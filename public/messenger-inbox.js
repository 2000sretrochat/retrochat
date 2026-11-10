/* Shared notification bell for browser, desktop, and Social Messenger. */
window.createMessengerInbox = function ({ respond, openMessage }) {
  const requests = new Map();
  const bell = document.createElement('button');
  bell.type = 'button';
  bell.className = 'messenger-bell';
  bell.setAttribute('aria-label', 'Notifications');
  bell.setAttribute('aria-expanded', 'false');
  bell.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Zm4 11a2 2 0 0 0 4 0"/></svg>';
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
    const d = document.createElement('div'); d.append(b); panel.append(d);
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

  function section(title) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    panel.append(heading);
  }

  function refresh() {
    const pending = Object.values(window.pmHeld || {}).filter(messages => messages.length);
    const count = requests.size + pending.reduce((total, messages) => total + messages.length, 0) + social.filter(n => !n.seen).length;
    // unread PMs already have their own IM sound, so they only shake the bell; requests/Social also chime
    const quiet = count - requests.size - social.filter(n => !n.seen).length;
    if (count > lastCount) newArrival(count - quiet > lastCount - lastQuiet);
    lastCount = count; lastQuiet = quiet;
    bell.classList.toggle('has-unread', !!count);
    badge.hidden = !count;
    badge.textContent = count;
    bell.setAttribute('aria-label', count ? 'Notifications, '+count+' unread' : 'Notifications');
    if (panel.hidden) return;
    panel.replaceChildren();
    section('Social');
    if (!social.length) row(socialLoaded ? 'No Social notifications' : 'Loading Social notifications...', []);
    for (const item of social.slice(0, 30)) socialRow(item);
    section('Contact requests');
    if (!requests.size) row('No pending requests', []);
    for (const request of requests.values()) {
      const reply = async accepted => {
        const result = await respond(request.name, accepted);
        if (result.error) { window.alert(result.error); return; }
        remove(request.name);
      };
      row(request.name+' wants to add you', [['Accept and add back', () => reply(true)], ['Decline', () => reply(false)]]);
    }
    section('Unread messages');
    if (!pending.length) row('No unread messages', []);
    for (const messages of pending) {
      const offline = messages.filter(message => message.receivedOffline).length;
      row(messages[0].from+' · '+messages.length+' unread'+(offline?' ('+offline+' offline)':''), [['Open', () => {
        close();
        openMessage(messages[0].from);
      }]]);
    }
    // keep the whole dropdown inside the window at any width (it used to hang off the left edge in a narrow window)
    const bounds = bell.getBoundingClientRect(), w = Math.min(panel.offsetWidth || 290, innerWidth - 16), top = bounds.bottom + 4;
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    panel.style.left = Math.max(8, Math.min(bounds.right - w, innerWidth - w - 8)) + 'px';
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
