'use strict';
// Help > Feedback (Nov 13, 2026): POST /api/feedback stores the note in Postgres (backup) and emails it through mail.js
// (Gmail SMTP) to razzlesocialbeta@gmail.com. Signed-in: 5 an hour per account and per IP.
// Guests: 2 an hour per IP. Never logs addresses, message text, or credentials.
const crypto = require('node:crypto');

const CATEGORIES = { suggestion: 'Suggestion', broken: "Something's not working", other: 'Other' };
const FALLBACK_TO = 'razzlesocialbeta@gmail.com';
const HOUR = 3600e3;

const clean = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, max);
const oneLine = (v, max) => clean(v, max).replace(/\s+/g, ' ');
function parse(body) {
  const b = body && typeof body === 'object' ? body : {};
  const category = Object.prototype.hasOwnProperty.call(CATEGORIES, b.category) ? b.category : null;
  if (!category) return { error: 'Choose a category.' };
  const message = clean(b.message, 2001);
  if (message.length < 10) return { error: 'Please write at least 10 characters.' };
  if (message.length > 2000) return { error: 'Please keep it under 2000 characters.' };
  const page = oneLine(b.page, 120).replace(/[^\w\-./?=&%#:+ ]/g, '');
  const app = oneLine(b.app, 40).replace(/[^\w.\- ()/]/g, '');
  return { category, label: CATEGORIES[category], message, page, app };
}
const mst = d => d.toLocaleString('en-US', { timeZone: 'America/Phoenix', dateStyle: 'medium', timeStyle: 'short' }) + ' MST';
function compose({ name, label, message, page, app, when }) {
  const who = oneLine(name, 40).replace(/[^\w.\- ]/g, '') || 'Guest';
  return {
    subject: 'Razzle feedback: ' + label + ' from ' + who,
    text: ['Screen name: ' + who, 'Category: ' + label, 'Page: ' + (page || 'unknown'), 'App: ' + (app || 'unknown'), 'Time: ' + mst(when), '', message].join('\n')
  };
}

function limiter() {
  const hits = new Map();
  return function allow(key, max, now = Date.now()) {
    const list = (hits.get(key) || []).filter(t => now - t < HOUR);
    if (list.length >= max) { hits.set(key, list); return false; }
    list.push(now); hits.set(key, list);
    if (hits.size > 20000) for (const [k, v] of hits) if (!v.some(t => now - t < HOUR)) hits.delete(k);
    return true;
  };
}

function register(app, express, { db, userFromReq, clientIp, mail = require('./mail'), log = console }) {
  const allow = limiter();
  app.post('/api/feedback', express.json({ limit: '16kb' }), async (req, res) => {
    try {
      const origin = req.get('origin');
      if (origin) { try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Invalid origin.' }); } catch { return res.status(403).json({ error: 'Invalid origin.' }); } }
      const f = parse(req.body); if (f.error) return res.status(400).json({ error: f.error });
      const user = await userFromReq(req).catch(() => null);
      const ipKey = 'ip:' + crypto.createHash('sha256').update(String(clientIp(req) || '')).digest('hex').slice(0, 24);
      const ok = user ? allow('u:' + user.id, 5) && allow(ipKey, 5) : allow(ipKey + ':guest', 2) && allow(ipKey, 5);
      if (!ok) return res.status(429).json({ error: 'Thanks! You’ve sent a lot of feedback this hour. Please try again a little later.' });
      const when = new Date(), name = user ? user.name : 'Guest';
      let id = null;
      if (db.status().ready) {
        try { id = (await db.q('insert into feedback(user_id,name,category,message,page,app,ip_hash,created) values($1,$2,$3,$4,$5,$6,$7,$8) returning id',
          [user ? user.id : null, name, f.category, f.message, f.page, f.app, ipKey, when]))[0].id; } catch (e) { log.error('[feedback] store failed', e.code || 'error'); }
      }
      const msg = compose({ name, ...f, when });
      // Always send to the fallback address
      const to = FALLBACK_TO;
      if (!mail.enabled()) {
        if (!id) return res.status(503).json({ error: 'Feedback is temporarily unavailable. Please try again later.' });
        log.log('[feedback] stored #' + id + ', email not configured (mail.enabled() = false)');
        return res.json({ ok: true });
      }
      // Fire-and-forget so the request never hangs
      mail.sendMail({ to, subject: msg.subject, text: msg.text })
        .then(() => {
          log.log('[feedback] stored #' + id + ', emailed to ' + to);
          if (id) db.q('update feedback set emailed=true where id=$1', [id]).catch(() => {});
        })
        .catch(e => log.error('[feedback] stored #' + id + ', email failed:', String(e.message || e).slice(0, 200)));
      res.json({ ok: true });
    } catch (e) { log.error('[feedback]', e.code || 'error'); res.status(500).json({ error: 'Could not send your feedback. Please try again.' }); }
  });
}

module.exports = { CATEGORIES, FALLBACK_TO, parse, compose, limiter, register, mst };
