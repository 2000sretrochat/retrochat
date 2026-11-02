// Room moderation + join/leave notice tests: TEST_DATABASE_URL=... node test-mod.js
const { spawn } = require('child_process'), { io } = require('socket.io-client'), assert = require('assert');
const PORT = 3016, U = 'http://localhost:' + PORT, DB = process.env.TEST_DATABASE_URL, KEY = 'test-site-key-0123456789abcdef';
const w = ms => new Promise(r => setTimeout(r, ms)); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓', m); };
const E = (s, ev, d) => new Promise(r => d === undefined ? s.emit(ev, r) : s.emit(ev, d, r));
async function acct(n) { const r = await fetch(U + '/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, password: 'hunter22pw' }) });
  return (r.headers.get('set-cookie') || '').split(';')[0]; }
const conn = cookie => io(U, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {} });
(async () => {
  const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATABASE_URL: DB || '', ADMIN_KEY: KEY }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(300);
  const sfx = Date.now() % 100000, names = [];
  try {
    // join / leave notices (no DB needed)
    const g1 = conn(), g2 = conn(), log = []; g1.on('msg', m => log.push(m));
    await E(g1, 'login', { name: 'Gone' + sfx, room: 'Late Night' }); await E(g2, 'login', { name: 'Owl' + sfx, room: 'Late Night' }); await w(200);
    ok(log.some(m => m.sys && m.t && m.text == 'Owl' + sfx + ' has entered the room.'), 'enter notice (with timestamp) shown');
    g2.disconnect(); await w(300); ok(log.some(m => m.sys && m.t && m.text == 'Owl' + sfx + ' has left the room.'), 'leave notice (with timestamp) shown');
    const html = await (await fetch(U + '/rooms.html')).text();
    ok(/id="mTs"/.test(html) && /ts:true/.test(html) && /rcPrefs/.test(html), 'View > Show Timestamps toggle, default ON, saved in localStorage');
    ok(!/id="send"[^>]*>Send</.test(html) && !/<button id="send">/.test(html), 'no Send button in rooms (Enter sends)');
    // site moderator via ADMIN_KEY in official room
    ok((await E(g1, 'mod', { action: 'dot', who: 'x' })).error, 'normal user cannot moderate');
    ok((await E(g1, 'mod:site', 'wrong')).error, 'wrong site key rejected');
    const g3 = conn(); await E(g3, 'login', { name: 'Tgt' + sfx, room: 'Late Night' });
    ok((await E(g1, 'mod:site', KEY)).ok, 'site key grants owner powers in official rooms');
    ok((await E(g1, 'mod', { action: 'mutetext', who: 'Tgt' + sfx })).ok, 'site mod mutes text');
    const before = log.length; g3.emit('say', { text: 'hello' }); await w(300); ok(!log.slice(before).some(m => m.text == 'hello'), 'muted user text is blocked server-side');
    ok((await E(g1, 'mod', { action: 'unmuteall', who: 'Tgt' + sfx })).ok, 'unmute works'); g3.emit('say', { text: 'hello2' }); await w(300); ok(log.some(m => m.text == 'hello2'), 'unmuted user can talk again');
    g3.disconnect(); g1.disconnect();
    if (!DB) { console.log('  (no TEST_DATABASE_URL: skipping owner/admin account tests)'); }
    else {
      const O = 'Own' + sfx, A = 'Adm' + sfx; names.push(O, A); const co = await acct(O), ca = await acct(A); ok(co && ca, 'two accounts created');
      const o = conn(co), a = conn(ca), g = conn(), msgs = []; o.on('msg', m => msgs.push(m));
      const RN = 'Mod Room ' + sfx; await E(o, 'login', { name: '', room: 'Lobby' }); ok((await E(o, 'create-room', { name: RN, topic: 't', rating: 'PG-13' })).ok, 'owner creates room');
      await E(a, 'login', { name: '', room: RN }); const G = 'Gu' + sfx; await E(g, 'login', { name: G, room: RN }); await w(300);
      let ros; o.on('roster', r => ros = r); o.emit('say', { text: 'hi all' }); await w(300);
      ok(msgs.find(m => m.text == 'hi all').role == 'owner', 'owner messages tagged owner (bold + star in UI)');
      ok((await E(a, 'mod', { action: 'dot', who: G })).error, 'non-admin cannot dot');
      ok((await E(o, 'mod', { action: 'admin', who: A })).ok, 'owner appoints admin'); await w(200);
      ok(ros.find(r => r.name == A).role == 'admin' && ros.find(r => r.name == O).role == 'owner', 'roster shows owner/admin roles');
      ok((await E(a, 'mod', { action: 'kick', who: O })).error, 'admin cannot act on owner');
      ok((await E(a, 'mod', { action: 'admin', who: G })).error, 'admin cannot appoint admins');
      let dotted = false; g.on('dotted', () => dotted = true);
      ok((await E(a, 'mod', { action: 'dot', who: G })).ok, 'admin dots user'); await w(200);
      ok(dotted && msgs.some(m => m.sys && m.text == G + ' was dotted'), 'dotted user notified + room notice');
      ok((await E(a, 'mod', { action: 'mutemic', who: G })).ok, 'admin mutes mic'); g.emit('voice', true); g.emit('talk', true); await w(300);
      ok(!ros.find(r => r.name == G).talk && ros.find(r => r.name == G).mm, 'mic-muted user cannot talk');
      const l = await E(a, 'mod:list'); ok(l.muted.some(x => x.name == G.toLowerCase() && x.mic), 'muted list returned');
      ok((await E(g, 'mod:list')).error, 'normal user cannot read mod list');
      ok((await E(a, 'mod', { action: 'kick', who: G })).ok, 'admin kicks user'); await w(300);
      ok((await E(g, 'join', RN)).error, 'kicked user cannot rejoin during cooldown');
      ok((await E(a, 'mod:list')).kicked.some(x => x.name == G.toLowerCase()), 'kicked list returned');
      ok((await E(a, 'mod', { action: 'unkick', who: G })).ok && (await E(g, 'join', RN)).ok, 'kick lifted -> user can rejoin');
      const A2 = 'Adb' + sfx; names.push(A2); const a2 = conn(await acct(A2)); await E(a2, 'login', { name: '', room: RN }); await E(o, 'mod', { action: 'admin', who: A2 });
      ok((await E(a, 'mod', { action: 'mutetext', who: A2 })).error, 'admin cannot act on another admin');
      ok((await E(o, 'mod', { action: 'unadmin', who: A })).ok, 'owner removes admin'); await w(200); ok(!ros.find(r => r.name == A).role, 'removed admin loses role');
      [o, a, g, a2].forEach(x => x.disconnect());
    }
    console.log(`\nPASS ${pass} checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { if (DB && names.length) { const pg = new (require('pg').Pool)({ connectionString: DB }); await pg.query('delete from users where name_lc = any($1)', [names.map(n => n.toLowerCase())]).catch(() => {}); await pg.end(); } srv.kill(); process.exit(); }
})();
