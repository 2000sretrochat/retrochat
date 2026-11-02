// v11.5: ignore / block / privacy / sessions / IP limit: TEST_DATABASE_URL=... node test-v115.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3025, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL;
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const E = (s, ev, d) => new Promise(r => d === undefined ? s.emit(ev, r) : s.emit(ev, d, r));
const sfx = Date.now() % 100000, MN = 'mq' + sfx, A = 'aa' + sfx, B = 'bb' + sfx, C = 'cc' + sfx;
const H = c => ({ 'Content-Type': 'application/json', ...(c ? { cookie: c } : {}) });
async function signup(n) { const r = await fetch(U + '/api/signup', { method: 'POST', headers: H(), body: JSON.stringify({ agree: true,  name: n, password: 'hunter22pw' }) }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
const ck = (c, dev) => [c, dev && 'ydid=' + dev].filter(Boolean).join('; ');
const conn = (cookie, ip) => io(U, { transports: ['websocket'], extraHeaders: { ...(cookie ? { cookie } : {}), 'x-forwarded-for': ip || '10.0.0.1' }, reconnection: false, forceNew: true });
const up = s => new Promise(r => { s.on('connect', () => r(true)); s.on('connect_error', e => r(e.message)); });
let srv; const start = async () => { srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB, MASTER_NAMES: MN, SIGNUP_LIMIT: 100 }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(300); };
(async () => {
  if (!DB) { console.log('TEST_DATABASE_URL required'); process.exit(1); }
  await start(); const S = []; const mk = async (c, ip) => { const s = conn(c, ip); S.push(s); return [s, await up(s)]; };
  try {
    const mc = await signup(MN), ac = await signup(A), bc = await signup(B), cc = await signup(C);
    const [a] = await mk(ck(ac, 'dev-aaaaaaaa'), '10.1.0.1'), [b] = await mk(ck(bc, 'dev-bbbbbbbb'), '10.1.0.2'), [c] = await mk(ck(cc, 'dev-cccccccc'), '10.1.0.3');
    for (const s of [a, b, c]) ok((await E(s, 'login', { room: 'Lobby' })).ok, 'login');
    // ignore persists
    let r = await E(a, 'ign:set', { name: C, on: true }); ok(r.ignored.includes(C) && r.hide.includes(C), 'ignore saved');
    const [a2] = await mk(ck(ac, 'dev-aaaaaaaa'), '10.1.0.1'); r = await E(a2, 'prefs'); ok(r.ignored.includes(C), 'ignore persists per account (DB)');
    // guest ignore is session-only
    const [g] = await mk(ck('', 'dev-gggggggg'), '10.1.0.9'); ok((await E(g, 'login', { name: 'gq' + sfx, room: 'Lobby' })).ok, 'guest login');
    r = await E(g, 'ign:set', { name: A, on: true }); ok(r.hide.includes(A.toLowerCase()) && !r.account, 'guest ignore (session)');
    ok((await E(g, 'blk:set', { name: A })).error, 'guests cannot block');
    // notices carry who
    const msgs = []; a.on('msg', m => msgs.push(m)); c.disconnect(); await w(300); ok(msgs.some(m => m.who === C), 'exit notice tagged with who (client filter)');
    const [c2] = await mk(ck(cc, 'dev-cccccccc'), '10.1.0.3'); ok((await E(c2, 'login', { room: 'Lobby' })).ok, 'c rejoin');
    // block
    r = await E(a, 'blk:set', { name: B, on: true }); ok(r.blocked.includes(B) && r.hide.includes(B.toLowerCase()), 'block saved, implies ignore');
    r = await E(b, 'pm', { to: A, text: 'hi' }); ok(r.error === "This user isn't accepting messages.", 'blocked user cannot PM');
    const prof = await (await fetch(U + '/api/profile/' + A, { headers: H(bc) })).json(); ok(prof.online === false, 'blocked user sees you offline');
    const prof2 = await (await fetch(U + '/api/profile/' + A, { headers: H(cc) })).json(); ok(prof2.online === true, 'others see you online');
    a.emit('cam', true); await w(200); r = await E(b, 'view', a.id); ok(r.error, 'blocked user cannot view cam');
    // privacy
    r = await E(a, 'priv:set', { pmBuddies: true }); ok(r.pmBuddies, 'privacy saved');
    r = await E(c2, 'pm', { to: A, text: 'hi' }); ok(r.error === "This user isn't accepting messages.", 'non-buddy blocked by privacy');
    const [m] = await mk(ck(mc, 'dev-mmmmmmmm'), '10.1.0.1'); ok((await E(m, 'login', { room: 'Lobby' })).ok, 'master login');
    await E(a, 'blk:set', { name: MN, on: true });
    r = await E(m, 'pm', { to: A, text: 'hi' }); ok(r.ok, 'master bypasses block + privacy');
    r = await E(a, 'ign:set', { name: MN, on: true }); ok(!r.hide.includes(MN), 'ignoring a master is silently not applied');
    r = await E(a, 'blk:set', { name: B, on: false }); ok(!r.blocked.includes(B), 'unblock');
    await E(a, 'priv:set', { pmBuddies: false }); r = await E(c2, 'pm', { to: A, text: 'hi' }); ok(r.ok, 'privacy off allows PM');
    // sessions: takeover on same account
    let gone = false; a.on('signed-elsewhere', () => gone = true);
    const [a3] = await mk(ck(ac, 'dev-aaaaaaaa'), '10.1.0.1'); ok((await E(a3, 'login', { room: 'Lobby' })).ok, 'second sign-in takes over'); await w(200); ok(gone && !a.connected, 'old session told "Signed in elsewhere"');
    // device: different screen name blocked
    const [gx] = await mk(ck('', 'dev-aaaaaaaa'), '10.1.0.1'); r = await E(gx, 'login', { name: 'gz' + sfx, room: 'Lobby' }); ok(/already signed in on this computer/.test(r.error || ''), 'second screen name on same device blocked');
    // master unlimited sessions
    const [m2] = await mk(ck(mc, 'dev-mmmmmmmm'), '10.1.0.1'); const mi = await E(m2, 'm:init'); ok(!mi.error && m.connected, 'master keeps multiple sessions');
    // IP limit (5 devices)
    const res = []; for (let i = 0; i < 6; i++) res.push((await mk(ck('', 'dev-ip' + i + 'xxxxx'), '10.9.9.9'))[1]);
    ok(res.slice(0, 5).every(x => x === true) && res[5] === 'Too many users from this network (limit 5).', '6th connection from one IP refused');
    ok((await mk(ck(mc, 'dev-mmmmmmmm'), '10.9.9.9'))[1] === true, 'masters not limited');
    console.log(`\n${pass} passed`);
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { S.forEach(s => s.disconnect()); srv.kill(); setTimeout(() => process.exit(), 300); }
})();
