// The Story: the case told beat by beat, on the Table where it is played.
//
// The journal was a separate tab you went to after the fact; here it is the
// page itself. Every roll, consequence, clue and threat the engine produces is
// written as a short line of story — the case's own nouns in a sentence, with
// the dice as a small chip beside it — and under each beat that matters there
// is a line for the player's own words, seeded with an oracle prompt.
//
// Presentation only. The sentences carry no rule and no number of their own:
// every figure in them is read off the event the engine produced, and the exact
// mechanical line is kept as the entry's text, one tap away on its chip.

import { el, add } from "./core.js";
import { STAGES, SCENE_FRAMING } from "../data.js";
import * as R from "./rules.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import { eventText } from "./prompts.js";
import { rankName } from "./deck.js";
import { glyph, eventGlyph, flatDie } from "./art.js";

const rerender = () => import("./router.js").then((m) => m.render());

// --- Which entries are this case ------------------------------------------------

const PUT_DOWN = "The case was put down unfinished.";
/** A case opens with its premise, written as a "mystery" entry by the wizard. */
const isCaseStart = (j) => j.kind === "mystery" && j.text !== PUT_DOWN;

/** The entries that tell the case in play, oldest first. */
export function caseEntries(c, m) {
  if (!c || !m) return [];
  const j = c.journal || [];
  // Entries written before cases were tagged belong to whichever case had last
  // opened; tagged ones say so themselves.
  let from = 0;
  for (let i = j.length - 1; i >= 0; i--) if (isCaseStart(j[i]) && (!j[i].meta || !j[i].meta.case || j[i].meta.case === m.id)) { from = i; break; }
  return j.slice(from).filter((e) => !e.meta || !e.meta.case || e.meta.case === m.id);
}

/**
 * The whole journal filed by case, for the Notebook: each case from its
 * premise to the next one, with the entries written before any case first.
 */
export function cases(c) {
  const out = [];
  let cur = { title: null, entries: [], open: false };
  for (const e of (c && c.journal) || []) {
    if (isCaseStart(e)) {
      if (cur.entries.length) out.push(cur);
      cur = { title: e.text, caseId: e.meta && e.meta.case, ts: e.ts, entries: [e], open: false };
    } else cur.entries.push(e);
  }
  if (cur.entries.length) out.push(cur);
  const m = c && c.mystery;
  if (m) {
    const last = out[out.length - 1];
    if (last && (!last.caseId || last.caseId === m.id)) last.open = true;
  }
  return out;
}

// --- Prose ----------------------------------------------------------------------

/** A stable pick among variants, so a beat reads the same every time it is drawn. */
function pick(list, seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
const first = (name) => String(name || "You").trim().split(/\s+/)[0];
const lcFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** What an investigator is doing, from the label of the test they made. */
function doing(label) {
  const stage = STAGES.find((s) => s.action === label);
  if (stage) return { infiltration: "looks for a way in", discovery: "works out where the clue is", acquisition: "goes for the clue", escape: "makes for the door" }[stage.id];
  const against = /^Act against (.+)$/.exec(label || "");
  if (against) return `turns on ${against[1]}`;
  if (label === "Random event") return "meets the day's event head on";
  return lcFirst(label || "tries something");
}
const OUTCOME_TAIL = {
  success: [" — and it works.", ". It goes their way.", ", and gets it done."],
  cost: [" — it works, but at a price.", ". It holds, just about.", ", and pays for it."],
  failure: [" — and it goes wrong.", ". It does not work.", ", and comes up short."],
};

/** The sentence for a test the investigator made. */
export function testProse(who, label, outcomeId, seed) {
  return `${first(who)} ${doing(label)}${pick(OUTCOME_TAIL[outcomeId] || OUTCOME_TAIL.cost, seed)}`;
}

const CONSEQUENCE_PROSE = {
  threat_up: ["Things get worse.", "The scene tightens."],
  discard: ["A lead goes cold.", "Something slips away — a card leaves the deck."],
  fatigue1: ["It wears {who} down.", "{who} feels it."],
  fatigue2: ["It takes it out of {who}.", "{who} is badly shaken."],
  end: ["{who} can go no further."],
  danger3: ["The danger climbs sharply."],
};

/**
 * One engine event as a beat: its sentence, whether it is a beat the player
 * may write under (major) or a small tick of machinery (minor), and the dice
 * chip, if dice were thrown for it.
 */
export function beatFor(e, who, seed) {
  const w = first(who);
  const fill = (s) => s.replace(/\{who\}/g, w);
  switch (e.t) {
    case "consequence": {
      const row = R.consequenceRow(e.total, Settings.get("multiplayer"));
      const lines = CONSEQUENCE_PROSE[row && row.id] || ["Something gives."];
      return { major: false, prose: fill(pick(lines, seed)), chip: { dice: [e.die], plus: e.bonus || 0, total: e.total, what: "Consequence" } };
    }
    case "threat_acts": return { major: true, prose: pick([`${e.name} moves against ${w}.`, `${e.name} makes its move.`, `${e.name} does not wait.`], seed), chip: { dice: [e.die], plus: e.level, total: e.total, what: `${e.name} acts` } };
    case "threat_in": return { major: true, prose: pick([`${e.name} is here.`, `Out of the rain: ${e.name}.`, `${e.name} steps into the scene.`], seed) };
    case "rival_returns": return { major: true, prose: `${e.name} is back.` };
    case "threat_removed": return { major: true, prose: e.via === "keyword" ? `${e.name} is dealt with, one way or another.` : pick([`${e.name} is dealt with.`, `${e.name} is out of the way.`], seed) };
    case "threat_up": return { major: false, prose: `${e.name} grows more dangerous.` };
    case "threat_marked": return { major: false, prose: `${e.name} gives ground (${e.marks}/${e.level}).` };
    case "rival_defeated": return { major: false, prose: `${e.name} will not trouble you again.` };
    case "attribute_struck": return { major: true, prose: `${w}'s ${String(e.attribute).toLowerCase()} gives out.` };
    case "force_escape": return { major: true, prose: "Too tired to stay. Time to run." };
    case "keyword_gained": return { major: true, prose: `${w} comes away with something: ${e.text}.` };
    case "new_clue": return { major: true, prose: pick([`A new lead: the ${rankName(e.set.rank)}.`, `Something to go on — the ${rankName(e.set.rank)}.`], seed) };
    case "strengthen_clue": return { major: true, prose: `The ${rankName(e.set.rank)} get clearer.` };
    case "false_lead": return { major: true, prose: `The ${rankName(e.rank)} were never part of it.` };
    case "deck_empty": return { major: true, prose: "There is nothing left to find." };
    case "game_over": return { major: true, prose: e.trigger === "deck_empty" ? "The trail has gone cold. Time to name the truth." : `${w} cannot go on. Time to name the truth.` };
    case "random_event": return { major: true, prose: `Something else happens: ${e.words.join(", ")}.` };
    case "investigation_roll": return { major: true, prose: e.text, chip: { dice: [e.die], plus: e.danger, total: e.total, what: "Investigation roll" } };
    case "rest": return { major: true, prose: `${w} rests${e.cleared ? `, and ${e.cleared} fatigue lifts` : ""}.`, chip: { dice: [e.die], plus: 0, total: e.die, what: "Rest" } };
    case "obligation_attended": return { major: true, prose: `${w} attends to it: ${lcFirst(e.text)}.` };
    case "day_end": return { major: true, prose: e.neglected.length ? `The day ends with things left undone: ${e.neglected.join(", ")}.` : "The day ends with nothing left undone." };
    case "test": case "scene_end": case "day_start": return null; // told by their own entries
    default: {
      const text = eventText(e);
      return text ? { major: false, prose: text } : null;
    }
  }
}

/** A two-word prompt for the line under a beat: the oracle's verb and adjective. */
export function promptWords() {
  return R.subjectWords(R.rollSubject(false)).join(" · ");
}

/**
 * Write the events of one action into the story. Each becomes an entry whose
 * text is the exact mechanical line the journal always kept, and whose meta
 * carries the sentence, the chip and a prompt for the player's line.
 */
export function tell(events, who) {
  if (!events || !events.length || !Store.career) return;
  const name = who ? who.name : (Store.investigator || {}).name;
  // A clue the player described in its dialog keeps that description as its line.
  const lastFor = new Map();
  events.forEach((e, i) => { if ((e.t === "new_clue" || e.t === "strengthen_clue") && e.set) lastFor.set(e.set.rank, i); });
  events.forEach((e, i) => {
    const seed = `${Date.now()}-${i}-${e.t}`;
    const b = beatFor(e, name, seed);
    if (!b) return;
    const meta = { t: e.t, prose: b.prose, major: b.major };
    if (b.chip) meta.chip = b.chip;
    if (b.major) meta.prompt = promptWords();
    if (lastFor.get(e.set && e.set.rank) === i && e.set.entries && e.set.entries.length) meta.line = e.set.entries[e.set.entries.length - 1];
    Store.journal("event", eventText(e) || b.prose, meta);
  });
}

// --- Drawing the story ------------------------------------------------------------

/** The dice chip: the dice drawn small, the sum beside them, the full line on a tap. */
function chip(c, full) {
  if (!c) return null;
  const sum = `${c.attrName ? `${c.attrName} ${c.attrValue} + ` : ""}${c.dice.join(" + ")}${c.plus ? ` + ${c.plus}` : ""} = ${c.total}`;
  const d = el("details", { class: "dice-chip" });
  add(d, el("summary", { "aria-label": `${c.what || "Roll"}: ${sum}. Show the arithmetic` },
    ...c.dice.map((n) => flatDie(n, "chip-die")), el("b", { text: String(c.total) })),
    el("span", { class: "dice-chip-full", text: full || `${c.what || "Roll"}: ${sum}` }));
  return d;
}

/** The player's line under a beat: optional, saved as you go, never in the way. */
function lineField(entry, readOnly, open = true) {
  const meta = entry.meta || {};
  if (readOnly) return meta.line ? el("p", { class: "beat-line", text: meta.line }) : null;
  // Older chapters show what was written; a tap on the beat opens the pen there.
  if (!open && !meta.line) return null;
  const ta = el("textarea", {
    class: "beat-input", rows: 1,
    "aria-label": "Your line",
    placeholder: meta.prompt ? `Add a line… (${meta.prompt})` : "Add a line…",
  });
  ta.value = meta.line || "";
  const grow = () => { ta.style.height = "auto"; ta.style.height = `${ta.scrollHeight}px`; };
  ta.addEventListener("input", grow);
  ta.addEventListener("change", () => Store.setLine(entry.id, ta.value.trim()));
  ta.addEventListener("blur", () => Store.setLine(entry.id, ta.value.trim()));
  requestAnimationFrame(grow);
  return ta;
}

/** What scene an entry opened, if it opened one. */
export function sceneStartOf(e) { return sceneStart(e); }
function sceneStart(e) {
  if (e.kind !== "scene" || (e.meta && e.meta.framing)) return null;
  if (e.meta && e.meta.start) return e.meta.start;
  if (/^Investigation scene:/.test(e.text)) return "investigation";
  if (/^Truth scene:/.test(e.text)) return "truth";
  if (/ rests\.$/.test(e.text)) return "rest";
  if (/ attends: /.test(e.text)) return "obligation";
  return null;
}
const isSceneEnd = (e) => e.kind === "scene" && /^Scene ended/.test(e.text);

/** One entry as it reads in the story. */
function beatNode(e, { readOnly, fresh, open = true }) {
  const meta = e.meta || {};
  const cls = (x) => `beat ${x}${fresh ? " arrive" : ""}`;
  if (e.kind === "test") {
    return el("div", { class: cls(`major test ${meta.outcome || ""}`), "data-beat": e.id },
      el("p", { class: "beat-prose" }, glyph("die", 15, "beat-glyph"), el("span", { text: meta.prose || e.text }), chip(meta.chip, e.text)),
      lineField(e, readOnly, open));
  }
  if (e.kind === "event") {
    if (!meta.major) return el("p", { class: cls("minor"), "data-beat": e.id }, eventGlyph(meta.t), el("span", { text: meta.prose || e.text }), chip(meta.chip, e.text));
    return el("div", { class: cls(`major ev-${meta.t}`), "data-beat": e.id },
      el("p", { class: "beat-prose" }, eventGlyph(meta.t), el("span", { text: meta.prose || e.text }), chip(meta.chip, e.text)),
      lineField(e, readOnly, open));
  }
  if (e.kind === "oracle") {
    return el("p", { class: cls("oracle"), "data-beat": e.id }, glyph("tiles", 15, "beat-glyph"), el("span", { text: e.text }));
  }
  if (e.kind === "note" || (e.kind === "scene" && meta.framing)) {
    return el("p", { class: cls("own"), "data-beat": e.id, text: e.text });
  }
  if (e.kind === "mystery") return el("p", { class: cls("premise-beat"), "data-beat": e.id, text: e.text });
  return el("p", { class: cls("minor"), "data-beat": e.id }, glyph(e.kind === "keyword" ? "tag" : "drop", 14, "beat-glyph"), el("span", { text: meta.prose || e.text }));
}

/**
 * The story as a column of chapters. Each scene opens a chapter with its mark
 * and its day; a scene's end closes it with the clock. `hideFrom` holds back
 * the entries a live card is still showing, so nothing is told twice.
 */
export function storyColumn(entries, { readOnly = false, hideFrom = null, seen = 0, skipPremise = false } = {}) {
  const col = el("div", { class: "story", role: "log", "aria-label": "The story so far" });
  let chapter = el("section", { class: "chapter prologue" });
  // The scene in play is the one written under as it happens.
  let current = 0;
  entries.forEach((e, i) => { if (sceneStart(e)) current = i; });
  add(col, chapter);
  entries.forEach((e, i) => {
    if (hideFrom !== null && i >= hideFrom) return;
    if (skipPremise && i === 0 && isCaseStart(e)) return;
    const start = sceneStart(e);
    if (start) {
      chapter = el("section", { class: `chapter ${start}` },
        el("h3", { class: "chapter-head" }, glyph(start, 18, "chapter-glyph"),
          el("span", { text: R.sceneType(start).name }), el("span", { class: "chapter-day", text: `Day ${e.day || 1}` })));
      add(col, chapter);
    }
    if (isSceneEnd(e)) {
      add(chapter, el("p", { class: `chapter-end${i >= seen ? " arrive" : ""}`, "data-beat": e.id },
        glyph("day", 15, "beat-glyph"), el("span", { text: /day turned/.test(e.text) ? "The scene ends, and the day turns." : "The scene ends. The clock moves on." })));
      return;
    }
    const node = beatNode(e, { readOnly, fresh: !readOnly && i >= seen, open: i >= current });
    // A beat from an earlier scene takes a line on a tap, without a field
    // under every beat of the case.
    if (!readOnly && i < current && node.classList.contains("major") && !node.querySelector(".beat-input")) {
      const prose = node.querySelector(".beat-prose");
      prose.classList.add("tappable");
      prose.setAttribute("role", "button");
      prose.setAttribute("tabindex", "0");
      prose.setAttribute("aria-label", `${prose.textContent}. Add a line`);
      const openIt = (ev) => {
        if (ev.target.closest(".dice-chip")) return;
        if (node.querySelector(".beat-input")) return;
        const f = lineField(e, false, true);
        add(node, f);
        f.focus();
      };
      prose.addEventListener("click", openIt);
      prose.addEventListener("keydown", (ev) => { if (ev.key === "Enter") openIt(ev); });
    }
    add(chapter, node);
  });
  return col;
}

// --- Holding beats back while a live card shows them --------------------------------

let holdFrom = null;
/** How far the story has got, to hold back what is written after this point. */
export const mark = () => ((Store.career && Store.mystery) ? caseEntries(Store.career, Store.mystery).length : 0);
export function hold(n) { holdFrom = n; }
export function release() { holdFrom = null; }
export const held = () => holdFrom;

// --- The opening beat of a scene ----------------------------------------------------

/**
 * The book's two questions, as the first beat of every scene, with the
 * oracle's words already on the table to use or throw again. The answer is the
 * scene's opening paragraph.
 */
export function framingBeat(scene, who) {
  if (!Settings.get("sceneFraming") || !scene || scene.framing) return null;
  if (!scene.frameWords) Store.quietly(() => { scene.frameWords = R.subjectWords(R.rollSubject(true)); });
  const ta = el("textarea", { class: "input framing-input", rows: 3, "aria-label": "Set the scene", placeholder: `${SCENE_FRAMING.questions.join(" ")}` });
  const tiles = el("div", { class: "word-tiles framing-tiles", role: "list" });
  const paint = () => {
    tiles.replaceChildren(...scene.frameWords.map((w) => el("button", {
      class: "word-tile", type: "button", role: "listitem", "aria-label": `Use “${w}”`,
      onclick: () => { ta.value = `${ta.value}${ta.value && !/\s$/.test(ta.value) ? " " : ""}${w}`; ta.focus(); },
    }, w)));
  };
  paint();
  return el("div", { class: "beat framing-beat" },
    el("p", { class: "framing-ask" }, glyph("pen", 15, "beat-glyph"),
      el("span", { text: `${SCENE_FRAMING.questions.join(" ")}${who ? ` ${first(who)} is at the centre of it.` : ""}` })),
    tiles, ta,
    el("div", { class: "btn-row" },
      el("button", { class: "btn primary", type: "button", onclick: () => {
        const text = ta.value.trim();
        if (!text) { ta.focus(); return; }
        Store.update("set the scene", () => { scene.framing = text; });
        Store.journal("scene", text, { framing: true });
        rerender();
      } }, "Set the scene"),
      el("button", { class: "btn ghost", type: "button", onclick: () => {
        Store.quietly(() => { scene.frameWords = R.subjectWords(R.rollSubject(true)); });
        paint();
      } }, glyph("refresh", 15), el("span", { text: "Other words" }))));
}

// --- The pen: the oracle and your own words at the foot of the story ----------------

export function pen() {
  const ask = (kind) => {
    if (kind === "words") {
      const words = R.subjectWords(R.rollSubject(true));
      Store.journal("oracle", `Asked the oracle: ${words.join(" · ")}`);
    } else {
      const r = R.rollYesNo();
      Store.journal("oracle", `Asked yes or no: d6 ${r.die} — ${r.row.name}`);
    }
    rerender();
  };
  const ta = el("textarea", { class: "beat-input pen-input", rows: 1, "aria-label": "Write a line", placeholder: "Write what happens next…" });
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = `${ta.scrollHeight}px`; });
  const keep = () => {
    const t = ta.value.trim();
    if (!t) return;
    Store.journal("note", t);
    ta.value = "";
    rerender();
  };
  ta.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); keep(); } });
  return el("div", { class: "pen", role: "group", "aria-label": "Your pen" },
    ta,
    el("div", { class: "pen-row" },
      el("button", { class: "btn ghost pen-btn", type: "button", onclick: keep }, glyph("pen", 15), el("span", { text: "Keep" })),
      el("button", { class: "btn ghost pen-btn", type: "button", onclick: () => ask("words") }, glyph("tiles", 15), el("span", { text: "Oracle" })),
      el("button", { class: "btn ghost pen-btn", type: "button", onclick: () => ask("yesno") }, glyph("die", 15), el("span", { text: "Yes / no" }))));
}

