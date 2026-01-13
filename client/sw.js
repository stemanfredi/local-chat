/**
 * Service Worker for Local Chat PWA
 * Caches static assets for offline use
 */

const CACHE_NAME = 'local-chat-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/main.css',
    '/css/variables.css',
    '/css/components/panel.css',
    '/js/app.js',
    '/js/state.js',
    '/js/db/index.js',
    '/js/api/client.js',
    '/js/api/auth.js',
    '/js/api/users.js',
    '/js/api/sync.js',
    '/js/services/webllm.js',
    '/js/services/sync.js',
    '/js/services/documents.js',
    '/js/services/rag.js',
    '/js/components/sidebar.js',
    '/js/components/chat-view.js',
    '/js/components/panel.js',
    '/js/utils/dom.js',
    '/js/utils/events.js',
    '/manifest.json',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip API requests - always go to network
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Skip CDN requests (WebLLM models, pdf.js, etc.) - let browser handle caching
    if (url.origin !== location.origin) {
        return;
    }

    // Cache-first for static assets
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        // Clone response since it can only be consumed once
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    });
            })
            .catch(() => {
                // Offline fallback for navigation requests
                if (request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                return new Response('Offline', { status: 503 });
            })
    );
});
