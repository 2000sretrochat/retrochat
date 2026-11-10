const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const server = read('server.js');
const handler = server.slice(server.indexOf("s.on('hand',"), server.indexOf("s.on('handq',"));

test('raising a hand only joins the line; it never keys anyone up', () => {
  assert.ok(handler.length > 100);
  assert.doesNotMatch(handler, /advance\(/);
  assert.doesNotMatch(handler, /startTurn\(/);
  assert.match(handler, /cb\(\{ ok: true, up: pos >= 0, pos: pos \+ 1, free:/);
});

test('the line advances only on a hand-off (Talk off, time up, pass, speaker gone)', () => {
  assert.match(server, /function advance\(room, handoff = false\)/);
  assert.match(server, /if \(hqOn\(room\) && handoff\) \{ const q = qOf\(room\);/);
  assert.match(server, /if \(micsUsed\(room\) < \(MICPREV\[room\] \|\| 0\)\) handoff = true;/);
  assert.match(server, /const had = s\.data\.talk; s\.data\.talk = false; s\.data\.talkUntil = 0; advance\(room, had\);/);
  assert.match(server, /passed the mic to the next in line\.' \}\); advance\(room, true\)/);
  // first in line may take a free mic with Talk; others must raise a hand
  assert.match(server, /if \(hqOn\(room\) && qOf\(room\)\.length && QUEUE\[room\]\[0\] !== s\.id\) return ack/);
});

test('Listen is never a dead button: it plays, or says why nothing is playing', () => {
  const rm = read('public/room-music.js');
  assert.match(rm, /button\.disabled=false;/);
  assert.match(rm, /socket\.emit\('music:why'/);
  for (const k of ['off', 'empty', 'multi', 'mic', 'starting', 'blocked']) assert.match(rm, new RegExp('\\b' + k + ":'"));
  assert.match(server, /s\.on\('music:why'/);
});

test('music lobby count() reports the library size', async () => {
  const { createMusicLobby } = require('../music-lobby');
  const lobby = createMusicLobby({ db: { status: () => ({ ready: true }), q: async () => [{ n: 0 }] }, occupied: () => true, humanTurn: () => false, emit: () => {} });
  assert.equal(await lobby.count(), 0);
});
