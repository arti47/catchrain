// Persistence, the career list, the journal, the roll log, undo and JSON backup.
// Storage is plain JSON a human can read and a script can process (§5.1).

import { APP, uid } from "./core.js";
import { normalize, normalizeCareer } from "./derived.js";

const listeners = new Set();
let state = null;
let undoStack = [];
const UNDO_LIMIT = 20;
const LOG_CAP = 200;
const JOURNAL_CAP = 500;

function read() {
  try { return normalize(JSON.parse(localStorage.getItem(APP.storageKey) || "{}")); }
  catch { return normalize({}); }
}
function write() {
  try { localStorage.setItem(APP.storageKey, JSON.stringify(state)); }
  catch (e) { console.warn("save failed", e); }
}

export const Store = {
  init() { state = read(); return state; },
  get state() { return state || (state = read()); },
  get career() { const s = Store.state; return s.activeId ? s.careers[s.activeId] : null; },
  /** The investigator whose turn it is; in solo play there is only ever one. */
  get investigator() {
    const c = Store.career;
    if (!c) return null;
    return c.investigators.find((i) => i.id === c.activeInvestigatorId) || c.investigators[0] || null;
  },
  get party() { return Store.career ? Store.career.investigators : []; },
  investigatorById(id) {
    const c = Store.career;
    if (!c) return null;
    return c.investigators.find((i) => i.id === id) || null;
  },
  setActive(id) {
    const c = Store.career;
    if (!c || !c.investigators.some((i) => i.id === id)) return null;
    Store.update("switch investigator", () => { c.activeInvestigatorId = id; });
    return id;
  },
  addInvestigator(inv) {
    const c = Store.career;
    if (!c) return null;
    c.investigators.push(inv);
    c.activeInvestigatorId = inv.id;
    return inv;
  },
  /**
   * Ch.3: bring in an investigator you already play, as long as they are not in
   * the middle of another mystery. The copy is theirs in this career from then
   * on; the original stays where it is (ruling A21).
   */
  availableToBorrow() {
    const here = Store.career;
    const out = [];
    for (const car of Object.values(Store.state.careers)) {
      if (!here || car.id === here.id) continue;
      const busy = car.mystery && !car.mystery.solved;
      for (const inv of car.investigators) {
        if (!inv.name) continue;
        out.push({ investigator: inv, career: car, busy: !!busy });
      }
    }
    return out;
  },
  borrowInvestigator(careerId, invId) {
    const here = Store.career;
    const from = Store.state.careers[careerId];
    if (!here || !from) return null;
    if (from.mystery && !from.mystery.solved) return null; // mid-mystery elsewhere
    const source = from.investigators.find((i) => i.id === invId);
    if (!source) return null;
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = uid();
    Store.update("bring in an investigator", () => {
      here.investigators.push(copy);
      here.activeInvestigatorId = copy.id;
    });
    return copy;
  },
  removeInvestigator(id) {
    const c = Store.career;
    if (!c || c.investigators.length < 2) return false;
    Store.update("remove investigator", () => {
      c.investigators = c.investigators.filter((i) => i.id !== id);
      if (c.activeInvestigatorId === id) c.activeInvestigatorId = c.investigators[0].id;
    });
    return true;
  },
  get mystery() { return Store.career ? Store.career.mystery : null; },
  careers() { return Object.values(Store.state.careers).sort((a, b) => b.createdAt - a.createdAt); },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { for (const fn of listeners) fn(state); },

  /** Every mutation goes through here so undo and persistence are never forgotten. */
  update(label, fn) {
    Store.begin(label);
    const result = fn(state);
    Store.commit();
    return result;
  },
  /** begin/commit wrap a multi-step, player-prompted procedure as ONE undo step. */
  begin(label) {
    undoStack.push({ label, snapshot: JSON.stringify(state) });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  },
  commit() { write(); Store.emit(); },
  /** Read-only helper for callers that must not push an undo step. */
  peek(fn) { return fn(Store.state); },

  canUndo: () => undoStack.length > 0,
  lastLabel: () => (undoStack.length ? undoStack[undoStack.length - 1].label : null),
  undo() {
    const step = undoStack.pop();
    if (!step) return null;
    state = normalize(JSON.parse(step.snapshot));
    write();
    Store.emit();
    return step.label;
  },
  clearUndo() { undoStack = []; },

  newCareer(name) {
    const id = uid();
    return Store.update("new career", (s) => {
      s.careers[id] = normalizeCareer({ id, name: name || "New career", createdAt: Date.now() });
      s.activeId = id;
      return s.careers[id];
    });
  },
  selectCareer(id) { Store.update("switch career", (s) => { if (s.careers[id]) s.activeId = id; }); },
  deleteCareer(id) { Store.update("delete career", (s) => { delete s.careers[id]; if (s.activeId === id) s.activeId = Object.keys(s.careers)[0] || null; }); },

  /**
   * Journal: the narrative record. Mechanical events and player prose share one
   * list. Both records save themselves, because callers write them on either
   * side of a transaction and a lost entry is indistinguishable from one that
   * was never written.
   */
  journal(kind, text, meta) {
    const c = Store.career;
    if (!c) return;
    c.journal.push({ id: uid(), ts: Date.now(), kind, text, meta: meta || null, day: (Store.investigator || {}).day || 1, scene: c.mystery && c.mystery.scene ? c.mystery.scene.type : null });
    if (c.journal.length > JOURNAL_CAP) c.journal.splice(0, c.journal.length - JOURNAL_CAP);
    write();
  },
  log(entry) {
    const c = Store.career;
    if (!c) return;
    c.rollLog.push({ id: uid(), ts: Date.now(), ...entry });
    if (c.rollLog.length > LOG_CAP) c.rollLog.splice(0, c.rollLog.length - LOG_CAP);
    write();
  },

  /**
   * Put the current case down and keep the people: the mystery, both decks,
   * every clue set, the threats and the scene go; investigators, journal,
   * history, rivals and experience stay. No danger carries over, because the
   * case was never closed.
   */
  clearMystery() {
    const c = Store.career;
    if (!c || !c.mystery) return false;
    Store.update("clear the mystery", () => {
      Store.journal("mystery", "The case was put down unfinished.");
      c.mystery = null;
      c.carryDanger = 0;
    });
    return true;
  },

  /**
   * Erase every career on this device. Settings are the settings module's to
   * clear; the screen that offers this calls both.
   */
  eraseEverything() {
    try { localStorage.removeItem(APP.storageKey); }
    catch (e) { console.warn("erase failed", e); }
    state = normalize({});
    undoStack = [];
    write();
    Store.emit();
    return true;
  },

  exportJSON() { return JSON.stringify(Store.state, null, 2); },
  /** Import replaces everything; the caller confirms and names the loss first. */
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.careers) throw new Error("Not a Caught in the Rain backup.");
    Store.update("import backup", (s) => {
      const next = normalize(parsed);
      s.careers = next.careers;
      s.activeId = next.activeId;
    });
    return true;
  },
  /** Settings > check my data: re-run normalization and report. */
  integrityCheck() {
    const before = JSON.stringify(Store.state);
    Store.update("data check", (s) => normalize(s));
    return before === JSON.stringify(Store.state) ? "No repairs needed." : "Repaired stored data.";
  },
};
