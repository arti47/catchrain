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
import { go } from "./router.js";
import { section, row, btn, pill, explain, modal, chooseModal, confirmModal, promptModal, showToast, actionBar, emptyState } from "./ui.js";

const rerender = () => import("./router.js").then((m) => m.render());

// --- Result presentation ------------------------------------------------------
function diceRow(dice, attrValue, total, doubles) {
  const wrap = el("div", { class: "dice" });
  for (const d of dice) add(wrap, el("span", { class: `die ${doubles ? "doubles" : ""}`, text: String(d) }));
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
async function chooseAttribute(purpose) {
  const inv = Store.investigator;
  const usable = D.usableAttributes(inv);
  if (!usable.length) {
    modal({ title: "Nothing left to try", body: el("p", { text: "Every attribute is struck. Your investigator needs to rest before testing anything else." }), actions: [{ label: "Back" }] });
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

// --- Running a test -----------------------------------------------------------
async function runTest({ label, purpose, againstThreatId, stageTest }) {
  const attrId = await chooseAttribute(purpose || label);
  if (!attrId) return;
  let manual = null;
  if (Settings.get("manualDice")) {
    manual = await manualDicePair(label);
    if (!manual) return;
  }
  await applyTest({ attrId, label, manual, againstThreatId, stageTest, undoLabel: label });
}

/** Rolls (or replays) one test, applies it, and offers the re-roll keyword. */
async function applyTest({ attrId, label, manual, againstThreatId, stageTest, undoLabel }) {
  const m = Store.mystery;
  Store.begin(undoLabel);
  const res = await Roller.attributeTest({
    attrId, label, manualDice: manual, againstThreatId,
    inInvestigation: !!(m.scene && m.scene.type === "investigation" && !m.scene.done),
  });
  const extra = [];
  if (stageTest && res.outcome.id !== "failure" && !m.ended) {
    const out = await Life.completeStage();
    extra.push(...out.events);
  }
  Store.journal("test", `${label}: ${res.dice.join("+")}${res.attrValue ? `+${res.attrValue}` : ""} = ${res.total} (${res.outcome.name}).`, { outcome: res.outcome.id });
  Store.commit();
  const spare = D.usableKeywords(Store.investigator);
  const onReroll = spare.length && !Store.mystery.ended
    ? () => rerollFlow({ attrId, label, againstThreatId, stageTest, first: { dice: res.dice, total: res.total, outcome: res.outcome, attrValue: res.attrValue } })
    : null;
  showResult(label, { ...res, attrValue: D.attrValue(Store.investigator, attrId) }, extra, onReroll);
  await rerender();
}

/**
 * The re-roll keyword: the test un-happens, the keyword is struck, the dice are
 * thrown again, and whichever of the two outcomes the player keeps is applied.
 */
async function rerollFlow({ attrId, label, againstThreatId, stageTest, first }) {
  const spare = D.usableKeywords(Store.investigator);
  if (!spare.length) { showToast("No keyword left to spend."); return; }
  const id = await chooseModal({
    title: "Spend which keyword?",
    message: "Striking it buys one re-roll of this test. You will see both outcomes and keep either.",
    options: spare.map((k) => ({ value: k.id, label: k.text, note: k.signature ? "Signature — comes back when you rest" : "One use" })),
  });
  if (!id) return;

  Store.undo();
  const keyword = Store.investigator.keywords.find((k) => k.id === id);
  let manual = null;
  if (Settings.get("manualDice")) {
    manual = await manualDicePair(`${label} (re-roll)`);
    if (!manual) { await rerender(); return; }
  }
  const second = Roller.previewTest(attrId, manual);
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
  await applyTest({ attrId, label, manual: dice, againstThreatId, stageTest, undoLabel: `${label} (re-rolled)` });
}

// --- Scene starters -----------------------------------------------------------
async function startInvestigation() {
  let die = null;
  if (Settings.get("manualDice")) { die = await manualDie("Investigation roll"); if (!die) return; }
  Store.begin("start investigation");
  const out = await Life.beginInvestigation(die);
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
  Store.begin("rest scene");
  Life.startScene("rest");
  const events = await Life.restScene();
  Store.mystery.scene.done = true;
  Store.journal("scene", "Rest scene.");
  Store.commit();
  modal({ title: "Rest", body: el("div", {}, el("p", { class: "muted", text: "Describe how your investigator unwinds." }), eventList(events)), actions: [{ label: "Done" }] });
  await rerender();
}

async function startObligation() {
  const inv = Store.investigator;
  const open = D.openObligations(inv);
  if (!open.length) { showToast("Every obligation is already attended today."); return; }
  const id = await chooseModal({ title: "Which obligation?", options: open.map((o) => ({ value: o.id, label: o.text })) });
  if (!id) return;
  Store.begin("obligation scene");
  Life.startScene("obligation");
  const out = await Life.obligationScene(id);
  Store.mystery.scene.done = true;
  Store.journal("scene", `Obligation: ${out.obligation.text}.`);
  Store.commit();
  modal({
    title: "Obligation",
    body: el("div", {},
      el("p", { class: "muted", text: "How does your investigator attend to this? Use the prompt below if you want one." }),
      el("p", { class: "mono", text: out.words.join("  ·  ") }),
      eventList(out.events)),
    actions: [{ label: "Done" }],
  });
  await rerender();
}

async function startTruth() {
  const m = Store.mystery;
  const open = D.openSets(m).filter((s) => s.cards.length > 0);
  if (!open.length) { showToast("You need a clue set that is not a false lead."); return; }
  if (!m.truthDeck.length) { showToast("The truth deck is empty — every card is already known."); return; }
  const rank = await chooseModal({
    title: "Establish a truth",
    message: "Turn a clue set sideways and reveal that many truth cards. The set can never become a false lead afterwards.",
    options: open.map((s) => ({ value: s.rank, label: `The ${s.rank}s — ${s.cards.length} card(s)`, note: s.description || "no description yet" })),
  });
  if (!rank) return;
  Store.begin("truth scene");
  Life.startScene("truth");
  const out = Life.truthScene(rank);
  Store.mystery.scene.done = true;
  const text = await promptModal({
    title: "What connection does your investigator make?",
    message: `Revealed: ${out.drawn.map((c) => `${c.rank}${c.suit}`).join(", ") || "nothing left to reveal"}. Add it to the clue description.`,
    multiline: true,
  });
  if (text) { out.set.entries.push(text); out.set.description = out.set.entries.join(" — "); }
  Store.journal("scene", `Truth scene: established the ${rank}s, removing ${out.drawn.length} truth card(s).`);
  Store.commit();
  await rerender();
}

// --- Boundaries ---------------------------------------------------------------
async function endSceneFlow() {
  const inv = Store.investigator, m = Store.mystery;
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
  if (!c || !c.investigator.name) {
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
    add(host, section("How it ended", el("p", { text: R.problemText(m) }),
      row("Trigger", (END_TRIGGERS.find((t) => t.id === m.endTrigger) || END_TRIGGERS[0]).text)));
    return { action: actionBar("Resolve the mystery", () => go("solve"), "Name the three truth cards") };
  }

  const scene = m.scene;
  const inScene = scene && !scene.done;

  add(host, el("h1", { text: inScene ? R.sceneType(scene.type).name : "Next scene" }),
    explain(inScene
      ? "Play the scene out. Each stage needs one successful test; failure and success-at-a-cost both bring consequences, and every threat that you did not act against gets a roll of its own."
      : "Pick the scene that fits what your investigator needs: clues, certainty, recovery, or the rest of their life. Ending a scene marks the clock; four scenes make a day."));

  add(host, section("The problem", el("p", { text: R.problemText(m) }),
    m.motivation ? row("Motivation", m.motivation) : null,
    row("Danger", el("span", { class: `pill ${m.danger >= 6 ? "danger" : ""}`, text: String(m.danger) }))));

  if (inScene && scene.type === "investigation") return renderInvestigation(host, m, scene);

  if (scene && scene.done) {
    add(host, section("This scene is finished",
      el("p", { class: "muted small", text: "Mark the clock, then choose again — or resolve the mystery now." }),
      el("div", { class: "btn-row" }, btn("Resolve the mystery instead", () => confirmEnd(), "danger"))));
    return { action: actionBar("End the scene", endSceneFlow, `Clock ${Store.investigator.clock}/${CLOCK_SEGMENTS}`) };
  }

  // Scene picker, in the book's own order.
  const list = el("div", {});
  for (const t of SCENE_TYPES) {
    const handler = { investigation: startInvestigation, truth: startTruth, rest: startRest, obligation: startObligation }[t.id];
    add(list, el("button", { class: "choice", type: "button", onclick: handler },
      el("span", { class: "choice-label", text: t.name }), el("span", { class: "choice-note", text: t.text })));
  }
  add(host, section("Choose a scene", list));
  add(host, section("Or stop here",
    el("p", { class: "small muted", text: "You may resolve the mystery at the end of any scene. The fewer truth cards you have revealed, the wilder the guess." }),
    btn("Resolve the mystery", () => confirmEnd(), "danger")));
  return { action: actionBar("Investigation scene", startInvestigation, `Roll 1d6 + ${m.danger} danger`) };
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
      el("div", { class: "btn-row" },
        btn("Act against it", () => runTest({ label: `Act against ${t.name}`, purpose: `How does your investigator deal with ${t.name}?`, againstThreatId: t.id })))));
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
