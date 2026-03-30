// server.js (CommonJS)
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Basic health route
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

/**
 * In-memory state for demo purposes.
 * For production use persistent stores (Redis, DB).
 */
const rooms = {}; // { roomId: { users: {socketId: username}, counter: number } }

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // attach default meta
  socket.data.username = `User-${socket.id.slice(0,5)}`;

  // join room (default 'global')
  socket.on('joinRoom', ({ roomId = 'global', username } = {}) => {
    if (username) socket.data.username = username;
    socket.join(roomId);
    rooms[roomId] = rooms[roomId] || { users: {}, counter: 0, cursors: {} };

    rooms[roomId].users[socket.id] = socket.data.username;

    // notify others
    socket.to(roomId).emit('notification', {
      type: 'join',
      message: `${socket.data.username} joined ${roomId}`,
      time: Date.now()
    });

    // update user list
    io.in(roomId).emit('roomData', {
      roomId,
      users: Object.values(rooms[roomId].users),
      counter: rooms[roomId].counter
    });

    console.log(`${socket.data.username} joined ${roomId}`);
  });

  // chat message
  socket.on('chatMessage', ({ roomId = 'global', message }) => {
    const payload = {
      from: socket.data.username,
      message,
      time: Date.now()
    };
    io.in(roomId).emit('chatMessage', payload);
  });

  // notification (manual trigger)
  socket.on('notify', ({ roomId = 'global', title, body }) => {
    const payload = { from: socket.data.username, title, body, time: Date.now() };
    io.in(roomId).emit('notification', payload);
  });

  // live counter increment
  socket.on('increment', ({ roomId = 'global' } = {}) => {
    rooms[roomId] = rooms[roomId] || { users: {}, counter: 0, cursors: {} };
    rooms[roomId].counter++;
    io.in(roomId).emit('counterUpdate', { counter: rooms[roomId].counter });
  });

  // typing indicator
  socket.on('typing', ({ roomId = 'global', typing }) => {
    socket.to(roomId).emit('typing', { user: socket.data.username, typing });
  });

  // multiplayer: cursor positions on a shared canvas
  socket.on('cursorMove', ({ roomId = 'global', x, y }) => {
    rooms[roomId] = rooms[roomId] || { users: {}, counter: 0, cursors: {} };
    rooms[roomId].cursors[socket.id] = { x, y, user: socket.data.username, time: Date.now() };
    // broadcast to all except sender
    socket.to(roomId).emit('remoteCursor', { id: socket.id, x, y, user: socket.data.username });
  });

  // request initial room snapshot
  socket.on('getRoomSnapshot', ({ roomId = 'global' } = {}) => {
    rooms[roomId] = rooms[roomId] || { users: {}, counter: 0, cursors: {} };
    socket.emit('roomSnapshot', {
      users: Object.values(rooms[roomId].users),
      counter: rooms[roomId].counter,
      cursors: rooms[roomId].cursors
    });
  });

  socket.on('disconnecting', () => {
    const joinedRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    joinedRooms.forEach(roomId => {
      if (rooms[roomId] && rooms[roomId].users) {
        delete rooms[roomId].users[socket.id];
        delete rooms[roomId].cursors?.[socket.id];
        socket.to(roomId).emit('notification', {
          type: 'leave',
          message: `${socket.data.username} left ${roomId}`,
          time: Date.now()
        });
        io.in(roomId).emit('roomData', {
          roomId,
          users: Object.values(rooms[roomId].users),
          counter: rooms[roomId].counter
        });
      }
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', socket.id, reason);
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
