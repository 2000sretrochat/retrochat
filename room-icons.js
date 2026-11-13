'use strict';
// Custom room icons uploaded by a room's owner.
// Render's free disk is wiped on every deploy, so the image lives in Postgres (room_icons.data, bytea), the same
// durable store the app already uses for Messenger profile pictures. The browser crops and re-encodes the picture
// to a small square first; the server only accepts real PNG/JPEG/WebP/GIF bytes under ICON_MAX and serves them
// back with their exact type, nosniff and a locked-down CSP.
const ICON_MAX = 48 * 1024;
const TYPES = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const MARK = /^img:([a-z0-9]{1,16})$/;
function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 6 && /^GIF8[79]a$/.test(buf.toString('latin1', 0, 6))) return 'gif';
  return '';
}
// -> { mime, data } or { error }
function parseIcon(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!m) return { error: 'Choose a PNG, JPG, WebP or GIF picture.' };
  const data = Buffer.from(m[2], 'base64');
  if (!data.length || data.length > ICON_MAX) return { error: 'That icon is too big. Pick a smaller picture (under 48 KB after resizing).' };
  const kind = sniff(data);
  if (!kind || kind !== m[1]) return { error: 'That file is not a valid picture.' };
  return { mime: TYPES[kind], data };
}
const isUploaded = icon => MARK.test(String(icon || ''));
const newMark = () => 'img:' + Date.now().toString(36);
const SCHEMA = 'create table if not exists room_icons(room text primary key, mime text not null, data bytea not null, updated timestamptz not null default now())';
async function save(db, room, icon) { await db.q('insert into room_icons(room,mime,data,updated) values($1,$2,$3,now()) on conflict(room) do update set mime=$2,data=$3,updated=now()', [room, icon.mime, icon.data]); }
function route(app, db, isRoom) {
  app.get('/api/room-icon/:room', async (req, res) => {
    const room = String(req.params.room || '');
    if (!isRoom(room)) return res.status(404).end();
    try {
      const row = (await db.q('select mime,data from room_icons where room=$1', [room]))[0];
      if (!row || !Object.values(TYPES).includes(row.mime)) return res.status(404).end();
      res.set({ 'Content-Type': row.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'public, max-age=86400', 'Content-Disposition': 'inline' });
      res.end(row.data);
    } catch { res.status(503).end(); }
  });
}
module.exports = { ICON_MAX, parseIcon, sniff, isUploaded, newMark, SCHEMA, save, route };
