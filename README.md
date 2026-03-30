# Realtime App — Socket.IO + Express + React

A full-stack realtime demo app with chat rooms, live counter, typing indicators, push notifications, and a multiplayer shared canvas.

---

## Features

- Chat with rooms — join any named room, messages are isolated per room
- Typing indicator — shows when another user is typing
- Live counter — shared state incremented by any user in the room
- In-app + OS notifications — triggers Windows/browser push notifications on new messages and events
- Multiplayer shared canvas — see other users' cursor positions in real time
- Mobile responsive — works on phones via local network IP

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Server   | Node.js, Express, Socket.IO v4    |
| Client   | React 18, Vite 5, socket.io-client|
| Styling  | Inline styles + CSS (no framework)|

---

## Project Structure

```
realtime app/
├── client/                   # React frontend (Vite)
│   ├── public/
│   ├── src/
│   │   ├── App.jsx           # All UI + socket logic
│   │   ├── main.jsx          # React entry point
│   │   └── index.css         # Global styles + responsive grid
│   ├── index.html
│   ├── package.json          # React deps (react, vite, socket.io-client)
│   └── vite.config.js        # Vite config + proxy to backend
├── public/                   # Legacy static files (unused in React mode)
├── server.js                 # Express + Socket.IO server
├── package.json              # Server deps + concurrently script
├── .env                      # Environment variables (PORT etc.)
└── README.md
```

---

## Requirements

- Node.js 18+
- npm

---

## First-Time Setup

### 1. Install server dependencies
```powershell
cd "realtime app"
npm install
```

### 2. Install client dependencies
```powershell
cd "realtime app/client"
npm install
```

---

## Running the App

You need **two terminals** running simultaneously.

### Terminal 1 — Backend (Express + Socket.IO)
```powershell
cd "f:\notes\Web development Roadmap\Full stack projects\realtime app"
node server.js
```
Runs on: `http://localhost:3000`

### Terminal 2 — Frontend (React + Vite)
```powershell
cd "f:\notes\Web development Roadmap\Full stack projects\realtime app\client"
npx vite
```
Runs on: `http://localhost:5173`

> Vite automatically proxies all `/socket.io` requests to the backend on port 3000 — no manual config needed.

---

## Accessing from Phone (Same WiFi)

1. Find your PC's local IP:
   ```powershell
   ipconfig
   ```
   Look for `IPv4 Address` under Wi-Fi — e.g. `10.18.41.251`

2. Open on your phone:
   ```
   http://10.18.41.251:5173
   ```

3. If it doesn't load, allow the ports through Windows Firewall (run as Administrator):
   ```powershell
   netsh advfirewall firewall add rule name="Vite 5173" dir=in action=allow protocol=TCP localport=5173
   netsh advfirewall firewall add rule name="Node 3000" dir=in action=allow protocol=TCP localport=3000
   ```

---

## Simulating Multiple Users

- Open `http://localhost:5173` in multiple browser tabs
- Enter different usernames and the same room name
- All users in the same room share chat, counter, canvas and notifications

To test isolated rooms, use different room names (e.g. `room1`, `room2`).

---

## OS Notifications

- The browser will ask for notification permission on Join
- Every incoming chat message fires a native OS/browser notification: `💬 Username — message`
- Join/leave events also trigger notifications
- Notifications only appear when the browser tab is in the background (browser behaviour)

---

## Environment Variables

Create a `.env` file at the root (already exists):

```
PORT=3000
```

---

## Socket.IO Events Reference

| Event            | Direction         | Description                        |
|------------------|-------------------|------------------------------------|
| `joinRoom`       | client → server   | Join a named room with username    |
| `chatMessage`    | both              | Send / receive a chat message      |
| `typing`         | both              | Typing indicator start/stop        |
| `increment`      | client → server   | Increment the shared counter       |
| `counterUpdate`  | server → client   | Broadcast updated counter value    |
| `notify`         | both              | Send a custom notification         |
| `notification`   | server → client   | Receive a notification             |
| `cursorMove`     | client → server   | Send local cursor position         |
| `remoteCursor`   | server → client   | Receive another user's cursor      |
| `roomData`       | server → client   | Updated user list + counter        |
| `getRoomSnapshot`| client → server   | Request current room state         |
| `roomSnapshot`   | server → client   | Initial room state on connect      |
