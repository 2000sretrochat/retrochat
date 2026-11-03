// Anti-spam / flood control shared by room chat, room PMs and Messenger IMs (masters are exempt)
const U = new Map(); // key -> { ts:[], last:'', rep:0, until:0 }
const RATE = +process.env.FLOOD_RATE || 8, WIN = 10e3, REP = +process.env.FLOOD_REP || 3, MUTE = +process.env.FLOOD_MUTE_MS || 60e3;
function check(key, text, master) {
  if (master || !key) return null; key = String(key).toLowerCase(); const now = Date.now();
  const u = U.get(key) || { ts: [], last: '', rep: 0, lastT: 0, until: 0 }; U.set(key, u);
  if (u.until > now) return 'Whoa, slow down a little! You can chat again in ' + Math.ceil((u.until - now) / 1000) + 's.';
  u.ts = u.ts.filter(t => now - t < WIN); u.ts.push(now);
  const norm = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (norm && norm === u.last && now - u.lastT < 60e3) u.rep++; else u.rep = 1; u.last = norm; u.lastT = now;
  if (u.ts.length > RATE || u.rep >= REP) { const why = u.rep >= REP ? 'repeating the same message' : 'sending messages too fast'; u.until = now + MUTE; u.ts = []; u.rep = 0; return 'Whoa, slow down a little! You were ' + why + ', so please take a ' + MUTE / 1000 + '-second breather.'; }
  return null;
}
setInterval(() => { const now = Date.now(); for (const [k, u] of U) if (u.until < now && (!u.ts.length || now - u.ts[u.ts.length - 1] > 120e3)) U.delete(k); }, 60e3).unref();
module.exports = { check, _reset: () => U.clear() };
