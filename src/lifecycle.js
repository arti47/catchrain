// Scene and day boundaries. The app owns these events; each one reports what it
// changed and is covered by the single-step undo in the store.

import { uid } from "./core.js";
import { RIVAL_SLOTS } from "../data.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { discardClue, establishTruth } from "./deck.js";
import { Settings } from "./settings.js";
import * as Roller from "./roller.js";

export function startScene(type) {
  const m = Store.career.mystery;
  m.scene = { id: uid(), type, stage: null, order: [], index: 0, done: false, forceEscape: false, startedAt: Date.now() };
  return m.scene;
}

// --- Investigation ------------------------------------------------------------
export async function beginInvestigation(manualDie) {
  const m = Store.career.mystery;
  const events = [];
  const res = Roller.investigationRoll(manualDie);
  const scene = startScene("investigation");
  events.push({ t: "investigation_roll", die: res.die, danger: res.danger, total: res.total, text: res.row.text });
  if (res.row.threatLevel > 0) {
    await Roller.introduceThreat(res.row.threatLevel, events, "the investigation roll");
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
export async function restScene(prompts) {
  const c = Store.career, inv = c.investigator, m = c.mystery;
  const events = [];
  const die = await Roller.rollD6("Rest");
  const before = inv.fatigue;
  inv.fatigue = Math.max(0, inv.fatigue - die);
  events.push({ t: "rest", die, cleared: before - inv.fatigue, fatigue: inv.fatigue });
  const wasStruck = Object.keys(inv.struck).filter((k) => inv.struck[k]);
  inv.struck = {};
  if (wasStruck.length) events.push({ t: "attributes_cleared", attributes: wasStruck });
  let sig = 0;
  for (const k of inv.keywords) if (k.signature && k.struck) { k.struck = false; sig++; }
  if (sig) events.push({ t: "signature_cleared", count: sig });
  const res = await discardClue(m, (prompts && prompts.pickFalseLead) || Roller.getPrompts().pickFalseLead);
  events.push(...res.events);
  Roller.checkDeckEmpty(events);
  Store.log({ kind: "rest", dice: [die], total: die });
  return events;
}

export async function obligationScene(obligationId) {
  const c = Store.career, inv = c.investigator, m = c.mystery;
  const events = [];
  const ob = inv.obligations.find((o) => o.id === obligationId);
  if (!ob || ob.struck) return null;
  ob.struck = true;
  events.push({ t: "obligation_attended", text: ob.text });
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
  Store.log({ kind: "truth", label: `set of ${rank}s`, total: out.drawn.length });
  return out;
}

// --- Clock and day ------------------------------------------------------------
/** End of any scene: mark the clock, and run the day boundary when it fills. */
export function endScene() {
  const c = Store.career, inv = c.investigator, m = c.mystery;
  const events = [];
  if (m.scene) { m.scene.done = true; events.push({ t: "scene_end", type: m.scene.type }); }
  inv.clock += 1;
  events.push({ t: "clock", value: inv.clock });
  // Threats do not persist past an investigation scene; one may become a rival.
  const leftover = D.activeThreats(m);
  if (leftover.length) events.push({ t: "threats_left", names: leftover.map((t) => t.name) });
  m.threats = [];
  const dayOver = D.clockFull(inv);
  return { events, dayOver, leftover };
}

/** The day boundary bundle: obligations bite, the clock clears, a random event happens. */
export function dayBoundary() {
  const c = Store.career, inv = c.investigator;
  const events = [];
  const open = D.openObligations(inv);
  events.push({ t: "day_end", day: inv.day, neglected: open.map((o) => o.text) });
  return { events, pendingFatigue: open.length, open };
}

export async function applyDayBoundary() {
  const c = Store.career, inv = c.investigator;
  const events = [];
  const open = D.openObligations(inv);
  if (open.length) await Roller.markFatigue(open.length, events);
  inv.clock = 0;
  for (const o of inv.obligations) o.struck = false;
  inv.day += 1;
  events.push({ t: "day_start", day: inv.day });
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
