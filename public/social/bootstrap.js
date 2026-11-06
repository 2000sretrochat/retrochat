(async () => {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new Error('Account service unavailable');
    const me = await res.json();
    if (!me || !me.name) {
      // Real cookie auth on this origin — do not load Guest/demo Social.
      const next = '/?chat=1&social=1';
      location.replace(next);
      return;
    }
    window.currentAlias = me.name;
    window.LIVE_AUTH = true;
    window.MASTER = !!me.m;
    const script = document.createElement('script');
    script.src = '/social/social-preview.js';
    script.onload = () => {
      const adapter = document.createElement('script');
      adapter.src = '/social/live.js';
      adapter.onerror = () => { document.getElementById('content').textContent = 'Messenger integration could not load. Please refresh.'; };
      document.body.append(adapter);
    };
    script.onerror = () => { document.getElementById('content').textContent = 'Social could not load. Please refresh.'; };
    document.body.append(script);
  } catch {
    document.getElementById('content').textContent = 'Could not check your account. Please refresh when the connection is back.';
  }
})();
