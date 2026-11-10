// Razzle homepage link (Messenger footer logo). One constant: switch to 'https://razzlesocial.com/' once that domain is live.
window.RAZZLE_HOME_URL = 'https://retrochat-izzg.onrender.com/';
(function () {
  const sync = () => document.querySelectorAll('a[data-home-link]').forEach(a => { a.href = window.RAZZLE_HOME_URL; });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', sync) : sync();
  // Desktop app: open in the default browser (not inside the app). Browser: new tab, noopener.
  document.addEventListener('click', e => {
    const a = e.target && e.target.closest && e.target.closest('a[data-home-link]'); if (!a) return;
    e.preventDefault();
    const D = window.YappDesktop;
    if (D && typeof D.openExternal === 'function') D.openExternal(window.RAZZLE_HOME_URL);
    else window.open(window.RAZZLE_HOME_URL, '_blank', 'noopener');
  });
})();
