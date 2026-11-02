// v11.7: TEST_DATABASE_URL=... node test-v117.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3027, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL;
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const E = (s, ev, d) => new Promise(r => d === undefined ? s.emit(ev, r) : s.emit(ev, d, r));
const sfx = Date.now() % 100000, MN = 'mq' + sfx, A = 'aa' + sfx, B = 'bb' + sfx, C = 'cc' + sfx;
const H = c => ({ 'Content-Type': 'application/json', ...(c ? { cookie: c } : {}) });
async function signup(n) { const r = await fetch(U + '/api/signup', { method: 'POST', headers: H(), body: JSON.stringify({ agree: true,  name: n, password: 'hunter22pw' }) }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
const conn = (cookie, dev, ip) => io(U, { transports: ['websocket'], extraHeaders: { cookie: [cookie, 'ydid=' + dev].filter(Boolean).join('; '), 'x-forwarded-for': ip }, reconnection: false, forceNew: true });
const up = s => new Promise(r => { s.on('connect', () => r(true)); s.on('connect_error', e => r(e.message)); });

const RES = 'zq' + sfx;
let srv; const start = () => { srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB, MASTER_NAMES: MN, MASTER_RESERVED: RES + ',tony', SIGNUP_LIMIT: 100, FLOOD_MUTE_MS: 3000 }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())).then(() => w(300)); };
(async () => {
  await start(); const S = []; const mk = async (c, d, ip) => { const s = conn(c, d, ip); S.push(s); await up(s); return s; };
  const J = async (p, o) => (await fetch(U + p, o)).json();
  try {
    ok(/^v11\.[78]/.test((await J('/api/version')).version), 'version v11.7+');
    const ice = await J('/api/ice'); ok(Array.isArray(ice.iceServers || ice) , '/api/ice serves ICE list');
    for (const p of ['/privacy', '/terms', '/manifest.webmanifest', '/sw.js']) { const r = await fetch(U + p); ok(r.ok, p + ' served'); if (p[1] != 's' || p == '/sw.js') { } }
    const pv = await (await fetch(U + '/privacy')).text(); ok(/YappChat/.test(pv) && /IP/.test(pv), 'privacy names YappChat, mentions IP');
    // signup agree enforced
    let r = await fetch(U + '/api/signup', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'na' + sfx, password: 'hunter22pw' }) }); ok(r.status === 400, 'signup without agree rejected');
    r = await fetch(U + '/api/signup', { method: 'POST', headers: H(), body: JSON.stringify({ agree: true, name: RES, password: 'hunter22pw' }) }); ok(!r.ok, 'reserved name cannot sign up');
    const mc = await signup(MN), ac = await signup(A), bc = await signup(B);
    ok((await J('/api/verify/status', { headers: H(ac) })).need === false, 'verification off without sender');
    r = await J('/api/master/create-reserved', { method: 'POST', headers: H(ac), body: JSON.stringify({ name: RES, password: 'hunter22pw' }) }).catch(() => ({})); ok(!r.ok, 'non-master cannot create reserved');
    { const m = await mk(mc, 'dev-m7777777', '10.7.0.9'); await E(m, 'login', { room: 'Lobby' }); await w(200); }
    r = await J('/api/master/create-reserved', { method: 'POST', headers: H(mc), body: JSON.stringify({ name: RES, password: 'hunter22pw' }) }); ok(r.ok, 'master creates reserved account');
    // display capitalization
    const lr = await fetch(U + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ name: A.toUpperCase(), password: 'hunter22pw' }) }); const lj = await lr.json(); ok(lj.name === A.toUpperCase(), 'display name keeps typed case');
    ok(typeof (await J('/api/master/stats', { headers: H(mc) })).online === 'number', 'master stats');
    ok((await fetch(U + '/api/master/stats', { headers: H(ac) })).status === 404, 'stats hidden from non-master');
    // receipts toggle
    ok((await J('/api/receipts', { headers: H(ac) })).on === false, 'read receipts off by default');
    ok((await J('/api/receipts', { method: 'POST', headers: H(ac), body: JSON.stringify({ on: true }) })).on === true, 'read receipts toggle');
    // rooms: guest limits, peek, flood
    const a = await mk(ac, 'dev-a7777777', '10.7.0.1'), b = await mk(bc, 'dev-b7777777', '10.7.0.2'), g = await mk('', 'dev-g7777777', '10.7.0.3');
    ok((await E(a, 'login', { room: 'Lobby' })).ok, 'a in Lobby'); ok((await E(b, 'login', { room: 'Lobby' })).ok, 'b in Lobby');
    const gn = 'gg' + sfx; ok((await E(g, 'login', { name: gn, room: 'Lobby' })).ok, 'guest in Lobby');
    ok(/reserved|not available|taken/i.test((await E(await mk('', 'dev-h7777777', '10.7.0.4'), 'login', { name: 'TONY', room: 'Lobby' })).error || 'x'), 'guest cannot use reserved name');
    const pk = await J('/api/peek?room=Lobby'); ok(pk.names.includes(A) && pk.names.includes(gn), 'room preview lists people');
    let gr = await E(g, 'pm', { to: A, text: 'hi' }); ok(/Guests can only reply/.test(gr.error || ''), 'guest cannot start IM');
    ok((await E(a, 'pm', { to: gn, text: 'hello guest' })).ok, 'user IMs guest'); await w(100);
    ok((await E(g, 'pm', { to: A, text: 'hi back' })).ok, 'guest can reply');
    const gm = []; g.on('msg', x => gm.push(x)); g.emit('cam', true); await w(200); ok(gm.some(x => /broadcast a webcam/.test(x.text || '')), 'guest cam blocked');
    const bm = []; b.on('msg', x => bm.push(x)); for (let i = 0; i < 4; i++) { b.emit('say', { text: 'same thing' }); await w(150); } await w(200); ok(bm.some(x => /Flood control/.test(x.text || '')), 'flood control auto-mute');
    const ar = await J('/api/report', { method: 'POST', headers: H(ac), body: JSON.stringify({ who: B, why: 'test' }) }); ok(ar.ok, 'report accepted');
    ok(((await J('/api/forgot', { method: 'POST', headers: H(), body: JSON.stringify({ name: A }) })).email) === false, 'forgot falls back when no sender');
    ok((await J('/api/master/reset-link', { method: 'POST', headers: H(mc), body: JSON.stringify({ name: A }) })).link, 'master reset link');
    const on = await J('/api/online'); ok(on.n >= 3 + 51 - 0, 'online count includes bots (' + on.n + ')');
    const rl = await J('/api/rooms'); const cats = new Set(rl.map(r => r.cat)); ok(['Government & Politics', 'Regional', 'Languages', 'Teen', 'Games'].every(c => cats.has(c)), 'Yahoo categories incl. Languages/Teen');
    ok(rl.find(r => r.name === 'हिन्दी Hindi').count >= 3, 'Hindi room count includes bots');
    ok((await J('/api/peek?room=' + encodeURIComponent('日本語 Japanese'))).names.includes('sakura_chan_98'), 'preview shows bots');
    let bt = await J('/api/master/bots', { method: 'POST', headers: H(mc), body: JSON.stringify({ room: 'Tagalog', on: false }) }); ok(bt.rooms.find(r => r.room === 'Tagalog').on === false, 'per-room bot toggle');
    ok((await J('/api/peek?room=Tagalog')).names.length === 0, 'bots gone from toggled room');
    await J('/api/master/bots', { method: 'POST', headers: H(mc), body: JSON.stringify({ room: 'Tagalog', on: true }) });
    ok((await E(a, 'pm', { to: 'sakura_chan_98', text: 'hi' })).ok, 'IM to bot fails silently');
    console.log('\n' + pass + ' passed');
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { S.forEach(s => s.close()); srv.kill(); }
})();
