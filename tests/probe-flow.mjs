// Prints the tap count and route changes for the sequences a session repeats.
// Usage: node tests/probe-flow.mjs
import { chromium } from "playwright-core";
import { serve, launch, seed } from "./server.mjs";

const { server, port } = await serve();
const browser = await launch(chromium);
const base = `http://127.0.0.1:${port}/index.html`;
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
const page = await ctx.newPage();

async function walk(name, fixture, steps) {
  await seed(page, base, fixture);
  await page.goto(`${base}#/home`);
  await page.waitForTimeout(120);
  let taps = 0;
  const routes = [location => location];
  const seen = [];
  for (const step of steps) {
    const before = await page.evaluate(() => location.hash);
    await step(page);
    taps++;
    const after = await page.evaluate(() => location.hash);
    if (after !== before) seen.push(after);
    await page.waitForTimeout(80);
  }
  console.log(`${name.padEnd(34)} ${String(taps).padStart(2)} taps  ${seen.join(" ") || "(no route change)"}`);
}

const tapBar = (p) => p.locator(".action-bar .btn").click();
const tapChoice = (p) => p.locator(".modal-overlay .choice").first().click();
const tapModal = (p) => p.locator(".modal-actions .btn").first().click();

console.log("sequence                           taps  routes\n" + "-".repeat(70));

await walk("open the sheet from the case", "mid-session", [
  (p) => p.getByRole("button", { name: "Open the sheet" }).click(),
]);

await walk("make a stage test", "mid-session", [
  (p) => p.locator('.tab[href="#/play"]').click(),
  tapBar, tapChoice, tapModal,
]);

await walk("act against a threat", "mid-session", [
  (p) => p.locator('.tab[href="#/play"]').click(),
  (p) => p.getByRole("button", { name: "Act against it" }).first().click(),
  tapChoice, tapModal,
]);

await walk("use a keyword", "mid-session", [
  (p) => p.locator('.tab[href="#/case"], .tab[href="#/home"]').first().click(),
  (p) => p.getByRole("button", { name: "Open the sheet" }).click(),
  (p) => p.getByRole("button", { name: "Smooth talker" }).click(),
  tapChoice,
]);

await walk("ask the oracle a yes/no", "mid-session", [
  (p) => p.locator('.tab[href="#/tables"]').click(),
  (p) => p.locator('.section-nav a[href="#/oracle"]').click(),
  (p) => p.getByRole("button", { name: "Ask" }).click(),
]);

await browser.close();
server.close();
