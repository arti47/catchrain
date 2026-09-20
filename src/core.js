// Foundational constants, DOM helpers and raw randomness. No imports.

export const APP = { name: "Caught in the Rain", storageKey: "citr:v1", schema: 1 };

// --- Randomness ---------------------------------------------------------------
// crypto.getRandomValues, never Math.random: the dice must be defensible (§5.1).
const MAX = 0x100000000;
export function randInt(n) {
  if (n <= 0) throw new Error("randInt needs a positive range");
  const limit = Math.floor(MAX / n) * n; // rejection sampling: no modulo bias
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
  return x % n;
}
export const d6 = () => randInt(6) + 1;
export const roll2d6 = () => [d6(), d6()];
/** 1d66: two dice read left to right. Returns {dice:[a,b], code:"34", index:0..35} */
export function d66() {
  const a = d6(), b = d6();
  return { dice: [a, b], code: `${a}${b}`, index: (a - 1) * 6 + (b - 1) };
}
export const d66Code = (i) => `${Math.floor(i / 6) + 1}${(i % 6) + 1}`;
export const pick = (arr) => arr[randInt(arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const uid = () => {
  const b = new Uint8Array(8); crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};

// --- Table lookup by range ----------------------------------------------------
export function lookupRange(table, value) {
  const row = table.find((r) => value >= r.min && value <= r.max);
  if (!row) throw new Error(`no row for ${value}`);
  return row;
}

// --- DOM ----------------------------------------------------------------------
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  add(node, ...children);
  return node;
}
/** Null-safe append: never renders the text "null" (defect D-1). */
export function add(parent, ...children) {
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false || c === true) continue;
    parent.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return parent;
}
export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };
export const $ = (sel, root = document) => root.querySelector(sel);

// --- Misc ---------------------------------------------------------------------
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const halveUp = (n) => Math.ceil(n / 2);
export const sum = (a) => a.reduce((x, y) => x + y, 0);
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
