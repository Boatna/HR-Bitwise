const VERSION = 'fl-v16';
const NET_TIMEOUT_MS = 5000;
const APP_CACHE = 'app-' + VERSION;
const CDN_CACHE = 'cdn-' + VERSION;
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/i18n.js',
  'js/config.js',
  'js/state.js',
  'js/utils.js',
  'js/forklift-types.js',
  'js/api.js',
  'js/auth.js',
  'js/form.js',
  'js/offline.js',
  'js/submit.js',
  'js/3d/helpers.js',
  'js/3d/parts-powertrain.js',
  'js/3d/parts-chassis.js',
  'js/3d/parts-gas-controls.js',
  'js/3d/parts-registry.js',
  'js/3d/vehicles.js',
  'js/3d/stage.js',
  'js/3d/viewer-main.js',
  'js/3d/part-viewer.js',
  'js/dashboard.js',
  'js/main.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/icon-maskable-512.png'
];
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
    if (res && res.status === 200) cache.put(key, res.clone()).catch(() => {});
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
    if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return hit || (await fresh) || Response.error();
}