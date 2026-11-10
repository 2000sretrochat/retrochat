// Razzle Social Chat service worker: network-first for pages/static, never touches socket.io or /api
const C = 'razzle-chat-v2';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || /^\/(socket\.io|api|social-next)\//.test(u.pathname) || u.pathname.startsWith('/avatar/')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && r.type === 'basic' && !/\b(?:private|no-store)\b/i.test(r.headers.get('Cache-Control') || '')) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('/')))); });
