// v11.6: classic rooms, bots, favorites, top rooms, show-room status, invites: TEST_DATABASE_URL=... node test-v116.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3026, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL;
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const E = (s, ev, d) => new Promise(r => d === undefined ? s.emit(ev, r) : s.emit(ev, d, r));
const sfx = Date.now() % 100000, MN = 'mq' + sfx, A = 'aa' + sfx, B = 'bb' + sfx, C = 'cc' + sfx;
const H = c => ({ 'Content-Type': 'application/json', ...(c ? { cookie: c } : {}) });
async function signup(n) { const r = await fetch(U + '/api/signup', { method: 'POST', headers: H(), body: JSON.stringify({ agree: true,  name: n, password: 'hunter22pw' }) }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
const conn = (cookie, dev, ip) => io(U, { transports: ['websocket'], extraHeaders: { cookie: [cookie, 'ydid=' + dev].filter(Boolean).join('; '), 'x-forwarded-for': ip }, reconnection: false, forceNew: true });
const up = s => new Promise(r => { s.on('connect', () => r(true)); s.on('connect_error', e => r(e.message)); });
let srv; (async () => {
  srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB, MASTER_NAMES: MN, SIGNUP_LIMIT: 100 }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(300); const S = [];
  const mk = async (c, d, ip) => { const s = conn(c, d, ip); S.push(s); await up(s); return s; };
  try {
    const mc = await signup(MN), ac = await signup(A), bc = await signup(B), cc = await signup(C);
    let rs = await (await fetch(U + '/api/rooms')).json();
    const cats = new Set(rs.map(r => r.cat));
    ok(['Computers & Internet', 'Music', 'Romance', 'Regional', 'Science', 'Business & Finance'].every(c => cats.has(c)), 'classic Yahoo categories');
    ok(rs.find(r => r.name === 'Late Night').cat === 'Cultures & Community', 'Late Night kept under a category');
    ok(!rs.some(r => r.name === 'Adult Romance'), 'adult rooms hidden without 18+');
    const a = await mk(ac, 'dev-a1111111', '10.2.0.1'), b = await mk(bc, 'dev-b1111111', '10.2.0.2'), c = await mk(cc, 'dev-c1111111', '10.2.0.3'), m = await mk(mc, 'dev-m1111111', '10.2.0.4');
    ok((await E(m, 'rooms')).find(r => r.name === 'Adult Romance').rating === 'R', 'adult room rated R');
    const ros = []; a.on('roster', x => ros.push(x));
    ok((await E(a, 'login', { room: 'Late Night' })).ok, 'login Late Night'); await w(200);
    ok(ros.at(-1).some(p => p.bot && p.name === 'sk8rboi_1987') && ros.at(-1).some(p => p.name === 'xXmoonchildXx'), 'two bots in people list');
    ok((await E(a, 'pm', { to: 'sk8rboi_1987', text: 'hi' })).ok, 'IM to bot accepted silently');
    const g = await mk('', 'dev-g1111111', '10.2.0.5'); ok(/not available/.test((await E(g, 'login', { name: 'sk8rboi_1987', room: 'Lobby' })).error || ''), 'bot names reserved');
    ok((await E(m, 'login', { room: 'Lobby' })).ok, 'master login');
    let r = await (await fetch(U + '/api/master/bots', { method: 'POST', headers: H(mc), body: JSON.stringify({ on: false }) })).json(); ok(r.on === false, 'master turns bots off');
    await w(200); ok(!ros.at(-1).some(p => p.bot), 'bots removed from list');
    await fetch(U + '/api/master/bots', { method: 'POST', headers: H(mc), body: JSON.stringify({ on: true }) });
    ok((await fetch(U + '/api/master/bots', { headers: H(ac) })).status >= 400, 'non-master cannot toggle bots');
    { const fr = await fetch(U + '/api/fav', { method: 'POST', headers: H(ac), body: JSON.stringify({ room: 'Rock', on: true }) }); if (!fr.ok) console.log(fr.status, await fr.text()); ok(fr.ok, 'favorite saved'); }
    ok((await E(a, 'rooms')).find(r => r.name === 'Rock').fav, 'favorite in DB-backed list');
    ok((await fetch(U + '/api/fav', { method: 'POST', headers: H(), body: JSON.stringify({ room: 'Rock', on: true }) })).status === 401, 'guest favorites are local only');
    ok((await E(b, 'login', { room: 'Late Night' })).ok, 'b joins'); b.emit('cam', true); await w(200);
    rs = await E(c, 'rooms'); const ln = rs.find(r => r.name === 'Late Night'); ok(ln.count === 4 && ln.cams === 1, 'people + cam counts (incl. bots)');
    await E(a, 'create-room', { name: 'Zed Lounge ' + (sfx % 100), topic: 't', rating: 'PG-13', mics: 1 });
    ok((await E(a, 'rooms')).some(r => r.mine === 'owner'), 'owned room marked mine');
    for (const s of [a, c]) await E(s, 'm:init');
    await E(a, 'm:add', { name: C, msg: '' }); await E(c, 'm:respond', { name: A, accept: true }); await w(200);
    const pres = []; c.on('m:presence', p => pres.push(p));
    await E(a, 'm:status', { msg: '[room]' }); await w(200); ok(pres.some(p => p.name === A && p.room && /^In chat: /.test(p.msg)), 'show-room status');
    pres.length = 0; await E(a, 'join', 'Rock'); await w(300); ok(pres.some(p => p.room === 'Rock' && p.msg === 'In chat: Rock'), 'updates on room change');
    const inv = []; c.on('m:invite', x => inv.push(x));
    r = await E(a, 'm:invite', { to: C }); ok(r.ok && r.room === 'Rock', 'invite to current room'); await w(100); ok(inv.length === 1, 'invite delivered');
    ok(/already invited/.test((await E(a, 'm:invite', { to: C })).error || ''), 'per-target rate limit');
    await E(c, 'm:status', { status: 'busy' });
    await w(100); ok((await E(b, 'room:invite', { to: C })).error === C + " isn't available for invites.", 'busy target rejected');
    await E(c, 'm:status', { status: 'available' });
    await E(c, 'blk:set', { name: B, on: true }); ok((await E(b, 'room:invite', { to: C })).error === C + " isn't available for invites.", 'blocked inviter rejected');
    await E(c, 'blk:set', { name: B, on: false }); await E(c, 'priv:set', { pmBuddies: true });
    ok(/isn't available/.test((await E(b, 'room:invite', { to: C })).error || ''), 'buddies-only privacy rejects non-buddy');
    await E(c, 'priv:set', { pmBuddies: false }); await E(c, 'ign:set', { name: B, on: true });
    ok(/isn't available/.test((await E(b, 'room:invite', { to: C })).error || ''), 'ignored inviter rejected');
    console.log(`\n${pass} passed`);
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { S.forEach(s => s.disconnect()); srv.kill(); setTimeout(() => process.exit(), 300); }
})();
