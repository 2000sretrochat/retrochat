// Avatar tests: node test-avatar.js  (uses TEST_DATABASE_URL if set for account tests)
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3011, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const w = ms => new Promise(r => setTimeout(r, ms)), call = (s, ev, d) => new Promise(r => s.emit(ev, d, r));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
(async () => {
  const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB || '' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(300);
  try {
    const sfx = Date.now() % 100000, g1 = 'Guest' + sfx, g2 = 'Pal' + sfx;
    const a = io(U, { transports: ['websocket'] }), b = io(U, { transports: ['websocket'] });
    ok((await call(a, 'login', { name: g1, room: 'Lobby' })).ok, 'guest A signs in');
    ok((await call(b, 'login', { name: g2, room: 'Lobby' })).ok, 'guest B signs in');
    let r = await fetch(U + '/av/' + g1); ok(r.status == 200 && /svg/.test(r.headers.get('content-type')), 'default avatar is an SVG');
    ok(r.headers.get('x-content-type-options') == 'nosniff', 'avatar served with nosniff');
    ok((await call(a, 'avatar:set', 'data:text/html;base64,PHNjcmlwdD4=')).error, 'rejects non-image type');
    await w(2100); ok((await call(a, 'avatar:set', 'data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>' + 'x'.repeat(60)).toString('base64'))).error, 'rejects fake PNG (magic bytes)');
    await w(2100); ok(/too big/.test((await call(a, 'avatar:set', 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(40000)]).toString('base64'))).error || ''), 'rejects oversize image');
    await w(2100); const got = new Promise(res => b.on('avatar', res)), roster = new Promise(res => b.on('roster', res));
    r = await call(a, 'avatar:set', PNG); ok(r.ok && /^c/.test(r.av), 'accepts valid PNG');
    const ev = await got; ok(ev.name == g1 && ev.av == r.av, 'live avatar broadcast to others');
    r = await fetch(U + '/av/' + g1 + '?v=' + ev.av); ok(r.headers.get('content-type') == 'image/png' && (await r.arrayBuffer()).byteLength == 70, 'custom guest avatar served');
    ok((await call(a, 'avatar:set', PNG)).error, 'rate limited');
    a.emit('say', { text: 'hi' }); const m = await new Promise(res => b.on('msg', x => x.text == 'hi' && res(x))); ok(m.av == ev.av, 'chat message carries avatar');
    a.disconnect(); await w(300); r = await fetch(U + '/av/' + g1); ok(/svg/.test(r.headers.get('content-type')), 'guest avatar cleared on sign-out');
    ok((await call(b, 'avatar:set', 'a3')).ok, 'preset avatar accepted');
    b.disconnect();
    if (DB) {
      const n = 'Avt' + sfx; r = await fetch(U + '/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agree: true,  name: n, password: 'hunter22pw' }) });
      const ck = r.headers.get('set-cookie').split(';')[0]; ok(r.ok, 'account signup');
      const c = io(U, { transports: ['websocket'], extraHeaders: { cookie: ck } }); await new Promise(res => c.on('connect', res));
      const init = await call(c, 'm:init'); ok(init.me && init.me.name == n, 'messenger init');
      r = await call(c, 'avatar:set', PNG); ok(r.ok, 'account avatar saved');
      const pg = new (require('pg').Pool)({ connectionString: DB }); const row = (await pg.query('select a.mime,length(a.data) l,u.avatar from avatars a join users u on u.id=a.user_id where u.name_lc=$1', [n.toLowerCase()])).rows[0];
      ok(row && row.mime == 'image/png' && row.l == 70 && row.avatar == r.av, 'stored in Postgres'); await pg.end();
      ok((await call(c, 'm:init')).me.avatar == r.av, 'avatar returned on next init');
      c.disconnect(); await w(300); r = await fetch(U + '/av/' + n); ok(r.headers.get('content-type') == 'image/png', 'account avatar persists after sign-out');
    } else console.log('  (skipping account/Postgres tests: TEST_DATABASE_URL not set)');
    console.log(`\nPASS ${pass} checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { srv.kill(); process.exit(); }
})();
