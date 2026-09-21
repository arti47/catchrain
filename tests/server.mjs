// Tiny static server for the harnesses. No dependencies, no build step.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

export function serve(root = process.cwd()) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let path = normalize(decodeURIComponent(url.pathname));
    if (path === "/" || path === "\\") path = "/index.html";
    try {
      const body = await readFile(join(root, path));
      res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, port: server.address().port })));
}

export const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export async function launch(chromium) {
  return chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
}

import { readFileSync } from "node:fs";
/** The three shared seed states (§11.1 D). */
export const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
/** Boot the app against a fixture: a hash change is not a load, so reload. */
export async function seed(page, base, name, settings) {
  await page.goto(base);
  const state = fixture(name);
  await page.evaluate(({ s, cfg }) => {
    localStorage.clear();
    if (s.activeId) localStorage.setItem("citr:v1", JSON.stringify(s));
    if (cfg) localStorage.setItem("citr:v1:settings", JSON.stringify(cfg));
  }, { s: state, cfg: settings || null });
  await page.reload();
}
