// Master-only room recordings (metadata + room-wide "recording" flag).
// The audio/video itself is recorded in the master's own browser or Messenger app from the
// streams it already receives (public/room-recorder.js) and saved on that device, so the
// server never stores media. The server only:
//   - lets masters start/stop a session (everyone else gets 403),
//   - keeps a room-wide "recording" flag so every client can show the small amber dot,
//   - clears the flag when the recording master leaves the room or disconnects,
//   - keeps a metadata log (room, master, mode, start/stop) that only masters can list.
const MODES = ['audio', 'video', 'both'];
const LIST_MAX = 200;

function createRecordings({ db, now = () => Date.now(), uuid = () => require('node:crypto').randomUUID(), log = console } = {}) {
  const active = new Map(); // id -> session
  const recent = [];        // in-memory fallback log when the database is unavailable
  const dbReady = () => { try { return !!(db && db.status && db.status().ready); } catch { return false; } };
  const save = (sql, args) => { if (!dbReady()) return Promise.resolve(); try { return Promise.resolve(db.q(sql, args)).catch(e => log.error('[recordings]', e.message)); } catch (e) { log.error('[recordings]', e.message); return Promise.resolve(); } };
  const pub = x => ({ id: x.id, room: x.room, master: x.master, mode: x.mode, startedAt: new Date(x.startedAt).toISOString(), stoppedAt: x.stoppedAt ? new Date(x.stoppedAt).toISOString() : null, endReason: x.endReason || null, bytes: x.bytes ?? null });
  const isOn = room => { for (const x of active.values()) if (x.room === room) return true; return false; };
  const bySock = sockId => [...active.values()].filter(x => x.sockId === sockId);

  function start({ room, master, sockId, mode }) {
    mode = String(mode || '').toLowerCase();
    if (!MODES.includes(mode)) return { error: 'Pick audio, video or both.' };
    if (!room) return { error: 'Join a room first.' };
    const mine = bySock(sockId);
    if (mine.length) return { error: 'You are already recording this room.', id: mine[0].id };
    const x = { id: uuid(), room, master, sockId, mode, startedAt: now() };
    const wasOn = isOn(room); active.set(x.id, x);
    recent.unshift(x); recent.length = Math.min(recent.length, LIST_MAX);
    // writes for one session run in order (insert before any update), even though the pool has several connections
    x.db = save('insert into recording_sessions(id,room,master,mode,started_at) values($1,$2,$3,$4,$5)', [x.id, room, master, mode, new Date(x.startedAt)]);
    return { ok: true, session: pub(x), changed: !wasOn };
  }
  // Only the socket that started a session (or the master who owns it) can stop it.
  function stop({ id, sockId, master, reason = 'stopped', bytes }) {
    const x = active.get(String(id || ''));
    if (!x || (x.sockId !== sockId && String(x.master).toLowerCase() !== String(master || '').toLowerCase())) return { error: 'No recording to stop.' };
    return end(x, reason, bytes);
  }
  function end(x, reason, bytes) {
    active.delete(x.id); x.stoppedAt = now(); x.endReason = reason;
    if (Number.isFinite(+bytes) && +bytes >= 0) x.bytes = Math.floor(+bytes);
    x.db = x.db.then(() => save('update recording_sessions set stopped_at=$2,end_reason=$3,bytes=$4 where id=$1', [x.id, new Date(x.stoppedAt), reason, x.bytes ?? null]));
    return { ok: true, session: pub(x), room: x.room, changed: !isOn(x.room) };
  }
  // Master left the room / switched rooms / disconnected: end everything that socket was recording.
  function endForSocket(sockId, reason) { return bySock(sockId).map(x => end(x, reason)); }
  // Late byte count from the client after the file was saved.
  function report({ id, master, bytes }) {
    const x = recent.find(r => r.id === id && String(r.master).toLowerCase() === String(master || '').toLowerCase());
    if (!x || !Number.isFinite(+bytes) || +bytes < 0) return { error: 'Unknown recording.' };
    x.bytes = Math.floor(+bytes); x.db = x.db.then(() => save('update recording_sessions set bytes=$2 where id=$1', [x.id, x.bytes])); return { ok: true };
  }
  async function list({ limit = 50 } = {}) {
    limit = Math.max(1, Math.min(LIST_MAX, limit | 0 || 50));
    if (dbReady()) {
      try {
        const rows = await db.q('select id,room,master,mode,started_at,stopped_at,end_reason,bytes from recording_sessions order by started_at desc limit $1', [limit]);
        return rows.map(r => ({ id: r.id, room: r.room, master: r.master, mode: r.mode, startedAt: new Date(r.started_at).toISOString(), stoppedAt: r.stopped_at ? new Date(r.stopped_at).toISOString() : null, endReason: r.end_reason || null, bytes: r.bytes == null ? null : +r.bytes, active: active.has(r.id) }));
      } catch (e) { log.error('[recordings]', e.message); }
    }
    return recent.slice(0, limit).map(x => ({ ...pub(x), active: active.has(x.id) }));
  }
  const rename = (from, to) => { for (const x of active.values()) if (x.room === from) x.room = to; };
  return { MODES, start, stop, endForSocket, report, list, isOn, rename, activeFor: sockId => bySock(sockId).map(pub), size: () => active.size };
}

// Socket + HTTP wiring, kept here so tests can drive it with fakes.
//   emitRoom(room, ev, data) -> broadcast to a room
//   userFromReq(req) -> account or null; isMaster(account) -> bool (DB is_master is authoritative)
//   roomSocketFor(account) -> the master's live room socket (needed so leaving the room clears the flag)
function wireRecordings(rec, { app, express, emitRoom, userFromReq, isMaster, roomSocketFor }) {
  const flag = room => emitRoom(room, 'rec', { room, on: rec.isOn(room) });
  function startFor(s, mode) {
    if (!s || !s.data || !s.data.master) return { error: 'Masters only.', status: 403 };
    if (!s.data.name || !s.data.room) return { error: 'Join a room first.', status: 400 };
    const r = rec.start({ room: s.data.room, master: s.data.name, sockId: s.id, mode });
    if (r.error) return { ...r, status: 409 };
    flag(s.data.room); return r;
  }
  function stopFor(s, id, bytes, reason = 'stopped') {
    if (!s || !s.data || !s.data.master) return { error: 'Masters only.', status: 403 };
    const r = rec.stop({ id, sockId: s.id, master: s.data.name, bytes, reason });
    if (r.error) return { ...r, status: 404 };
    flag(r.room); return r;
  }
  // Called when a room socket leaves its room (switch rooms, sign out, disconnect).
  function onLeave(s, reason) {
    const ended = rec.endForSocket(s.id, reason);
    for (const r of ended) { flag(r.room); try { s.emit('rec:ended', { id: r.session.id, reason }); } catch { } }
    return ended;
  }
  function socket(s) {
    const reply = (cb, r) => { if (typeof cb === 'function') { const rest = { ...r }; delete rest.status; cb(rest.session ? { ok: true, ...rest.session } : rest); } };
    s.on('rec:start', ({ mode } = {}, cb) => reply(cb, startFor(s, mode)));
    s.on('rec:stop', ({ id, bytes } = {}, cb) => reply(cb, stopFor(s, id, bytes)));
    s.on('rec:bytes', ({ id, bytes } = {}) => { if (s.data && s.data.master) rec.report({ id, master: s.data.name, bytes }); });
  }
  if (app && express) {
    const auth = async (req, res) => {
      res.set('Cache-Control', 'no-store');
      const u = await Promise.resolve(userFromReq(req)).catch(() => null);
      if (!u) { res.status(401).json({ error: 'Sign in first.' }); return null; }
      if (!(await Promise.resolve(isMaster(u)).catch(() => false))) { res.status(403).json({ error: 'Masters only.' }); return null; }
      return u;
    };
    const send = (res, r) => { const { status, ...rest } = r; res.status(r.error ? status || 400 : 200).json(rest); };
    app.get('/api/recordings', async (req, res) => { if (!(await auth(req, res))) return; res.json({ sessions: await rec.list({ limit: +req.query.limit || 50 }) }); });
    app.get('/api/recordings/state', async (req, res) => { if (!(await auth(req, res))) return; res.json({ room: String(req.query.room || ''), on: rec.isOn(String(req.query.room || '')) }); });
    app.post('/api/recordings/start', express.json(), async (req, res) => { const u = await auth(req, res); if (!u) return;
      const s = roomSocketFor(u); if (!s) return res.status(400).json({ error: 'Join a room first.' });
      send(res, startFor(s, req.body?.mode)); });
    app.post('/api/recordings/stop', express.json(), async (req, res) => { const u = await auth(req, res); if (!u) return;
      const s = roomSocketFor(u) || { id: null, data: { master: true, name: u.name } };
      send(res, stopFor(s, req.body?.id, req.body?.bytes)); });
  }
  return { socket, onLeave, startFor, stopFor };
}

module.exports = { createRecordings, wireRecordings, MODES };
