const VERSION = 'fl-v13';
const NET_TIMEOUT_MS = 5000;
const APP_CACHE = 'app-' + VERSION;
const CDN_CACHE = 'cdn-' + VERSION;
const SHELL = ['./', 'index.html', 'style.css', 'i18n.js', 'app.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP_CACHE && k !== CDN_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req, url));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req, url) {
  const cache = await caches.open(APP_CACHE);
  const key = url.origin + url.pathname;
  const hit = await cache.match(key);

  const net = fetch(req).then(res => {
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  });
  net.catch(() => {});

  try {
    if (!hit) return await net;
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_TIMEOUT_MS));
    return await Promise.race([net, timeout]);
  } catch (err) {
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const page = await cache.match(new URL('index.html', self.registration.scope).href);
      if (page) return page;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CDN_CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await fresh) || Response.error();
}