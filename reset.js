// Password reset: token link (1 hour). Email goes out via Resend when RESEND_API_KEY + MAIL_FROM are set;
// otherwise masters can generate a reset link in Master Control.
const crypto = require('crypto'), bcrypt = require('bcryptjs'), db = require('./db');
const TTL = 3600e3, sha = t => crypto.createHash('sha256').update(t).digest('hex');
const enabled = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
const base = req => (process.env.PUBLIC_URL || (req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.headers.host).replace(/\/$/, '');
async function makeLink(req, uid) { const t = crypto.randomBytes(32).toString('base64url'); await db.q('delete from pw_resets where user_id=$1 or expires < now()', [uid]);
  await db.q('insert into pw_resets(token,user_id,expires) values($1,$2,$3)', [sha(t), uid, new Date(Date.now() + TTL)]); return base(req) + '/reset.html?t=' + t; }
async function send(to, name, link) { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject: 'Reset your YappChat password', text: 'Hi ' + name + ',\n\nUse this link within 1 hour to choose a new YappChat password:\n' + link + '\n\nIf you did not ask for this, ignore this email.\n\n- YappChat' }) });
  if (!r.ok) throw new Error('mail ' + r.status); }
async function mail(to, subject, text) { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }) }); if (!r.ok) throw new Error('mail ' + r.status); }
const verifyOn = () => enabled() && process.env.EMAIL_VERIFY !== 'off';
const hits = new Map(), vhits = new Map();
module.exports = function (app, express) {
  const ACC = require('./accounts'), EM = require('./emails');
  async function vstate(req) { const u = await ACC.userFromCookie(req.headers.cookie); if (!u) return null;
    const r = (await db.q('select id,name,email,verified,is_master from users where id=$1', [u.id]))[0]; if (!r) return null;
    const exempt = r.is_master || (r.email && EM.list().includes(EM.norm(r.email)));
    return { r, need: verifyOn() && !!r.email && !r.verified && !exempt }; }
  // email verification (only when a sender is configured; masters and unlimited-list emails are exempt)
  app.get('/api/verify/status', async (req, res) => { res.set('Cache-Control', 'no-store'); try { const v = await vstate(req); res.json({ need: !!(v && v.need) }); } catch { res.json({ need: false }); } });
  app.post('/api/verify/send', async (req, res) => { try { const v = await vstate(req); if (!v || !v.need) return res.json({ ok: true, sent: false });
    const n = (vhits.get(v.r.id) || []).filter(t => Date.now() - t < 3600e3); if (n.length >= 3) return res.status(429).json({ error: 'Too many verification emails. Try again later.' }); n.push(Date.now()); vhits.set(v.r.id, n);
    const t = crypto.randomBytes(32).toString('base64url'); await db.q('delete from email_verify where user_id=$1 or expires < now()', [v.r.id]);
    await db.q('insert into email_verify(token,user_id,expires) values($1,$2,$3)', [sha(t), v.r.id, new Date(Date.now() + 24 * TTL)]);
    await mail(v.r.email, 'Verify your YappChat email', 'Hi ' + v.r.name + ',\n\nConfirm your email for YappChat with this link (valid 24 hours):\n' + base(req) + '/api/verify?t=' + t + '\n\nIf you didn\'t sign up, ignore this email.');
    res.json({ ok: true, sent: true }); } catch (e) { console.error('verify send', e.message); res.status(500).json({ error: 'Could not send the email right now.' }); } });
  app.get('/api/verify', async (req, res) => { const t = String(req.query.t || ''); const r = t ? (await db.q('delete from email_verify where token=$1 returning user_id, expires', [sha(t)]).catch(() => []))[0] : null;
    if (!r || new Date(r.expires) < new Date()) return res.redirect('/?verified=0'); await db.q('update users set verified=true where id=$1', [r.user_id]).catch(() => {}); res.redirect('/?verified=1'); });
  app.get('/api/reset/config', (req, res) => res.json({ email: enabled() }));
  app.post('/api/forgot', express.json(), async (req, res) => { const ip = req.ip, n = (hits.get(ip) || []).filter(t => Date.now() - t < 3600e3); if (n.length >= 5) return res.status(429).json({ error: 'Too many requests. Try again later.' }); n.push(Date.now()); hits.set(ip, n);
    if (!enabled()) return res.json({ ok: true, email: false, text: 'Email reset is not available yet. Use the Report button in a chat room to ask a moderator for a reset link.' });
    const k = String(req.body?.name || '').trim().toLowerCase().slice(0, 100); const generic = { ok: true, email: true, text: 'If that account has an email address on file, a reset link is on its way. It expires in 1 hour.' };
    if (!k) return res.json(generic);
    try { const u = (await db.q('select id,name,email from users where name_lc=$1 or lower(email)=$1 limit 1', [k]))[0]; if (u && u.email) await send(u.email, u.name, await makeLink(req, u.id)); } catch (e) { console.error('forgot', e.message); }
    res.json(generic); });
  app.post('/api/reset', express.json(), async (req, res) => { const { t, password } = req.body || {};
    if (typeof password !== 'string' || password.length < 8 || password.length > 100) return res.status(400).json({ error: 'Passwords must be 8-100 characters.' });
    const r = typeof t === 'string' ? (await db.q('delete from pw_resets where token=$1 returning user_id, expires', [sha(t)]).catch(() => []))[0] : null;
    if (!r || new Date(r.expires) < new Date()) return res.status(400).json({ error: 'This reset link is invalid or has expired. Ask for a new one.' });
    await db.q('update users set pw=$2 where id=$1', [r.user_id, await bcrypt.hash(password, 12)]); await db.q('delete from sessions where user_id=$1', [r.user_id]).catch(() => {});
    res.json({ ok: true }); });
  return { makeLink, verifyOn };
};
