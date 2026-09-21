// Screenshots of the main screens, both themes, at phone width. A probe: it
// asserts nothing — you look at the pictures. Design work without them is
// guesswork, and this is the tool the visual pass was done with.
// Usage: node tests/probe-shots.mjs [outDir] [fixture]
import { chromium } from "playwright-core";
import { serve, launch, seed } from "./server.mjs";

const OUT = process.argv[2] || "/tmp/citr-shots";
const FIXTURE = process.argv[3] || "stress";
const ROUTES = ["home", "play", "sheet", "clues", "settings", "tables"];

const { server, port } = await serve(process.cwd());
const browser = await launch(chromium);
const base = `http://127.0.0.1:${port}/index.html`;

for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  await seed(page, base, FIXTURE, { theme, career: true, rivals: true });
  for (const route of ROUTES) {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${theme}-${route}.png` });
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(`${ROUTES.length * 2} screenshots in ${OUT}`);
