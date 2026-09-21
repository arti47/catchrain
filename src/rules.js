// Pure rules lookups over the data library. No state, no DOM.

import { d6, d66, d66Code, lookupRange, randInt } from "./core.js";
import * as D from "../data.js";

export const genre = (id) => D.GENRES[id] || D.GENRES.noir;
export const genreTable = (id, kind) => genre(id)[kind];

// House aid (labelled as such in the UI): rows the player has chosen to skip.
let blocked = new Set();
export const setBlocked = (list) => { blocked = new Set(list || []); };
export const blockedList = () => [...blocked];

/**
 * Roll 1d66 on a table. A filtered row does not become a near-miss: the roll is
 * redirected to a row the player has not blocked, and says so, rather than
 * re-rolling a handful of times and leaking one every so often.
 */
export function rollTable(table) {
  const r = d66();
  if (!blocked.size || !blocked.has(table[r.index])) {
    return { dice: r.dice, code: r.code, index: r.index, value: table[r.index], redirected: false };
  }
  const allowed = [];
  for (let i = 0; i < table.length; i++) if (!blocked.has(table[i])) allowed.push(i);
  if (!allowed.length) {
    return { dice: r.dice, code: r.code, index: r.index, value: table[r.index], redirected: false, allBlocked: true };
  }
  const i = allowed[randInt(allowed.length)];
  return { dice: r.dice, code: d66Code(i), index: i, value: table[i], redirected: true };
}
export const rollGenre = (id, kind) => rollTable(genreTable(id, kind));

export function rollTreachery() {
  const r = rollTable(D.TREACHERIES);
  return { ...r, needsSecondObject: D.TREACHERY_NEEDS_SECOND_OBJECT(r.index) };
}

export function rollName(mode = "tables") {
  if (mode === "affix") {
    const p = rollTable(D.NAME_PREFIX), s = rollTable(D.NAME_SUFFIX);
    return { name: p.value + s.value, parts: [p, s] };
  }
  const f = rollTable(D.FIRST_NAMES), l = rollTable(D.LAST_NAMES);
  return { name: `${f.value} ${l.value}`, parts: [f, l] };
}

export const rollYesNo = () => { const n = d6(); return { die: n, row: lookupRange(D.YES_NO, n) }; };

/** Subject oracles: action + focus, optionally a descriptor. */
export function rollSubject(withDescriptor = true) {
  const out = { action: rollTable(D.ORACLE_ACTION), focus: rollTable(D.ORACLE_FOCUS) };
  if (withDescriptor) out.descriptor = rollTable(D.ORACLE_DESCRIPTOR);
  return out;
}
export const subjectWords = (s) => [s.action?.value, s.descriptor?.value, s.focus?.value].filter(Boolean);

// --- Resolution lookups -------------------------------------------------------
export const investigationRow = (total) => lookupRange(D.INVESTIGATION_ROLL, total);
export const testOutcome = (total) => lookupRange(D.TEST_OUTCOMES, total);
export const consequenceRow = (total, multiplayer = false) =>
  lookupRange(multiplayer ? D.CONSEQUENCES_MULTI : D.CONSEQUENCES_SOLO, total);
export const difficulty = (id) => D.DIFFICULTIES.find((x) => x.id === id) || D.DIFFICULTIES[1];
export const threatLevelText = (lvl) => (D.THREAT_LEVELS.find((t) => t.level === lvl) || {}).text || "";
export const sceneType = (id) => D.SCENE_TYPES.find((s) => s.id === id);
export const stage = (id) => D.STAGES.find((s) => s.id === id);

/** Stage order for a scene: infiltration only when rolled 4+, escape only with a threat. */
export function stageOrder(startStage, hasThreat) {
  const order = ["infiltration", "discovery", "acquisition"];
  const from = order.indexOf(startStage === "infiltration" ? "infiltration" : "discovery");
  const seq = order.slice(from);
  if (hasThreat) seq.push("escape");
  return seq;
}

export const randomProblem = (genreId) => ({
  location: rollGenre(genreId, "locations"),
  object: rollGenre(genreId, "objects"),
  treachery: rollTreachery(),
});

export const problemText = (m) => {
  const t = m.treachery && m.treachery.includes("[object]") && m.secondObject
    ? m.treachery.replace("[object]", m.secondObject) : m.treachery;
  return `It happened at the ${m.location}. That's where the ${m.object} ${(t || "").toLowerCase()}.`;
};

export const randomMotivation = () => rollTable(D.MOTIVATIONS);
export const randomTrait = () => rollTable(D.TRAITS);
