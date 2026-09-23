// Feature/content toggles. Off by default unless the fiction's default is on (§10.15).

import { APP } from "./core.js";

const KEY = APP.storageKey + ":settings";
const DEFAULTS = {
  theme: "system",          // system | light | dark
  textScale: 100,           // pays back the zoom lock
  manualDice: false,        // enter physically rolled dice instead of rolling in-app
  multiplayer: false,       // Ch.3 co-op: a party sharing one mystery
  rivals: false,            // Ch.3 rivals
  career: true,             // Ch.3 career: XP, multiple mysteries, lingering questions
  safetyFilter: false,      // house aid: suppress chosen table rows
  wakeLock: false,
  autoOracle: true,         // offer an oracle prompt when a scene needs a detail
  sceneFraming: true,       // the book opens every scene by describing it, so this is on
  coach: true,              // the guide bar: what to do next, on every screen
  depth: true,              // the drawn things have depth: dice land, cards turn, rain falls
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
  { key: "multiplayer", name: "Co-op", text: "Several investigators share one mystery, one clock and one danger track. Adds the party, the harsher consequences table, and threats that stay attached to whoever drew them (Ch.3)." },
  { key: "manualDice", name: "Manual dice", text: "Type the faces you rolled for every resolution roll: tests, the investigation roll, consequences, threats and rest. Table rolls stay digital." },
  { key: "coach", name: "Guide me", text: "A line at the top of every screen saying what to do next and what it costs, with a Why? that explains the moment you are in. On, so the app can be played without the book." },
  { key: "sceneFraming", name: "Set the scene", text: "Open each scene with the book's two questions — where is this, who is here — and somewhere to write the answer. On, because the book opens every scene this way." },
  { key: "autoOracle", name: "Oracle prompts", text: "Offer subject-oracle words whenever a scene asks you to invent a detail." },
  { key: "safetyFilter", name: "Content filter", text: "House aid: hide chosen table rows and re-roll past them." },
  { key: "wakeLock", name: "Keep screen awake", text: "Hold the screen on during a session. Uses battery." },
];
