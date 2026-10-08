// The investigator sheet and the persistent resource header.

import { el, add, clear, clamp } from "./core.js";
import { FATIGUE_BOXES, CLOCK_SEGMENTS, ATTRIBUTES, KEYWORD_ACTIONS, ATTRIBUTE_MAX } from "../data.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { rankName } from "./deck.js";
import { Settings } from "./settings.js";
import { section, row, defRow, btn, edgeFade, explain, promptModal, showToast, chooseModal, modal, actionBar } from "./ui.js";
import * as Roller from "./roller.js";
import { eventList } from "./prompts.js";
import { go } from "./router.js";
import { saveSheets } from "./paper.js";

import { glyph, tick, attrPips, deckStack, truthCard, dangerGauge, fatigueMini } from "./art.js";
import { RULES_LIBRARY } from "./library.js";
// Not the Table: it shows the same numbers as objects on the desk.
const IN_PLAY = new Set(["home", "sheet", "case-sheet", "clues", "solve", "journal"]);

/**
 * The numbers tuck away as you read down a screen and come back the moment you
 * climb back up or one of them changes. They are what every choice is made on,
 * so they are never gone for long — but four fixed bars was a third of a small
 * phone spent on chrome while you were reading a page of fiction.
 */
let lastScrollY = 0;
export function watchScroll() {
  const host = document.querySelector("#resource-header");
  if (!host) return;
  addEventListener("scroll", () => {
    const y = Math.max(0, window.scrollY);
    const down = y > lastScrollY + 4;
    const up = y < lastScrollY - 4;
    if (down && y > 140) host.classList.add("tucked");
    else if (up || y <= 140) host.classList.remove("tucked");
    lastScrollY = y;
  }, { passive: true });
}

/** Sticky under the app header: the numbers that decide every choice in the game. */
export function renderResourceHeader(routeName) {
  const host = document.querySelector("#resource-header");
  if (!host) return;
  const c = Store.career, m = Store.mystery, inv = Store.investigator;
  if (!c || !m || !IN_PLAY.has(routeName)) { host.hidden = true; clear(host); return; }
  host.hidden = false;
  // A number that just changed is a number worth looking at.
  host.classList.remove("tucked");
  clear(host);
  // Every number is a button: a tap opens the rule it counts, drawn, without
  // leaving the screen you are on.
  const cell = (rule, label, kind, warn, ...kids) => el("button", {
    class: `res ${kind} ${warn ? "warn" : ""}`.replace(/\s+/g, " ").trim(), type: "button",
    "aria-label": `${label}: ${kids.map((k) => (k && k.textContent) || "").join(" ").trim()}. What this means`,
    onclick: () => ruleSheet(rule),
  }, ...kids);
  // An icon and a number: the label is on the button for a screen reader and
  // in the rule a tap opens, not printed under every figure.
  const MARK = { danger: "gauge", fatigue: "box", struck: "box" };
  const res = (label, value, kind = "", warn = false, meter = null, rule = null) =>
    cell(rule || label.toLowerCase(), label, kind, warn,
      el("span", { class: "res-top" }, glyph(MARK[label.toLowerCase()] || "drop", 16), el("b", { text: String(value) })),
      el("span", { class: "res-label", text: label }),
      meter === null ? null : el("i", { class: "meter", style: `--fill:${Math.round(clamp(meter, 0, 1) * 100)}%` }));
  const band = D.dangerBand(m.danger);
  let dangerCell = null;
  const dangerKey = `danger:${m.id}`;
  const dangerBefore = lastSeen.has(dangerKey) ? lastSeen.get(dangerKey) : m.danger;
  lastSeen.set(dangerKey, m.danger);
  add(host,
    // With a party the header follows whoever is in context, and switching is
    // the most repeated interaction in co-op, so it sits first.
    c.investigators.length > 1
      ? el("button", { class: "res who", type: "button", "aria-label": `Playing as ${inv.name}. Switch investigator`, onclick: () => switchInvestigator() },
          el("b", { text: (inv.name || "?").split(" ")[0] }), el("span", { text: "playing as" }))
      : null,
    dangerCell = res("Danger", m.danger, "danger", band === "high" || band === "extreme", m.danger / 12),
    res("Fatigue", `${inv.fatigue}/${FATIGUE_BOXES}`, "loss", inv.fatigue >= 4, inv.fatigue / FATIGUE_BOXES),
    // The clock is drawn everywhere else in the app; spelling it out here was
    // the one place the game's own dial turned back into a fraction.
    // Each drawing sits beside its number, over the label, so a cell is only as
    // wide as its label and five of them fit a 360px phone.
    cell("clock", "Day", "dialled", false,
      el("span", { class: "res-top" }, el("b", { text: String(inv.day) }), clockTrack(inv, 18)), el("span", { class: "res-label", text: "day" })),
    // The two decks are drawn as what they are, the way the clock beside them is.
    cell("truths", "Truths", "dialled truth", false,
      el("span", { class: "res-top" }, el("b", { text: `${m.truthRevealed.length}/${m.truthRevealed.length + m.truthDeck.length}` }),
        truthCard(m.truthRevealed.length, m.truthRevealed.length + m.truthDeck.length)), el("span", { class: "res-label", text: "Truths" })),
    cell("deck", "Clue deck", "dialled", m.clueDeck.length <= 5,
      el("span", { class: "res-top" }, el("b", { text: String(m.clueDeck.length) }), deckStack(m.clueDeck.length, "Clue deck")), el("span", { class: "res-label", text: "Clue deck" })),
    D.allAttributesStruck(inv) ? res("Struck", "all", "loss", true, null, "fatigue") : null,
  );
  edgeFade(host);
  if (dangerCell && dangerBefore !== m.danger) tick(dangerCell.querySelector("b"), dangerBefore, m.danger);
}

/**
 * What a number in the bar means, opened from the number itself: the number
 * drawn, and the rules library's own words about it — the same text the Rules
 * screen shows, read from one place, with the way through to the full entry.
 */
const RULE_SHEETS = {
  danger: { title: "Danger", ids: ["problem", "investigation-roll", "stages", "test", "consequences", "jokers", "career"], only: /danger/i },
  fatigue: { title: "Fatigue", ids: ["fatigue"] },
  clock: { title: "The clock and the day", ids: ["clock"] },
  truths: { title: "Truths", ids: ["truths"] },
  deck: { title: "The clue deck", ids: ["setup", "end", "rest", "obligation"], only: /deck/i },
};
export function ruleSheet(kind) {
  const def = RULE_SHEETS[kind] || RULE_SHEETS.danger;
  const m = Store.mystery, inv = Store.investigator;
  const entries = RULES_LIBRARY.flatMap((g) => g.entries).filter((e) => def.ids.includes(e.id));
  const figure = !m ? null
    : kind === "danger" ? el("span", { class: "gauged" }, dangerGauge(m.danger), el("b", { class: "rule-number", text: String(m.danger) }))
    : kind === "fatigue" ? el("span", { class: "gauged" }, fatigueMini(inv.fatigue), el("b", { class: "rule-number", text: `${inv.fatigue}/${FATIGUE_BOXES}` }))
    : kind === "clock" ? el("span", { class: "gauged" }, clockTrack(inv, 44), el("b", { class: "rule-number", text: `Day ${inv.day} · ${inv.clock}/${CLOCK_SEGMENTS}` }))
    : kind === "truths" ? el("span", { class: "gauged" }, truthCard(m.truthRevealed.length, m.truthRevealed.length + m.truthDeck.length, "big"), el("b", { class: "rule-number", text: `${m.truthRevealed.length} of ${m.truthRevealed.length + m.truthDeck.length}` }))
    : el("span", { class: "gauged" }, deckStack(m.clueDeck.length, "Clue deck"), el("b", { class: "rule-number", text: `${m.clueDeck.length} left` }));
  const body = el("div", { class: "rule-sheet" }, figure);
  for (const e of entries) {
    const lines = e.text.filter((t) => !def.only || def.only.test(t));
    if (!lines.length) continue;
    add(body, el("div", { class: "rule-entry" },
      el("h4", { class: "rule-entry-name", text: e.name }),
      ...lines.map((t) => el("p", { class: "small", text: t })),
      el("p", { class: "small muted", text: e.cite })));
  }
  modal({
    title: def.title, body,
    actions: [{ label: "Got it" }, { label: "Open in the rules", kind: "ghost", onClick: () => go(`rules?rule=${entries[0] ? entries[0].id : ""}`) }],
  });
}

const attrTile = (inv, a) => {
  const struck = D.isStruck(inv, a.id);
  return el("div", { class: `attr ${struck ? "struck" : ""}`, title: a.text },
    el("b", { text: String(D.attrValue(inv, a.id)) }), attrPips(D.attrValue(inv, a.id), ATTRIBUTE_MAX), el("span", { text: a.name }));
};

/**
 * What each drawing last showed, per investigator, so a box or a segment moves
 * only the time it changes — not on every re-render of a screen that has it.
 * The first sight of a value records it and moves nothing.
 */
const lastSeen = new Map();
function changedUp(key, value) {
  const before = lastSeen.get(key);
  lastSeen.set(key, value);
  return before !== undefined && value > before ? before : null;
}

export function fatigueTrack(inv, onChange) {
  const track = el("div", { class: "track" });
  // A box just marked is stamped in, like ink pressed onto the sheet.
  const was = changedUp(`fatigue:${inv.id}`, inv.fatigue);
  for (let i = 0; i < FATIGUE_BOXES; i++) {
    const on = i < inv.fatigue;
    const fresh = on && was !== null && i >= was;
    add(track, el("button", {
      class: `box ${on ? "on" : ""} ${fresh ? "fresh" : ""}`.trim(), type: "button",
      "aria-label": `Fatigue box ${i + 1}${on ? ", marked" : ""}`, "aria-pressed": on ? "true" : "false",
      onclick: () => onChange(i + 1 === inv.fatigue ? i : i + 1),
    }));
  }
  return track;
}

/** The clock as the book draws it: one circle, four wedges, filled as they go. */
export function clockTrack(inv, size = 46) {
  const wrap = el("div", { class: "clock", role: "img", "aria-label": `Clock ${inv.clock} of ${CLOCK_SEGMENTS} segments marked` });
  const c = size / 2, r = size / 2 - 3;
  const point = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(rad)).toFixed(2)},${(c + r * Math.sin(rad)).toFixed(2)}`;
  };
  const wedges = [];
  // A segment just marked sweeps in; the rest are simply there.
  const was = changedUp(`clock:${inv.id}:${size}`, inv.clock);
  for (let i = 0; i < CLOCK_SEGMENTS; i++) {
    const from = (360 / CLOCK_SEGMENTS) * i, to = from + 360 / CLOCK_SEGMENTS;
    const fresh = i < inv.clock && was !== null && i >= was;
    wedges.push(`<path class="${i < inv.clock ? "seg-on" : "seg-off"}${fresh ? " fresh" : ""}" stroke-width="1" d="M${c},${c} L${point(from)} A${r},${r} 0 0 1 ${point(to)} Z"/>`);
  }
  wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${wedges.join("")}</svg>`;
  return wrap;
}

/** The party switcher: one tap from anywhere in play. */
export async function switchInvestigator() {
  const c = Store.career;
  if (!c || c.investigators.length < 2) return null;
  const id = await chooseModal({
    title: "Who are you playing?",
    message: "The sheet, the header and every roll you make belong to whoever is in context.",
    options: c.investigators.map((i) => ({
      value: i.id,
      label: i.name || "unnamed",
      note: `Fatigue ${i.fatigue}/${FATIGUE_BOXES} \u00b7 clock ${i.clock}/${CLOCK_SEGMENTS}${D.unstruck(i).length < 3 ? " \u00b7 struck" : ""}`,
    })),
  });
  if (!id) return null;
  Store.setActive(id);
  const mod = await import("./router.js");
  await mod.render();
  return id;
}

/** Keyword use is the game's one always-available lever, so it lives on the sheet. */
export async function useKeywordFlow(keyword) {
  const m = Store.mystery;
  const options = KEYWORD_ACTIONS.map((a) => ({
    value: a.id, label: a.name,
    note: a.id === "eliminate" && !D.hasThreat(m) ? "No threat is present." : a.text,
  }));
  const action = await chooseModal({ title: `Use "${keyword.text}"`, message: "Striking a keyword spends it. Signature keywords come back after a rest.", options });
  if (!action) return;
  let payload = {};
  if (action === "eliminate") {
    const live = D.activeThreats(m);
    if (!live.length) { showToast("No threat is present to eliminate."); return; }
    const threatId = await chooseModal({ title: "Eliminate which threat?", options: live.map((t) => ({ value: t.id, label: t.name, note: `Level ${t.level}` })) });
    if (!threatId) return;
    payload = { threatId };
  } else if (action === "strengthen") {
    const open = D.openSets(m);
    if (!open.length) { showToast("No clue set to strengthen yet."); return; }
    const rank = await chooseModal({ title: "Strengthen which clue?", options: open.map((s) => ({ value: s.rank, label: `The ${rankName(s.rank)}`, note: s.description || `${s.cards.length} card(s)` })) });
    if (!rank) return;
    payload = { rank };
  } else if (action === "reroll") {
    // The rule re-rolls a test after its outcome is known, so it is spent from
    // the result dialog, where both outcomes can be compared.
    modal({
      title: "Spend it on a result",
      body: el("p", { text: "A re-roll is taken after you have seen an outcome. Make the test, then choose “Re-roll with a keyword” on the result — you will see both outcomes and keep whichever you prefer." }),
      actions: [{ label: "Back" }],
    });
    return;
  }
  Store.begin("use keyword");
  const events = await Roller.useKeyword(keyword, action, payload);
  Store.journal("keyword", `Used the keyword "${keyword.text}" to ${action}.`);
  Store.commit();
  if (events) modal({ title: "Keyword spent", body: eventList(events) || el("p", { text: "Done." }), actions: [{ label: "Back" }] });
}

export function renderSheet(host) {
  const c = Store.career;
  if (!c || !Store.investigator.name) {
    add(host, el("h1", { text: "No investigator yet" }),
      explain("This is your investigator: three attributes, a fatigue track, the keywords you pick up in play, and the obligations that pull at you between scenes. Make one and the rest of the app comes alive."));
    add(host, el("div", { class: "empty" }, el("p", { text: "Every mystery starts with someone who has a reason to look." }), btn("Create an investigator", () => go("wizard"), "primary")));
    return {};
  }
  const inv = Store.investigator, m = c.mystery;

  add(host, el("h1", { text: inv.name }),
    c.investigators.length > 1
      ? el("div", { class: "btn-row" }, btn(`Playing as ${inv.name} — switch`, () => switchInvestigator()))
      : null,
    explain("Your investigator's sheet. Attributes feed every test; fatigue rises until the track fills and strikes your best attribute; keywords are one-use favours you can spend at any moment. Obligations are struck when you attend them and bite at the end of the day when you do not."));

  add(host, section("Attributes",
    el("div", { class: "attr-grid" }, ...ATTRIBUTES.map((a) => attrTile(inv, a))),
    el("p", { class: "small muted", text: D.allAttributesStruck(inv) ? "Every attribute is struck. Rest before you test anything else." : "A struck attribute cannot be used until you rest." })));

  add(host, section("Fatigue and time",
    defRow("Fatigue", fatigueTrack(inv, (value) => {
      Store.update("adjust fatigue", () => { inv.fatigue = value; });
    })),
    defRow("Clock", el("div", {}, clockTrack(inv), el("p", { class: "small muted", text: `Day ${inv.day}. Four scenes make a day.` })))));

  const kw = el("div", { class: "chip-list" });
  for (const k of inv.keywords) {
    add(kw, el("button", {
      class: `chip tag ${k.struck ? "struck" : ""} ${k.signature ? "signature" : ""}`, type: "button",
      onclick: () => { if (k.struck) { showToast(k.signature ? "Struck until you rest." : "Already spent."); return; } useKeywordFlow(k); },
    }, glyph(k.signature ? "seal" : "tag", 16), k.signature ? el("span", { class: "vh", text: "Signature: " }) : null, k.text));
  }
  add(host, section(`Keywords (${D.usableKeywords(inv).length} ready)`,
    inv.keywords.length ? kw : el("p", { class: "muted small", text: "None yet. Failing a test is how most keywords arrive." }),
    el("div", { class: "btn-row" }, btn("Add a keyword", async () => {
      const text = await promptModal({ title: "Add a keyword", message: "Usually gained from a failed test; add one here if play handed you something." });
      if (text) Store.update("add keyword", () => { inv.keywords.push({ id: crypto.randomUUID(), text, signature: false, struck: false }); });
    }))));

  const obs = el("div", { class: "chip-list" });
  for (const o of inv.obligations) {
    add(obs, el("span", { class: `chip ${o.struck ? "struck" : ""}`, title: o.struck ? "Attended this day" : "Not yet attended" }, glyph("obligation", 16), el("span", { text: o.text })));
  }
  add(host, section("Obligations",
    inv.obligations.length ? obs : el("p", { class: "muted small", text: "No obligations." }),
    el("p", { class: "small muted", text: "Each obligation you have not struck by the end of a day costs you a fatigue." })));

  add(host, section("Details",
    defRow("Trait", el("span", { text: inv.trait || "—" })),
    defRow("Notes", el("span", { text: inv.notes || "—" })),
    m ? defRow("Motivation", el("span", { text: m.motivation || "—" })) : null,
    Settings.get("career") ? row("Experience", `${inv.xp} XP`) : null,
    el("div", { class: "btn-row" },
      btn("Edit trait", async () => {
        const t = await promptModal({ title: "Trait", value: inv.trait });
        if (t !== null) Store.update("edit trait", () => { inv.trait = t; });
      }),
      btn("Edit notes", async () => {
        const t = await promptModal({ title: "Notes", value: inv.notes, multiline: true });
        if (t !== null) Store.update("edit notes", () => { inv.notes = t; });
      }),
      // JSON keeps the data safe and cannot be handed to anyone, printed, or
      // read on a device without the app. This is the sheet as a sheet.
      btn("Save this sheet", () => saveSheets()))));

  // The investigator is one card: attributes and fatigue on the front,
  // keywords and obligations on the back. Turned over, not scrolled past.
  const cards = [...host.querySelectorAll(":scope > section.card")];
  const pick = (t) => cards.find((c) => (c.querySelector(".card-title")?.textContent || "").startsWith(t));
  const front = el("div", { class: "inv-front" }, pick("Attributes"), pick("Fatigue and time"));
  const back = el("div", { class: "inv-back" }, pick("Keywords"), pick("Obligations"));
  const flip = el("div", { class: "inv-flip" }, front, back);
  const turn = el("button", { class: "btn ghost inv-flip-btn", type: "button", "aria-pressed": "false",
    onclick: () => {
      const over = flip.classList.toggle("flipped");
      flip.classList.add("turning");
      setTimeout(() => flip.classList.remove("turning"), 400);
      turn.setAttribute("aria-pressed", over ? "true" : "false");
      turn.querySelector(".turn-label").textContent = over ? "Front: attributes and fatigue" : "Back: keywords and obligations";
    } }, glyph("refresh", 16), el("span", { class: "turn-label", text: "Back: keywords and obligations" }));
  const details = pick("Details");
  host.insertBefore(el("div", { class: "inv-card-wrap" }, flip, turn), details || null);

  if (!m) return { action: actionBar("Set up a mystery", () => go("mystery"), "Roll the problem") };
  const inScene = m.scene && !m.scene.done;
  return { action: actionBar(
    m.ended ? "Resolve the mystery" : inScene ? "Back to the scene" : "Play the next scene",
    () => go(m.ended ? "solve" : "play"),
    m.ended ? "Name the three cards" : inScene ? `${m.scene.type} scene in progress` : `Danger ${m.danger} · clock ${inv.clock}/4`) };
}
