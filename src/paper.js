// The two sheets the book prints in Chapter 4, as the app's versions of them.
//
// Two jobs, one subject. The screen is the mystery sheet: everything the paper
// one holds, on one page, read-only — the Case, Clues and Play tabs own every
// action, and a fourth surface that could also change things is how two screens
// end up disagreeing about one state. The export is both sheets rendered as a
// document you can keep, print, or hand to someone who does not have the app;
// JSON protects the data and cannot do any of those.

import { el, add } from "./core.js";
import { FATIGUE_BOXES, CLOCK_SEGMENTS, DECK, GENRES, END_TRIGGERS } from "../data.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import { readiness } from "./coach.js";
import { section, row, pill, explain, emptyState, cardFace, showToast, actionBar } from "./ui.js";
import { go } from "./router.js";

import { illustration, caseFile, dangerGauge, glyph, tornCard, levelBars, markBoxes, flatDie, deckStack } from "./art.js";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// --- The mystery sheet, on screen ---------------------------------------------
export function renderMysterySheet(host) {
  const c = Store.career, m = c && c.mystery;
  add(host, el("h1", { text: "Mystery sheet" }),
    explain("Everything the book's mystery sheet holds, on one page: the problem, the danger, every clue set, the threats in the scene and the rivals behind it. It only shows — the Case, Clues and Play tabs are where any of it changes."));

  if (!m) {
    add(host, emptyState("No mystery in progress.", "Set up a mystery", () => go("mystery"), illustration("mystery")));
    return {};
  }
  const inv = Store.investigator;
  const read = readiness(m);
  const sets = D.clueSetList(m).sort((a, b) => DECK.clueRanks.indexOf(a.rank) - DECK.clueRanks.indexOf(b.rank));
  const threats = D.activeThreats(m);

  add(host, caseFile(section("The problem",
    el("p", { class: "premise", text: R.problemText(m) }),
    row("Location", m.location || "—"),
    row("Object", m.object || "—"),
    row("Treachery", m.treachery || "—"),
    m.secondObject ? row("Second object", m.secondObject) : null,
    row("Motivation", m.motivation || "—"),
    row("Genre", GENRES[m.genre].name),
    row("Difficulty", R.difficulty(m.difficulty).name)), ((Store.career && Store.career.history) || []).length + 1));

  add(host, section("Danger and the scene",
    row("Danger", el("span", { class: "gauged" }, dangerGauge(m.danger), el("span", { class: `pill ${m.danger >= 6 ? "danger" : ""}`, text: String(m.danger) }))),
    row("Scene", m.scene ? `${R.sceneType(m.scene.type).name}${m.scene.stage ? ` · ${R.stage(m.scene.stage).name} stage` : ""}${m.scene.done ? " (finished)" : ""}` : "None in progress"),
    row("Clock", `${inv.clock}/${CLOCK_SEGMENTS} · day ${inv.day}`),
    row("Ends when", m.ended
      ? `Ended — ${(END_TRIGGERS.find((t) => t.id === m.endTrigger) || END_TRIGGERS[0]).text}`
      : "You stop, the deck empties, or a 9+ consequence forces it")));

  add(host, section(`Clue sets (${sets.length})`,
    sets.length
      ? el("div", {}, ...sets.map((s) => el("div", { class: `clue-set ${s.truth ? "truth" : ""} ${s.falseLead ? "false" : ""}` },
          el("div", { class: "threat-head" },
            el("strong", { text: `The ${s.rank}s` }),
            s.truth ? pill("Truth", "truth") : s.falseLead ? pill("False lead", "loss") : pill(`${s.cards.length} card${s.cards.length === 1 ? "" : "s"}`)),
          s.cards.length ? el("div", { class: "hand" }, ...s.cards.map(cardFace)) : s.falseLead ? el("div", { class: "hand" }, tornCard(s.rank)) : null,
          el("p", { class: "small", text: s.description || "No description yet." }))))
      : el("p", { class: "muted small", text: "No clues yet." })));

  add(host, section("The truth",
    row("Ruled out", `${m.truthRevealed.length}`),
    row("Never seen", `${read.unseen}`),
    m.truthRevealed.length ? el("div", { class: "hand" }, ...m.truthRevealed.map(cardFace)) : null,
    el("p", { class: "small muted", text: read.guess })));

  add(host, section(`Threats (${threats.length})`,
    threats.length
      ? el("div", {}, ...threats.map((t) => row(el("span", { class: "threat-name" }, glyph("threat", 16), el("span", { text: t.name })),
          el("span", { class: "threat-meters" },
            el("span", { class: "pill loss" }, levelBars(t.level), `Level ${t.level}`), " ",
            el("span", { class: "pill" }, markBoxes(t.marks || 0, t.level), `${t.marks || 0}/${t.level} marks`)))))
      : el("p", { class: "muted small", text: "Nothing in the scene." })));

  if (Settings.get("rivals")) {
    add(host, section(`Rivals (${c.rivals.length})`,
      c.rivals.length
        ? el("div", {}, ...c.rivals.map((r, i) => row(el("span", { class: "rival-name" }, el("span", { class: "rival-die" }, flatDie(i + 1, "rival")), `${i + 1}. ${r.name}`),
            el("span", { class: "pill loss" }, levelBars(r.level), `Level ${r.level}`))))
        : el("p", { class: "muted small", text: "None yet." })));
  }

  const stacked = (count, label, text) => el("span", { class: "stacked" }, deckStack(count, label), el("span", { text }));
  add(host, section("The decks",
    row("Clue deck", stacked(m.clueDeck.length, "Clue deck", `${m.clueDeck.length} left`)),
    row("Discarded", stacked(m.clueDiscard.length, "Discarded", `${m.clueDiscard.length}`)),
    row("Truth deck", stacked(m.truthDeck.length, "Truth deck", `${m.truthDeck.length} left`)),
    row("Jokers drawn", `${m.jokersDrawn || 0} of ${DECK.jokers}`)));

  return { action: actionBar("Save both sheets", () => saveSheets(), "As a page you can print or keep") };
}

// --- Both sheets, as a document -----------------------------------------------
/**
 * One self-contained HTML file: no script, no network, opens anywhere, prints
 * to something that looks like the sheets in the back of the book. The set-aside
 * truth cards are never in it — a sheet you hand to someone should not spoil
 * the mystery it describes.
 */
export function sheetsHtml(career, inv, m) {
  const attr = (a) => `<div class="cell"><span class="k">${esc(a.name)}</span><span class="v">${D.attrValue(inv, a.id)}${D.isStruck(inv, a.id) ? " &#10007;" : ""}</span>${pips(D.attrValue(inv, a.id))}</div>`;
  const boxes = (n, of) => Array.from({ length: of }, (_, i) => `<span class="box${i < n ? " on" : ""}"></span>`).join("");
  const card = (c2) => `<span class="pc${c2.suit === "H" || c2.suit === "D" ? " red" : ""}">${esc(c2.rank)}&nbsp;${{ S: "&#9824;", H: "&#9829;", D: "&#9830;", C: "&#9827;" }[c2.suit] || "?"}</span>`;
  // The sheet's drawings, as the app draws them: pips for an attribute out of
  // three, the clock as a disc of four wedges, and the title's drop.
  const pips = (v) => `<svg class="pips" width="34" height="10" viewBox="0 0 34 10" aria-hidden="true">${[0, 1, 2].map((i) =>
    `<circle cx="${5 + i * 12}" cy="5" r="3.6" ${i < v ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.1"'}/>`).join("")}</svg>`;
  const disc = (n, of) => {
    const pt = (deg) => { const r = ((deg - 90) * Math.PI) / 180; return `${(12 + 10 * Math.cos(r)).toFixed(2)},${(12 + 10 * Math.sin(r)).toFixed(2)}`; };
    const wedges = Array.from({ length: of }, (_, i) => {
      const a = (360 / of) * i, b = a + 360 / of;
      return `<path d="M12,12 L${pt(a)} A10,10 0 0 1 ${pt(b)} Z" fill="${i < n ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1"/>`;
    }).join("");
    return `<svg class="disc" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">${wedges}</svg>`;
  };
  const drop = glyph("drop", 18).innerHTML;
  // A threat's marks as boxes to fill, the way the app draws them.
  const marks = (n, of) => Array.from({ length: of }, (_, i) => `<span class="mk${i < n ? " on" : ""}"></span>`).join("");
  const list = (items, empty) => (items.length ? `<ul>${items.join("")}</ul>` : `<p class="muted">${empty}</p>`);

  const sets = m ? D.clueSetList(m).sort((a, b) => DECK.clueRanks.indexOf(a.rank) - DECK.clueRanks.indexOf(b.rank)) : [];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(inv.name)} &mdash; Caught in the Rain</title>
<style>
  @page { size: A4; margin: 16mm; }
  :root { --ink:#1b1714; --dim:#6d6257; --rule:#d9cfc2; --paper:#fbf7f0; --loss:#8c3b23; --truth:#2c4f6b; }
  *{box-sizing:border-box}
  body{margin:0;padding:24px;background:var(--paper);color:var(--ink);
       font:14px/1.5 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;max-width:820px}
  h1{font-size:24px;margin:0 0 2px}
  h2{font-family:"Helvetica Neue",Arial,sans-serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;
     color:var(--dim);margin:26px 0 8px;border-bottom:1px solid var(--rule);padding-bottom:5px}
  .sub{font-family:"Helvetica Neue",Arial,sans-serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
  .grid{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
  .cell{border:1px solid var(--rule);border-radius:8px;padding:8px 14px;background:#fff;min-width:96px}
  .cell .k{display:block;font-family:"Helvetica Neue",Arial,sans-serif;font-size:9px;letter-spacing:.1em;
           text-transform:uppercase;color:var(--dim)}
  .cell .v{font-size:22px;font-variant-numeric:tabular-nums}
  .box{display:inline-block;width:16px;height:16px;border:1px solid var(--ink);margin-right:5px;border-radius:3px}
  .box.on{background:var(--ink)}
  .pips{display:block;margin-top:4px} .disc{vertical-align:middle;margin-right:6px}
  .case-file{position:relative;border:1px solid var(--rule);border-radius:0 8px 8px 8px;background:#fff;padding:14px 16px 6px;margin:26px 0 12px}
  .case-tab{position:absolute;top:-21px;left:-1px;border:1px solid var(--rule);border-bottom:0;border-radius:6px 6px 0 0;
    background:#fff;padding:2px 12px;font-family:"Helvetica Neue",Arial,sans-serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
  .mk{display:inline-block;width:9px;height:11px;border:1px solid var(--loss);border-radius:2px;margin-right:2px;vertical-align:-1px}
  .mk.on{background:var(--loss)}
  .sub svg{width:14px;height:14px;vertical-align:-2px;margin-right:6px}
  .premise{font-size:17px;font-style:italic;margin:6px 0 12px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{border-bottom:1px solid var(--rule);padding:5px 8px 5px 0;vertical-align:top}
  td.k{font-family:"Helvetica Neue",Arial,sans-serif;font-size:10px;letter-spacing:.06em;text-transform:uppercase;
       color:var(--dim);width:34%}
  ul{margin:6px 0;padding-left:18px} li{margin-bottom:5px}
  .muted{color:var(--dim);font-size:13px}
  .pc{display:inline-block;border:1px solid var(--rule);border-radius:3px;padding:1px 6px;margin-right:4px;
      background:#fff;font-family:"Helvetica Neue",Arial,sans-serif;font-size:12px}
  .pc.red{color:var(--loss)}
  .struck{text-decoration:line-through;color:var(--dim)}
  /* A page break only exists when printing; on screen the two sheets still
     need to read as two sheets, so it carries a rule of its own. */
  .page-break{page-break-before:always;border-top:2px solid var(--ink);margin:34px 0 22px}
  footer{margin-top:28px;border-top:1px solid var(--rule);padding-top:8px;
         font-family:"Helvetica Neue",Arial,sans-serif;font-size:9px;color:var(--dim)}
</style></head><body>

<div class="sub">${drop}Caught in the Rain &middot; investigator</div>
<h1>${esc(inv.name) || "Unnamed"}</h1>
<p class="premise">${esc(inv.trait)}</p>

<h2>Attributes</h2>
<div class="grid">${["power", "insight", "method"].map((id) => attr({ id, name: id[0].toUpperCase() + id.slice(1) })).join("")}</div>

<h2>Fatigue and time</h2>
<table>
  <tr><td class="k">Fatigue</td><td>${boxes(inv.fatigue, FATIGUE_BOXES)} ${inv.fatigue}/${FATIGUE_BOXES}</td></tr>
  <tr><td class="k">Clock</td><td>${disc(inv.clock, CLOCK_SEGMENTS)} ${inv.clock}/${CLOCK_SEGMENTS}</td></tr>
  <tr><td class="k">Day</td><td>${inv.day}</td></tr>
  ${Settings.get("career") ? `<tr><td class="k">Experience</td><td>${inv.xp} XP</td></tr>` : ""}
</table>

<h2>Keywords</h2>
${list(inv.keywords.map((k) => `<li class="${k.struck ? "struck" : ""}">${esc(k.text)}${k.signature ? " <em>(signature)</em>" : ""}</li>`), "None.")}

<h2>Obligations</h2>
${list(inv.obligations.map((o) => `<li class="${o.struck ? "struck" : ""}">${esc(o.text)}${o.struck ? " <em>(attended today)</em>" : ""}</li>`), "None.")}

${inv.notes ? `<h2>Notes</h2><p>${esc(inv.notes)}</p>` : ""}

${m ? `
<div class="page-break"></div>
<div class="sub">${drop}Caught in the Rain &middot; mystery</div>
<div class="case-file"><span class="case-tab">Case &numero;&nbsp;${((career && career.history) || []).length + 1}</span>
<h1>The problem</h1>
<p class="premise">${esc(R.problemText(m))}</p>
</div>
<table>
  <tr><td class="k">Location</td><td>${esc(m.location)}</td></tr>
  <tr><td class="k">Object</td><td>${esc(m.object)}</td></tr>
  <tr><td class="k">Treachery</td><td>${esc(m.treachery)}</td></tr>
  ${m.secondObject ? `<tr><td class="k">Second object</td><td>${esc(m.secondObject)}</td></tr>` : ""}
  <tr><td class="k">Motivation</td><td>${esc(m.motivation)}</td></tr>
  <tr><td class="k">Genre</td><td>${esc(GENRES[m.genre].name)}</td></tr>
  <tr><td class="k">Difficulty</td><td>${esc(R.difficulty(m.difficulty).name)}</td></tr>
  <tr><td class="k">Danger</td><td>${m.danger}</td></tr>
</table>

<h2>Clue sets</h2>
${list(sets.map((s) => `<li><strong>The ${esc(s.rank)}s</strong> ${s.cards.map(card).join("")}${
  s.truth ? " <em>established as a truth</em>" : s.falseLead ? " <em>false lead</em>" : ""
}<br>${esc(s.description) || '<span class="muted">No description yet.</span>'}</li>`), "No clues yet.")}

<h2>The truth</h2>
<p>${m.truthRevealed.length ? m.truthRevealed.map(card).join("") : '<span class="muted">Nothing ruled out yet.</span>'}</p>
<table>
  <tr><td class="k">Ruled out</td><td>${m.truthRevealed.length}</td></tr>
  <tr><td class="k">Never seen</td><td>${m.truthDeck.length + DECK.setAside}</td></tr>
  <tr><td class="k">Clue deck</td><td>${m.clueDeck.length} left, ${m.clueDiscard.length} discarded</td></tr>
</table>

<h2>Threats</h2>
${list(D.activeThreats(m).map((t) => `<li>${esc(t.name)} &mdash; level ${t.level}, ${marks(t.marks || 0, t.level)} ${t.marks || 0}/${t.level} marks</li>`), "Nothing in the scene.")}

${Settings.get("rivals") ? `<h2>Rivals</h2>${list(career.rivals.map((r, i) => `<li>${i + 1}. ${esc(r.name)} &mdash; level ${r.level}</li>`), "None yet.")}` : ""}
` : ""}

<footer>Printed from the Caught in the Rain play aid. The three set-aside truth cards are deliberately not on this sheet.</footer>
</body></html>`;
}

/** Hand the document over as a file. */
export function saveSheets() {
  const c = Store.career, inv = Store.investigator;
  if (!c || !inv || !inv.name) { showToast("No investigator to write down yet."); return; }
  const html = sheetsHtml(c, inv, c.mystery);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `${(inv.name || "investigator").replace(/[^\w]+/g, "-").toLowerCase()}-sheets.html` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Saved. Open it in any browser, or print it.");
}
