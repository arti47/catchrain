// Interaction audit: click every visible control in isolation, resetting the
// app between clicks, and flag three things — a JS error, a control that
// cannot be clicked, and a control that changes nothing at all.
import { chromium } from "playwright-core";
import { serve, launch, seed } from "./server.mjs";

const ROUTES = ["home", "sheet", "journal", "play", "clues", "solve", "tables", "oracle", "rules", "tutorial", "careers", "settings", "wizard", "mystery"];
// Buttons, not decorations: a chip that is a <span> is a label by design, a
// link to the route you are already on has nowhere to go, and a disabled
// control refusing the click is the rule working.
const SELECTOR = "#screen button.btn, #screen .choice, #screen summary, #screen label.opt, #screen button.box, #screen button.chip, " +
  "#screen .section-nav a:not([aria-current=page]), .action-bar .btn";
// A pressed option re-tapped is correctly inert.
// Controls whose only effect is outside the page (an OS file picker).
const EXTERNAL = ["Import backup"];
const findings = [];

const { server, port } = await serve();
const browser = await launch(chromium);
const base = `http://127.0.0.1:${port}/index.html`;
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => { window.addEventListener("unhandledrejection", (e) => console.error("rejection: " + (e.reason && e.reason.message || e.reason))); });

// Compare the whole markup, not its length: two class swaps of equal length
// cancel out and a real change reads as a no-op.
const snapshot = () => page.evaluate(() => ({
  html: document.querySelector("#screen").innerHTML,
  store: Object.keys(localStorage).sort().map((k) => k + "=" + localStorage.getItem(k)).join("\n"),
  hash: location.hash,
  modal: !!document.querySelector(".modal-overlay"),
  toast: document.querySelector("#toast.show") ? document.querySelector("#toast").textContent : "",
  theme: document.documentElement.getAttribute("data-theme") || "",
  scale: document.documentElement.style.getPropertyValue("--scale"),
}));

for (const route of ROUTES) {
  await seed(page, base, "mid-session");
  await page.goto(`${base}#/${route}`);
  await page.waitForTimeout(120);
  const count = Math.min(await page.locator(SELECTOR).count(), 40);
  for (let i = 0; i < count; i++) {
    await seed(page, base, "mid-session");
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(90);
    const control = page.locator(SELECTOR).nth(i);
    if (!(await control.count())) continue;
    let label = (await control.innerText().catch(() => "")).split("\n")[0].slice(0, 28) || `control ${i}`;
    if (!(await control.isVisible().catch(() => false))) continue;
    if (await control.isDisabled().catch(() => false)) continue;
    if ((await control.getAttribute("aria-pressed").catch(() => null)) === "true") continue;
    if (EXTERNAL.some((x) => label.includes(x))) continue;
    errors.length = 0;
    const before = await snapshot();
    try { await control.click({ timeout: 2500 }); }
    catch (e) { findings.push(`${route} / "${label}": cannot be clicked`); continue; }

    // Poll for any change rather than waiting a fixed interval.
    let changed = false;
    for (let t = 0; t < 12 && !changed; t++) {
      await page.waitForTimeout(60);
      const after = await snapshot();
      changed = after.html !== before.html || after.store !== before.store || after.hash !== before.hash
        || after.modal !== before.modal || after.toast !== before.toast
        || after.theme !== before.theme || after.scale !== before.scale;
    }
    if (errors.length) findings.push(`${route} / "${label}": ${errors[0].slice(0, 120)}`);
    else if (!changed) findings.push(`${route} / "${label}": changes nothing`);
    // Close anything the click opened so the next reseed starts clean.
    await page.keyboard.press("Escape").catch(() => {});
  }
  console.log(`  checked ${count} controls on ${route}`);
}

await browser.close();
server.close();
if (findings.length) { console.log("\nfindings:"); for (const f of findings) console.log("  " + f); }
else console.log("\ninteraction audit clean");
process.exit(findings.length ? 1 : 0);
