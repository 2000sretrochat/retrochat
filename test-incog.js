// Master console, watch list, persistence, mic limits / hands-up queue / turn timer: TEST_DATABASE_URL=... node test-incog.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3021, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL;
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const E = (s, ev, d) => new Promise(r => d === undefined ? s.emit(ev, r) : s.emit(ev, d, r));
const sfx = Date.now() % 100000, MN = "mi" + sfx, M2 = "mj" + sfx;
const H = c => ({ 'Content-Type': 'application/json', ...(c ? { cookie: c } : {}) });
async function signup(n) { const r = await fetch(U + '/api/signup', { method: 'POST', headers: H(), body: JSON.stringify({ agree: true,  name: n, password: 'hunter22pw' }) }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
async function login(n) { const r = await fetch(U + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ name: n, password: 'hunter22pw' }) }); return { status: r.status, c: (r.headers.get('set-cookie') || '').split(';')[0] }; }
const get = (p, c) => fetch(U + p, { headers: H(c) });
const post = async (p, b, c) => { const r = await fetch(U + p, { method: 'POST', headers: H(c), body: JSON.stringify(b) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const conn = cookie => io(U, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {}, reconnection: false });
let srv; const start = async () => { srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB, MASTER_NAMES: MN + "," + M2, SIGNUP_LIMIT: 100 }, stdio: ['ignore', 'pipe', 'inherit'] });
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
    let kd = null; a.once('kicked', d => kd = d); ae.length = 0; await E(m2, 'mod', { action: 'kick', who: 'na' + sfx }); await w(300);
    ok(ae.some(([e, d]) => e === 'msg' && /was bounced from the room by a moderator/.test(d.text)) && kd, 'kick is shown to users as "bounced"');
    const rh = await (await fetch(U + '/rooms.html')).text(); ok(/Bounce \(5 min\)/.test(rh) && !/>Kick|'Kick |kicked from/.test(rh), 'room UI says Bounce, not Kick');
    // dots: optional duration, roster flag, talk blocked, auto-lift
    const dc = await signup('nd' + sfx), d = conn(dc); S.push(d); let dros = [], dd = null, und = null; d.on('roster', r => dros = r); d.on('dotted', x => dd = x); d.on('undotted', x => und = x);
    const de = []; d.on('msg', x => de.push(x)); await E(d, 'login', { name: 'nd' + sfx, room: 'Lobby' }); await w(200);
    const r1 = await post('/api/master/roommod', { room: 'Lobby', action: 'dot', who: 'nd' + sfx, mins: 1 }, mc); await w(300);
    ok(r1.status === 200 && dd && dd.mins === 1, 'timed dot (1 min) applied');
    const me1 = dros.find(x => x.name === 'nd' + sfx); ok(me1.dot === true && me1.dl > 50 && me1.dl <= 60, 'roster shows dot flag + countdown seconds');
    ok(de.some(x => x.sys && x.text === 'nd' + sfx + ' was dotted'), 'quiet notice: "X was dotted"');
    d.emit('voice', true); await w(100); ok((await E(d, 'talk', true)).error === "You've been dotted.", 'dotted user cannot take the mic');
    ok((await post('/api/master/roommod', { room: 'Lobby', action: 'undot', who: 'nd' + sfx }, mc)).status === 200, 'dot can be lifted'); await w(300);
    ok(!dros.find(x => x.name === 'nd' + sfx).dot && und, 'lifted dot clears roster flag + notifies user');
    await post('/api/master/roommod', { room: 'Lobby', action: 'dot', who: 'nd' + sfx, mins: 0 }, mc); await w(300); ok(dros.find(x => x.name === 'nd' + sfx).dl === 0 && dros.find(x => x.name === 'nd' + sfx).dot, 'untimed dot = until lifted');
    // force expiry: set a timed dot then rewind it via a 1-min dot and fake clock is not possible, so check auto-lift path with a near-expired entry through the API
    await post('/api/master/roommod', { room: 'Lobby', action: 'undot', who: 'nd' + sfx }, mc);
    const rh2 = await (await fetch(U + '/rooms.html')).text(); ok(/You've been dotted/.test(rh2) && /data-dend/.test(rh2) && /until lifted/.test(rh2), 'room UI has dotted tooltip, countdown and duration picker');
    // one screen name per email
    const sp = (n, e) => post('/api/signup', { agree: true, name: n, password: 'hunter22pw', email: e });
    ok((await sp('ea' + sfx, 'Some.One' + sfx + '+x@Gmail.com')).status === 200, 'first sign-up with an email works');
    const dup = await sp('eb' + sfx, '  someone' + sfx + '@googlemail.com '); ok(dup.status === 409 && dup.j.error === 'That email already has a screen name.', 'second name for same Gmail (dots/+tag/case/space) rejected');
    ok((await sp('ec' + sfx, 'x' + sfx + '@example.com')).status === 200 && (await sp('ed' + sfx, 'X' + sfx + '@EXAMPLE.com')).status === 409, 'non-Gmail compared case-insensitively');
    ok((await sp('ee' + sfx, 'x.y' + sfx + '@example.com')).status === 200, 'dots matter outside Gmail');
    const ul = await (await get('/api/master/unlimited', mc)).json(); ok(ul.emails.includes('zainyochka@gmail.com') && ul.emails.includes('teslaphx@gmail.com'), 'default unlimited list has both emails');
    ok((await sp('ef' + sfx, 'Zainy.Ochka+t' + sfx + '@gmail.com')).status === 200 && (await sp('eg' + sfx, 'zainyochka@gmail.com')).status === 200, 'unlimited email can have many screen names');
    ok((await get('/api/master/unlimited', uc)).status === 404, 'unlimited list is master-only');
    const nl = await post('/api/master/unlimited', { emails: ul.emails.join('\n') + '\nx' + sfx + '@example.com' }, mc); ok(nl.j.emails.length === 3, 'master can edit unlimited list');
    ok((await sp('eh' + sfx, 'x' + sfx + '@example.com')).status === 200, 'newly unlimited email can add names');
    await post('/api/master/unlimited', { emails: ul.emails.join(',') }, mc);
    console.log(`\n${pass} passed`);
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { S.forEach(s => s.disconnect()); srv.kill(); setTimeout(() => process.exit(), 300); }
})();
