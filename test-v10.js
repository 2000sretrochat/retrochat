// Ratings (PG-13/R + 18+ gate), cam viewer list/block, profiles: TEST_DATABASE_URL=... node test-v10.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3017, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL, KEY = 'test-site-key-0123456789abcdef';
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const E = (s, ev, d) => new Promise(r => d === undefined ? s.emit(ev, r) : s.emit(ev, d, r));
const J = { 'Content-Type': 'application/json' };
async function acct(n) { const r = await fetch(U + '/api/signup', { method: 'POST', headers: J, body: JSON.stringify({ name: n, password: 'hunter22pw' }) }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
const conn = cookie => io(U, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {} });
(async () => {
  if (!DB) { console.log('needs TEST_DATABASE_URL'); process.exit(1); }
  const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB, ADMIN_KEY: KEY }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(300);
  const sfx = Date.now() % 100000, names = [];
  try {
    const O = 'Rat' + sfx, P = 'Pro' + sfx; names.push(O, P); const co = await acct(O), cp = await acct(P);
    const o = conn(co); await E(o, 'login', { name: '', room: 'Lobby' });
    ok((await E(o, 'create-room', { name: 'NoRate ' + sfx, topic: '' })).error, 'create room without rating rejected');
    ok((await E(o, 'create-room', { name: 'XRate ' + sfx, topic: '', rating: 'X' })).error, 'X rating rejected (only PG-13 / R)');
    ok((await E(o, 'create-room', { name: 'R Room ' + sfx, topic: '', rating: 'R' })).adult, 'R room requires 18+ confirmation first');
    await E(o, 'adult', true); const RR = 'R Room ' + sfx; ok((await E(o, 'create-room', { name: RR, topic: '', rating: 'R' })).ok, 'confirmed adult creates R room');
    ok((await (await fetch(U + '/api/rooms', { headers: { cookie: co } })).json()).find(r => r.name == RR)?.rating == 'R', 'adult account sees R room (stored on account)');
    ok(!(await (await fetch(U + '/api/rooms')).json()).some(r => r.name == RR), 'R room hidden from anonymous /api/rooms');
    ok((await (await fetch(U + '/api/rooms')).json()).filter(r => ['Lobby','Friends','Chit Chat','Late Night'].includes(r.name)).every(r => r.rating == 'PG-13'), 'official rooms are PG-13');
    const g = conn(); ok(!(await E(g, 'rooms')).some(r => r.name == RR), 'guest session does not see R room');
    ok((await E(g, 'login', { name: 'Kid' + sfx, room: RR })).adult, 'unconfirmed guest cannot join R room (server)');
    await E(g, 'login', { name: 'Kid' + sfx, room: 'Lobby' }); ok((await E(g, 'join', RR)).adult, 'unconfirmed guest join event refused');
    await E(g, 'adult', true); ok((await E(g, 'rooms')).some(r => r.name == RR) && (await E(g, 'join', RR)).ok, 'guest confirms 18+ (per session) and can join');
    const g2 = conn(); ok(!(await E(g2, 'rooms')).some(r => r.name == RR), 'guest confirmation does not leak to other sessions');
    const p = conn(cp); ok(!(await E(p, 'rooms')).some(r => r.name == RR), 'other account without confirmation does not see R room');
    const ra = await fetch(U + '/api/adult', { method: 'POST', headers: { ...J, cookie: cp }, body: JSON.stringify({ confirm: true }) }); ok(ra.ok, 'account confirms 18+ via Messenger');
    // admin rating / close
    const RN = 'Pg Room ' + sfx; await E(o, 'join', 'Lobby'); ok((await E(o, 'create-room', { name: RN, topic: '', rating: 'PG-13' })).ok, 'PG-13 room created');
    ok((await fetch(U + '/api/admin/room', { method: 'POST', headers: J, body: JSON.stringify({ room: RN, rating: 'R' }) })).status == 401, 'admin room API needs key');
    const g3 = conn(); await E(g3, 'login', { name: 'Kie' + sfx, room: RN }); let moved = null; g3.on('history', h => moved = h.room);
    ok((await fetch(U + '/api/admin/room', { method: 'POST', headers: { ...J, 'x-admin-key': KEY }, body: JSON.stringify({ room: RN, rating: 'X' }) })).status == 400, 'admin cannot set X');
    ok((await fetch(U + '/api/admin/room', { method: 'POST', headers: { ...J, 'x-admin-key': KEY }, body: JSON.stringify({ room: RN, rating: 'R' }) })).ok, 'admin changes rating to R'); await w(300);
    ok(moved == 'Lobby', 'unconfirmed user moved out when room becomes R');
    ok((await fetch(U + '/api/admin/room', { method: 'POST', headers: { ...J, 'x-admin-key': KEY }, body: JSON.stringify({ room: RN, close: true }) })).ok && !(await (await fetch(U + '/api/admin/rooms', { headers: { 'x-admin-key': KEY } })).json()).some(r => r.name == RN), 'admin closes room');
    ok((await fetch(U + '/api/admin/room', { method: 'POST', headers: { ...J, 'x-admin-key': KEY }, body: JSON.stringify({ room: 'Lobby', close: true }) })).status == 400, 'official rooms cannot be closed');
    // cam viewers + block
    const c1 = conn(), c2 = conn(); await E(c1, 'login', { name: 'Cam' + sfx, room: 'Friends' }); await E(c2, 'login', { name: 'Vw' + sfx, room: 'Friends' });
    let ros; c1.on('roster', r => ros = r); c1.emit('cam', true); await w(200);
    ok((await E(c2, 'view', c1.id)).ok, 'viewer opens cam'); await w(200);
    ok(ros.find(r => r.id == c1.id).viewers.includes('Vw' + sfx), "cam owner sees viewer in Who's watching");
    let blocked = false; c2.on('cam-blocked', () => blocked = true);
    ok((await E(c1, 'cam:block', 'Vw' + sfx)).ok, 'owner blocks viewer'); await w(200);
    ok(blocked && !ros.find(r => r.id == c1.id).viewers.length, 'blocked viewer is dropped and notified');
    ok((await E(c2, 'view', c1.id)).error, 'blocked viewer cannot re-open the cam');
    // profiles
    ok((await fetch(U + '/api/profile', { method: 'POST', headers: J, body: '{}' })).status == 401, 'profile edit requires sign-in');
    ok((await fetch(U + '/api/profile', { method: 'POST', headers: { ...J, cookie: cp }, body: JSON.stringify({ age: 5 }) })).status == 400, 'bad age rejected');
    ok((await fetch(U + '/api/profile', { method: 'POST', headers: { ...J, cookie: cp }, body: JSON.stringify({ displayName: 'Pro Fan', age: '29', location: 'Tempe, AZ', bio: 'Hi <b>there</b>', interests: 'music' }) })).ok, 'user edits own profile');
    const pr = await (await fetch(U + '/api/profile/' + P)).json();
    ok(pr.displayName == 'Pro Fan' && pr.age == 29 && pr.location == 'Tempe, AZ' && pr.bio == 'Hi <b>there</b>' && pr.interests == 'music' && pr.memberSince, 'profile stored in Postgres with member-since');
    ok(!/ip|last_loc|email|pw/i.test(Object.keys(pr).join(',')), 'profile exposes no IP / IP location / email');
    const gp = await (await fetch(U + '/api/profile/Cam' + sfx)).json(); ok(gp.guest && gp.name == 'Cam' + sfx && !gp.age, 'guest has minimal profile');
    ok((await fetch(U + '/api/profile/Nobody' + sfx)).status == 404, 'unknown profile 404');
    [o, g, g2, g3, p, c1, c2].forEach(x => x.disconnect());
    console.log(`\nPASS ${pass} checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { const pg = new (require('pg').Pool)({ connectionString: DB }); await pg.query('delete from users where name_lc = any($1)', [names.map(n => n.toLowerCase())]).catch(() => {}); await pg.end(); srv.kill(); process.exit(); }
})();
