// Trivia rounds run by the two trivia hosts (Jenna_Q, MarcusT). Rounds only start when someone asks,
// one round per room, up to 2 hints (timed or on request) before the answer is revealed.
// Answers are recognized from normal chat (no @ needed). Scores persist through `store`.
const QUESTIONS = [
  { q: 'Which Messenger feature shook your buddy\'s window?', a: ['buzz', 'nudge'], h: 'You did it to get someone\'s attention.' },
  { q: 'What does PM stand for in chat?', a: ['private message', 'private msg'], h: 'Only one person can read it.' },
  { q: 'Complete the AOL phrase: "You\'ve got ___!"', a: ['mail'], h: 'Delivered to an inbox.' },
  { q: 'Which band sang "Mr. Brightside" (2004)?', a: ['the killers', 'killers'], h: 'Las Vegas band.' },
  { q: 'What was the name of the virtual pet keychain from Bandai?', a: ['tamagotchi'], h: 'It hatched from an egg.' },
  { q: 'Which 2004 movie gave us "On Wednesdays we wear pink"?', a: ['mean girls'], h: 'Lindsay Lohan and Rachel McAdams.' },
  { q: 'What music player "really whips the llama\'s ass"?', a: ['winamp'], h: 'Made by Nullsoft.' },
  { q: 'Which social network let you pick a "Top 8" of friends?', a: ['myspace'], h: 'Tom was everyone\'s first friend.' },
  { q: 'Which video rental chain had blue-and-yellow stores?', a: ['blockbuster'], h: 'Be kind, rewind.' },
  { q: 'Which boy band sang "Bye Bye Bye"?', a: ['nsync', '*nsync', 'n sync'], h: 'Justin Timberlake was in it.' },
  { q: 'Which Nintendo handheld launched in 2004 with two screens?', a: ['nintendo ds', 'ds'], h: 'Dual ___.' },
  { q: 'Which artist sang "Toxic" (2003)?', a: ['britney spears', 'britney'], h: 'She also did "Oops!... I Did It Again".' },
  { q: 'Which life-simulation game made you remove the pool ladder?', a: ['the sims', 'sims'], h: 'Created by Will Wright.' },
  { q: 'Which Apple music player came out in 2001?', a: ['ipod'], h: '1,000 songs in your pocket.' },
  { q: 'Which OutKast song told you to "shake it like a Polaroid picture"?', a: ['hey ya', 'hey ya!'], h: 'Starts with a greeting.' },
];
const norm = s => String(s || '').toLowerCase().replace(/@[a-z0-9_]+[,:]?/g, ' ').replace(/[^\p{L}\p{N}* ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const matches = (text, answers) => { const t = ' ' + norm(text) + ' '; return answers.some(a => { const n = norm(a); return n && t.includes(' ' + n + ' '); }); };
const mask = a => { const w = String(a); return w.split('').map((c, i) => /\s/.test(c) ? '  ' : (i === 0 || i % 3 === 0 ? c.toUpperCase() : '_')).join(' ').replace(/\s{3,}/g, '   '); };
function memoryStore() { const m = new Map(); return {
  async add(name, n = 1) { const k = String(name).toLowerCase(); const r = m.get(k) || { name, points: 0 }; r.name = name; r.points += n; m.set(k, r); return r.points; },
  async get(name) { return (m.get(String(name).toLowerCase()) || { points: 0 }).points; },
  async top(n = 5) { return [...m.values()].sort((a, b) => b.points - a.points).slice(0, n); } }; }
function dbStore(db) { return {
  async add(name, n = 1) { const r = await db.q(`insert into trivia_scores(name_lc,name,points) values($1,$2,$3)
      on conflict(name_lc) do update set points=trivia_scores.points+excluded.points, name=excluded.name, updated=now() returning points`, [String(name).toLowerCase(), String(name).slice(0, 40), n]); return +r[0].points; },
  async get(name) { const r = await db.q('select points from trivia_scores where name_lc=$1', [String(name).toLowerCase()]); return r[0] ? +r[0].points : 0; },
  async top(n = 5) { return (await db.q('select name,points from trivia_scores order by points desc, updated asc limit $1', [n])).map(r => ({ name: r.name, points: +r.points })); } }; }

function createTrivia({ say, store = memoryStore(), questions = QUESTIONS, stepMs = 20000, timers = { setTimeout, clearTimeout }, rnd = Math.random }) {
  const rooms = new Map(), recent = new Map();
  const pts = n => n + (n === 1 ? ' point' : ' points');
  function pickQ(room) { const used = recent.get(room) || []; const pool = questions.filter(q => !used.includes(q.q)); const q = (pool.length ? pool : questions)[Math.floor(rnd() * (pool.length || questions.length))];
    used.push(q.q); if (used.length > Math.min(8, questions.length - 1)) used.shift(); recent.set(room, used); return q; }
  function hintText(r, k) { return k === 1 ? 'Hint 1: ' + (r.q.h || ('starts with "' + r.q.a[0][0].toUpperCase() + '"')) + ' (' + r.q.a[0].replace(/\s/g, '').length + ' letters)' : 'Hint 2: ' + mask(r.q.a[0]); }
  function arm(room) { const r = rooms.get(room); if (!r) return; timers.clearTimeout(r.timer); r.timer = timers.setTimeout(() => step(room), stepMs); r.timer?.unref?.(); }
  function step(room) { const r = rooms.get(room); if (!r) return;
    if (r.hints < 2) { r.hints++; say(room, r.host, hintText(r, r.hints)); arm(room); return; }
    rooms.delete(room); say(room, r.host, 'Time\'s up! The answer was: ' + r.q.a[0] + '. Say "@' + r.host.name + ' trivia" for another one.'); }
  function start(room, host) { const cur = rooms.get(room);
    if (cur) { say(room, cur.host, 'Still going: ' + cur.q.q + (cur.hints ? ' (' + hintText(cur, cur.hints) + ')' : '')); return true; }
    const q = pickQ(room); rooms.set(room, { host, q, hints: 0, timer: null }); say(room, host, 'Trivia time! ' + q.q + ' Just type your answer. I\'ll give 2 hints if nobody gets it.'); arm(room); return true; }
  function hint(room) { const r = rooms.get(room); if (!r) return false; if (r.hints >= 2) { say(room, r.host, 'That was both hints! ' + hintText(r, 2)); return true; } r.hints++; say(room, r.host, hintText(r, r.hints)); arm(room); return true; }
  // Called for every room message. Returns true if trivia consumed it.
  async function hear(room, who, text, host) { const r = rooms.get(room); const t = norm(text);
    if (r && matches(text, r.q.a)) { rooms.delete(room); timers.clearTimeout(r.timer); let total = null; try { total = await store.add(who, 1); } catch (e) { console.error('[trivia score]', e.message); }
      say(room, r.host, 'Yes! ' + who + ' got it: ' + r.q.a[0] + '.' + (total != null ? ' ' + who + ' now has ' + pts(total) + '.' : '')); return true; }
    if (!host) return false;
    if (/\b(score|points|my score)\b/.test(t)) { const n = await store.get(who).catch(() => 0); say(room, host, who + ', you have ' + pts(n) + '.'); return true; }
    if (/\b(leaderboard|top|scores|scoreboard)\b/.test(t)) { const top = await store.top(5).catch(() => []); say(room, host, top.length ? 'Top players: ' + top.map((x, i) => (i + 1) + '. ' + x.name + ' (' + x.points + ')').join(', ') : 'No scores yet. Say "@' + host.name + ' trivia" to play!'); return true; }
    if (/\bhint\b/.test(t)) return r ? hint(room) : (say(room, host, 'No question right now. Say "@' + host.name + ' trivia" to start.'), true);
    if (/\b(trivia|question|quiz|play|start)\b/.test(t)) return start(room, host);
    return false; }
  return { start, hint, hear, active: room => rooms.has(room), state: room => rooms.get(room), stop: room => { const r = rooms.get(room); if (r) timers.clearTimeout(r.timer); rooms.delete(room); } };
}
module.exports = { createTrivia, memoryStore, dbStore, QUESTIONS, matches, norm };
