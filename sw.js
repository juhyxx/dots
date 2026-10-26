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
const VERSION = '56c77e0';
const CACHE = 'dots-' + VERSION;

// Everything index.html loads, plus the piano samples js/audio.js fetches. The deploy fails if a
// local file index.html loads is missing here.
const FILES = [
  './',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'css/style.css?v=56c77e0',
  'fonts/Bravura.woff2?v=56c77e0',
  'img/piano.webp?v=56c77e0',
  'img/piano-400.webp?v=56c77e0',
  'img/guitar.webp?v=56c77e0',
  'img/guitar-400.webp?v=56c77e0',
  'img/bass.webp?v=56c77e0',
  'img/bass-400.webp?v=56c77e0',
  'samples/piano/A0.mp3',
  'samples/piano/A1.mp3',
  'samples/piano/A2.mp3',
  'samples/piano/A3.mp3',
  'samples/piano/A4.mp3',
  'samples/piano/A5.mp3',
  'samples/piano/A6.mp3',
  'samples/piano/A7.mp3',
  'samples/piano/C1.mp3',
  'samples/piano/C2.mp3',
  'samples/piano/C3.mp3',
  'samples/piano/C4.mp3',
  'samples/piano/C5.mp3',
  'samples/piano/C6.mp3',
  'samples/piano/C7.mp3',
  'samples/piano/C8.mp3',
  'samples/piano/Ds1.mp3',
  'samples/piano/Ds2.mp3',
  'samples/piano/Ds3.mp3',
  'samples/piano/Ds4.mp3',
  'samples/piano/Ds5.mp3',
  'samples/piano/Ds6.mp3',
  'samples/piano/Ds7.mp3',
  'samples/piano/Fs1.mp3',
  'samples/piano/Fs2.mp3',
  'samples/piano/Fs3.mp3',
  'samples/piano/Fs4.mp3',
  'samples/piano/Fs5.mp3',
  'samples/piano/Fs6.mp3',
  'samples/piano/Fs7.mp3',
  'js/i18n.js?v=56c77e0',
  'js/lang/en.js?v=56c77e0',
  'js/lang/cs.js?v=56c77e0',
  'js/lang/de.js?v=56c77e0',
  'js/lang/es.js?v=56c77e0',
  'js/lang/fr.js?v=56c77e0',
  'js/lang/it.js?v=56c77e0',
  'js/lang/pt-BR.js?v=56c77e0',
  'js/lang/zh.js?v=56c77e0',
  'js/music.js?v=56c77e0',
  'js/levels.js?v=56c77e0',
  'js/audio.js?v=56c77e0',
  'js/midi.js?v=56c77e0',
  'js/mic.js?v=56c77e0',
  'js/store.js?v=56c77e0',
  'js/staff.js?v=56c77e0',
  'js/instruments.js?v=56c77e0',
  'js/game.js?v=56c77e0',
  'js/practice.js?v=56c77e0',
  'js/rhythm.js?v=56c77e0',
  'js/beats.js?v=56c77e0',
  'js/app.js?v=56c77e0',
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
