/**
 * Sonance Progressive Web Application - Production Service Worker
 * 
 * Version: sonance-v1.0.0
 * 
 * Caching Strategies:
 * 1. HTML Documents: Network-First with Cache Fallback (Ensures fresh application shell on deployment)
 * 2. Static Assets (CSS, JS, Fonts, Icons, Manifest, Audio, Images): Stale-While-Revalidate
 * 3. Dynamic Bypasses: Blobs, Data URIs, and WebRTC signaling servers
 */

const CACHE_NAME = 'sonance-v1.0.0';

// Core static assets required for 100% offline playback & UI rendering
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/design-system.css',
  './css/layout.css',
  './css/components.css',
  './css/responsive.css',
  './js/main.js',
  './js/eventBus.js',
  './js/audioEngine.js',
  './js/uiController.js',
  './js/visualizer.js',
  './js/partySync.js',
  './js/playlist.js',
  './js/storage.js',
  './js/waveformWorker.js',
  './assets/icons/icon.svg',
  './assets/audio/1.mp3',
  './assets/audio/2.mp3',
  './assets/audio/3.mp3',
  './assets/audio/4.mp3',
  './assets/audio/5.mp3'
];

/**
 * 1. INSTALL EVENT
 * Pre-caches essential static assets and immediately activates the new Service Worker version.
 */
self.addEventListener('install', (event) => {
  console.log(`[Sonance SW] Installing Service Worker version: ${CACHE_NAME}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('[Sonance SW] Pre-caching static assets...');
        // Pre-cache assets with resilient error handling per file
        for (const asset of STATIC_ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn(`[Sonance SW] Pre-cache warning for asset "${asset}":`, err);
          }
        }
      })
      .then(() => {
        console.log('[Sonance SW] Skip waiting triggered.');
        return self.skipWaiting();
      })
  );
});

/**
 * 2. ACTIVATE EVENT
 * Cleans up legacy caches (e.g. sonance-v0.8, sonance-v0.9, sonance-v2) and claims open clients.
 */
self.addEventListener('activate', (event) => {
  console.log(`[Sonance SW] Activating Service Worker version: ${CACHE_NAME}`);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((existingCache) => {
            if (existingCache !== CACHE_NAME) {
              console.log(`[Sonance SW] Deleting obsolete cache: ${existingCache}`);
              return caches.delete(existingCache);
            }
          })
        );
      })
      .then(() => {
        console.log('[Sonance SW] Claiming clients for instant control...');
        return self.clients.claim();
      })
  );
});

/**
 * 3. FETCH EVENT HANDLER
 * Enforces Network-First for HTML navigation and Stale-While-Revalidate for static assets.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests
  if (request.method !== 'GET') return;

  const url = request.url;

  // Bypass dynamic memory blobs, data URIs, and WebRTC PeerJS signaling sockets
  if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('peerjs') || url.includes('unpkg.com')) {
    return;
  }

  const isHtmlRequest = request.mode === 'navigate' || 
                        (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isHtmlRequest) {
    // ----------------------------------------------------
    // STRATEGY A: NETWORK-FIRST (For HTML Documents)
    // Ensures users receive updated application releases on deployment
    // ----------------------------------------------------
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          console.log('[Sonance SW] Network offline. Serving cached HTML fallback...');
          return caches.match('./index.html') || caches.match(request);
        })
    );
  } else {
    // ----------------------------------------------------
    // STRATEGY B: STALE-WHILE-REVALIDATE (For CSS, JS, Images, Audio, Fonts)
    // Instantly serves cached copy, then fetches & updates cache in background
    // ----------------------------------------------------
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            // Do NOT cache API errors or non-200 responses
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch((fetchErr) => {
            // Network fetch failed (offline mode)
            console.log(`[Sonance SW Offline Fetch] Asset: ${url}`, fetchErr);
          });

        // Return cached asset immediately if present; otherwise wait for network fetch
        return cachedResponse || fetchPromise;
      })
    );
  }
});
