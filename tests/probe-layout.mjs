// Prints the measurement table for every route under a chosen fixture.
// A probe prints; it does not assert. Read the table and look for the outlier.
// Usage: node tests/probe-layout.mjs [fresh|mid-session|stress] [width]
import { chromium } from "playwright-core";
import { serve, launch, seed } from "./server.mjs";

const FIXTURE = process.argv[2] || "stress";
const WIDTH = Number(process.argv[3] || 390);
const ROUTES = ["home", "sheet", "journal", "play", "clues", "solve", "tables", "oracle", "rules", "tutorial", "careers", "settings", "wizard", "mystery"];

const { server, port } = await serve();
const browser = await launch(chromium);
const base = `http://127.0.0.1:${port}/index.html`;
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 780 } });
const page = await ctx.newPage();
await seed(page, base, FIXTURE);

const rows = [];
for (const route of ROUTES) {
  await page.goto(`${base}#/${route}`);
  await page.waitForTimeout(120);
  rows.push(await page.evaluate((route) => {
    const vh = window.innerHeight;
    const bar = document.querySelector(".action-bar .btn");
    const controls = document.querySelectorAll("#screen .btn, #screen .choice, #screen summary, #screen label.opt, #screen .chip, #screen .box");
    let smallest = Infinity;
    for (const c of controls) {
      const r = c.getBoundingClientRect();
      if (r.width && r.height) smallest = Math.min(smallest, Math.min(r.width, r.height));
    }
    return {
      route,
      viewports: +(document.documentElement.scrollHeight / vh).toFixed(1),
      controls: controls.length,
      actionTop: bar ? Math.round(bar.getBoundingClientRect().top) : null,
      smallestTarget: smallest === Infinity ? null : Math.round(smallest),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      textNodes: document.querySelector("#screen").innerText.length,
    };
  }, route));
}

console.log(`fixture=${FIXTURE} width=${WIDTH}px viewport=780px\n`);
console.log("route      | height(vh) | controls | action top | min target | overflow | chars");
console.log("-".repeat(82));
for (const r of rows) {
  console.log(
    r.route.padEnd(10) + " | " + String(r.viewports).padStart(10) + " | " + String(r.controls).padStart(8) + " | " +
    String(r.actionTop ?? "-").padStart(10) + " | " + String(r.smallestTarget ?? "-").padStart(10) + " | " +
    String(r.overflow).padStart(8) + " | " + String(r.textNodes).padStart(5));
}

await browser.close();
server.close();
