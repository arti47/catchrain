// The guide: what to do next, in one sentence, on every screen.
//
// The rest of the app is correct and says almost nothing. This module is the
// opposite — it holds no rules of its own, reads the live state, and answers
// the only question a player who has not read the book actually has: what do I
// press now, and what will it cost me? Every sentence here is derived, never
// canned: if the state changes the sentence changes, so it cannot go stale.

import { el, add } from "./core.js";
import { FATIGUE_BOXES, CLOCK_SEGMENTS, DECK, SCENE_TYPES } from "../data.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import { btn, modal, section, defRow } from "./ui.js";

const go = (name) => import("./router.js").then((m) => m.go(name));

/** Plural without the "(s)". */
const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// --- How close the case is to ending, in words rather than numbers ------------
/**
 * The book gives four ways out and no sense of which is coming. This says which
 * one is nearest, and what a guess is worth if you stop now.
 */
export function readiness(m) {
  const unseen = (m.truthDeck || []).length + DECK.setAside;
  const ruledOut = (m.truthRevealed || []).length;
  // Three guesses against `unseen` cards, three of which are the answer.
  const expected = unseen ? Math.round((DECK.setAside * DECK.setAside / unseen) * 10) / 10 : 0;
  const deck = (m.clueDeck || []).length;
  const ends = [];
  if (deck <= 8) ends.push(`the clue deck is down to ${n(deck, "card", "cards")} — when it empties the case ends whether you are ready or not`);
  if (m.danger >= 7) ends.push(`danger is ${m.danger}, so every investigation now starts with something already on to you`);
  return {
    unseen, ruledOut, expected, deck,
    guess: unseen
      ? `${ruledOut ? `${n(ruledOut, "card is", "cards are")} ruled out` : "Nothing is ruled out yet"} and ${unseen} you have never seen, three of which are the answer. Guessing now, expect about ${expected} of 3 right.`
      : "Every face card is accounted for.",
    pressure: ends,
  };
}

// --- What to do next ----------------------------------------------------------
/**
 * One step, derived from state. `press` names the control that does it, on the
 * screen `route` — the guide points at the real button rather than growing a
 * second one, so there is never a question of which of two things acted.
 */
export function nextStep(currentRoute) {
  const c = Store.career;
  const inv = Store.investigator;
  const m = c && c.mystery;

  if (!c || !inv || !inv.name) {
    // Someone mid-wizard is coached through it; everyone else is offered the
    // one tap that skips it, because the slow path should never be the advice.
    if (currentRoute === "wizard") {
      return { id: "in-wizard", route: "wizard", press: "Create the investigator",
        say: "Four steps, and every one of them has a Roll button.",
        why: "Spread 2, 1 and 0 across the three attributes — the 2 is what they reach for first. Then one obligation (neglect it and the day costs you a fatigue), one signature keyword (your reusable favour, back after every rest), and a name. Nothing is permanent; the sheet edits all of it." };
    }
    return { id: "start-playing", route: "home", press: "Start playing",
      say: "Press Start playing — it rolls everything and deals you into the first scene.",
      why: "An investigator is three numbers, an obligation, a keyword, a name and a trait; a case is a place, a thing and something bad that happened to it. Rolling them is how the book expects you to start, and none of it is permanent — the sheet rewrites any of it. If you would rather choose, make one yourself from the button under the panel." };
  }
  if (!m) {
    if (currentRoute === "mystery") {
      return { id: "in-mystery-wizard", route: "mystery", press: "Start the mystery",
        say: "Press Roll all three, take a motivation, then start it.",
        why: "The sentence those three rolls make is the whole premise, and you are not supposed to know what it means yet — working that out is the game. Difficulty changes how much help you get: Standard is the default, Easy reveals three face cards for free." };
    }
    return { id: "make-mystery", route: "mystery", press: "Start the mystery",
      say: `Roll the case ${inv.name} walks into.`,
      why: "A place, a thing, and something bad that happened to it. You are not supposed to know what it means yet — that is the game. Press Roll all three, take a motivation, and the app shuffles both decks for you." };
  }
  if (m.solved) {
    return { id: "close-case", route: "solve", press: "Close the case",
      say: "Write up what you learned, then close the case.",
      why: "Every correct guess buys one answer, and whatever you write as the answer is true. Closing files the case in your history, banks the experience, and halves the danger going into the next one." };
  }
  if (m.ended) {
    return { id: "resolve", route: "solve", press: "Reveal the three cards",
      say: "The case is over. Name the three cards you never saw.",
      why: `${m.endTrigger === "deck_empty" ? "The clue deck ran out." : m.endTrigger === "consequence" ? "A consequence forced your investigator out." : "You chose to stop."} Pick a card for each of the three questions, then turn them over. ${readiness(m).guess}` };
  }

  const scene = m.scene;
  const party = Store.party;

  if (scene && !scene.done) {
    if (D.allAttributesStruck(inv)) {
      return { id: "spent", route: "play", press: R.stage(scene.stage) ? R.stage(scene.stage).action : "the stage button", tone: "warn",
        say: `${inv.name} has nothing left to test with — press the stage button and take "Leave the scene".`,
        why: "Every attribute is struck, so no test can be made and a scene only ends on a test. Leaving costs you the clue and the stage, and then a rest clears every strike." };
    }
    if (scene.type === "investigation") {
      const st = R.stage(scene.stage);
      const threats = D.activeThreats(m);
      const warn = inv.fatigue >= FATIGUE_BOXES - 1
        ? `You are at ${inv.fatigue} of ${FATIGUE_BOXES} fatigue: one more mark strikes your best attribute and throws you into the escape stage.`
        : null;
      return { id: `stage-${scene.stage}`, route: "play", press: st.action, tone: warn ? "warn" : null, warn,
        say: `${st.action} — one successful test clears this stage.`,
        why: [
          `${st.note} Pick the attribute that fits what your investigator is actually doing, not the biggest number; a struck one is not offered.`,
          "7 or more succeeds. Below 7 fails and hands you a keyword. Either way, anything under 10 brings a consequence.",
          threats.length
            ? `${threats.map((t) => `${t.name} (level ${t.level})`).join(" and ")} ${threats.length === 1 ? "is" : "are"} in here with you and ${threats.length === 1 ? "rolls" : "roll"} against you after every test you do not act against ${threats.length === 1 ? "it" : "them"}. You cannot leave until the escape stage is cleared.`
            : "Nothing is in your way, so taking the clue ends the scene.",
        ].join(" ") };
    }
    return { id: "finish-scene", route: "play", press: "Done",
      say: "Finish the scene that is open.",
      why: "The dialog is waiting on you." };
  }

  if (scene && scene.done) {
    const waiting = party.length > 1 ? party.filter((i) => !(m.round && m.round.scenes[i.id])) : [];
    if (waiting.length) {
      return { id: "hand-over", route: "play", press: `Play as ${waiting[0].name}`,
        say: `Hand the device to ${waiting[0].name} — everyone takes a scene before the clock moves.`,
        why: `${n(waiting.length, "investigator", "investigators")} still ${waiting.length === 1 ? "owes" : "owe"} a scene this round. The clock is marked once, for all of you, when the last one is done.` };
    }
    return { id: "end-scene", route: "play", press: "End the scene",
      say: "Mark the clock, then choose the next scene.",
      why: `Every scene fills one of the ${CLOCK_SEGMENTS} segments of the day. When the fourth fills, any obligation you have not attended costs you a fatigue, strikes clear, and a random event opens the new day.` };
  }

  // --- The picker: one recommendation, and the reason ------------------------
  const open = D.openSets(m);
  const best = open.slice().sort((a, b) => b.cards.length - a.cards.length)[0];
  const read = readiness(m);
  const owed = D.openObligations(inv);
  const lastSegment = (inv.clock || 0) >= CLOCK_SEGMENTS - 1;

  if (inv.fatigue >= FATIGUE_BOXES - 1 || D.unstruck(inv).length < 3) {
    return { id: "pick-rest", route: "play", press: "Rest", tone: "warn",
      say: "Rest before anything else.",
      why: `${inv.fatigue >= FATIGUE_BOXES - 1 ? `At ${inv.fatigue} of ${FATIGUE_BOXES} fatigue the next consequence strikes out your best attribute. ` : ""}${D.unstruck(inv).length < 3 ? "A struck attribute cannot be used at all until you rest. " : ""}A rest clears 1d6 fatigue and every attribute strike, and gives your signature keyword back. It costs one card off the clue deck and one segment of the day.` };
  }
  if (lastSegment && owed.length) {
    return { id: "pick-obligation", route: "play", press: "Obligation",
      say: `Attend "${owed[0].text}" — the day turns after this scene.`,
      why: "Every obligation you have not attended when the day turns costs you a fatigue. Attending is a scene like any other: it strikes the obligation until tomorrow and costs one card off the clue deck." };
  }
  if (best && best.cards.length >= 2) {
    return { id: "pick-truth", route: "play", press: "Truth",
      say: `Turn the ${best.rank}s over — ${n(best.cards.length, "card", "cards")} means ${n(best.cards.length, "truth card", "truth cards")} ruled out.`,
      why: `A truth scene reveals as many face cards as the set has cards, and those cards can never be the answer — that is how you stop guessing blind. It also makes the set joker-proof, so a false lead can never burn it. ${read.guess}` };
  }
  if (best && read.pressure.length) {
    return { id: "pick-truth-pressure", route: "play", press: "Truth",
      say: `Turn the ${best.rank}s over while you still can.`,
      why: `${read.pressure.join("; ")}. Each truth scene rules a card out for good. ${read.guess}` };
  }
  return { id: "pick-investigation", route: "play", press: "Investigation scene",
    say: open.length ? "Go and find another clue." : "Go and find your first clue.",
    why: `An investigation rolls 1d6 plus your danger of ${m.danger}: 4 or more and something is already in your way. Then one test per stage, and clearing acquisition draws a card — a new rank starts a clue set, a repeat makes one stronger. ${read.pressure.length ? read.pressure.join("; ") + "." : "Danger rises by one every time you move between stages."}` };
}

// --- The bar ------------------------------------------------------------------
/**
 * Sits above every screen. When the control it names is on the screen you are
 * looking at, it says so rather than growing a duplicate of it: one button ever
 * does one thing, which is also the only way the audit stays honest.
 */
export function coachBar(currentRoute) {
  if (!Settings.get("coach")) return null;
  const step = nextStep(currentRoute);
  const here = step.route === currentRoute;
  const wrap = el("div", { class: `coach ${step.tone || ""}`.trim(), role: "status" });
  add(wrap,
    el("p", { class: "coach-say" }, el("span", { class: "coach-mark", "aria-hidden": "true" }, "›"), el("span", { text: step.say })),
    step.warn ? el("p", { class: "coach-warn", text: step.warn }) : null,
    here
      ? el("p", { class: "coach-here", text: `Press “${step.press}” on this screen.` })
      : null);
  add(wrap, el("div", { class: "coach-row" },
    here ? null : btn(step.press ? `Go: ${step.press}` : "Take me there", () => go(step.route), "primary"),
    btn("Why?", () => explainStep(step), "ghost")));
  return wrap;
}

/** The long answer, for the moment you are actually in. */
export function explainStep(step = nextStep()) {
  const c = Store.career, inv = Store.investigator, m = c && c.mystery;
  const body = el("div", {});
  add(body, el("p", { class: "premise", text: step.say }));
  add(body, el("p", { text: step.why }));

  if (m && !m.ended && !(m.scene && !m.scene.done)) {
    const list = el("div", {});
    for (const t of SCENE_TYPES) {
      const barred = sceneNote(t.id, m, inv);
      add(list, defRow(t.name, el("p", { class: "small", text: barred || COSTS[t.id] })));
    }
    add(body, section("Your other options right now", list));
  }

  if (m && !m.solved) {
    const read = readiness(m);
    const line = (k, v) => defRow(k, el("p", { class: "small", text: v }));
    add(body, section("How this ends",
      el("p", { class: "small", text: "Four ways out. Only the first one is yours to choose \u2014 the other three arrive whether you are ready or not, which is why it is worth stopping while the stopping is good." }),
      line("You stop", "Resolve the mystery at the end of any scene. This is the ending you want."),
      line("The deck runs out", `${read.deck} clue cards left. Rest and obligation scenes each burn one.`),
      line("A consequence", `9 or more on the consequences table ends it on the spot. Danger is ${m.danger}, and a threat adds its level to that roll.`),
      line("Fatigue", `${inv.fatigue} of ${FATIGUE_BOXES}. A full track strikes out an attribute and throws you into the escape stage \u2014 it does not end the case, but it is how cases end.`),
      el("p", { class: "small muted", text: read.guess })));
  }

  modal({
    title: "What do I do now?",
    body,
    actions: [{ label: "Got it" }, { label: "The whole sequence", kind: "ghost", onClick: () => go("tutorial") }],
  });
}

const COSTS = {
  investigation: "Clues, but danger rises and threats act. The only scene that finds anything.",
  truth: "Rules a face card out for good and makes the clue set joker-proof. Costs nothing but the scene.",
  rest: "Clears 1d6 fatigue and every attribute strike. Costs one card off the clue deck.",
  obligation: "Keeps the day boundary from biting. Costs one card off the clue deck.",
};

/** Why a scene is not available, in the same words the picker uses. */
function sceneNote(type, m, inv) {
  if (type === "truth" && !D.openSets(m).length) return "Not yet — you need a clue set that is not already a truth or a false lead.";
  if (type === "obligation" && !D.openObligations(inv).length) return "Not today — every obligation is attended.";
  return null;
}
