// Builds the three seed states every harness and probe shares, so no two
// passes measure a different app. Run: node tests/make-fixtures.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const clue = [];
for (const r of ["A","2","3","4","5","6","7","8","9","10"]) for (const s of ["S","H","D","C"]) clue.push({ id: r + s, rank: r, suit: s });
const truth = [];
for (const r of ["J","Q","K"]) for (const s of ["S","H","D","C"]) truth.push({ id: r + s, rank: r, suit: s });

const career = (over = {}) => ({
  id: "c1", name: "Amine Deckard", createdAt: 1730000000000, xp: 4,
  rivals: [], history: [], questions: [], journal: [], rollLog: [],
  investigator: {
    name: "Amine Deckard", trait: "Insomniac", notes: "Ex-detective.",
    attributes: { power: 2, insight: 1, method: 0 }, struck: {}, fatigue: 0, clock: 0, day: 1,
    obligations: [{ id: "o1", text: "Run the lake", struck: false }],
    keywords: [{ id: "k1", text: "Smooth talker", signature: true, struck: false }],
  },
  mystery: null, ...over,
});

const mystery = (over = {}) => ({
  id: "m1", genre: "noir", difficulty: "standard", danger: 3, motivation: "Right a wrong",
  location: "Shopping centre", object: "Resident", treachery: "Perished", secondObject: null,
  clueDeck: clue.slice(6), clueDiscard: clue.slice(0, 3),
  truthDeck: truth.slice(5), truthRevealed: truth.slice(0, 2), setAside: truth.slice(2, 5),
  clueSets: {}, threats: [], scene: null, jokersDrawn: 0, ended: false, ...over,
});

const fresh = { v: 1, activeId: null, careers: {} };

const mid = { v: 1, activeId: "c1", careers: { c1: career({
  journal: Array.from({ length: 12 }, (_, i) => ({ id: "j" + i, ts: 1730000000000 + i * 60000, kind: "test", text: `Test ${i}: something moved in the crowd.`, day: 1 })),
  rollLog: Array.from({ length: 10 }, (_, i) => ({ id: "l" + i, ts: 1730000000000 + i * 30000, kind: "test", dice: [1 + i % 6, 1 + (i * 3) % 6], attrValue: 2, total: 7, outcome: "cost", label: "Find a way in" })),
  mystery: mystery({
    clueSets: {
      "7": { rank: "7", cards: [clue[24], clue[25]], entries: ["A strong person took the console"], description: "A strong person took the console", truth: false, falseLead: false, truthCards: [] },
      "3": { rank: "3", cards: [clue[8]], entries: ["Head injury"], description: "Head injury", truth: true, falseLead: false, truthCards: [] },
    },
    threats: [{ id: "t1", name: "Restless crowd", level: 2, marks: 1, removed: false }],
    scene: { id: "s1", type: "investigation", stage: "acquisition", order: ["infiltration", "discovery", "acquisition", "escape"], index: 2, done: false, forceEscape: false },
  }),
}) } };

// What a table actually has by session three.
const stress = { v: 1, activeId: "c1", careers: { c1: career({
  xp: 11,
  rivals: [
    { id: "r1", name: "Rival detective", level: 2 }, { id: "r2", name: "Police presence", level: 3 },
    { id: "r3", name: "Unrelenting stalker", level: 2 }, { id: "r4", name: "Interested faction", level: 2 },
    { id: "r5", name: "Assassin", level: 3 }, { id: "r6", name: "Media presence", level: 2 },
  ],
  history: Array.from({ length: 6 }, (_, i) => ({ id: "h" + i, problem: `It happened at the pier. That's where the witness vanished. (${i})`, correct: i % 4, difficulty: "hard", answers: ["Because the pier was where the shipments landed."], closedAt: 1730000000000 + i * 86400000 })),
  questions: Array.from({ length: 5 }, (_, i) => ({ id: "q" + i, text: `Who paid for the van, and why did nobody report it missing? (${i})` })),
  journal: Array.from({ length: 220 }, (_, i) => ({ id: "j" + i, ts: 1730000000000 + i * 60000, kind: i % 3 ? "test" : "note", day: 1 + Math.floor(i / 16), text: `Day ${1 + Math.floor(i / 16)}: a long entry about the crowd outside the shopping centre, the taped door of the green van, and the way the rain kept the witnesses inside. Entry ${i}.` })),
  rollLog: Array.from({ length: 180 }, (_, i) => ({ id: "l" + i, ts: 1730000000000 + i * 30000, kind: ["test", "investigation", "rest", "keyword"][i % 4], dice: [1 + i % 6, 1 + (i * 5) % 6], attrValue: i % 3, total: 4 + (i % 9), outcome: ["failure", "cost", "success"][i % 3], label: "Act against the restless crowd" })),
  investigator: {
    name: "Amine Deckard", trait: "Insomniac", notes: "Ex-detective, struck off after the Bardon case. Keeps the badge anyway.",
    attributes: { power: 3, insight: 2, method: 1 }, struck: { insight: true, method: true }, fatigue: 4, clock: 3, day: 9,
    obligations: [
      { id: "o1", text: "Run the lake", struck: false }, { id: "o2", text: "Work at a day job", struck: true },
      { id: "o3", text: "Care for a pet", struck: false }, { id: "o4", text: "Win a legal battle", struck: false },
    ],
    keywords: [
      { id: "k1", text: "Smooth talker", signature: true, struck: true }, { id: "k2", text: "Polaroid", signature: false, struck: true },
      { id: "k3", text: "Backdoor", signature: false, struck: false }, { id: "k4", text: "Powerful ally", signature: false, struck: false },
      { id: "k5", text: "Avenue of escape", signature: false, struck: true }, { id: "k6", text: "Conspiracy", signature: false, struck: false },
      { id: "k7", text: "Second badge", signature: true, struck: false },
    ],
  },
  mystery: mystery({
    danger: 11, difficulty: "hard", clueDeck: clue.slice(30), clueDiscard: clue.slice(0, 14),
    truthDeck: truth.slice(9), truthRevealed: truth.slice(0, 6), setAside: truth.slice(6, 9), jokersDrawn: 2,
    clueSets: {
      "7": { rank: "7", cards: [clue[24], clue[25], clue[26]], entries: ["A strong person took the console", "One of the doors is taped shut", "The van was seen at the pier"], description: "A strong person took the console — one of the doors is taped shut — the van was seen at the pier", truth: true, falseLead: false, truthCards: [] },
      "3": { rank: "3", cards: [clue[8], clue[9]], entries: ["Head injury", "The coroner was paid"], description: "Head injury — the coroner was paid", truth: true, falseLead: false, truthCards: [] },
      "9": { rank: "9", cards: [], entries: [], description: "The taped door meant nothing", truth: false, falseLead: true, truthCards: [] },
      "A": { rank: "A", cards: [clue[0]], entries: ["An eviction notice pinned to the shutter"], description: "An eviction notice pinned to the shutter", truth: false, falseLead: false, truthCards: [] },
      "5": { rank: "5", cards: [clue[16], clue[17]], entries: ["A second witness who will not give a name"], description: "A second witness who will not give a name", truth: false, falseLead: false, truthCards: [] },
    },
    threats: [
      { id: "t1", name: "Restless crowd", level: 3, marks: 1, removed: false },
      { id: "t2", name: "Police presence", level: 2, marks: 0, removed: false },
      { id: "t3", name: "Armed individual", level: 3, marks: 2, removed: false },
      { id: "t4", name: "Heavy rain", level: 1, marks: 0, removed: false },
    ],
    scene: { id: "s1", type: "investigation", stage: "escape", order: ["infiltration", "discovery", "acquisition", "escape"], index: 3, done: false, forceEscape: true },
  }),
}) } };

// The joker path is 2 cards in 42, so it gets a fixture of its own: the next
// card is a joker and there are two leads for it to choose between.
const joker = { v: 1, activeId: "c1", careers: { c1: career({
  mystery: mystery({
    clueDeck: [{ id: "JOKER1", rank: "JOKER", suit: null }, ...clue.slice(10)],
    clueSets: {
      "7": { rank: "7", cards: [clue[24], clue[25]], entries: ["A strong person took the console"], description: "A strong person took the console", truth: false, falseLead: false, truthCards: [] },
      "5": { rank: "5", cards: [clue[16]], entries: ["A second witness"], description: "A second witness", truth: false, falseLead: false, truthCards: [] },
    },
    threats: [],
    scene: { id: "s1", type: "investigation", stage: "acquisition", order: ["discovery", "acquisition"], index: 1, done: false, forceEscape: false },
  }),
}) } };

// Chapter 3 co-op: two investigators, one mystery, a round already half taken.
const party = { v: 1, activeId: "c1", careers: { c1: {
  id: "c1", name: "Amine Deckard", createdAt: 1730000000000,
  rivals: [], history: [], questions: [], journal: [], rollLog: [],
  activeInvestigatorId: "inv1",
  investigators: [
    { id: "inv1", name: "Amine Deckard", trait: "Insomniac", notes: "", xp: 2,
      attributes: { power: 2, insight: 1, method: 0 }, struck: {}, fatigue: 2, clock: 1, day: 2,
      obligations: [{ id: "o1", text: "Run the lake", struck: true }],
      keywords: [{ id: "k1", text: "Smooth talker", signature: true, struck: false }] },
    { id: "inv2", name: "Percy Roh", trait: "Paranoid", notes: "", xp: 2,
      attributes: { power: 0, insight: 2, method: 1 }, struck: {}, fatigue: 3, clock: 1, day: 2,
      obligations: [{ id: "o2", text: "Write a novel", struck: false }],
      keywords: [{ id: "k2", text: "Polaroid", signature: true, struck: false }] },
  ],
  mystery: mystery({
    danger: 4,
    clueSets: {
      "7": { rank: "7", cards: [clue[24], clue[25]], entries: ["A strong person took the console"], description: "A strong person took the console", truth: false, falseLead: false, truthCards: [] },
    },
    threats: [],
    scene: { id: "s1", type: "rest", stage: null, order: [], index: 0, done: true, forceEscape: false, actorId: "inv1", participants: ["inv1"] },
    round: { mode: "individual", scenes: { inv1: { type: "rest", done: true } } },
  }),
} } };

mkdirSync("tests/fixtures", { recursive: true });
for (const [name, value] of Object.entries({ fresh, "mid-session": mid, stress, joker, party })) {
  writeFileSync(`tests/fixtures/${name}.json`, JSON.stringify(value, null, 1));
  console.log(`tests/fixtures/${name}.json`);
}
