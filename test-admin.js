// Admin/IP logging tests: TEST_DATABASE_URL=... node test-admin.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3014, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL, KEY = 'test-admin-key-0123456789abcdef';
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
(async () => {
  const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB || '', ADMIN_KEY: KEY }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(300);
  try {
    const sfx = Date.now() % 100000, g = 'Gst' + sfx, xff = { 'x-forwarded-for': '8.8.8.8, 10.0.0.1' };
    const a = io(U, { transports: ['websocket'], extraHeaders: xff });
    ok((await new Promise(r => a.emit('login', { name: g, room: 'Lobby' }, r))).ok, 'guest signs in');
    a.emit('say', { text: 'x' }); await w(300);
    ok((await fetch(U + '/api/admin/data')).status == 401, 'admin API rejects missing key');
    ok((await fetch(U + '/api/admin/data', { headers: { 'x-admin-key': 'wrong' } })).status == 401, 'admin API rejects wrong key');
    ok((await fetch(U + '/admin')).status == 200, '/admin page served (data still key-protected)');
    let N; if (DB) { N = 'Geo' + sfx; const r = await fetch(U + '/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', ...xff }, body: JSON.stringify({ agree: true,  name: N, password: 'hunter22pw' }) }); ok(r.ok, 'account signup'); }
    await w(3000);
    const d = await (await fetch(U + '/api/admin/data', { headers: { 'x-admin-key': KEY } })).json();
    const gg = d.guests.find(x => x.name == g); ok(gg && gg.ip == '8.8.8.8' && gg.online, 'guest IP from first X-Forwarded-For');
    console.log('    guest location:', gg.loc || '(lookup failed - IP only)');
    if (DB) { const ac = d.accounts.find(x => x.name == N); ok(ac && ac.last_ip == '8.8.8.8' && ac.hist.length == 1 && ac.hist[0].kind == 'signup', 'account IP + history stored');
      ok(d.guestLog.some(x => x.name == g && x.ip == '8.8.8.8'), 'guest session logged to DB');
      const pg = new (require('pg').Pool)({ connectionString: DB }); await pg.query('delete from users where name_lc=$1', [N.toLowerCase()]); await pg.query('delete from guest_log where name=$1', [g]); await pg.end(); }
    const html = await (await fetch(U + '/rooms.html')).text(); ok(/We log IP address and approximate location/.test(html), 'privacy notice on sign-in screen');
    const ro = JSON.stringify(await new Promise(r => { const b = io(U, { transports: ['websocket'] }); b.emit('login', { name: 'Chk' + sfx, room: 'Lobby' }, () => {}); b.once('roster', x => { b.disconnect(); r(x) }); }));
    ok(!/8\.8\.8\.8|"ip"|"loc"/.test(ro), 'roster sent to users contains no IP/location');
    a.disconnect(); await w(300);
    const d2 = await (await fetch(U + '/api/admin/data', { headers: { 'x-admin-key': KEY } })).json(); ok(d2.guests.find(x => x.name == g).online === false, 'guest marked offline after leaving');
    console.log(`\nPASS ${pass} checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { srv.kill(); process.exit(); }
})();
