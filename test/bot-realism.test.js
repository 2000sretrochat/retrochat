'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const R = require('../bot-realism'), BOTMOD = require('../bots');
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const kyle = BOTMOD.BOTS.find(b => b.id === 'sk8rboi_1987');

test('reply delay is 2–12 seconds and grows with length', () => {
  for (const r of [0, 0.5, 0.999]) { assert.ok(R.delay('hi', () => r) >= 2000); assert.ok(R.delay('x'.repeat(500), () => r) <= 12000); }
  assert.ok(R.delay('x'.repeat(60), () => 0) > R.delay('hey', () => 0));
});

test('personalities are stable per bot and differ between bots', () => {
  const a = R.personality(kyle), b = R.personality(kyle);
  assert.deepEqual(a, b);
  const all = BOTMOD.BOTS.filter(x => !R.host(x)).map(x => JSON.stringify(R.personality(x)));
  assert.ok(new Set(all).size > 10);
  assert.ok(a.wake >= 15, 'night owls wake in the afternoon/evening MST');
});

test('awake hours use MST (UTC-7, no daylight saving)', () => {
  const p = { wake: 9, hours: 12 };
  const at = h => Date.UTC(2026, 6, 1, (h + 7) % 24, 30); // h o'clock in Phoenix
  assert.equal(R.mstHour(at(9)), 9);
  assert.equal(R.awake(kyle, p, at(9)), true); assert.equal(R.awake(kyle, p, at(20)), true); assert.equal(R.awake(kyle, p, at(21)), false); assert.equal(R.awake(kyle, p, at(3)), false);
  assert.equal(R.awake({ id: 'x', interactive: true }, p, at(3)), true, 'hosts never sleep');
});

test('style adds slang, lowercase, typos and emoji habits but never touches names', () => {
  const p = { slang: 2, lower: true, typo: 1, emoji: 1, emos: [':P'] };
  const out = R.style(kyle, p, 'Are you really coming tonight sk8rboi_1987 Zainy_99?', seq(0, 0.5, 0.2, 0, 0));
  assert.match(out, /^r u rly/); assert.match(out, /sk8rboi_1987 Zainy_99\?/); assert.match(out, / :P$/);
  assert.equal(R.style({ ...kyle, lang: 'ja' }, p, 'こんにちは'), 'こんにちは');
  assert.equal(R.style({ id: 'h', lang: 'en', trivia: true }, p, 'Question 1: Who?'), 'Question 1: Who?');
});

test('memory keeps the last 20 lines and finds the topic', () => {
  const m = new R.Memory(20);
  for (let i = 0; i < 25; i++) m.add('Lobby', { name: 'u' + i, text: 'line ' + i, t: i });
  assert.equal(m.recent('Lobby').length, 20); assert.equal(m.recent('Lobby')[0].name, 'u5');
  m.add('Lobby', { name: 'zainy', text: 'what music is everyone into', t: 100 });
  m.add('Lobby', { name: 'kyle', text: 'pop punk band all day', bot: true, t: 101 });
  assert.equal(m.topic('Lobby'), 'music'); assert.equal(m.lastHuman('Lobby').name, 'zainy');
  assert.deepEqual([...m.botSpeakers('Lobby', 0)], ['kyle']);
  m.clear('Lobby'); assert.equal(m.recent('Lobby').length, 0);
});

test('pace: 4 bot lines per 5 minutes per room, 12 s apart, 20 s per bot', () => {
  const p = new R.Pace(); let t = 1e6;
  assert.ok(p.ok('L', 'a', t)); p.take('L', 'a', t);
  assert.ok(!p.ok('L', 'b', t + 5e3)); assert.ok(!p.ok('L', 'a', t + 15e3)); assert.ok(p.ok('L', 'b', t + 15e3));
  for (let i = 1; i < 4; i++) p.take('L', 'b' + i, t + i * 20e3);
  assert.ok(!p.ok('L', 'c', t + 100e3)); assert.ok(p.ok('L', 'c', t + 301e3)); assert.ok(p.ok('Other', 'c', t + 100e3));
});

test('greeter: some joiners, room cooldown 2 min, person cooldown 30 min', () => {
  const g = new R.Greeter(), t = 1e7;
  assert.equal(g.should('L', 'zainy', t, () => 0.9), false, 'coin flip says no');
  assert.equal(g.should('L', 'zainy', t, () => 0.1), true);
  assert.equal(g.should('L', 'tony', t + 60e3, () => 0.1), false);
  assert.equal(g.should('L', 'tony', t + 121e3, () => 0.1), true);
  assert.equal(g.should('L', 'ZAINY', t + 600e3, () => 0.1), false);
  assert.equal(g.should('L', 'zainy', t + 1801e3, () => 0.1), true);
});

test('fewer chatting bots than people (one bot may talk to a lone visitor)', () => {
  const m = new R.Memory(), now = 1e6;
  assert.ok(R.speakersOk(m, 'L', 'kyle', 1, now));
  m.add('L', { name: 'kyle', text: 'hi', bot: true, t: now });
  assert.ok(R.speakersOk(m, 'L', 'kyle', 1, now)); assert.ok(!R.speakersOk(m, 'L', 'luna', 1, now)); assert.ok(!R.speakersOk(m, 'L', 'luna', 2, now));
  assert.ok(R.speakersOk(m, 'L', 'luna', 3, now)); assert.ok(R.speakersOk(m, 'L', 'luna', 1, now + 601e3));
});

test('template answers for simple questions, name mentions', () => {
  const r = () => 0;
  assert.equal(R.answer('how is everyone?', { who: 'zainy' }, r), 'pretty good, just chillin. hbu zainy?');
  assert.equal(R.answer("what's playing", { np: [{ name: 'tony', artist: 'Blink-182', song: 'Dammit' }] }, r), 'tony has Blink-182 - Dammit on right now');
  assert.match(R.answer('what song is playing', { who: 'z' }, r), /nothing on the mic/);
  assert.match(R.answer('anyone here?', { who: 'z' }, r), /im here z/);
  assert.equal(R.answer('where is everyone from', { who: 'z', from: 'San Diego, CA' }, r), 'im in San Diego, CA z');
  assert.equal(R.answer('how are you', { who: 'z' }, r), null, 'only when talking to the bot');
  assert.match(R.answer('how are you', { who: 'z', directed: true }, r), /^good z/);
  assert.match(R.answer('lol', { who: 'z', directed: true, topic: 'music' }, r), /playlist/);
  assert.equal(R.answer('nice weather', { who: 'z' }, r), null);
  const bots = BOTMOD.byRoom['Late Night'];
  assert.equal(R.mentioned(bots, 'lol sk8rboi is so funny'), kyle);
  assert.equal(R.mentioned(bots, 'i like skating'), null);
});

test('server wiring: pacing, typing pause, joins, awake hours, ignores/blocks/mutes, no mic', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(s, /require\('\.\/bot-realism'\)/);
  assert.match(s, /function botSpeak\(room, b, text, to/);
  assert.match(s, /botPace\.ok\(room, b\.id, now\) \|\| !REAL\.speakersOk/);
  assert.doesNotMatch(s, /io\.to\(room\)\.emit\('typing'/);
  assert.match(s, /x\.data\.ign\?\.has\(lc\) && !\(id && x\.data\.blk\?\.has\(id\)\)/);
  assert.match(s, /mod\(room\)\.mt\.has\(whoLc\)/);
  assert.match(s, /if \(!s\.data\.inc && noticeOk\(\)\) botJoined\(room, s\.data\.name\);/);
  assert.match(s, /setInterval\(botRealismTick, 5 \* 60e3\)/);
  assert.match(s, /botPresence\.get\(b\.id\) === true \|\| !botAsleep\.has\(b\.id\)/);
  const block = s.slice(s.indexOf('// ---- Bot realism'), s.indexOf('function botRealismTick'));
  assert.doesNotMatch(block, /talk\s*=\s*true|'mic|micdrop|np:set/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'bot-realism.js'), 'utf8'), /require\(|fetch\(|https?:/);
});
