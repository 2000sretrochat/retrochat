// Master console, watch list, persistence, mic limits / hands-up queue / turn timer: TEST_DATABASE_URL=... node test-incog.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3021, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL;
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const E = (s, ev, d) => new Promise(r => d === undefined ? s.emit(ev, r) : s.emit(ev, d, r));
const sfx = Date.now() % 100000, MN = "mi" + sfx, M2 = "mj" + sfx;
const H = c => ({ 'Content-Type': 'application/json', ...(c ? { cookie: c } : {}) });
async function signup(n) { const r = await fetch(U + '/api/signup', { method: 'POST', headers: H(), body: JSON.stringify({ name: n, password: 'hunter22pw' }) }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
async function login(n) { const r = await fetch(U + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ name: n, password: 'hunter22pw' }) }); return { status: r.status, c: (r.headers.get('set-cookie') || '').split(';')[0] }; }
const get = (p, c) => fetch(U + p, { headers: H(c) });
const post = async (p, b, c) => { const r = await fetch(U + p, { method: 'POST', headers: H(c), body: JSON.stringify(b) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const conn = cookie => io(U, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {}, reconnection: false });
let srv; const start = async () => { srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB, MASTER_NAMES: MN + "," + M2 }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(300); };
const has = (x, n) => JSON.stringify(x).includes(n);
(async () => {
  if (!DB) { console.log('TEST_DATABASE_URL required'); process.exit(1); }
  await start(); const S = [];
  try {
    const mc = await signup(MN), m2c = await signup(M2), uc = await signup('ni' + sfx);
    ok((await get('/api/master/prefs', uc)).status === 404 && (await post('/api/master/prefs', { incognito: true }, uc)).status === 404 && (await get('/api/master/prefs')).status === 404, 'prefs API is master-only (404)');
    const p0 = await (await get('/api/master/prefs', mc)).json(); ok(p0.incognito === false && p0.announce === false, 'defaults: incognito off, announce off');
    const u = conn(uc), m = conn(mc), m2 = conn(m2c); S.push(u, m, m2);
    const ue = []; u.onAny((ev, d) => ue.push([ev, d])); let uros = [], m2ros = [];
    u.on('roster', r => uros = r); m2.on('roster', r => m2ros = r);
    await E(u, 'login', { name: 'ni' + sfx, room: 'Chit Chat' }); await E(m2, 'login', { name: M2, room: 'Chit Chat' }); await w(300);
    // silent entry by default
    ue.length = 0; await E(m, 'login', { name: MN, room: 'Chit Chat' }); await w(300);
    ok(uros.some(x => x.name === MN), 'visible master appears in people list');
    ok(!ue.some(([e, d]) => e === 'msg' && d.sys && d.text.includes(MN)), 'no entry notice for master by default');
    ue.length = 0; await E(m, 'join', 'Lobby'); await w(300); ok(!ue.some(([e, d]) => e === 'msg' && has(d, MN)), 'no exit notice for master by default');
    ok((await post('/api/master/prefs', { announce: true }, mc)).j.announce === true, 'announce setting saved');
    ue.length = 0; await E(m, 'join', 'Chit Chat'); await w(300); ok(ue.some(([e, d]) => e === 'msg' && d.sys && /has entered/.test(d.text) && d.text.includes(MN)), 'announce on: normal entry notice');
    await post('/api/master/prefs', { announce: false }, mc); await E(m, 'join', 'Lobby'); await w(200);
    // incognito
    ok((await post('/api/master/prefs', { incognito: true }, mc)).j.incognito === true, 'incognito toggle saved');
    await post('/api/master/room', { room: 'Chit Chat', rating: 'R' }, mc); await w(100);
    const uc2 = await signup('na' + sfx), a = conn(uc2); S.push(a); await E(a, 'adult', true); const ae = []; a.onAny((ev, d) => ae.push([ev, d])); let aros = []; a.on('roster', r => aros = r);
    await E(a, 'login', { name: 'na' + sfx, room: 'Chit Chat' }); await w(200);
    ae.length = 0; const mj = await E(m, 'join', 'Chit Chat'); ok(mj.ok, 'incognito master (not 18+-confirmed) can join an R room'); await w(300);
    m.emit('typing'); await w(300);
    ok(!aros.some(x => x.name === MN), 'incognito master not in people list');
    ok(m2ros.some(x => x.name === MN && x.inc === true), 'other masters see incognito master, marked inc');
    const rl = await (await get('/api/rooms', uc2)).json(), cc = rl.find(r => r.name === 'Chit Chat'); ok(cc.count === aros.length, 'room user count excludes incognito master');
    const sr = await E(a, 'rooms'); ok(sr.find(r => r.name === 'Chit Chat').count === aros.length, 'socket room list count excludes incognito master');
    const pr = await (await get('/api/profile/' + MN, uc2)).json(); ok(pr.online === false && !pr.room, 'profile lookup shows incognito master offline / no room');
    ok((await E(a, 'pm', { to: MN, text: 'hi' })).error, 'PM to incognito master says not online');
    ok((await E(a, 'mod', { action: 'kick', who: MN })).error && true, 'non-master cannot target incognito master');
    const mm = []; m.on('msg', x => mm.push(x)); let warned = null; m.once('incwarn', d => warned = d);
    m.emit('say', { text: 'hello ' + sfx }); await w(300); ok(warned && !ae.some(([e, d]) => e === 'msg' && has(d, 'hello ' + sfx)), 'incognito send warns first and is not delivered');
    ok(!ae.some(([e, d]) => has(d, MN)), 'no socket event to non-master mentions incognito master (' + ae.length + ' events checked)');
    m.emit('say', { text: 'hello ' + sfx, vis: true }); await w(300);
    ok(ae.some(([e, d]) => e === 'msg' && has(d, 'hello ' + sfx)) && aros.some(x => x.name === MN), 'confirmed send delivers and makes master visible');
    ok(!ae.some(([e, d]) => e === 'msg' && d.sys && has(d, MN)), 'becoming visible posts no join notice');
    // toggle live from room
    await post('/api/master/prefs', { incognito: true }, mc); await w(300); ok(!aros.some(x => x.name === MN), 'toggling incognito on in-room hides master immediately');
    ae.length = 0; m.disconnect(); await w(300); ok(!ae.some(([e, d]) => has(d, MN)), 'incognito disconnect leaks nothing');
    await post('/api/master/room', { room: 'Chit Chat', rating: 'PG-13' }, mc); await post('/api/master/prefs', { incognito: false }, mc);
    console.log(`\n${pass} passed`);
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { S.forEach(s => s.disconnect()); srv.kill(); setTimeout(() => process.exit(), 300); }
})();
