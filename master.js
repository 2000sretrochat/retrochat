// Hidden master (site-wide) administration. Never reveal master status to non-masters.
const path = require('path');
module.exports = function (C) {
  const { app, express, io, db, acc, geo, users, ROOMS, UROOMS, RATE, TOPICS, OFFICIAL, MOD, mod, socks, upd, history, closeRoom, setRating, setTopic, modAct, esc, MICS, setMics, micsOf } = C;
  const NAMES = String(process.env.MASTER_NAMES || 'zainy').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const IPBAN = new Set();
  const ready = () => db.status().ready;
  const q = (...a) => ready() ? db.q(...a) : Promise.resolve([]);
  const nf = res => res.status(404).type('text/plain').send('Cannot GET');

  async function seedMaster(id, name) { // first time a seeded name is seen, grant; later revokes stick
    if (!ready() || !NAMES.includes(String(name).toLowerCase())) return;
    const r = await db.q("insert into kv(k,v) values($1,'1') on conflict do nothing returning k", ['seed:' + String(name).toLowerCase()]);
    if (r.length) await db.q('update users set is_master=true where id=$1', [id]);
  }
  async function load() {
    if (!ready()) return;
    for (const n of NAMES) { const u = (await db.q('select id,name from users where name_lc=$1', [n]))[0]; if (u) await seedMaster(u.id, u.name); }
    (await db.q('select ip from ip_bans')).forEach(r => IPBAN.add(r.ip));
    for (const r of await db.q('select room,rating,mics,hq,mtimer from room_meta')) { if (!ROOMS[r.room]) continue; if (r.rating) RATE[r.room] = r.rating; if (r.mics) MICS[r.room] = r.mics; if (r.hq) C.HQ[r.room] = true; if (r.mtimer) C.MTIMER[r.room] = r.mtimer; }
    for (const r of await db.q('select room,name_lc,kind,until from room_mod')) { if (!ROOMS[r.room]) continue; const m = mod(r.room);
      if (r.kind === 'admin') m.admins.add(r.name_lc); else if (r.kind === 'mt') m.mt.add(r.name_lc); else if (r.kind === 'mm') m.mm.add(r.name_lc);
      else if (r.kind === 'kick' && +r.until > Date.now()) m.kicked.set(r.name_lc, +r.until); }
  }
  const saveRating = (room, rating) => { q(rating ? 'insert into room_meta(room,rating) values($1,$2) on conflict(room) do update set rating=$2' : 'delete from room_meta where room=$1', rating ? [room, rating] : [room]).catch(() => {}); };
  const saveMeta = (room, o) => { q('insert into room_meta(room,hq,mtimer) values($1,$2,$3) on conflict(room) do update set hq=$2,mtimer=$3', [room, !!o.hq, o.mtimer | 0]).catch(() => {}); };
  const saveMics = (room, n) => { if (n) q('insert into room_meta(room,mics) values($1,$2) on conflict(room) do update set mics=$2', [room, n]).catch(() => {}); };
  async function saveMod(room) { if (!ready()) return; try {
    await db.q('delete from room_mod where room=$1', [room]); const m = MOD[room]; if (!m) return; const rows = [];
    m.admins.forEach(n => rows.push([n, 'admin', null])); m.mt.forEach(n => rows.push([n, 'mt', null])); m.mm.forEach(n => rows.push([n, 'mm', null])); m.kicked.forEach((u, n) => rows.push([n, 'kick', u]));
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

  app.get('/master', guard((req, res) => res.sendFile(path.join(__dirname, 'master.html'))));
  app.get('/api/master/data', guard(async (req, res) => {
    const d = await geo.adminData(acc.isOnline); const ms = new Set((await q('select name from users where is_master')).map(r => r.name));
    d.accounts.forEach(a => { a.master = ms.has(a.name); a.room = sockOf(a.name)?.data.room || null; }); d.guests.forEach(g => g.room = sockOf(g.name)?.data.room || null);
    d.banned = (await q('select name from users where banned')).map(r => r.name); d.ipbans = await q('select ip,reason,at from ip_bans order by at desc'); res.json(d); }));
  app.get('/api/master/rooms', guard((req, res) => res.json(Object.keys(ROOMS).map(r => ({ name: r, cat: ROOMS[r], topic: TOPICS[r], rating: RATE[r] || 'PG-13', mics: micsOf(r), hq: !!C.HQ[r], timer: C.MTIMER[r] || 0, official: OFFICIAL.has(r), owner: UROOMS.get(r)?.owner || null,
    people: socks(r).map(x => x.data.name), mod: MOD[r] ? { admins: [...MOD[r].admins], mt: [...MOD[r].mt], mm: [...MOD[r].mm], kicked: [...MOD[r].kicked.keys()] } : null })))));
  app.post('/api/master/room', express.json(), guard((req, res) => { const { room, rating, topic, close, mics } = req.body || {};
    const { hq, timer } = req.body || {}; const e = close ? closeRoom(room) : rating ? setRating(room, rating) : mics ? setMics(room, mics) : (hq !== undefined || timer !== undefined) ? C.setMicOpts(room, { hq, timer }) : topic != null ? setTopic(room, topic) : 'Nothing to do.'; if (e) return res.status(400).json({ error: e }); res.json({ ok: true }); }));
  app.post('/api/master/roommod', express.json(), guard((req, res) => { const { room, action, who } = req.body || {}; if (!ROOMS[room]) return res.status(404).json({ error: 'No such room.' });
    modAct(actor, room, { action, who }, r => res.status(r && r.error ? 400 : 200).json(r)); }));
  app.post('/api/master/account', express.json(), guard(async (req, res, me) => {
    const { name, action, email, newName } = req.body || {}; const u = (await q('select id,name,is_master from users where name_lc=$1', [String(name || '').toLowerCase()]))[0];
    if (!u) return res.status(404).json({ error: 'No such account.' });
    const masters = async () => +(await q('select count(*)::int n from users where is_master and not banned'))[0].n;
    if (['delete', 'ban', 'revoke'].includes(action) && u.is_master && await masters() <= 1) return res.status(400).json({ error: 'Cannot remove the last master.' });
    if (action === 'grant') await q('update users set is_master=true where id=$1', [u.id]);
    else if (action === 'revoke') await q('update users set is_master=false where id=$1', [u.id]);
    else if (action === 'ban') { await q('update users set banned=true where id=$1', [u.id]); await q('delete from sessions where user_id=$1', [u.id]); kickOut(u.name); }
    else if (action === 'unban') await q('update users set banned=false where id=$1', [u.id]);
    else if (action === 'signout') { await q('delete from sessions where user_id=$1', [u.id]); kickOut(u.name); }
    else if (action === 'delete') { await q('delete from sessions where user_id=$1', [u.id]); kickOut(u.name); await q('delete from users where id=$1', [u.id]); }
    else if (action === 'edit') { if (email != null) await q('update users set email=$2 where id=$1', [u.id, String(email).slice(0, 120) || null]);
      if (newName) { const n = String(newName).trim(); if (!/^[A-Za-z][A-Za-z0-9_.]{2,19}$/.test(n)) return res.status(400).json({ error: 'Invalid screen name.' });
        try { await q('update users set name=$2,name_lc=$3 where id=$1', [u.id, n, n.toLowerCase()]); } catch { return res.status(400).json({ error: 'That name is taken.' }); } kickOut(u.name); } }
    else return res.status(400).json({ error: 'Unknown action.' });
    console.log('[master]', me.name, action, u.name); res.json({ ok: true }); }));
  app.post('/api/master/ipban', express.json(), guard(async (req, res) => { const { ip, reason, unban } = req.body || {}; const i = String(ip || '').trim().slice(0, 64); if (!i) return res.status(400).json({ error: 'IP required.' });
    if (unban) { IPBAN.delete(i); await q('delete from ip_bans where ip=$1', [i]); return res.json({ ok: true }); }
    IPBAN.add(i); await q('insert into ip_bans(ip,reason) values($1,$2) on conflict(ip) do update set reason=$2', [i, String(reason || '').slice(0, 200)]);
    for (const s of io.sockets.sockets.values()) if (geo.clientIp(s.handshake.headers, s.handshake.address) === i) s.disconnect(true); res.json({ ok: true }); }));
  app.get('/api/master/reports', guard(async (req, res) => res.json(await q('select * from reports order by resolved, id desc limit 500'))));
  app.post('/api/master/report', express.json(), guard(async (req, res, me) => { await q('update reports set resolved=$2, resolved_by=$3 where id=$1', [+req.body?.id, req.body?.resolved !== false, me.name]); res.json({ ok: true }); }));
  app.post('/api/master/broadcast', express.json(), guard((req, res) => { const t = String(req.body?.text || '').trim().slice(0, 300); if (!t) return res.status(400).json({ error: 'Message required.' });
    for (const r of Object.keys(ROOMS)) C.push(r, { sys: true, text: '[System] ' + esc(t) }); io.emit('m:broadcast', { text: t }); res.json({ ok: true }); }));
  // silent watch list: nothing is ever sent to the watched user
  app.get('/api/master/watch', guard(async (req, res, me) => {
    const rows = await q('select u.id,u.name,u.status_msg,u.last_ip,u.last_loc from watch w join users u on u.id=w.target where w.owner=$1 order by u.name_lc', [me.id]);
    res.json(rows.map(r => { const p = acc.presence ? acc.presence(r.id) : { online: acc.isOnline(r.name) }; const s = sockOf(r.name);
      return { name: r.name, online: p.online || !!s, status: p.status, msg: p.msg || r.status_msg || '', room: s && !s.data.guest ? s.data.room : null, ip: (s && geo.clientIp(s.handshake.headers, s.handshake.address)) || r.last_ip || '', loc: r.last_loc || '' }; })); }));
  app.post('/api/master/watch', express.json(), guard(async (req, res, me) => { const { name, remove } = req.body || {};
    const u = (await q('select id from users where name_lc=$1', [String(name || '').toLowerCase()]))[0]; if (!u) return res.status(404).json({ error: 'No such screen name.' });
    if (remove) await q('delete from watch where owner=$1 and target=$2', [me.id, u.id]); else await q('insert into watch(owner,target) values($1,$2) on conflict do nothing', [me.id, u.id]); res.json({ ok: true }); }));

  return { ipBanned: ip => IPBAN.has(ip), seedMaster, load, saveRating, saveMics, saveMeta, saveMod, report };
};
