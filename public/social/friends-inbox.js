// Same-origin Social: show durable Messenger contact-request inbox (Accept/Decline).
(function () {
  const LIVE = '';
  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (html != null) n.innerHTML = html;
    return n;
  }
  async function load() {
    try {
      const r = await fetch('/api/friends/requests', { credentials: 'same-origin', cache: 'no-store' });
      if (r.status === 401) return;
      if (!r.ok) return;
      const data = await r.json();
      render(data.incoming || []);
    } catch {}
  }
  function render(incoming) {
    let host = document.getElementById('friends-inbox');
    if (!host) {
      host = el('div', { id: 'friends-inbox', class: 'friends-inbox' });
      const header = document.querySelector('header') || document.body;
      header.appendChild(host);
    }
    if (!incoming.length) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = '<button type="button" class="fi-toggle">Requests <span class="fi-badge">' + incoming.length + '</span></button>' +
      '<div class="fi-drop" hidden>' + incoming.map(r =>
        '<div class="fi-row" data-n="' + r.name.replace(/"/g, '&quot;') + '"><b>' + r.name + '</b> wants to add you' +
        '<div class="fi-acts"><button data-y="1">Accept</button><button data-y="0">Decline</button></div></div>'
      ).join('') + '</div>';
    const drop = host.querySelector('.fi-drop');
    host.querySelector('.fi-toggle').onclick = () => { drop.hidden = !drop.hidden; };
    host.querySelectorAll('.fi-acts button').forEach(b => b.onclick = async () => {
      const row = b.closest('.fi-row'); const name = row?.dataset.n; if (!name) return;
      const res = await fetch('/api/friends/respond', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, accept: b.dataset.y === '1' }) });
      const j = await res.json().catch(() => ({}));
      if (j.error) alert(j.error); else load();
    });
  }
  if (!document.getElementById('friends-inbox-css')) {
    const s = el('style', { id: 'friends-inbox-css' });
    s.textContent = '#friends-inbox{position:fixed;top:12px;right:12px;z-index:40;font:650 13px system-ui,Segoe UI,Arial}' +
      '.fi-toggle{background:#004990;color:#fff;border:0;border-radius:999px;padding:8px 12px;cursor:pointer}' +
      '.fi-badge{background:#e0245e;border-radius:999px;padding:1px 6px;margin-left:4px;font-size:11px}' +
      '.fi-drop{margin-top:8px;background:#fff;border:1px solid #c9daf0;border-radius:12px;padding:8px;min-width:240px;box-shadow:0 8px 24px #00387622}' +
      '.fi-row{padding:8px;border-radius:8px;background:#fff8ec;border:1px solid #f3d7a5;margin-bottom:6px;font-size:12px;color:#003876}' +
      '.fi-row b{color:#004990}.fi-acts{display:flex;gap:6px;margin-top:6px}' +
      '.fi-acts button{flex:1;min-height:28px;border-radius:8px;border:1px solid #c9daf0;background:#fff;cursor:pointer}' +
      '.fi-acts button[data-y="1"]{background:#004990;border-color:#004990;color:#fff}';
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
  setInterval(load, 60000);
})();
