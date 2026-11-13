// While the desktop app is signed in to the same account, this browser Messenger is "parked": it stays connected
// but is grayed out with a centered notice card, and the app takes priority (calls ring there). It wakes up when the app closes.
(function(){
  const CSS = `html.messenger-parked #mwin>*:not(.rz-parked),html.messenger-parked .im{filter:grayscale(1);opacity:.45;pointer-events:none;user-select:none}
.rz-parked{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100000;box-sizing:border-box;width:min(272px,calc(100% - 28px));
padding:20px 18px 18px;border-radius:12px;background:var(--card,#fff);color:var(--ink,#132849);border:1px solid var(--line,#C6D5E7);
box-shadow:0 10px 28px rgba(0,32,91,.22);text-align:center;font-family:Tahoma,'Segoe UI',Verdana,sans-serif;display:flex;flex-direction:column;align-items:center;gap:8px}
body>.rz-parked{position:fixed}
.rz-parked .rz-parked-icon{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:#e8f1fb;color:#0033A0}
.rz-parked .rz-parked-icon svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.rz-parked strong{display:block;font-size:15px;line-height:1.3;font-weight:700;color:inherit}
.rz-parked span{display:block;font-size:12px;line-height:1.45;color:var(--muted,#5b6f8c);max-width:24ch}
html.dark .rz-parked .rz-parked-icon{background:rgba(255,255,255,.08);color:#9cc4ff}`;
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>';
  let note = null;
  function show(on) {
    const doc = document, html = doc.documentElement;
    if (!doc.getElementById('rz-parked-style')) { const st = doc.createElement('style'); st.id = 'rz-parked-style'; st.textContent = CSS; doc.head.appendChild(st); }
    html.classList.toggle('messenger-parked', !!on);
    if (on) {
      if (!note) {
        note = doc.createElement('div'); note.className = 'rz-parked'; note.setAttribute('role', 'status');
        note.innerHTML = '<div class="rz-parked-icon">' + ICON + '</div><strong>Open in the Razzle app</strong><span>This window will reconnect when you close the app.</span>';
      }
      // Centered over the Messenger panel (web and the Social dock); falls back to the page if there is no panel.
      const host = doc.getElementById('mwin') || doc.body;
      if (note.parentNode !== host) host.appendChild(note);
    } else if (note) { note.remove(); note = null; }
  }
  function bind(socket) {
    if (!socket || socket._rzParked) return; socket._rzParked = true;
    socket.on('m:parked', d => show(!!(d && d.on)));
    socket.on('disconnect', () => show(false));
  }
  window.RazzleParked = { bind, show };
})();
