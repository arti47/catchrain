// A session, as something you would read rather than something you would debug.
//
//   node .playtest/transcript.mjs [session.json] [out.pdf]
//
// Takes a saved playtest session (or any export of the app's own localStorage)
// and lays the record out the way the book reads: the fiction in a serif, the
// machinery in a sans with tabular figures, oldest first, a day to a heading.
// Renders through the same headless Chromium the harnesses use, so it needs no
// network and no new dependency.

import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import { launch } from "../tests/server.mjs";

const inPath = process.argv[2] || ".playtest/play.json";
const outPath = process.argv[3] || ".playtest/session.pdf";

const raw = JSON.parse(readFileSync(inPath, "utf8"));
// Either a driver session file or a plain export of the app's storage.
const save = raw.local ? JSON.parse(raw.local["citr:v1"]) : raw;
const career = save.careers[save.activeId];
const inv = career.investigators.find((i) => i.id === career.activeInvestigatorId) || career.investigators[0];
const closed = career.history[career.history.length - 1] || null;
const mystery = career.mystery;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const SUIT = { S: "♠", H: "♥", D: "♦", C: "♣" };
const card = (c) => `<span class="pcard ${c.suit === "H" || c.suit === "D" ? "red" : ""}">${c.rank}${SUIT[c.suit] || "?"}</span>`;

// The book's own voice for each kind of line: what the player wrote is prose,
// what the app did is machinery, and they should not look the same on a page.
const KIND = {
  note: "prose", scene: "prose", create: "machine", mystery: "premise",
  test: "machine", keyword: "machine", solve: "machine",
};

const days = [];
for (const e of career.journal) {
  const d = e.day || 1;
  if (!days.length || days[days.length - 1].day !== d) days.push({ day: d, entries: [] });
  days[days.length - 1].entries.push(e);
}

// A scene line the player wrote and a scene line the app wrote share a kind, so
// they are told apart by whether the app's own sentence shape is there.
const machineScene = /^(Scene ended|Investigation scene: rolled|Truth scene: established|.* rests\.$|.* attends:)/;

const body = days.map(({ day, entries }) => `
  <section class="day">
    <h2>Day ${day}</h2>
    ${entries.map((e) => {
      const kind = KIND[e.kind] || "machine";
      const isProse = kind === "prose" && !(e.kind === "scene" && machineScene.test(e.text));
      if (kind === "premise") return ""; // the header already carries it, verbatim
      
      if (isProse) return `<p class="prose">${esc(e.text)}</p>`;
      return `<p class="machine"><span class="tag">${esc(e.kind)}</span>${esc(e.text)}</p>`;
    }).join("\n")}
  </section>`).join("\n");

const rolls = career.rollLog.map((r) => `
  <tr>
    <td class="k">${esc(r.kind)}</td>
    <td class="l">${esc(r.label || "")}</td>
    <td class="n">${(r.dice || []).join(" + ")}${r.attrValue ? ` + ${r.attrValue}` : ""}</td>
    <td class="n">${r.total == null ? "" : r.total}</td>
    <td class="o">${esc(r.outcome || "")}</td>
  </tr>`).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(career.name)} — session record</title>
<style>
  @page { size: A4; margin: 18mm 16mm 16mm; }
  :root { --ink:#1b1714; --dim:#6d6257; --rule:#d9cfc2; --paper:#fbf7f0; --rust:#8c3b23; --blue:#2c4f6b; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:14px/1.55 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; }
  .sans { font-family:"Helvetica Neue",Arial,sans-serif; font-variant-numeric:tabular-nums; }
  header { border-bottom:2px solid var(--ink); padding-bottom:10px; margin-bottom:16px; }
  h1 { font-size:26px; margin:0 0 2px; letter-spacing:-.01em; }
  .sub { font-family:"Helvetica Neue",Arial,sans-serif; font-size:10px; letter-spacing:.14em;
         text-transform:uppercase; color:var(--dim); }
  .facts { display:grid; grid-template-columns:repeat(2,1fr); gap:2px 22px; margin:14px 0 0;
           font-family:"Helvetica Neue",Arial,sans-serif; font-size:11px; font-variant-numeric:tabular-nums; }
  .facts div { display:flex; justify-content:space-between; gap:12px;
               border-bottom:1px solid var(--rule); padding:3px 0; }
  .facts span:first-child { color:var(--dim); letter-spacing:.06em; text-transform:uppercase; font-size:9.5px; }
  .premise { font-size:17px; font-style:italic; margin:14px 0 4px; }
  h2 { font-family:"Helvetica Neue",Arial,sans-serif; font-size:10px; letter-spacing:.18em;
       text-transform:uppercase; color:var(--dim); margin:22px 0 8px;
       border-bottom:1px solid var(--rule); padding-bottom:5px; }
  .day { break-inside:auto; }
  p { margin:0 0 9px; }
  p.prose { text-indent:0; }
  p.machine { font-family:"Helvetica Neue",Arial,sans-serif; font-size:10.5px; color:var(--dim);
              font-variant-numeric:tabular-nums; margin-bottom:7px; }
  .tag { display:inline-block; min-width:56px; color:var(--rust); letter-spacing:.1em;
         text-transform:uppercase; font-size:9px; }
  .cards { margin:10px 0; }
  .pcard { display:inline-block; border:1px solid var(--rule); border-radius:3px; padding:2px 6px;
           margin-right:5px; font-family:"Helvetica Neue",Arial,sans-serif; font-size:12px; background:#fff; }
  .pcard.red { color:var(--rust); }
  .answer { border-left:3px solid var(--blue); padding:2px 0 2px 12px; margin:8px 0 12px; }
  table { width:100%; border-collapse:collapse; font-family:"Helvetica Neue",Arial,sans-serif;
          font-size:10px; font-variant-numeric:tabular-nums; }
  th { text-align:left; color:var(--dim); font-size:9px; letter-spacing:.1em; text-transform:uppercase;
       border-bottom:1px solid var(--ink); padding:4px 6px 4px 0; }
  td { border-bottom:1px solid var(--rule); padding:3px 6px 3px 0; vertical-align:top; }
  td.n, th.n { text-align:right; white-space:nowrap; }
  td.o { color:var(--dim); }
  footer { margin-top:20px; border-top:1px solid var(--rule); padding-top:8px;
           font-family:"Helvetica Neue",Arial,sans-serif; font-size:9px; color:var(--dim); }
</style></head><body>
<header>
  <div class="sub">Caught in the Rain · session record</div>
  <h1>${esc(inv.name)}</h1>
  <p class="premise">${esc(closed ? closed.problem : (mystery ? "" : ""))}</p>
  <div class="facts">
    <div><span>Trait</span><span>${esc(inv.trait)}</span></div>
    <div><span>Attributes</span><span>Power ${inv.attributes.power} · Insight ${inv.attributes.insight} · Method ${inv.attributes.method}</span></div>
    <div><span>Obligation</span><span>${esc((inv.obligations[0] || {}).text || "—")}</span></div>
    <div><span>Days played</span><span>${inv.day}</span></div>
    ${closed ? `<div><span>Difficulty</span><span>${esc(closed.difficulty)}</span></div>
    <div><span>Guesses correct</span><span>${closed.correct} of 3</span></div>
    <div><span>Danger at the end</span><span>${closed.danger}</span></div>
    <div><span>Clue sets</span><span>${closed.clues}</span></div>` : ""}
    <div><span>Experience</span><span>${inv.xp}</span></div>
    <div><span>Keywords held</span><span>${inv.keywords.length}</span></div>
  </div>
</header>

${body}

${closed && closed.answers && closed.answers.length ? `
<h2>What she learned</h2>
${closed.answers.map((a) => `<div class="answer"><p class="prose">${esc(a)}</p></div>`).join("")}` : ""}

${career.questions.length ? `
<h2>A question still open</h2>
${career.questions.map((q) => `<p class="prose">${esc(q.text)}</p>`).join("")}` : ""}

<h2>Every roll, in order</h2>
<table>
  <thead><tr><th>Kind</th><th>What for</th><th class="n">Dice</th><th class="n">Total</th><th>Outcome</th></tr></thead>
  <tbody>${rolls}</tbody>
</table>

<footer>${career.journal.length} journal entries · ${career.rollLog.length} rolls · generated from the app's own saved state</footer>
</body></html>`;

const browser = await launch(chromium);
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
writeFileSync(outPath, pdf);
await browser.close();
console.log(`${outPath} — ${career.journal.length} entries, ${career.rollLog.length} rolls, ${(pdf.length / 1024).toFixed(0)} KB`);
