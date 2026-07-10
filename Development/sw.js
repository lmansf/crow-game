// Service worker: makes the game installable and fully playable offline.
//
// Strategy: stale-while-revalidate. Every same-origin GET is answered from
// cache immediately (instant, offline-safe) while a background fetch
// refreshes the cached copy, so players get updates one launch later.
// The shell below is precached on install so a fresh install works offline
// after its very first load; anything not listed (a newly added level file,
// say) is picked up by the runtime cache the first time it is fetched.

const CACHE = 'crow-game-v1';

const SHELL = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'src/main.js',
  'src/abilities.js',
  'src/audio.js',
  'src/background.js',
  'src/boss.js',
  'src/camera.js',
  'src/enemies.js',
  'src/fx.js',
  'src/gfx.js',
  'src/input.js',
  'src/level.js',
  'src/particles.js',
  'src/player.js',
  'src/save.js',
  'src/shop.js',
  'src/ui.js',
  'src/levels/index.js',
  'src/levels/ocean-drive.js',
  'src/levels/brickell-ascent.js',
  'src/levels/wynwood-walls.js',
  'src/levels/little-havana.js',
  'src/levels/skyway-mile-zero.js',
  'src/levels/river-of-grass.js',
  'src/levels/hallways.js',
  'src/levels/ufo.js',
  'src/levels/rookery.js',
  'assets/menu-bg.jpg',
  'assets/card-1.jpg',
  'assets/card-2.jpg',
  'assets/card-3.jpg',
  'assets/card-4.jpg',
  'assets/card-5.jpg',
  'assets/card-6.jpg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // ignoreSearch: the page loads main.js with a cache-busting query,
      // and ?debug/?gfx flags live on the page URL - same file either way
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const refresh = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
