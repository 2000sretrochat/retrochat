(() => {
  const message = 'Waking up Razzle… This can take up to a minute.';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function getJSON(url, status) {
    const deadline = Date.now() + 75000;
    const original = status?.textContent;
    let waking = false;
    const showWake = () => {
      waking = true;
      if (status) status.textContent = message;
    };
    const timer = setTimeout(showWake, 1500);
    try {
      do {
        try {
          const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(8000)});
          if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            return await response.json();
          }
          if (!response.ok && response.status < 500 && response.status !== 429) {
            throw Object.assign(new Error('Session unavailable'), {permanent: true});
          }
        } catch (error) {
          if (error.permanent) throw error;
        }
        showWake();
        if (Date.now() >= deadline) break;
        await wait(2000);
      } while (Date.now() < deadline);
      throw new Error('Razzle is taking longer than expected. Refresh to try again.');
    } finally {
      clearTimeout(timer);
      if (waking && status) status.textContent = original;
    }
  }

  function recoverSocket() {
    const status = document.getElementById('room-popout-status')?.hidden === false
      ? document.getElementById('room-popout-status')
      : document.getElementById('room-session-status') || document.getElementById('eIn');
    if (status) status.textContent = message;
    const retry = async () => {
      const deadline = Date.now() + 75000;
      while (Date.now() < deadline) {
        try {
          const response = await fetch('/socket.io/socket.io.js', {signal: AbortSignal.timeout(8000)});
          if (response.ok && /javascript/.test(response.headers.get('content-type') || '')) {
            location.reload();
            return;
          }
        } catch {}
        await wait(2000);
      }
      if (status) status.textContent = 'Razzle is taking longer than expected. Refresh to try again.';
    };
    retry();
  }

  window.RazzleStartup = {getJSON, message, recoverSocket};
})();
