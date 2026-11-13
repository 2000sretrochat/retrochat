'use strict';
// Night light setting saved on the account (users.night_pref jsonb) so it follows a chatter to every device.
const MIN = 10, MAX = 85;
function clean(b) {
  if (!b || typeof b.on !== 'boolean') return null;
  const s = Math.round(+b.strength);
  if (!Number.isFinite(s)) return null;
  return { on: b.on, strength: Math.max(MIN, Math.min(MAX, s)) };
}
function route(app, express, db, userFromReq) {
  app.get('/api/night-pref', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const u = await userFromReq(req).catch(() => null); if (!u) return res.status(401).json({});
    try { const p = clean((await db.q('select night_pref from users where id=$1', [u.id]))[0]?.night_pref); res.json(p || {}); }
    catch { res.status(503).json({}); }
  });
  app.post('/api/night-pref', express.json({ limit: '1kb' }), async (req, res) => {
    const o = req.headers.origin; try { if (o && new URL(o).host !== req.headers.host) return res.status(403).json({ error: 'Invalid origin.' }); } catch { return res.status(403).json({ error: 'Invalid origin.' }); }
    const u = await userFromReq(req).catch(() => null); if (!u) return res.status(401).json({ error: 'Sign in to save this on your account.' });
    const p = clean(req.body); if (!p) return res.status(400).json({ error: 'Invalid night light setting.' });
    try { await db.q('update users set night_pref=$2 where id=$1', [u.id, JSON.stringify(p)]); res.json({ ok: true, ...p }); }
    catch { res.status(503).json({ error: 'Could not save right now.' }); }
  });
}
module.exports = { clean, route, MIN, MAX };
