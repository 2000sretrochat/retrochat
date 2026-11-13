'use strict';
// Failed sign-in protection, kept in Postgres (login_guard) so deploys and restarts don't reset it.
// Per screen name (counted the same for names that don't exist, so replies never reveal whether an account exists):
//   10 failed passwords within an hour -> 5-minute wait.
//   Another 10 failures within 24 hours of that wait -> the screen name is locked until the password is reset
//   (the reset link is emailed when email is configured) or a master unlocks it in the Master Console.
// Per network (IP): 30 failures within 15 minutes -> 5-minute wait for that network (never a lock).
const MAX_FAILS = 10, NAME_WINDOW_MS = 3600e3, COOLDOWN_MS = 5 * 60e3, STRIKE_WINDOW_MS = 24 * 3600e3;
const IP_MAX_FAILS = 30, IP_WINDOW_MS = 15 * 60e3;
const MSG = {
  wait: 'Too many failed sign-in attempts. Please wait 5 minutes, then try again.',
  locked: 'This screen name is locked after too many failed sign-in attempts. Use "Forgot password" to reset it, or ask a site master to unlock it.'
};
const SCHEMA = `create table if not exists login_guard(key text primary key, fails int not null default 0, window_start timestamptz,
  locked_until timestamptz, strikes int not null default 0, strike_at timestamptz, locked boolean not null default false, updated timestamptz not null default now());`;
const nameKey = lc => 'n:' + String(lc || '').toLowerCase().slice(0, 40), ipKey = ip => 'ip:' + String(ip || '').slice(0, 64);
const ms = v => (v == null ? 0 : new Date(v).getTime());

function createLoginGuard({ db, now = () => Date.now() }) {
  const get = async key => (await db.q('select fails,window_start,locked_until,strikes,strike_at,locked from login_guard where key=$1', [key]))[0] || null;
  const put = (key, r) => db.q(`insert into login_guard(key,fails,window_start,locked_until,strikes,strike_at,locked,updated) values($1,$2,$3,$4,$5,$6,$7,now())
    on conflict(key) do update set fails=$2,window_start=$3,locked_until=$4,strikes=$5,strike_at=$6,locked=$7,updated=now()`,
    [key, r.fails, r.window_start == null ? null : new Date(ms(r.window_start)), r.locked_until == null ? null : new Date(ms(r.locked_until)),
      r.strikes, r.strike_at == null ? null : new Date(ms(r.strike_at)), !!r.locked]);

  // Before checking the password: is this name locked or cooling down, or this network cooling down?
  async function check(nameLc, ip) {
    const t = now(), n = await get(nameKey(nameLc));
    if (n?.locked) return { status: 423, error: MSG.locked, locked: true };
    if (ms(n?.locked_until) > t) return { status: 429, error: MSG.wait, retryAfter: Math.ceil((ms(n.locked_until) - t) / 1000) };
    const i = ip ? await get(ipKey(ip)) : null;
    if (ms(i?.locked_until) > t) return { status: 429, error: MSG.wait, retryAfter: Math.ceil((ms(i.locked_until) - t) / 1000) };
    return null;
  }

  // After a wrong password. Returns { status, error, lockedNow } for the reply.
  async function fail(nameLc, ip) {
    const t = now(), key = nameKey(nameLc);
    const r = (await get(key)) || { fails: 0, strikes: 0, locked: false };
    if (r.window_start == null || t - ms(r.window_start) > NAME_WINDOW_MS) { r.fails = 0; r.window_start = t; }
    if (r.strikes && t - ms(r.strike_at) > STRIKE_WINDOW_MS) { r.strikes = 0; r.strike_at = null; }
    r.fails++;
    let out = { status: 401, error: 'Invalid screen name or password.' };
    if (r.fails >= MAX_FAILS) {
      r.fails = 0; r.window_start = null;
      if (r.strikes >= 1) { r.locked = true; r.locked_until = null; out = { status: 423, error: MSG.locked, lockedNow: true }; }
      else { r.strikes = 1; r.strike_at = t; r.locked_until = t + COOLDOWN_MS; out = { status: 429, error: MSG.wait }; }
    }
    await put(key, r);
    if (ip) {
      const k = ipKey(ip), i = (await get(k)) || { fails: 0, strikes: 0, locked: false };
      if (i.window_start == null || t - ms(i.window_start) > IP_WINDOW_MS) { i.fails = 0; i.window_start = t; }
      i.fails++;
      if (i.fails >= IP_MAX_FAILS) { i.fails = 0; i.window_start = null; i.locked_until = t + COOLDOWN_MS; if (out.status === 401) out = { status: 429, error: MSG.wait }; }
      await put(k, i);
    }
    return out;
  }

  // A correct password (or a password reset / master unlock) clears the screen name's counters and lock.
  const clear = nameLc => db.q('delete from login_guard where key=$1', [nameKey(nameLc)]);
  // housekeeping: forget stale counters (locks stay until reset/unlock)
  const prune = () => db.q("delete from login_guard where not locked and updated < now() - interval '2 days'");
  const lockedNames = async () => (await db.q("select substr(key,3) as name_lc from login_guard where locked and key like 'n:%'")).map(r => r.name_lc);
  return { check, fail, clear, prune, lockedNames };
}
module.exports = { createLoginGuard, MSG, SCHEMA, MAX_FAILS, COOLDOWN_MS, STRIKE_WINDOW_MS, IP_MAX_FAILS };
