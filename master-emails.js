'use strict';
// Startup email seeding for the owner's own master accounts (idempotent; never creates accounts).
// - zainyochka@gmail.com is shared by exactly the names in emails.js SHARED_EMAIL_NAMES (zainy, zainyochka, razzle).
// - bigtony gets teslaphx@gmail.com only when bigtony has no email yet and no other account already uses that address.
const EM = require('./emails');
const SHARED_EMAIL = 'zainyochka@gmail.com';
const BIGTONY_EMAIL = 'teslaphx@gmail.com';

async function seedSharedEmail(db) {
  const en = EM.norm(SHARED_EMAIL), changed = [];
  for (const nm of EM.sharedNames(SHARED_EMAIL)) {
    const u = (await db.q('select id,name,email_norm from users where name_lc=$1', [nm]))[0];
    if (u && u.email_norm !== en) { await db.q('update users set email=$2,email_norm=$3 where id=$1', [u.id, SHARED_EMAIL, en]); changed.push(u.name); }
  }
  return changed;
}

async function seedBigTonyEmail(db) {
  const en = EM.norm(BIGTONY_EMAIL);
  const u = (await db.q("select id,name,email from users where name_lc='bigtony'"))[0];
  if (!u || String(u.email || '').trim()) return false;
  const used = await db.q('select id from users where email_norm=$1 and id<>$2 limit 1', [en, u.id]);
  if (used.length) return false;
  const r = await db.q("update users set email=$2,email_norm=$3 where id=$1 and coalesce(trim(email),'')='' returning id", [u.id, BIGTONY_EMAIL, en]);
  return r.length > 0;
}

module.exports = { seedSharedEmail, seedBigTonyEmail, SHARED_EMAIL, BIGTONY_EMAIL };
