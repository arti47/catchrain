// Feature/content toggles. Off by default unless the fiction's default is on (§10.15).

import { APP } from "./core.js";

const KEY = APP.storageKey + ":settings";
const DEFAULTS = {
  theme: "system",          // system | light | dark
  textScale: 100,           // pays back the zoom lock
  manualDice: false,        // enter physically rolled dice instead of rolling in-app
  multiplayer: false,       // Ch.3 co-op consequences table
  rivals: false,            // Ch.3 rivals
  career: true,             // Ch.3 career: XP, multiple mysteries, lingering questions
  safetyFilter: false,      // house aid: suppress chosen table rows
  wakeLock: false,
  autoOracle: true,         // offer an oracle prompt when a scene needs a detail
};

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { cache = { ...DEFAULTS }; }
  return cache;
}
export const Settings = {
  all: () => ({ ...load() }),
  get: (k) => load()[k],
  set(k, v) { const s = load(); s[k] = v; localStorage.setItem(KEY, JSON.stringify(s)); return v; },
  defaults: () => ({ ...DEFAULTS }),
  reset() { cache = { ...DEFAULTS }; localStorage.setItem(KEY, JSON.stringify(cache)); },
};
export const TOGGLES = [
  { key: "career", name: "Career", text: "Keep one investigator across mysteries: XP, rivals, lingering questions (Ch.3)." },
  { key: "rivals", name: "Rivals", text: "Threats that survive a scene can come back in later ones (Ch.3)." },
  { key: "multiplayer", name: "Co-op mode", text: "Use the multiplayer consequences table: danger +3 and two discards (Ch.3)." },
  { key: "manualDice", name: "Manual dice", text: "Type the faces you rolled for every resolution roll: tests, the investigation roll, consequences, threats and rest. Table rolls stay digital." },
  { key: "autoOracle", name: "Oracle prompts", text: "Offer subject-oracle words whenever a scene asks you to invent a detail." },
  { key: "safetyFilter", name: "Content filter", text: "House aid: hide chosen table rows and re-roll past them." },
  { key: "wakeLock", name: "Keep screen awake", text: "Hold the screen on during a session. Uses battery." },
];
