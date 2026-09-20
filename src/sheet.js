// The investigator sheet and the persistent resource header.

import { el, add, clear, $ } from "./core.js";
import { FATIGUE_BOXES, CLOCK_SEGMENTS, ATTRIBUTES } from "../data.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import { section, row, defRow, btn, pill, explain, promptModal, confirmModal, showToast, chooseModal, modal } from "./ui.js";
import * as Roller from "./roller.js";
import { eventList } from "./prompts.js";
import { go } from "./router.js";

const IN_PLAY = new Set(["home", "play", "sheet", "clues", "solve", "journal"]);

/** Sticky under the app header: the numbers that decide every choice in the game. */
export function renderResourceHeader(routeName) {
  const host = $("#resource-header");
  if (!host) return;
  const c = Store.career, m = Store.mystery, inv = Store.investigator;
  if (!c || !m || !IN_PLAY.has(routeName)) { host.hidden = true; clear(host); return; }
  host.hidden = false;
  clear(host);
  const res = (label, value, kind = "", warn = false) =>
    el("div", { class: `res ${kind} ${warn ? "warn" : ""}` }, el("b", { text: String(value) }), el("span", { text: label }));
  add(host,
    res("Danger", m.danger, "danger", m.danger >= 6),
    res("Fatigue", `${inv.fatigue}/${FATIGUE_BOXES}`, "loss", inv.fatigue >= 4),
    res("Day", `${inv.day}·${inv.clock}/${CLOCK_SEGMENTS}`),
    res("Truths", `${m.truthRevealed.length}/${m.truthRevealed.length + m.truthDeck.length}`, "truth"),
    res("Clue deck", m.clueDeck.length, "", m.clueDeck.length <= 5),
    D.allAttributesStruck(inv) ? res("Struck", "all", "loss", true) : null,
  );
}

const attrTile = (inv, a) => {
  const struck = D.isStruck(inv, a.id);
  return el("div", { class: `attr ${struck ? "struck" : ""}`, title: a.text },
    el("b", { text: String(D.attrValue(inv, a.id)) }), el("span", { text: a.name }));
};

export function fatigueTrack(inv, onChange) {
  const track = el("div", { class: "track" });
  for (let i = 0; i < FATIGUE_BOXES; i++) {
    const on = i < inv.fatigue;
    add(track, el("button", {
      class: `box ${on ? "on" : ""}`, type: "button",
      "aria-label": `Fatigue box ${i + 1}${on ? ", marked" : ""}`, "aria-pressed": on ? "true" : "false",
      onclick: () => onChange(i + 1 === inv.fatigue ? i : i + 1),
    }));
  }
  return track;
}

export function clockTrack(inv) {
  const wrap = el("div", { class: "clock", role: "img", "aria-label": `Clock ${inv.clock} of ${CLOCK_SEGMENTS} segments marked` });
  for (let i = 0; i < CLOCK_SEGMENTS; i++) add(wrap, el("div", { class: `seg ${i < inv.clock ? "on" : ""}` }));
  return wrap;
}

/** Keyword use is the game's one always-available lever, so it lives on the sheet. */
export async function useKeywordFlow(keyword) {
  const m = Store.mystery;
  const options = [
    { value: "reroll", label: "Re-roll an attribute test", note: "Use after seeing the outcome; keep either result." },
    { value: "strengthen", label: "Strengthen a clue", note: "Search the deck or discard for a matching card." },
    { value: "eliminate", label: "Eliminate a threat", note: D.hasThreat(m) ? "Remove a threat from the scene." : "No threat is present." },
  ];
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
    const rank = await chooseModal({ title: "Strengthen which clue?", options: open.map((s) => ({ value: s.rank, label: `The ${s.rank}s`, note: s.description || `${s.cards.length} card(s)` })) });
    if (!rank) return;
    payload = { rank };
  } else if (action === "reroll") {
    await confirmModal({ title: "Re-roll", message: "Strike this keyword now, then roll the test again from the play screen and keep whichever outcome you prefer.", confirmLabel: "Strike it" })
      .then((ok) => { if (!ok) throw new Error("cancelled"); }).catch(() => { payload = null; });
    if (payload === null) return;
  }
  Store.begin("use keyword");
  const events = await Roller.useKeyword(keyword, action, payload);
  Store.journal("keyword", `Used the keyword "${keyword.text}" to ${action}.`);
  Store.commit();
  if (events) modal({ title: "Keyword spent", body: eventList(events) || el("p", { text: "Done." }), actions: [{ label: "Back" }] });
}

export function renderSheet(host) {
  const c = Store.career;
  if (!c || !c.investigator.name) {
    add(host, el("h1", { text: "No investigator yet" }),
      explain("This is your investigator: three attributes, a fatigue track, the keywords you pick up in play, and the obligations that pull at you between scenes. Make one and the rest of the app comes alive."));
    add(host, el("div", { class: "empty" }, el("p", { text: "Every mystery starts with someone who has a reason to look." }), btn("Create an investigator", () => go("wizard"), "primary")));
    return {};
  }
  const inv = c.investigator, m = c.mystery;

  add(host, el("h1", { text: inv.name }),
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
      class: `chip ${k.struck ? "struck" : ""} ${k.signature ? "signature" : ""}`, type: "button",
      onclick: () => { if (k.struck) { showToast(k.signature ? "Struck until you rest." : "Already spent."); return; } useKeywordFlow(k); },
    }, k.signature ? "★ " : "", k.text));
  }
  add(host, section("Keywords",
    inv.keywords.length ? kw : el("p", { class: "muted small", text: "None yet. Failing a test is how most keywords arrive." }),
    el("div", { class: "btn-row" }, btn("Add a keyword", async () => {
      const text = await promptModal({ title: "Add a keyword", message: "Usually gained from a failed test; add one here if play handed you something." });
      if (text) Store.update("add keyword", () => { inv.keywords.push({ id: crypto.randomUUID(), text, signature: false, struck: false }); });
    }))));

  const obs = el("div", { class: "chip-list" });
  for (const o of inv.obligations) {
    add(obs, el("span", { class: `chip ${o.struck ? "struck" : ""}`, title: o.struck ? "Attended this day" : "Not yet attended" }, o.text));
  }
  add(host, section("Obligations",
    inv.obligations.length ? obs : el("p", { class: "muted small", text: "No obligations." }),
    el("p", { class: "small muted", text: "Each obligation you have not struck by the end of a day costs you a fatigue." })));

  add(host, section("Details",
    defRow("Trait", el("span", { text: inv.trait || "—" })),
    defRow("Notes", el("span", { text: inv.notes || "—" })),
    m ? defRow("Motivation", el("span", { text: m.motivation || "—" })) : null,
    Settings.get("career") ? row("Experience", `${c.xp} XP`) : null,
    el("div", { class: "btn-row" },
      btn("Edit trait", async () => {
        const t = await promptModal({ title: "Trait", value: inv.trait });
        if (t !== null) Store.update("edit trait", () => { inv.trait = t; });
      }),
      btn("Edit notes", async () => {
        const t = await promptModal({ title: "Notes", value: inv.notes, multiline: true });
        if (t !== null) Store.update("edit notes", () => { inv.notes = t; });
      }))));

  return {};
}
