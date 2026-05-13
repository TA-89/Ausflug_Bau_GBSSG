/* =========================================================
   GBS Reise · Service Worker
   ---------------------------------------------------------
   WICHTIG: Bei jeder Änderung an HTML/CSS/JS oder Inhalten
   den CACHE_VERSION-Wert unten erhöhen (z.B. v1 → v2 → v3).
   Das löst automatisch ein Update bei allen Nutzern aus.
   ========================================================= */

const CACHE_VERSION = 'gbs-reise-v10';

// Diese Dateien werden bei der Installation gecacht (Offline-Basis)
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
  './assets/apple-touch-icon.png'
];

// =========================
// INSTALL
// =========================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(FILES_TO_CACHE).catch(() => Promise.resolve()))
      .then(() => self.skipWaiting()) // sofort aktivieren, nicht warten
  );
});

// =========================
// ACTIVATE — alte Caches löschen
// =========================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// =========================
// FETCH — Strategie je nach Dateityp
// =========================
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Karten-Tiles nicht cachen (würde sonst den Speicher fluten)
  if (url.includes('basemaps.cartocdn.com') || url.includes('tile.openstreetmap.org')) {
    return;
  }

  // HTML / CSS / JS / JSON: NETWORK FIRST
  // → Bei Online-Sein wird IMMER die neueste Version geladen.
  //   Nur wenn offline, fällt der Service Worker auf den Cache zurück.
  const isAppFile = url.endsWith('.html') ||
                    url.endsWith('.css') ||
                    url.endsWith('.js') ||
                    url.endsWith('.json') ||
                    url.endsWith('/') ||
                    /\/[^./]*$/.test(new URL(url).pathname); // URLs ohne Endung (z.B. /ausflug)

  if (isAppFile) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Erfolgreiche Antworten in den Cache legen für Offline-Nutzung
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline → aus Cache servieren
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Andere Dateien (Bilder, Icons): CACHE FIRST
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// =========================
// MESSAGE — Manuell „skip waiting" auslösen (für Update-Banner)
// =========================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
