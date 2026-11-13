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

module.exports = { applyBackdates, BACKDATED_NAMES, BACKDATE_AT };
