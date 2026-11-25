const CACHE_NAME = 'asbuilt-mobiliario-v2.4.0';
const ASSETS = [
  './',
  './index.html?v=2.4.0',
  './styles.css?v=2.4.0',
  './manifest.json',
  './js/geometry.js?v=2.4.0',
  './js/dxf_template_data.js?v=2.4.0',
  './js/exporter_dxf.js?v=2.4.0',
  './js/exporter_pdf.js?v=2.4.0',
  './js/app.js?v=2.4.0',
  './js/test_suite_boceto.js?v=2.4.0'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ESTRATEGIA NETWORK-FIRST: Siempre solicita la versión más reciente del servidor
// Si no hay conexión o falla la red, utiliza la copia local en caché.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
