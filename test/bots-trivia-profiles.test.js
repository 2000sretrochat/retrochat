// t225u/t226u: two natural trivia hosts, hints/scoring flow, profiles for ALL bots.
// Unit parts always run; the live part (real server + Postgres + socket.io) runs when TEST_DATABASE_URL is set.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..');
const BOTMOD = require('../bots');
const { createTrivia, memoryStore, matches } = require('../trivia');

test('exactly two trivia hosts, natural names, no [bot] suffix, stable unique ids', () => {
  const hosts = BOTMOD.BOTS.filter(b => b.trivia);
  assert.deepEqual(hosts.map(b => b.name).sort(), ['Jenna_Q', 'MarcusT']);
  assert.deepEqual(hosts.map(b => b.id).sort(), ['gamenight', 'triviatime']); // ids preserved for DB/avatars
  for (const b of BOTMOD.BOTS) assert.doesNotMatch(b.name, /bot\b|\[bot\]/i, b.name);
  assert.equal(new Set(BOTMOD.BOTS.map(b => b.id)).size, BOTMOD.BOTS.length);
  assert.equal(BOTMOD.byAlias('jenna').id, 'triviatime');
  assert.equal(BOTMOD.byAlias('triviatime').id, 'triviatime');
  assert.equal(BOTMOD.byAlias('marcus').id, 'gamenight');
});

test('ALL bots (casual + international + hosts) have descriptive, non-boilerplate profiles', () => {
  const S = BOTMOD.PROFILE_SEEDS; assert.equal(S.length, BOTMOD.BOTS.length); assert.ok(S.length >= 60);
  for (const s of S) {
    assert.ok(s.display_name && s.display_name.length >= 2, s.id);
    assert.ok(s.bio.length >= 25, 'bio too short ' + s.id);
    assert.ok(s.interests.split(',').length >= 2, 'interests ' + s.id);
    assert.ok(s.location.length >= 4, 'location ' + s.id);
  }
  assert.equal(new Set(S.map(s => s.bio)).size, S.length, 'bios are unique');
  // international bots carry their own language in the bio
  const nonLatin = S.filter(s => ['zh', 'yue', 'ja', 'ko', 'th', 'hi', 'ta', 'te', 'pa', 'bn', 'ru'].includes(s.lang));
  for (const s of nonLatin) assert.match(s.bio, /[^\u0000-\u024f]/, s.id);
});

test('answer matching is whole-phrase and tolerant of case/punctuation/mentions', () => {
  assert.ok(matches('Winamp!!', ['winamp']));
  assert.ok(matches('@Jenna_Q i think its the killers', ['the killers', 'killers']));
  assert.ok(!matches('winamps are cool', ['winamp']));
  assert.ok(!matches('kids', ['ds']));
});

function fakeTimers() { const q = []; return { timers: { setTimeout: (f, ms) => { const t = { f, ms, on: true }; q.push(t); return t; }, clearTimeout: t => { if (t) t.on = false; } },
  fire() { const t = q.filter(x => x.on).shift(); if (!t) return false; t.on = false; t.f(); return true; }, pending: () => q.filter(x => x.on).length }; }

test('round flow: question -> hint 1 -> hint 2 -> reveal; no 3rd hint; nothing scheduled after', async () => {
  const said = [], ft = fakeTimers(); const host = { name: 'Jenna_Q' };
  const T = createTrivia({ say: (r, b, t) => said.push(b.name + ': ' + t), timers: ft.timers, rnd: () => 0, questions: [{ q: 'Q1?', a: ['winamp'], h: 'llama' }] });
  assert.equal(await T.hear('Lobby', 'amy', '@jenna trivia', host), true);
  assert.match(said[0], /Trivia time! Q1\?/);
  ft.fire(); assert.match(said[1], /Hint 1: llama \(6 letters\)/);
  ft.fire(); assert.match(said[2], /Hint 2: W/);
  ft.fire(); assert.match(said[3], /Time's up! The answer was: winamp/);
  assert.equal(T.active('Lobby'), false); assert.equal(ft.pending(), 0); assert.equal(said.length, 4);
});

test('correct answer in normal chat (no mention) scores and persists in store; hint on request capped at 2', async () => {
  const said = [], ft = fakeTimers(), store = memoryStore(); const host = { name: 'MarcusT' };
  const T = createTrivia({ say: (r, b, t) => said.push(t), store, timers: ft.timers, rnd: () => 0, questions: [{ q: 'Q?', a: ['blockbuster'], h: 'rewind' }, { q: 'Q2?', a: ['ipod'] }] });
  await T.hear('Chit Chat', 'bob', '@marcus trivia', host);
  await T.hear('Chit Chat', 'bob', '@marcus hint', host); await T.hear('Chit Chat', 'bob', '@marcus hint', host); await T.hear('Chit Chat', 'bob', '@marcus hint', host);
  assert.equal(said.filter(s => /^Hint/.test(s)).length, 2); assert.match(said.at(-1), /both hints/);
  assert.equal(await T.hear('Chit Chat', 'carl', 'wrong guess'), false);
  assert.equal(await T.hear('Chit Chat', 'Carl', 'is it Blockbuster?'), true);
  assert.match(said.at(-1), /Carl got it: blockbuster\. Carl now has 1 point\./);
  assert.equal(await store.get('carl'), 1); assert.equal(ft.pending(), 0);
  await T.hear('Chit Chat', 'carl', '@marcus score', host); assert.match(said.at(-1), /you have 1 point/);
  await T.hear('Chit Chat', 'carl', '@marcus top', host); assert.match(said.at(-1), /1\. Carl \(1\)/);
});

// ---------- live: real server, real Postgres, socket.io message flow, restart persistence ----------
const DB = process.env.TEST_DATABASE_URL;
test('LIVE server: trivia in chat, persistent scores, all bot profiles, master edits survive restart, legacy migration', { skip: !DB && 'set TEST_DATABASE_URL' }, async () => {
  const { io } = require('socket.io-client'); const { Client } = require('pg');
  const PORT = 3000 + 400 + (process.pid % 300), U = 'http://localhost:' + PORT; const w = ms => new Promise(r => setTimeout(r, ms));
  const pg = new Client({ connectionString: DB }); await pg.connect();
  for (const t of ['bot_profiles', 'bot_avatars', 'trivia_scores']) await pg.query('drop table if exists ' + t);
  // legacy row as created by HEAD 187b5a5, with a master-edited bio we must keep
  await pg.query(`create table bot_profiles(name_lc text primary key, name text not null, display_name text not null default '', bio text not null default '', location text not null default '', interests text not null default '', avatar text not null default '', room text not null default '', interactive boolean not null default false, updated timestamptz not null default now(), updated_by text)`);
  await pg.query(`insert into bot_profiles(name_lc,name,display_name,bio,avatar,room,interactive,updated_by) values('triviatime [bot]','TriviaTime [bot]','TriviaTime','Nostalgia trivia host. Say @TriviaTime trivia to start a round.','triviatime','Lobby',true,null),('gamenight [bot]','GameNight [bot]','GameNight','MASTER EDITED BIO','gamenight','Lobby',true,'zainy')`);
  let srv; const start = async () => { srv = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT, DATABASE_URL: DB, TRIVIA_STEP_MS: '300' }, stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise(r => srv.stdout.on('data', d => /YappChat on/.test(d) && r())); await w(1500); };
  const stop = () => new Promise(r => { srv.once('exit', r); srv.kill(); });
  const room = async (name, rm) => { const s = io(U, { transports: ['websocket'], reconnection: false }); const log = []; s.on('msg', m => log.push({ ...m, text: String(m.text || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') }));
    const ack = await new Promise(r => s.emit('login', { name, room: rm }, r)); assert.ok(!ack.error, JSON.stringify(ack)); return { s, log }; };
  const waitFor = async (log, re, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = log.find(x => re.test(x.text || '')); if (m) return m; await w(50); } throw new Error('timeout waiting for ' + re + ' got ' + JSON.stringify(log.map(x => x.name + ':' + x.text).slice(-6))); };
  try {
    await start();
    const rows = (await pg.query('select bot_id,name,display_name,bio,room,updated_by,avatar from bot_profiles')).rows;
    assert.equal(rows.filter(r => r.bot_id).length, BOTMOD.BOTS.length, 'one profile row per bot');
    const jen = rows.find(r => r.bot_id === 'triviatime'), mar = rows.find(r => r.bot_id === 'gamenight');
    assert.equal(jen.name, 'Jenna_Q'); assert.equal(jen.display_name, 'Jenna'); assert.match(jen.bio, /Pub-trivia/); assert.equal(jen.avatar, '');
    assert.equal(mar.name, 'MarcusT'); assert.equal(mar.bio, 'MASTER EDITED BIO', 'master edit preserved by migration'); assert.equal(mar.updated_by, 'zainy');
    assert.equal(rows.some(r => /\[bot\]/.test(r.name)), false);
    // public profiles for every bot via both routes
    for (const b of BOTMOD.BOTS) { const p = await (await fetch(U + '/api/bot-profile/' + b.id)).json(); assert.equal(p.name, b.name); assert.ok(p.bio, b.id); assert.equal(p.avatar, 'bot:' + b.id); assert.equal('label' in p, false);
      const p2 = await (await fetch(U + '/api/profile/' + encodeURIComponent(b.name))).json(); assert.equal(p2.id, b.id); }
    assert.equal((await fetch(U + '/api/profile/' + encodeURIComponent('TriviaTime [bot]'))).status, 200);
    const av = await fetch(U + '/bot-av/sakura_chan_98'); assert.equal(av.status, 200); assert.match(av.headers.get('content-type'), /svg/);
    assert.equal((await fetch(U + '/bot-av/nope')).status, 404);
    // master edits through the real API (a temporary master account in the test DB only)
    await pg.query("delete from users where name_lc='tmaster'"); await pg.query("insert into users(name,name_lc,pw,is_master) values('tmaster','tmaster',$1,true)", [await require('bcryptjs').hash('pw-test-123', 4)]);
    const lr = await fetch(U + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'tmaster', password: 'pw-test-123' }) });
    const ck = (lr.headers.get('set-cookie') || '').split(';')[0]; const H = { 'Content-Type': 'application/json', cookie: ck };
    assert.equal((await fetch(U + '/api/master/bot-profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"id":"sakura_chan_98","bio":"x"}' })).status, 404, 'non-master gets 404');
    const list = await (await fetch(U + '/api/master/bot-profiles', { headers: H })).json(); assert.equal(list.bots.length, BOTMOD.BOTS.length);
    const ed = await (await fetch(U + '/api/master/bot-profiles', { method: 'POST', headers: H, body: JSON.stringify({ id: 'sakura_chan_98', bio: 'edited by master' }) })).json();
    assert.equal(ed.bot.bio, 'edited by master'); assert.equal(ed.bot.display_name, 'Sakura', 'unspecified fields untouched');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    assert.equal((await fetch(U + '/api/master/bot-avatar', { method: 'POST', headers: H, body: JSON.stringify({ id: 'triviatime', data: png }) })).status, 200);
    assert.match((await fetch(U + '/bot-av/triviatime')).headers.get('content-type'), /image\/png/);
    assert.equal((await (await fetch(U + '/api/bot-profile/sakura_chan_98')).json()).bio, 'edited by master');
    // chat flow in Lobby with Jenna_Q
    const a = await room('ann' + (process.pid % 1000), 'Lobby'); await w(300);
    a.s.emit('say', { text: '@Jenna trivia' }); const q = await waitFor(a.log, /^Trivia time!/); assert.equal(q.name, 'Jenna_Q');
    await waitFor(a.log, /^Hint 1:/); await waitFor(a.log, /^Hint 2:/); await waitFor(a.log, /^Time's up! The answer was:/);
    const hints = a.log.filter(m => /^Hint/.test(m.text)); assert.equal(hints.length, 2);
    // second round: answer correctly via plain chat using the server's own question bank
    a.log.length = 0; a.s.emit('say', { text: '@jenna_q trivia' }); const q2 = await waitFor(a.log, /^Trivia time!/);
    const Q = require('../trivia').QUESTIONS.find(x => q2.text.includes(x.q));
    assert.ok(Q, 'question identified: ' + q2.text); await w(50);
    a.s.emit('say', { text: Q.a[0] }); const win = await waitFor(a.log, /got it/); assert.equal(win.name, 'Jenna_Q'); assert.match(win.text, /now has 1 point/);
    a.s.disconnect();
    await stop(); await start();
    assert.equal((await pg.query("select bio,updated_by from bot_profiles where bot_id='sakura_chan_98'")).rows[0].bio, 'edited by master');
    assert.equal((await pg.query("select bio from bot_profiles where bot_id='gamenight'")).rows[0].bio, 'MASTER EDITED BIO');
    assert.match((await fetch(U + '/bot-av/triviatime')).headers.get('content-type'), /image\/png/, 'uploaded avatar survives restart');
    await pg.query("delete from users where name_lc='tmaster'");
    // score persisted across restart, read back in Chit Chat from the other host
    const nm = 'ann' + (process.pid % 1000); const b = await room(nm, 'Chit Chat'); await w(300);
    b.s.emit('say', { text: '@Marcus score' }); const sc = await waitFor(b.log, /you have/); assert.equal(sc.name, 'MarcusT'); assert.match(sc.text, /1 point/);
    b.s.emit('say', { text: '@marcus roll' }); await waitFor(b.log, /rolled a [1-6]/);
    b.s.disconnect();
  } finally { if (srv && srv.exitCode == null) await stop(); await pg.end(); }
});

test('master.html inline script parses (master console must load)', () => {
  const h = require('fs').readFileSync(path.join(root, 'master.html'), 'utf8');
  for (const s of [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])) new (require('vm').Script)(s);
});
