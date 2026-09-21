// The dice engine. Every rule that charges something is charged here, not in the UI.
// Player decisions arrive through the `prompts` object so the engine stays testable.

import { roll2d6, d6, halveUp, uid, clamp, randInt } from "./core.js";
import { FATIGUE_BOXES, RIVAL_SLOTS } from "../data.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { drawClue, discardClue, strengthenFromDeck } from "./deck.js";
import { Settings } from "./settings.js";

/** Default prompts: used by tests and by any path with no player present. */
export const autoPrompts = {
  /** Manual-dice mode asks for every resolution die; digital mode never calls this. */
  enterDie: null,
  pickFalseLead: (sets) => sets[0],
  pickStrike: (options) => options[0],
  describeClue: async () => "",
  describeKeyword: async () => null,
  randomEvent: async () => {},
  note: () => {},
};

let prompts = autoPrompts;
export const setPrompts = (p) => { prompts = { ...autoPrompts, ...p }; };
export const getPrompts = () => prompts;

const multi = () => Settings.get("multiplayer");

/**
 * One d6 of resolution. With manual dice on, the player types the face they
 * rolled; table lookups (d66 oracles and genre tables) stay digital, since the
 * app is rolling those on the player's behalf rather than resolving an action.
 */
export async function rollD6(label) {
  if (Settings.get("manualDice") && prompts.enterDie) {
    const n = await prompts.enterDie(label);
    if (n >= 1 && n <= 6) return n;
  }
  return d6();
}

// --- Fatigue ------------------------------------------------------------------
/** Mark fatigue one box at a time; a full track strikes an attribute and carries the excess. */
export async function markFatigue(n, events = []) {
  const c = Store.career, inv = c.investigator, m = c.mystery;
  for (let i = 0; i < n; i++) {
    inv.fatigue += 1;
    if (inv.fatigue >= FATIGUE_BOXES) {
      inv.fatigue = 0;
      const options = D.highestUnstruck(inv);
      if (options.length) {
        const chosen = options.length === 1 ? options[0] : await prompts.pickStrike(options);
        const pickId = (chosen && chosen.id) || options[0].id;
        inv.struck[pickId] = true;
        events.push({ t: "attribute_struck", attribute: pickId });
      } else {
        events.push({ t: "all_struck" });
      }
      if (m && m.scene && m.scene.type === "investigation" && !m.scene.done) {
        if (!D.hasThreat(m)) await introduceThreat(1, events, "the track filling");
        m.scene.forceEscape = true;
        events.push({ t: "force_escape" });
      }
    }
  }
  events.push({ t: "fatigue", value: inv.fatigue });
  return events;
}

// --- Threats ------------------------------------------------------------------
export async function introduceThreat(level, events = [], cause = "") {
  const c = Store.career, m = c.mystery;
  let threat = null;
  if (Settings.get("rivals") && c.rivals.length) {
    const rollRival = await rollD6("Rival or new threat?");
    if (rollRival >= 4) {
      const slot = randInt(RIVAL_SLOTS) + 1;
      const rival = c.rivals[slot - 1];
      if (rival) {
        threat = { id: uid(), name: rival.name, level: Math.max(level, rival.level), marks: 0, removed: false, rivalId: rival.id, justIntroduced: true };
        events.push({ t: "rival_returns", name: rival.name, roll: rollRival, slot });
      }
    }
  }
  if (!threat) {
    const t = R.rollGenre(m.genre, "threats");
    threat = { id: uid(), name: t.value, code: t.code, level, marks: 0, removed: false, justIntroduced: true };
  }
  threat.level = clamp(threat.level, 1, 3);
  m.threats.push(threat);
  events.push({ t: "threat_in", name: threat.name, level: threat.level, cause });
  return threat;
}

/** A threat acts: 1d6 + its level on the consequences table. */
export async function threatActs(threat, events = []) {
  const die = await rollD6(`${threat.name} acts`);
  const total = die + threat.level;
  const row = R.consequenceRow(total, multi());
  events.push({ t: "threat_acts", name: threat.name, die, level: threat.level, total, row: row.id, text: row.text });
  await applyConsequence(row, events);
  return row;
}

/** Everything that did not act against gets its roll, except a threat just introduced. */
export async function threatsAct(exceptId, events = []) {
  const m = Store.career.mystery;
  for (const t of D.activeThreats(m).slice()) {
    if (t.id === exceptId || t.justIntroduced || t.removed) continue;
    await threatActs(t, events);
    if (m.ended) break;
  }
  return events;
}

export function clearJustIntroduced() {
  const m = Store.career.mystery;
  for (const t of m.threats) t.justIntroduced = false;
}

/** The clue deck running dry ends the mystery, whichever path emptied it. */
export function checkDeckEmpty(events = []) {
  const m = Store.career.mystery;
  if (!m || m.ended || (m.clueDeck || []).length > 0) return false;
  m.ended = true;
  m.endTrigger = "deck_empty";
  events.push({ t: "game_over", trigger: "deck_empty" });
  return true;
}

// --- Consequences -------------------------------------------------------------
export async function rollConsequence(events = [], bonus = 0) {
  const die = await rollD6("Consequences");
  const total = die + bonus;
  const row = R.consequenceRow(total, multi());
  events.push({ t: "consequence", die, bonus, total, row: row.id, text: row.text });
  await applyConsequence(row, events);
  return row;
}

export async function applyConsequence(row, events) {
  const c = Store.career, m = c.mystery;
  if (row.id === "threat_up") {
    const live = D.activeThreats(m);
    if (live.length) {
      const t = live.reduce((a, b) => (a.level <= b.level ? a : b)); // raise the least advanced first
      if (t.level < 3) { t.level += 1; events.push({ t: "threat_up", name: t.name, level: t.level }); }
      else events.push({ t: "threat_capped", name: t.name });
    } else {
      m.danger += multi() ? 3 : 1;
      events.push({ t: "danger", value: m.danger });
    }
  } else if (row.id === "discard") {
    const n = multi() ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const res = await discardClue(m, prompts.pickFalseLead);
      events.push(...res.events);
    }
  } else if (row.id === "fatigue1") {
    await markFatigue(1, events);
  } else if (row.id === "fatigue2") {
    await markFatigue(2, events);
  } else if (row.id === "end") {
    m.ended = true;
    m.endTrigger = "consequence";
    events.push({ t: "game_over", trigger: "consequence" });
  }
  checkDeckEmpty(events);
  return events;
}

// --- Clues --------------------------------------------------------------------
export async function gainClue(reason, events = []) {
  const m = Store.career.mystery;
  const res = await drawClue(m, "gain", prompts.pickFalseLead);
  events.push(...res.events.map((e) => ({ ...e, reason })));
  if (res.set) {
    const words = R.rollSubject(true);
    const suggestion = R.subjectWords(words).join(" · ");
    const clueWord = R.rollGenre(m.genre, "clues");
    const text = await prompts.describeClue({ set: res.set, card: res.card, oracle: suggestion, clue: clueWord.value, isNew: res.set.cards.length === 1 });
    if (text) { res.set.entries.push(text); res.set.description = res.set.entries.join(" — "); }
  }
  checkDeckEmpty(events);
  return { events, ...res };
}

// --- Keywords -----------------------------------------------------------------
export async function gainKeyword(events = []) {
  const c = Store.career, m = c.mystery;
  const k = R.rollGenre(m.genre, "keywords");
  const words = R.rollSubject(false);
  const text = await prompts.describeKeyword({ suggestion: k.value, oracle: R.subjectWords(words).join(" · ") });
  const value = (text || k.value).trim();
  c.investigator.keywords.push({ id: uid(), text: value, signature: false, struck: false });
  events.push({ t: "keyword_gained", text: value });
  return value;
}

/** Dice and outcome only — no effects. The re-roll keyword compares two of these. */
export function previewTest(attrId, manualDice) {
  const inv = Store.career.investigator;
  const dice = manualDice && manualDice.length === 2 ? manualDice.slice() : roll2d6();
  const attrValue = attrId ? D.attrValue(inv, attrId) : 0;
  const total = dice[0] + dice[1] + attrValue;
  return { dice, attrValue, total, outcome: R.testOutcome(total), doubles: dice[0] === dice[1] };
}

// --- The attribute test -------------------------------------------------------
/**
 * opts: { attrId, label, manualDice:[a,b], againstThreatId, inInvestigation }
 * Order of resolution follows the outcome table: outcome, then threats act,
 * then a doubles random event, then the sub-danger threat.
 */
export async function attributeTest(opts) {
  const c = Store.career, inv = c.investigator, m = c.mystery;
  const events = [];
  const dice = opts.manualDice && opts.manualDice.length === 2 ? opts.manualDice.slice() : roll2d6();
  const attrValue = opts.attrId ? D.attrValue(inv, opts.attrId) : 0;
  const total = dice[0] + dice[1] + attrValue;
  const outcome = R.testOutcome(total);
  const doubles = dice[0] === dice[1];
  const inScene = !!opts.inInvestigation && m && m.scene && m.scene.type === "investigation";
  const belowDanger = inScene && total < m.danger;

  events.push({ t: "test", label: opts.label, attribute: opts.attrId, attrValue, dice, total, outcome: outcome.id, doubles, belowDanger });

  // 1. the outcome
  if (opts.againstThreatId && outcome.id !== "failure") {
    const threat = m.threats.find((t) => t.id === opts.againstThreatId);
    if (threat && !threat.removed) {
      threat.marks = (threat.marks || 0) + (outcome.id === "success" ? 2 : 1);
      events.push({ t: "threat_marked", name: threat.name, marks: threat.marks, level: threat.level });
      if (D.threatDone(threat)) {
        threat.removed = true;
        events.push({ t: "threat_removed", name: threat.name });
        if (Settings.get("rivals") && threat.rivalId) {
          c.rivals = c.rivals.filter((r) => r.id !== threat.rivalId);
          events.push({ t: "rival_defeated", name: threat.name });
          await gainKeyword(events);
        }
      }
    }
  }
  if (outcome.gainKeyword) await gainKeyword(events);
  if (outcome.consequences) await rollConsequence(events);
  if (outcome.bonusClue && m && !m.ended) {
    const res = await gainClue("10+ bonus", events);
    void res;
  }

  // 2. threats that were not acted against
  if (inScene && !m.ended) await threatsAct(opts.againstThreatId, events);

  // 3. doubles: a random event
  if (doubles && !m.ended) {
    const subject = R.rollSubject(true);
    events.push({ t: "random_event", words: R.subjectWords(subject) });
    await prompts.randomEvent({ words: R.subjectWords(subject), context: "scene" });
  }

  // 4. rolled under danger: a new threat, and danger is halved
  if (belowDanger && !m.ended) {
    await introduceThreat(1, events, "rolling under danger");
    m.danger = halveUp(m.danger);
    events.push({ t: "danger", value: m.danger, note: "halved" });
  }

  clearJustIntroduced();
  Store.log({ kind: "test", label: opts.label || "", attribute: opts.attrId, attrValue, dice, total, outcome: outcome.id, manual: !!opts.manualDice });
  return { dice, total, outcome, events, doubles, belowDanger };
}

// --- Keyword actions ----------------------------------------------------------
export async function useKeyword(keyword, action, payload = {}) {
  const c = Store.career, m = c.mystery;
  const events = [];
  if (action === "eliminate") {
    const threat = m.threats.find((t) => t.id === payload.threatId);
    if (!threat) return null;
    threat.removed = true;
    events.push({ t: "threat_removed", name: threat.name, via: "keyword" });
    if (Settings.get("rivals") && threat.rivalId) {
      c.rivals = c.rivals.filter((r) => r.id !== threat.rivalId);
      events.push({ t: "rival_defeated", name: threat.name });
      await gainKeyword(events);
    }
  } else if (action === "strengthen") {
    const res = strengthenFromDeck(m, payload.rank);
    if (!res) return null;
    events.push({ t: "strengthen_clue", card: res.card, set: res.set, via: "keyword" });
    const text = await prompts.describeClue({ set: res.set, card: res.card, oracle: R.subjectWords(R.rollSubject(true)).join(" · "), clue: R.rollGenre(m.genre, "clues").value, isNew: false });
    if (text) { res.set.entries.push(text); res.set.description = res.set.entries.join(" — "); }
    checkDeckEmpty(events); // searching the deck for a card can empty it
  } else if (action === "reroll") {
    events.push({ t: "reroll", via: "keyword" });
  }
  keyword.struck = true;
  events.push({ t: "keyword_used", text: keyword.text, action });
  Store.log({ kind: "keyword", label: keyword.text, action });
  return events;
}

// --- Investigation roll -------------------------------------------------------
export function investigationRoll(manualDie) {
  const m = Store.career.mystery;
  const die = manualDie || d6();
  const total = die + m.danger;
  const row = R.investigationRow(total);
  Store.log({ kind: "investigation", dice: [die], danger: m.danger, total, outcome: row.startStage });
  return { die, danger: m.danger, total, row };
}
