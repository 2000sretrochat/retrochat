// Razzle Messenger desktop app only: Help > Check for Updates, with a yellow "!" when an update is waiting.
// Does nothing in a browser or in older desktop builds without RazzleDesktop.updates.
(function () {
  const U = window.RazzleDesktop && window.RazzleDesktop.updates;
  if (!U) return;
  const ready = st => st && (st.status === 'downloading' || st.status === 'downloaded');
  const dot = '<span class="rz-upd-dot" aria-label="Update available" style="display:none;margin-left:6px;padding:0 5px;border-radius:7px;background:#ffd400;color:#000;font-weight:bold;font-size:11px;line-height:14px">!</span>';
  function build() {
    const about = document.getElementById('mAbout'); if (!about) return;
    const dd = about.parentNode, help = dd.parentNode;
    const item = document.createElement('div'); item.id = 'mUpd';
    item.innerHTML = '<span class="rz-upd-txt">Check for Updates</span>' + dot;
    dd.insertBefore(item, about);
    help.insertBefore(document.createRange().createContextualFragment(dot), dd);
    item.onclick = () => { U.check(); };
    const paint = st => {
      const show = ready(st);
      document.querySelectorAll('.rz-upd-dot').forEach(d => { d.style.display = show ? 'inline-block' : 'none'; });
      item.querySelector('.rz-upd-txt').textContent = st && st.status === 'downloaded' ? 'Restart to Update (' + st.version + ')'
        : st && st.status === 'downloading' ? 'Downloading Update... ' + (st.percent || 0) + '%'
        : 'Check for Updates';
      item.title = st && st.current ? 'Installed: ' + st.current + ' (Beta)' : '';
    };
    U.onState(paint);
    U.state().then(paint).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
