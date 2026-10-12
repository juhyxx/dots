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
const VERSION = 'dev';
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
  'css/style.css',
  'fonts/Bravura.woff2',
  'img/piano.webp',
  'img/piano-400.webp',
  'img/guitar.webp',
  'img/guitar-400.webp',
  'img/bass.webp',
  'img/bass-400.webp',
  'js/i18n.js',
  'js/lang/en.js',
  'js/lang/cs.js',
  'js/lang/de.js',
  'js/lang/es.js',
  'js/lang/fr.js',
  'js/lang/it.js',
  'js/lang/pt-BR.js',
  'js/lang/zh.js',
  'js/music.js',
  'js/levels.js',
  'js/audio.js',
  'js/midi.js',
  'js/mic.js',
  'js/store.js',
  'js/staff.js',
  'js/instruments.js',
  'js/game.js',
  'js/practice.js',
  'js/rhythm.js',
  'js/beats.js',
  'js/app.js',
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
