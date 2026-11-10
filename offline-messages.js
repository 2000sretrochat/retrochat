// Offline messages: a DM left for someone who is signed out of Messenger.
// Stored in the existing `offline` table and delivered the next time they sign in
// (Messenger m:init / m:offline-list, Social /api/offline-messages and /api/notifications).
// Privacy: the recipient's existing settings decide who may leave one:
//   - blocks (either direction) and the recipient's ignore list always refuse
//   - "Only friends can PM me" (users.pm_buddies) limits it to mutual contacts
const PER_SENDER_UNREAD = 20, PER_RECIPIENT_UNREAD = 200, MAX_TEXT = 1000;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids = list => Array.isArray(list) ? [...new Set(list.map(Number).filter(id => Number.isInteger(id) && id > 0 && id <= 2147483647))].slice(0, 200) : [];

function createOfflineMessages({ db, isOnline = () => false, toUser = () => {}, uuid = () => require('node:crypto').randomUUID() }) {
  const refuse = { error: "This person isn't accepting messages from you." };
  async function target(name) {
    const [row] = await db.q(`select id,name,pm_buddies from users where name_lc=$1 and not banned and not coalesce(deactivated,false)`,
      [String(name || '').toLowerCase().slice(0, 40)]);
    return row || null;
  }
  // Returns {ok:true,target} or {error}. `from` is {id,name,master}.
  async function allowed(from, toName) {
    const t = await target(toName);
    if (!t) return { error: 'No Razzle account found with that screen name.' };
    if (t.id === from.id) return { error: 'You cannot message yourself.' };
    const [r] = await db.q(`select
        exists(select 1 from blocks where (owner=$1 and blocked=$2) or (owner=$2 and blocked=$1)) as blocked,
        exists(select 1 from ignores where owner=$2 and name_lc=$3) as ignored,
        exists(select 1 from contacts where owner=$2 and contact=$1) as contact,
        exists(select 1 from social_restrictions where user_id=$1 and service='messenger') as restricted`,
      [from.id, t.id, String(from.name).toLowerCase()]);
    if (r.restricted) return { error: 'Messenger access is restricted. Your Social account remains available.' };
    if (!from.master && (r.blocked || r.ignored)) return refuse;
    if (!from.master && t.pm_buddies && !r.contact) return refuse;
    return { ok: true, target: t, contact: r.contact };
  }
  async function send(from, toName, text) {
    text = String(text || '').trim().slice(0, MAX_TEXT);
    if (!text) return { error: 'Type a message first.' };
    const check = await allowed(from, toName); if (check.error) return check;
    const t = check.target;
    if (isOnline(t.name)) return { error: t.name + ' is online now. Send them a message in Messenger instead.', online: true };
    const [counts] = await db.q(`select count(*) filter (where from_id=$2)::int as mine, count(*)::int as total
      from offline where to_id=$1 and read_at is null`, [t.id, from.id]);
    if (counts.mine >= PER_SENDER_UNREAD) return { error: 'You have left ' + t.name + ' a lot of messages already. Wait until they read them.' };
    if (counts.total >= PER_RECIPIENT_UNREAD) return { error: t.name + "'s offline inbox is full." };
    const body = { id: uuid(), text: esc(text), b: false, i: false, u: false, color: '#000000', f: 'Arial' };
    const [row] = await db.q('insert into offline(to_id,from_id,body) values($1,$2,$3) returning id,extract(epoch from created)*1000 as t', [t.id, from.id, body]);
    return { ok: true, offline: true, offlineId: row.id, to: t.name, t: Math.round(row.t), ...body };
  }
  // Unread (and, if asked, already-read) messages for a recipient, oldest first.
  async function list(uid, { includeRead = false } = {}) {
    const rows = await db.q(`select o.id,u.name,o.body,o.read_at,extract(epoch from o.created)*1000 as t,
        exists(select 1 from contacts c where c.owner=$1 and c.contact=o.from_id) as contact
      from offline o join users u on u.id=o.from_id where o.to_id=$1 and ($2 or o.read_at is null)
      and not exists(select 1 from blocks b where b.owner=$1 and b.blocked=o.from_id) order by o.id limit 500`, [uid, !!includeRead]);
    return rows.map(r => ({ offlineId: r.id, id: 'offline:' + r.id, from: r.name, text: r.body?.text || '', t: Math.round(r.t),
      read: !!r.read_at, contact: !!r.contact, messageId: r.body?.id || null }));
  }
  async function unreadCount(uid) {
    const [r] = await db.q(`select count(*)::int as n from offline o where o.to_id=$1 and o.read_at is null
      and not exists(select 1 from blocks b where b.owner=$1 and b.blocked=o.from_id)`, [uid]);
    return r?.n || 0;
  }
  // Mark read keeps the message (Social can still show it under "read"); dismiss deletes it.
  async function markRead(uid, list) {
    const valid = ids(list); if (!valid.length) return { ok: true, ids: [] };
    const rows = await db.q('update offline set read_at=coalesce(read_at,now()) where to_id=$1 and id=any($2::int[]) returning id', [uid, valid]);
    const done = rows.map(r => r.id); if (done.length) toUser(uid, 'm:offline-read', done);
    return { ok: true, ids: done };
  }
  async function dismiss(uid, list) {
    const valid = ids(list); if (!valid.length) return { ok: true, ids: [] };
    const rows = await db.q('delete from offline where to_id=$1 and id=any($2::int[]) returning id', [uid, valid]);
    const done = rows.map(r => r.id); if (done.length) toUser(uid, 'm:offline-read', done);
    return { ok: true, ids: done };
  }
  return { allowed, send, list, unreadCount, markRead, dismiss };
}

// Social HTTP routes (mounted on the Social router, which already requires sign-in and same-origin JSON writes).
function registerOfflineRoutes(router, offline, run) {
  router.get('/api/offline-messages', run(async (req, res) => {
    const messages = await offline.list(req.socialAccount.id, { includeRead: req.query.all === '1' });
    res.json({ messages, unread: messages.filter(m => !m.read).length });
  }));
  router.post('/api/offline-messages', run(async (req, res) => {
    const result = await offline.send({ id: req.socialAccount.id, name: req.socialAccount.alias, master: req.socialAccount.master }, req.body?.to, req.body?.text);
    res.status(result.error ? (result.online ? 409 : 400) : 201).json(result);
  }));
  router.post('/api/offline-messages/read', run(async (req, res) => res.json(await offline.markRead(req.socialAccount.id, req.body?.ids))));
  router.post('/api/offline-messages/dismiss', run(async (req, res) => res.json(await offline.dismiss(req.socialAccount.id, req.body?.ids))));
}

module.exports = { createOfflineMessages, registerOfflineRoutes, PER_SENDER_UNREAD, PER_RECIPIENT_UNREAD };
