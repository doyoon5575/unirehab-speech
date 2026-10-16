const CACHE_NAME = 'unirehab-public-v5';
// Never cache authentication, API traffic, reports, or patient records.
function isPublicAsset(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search) return false;
  return ['/', '/index.html', '/index.css', '/manifest.json'].includes(url.pathname)
    || /^\/src\/[a-zA-Z0-9_/-]+\.js$/.test(url.pathname)
    || /^\/audio\/[a-zA-Z0-9_-]+\.mp3$/.test(url.pathname);
}
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(['/', '/index.html', '/index.css', '/manifest.json'])));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('unirehab-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (!isPublicAsset(event.request)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic' && !/no-store|private/i.test(response.headers.get('Cache-Control') || '')) {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return (await cache.match(event.request)) || new Response('오프라인에서 사용할 수 없는 자료입니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
