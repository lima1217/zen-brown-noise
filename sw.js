const CACHE_NAME = 'zen-brown-noise-v2.1-control-system';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css?v=20260612-control-system',
    '/app.js?v=20260612-control-system',
    '/favicon.png',
    '/apple-touch-icon.png',
    '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - keep app shell fresh, use cache for static fallback.
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    const isFreshAsset = request.mode === 'navigate'
        || url.pathname.endsWith('.html')
        || url.pathname.endsWith('.css')
        || url.pathname.endsWith('.js');

    if (isFreshAsset) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(request);
            })
    );
});
