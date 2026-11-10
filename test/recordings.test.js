const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const express = require('express');
const { createRecordings, wireRecordings } = require('../recordings');
const root = path.join(__dirname, '..');
const quiet = { error() { } };

function fakeSocket(id, data) { return { id, data, handlers: {}, events: [], on(e, fn) { this.handlers[e] = fn; }, emit(...a) { this.events.push(a); } }; }
const call = (s, ev, d) => new Promise(r => s.handlers[ev](d, r));
function rig() {
  let t = 1000, n = 0; const rec = createRecordings({ db: null, now: () => t, uuid: () => 'rec-' + (++n), log: quiet });
  const room = []; const sockets = [];
  const accounts = { 1: { id: 1, name: 'zainy', master: true }, 2: { id: 2, name: 'Alice', master: false }, 3: { id: 3, name: 'tony', master: true } };
  const wire = wireRecordings(rec, { app: null, emitRoom: (r, ev, d) => room.push([r, ev, d]), userFromReq: () => null, isMaster: () => false, roomSocketFor: () => null });
  const sock = (id, name, roomName, master) => { const s = fakeSocket(id, { name, room: roomName, master }); wire.socket(s); sockets.push(s); return s; };
  return { rec, wire, room, sock, accounts, tick: ms => { t += ms; } };
}

test('non-masters cannot start or stop a recording', async () => {
  const { sock, room, rec } = rig();
  const alice = sock('a', 'Alice', 'Lobby', false);
  assert.deepEqual(await call(alice, 'rec:start', { mode: 'both' }), { error: 'Masters only.' });
  assert.deepEqual(await call(alice, 'rec:stop', { id: 'x' }), { error: 'Masters only.' });
  assert.equal(room.length, 0, 'nothing broadcast'); assert.equal(rec.size(), 0);
  const z = sock('z', 'zainy', 'Lobby', true); const r = await call(z, 'rec:start', { mode: 'both' });
  assert.deepEqual(await call(alice, 'rec:stop', { id: r.id }), { error: 'Masters only.' }, 'a non-master cannot stop a master recording');
  assert.equal(rec.isOn('Lobby'), true);
});

test('modes are validated; one recording per master socket', async () => {
  const { sock } = rig(); const z = sock('z', 'zainy', 'Lobby', true);
  assert.match((await call(z, 'rec:start', { mode: 'screen' })).error, /audio, video or both/);
  for (const mode of ['audio', 'video', 'both']) {
    const r = await call(z, 'rec:start', { mode }); assert.equal(r.ok, true); assert.equal(r.mode, mode); assert.equal(r.room, 'Lobby'); assert.equal(r.master, 'zainy');
    assert.match((await call(z, 'rec:start', { mode })).error, /already recording/);
    assert.equal((await call(z, 'rec:stop', { id: r.id, bytes: 1234 })).ok, true);
  }
  const notInRoom = sock('q', 'tony', null, true); assert.match((await call(notInRoom, 'rec:start', { mode: 'audio' })).error, /Join a room/);
});

test('start/stop broadcast the room-wide recording flag; it stays on while any master records', async () => {
  const { sock, room } = rig();
  const z = sock('z', 'zainy', 'Lobby', true), t = sock('t', 'tony', 'Lobby', true);
  const a = await call(z, 'rec:start', { mode: 'audio' });
  assert.deepEqual(room.at(-1), ['Lobby', 'rec', { room: 'Lobby', on: true }]);
  const b = await call(t, 'rec:start', { mode: 'video' });
  assert.deepEqual(room.at(-1), ['Lobby', 'rec', { room: 'Lobby', on: true }]);
  assert.match((await call(t, 'rec:stop', { id: a.id })).error, /No recording/, "one master cannot stop another master's session");
  await call(z, 'rec:stop', { id: a.id }); assert.deepEqual(room.at(-1), ['Lobby', 'rec', { room: 'Lobby', on: true }], 'still on: tony is recording');
  await call(t, 'rec:stop', { id: b.id }); assert.deepEqual(room.at(-1), ['Lobby', 'rec', { room: 'Lobby', on: false }]);
});

test('recording clears when the master leaves the room or disconnects', async () => {
  const { sock, room, wire, rec } = rig();
  const z = sock('z', 'zainy', 'Lobby', true);
  const r = await call(z, 'rec:start', { mode: 'both' });
  wire.onLeave(z, 'left room');
  assert.deepEqual(room.at(-1), ['Lobby', 'rec', { room: 'Lobby', on: false }]);
  assert.deepEqual(z.events.at(-1), ['rec:ended', { id: r.id, reason: 'left room' }], 'the recorder is told to stop and save');
  const r2 = await call(z, 'rec:start', { mode: 'audio' }); assert.equal(r2.ok, true);
  wire.onLeave(z, 'disconnected'); assert.equal(rec.isOn('Lobby'), false);
  const log = await rec.list(); assert.deepEqual(log.map(x => [x.id, x.endReason, x.active]), [[r2.id, 'disconnected', false], [r.id, 'left room', false]]);
  assert.deepEqual(wire.onLeave(sock('a', 'Alice', 'Lobby', false), 'left room'), [], 'nothing to clear for others');
});

test('metadata log: room, master, mode, start/stop, bytes; room renames follow', async () => {
  const { sock, rec, tick } = rig(); const z = sock('z', 'zainy', 'Old Name', true);
  const r = await call(z, 'rec:start', { mode: 'video' }); rec.rename('Old Name', 'New Name'); assert.equal(rec.isOn('New Name'), true); assert.equal(rec.isOn('Old Name'), false);
  tick(65e3); await call(z, 'rec:stop', { id: r.id, bytes: 4096 });
  const [x] = await rec.list();
  assert.equal(x.room, 'New Name'); assert.equal(x.master, 'zainy'); assert.equal(x.mode, 'video'); assert.equal(x.bytes, 4096);
  assert.equal(Date.parse(x.stoppedAt) - Date.parse(x.startedAt), 65e3);
});

test('metadata is written to the recording_sessions table when the database is up', async () => {
  const calls = []; const db = { status: () => ({ ready: true }), q: async (sql, args) => { calls.push([sql.split(' ').slice(0, 3).join(' '), args]); return sql.startsWith('select') ? [{ id: 'r1', room: 'Lobby', master: 'zainy', mode: 'audio', started_at: new Date(0), stopped_at: null, end_reason: null, bytes: null }] : []; } };
  const rec = createRecordings({ db, uuid: () => 'r1', log: quiet });
  rec.start({ room: 'Lobby', master: 'zainy', sockId: 's', mode: 'audio' });
  assert.equal(calls[0][0], 'insert into recording_sessions(id,room,master,mode,started_at)'); assert.deepEqual(calls[0][1].slice(0, 4), ['r1', 'Lobby', 'zainy', 'audio']);
  const list = await rec.list(); assert.equal(list[0].active, true);
  rec.endForSocket('s', 'disconnected'); await new Promise(r => setImmediate(r)); assert.match(calls.at(-1)[0], /^update recording_sessions/);
  const schema = fs.readFileSync(path.join(root, 'db.js'), 'utf8'); assert.match(schema, /create table if not exists recording_sessions\(/);
});

// HTTP API with a real express app: 401 signed out, 403 non-masters, masters only.
test('HTTP: list/state/start/stop are master-only (403 for everyone else)', async () => {
  const rec = createRecordings({ db: null, log: quiet }); const room = [];
  const accts = { zainy: { id: 1, name: 'zainy', m: true }, alice: { id: 2, name: 'Alice', m: false }, tony: { id: 3, name: 'tony', m: true } };
  const zs = fakeSocket('zs', { name: 'zainy', room: 'Lobby', master: true });
  const app = express();
  const wire = wireRecordings(rec, { app, express, emitRoom: (r, ev, d) => room.push([r, ev, d]), userFromReq: req => accts[req.headers['x-test-user']] || null, isMaster: u => u.m, roomSocketFor: u => (u.id === 1 ? zs : null) });
  wire.socket(zs);
  const srv = http.createServer(app); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const req = (p, who, body) => fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(who ? { 'x-test-user': who } : {}) }, body: body && JSON.stringify(body) });
  try {
    for (const p of ['/api/recordings', '/api/recordings/state?room=Lobby']) { assert.equal((await req(p)).status, 401); assert.equal((await req(p, 'alice')).status, 403); }
    for (const p of ['/api/recordings/start', '/api/recordings/stop']) { assert.equal((await req(p, null, {})).status, 401); const r = await req(p, 'alice', { mode: 'both', id: 'x' }); assert.equal(r.status, 403); assert.deepEqual(await r.json(), { error: 'Masters only.' }); }
    assert.equal(room.length, 0, 'non-master calls broadcast nothing');
    assert.equal((await req('/api/recordings/start', 'tony', { mode: 'both' })).status, 400, 'a master must be in the room');
    const s = await req('/api/recordings/start', 'zainy', { mode: 'both' }); assert.equal(s.status, 200); const sj = await s.json(); assert.equal(sj.session.room, 'Lobby');
    assert.deepEqual(room.at(-1), ['Lobby', 'rec', { room: 'Lobby', on: true }]);
    assert.deepEqual(await (await req('/api/recordings/state?room=Lobby', 'tony')).json(), { room: 'Lobby', on: true });
    const list = await (await req('/api/recordings', 'tony')).json(); assert.equal(list.sessions[0].id, sj.session.id); assert.equal(list.sessions[0].active, true);
    assert.equal((await req('/api/recordings/stop', 'zainy', { id: sj.session.id })).status, 200); assert.deepEqual(room.at(-1), ['Lobby', 'rec', { room: 'Lobby', on: false }]);
    assert.equal((await req('/api/recordings/stop', 'zainy', { id: sj.session.id })).status, 404);
  } finally { srv.close(); }
});

test('client hooks: amber dot is hidden by default, recorder code is master-only, Terms line present', () => {
  const rooms = fs.readFileSync(path.join(root, 'public/rooms.html'), 'utf8'), server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const master = fs.readFileSync(path.join(root, 'master.js'), 'utf8'), terms = fs.readFileSync(path.join(root, 'public/terms.html'), 'utf8');
  assert.match(rooms, /<div class=rn id=rname><\/div><span id=recDot class=rec-dot hidden/);
  assert.match(rooms, /\$\('recDot'\)\.hidden=!h\.rec/); assert.match(rooms, /S\.on\('rec',/);
  assert.doesNotMatch(rooms, /Record: Audio only|mRecA|rec:start/, 'no record controls in the page everyone downloads');
  assert.ok(!fs.existsSync(path.join(root, 'public/master-recorder.js')), 'recorder is not a public static file');
  assert.match(master, /app\.get\('\/api\/master\/recorder\.js', guard\(/);
  assert.match(rooms, /r\.m&&!window\.MASTER\)\{[^}]*\/api\/master\/recorder\.js/);
  assert.match(server, /function mediaReset\(why = 'left room'\) \{\s*const room = s\.data\.room; if \(!room\) return; RECW\.onLeave\(s, why\)/);
  assert.match(server, /mediaReset\('disconnected'\)/); assert.match(server, /rec: REC\.isOn\(room\)/);
  assert.match(terms, /Rooms may be recorded for moderation and safety purposes\./);
  const recJs = fs.readFileSync(path.join(root, 'master-recorder.js'), 'utf8');
  for (const id of ['mRecA', 'mRecV', 'mRecB', 'mRecS']) assert.match(recJs, new RegExp('id=' + id));
  assert.match(recJs, /createMediaStreamDestination/); assert.match(recJs, /captureStream\(FPS\)/);
});

test('a quick start+stop still writes insert before update (no lost stop on a busy pool)', async () => {
  const order = []; const db = { status: () => ({ ready: true }), q: (sql) => new Promise(r => setTimeout(() => { order.push(sql.split(' ')[0]); r([]); }, sql.startsWith('insert') ? 30 : 0)) };
  const rec = createRecordings({ db, uuid: () => 'r9', log: quiet });
  rec.start({ room: 'Lobby', master: 'zainy', sockId: 's', mode: 'both' }); rec.endForSocket('s', 'left room');
  await new Promise(r => setTimeout(r, 80)); assert.deepEqual(order, ['insert', 'update']);
});
