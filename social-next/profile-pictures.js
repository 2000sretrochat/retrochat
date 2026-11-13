'use strict';
// "Profile pictures" album on a Social profile (Nov 13, 2026).
// History lives in avatar_history (db.js): a trigger records every custom Messenger/profile picture written to `avatars`
// (Messenger upload, phone snap, Social photo set). History starts with each account's current picture; earlier
// pictures were never stored, so they can't be shown. The owner can upload, delete (never the current default), and
// "Set as default", which becomes the Messenger/profile picture everywhere. Viewers follow the profile's privacy:
// blocked either way, or a private profile you aren't friends with, sees nothing.
const crypto = require('node:crypto');

const MAX = 32 * 1024; // same limit as Messenger avatars
const MAGIC = {
  'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': b => b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/webp': b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'
};
function parsePicture(d) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d || '').slice(0, 50000));
  if (!m) return { error: 'Pictures must be a JPEG, PNG or WebP image.' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX) return { error: 'That picture is too big (max 32 KB after resizing).' };
  if (buf.length < 50 || !MAGIC[m[1]](buf)) return { error: 'That file is not a valid image.' };
  return { mime: m[1], buf };
}

function registerProfilePictures(router, db, { run, fail, isBlocked, accounts, io }) {
  const NAME = /^[a-z0-9_.-]{1,40}$/;
  // Returns the profile owner row if the viewer may see their pictures, else throws 404.
  async function visible(req, name) {
    const lc = String(name || '').toLowerCase(); if (!NAME.test(lc)) fail('Profile unavailable.', 404);
    const viewer = req.socialAccount.id;
    const [row] = await db.q(`select u.id,u.name,u.avatar,
        coalesce((select value->>'visibility' from social_settings where user_id=u.id),'public') as visibility,
        exists(select 1 from contacts where owner=u.id and contact=$1) as friend, ${isBlocked('u.id', '$1')} as blocked
      from users u where u.name_lc=$2 and not u.banned and not coalesce(u.deactivated,false)`, [viewer, lc]);
    if (!row) fail('Profile unavailable.', 404);
    const owner = row.id === viewer;
    if (!owner && !req.socialAccount.master && (row.blocked || row.visibility === 'private' && !row.friend)) fail('Profile unavailable.', 404);
    return { ...row, owner };
  }
  const currentSql = `(u.avatar like 'c%' and h.hash = (select md5(a.data) from avatars a where a.user_id=u.id))`;
  async function setDefault(uid, alias, mime, buf) {
    const av = 'c' + crypto.randomBytes(8).toString('hex');
    await db.q('insert into avatars(user_id,mime,data,updated) values($1,$2,$3,now()) on conflict(user_id) do update set mime=$2,data=$3,updated=now()', [uid, mime, buf]);
    await db.q('update users set avatar=$2 where id=$1', [uid, av]);
    await accounts.setAvatar?.(uid, av);
    for (const s of io?.sockets?.sockets?.values() || []) if (s.data.acct?.id === uid) s.data.av = av;
    io?.emit('avatar', { name: alias, av });
    return av;
  }

  router.get('/api/profile-pictures/:name', run(async (req, res) => {
    const p = await visible(req, req.params.name);
    const rows = await db.q(`select h.id::text as id,h.created,${currentSql} as current from avatar_history h join users u on u.id=h.user_id
      where h.user_id=$1 order by ${currentSql} desc, h.created desc, h.id desc limit 30`, [p.id]);
    res.set('Cache-Control', 'no-store').json({
      owner: p.owner, name: p.name,
      note: p.owner ? 'Pictures are saved here from November 13, 2026 on. Older pictures weren’t kept.' : '',
      pictures: rows.map(r => ({ id: r.id, created: r.created, current: !!r.current,
        src: '/social-next/api/profile-pictures/' + encodeURIComponent(p.name) + '/' + r.id + '/image' }))
    });
  }));
  router.get('/api/profile-pictures/:name/:id/image', run(async (req, res) => {
    if (!/^\d{1,18}$/.test(req.params.id)) fail('Picture unavailable.', 404);
    const p = await visible(req, req.params.name);
    const [r] = await db.q('select mime,data from avatar_history where id=$1 and user_id=$2', [req.params.id, p.id]);
    if (!r || !MAGIC[r.mime]) fail('Picture unavailable.', 404);
    res.set({ 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
    res.type(r.mime).send(r.data);
  }));
  // Upload a new picture to the album (optionally making it the default right away).
  router.post('/api/profile-pictures', run(async (req, res) => {
    const pic = parsePicture(req.body?.image); if (pic.error) fail(pic.error);
    const uid = req.socialAccount.id;
    if (req.body?.makeDefault === true) await setDefault(uid, req.socialAccount.alias, pic.mime, pic.buf);
    else await db.q(`insert into avatar_history(user_id,mime,data,hash) values($1,$2,$3::bytea,md5($3::bytea)) on conflict(user_id,hash) do update set created=now()`, [uid, pic.mime, pic.buf]);
    // Keep the newest 30 per account (never the current default), the same cap the history trigger uses.
    await db.q(`delete from avatar_history h using users u where h.user_id=$1 and u.id=h.user_id and not ${currentSql}
      and h.id not in (select id from avatar_history where user_id=$1 order by created desc, id desc limit 30)`, [uid]);
    res.json({ ok: true });
  }));
  router.post('/api/profile-pictures/:id/default', run(async (req, res) => {
    if (!/^\d{1,18}$/.test(req.params.id)) fail('Picture unavailable.', 404);
    const uid = req.socialAccount.id;
    const [r] = await db.q('select mime,data from avatar_history where id=$1 and user_id=$2', [req.params.id, uid]);
    if (!r) fail('Picture unavailable.', 404);
    const av = await setDefault(uid, req.socialAccount.alias, r.mime, r.data);
    res.json({ ok: true, avatar: av });
  }));
  router.delete('/api/profile-pictures/:id', run(async (req, res) => {
    if (!/^\d{1,18}$/.test(req.params.id)) fail('Picture unavailable.', 404);
    const uid = req.socialAccount.id;
    const gone = await db.q(`delete from avatar_history h using users u where h.id=$1 and h.user_id=$2 and u.id=h.user_id
      and not ${currentSql} returning h.id`, [req.params.id, uid]);
    if (!gone.length) fail('You can’t delete your current default picture. Set another one as default first.', 409);
    res.json({ ok: true });
  }));
}

module.exports = { parsePicture, registerProfilePictures, MAX };
