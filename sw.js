// Service worker: lets Dots be installed as an app and played offline.
//
// On deploy, VERSION becomes the commit hash, and every css/js/img/fonts URL below (and in
// index.html and css/style.css) gets the same ?v=<hash>. See .github/workflows/pages.yml.
// So each deploy changes this file: the browser installs the new worker, which downloads
// that version's files into a fresh cache and deletes the old one.
//
// The page itself always comes from the network first, so a new deploy shows up on the next
// start; it's served from the cache only when offline. The other files are versioned, so the
// cache can answer for them straight away. Locally (VERSION 'dev') files change without a new
// version, so there everything comes from the network first and the cache is only for offline.
const VERSION = 'ea78714';
const CACHE = 'dots-' + VERSION;

// Everything index.html loads. The deploy fails if a local file there is missing here.
const FILES = [
  './',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'css/style.css?v=ea78714',
  'fonts/Bravura.woff2?v=ea78714',
  'img/piano.webp?v=ea78714',
  'img/piano-400.webp?v=ea78714',
  'img/guitar.webp?v=ea78714',
  'img/guitar-400.webp?v=ea78714',
  'img/bass.webp?v=ea78714',
  'img/bass-400.webp?v=ea78714',
  'js/i18n.js?v=ea78714',
  'js/lang/en.js?v=ea78714',
  'js/lang/cs.js?v=ea78714',
  'js/lang/de.js?v=ea78714',
  'js/lang/es.js?v=ea78714',
  'js/lang/fr.js?v=ea78714',
  'js/lang/it.js?v=ea78714',
  'js/lang/pt-BR.js?v=ea78714',
  'js/lang/zh.js?v=ea78714',
  'js/music.js?v=ea78714',
  'js/levels.js?v=ea78714',
  'js/audio.js?v=ea78714',
  'js/midi.js?v=ea78714',
  'js/mic.js?v=ea78714',
  'js/store.js?v=ea78714',
  'js/staff.js?v=ea78714',
  'js/instruments.js?v=ea78714',
  'js/game.js?v=ea78714',
  'js/practice.js?v=ea78714',
  'js/rhythm.js?v=ea78714',
  'js/beats.js?v=ea78714',
  'js/app.js?v=ea78714',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the HTTP cache, so no stale copy ends up in the new cache
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dots-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// keep a copy of what came from the network (also the Google Fonts, which can't be listed above);
// waitUntil keeps the worker alive until it's stored
function keep(e, res) {
  if (res.status === 200 || res.type === 'opaque') {
    const copy = res.clone();
    e.waitUntil(caches.open(CACHE).then((cache) => cache.put(e.request, copy)));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  if (req.mode === 'navigate' || VERSION === 'dev') {
    // no-cache revalidates with the server, so even the HTTP cache can't hand out an old page.
    // The page is fetched by its URL: Chrome may already have requested it (without no-cache)
    // while the worker started, and fetch(req) would be given that response instead.
    const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', redirect: 'manual' }) : fetch(req, { cache: 'no-cache' });
    e.respondWith(
      fresh
        .then((res) => keep(e, res))
        .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
    );
    return;
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(e, res))));
});
