// Быстрый запуск: приложение открывается сразу из памяти телефона,
// а свежая версия с GitHub скачивается в фоне и применяется при следующем открытии.
const CACHE = 'booking-v4';
const FONTS = 'booking-fonts-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // шрифты Google: всегда из памяти, если уже скачаны
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // само приложение: сразу из памяти, а в фоне — проверить обновление
  e.respondWith(caches.open(CACHE).then(async c => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const hit = await c.match(key, {ignoreSearch: true});
    const fresh = fetch(req, {cache: 'no-cache'}).then(res => {
      if (res.ok) c.put(key, res.clone()).then(() => notifyIfChanged(hit, res.clone(), req));
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || c.match('./index.html');
  }));
});
// если скачалась новая версия страницы — сказать приложению, чтобы предложило обновиться
async function notifyIfChanged(oldRes, newRes, req) {
  if (!oldRes || req.mode !== 'navigate') return;
  const [a, b] = await Promise.all([oldRes.clone().text(), newRes.text()]);
  if (a === b) return;
  (await self.clients.matchAll()).forEach(cl => cl.postMessage('updated'));
}
