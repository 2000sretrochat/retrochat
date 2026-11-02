// v11.8 room tree: TEST_DATABASE_URL=... node test-v118.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs');
const PORT = 3028, U = 'http://localhost:' + PORT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: process.env.TEST_DATABASE_URL }, stdio: ['ignore', 'pipe', 'inherit'] });
new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())).then(async () => { try {
  ok(/^v11\.[89]/.test((await (await fetch(U + '/api/version')).json()).version), 'version v11.8');
  const rs = await (await fetch(U + '/api/rooms')).json(), by = Object.fromEntries(rs.map(r => [r.name, r]));
  for (const n of ['LGB Lobby', 'Both Ways', "Gay Men's Lounge", "Lesbian Women's Lounge"]) ok(!by[n], 'removed ' + n);
  const reg = rs.filter(r => r.cat == 'Regional'); ok(reg.length > 50 && reg.every(r => !r.path.length), 'Regional is a flat country list');
  ok(!by.Phoenix && !by.Texas && !by.Toronto && !by.Mumbai && !by['Hong Kong'] && by['United States'] && by.India && by.Philippines, 'states/cities removed, countries kept');
  ok(by.NBA.path.join('/') == 'Sports/Basketball' && by.NBA.cat == 'Recreation & Sports', 'NBA under Sports/Basketball');
  ok(by['हिन्दी Hindi'].path[0] == 'Indian & South Asian', 'languages grouped by region');
  ok(by['Late Night'].cat == 'Cultures & Community' && rs.every(r => Array.isArray(r.path)), 'every room has a path');
  const b = fs.readFileSync('public/browse.js', 'utf8'); ok(/function tree/.test(b) && /online/.test(b), 'client tree renderer with counts');
  const bots = require('./bots'), d = require('./rooms-dir'); ok(Object.keys(bots.byRoom).every(r => d.PATH[r]), 'all bot rooms exist');
  console.log('PASS', pass); } catch (e) { console.error('FAIL', e.message); process.exitCode = 1 } srv.kill(); });
