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
for (const f of ["index.html", "styles.css", "data.js", "manifest.json", "service-worker.js", "icon.svg", "src"]) {
  cpSync(f, join(dir, f), { recursive: true });
}

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

if (!failures.length) {
  // Ship a change, exactly as a deploy would.
  const swPath = join(dir, "service-worker.js");
  const sw = readFileSync(swPath, "utf8");
  writeFileSync(swPath, sw.replace('"citr-v1"', '"citr-v2"'));
  const css = join(dir, "styles.css");
  writeFileSync(css, readFileSync(css, "utf8") + "\n/* shipped change */\n");

  await page.reload();
  const toast = page.locator(".modal-title", { hasText: "Update available" });
  await toast.waitFor({ timeout: 15000 }).catch(() => fail("no update prompt after a deploy"));

  if (!failures.length) {
    await page.locator(".modal-actions .btn").first().click(); // Reload now
    await page.waitForTimeout(1500);
    const version = await page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.join(",");
    });
    if (!version.includes("citr-v2")) fail(`the new cache never became active (caches: ${version})`);
    else console.log("  ok   a deploy reaches an installed app, and accepting it activates the new version");
  }
}

await browser.close();
server.close();
rmSync(dir, { recursive: true, force: true });
console.log(failures.length ? `\n${failures.length} failed` : "\nservice-worker update path clean");
process.exit(failures.length ? 1 : 0);
