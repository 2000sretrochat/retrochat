// Yapp Chat server (repo: retrochat). Auth hook: replace `identify()` later for accounts; media hook: add /api/media-token for LiveKit.
const express = require('express'), http = require('http'), { Server } = require('socket.io');
const app = express(), server = http.createServer(app), io = new Server(server, { maxHttpBufferSize: 1e5 });
const ROOMS = { 'Lobby':'General','Friends':'General','Chit Chat':'General','Late Night':'General' };
const TOPICS = { 'Lobby':'Welcome! Pull up a chair and say hi','Friends':'Make new friends and catch up with old ones','Chit Chat':'Talk about anything and everything','Late Night':'For the night owls - who else is still up?' };
const MAXLEN = 300, HIST = 50, COLORS = ['#000000','#ff0000','#0000ff','#008000','#800080','#ff6600','#008080','#990033'];
const users = new Map(); const VERSION = 'v3-classic'; // lower(name) -> socket.id
const history = Object.fromEntries(Object.keys(ROOMS).map(r => [r, []]));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.use(express.static(__dirname + '/public'));
app.get('/healthz', (q, r) => r.send('ok')); app.get('/api/version', (q, r) => r.json({ version: VERSION }));
app.get('/api/rooms', (q, r) => r.json(Object.entries(ROOMS).map(([name, cat]) => ({ name, cat, topic: TOPICS[name], count: members(name).length }))));
function socks(room) { return [...io.sockets.adapter.rooms.get(room) || []].map(id => io.sockets.sockets.get(id)).filter(x => x && x.data.name); }
function members(room) { return socks(room).map(x => x.data.name).sort((a,b)=>a.localeCompare(b)); }
function roster(room) { return socks(room).map(x => ({ name: x.data.name, id: x.id, cam: !!x.data.cam, talk: !!x.data.talk, voice: !!x.data.voice, viewers: x.data.cam ? [...(x.data.viewers||[])].map(v => io.sockets.sockets.get(v)?.data.name).filter(Boolean) : [] })).sort((a,b)=>a.name.localeCompare(b.name)); }
function upd(room) { if (room) io.to(room).emit('roster', roster(room)); }
const MAXVIEW = 6;
function push(room, m) { m.t = m.t || Date.now(); history[room].push(m); if (history[room].length > HIST) history[room].shift(); io.to(room).emit('msg', m); }
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
    const old = s.data.room; mediaReset(); if (old) upd(old);
    s.data.room = room; s.join(room); s.emit('history', { room, topic: TOPICS[room], msgs: history[room] });
    push(room, { sys: true, text: `${esc(s.data.name)} has joined the room.` }); io.to(room).emit('members', members(room)); upd(room);
  }
  s.on('join', room => { if (s.data.name && ROOMS[room] && room !== s.data.room) join(room); });
  s.on('say', m => {
    if (!s.data.name || !m) return;
    const now = Date.now(); stamps = stamps.filter(t => now - t < 10000);
    if (stamps.length >= 5) return s.emit('msg', { sys: true, text: 'You are sending messages too fast. Slow down.' });
    stamps.push(now);
    const text = String(m.text || '').trim().slice(0, MAXLEN); if (!text) return;
    const FONTS = ['Arial','Verdana','Tahoma','Comic Sans MS','Times New Roman','Courier New'];
    push(s.data.room, { name: esc(s.data.name), text: esc(text), color: COLORS.includes(m.color) ? m.color : '#000000', b: !!m.b, i: !!m.i, u: !!m.u, f: FONTS.includes(m.f) ? m.f : 'Arial', t: now });
  });
  function mediaReset() {
    const room = s.data.room; if (!room) return;
    io.to(room).emit('media-gone', { id: s.id });
    for (const x of socks(room)) x.data.viewers?.delete(s.id);
    s.data.cam = false; s.data.talk = false; s.data.voice = false; s.data.viewers = new Set();
  }
  const same = id => { const t = io.sockets.sockets.get(id); return t && t.data.name && t.data.room === s.data.room ? t : null; };
  s.on('voice', on => { if (!s.data.name) return; s.data.voice = !!on; if (!on) s.data.talk = false; upd(s.data.room); });
  s.on('talk', on => { if (!s.data.name || !s.data.voice) return; s.data.talk = !!on; upd(s.data.room); });
  s.on('cam', on => { if (!s.data.name) return; s.data.cam = !!on; if (!on) { io.to(s.data.room).emit('cam-off', { id: s.id }); s.data.viewers = new Set(); } upd(s.data.room); });
  s.on('view', (id, cb) => { const t = same(id); if (!t || !t.data.cam) return cb && cb({ error: 'That webcam is not available.' });
    t.data.viewers = t.data.viewers || new Set();
    if (!t.data.viewers.has(s.id) && t.data.viewers.size >= MAXVIEW) return cb && cb({ error: 'That webcam has the maximum number of viewers (' + MAXVIEW + ').' });
    t.data.viewers.add(s.id); t.emit('view-req', { id: s.id, name: s.data.name }); upd(s.data.room); cb && cb({ ok: true }); });
  s.on('unview', id => { const t = same(id); if (t && t.data.viewers?.delete(s.id)) { t.emit('unview', { id: s.id }); upd(s.data.room); } });
  s.on('signal', ({ to, data }) => { const t = same(to); if (t && data && JSON.stringify(data).length < 60000) t.emit('signal', { from: s.id, name: s.data.name, data }); });
  let lastBuzz = 0, lastTyping = 0;
  s.on('buzz', () => { if (!s.data.name) return; const now = Date.now(); if (now - lastBuzz < 15000) return s.emit('msg', { sys: true, text: 'Please wait a bit before buzzing again.' }); lastBuzz = now;
    push(s.data.room, { buzz: true, name: esc(s.data.name), t: now }); });
  s.on('typing', () => { if (!s.data.name) return; const now = Date.now(); if (now - lastTyping < 2000) return; lastTyping = now; s.to(s.data.room).emit('typing', { name: s.data.name }); });
  s.on('pm', ({ to, text }, cb) => { if (!s.data.name) return; const id = users.get(String(to || '').toLowerCase()); const t = id && io.sockets.sockets.get(id);
    text = String(text || '').trim().slice(0, MAXLEN); if (!text) return; if (!t) return cb && cb({ error: to + ' is not online.' });
    const now = Date.now(); stamps = stamps.filter(x => now - x < 10000); if (stamps.length >= 5) return cb && cb({ error: 'You are sending messages too fast.' }); stamps.push(now);
    t.emit('pm', { from: s.data.name, text: esc(text), t: now }); cb && cb({ ok: true, text: esc(text) }); });
  s.on('report', ({ who, why }) => { if (!s.data.name) return; console.log('[REPORT ABUSE]', new Date().toISOString(), 'by', s.data.name, 'in', s.data.room, 'against', String(who || '').slice(0, 30), '-', String(why || '').slice(0, 300)); });
  s.on('disconnect', () => { if (!s.data.name) return; users.delete(s.data.name.toLowerCase()); const r0 = s.data.room; mediaReset(); s.leave(r0); upd(r0);
    if (s.data.room) { push(s.data.room, { sys: true, text: `${esc(s.data.name)} has left the room.` }); io.to(s.data.room).emit('members', members(s.data.room)); } });
});
server.listen(process.env.PORT || 3000, () => console.log('RetroChat on', process.env.PORT || 3000));
