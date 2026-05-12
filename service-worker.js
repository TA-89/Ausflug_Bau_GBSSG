/* Service Worker für die PWA — macht die Seite offline-fähig.
   Cachet beim ersten Besuch alle wichtigen Dateien.
   Bei Updates: Cache-Name (CACHE_VERSION) erhöhen, dann lädt der Service Worker neu. */

const CACHE_VERSION = 'gbs-reise-v1';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './programm.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './assets/gbs-logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Installation: alle wichtigen Dateien cachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(FILES_TO_CACHE).catch(() => {
        // Falls einzelne Dateien (z.B. externe CDN) nicht erreichbar sind: trotzdem installieren
        return Promise.resolve();
      }))
      .then(() => self.skipWaiting())
  );
});

// Aktivierung: alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Cache-First-Strategie — wenn im Cache, von dort; sonst Netzwerk
self.addEventListener('fetch', (event) => {
  // Nur GET-Requests cachen
  if (event.request.method !== 'GET') return;

  // Karten-Tiles nicht cachen (sonst wird der Speicher voll)
  const url = event.request.url;
  if (url.includes('basemaps.cartocdn.com') || url.includes('tile.openstreetmap.org')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Erfolgreiche Antworten in den Cache legen
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline und kein Cache — zur Hauptseite zurückfallen
        return caches.match('./index.html');
      });
    })
  );
});
