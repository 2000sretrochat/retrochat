/* Master Console button in the Messenger window, right of the notification bell (browser, desktop app, Social Messenger).
   Only created after /api/me reports the signed-in account is a master (server reads users.is_master from the database).
   The console itself (/master, /api/master/*) re-checks is_master on every request and answers 404 to everyone else,
   so hiding the button is presentation only, never the authorization. No room is needed: the console's Rooms tab
   lists every room and its per-room actions take the room name explicitly. */
window.createMessengerMasterButton = function ({ open } = {}) {
  const menu = document.querySelector('#menu');
  if (!menu || document.querySelector('#menu .messenger-master')) return document.querySelector('#menu .messenger-master');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'messenger-master';
  btn.id = 'bMaster';
  btn.setAttribute('aria-label', 'Master Console');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.title = 'Master Console (masters only)';
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8 3.2 4.4v4.9c0 4.2 2.8 7.6 6.8 8.9 4-1.3 6.8-4.7 6.8-8.9V4.4L10 1.8Z" fill="#F2B21B" stroke="#8A5A00" stroke-width="1.2" stroke-linejoin="round"/><path d="m10 5.6 1.2 2.5 2.7.4-2 1.9.5 2.7L10 11.8l-2.4 1.3.5-2.7-2-1.9 2.7-.4L10 5.6Z" fill="#00205B"/></svg><span class="mm-l">Master</span>';
  btn.addEventListener('click', () => { (open || (() => window.openMasterConsole && window.openMasterConsole()))(); });
  const place = () => { const bell = menu.querySelector('.messenger-bell'); if (bell) bell.after(btn); else menu.append(btn); };
  place();
  // the bell may be created after the master check resolves: keep the button immediately to its right
  if (!menu.querySelector('.messenger-bell') && typeof MutationObserver === 'function') {
    const mo = new MutationObserver(() => { if (menu.querySelector('.messenger-bell')) { place(); mo.disconnect(); } });
    mo.observe(menu, { childList: true });
  }
  if(window.RazzleMasterReports)window.RazzleMasterReports.watch(btn);
  return btn;
};
