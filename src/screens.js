// Home, the tables, the oracles, the rules library, the journal and settings.

import { el, add, uid, fmtTime, d66Code } from "./core.js";
import * as DATA from "../data.js";
import { HOUSE_AIDS, houseAidLabel, houseAidTitle } from "../data-house.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { Settings, TOGGLES } from "./settings.js";
import { RULES_LIBRARY } from "./library.js";
import { resetDrafts, expressStart } from "./wizard.js";
import { recapCard } from "./coach.js";
import { Updates } from "./updates.js";
import { section, row, defRow, btn, optionBtn, pill, explain, modal, promptModal, confirmModal, chooseModal, showToast, actionBar, emptyState } from "./ui.js";
import { go } from "./router.js";

const rerender = () => import("./router.js").then((m) => m.render());

// --- Home ---------------------------------------------------------------------
export function renderHome(host) {
  const c = Store.career;
  add(host, el("h1", { text: "The case" }),
    explain("Everything in one place: who is investigating, what the problem is, and what the rules say to do next. The bar at the bottom always offers that next step."));

  if (!c || !Store.investigator.name) {
    add(host, section("Never played this before?",
      el("p", { text: "Press the button at the bottom. It rolls you an investigator and a case and puts you in the first scene — you do not have to decide anything, and nothing it rolls is permanent." }),
      el("p", { class: "small muted", text: "From then on, the line at the top of every screen says what to do next and what it will cost you. Press Why? next to it whenever you want the longer answer." })));
    add(host, section("Or take your time",
      el("div", { class: "btn-row" },
        btn("Make an investigator myself", () => go("wizard")),
        btn("Read the walkthrough", () => go("tutorial")))));
    return { action: actionBar("Start playing", startPlaying, "Rolls everything and deals you in") };
  }
  const inv = Store.investigator, m = c.mystery;

  if (c.investigators.length > 1) {
    const rows = c.investigators.map((i) => row(i.name || "unnamed", el("span", {},
      pill(`fatigue ${i.fatigue}/${DATA.FATIGUE_BOXES}`, i.fatigue >= 4 ? "loss" : ""), " ",
      pill(`clock ${i.clock}/${DATA.CLOCK_SEGMENTS}`), " ",
      D.unstruck(i).length < 3 ? pill("struck", "loss") : null, " ",
      D.openObligations(i).length ? pill(`${D.openObligations(i).length} owed`, "danger") : pill("clear", "ok"), " ",
      i.id === inv.id ? pill("you", "truth") : btn("Play as", () => { Store.setActive(i.id); rerender(); }))));
    add(host, section(`The party (${c.investigators.length})`, ...rows,
      el("p", { class: "small muted", text: "One mystery, one clock, one danger track. Fatigue, keywords and obligations are each investigator's own." })));
  }

  add(host, section(c.investigators.length > 1 ? `Investigator — ${inv.name}` : "Investigator",
    row("Name", inv.name),
    row("Trait", inv.trait || "—"),
    row("Attributes", el("span", { class: "chip-list" }, ...DATA.ATTRIBUTES.map((a) =>
      pill(`${a.name} ${D.attrValue(inv, a.id)}${D.isStruck(inv, a.id) ? " \u2715" : ""}`, D.isStruck(inv, a.id) ? "loss" : "")))),
    row("Fatigue", `${inv.fatigue}/${DATA.FATIGUE_BOXES}`),
    row("Day", `${inv.day} · clock ${inv.clock}/${DATA.CLOCK_SEGMENTS}`),
    el("div", { class: "btn-row" },
      btn("Open the sheet", () => go("sheet")),
      Settings.get("multiplayer")
        ? btn("Add an investigator", () => go("wizard"))
        : null,
      Settings.get("multiplayer") && Store.availableToBorrow().length
        ? btn("Bring one in", async () => {
            const offered = Store.availableToBorrow();
            const pick = await chooseModal({
              title: "Who joins the case?",
              message: "An investigator you already play can join, as long as they are not in the middle of a mystery of their own.",
              options: offered.map((o) => ({
                value: `${o.career.id}|${o.investigator.id}`,
                label: o.investigator.name,
                note: o.busy
                  ? `Mid-mystery in ${o.career.name} — not available`
                  : `From ${o.career.name} — ${o.investigator.xp} XP, fatigue ${o.investigator.fatigue}/${DATA.FATIGUE_BOXES}`,
              })),
            });
            if (!pick) return;
            const [careerId, invId] = pick.split("|");
            const brought = Store.borrowInvestigator(careerId, invId);
            if (!brought) { showToast("They are in the middle of their own mystery."); return; }
            Store.update("journal", () => Store.journal("create", `${brought.name} joins the investigation.`));
            showToast(`${brought.name} joins. Their sheet comes across as it stands; the original stays in its own career.`);
            rerender();
          })
        : null,
      Settings.get("multiplayer") && c.investigators.length > 1
        ? btn("Remove one", async () => {
            const id = await chooseModal({
              title: "Who leaves the case?",
              options: c.investigators.filter((i) => i.id !== inv.id).map((i) => ({ value: i.id, label: i.name, note: `${i.xp} XP` })),
            });
            if (!id) return;
            const person = Store.investigatorById(id);
            const ok = await confirmModal({ title: `Remove ${person.name}?`, message: `Their sheet, keywords, obligations and experience go with them. The mystery, the decks and the journal stay.`, confirmLabel: "Remove", danger: true });
            if (ok) { Store.removeInvestigator(id); rerender(); }
          }, "danger")
        : null)));

  if (!m) {
    add(host, section("Next step",
      el("p", { text: "Your investigator has no mystery. Set one up: a location, an object, and something bad that happened to it." }),
      c.history.length ? el("p", { class: "small muted", text: `${c.history.length} case(s) closed. Danger carried into the next one: ${c.carryDanger || 0}.` }) : null));
    return { action: actionBar("Set up a mystery", () => go("mystery"), "Roll the problem") };
  }

  add(host, recapCard());

  add(host, section("The problem",
    el("p", { class: "premise", text: R.problemText(m) }),
    row("Motivation", m.motivation || "—"),
    row("Genre", DATA.GENRES[m.genre].name),
    row("Difficulty", R.difficulty(m.difficulty).name),
    row("Danger", String(m.danger)),
    row("Clue sets", `${D.openSets(m).length} open, ${D.truthSets(m).length} established, ${D.falseLeads(m).length} false`)));

  if (Settings.get("rivals") && c.rivals.length) {
    add(host, section("Rivals",
      ...c.rivals.map((r, i) => row(`${i + 1}. ${r.name}`, el("span", {}, pill(`Level ${r.level}`, "loss"), " ",
        btn("Remove", () => { Store.update("remove rival", () => { c.rivals.splice(i, 1); }); rerender(); }))))));
  }

  if (c.history.length) {
    add(host, section("Closed cases", ...c.history.slice(-5).reverse().map((h) =>
      defRow(new Date(h.closedAt).toLocaleDateString(), el("div", {}, el("p", { class: "small", text: h.problem }), pill(`${h.correct}/3 correct`, h.correct === 3 ? "ok" : h.correct ? "" : "loss"))))));
  }

  const label = m.ended ? "Resolve the mystery" : (m.scene && !m.scene.done) ? "Back to the scene" : "Play the next scene";
  return { action: actionBar(label, () => go(m.ended ? "solve" : "play"), m.ended ? "Name the three cards" : `Danger ${m.danger} · clock ${inv.clock}/4`) };
}

/** One tap from a blank app to the first scene (see wizard.expressStart). */
async function startPlaying() {
  const { investigator, mystery } = expressStart();
  modal({
    title: `${investigator.name} takes the case`,
    body: el("div", {},
      el("p", { class: "premise", text: R.problemText(mystery) }),
      row("Trait", investigator.trait),
      row("Attributes", DATA.ATTRIBUTES.map((a) => `${a.name} ${D.attrValue(investigator, a.id)}`).join(" \u00b7 ")),
      row("Obligation", investigator.obligations[0].text),
      row("Signature keyword", investigator.keywords[0].text),
      el("p", { class: "small muted", text: "All of it is yours to rewrite on the sheet. You are not meant to know what the case means yet — working that out is the game." })),
    actions: [{ label: "Play the first scene", onClick: () => go("play") }, { label: "Look around first", kind: "ghost" }],
  });
  await rerender();
}

// --- Tables -------------------------------------------------------------------
const TABLE_GROUPS = [
  { name: "The problem", tables: [["Treacheries", DATA.TREACHERIES]] },
  { name: "The investigator", tables: [["Traits", DATA.TRAITS], ["Motivations", DATA.MOTIVATIONS], ["First names", DATA.FIRST_NAMES], ["Last names", DATA.LAST_NAMES], ["Name prefixes", DATA.NAME_PREFIX], ["Name suffixes", DATA.NAME_SUFFIX]] },
];

export function renderTables(host) {
  const c = Store.career;
  const genreId = (Store.mystery && Store.mystery.genre) || (c && c.defaultGenre) || "noir";
  add(host, el("h1", { text: "Tables" }),
    explain("Every d66 table in the book, in the order you reach for them: the genre tables and the oracles you roll every scene, then the ones you roll once a mystery or once an investigator. Rolling here changes nothing in your game — it just hands you a word."));

  const resultHost = el("div", { class: "card" }, el("p", { class: "muted small", text: "Roll a table and the result lands here." }));
  add(host, resultHost);
  const showRoll = (name, r) => {
    resultHost.replaceChildren(
      el("h3", { text: name }),
      el("p", { class: "mono", text: `d66 ${r.code} — ${r.value}` }),
      r.redirected ? el("p", { class: "small", text: `Your content filter moved this roll ${houseAidLabel("contentFilter")}: ${r.dice.join("")} was a row you blocked.` }) : null,
      r.allBlocked ? el("p", { class: "small", text: `Every row of this table is filtered, so the roll stands ${houseAidLabel("contentFilter")}.` }) : null,
    );
  };

  const search = el("input", { class: "input", type: "search", placeholder: "Search every table", "aria-label": "Search every table" });
  add(host, section("Find a row", search));

  const tableBlock = (name, table) => {
    const det = el("details", { class: "acc" });
    const body = el("div", { class: "acc-body" });
    const grid = el("div", { class: "table-grid" });
    table.forEach((v, i) => add(grid, el("div", { class: "table-row", dataset: { value: v.toLowerCase() } },
      el("span", { class: "code", text: d66Code(i) }), el("span", { text: v }))));
    add(body, el("div", { class: "btn-row" }, btn("Roll 1d66", () => showRoll(name, R.rollTable(table)), "primary")), grid);
    add(det, el("summary", {}, name, " ", el("span", { class: "pill", text: "36" })), body);
    return det;
  };

  const genreWrap = el("div", {});
  const genreBtns = el("div", { class: "btn-row" }, ...DATA.GENRE_IDS.map((g) =>
    optionBtn(DATA.GENRES[g].name, () => { current = g; paint(); }, g === genreId)));
  let current = genreId;
  const paint = () => {
    genreWrap.replaceChildren();
    for (const kind of DATA.TABLE_KINDS) {
      const label = kind[0].toUpperCase() + kind.slice(1);
      add(genreWrap, tableBlock(`${DATA.GENRES[current].name} · ${label}`, DATA.GENRES[current][kind]));
    }
    for (const b of genreBtns.children) {
      const on = b.textContent === DATA.GENRES[current].name;
      b.className = `btn ${on ? "primary" : "ghost"}`;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    filter();
  };
  add(host, section("Genre tables", genreBtns, genreWrap));

  const oracleWrap = el("div", {},
    tableBlock("Oracle · Action", DATA.ORACLE_ACTION),
    tableBlock("Oracle · Descriptor", DATA.ORACLE_DESCRIPTOR),
    tableBlock("Oracle · Focus", DATA.ORACLE_FOCUS));
  add(host, section("Subject oracles", oracleWrap));

  // Rolled once a mystery, or once an investigator: last.
  for (const g of TABLE_GROUPS) {
    const wrap = el("div", {});
    for (const [name, table] of g.tables) add(wrap, tableBlock(name, table));
    add(host, section(g.name, wrap));
  }

  function filter() {
    const q = search.value.trim().toLowerCase();
    for (const det of host.querySelectorAll("details.acc")) {
      let hits = 0;
      for (const rowEl of det.querySelectorAll(".table-row")) {
        const hit = q && rowEl.dataset.value.includes(q);
        rowEl.classList.toggle("hit", !!hit);
        if (hit) hits++;
      }
      det.open = q ? hits > 0 : false;
      det.hidden = !!q && hits === 0;
    }
  }
  search.addEventListener("input", filter);
  paint();
  return {};
}

// --- Oracles ------------------------------------------------------------------
export function renderOracle(host) {
  add(host, el("h1", { text: "Oracles" }),
    explain("Ask the game a question. Closed questions (“is anyone watching?”) go to the yes/no oracle; open ones (“what are they doing?”) get two or three words to interpret. Nothing here touches your mystery's state."));

  const out = el("div", { class: "card" }, el("p", { class: "muted small", text: "Answers land here." }));
  const history = el("div", { class: "card" }, el("h3", { text: "Recent" }));
  const remember = (text) => {
    const line = el("p", { class: "small", text });
    history.insertBefore(line, history.children[1] || null);
    while (history.children.length > 9) history.lastChild.remove();
    // This list is DOM only and dies with the screen. An oracle asked during a
    // case is part of that case, so it goes to the record as well — quietly,
    // because the screen is already showing it back.
    if (Store.mystery) Store.journal("oracle", text);
  };

  add(host, section("Yes or no",
    el("p", { class: "small muted", text: "1d6. Extreme answers exaggerate the result rather than just answering it." }),
    btn("Ask", () => {
      const r = R.rollYesNo();
      out.replaceChildren(el("h3", { text: "Yes or no" }), el("p", { class: "mono", text: `d6 ${r.die} — ${r.row.name}` }));
      remember(`Yes/no: ${r.row.name} (${r.die})`);
    }, "primary")));

  add(host, section("Subject oracle",
    el("div", { class: "btn-row" },
      btn("Two words", () => ask(false), "primary"),
      btn("Three words", () => ask(true)))));

  function ask(withFocus) {
    const s = R.rollSubject(withFocus);
    const words = R.subjectWords(s);
    out.replaceChildren(el("h3", { text: "Subject oracle" }),
      el("p", { class: "mono", text: words.join("  ·  ") }),
      el("p", { class: "small muted", text: [s.action && `action ${s.action.code}`, s.descriptor && `descriptor ${s.descriptor.code}`, s.focus && `focus ${s.focus.code}`].filter(Boolean).join(" · ") }));
    remember(`Subject: ${words.join(" · ")}`);
  }

  add(host, out, history);
  return {};
}

// --- Rules library ------------------------------------------------------------
export function renderRules(host) {
  add(host, el("h1", { text: "Rules" }),
    explain("Every rule the app automates, in the app's own words and in the order play uses them. Search opens the matching entries. Where a screen automates something, it links back here."));
  const search = el("input", { class: "input", type: "search", placeholder: "Search the rules", "aria-label": "Search the rules" });
  add(host, section("Search", search));
  const wrap = el("div", {});
  for (const group of RULES_LIBRARY) {
    const inner = el("div", {});
    for (const entry of group.entries) {
      const det = el("details", { class: "acc", id: `rule-${entry.id}` });
      add(det, el("summary", { text: entry.name }),
        el("div", { class: "acc-body" }, ...entry.text.map((t) => el("p", { class: "small", text: t })),
          el("p", { class: "small muted", text: entry.cite })));
      add(inner, det);
    }
    add(wrap, section(group.name, inner));
  }
  add(host, wrap);
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const det of wrap.querySelectorAll("details.acc")) {
      const hit = q && det.textContent.toLowerCase().includes(q);
      det.open = !!hit;
      det.hidden = !!q && !hit;
    }
  });
  if (location.hash.includes("?rule=")) {
    const id = location.hash.split("?rule=")[1];
    const det = wrap.querySelector(`#rule-${id}`);
    if (det) { det.open = true; setTimeout(() => det.scrollIntoView({ block: "center" }), 40); }
  }
  return {};
}

/** The case as a file you can keep, open anywhere, and read without the app. */
function saveStory(c) {
  const MACHINE = /^(Scene ended|Investigation scene: rolled|Truth scene: established|.+ rests\.$|.+ attends:)/;
  const keep = (e) => e.kind === "note" || e.kind === "oracle" || e.kind === "mystery" || e.kind === "solve"
    || (e.kind === "scene" && !MACHINE.test(e.text));
  const lines = [`${c.name} \u2014 Caught in the Rain`, ""];
  let day = null;
  for (const e of c.journal) {
    if (!keep(e)) continue;
    if ((e.day || 1) !== day) { day = e.day || 1; lines.push("", `Day ${day}`, "-".repeat(20)); }
    lines.push(e.kind === "oracle" ? `    [${e.text}]` : e.text, "");
  }
  for (const h of c.history) {
    lines.push("", `Closed: ${h.problem}`, `${h.correct} of 3 guesses correct.`, ...(h.answers || []));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `${(c.name || "case").replace(/[^\w]+/g, "-").toLowerCase()}-case.txt` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Saved.");
}

// --- Journal ------------------------------------------------------------------
export function renderJournal(host) {
  const c = Store.career;
  add(host, el("h1", { text: "Journal" }),
    explain("The record of this case: what you wrote, what the dice did, and what the app changed as a result. It pages a session at a time so it stays readable, and it exports as plain text you can keep."));
  if (!c) { add(host, emptyState("No career yet.", "Create an investigator", () => go("wizard"))); return {}; }

  let page = 0;
  const PAGE = 25;
  let view = "story";
  const listHost = el("div", {});
  // Three readings of one record. "Story" is what you would hand someone: what
  // you wrote and what the game answered, oldest first, with the machinery out
  // of the way. The log was always there; it was never readable as a story.
  const MACHINE_SCENE = /^(Scene ended|Investigation scene: rolled|Truth scene: established|.+ rests\.$|.+ attends:)/;
  const isStory = (e) => e.kind === "note" || e.kind === "oracle" || e.kind === "mystery" || e.kind === "solve"
    || (e.kind === "scene" && !MACHINE_SCENE.test(e.text));
  const entries = () => (view === "story"
    ? c.journal.filter(isStory)
    : view === "rolls" ? c.journal.filter((e) => e.kind === "test" || e.kind === "keyword").slice().reverse()
    : c.journal.slice().reverse());

  const paint = () => {
    listHost.replaceChildren();
    const all = entries();
    const slice = view === "story" ? all : all.slice(0, (page + 1) * PAGE);
    if (view === "story") {
      // A diary is read from the end backwards, but each sitting reads forwards:
      // show the most recent days in order, and offer the earlier ones.
      const STORY_PAGE = 60;
      const shown = all.slice(Math.max(0, all.length - (page + 1) * STORY_PAGE));
      if (shown.length < all.length) {
        add(listHost, btn(`Show ${Math.min(STORY_PAGE, all.length - shown.length)} earlier`, () => { page++; paint(); }));
      }
      let day = null;
      for (const e of shown) {
        if ((e.day || 1) !== day) { day = e.day || 1; add(listHost, el("h3", { class: "card-title", text: `Day ${day}` })); }
        add(listHost, el("p", { class: e.kind === "oracle" ? "mono small" : "story-line", text: e.text }));
      }
      if (!all.length) add(listHost, el("p", { class: "muted small", text: "Nothing written yet. Whatever you write in a scene, and every answer the oracle gives, lands here." }));
      return;
    }
    for (const e of slice) {
      add(listHost, el("div", { class: "log-entry" },
        el("div", { class: "log-when", text: `Day ${e.day || 1} · ${fmtTime(e.ts)} · ${e.kind}` }),
        el("div", { text: e.text })));
    }
    if (slice.length < all.length) add(listHost, btn(`Show ${Math.min(PAGE, all.length - slice.length)} older`, () => { page++; paint(); }));
    if (!all.length) add(listHost, el("p", { class: "muted small", text: "Nothing written yet. Scenes write themselves in here as you play." }));
  };
  paint();

  const views = el("div", { class: "btn-row" }, ...[["story", "Story"], ["all", "Everything"], ["rolls", "Rolls"]].map(([id, label]) =>
    optionBtn(label, () => { view = id; page = 0; paint(); }, view === id)));
  add(host, section("How to read it", views,
    el("p", { class: "small muted", text: "Story is the case as it happened, oldest first: what you wrote and what the game answered back. Everything adds the machinery; Rolls is the dice alone." }),
    el("div", { class: "btn-row" }, btn("Save the story as text", () => saveStory(c), "primary"))));

  // House aid (§4), not a rule: the book's oracles make words and you make
  // the people out of them, and nothing in the game remembers who they were.
  // Over a case that runs for days, that is the first thing you lose.
  const cast = el("div", {});
  const paintCast = () => {
    cast.replaceChildren();
    if (!c.cast.length) add(cast, el("p", { class: "muted small", text: "Nobody yet. Add the people and places you invent, so they are still here next week." }));
    for (const person of c.cast) {
      add(cast, el("div", { class: "row" },
        el("span", { class: "row-label", text: person.name }),
        el("span", { class: "row-value" },
          el("span", { class: "small", text: person.note || "" }), " ",
          btn("Forget", () => {
            Store.update("forget someone", () => { c.cast = c.cast.filter((x) => x.id !== person.id); });
            paintCast();
          }))));
    }
  };
  paintCast();

  const ways = el("details", { class: "acc" },
    el("summary", { text: "Ways to keep a record" }),
    el("div", { class: "acc-body" },
      el("p", { class: "small muted", text: "The book does not insist on writing. Any of these count, and you can mix them." }),
      el("ul", { class: "ask" }, ...DATA.RECORDING_METHODS.map((w) => el("li", { class: "small", text: w })))));


  add(host, section("Write",
    btn("Add a note", async () => {
      const t = await promptModal({ title: "Journal", multiline: true, placeholder: "What happened in the fiction?" });
      if (t) { Store.update("journal", () => Store.journal("note", t)); paint(); }
    }, "primary")));

  add(host, section("The case, as it happened", listHost));

  add(host, section(houseAidTitle("cast"), cast,
    el("p", { class: "small muted", text: HOUSE_AIDS.cast.text }),
    btn("Add someone", async () => {
      const name = await promptModal({ title: "Who, or where?", placeholder: "e.g. the night supervisor at the care agency" });
      if (!name) return;
      const note = await promptModal({ title: name, message: "One line: what they are to the case.", multiline: true });
      Store.update("remember someone", () => { c.cast.push({ id: uid(), name, note: note || "" }); });
      paintCast();
    }, "primary")));
  add(host, ways);

  const log = c.rollLog.slice().reverse().slice(0, 40);
  const logBody = el("div", { class: "acc-body" },
    log.length ? el("div", {}, ...log.map((r) => el("div", { class: "log-entry" },
      el("div", { class: "log-when", text: `${fmtTime(r.ts)} · ${r.kind}${r.manual ? " · entered by hand" : ""}` }),
      el("div", { class: "mono small", text: `${(r.dice || []).join(" + ")}${r.attrValue ? ` + ${r.attrValue}` : ""}${r.total !== undefined ? ` = ${r.total}` : ""} ${r.outcome || ""} ${r.label || ""}` }))))
      : el("p", { class: "muted small", text: "No rolls yet." }),
    c.rollLog.length > 40 ? el("p", { class: "small muted", text: `Showing the most recent 40 of ${c.rollLog.length}.` }) : null,
    el("div", { class: "btn-row" },
      btn("Face distribution", () => showDistribution(c)),
      btn("Export as text", () => exportText(c))));
  const logAcc = el("details", { class: "acc" }, el("summary", { text: `Roll log (${c.rollLog.length})` }), logBody);
  add(host, logAcc);
  return {};
}

function showDistribution(c) {
  const counts = [0, 0, 0, 0, 0, 0];
  let n = 0;
  for (const r of c.rollLog) for (const d of r.dice || []) if (d >= 1 && d <= 6) { counts[d - 1]++; n++; }
  const body = el("div", {},
    el("p", { class: "small muted", text: `Every d6 face this career has rolled in the app (${n} dice). Physically rolled dice you typed in are counted too.` }),
    ...counts.map((v, i) => row(`${i + 1}`, `${v}${n ? ` · ${Math.round((v / n) * 100)}%` : ""}`)));
  modal({ title: "Face distribution", body, actions: [{ label: "Close" }] });
}

function exportText(c) {
  const lines = [`${c.name} — Caught in the Rain`, ""];
  for (const e of c.journal) lines.push(`[Day ${e.day || 1} ${fmtTime(e.ts)}] ${e.text}`);
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `${c.name.replace(/\W+/g, "-").toLowerCase()}-journal.txt` });
  document.body.append(a); a.click(); a.remove();
  showToast("Journal saved as text.");
}

// --- Careers ------------------------------------------------------------------
export function renderCareers(host) {
  add(host, el("h1", { text: "Careers" }),
    explain("One investigator, one career: their mysteries, their experience, their rivals. Keep several and switch between them; each keeps its own journal and decks."));
  const c = Store.career;
  const list = el("div", {});
  for (const car of Store.careers()) {
    add(list, el("div", { class: "card" },
      row(car.investigators.length > 1 ? "Party" : "Investigator", car.investigators.map((i) => i.name || "unnamed").join(", ")),
      row("Cases closed", String(car.history.length)),
      row("Experience", car.investigators.map((i) => `${i.name || "unnamed"} ${i.xp} XP`).join(" · ")),
      el("div", { class: "btn-row" },
        car.id === (c && c.id) ? pill("Current", "ok") : btn("Switch to this", () => { resetDrafts(); Store.selectCareer(car.id); go("home"); }),
        btn("Delete", async () => {
          const ok = await confirmModal({ title: "Delete this career?", message: `This erases ${car.investigators.map((i) => i.name || "this investigator").join(", ")}, the journal, the decks and the history. It cannot be undone.`, confirmLabel: "Delete", danger: true });
          if (ok) { resetDrafts(); Store.deleteCareer(car.id); rerender(); }
        }, "danger"))));
  }
  add(host, section("Your investigators", Store.careers().length ? list : el("p", { class: "muted small", text: "No careers yet." })));

  if (c && Settings.get("career")) {
    const who = Store.investigator;
    const spendable = DATA.XP_BENEFITS.filter((b) => b.cost <= who.xp);
    add(host, section(`Experience — ${who.name || "your investigator"}, ${who.xp} XP`,
      el("p", { class: "small muted", text: "Spend between mysteries. Two of these hand you a new obligation as well." }),
      ...DATA.XP_BENEFITS.map((b) => row(`${b.cost} XP · ${b.name}`,
        btn("Spend", () => spendXP(b), b.cost <= who.xp ? "primary" : "ghost", { disabled: b.cost > who.xp || !!(Store.mystery && !Store.mystery.solved) }))),
      Store.mystery && !Store.mystery.solved ? el("p", { class: "small", text: "Experience is spent between mysteries, not during one." }) : null,
      spendable.length === 0 ? el("p", { class: "small muted", text: "Nothing affordable yet." }) : null));
    add(host, section("Take on more",
      el("p", { class: "small muted", text: `The book lets you shoulder a new obligation before your next mystery and take ${DATA.NEW_OBLIGATION_XP} experience for it. Swapping one that no longer fits is free, and pays nothing.` }),
      el("div", { class: "btn-row" },
        btn(`New obligation (+${DATA.NEW_OBLIGATION_XP} XP)`, async () => {
          if (Store.mystery && !Store.mystery.solved) { showToast("Between mysteries only."); return; }
          const text = await promptModal({ title: "A new obligation", value: R.rollGenre(c.defaultGenre || "noir", "obligations").value });
          if (!text) return;
          Store.update("take an obligation", () => {
            Store.investigator.obligations.push({ id: uid(), text, struck: false });
            Store.investigator.xp += DATA.NEW_OBLIGATION_XP;
          });
          showToast(`Obligation taken. +${DATA.NEW_OBLIGATION_XP} XP.`);
          rerender();
        }),
        btn("Replace one", async () => {
          const id = await chooseModal({ title: "Replace which obligation?", options: Store.investigator.obligations.map((o) => ({ value: o.id, label: o.text })) });
          if (!id) return;
          const text = await promptModal({ title: "Its replacement", message: "No experience for this one: it is a swap, not a new burden.", value: R.rollGenre(c.defaultGenre || "noir", "obligations").value });
          if (!text) return;
          Store.update("replace an obligation", () => {
            const ob = Store.investigator.obligations.find((o) => o.id === id);
            if (ob) { ob.text = text; ob.struck = false; }
          });
          rerender();
        }))));
  }

  add(host, section("Start another",
    btn("New investigator", () => { resetDrafts(); Store.newCareer("New career"); go("wizard"); })));

  // Between cases the book's order ends here: the answers, a lingering
  // question, experience spent, then the next problem.
  if (!c) return {};
  const running = Store.mystery;
  if (!running) return { action: actionBar("Set up the next mystery", () => go("mystery"), c.history.length ? `${c.history.length} case(s) closed` : "Roll the problem") };
  if (running.solved) return { action: actionBar("Close the case", () => go("solve"), "Then the next mystery") };
  return { action: actionBar("Back to the case", () => go(running.ended ? "solve" : "play"), running.ended ? "Name the three cards" : "A mystery is running") };
}

async function spendXP(benefit) {
  const c = Store.career;
  const who = Store.investigator;
  if (who.xp < benefit.cost) return;
  if (Store.mystery && !Store.mystery.solved) { showToast("Between mysteries only."); return; }
  const inv = Store.investigator;
  let extra = null;
  if (benefit.id === "attribute") {
    extra = await chooseModal({ title: "Raise which attribute?", options: DATA.ATTRIBUTES.filter((a) => D.attrValue(inv, a.id) < DATA.ATTRIBUTE_MAX).map((a) => ({ value: a.id, label: `${a.name} ${D.attrValue(inv, a.id)} → ${D.attrValue(inv, a.id) + 1}` })) });
    if (!extra) return;
  }
  if (benefit.id === "rival") {
    if (!c.rivals.length) { showToast("You have no rivals to reduce."); return; }
    const reducible = c.rivals.filter((r) => r.level > 1);
    if (!reducible.length) { showToast("Every rival is already at level 1."); return; }
    extra = await chooseModal({ title: "Ease off which rival?", options: reducible.map((r) => ({ value: r.id, label: r.name, note: `Level ${r.level} → ${r.level - 1}` })) });
    if (!extra) return;
  }
  if (benefit.id === "danger") {
    if (!c.carryDanger) { showToast("No danger is carrying over yet — spend this between mysteries."); return; }
  }
  if (benefit.id === "drop_obligation") {
    if (inv.obligations.length < 2) { showToast("You need more than one obligation."); return; }
    extra = await chooseModal({ title: "Drop which obligation?", options: inv.obligations.map((o) => ({ value: o.id, label: o.text })) });
    if (!extra) return;
  }
  let newObligation = null, newSignature = null;
  if (benefit.id === "attribute" || benefit.id === "signature") {
    if (benefit.id === "signature") {
      newSignature = await promptModal({ title: "New signature keyword", value: R.rollGenre(c.defaultGenre || "noir", "keywords").value });
      if (!newSignature) return;
    }
    newObligation = await promptModal({ title: "And a new obligation", message: "Taking on more means owing more.", value: R.rollGenre(c.defaultGenre || "noir", "obligations").value });
    if (!newObligation) return;
  }
  Store.update("spend experience", () => {
    who.xp -= benefit.cost;
    if (benefit.id === "danger") { if (c.carryDanger) c.carryDanger = Math.max(0, c.carryDanger - 1); }
    if (benefit.id === "rival") { const r = c.rivals.find((x) => x.id === extra); if (r) r.level = Math.max(1, r.level - 1); }
    if (benefit.id === "drop_obligation") inv.obligations = inv.obligations.filter((o) => o.id !== extra);
    if (benefit.id === "clear") { inv.fatigue = 0; inv.struck = {}; }
    if (benefit.id === "signature") inv.keywords.push({ id: uid(), text: newSignature, signature: true, struck: false });
    if (benefit.id === "attribute") inv.attributes[extra] = Math.min(DATA.ATTRIBUTE_MAX, inv.attributes[extra] + 1);
    if (newObligation) inv.obligations.push({ id: uid(), text: newObligation, struck: false });
  });
  showToast(`Spent ${benefit.cost} XP.`);
  rerender();
}

// --- Settings -----------------------------------------------------------------
export function renderSettings(host) {
  add(host, el("h1", { text: "Settings" }),
    explain("Optional rules from Chapter 3, how the app handles dice, and your data. Everything here is off unless the book's own default is on."));

  const toggles = el("div", {});
  for (const t of TOGGLES) {
    const input = el("input", { type: "checkbox", checked: Settings.get(t.key) ? true : null,
      onchange: (e) => { Settings.set(t.key, e.target.checked); if (t.key === "wakeLock") applyWakeLock(); rerender(); } });
    add(toggles, el("label", { class: "opt" }, input, el("span", { class: "opt-text" }, t.name, el("small", { text: t.text }))));
  }
  add(host, section("Rules and play", toggles));

  add(host, section("Appearance",
    defRow("Theme", el("div", { class: "btn-row" }, ...["system", "light", "dark"].map((t) =>
      optionBtn(t[0].toUpperCase() + t.slice(1), () => { Settings.set("theme", t); applyTheme(); rerender(); }, Settings.get("theme") === t)))),
    defRow("Text size", el("div", { class: "btn-row" }, ...[90, 100, 115, 130].map((sz) =>
      optionBtn(`${sz}%`, () => { Settings.set("textScale", sz); applyTextScale(); rerender(); }, Settings.get("textScale") === sz))))));

  const blocked = R.blockedList();
  add(host, section(houseAidTitle("contentFilter"),
    el("p", { class: "small muted", text: "Not from the book. Rows you list here are skipped when the app rolls a table, so a mystery stays inside what you want to play. Lines and veils, in one list." }),
    el("p", { class: "small mono", text: blocked.length ? blocked.join(", ") : "Nothing filtered." }),
    el("div", { class: "btn-row" },
      btn("Edit the list", async () => {
        const t = await promptModal({ title: "Filtered rows", message: "One table entry per line, spelled as the table spells it.", value: blocked.join("\n"), multiline: true });
        if (t !== null) {
          const list = t.split("\n").map((x) => x.trim()).filter(Boolean);
          Settings.set("blocked", list); R.setBlocked(list); rerender();
        }
      }))));

  add(host, section("Your data",
    el("p", { class: "small muted", text: "Everything lives on this device as plain JSON. Export it before you clear your browser, or to move to another phone." }),
    el("div", { class: "btn-row" },
      btn("Export backup", () => {
        const blob = new Blob([Store.exportJSON()], { type: "application/json" });
        const a = el("a", { href: URL.createObjectURL(blob), download: "caught-in-the-rain-backup.json" });
        document.body.append(a); a.click(); a.remove();
        showToast("Backup saved.");
      }, "primary"),
      btn("Import backup", async () => {
        const input = el("input", { type: "file", accept: "application/json" });
        input.addEventListener("change", async () => {
          const file = input.files[0];
          if (!file) return;
          const ok = await confirmModal({ title: "Replace everything?", message: "Importing replaces every career on this device, including the one in play.", confirmLabel: "Replace", danger: true });
          if (!ok) return;
          try { Store.importJSON(await file.text()); showToast("Backup restored."); rerender(); }
          catch (e) { showToast("That file is not a backup."); }
        });
        input.click();
      }),
      btn("Check my data", () => showToast(Store.integrityCheck())))));

  // An installed app cannot be "reloaded" the way a tab can, so it gets a button.
  const versionLine = el("p", { class: "small muted", text: "Checking which version is installed\u2026" });
  Updates.version().then((v) => {
    versionLine.textContent = v ? `Installed version: ${v}.` : "Running from the network, not an installed copy.";
  });
  add(host, section("Updates",
    versionLine,
    el("p", { class: "small muted", text: "An app added to the home screen only looks for a new version when it opens or comes back to the foreground. This asks now." }),
    el("div", { class: "btn-row" },
      btn("Check for updates", async () => {
        showToast("Checking\u2026");
        const result = await Updates.check({ force: true });
        if (result === "update") return;                       // the update toast is already up
        if (result === "current") showToast("You are on the latest version.");
        else if (result === "offline") showToast("No connection \u2014 try again when you are online.");
        else showToast("Updates apply to the installed app, not to a plain browser tab.");
      }))));

  add(host, section("About",
    el("p", { class: "small", text: "A personal play aid for Caught in the Rain by Nicholas Robinia (The Ravensridge Emporium, 2025). It holds the rules and tables you need at the table; it is not the book and does not reproduce it." }),
    el("p", { class: "small muted", text: "Built from the owner's own copy. If you share or publish this app, the licensing is yours to sort out." }),
    el("div", { class: "btn-row" }, btn("Open the tutorial", () => go("tutorial")), btn("Rules library", () => go("rules")))));

  // Destructive, and at the end of the scroll rather than under the thumb.
  add(host, section("Start over",
    el("p", { class: "small muted", text: "Two different sizes of clean slate. Export a backup first if there is anything here you might want back." }),
    el("div", { class: "btn-row" },
      btn("Put down this case", async () => {
        const c = Store.career;
        if (!c || !c.mystery) { showToast("No mystery is running."); return; }
        const who = c.investigators.map((i) => i.name || "your investigator").join(", ");
        const ok = await confirmModal({
          title: "Put down this case?",
          message: `The mystery, both decks, every clue set and the three cards set aside are discarded, unsolved. ${who} stays exactly as they are — fatigue, strikes, keywords, obligations and experience — along with the journal, the closed cases and any rivals. No danger carries over.`,
          confirmLabel: "Put it down", danger: true,
        });
        if (!ok) return;
        Store.clearMystery();
        showToast("Case put down. Set up a new mystery when you are ready.");
        go("home");
      }, "danger"),
      btn("Erase everything", async () => {
        const careers = Store.careers().length;
        const ok = await confirmModal({
          title: "Erase everything?",
          message: `Every career on this device — ${careers === 1 ? "one career" : `${careers} careers`}, every investigator, every journal and every closed case — and your settings with them. There is no undo, and no copy anywhere else.`,
          confirmLabel: "Erase it all", danger: true,
        });
        if (!ok) return;
        const second = await confirmModal({
          title: "Last chance",
          message: "This cannot be undone. If you have not exported a backup, cancel and do that first.",
          confirmLabel: "Erase everything", danger: true,
        });
        if (!second) return;
        Store.eraseEverything();
        Settings.reset();
        applyTheme();
        applyTextScale();
        showToast("Everything erased.");
        go("home");
      }, "danger"))));

  return {};
}

export function applyTheme() {
  const t = Settings.get("theme");
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}
export function applyTextScale() {
  document.documentElement.style.setProperty("--scale", (Settings.get("textScale") || 100) / 100);
}
let wakeLock = null;
export async function applyWakeLock() {
  try {
    if (Settings.get("wakeLock") && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* a refused wake lock is not an error worth interrupting play for */ }
}
