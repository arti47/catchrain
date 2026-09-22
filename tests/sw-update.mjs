// The one PWA behaviour you cannot verify by looking at the running app: does a
// deploy actually reach a player who already has it installed?
// Serves a copy of the project, installs the service worker, ships a change,
// and asserts the update toast appears and accepting it yields the new version.
import { chromium } from "playwright-core";
import { cpSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve, launch } from "./server.mjs";

const dir = mkdtempSync(join(tmpdir(), "citr-sw-"));
// What to stage is read out of the worker's own shell list rather than repeated
// here. A hand-kept copy silently rots the first time a shipped file is added:
// the worker then fetches a file the deploy does not have, install rejects, and
// the failure reads as "the service worker never took control" — nothing like
// its cause.
const shellSource = readFileSync("service-worker.js", "utf8");
const shellPaths = [...shellSource.matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1]);
const staged = [...new Set(shellPaths.map((p) => p.split("/")[0])), "service-worker.js"];
for (const f of staged) cpSync(f, join(dir, f), { recursive: true });

const { server, port } = await serve(dir);
const browser = await launch(chromium);
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: "allow" });
const page = await ctx.newPage();
const base = `http://127.0.0.1:${port}/index.html`;
const failures = [];
const fail = (m) => { failures.push(m); console.log("  FAIL " + m); };

await page.goto(base);
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
  .catch(() => fail("the service worker never took control of the page"));

let next = "";
if (!failures.length) {
  // Ship a change, exactly as a deploy would. Bump whatever version the worker
  // actually ships rather than one this file remembers: the two drift apart,
  // and then the test ships nothing and blames the app for it.
  const swPath = join(dir, "service-worker.js");
  const sw = readFileSync(swPath, "utf8");
  const current = (sw.match(/CACHE_VERSION = "([^"]+)"/) || [])[1];
  if (!current) fail("the service worker has no CACHE_VERSION to bump");
  next = `${current}-deploytest`;
  writeFileSync(swPath, sw.replace(`"${current}"`, `"${next}"`));
  const css = join(dir, "styles.css");
  writeFileSync(css, readFileSync(css, "utf8") + "\n/* shipped change */\n");

  await page.reload();
  const toast = page.locator(".toast-action", { hasText: "Update available" });
  await toast.waitFor({ timeout: 15000 }).catch(() => fail("no update toast after a deploy"));

  if (!failures.length) {
    // The prompt is a toast, not a modal: the screen behind it stays usable.
    const blocking = await page.locator(".modal-overlay").count();
    if (blocking) fail("the update prompt blocks the screen");
    const reachable = await page.locator("#screen .btn, .tab").first().isVisible().catch(() => false);
    if (!reachable) fail("the update toast hides the app behind it");
    const clearsTabBar = await page.evaluate(() => {
      const t = document.querySelector(".toast-action").getBoundingClientRect();
      const bar = document.querySelector(".tab-bar").getBoundingClientRect();
      return t.bottom <= bar.top + 1 && t.left >= 0 && t.right <= window.innerWidth;
    });
    if (!clearsTabBar) fail("the update toast sits over the tab bar");

    // "Not now" means not now: dismissing it must not lose the update. On the
    // next load either it is offered again, or the browser has already let the
    // waiting worker take over — never silently neither.
    await page.locator(".toast-action .icon-btn").click();
    await page.waitForTimeout(150);
    if (await page.locator(".toast-action").count()) fail("dismissing the update toast left it on screen");
    await page.reload();
    await page.waitForTimeout(1500);
    const offeredAgain = await page.locator(".toast-action", { hasText: "Update available" })
      .waitFor({ timeout: 4000 }).then(() => true, () => false);
    const already = await page.evaluate(async () => (await caches.keys()).join(","));
    if (!offeredAgain && !already.includes(next)) fail("a dismissed update was lost: no prompt, and the old version is still active");

    if (offeredAgain) {
      await page.locator(".toast-action .btn").first().click(); // Reload
      await page.waitForTimeout(1500);
    }
    const version = await page.evaluate(async () => (await caches.keys()).join(","));
    if (!version.includes(next)) fail(`the new cache never became active (caches: ${version})`);
    else console.log(`  ok   a deploy reaches an installed app through a toast, and ${offeredAgain ? "accepting it" : "the next load"} activates the new version`);
  }
}

// The failure a home-screen install actually hits: a deploy changes the app's
// files but not the worker, so the browser sees no new worker and the old cache
// would serve forever. Asking from Settings has to find it.
if (!failures.length) {
  const css = join(dir, "styles.css");
  writeFileSync(css, readFileSync(css, "utf8") + "\n.premise { letter-spacing: .042em; }\n");
  const swBefore = readFileSync(join(dir, "service-worker.js"), "utf8");

  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Check for updates" }).click();
  const found = await page.locator(".toast-action", { hasText: "Update available" })
    .waitFor({ timeout: 15000 }).then(() => true, () => false);
  if (!found) fail("a deploy that did not touch the worker was never noticed");
  else {
    await page.locator(".toast-action .btn").first().click();
    await page.waitForTimeout(1200);
    const applied = await page.evaluate(async () => {
      const res = await fetch("styles.css");
      return (await res.text()).includes(".042em");
    });
    if (!applied) fail("the changed file was found but never served");
    else console.log("  ok   a deploy that leaves the worker untouched is still found and applied");
  }
  if (readFileSync(join(dir, "service-worker.js"), "utf8") !== swBefore) fail("the test changed the worker after all");
}

await browser.close();
server.close();
rmSync(dir, { recursive: true, force: true });
console.log(failures.length ? `\n${failures.length} failed` : "\nservice-worker update path clean");
process.exit(failures.length ? 1 : 0);
