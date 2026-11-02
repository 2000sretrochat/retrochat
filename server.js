// RetroChat server. Auth hook: replace `identify()` later for accounts; media hook: add /api/media-token for LiveKit.
const express = require('express'), http = require('http'), { Server } = require('socket.io');
const app = express(), server = http.createServer(app), io = new Server(server, { maxHttpBufferSize: 1e4 });
const ROOMS = { 'Lobby':'General','Friends':'General','Music':'Entertainment','Movies & TV':'Entertainment','Romance':'Romance','Over 40':'Romance','Arizona':'Regional','Texas':'Regional','Sports':'Hobbies','Gaming':'Hobbies' };
const MAXLEN = 300, HIST = 50, COLORS = ['#000000','#ff0000','#0000ff','#008000','#800080','#ff6600','#008080','#990033'];
const users = new Map(); // lower(name) -> socket.id
const history = Object.fromEntries(Object.keys(ROOMS).map(r => [r, []]));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.use(express.static(__dirname + '/public'));
app.get('/healthz', (q, r) => r.send('ok'));
app.get('/api/rooms', (q, r) => r.json(Object.entries(ROOMS).map(([name, cat]) => ({ name, cat, count: members(name).length }))));
function members(room) { return [...io.sockets.adapter.rooms.get(room) || []].map(id => io.sockets.sockets.get(id)?.data.name).filter(Boolean).sort((a,b)=>a.localeCompare(b)); }
function push(room, m) { history[room].push(m); if (history[room].length > HIST) history[room].shift(); io.to(room).emit('msg', m); }
io.on('connection', s => {
  let stamps = [];
  s.on('login', ({ name, room }, cb) => {
    name = String(name || '').trim();
    if (!/^[A-Za-z0-9_.\-]{3,20}$/.test(name)) return cb({ error: 'Screen names must be 3-20 letters, numbers, _ . or -' });
    if (!ROOMS[room]) return cb({ error: 'Unknown room' });
    if (s.data.name) return cb({ error: 'Already signed in' });
    if (users.has(name.toLowerCase())) return cb({ error: 'That screen name is in use right now. Try another.' });
    users.set(name.toLowerCase(), s.id); s.data.name = name; join(room); cb({ ok: true, name, colors: COLORS });
  });
  function join(room) {
    if (s.data.room) { s.leave(s.data.room); push(s.data.room, { sys: true, text: `${esc(s.data.name)} has left the room.` }); io.to(s.data.room).emit('members', members(s.data.room)); }
    s.data.room = room; s.join(room); s.emit('history', { room, msgs: history[room] });
    push(room, { sys: true, text: `${esc(s.data.name)} has joined the room.` }); io.to(room).emit('members', members(room));
  }
  s.on('join', room => { if (s.data.name && ROOMS[room] && room !== s.data.room) join(room); });
  s.on('say', m => {
    if (!s.data.name || !m) return;
    const now = Date.now(); stamps = stamps.filter(t => now - t < 10000);
    if (stamps.length >= 5) return s.emit('msg', { sys: true, text: 'You are sending messages too fast. Slow down.' });
    stamps.push(now);
    const text = String(m.text || '').trim().slice(0, MAXLEN); if (!text) return;
    push(s.data.room, { name: esc(s.data.name), text: esc(text), color: COLORS.includes(m.color) ? m.color : '#000000', b: !!m.b, i: !!m.i, t: now });
  });
  s.on('disconnect', () => { if (!s.data.name) return; users.delete(s.data.name.toLowerCase());
    if (s.data.room) { push(s.data.room, { sys: true, text: `${esc(s.data.name)} has left the room.` }); io.to(s.data.room).emit('members', members(s.data.room)); } });
});
server.listen(process.env.PORT || 3000, () => console.log('RetroChat on', process.env.PORT || 3000));
