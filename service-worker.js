// The app shell is cached and versioned; navigation is network-first so a stale
// shell never outlives a deploy.
//
// A home-screen install is the hard case: it is resumed from the app switcher
// for days without a fresh load, and if a deploy changes the app's files but
// not this worker, the browser sees no new worker and keeps serving the old
// cache forever. So the page can ask this worker to go and look — checkShell()
// re-fetches every shell file past the HTTP cache, compares it with what is
// cached, replaces anything that changed, and tells the page.
const CACHE_VERSION = "citr-v15";
const SHELL = [
  "./", "./index.html", "./styles.css", "./manifest.json", "./icon.svg", "./data.js", "./data-house.js",
  "./src/main.js", "./src/core.js", "./src/ui.js", "./src/rules.js", "./src/derived.js",
  "./src/settings.js", "./src/store.js", "./src/deck.js", "./src/roller.js",
  "./src/lifecycle.js", "./src/wizard.js", "./src/sheet.js", "./src/play.js",
  "./src/clues.js", "./src/solve.js", "./src/screens.js", "./src/tutorial.js", "./src/router.js",
  "./src/paper.js", "./src/prompts.js", "./src/library.js", "./src/framing.js", "./src/updates.js",
  "./src/coach.js",
];

/** Always install from the network, never from a stale HTTP cache. */
const fresh = (url) => new Request(url, { cache: "reload" });

// No skipWaiting here on purpose: a new worker waits until the player accepts
// it, so a deploy never swaps the app out from under a scene in progress. The
// toast's Reload button sends "skip-waiting" when they are ready.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => Promise.all(SHELL.map((url) => fetch(fresh(url)).then((res) => (res.ok ? c.put(url, res) : null))))),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") { self.skipWaiting(); return; }
  if (e.data === "check-update") e.waitUntil(checkShell(e.source));
  if (e.data === "version" && e.source) e.source.postMessage({ type: "version", version: CACHE_VERSION });
});

/** Re-fetch the shell past every cache, keep what changed, and report. */
async function checkShell(client) {
  const cache = await caches.open(CACHE_VERSION);
  const changed = [];
  let offline = false;
  await Promise.all(SHELL.map(async (url) => {
    let res;
    try { res = await fetch(fresh(url)); }
    catch { offline = true; return; }
    if (!res.ok) return;
    const cached = await cache.match(url);
    const [next, prev] = await Promise.all([res.clone().text(), cached ? cached.clone().text() : Promise.resolve(null)]);
    if (next !== prev) { changed.push(url); await cache.put(url, res); }
  }));
  if (!client) return;
  client.postMessage({
    type: changed.length ? "update-ready" : offline ? "offline" : "up-to-date",
    changed, version: CACHE_VERSION,
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).pathname.endsWith("/service-worker.js")) return; // never from cache
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
