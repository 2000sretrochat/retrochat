function createMicBump({ db, accounts, onChange }) {
  const lowerPriority = new Map();
  let enabled = true;
  let pending = Promise.resolve();

  async function load() {
    if (!db.status().ready) return;
    const [row] = await db.q("select v from kv where k='mic-bump'");
    enabled = row?.v !== 'off';
  }

  function reconcile(room, members, drop) {
    if (!enabled || members.length < 2) {
      lowerPriority.delete(room);
      return false;
    }
    const visible = new Map(members.filter(socket => socket.data.name && !socket.data.inc)
      .map(socket => [socket.data.name.toLowerCase(),socket]));
    const needed = Math.ceil((visible.size - 1) / 2);
    const votes = new Map();
    for (const [voter, socket] of visible) {
      for (const target of socket.data.ign || []) {
        if (target !== voter && visible.has(target)) votes.set(target,(votes.get(target) || 0) + 1);
      }
    }
    const previous = lowerPriority.get(room);
    const next = new Set();
    const bumped = [];
    for (const [name, socket] of visible) {
      if (socket.data.master || !needed || (votes.get(name) || 0) < needed) continue;
      next.add(socket.id);
      if (!previous?.has(socket.id) && socket.data.talk) bumped.push(socket);
    }
    if (next.size) lowerPriority.set(room,next);
    else lowerPriority.delete(room);
    bumped.forEach(drop);
    return bumped.length > 0;
  }

  const isLower = (room,id) => lowerPriority.get(room)?.has(id) === true;
  function prioritize(room, queue) {
    const lowered = lowerPriority.get(room);
    if (!lowered) return queue;
    return [...queue.filter(id => !lowered.has(id)), ...queue.filter(id => lowered.has(id))];
  }

  function register(app) {
    const masterOnly = handler => async (req,res) => {
      res.set('Cache-Control','no-store');
      try {
        const account = await accounts.userFromCookie(req.headers.cookie);
        if (!account) return res.sendStatus(404);
        const [role] = await db.q('select is_master from users where id=$1',[account.id]);
        if (!role?.is_master) return res.sendStatus(404);
        await handler(req,res,account);
      } catch (error) {
        console.error('[mic bump]',error.message);
        res.status(500).json({error:'Could not load or save Mic Bump.'});
      }
    };
    app.get('/api/master/mic-bump',masterOnly((_req,res) => res.json({enabled})));
    app.post('/api/master/mic-bump',masterOnly(async (req,res,account) => {
      const value = req.body?.enabled;
      if (typeof value !== 'boolean') return res.status(400).json({error:'Choose on or off.'});
      const save = pending.then(async () => {
        if (enabled === value) return;
        await db.q(`with saved as (
          insert into kv(k,v) values('mic-bump',$1)
          on conflict(k) do update set v=excluded.v returning v
        ) insert into master_audit(by_name,action,target,detail)
          select $2,'master-setting','mic-bump',v from saved`,[value?'on':'off',account.name]);
        enabled = value;
        lowerPriority.clear();
        onChange();
      });
      pending = save.catch(() => {});
      await save;
      res.json({enabled});
    }));
  }

  function rename(from,to) {
    const priority = lowerPriority.get(from);
    if (priority) lowerPriority.set(to,priority);
    lowerPriority.delete(from);
  }

  return { load, register, reconcile, prioritize, isLower, rename };
}

module.exports = { createMicBump };
