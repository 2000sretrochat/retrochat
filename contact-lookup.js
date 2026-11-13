// Add-a-contact lookup for Messenger (m:find-contacts).
// Case-insensitive on users.name_lc. Prefix and substring both match (exact, then prefix, then the rest).
// Includes people you already added, requests you sent or received, and people you blocked (so the UI can
// say "already sent" / "you blocked them" instead of "no one found"). People who blocked you stay hidden.
'use strict';

const TERM_RE = /^[a-z0-9_.-]{3,20}$/;
const AV_RE = /^(a\d+|c[0-9a-z]+)$/;

function normalize(query) {
  const term = String(query || '').trim().toLowerCase();
  if (!TERM_RE.test(term)) return { error: 'Enter 3–20 screen name characters.' };
  return { term };
}

function truthy(v) { return v === true || v === 't' || v === 'true'; }

function avatar(key) { return AV_RE.test(key || '') ? key : 'a1'; }

function notice(term, person) {
  if (!person || String(person.name).toLowerCase() !== term) return '';
  if (person.sent) return 'Request already sent to ' + person.name;
  if (person.blocked) return 'You blocked ' + person.name + '. Unblock them to send a request.';
  if (person.contact) return person.name + ' is already in your contacts.';
  if (person.incoming) return person.name + ' already sent you a request. Add them to accept.';
  return '';
}

function hint(person, presence) {
  if (person.blocked) return 'You blocked this person';
  if (person.contact) return presence && presence.online ? 'Online' : 'Offline';
  if (person.sent) return 'Request sent';
  if (person.incoming) return 'They sent you a request';
  return 'Not in your list yet';
}

async function find(db, { uid, query, page } = {}) {
  const n = normalize(query);
  if (n.error) return n;
  const offset = Math.min(1000, Math.max(0, Math.trunc(Number(page) || 0))) * 4;
  const rows = await db.q(`
        select u.id, u.name, u.avatar,
          exists(select 1 from contacts where owner=$1 and contact=u.id) as contact,
          exists(select 1 from requests where from_id=$1 and to_id=u.id) as sent,
          exists(select 1 from requests where from_id=u.id and to_id=$1) as incoming,
          exists(select 1 from blocks where owner=$1 and blocked=u.id) as blocked
        from users u
        where strpos(u.name_lc,$2)>0 and u.id<>$1 and not u.banned and not coalesce(u.deactivated,false)
          and not exists(select 1 from blocks where owner=u.id and blocked=$1)
        order by (u.name_lc=$2) desc, (strpos(u.name_lc,$2)=1) desc, u.name_lc
        limit 5 offset $3`, [uid, n.term, offset]);
  const people = rows.slice(0, 4).map(r => {
    const person = {
      name: r.name,
      avatar: avatar(r.avatar),
      contact: truthy(r.contact),
      sent: truthy(r.sent),
      incoming: truthy(r.incoming),
      blocked: truthy(r.blocked),
    };
    person.hint = hint(person);
    return person;
  });
  return { people, more: rows.length > 4, notice: notice(n.term, people[0]) || undefined };
}

module.exports = { normalize, find, notice, hint, avatar };
