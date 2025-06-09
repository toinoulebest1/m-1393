
const CACHE_NAME = 'music-app-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression du cache obsolète:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Stratégie de cache: Network First avec fallback vers le cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la requête réussit, on met à jour le cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Si la requête échoue, on essaie de récupérer depuis le cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Si pas dans le cache et que c'est une navigation, on retourne la page principale
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
      })
  );
});
