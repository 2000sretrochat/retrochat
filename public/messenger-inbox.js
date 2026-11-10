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

  function section(title) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    panel.append(heading);
  }

  function refresh() {
    const pending = Object.values(window.pmHeld || {}).filter(messages => messages.length);
    const count = requests.size + pending.reduce((total, messages) => total + messages.length, 0);
    badge.hidden = !count;
    badge.textContent = count;
    bell.setAttribute('aria-label', count ? 'Notifications, '+count+' unread' : 'Notifications');
    if (panel.hidden) return;
    panel.replaceChildren();
    section('Contact requests');
    if (!requests.size) row('No pending requests', []);
    for (const request of requests.values()) {
      const reply = async accepted => {
        const result = await respond(request.name, accepted);
        if (result.error) { window.alert(result.error); return; }
        remove(request.name);
      };
      row(request.name+' wants to add you', [['Accept', () => reply(true)], ['Decline', () => reply(false)]]);
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
    const bounds = bell.getBoundingClientRect();
    panel.style.top = bounds.bottom+4+'px';
    panel.style.right = Math.max(8, innerWidth-bounds.right)+'px';
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
  };
  document.addEventListener('click', event => { if (!panel.contains(event.target) && !bell.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { close(); bell.focus(); } });
  addEventListener('resize', refresh);
  refresh();
  return {
    refresh,
    remove,
    add(request) { requests.set(request.name.toLowerCase(), request); refresh(); },
    reset(list) { requests.clear(); for (const request of list) requests.set(request.name.toLowerCase(), request); refresh(); }
  };
};
