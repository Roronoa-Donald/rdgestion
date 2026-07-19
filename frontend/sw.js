const CACHE_NAME = 'rdgestion-cache-v8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/assets/icon.svg',
  '/src/css/style.css',
  '/src/css/onboarding.css',
  '/src/js/init-theme.js',
  '/src/js/app.js',
  '/src/js/api.js',
  '/src/js/utils.js',
  '/src/js/utils/ui.js',
  '/src/js/utils/aria.js',
  '/src/js/utils/onboarding.js',
  '/src/js/router.js',
  '/src/js/views/auth.js',
  '/src/js/views/dashboard.js',
  '/src/js/views/products.js',
  '/src/js/views/pos.js',
  '/src/js/views/sales.js',
  '/src/js/views/stock.js',
  '/src/js/views/logs.js',
  '/src/js/views/settings.js',
  '/src/js/views/admin.js'
];

// Installation du Service Worker et mise en cache des ressources statiques
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes réseau (Stratégie hybride Cache-First / Network-First)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Si c'est une requête API
  if (url.pathname.startsWith('/api/')) {
    // Ne pas mettre en cache les requêtes de modification (POST, PUT, DELETE, PATCH)
    if (e.request.method !== 'GET') {
      return; // Laisser passer directement sur le réseau (bloqué par l'app si hors-ligne)
    }

    // Stratégie Network-First pour les GET API (ex: liste de produits, stats)
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Mettre en cache la réponse fraîche de l'API
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
          return response;
        })
        .catch(() => {
          // Si le réseau échoue (offline), retourner la version du cache
          return caches.match(e.request);
        })
    );
  } else {
    // Stratégie Stale-While-Revalidate pour les ressources statiques
    // (sert le cache immédiatement MAIS récupère la version fraîche en fond)
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        const fetchPromise = fetch(e.request).then((response) => {
          // Mettre en cache la nouvelle version
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
          return response;
        }).catch(() => cachedResponse);

        // Retourne le cache immédiatement s'il existe, sinon attend le réseau
        return cachedResponse || fetchPromise;
      })
    );
  }
});
