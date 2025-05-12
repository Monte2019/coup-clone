import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoom = urlParams.get("room") || "";

  const [roomCode, setRoomCode] = useState(initialRoom);
  const [inRoom, setInRoom] = useState(false);
  const [playerList, setPlayerList] = useState([]);
  const [playerName, setPlayerName] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [myRoles, setMyRoles] = useState([]);
  const [myRoll, setMyRoll] = useState(null);
  const [firstHunter, setFirstHunter] = useState(null);
  const [yourFood, setYourFood] = useState(0);
  const [sharedFood, setSharedFood] = useState(0);
  const [allPlayerFoods, setAllPlayerFoods] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [allReady, setAllReady] = useState(false);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
    });

    socket.on("roomPlayers", (names) => {
      setPlayerList(names);
    });

    socket.on("gameStarted", () => {
      setGameStarted(true);
    });

    socket.on("yourRoll", ({ roll }) => {
      setMyRoll(roll);
    });

    socket.on("firstHunt", ({ playerId, playerName }) => {
      setFirstHunter(playerName);
    });

    socket.on("initFood", ({ yourFood, sharedFood, playerFoods }) => {
      setYourFood(yourFood);
      setSharedFood(sharedFood);
      setAllPlayerFoods(playerFoods);
    });

    socket.on("readyUpdate", ({ names, allReady }) => {
      setReadyPlayers(names);
      setAllReady(allReady);
    });

    return () => {
      socket.off("connect");
      socket.off("roomPlayers");
      socket.off("gameStarted");
      socket.off("yourRoles");
      socket.off("yourRoll");
      socket.off("firstHunt");
      socket.off("initFood");
      socket.off("readyUpdate");
    };
  }, []);

  const createRoom = () => {
    socket.emit("createRoom", { name: playerName }, (response) => {
      if (response.success) {
        setRoomCode(response.roomCode);
        setIsHost(response.isHost); // ✅ correct here
        setInRoom(true);
      }
    });
  };

  const joinRoom = () => {
    socket.emit("joinRoom", { roomCode, name: playerName }, (response) => {
      if (response.success) {
        setIsHost(response.isHost); // ✅ correct here
        setInRoom(true);
      } else {
        alert(response.message);
      }
    });
  };

  return (
    <div>
      {!inRoom ? (
        <>
          <h1>🐾 Predator's Bluff</h1>

          <input
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <br /><br />

          <button onClick={createRoom}>Create Room</button>
          <br /><br />

          <input
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </>
      ) : (
        <>
          <h2>In Room: {roomCode}</h2>
          <h3>Players:</h3>
          <ul>
            {playerList.map((name, idx) => (
              <li key={idx}>{name}</li>
            ))}
          </ul>

          <input
            type="text"
            value={`${window.location.origin}?room=${roomCode}`}
            readOnly
            onClick={(e) => e.target.select()}
          />

          {!isHost && !gameStarted && (
            <button onClick={() => socket.emit("playerReady")}>
              I'm Ready
            </button>
          )}

          {isHost && readyPlayers.length > 0 && (
            <>
              <h4>Players Ready:</h4>
              <ul>
                {readyPlayers.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </>
          )}

          {isHost && !gameStarted && (
            <button
              onClick={() => socket.emit("startGame", { roomCode })}
              disabled={!allReady}
            >
              Start Game
            </button>
          )}

          {gameStarted && (
            <>
              <h3>Game Started!</h3>

              <h4>🍖 Your Food: {yourFood}</h4>
              <h4>🗻 Mountain of Food: {sharedFood}</h4>

              <h4>Other Players' Food:</h4>
              <ul>
                {allPlayerFoods.map((p, i) => (
                  <li key={i}>{p.name}: {p.food}</li>
                ))}
              </ul>

              <h4>Your Animal Roles:</h4>
              <ul>
                {myRoles.map((role, idx) => (
                  <li key={idx}>{role}</li>
                ))}
              </ul>

              {myRoll && <p>You rolled a {myRoll} 🎲</p>}
              {firstHunter && <p>First to hunt: {firstHunter}</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
