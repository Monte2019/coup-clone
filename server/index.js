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

// ========== Game State ==========
const rooms = {};         // { roomCode: [socket.id, ...] }
const players = {};       // { socket.id: { name, roomCode, host? } }
const readyStatus = {};   // { roomCode: Set(socket.id, ...) }

const ROLE_DECK = [
  "Lion", "Lion", "Lion",
  "Cobra", "Cobra", "Cobra",
  "Raven", "Raven", "Raven",
  "Owl", "Owl", "Owl",
  "Panther", "Panther", "Panther"
];

// ========== Helpers ==========
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

// ========== Socket Events ==========
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
        names: readyNames,
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
      // Remove from room and ready list
      rooms[roomCode] = room.filter(id => id !== socket.id);
      if (readyStatus[roomCode]) {
        readyStatus[roomCode].delete(socket.id);
      }

      delete players[socket.id];
      emitRoomPlayers(roomCode);

      const hostId = rooms[roomCode].find(id => players[id]?.host);
      if (hostId && readyStatus[roomCode]) {
        const readyNames = [...readyStatus[roomCode]].map(id => players[id]?.name || "Unnamed");
        const readyCount = readyStatus[roomCode].size;
        const requiredReady = getNonHostPlayerCount(roomCode);

        io.to(hostId).emit("readyUpdate", {
          names: readyNames,
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

    const sockets = rooms[roomCode];
    if (!sockets) return;

    // Shuffle and assign roles
    const shuffled = [...ROLE_DECK].sort(() => Math.random() - 0.5);
    const assignments = {};
    sockets.forEach((socketId) => {
      assignments[socketId] = [shuffled.pop(), shuffled.pop()];
    });

    Object.entries(assignments).forEach(([id, roles]) => {
      io.to(id).emit("yourRoles", roles);
    });

    // Determine first hunter via d20 roll
    const rolls = {};
    let highest = 0;
    let firstHunterId = null;

    sockets.forEach((id) => {
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
      playerId: firstHunterId,
      playerName: players[firstHunterId]?.name || "Unknown"
    });

    // Initialize food
    const playerFood = {};
    let sharedFood = 50;

    sockets.forEach((id) => {
      playerFood[id] = 2;
    });

    sockets.forEach((id) => {
      io.to(id).emit("initFood", {
        yourFood: playerFood[id],
        sharedFood,
        playerFoods: sockets.map(pid => ({
          name: players[pid].name,
          food: playerFood[pid]
        }))
      });
    });

    // Clear readiness
    delete readyStatus[roomCode];

    io.to(roomCode).emit("gameStarted");
  });
});

// ========== Server Start ==========
httpServer.listen(3001, () => {
  console.log("Server listening on port 3001");
});
