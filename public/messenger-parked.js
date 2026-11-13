// While the desktop app is signed in to the same account, this browser Messenger is "parked": it stays connected
// but is grayed out with a quiet notice, and the app takes priority (calls ring there). It wakes up when the app closes.
(function(){
  const CSS = `html.messenger-parked #mwin>*:not(.rz-parked),html.messenger-parked .im{filter:grayscale(1);opacity:.5;pointer-events:none;user-select:none}
.rz-parked{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:100000;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);box-sizing:border-box;
padding:8px 14px;border-radius:999px;background:var(--card,#fff);color:var(--ink,#132849);border:1px solid var(--line,#C6D5E7);box-shadow:0 4px 14px rgba(0,32,91,.12);
font:13px/1.35 Tahoma,'Segoe UI',sans-serif;letter-spacing:.01em}
.rz-parked .dot{width:8px;height:8px;border-radius:50%;background:#0033A0;flex:none;opacity:.8}
.rz-parked small{color:var(--muted,#5b6f8c);font-size:12px}`;
  let note = null;
  function show(on, text) {
    const doc = document, html = doc.documentElement;
    if (!doc.getElementById('rz-parked-style')) { const st = doc.createElement('style'); st.id = 'rz-parked-style'; st.textContent = CSS; doc.head.appendChild(st); }
    html.classList.toggle('messenger-parked', !!on);
    if (on) {
      if (!note) { note = doc.createElement('div'); note.className = 'rz-parked'; note.setAttribute('role', 'status'); doc.body.appendChild(note); }
      note.innerHTML = '<span class=dot aria-hidden=true></span><span></span>';
      note.lastChild.textContent = text || 'Razzle Messenger is open in the app';
      const sub = doc.createElement('small'); sub.textContent = '· this window wakes up when the app closes'; note.appendChild(sub);
    } else if (note) { note.remove(); note = null; }
  }
  function bind(socket) {
    if (!socket || socket._rzParked) return; socket._rzParked = true;
    socket.on('m:parked', d => show(!!(d && d.on), d && d.text));
    socket.on('disconnect', () => show(false));
  }
  window.RazzleParked = { bind, show };
})();
