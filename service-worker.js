// App shell + data are cached and versioned; navigation is network-first so a
// stale shell never outlives a deploy.
const CACHE_VERSION = "citr-v1";
const SHELL = [
  "./", "./index.html", "./styles.css", "./manifest.json", "./icon.svg", "./data.js",
  "./src/main.js", "./src/core.js", "./src/ui.js", "./src/rules.js", "./src/derived.js",
  "./src/settings.js", "./src/store.js", "./src/deck.js", "./src/roller.js",
  "./src/lifecycle.js", "./src/wizard.js", "./src/sheet.js", "./src/play.js",
  "./src/clues.js", "./src/solve.js", "./src/screens.js", "./src/tutorial.js", "./src/router.js",
  "./src/prompts.js", "./src/library.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skip-waiting") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    const copy = res.clone();
    if (res.ok && new URL(req.url).origin === location.origin) caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
    return res;
  }).catch(() => hit)));
});
