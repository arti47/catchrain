// The play screen: choosing a scene, running the investigation stages, and the
// boundaries between them. Controls are ordered by the book's sequence of play.

import { el, add } from "./core.js";
import { SCENE_TYPES, CLOCK_SEGMENTS, END_TRIGGERS } from "../data.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import * as Roller from "./roller.js";
import * as Life from "./lifecycle.js";
import { eventList } from "./prompts.js";
import { useKeywordFlow } from "./sheet.js";
import { rankName } from "./deck.js";
import { framingCard, framingLines } from "./framing.js";
import { SCENE_FRAMING } from "../data.js";
const SCENE_FRAMING_NOTE = SCENE_FRAMING.note;
import { go } from "./router.js";
import { section, row, btn, pill, explain, modal, chooseModal, confirmModal, promptModal, showToast, actionBar, emptyState, dieFace } from "./ui.js";

const rerender = () => import("./router.js").then((m) => m.render());

// --- Result presentation ------------------------------------------------------
function diceRow(dice, attrValue, total, doubles) {
  const wrap = el("div", { class: "dice" });
  for (const d of dice) add(wrap, dieFace(d, doubles ? "doubles" : ""));
  add(wrap, el("span", { class: "math", text: `${dice.join(" + ")}${attrValue ? ` + ${attrValue}` : ""} = ${total}` }));
  return wrap;
}

function showResult(title, res, extraEvents = [], onReroll) {
  const body = el("div", {});
  add(body,
    diceRow(res.dice, res.attrValue || 0, res.total, res.doubles),
    el("p", { class: `outcome ${res.outcome.id}`, text: `${res.outcome.name} — ${res.outcome.text}` }),
    eventList([...(res.events || []), ...extraEvents]));
  const actions = [{ label: "Continue" }];
  if (onReroll) actions.push({ label: "Re-roll with a keyword", kind: "ghost", onClick: () => { setTimeout(onReroll, 40); } });
  modal({ title, body, actions });
}

// --- Dice input ---------------------------------------------------------------
async function manualDicePair(label) {
  const text = await promptModal({
    title: "Enter your dice", message: `${label}: type the two d6 faces you rolled, e.g. 4 3.`, placeholder: "4 3",
  });
  if (!text) return null;
  const parts = text.split(/[^1-6]+/).filter(Boolean).map(Number).slice(0, 2);
  if (parts.length !== 2) { showToast("Enter two numbers from 1 to 6."); return null; }
  return parts;
}
async function manualDie(label) {
  const text = await promptModal({ title: "Enter your die", message: `${label}: type the d6 face you rolled.`, placeholder: "4" });
  const n = Number((text || "").trim());
  return n >= 1 && n <= 6 ? n : null;
}

// --- Choosing an attribute ----------------------------------------------------
async function chooseAttribute(purpose, who) {
  const inv = who || Store.investigator;
  const usable = D.usableAttributes(inv);
  if (!usable.length) {
    // Ruling A22: with every attribute struck there is no test left to make,
    // and the book gives no way out of a scene except a successful test. The
    // rest it asks for is itself a scene, so without a door here the session
    // has nowhere to go. They leave empty-handed instead.
    const m = Store.mystery;
    const stuck = m && m.scene && !m.scene.done;
    modal({
      title: "Nothing left to try",
      body: el("div", {},
        el("p", { text: `Every one of ${inv.name}'s attributes is struck. They need to rest before testing anything else.` }),
        stuck ? el("p", { class: "small muted", text: "There is no test left to make here, so the only thing left is to get out. The scene ends where it stands: no clue, no stage cleared — then rest." }) : null),
      actions: stuck
        ? [{ label: "Leave the scene", onClick: () => { setTimeout(leaveSceneSpent, 40); } }, { label: "Back", kind: "ghost" }]
        : [{ label: "Back" }],
    });
    return null;
  }
  const struck = D.unstruck(inv).length < 3
    ? "A struck attribute is missing from this list: your investigator must find another approach."
    : null;
  return await chooseModal({
    title: purpose,
    message: struck || "Which approach fits what your investigator is doing?",
    options: usable.map((a) => ({ value: a.id, label: `${a.name} ${a.value}`, note: a.text })),
  });
}

/** The way out of a scene nobody can test their way out of (ruling A22). */
async function leaveSceneSpent() {
  const m = Store.mystery;
  if (!m || !m.scene || m.scene.done) return;
  const type = R.sceneType(m.scene.type).name.toLowerCase();
  Store.update("leave the scene spent", () => { m.scene.done = true; });
  Store.journal("scene", `${Store.investigator.name} is spent \u2014 every attribute struck \u2014 and leaves the ${type} scene empty-handed.`);
  showToast("You are out. Rest before the next one.");
  await rerender();
}

// --- Running a test -----------------------------------------------------------
async function runTest({ label, purpose, againstThreatId, stageTest }) {
  const actor = await chooseActor(label);
  if (!actor) return;
  const attrId = await chooseAttribute(purpose || label, actor);
  if (!attrId) return;
  let manual = null;
  if (Settings.get("manualDice")) {
    manual = await manualDicePair(`${label}${Store.party.length > 1 ? ` \u2014 ${actor.name}` : ""}`);
    if (!manual) return;
  }
  await applyTest({ attrId, label, manual, againstThreatId, stageTest, undoLabel: label, actorId: actor.id });
}

/**
 * Who makes this test. In co-op the spotlight is meant to move around, so the
 * chooser says who has and has not acted in this scene (Ch.3, Sharing the narration).
 */
async function chooseActor(label) {
  const party = Store.party;
  if (party.length < 2) return Store.investigator;
  const scene = Store.mystery.scene;
  const rolls = (scene && scene.rolls) || {};
  const id = await chooseModal({
    title: "Who acts?",
    message: "Everyone should get their hands on the scene at least once.",
    options: party.map((i) => ({
      value: i.id,
      label: i.name,
      note: `${rolls[i.id] ? `${rolls[i.id]} test(s) this scene` : "has not acted yet"} \u00b7 ${D.usableAttributes(i).map((a) => `${a.name[0]}${a.value}`).join(" ")}`,
    })),
  });
  if (!id) return null;
  Store.setActive(id);
  return Store.investigatorById(id);
}

/** Rolls (or replays) one test, applies it, and offers the re-roll keyword. */
async function applyTest({ attrId, label, manual, againstThreatId, stageTest, undoLabel, actorId }) {
  const m = Store.mystery;
  const actor = (actorId && Store.investigatorById(actorId)) || Store.investigator;
  Store.begin(undoLabel);
  if (m.scene) {
    m.scene.rolls = m.scene.rolls || {};
    m.scene.rolls[actor.id] = (m.scene.rolls[actor.id] || 0) + 1;
  }
  const res = await Roller.attributeTest({
    attrId, label, manualDice: manual, againstThreatId, actorId: actor.id,
    inInvestigation: !!(m.scene && m.scene.type === "investigation" && !m.scene.done),
  });
  const extra = [];
  if (stageTest && res.outcome.id !== "failure" && !m.ended) {
    const out = await Life.completeStage();
    extra.push(...out.events);
  }
  Store.journal("test", `${actor.name} \u2014 ${label}: ${res.dice.join("+")}${res.attrValue ? `+${res.attrValue}` : ""} = ${res.total} (${res.outcome.name}).`, { outcome: res.outcome.id });
  Store.commit();
  const spare = spendableOnReroll(actor);
  const onReroll = spare.length && !Store.mystery.ended
    ? () => rerollFlow({ attrId, label, againstThreatId, stageTest, actorId: actor.id, first: { dice: res.dice, total: res.total, outcome: res.outcome, attrValue: res.attrValue } })
    : null;
  showResult(Store.party.length > 1 ? `${actor.name} \u2014 ${label}` : label, { ...res, attrValue: D.attrValue(actor, attrId) }, extra, onReroll);
  await rerender();
}

/**
 * What can pay for a re-roll: only the keywords the actor already held when the
 * test was made. A failure hands one over, and the re-roll undoes the test,
 * which takes it straight back — so it was never in hand to spend, and offering
 * it threw and swallowed the whole test.
 */
function spendableOnReroll(actor) {
  const inHand = D.usableKeywords(actor);
  const before = Store.peekUndo();
  const career = before && before.activeId ? before.careers[before.activeId] : null;
  const was = career && (career.investigators || []).find((i) => i.id === actor.id);
  if (!was) return inHand;
  const had = new Set((was.keywords || []).filter((k) => !k.struck).map((k) => k.id));
  return inHand.filter((k) => had.has(k.id));
}

/**
 * The re-roll keyword: the test un-happens, the keyword is struck, the dice are
 * thrown again, and whichever of the two outcomes the player keeps is applied.
 */
async function rerollFlow({ attrId, label, againstThreatId, stageTest, first, actorId }) {
  const actor = (actorId && Store.investigatorById(actorId)) || Store.investigator;
  const spare = spendableOnReroll(actor);
  if (!spare.length) { showToast("No keyword left to spend."); return; }
  const id = await chooseModal({
    title: `Spend which of ${actor.name}'s keywords?`,
    message: "Striking it buys one re-roll of this test. You will see both outcomes and keep either.",
    options: spare.map((k) => ({ value: k.id, label: k.text, note: k.signature ? "Signature — comes back when you rest" : "One use" })),
  });
  if (!id) return;

  Store.undo();
  const keyword = (Store.investigatorById(actor.id) || Store.investigator).keywords.find((k) => k.id === id);
  if (!keyword) { showToast("That keyword is no longer in hand."); await rerender(); return; }
  let manual = null;
  if (Settings.get("manualDice")) {
    manual = await manualDicePair(`${label} (re-roll)`);
    if (!manual) { await rerender(); return; }
  }
  const second = Roller.previewTest(attrId, manual, actor);
  const keep = await chooseModal({
    title: "Which outcome stands?",
    allowCancel: false,
    options: [
      { value: "second", label: `New: ${second.dice.join(" + ")}${second.attrValue ? ` + ${second.attrValue}` : ""} = ${second.total}`, note: second.outcome.name },
      { value: "first", label: `First: ${first.dice.join(" + ")}${first.attrValue ? ` + ${first.attrValue}` : ""} = ${first.total}`, note: first.outcome.name },
    ],
  });
  const dice = keep === "first" ? first.dice : second.dice;
  Store.begin("spend a keyword on a re-roll");
  await Roller.useKeyword(keyword, "reroll");
  Store.journal("keyword", `Spent "${keyword.text}" to re-roll ${label}; kept the ${keep === "first" ? "first" : "new"} outcome.`);
  Store.commit();
  await applyTest({ attrId, label, manual: dice, againstThreatId, stageTest, undoLabel: `${label} (re-rolled)`, actorId: actor.id });
}

// --- Scene starters -----------------------------------------------------------
/** One scene each per segment of the clock (Ch.3, Game turns). */
function canTakeScene(who) {
  const m = Store.mystery;
  if (Store.party.length < 2 || !m.round) return true;
  if (!m.round.scenes[who.id]) return true;
  showToast(`${who.name} has already had a scene this round.`);
  return false;
}

async function startInvestigation() {
  let die = null;
  if (Settings.get("manualDice")) { die = await manualDie("Investigation roll"); if (!die) return; }
  // A threat that nobody called up is attached by the players (Ch.3, Threats).
  let threatOn = Store.investigator;
  if (Store.party.length > 1) {
    const id = await chooseModal({
      title: "If something is waiting for you",
      message: "An investigation roll can put a threat in your way before anyone has acted. Whose way is it in?",
      options: Store.party.map((i) => ({ value: i.id, label: i.name, note: `Fatigue ${i.fatigue}/5` })),
    });
    if (!id) return;
    threatOn = Store.investigatorById(id);
  }
  Store.begin("start investigation");
  Life.startRound("shared");
  const out = await Life.beginInvestigation(die, { threatOn });
  Store.journal("scene", `Investigation scene: rolled ${out.die} + ${out.danger} danger = ${out.total}.`);
  Store.commit();
  modal({
    title: "Investigation",
    body: el("div", {}, el("p", { text: out.row.text }),
      el("p", { class: "math", text: `1d6 ${out.die} + danger ${out.danger} = ${out.total}` }),
      eventList(out.events)),
    actions: [{ label: "Set the scene" }],
  });
  await rerender();
}

async function startRest() {
  const who = Store.investigator;
  if (!canTakeScene(who)) return;
  Store.begin("rest scene");
  Life.startScene("rest", who);
  const events = await Life.restScene(null, who);
  Store.mystery.scene.done = true;
  Life.recordRoundScene("rest", who);
  Store.journal("scene", `${who.name} rests.`);
  Store.commit();
  modal({
    title: "Rest",
    body: el("div", {}, el("p", { class: "muted", text: `Describe how ${who.name} unwinds.` }), framingLines(who.name), eventList(events)),
    actions: [{ label: "Done" }],
  });
  await afterIndividualScene();
}

async function startObligation() {
  const inv = Store.investigator;
  if (!canTakeScene(inv)) return;
  const open = D.openObligations(inv);
  if (!open.length) { showToast(`${inv.name} has attended every obligation today.`); return; }
  const id = await chooseModal({ title: "Which obligation?", options: open.map((o) => ({ value: o.id, label: o.text })) });
  if (!id) return;
  Store.begin("obligation scene");
  Life.startScene("obligation", inv);
  const out = await Life.obligationScene(id, inv);
  Store.mystery.scene.done = true;
  Life.recordRoundScene("obligation", inv);
  Store.journal("scene", `${inv.name} attends: ${out.obligation.text}.`);
  Store.commit();
  modal({
    title: "Obligation",
    body: el("div", {},
      el("p", { class: "muted", text: `How does ${inv.name} attend to this? Use the prompt below if you want one.` }),
      framingLines(inv.name),
      el("p", { class: "mono", text: out.words.join("  ·  ") }),
      eventList(out.events)),
    actions: [{ label: "Done" }],
  });
  await afterIndividualScene();
}

/**
 * In co-op, one segment of the clock covers a scene for everybody. When an
 * individual scene ends, the spotlight moves to whoever still owes one.
 */
async function afterIndividualScene() {
  const waiting = Life.pendingInvestigators();
  if (waiting.length) {
    const next = waiting[0];
    Store.setActive(next.id);
    showToast(`${next.name} takes a scene next.`);
  }
  await rerender();
}

/** Also reachable from the Clues tab, where a player is looking at the sets. */
export async function startTruth() {
  const m = Store.mystery;
  const open = D.openSets(m).filter((s) => s.cards.length > 0);
  if (!open.length) { showToast("You need a clue set that is not a false lead."); return; }
  if (!m.truthDeck.length) { showToast("The truth deck is empty — every card is already known."); return; }
  const rank = await chooseModal({
    title: "Establish a truth",
    message: "Turn a clue set sideways and reveal that many truth cards. The set can never become a false lead afterwards.",
    options: open.map((s) => ({ value: s.rank, label: `The ${rankName(s.rank)} — ${s.cards.length} card(s)`, note: s.description || "no description yet" })),
  });
  if (!rank) return;
  Store.begin("truth scene");
  Life.startRound("shared");
  Life.startScene("truth");
  Store.mystery.scene.participants = Store.party.map((i) => i.id); // everyone works it out together
  const out = Life.truthScene(rank);
  Store.mystery.scene.done = true;
  const text = await promptModal({
    title: "What connection does your investigator make?",
    message: `Revealed: ${out.drawn.map((c) => `${c.rank}${c.suit}`).join(", ") || "nothing left to reveal"}. Add it to the clue description.`,
    multiline: true,
  });
  if (text) { out.set.entries.push(text); out.set.description = out.set.entries.join(" — "); }
  Store.journal("scene", `Truth scene: established the ${rankName(rank)}, removing ${out.drawn.length} truth card(s).`);
  Store.commit();
  await rerender();
}

// --- Boundaries ---------------------------------------------------------------
async function endSceneFlow() {
  const inv = Store.investigator, m = Store.mystery;
  // In co-op the clock is only marked once everybody has had a scene (Ch.3).
  const waiting = Life.pendingInvestigators();
  if (waiting.length && Store.party.length > 1) {
    modal({
      title: "Not everyone has had a scene",
      body: el("p", { text: `The clock is marked once per round, for all of you. Still to take a scene: ${waiting.map((i) => i.name).join(", ")}.` }),
      actions: [
        { label: `Switch to ${waiting[0].name}`, onClick: () => { Store.setActive(waiting[0].id); rerender(); } },
        { label: "Back", kind: "ghost" },
      ],
    });
    return;
  }
  Store.begin("end scene");
  const out = Life.endScene();
  Store.commit();

  if (Settings.get("rivals") && out.leftover.length) {
    const pick = await chooseModal({
      title: "A threat follows you out",
      message: "A threat left standing can come back as a rival in a later scene.",
      options: [...out.leftover.map((t) => ({ value: t, label: t.name, note: `Level ${t.level} → rival at level ${Math.max(2, t.level)}` })), { value: null, label: "Let them go", note: "Add no rival." }],
    });
    if (pick) {
      Store.begin("add rival");
      const res = Life.addRival(pick);
      if (res && res.full) {
        // The book lets a full list be replaced by a rival of matching level.
        const matching = Store.career.rivals.map((r, i) => ({ r, i })).filter(({ r }) => r.level === res.rival.level);
        const pool = matching.length ? matching : Store.career.rivals.map((r, i) => ({ r, i }));
        const slot = await chooseModal({
          title: "Your rival list is full",
          message: matching.length
            ? "Replace a rival of the same threat level, or let this one go."
            : "No rival shares this one's level, so by the book it cannot be added. Drop one anyway, or let it go.",
          options: [...pool.map(({ r, i }) => ({ value: i, label: `${i + 1}. ${r.name}`, note: `Level ${r.level}` })),
                    { value: null, label: "Let this one go", note: "The list stays as it is." }],
        });
        if (slot !== null && slot !== undefined) Life.replaceRival(slot, res.rival);
      }
      Store.commit();
    }
  }

  const events = [...out.events];
  if (out.dayOver) {
    const pending = Life.dayBoundary();
    events.push(...pending.events);
    Store.begin("day boundary");
    const applied = await Life.applyDayBoundary();
    events.push(...applied.events);
    Store.commit();
    modal({
      title: `Day ${Store.investigator.day - 1} is over`,
      body: el("div", {},
        el("p", { class: "muted", text: "The clock filled. Neglected obligations cost fatigue, strikes clear, and a random event opens the new day — resolve it with a test." }),
        eventList(events),
        el("p", { class: "mono", text: applied.words.join("  ·  ") })),
      actions: [
        { label: "Resolve it with a test", onClick: () => { setTimeout(() => runTest({ label: "Random event", purpose: "How does your investigator deal with the event?" }), 60); } },
        { label: "Later", kind: "ghost" },
      ],
    });
  } else {
    modal({ title: "Scene over", body: el("div", {}, eventList(events), el("p", { class: "small muted", text: "Choose the next scene, or resolve the mystery now." })), actions: [{ label: "Continue" }] });
  }
  Store.journal("scene", out.dayOver ? "Scene ended; the day turned over." : "Scene ended.");
  await rerender();
}

// --- Screen -------------------------------------------------------------------
export function renderPlay(host) {
  const c = Store.career;
  if (!c || !Store.investigator.name) {
    add(host, el("h1", { text: "Play" }), explain("This is where a mystery is played out, one scene at a time. You need an investigator first."));
    add(host, emptyState("No investigator yet.", "Create an investigator", () => go("wizard")));
    return {};
  }
  const m = c.mystery;
  if (!m) {
    add(host, el("h1", { text: "Play" }), explain("Each scene is a choice: investigate for clues, establish a truth, rest, or attend an obligation. Four scenes make a day. You need a mystery to start."));
    add(host, emptyState("No mystery in progress.", "Set up a mystery", () => go("mystery")));
    return {};
  }
  if (m.ended) {
    add(host, el("h1", { text: "It ends here" }),
      explain("The mystery is over: either you chose to stop, the clue deck ran dry, or a consequence forced your investigator out. All that is left is to name the truth."));
    add(host, section("How it ended", el("p", { class: "premise", text: R.problemText(m) }),
      row("Trigger", (END_TRIGGERS.find((t) => t.id === m.endTrigger) || END_TRIGGERS[0]).text)));
    return { action: actionBar("Resolve the mystery", () => go("solve"), "Name the three truth cards") };
  }

  const scene = m.scene;
  const inScene = scene && !scene.done;

  add(host, el("h1", { text: inScene ? R.sceneType(scene.type).name : "Next scene" }),
    explain(inScene
      ? "Play the scene out. Each stage needs one successful test; failure and success-at-a-cost both bring consequences, and every threat that you did not act against gets a roll of its own."
      : "Pick the scene that fits what your investigator needs: clues, certainty, recovery, or the rest of their life. Ending a scene marks the clock; four scenes make a day."));

  add(host, problemBlock(m, inScene));

  if (inScene && scene.type === "investigation") return renderInvestigation(host, m, scene);

  const party = Store.party;
  const waiting = Life.pendingInvestigators();
  const individualRound = m.round && m.round.mode === "individual";

  if (party.length > 1) add(host, roundPanel(m, waiting));

  if (scene && scene.done && (!waiting.length || party.length === 1)) {
    add(host, section("This scene is finished",
      el("p", { class: "muted small", text: "Mark the clock, then choose again — or resolve the mystery now." }),
      el("div", { class: "btn-row" }, btn("Resolve the mystery instead", () => confirmEnd(), "danger"))));
    return { action: actionBar("End the scene", endSceneFlow, party.length > 1 ? "Everyone marks the clock" : `Clock ${Store.investigator.clock}/${CLOCK_SEGMENTS}`) };
  }

  const mine = m.round && m.round.scenes[Store.investigator.id];
  if (mine && waiting.length && party.length > 1) {
    const next = waiting[0];
    add(host, section("Your scene is done",
      el("p", { text: `${Store.investigator.name} has had a scene this round. ${next.name} still owes one, and the clock only moves when everybody has had theirs.` })));
    return { action: actionBar(`Play as ${next.name}`, () => { Store.setActive(next.id); rerender(); }, `${waiting.length} still to go`) };
  }

  // Scene picker, in the book's own order. A scene the rules do not allow right
  // now says why before you tap it, and tapping still explains the rule.
  const list = el("div", { class: "choice-list" });
  for (const t of SCENE_TYPES) {
    const handler = { investigation: startInvestigation, truth: startTruth, rest: startRest, obligation: startObligation }[t.id];
    const shared = Life.SHARED_SCENES.has(t.id);
    const barred = individualRound && shared && party.length > 1
      ? { why: "Not this round: the party is taking separate scenes.",
          rule: "An investigation or truth scene is played by everybody. Once the round is one of separate scenes, the investigators still owing one take a scene of their own (Ch.3, Game turns)." }
      : sceneBlocked(t.id, m);
    const note = party.length > 1
      ? `${shared ? "The whole party plays this one." : "Each investigator takes their own."} ${t.text}`
      : t.text;
    add(list, el("button", {
      class: "choice", type: "button",
      onclick: barred
        ? () => modal({ title: t.name, body: el("div", {}, el("p", { text: barred.why }), el("p", { class: "small muted", text: barred.rule })), actions: [{ label: "Back" }] })
        : handler,
      "aria-disabled": barred ? "true" : null,
    }, el("span", { class: "choice-label", text: t.name }),
       el("span", { class: "choice-note", text: barred ? barred.why : note })));
  }
  add(host, section(party.length > 1 ? `Choose a scene — ${Store.investigator.name}` : "Choose a scene", list));
  add(host, section("Or stop here",
    el("p", { class: "small muted", text: "You may resolve the mystery at the end of any scene. The fewer truth cards you have revealed, the wilder the guess." }),
    btn("Resolve the mystery", () => confirmEnd(), "danger")));
  if (individualRound && party.length > 1) {
    return { action: actionBar("Rest scene", startRest, `${Store.investigator.name} takes a scene`) };
  }
  return { action: actionBar("Investigation scene", startInvestigation, `Roll 1d6 + ${m.danger} danger`) };
}

/** The premise: a card between scenes, a line you can unfold during one. */
function problemBlock(m, inScene) {
  const rows = [
    m.motivation ? row("Motivation", m.motivation) : null,
    row("Danger", el("span", { class: `pill ${m.danger >= 6 ? "danger" : ""}`, text: String(m.danger) })),
  ];
  if (!inScene) return section("The problem", el("p", { class: "premise", text: R.problemText(m) }), ...rows);
  const fold = el("details", { class: "acc" });
  add(fold, el("summary", { text: "The problem" }),
    el("div", { class: "acc-body" }, el("p", { class: "premise", text: R.problemText(m) }), ...rows));
  return fold;
}

/** Why a scene type cannot be taken right now, or null when it can. */
export function sceneBlocked(type, mystery) {
  const m = mystery || Store.mystery;
  if (!m) return null;
  if (type === "truth") {
    if (!D.openSets(m).filter((s) => s.cards.length).length) {
      return { why: "No clue set to turn over yet.",
               rule: "A truth scene establishes a clue set you already hold. Take a clue in an investigation scene first (Ch.2, Truth scenes)." };
    }
    if (!m.truthDeck.length) {
      return { why: "Every truth card is already known.",
               rule: "A truth scene reveals cards from the truth deck. With the deck empty there is nothing left to rule out (Ch.2, Truth scenes)." };
    }
  }
  if (type === "obligation" && !D.openObligations(Store.investigator).length) {
    return { why: "Every obligation is attended for today.",
             rule: "An obligation scene strikes one obligation. They come back when the day turns (Ch.2, The clock)." };
  }
  return null;
}

/** Where the round stands: who has taken a scene this segment, and who has not. */
function roundPanel(m, waiting) {
  const mode = m.round ? (m.round.mode === "shared" ? "everyone is in this one" : "separate scenes") : "nothing chosen yet";
  const rows = Store.party.map((i) => {
    const taken = m.round && m.round.scenes[i.id];
    const shared = m.round && m.round.mode === "shared";
    return row(i.name, el("span", {},
      shared ? pill("in the scene", "truth") : taken ? pill(R.sceneType(taken.type).name, "ok") : pill("waiting", "loss"),
      " ", pill(`clock ${i.clock}/${CLOCK_SEGMENTS}`), " ",
      i.id === Store.investigator.id ? pill("you", "truth") : btn("Play as", () => { Store.setActive(i.id); rerender(); })));
  });
  return section(`The round — ${mode}`, ...rows,
    Life.roundComplete()
      ? el("p", { class: "small muted", text: "Everyone has had a scene. Mark the clock to move on." })
      : el("p", { class: "small muted", text: `Still to take a scene: ${waiting.map((i) => i.name).join(", ") || "nobody"}.` }));
}

async function confirmEnd() {
  const ok = await confirmModal({
    title: "Resolve the mystery?",
    message: "This ends the mystery for good: no more clues, no more truth scenes. You will guess the three cards set aside at the start.",
    confirmLabel: "End it", danger: true,
  });
  if (!ok) return;
  Store.update("resolve mystery", (s) => { const m = Store.mystery; m.ended = true; m.endTrigger = "chosen"; });
  go("solve");
}

function renderInvestigation(host, m, scene) {
  const framing = framingCard(scene, { note: `${SCENE_FRAMING_NOTE} Danger is ${m.danger}${D.hasThreat(m) ? `, and ${D.activeThreats(m).map((t) => t.name).join(" and ")} is in it with you` : ""}.` });
  if (framing) add(host, framing);
  const order = scene.order;
  const rail = el("div", { class: "stages" });
  for (const id of order) {
    const idx = order.indexOf(id), now = idx === scene.index;
    add(rail, el("div", { class: `stage-step ${now ? "now" : idx < scene.index ? "done" : ""}`, text: R.stage(id).name }));
  }
  add(host, section("Stages", rail,
    el("p", { class: "small muted", text: R.stage(scene.stage).note }),
    scene.forceEscape ? el("p", { class: "small", text: "The track filled — you are running for the door." }) : null));

  const threats = D.activeThreats(m);
  const tl = el("div", {});
  for (const t of threats) {
    add(tl, el("div", { class: "threat" },
      el("div", { class: "threat-head" },
        el("strong", { text: t.name }),
        el("span", {}, pill(`Level ${t.level}`, "loss"), " ", pill(`${t.marks || 0}/${t.level} marks`))),
      el("p", { class: "small muted", text: R.threatLevelText(t.level) }),
      Store.party.length > 1
        ? el("p", { class: "small", text: `On ${Roller.attachedTo(t).name} — its rolls land on them until someone else acts against it.` })
        : null,
      el("div", { class: "btn-row" },
        btn("Act against it", () => runTest({ label: `Act against ${t.name}`, purpose: `How do they deal with ${t.name}?`, againstThreatId: t.id })))));
  }
  add(host, section(`Threats (${threats.length})`,
    threats.length ? tl : el("p", { class: "muted small", text: "Nothing is in your way. The scene ends when you take the clue." })));

  const ready = D.usableKeywords(Store.investigator);
  if (ready.length) {
    const chips = el("div", { class: "chip-list" });
    for (const k of ready) {
      add(chips, el("button", { class: `chip ${k.signature ? "signature" : ""}`, type: "button", onclick: () => useKeywordFlow(k).then(rerender) },
        k.signature ? "★ " : "", k.text));
    }
    add(host, section(`Keywords ready (${ready.length})`, chips,
      el("p", { class: "small muted", text: "Spend one to re-roll a test, strengthen a clue, or remove a threat outright." })));
  }

  const label = { infiltration: "Find a way in", discovery: "Find where the clue is", acquisition: "Take the clue", escape: "Get out" }[scene.stage];
  return { action: actionBar(label, () => runTest({ label, purpose: `${label} — which approach?`, stageTest: true }), `${R.stage(scene.stage).name} stage · danger ${m.danger}`) };
}
