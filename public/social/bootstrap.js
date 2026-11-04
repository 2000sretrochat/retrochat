(async () => {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new Error('Account service unavailable');
    const me = await res.json(); window.currentAlias = me.name || 'Guest';
    const script = document.createElement('script'); script.src = '/social/social-preview.js';
    script.onload = () => { const adapter = document.createElement('script'); adapter.src = '/social/live.js'; adapter.onerror = () => { document.getElementById('content').textContent = 'Messenger integration could not load. Please refresh.'; }; document.body.append(adapter); };
    script.onerror = () => { document.getElementById('content').textContent = 'Social could not load. Please refresh.'; };
    document.body.append(script);
  } catch {
    document.getElementById('content').textContent = 'Could not check your account. Please refresh when the connection is back.';
  }
})();
