// Pure derivations over investigator + mystery state, plus normalization/migration.

import { FATIGUE_BOXES, CLOCK_SEGMENTS, ATTRIBUTES, ATTRIBUTE_MAX } from "../data.js";
import { APP, uid } from "./core.js";

export const attrValue = (inv, id) => (inv.attributes || {})[id] ?? 0;
export const isStruck = (inv, id) => !!(inv.struck || {})[id];
export const unstruck = (inv) => ATTRIBUTES.filter((a) => !isStruck(inv, a.id));
export const usableAttributes = (inv) => unstruck(inv).map((a) => ({ ...a, value: attrValue(inv, a.id) }));

/** Highest unstruck attribute(s) — ties are the player's choice (ruling A2). */
export function highestUnstruck(inv) {
  const list = usableAttributes(inv);
  if (!list.length) return [];
  const top = Math.max(...list.map((a) => a.value));
  return list.filter((a) => a.value === top);
}

export const clockFull = (inv) => (inv.clock || 0) >= CLOCK_SEGMENTS;
export const openObligations = (inv) => (inv.obligations || []).filter((o) => !o.struck);
export const usableKeywords = (inv) => (inv.keywords || []).filter((k) => !k.struck);
export const allAttributesStruck = (inv) => unstruck(inv).length === 0;

export const activeThreats = (m) => (m.threats || []).filter((t) => !t.removed);
export const hasThreat = (m) => activeThreats(m).length > 0;
export const threatDone = (t) => (t.marks || 0) >= t.level;

export const clueSetList = (m) => Object.values(m.clueSets || {});
export const openSets = (m) => clueSetList(m).filter((s) => !s.truth && !s.falseLead);
export const truthSets = (m) => clueSetList(m).filter((s) => s.truth);
export const falseLeads = (m) => clueSetList(m).filter((s) => s.falseLead);
export const clueCount = (m) => clueSetList(m).reduce((n, s) => n + s.cards.length, 0);

export const dangerBand = (d) => (d <= 2 ? "low" : d <= 5 ? "mid" : d <= 8 ? "high" : "extreme");

// --- Normalization / migration ------------------------------------------------
// Back-fills every field added since v1 and clears spent once-per-X flags that a
// boundary would have cleared, so old saves never crash and never stay struck.
export function normalize(state) {
  const s = state && typeof state === "object" ? state : {};
  s.v = APP.schema;
  s.careers = s.careers && typeof s.careers === "object" ? s.careers : {};
  for (const c of Object.values(s.careers)) normalizeCareer(c);
  if (!s.activeId || !s.careers[s.activeId]) s.activeId = Object.keys(s.careers)[0] || null;
  s.journalOpen = !!s.journalOpen;
  return s;
}

export function normalizeCareer(c) {
  c.id = c.id || "career";
  c.name = c.name || "Untitled career";
  c.createdAt = c.createdAt || Date.now();
  c.rivals = Array.isArray(c.rivals) ? c.rivals : [];
  c.history = Array.isArray(c.history) ? c.history : [];
  c.questions = Array.isArray(c.questions) ? c.questions : [];
  // House aid (§4): the people and places you invent are yours, not the book's.
  c.cast = Array.isArray(c.cast) ? c.cast : [];
  c.journal = Array.isArray(c.journal) ? c.journal : [];
  c.rollLog = Array.isArray(c.rollLog) ? c.rollLog : [];

  // A career holds a party: one investigator solo, several in co-op (Ch.3).
  // Saves from before the party existed carry a single `investigator`, and
  // experience that belonged to the career rather than to the person.
  if (!Array.isArray(c.investigators)) c.investigators = c.investigator ? [c.investigator] : [];
  c.investigators = c.investigators.map(normalizeInvestigator);
  if (!c.investigators.length) c.investigators = [normalizeInvestigator({})];
  if (typeof c.xp === "number") {
    c.investigators[0].xp = (c.investigators[0].xp || 0) + c.xp;
    delete c.xp; // one counter, in one place
  }
  delete c.investigator;
  if (!c.investigators.some((i) => i.id === c.activeInvestigatorId)) {
    c.activeInvestigatorId = c.investigators[0].id;
  }
  if (c.mystery) normalizeMystery(c.mystery);
  return c;
}

export function normalizeInvestigator(inv) {
  inv.id = inv.id || uid();
  inv.xp = inv.xp || 0;
  inv.name = inv.name || "";
  inv.trait = inv.trait || "";
  inv.notes = inv.notes || "";
  inv.attributes = inv.attributes || { power: 0, insight: 0, method: 0 };
  for (const a of ATTRIBUTES) {
    inv.attributes[a.id] = Math.min(ATTRIBUTE_MAX, inv.attributes[a.id] ?? 0);
  }
  inv.struck = inv.struck || {};
  inv.fatigue = Math.min(FATIGUE_BOXES, inv.fatigue || 0);
  inv.clock = Math.min(CLOCK_SEGMENTS, inv.clock || 0);
  inv.day = inv.day || 1;
  inv.obligations = (inv.obligations || []).map((o) => ({ id: o.id, text: o.text, struck: !!o.struck }));
  inv.keywords = (inv.keywords || []).map((k) => ({ id: k.id, text: k.text, signature: !!k.signature, struck: !!k.struck }));
  return inv;
}

export function normalizeMystery(m) {
  m.genre = m.genre || "noir";
  m.difficulty = m.difficulty || "standard";
  m.danger = m.danger || 0;
  m.clueDeck = m.clueDeck || [];
  m.clueDiscard = m.clueDiscard || [];
  m.truthDeck = m.truthDeck || [];
  m.truthRevealed = m.truthRevealed || [];
  m.setAside = m.setAside || [];
  m.clueSets = m.clueSets || {};
  for (const s of Object.values(m.clueSets)) {
    s.cards = s.cards || [];
    s.entries = s.entries || (s.description ? [s.description] : []);
    s.prompts = Array.isArray(s.prompts) ? s.prompts : [];
    s.truthCards = s.truthCards || [];
    s.truth = !!s.truth;
    s.falseLead = !!s.falseLead;
  }
  m.threats = (m.threats || []).map((t) => ({ ...t, marks: t.marks || 0, removed: !!t.removed, attachedTo: t.attachedTo || null }));
  m.scene = m.scene || null;
  if (m.scene) {
    m.scene.participants = Array.isArray(m.scene.participants) ? m.scene.participants : [];
    m.scene.actorId = m.scene.actorId || null;
  }
  // Setup step 6: play begins with an investigation scene, so the picker has to
  // know whether anything has been played yet. A save from before this counter
  // existed is read from what it has already done rather than assumed fresh.
  if (typeof m.scenesPlayed !== "number") {
    const started = (m.clueDiscard || []).length || Object.keys(m.clueSets || {}).length
      || (m.truthRevealed || []).length || m.scene || m.ended;
    m.scenesPlayed = started ? 1 : 0;
  }
  m.round = m.round && typeof m.round === "object" ? { mode: m.round.mode === "shared" ? "shared" : "individual", scenes: m.round.scenes || {} } : null;
  m.jokersDrawn = m.jokersDrawn || 0;
  m.ended = !!m.ended;
  return m;
}
