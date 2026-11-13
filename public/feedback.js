// Help > Feedback (Nov 13, 2026): a centered modal on every Messenger, chat room and Social page. Posts to /api/feedback,
// which stores the note and emails it to the Razzle team. Open it from #mFeedback or any [data-feedback] link.
(function () {
  if (window.RazzleFeedback) return;
  const CATS = [['suggestion', 'Suggestion'], ['broken', 'Something\u2019s not working'], ['other', 'Other']];
  const appInfo = () => {
    const m = /RazzleMessenger\/([\d.]+)/i.exec(navigator.userAgent || '');
    return window.YappDesktop?.isDesktop ? 'Desktop app ' + (m ? m[1] : '') : 'Web';
  };
  const css = `.rz-fb-back{position:fixed;inset:0;z-index:100050;background:rgba(10,30,60,.35);display:grid;place-items:center;padding:12px}
.rz-fb{box-sizing:border-box;width:min(440px,100%);max-height:calc(100vh - 24px);overflow:auto;background:var(--card,#fff);color:var(--ink,#13294b);border:1px solid var(--line,#c6d5e7);border-radius:12px;box-shadow:0 14px 40px rgba(0,32,91,.28);font:13px/1.45 Tahoma,'Segoe UI',Verdana,sans-serif}
.rz-fb-h{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(#005b9e,#003b79);color:#fff;font-weight:700;border-radius:11px 11px 0 0}
.rz-fb-h span{flex:1}.rz-fb-x{all:unset;cursor:pointer;width:26px;height:26px;display:grid;place-items:center;border-radius:6px;font-size:18px}.rz-fb-x:hover,.rz-fb-x:focus-visible{background:#ffffff26}
.rz-fb-b{padding:14px 16px 16px;display:grid;gap:10px}.rz-fb-b p{margin:0}.rz-fb label{display:grid;gap:4px;font-weight:600}
.rz-fb select,.rz-fb textarea{font:inherit;font-weight:400;color:inherit;background:var(--field,#fff);border:1px solid var(--line,#c6d5e7);border-radius:6px;padding:7px 9px;box-sizing:border-box;width:100%}
.rz-fb textarea{min-height:120px;resize:vertical}.rz-fb-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.rz-fb-count{color:var(--muted,#5b6f8c);font-size:12px}.rz-fb-err{color:#b3261e;min-height:1em}
.rz-fb-send{font:600 13px Tahoma,'Segoe UI',sans-serif;border:0;border-radius:6px;padding:8px 18px;cursor:pointer;background:linear-gradient(#2a86ef,#0033A0);color:#fff}.rz-fb-send:disabled{opacity:.6;cursor:default}
.rz-fb-done{text-align:center;padding:10px 0 4px}.rz-fb-done strong{display:block;font-size:15px;margin-bottom:4px}`;
  function open() {
    if (document.querySelector('.rz-fb-back')) return document.querySelector('.rz-fb textarea')?.focus();
    if (!document.getElementById('rz-fb-style')) { const s = document.createElement('style'); s.id = 'rz-fb-style'; s.textContent = css; document.head.appendChild(s); }
    const back = document.createElement('div'); back.className = 'rz-fb-back';
    back.innerHTML = `<div class="rz-fb" role="dialog" aria-modal="true" aria-labelledby="rz-fb-t"><div class="rz-fb-h"><span id="rz-fb-t">Feedback</span><button type="button" class="rz-fb-x" aria-label="Close">\u00d7</button></div>
<form class="rz-fb-b"><p>If you have any suggestions to make Razzle better, or notice something isn't working, write us. We appreciate your feedback!</p>
<label>Category<select name="category">${CATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
<label>Message<textarea name="message" minlength="10" maxlength="2000" required placeholder="Tell us what you think or what went wrong\u2026"></textarea></label>
<div class="rz-fb-row"><span class="rz-fb-count">0 / 2000</span><button type="submit" class="rz-fb-send">Send</button></div><p class="rz-fb-err" role="alert"></p></form></div>`;
    const form = back.querySelector('form'), ta = form.message, count = back.querySelector('.rz-fb-count'), err = back.querySelector('.rz-fb-err'), send = back.querySelector('.rz-fb-send');
    const close = () => { back.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc, true);
    back.querySelector('.rz-fb-x').onclick = close;
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    ta.oninput = () => { count.textContent = ta.value.length + ' / 2000'; err.textContent = ''; };
    form.onsubmit = async e => {
      e.preventDefault();
      const message = ta.value.trim();
      if (message.length < 10) { err.textContent = 'Please write at least 10 characters.'; return; }
      send.disabled = true; send.textContent = 'Sending\u2026';
      try {
        const r = await fetch('/api/feedback', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: form.category.value, message, page: location.pathname, app: appInfo() }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw Error(j.error || 'Could not send your feedback. Please try again.');
        form.innerHTML = '<div class="rz-fb-done"><strong>Thank you!</strong>Your feedback was sent to the Razzle team. We read every note.</div><div class="rz-fb-row" style="justify-content:flex-end"><button type="button" class="rz-fb-send">Close</button></div>';
        form.querySelector('button').onclick = close; form.querySelector('button').focus();
      } catch (x) { err.textContent = x.message; send.disabled = false; send.textContent = 'Send'; }
    };
    document.body.appendChild(back);
    ta.focus();
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('#mFeedback,[data-feedback]'); if (!t) return;
    e.preventDefault(); document.querySelectorAll('#menu>div.open').forEach(x => x.classList.remove('open')); open();
  }, true);
  window.RazzleFeedback = { open };
})();
