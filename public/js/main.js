// main.js - client side
const socket = io(); // connect to same origin

// UI elements
const usernameInput = document.getElementById('username');
const roomIdInput = document.getElementById('roomId');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');

const messagesDiv = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const msgInput = document.getElementById('msgInput');
const typingDiv = document.getElementById('typing');

const notificationsDiv = document.getElementById('notifications');
const notifTitle = document.getElementById('notifTitle');
const notifBody = document.getElementById('notifBody');
const sendNotifBtn = document.getElementById('sendNotifBtn');

const incBtn = document.getElementById('incBtn');
const counterValue = document.getElementById('counterValue');
const roomInfo = document.getElementById('roomInfo');

// Canvas
const canvas = document.getElementById('sharedCanvas');
const ctx = canvas.getContext('2d');
let canvasWidth, canvasHeight;
function resizeCanvas() {
  canvasWidth = canvas.width = canvas.clientWidth * devicePixelRatio;
  canvasHeight = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
}
resizeCanvas();
window.addEventListener('resize', () => {
  // clear transforms then resize
  ctx.setTransform(1,0,0,1,0,0);
  resizeCanvas();
});

// local state
let currentRoom = null;
let typingTimer = null;

// utilities
function appendMessage({ from, message, time }) {
  const d = new Date(time || Date.now());
  const el = document.createElement('div');
  el.className = 'msg';
  el.innerHTML = `<div class="meta">${from} • ${d.toLocaleTimeString()}</div><div>${escapeHtml(message)}</div>`;
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function appendNotification({ from, title, body, message, type, time }) {
  const d = new Date(time || Date.now());
  const el = document.createElement('div');
  el.className = 'notif';
  if (title || body) {
    el.innerHTML = `<div class="meta">${from || 'System'} • ${d.toLocaleTimeString()}</div><div><strong>${escapeHtml(title||'')}</strong><div>${escapeHtml(body||'')}</div></div>`;
  } else {
    el.innerHTML = `<div class="meta">${escapeHtml(message||'')} • ${d.toLocaleTimeString()}</div>`;
  }
  notificationsDiv.prepend(el);
}

// escape HTML
function escapeHtml(s='') { return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// join room
joinBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim() || undefined;
  const room = roomIdInput.value.trim() || 'global';
  currentRoom = room;
  socket.emit('joinRoom', { roomId: room, username: name });
  joinBtn.disabled = true;
  leaveBtn.disabled = false;
  roomInfo.innerText = `Joined: ${room}`;
});

// leave
leaveBtn.addEventListener('click', () => {
  if (!currentRoom) return;
  // leaving is achieved by reloading or disconnecting; for demo, we'll disconnect and reconnect fresh
  socket.emit('notify', { roomId: currentRoom, title: 'Left', body: `${usernameInput.value || 'A user'} left.` });
  socket.disconnect();
  setTimeout(() => {
    location.reload(); // simple UX: reload to reset state
  }, 200);
});

// chat send
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = msgInput.value.trim();
  if (!message) return;
  socket.emit('chatMessage', { roomId: currentRoom || 'global', message });
  msgInput.value = '';
});

// quick increment
incBtn.addEventListener('click', () => {
  socket.emit('increment', { roomId: currentRoom || 'global' });
});

// send custom notification
sendNotifBtn.addEventListener('click', () => {
  const title = notifTitle.value.trim();
  const body = notifBody.value.trim();
  if (!title && !body) return;
  socket.emit('notify', { roomId: currentRoom || 'global', title, body });
  notifTitle.value = '';
  notifBody.value = '';
});

// typing indicator
msgInput.addEventListener('input', () => {
  socket.emit('typing', { roomId: currentRoom || 'global', typing: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('typing', { roomId: currentRoom || 'global', typing: false });
  }, 700);
});

// socket events
socket.on('connect', () => {
  console.log('connected', socket.id);
});

socket.on('chatMessage', (payload) => {
  appendMessage(payload);
});

socket.on('notification', (payload) => {
  appendNotification(payload);
  // also try Web Notification API
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(payload.title || payload.message || 'Notification', { body: payload.body || '' });
  } else if (window.Notification && Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(payload.title || payload.message || 'Notification', { body: payload.body || '' });
    });
  }
});

socket.on('counterUpdate', ({ counter }) => {
  counterValue.innerText = counter;
});

socket.on('roomData', ({ roomId, users, counter }) => {
  roomInfo.innerText = `Room: ${roomId}\nUsers: ${users.join(', ') || 'none'}\nCounter: ${counter}`;
});

socket.on('typing', ({ user, typing }) => {
  typingDiv.innerText = typing ? `${user} is typing...` : '';
});

// handle snapshot for initial state
socket.on('roomSnapshot', (snapshot) => {
  if (snapshot.counter != null) counterValue.innerText = snapshot.counter;
  if (snapshot.users) roomInfo.innerText = `Users: ${snapshot.users.join(', ')}`;
});

// Multiplayer canvas: draw local cursor and remote cursors
const cursors = {}; // { socketId: { x, y, user, lastSeen } }
let localCursor = { x: 0, y:0 };
let drawLoopRunning = false;

function drawCanvas() {
  // clear
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  // draw remote cursors
  Object.entries(cursors).forEach(([id, c], idx) => {
    // fade old cursors
    if (Date.now() - c.time > 5000) {
      delete cursors[id];
      return;
    }
    // draw a dot + label
    ctx.beginPath();
    ctx.arc(c.x * canvas.clientWidth, c.y * canvas.clientHeight, 6, 0, Math.PI * 2);
    ctx.fillStyle = colorFromId(id);
    ctx.fill();
    ctx.font = '12px Inter, Arial';
    ctx.fillText(c.user || 'Anon', c.x * canvas.clientWidth + 8, c.y * canvas.clientHeight + 4);
  });

  // draw local cursor (blue)
  ctx.beginPath();
  ctx.arc(localCursor.x * canvas.clientWidth, localCursor.y * canvas.clientHeight, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  requestAnimationFrame(drawCanvas);
}

// small color generator for remote cursors
function colorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 80% 55%)`;
}

// track pointer inside canvas and send normalized coords
canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  localCursor = { x: nx, y: ny };
  socket.emit('cursorMove', { roomId: currentRoom || 'global', x: nx, y: ny });
});

// receive remote cursor updates
socket.on('remoteCursor', ({ id, x, y, user }) => {
  cursors[id] = { x, y, user, time: Date.now() };
});

// start drawing loop when connected
if (!drawLoopRunning) {
  drawLoopRunning = true;
  requestAnimationFrame(drawCanvas);
}

// get initial snapshot on first connection
socket.on('connect', () => {
  socket.emit('getRoomSnapshot', { roomId: 'global' });
});
