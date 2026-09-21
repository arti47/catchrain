// Scene and day boundaries. The app owns these events; each one reports what it
// changed and is covered by the single-step undo in the store.

import { uid } from "./core.js";
import { RIVAL_SLOTS } from "../data.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { discardClue, establishTruth, rankName } from "./deck.js";
import { Settings } from "./settings.js";
import * as Roller from "./roller.js";

export function startScene(type, who) {
  const m = Store.career.mystery;
  const inv = who || Store.investigator;
  m.scene = { id: uid(), type, stage: null, order: [], index: 0, done: false, forceEscape: false, startedAt: Date.now(), actorId: inv ? inv.id : null, participants: [inv ? inv.id : null] };
  return m.scene;
}

// --- Rounds -------------------------------------------------------------------
// One segment of the clock. An investigation or truth scene is played by the
// whole party; otherwise each investigator takes a scene of their own, and the
// clock is only marked once everyone has had one (Ch.3, Game turns).

export function startRound(mode) {
  const m = Store.career.mystery;
  m.round = { mode, scenes: {} };
  return m.round;
}
export function recordRoundScene(type, who) {
  const m = Store.career.mystery;
  const inv = who || Store.investigator;
  if (!m.round) startRound(SHARED_SCENES.has(type) ? "shared" : "individual");
  m.round.scenes[inv.id] = { type, done: true };
  return m.round;
}
export const SHARED_SCENES = new Set(["investigation", "truth"]);
/** Who still owes the round a scene. Empty means the clock can be marked. */
export function pendingInvestigators() {
  const c = Store.career, m = c.mystery;
  if (!m.round) return c.investigators.slice();
  if (m.round.mode === "shared") return m.scene && m.scene.done ? [] : c.investigators.slice();
  return c.investigators.filter((i) => !(m.round.scenes[i.id] && m.round.scenes[i.id].done));
}
export const roundComplete = () => pendingInvestigators().length === 0;

// --- Investigation ------------------------------------------------------------
export async function beginInvestigation(manualDie, opts = {}) {
  const m = Store.career.mystery;
  const events = [];
  const res = Roller.investigationRoll(manualDie);
  const scene = startScene("investigation");
  // Everyone is in an investigation scene (Ch.3); in solo play that is one person.
  scene.participants = Store.party.map((i) => i.id);
  scene.actorId = Store.investigator ? Store.investigator.id : null;
  events.push({ t: "investigation_roll", die: res.die, danger: res.danger, total: res.total, text: res.row.text });
  if (res.row.threatLevel > 0) {
    // Nobody caused this one, so the players say who it is on (Ch.3, Threats).
    await Roller.introduceThreat(res.row.threatLevel, events, "the investigation roll", opts.threatOn || Store.investigator);
    Roller.clearJustIntroduced(); // it is present from the start of the scene
  }
  scene.order = R.stageOrder(res.row.startStage, D.hasThreat(m));
  scene.stage = scene.order[0];
  scene.index = 0;
  return { ...res, events, scene };
}

/** A successful stage test: +1 danger and move on. Acquisition grants the clue. */
export async function completeStage() {
  const m = Store.career.mystery;
  const scene = m.scene;
  const events = [];
  const finished = scene.stage;
  const hasThreat = D.hasThreat(m);
  // Danger is paid for MOVING to the next stage, not for finishing one: the
  // flowchart puts +1 on the arrows between stages and none on the way out.
  const sceneEnds = finished === "escape" || (finished === "acquisition" && !hasThreat);
  if (!sceneEnds) {
    m.danger += 1;
    events.push({ t: "danger", value: m.danger, note: "moving on" });
  }
  if (finished === "acquisition" && !m.ended) {
    const res = await Roller.gainClue("acquisition", events);
    void res;
  }
  if (sceneEnds) {
    scene.done = true;
    events.push({ t: "scene_end", type: "investigation" });
    return { events, done: true };
  }
  // Skip straight to escape when the fatigue track filled mid-scene.
  if (scene.forceEscape) {
    scene.stage = "escape";
    if (!scene.order.includes("escape")) scene.order.push("escape");
    scene.index = scene.order.indexOf("escape");
    events.push({ t: "stage", stage: "escape", forced: true });
    return { events, done: false };
  }
  let next = scene.order[scene.index + 1];
  if (!next && hasThreat) { scene.order.push("escape"); next = "escape"; }
  if (!next) { scene.done = true; events.push({ t: "scene_end", type: "investigation" }); return { events, done: true }; }
  scene.index = scene.order.indexOf(next);
  scene.stage = next;
  events.push({ t: "stage", stage: next });
  return { events, done: false };
}

// --- Other scene types --------------------------------------------------------
export async function restScene(prompts, who) {
  const c = Store.career, inv = who || Store.investigator, m = c.mystery;
  const events = [];
  const die = await Roller.rollD6("Rest");
  const before = inv.fatigue;
  inv.fatigue = Math.max(0, inv.fatigue - die);
  events.push({ t: "rest", die, cleared: before - inv.fatigue, fatigue: inv.fatigue, who: inv.name });
  const wasStruck = Object.keys(inv.struck).filter((k) => inv.struck[k]);
  inv.struck = {};
  if (wasStruck.length) events.push({ t: "attributes_cleared", attributes: wasStruck, who: inv.name });
  let sig = 0;
  for (const k of inv.keywords) if (k.signature && k.struck) { k.struck = false; sig++; }
  if (sig) events.push({ t: "signature_cleared", count: sig });
  const res = await discardClue(m, (prompts && prompts.pickFalseLead) || Roller.getPrompts().pickFalseLead);
  events.push(...res.events);
  Roller.checkDeckEmpty(events);
  Store.log({ kind: "rest", dice: [die], total: die, by: inv.name });
  return events;
}

export async function obligationScene(obligationId, who) {
  const c = Store.career, inv = who || Store.investigator, m = c.mystery;
  const events = [];
  const ob = inv.obligations.find((o) => o.id === obligationId);
  if (!ob || ob.struck) return null;
  ob.struck = true;
  events.push({ t: "obligation_attended", text: ob.text, who: inv.name });
  const subject = R.rollSubject(true);
  events.push({ t: "random_event", words: R.subjectWords(subject) });
  const res = await discardClue(m, Roller.getPrompts().pickFalseLead);
  events.push(...res.events);
  Roller.checkDeckEmpty(events);
  return { events, words: R.subjectWords(subject), obligation: ob };
}

export function truthScene(rank) {
  const m = Store.career.mystery;
  const out = establishTruth(m, rank);
  if (!out) return null;
  Store.log({ kind: "truth", label: `set of ${rankName(rank)}`, total: out.drawn.length });
  return out;
}

// --- Clock and day ------------------------------------------------------------
/** End of any scene: mark the clock, and run the day boundary when it fills. */
/** Once every scene of the round is finished, ALL investigators mark the clock (Ch.3). */
export function endScene() {
  const c = Store.career, m = c.mystery;
  const events = [];
  // The scene is over, so it is cleared rather than left lying about marked
  // done: a finished-but-not-cleared scene kept the play screen on "This scene
  // is finished" for good, and the only control on it marked the clock again.
  if (m.scene) { m.scene.done = true; events.push({ t: "scene_end", type: m.scene.type }); m.scene = null; }
  m.round = null;
  for (const inv of c.investigators) inv.clock += 1;
  const lead = Store.investigator;
  events.push({ t: "clock", value: lead.clock });
  // Threats do not persist past an investigation scene; one may become a rival.
  const leftover = D.activeThreats(m);
  if (leftover.length) events.push({ t: "threats_left", names: leftover.map((t) => t.name) });
  m.threats = [];
  const dayOver = c.investigators.every((i) => D.clockFull(i));
  return { events, dayOver, leftover };
}

/** The day boundary bundle: obligations bite, the clock clears, a random event happens. */
export function dayBoundary() {
  const c = Store.career;
  const events = [];
  const open = c.investigators.flatMap((inv) => D.openObligations(inv));
  events.push({ t: "day_end", day: Store.investigator.day, neglected: open.map((o) => o.text) });
  return { events, pendingFatigue: open.length, open };
}

export async function applyDayBoundary() {
  const c = Store.career;
  const events = [];
  // Each investigator answers for their own obligations.
  for (const inv of c.investigators) {
    const open = D.openObligations(inv);
    if (open.length) await Roller.markFatigue(open.length, events, inv);
    inv.clock = 0;
    for (const o of inv.obligations) o.struck = false;
    inv.day += 1;
  }
  events.push({ t: "day_start", day: Store.investigator.day });
  const subject = R.rollSubject(true);
  events.push({ t: "random_event", words: R.subjectWords(subject), resolveWithTest: true });
  return { events, words: R.subjectWords(subject) };
}

export function addRival(threat) {
  const c = Store.career;
  if (!Settings.get("rivals")) return null;
  const rival = { id: uid(), name: threat.name, level: Math.max(2, threat.level) };
  if (c.rivals.length >= RIVAL_SLOTS) return { full: true, rival };
  c.rivals.push(rival);
  return { rival };
}
export function replaceRival(slotIndex, rival) {
  const c = Store.career;
  c.rivals[slotIndex] = rival;
}
