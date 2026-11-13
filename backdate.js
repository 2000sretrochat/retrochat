'use strict';
// Owner request (Nov 12, 2026): these screen names show as created 11/11/2026.
// users.created is the only stored creation date; it feeds every "Member since" / "Created" display
// (Messenger profile, Social profile API, Master Console + Social admin account details, admin page).
// Runs at startup, idempotent, case-insensitive, and only touches accounts that exist.
const BACKDATED_NAMES = Object.freeze(['zainy', 'zainyochka', 'tony', 'bigtony']);
const BACKDATE_AT = '2026-11-11T19:00:00Z'; // 12:00 PM America/Phoenix (MST, UTC-7) on 11/11/2026

async function applyBackdates(db) {
  const rows = await db.q(
    'update users set created=$1::timestamptz where lower(name_lc) = any($2::text[]) and created is distinct from $1::timestamptz returning name',
    [BACKDATE_AT, [...BACKDATED_NAMES]]);
  return rows.map(r => r.name);
}

// Owner request (Nov 13, 2026): razzle shows as created 3 weeks before Nov 13 (10/23/2026 12:00 PM MST).
const RAZZLE_AT = '2026-10-23T19:00:00Z';
async function applyRazzleBackdate(db) {
  const rows = await db.q("update users set created=$1::timestamptz where name_lc='razzle' and created is distinct from $1::timestamptz returning name", [RAZZLE_AT]);
  return rows.map(r => r.name);
}

// Bot accounts (the Social/room bot profiles, PROFILE_SEEDS in bots.js) get natural-looking join dates between
// 10/23/2026 and 11/13/2026. A bot account is a users row linked in social_bot_members AND seeded with a
// '!social-bot:' password (seedSocialBots never converts a real member, so real accounts are never matched).
// The date is a stable hash of the bot id (survives renames): a day in the range and a time between 8:00 AM and
// 9:59 PM MST (UTC-7, no DST in Phoenix). Dates still in the future are skipped and applied on a later start.
const BOT_FROM = Date.UTC(2026, 9, 23, 7, 0); // 10/23/2026 00:00 MST
const BOT_DAYS = 22;                          // 10/23 .. 11/13 inclusive
function botCreatedAt(botId) {
  const h = require('node:crypto').createHash('sha256').update(String(botId).toLowerCase()).digest();
  const day = h.readUInt32BE(0) % BOT_DAYS, minute = 8 * 60 + h.readUInt32BE(4) % (14 * 60);
  return new Date(BOT_FROM + day * 86400e3 + minute * 60e3).toISOString();
}
async function applyBotBackdates(db, now = new Date()) {
  const bots = await db.q(`select u.id,u.created,b.bot_id from users u join social_bot_members b on b.user_id=u.id where u.pw like '!social-bot:%'`);
  const ids = [], ats = [];
  for (const b of bots) {
    const at = botCreatedAt(b.bot_id);
    if (+new Date(at) > +now) continue;
    if (b.created && +new Date(b.created) === +new Date(at)) continue;
    ids.push(b.id); ats.push(at);
  }
  if (!ids.length) return [];
  const rows = await db.q(`update users u set created=v.at from unnest($1::int[],$2::timestamptz[]) as v(id,at)
    where u.id=v.id and u.pw like '!social-bot:%' and exists(select 1 from social_bot_members b where b.user_id=u.id)
    and u.created is distinct from v.at returning u.name`, [ids, ats]);
  return rows.map(r => r.name);
}

module.exports = { applyBackdates, BACKDATED_NAMES, BACKDATE_AT, applyRazzleBackdate, RAZZLE_AT, botCreatedAt, applyBotBackdates, BOT_FROM, BOT_DAYS };
