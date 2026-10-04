const CACHE_NAME = 'unirehab-cache-v2.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.css',
  '/manifest.json',
  '/src/main.js',
  '/src/store.js',
  '/src/utils/icons.js',
  '/src/utils/helpers.js',
  '/src/data/taskBank.js',
  '/src/agents/taskAgent.js',
  '/src/agents/cueAgent.js',
  '/src/agents/evalAgent.js',
  '/src/agents/adaptiveAgent.js',
  '/src/agents/speechAgent.js',
  '/src/agents/reportAgent.js',
  '/src/agents/insightAgent.js',
  '/src/agents/sessionOrchestrator.js',
  '/src/components/Header.js',
  '/src/components/ClinicianView.js',
  '/src/components/PatientView.js',
  '/src/components/ReportView.js',
  '/src/components/SettingsModal.js',
  '/src/components/ExternalAccessModal.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('PWA Asset caching warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
