'use strict';
// Link previews for Social posts: title, description and picture (og:/twitter: tags) for any http/https page.
// The server fetches the page itself, so it is locked down against SSRF:
//   - http/https only, default ports only, no user:pass@ URLs
//   - every DNS answer is checked and the connection is pinned to the checked address (no DNS-rebinding tricks);
//     private, loopback, link-local, CGNAT, multicast and reserved ranges are refused (IPv4 and IPv6)
//   - redirects are followed by hand (max 3), each hop checked again
//   - 5 s timeout, 256 KB page cap (only <head> is read), 2 MB image cap
// Results are cached (6 h, 500 entries). Preview pictures are served through /social-next/link-image with a signed
// URL, so the visitor's browser never contacts the other site and the proxy cannot be used for arbitrary URLs.
const http = require('node:http'), https = require('node:https'), dns = require('node:dns'), net = require('node:net'), crypto = require('node:crypto');

const BLOCK = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) BLOCK.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32], ['100::', 64]]) BLOCK.addSubnet(a, p, 'ipv6');
function privateIp(ip) {
  const kind = net.isIP(ip); if (!kind) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip); if (mapped) return privateIp(mapped[1]);
  return BLOCK.check(ip, kind === 4 ? 'ipv4' : 'ipv6');
}
function publicUrl(value) {
  let url; try { url = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.href.length > 2000) return null;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) ? privateIp(host) : !/^(?:[a-z0-9-]+\.)+[a-z0-9-]{2,}$/i.test(host) || /\.(?:local|localhost|internal|lan|home|corp|test|invalid)$/i.test(host)) return null;
  url.hash = ''; return url;
}
// dns.lookup replacement used for the real connection: refuse if any answer is private.
function safeLookup(host, options, cb) {
  dns.lookup(host, { all: true }, (err, list) => {
    if (err) return cb(err);
    if (!list.length || list.some(a => privateIp(a.address))) return cb(Object.assign(Error('blocked address'), { code: 'EBLOCKED' }));
    if (options && options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}
// GET with checks; resolves { status, type, body: Buffer, url } or null.
function get(start, { accept, max, lookup = safeLookup, timeout = 5000 }) {
  return new Promise(resolve => {
    const deadline = setTimeout(() => done(null), timeout); let finished = false, req;
    const done = v => { if (finished) return; finished = true; clearTimeout(deadline); try { req && req.destroy(); } catch { } resolve(v); };
    const hop = (url, left) => {
      url = publicUrl(url); if (!url) return done(null);
      req = (url.protocol === 'https:' ? https : http).get(url, { lookup, headers: { Accept: accept, 'User-Agent': 'RazzleSocialPreview/1.0', 'Accept-Encoding': 'identity' } }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) { res.resume(); const loc = res.headers.location; if (!loc || !left) return done(null); let next; try { next = new URL(loc, url).href; } catch { return done(null); } return hop(next, left - 1); }
        if (res.statusCode !== 200) { res.resume(); return done(null); }
        const chunks = []; let size = 0;
        res.on('data', c => { size += c.length; if (size > max) { if (accept.startsWith('text/')) { chunks.push(c); return done({ status: 200, type: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks).subarray(0, max), url: url.href }); } return done(null); } chunks.push(c);
          if (accept.startsWith('text/') && /<\/head\s*>/i.test(c.toString('latin1'))) done({ status: 200, type: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks), url: url.href }); });
        res.on('end', () => done({ status: 200, type: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks), url: url.href }));
        res.on('error', () => done(null));
      });
      req.on('error', () => done(null));
    };
    hop(start, 3);
  });
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = s => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? (() => { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })() : ENT[e.toLowerCase()] ?? m);
const clip = (s, n) => { s = decode(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
function parseMeta(html, base) {
  const meta = {};
  for (const tag of html.matchAll(/<meta\s+([^<>]*)>/gi)) {
    const at = Object.fromEntries(Array.from(tag[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/g), ([, k, a, b, c]) => [k.toLowerCase(), a ?? b ?? c]));
    const key = String(at.property || at.name || '').toLowerCase(); if (key && at.content && !(key in meta)) meta[key] = at.content;
  }
  const title = clip(meta['og:title'] || meta['twitter:title'] || (/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || '', 160);
  const description = clip(meta['og:description'] || meta['twitter:description'] || meta.description || '', 280);
  let image = null;
  for (const k of ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']) {
    if (!meta[k]) continue; try { const u = publicUrl(new URL(decode(meta[k]), base).href); if (u) { image = u.href; break; } } catch { }
  }
  const site = clip(meta['og:site_name'] || '', 80);
  return { title, description, image, site };
}
const IMAGE_TYPES = /^image\/(jpeg|png|gif|webp)$/;
function createLinkPreviews({ secret = crypto.randomBytes(32), fetchPage = get, ttl = 6 * 3600e3, now = Date.now } = {}) {
  const cache = new Map();
  const sign = u => crypto.createHmac('sha256', secret).update(u).digest('base64url').slice(0, 32);
  const imageUrl = u => '/social-next/link-image?u=' + encodeURIComponent(u) + '&s=' + sign(u);
  async function preview(value) {
    const url = publicUrl(value); if (!url) return {};
    const key = url.href, hit = cache.get(key); if (hit && now() - hit.at < ttl) return hit.data;
    let data = {};
    const page = await fetchPage(key, { accept: 'text/html,application/xhtml+xml', max: 256 * 1024 });
    if (page && /html/i.test(page.type)) { const m = parseMeta(page.body.toString('utf8'), page.url); data = { title: m.title, description: m.description, site: m.site || new URL(page.url).hostname.replace(/^www\./, ''), image: m.image ? imageUrl(m.image) : null }; }
    cache.set(key, { at: now(), data }); if (cache.size > 500) cache.delete(cache.keys().next().value);
    return data;
  }
  async function image(u, s) {
    if (typeof u !== 'string' || typeof s !== 'string' || s.length !== 32 || !crypto.timingSafeEqual(Buffer.from(sign(u)), Buffer.from(s))) return null;
    const res = await fetchPage(u, { accept: 'image/jpeg,image/png,image/gif,image/webp', max: 2 * 1024 * 1024 });
    const type = res && String(res.type).split(';')[0].trim().toLowerCase();
    return res && IMAGE_TYPES.test(type) && res.body.length ? { type, body: res.body } : null;
  }
  function routes(router) {
    router.get('/article-preview', async (req, res) => { res.set('Cache-Control', 'private, max-age=900'); res.json(await preview(typeof req.query.url === 'string' ? req.query.url : '').catch(() => ({}))); });
    router.get('/link-image', async (req, res) => {
      const img = await image(req.query.u, req.query.s).catch(() => null);
      if (!img) return res.status(404).end();
      res.set({ 'Content-Type': img.type, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'public, max-age=21600' }).end(img.body);
    });
  }
  return { preview, image, routes, sign, cache };
}
// Image addresses typed into a post show as the picture itself (jpg/png/gif/webp, http/https).
const IMAGE_LINK = /\.(?:jpe?g|png|gif|webp)$/i;
const isImageLink = value => { const u = publicUrl(value); return !!u && IMAGE_LINK.test(u.pathname); };
module.exports = { createLinkPreviews, publicUrl, privateIp, safeLookup, parseMeta, isImageLink, get };
