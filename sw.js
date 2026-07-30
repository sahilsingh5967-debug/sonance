const CACHE_NAME = 'sonance-v2';
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
  './assets/audio/mixkit-hazy-after-hours-132.mp3',
  './assets/audio/alexguz-funk-amp-breakbeat-541097.mp3',
  './assets/audio/kontraa-water-afro-pop-music-445661.mp3',
  './assets/audio/alexzavesa-dance-playful-night-510786.mp3',
  './assets/audio/mickeyscat-moment-of-peace-mickeyscat-554494.mp3',
  './assets/audio/mixkit-beautiful-dream-493.mp3'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // Exclude dynamic blob URLs, data URIs, and PeerJS WebRTC network streams
  if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('peerjs') || url.includes('unpkg.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {});

        return cachedResponse;
      }

      return fetch(e.request).catch(() => {
        if (e.request.headers && e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
