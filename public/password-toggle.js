// Show/hide button inside every password field (Messenger sign-in and sign-up, website sign-in, password reset).
// The field keeps its own size and spacing: it is wrapped in a full-width box and the eye sits inside its right edge.
(() => {
  if (window.RazzlePasswordToggle) return;
  const SAVED = '\u2022saved\u2022'; // desktop app placeholder for a saved password (the real one never reaches the page)
  const eye = open => open
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const style = document.createElement('style');
  style.textContent = `
.pw-field{position:relative;display:block;align-self:stretch;width:100%;margin:0;padding:0}
.pw-field>input{width:100%!important;padding-right:32px!important;box-sizing:border-box}
.pw-field>.pw-eye{position:absolute;top:50%;right:3px;transform:translateY(-50%);display:inline-grid;place-items:center;width:26px;height:26px;min-width:0!important;min-height:0!important;padding:0!important;margin:0!important;border:0!important;border-radius:3px!important;background:transparent!important;box-shadow:none!important;color:#536e8a;cursor:pointer;line-height:0}
.pw-field>.pw-eye:hover{color:#00205b}
.pw-field>.pw-eye:focus-visible{outline:2px solid #397cba;outline-offset:-2px}
.pw-field>.pw-eye[hidden]{display:none}
html.dark .pw-field>.pw-eye{color:#b8c6dc}html.dark .pw-field>.pw-eye:hover{color:#fff}
#mwin #fIn>.pw-field{max-width:320px;align-self:center}
#fIn.rzn-on .pw-field+.row{margin-top:12px}`;
  document.head.append(style);

  const hiders = [];
  function enhance(input) {
    if (input.dataset.pwToggle || !input.parentNode) return;
    input.dataset.pwToggle = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pw-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.append(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-eye';
    const set = shown => {
      input.type = shown ? 'text' : 'password';
      btn.innerHTML = eye(shown);
      btn.setAttribute('aria-pressed', String(shown));
      btn.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
      btn.title = shown ? 'Hide password' : 'Show password';
    };
    const sync = () => { btn.hidden = input.value === SAVED; if (btn.hidden && input.type !== 'password') set(false); };
    set(false);
    btn.addEventListener('mousedown', event => event.preventDefault()); // keep focus (and the caret) in the field
    btn.addEventListener('click', () => { if (input.value === SAVED) return; set(input.type === 'password'); input.focus(); });
    for (const event of ['input', 'focus', 'change']) input.addEventListener(event, sync);
    input.form?.addEventListener('submit', () => set(false));
    hiders.push(() => set(false));
    wrap.append(btn);
    sync();
  }
  const scan = root => root.querySelectorAll?.('input[type=password]:not([data-pw-toggle])').forEach(enhance);
  const start = () => {
    scan(document);
    new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) { if (n.matches('input[type=password]')) enhance(n); else scan(n); } })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  // Pages call hide() after signing in or out so a shown password never stays visible for the next person.
  window.RazzlePasswordToggle = { enhance, hide: () => hiders.forEach(hide => hide()) };
})();
