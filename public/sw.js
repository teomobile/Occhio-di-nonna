// Service worker: app utilizzabile offline + tessere della mappa in cache.
const VERSION = 'v3';
const APP_CACHE = `tartufi-app-${VERSION}`;
const TILE_CACHE = 'tartufi-tiles'; // stesso nome usato in offline.js
const TILE_HOSTS = ['server.arcgisonline.com', 'a.tile.opentopomap.org', 'tile.openstreetmap.org'];
const SHELL = [
  './', './index.html', './styles.css', './app.js', './db.js', './sync.js', './seasons.js', './offline.js', './zones.js', './province.json',
  './manifest.webmanifest', './icon.svg',
];
const CDN = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(SHELL);
    await Promise.all(CDN.map(async url => {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [APP_CACHE, TILE_CACHE];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (TILE_HOSTS.includes(url.hostname)) return event.respondWith(tile(req));
  // strati dei geoportali passati dal server (/ov/<id>/<z>/<x>/<y>): come le tessere
  if (url.origin === self.location.origin && /\/ov\/[\w-]+\/\d+\/\d+\/\d+$/.test(url.pathname)) return event.respondWith(tile(req));
  if (CDN.includes(req.url)) return event.respondWith(cacheFirst(req));
  if (url.origin === self.location.origin && !url.pathname.includes('/api/')) return event.respondWith(networkFirst(req));
});

// Tessere: prima la cache (zone scaricate o già viste), poi la rete salvando il risultato.
async function tile(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req.url, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type !== 'opaque') cache.put(req.url, res.clone());
    return res;
  } catch {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(req.url, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req.url, res.clone());
  return res;
}

// File dell'app: rete (con timeout breve, nel bosco la rete "finta" blocca), altrimenti cache.
async function networkFirst(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    return hit || new Response('Offline', { status: 503 });
  }
}
