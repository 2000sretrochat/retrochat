// Master console, watch list, persistence, mic limits / hands-up queue / turn timer: TEST_DATABASE_URL=... node test-master.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3019, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL;
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const E = (s, ev, d) => new Promise(r => d === undefined ? s.emit(ev, r) : s.emit(ev, d, r));
const sfx = Date.now() % 100000, MN = 'mz' + sfx;
const H = c => ({ 'Content-Type': 'application/json', ...(c ? { cookie: c } : {}) });
async function signup(n) { const r = await fetch(U + '/api/signup', { method: 'POST', headers: H(), body: JSON.stringify({ name: n, password: 'hunter22pw' }) }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
async function login(n) { const r = await fetch(U + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ name: n, password: 'hunter22pw' }) }); return { status: r.status, c: (r.headers.get('set-cookie') || '').split(';')[0] }; }
const get = (p, c) => fetch(U + p, { headers: H(c) });
const post = async (p, b, c) => { const r = await fetch(U + p, { method: 'POST', headers: H(c), body: JSON.stringify(b) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const conn = cookie => io(U, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {}, reconnection: false });
let srv; const start = async () => { srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB, MASTER_NAMES: MN }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(300); };
(async () => {
  if (!DB) { console.log('TEST_DATABASE_URL required'); process.exit(1); }
  await start(); const socks = [];
  try {
    const mc = await signup(MN), uc = await signup('mu' + sfx), vc = await signup('mv' + sfx);
    ok((await (await get('/api/me', mc)).json()).m === true, 'MASTER_NAMES account auto-granted master on sign-up');
    const me2 = await (await get('/api/me', uc)).json(); ok(me2.name && !('m' in me2), '/api/me has no master field for normal users');
    for (const p of ['/master', '/api/master/data', '/api/master/rooms', '/api/master/reports', '/api/master/watch']) ok((await get(p, uc)).status === 404, 'non-master gets 404 on ' + p);
    ok((await get('/master', mc)).status === 200, 'master can open /master console');
    ok((await post('/api/master/account', { name: 'mv' + sfx, action: 'grant' }, uc)).status === 404, 'non-master cannot grant master');
    // hidden in rooms
    const m = conn(mc), u = conn(uc), v = conn(vc); socks.push(m, u, v); const ulog = []; u.on('msg', x => ulog.push(x)); let uros = []; u.on('roster', r => uros = r);
    const ml = await E(m, 'login', { name: MN, room: 'Late Night' }); ok(ml.m === true, 'master gets m flag in own login ack');
    const ul = await E(u, 'login', { name: 'mu' + sfx, room: 'Late Night' }); ok(!('m' in ul), 'normal login ack has no m flag');
    await E(v, 'login', { name: 'mv' + sfx, room: 'Late Night' }); await w(300);
    ok(uros.find(x => x.name === MN) && uros.find(x => x.name === MN).role === '', 'master shows no role/badge in roster');
    const prof = await (await get('/api/profile/' + MN, uc)).text(); ok(!/master/i.test(prof), 'profile API reveals nothing about master');
    ok((await E(m, 'mod', { action: 'mutetext', who: 'mv' + sfx })).ok, 'master can moderate an official room');
    await w(200); ok(ulog.some(x => x.sys && /by a moderator/.test(x.text)) && !ulog.some(x => x.text.includes(MN + '.')), 'notice says "a moderator", not the master name');
    ok((await E(u, 'mod', { action: 'kick', who: MN })).error, 'normal user cannot act on master');
    // reports
    u.emit('report', { who: 'mv' + sfx, why: 'spam test ' + sfx }); await w(300);
    const reps = await (await get('/api/master/reports', mc)).json(); const rp = reps.find(r => r.why === 'spam test ' + sfx); ok(rp && !rp.resolved, 'abuse report persisted in DB');
    await post('/api/master/report', { id: rp.id }, mc); ok((await (await get('/api/master/reports', mc)).json()).find(r => r.id === rp.id).resolved, 'report resolved');
    // watch list: silent
    const vEvents = []; v.onAny((ev) => vEvents.push(ev));
    ok((await post('/api/master/watch', { name: 'mv' + sfx }, mc)).j.ok, 'master adds silent watch');
    const wl = await (await get('/api/master/watch', mc)).json(); const wv = wl.find(x => x.name === 'mv' + sfx);
    ok(wv && wv.room === 'Late Night', 'watch list shows current room'); ok(wv.ip && 'loc' in wv, 'watch list shows IP and location: ' + wv.ip + ' / ' + wv.loc);
    ok((await get('/api/master/watch', uc)).status === 404, 'watch IP data is master-only (404)');
    await w(300); ok(!vEvents.some(e => /request|contact|watch|presence/.test(e)), 'watched user receives no request/notification');
    // broadcast
    let bc = null; u.on('m:broadcast', d => bc = d); const before = ulog.length;
    await post('/api/master/broadcast', { text: 'Hello all ' + sfx }, mc); await w(300); ok(bc && bc.text === 'Hello all ' + sfx && ulog.slice(before).some(x => x.sys && x.text.includes('Hello all')), 'broadcast reaches rooms and sockets');
    // data includes ip/location for masters
    const d = await (await get('/api/master/data', mc)).json(); ok(d.accounts.find(a => a.name === 'mu' + sfx && 'last_ip' in a), 'master data shows IP/location');
    // grant / revoke / last master
    for (const a of (await (await get('/api/master/data', mc)).json()).accounts) if (a.master && a.name !== MN) await post('/api/master/account', { name: a.name, action: 'revoke' }, mc);
    ok((await post('/api/master/account', { name: MN, action: 'revoke' }, mc)).status === 400, 'cannot revoke the last master');
    ok((await post('/api/master/account', { name: MN, action: 'delete' }, mc)).status === 400, 'cannot delete the last master');
    ok((await post('/api/master/account', { name: 'mv' + sfx, action: 'grant' }, mc)).j.ok, 'master grants master');
    ok((await (await get('/api/me', vc)).json()).m === true, 'granted user is master');
    ok((await post('/api/master/account', { name: 'mv' + sfx, action: 'revoke' }, mc)).j.ok, 'master revokes master');
    // ban / sign-out / delete
    const xc = await signup('mx' + sfx); const xs = conn(xc); socks.push(xs); await w(200); let disc = false; xs.on('disconnect', () => disc = true);
    ok((await post('/api/master/account', { name: 'mx' + sfx, action: 'signout' }, mc)).j.ok && !(await (await get('/api/me', xc)).json()).name, 'force sign-out kills session');
    await w(200); ok(disc, 'force sign-out disconnects sockets');
    await post('/api/master/account', { name: 'mx' + sfx, action: 'ban' }, mc); ok((await login('mx' + sfx)).status === 403, 'banned account cannot log in');
    await post('/api/master/account', { name: 'mx' + sfx, action: 'unban' }, mc); ok((await login('mx' + sfx)).status === 200, 'unbanned account can log in');
    await post('/api/master/account', { name: 'mx' + sfx, action: 'delete' }, mc); ok((await login('mx' + sfx)).status === 401, 'deleted account is gone');
    ok((await post('/api/master/ipban', { ip: '203.0.113.' + (sfx % 250) }, mc)).j.ok, 'IP ban stored');
    const ipb = await (await get('/api/master/data', mc)).json(); ok(ipb.ipbans.some(b => b.ip === '203.0.113.' + (sfx % 250)), 'IP ban listed');
    await post('/api/master/ipban', { ip: '203.0.113.' + (sfx % 250), unban: true }, mc);
    // mic limit / hands up / timer in a user room
    const room = 'Mic' + sfx; ok((await E(u, 'create-room', { name: room, topic: 't', rating: 'PG-13', mics: 2 })).mics === 2, 'room created with multi-mic 2');
    let vh = null; v.on('history', h => vh = h); await E(v, 'join', room); await w(200); ok(vh && vh.mics === 2, 'room settings expose mic limit');
    const g = conn(); socks.push(g); await E(g, 'login', { name: 'mg' + sfx, room });
    for (const s of [u, v, g]) s.emit('voice', true); await w(200);
    ok((await E(u, 'talk', true)).ok && (await E(v, 'talk', true)).ok, 'two talkers allowed with limit 2');
    const full = await E(g, 'talk', true); ok(full.error === 'Mic is full (2/2)', 'third talker blocked: ' + full.error);
    ok((await E(u, 'set-mics', 1)).ok, 'owner sets single mic'); await E(u, 'talk', false); await E(v, 'talk', false);
    ok((await E(v, 'set-micopts', { hq: true })).error, 'non-owner cannot change mic options');
    ok((await E(u, 'set-micopts', { hq: true, timer: '45s' })).ok, 'owner enables hands up with custom 45s timer');
    ok((await E(u, 'set-micopts', { timer: '9m' })).error, 'timer capped at 5 minutes');
    ok((await E(u, 'talk', true)).ok, 'owner takes the free mic');
    let q = null; g.on('micq', d => q = d); let turn = null; v.on('yourturn', d => turn = d);
    ok((await E(v, 'hand', true)).ok && (await E(g, 'hand', true)).ok, 'two users raise hands'); await w(100);
    ok(q && q.q.join() === ['mv' + sfx, 'mg' + sfx].join(), 'line is ordered');
    ok((await E(u, 'handq', { who: 'mg' + sfx, op: 'up' })).ok, 'owner reorders line'); await w(100); ok(q.q[0] === 'mg' + sfx, 'reorder applied');
    ok((await E(u, 'handq', { who: 'mg' + sfx, op: 'down' })).ok, 'owner moves back');
    ok((await E(g, 'talk', true)).error, 'cannot jump the line while hands up is on');
    await E(u, 'talk', false); await w(300); ok(turn && turn.secs === 45, 'mic passes to next in line automatically with timer');
    ok((await E(u, 'set-micopts', { timer: 5 })).ok, 'owner sets 5s timer'); let gturn = false; g.on('yourturn', () => gturn = true); let drop = false; v.on('micdrop', () => drop = true);
    await w(6500); ok(drop && gturn, 'timer drops speaker and passes mic to next');
    ok((await E(g, 'hand', false)).ok, 'lower hand works');
    // persistence across restart
    await post('/api/master/room', { room: 'Late Night', mics: 4 }, mc); await post('/api/master/room', { room: 'Late Night', hq: false, timer: 60 }, mc);
    await E(m, 'mod', { action: 'admin', who: 'mu' + sfx }).catch(() => {});
    socks.forEach(s => s.disconnect()); srv.kill(); await w(500); await start();
    const rooms = await (await get('/api/master/rooms', mc)).json(); const ln = rooms.find(r => r.name === 'Late Night');
    ok(ln.mics === 4 && ln.timer === 60, 'room mic settings persisted across restart');
    ok(ln.mod && ln.mod.mt.includes('mv' + sfx), 'room mutes persisted across restart');
    await post('/api/master/roommod', { room: 'Late Night', action: 'unmuteall', who: 'mv' + sfx }, mc); await post('/api/master/room', { room: 'Late Night', mics: 3, timer: 0 }, mc);
    ok((await (await get('/api/me', mc)).json()).m, 'master still master after restart (seed not reapplied after revoke logic)');
    console.log(`\n${pass} passed`);
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { socks.forEach(s => s.disconnect()); srv.kill(); setTimeout(() => process.exit(), 300); }
})();
