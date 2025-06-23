# 🕵️‍♂️ Coup Clone – Multiplayer Browser Game

A real-time, browser-based party card game inspired by *Coup*. Bluff, strategize, and eliminate your opponents in a game of deception and deduction.

This project is built for learning and experimenting with multiplayer game architecture using modern web technologies.

---

## 🎮 Gameplay Features

- ✅ Real-time multiplayer (room-based)
- ✅ Player roles and actions inspired by *Coup*
- ✅ Food-based economy (custom theme variant)
- ✅ Turn-based logic ("Hunts" instead of turns)
- ✅ Bluffing and counteraction mechanics
- ✅ Central food pool ("Mountain of Food") instead of coins

---

## 🧱 Tech Stack

- **Frontend:** React.js + Tailwind CSS
- **Backend:** Node.js + Express + Socket.IO
- **Game State:** Managed server-side via websockets
- **Deployment:** Vercel (Frontend) + Render / Railway / Heroku (Backend)

---

## 📁 Folder Structure

```bash
/
├── client/              # React frontend
│   ├── src/components/  # UI components
│   └── src/pages/       # Game lobby, room, etc.
├── server/              # Node.js + Socket.IO game server
│   ├── game/            # Core game logic (roles, hunts, food pool)
│   └── routes/          # API endpoints (if any)
├── package.json
└── README.md
