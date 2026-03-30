import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const socket = io({ autoConnect: false })

function colorFromId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360} 80% 55%)`
}

export default function App() {
  const [joined, setJoined] = useState(false)
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('global')
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [notifications, setNotifications] = useState([])
  const [notifTitle, setNotifTitle] = useState('')
  const [notifBody, setNotifBody] = useState('')
  const [counter, setCounter] = useState(0)
  const [users, setUsers] = useState([])
  const [typingUser, setTypingUser] = useState('')

  const canvasRef = useRef(null)
  const cursorsRef = useRef({})
  const localCursorRef = useRef({ x: 0, y: 0 })
  const typingTimer = useRef(null)
  const messagesEndRef = useRef(null)

  // scroll chat to bottom
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    function draw() {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      Object.entries(cursorsRef.current).forEach(([id, c]) => {
        if (Date.now() - c.time > 5000) { delete cursorsRef.current[id]; return }
        ctx.beginPath()
        ctx.arc(c.x * canvas.width, c.y * canvas.height, 6, 0, Math.PI * 2)
        ctx.fillStyle = colorFromId(id)
        ctx.fill()
        ctx.font = '12px sans-serif'
        ctx.fillStyle = '#fff'
        ctx.fillText(c.user || 'Anon', c.x * canvas.width + 9, c.y * canvas.height + 4)
      })

      const lc = localCursorRef.current
      ctx.beginPath()
      ctx.arc(lc.x * canvas.width, lc.y * canvas.height, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#3b82f6'
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // socket events
  useEffect(() => {
    socket.on('chatMessage', (p) => {
      setMessages(m => [...m, p])
      if (Notification.permission === 'granted')
        new Notification(`💬 ${p.from}`, { body: p.message, silent: false })
    })
    socket.on('notification', (p) => {
      setNotifications(n => [p, ...n])
      if (Notification.permission === 'granted')
        new Notification(p.title || p.message || 'Notification', { body: p.body || '' })
    })
    socket.on('counterUpdate', ({ counter }) => setCounter(counter))
    socket.on('roomData', ({ users, counter }) => { setUsers(users); setCounter(counter) })
    socket.on('typing', ({ user, typing }) => setTypingUser(typing ? user : ''))
    socket.on('remoteCursor', ({ id, x, y, user }) => { cursorsRef.current[id] = { x, y, user, time: Date.now() } })
    socket.on('roomSnapshot', ({ users, counter }) => { setUsers(users); setCounter(counter) })

    return () => socket.removeAllListeners()
  }, [])

  const join = () => {
    socket.connect()
    socket.emit('joinRoom', { roomId, username: username || undefined })
    socket.emit('getRoomSnapshot', { roomId })
    if (Notification.permission === 'default') Notification.requestPermission()
    setJoined(true)
  }

  const leave = () => {
    socket.disconnect()
    setJoined(false)
    setMessages([])
    setNotifications([])
    setUsers([])
    setCounter(0)
  }

  const sendMessage = (e) => {
    e.preventDefault()
    if (!msgInput.trim()) return
    socket.emit('chatMessage', { roomId, message: msgInput })
    setMsgInput('')
  }

  const handleTyping = (e) => {
    setMsgInput(e.target.value)
    socket.emit('typing', { roomId, typing: true })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => socket.emit('typing', { roomId, typing: false }), 700)
  }

  const sendNotif = () => {
    if (!notifTitle && !notifBody) return
    socket.emit('notify', { roomId, title: notifTitle, body: notifBody })
    setNotifTitle(''); setNotifBody('')
  }

  const onCanvasMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    localCursorRef.current = { x, y }
    if (joined) socket.emit('cursorMove', { roomId, x, y })
  }, [joined, roomId])

  return (
    <div style={s.app}>
      <h2 style={s.title}>⚡ Realtime App</h2>

      {/* Join / Leave */}
      <div style={s.card}>
        <input style={s.input} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} disabled={joined} />
        <input style={s.input} placeholder="Room (default: global)" value={roomId} onChange={e => setRoomId(e.target.value)} disabled={joined} />
        {!joined
          ? <button style={s.btn} onClick={join}>Join</button>
          : <button style={{...s.btn, background:'#ef4444'}} onClick={leave}>Leave</button>
        }
        {joined && <span style={s.badge}>Room: {roomId} | Users: {users.join(', ') || '—'}</span>}
      </div>

      <div style={s.grid} className="grid">
        {/* Chat */}
        <div style={s.card}>
          <b>Chat</b>
          <div style={s.msgBox}>
            {messages.map((m, i) => (
              <div key={i} style={s.msg}>
                <span style={s.meta}>{m.from} · {new Date(m.time).toLocaleTimeString()}</span>
                <div>{m.message}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          {typingUser && <div style={s.typing}>{typingUser} is typing…</div>}
          <form onSubmit={sendMessage} style={s.row}>
            <input style={{...s.input, flex:1}} placeholder="Message…" value={msgInput} onChange={handleTyping} disabled={!joined} />
            <button style={s.btn} disabled={!joined}>Send</button>
          </form>
        </div>

        {/* Right column */}
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {/* Counter */}
          <div style={s.card}>
            <b>Live Counter</b>
            <div style={s.counter}>{counter}</div>
            <button style={s.btn} onClick={() => socket.emit('increment', { roomId })} disabled={!joined}>+1</button>
          </div>

          {/* Notifications */}
          <div style={s.card}>
            <b>Notifications</b>
            <input style={s.input} placeholder="Title" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} disabled={!joined} />
            <input style={s.input} placeholder="Body" value={notifBody} onChange={e => setNotifBody(e.target.value)} disabled={!joined} />
            <button style={s.btn} onClick={sendNotif} disabled={!joined}>Send Notification</button>
            <div style={s.notifBox}>
              {notifications.map((n, i) => (
                <div key={i} style={s.notif}>
                  <span style={s.meta}>{n.from || 'System'} · {new Date(n.time).toLocaleTimeString()}</span>
                  <div><b>{n.title || n.message}</b> {n.body && <span>— {n.body}</span>}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Shared Canvas */}
      <div style={s.card}>
        <b>Shared Canvas (move your cursor here)</b>
        <canvas ref={canvasRef} onPointerMove={onCanvasMove} style={s.canvas} />
      </div>
    </div>
  )
}

const s = {
  app: { maxWidth: 900, margin: '0 auto', padding: 16, fontFamily: 'sans-serif', color: '#e2e8f0', background: '#0f172a', minHeight: '100vh' },
  title: { textAlign: 'center', marginBottom: 12 },
  card: { background: '#1e293b', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: '8px 10px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 15, width: '100%' },
  btn: { padding: '8px 14px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 15 },
  badge: { fontSize: 12, color: '#94a3b8' },
  row: { display: 'flex', gap: 8 },
  msgBox: { height: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: 4 },
  msg: { background: '#0f172a', borderRadius: 6, padding: '6px 10px', fontSize: 14 },
  meta: { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 2 },
  typing: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  counter: { fontSize: 48, fontWeight: 700, textAlign: 'center', color: '#3b82f6' },
  notifBox: { maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
  notif: { background: '#0f172a', borderRadius: 6, padding: '4px 8px', fontSize: 13 },
  canvas: { width: '100%', height: 200, borderRadius: 6, background: '#0f172a', cursor: 'crosshair', display: 'block' },
}
