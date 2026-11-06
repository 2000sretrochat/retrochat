// HTTP friend-request API for Social / Pages → Messenger (uses durable `requests` table).
// Mount once from server.js; do not put bot logic here.
const db = require('./db');

module.exports = function friendSite(app, express, acc) {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NAME_RE = /^[A-Za-z][A-Za-z0-9_.]{2,19}$/;

  async function idOf(name) {
    if (!db.status().ready) return null;
    const n = String(name || '').trim();
    if (!NAME_RE.test(n)) return null;
    const [row] = await db.q('select id, name from users where name_lc=$1 and not banned', [n.toLowerCase()]);
    return row || null;
  }

  app.get('/api/friends/requests', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const u = await acc.userFromCookie(req.headers.cookie);
    if (!u) return res.status(401).json({ error: 'Sign in to Razzle Messenger first to send or manage contact requests.', login: true });
    if (!db.status().ready) return res.status(503).json({ error: 'Accounts temporarily unavailable.' });
    try {
      const incoming = await db.q(
        'select u.name, r.msg, r.created from requests r join users u on u.id=r.from_id where r.to_id=$1 order by r.created desc',
        [u.id]
      );
      const outgoing = await db.q(
        'select u.name, r.msg, r.created from requests r join users u on u.id=r.to_id where r.from_id=$1 order by r.created desc',
        [u.id]
      );
      res.json({
        me: u.name,
        incoming: incoming.map(r => ({ name: r.name, msg: esc(r.msg || ''), created: r.created })),
        outgoing: outgoing.map(r => ({ name: r.name, msg: esc(r.msg || ''), created: r.created })),
      });
    } catch (e) {
      console.error('[friends/requests]', e.message);
      res.status(500).json({ error: 'Could not load requests.' });
    }
  });

  app.post('/api/friends/add', async (req, res) => {
    const u = await acc.userFromCookie(req.headers.cookie);
    if (!u) return res.status(401).json({ error: 'Sign in to Razzle Messenger first to send or manage contact requests.', login: true });
    if (!db.status().ready) return res.status(503).json({ error: 'Accounts temporarily unavailable.' });
    const name = String(req.body?.name || '').trim();
    const msg = String(req.body?.msg || '').slice(0, 120);
    // Privacy-preserving generic reply (same shape as messenger m:add)
    const generic = { ok: true, text: 'If ' + esc(name.slice(0, 20)) + ' is a Razzle user, they have been sent your request.' };
    try {
      const t = await idOf(name);
      if (!t) return res.status(404).json({ error: 'No Razzle account found with that screen name. Check the spelling, or ask them to create one and sign in.', notFound: true });
      if (t.id === u.id) return res.status(400).json({ error: 'You cannot add yourself.' });
      const mutual = await db.q('select 1 from contacts where owner=$1 and contact=$2', [u.id, t.id]);
      if (mutual.length) return res.status(409).json({ error: esc(t.name) + ' is already in your contacts.' });
      if ((await db.q('select 1 from blocks where owner=$1 and blocked=$2', [t.id, u.id])).length) return res.json(generic);
      // Lift own block if re-adding
      await db.q('delete from blocks where owner=$1 and blocked=$2', [u.id, t.id]);
      // Reciprocal pending → accept
      if ((await db.q('select 1 from requests where from_id=$1 and to_id=$2', [t.id, u.id])).length) {
        await db.q('delete from requests where (from_id=$1 and to_id=$2) or (from_id=$2 and to_id=$1)', [u.id, t.id]);
        await db.q('insert into contacts(owner,contact) values($1,$2),($2,$1) on conflict do nothing', [u.id, t.id]);
        try {
          acc.toUser(u.id, 'm:contact', { name: t.name, group: 'Friends', online: false, status: 'offline' });
          acc.toUser(t.id, 'm:contact', { name: u.name, group: 'Friends', online: false, status: 'offline' });
          acc.toUser(t.id, 'm:toast', { text: esc(u.name) + ' accepted your contact request.' });
        } catch {}
        return res.json({ ok: true, accepted: true, text: esc(t.name) + ' was added to your contacts.' });
      }
      await db.q(
        'insert into requests(from_id,to_id,msg) values($1,$2,$3) on conflict (from_id,to_id) do update set msg=excluded.msg, created=now()',
        [u.id, t.id, msg]
      );
      try { acc.toUser(t.id, 'm:request', { name: u.name, msg: esc(msg) }); } catch {}
      return res.json(generic);
    } catch (e) {
      console.error('[friends/add]', e.message);
      res.status(500).json({ error: 'Could not send request.' });
    }
  });

  app.post('/api/friends/respond', async (req, res) => {
    const u = await acc.userFromCookie(req.headers.cookie);
    if (!u) return res.status(401).json({ error: 'Sign in to Razzle Messenger first to send or manage contact requests.', login: true });
    if (!db.status().ready) return res.status(503).json({ error: 'Accounts temporarily unavailable.' });
    const name = String(req.body?.name || '').trim();
    const yes = req.body?.accept === true || req.body?.accept === '1' || req.body?.accept === 1;
    try {
      const t = await idOf(name);
      if (!t) return res.status(404).json({ error: 'Request not found.' });
      const r = await db.q('select 1 from requests where from_id=$1 and to_id=$2', [t.id, u.id]);
      if (!r.length) return res.status(404).json({ error: 'Request not found.' });
      if (!yes) {
        await db.q('delete from requests where from_id=$1 and to_id=$2', [t.id, u.id]);
        return res.json({ ok: true, declined: true });
      }
      await db.q('delete from requests where (from_id=$1 and to_id=$2) or (from_id=$2 and to_id=$1)', [u.id, t.id]);
      await db.q('insert into contacts(owner,contact) values($1,$2),($2,$1) on conflict do nothing', [u.id, t.id]);
      await db.q('delete from blocks where owner=$1 and blocked=$2', [u.id, t.id]);
      try {
        const [ug] = await db.q('select grp from contacts where owner=$1 and contact=$2', [u.id, t.id]);
        const [tg] = await db.q('select grp from contacts where owner=$2 and contact=$1', [u.id, t.id]);
        acc.toUser(u.id, 'm:contact', { name: t.name, group: ug?.grp || 'Friends', online: false, status: 'offline' });
        acc.toUser(t.id, 'm:contact', { name: u.name, group: tg?.grp || 'Friends', online: false, status: 'offline' });
        acc.toUser(t.id, 'm:toast', { text: esc(u.name) + ' accepted your contact request.' });
      } catch {}
      return res.json({ ok: true, accepted: true, text: esc(t.name) + ' was added to your contacts.' });
    } catch (e) {
      console.error('[friends/respond]', e.message);
      res.status(500).json({ error: 'Could not update request.' });
    }
  });
};
