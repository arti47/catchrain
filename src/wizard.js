// Creation: the investigator wizard and the mystery wizard, in rule-legal order.

import { el, add, uid, shuffle } from "./core.js";
import { ATTRIBUTES, ATTRIBUTE_ARRAY, GENRES, GENRE_IDS, DIFFICULTIES } from "../data.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import { buildClueDeck, buildTruth } from "./deck.js";
import { section, row, btn, seg, explain, actionBar, showToast, promptModal } from "./ui.js";
import { go } from "./router.js";
import { glyph, attrPips, withGlyph, truthPreview, blank, rolledValue } from "./art.js";

const rerender = () => import("./router.js").then((m) => m.render());

// Draft lives in memory: nothing half-made is written into a career.
let draft = null;
const newDraft = () => ({
  step: 0, genre: "noir",
  attributes: { power: null, insight: null, method: null },
  obligation: "", signature: "", name: "", trait: "", notes: "",
});

const rollBtn = (label, fn) => btn(label, fn);

/**
 * What each step of the investigator wizard is called and what its button says.
 * The guide reads this rather than keeping its own copy, so it can never name a
 * control that is not on the screen you are looking at.
 */
export const WIZARD_STEPS = [
  { name: "Attributes", action: "Next: obligation" },
  { name: "Obligation", action: "Next: signature keyword" },
  { name: "Signature", action: "Next: who they are" },
  { name: "Identity", action: "Create the investigator" },
];
export const wizardStep = () => (draft ? draft.step : 0);

export function renderWizard(host) {
  if (!draft) draft = newDraft();
  const steps = [stepAttributes, stepObligation, stepKeyword, stepIdentity];
  const step = steps[draft.step];
  add(host, el("h1", { text: "Create an investigator" }),
    explain("Four steps, in the book's order: spread 2/1/0 across your three attributes, take one obligation from the rest of your life, name the signature keyword you can lean on again and again, then say who this person is."));
  const bar = el("div", { class: "steps", role: "list", "aria-label": `Step ${draft.step + 1} of ${WIZARD_STEPS.length}` });
  WIZARD_STEPS.forEach((st, i) => {
    add(bar, el("button", {
      class: `step-seg ${i === draft.step ? "now" : i < draft.step ? "done" : ""}`.trim(),
      type: "button", role: "listitem",
      "aria-label": `${st.name}${i === draft.step ? ", where you are" : i < draft.step ? ", done" : ", not reached"}`,
      "aria-current": i === draft.step ? "step" : null,
      disabled: i > draft.step,
      onclick: () => { if (i < draft.step) { draft.step = i; rerender(); } },
    }));
  });
  add(host, section(`Step ${draft.step + 1} of 4 \u00b7 ${WIZARD_STEPS[draft.step].name}`, bar));
  add(host, indexCard());
  const out = step(host);
  return out;
}

/**
 * The investigator as an index card, filling in as you choose: a name on the
 * top line, the trait under it, the three attributes as pips, the obligation
 * under its roof and the signature keyword under its seal. No face (decision 9).
 */
function indexCard() {
  const line = (mark, value, what) => el("div", { class: "index-line" }, glyph(mark, 16),
    value ? el("span", { text: value }) : blank(`${what} not chosen yet`));
  return el("div", { class: "index-card", role: "group", "aria-label": "The investigator so far" },
    el("div", { class: "index-name" }, draft.name ? el("span", { text: draft.name }) : blank("no name yet")),
    el("div", { class: "index-trait" }, draft.trait ? el("span", { text: draft.trait }) : blank("no trait yet")),
    el("div", { class: "index-attrs" }, ...ATTRIBUTES.map((a) => el("span", { class: "index-attr" },
      el("span", { class: "index-attr-name", text: a.name }),
      draft.attributes[a.id] === null ? blank(`${a.name} not assigned`) : attrPips(draft.attributes[a.id])))),
    line("obligation", draft.obligation, "Obligation"),
    line("seal", draft.signature, "Signature keyword"));
}

function stepAttributes(host) {
  const used = Object.values(draft.attributes).filter((v) => v !== null);
  add(host, section("Assign 2, 1 and 0",
    el("p", { class: "small muted", text: "2 for what they are best at, 1 for the next, 0 for the last. Power is force and endurance, Insight is reasoning and noticing, Method is resourcefulness." }),
    ...ATTRIBUTES.map((a) => el("div", { class: "defrow" },
      el("span", { class: "row-label" }, a.name, " — ", el("small", { class: "muted", text: a.text })),
      el("div", { class: "defrow-value" },
        seg(ATTRIBUTE_ARRAY.map((v) => ({ value: v, label: el("span", { class: "seg-with-glyph" }, attrPips(v), el("span", { text: String(v) })) })), draft.attributes[a.id], (v) => {
          const takenBy = Object.entries(draft.attributes).find(([k, val]) => val === v && k !== a.id);
          if (takenBy) draft.attributes[takenBy[0]] = null;
          draft.attributes[a.id] = v;
          rerender();
        }, a.name))))));
  const done = used.length === 3;
  return { action: actionBar("Next: obligation", () => { if (!done) { showToast("Assign all three values."); return; } draft.step = 1; rerender(); }, done ? "2 / 1 / 0 assigned" : "Assign all three") };
}

function genrePicker(onPick) {
  const g = seg(GENRE_IDS.map((id) => ({ value: id, label: withGlyph(id, GENRES[id].name) })), draft.genre,
    (id) => { draft.genre = id; onPick(); }, "Genre");
  g.classList.add("grid");
  return g;
}

function stepObligation(host) {
  add(host, section("Where do the tables come from?", genrePicker(rerender),
    el("p", { class: "small muted", text: "Pick the genre whose tables you want to roll on. You can mix genres later." })));
  add(host, section("Your obligation",
    el("p", { class: "small muted", text: "Something your investigator owes the rest of their life. Neglect it and the day costs you fatigue." }),
    el("p", { class: "mono" }, draft.obligation ? rolledValue(draft.obligation, draft.obligationCode) : blank()),
    el("div", { class: "btn-row" },
      rollBtn("Roll one", () => { const r = R.rollGenre(draft.genre, "obligations"); draft.obligation = r.value; draft.obligationCode = r.code; rerender(); }),
      btn("Write my own", async () => { const t = await promptModal({ title: "Obligation", value: draft.obligation }); if (t) { draft.obligation = t; draft.obligationCode = null; rerender(); } }))));
  return { action: actionBar("Next: signature keyword", () => { if (!draft.obligation) { showToast("Take an obligation first."); return; } draft.step = 2; rerender(); }) };
}

function stepKeyword(host) {
  add(host, section("Signature keyword",
    el("p", { class: "small muted", text: "The thing they always have: a revolver, a photograph, a way with people. Unlike other keywords it comes back every time you rest." }),
    el("p", { class: "mono" }, draft.signature ? rolledValue(draft.signature, draft.signatureCode) : blank()),
    el("div", { class: "btn-row" },
      rollBtn("Roll one", () => { const r = R.rollGenre(draft.genre, "keywords"); draft.signature = r.value; draft.signatureCode = r.code; rerender(); }),
      btn("Write my own", async () => { const t = await promptModal({ title: "Signature keyword", value: draft.signature }); if (t) { draft.signature = t; draft.signatureCode = null; rerender(); } }))));
  return { action: actionBar("Next: who they are", () => { if (!draft.signature) { showToast("Name a signature keyword."); return; } draft.step = 3; rerender(); }) };
}

function stepIdentity(host) {
  add(host, section("Name",
    el("p", { class: "mono" }, draft.name ? el("span", { text: draft.name }) : blank("no name yet")),
    el("div", { class: "btn-row" },
      rollBtn("Roll a name", () => { draft.name = R.rollName("tables").name; rerender(); }),
      rollBtn("Roll from affixes", () => { draft.name = R.rollName("affix").name; rerender(); }),
      btn("Type it", async () => { const t = await promptModal({ title: "Name", value: draft.name }); if (t) { draft.name = t; rerender(); } }))));
  add(host, section("Trait",
    el("p", { class: "mono" }, draft.trait ? rolledValue(draft.trait, draft.traitCode) : blank()),
    el("div", { class: "btn-row" },
      rollBtn("Roll a trait", () => { const r = R.randomTrait(); draft.trait = r.value; draft.traitCode = r.code; rerender(); }),
      btn("Write my own", async () => { const t = await promptModal({ title: "Trait", value: draft.trait }); if (t) { draft.trait = t; draft.traitCode = null; rerender(); } }))));
  add(host, section("Anything else", el("p", { class: "small muted", text: "Optional notes: how they carry themselves, who they were before." }),
    btn(draft.notes ? "Edit notes" : "Add notes", async () => { const t = await promptModal({ title: "Notes", value: draft.notes, multiline: true }); if (t !== null) { draft.notes = t; rerender(); } })));
  return { action: actionBar("Create the investigator", finishInvestigator, draft.name ? draft.name : "Name them first") };
}

function finishInvestigator() {
  if (!draft.name) { showToast("Give them a name."); return; }
  let career = Store.career;
  if (!career) career = Store.newCareer(draft.name);
  const made = D.normalizeInvestigator({
    name: draft.name, trait: draft.trait, notes: draft.notes,
    attributes: { ...draft.attributes },
    obligations: [{ id: uid(), text: draft.obligation, struck: false }],
    keywords: [{ id: uid(), text: draft.signature, signature: true, struck: false }],
  });
  const joining = !!(Store.investigator && Store.investigator.name);
  Store.update("create investigator", () => {
    const c = Store.career;
    c.defaultGenre = draft.genre;
    if (joining) {
      // A second investigator joins the party (Ch.3); the first names the career.
      Store.addInvestigator(made);
    } else {
      c.name = draft.name;
      made.id = Store.investigator.id; // keep the slot the career already points at
      c.investigators[c.investigators.findIndex((i) => i.id === made.id)] = made;
    }
  });
  Store.journal("create", joining ? `${draft.name} joins the investigation.` : `${draft.name} takes the case.`);
  draft = null;
  go(Store.mystery ? "home" : "mystery");
}

// --- The mystery wizard -------------------------------------------------------
let mDraft = null;
const newMysteryDraft = () => {
  const c = Store.career;
  return { genre: (c && c.defaultGenre) || "noir", difficulty: "standard", location: null, object: null, treachery: null, secondObject: null, motivation: "" };
};

export function renderMysteryWizard(host) {
  if (!mDraft) mDraft = newMysteryDraft();
  const c = Store.career;
  if (!c || !Store.investigator.name) { go("wizard"); return {}; }

  add(host, el("h1", { text: "Set up a mystery" }),
    explain("A problem is a place, a thing, and something bad that happened to it. Roll all three, give your investigator a reason to care, and the decks are built for you."));

  const genres = seg(GENRE_IDS.map((g) => ({ value: g, label: withGlyph(g, GENRES[g].name) })), mDraft.genre,
    (g) => { mDraft.genre = g; rerender(); }, "Genre");
  genres.classList.add("grid");
  add(host, section("Genre", genres,
    el("p", { class: "small muted", text: "This picks which set of tables the mystery rolls on." })));

  const diffs = seg(DIFFICULTIES.map((d) => ({ value: d.id, label: d.name })), mDraft.difficulty,
    (id) => { mDraft.difficulty = id; rerender(); }, "Difficulty");
  diffs.classList.add("grid");
  add(host, section("Difficulty", diffs,
    el("p", { class: "small muted", text: R.difficulty(mDraft.difficulty).text }),
    row("Truth deck", truthPreview(R.difficulty(mDraft.difficulty))),
    Settings.get("career")
      ? row("Experience bonus", `${R.difficulty(mDraft.difficulty).xpBonus >= 0 ? "+" : ""}${R.difficulty(mDraft.difficulty).xpBonus} XP`)
      : null));

  const line = (label, value, onRoll, code = null) => el("div", { class: "defrow" },
    el("span", { class: "row-label", text: label }),
    el("div", { class: "defrow-value" }, el("p", { class: "mono" }, value ? rolledValue(value, code) : blank()), btn("Roll", onRoll)));

  add(host, section("The problem",
    line("Location", mDraft.location && mDraft.location.value, () => { mDraft.location = R.rollGenre(mDraft.genre, "locations"); rerender(); }, mDraft.location && mDraft.location.code),
    line("Object", mDraft.object && mDraft.object.value, () => { mDraft.object = R.rollGenre(mDraft.genre, "objects"); rerender(); }, mDraft.object && mDraft.object.code),
    line("Treachery", mDraft.treachery && mDraft.treachery.value, () => {
      mDraft.treachery = R.rollTreachery();
      mDraft.secondObject = mDraft.treachery.needsSecondObject ? R.rollGenre(mDraft.genre, "objects").value : null;
      rerender();
    }, mDraft.treachery && mDraft.treachery.code),
    mDraft.treachery && mDraft.treachery.needsSecondObject ? line("Second object", mDraft.secondObject, () => { mDraft.secondObject = R.rollGenre(mDraft.genre, "objects").value; rerender(); }) : null,
    el("div", { class: "btn-row" },
      btn("Roll all three", () => {
        const p = R.randomProblem(mDraft.genre);
        Object.assign(mDraft, p);
        mDraft.secondObject = p.treachery.needsSecondObject ? R.rollGenre(mDraft.genre, "objects").value : null;
        rerender();
      }),
      btn("Write it myself", async () => {
        const loc = await promptModal({ title: "Location", value: mDraft.location ? mDraft.location.value : "" });
        if (loc === null) return;
        const obj = await promptModal({ title: "Object", value: mDraft.object ? mDraft.object.value : "" });
        if (obj === null) return;
        const tre = await promptModal({ title: "Treachery", message: "What happened to it?", value: mDraft.treachery ? mDraft.treachery.value : "" });
        if (tre === null) return;
        mDraft.location = { value: loc }; mDraft.object = { value: obj }; mDraft.treachery = { value: tre, needsSecondObject: false };
        mDraft.secondObject = null;
        rerender();
      }))));

  if (mDraft.location && mDraft.object && mDraft.treachery) {
    add(host, section("Reads as",
      el("p", { text: R.problemText({ location: mDraft.location.value, object: mDraft.object.value, treachery: mDraft.treachery.value, secondObject: mDraft.secondObject }) })));
  }

  add(host, section("Motivation",
    el("p", { class: "small muted", text: "Why does your investigator walk into this?" }),
    el("p", { class: "mono" }, mDraft.motivation ? rolledValue(mDraft.motivation, mDraft.motivationCode) : blank()),
    el("div", { class: "btn-row" },
      btn("Roll one", () => { const r = R.randomMotivation(); mDraft.motivation = r.value; mDraft.motivationCode = r.code; rerender(); }),
      btn("Write my own", async () => { const t = await promptModal({ title: "Motivation", value: mDraft.motivation }); if (t) { mDraft.motivation = t; mDraft.motivationCode = null; rerender(); } }))));

  if (Settings.get("career") && Store.career.questions.length) {
    add(host, section("Lingering questions",
      el("p", { class: "small muted", text: "From earlier cases. Use one in place of a rolled element." }),
      ...Store.career.questions.slice(-4).map((q) => el("p", { class: "small", text: `“${q.text}”` }))));
  }

  const ready = mDraft.location && mDraft.object && mDraft.treachery;
  return { action: actionBar("Start the mystery", startMystery, ready ? "Builds both decks" : "Roll the problem first") };
}

function startMystery() {
  if (!(mDraft.location && mDraft.object && mDraft.treachery)) { showToast("Roll the problem first."); return; }
  const c = Store.career;
  const truth = buildTruth(mDraft.difficulty);
  Store.update("start mystery", () => {
    c.mystery = D.normalizeMystery({
      id: uid(), genre: mDraft.genre, difficulty: mDraft.difficulty,
      location: mDraft.location.value, object: mDraft.object.value,
      treachery: mDraft.treachery.value, secondObject: mDraft.secondObject,
      motivation: mDraft.motivation, danger: Settings.get("career") ? (c.carryDanger || 0) : 0,
      clueDeck: buildClueDeck(), clueDiscard: [], clueSets: {}, threats: [],
      ...truth, startedAt: Date.now(),
    });
    c.carryDanger = 0;
  });
  Store.journal("mystery", R.problemText(c.mystery));
  mDraft = null;
  go("play");
}

export const resetDrafts = () => { draft = null; mDraft = null; };

/**
 * Everything rolled, nothing asked: the shortest legal way from a blank app to
 * the first scene. It takes the same paths the two wizards take — the same
 * tables, the same deck build, the same normalisation — so there is no second
 * definition of a legal investigator anywhere.
 */
export function expressStart(genreId = "noir", difficultyId = "standard") {
  const spread = shuffle(ATTRIBUTE_ARRAY);
  const attributes = {};
  ATTRIBUTES.forEach((a, i) => { attributes[a.id] = spread[i]; });

  const made = D.normalizeInvestigator({
    name: R.rollName("tables").name,
    trait: R.randomTrait().value,
    attributes,
    obligations: [{ id: uid(), text: R.rollGenre(genreId, "obligations").value, struck: false }],
    keywords: [{ id: uid(), text: R.rollGenre(genreId, "keywords").value, signature: true, struck: false }],
  });

  let career = Store.career;
  if (!career) career = Store.newCareer(made.name);
  Store.update("start playing", () => {
    const c = Store.career;
    c.name = made.name;
    c.defaultGenre = genreId;
    made.id = Store.investigator.id;
    c.investigators[c.investigators.findIndex((i) => i.id === made.id)] = made;
  });
  Store.journal("create", `${made.name} takes the case.`);

  const problem = R.randomProblem(genreId);
  const secondObject = problem.treachery.needsSecondObject ? R.rollGenre(genreId, "objects").value : null;
  const truth = buildTruth(difficultyId);
  Store.update("start mystery", () => {
    Store.career.mystery = D.normalizeMystery({
      id: uid(), genre: genreId, difficulty: difficultyId,
      location: problem.location.value, object: problem.object.value,
      treachery: problem.treachery.value, secondObject,
      motivation: R.randomMotivation().value,
      danger: Settings.get("career") ? (Store.career.carryDanger || 0) : 0,
      clueDeck: buildClueDeck(), clueDiscard: [], clueSets: {}, threats: [],
      ...truth, startedAt: Date.now(),
    });
    Store.career.carryDanger = 0;
  });
  Store.journal("mystery", R.problemText(Store.mystery));
  draft = null; mDraft = null;
  return { investigator: Store.investigator, mystery: Store.mystery };
}
