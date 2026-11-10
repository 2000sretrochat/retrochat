// Razzle Messenger desktop app only: saved screen names on the sign-in screen.
// Does nothing in a normal browser or in older desktop builds without RazzleDesktop.signin.
(function () {
  const D = window.RazzleDesktop && window.RazzleDesktop.signin;
  const api = { active: false, signIn: null, note: () => {} };
  window.RazzleSignin = api;
  if (!D) return;
  const $ = id => document.getElementById(id);
  const MARK = '\u2022saved\u2022'; // placeholder in the password box; the real password stays in the app
  let names = [], canSave = false, savedFor = null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function css() {
    const st = document.createElement('style');
    st.textContent = `
.rzn-wrap{align-self:stretch;display:flex;position:relative;width:100%}
html.yd .rzn-wrap{max-width:320px;align-self:center}
.rzn-wrap #iName{flex:1;min-width:0;max-width:none!important;border-top-right-radius:0!important;border-bottom-right-radius:0!important}
.rzn-btn{flex:none;width:28px;padding:0!important;margin:0!important;border-left:0;border-top-left-radius:0!important;border-bottom-left-radius:0!important}
.rzn-list{display:none;position:absolute;left:0;right:0;top:100%;z-index:50;background:var(--card,#fff);color:var(--ink,#000);border:1px solid #7f9db9;box-shadow:2px 2px 5px rgba(0,0,0,.25);padding:2px 0;max-height:220px;overflow:auto;font-weight:normal}
.rzn-list.open{display:block}
.rzn-list div{padding:4px 10px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rzn-list div:hover,.rzn-list div.sel{background:var(--blue,#316ac5);color:#fff}
.rzn-list .rzn-pw{font-size:11px;opacity:.7;margin-left:6px}
.rzn-list hr{border:0;border-top:1px solid var(--line,#ccd);margin:2px 0}
.rzn-ov{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}
.rzn-box{background:var(--card,#fff);color:var(--ink,#000);border:1px solid #7f9db9;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.3);width:min(320px,calc(100% - 32px));padding:14px}
.rzn-box h3{margin:0 0 8px;font-size:14px}
.rzn-rows{max-height:50vh;overflow:auto;border:1px solid var(--line,#ccd);border-radius:4px}
.rzn-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--line,#eee)}
.rzn-row:last-child{border-bottom:0}.rzn-row span{flex:1;overflow:hidden;text-overflow:ellipsis}
.rzn-row button{flex:none;margin:0}
.rzn-empty{padding:10px;color:var(--muted,#667);text-align:center}
.rzn-done{display:flex;justify-content:flex-end;margin-top:10px}.rzn-done button{flex:none;margin:0}
/* design handoff Nov 10 (item 7): 36px screen-name control, 32px rows, Edit pinned under a divider, stacked checks */
.rzn-wrap{height:36px}
.rzn-wrap #iName{height:36px!important;min-height:36px!important;padding:0 8px!important;box-sizing:border-box}
.rzn-btn{width:32px;height:36px!important;min-height:36px!important;display:inline-grid!important;place-items:center;color:#00205B!important}
.rzn-btn svg{width:16px;height:16px}
.rzn-list{border:1px solid #9DB3CC;border-radius:4px;box-shadow:0 3px 6px #00205b1a;padding:4px;max-height:none;overflow:visible;margin-top:2px;font:13px/1.4 Tahoma,'Segoe UI',sans-serif}
.rzn-list.open{display:flex;flex-direction:column}
.rzn-opts{max-height:192px;overflow:auto}
.rzn-list div[data-n],.rzn-list .rzn-edit,.rzn-list .rzn-empty{display:flex;align-items:center;gap:8px;min-height:32px;padding:4px 8px;border-radius:3px;color:#132849;box-sizing:border-box}
.rzn-list div[data-n]:hover,.rzn-list div.sel,.rzn-list .rzn-edit:hover{background:#DBEBFF;color:#132849}
.rzn-list .rzn-edit{border-top:1px solid #C6D5E7;border-radius:0 0 3px 3px;margin-top:4px}
.rzn-list .rzn-edit svg{width:16px;height:16px;flex:none}
.rzn-list .rzn-pw{margin-left:auto}
#fIn.rzn-on #iPw+.row{margin-top:12px}
#fIn.rzn-on .row{display:flex;flex-direction:column;gap:8px;margin-bottom:0}
#fIn.rzn-on .row+.row{margin-top:8px}
#fIn.rzn-on .row label{display:flex;align-items:center;gap:6px;min-height:20px;margin:0;cursor:pointer}
#fIn.rzn-on .row input[type=checkbox]{width:16px;height:16px;margin:0;accent-color:#0033A0;flex:none}
#fIn.rzn-on #bIn{margin-top:12px}
@media (pointer:coarse){#fIn.rzn-on .row label{min-height:44px}.rzn-list div[data-n],.rzn-list .rzn-edit{min-height:44px}}`;
    document.head.appendChild(st);
  }

  function build() {
    const name = $('iName'), pw = $('iPw'), rem = $('iRem');
    if (!name || !pw) return;
    css();
    const wrap = document.createElement('div'); wrap.className = 'rzn-wrap';
    name.parentNode.insertBefore(wrap, name); wrap.appendChild(name);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rzn-btn'; btn.id = 'iNameMore';
    btn.setAttribute('aria-label', 'Saved screen names'); btn.setAttribute('aria-haspopup', 'listbox');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 5 5 5-5"/></svg>';
    const form = $('fIn'); if (form) form.classList.add('rzn-on');
    const list = document.createElement('div'); list.className = 'rzn-list'; list.id = 'iNameList'; list.setAttribute('role', 'listbox');
    wrap.append(btn, list);
    // "Remember me" (30-day browser cookie) is replaced by "Save password" in the desktop app.
    const row = rem && rem.closest('.row');
    if (row) {
      rem.closest('label').style.display = 'none';
      row.insertAdjacentHTML('beforeend', '<label style="font-weight:normal"><input type="checkbox" id="iSave"> Save password</label>');
    }
    const save = $('iSave'), inv = $('iInv');
    if (save && !canSave) { save.disabled = true; save.parentNode.title = 'Password saving is not available on this computer.'; }

    const clearSaved = () => { if (savedFor) { savedFor = null; pw.value = ''; } };
    const fill = n => {
      const e = names.find(x => x.name.toLowerCase() === String(n).toLowerCase());
      name.value = e ? e.name : n;
      if (e && e.saved) { savedFor = e.name; pw.value = MARK; if (save) save.checked = true; }
      else { savedFor = null; pw.value = ''; if (save) save.checked = false; }
      if (inv) inv.checked = !!(e && e.invisible); // "Sign in as invisible" is remembered per screen name
    };
    const close = () => list.classList.remove('open');
    const render = () => {
      const cur = name.value.trim().toLowerCase();
      list.innerHTML = '<div class="rzn-opts">' + (names.map(e => `<div role="option" data-n="${esc(e.name)}"${e.name.toLowerCase() === cur ? ' class="sel" aria-selected="true"' : ''}>${esc(e.name)}${e.saved ? '<span class="rzn-pw">password saved</span>' : ''}</div>`).join('')
        || '<div class="rzn-empty" style="cursor:default">No saved screen names yet</div>') + '</div>'
        + '<div class="rzn-edit" data-edit="1" role="option"><svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 13 9-9 3 3-9 9-4 1zM11 6l3 3"/></svg><span>Edit</span></div>';
      btn.style.display = '';
    };
    btn.onclick = e => { e.preventDefault(); e.stopPropagation(); render(); list.classList.toggle('open'); };
    list.onclick = e => {
      const it = e.target.closest('div[data-n],div[data-edit]'); if (!it) return;
      close();
      if (it.dataset.edit) return editor();
      fill(it.dataset.n);
      (savedFor ? $('bIn') : pw).focus();
    };
    document.addEventListener('click', e => { if (!e.target.closest('.rzn-wrap')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    name.addEventListener('input', () => { if (savedFor && name.value.trim().toLowerCase() !== savedFor.toLowerCase()) { clearSaved(); if (save) save.checked = false; } });
    pw.addEventListener('focus', () => { if (savedFor) pw.select(); });
    pw.addEventListener('input', () => { savedFor = null; });

    function editor() {
      const ov = document.createElement('div'); ov.className = 'rzn-ov';
      ov.innerHTML = '<div class="rzn-box" role="dialog" aria-modal="true" aria-label="Edit saved screen names"><h3>Saved screen names</h3><div class="rzn-rows"></div><div class="rzn-done"><button type="button" class="pri">Done</button></div></div>';
      const rows = ov.querySelector('.rzn-rows');
      const draw = () => {
        rows.innerHTML = names.length ? names.map(e => `<div class="rzn-row"><span>${esc(e.name)}</span><button type="button" data-n="${esc(e.name)}">Remove</button></div>`).join('')
          : '<div class="rzn-empty">No saved screen names.</div>';
      };
      rows.onclick = async e => {
        const b = e.target.closest('button[data-n]'); if (!b) return;
        const n = b.dataset.n; b.disabled = true;
        await D.remove(n).catch(() => {});
        names = names.filter(x => x.name.toLowerCase() !== n.toLowerCase());
        if (name.value.trim().toLowerCase() === n.toLowerCase()) { clearSaved(); if (save) save.checked = false; }
        draw();
      };
      const done = () => { ov.remove(); name.focus(); };
      ov.querySelector('.rzn-done button').onclick = done;
      ov.addEventListener('click', e => { if (e.target === ov) done(); });
      ov.addEventListener('keydown', e => { if (e.key === 'Escape') done(); });
      draw(); document.body.appendChild(ov); ov.querySelector('.rzn-done button').focus();
    }

    api.signIn = async () => {
      const n = name.value.trim();
      const useSaved = savedFor && savedFor.toLowerCase() === n.toLowerCase() && pw.value === MARK;
      const r = await D.signIn({ name: n, password: useSaved ? null : pw.value, save: !!(save && save.checked), invisible: !!(inv && inv.checked) }).catch(() => ({ error: 'Sign-in failed.' }));
      if (r && r.ok) { savedFor = null; refresh(); }
      return r || { error: 'Sign-in failed.' };
    };
    api.note = n => { D.note(n).then(refresh).catch(() => {}); };
    api.active = true;
    if (names[0] && !name.value) fill(names[0].name);
  }
  async function refresh() { try { const r = await D.list(); names = r.names || []; canSave = !!r.canSave; } catch {} }
  const go = async () => { await refresh(); build(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
