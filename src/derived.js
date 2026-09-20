// Pure derivations over investigator + mystery state, plus normalization/migration.

import { FATIGUE_BOXES, CLOCK_SEGMENTS, ATTRIBUTES, ATTRIBUTE_MAX } from "../data.js";
import { APP } from "./core.js";

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

export const fatigueFull = (inv) => (inv.fatigue || 0) >= FATIGUE_BOXES;
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

/** The four end-of-game thresholds, live for the persistent header. */
export const endState = (m) => ({
  deckEmpty: (m.clueDeck || []).length === 0,
  ended: !!m.ended,
  truthsLeft: (m.truthDeck || []).length,
  known: (m.truthRevealed || []).length,
});

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
  c.xp = c.xp || 0;
  c.rivals = Array.isArray(c.rivals) ? c.rivals : [];
  c.history = Array.isArray(c.history) ? c.history : [];
  c.questions = Array.isArray(c.questions) ? c.questions : [];
  c.journal = Array.isArray(c.journal) ? c.journal : [];
  c.rollLog = Array.isArray(c.rollLog) ? c.rollLog : [];
  c.investigator = normalizeInvestigator(c.investigator || {});
  if (c.mystery) normalizeMystery(c.mystery);
  return c;
}

export function normalizeInvestigator(inv) {
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
    s.truthCards = s.truthCards || [];
    s.truth = !!s.truth;
    s.falseLead = !!s.falseLead;
  }
  m.threats = (m.threats || []).map((t) => ({ ...t, marks: t.marks || 0, removed: !!t.removed }));
  m.scene = m.scene || null;
  m.jokersDrawn = m.jokersDrawn || 0;
  m.ended = !!m.ended;
  return m;
}
