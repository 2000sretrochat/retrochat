// Hidden master (site-wide) administration. Never reveal master status to non-masters.
const path = require('path');
module.exports = function (C) {
  const { app, express, io, db, acc, geo, users, ROOMS, UROOMS, RATE, TOPICS, OFFICIAL, MOD, mod, socks, upd, history, closeRoom, setRating, setTopic, modAct, esc, MICS, setMics, micsOf } = C;
  // Default master screen name is razzle. Env MASTER_NAMES may list legacy names (e.g. yappchat) but those are NOT auto-promoted; is_master in DB is authoritative.
  const DEFAULT_MASTER = 'razzle';
  const DEFAULT_RESERVED = 'zainy,tony,razzle,zainyochka,yappchat';
  const splitNames = s => String(s || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const RESV = [...new Set(splitNames(process.env.MASTER_RESERVED || DEFAULT_RESERVED).concat([DEFAULT_MASTER, 'yappchat']))];
  // Seedable names: only the default master. Env MASTER_NAMES=yappchat alone is NOT seedable (collision guard); DB is_master remains authoritative.
  const NAMES = [DEFAULT_MASTER]; // env MASTER_NAMES legacy values are ignored for seeding
  // Exact authorized masters (t228u/t229u). DB is_master only for these; no broad env auto-promote.
  const AUTHORIZED_MASTERS = ['zainy', 'tony', 'bigtony', 'razzle', 'zainyochka'];
  // Demo/example names used in marketing screenshots — blocked for signup and guest, never seeded as masters.
  const EXAMPLE_BLOCKED = ['lumakite', 'pixelorchard', 'mosscomet'];
  const reserved = n => { const lc = String(n || '').trim().toLowerCase(); return RESV.includes(lc) || EXAMPLE_BLOCKED.includes(lc) || lc === 'razzle' || lc === 'yappchat'; };
  const IPBAN = new Set();
  const ready = () => db.status().ready;
  const q = (...a) => ready() ? db.q(...a) : Promise.resolve([]);
  const nf = res => res.status(404).type('text/plain').send('Cannot GET');
  const mailer = require('./mail');
  const EM = require('./emails');
  const RESET = require('./reset');
  async function audit(by, action, target, detail) {
    console.log('[master]', by, action, target || '', detail || '');
    try { await q('insert into master_audit(by_name,action,target,detail) values($1,$2,$3,$4)', [String(by || '').slice(0, 40), String(action || '').slice(0, 40), target != null ? String(target).slice(0, 80) : null, String(detail || '').slice(0, 500)]); } catch (e) { console.error('[audit]', e.message); }
  }
  const PCLEAN = (t, n) => String(t ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

  async function seedMaster(id, name) { // first time a seeded name is seen, grant; later revokes stick
    const lc = String(name || '').toLowerCase();
    // Collision guard: never newly promote a legacy env-configured name that is not the default master identity.
    if (!ready() || lc !== DEFAULT_MASTER || !NAMES.includes(lc)) return;
    const r = await db.q("insert into kv(k,v) values($1,'1') on conflict do nothing returning k", ['seed:' + lc]);
    if (r.length) await db.q('update users set is_master=true where id=$1', [id]);
  }
  /** Grant is_master to exactly AUTHORIZED_MASTERS (name_lc). Skips missing/banned/deactivated. Does not create accounts (except razzle via create-reserved elsewhere). Does not change passwords/sessions. */
  async function ensureAuthorizedMasters() {
    const out = { targets: AUTHORIZED_MASTERS.slice(), accounts: {}, granted: [], skipped: [], missing: [] };
    if (!ready()) { out.error = 'db_not_ready'; return out; }
    for (const n of AUTHORIZED_MASTERS) {
      const u = (await db.q('select id,name,name_lc,is_master,banned,coalesce(deactivated,false) as deactivated from users where name_lc=$1', [n]))[0];
      if (!u) { out.missing.push(n); out.accounts[n] = { exists: false, is_master: false }; out.skipped.push({ n, reason: 'not_found' }); continue; }
      if (u.banned) { out.accounts[n] = { exists: true, name: u.name, is_master: !!u.is_master, banned: true, deactivated: !!u.deactivated }; out.skipped.push({ n, reason: 'banned' }); continue; }
      if (u.deactivated) { out.accounts[n] = { exists: true, name: u.name, is_master: !!u.is_master, banned: false, deactivated: true }; out.skipped.push({ n, reason: 'deactivated' }); continue; }
      if (!u.is_master) {
        await db.q('update users set is_master=true where id=$1 and name_lc=$2 and not banned and not coalesce(deactivated,false)', [u.id, n]);
        await audit('system', 'grant', n, 't228u/t229u authorized exact four-account master grant');
        out.granted.push(n);
      }
      const after = (await db.q('select name,is_master,banned,coalesce(deactivated,false) as deactivated from users where name_lc=$1', [n]))[0];
      out.accounts[n] = { exists: true, name: after.name, is_master: !!after.is_master, banned: !!after.banned, deactivated: !!after.deactivated };
    }
    console.log('[master] ensureAuthorizedMasters', JSON.stringify({ granted: out.granted, missing: out.missing, skipped: out.skipped, masters: Object.fromEntries(Object.entries(out.accounts).map(([k,v]) => [k, !!v.is_master])) }));
    return out;
  }
  async function load() {
    if (!ready()) return;
    for (const n of NAMES) { const u = (await db.q('select id,name from users where name_lc=$1', [n]))[0]; if (u) await seedMaster(u.id, u.name); }
    try { await ensureAuthorizedMasters(); } catch (e) { console.error('[master] ensureAuthorizedMasters', e.message); }
    (await db.q('select ip from ip_bans')).forEach(r => IPBAN.add(r.ip));
    for (const r of await db.q('select room,rating,mics,hq,mtimer,mann from room_meta')) { if (!ROOMS[r.room]) continue; if (r.rating) RATE[r.room] = r.rating; if (r.mics) MICS[r.room] = r.mics; if (r.hq) C.HQ[r.room] = true; if (r.mtimer) C.MTIMER[r.room] = r.mtimer; if (r.mann && C.MANN) C.MANN[r.room] = r.mann; }
    for (const r of await db.q('select room,name_lc,kind,until from room_mod')) { if (!ROOMS[r.room]) continue; const m = mod(r.room);
      if (r.kind === 'admin') m.admins.add(r.name_lc); else if (r.kind === 'mt') m.mt.add(r.name_lc); else if (r.kind === 'mm') m.mm.add(r.name_lc);
      else if (r.kind === 'kick' && +r.until > Date.now()) m.kicked.set(r.name_lc, +r.until); else if (r.kind === 'dot' && +r.until > Date.now()) m.dot.set(r.name_lc, +r.until); }
    // Controlled shared-email attachment for owned accounts (no new accounts created).
    try {
      const sharedEmail = 'zainyochka@gmail.com', en = EM.norm(sharedEmail);
      for (const nm of ['zainy', 'zainyochka']) {
        const u = (await db.q('select id,email_norm from users where name_lc=$1', [nm]))[0];
        if (u && u.email_norm !== en) await db.q('update users set email=$2,email_norm=$3 where id=$1', [u.id, sharedEmail, en]);
      }
    } catch (e) { console.error('[shared-email]', e.message); }
    try { await seedBotProfiles(); } catch (e) { console.error('[bot-profiles]', e.message); }
    try { await require('./social-next/bots').seedSocialBots(db); console.log('[social-bots] synchronized'); } catch(e) { console.error('[social-bots]',e.message); }
  }
  // Seeds a profile for EVERY bot. Never overwrites master edits: inserts use ON CONFLICT and only fill a missing bot_id.
  // Legacy "[bot]" rows (TriviaTime/GameNight/...) are renamed in place so their edits/avatars survive; only untouched legacy defaults are refreshed.
  async function seedBotProfiles() {
    if (!ready()) return;
    const BOTMOD = C.BOTMOD || require('./bots');
    for (const d of BOTMOD.PROFILE_SEEDS) {
      const lc = d.name.toLowerCase();
      for (const old of d.legacy || []) {
        const olc = old.toLowerCase(); if (olc === lc) continue;
        const has = (await db.q('select 1 from bot_profiles where name_lc=$1', [lc])).length;
        if (has) { await db.q('update bot_profiles set bot_id=null where name_lc=$1 and bot_id=$2', [olc, d.id]); continue; }
        const r = await db.q('update bot_profiles set name_lc=$2, name=$3, bot_id=$4 where name_lc=$1 returning display_name,bio,room', [olc, lc, d.name, d.id]);
        if (r.length) {
          if (r[0].display_name === BOTMOD.LEGACY_DEFAULT_DISPLAY[d.id] || r[0].display_name === '') await db.q('update bot_profiles set display_name=$2 where name_lc=$1', [lc, d.display_name]);
          if (r[0].bio === BOTMOD.LEGACY_DEFAULT_BIO[d.id] || r[0].bio === '') await db.q('update bot_profiles set bio=$2, interests=$3, location=$4 where name_lc=$1', [lc, d.bio, d.interests, d.location]);
          if (BOTMOD.LEGACY_DEFAULT_ROOM[d.id] && r[0].room === BOTMOD.LEGACY_DEFAULT_ROOM[d.id]) await db.q('update bot_profiles set room=$2 where name_lc=$1', [lc, d.room]);
          // old default "BOT"-badged SVG -> initials placeholder (a master-chosen different key or upload is kept)
          await db.q("update bot_profiles set avatar='' where name_lc=$1 and avatar=$2", [lc, d.id]);
          await audit('system', 'bot-rename', old, d.name);
        }
      }
      await db.q(`insert into bot_profiles(name_lc,name,display_name,bio,location,interests,avatar,room,interactive,bot_id)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict(name_lc) do update set bot_id=coalesce(bot_profiles.bot_id, excluded.bot_id)`, [lc, d.name, d.display_name, d.bio, d.location, d.interests, d.avatar_key || '', d.room || '', d.interactive, d.id]);
    }
    if (typeof C.applyBotProfiles === 'function') await C.applyBotProfiles();
  }
  const saveRating = (room, rating) => { q(rating ? 'insert into room_meta(room,rating) values($1,$2) on conflict(room) do update set rating=$2' : 'delete from room_meta where room=$1', rating ? [room, rating] : [room]).catch(() => {}); };
  const saveMeta = (room, o) => { q('insert into room_meta(room,hq,mtimer,mann) values($1,$2,$3,$4) on conflict(room) do update set hq=$2,mtimer=$3,mann=$4', [room, !!o.hq, o.mtimer | 0, o.mann | 0]).catch(() => {}); };
  const saveMics = (room, n) => { if (n) q('insert into room_meta(room,mics) values($1,$2) on conflict(room) do update set mics=$2', [room, n]).catch(() => {}); };
  async function saveMod(room) { if (!ready()) return; try {
    await db.q('delete from room_mod where room=$1', [room]); const m = MOD[room]; if (!m) return; const rows = [];
    m.admins.forEach(n => rows.push([n, 'admin', null])); m.mt.forEach(n => rows.push([n, 'mt', null])); m.mm.forEach(n => rows.push([n, 'mm', null])); (m.dot || new Map()).forEach((u, n) => rows.push([n, 'dot', u])); m.kicked.forEach((u, n) => rows.push([n, 'kick', u]));
    for (const [n, k, u] of rows) await db.q('insert into room_mod(room,name_lc,kind,until) values($1,$2,$3,$4) on conflict do nothing', [room, n, k, u]);
  } catch (e) { console.error('[saveMod]', e.message); } }
  const report = (by, room, who, why) => { console.log('[REPORT ABUSE]', by, room, who, why); q('insert into reports(by_name,room,who,why) values($1,$2,$3,$4)', [by, room || null, who, why]).catch(() => {}); };

  // auth: master check against DB on every request; non-masters get a plain 404
  async function who(req) { const u = await acc.userFromCookie(req.headers.cookie); if (!u) return null;
    const r = await q('select is_master from users where id=$1', [u.id]); return r[0]?.is_master ? u : null; }
  const guard = h => async (req, res) => { try { const u = await who(req); if (!u) return nf(res); await h(req, res, u); } catch (e) { console.error('[master]', e.message); res.status(500).json({ error: 'Server error' }); } };
  const actor = { data: { name: 'a moderator', master: true, site: true } };
  const sockOf = n => { const id = users.get(String(n).toLowerCase()); return id && io.sockets.sockets.get(id); };
  function kickOut(name) { // disconnect all sockets (rooms + messenger) for an account name
    const lc = String(name).toLowerCase(); for (const s of io.sockets.sockets.values()) if ((s.data.acct && s.data.acct.name.toLowerCase() === lc) || (s.data.name && s.data.name.toLowerCase() === lc && !s.data.guest)) { s.emit('m:signedout'); s.disconnect(true); } }

  app.get('/api/master/ui.js', guard((req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(__dirname, 'master-win.js')); }));
  app.get('/api/master/recorder.js', guard((req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(__dirname, 'master-recorder.js')); }));
  app.get('/master', guard((req, res) => res.sendFile(path.join(__dirname, 'master.html'))));
  app.get('/api/master/data', guard(async (req, res) => {
    const d = await geo.adminData(acc.isConnected); const ms = new Set((await q('select name from users where is_master')).map(r => r.name));
    d.accounts.forEach(a => { a.master = ms.has(a.name); a.room = sockOf(a.name)?.data.room || null; }); d.guests.forEach(g => g.room = sockOf(g.name)?.data.room || null);
    d.banned = (await q('select name from users where banned')).map(r => r.name); d.deactivated = (await q('select name from users where deactivated')).map(r => r.name); d.ipbans = await q('select ip,reason,at from ip_bans order by at desc'); res.json(d); }));
  app.get('/api/master/rooms', guard((req, res) => res.json(Object.keys(ROOMS).map(r => ({ name: r, cat: ROOMS[r], topic: TOPICS[r], rating: RATE[r] || 'PG-13', mics: micsOf(r), hq: !!C.HQ[r], timer: C.MTIMER[r] || 0, official: OFFICIAL.has(r), owner: UROOMS.get(r)?.owner || null,
    people: socks(r).map(x => x.data.name), mod: MOD[r] ? { admins: [...MOD[r].admins], mt: [...MOD[r].mt], mm: [...MOD[r].mm], kicked: [...MOD[r].kicked.keys()], dot: [...MOD[r].dot.keys()] } : null })))));
  app.post('/api/master/room', express.json(), guard((req, res) => { const { room, rating, topic, close, mics } = req.body || {};
    const { hq, timer } = req.body || {}; const e = close ? closeRoom(room) : rating ? setRating(room, rating) : mics ? setMics(room, mics) : (hq !== undefined || timer !== undefined) ? C.setMicOpts(room, { hq, timer }) : topic != null ? setTopic(room, topic) : 'Nothing to do.'; if (e) return res.status(400).json({ error: e }); res.json({ ok: true }); }));
  app.post('/api/master/roommod', express.json(), guard((req, res) => { const { room, action, who, mins } = req.body || {}; if (!ROOMS[room]) return res.status(404).json({ error: 'No such room.' });
    modAct(actor, room, { action, who, mins }, r => res.status(r && r.error ? 400 : 200).json(r)); }));
  app.post('/api/master/account', express.json(), guard(async (req, res, me) => {
    const { name, action, email, newName } = req.body || {}; const u = (await q('select id,name,is_master,email from users where name_lc=$1', [String(name || '').toLowerCase()]))[0];
    if (!u) return res.status(404).json({ error: 'No such account.' });
    const masters = async () => +(await q('select count(*)::int n from users where is_master and not banned and not coalesce(deactivated,false)'))[0].n;
    if (['delete', 'ban', 'revoke', 'deactivate'].includes(action) && u.is_master && await masters() <= 1) return res.status(400).json({ error: 'Cannot remove the last master.' });
    if (action === 'grant') await q('update users set is_master=true where id=$1', [u.id]);
    else if (action === 'revoke') await q('update users set is_master=false where id=$1', [u.id]);
    else if (action === 'ban') { await q('update users set banned=true where id=$1', [u.id]); await q('delete from sessions where user_id=$1', [u.id]); kickOut(u.name); }
    else if (action === 'unban') await q('update users set banned=false where id=$1', [u.id]);
    else if (action === 'deactivate') { await q('update users set deactivated=true where id=$1', [u.id]); await q('delete from sessions where user_id=$1', [u.id]); kickOut(u.name); }
    else if (action === 'reactivate') await q('update users set deactivated=false where id=$1', [u.id]);
    else if (action === 'signout') { await q('delete from sessions where user_id=$1', [u.id]); kickOut(u.name); }
    else if (action === 'delete') { await q('delete from sessions where user_id=$1', [u.id]); kickOut(u.name); await q('delete from users where id=$1', [u.id]); }
    else if (action === 'clear-avatar') { await q('delete from avatars where user_id=$1', [u.id]); await q("update users set avatar='a1' where id=$1", [u.id]); }
    else if (action === 'clear-profile') { await q("update users set display_name='', bio='', location='', interests='', age=null, status_msg='' where id=$1", [u.id]); }
    else if (action === 'edit') {
      if (email != null) {
        const em = String(email).trim().slice(0, 120);
        if (em && await EM.taken(em, u.name)) return res.status(409).json({ error: 'That email already has a screen name.' });
        await q('update users set email=$2,email_norm=$3 where id=$1', [u.id, em || null, em ? EM.norm(em) : null]);
      }
      if (newName) { const n = String(newName).trim(); if (!/^[A-Za-z][A-Za-z0-9_.]{2,19}$/.test(n)) return res.status(400).json({ error: 'Invalid screen name.' });
        if (reserved(n) && !RESV.includes(n.toLowerCase())) return res.status(400).json({ error: 'That screen name is reserved.' });
        try { await q('update users set name=$2,name_lc=$3 where id=$1', [u.id, n, n.toLowerCase()]); } catch { return res.status(400).json({ error: 'That name is taken.' }); } kickOut(u.name); } }
    else return res.status(400).json({ error: 'Unknown action.' });
    await audit(me.name, action, u.name, email || newName || ''); res.json({ ok: true }); }));
  app.post('/api/master/ipban', express.json(), guard(async (req, res, me) => { const { ip, reason, unban } = req.body || {}; const i = String(ip || '').trim().slice(0, 64); if (!i) return res.status(400).json({ error: 'IP required.' });
    if (unban) { IPBAN.delete(i); await q('delete from ip_bans where ip=$1', [i]); await audit(me.name, 'ipunban', i, ''); return res.json({ ok: true }); }
    IPBAN.add(i); await q('insert into ip_bans(ip,reason) values($1,$2) on conflict(ip) do update set reason=$2', [i, String(reason || '').slice(0, 200)]);
    for (const s of io.sockets.sockets.values()) if (geo.clientIp(s.handshake.headers, s.handshake.address) === i) s.disconnect(true); await audit(me.name, 'ipban', i, reason || ''); res.json({ ok: true }); }));
  app.get('/api/master/reports', guard(async (req, res) => res.json(await q('select * from reports order by resolved, id desc limit 500'))));
  app.post('/api/master/report', express.json(), guard(async (req, res, me) => { await q('update reports set resolved=$2, resolved_by=$3 where id=$1', [+req.body?.id, req.body?.resolved !== false, me.name]); res.json({ ok: true }); }));
  app.post('/api/master/broadcast', express.json(), guard(async (req, res, me) => { const t = String(req.body?.text || '').trim().slice(0, 300); if (!t) return res.status(400).json({ error: 'Message required.' });
    for (const r of Object.keys(ROOMS)) C.push(r, { sys: true, text: '[System] ' + esc(t) }); io.emit('m:broadcast', { text: t }); await audit(me.name, 'broadcast', null, t); res.json({ ok: true }); }));
  require('./backup').routes(app, guard); require('./backup').schedule();
  // pre-create a reserved owner account (only names on the master seed list); it becomes a hidden master on creation
  app.post('/api/master/create-reserved', express.json(), guard(async (req, res) => { const n = String(req.body?.name || '').trim(), pw = req.body?.password;
    if (!RESV.includes(n.toLowerCase())) return res.status(400).json({ error: 'Only names on the master seed list can be created here.' }); if (typeof pw !== 'string' || pw.length < 8 || pw.length > 100) return res.status(400).json({ error: 'Passwords must be 8-100 characters.' });
    if ((await q('select 1 from users where name_lc=$1', [n.toLowerCase()])).length) return res.status(409).json({ error: 'That account already exists.' });
    const r = await q('insert into users(name,name_lc,pw,is_master) values($1,$2,$3,true) returning id', [n, n.toLowerCase(), await require('bcryptjs').hash(pw, 12)]);
    await q("insert into kv(k,v) values($1,'1') on conflict do nothing", ['seed:' + n.toLowerCase()]);
    res.json({ ok: true, name: n }); }));
  app.post('/api/master/reset-link', express.json(), guard(async (req, res, me) => {
    const u = (await q('select id,name,email from users where name_lc=$1', [String(req.body?.name || '').trim().toLowerCase()]))[0]; if (!u) return res.status(404).json({ error: 'No such user.' });
    const link = await C.resetLink(req, u.id); let sent = false;
    if (req.body?.email) {
      if (!mailer.enabled()) return res.status(400).json({ error: 'Email reset is not configured. Use the link instead.', name: u.name, link, expires: '1 hour' });
      if (!u.email) return res.status(400).json({ error: 'No email on file for this account.', name: u.name, link, expires: '1 hour' });
      await RESET.send(u.email, u.name, link); sent = true;
    }
    await audit(me.name, sent ? 'reset-email' : 'reset-link', u.name, sent ? u.email : 'link-only');
    res.json({ name: u.name, link, expires: '1 hour', sent, emailConfigured: mailer.enabled() }); }));
  app.get('/api/master/stats', guard(async (req, res) => { const st = C.stats(); let su = { d: 0, w: 0 }, pk = 0; try { su = (await q("select count(*) filter (where created >= date_trunc('day', now())) as d, count(*) filter (where created >= now() - interval '7 days') as w from users"))[0]; pk = (await q('select peak from stats_day where d=current_date'))[0]?.peak || 0; } catch { }
    res.json({ ...st, peak: Math.max(st.peak, pk), signupsToday: +su.d, signupsWeek: +su.w }); }));
  app.get('/api/master/bots', guard(async (req, res) => res.json(C.getBots())));
  app.post('/api/master/bots', express.json(), guard(async (req, res) => res.json({ ok: true, on: C.setBots(!!req.body?.on, typeof req.body?.room === 'string' ? req.body.room : undefined), ...C.getBots() })));
  app.get('/api/master/unlimited', guard(async (req, res) => res.json({ emails: await require('./emails').list() })));
  app.post('/api/master/unlimited', express.json(), guard(async (req, res) => res.json({ ok: true, emails: await require('./emails').setList(req.body?.emails) })));
  // incognito + announce prefs (per master, persisted); applied live to the master's room sockets
  app.get('/api/master/prefs', guard(async (req, res, me) => { const r = (await q('select m_incog,m_announce from users where id=$1', [me.id]))[0] || {}; res.set('Cache-Control', 'no-store'); res.json({ incognito: !!r.m_incog, announce: !!r.m_announce }); }));
  app.post('/api/master/prefs', express.json(), guard(async (req, res, me) => { const b = req.body || {}, sets = [], vals = [me.id];
    if (typeof b.incognito === 'boolean') { vals.push(b.incognito); sets.push('m_incog=$' + vals.length); } if (typeof b.announce === 'boolean') { vals.push(b.announce); sets.push('m_announce=$' + vals.length); }
    if (sets.length) await q('update users set ' + sets.join(',') + ' where id=$1', vals);
    const rooms = new Set(); for (const s of io.sockets.sockets.values()) if (s.data.acct?.id === me.id && s.data.master) {
      if (typeof b.incognito === 'boolean') { s.data.incPref = b.incognito; if (s.data.room) { s.data.inc = b.incognito; if (b.incognito) { s.data.cam = false; s.data.talk = false; } rooms.add(s.data.room); } }
      if (typeof b.announce === 'boolean') s.data.announce = b.announce; if (s.data.room) s.emit('inc', { on: !!s.data.inc, announce: !!s.data.announce }); }
    rooms.forEach(r => C.upd(r)); const r = (await q('select m_incog,m_announce from users where id=$1', [me.id]))[0] || {}; res.json({ ok: true, incognito: !!r.m_incog, announce: !!r.m_announce }); }));
  // silent watch list: nothing is ever sent to the watched user
  app.get('/api/master/watch', guard(async (req, res, me) => {
    const rows = await q('select u.id,u.name,u.status_msg,u.last_ip,u.last_loc from watch w join users u on u.id=w.target where w.owner=$1 order by u.name_lc', [me.id]);
    res.json(rows.map(r => { const p = acc.presenceRaw ? acc.presenceRaw(r.id) : { online: acc.isConnected(r.name) }; const s = sockOf(r.name);
      return { name: r.name, online: p.online || !!s, status: p.status, msg: p.msg || r.status_msg || '', room: s && !s.data.guest ? s.data.room : null, ip: (s && geo.clientIp(s.handshake.headers, s.handshake.address)) || r.last_ip || '', loc: r.last_loc || '' }; })); }));
  app.post('/api/master/watch', express.json(), guard(async (req, res, me) => { const { name, remove } = req.body || {};
    const u = (await q('select id from users where name_lc=$1', [String(name || '').toLowerCase()]))[0]; if (!u) return res.status(404).json({ error: 'No such screen name.' });
    if (remove) await q('delete from watch where owner=$1 and target=$2', [me.id, u.id]); else await q('insert into watch(owner,target) values($1,$2) on conflict do nothing', [me.id, u.id]); res.json({ ok: true }); }));

  app.get('/api/master/audit', guard(async (req, res) => res.json(await q('select id,by_name,action,target,detail,at from master_audit order by id desc limit 200'))));
  const botAssets = () => { try { return require('fs').readdirSync(path.join(__dirname, 'public', 'bot-avatars')).filter(f => /^[a-z0-9_-]+\.svg$/.test(f)).map(f => f.slice(0, -4)).sort(); } catch { return []; } };
  const BOTSRC = () => C.BOTMOD || require('./bots');
  const findBotRow = async b => { const id = String(b.id || '').toLowerCase(), lc = String(b.name || '').trim().toLowerCase();
    return (await q('select name_lc,bot_id,name from bot_profiles where ' + (id ? 'bot_id=$1' : 'name_lc=$1'), [id || lc]))[0]; };
  app.get('/api/master/bot-profiles', guard(async (req, res) => {
    const rows = await q('select p.bot_id as id,p.name,p.display_name,p.bio,p.location,p.interests,p.avatar,p.room,p.interactive,p.updated,p.updated_by,(a.bot_id is not null) as uploaded from bot_profiles p left join bot_avatars a on a.bot_id=p.bot_id order by p.interactive desc, p.room, p.name_lc');
    const live = new Set(BOTSRC().BOTS.map(b => b.id));
    res.json({ bots: rows.map(r => ({ ...r, live: live.has(r.id) })), assets: botAssets(), note: 'Bots have no login passwords. Edit profiles here only. Upload a PNG/JPG/WebP (max 600 KB) to replace an avatar.' });
  }));
  app.post('/api/master/bot-profiles', express.json(), guard(async (req, res, me) => {
    const b = req.body || {}; if (!b.id && !String(b.name || '').trim()) return res.status(400).json({ error: 'Bot id or name required.' });
    const existing = await findBotRow(b);
    if (!existing) return res.status(404).json({ error: 'Unknown bot profile.' });
    const cur = (await q('select display_name,bio,location,interests,avatar from bot_profiles where name_lc=$1', [existing.name_lc]))[0];
    const pick = (v, alt, n) => v === undefined ? alt : PCLEAN(v, n);
    const display_name = pick(b.displayName !== undefined ? b.displayName : b.display_name, cur.display_name, 40);
    const bio = pick(b.bio, cur.bio, 300), location = pick(b.location, cur.location, 50), interests = pick(b.interests, cur.interests, 150);
    const avatar = b.avatar === undefined ? cur.avatar : String(b.avatar || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    const room = PCLEAN(b.room, 60);
    await q(`update bot_profiles set display_name=$2, bio=$3, location=$4, interests=$5, avatar=$6, room=coalesce(nullif($7,''),room), updated=now(), updated_by=$8 where name_lc=$1`,
      [existing.name_lc, display_name, bio, location, interests, avatar, room, me.name]);
    if (typeof C.applyBotProfiles === 'function') await C.applyBotProfiles();
    await audit(me.name, 'bot-profile', existing.name, avatar || display_name);
    const row = (await q('select bot_id as id,name,display_name,bio,location,interests,avatar,room,interactive,updated,updated_by from bot_profiles where name_lc=$1', [existing.name_lc]))[0];
    res.json({ ok: true, bot: row });
  }));
  // Avatar replacement (e.g. images made in ChatGPT): data URL upload stored in DB, served at /bot-av/<id>.
  app.post('/api/master/bot-avatar', express.json({ limit: '1mb' }), guard(async (req, res, me) => {
    const b = req.body || {}; const row = await findBotRow(b); if (!row || !row.bot_id) return res.status(404).json({ error: 'Unknown bot profile.' });
    if (b.remove) { await q('delete from bot_avatars where bot_id=$1', [row.bot_id]); await audit(me.name, 'bot-avatar-remove', row.name, ''); return res.json({ ok: true, removed: true }); }
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ''));
    if (!m) return res.status(400).json({ error: 'Upload a PNG, JPG, or WebP image.' });
    const buf = Buffer.from(m[2], 'base64'); if (!buf.length || buf.length > 600 * 1024) return res.status(400).json({ error: 'Image must be under 600 KB.' });
    await q('insert into bot_avatars(bot_id,mime,data,updated_by) values($1,$2,$3,$4) on conflict(bot_id) do update set mime=$2,data=$3,updated=now(),updated_by=$4', [row.bot_id, m[1], buf, me.name]);
    await audit(me.name, 'bot-avatar', row.name, m[1] + ' ' + buf.length + 'B'); res.json({ ok: true, bytes: buf.length });
  }));

  return { seedBotProfiles, reserved, ipBanned: ip => IPBAN.has(ip), seedMaster, ensureAuthorizedMasters, AUTHORIZED_MASTERS, load, saveRating, saveMics, saveMeta, saveMod, report, EXAMPLE_BLOCKED };
};
