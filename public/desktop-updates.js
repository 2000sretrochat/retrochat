// Razzle Messenger desktop app only: Help > Check for Updates, with a yellow "!" when an update is waiting.
// Does nothing in a browser or in older desktop builds without RazzleDesktop.updates.
(function () {
  const U = window.RazzleDesktop && window.RazzleDesktop.updates;
  if (!U) return;
  const ready = st => st && (st.status === 'downloading' || st.status === 'downloaded');
  // design handoff Nov 10 (item 8): alert.svg, 14px, on the trailing edge of the label, 8px from the text
  const dot = '<span class="rz-upd-dot" role="img" aria-label="Update available" style="display:none;margin-left:8px;width:14px;height:14px;vertical-align:-2px;line-height:0"><svg class="rz-upd-ico" width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path fill="#FFE066" stroke="#A87800" d="M9 2.5a1.15 1.15 0 0 1 2 0l7 12.8A1.15 1.15 0 0 1 17 17H3a1.15 1.15 0 0 1-1-1.7Z"/><path stroke="#442E00" d="M10 7v4.2"/><circle cx="10" cy="13.8" r=".8" fill="#442E00" stroke="none"/></svg></span>';
  function build() {
    const about = document.getElementById('mAbout'); if (!about) return;
    const dd = about.parentNode, help = dd.parentNode;
    const item = document.createElement('div'); item.id = 'mUpd';
    item.innerHTML = '<span class="rz-upd-txt">Check for Updates</span>' + dot;
    item.style.display = 'flex'; item.style.alignItems = 'center';
    dd.insertBefore(item, about);
    help.insertBefore(document.createRange().createContextualFragment(dot), dd);
    item.onclick = () => { U.check(); };
    const paint = st => {
      const show = ready(st);
      document.querySelectorAll('.rz-upd-dot').forEach(d => { d.style.display = show ? 'inline-block' : 'none'; });
      // the label stays "Check for Updates"; the state is in the alert icon and the tooltip
      item.querySelector('.rz-upd-txt').textContent = 'Check for Updates';
      const state = st && st.status === 'downloaded' ? 'Update ready to install (' + st.version + ')'
        : st && st.status === 'downloading' ? 'An update is downloading (' + (st.percent || 0) + '%)'
        : st && st.status === 'checking' ? 'Checking for updates…' : '';
      item.title = [state, st && st.current ? 'Installed: ' + st.current + ' (Beta)' : ''].filter(Boolean).join(' · ');
    };
    U.onState(paint);
    U.state().then(paint).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
