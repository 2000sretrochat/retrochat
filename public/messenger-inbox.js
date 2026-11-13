/* Shared notification bell for browser, desktop, and Social Messenger. */
window.createMessengerInbox = function ({ respond, openMessage, onRefresh }) {
  const requests = new Map();
  const bell = document.createElement('button');
  bell.type = 'button';
  bell.className = 'messenger-bell';
  bell.setAttribute('aria-label', 'Show Notifications');
  bell.title = 'Show Notifications';
  bell.setAttribute('aria-expanded', 'false');
  // design Nov 10 (item 9): outline bell when quiet, filled orange bell on a navy backing when something is unread
  bell.innerHTML = '<svg class="bell-quiet" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 14.5h-13l1-1c.9-.9 1.5-2 1.5-4V7a4 4 0 0 1 8 0v2.5c0 2 .6 3.1 1.5 4l1 1ZM8 16.8a2.3 2.3 0 0 0 4 0"/></svg>'
    + '<svg class="bell-on" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 2.2a4.9 4.9 0 0 0-4.9 4.9v2.2c0 1.9-.7 2.9-1.8 4l-.3.3c-.5.5-.1 1.4.6 1.4h12.8c.7 0 1.1-.9.6-1.4l-.3-.3c-1.1-1.1-1.8-2.1-1.8-4V7.1A4.9 4.9 0 0 0 10 2.2ZM7.8 16.2h4.4a2.2 2.2 0 0 1-4.4 0Z"/></svg>';
  const badge = document.createElement('small');
  bell.append(badge);
  const panel = document.createElement('section');
  panel.className = 'messenger-notifications';
  panel.setAttribute('aria-label', 'Messenger notifications');
  panel.hidden = true;
  document.querySelector('#menu').append(bell);
  document.body.append(panel);

  function row(label, actions) {
    const item = document.createElement('div');
    item.className = 'mn-line';
    const title = document.createElement('span');
    title.textContent = label;
    item.append(title);
    for (const [name, handler] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.onclick = async () => {
        button.disabled = true;
        try { await handler(); }
        finally { button.disabled = false; }
      };
      item.append(button);
    }
    panel.append(item);
  }

  // Social notifications (wall posts, comments, likes) from the Social API; opening the bell marks them read, like Social does.
  let social = [], socialLoaded = false, socialSeenMax = null, ready = false, lastCount = 0, lastQuiet = 0, lastChime = 0;
  const VERB = { post: 'posted on your wall', comment: 'commented on your post', like: 'liked your post', mention: 'mentioned you', friend_post: 'posted' };
  function socialRow(item) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'messenger-social-item' + (item.seen ? '' : ' unread');
    b.textContent = (item.display_name || item.name) + ' ' + (VERB[item.kind] || 'has new activity');
    b.title = 'Open in Social';
    b.onclick = () => { close(); window.open('/social-next/?post=' + encodeURIComponent(item.post_id), '_blank', 'noopener'); };
    const d = document.createElement('div'); d.className = 'mn-line mn-social' + (item.seen ? '' : ' unread'); d.append(b); panel.append(d);
  }
  async function loadSocial() {
    try {
      const r = await fetch('/social-next/api/notifications', { credentials: 'same-origin' });
      if (!r.ok) return;
      const j = await r.json(); social = Array.isArray(j.notifications) ? j.notifications : [];
      const max = social.reduce((m, n) => Math.max(m, +n.id || 0), 0);
      if (socialSeenMax !== null && max > socialSeenMax && social.some(n => !n.seen && +n.id > socialSeenMax)) newArrival(true);
      socialSeenMax = Math.max(socialSeenMax || 0, max); socialLoaded = true; refresh();
    } catch { }
  }
  function markSocialRead() {
    const ids = social.filter(n => !n.seen).map(n => n.id); if (!ids.length) return;
    social.forEach(n => { n.seen = true; });
    fetch('/social-next/api/notifications/read', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }).catch(() => { });
  }
  // a live arrival (not the backlog on load): one short shake + a soft chime (Settings > Notification sound; quiet while Busy)
  function newArrival(sound) {
    if (!ready) return;
    bell.classList.remove('shake'); void bell.offsetWidth; bell.classList.add('shake');
    setTimeout(() => bell.classList.remove('shake'), 700);
    const now = Date.now(); if (!sound || now - lastChime < 4000) return;
    if (localStorage.ycNotifSound === 'off' || localStorage.ycSound === 'off') return;
    const st = document.getElementById('stsel'); if (st && st.value === 'busy') return;
    lastChime = now; chime();
  }
  function chime() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ac = chime.ac || (chime.ac = new C()); if (ac.state === 'suspended') ac.resume().catch(() => { });
      const t = ac.currentTime;
      [[880, 0], [1318.5, 0.12]].forEach(([f, d]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.06, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.45);
        o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + 0.5);
      });
    } catch { }
  }

  function section(title, count, extra) {
    const heading = document.createElement('h3');
    heading.className = 'mn-head' + (extra ? ' ' + extra : '');
    heading.textContent = title;
    if (count) { const b = document.createElement('span'); b.className = 'rz-badge'; b.textContent = count > 99 ? '99+' : count; heading.append(' ', b); }
    panel.append(heading);
  }
  // design Nov 10 (item 3): an offline message gets an envelope row with preview, time and an unread dot
  function offlineRow(m) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mn-offline unread';
    const icon = document.createElement('span'); icon.className = 'mn-msg-icon';
    icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="m3 6 7 5 7-5"/></svg>';
    const body = document.createElement('span'); body.className = 'mn-offline-body';
    const title = document.createElement('b'); title.textContent = m.from + ' sent an offline message';
    const text = document.createElement('small'); text.textContent = window.rzDecode ? window.rzDecode(m.text) : String(m.text || '');
    const when = document.createElement('small'); when.className = 'mn-time'; when.textContent = window.rzWhen ? window.rzWhen(m.t) : '';
    body.append(title, text, when);
    const dot = document.createElement('span'); dot.className = 'mn-dot'; dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', 'Unread');
    b.append(icon, body, dot);
    b.onclick = () => { close(); openMessage(m.from); };
    panel.append(b);
  }

  function refresh() {
    try { onRefresh && onRefresh(); } catch { }
    const pending = Object.values(window.pmHeld || {}).filter(messages => messages.length);
    const count = requests.size + pending.reduce((total, messages) => total + messages.length, 0) + social.filter(n => !n.seen).length;
    // unread PMs already have their own IM sound, so they only shake the bell; requests/Social also chime
    const quiet = count - requests.size - social.filter(n => !n.seen).length;
    if (count > lastCount) newArrival(count - quiet > lastCount - lastQuiet);
    lastCount = count; lastQuiet = quiet;
    bell.classList.toggle('has-unread', !!count);
    badge.hidden = !count;
    badge.textContent = count > 99 ? '99+' : count;
    bell.setAttribute('aria-label', count ? 'Show Notifications, '+count+' unread' : 'Show Notifications');
    bell.title = count ? 'Show Notifications ('+count+' unread)' : 'Show Notifications';
    if (panel.hidden) return;
    panel.replaceChildren();
    // order (design Nov 10): Contact requests, Unread messages (offline messages first), then Social
    section('Contact requests', requests.size);
    if (!requests.size) row('No pending requests', []);
    for (const request of requests.values()) {
      const reply = async accepted => {
        const result = await respond(request.name, accepted);
        if (result.error) { window.alert(result.error); return; }
        remove(request.name);
      };
      row(request.name+' sent a contact request', [['Accept and add back', () => reply(true)], ['Decline', () => reply(false)]]);
    }
    const unreadTotal = pending.reduce((total, messages) => total + messages.length, 0);
    section('Unread messages', unreadTotal);
    if (!pending.length) row('No unread messages', []);
    const offline = pending.flat().filter(message => message.receivedOffline && message.offlineId).sort((a, b) => (b.t || 0) - (a.t || 0));
    for (const message of offline.slice(0, 30)) offlineRow(message);
    for (const messages of pending) {
      const live = messages.filter(message => !(message.receivedOffline && message.offlineId)).length;
      if (!live) continue;
      row(live+' new message'+(live === 1 ? '' : 's')+' from '+messages[0].from, [['Open', () => {
        close();
        openMessage(messages[0].from);
      }]]);
    }
    section('Social', social.filter(n => !n.seen).length, 'mn-social-head');
    if (!social.length) row(socialLoaded ? 'No Social notifications' : 'Loading Social notifications...', []);
    for (const item of social.slice(0, 30)) socialRow(item);
    // keep the whole dropdown inside the window at any width (it used to hang off the left edge in a narrow window)
    // right-aligned to the bell, width min(336px, viewport - 24px), 12px inset from the window edges
    const bounds = bell.getBoundingClientRect(), w = Math.min(336, innerWidth - 24), top = bounds.bottom + 4;
    panel.style.width = w + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    panel.style.left = Math.max(12, Math.min(bounds.right - w, innerWidth - w - 12)) + 'px';
    panel.style.maxHeight = Math.max(120, innerHeight - top - 8) + 'px';
  }

  function close() {
    panel.hidden = true;
    bell.setAttribute('aria-expanded', 'false');
  }

  function remove(name) {
    requests.delete(name.toLowerCase());
    refresh();
  }

  bell.onclick = event => {
    event.stopPropagation();
    if (!panel.hidden) return close();
    panel.hidden = false;
    bell.setAttribute('aria-expanded', 'true');
    refresh();
    markSocialRead();
    loadSocial();
  };
  document.addEventListener('click', event => { if (!panel.contains(event.target) && !bell.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { close(); bell.focus(); } });
  addEventListener('resize', refresh);
  refresh();
  loadSocial().finally(() => setTimeout(() => { ready = true; }, 3000));
  setInterval(() => { if (!document.hidden || !panel.hidden) loadSocial(); }, 60000);
  return {
    refresh,
    remove,
    loadSocial,
    add(request) { requests.set(request.name.toLowerCase(), request); refresh(); },
    reset(list) { requests.clear(); for (const request of list) requests.set(request.name.toLowerCase(), request); refresh(); }
  };
};
