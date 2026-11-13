'use strict';
// Idempotent bot profile seeding (one row per bot in bot_profiles, keyed by name_lc with a unique bot_id).
// Never overwrites a master's edits and never touches real user accounts (only the bot_profiles table).
// Root cause this fixes: when a bot was renamed in bots.js (e.g. bart-simpson Bart_Simpson -> Patch_Pigeon) its
// existing row kept the old name_lc but already held the bot_id, so "insert ... on conflict(name_lc)" for the new
// name hit the bot_profiles_bot_id unique index, threw, and aborted the whole loop on every startup.

function dedupeSeeds(seeds) {
  const ids = new Set(), names = new Set(), out = [];
  for (const d of seeds || []) {
    if (!d || !d.id || !d.name) continue;
    const lc = String(d.name).toLowerCase();
    if (ids.has(d.id) || names.has(lc)) continue;
    ids.add(d.id); names.add(lc); out.push(d);
  }
  return out;
}

async function seedOne(db, d, BOTMOD, audit, stats) {
  const lc = d.name.toLowerCase();
  // Legacy "[bot]" rows (TriviaTime [bot] ...) are renamed in place so edits and avatars survive.
  for (const old of d.legacy || []) {
    const olc = String(old).toLowerCase(); if (olc === lc) continue;
    const has = (await db.q('select 1 from bot_profiles where name_lc=$1', [lc])).length;
    if (has) { await db.q('update bot_profiles set bot_id=null where name_lc=$1 and bot_id=$2', [olc, d.id]); continue; }
    const r = await db.q('update bot_profiles set name_lc=$2, name=$3, bot_id=$4 where name_lc=$1 and (bot_id is null or bot_id=$4) and not exists (select 1 from bot_profiles x where x.bot_id=$4 and x.name_lc<>$1) returning display_name,bio,room', [olc, lc, d.name, d.id]);
    if (r.length) {
      if (r[0].display_name === (BOTMOD.LEGACY_DEFAULT_DISPLAY || {})[d.id] || r[0].display_name === '') await db.q('update bot_profiles set display_name=$2 where name_lc=$1', [lc, d.display_name]);
      if (r[0].bio === (BOTMOD.LEGACY_DEFAULT_BIO || {})[d.id] || r[0].bio === '') await db.q('update bot_profiles set bio=$2, interests=$3, location=$4 where name_lc=$1', [lc, d.bio, d.interests, d.location]);
      if ((BOTMOD.LEGACY_DEFAULT_ROOM || {})[d.id] && r[0].room === BOTMOD.LEGACY_DEFAULT_ROOM[d.id]) await db.q('update bot_profiles set room=$2 where name_lc=$1', [lc, d.room]);
      await db.q("update bot_profiles set avatar='' where name_lc=$1 and avatar=$2", [lc, d.id]);
      await audit('system', 'bot-rename', old, d.name);
      stats.renamed++;
    }
  }
  // Renamed in bots.js: the row holding this bot_id lives under an older name. Move it to the new name in place
  // (keeps master edits and the bot_avatars upload, which is keyed by bot_id). Rows no master ever edited
  // (updated_by is null) take the new seed's text so an old character name doesn't linger.
  const held = (await db.q('select name_lc,name,updated_by from bot_profiles where bot_id=$1', [d.id]))[0];
  if (held && held.name_lc !== lc) {
    const taken = (await db.q('select bot_id from bot_profiles where name_lc=$1', [lc]))[0];
    if (!taken) {
      await db.q('update bot_profiles set name_lc=$2, name=$3 where name_lc=$1 and bot_id=$4', [held.name_lc, lc, d.name, d.id]);
      if (!held.updated_by) await db.q("update bot_profiles set display_name=$2, bio=$3, location=$4, interests=$5, room=coalesce(nullif($6,''),room), avatar=case when avatar in ('',$7,$8) then $9 else avatar end where name_lc=$1",
        [lc, d.display_name || '', d.bio || '', d.location || '', d.interests || '', d.room || '', d.id, held.name_lc, d.avatar_key || '']);
      await audit('system', 'bot-rename', held.name, d.name);
      stats.renamed++;
    } else if (!taken.bot_id) {
      // A row already exists under the new name: it becomes this bot's profile; the old one keeps its data, unlinked.
      await db.q('update bot_profiles set bot_id=null where name_lc=$1 and bot_id=$2', [held.name_lc, d.id]);
    } else if (taken.bot_id !== d.id) {
      throw new Error(`${d.name} name is held by bot ${taken.bot_id}`);
    }
  }
  const ins = await db.q(`insert into bot_profiles(name_lc,name,display_name,bio,location,interests,avatar,room,interactive,bot_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    on conflict(name_lc) do update set bot_id=coalesce(bot_profiles.bot_id, excluded.bot_id)
      where not exists (select 1 from bot_profiles x where x.bot_id=excluded.bot_id and x.name_lc<>excluded.name_lc)
    returning (xmax = 0) as inserted`, [lc, d.name, d.display_name || '', d.bio || '', d.location || '', d.interests || '', d.avatar_key || '', d.room || '', !!d.interactive, d.id]);
  if (ins[0] && ins[0].inserted) stats.inserted++;
}

async function seedBotProfiles(db, BOTMOD, { audit = async () => {}, log = console } = {}) {
  const stats = { seeds: 0, inserted: 0, renamed: 0, failed: [] };
  const seeds = dedupeSeeds(BOTMOD.PROFILE_SEEDS);
  stats.seeds = seeds.length;
  for (const d of seeds) {
    try { await seedOne(db, d, BOTMOD, audit, stats); }
    catch (e) { stats.failed.push(d.id); log.error('[bot-profiles]', d.id + ':', String(e.message || e).slice(0, 160)); }
  }
  if (stats.inserted || stats.renamed || stats.failed.length) log.log('[bot-profiles] seeded', stats.seeds, 'bots: added', stats.inserted, 'renamed', stats.renamed, 'failed', stats.failed.length);
  return stats;
}

module.exports = { dedupeSeeds, seedBotProfiles };
