'use strict';
// Bot realism without any AI service: timing, short room memory, simple triggers,
// per-bot habits, awake hours (MST) and pacing. Everything here is cheap string work.
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pickR = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length) % a.length];
const MST = 7 * 3600e3; // Arizona time, no daylight saving
const mstHour = (now = Date.now()) => new Date(now - MST).getUTCHours();
const host = b => !!(b.trivia || b.lines || b.interactive || b.silent || b.music || b.games);

const EMOS = [[':)', ':P', ';)'], ['xD', 'lol', ':D'], ['<3', ':)', '^_^'], [':P', 'B)', '8)'], ['~*~', '<3', ':)']];
function personality(b, seed = {}) {
  const h = hash(b.id || b.name), nightOwl = /night|moon|sk8r|owl|dj_|late/i.test(b.name + ' ' + (b.room || ''));
  return {
    typo: [0, 0.04, 0.08, 0.12][(h >>> 3) % 4], emoji: [0.05, 0.15, 0.25, 0.35][(h >>> 6) % 4], lower: (h >>> 9) % 3 !== 0,
    slang: (h >>> 11) % 3, emos: EMOS[(h >>> 13) % EMOS.length],
    wake: nightOwl ? 15 + (h >>> 16) % 4 : 7 + (h >>> 16) % 4, hours: nightOwl ? 14 : 13 + (h >>> 19) % 4,
    topics: String(seed.interests || '').split(/\s*,\s*/).filter(Boolean).slice(0, 4), from: seed.location || '',
  };
}
const awake = (b, p, now = Date.now()) => host(b) || (mstHour(now) - p.wake + 24) % 24 < p.hours;

const SLANG = [[/\byou\b/gi, 'u'], [/\bare\b/gi, 'r'], [/\bbecause\b/gi, 'cuz'], [/\breally\b/gi, 'rly'], [/\bplease\b/gi, 'pls'], [/\bwhat'?s\b/gi, 'whats'], [/\bokay\b/gi, 'ok']];
function typo(text, rnd) {
  const words = text.split(' '), idx = words.map((w, i) => /^[a-z]{5,}$/i.test(w) ? i : -1).filter(i => i >= 0);
  if (!idx.length) return text;
  const i = pickR(idx, rnd), w = words[i], k = 1 + Math.floor(rnd() * (w.length - 3));
  words[i] = w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2); return words.join(' ');
}
// Names and @mentions are never changed.
function style(b, p, text, rnd = Math.random) {
  if (host(b) || b.lang !== 'en') return text;
  let t = String(text);
  if (p.slang && rnd() < p.slang / 2) for (const [re, to] of SLANG) t = t.replace(re, to);
  if (p.lower) t = t.replace(/[A-Za-z][^\s]*/g, w => /[_\d@]/.test(w) ? w : w.toLowerCase()).replace(/\.$/, '');
  if (rnd() < p.typo) t = typo(t, rnd);
  if (rnd() < p.emoji && !/[:;<^~xB8][)PD3_*)]$|lol$/.test(t)) t += ' ' + pickR(p.emos, rnd);
  return t;
}
// 2–12 s, longer lines take longer to "type".
const delay = (text, rnd = Math.random) => Math.round(Math.min(12000, Math.max(2000, 1500 + String(text).length * 110 + rnd() * 2500)));

const TOPICS = { music: /\b(song|songs|music|band|album|playing|listening|mixtape|cd)\b/, movies: /\b(movie|movies|film|netflix|blockbuster|dvd)\b/, games: /\b(game|games|gaming|xbox|playstation|nintendo|halo|sims)\b/,
  school: /\b(school|class|homework|teacher|exam|college)\b/, work: /\b(work|job|boss|shift)\b/, food: /\b(food|eat|eating|pizza|dinner|lunch|hungry)\b/, sports: /\b(game day|football|soccer|basketball|baseball|team)\b/, weather: /\b(weather|hot|cold|rain|snow)\b/ };
const FOLLOW = { music: ['what else is on ur playlist {n}?', 'ok {n} whats the best album ever tho', 'i need new music, {n} got recs?'], movies: ['{n} seen anything good lately?', 'best movie ever {n}? go'], games: ['{n} what r u playing lately?', 'halo or the sims {n}? lol'],
  school: ['ugh school. what grade/class {n}?', 'homework is the worst {n}'], work: ['{n} long day at work?', 'work is draining lol, hang in there {n}'], food: ['{n} now im hungry lol', 'pizza is always the answer {n}'],
  sports: ['who r u rooting for {n}?'], weather: ['its sooo hot here in AZ lol', '{n} where r u that its like that?'] };

class Memory {
  constructor(max = 20) { this.max = max; this.rooms = new Map(); }
  add(room, m) { const l = this.rooms.get(room) || []; l.push({ name: String(m.name || ''), text: String(m.text || '').slice(0, 300), bot: !!m.bot, t: m.t || Date.now() }); if (l.length > this.max) l.splice(0, l.length - this.max); this.rooms.set(room, l); }
  recent(room) { return this.rooms.get(room) || []; }
  clear(room) { this.rooms.delete(room); }
  lastHuman(room) { const l = this.recent(room); for (let i = l.length - 1; i >= 0; i--) if (!l[i].bot) return l[i]; return null; }
  topic(room) { const n = {}; for (const m of this.recent(room).slice(-10)) { const t = m.text.toLowerCase(); for (const k in TOPICS) if (TOPICS[k].test(t)) n[k] = (n[k] || 0) + (m.bot ? 1 : 2); } let best = null; for (const k in n) if (!best || n[k] > n[best]) best = k; return best; }
  botSpeakers(room, since) { return new Set(this.recent(room).filter(m => m.bot && m.t >= since).map(m => m.name)); }
}

// Pacing: per room at most 4 bot lines in 5 minutes and 12 s between bot lines; per bot 20 s.
class Pace {
  constructor({ perWindow = 4, windowMs = 300e3, roomGap = 12e3, botGap = 20e3 } = {}) { Object.assign(this, { perWindow, windowMs, roomGap, botGap }); this.rooms = new Map(); this.bots = new Map(); }
  ok(room, bot, now = Date.now()) { const l = (this.rooms.get(room) || []).filter(t => now - t < this.windowMs); this.rooms.set(room, l);
    return l.length < this.perWindow && (!l.length || now - l[l.length - 1] >= this.roomGap) && now - (this.bots.get(bot) || 0) >= this.botGap; }
  take(room, bot, now = Date.now()) { (this.rooms.get(room) || this.rooms.set(room, []).get(room)).push(now); this.bots.set(bot, now); }
}

// Greets some joiners: half the time, at most once per 2 min per room and once per 30 min per person.
class Greeter {
  constructor() { this.room = new Map(); this.person = new Map(); }
  should(room, who, now = Date.now(), rnd = Math.random) {
    const k = String(who).toLowerCase();
    if (now - (this.room.get(room) || 0) < 120e3 || now - (this.person.get(k) || 0) < 1800e3 || rnd() >= 0.5) return false;
    this.room.set(room, now); this.person.set(k, now);
    if (this.person.size > 2000) for (const [n, t] of this.person) if (now - t > 1800e3) this.person.delete(n);
    return true;
  }
}

// Fewer chatting bots than people: a lone visitor can talk to one bot; two bots chat only with 3+ people around.
const speakersOk = (memory, room, bot, humans, now = Date.now()) => { const s = memory.botSpeakers(room, now - 600e3); s.add(bot); return s.size <= Math.max(1, humans - 1); };

// Answers to simple questions. ctx: {who, np:[{name,artist,song}], topic, from, directed}
function answer(text, ctx, rnd = Math.random) {
  const t = String(text).toLowerCase(), n = ctx.who || '';
  const say = a => pickR(a, rnd).replace(/\{n\}/g, n);
  if (/\bhow('?s| is| are| r)? (every(one|body)|ya'?ll|you all|u all|you guys|u guys|everybody doing)\b|\bhows every(one|body)\b/.test(t)) return say(['pretty good, just chillin. hbu {n}?', 'tired lol but good', 'doing good {n}! u?', 'not bad, just hanging out in here']);
  if (/\bwhat'?s (playing|on)\b|\bwhat (song|music) is (on|playing)\b|\bwhat (are|r) (you|u|y'?all) listening to\b|\bwhat r u listening\b/.test(t)) {
    const np = (ctx.np || [])[0]; if (np) return np.name + ' has ' + np.artist + ' - ' + np.song + ' on right now';
    return say(['nothing on the mic rn, someone should play something!', 'nobody is playing anything yet, {n} pick a song?', 'just mr brightside on repeat in my head lol']); }
  if (ctx.directed && /\bhow (are|r) (you|u)\b|\bhow u doin|\bhows it going\b/.test(t)) return say(['good {n}! hbu?', 'pretty good, kinda bored lol', 'im ok {n}, just chillin']);
  if (ctx.directed && /\b(what'?s up|wassup|whats good|sup)\b/.test(t)) return say(['not much {n}, hbu?', 'nm just chillin', 'nothin much lol']);
  if (/\b(any(one|body)) (here|there|on|around|awake)\b/.test(t)) return say(['yep im here {n}', 'here!', 'hey {n} im around']);
  if (/\bwhere (is|are|r) (every(one|body)|you|u|y'?all|you guys|u guys) from\b|\ba\/?s\/?l\b/.test(t)) return ctx.from ? say(['im in ' + ctx.from + ' {n}', ctx.from + ' :) hbu {n}?']) : null;
  if (ctx.directed && ctx.topic && FOLLOW[ctx.topic]) return say(FOLLOW[ctx.topic]);
  return null;
}

module.exports = { hash, mstHour, host, personality, awake, style, delay, Memory, Pace, Greeter, speakersOk, answer, FOLLOW, TOPICS };
// A bot's name said anywhere in a line ("lol sk8rboi is funny"): full name, or its first part when 4+ letters.
function mentioned(bots, text) {
  const t = ' ' + String(text).toLowerCase().replace(/[^a-z0-9_\s]/g, ' ') + ' ';
  const hits = bots.filter(b => { const n = b.name.toLowerCase(), head = n.split('_')[0];
    return t.includes(' ' + n + ' ') || (head.length >= 4 && head !== n && t.includes(' ' + head + ' ')); });
  return hits.length === 1 ? hits[0] : null;
}
module.exports.mentioned = mentioned;
