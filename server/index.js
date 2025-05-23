import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);
app.use(cors());

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// ========== Game State ===========
const rooms = {};         // { roomCode: [socket.id, ...] }
const players = {};       // { socket.id: { name, roomCode, host?, cards: [], revealed: [], food } }
const readyStatus = {};   // { roomCode: Set(socket.id, ...) }

// Role deck (3 copies of each animal)
const ROLE_DECK = [
  "Lion","Lion","Lion",
  "Cobra","Cobra","Cobra",
  "Raven","Raven","Raven",
  "Owl","Owl","Owl",
  "Panther","Panther","Panther"
];

// Persistent shuffled deck per room
const roomDecks = {};     // { roomCode: [...cards] }

// ========== Helpers ===========
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms[code]);
  return code;
}

function emitRoomPlayers(roomCode) {
  const sockets = rooms[roomCode] || [];
  const playerNames = sockets.map(id => players[id]?.name || "Unnamed");
  io.to(roomCode).emit("roomPlayers", playerNames);
}

function getNonHostPlayerCount(roomCode) {
  const socketIds = rooms[roomCode] || [];
  return socketIds.filter(id => !players[id]?.host).length;
}

// Fisher–Yates shuffle
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Reveal one of the player’s cards without replacing it
function loseCard(socketId, cardIndex) {
  const player   = players[socketId];
  const roomCode = player.roomCode;

  // Remove that card from hidden hand
  const [lost] = player.cards.splice(cardIndex, 1);

  // Track it as revealed (face-up)
  player.revealed.push(lost);

  // Notify the affected player
  io.to(socketId).emit("cardLost", lost);

  // Broadcast to room who lost which animal
  io.to(roomCode).emit("playerLostCard", {
    playerId:   socketId,
    lostAnimal: lost
  });
}

// ========== Socket Events ===========
io.on("connection", (socket) => {

  // --- Room Creation ---
  socket.on("createRoom", ({ name }, cb) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = [socket.id];
    players[socket.id] = { name, roomCode, host: true };
    socket.join(roomCode);
    emitRoomPlayers(roomCode);
    cb({ success: true, roomCode, isHost: true });
  });

  // --- Join Room ---
  socket.on("joinRoom", ({ roomCode, name }, cb) => {
    const room = rooms[roomCode];
    if (room && room.length < 6) {
      room.push(socket.id);
      players[socket.id] = { name, roomCode };
      socket.join(roomCode);
      emitRoomPlayers(roomCode);
      cb({ success: true, isHost: false });
    } else {
      cb({ success: false, message: "Room full or not found." });
    }
  });

  // --- Player Ready ---
  socket.on("playerReady", () => {
    const player = players[socket.id];
    if (!player) return;

    const roomCode = player.roomCode;
    if (!readyStatus[roomCode]) {
      readyStatus[roomCode] = new Set();
    }

    readyStatus[roomCode].add(socket.id);

    const hostId = rooms[roomCode].find(id => players[id]?.host);
    const readyNames = [...readyStatus[roomCode]].map(id => players[id]?.name || "Unnamed");

    const readyCount = readyStatus[roomCode].size;
    const requiredReadyCount = getNonHostPlayerCount(roomCode);

    if (hostId) {
      io.to(hostId).emit("readyUpdate", {
        names:    readyNames,
        allReady: readyCount === requiredReadyCount
      });
    }
  });

  // --- Player Disconnect ---
  socket.on("disconnect", () => {
    const player = players[socket.id];
    if (!player) return;

    const { roomCode } = player;
    const room = rooms[roomCode];

    if (room) {
      rooms[roomCode] = room.filter(id => id !== socket.id);
      if (readyStatus[roomCode]) readyStatus[roomCode].delete(socket.id);

      delete players[socket.id];
      emitRoomPlayers(roomCode);

      const hostId = rooms[roomCode].find(id => players[id]?.host);
      if (hostId && readyStatus[roomCode]) {
        const readyNames = [...readyStatus[roomCode]].map(id => players[id]?.name || "Unnamed");
        const readyCount = readyStatus[roomCode].size;
        const requiredReady = getNonHostPlayerCount(roomCode);

        io.to(hostId).emit("readyUpdate", {
          names:    readyNames,
          allReady: readyCount === requiredReady
        });
      }
    }
  });

  // --- Start Game ---
  socket.on("startGame", ({ roomCode }) => {
    const player = players[socket.id];
    if (!player || player.roomCode !== roomCode || !player.host) {
      delete readyStatus[roomCode];
      return;
    }

    const socketsArr = rooms[roomCode];
    if (!socketsArr) return;

    // Build & shuffle deck for this room
    const deck = [...ROLE_DECK];
    shuffle(deck);
    roomDecks[roomCode] = deck;

    // Deal 2 cards to each player & init revealed and food
    socketsArr.forEach((id) => {
      const card1 = deck.pop();
      const card2 = deck.pop();
      players[id].cards    = [card1, card2];
      players[id].revealed = [];
      players[id].food     = 2;
    });

    // Emit private roles
    socketsArr.forEach((id) => {
      io.to(id).emit("yourRoles", players[id].cards);
    });

    // Determine first hunter via d20 roll
    const rolls = {};
    let highest = 0;
    let firstHunterId = null;

    socketsArr.forEach((id) => {
      const roll = Math.floor(Math.random() * 20) + 1;
      rolls[id] = roll;
      if (roll > highest) {
        highest = roll;
        firstHunterId = id;
      }
    });

    Object.entries(rolls).forEach(([id, roll]) => {
      io.to(id).emit("yourRoll", { roll });
    });

    io.to(roomCode).emit("firstHunt", {
      playerId:   firstHunterId,
      playerName: players[firstHunterId]?.name || "Unknown"
    });

    // Initialize shared & player food
    const sharedFood = 50;
    socketsArr.forEach((id) => {
      io.to(id).emit("initFood", {
        yourFood:     players[id].food,
        sharedFood,
        playerFoods:  socketsArr.map(pid => ({
          name: players[pid].name,
          food: players[pid].food
        }))
      });
    });

    // Clear ready status and notify game start
    delete readyStatus[roomCode];
    io.to(roomCode).emit("gameStarted");
  });

  // --- Example action hooks for lose life ---
  socket.on("assassinate", ({ targetId, cardIndex }) => {
    loseCard(targetId, cardIndex);
  });

  socket.on("coup", ({ targetId, cardIndex }) => {
    loseCard(targetId, cardIndex);
  });

});

// ========== Server Start ===========
httpServer.listen(3001, () => {
  console.log("Server listening on port 3001");
});
