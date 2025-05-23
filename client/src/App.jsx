// client/src/App.jsx

import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Home";             // your landing page
import Room from "./Room";             // the lobby view
import Game from "./Game";             // the game screen

export default function App() {
  return (
    <Routes>
      <Route path="/"               element={<Home />} />
      <Route path="/room/:roomCode" element={<Room />} />
      <Route path="/game/:roomCode" element={<Game />} />
    </Routes>
  );
}
