// Unit + data harness. Rules invariants first, table completeness second.
import { parseGate, installEnv, test, assert, eq, report } from "./harness.mjs";

installEnv();

const gate = parseGate();
await test("every source file parses", () => assert(gate.bad.length === 0, gate.bad.join(" | ")));

const D = await import("../data.js");
const core = await import("../src/core.js");
const deck = await import("../src/deck.js");
const rules = await import("../src/rules.js");
const derived = await import("../src/derived.js");
const { Store } = await import("../src/store.js");
const { Settings } = await import("../src/settings.js");
const Roller = await import("../src/roller.js");
const Life = await import("../src/lifecycle.js");

// --- Tables -------------------------------------------------------------------
await test("34 d66 tables have 36 unique rows", () => {
  const named = ["ORACLE_ACTION","ORACLE_DESCRIPTOR","ORACLE_FOCUS","TREACHERIES","FIRST_NAMES","LAST_NAMES","NAME_PREFIX","NAME_SUFFIX","TRAITS","MOTIVATIONS"];
  let count = 0;
  for (const n of named) { assert(D[n].length === 36, n); assert(new Set(D[n]).size === 36, n + " dupes"); count++; }
  for (const g of D.GENRE_IDS) for (const k of D.TABLE_KINDS) {
    const t = D.GENRES[g][k];
    assert(t.length === 36, `${g}.${k} = ${t.length}`);
    assert(new Set(t).size === 36, `${g}.${k} dupes`);
    count++;
  }
  eq(count, 34, "table count");
});

await test("d66 index maps 11..66 onto 0..35", () => {
  eq(core.d66Code(0), "11"); eq(core.d66Code(35), "66"); eq(core.d66Code(18), "41");
});

await test("range tables cover every reachable roll", () => {
  for (let i = 1; i <= 12; i++) { rules.investigationRow(i); rules.testOutcome(i); rules.consequenceRow(i); rules.consequenceRow(i, true); }
  for (let i = 1; i <= 6; i++) rules.rollYesNo && assert(D.YES_NO.some((r) => i >= r.min && i <= r.max), "yes/no " + i);
});

await test("test outcome boundaries are 6/7 and 9/10", () => {
  eq(rules.testOutcome(6).id, "failure"); eq(rules.testOutcome(7).id, "cost");
  eq(rules.testOutcome(9).id, "cost"); eq(rules.testOutcome(10).id, "success");
});

await test("investigation roll boundaries are 3/4 and 5/6", () => {
  eq(rules.investigationRow(3).startStage, "discovery");
  eq(rules.investigationRow(4).threatLevel, 1);
  eq(rules.investigationRow(5).threatLevel, 1);
  eq(rules.investigationRow(6).threatLevel, 2);
});

await test("consequence boundaries, solo and co-op", () => {
  eq(rules.consequenceRow(3).id, "threat_up"); eq(rules.consequenceRow(4).id, "discard");
  eq(rules.consequenceRow(6).id, "fatigue1"); eq(rules.consequenceRow(8).id, "fatigue2");
  eq(rules.consequenceRow(9).id, "end");
  assert(rules.consequenceRow(4, true).text.includes("2 cards"), "co-op discards two");
});

// --- Decks --------------------------------------------------------------------
await test("clue deck is 40 cards plus 2 jokers", () => {
  const d = deck.buildClueDeck();
  eq(d.length, 42);
  eq(d.filter((c) => c.rank === "JOKER").length, 2);
  eq(d.filter((c) => c.rank === "A").length, 4);
});

await test("standard truth deck is 9 after 3 are set aside", () => {
  const t = deck.buildTruth("standard");
  eq(t.truthDeck.length, 9); eq(t.setAside.length, 3); eq(t.truthRevealed.length, 0);
});
await test("hard adds 2 red herrings, easy reveals 3, trivial reveals 6", () => {
  eq(deck.buildTruth("hard").truthDeck.length, 11);
  eq(deck.buildTruth("easy").truthDeck.length, 6);
  eq(deck.buildTruth("trivial").truthDeck.length, 3);
});

// --- Fixtures -----------------------------------------------------------------
function freshMystery(overrides = {}) {
  const t = deck.buildTruth("standard");
  return Object.assign({
    genre: "noir", difficulty: "standard", danger: 0,
    clueDeck: deck.buildClueDeck(), clueDiscard: [], clueSets: {}, threats: [],
    scene: null, jokersDrawn: 0, ended: false, ...t,
  }, overrides);
}
function seed(mystery) {
  globalThis.__resetStorage();
  Store.init();
  const c = Store.newCareer("Test");
  Store.update("seed", () => {
    c.investigator = derived.normalizeInvestigator({
      name: "Amine", attributes: { power: 2, insight: 1, method: 0 },
      obligations: [{ id: "o1", text: "Run the lake", struck: false }],
      keywords: [{ id: "k1", text: "Smooth talker", signature: true, struck: false }],
    });
    c.mystery = derived.normalizeMystery(mystery || freshMystery());
  });
  return c;
}
const card = (rank, suit = "S") => ({ id: core.uid(), rank, suit });

// --- Clue draws ---------------------------------------------------------------
await test("first card of a rank starts a set; a second strengthens it", () => {
  const m = freshMystery({ clueDeck: [card("7", "H"), card("7", "D")] });
  const a = deck.drawClue(m, "gain");
  eq(a.set.cards.length, 1); assert(a.events.some((e) => e.t === "new_clue"));
  const b = deck.drawClue(m, "gain");
  eq(b.set.cards.length, 2); assert(b.events.some((e) => e.t === "strengthen_clue"));
});

await test("a joker burns a clue set and the draw continues", () => {
  const m = freshMystery({ clueDeck: [card("JOKER", null), card("5", "C")] });
  m.clueSets["7"] = { rank: "7", cards: [card("7", "H")], entries: [], truth: false, falseLead: false, truthCards: [] };
  const r = deck.drawClue(m, "gain", (sets) => sets[0]);
  assert(m.clueSets["7"].falseLead, "set became a false lead");
  eq(m.clueSets["7"].cards.length, 0, "its cards are discarded");
  eq(r.card.rank, "5", "a replacement card was drawn");
});

await test("a joker with no eligible set doubles danger instead", () => {
  const m = freshMystery({ clueDeck: [card("JOKER", null), card("3", "S")], danger: 4 });
  deck.drawClue(m, "gain");
  eq(m.danger, 8);
});

await test("a false-lead rank is discarded with no replacement", () => {
  const m = freshMystery({ clueDeck: [card("7", "H"), card("9", "S")] });
  m.clueSets["7"] = { rank: "7", cards: [], entries: [], truth: false, falseLead: true, truthCards: [] };
  const r = deck.drawClue(m, "gain");
  eq(r.card, null, "nothing gained");
  eq(m.clueDeck.length, 1, "the next card stays in the deck");
});

await test("a rank already established as truth is discarded AND replaced", () => {
  const m = freshMystery({ clueDeck: [card("7", "H"), card("9", "S")] });
  m.clueSets["7"] = { rank: "7", cards: [card("7", "C")], entries: [], truth: true, falseLead: false, truthCards: [] };
  const r = deck.drawClue(m, "gain");
  eq(r.card.rank, "9", "replacement drawn");
  eq(m.clueDeck.length, 0);
});

await test("establishing a truth removes that many cards from the truth deck", () => {
  const m = freshMystery();
  m.clueSets["7"] = { rank: "7", cards: [card("7", "H"), card("7", "D")], entries: [], truth: false, falseLead: false, truthCards: [] };
  const before = m.truthDeck.length;
  const out = deck.establishTruth(m, "7");
  eq(out.drawn.length, 2);
  eq(m.truthDeck.length, before - 2);
  eq(m.truthRevealed.length, 2);
  assert(m.clueSets["7"].truth, "set is established");
  eq(deck.establishTruth(m, "7"), null, "cannot establish twice");
});

await test("a truth scene takes what remains when the deck is short (A7)", () => {
  const m = freshMystery();
  m.truthDeck = [card("J", "S")];
  m.clueSets["4"] = { rank: "4", cards: [card("4", "H"), card("4", "D"), card("4", "C")], entries: [], truth: false, falseLead: false, truthCards: [] };
  const out = deck.establishTruth(m, "4");
  eq(out.drawn.length, 1);
  assert(m.clueSets["4"].truth);
});

await test("guesses score against the set-aside cards; duplicates are red herrings", () => {
  const m = freshMystery();
  m.setAside = [card("J", "S"), card("Q", "H"), card("K", "D")];
  m.truthDeck = [{ id: "x", rank: "J", suit: "S", herring: true }];
  m.truthRevealed = [];
  const out = deck.scoreGuesses(m, [{ rank: "J", suit: "S" }, { rank: "Q", suit: "H" }, { rank: "K", suit: "C" }]);
  eq(out.map((o) => o.correct), [false, true, false]);
  eq(out[0].reason, "red herring");
});

// --- Engine -------------------------------------------------------------------
await test("fatigue overflow strikes the highest attribute and carries the excess", async () => {
  const c = seed();
  Store.begin("t");
  const ev = [];
  await Roller.markFatigue(7, ev);
  Store.commit();
  assert(c.investigator.struck.power, "power was struck (highest at 2)");
  eq(c.investigator.fatigue, 2, "excess carried");
});

await test("the fatigue strike forces the escape stage inside an investigation", async () => {
  const c = seed();
  Store.begin("t");
  await Life.beginInvestigation(1); // quiet: discovery start, no threat
  c.investigator.fatigue = 4;
  const ev = [];
  await Roller.markFatigue(1, ev);
  Store.commit();
  assert(c.mystery.scene.forceEscape, "forced to escape");
  assert(derived.hasThreat(c.mystery), "a threat is introduced when none was present");
});

await test("a threat is removed once its marks equal its level", async () => {
  const c = seed();
  Store.begin("t");
  await Life.beginInvestigation(6); // level 2 threat
  const threat = c.mystery.threats[0];
  eq(threat.level, 2);
  threat.marks = 1;
  const r = await Roller.attributeTest({ attrId: "power", againstThreatId: threat.id, manualDice: [6, 6], inInvestigation: true });
  Store.commit();
  eq(r.outcome.id, "success");
  assert(threat.removed, "two marks on a 10+ finished it");
});

await test("rolling under danger introduces a threat and halves danger", async () => {
  const c = seed(freshMystery({ danger: 9 }));
  Store.begin("t");
  await Life.beginInvestigation(1);
  c.mystery.danger = 9;
  c.mystery.threats = [];
  await Roller.attributeTest({ attrId: "method", manualDice: [1, 2], inInvestigation: true });
  Store.commit();
  eq(c.mystery.danger, 5, "9 halved, rounded up");
  assert(c.mystery.threats.length >= 1, "a level 1 threat arrived");
});

await test("a threat just introduced does not act in the same test", async () => {
  const c = seed(freshMystery({ danger: 12 }));
  Store.begin("t");
  await Life.beginInvestigation(1);
  c.mystery.danger = 12;
  c.mystery.threats = [];
  const ev = (await Roller.attributeTest({ attrId: "method", manualDice: [1, 1], inInvestigation: true })).events;
  Store.commit();
  const introduced = ev.filter((e) => e.t === "threat_in");
  const acted = ev.filter((e) => e.t === "threat_acts");
  assert(introduced.length >= 1, "threat introduced");
  eq(acted.length, 0, "it did not act on the test that created it");
});

await test("a 10+ test grants a bonus clue in any scene", async () => {
  const c = seed();
  Store.begin("t");
  const before = derived.clueCount(c.mystery);
  await Roller.attributeTest({ attrId: "power", manualDice: [6, 6] });
  Store.commit();
  assert(derived.clueCount(c.mystery) > before, "clue gained");
});

await test("a failure gains a keyword and rolls consequences", async () => {
  const c = seed();
  Store.begin("t");
  const before = c.investigator.keywords.length;
  const r = await Roller.attributeTest({ attrId: "method", manualDice: [1, 2] });
  Store.commit();
  eq(r.outcome.id, "failure");
  eq(c.investigator.keywords.length, before + 1);
  assert(r.events.some((e) => e.t === "consequence"), "consequences rolled");
});

await test("completing acquisition without a threat ends the scene; with one, escape follows", async () => {
  let c = seed();
  Store.begin("t");
  await Life.beginInvestigation(1);
  c.mystery.scene.stage = "acquisition";
  c.mystery.scene.order = ["discovery", "acquisition"];
  c.mystery.scene.index = 1;
  const out = await Life.completeStage();
  Store.commit();
  assert(out.done, "no threat: the scene ends at acquisition");

  c = seed();
  Store.begin("t2");
  await Life.beginInvestigation(6);
  c.mystery.scene.stage = "acquisition";
  c.mystery.scene.index = c.mystery.scene.order.indexOf("acquisition");
  const out2 = await Life.completeStage();
  Store.commit();
  assert(!out2.done && c.mystery.scene.stage === "escape", "threat present: escape stage");
});

await test("each completed stage raises danger, but escaping does not", async () => {
  const c = seed();
  Store.begin("t");
  await Life.beginInvestigation(6); // infiltration + level 2 threat
  const d0 = c.mystery.danger;
  await Life.completeStage(); // infiltration -> discovery
  eq(c.mystery.danger, d0 + 1);
  c.mystery.scene.stage = "escape";
  c.mystery.scene.index = c.mystery.scene.order.indexOf("escape");
  const d1 = c.mystery.danger;
  await Life.completeStage();
  Store.commit();
  eq(c.mystery.danger, d1, "escaping costs no danger");
});

await test("danger rises only when a next stage follows", async () => {
  // No threat: acquisition ends the scene, and the book's flowchart puts no
  // +1 on that arrow \u2014 only on the moves between stages.
  const c = seed();
  Store.begin("t");
  await Life.beginInvestigation(1);
  c.mystery.scene.stage = "acquisition";
  c.mystery.scene.order = ["discovery", "acquisition"];
  c.mystery.scene.index = 1;
  c.mystery.threats = [];
  const before = c.mystery.danger;
  const out = await Life.completeStage();
  Store.commit();
  assert(out.done, "the scene ended");
  eq(c.mystery.danger, before, "no danger for a stage nobody moved to");
});

await test("rest clears 1d6 fatigue, attribute strikes and signature keyword strikes", async () => {
  const c = seed();
  Store.begin("t");
  c.investigator.fatigue = 4;
  c.investigator.struck.power = true;
  c.investigator.keywords[0].struck = true;
  c.investigator.keywords.push({ id: "k2", text: "Polaroid", signature: false, struck: true });
  await Life.restScene();
  Store.commit();
  assert(c.investigator.fatigue < 4, "fatigue cleared");
  assert(!c.investigator.struck.power, "attribute strike cleared");
  assert(!c.investigator.keywords[0].struck, "signature keyword recharged");
  assert(c.investigator.keywords[1].struck, "an ordinary keyword stays struck");
});

await test("an obligation scene strikes the obligation and discards a clue card", async () => {
  const c = seed();
  Store.begin("t");
  const before = c.mystery.clueDeck.length;
  await Life.obligationScene("o1");
  Store.commit();
  assert(c.investigator.obligations[0].struck, "struck");
  assert(c.mystery.clueDeck.length < before, "a card left the clue deck");
});

await test("the day boundary marks fatigue per neglected obligation and clears strikes", async () => {
  const c = seed();
  Store.begin("t");
  c.investigator.obligations.push({ id: "o2", text: "Day job", struck: true });
  c.investigator.clock = 4;
  await Life.applyDayBoundary();
  Store.commit();
  eq(c.investigator.fatigue, 1, "one unstruck obligation bit");
  eq(c.investigator.clock, 0);
  eq(c.investigator.day, 2);
  assert(c.investigator.obligations.every((o) => !o.struck), "obligation strikes cleared");
});

await test("ending a scene marks the clock and clears threats", () => {
  const c = seed();
  Store.begin("t");
  c.mystery.threats = [{ id: "x", name: "Restless crowd", level: 2, marks: 0, removed: false }];
  const out = Life.endScene();
  Store.commit();
  eq(c.investigator.clock, 1);
  eq(c.mystery.threats.length, 0);
  eq(out.leftover.length, 1, "the leftover threat is offered as a rival");
});

await test("an empty clue deck ends the game", async () => {
  const c = seed(freshMystery({ clueDeck: [card("7", "H")] }));
  Store.begin("t");
  await Roller.gainClue("test");
  Store.commit();
  assert(c.mystery.ended && c.mystery.endTrigger === "deck_empty");
});

await test("a 9+ consequence ends the game", async () => {
  const c = seed();
  Store.begin("t");
  const ev = [];
  await Roller.applyConsequence(rules.consequenceRow(9), ev);
  Store.commit();
  assert(c.mystery.ended && c.mystery.endTrigger === "consequence");
});

await test("keyword use strikes the keyword and does what it says", async () => {
  const c = seed();
  Store.begin("t");
  c.mystery.threats = [{ id: "t1", name: "Guard patrol", level: 3, marks: 0, removed: false }];
  await Roller.useKeyword(c.investigator.keywords[0], "eliminate", { threatId: "t1" });
  Store.commit();
  assert(c.mystery.threats[0].removed, "threat gone");
  assert(c.investigator.keywords[0].struck, "keyword struck");
});

await test("a rival eliminated by a keyword still leaves the rival list", async () => {
  const c = seed();
  Settings.set("rivals", true);
  Store.begin("t");
  c.rivals = [{ id: "r1", name: "Rival detective", level: 2 }];
  c.mystery.threats = [{ id: "t1", name: "Rival detective", level: 2, marks: 0, removed: false, rivalId: "r1" }];
  const before = c.investigator.keywords.length;
  await Roller.useKeyword(c.investigator.keywords[0], "eliminate", { threatId: "t1" });
  Store.commit();
  eq(Store.career.rivals.length, 0, "off the list");
  eq(Store.career.investigator.keywords.length, before + 1, "beating a rival hands you a keyword");
  Settings.set("rivals", false);
});

await test("co-op consequences raise danger by 3 when no threat is present", async () => {
  const c = seed();
  Settings.set("multiplayer", true);
  Store.begin("t");
  const ev = [];
  await Roller.applyConsequence(rules.consequenceRow(1, true), ev);
  Store.commit();
  eq(c.mystery.danger, 3);
  Settings.set("multiplayer", false);
});

await test("undo restores the whole state of a procedure", async () => {
  const c = seed();
  const before = c.mystery.danger;
  Store.begin("test step");
  await Roller.attributeTest({ attrId: "power", manualDice: [1, 2], inInvestigation: false });
  Store.commit();
  Store.undo();
  eq(Store.mystery.danger, before);
  eq(Store.investigator.keywords.length, 1, "the gained keyword is gone");
});

await test("export round-trips through import", () => {
  seed();
  const json = Store.exportJSON();
  globalThis.__resetStorage();
  Store.init();
  Store.importJSON(json);
  assert(Store.investigator.name === "Amine", "career came back");
});

await test("old saves normalize without crashing", () => {
  globalThis.__resetStorage();
  localStorage.setItem("citr:v1", JSON.stringify({ careers: { a: { id: "a", name: "Old", investigator: { name: "X" }, mystery: { danger: 2 } } }, activeId: "a" }));
  Store.init();
  const inv = Store.investigator;
  eq(inv.fatigue, 0); eq(inv.clock, 0); eq(inv.day, 1);
  eq(Store.mystery.clueSets, {});
  assert(Array.isArray(Store.career.journal), "journal back-filled");
});

process.exit(report() ? 0 : 1);
