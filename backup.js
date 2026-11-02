// Daily JSON backup of key tables into the backups table (keeps the last 7 days). Masters can list/download/run via Master Control.
const db = require('./db');
const TABLES = ['users', 'contacts', 'groups', 'requests', 'blocks', 'favorites', 'user_rooms', 'room_meta', 'room_mod', 'room_ann', 'ip_bans', 'kv', 'reports', 'watch', 'imv'];
async function run() { const data = {}; for (const t of TABLES) { try { data[t] = await db.q('select * from ' + t); } catch (e) { data[t] = { error: e.message }; } }
  const d = new Date().toISOString().slice(0, 10); await db.q('insert into backups(d,data) values($1,$2) on conflict(d) do update set data=$2, created=now()', [d, JSON.stringify(data)]);
  await db.q("delete from backups where d < current_date - interval '6 days'"); return { d, rows: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])) }; }
function schedule() { const tick = async () => { try { if (!db.status().ready) return; const r = await db.q('select 1 from backups where d=current_date'); if (!r.length) { const x = await run(); console.log('backup done', x.d); } } catch (e) { console.error('backup', e.message); } };
  setTimeout(tick, 60e3).unref(); setInterval(tick, 3600e3).unref(); }
function routes(app, guard) {
  app.get('/api/master/backups', guard(async (req, res) => res.json(await db.q("select d::text as d, created, pg_column_size(data) as bytes from backups order by d desc"))));
  app.post('/api/master/backups', guard(async (req, res) => res.json(await run())));
  app.get('/api/master/backups/:d', guard(async (req, res) => { const r = (await db.q('select data from backups where d=$1::date', [String(req.params.d).slice(0, 10)]))[0]; if (!r) return res.status(404).json({ error: 'No backup for that day.' });
    res.set('Content-Disposition', 'attachment; filename="yappchat-backup-' + req.params.d.slice(0, 10) + '.json"').json(r.data); }));
}
module.exports = { run, schedule, routes, TABLES };
