// Minimal test harness: a parse gate, assertions, and a browser-free environment.
import { readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

export function parseGate() {
  const files = [];
  for (const f of readdirSync(".")) if (f.endsWith(".js")) files.push(f);
  if (existsSync("src")) for (const f of readdirSync("src")) if (f.endsWith(".js")) files.push(`src/${f}`);
  const bad = [];
  for (const f of files) {
    try { execFileSync("node", ["--check", f], { stdio: "pipe" }); }
    catch (e) { bad.push(`${f}: ${String(e.stderr || e).split("\n")[0]}`); }
  }
  return { files, bad };
}

/** localStorage + a stable document stub so store/ui modules import cleanly. */
export function installEnv() {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
  globalThis.__resetStorage = () => mem.clear();
}

let passed = 0;
const failures = [];
let current = "";
export function test(name, fn) {
  current = name;
  try { const r = fn(); if (r && typeof r.then === "function") return r.then(() => { passed++; }, (e) => failures.push(`${name}: ${e.message}`)); passed++; }
  catch (e) { failures.push(`${name}: ${e.message}`); }
  return Promise.resolve();
}
export function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
export function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg || "not equal"}: ${A} !== ${B}`);
}
export function report() {
  console.log(`\n${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  FAIL " + f);
  return failures.length === 0;
}
export const ctx = () => current;
