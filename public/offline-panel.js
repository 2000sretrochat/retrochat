/* Messenger "Offline Messages" panel (design handoff Nov 10, item 2): sits directly below the contact toolbar and lists
   PMs that arrived while you were signed out. Clicking a row opens the conversation (which marks it read); the X
   dismisses one message for good (server deletes it and tells every open Messenger via m:offline-read). */
window.RZ_ICONS = window.RZ_ICONS || {};
Object.assign(window.RZ_ICONS, {
  envelope: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="m3 6 7 5 7-5"/></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 5 10 10M15 5 5 15"/></svg>'
});
window.rzDecode = function (text) { const t = document.createElement('textarea'); t.innerHTML = String(text == null ? '' : text); return t.value; };
window.rzWhen = function (ms) {
  const d = new Date(+ms || Date.now()), now = new Date();
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff <= 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
window.createOfflinePanel = function ({ el, held, openMessage, dismiss }) {
  if (!el) return { render() {} };
  el.classList.add('rz-offline');
  el.setAttribute('aria-label', 'Offline Messages');
  function messages() {
    const list = [];
    for (const items of Object.values(held() || {})) for (const m of items) if (m && m.offlineId && m.receivedOffline) list.push(m);
    return list.sort((a, b) => (b.t || 0) - (a.t || 0));
  }
  function render() {
    const list = messages();
    el.hidden = !list.length;
    if (!list.length) { el.replaceChildren(); return; }
    const head = document.createElement('div');
    head.className = 'rz-offline-head';
    head.innerHTML = window.RZ_ICONS.envelope + '<b>Offline Messages</b>';
    const badge = document.createElement('span');
    badge.className = 'rz-badge'; badge.textContent = list.length > 99 ? '99+' : String(list.length);
    badge.setAttribute('aria-label', list.length + ' offline message' + (list.length === 1 ? '' : 's'));
    head.append(badge);
    const rows = document.createElement('div');
    rows.className = 'rz-offline-list';
    for (const m of list) {
      const row = document.createElement('div');
      row.className = 'rz-offline-row';
      const open = document.createElement('button');
      open.type = 'button'; open.className = 'rz-offline-open';
      open.title = 'Open conversation with ' + m.from;
      const av = document.createElement('span'); av.className = 'rz-avatar'; av.textContent = (m.from || '?').charAt(0).toUpperCase();
      const body = document.createElement('span'); body.className = 'rz-offline-body';
      const who = document.createElement('b'); who.textContent = m.from;
      const text = document.createElement('small'); text.textContent = window.rzDecode(m.text);
      body.append(who, text);
      const when = document.createElement('time'); when.textContent = window.rzWhen(m.t);
      if (m.t) when.dateTime = new Date(m.t).toISOString();
      open.append(av, body, when);
      open.onclick = () => openMessage(m.from);
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'rz-offline-x';
      x.setAttribute('aria-label', 'Dismiss ' + m.from + ' message'); x.title = 'Dismiss';
      x.innerHTML = window.RZ_ICONS.close;
      x.onclick = async event => {
        event.stopPropagation(); x.disabled = true;
        try { const r = await dismiss([m.offlineId]); if (r && r.error) { x.disabled = false; window.alert(r.error); } }
        catch { x.disabled = false; }
      };
      row.append(open, x);
      rows.append(row);
    }
    el.replaceChildren(head, rows);
  }
  return { render, messages };
};
