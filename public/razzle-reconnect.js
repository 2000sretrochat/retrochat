(() => {
  const key = 'razzle-logout-pending';
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const pending = () => localStorage.getItem(key) !== null;
  let logoutRequest;

  async function finishLogout() {
    const run = async () => {
      while (pending()) {
        try {
          const response = await fetch('/api/logout', {
            method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(8000)
          });
          if (response.ok && (await response.json()).ok) {
            localStorage.removeItem(key);
            return;
          }
        } catch {}
        await delay(2500);
      }
    };
    return logoutRequest ||= (navigator.locks ? navigator.locks.request(key, run) : run())
      .finally(() => { logoutRequest = null; });
  }

  function onLogout(callback) {
    addEventListener('storage', event => {
      if (event.key === key && event.newValue !== null) callback();
    });
  }

  function indicator(parent, {exit} = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'rz-reconnect-overlay';
    overlay.hidden = true;
    overlay.innerHTML = '<span class="rz-reconnect-spinner" aria-hidden="true"></span>';
    parent.append(overlay);
    let badge, dialog, label;
    if (exit) {
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'rz-reconnect-badge';
      badge.hidden = true;
      badge.textContent = 'Reconnecting…';
      dialog = document.createElement('dialog');
      dialog.className = 'rz-reconnect-dialog';
      dialog.setAttribute('aria-labelledby', 'rz-reconnect-title');
      dialog.innerHTML = `<form method="dialog">
        <button class="rz-reconnect-close" aria-label="Close reconnect prompt" value="continue">×</button>
        <div class="rz-reconnect-heading"><span class="rz-reconnect-spinner" aria-hidden="true"></span>
        <strong id="rz-reconnect-title">Reconnecting…</strong></div>
        <p role="status">Razzle will refresh your contacts when the connection returns.</p>
        <div class="rz-reconnect-actions"><button value="continue" autofocus>Continue</button>
        <button type="button" data-exit>Exit</button></div>
      </form>`;
      label = dialog.querySelector('p');
      badge.onclick = () => { if (!dialog.open) dialog.showModal(); };
      dialog.querySelector('[data-exit]').onclick = exit;
      document.body.append(badge, dialog);
    } else {
      label = document.createElement('span');
      label.setAttribute('role', 'status');
      label.textContent = 'Reconnecting…';
      overlay.append(label);
    }

    const blocked = new Set();
    function show(message) {
      const first = overlay.hidden;
      overlay.hidden = false;
      if (first) for (const child of parent.children) {
        if (child !== overlay && !child.inert) {
          child.inert = true;
          blocked.add(child);
        }
      }
      if (badge) badge.hidden = false;
      if (message) label.textContent = message;
      if (first && dialog) dialog.showModal();
    }

    function clear() {
      overlay.hidden = true;
      for (const child of blocked) child.inert = false;
      blocked.clear();
      if (dialog?.open) dialog.close();
      if (badge) {
        badge.hidden = true;
        label.textContent = 'Razzle will refresh your contacts when the connection returns.';
      } else label.textContent = 'Reconnecting…';
    }
    return {show, clear};
  }

  window.RazzleReconnect = {
    indicator, onLogout, pending,
    finishLogout,
    requestLogout() { localStorage.setItem(key, '1'); return finishLogout(); }
  };
})();
