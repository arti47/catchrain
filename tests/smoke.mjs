// Browser smoke: every route renders, nothing overflows, no stray null text,
// no console errors, and the end-to-end walk works.
import { chromium } from "playwright-core";
import { serve, launch, seed } from "./server.mjs";

import { ROUTES } from "./routes.mjs";
import { TAPPABLE_ALL } from "./controls.mjs";
import { DRAWN, sweep } from "./floors.mjs";
const WIDTHS = [320, 360, 390];
let failures = [];
const fail = (m) => { failures.push(m); console.log("  FAIL " + m); };
const ok = (m) => console.log("  ok   " + m);

const { server, port } = await serve();
const browser = await launch(chromium);
const base = `http://127.0.0.1:${port}/index.html`;

async function newPage(width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

const withSeed = (page, seeded = true) => seed(page, base, seeded ? "stress" : "fresh");
// The guide is one line by the Next button; opened, it is the card these checks read.
const openGuide = async (page) => {
  const t = page.locator(".coach.compact .coach-toggle");
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(80); }
};

// 1. every route renders, no console errors, no stray null text
for (const seeded of [false, true]) {
  const { ctx, page, errors } = await newPage();
  await withSeed(page, seeded);
  for (const route of ROUTES) {
    errors.length = 0;
    await page.goto(`${base}#/${route}`);
    await page.waitForFunction(() => document.querySelector("#screen h1, #screen .empty"), null, { timeout: 4000 }).catch(() => {});
    const heading = await page.locator("#screen h1").count();
    if (!heading) fail(`${route}${seeded ? " (seeded)" : ""}: no heading`);
    const text = await page.locator("#screen").innerText();
    const stray = text.match(/\b(null|undefined|NaN|\[object Object\])\b/);
    if (stray) fail(`${route}${seeded ? " (seeded)" : ""}: stray "${stray[0]}"`);
    if (errors.length) fail(`${route}${seeded ? " (seeded)" : ""}: console error ${errors[0]}`);
    const explainCount = await page.locator("#screen details.explain").count();
    const explainOpen = await page.locator("#screen details.explain[open]").count();
    if (!explainCount) fail(`${route}${seeded ? " (seeded)" : ""}: no explain() note`);
    if (explainOpen) fail(`${route}${seeded ? " (seeded)" : ""}: explain() starts open`);
  }
  if (seeded) {
    await page.goto(`${base}#/home`);
    const text = await page.locator("#screen").innerText();
    if (!text.includes("Amine Deckard")) fail("seeded career never reached the screen");
    // The numbers print icons and figures; their names are on the buttons.
    const header = await page.evaluate(() => [...document.querySelectorAll("#resource-header button.res")].map((b) => b.getAttribute("aria-label")).join(" "));
    if (!/danger/i.test(header) || !/fatigue/i.test(header)) fail("resource header missing on an in-play screen");
  }
  ok(`all ${ROUTES.length} routes render${seeded ? " with a mid-case career" : " from empty"}`);
  await ctx.close();
}

// 2. no horizontal overflow at three phone widths, in the seeded state
for (const width of WIDTHS) {
  const { ctx, page } = await newPage(width);
  await withSeed(page, true);
  for (const route of ROUTES) {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(60);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (over) fail(`${route}: horizontal overflow at ${await page.evaluate(() => window.innerWidth)}px`);
  }
  ok(`no horizontal overflow at ${width}px`);
  await ctx.close();
}

// 3. the primary action is above the fold and nothing sits under the tab bar
{
  const { ctx, page } = await newPage();
  await withSeed(page, true);
  for (const route of ROUTES) {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(60);
    const res = await page.evaluate(() => {
      const bar = document.querySelector(".action-bar .btn");
      const tab = document.querySelector(".tab-bar").getBoundingClientRect();
      const out = { action: null, buried: [] };
      if (bar) { const r = bar.getBoundingClientRect(); out.action = r.top < window.innerHeight && r.bottom > 0; }
      for (const b of document.querySelectorAll("#screen .btn, #screen .choice, #screen summary")) {
        if (b.closest("details:not([open])")) continue;
        const r = b.getBoundingClientRect();
        const docBottom = r.bottom + window.scrollY;
        const pageBottom = document.documentElement.scrollHeight;
        if (pageBottom - docBottom < 0) out.buried.push(b.textContent.slice(0, 20));
      }
      return out;
    });
    if (res.action === false) fail(`${route}: primary action is off-screen`);
    if (res.buried.length) fail(`${route}: controls under the tab bar (${res.buried.join(", ")})`);
  }
  ok("primary actions are above the fold; nothing is buried under the tab bar");
  await ctx.close();
}

// 4. tap targets and input font size
{
  const { ctx, page } = await newPage();
  await withSeed(page, true);
  const small = [];
  for (const route of ROUTES) {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(60);
    const hits = await page.evaluate((sel) => {
      const bad = [];
      for (const n of document.querySelectorAll(sel)) {
        const r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (Math.min(r.width, r.height) < 24) bad.push(`${n.className}:${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      for (const i of document.querySelectorAll("#screen input:not([type=checkbox]):not([type=radio]), #screen select, #screen textarea")) {
        if (parseFloat(getComputedStyle(i).fontSize) < 16) bad.push(`input font ${getComputedStyle(i).fontSize}`);
      }
      return bad;
    }, TAPPABLE_ALL);
    if (hits.length) small.push(`${route}: ${hits.slice(0, 3).join(", ")}`);
  }
  if (small.length) fail("small targets — " + small.join(" | "));
  else ok("every tap target clears 24px and inputs are 16px");
  await ctx.close();
}

// 5. a drawer leads back to the Table, and the Book's switch marks the page you are on
{
  const { ctx, page } = await newPage();
  await withSeed(page, true);
  await page.goto(`${base}#/home`);
  if (!(await page.locator('#screen a.drawer-back[href="#/play"]').count())) fail("the case drawer has no way back to the Table");
  await page.goto(`${base}#/tables`);
  const current = await page.locator('#screen .book-switch .seg-opt[aria-checked="true"]').allInnerTexts();
  if (current.length !== 1 || !/tables/i.test(current[0])) fail(`the Book's switch marks ${current.join(", ") || "nothing"} on Tables`);
  ok("drawers lead back to the Table and the Book's switch marks the current page");
  await ctx.close();
}

// 6. end-to-end: create an investigator, start a mystery, run a scene, take a clue
{
  const { ctx, page, errors } = await newPage();
  await withSeed(page, false);
  await page.goto(`${base}#/wizard`);
  await page.getByRole("radio", { name: "2", exact: true }).first().click();
  await page.locator(".defrow").nth(1).getByRole("radio", { name: "1", exact: true }).click();
  await page.locator(".defrow").nth(2).getByRole("radio", { name: "0", exact: true }).click();
  await page.locator(".action-bar .btn").click();
  await page.getByRole("button", { name: "Roll one" }).click();
  await page.locator(".action-bar .btn").click();
  await page.getByRole("button", { name: "Roll one" }).click();
  await page.locator(".action-bar .btn").click();
  await page.getByRole("button", { name: "Roll a name" }).click();
  await page.getByRole("button", { name: "Roll a trait" }).click();
  await page.locator(".action-bar .btn").click();
  await page.waitForURL(/#\/mystery/, { timeout: 4000 });
  await page.getByRole("button", { name: "Roll all three" }).click();
  await page.getByRole("button", { name: "Roll one" }).click();
  await page.locator(".action-bar .btn").click();
  await page.waitForURL(/#\/play/, { timeout: 4000 });
  const problem = await page.locator("#screen").innerText();
  if (!/It happened at the/.test(problem)) fail("the problem sentence never appeared");

  // run stages until the scene ends or ten tests pass
  await page.locator(".action-bar .btn").click(); // investigation scene
  await page.locator(".modal-actions .btn").first().click();
  let clueSeen = false;
  let rerollOffered = false;
  // A run of failures does not advance a stage, so allow for a bad night: the
  // cap is a stall detector, not a step budget.
  for (let i = 0; i < 30; i++) {
    const bar = page.locator(".action-bar .btn");
    if (!(await bar.count())) break;
    const label = await bar.innerText();
    // Either the scene ended, or a consequence ended the whole mystery.
    if (/Investigation scene|End the scene|Resolve the mystery/.test(label)) { clueSeen = true; break; }
    await bar.click();
    // Poll for each dialog rather than waiting a fixed interval, and always
    // prefer a choice over the dialog's own Cancel.
    for (let j = 0; j < 6; j++) {
      await page.waitForSelector(".modal-overlay", { timeout: 1500 }).catch(() => {});
      const ch = page.locator(".modal-overlay .choice").first();
      const act = page.locator(".modal-actions .btn").first();
      if (await page.locator(".modal-actions .btn", { hasText: "Re-roll with a keyword" }).count()) rerollOffered = true;
      if (await ch.count()) { await ch.click(); }
      else if (await act.count()) { await act.click(); }
      else break;
      await page.waitForTimeout(60);
    }
  }
  if (!clueSeen) fail("the investigation scene never reached its end");
  if (!rerollOffered) fail("no test result offered the re-roll keyword");
  // On the Table the numbers are objects on the desk, not a bar.
  if ((await page.locator("#screen .desk .desk-item").count()) !== 4) fail("the desk is missing in play");
  if (errors.length) fail("console error during the walk: " + errors[0]);
  const logged = await page.evaluate(() => JSON.parse(localStorage.getItem("citr:v1")).careers[Object.keys(JSON.parse(localStorage.getItem("citr:v1")).careers)[0]].rollLog.length);
  if (!logged) fail("no rolls reached the roll log");
  ok("wizard → mystery → investigation scene → roll log");
  await ctx.close();
}

// 7. the joker path, on demand rather than one draw in twenty-one
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "joker", { manualDice: true, autoOracle: true, career: true });
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(150);
  await page.locator(".action-bar .btn").click();            // take the clue
  await page.locator(".modal-overlay .choice").first().click(); // which attribute
  const dice = page.locator(".modal-overlay .dice-pick");
  await dice.first().waitFor({ timeout: 2000 });
  for (let r = 0; r < 2; r++) await dice.nth(r).locator(".die-choice[data-face='6']").click(); // a certain success
  const title = page.locator(".modal-title");
  await title.filter({ hasText: "joker" }).waitFor({ timeout: 4000 }).catch(() => {});
  const sawJoker = await page.locator(".modal-title", { hasText: "joker" }).count();
  if (!sawJoker) fail("drawing a joker never asked which lead was false");
  else {
    await page.locator(".modal-overlay .choice").first().click();
    await page.waitForTimeout(200);
    for (let i = 0; i < 6; i++) {
      const act = page.locator(".modal-actions .btn").first();
      if (!(await act.count())) break;
      await act.click();
      await page.waitForTimeout(90);
    }
    const state = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("citr:v1"));
      const sets = s.careers[s.activeId].mystery.clueSets;
      return Object.values(sets).filter((x) => x.falseLead).length;
    });
    if (state !== 1) fail(`the joker burned ${state} leads, expected 1`);
    if (errors.length) fail(`console error on the joker path: ${errors[0].slice(0, 120)}`);
    ok("a joker burns the lead the player picks, with no error");
  }
  await ctx.close();
}

// 7a. a save from before the party existed still opens, and migrates
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "legacy");
  await page.goto(`${base}#/home`);
  await page.waitForTimeout(200);
  const text = await page.locator("#screen").innerText();
  if (!/Yorinna Wilder/.test(text)) fail("an old save does not reach the screen");
  await page.goto(`${base}#/journal`);
  await page.getByRole("button", { name: "Add a note" }).click();
  const box = page.locator(".modal-overlay textarea").first();
  await box.waitFor({ timeout: 2000 });
  await box.fill("Migrated and still playing.");
  await page.locator(".modal-actions .btn").first().click();
  await page.waitForTimeout(250);
  const shape = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    return { party: (c.investigators || []).length, legacy: !!c.investigator, xpOnCareer: c.xp, xp: c.investigators && c.investigators[0].xp };
  });
  if (shape.party !== 1 || shape.legacy) fail("the old single investigator was not migrated into the party");
  if (shape.xpOnCareer !== undefined || shape.xp !== 6) fail(`experience did not move to the investigator (career ${shape.xpOnCareer}, theirs ${shape.xp})`);
  if (errors.length) fail(`console error on an old save: ${errors[0].slice(0, 120)}`);
  if (shape.party === 1 && !shape.legacy) ok("a pre-party save opens, migrates, and keeps its experience");
  await ctx.close();
}

// 7b. setting the scene: the book's two questions, where the scene is played
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(150);
  const framing = page.locator("#screen details.framing");
  if (!(await framing.count())) fail("an investigation scene does not ask where it takes place");
  else {
    // Folded to one line on the Table (the word budget); opened, the book's questions.
    if (await framing.evaluate((n) => n.open)) fail("the framing card opens across the Table instead of folding to a line");
    await framing.locator("summary").click();
    const text = await framing.innerText();
    if (!/where is this scene taking place/i.test(text)) fail("the framing card does not carry the book's questions");
    await page.getByRole("button", { name: "Ask the oracle" }).click();
    await page.waitForTimeout(120);
    const oracle = await framing.locator(".mono").innerText();
    if (!oracle.trim()) fail("the oracle button produced no words");
    await page.getByRole("button", { name: "Write it down" }).click();
    const input = page.locator(".modal-overlay textarea").first();
    await input.waitFor({ timeout: 2000 });
    await input.fill("The shutters are half down and the crowd will not move.");
    await page.locator(".modal-actions .btn").first().click();
    await page.waitForTimeout(250);
    const saved = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("citr:v1"));
      const c = s.careers[s.activeId];
      return { framing: c.mystery.scene.framing, journal: c.journal.some((e) => /shutters/.test(e.text)) };
    });
    if (!saved.framing) fail("the scene description was not kept");
    if (!saved.journal) fail("the scene description never reached the journal");
    if (errors.length) fail(`console error while setting the scene: ${errors[0].slice(0, 120)}`);
    ok("setting the scene: the questions, an oracle, and the answer kept in the journal");
  }
  await ctx.close();
}

// 8. co-op: the party, the round, and who a test belongs to (Ch.3)
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "party", { multiplayer: true, career: true });
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(150);

  // On the Table, who is playing sits on the desk, with the switch beside it.
  const who = await page.locator("#screen .desk-who").innerText().catch(() => "");
  if (!/AMINE|Amine/i.test(who)) fail("the Table does not say who is in context");

  const screen = await page.locator("#screen").innerText();
  if (!/Percy/.test(screen)) fail("the round panel does not name the investigator still owing a scene");

  // Amine has had her scene, so the screen hands over rather than offering
  // her a second one, and the clock waits.
  const handover = await page.locator(".action-bar .btn").innerText();
  if (!/Play as Percy/.test(handover)) fail(`the screen did not hand over to the waiting investigator (bar: "${handover.split("\n")[0]}")`);
  await page.locator(".action-bar .btn").click();
  await page.waitForTimeout(250);

  const now = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    return s.careers[s.activeId].activeInvestigatorId;
  });
  if (now !== "inv2") fail("the refusal did not hand the spotlight to whoever was waiting");

  // Percy takes a rest; the round completes and both clocks advance together.
  const rest = page.locator("#screen .choice", { has: page.locator(".choice-label", { hasText: /^Rest$/ }) }).first();
  await rest.click();
  await page.waitForTimeout(300);
  for (let i = 0; i < 4; i++) {
    const act = page.locator(".modal-actions .btn").first();
    if (!(await act.count())) break;
    await act.click();
    await page.waitForTimeout(120);
  }
  const bar = await page.locator(".action-bar .btn").innerText().catch(() => "");
  if (!/End the scene/.test(bar)) fail(`the round did not complete after everyone had a scene (bar: "${bar.split("\n")[0]}")`);
  await page.locator(".action-bar .btn").click();
  await page.waitForTimeout(300);
  for (let i = 0; i < 4; i++) {
    const act = page.locator(".modal-actions .btn").first();
    if (!(await act.count())) break;
    await act.click();
    await page.waitForTimeout(120);
  }
  const clocks = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    return s.careers[s.activeId].investigators.map((i) => i.clock);
  });
  if (!clocks.every((n) => n === 2)) fail(`the clock did not advance for everyone (${clocks.join(", ")})`);

  // A shared scene asks who is rolling.
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(150);
  await page.locator("#screen .choice", { has: page.locator(".choice-label", { hasText: /^Investigation$/ }) }).first().click();
  await page.waitForTimeout(200);
  const attach = await page.locator(".modal-title").innerText().catch(() => "");
  if (!/waiting for you/i.test(attach)) fail(`the investigation roll did not ask who a waiting threat is on (saw "${attach}")`);
  await page.locator(".modal-overlay .choice").first().click();
  await page.waitForTimeout(250);
  await page.locator(".modal-actions .btn").first().click(); // set the scene
  await page.waitForTimeout(200);
  await page.locator(".action-bar .btn").click();
  await page.waitForTimeout(250);
  const asked = await page.locator(".modal-title").innerText().catch(() => "");
  if (!/who acts/i.test(asked)) fail(`a shared scene did not ask who acts (saw "${asked}")`);
  if (errors.length) fail(`console error in co-op: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok("co-op: the party shares a round, a clock and a scene");
  await ctx.close();
}

// 8b. stacked choices are a list, not a pile
{
  const { ctx, page } = await newPage();
  await seed(page, base, "mid-session");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    c.mystery.scene = null; c.mystery.threats = [];   // the scene picker, not a scene
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(200);
  const geo = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll("#screen .choice")].map((n) => n.getBoundingClientRect());
    if (boxes.length < 2) return null;
    const widths = boxes.map((b) => Math.round(b.width));
    // Tiles, two to a row: every pair of tiles is apart, sideways or downwards.
    const gaps = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      gaps.push(Math.round(Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom)));
    }
    return { count: boxes.length, widths, gaps };
  });
  if (!geo) fail("the scene picker offered fewer than two choices");
  else {
    if (new Set(geo.widths).size !== 1) fail(`the choices are different widths (${geo.widths.join(", ")})`);
    if (geo.gaps.some((g) => g < 4)) fail(`the choices are clumped together (gaps ${geo.gaps.join(", ")}px)`);
    if (!failures.length) ok("the scene picker reads as tiles: one width, real gaps");
  }
  await ctx.close();
}

// 8c. the sequence of play: what each screen offers, and when
{
  const { ctx, page, errors } = await newPage();
  const patch = async (src) => {
    await page.evaluate((code) => {
      const s = JSON.parse(localStorage.getItem("citr:v1"));
      // eslint-disable-next-line no-eval
      eval(code)(s.careers[s.activeId]);
      localStorage.setItem("citr:v1", JSON.stringify(s));
    }, src);
    await page.reload();
  };

  // Mid-scene the premise stays readable and its numbers fold away; between
  // scenes the whole block is a card again.
  await seed(page, base, "mid-session");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(180);
  // Mid-scene the premise sits on the case strip, whole in the text and
  // leading to the mystery sheet; the numbers it used to carry are on the desk.
  const folded = await page.evaluate(() => {
    const strip = document.querySelector('#screen a.case-strip[href="#/case-sheet"] .premise');
    return { premise: strip ? strip.textContent.trim().length : 0, desk: document.querySelectorAll("#screen .desk .desk-item").length };
  });
  if (!folded.premise) fail("mid-scene the premise is not on the page at all");
  if (folded.desk !== 4) fail("mid-scene the case's numbers are not on the desk");

  await patch("(c) => { c.mystery.scene = null; c.mystery.threats = []; }");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(180);
  const premise = await page.evaluate(() => /It happened at/.test(document.querySelector("#screen .case-strip .premise")?.textContent || ""));
  if (!premise) fail("between scenes the premise is not shown in full");

  // A scene the rules do not allow says so before it is tapped.
  await patch("(c) => { c.mystery.scene = null; c.mystery.clueSets = {}; c.investigator = null; }");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(180);
  const truth = await page.evaluate(() => {
    const n = [...document.querySelectorAll("#screen .choice")].find((x) => /^Truth$/.test(x.querySelector(".choice-label").textContent));
    return n ? { disabled: n.getAttribute("aria-disabled"), note: n.querySelector(".choice-note").textContent } : null;
  });
  if (!truth) fail("the picker has no Truth choice");
  else if (truth.disabled !== "true") fail("a truth scene with no clue set is offered as if it were legal");
  else if (!/clue set/i.test(truth.note)) fail(`the blocked truth scene does not say why ("${truth.note}")`);

  // The Clues tab plays the truth scene instead of pointing at another screen.
  await seed(page, base, "mid-session");
  await patch("(c) => { c.mystery.scene = null; c.mystery.threats = []; }");
  await page.goto(`${base}#/clues`);
  await page.waitForTimeout(180);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("citr:v1")).careers.c1.mystery.truthRevealed.length);
  await page.locator(".action-bar .btn").click();
  await page.waitForTimeout(250);
  const chooser = await page.locator(".modal-title").innerText().catch(() => "");
  if (!/establish a truth/i.test(chooser)) fail(`the Clues action did not start a truth scene (saw "${chooser}")`);
  else {
    await page.locator(".modal-overlay .choice").first().click();
    await page.waitForTimeout(200);
    for (let i = 0; i < 3; i++) {
      const act = page.locator(".modal-actions .btn").first();
      if (!(await act.count())) break;
      await act.click();
      await page.waitForTimeout(120);
    }
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("citr:v1")).careers.c1.mystery.truthRevealed.length);
    if (!(after > before)) fail("the truth scene played from Clues revealed nothing");
  }

  // Careers ends where the book ends: the next mystery.
  await seed(page, base, "mid-session");
  await patch("(c) => { c.mystery = null; }");
  await page.goto(`${base}#/careers`);
  await page.waitForTimeout(180);
  const careersAction = await page.locator(".action-bar .btn").innerText().catch(() => "");
  if (!/next mystery/i.test(careersAction)) fail(`Careers does not offer the next mystery (saw "${careersAction.split("\n")[0]}")`);

  // Destructive controls sit at the end of the scroll.
  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(180);
  const lastSection = await page.evaluate(() => {
    const titles = [...document.querySelectorAll("#screen .card-title")].map((n) => n.textContent.trim());
    return titles[titles.length - 1];
  });
  if (!/start over/i.test(lastSection)) fail(`Settings does not end with the destructive section (ends with "${lastSection}")`);

  if (errors.length) fail(`console error during the sequence checks: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok("each screen offers what the sequence of play calls for next");
  await ctx.close();
}

// 8d. a scene you have ended hands the next one back
// The stall this catches: endScene() left the finished scene in place, so the
// play screen stayed on "This scene is finished" for good — the only control
// was "End the scene", which marked the clock again every time it was pressed
// and never offered another scene. The state here is played into existence
// through the UI rather than written by hand, because the bug was in the route
// to the state, not in the state.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(200);

  const clearDialogs = async () => {
    for (let j = 0; j < 8; j++) {
      await page.waitForSelector(".modal-overlay", { timeout: 900 }).catch(() => {});
      const ch = page.locator(".modal-overlay .choice").first();
      const input = page.locator(".modal-overlay .input").first();
      const act = page.locator(".modal-actions .btn").first();
      if (await ch.count()) await ch.click();
      else if (await input.count()) { await input.fill("A line written at the table."); await act.click(); }
      else if (await act.count()) await act.click();
      else return;
      await page.waitForTimeout(70);
    }
  };
  const barLabel = async () => {
    const bar = page.locator(".action-bar .btn");
    return (await bar.count()) ? (await bar.innerText()).split("\n")[0].trim() : "";
  };
  const clockNow = () => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    return (c.investigators.find((i) => i.id === c.activeInvestigatorId) || c.investigators[0]).clock;
  });

  // Play the investigation out, however the dice go.
  let label = "";
  for (let i = 0; i < 40; i++) {
    label = await barLabel();
    if (!label || /^End the scene|^Resolve the mystery/.test(label)) break;
    await page.locator(".action-bar .btn").click();
    await clearDialogs();
  }

  if (/^Resolve the mystery/.test(label)) {
    ok("the mystery ended inside the scene; the next-scene check does not apply this run");
  } else if (!/^End the scene/.test(label)) {
    fail(`a finished scene offered "${label}" instead of a way to end it`);
  } else {
    const before = await clockNow();
    const hadFailed = failures.length;
    await page.locator(".action-bar .btn").click();
    await clearDialogs();
    await page.waitForTimeout(150);

    const after = await barLabel();
    const screen = await page.locator("#screen").innerText();
    const choices = await page.locator("#screen .choice-list .choice").count();
    const clock = await clockNow();

    if (/^End the scene/.test(after)) fail(`after ending a scene the play screen still offers "${after}" — the same scene can be ended again`);
    if (/this scene is finished/i.test(screen)) fail('after ending a scene the play screen still says "This scene is finished"');
    if (!/choose a scene/i.test(screen)) fail("after ending a scene the play screen never offers the next one");
    if (choices !== 4) fail(`the scene picker came back with ${choices} scene(s) instead of four`);
    if (clock !== before + 1 && clock !== 0) fail(`ending one scene moved the clock from ${before} to ${clock}`);
    if (errors.length) fail(`console error while ending a scene: ${errors[0].slice(0, 120)}`);
    if (failures.length === hadFailed) ok("ending a scene hands back the picker, and marks the clock exactly once");
  }
  await ctx.close();
}

// 8e. the re-roll keyword cannot be paid for out of the test it is re-rolling
// A failure hands you a keyword. The re-roll undoes the test — which takes that
// keyword back — so offering it as payment threw and swallowed the test whole.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session", { manualDice: true, sceneFraming: false });
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(200);

  const held = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    const inv = c.investigators.find((i) => i.id === c.activeInvestigatorId);
    return inv.keywords.filter((k) => !k.struck).map((k) => k.text);
  });

  // Fail the stage test on purpose: two ones is a failure at any attribute.
  await page.locator(".action-bar .btn").click();
  let offered = false;
  for (let i = 0; i < 14; i++) {
    await page.waitForSelector(".modal-overlay", { timeout: 1200 }).catch(() => {});
    if (await page.locator(".modal-actions .btn", { hasText: "Re-roll with a keyword" }).count()) { offered = true; break; }
    const title = await page.locator(".modal-title").first().innerText().catch(() => "");
    const input = page.locator(".modal-overlay .input").first();
    const ch = page.locator(".modal-overlay .choice").first();
    const act = page.locator(".modal-actions .btn").first();
    const dicePick = page.locator(".modal-overlay .dice-pick");
    if (await dicePick.count()) {
      // Dice are tapped, not typed: one face per row, and the dialog closes itself.
      const want = /Enter your dice/i.test(title) ? [1, 1] : [1];
      for (let r = 0; r < want.length; r++) await dicePick.nth(r).locator(`.die-choice[data-face='${want[r]}']`).click();
    } else if (await input.count()) {
      await input.fill("A line written at the table.");
      await act.click();
    } else if (await ch.count()) await ch.click();
    else if (await act.count()) await act.click();
    else break;
    await page.waitForTimeout(80);
  }

  if (!offered) fail("a failed test never offered the re-roll keyword, so the check could not run");
  else {
    const gained = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("citr:v1"));
      const c = s.careers[s.activeId];
      const inv = c.investigators.find((i) => i.id === c.activeInvestigatorId);
      return inv.keywords.filter((k) => !k.struck).map((k) => k.text);
    });
    if (gained.length <= held.length) fail("the failed test did not hand over a keyword, so the check could not run");

    await page.locator(".modal-actions .btn", { hasText: "Re-roll with a keyword" }).click();
    await page.waitForTimeout(220);
    const options = await page.locator(".modal-overlay .choice .choice-label").allInnerTexts();
    const fromThisTest = options.filter((o) => !held.includes(o.trim()));
    if (fromThisTest.length) fail(`the re-roll offers ${fromThisTest.map((o) => `"${o}"`).join(", ")} — a keyword this very test handed over`);
    if (!options.length) fail("the re-roll was offered with no keyword to spend");

    if (options.length) {
      await page.locator(".modal-overlay .choice").first().click();
      for (let i = 0; i < 12; i++) {
        await page.waitForSelector(".modal-overlay", { timeout: 900 }).catch(() => {});
        const title = await page.locator(".modal-title").first().innerText().catch(() => "");
        const input = page.locator(".modal-overlay .input").first();
        const ch = page.locator(".modal-overlay .choice").first();
        const act = page.locator(".modal-actions .btn").first();
        const dicePick = page.locator(".modal-overlay .dice-pick");
        if (await dicePick.count()) {
          // Dice are tapped, not typed: one face per row, and the dialog closes itself.
          const want = /Enter your dice/i.test(title) ? [6, 6] : [1];
          for (let r = 0; r < want.length; r++) await dicePick.nth(r).locator(`.die-choice[data-face='${want[r]}']`).click();
        } else if (await input.count()) {
          await input.fill("A line written at the table.");
          await act.click();
        } else if (await ch.count()) await ch.click();
        else if (await act.count()) await act.click();
        else break;
        await page.waitForTimeout(80);
      }
      const spent = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("citr:v1"));
        const c = s.careers[s.activeId];
        const inv = c.investigators.find((i) => i.id === c.activeInvestigatorId);
        return inv.keywords.filter((k) => k.struck).length;
      });
      if (!spent) fail("the re-roll ran but struck no keyword");
    }
    if (errors.length) fail(`console error during the re-roll: ${errors[0].slice(0, 160)}`);
    ok("a keyword the failure just handed you cannot pay for that test's re-roll");
  }
  await ctx.close();
}

// 8f. a spent investigator can still get out of the scene
// Three full fatigue tracks in one scene strike all three attributes. The app
// said "They need to rest before testing anything else" and then offered no
// rest: rest is a scene, the scene will not end without a test, and there is no
// test left to make. The session had nowhere to go (ruling A22).
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    const inv = c.investigators.find((i) => i.id === c.activeInvestigatorId);
    inv.struck = { power: true, insight: true, method: true };
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.goto(`${base}#/play`);
  await page.reload();
  await page.waitForTimeout(250);

  await page.locator(".action-bar .btn").click();   // the stage test
  await page.waitForSelector(".modal-overlay", { timeout: 1500 }).catch(() => {});
  const title = await page.locator(".modal-title").first().innerText().catch(() => "");
  if (!/nothing left to try/i.test(title)) fail(`a spent investigator got "${title}" instead of being told there is nothing to try`);
  const outs = await page.locator(".modal-actions .btn").allInnerTexts();
  if (!outs.some((t) => /leave the scene/i.test(t))) {
    fail(`"Nothing left to try" offers only ${outs.map((t) => `"${t.trim()}"`).join(", ")} — no way out of the scene`);
    await page.locator(".modal-actions .btn").last().click();
  } else {
    await page.locator(".modal-actions .btn", { hasText: "Leave the scene" }).click();
    await page.waitForTimeout(250);
    const label = await page.locator(".action-bar .btn").innerText().catch(() => "");
    if (!/End the scene/.test(label.split("\n")[0])) fail(`leaving a scene spent offered "${label.split("\n")[0]}" instead of ending it`);
    await page.locator(".action-bar .btn").click();
    for (let i = 0; i < 8; i++) {
      const act = page.locator(".modal-actions .btn").first();
      const ch = page.locator(".modal-overlay .choice").first();
      if (await ch.count()) await ch.click();
      else if (await act.count()) await act.click();
      else break;
      await page.waitForTimeout(80);
    }
    const screen = await page.locator("#screen").innerText();
    if (!/choose a scene/i.test(screen)) fail("after leaving a scene spent, the picker never came back");
    const rest = page.locator("#screen .choice", { hasText: "Rest" }).first();
    if (!(await rest.count())) fail("the rest the app asked for is not on the picker");
    else if (await rest.getAttribute("aria-disabled")) fail("the rest the app asked for is offered but dimmed");
    if (errors.length) fail(`console error while leaving a scene spent: ${errors[0].slice(0, 140)}`);
    if (!failures.length) ok("a spent investigator can leave the scene and take the rest the app asked for");
  }
  await ctx.close();
}

// 8g. the record, and the comparison, add up
// attributeTest never returned the attribute it had just added, so the journal
// line and the re-roll comparison both printed the bare dice against the real
// total: "1+2 = 4". The result dialog looked right only because the play screen
// patched the number back in on its way to the modal. The journal outlives the
// session; every test line in it was arithmetic that does not work.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(200);

  await page.locator(".action-bar .btn").click();
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector(".modal-overlay", { timeout: 1000 }).catch(() => {});
    if (await page.locator(".modal-actions .btn", { hasText: "Re-roll with a keyword" }).count()) break;
    const input = page.locator(".modal-overlay .input").first();
    const ch = page.locator(".modal-overlay .choice").first();
    const act = page.locator(".modal-actions .btn").first();
    if (await input.count()) { await input.fill("A line written at the table."); await act.click(); }
    else if (await ch.count()) await ch.click();
    else if (await act.count()) await act.click();
    else break;
    await page.waitForTimeout(70);
  }

  // The record that outlives the session, read before the re-roll undoes it.
  const tests = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    // Only the lines this run wrote: the fixture ships prose under the same kind.
    return (c.journal || []).filter((e) => e.kind === "test" && /:\s*\d/.test(e.text)).map((e) => e.text);
  });
  if (!tests.length) fail("no test reached the journal, so the record could not be checked");
  for (const line of tests) {
    const m = line.match(/((?:\d+\+)+\d+)\s*=\s*(\d+)/);
    if (!m) { fail(`a journal test line has no sum in it: "${line}"`); continue; }
    const sum = m[1].split("+").reduce((a, b) => a + Number(b), 0);
    if (sum !== Number(m[2])) fail(`the journal records "${line.trim()}" — ${m[1]} is ${sum}, not ${m[2]}`);
  }

  // The comparison a player decides on: both sums must be the sums they claim.
  const compare = async () => {
    if (!(await page.locator(".modal-actions .btn", { hasText: "Re-roll with a keyword" }).count())) return [];
    await page.locator(".modal-actions .btn", { hasText: "Re-roll with a keyword" }).click();
    await page.waitForTimeout(200);
    if (await page.locator(".modal-overlay .choice").count()) await page.locator(".modal-overlay .choice").first().click();
    await page.waitForTimeout(250);
    const lines = await page.locator(".modal-overlay .choice-label").allInnerTexts();
    return lines;
  };
  const lines = await compare();
  for (const line of lines) {
    const m = line.match(/((?:\d+\s*\+\s*)+\d+)\s*=\s*(\d+)/);
    if (!m) continue;
    const sum = m[1].split("+").reduce((a, b) => a + Number(b.trim()), 0);
    if (sum !== Number(m[2])) fail(`the outcome you are asked to choose between reads "${line.split("\n")[0]}" — ${m[1]} is ${sum}, not ${m[2]}`);
  }

  if (errors.length) fail(`console error while checking the record: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok("the journal and the re-roll comparison print sums that add up");
  await ctx.close();
}

// 8h. a scene played inside a dialog still gets the book's two questions
// Rest and obligation scenes printed "Where is this scene taking place? Who is
// here, and what are they doing?" and then offered nothing but Done: no field,
// no oracle, and nothing reaching the journal. The app asked and did not listen.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session", { sceneFraming: true });
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(200);
  // Leave the investigation the fixture is in, so the picker is reachable.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    s.careers[s.activeId].mystery.scene = null;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.waitForTimeout(250);

  for (const which of ["Rest", "Obligation"]) {
    await page.goto(`${base}#/play`);
    await page.waitForTimeout(200);
    // A finished scene has to be ended before the picker comes back.
    const bar = page.locator(".action-bar .btn");
    if ((await bar.count()) && /^End the scene/.test((await bar.innerText()).split("\n")[0])) {
      await bar.click();
      for (let i = 0; i < 6; i++) {
        const a = page.locator(".modal-actions .btn").first();
        const c2 = page.locator(".modal-overlay .choice").first();
        if (await c2.count()) await c2.click(); else if (await a.count()) await a.click(); else break;
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(150);
    }
    const choice = page.locator("#screen .choice", { has: page.locator(".choice-label", { hasText: new RegExp(`^${which}$`) }) }).first();
    if (!(await choice.count())) { fail(`${which} is not on the picker, so the framing check could not run`); continue; }
    await choice.click();
    await page.waitForTimeout(250);
    if (await page.locator(".modal-overlay .choice").count()) { await page.locator(".modal-overlay .choice").first().click(); await page.waitForTimeout(250); }

    const body = await page.locator(".modal-body").innerText().catch(() => "");
    if (!/where is this scene taking place/i.test(body)) { fail(`the ${which.toLowerCase()} scene never asks where it takes place`); continue; }
    const actions = await page.locator(".modal-actions .btn").allInnerTexts();
    const canWrite = actions.some((a) => /write it down/i.test(a));
    const canAsk = await page.locator(".modal-body .btn", { hasText: "Ask the oracle" }).count();
    if (!canWrite) fail(`the ${which.toLowerCase()} scene asks the two questions and offers only ${actions.map((a) => `"${a.trim()}"`).join(", ")}`);
    if (!canAsk) fail(`the ${which.toLowerCase()} scene asks the two questions with no oracle to hand`);
    if (!canWrite) { await page.locator(".modal-actions .btn").last().click(); await page.waitForTimeout(150); continue; }

    await page.locator(".modal-actions .btn", { hasText: "Write it down" }).click();
    await page.waitForTimeout(250);
    const field = page.locator(".modal-overlay .input").first();
    if (!(await field.count())) { fail(`"Write it down" in the ${which.toLowerCase()} scene opens no field`); continue; }
    const line = `The ${which.toLowerCase()} scene, set at the table.`;
    await field.fill(line);
    await page.locator(".modal-actions .btn").first().click();
    await page.waitForTimeout(250);
    const kept = await page.evaluate((t) => {
      const s = JSON.parse(localStorage.getItem("citr:v1"));
      return (s.careers[s.activeId].journal || []).some((e) => e.text === t);
    }, line);
    if (!kept) fail(`what was written for the ${which.toLowerCase()} scene never reached the journal`);
  }
  if (errors.length) fail(`console error while setting a dialog scene: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok("a rest or obligation scene can be set, asked about, and written down");
  await ctx.close();
}

// 8i. the guide: a first-timer is never left wondering what to press
// The app was correct and said almost nothing: the sequence of play lived in a
// tutorial you had to go and read. The guide sits above every screen, names the
// real control rather than growing a duplicate of it, and changes with state.
{
  const { ctx, page, errors } = await newPage();
  await withSeed(page, false);

  // A blank app: one button that deals you in, and nothing to decide first.
  // Three panels and one button; the panels already say what the guide would.
  if ((await page.locator("#screen .intro-panel").count()) !== 3) fail("a blank app does not speak to someone who has never played");
  const first = await page.locator(".action-bar .btn").innerText();
  if (!/start playing/i.test(first)) fail(`a blank app offers "${first.split("\n")[0]}" instead of a way straight in`);
  if (await page.locator(".coach:not(.compact)").count()) fail("the guide repeats at length on the first screen what its three panels already say");
  if (!/start playing/i.test(await page.locator(".coach-line").first().innerText().catch(() => ""))) fail("the guide's line on a blank app does not name Start playing");

  await page.locator(".action-bar .btn").click();
  await page.waitForTimeout(400);
  const dealt = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1") || "{}");
    const c = s.careers && s.activeId ? s.careers[s.activeId] : null;
    if (!c) return null;
    const inv = c.investigators[0], m = c.mystery;
    return {
      name: inv.name, trait: inv.trait, attrs: Object.values(inv.attributes).sort(),
      obligations: inv.obligations.length, signature: inv.keywords.filter((k) => k.signature).length,
      deck: m ? m.clueDeck.length : 0, truth: m ? m.truthDeck.length : 0, aside: m ? m.setAside.length : 0,
      problem: m ? [m.location, m.object, m.treachery].every(Boolean) : false,
    };
  });
  if (!dealt) fail("Start playing left no career behind");
  else {
    if (!dealt.name || !dealt.trait) fail("Start playing dealt an investigator with no name or trait");
    if (String(dealt.attrs) !== "0,1,2") fail(`Start playing spread the attributes as ${dealt.attrs} instead of 2/1/0`);
    if (dealt.obligations !== 1 || dealt.signature !== 1) fail("Start playing skipped the obligation or the signature keyword");
    if (!dealt.problem) fail("Start playing dealt no problem");
    if (dealt.deck !== 42 || dealt.aside !== 3) fail(`Start playing built a ${dealt.deck}-card clue deck and set ${dealt.aside} aside`);
  }
  await page.locator(".modal-actions .btn").first().click();   // play the first scene
  await page.waitForTimeout(300);

  // In play, the guide names the button that is actually on the screen.
  await openGuide(page);
  const sayHere = await page.locator(".coach-say").innerText();
  const here = await page.locator(".coach-here").count();
  const bar = (await page.locator(".action-bar .btn").innerText()).split("\n")[0].trim();
  if (!here) fail(`on the screen the guide points at, it still offers to navigate: "${sayHere}"`);
  else {
    const named = await page.locator(".coach-here").innerText();
    const quoted = (named.match(/\u201c([^\u201d]+)\u201d/) || [])[1];
    if (!quoted) fail(`the guide does not name a control: "${named}"`);
    else if (!bar.startsWith(quoted)) fail(`the guide says press "${quoted}" but the button reads "${bar}"`);
  }
  if (await page.locator(".coach .btn", { hasText: /^Go:/ }).count()) fail("the guide grew a second button for a control already on the screen");

  // Why? answers for the moment you are in, and names the ways the case ends.
  await openGuide(page);
  await page.locator(".coach .btn", { hasText: "Why?" }).click();
  await page.waitForTimeout(250);
  const sheet = await page.locator(".modal-body").innerText();
  if (!/how this ends/i.test(sheet)) fail("the guide never says how the case can end");
  if (!/clue cards left|never seen/i.test(sheet)) fail("the guide never says how close the ending is");
  await page.locator(".modal-actions .btn").first().click();
  await page.waitForTimeout(150);

  // It tracks state: a spent investigator is told to rest, in the guide's own voice.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    const inv = c.investigators[0];
    inv.fatigue = 4;
    c.mystery.scene = null;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(300);
  await openGuide(page);
  const tired = await page.locator(".coach-say").innerText();
  if (!/rest/i.test(tired)) fail(`at 4 of 5 fatigue the guide says "${tired}" instead of telling you to rest`);
  if (!(await page.locator(".coach.warn").count())) fail("the guide does not mark an urgent step as urgent");

  // And it can be turned off.
  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(200);
  const toggle = page.locator("#screen .opt", { hasText: "Guide me" }).first();
  if (!(await toggle.count())) fail("the guide has no setting");
  else {
    await toggle.evaluate((n) => n.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(150);
    await toggle.locator(".switch-track").click();
    await page.goto(`${base}#/play`);
    await page.waitForTimeout(250);
    if (await page.locator(".coach").count()) fail("turning the guide off leaves it on the screen");
    await page.goto(`${base}#/settings`);
    await page.waitForTimeout(200);
    const guideRow = page.locator("#screen .opt", { hasText: "Guide me" }).first();
    if (!(await guideRow.locator("input").isChecked())) {
      await guideRow.evaluate((n) => n.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(150);
      await guideRow.locator(".switch-track").click();
    }
  }
  if (errors.length) fail(`console error around the guide: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the guide deals you in, names the real button, and changes with the state");
  await ctx.close();
}

// 8j. the game's own half of the conversation is kept
// Every oracle result was shown once in a dialog or a DOM node and then thrown
// away: the framing card's words, the doubles event, the day's event, the clue
// prompt behind a description you skipped. In a game that is a player asking
// and the game answering, the record held only one side of it.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session", { sceneFraming: true, autoOracle: true });
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(250);

  const oracles = () => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    return (s.careers[s.activeId].journal || []).filter((e) => e.kind === "oracle").map((e) => e.text);
  });
  const before = (await oracles()).length;

  // The framing card is one folded line on the Table; open it to ask.
  const fold = page.locator("#screen details.framing:not([open]) > summary");
  if (await fold.count()) { await fold.first().click(); await page.waitForTimeout(80); }
  const askBtn = page.locator("#screen .btn", { hasText: "Ask the oracle" }).first();
  if (!(await askBtn.count())) fail("no oracle to hand inside a scene");
  else {
    await askBtn.click();
    await page.waitForTimeout(200);
    const after = await oracles();
    if (after.length <= before) fail("the oracle answered and the record never heard it");
    else {
      const shown = await page.locator("#screen .framing .mono").first().innerText();
      const words = shown.split("\u00b7").map((w) => w.trim()).filter(Boolean);
      const kept = after[after.length - 1];
      if (!words.every((w) => kept.includes(w))) fail(`the oracle said "${shown}" and the record kept "${kept}"`);
    }
  }

  // The Oracles screen keeps what it rolls while a case is live.
  await page.goto(`${base}#/oracle`);
  await page.waitForTimeout(200);
  const n1 = (await oracles()).length;
  await page.locator("#screen .btn", { hasText: "Ask" }).first().click();
  await page.waitForTimeout(200);
  if ((await oracles()).length <= n1) fail("an oracle rolled during a case never reached the record");

  // A clue prompt survives a description you did not write.
  const prompted = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const m = s.careers[s.activeId].mystery;
    const set = Object.values(m.clueSets)[0];
    set.description = ""; set.entries = []; set.prompts = ["Incongruous object \u2014 Trick \u00b7 Sleepy"];
    localStorage.setItem("citr:v1", JSON.stringify(s));
    return set.rank;
  });
  await page.goto(`${base}#/clues`);
  await page.reload();
  await page.waitForTimeout(300);
  const cluesText = await page.locator("#screen").innerText();
  if (!/the prompts were/i.test(cluesText)) fail(`a clue set with no description shows nothing of the prompt it was given (rank ${prompted})`);

  if (errors.length) fail(`console error around the record: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("what the game says is kept, not just what you type");
  await ctx.close();
}

// 8k. picking the case up again, and reading it back
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");
  // A case you have actually written in.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    c.journal.push({ id: "n1", ts: Date.now(), kind: "note", text: "She went back to the flat with the code.", day: 2 });
    c.journal.push({ id: "n2", ts: Date.now(), kind: "oracle", text: "Asked the oracle: Support \u00b7 Redundant \u00b7 Risk", day: 2 });
    c.journal.push({ id: "n3", ts: Date.now(), kind: "scene", text: "Scene ended.", day: 2 });
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.goto(`${base}#/home`);
  await page.reload();
  await page.waitForTimeout(300);
  const home = await page.locator("#screen").innerText();
  if (!/where you left off/i.test(home)) fail("coming back to a case in progress, nothing says where you left off");
  await page.locator("#screen details.recap summary").click();
  await page.waitForTimeout(150);
  const recap = await page.locator("#screen details.recap").innerText();
  if (!/went back to the flat/.test(recap)) fail("the recap does not carry what actually happened");
  if (/Scene ended\./.test(recap)) fail("the recap is padded with machinery instead of the story");

  // The journal reads as a story, oldest first, and saves as a file.
  await page.goto(`${base}#/journal`);
  await page.waitForTimeout(250);
  const storyLines = await page.locator("#screen .story-line").allInnerTexts();
  if (!storyLines.length) fail("the journal has no story view");
  else {
    const first = storyLines.findIndex((t) => /went back to the flat/.test(t));
    const last = storyLines.length - 1;
    if (first < 0) fail("the story view drops what was written");
    else if (first !== last) fail("the story does not read oldest first");
  }
  const all = await page.locator("#screen").innerText();
  if (/Scene ended\./.test(all)) fail("the story view shows the machinery it is meant to leave out");
  if (!(await page.locator("#screen .btn", { hasText: "Save the story as text" }).count())) fail("the story cannot be taken out of the app");

  // The cast: a labelled house aid, and it persists.
  if (!/house aid/i.test(all)) fail("the cast list is not labelled as a house aid");
  await page.locator("#screen .btn", { hasText: "Add someone" }).click();
  await page.waitForTimeout(200);
  await page.locator(".modal-overlay .input").fill("The night supervisor");
  await page.locator(".modal-actions .btn").first().click();
  await page.waitForTimeout(200);
  await page.locator(".modal-overlay .input").fill("Let her walk out with the file.");
  await page.locator(".modal-actions .btn").first().click();
  await page.waitForTimeout(250);
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    return (s.careers[s.activeId].cast || []).map((p) => p.name);
  });
  if (!saved.includes("The night supervisor")) fail("somebody added to the cast is not remembered");

  // Undo says how far back it goes.
  const title = await page.locator("#undo-btn").getAttribute("title");
  if (!/steps? back available/.test(title || "")) fail(`the undo button says "${title}" and never admits the stack is deeper than one`);

  if (errors.length) fail(`console error picking the case up: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("you can pick the case up, read it back, keep a cast, and see how far undo goes");
  await ctx.close();
}

// 8l. the template's own rules, closed (§2.2, §14.1)
// House aids must carry the flag and label themselves from it, and the roll a
// player makes over and over should not cost two choosers every time.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session", { safetyFilter: true });

  // Both aids name themselves, from the one file that holds the flag.
  const flagged = await page.evaluate(async () => {
    const mod = await import("../data-house.js");
    return { flag: mod.HOUSE_AID, ids: Object.keys(mod.HOUSE_AIDS) };
  });
  if (flagged.flag !== true) fail("the house-aid file does not export HOUSE_AID = true");
  if (!flagged.ids.includes("contentFilter") || !flagged.ids.includes("cast")) fail(`the house-aid file knows ${flagged.ids.join(", ")}`);

  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(250);
  await page.locator("#screen details.settings-more > summary").click();
  const settings = await page.locator("#screen").innerText();
  if (!/content filter\s*\u00b7\s*house aid/i.test(settings)) fail("the content filter does not label itself a house aid");
  await page.goto(`${base}#/journal`);
  await page.waitForTimeout(250);
  const journal = await page.locator("#screen").innerText();
  if (!/people and places\s*\u00b7\s*house aid/i.test(journal)) fail("the cast list does not label itself a house aid");

  // A failed stage test offers the same test again, and taking it rolls.
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(250);
  let tried = false;
  for (let i = 0; i < 24; i++) {
    const bar = page.locator(".action-bar .btn");
    if (!(await bar.count())) break;
    const label = (await bar.innerText()).split("\n")[0];
    if (/^End the scene|^Resolve the mystery|^Investigation scene/.test(label)) break;
    await bar.click();
    for (let j = 0; j < 8; j++) {
      await page.waitForSelector(".modal-overlay", { timeout: 900 }).catch(() => {});
      const again = page.locator(".modal-actions .btn", { hasText: "Try it again" });
      if (await again.count()) {
        const outcome = await page.locator(".modal-body .outcome").innerText().catch(() => "");
        if (!/failure/i.test(outcome)) fail(`"Try it again" was offered on a ${outcome.split("\u2014")[0].trim()}, where the stage has already moved on`);
        const before = await page.evaluate(() => {
          const s = JSON.parse(localStorage.getItem("citr:v1"));
          return s.careers[s.activeId].rollLog.length;
        });
        await again.click();
        // The retry opens the same chain any test does (a gained keyword, a
        // consequence); the roll is only committed once that chain clears.
        for (let k = 0; k < 10; k++) {
          await page.waitForSelector(".modal-overlay", { timeout: 900 }).catch(() => {});
          const inp = page.locator(".modal-overlay .input").first();
          const c3 = page.locator(".modal-overlay .choice").first();
          const a3 = page.locator(".modal-actions .btn").first();
          if (await inp.count()) { await inp.fill("A line at the table."); await a3.click(); }
          else if (await c3.count()) await c3.click();
          else if (await a3.count()) await a3.click();
          else break;
          await page.waitForTimeout(80);
        }
        await page.waitForTimeout(250);
        const after = await page.evaluate(() => {
          const s = JSON.parse(localStorage.getItem("citr:v1"));
          return s.careers[s.activeId].rollLog.length;
        });
        if (after <= before) fail('"Try it again" did not roll anything');
        tried = true;
        break;
      }
      const ch = page.locator(".modal-overlay .choice").first();
      const input = page.locator(".modal-overlay .input").first();
      const act = page.locator(".modal-actions .btn").first();
      if (await input.count()) { await input.fill("A line at the table."); await act.click(); }
      else if (await ch.count()) await ch.click();
      else if (await act.count()) await act.click();
      else break;
      await page.waitForTimeout(70);
    }
    if (tried) break;
  }
  if (!tried) ok("no stage test failed this run, so the repeat affordance did not come up");
  if (errors.length) fail(`console error around the house aids: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("house aids carry the flag and say so; a failed stage test can be retried in one tap");
  await ctx.close();
}

// 8m. play begins with an investigation scene (Ch.1, Game setup, step 6)
// Setup's last step is a rule, and it was the one rule in the book with no
// control behind it: a fresh mystery let you open on a rest.
{
  const { ctx, page, errors } = await newPage();
  await withSeed(page, false);
  await page.locator(".action-bar .btn").click();   // Start playing
  await page.waitForTimeout(450);
  await page.locator(".modal-actions .btn").first().click();
  await page.waitForTimeout(350);

  const first = await page.locator("#screen .choice").allInnerTexts();
  const dimmed = await page.evaluate(() => [...document.querySelectorAll("#screen .choice")]
    .map((n) => ({ label: n.innerText.split("\n")[0].trim(), barred: n.getAttribute("aria-disabled") === "true" })));
  const investigation = dimmed.find((d) => /^Investigation/.test(d.label));
  if (!investigation || investigation.barred) fail("the first scene of a mystery cannot be an investigation");
  for (const d of dimmed.filter((x) => !/^Investigation/.test(x.label))) {
    if (!d.barred) fail(`a fresh mystery offers "${d.label}" as its first scene; the book begins play with an investigation`);
  }
  if (first.length !== 4) fail(`the picker shows ${first.length} scene types`);

  // And it stops being a gate the moment a scene has been played.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    s.careers[s.activeId].mystery.scenesPlayed = 1;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(300);
  const later = await page.evaluate(() => [...document.querySelectorAll("#screen .choice")]
    .map((n) => ({ label: n.innerText.split("\n")[0].trim(), barred: n.getAttribute("aria-disabled") === "true" })));
  const rest = later.find((d) => /^Rest/.test(d.label));
  if (!rest || rest.barred) fail("after the first scene, a rest is still refused");

  // A save from before the counter existed is read from what it has done.
  const migrated = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const m = s.careers[s.activeId].mystery;
    delete m.scenesPlayed;
    m.clueSets = { "7": { rank: "7", cards: [{ id: "7S", rank: "7", suit: "S" }], entries: [], description: "", truth: false, falseLead: false, truthCards: [] } };
    localStorage.setItem("citr:v1", JSON.stringify(s));
    return true;
  });
  void migrated;
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(350);
  // Asserted through the picker, not through storage: a back-fill lands in
  // memory at load and only reaches localStorage on the next write, so reading
  // the key back would test when the app saves rather than what it decided.
  const afterMigration = await page.evaluate(() => [...document.querySelectorAll("#screen .choice")]
    .map((n) => ({ label: n.innerText.split("\n")[0].trim(), barred: n.getAttribute("aria-disabled") === "true" })));
  const restAgain = afterMigration.find((d) => /^Rest/.test(d.label));
  if (!restAgain) fail("the picker vanished after migrating a save with no scene counter");
  else if (restAgain.barred) fail("a save that already holds a clue set was migrated as if the mystery had not started, and is gated to an investigation");

  if (errors.length) fail(`console error around the first scene: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("play begins with an investigation, and only the first one");
  await ctx.close();
}

// 8n. the subject oracle pairs the words the book pairs (Ch.4)
// "Roll 1d66 on the first two tables. If you want more detail, roll on the
// third as well." The first two are action and descriptor; focus is the third.
// The app rolled action and focus for two words and held the descriptor back,
// so a two-word answer read as a verb and a noun rather than a verb and an
// adjective — an answer where the book gives a prompt.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session");
  const shape = await page.evaluate(async () => {
    const R = await import("../src/rules.js");
    const two = R.rollSubject(false), three = R.rollSubject(true);
    return {
      two: Object.keys(two).sort(), three: Object.keys(three).sort(),
      twoWords: R.subjectWords(two).length, threeWords: R.subjectWords(three).length,
    };
  });
  if (String(shape.two) !== "action,descriptor") fail(`two words come from ${shape.two.join(" + ")}; the book's first two tables are action and descriptor`);
  if (String(shape.three) !== "action,descriptor,focus") fail(`three words come from ${shape.three.join(" + ")}`);
  if (shape.twoWords !== 2 || shape.threeWords !== 3) fail(`the oracle returned ${shape.twoWords} and ${shape.threeWords} words`);
  if (errors.length) fail(`console error in the oracle: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok("the subject oracle pairs action with descriptor, and focus is the third");
  await ctx.close();
}

// 8o. the two sheets: one screen for the mystery, one document for both
// The book prints an investigator sheet and a mystery sheet. Every field of
// both was in the app and the mystery's were spread over three tabs, and
// neither could be printed, handed over, or read on a device without the app.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress", { rivals: true });
  await page.goto(`${base}#/case-sheet`);
  await page.waitForTimeout(350);

  const screen = await page.locator("#screen").innerText();
  for (const want of ["The problem", "Clue sets", "The truth", "Threats", "Rivals", "The decks", "Danger and the scene"]) {
    if (!new RegExp(want, "i").test(screen)) fail(`the mystery sheet is missing "${want}"`);
  }
  // It shows and does not act: every control on it must be navigation or the export.
  // The guide bar belongs to every screen, not to this one, so it is not part
  // of what the mystery sheet offers.
  const acting = await page.evaluate(() => [...document.querySelectorAll("#screen button")]
    .filter((b) => !b.closest(".coach"))
    .map((b) => b.innerText.replace(/\s+/g, " ").trim())
    .filter((t) => t && !/^(What this screen does|Save both sheets)$/.test(t)));
  if (acting.length) fail(`the mystery sheet carries controls that are not a view: ${acting.join(", ")}`);

  // The Table's case strip reaches it, and it leads back to the Table.
  if (!(await page.locator('#screen a.drawer-back[href="#/play"]').count())) fail("the mystery sheet has no way back to the Table");

  // The export produces a real document, with both sheets and no spoilers.
  const html = await page.evaluate(async () => {
    const paper = await import("../src/paper.js");
    const store = (await import("../src/store.js")).Store;
    return paper.sheetsHtml(store.career, store.investigator, store.mystery);
  });
  for (const want of ["investigator", "mystery", "Attributes", "Keywords", "Obligations", "Clue sets", "Threats"]) {
    if (!new RegExp(want, "i").test(html)) fail(`the saved sheets have no "${want}" section`);
  }
  if (!/<!doctype html>/i.test(html)) fail("the saved sheets are not a standalone document");
  if (/<script/i.test(html)) fail("the saved sheets carry script");
  const setAside = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    return s.careers[s.activeId].mystery.setAside.map((c) => `${c.rank}${c.suit}`);
  });
  const leaked = setAside.filter((id) => html.includes(`>${id[0]}`) && html.includes(id));
  if (leaked.length && /set aside/i.test(html.replace(/deliberately not on this sheet/i, "")))
    fail(`the saved sheets name a set-aside card: ${leaked.join(", ")}`);

  // An ended mystery reaches a branch the running one never does.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const m = s.careers[s.activeId].mystery;
    m.ended = true; m.endTrigger = "deck_empty";
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/case-sheet`);
  await page.waitForTimeout(350);
  const ended = await page.locator("#screen").innerText();
  if (!/ends when/i.test(ended)) fail("the mystery sheet does not render once the mystery has ended");
  if (!/clue deck is empty/i.test(ended)) fail("the mystery sheet does not name the trigger that ended it");

  // And the investigator sheet offers it too.
  await page.goto(`${base}#/sheet`);
  await page.waitForTimeout(300);
  if (!(await page.locator("#screen .btn", { hasText: "Save this sheet" }).count())) fail("the investigator sheet cannot be saved from the investigator sheet");

  if (errors.length) fail(`console error around the sheets: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the mystery sheet is one page that only shows, and both sheets save as a document");
  await ctx.close();
}

// 8p. the table is drawn in three dimensions, and can be flattened
// The five things the game draws were flat: a die was a printed face rather
// than a cube that landed on one. Depth is drawn here, not imported — no
// dependency, no build step — and it is one CSS transform away from off,
// for a player who asked for less motion or wants the plain thing.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "mid-session");
  const build = () => page.evaluate(async () => {
    const ui = await import("../src/ui.js");
    const host = document.querySelector("#screen");
    const row = document.createElement("div");
    row.className = "dice"; row.id = "probe-dice";
    document.querySelector("#probe-dice")?.remove();
    row.appendChild(ui.dieFace(4));
    host.appendChild(row);
  });
  const read = () => page.evaluate(() => {
    const die = document.querySelector("#probe-dice .die");
    const cube = die.querySelector(".cube");
    const faces = [...die.querySelectorAll(".face")];
    const shown = faces.filter((f) => getComputedStyle(f).display !== "none");
    const tumble = die.querySelector(".tumble");
    return {
      label: die.getAttribute("aria-label"),
      faces: faces.length,
      landed: cube ? cube.getAttribute("data-face") : null,
      transform: cube ? getComputedStyle(cube).transform : "none",
      shown: shown.map((f) => f.className.trim()),
      pips: shown.length === 1 ? shown[0].querySelectorAll("i").length : null,
      width: Math.round(die.getBoundingClientRect().width),
      overflow: Math.round(die.getBoundingClientRect().width) > 44,
      animation: tumble ? getComputedStyle(tumble).animationName : "none",
    };
  });

  await build();
  const on = await read();
  if (on.faces !== 6) fail(`a die is drawn with ${on.faces} faces, not six`);
  if (on.landed !== "4") fail(`the cube landed on ${on.landed}, not the 4 that was rolled`);
  if (on.transform === "none") fail("the cube is not turned to the face that was rolled");
  if (on.label !== "4") fail(`the die reads "${on.label}" to a screen reader`);
  if (on.animation === "none") fail("a die appears rather than lands: no tumble");
  if (on.overflow) fail(`a die projects to ${on.width}px and would overflow its row`);

  // Flat, on request: one face, the one that was rolled, and nothing moving.
  await page.evaluate(async () => {
    const { Settings } = await import("../src/settings.js");
    const { applyDepth } = await import("../src/screens.js");
    Settings.set("depth", false); applyDepth();
  });
  await build();
  const off = await read();
  if (off.shown.length !== 1) fail(`flattened, the die still shows ${off.shown.length} faces`);
  if (off.shown.length === 1 && !/\bf4\b/.test(off.shown[0])) fail(`flattened, the die shows ${off.shown[0]} instead of the 4 that was rolled`);
  if (off.pips !== 4) fail(`flattened, the 4 face carries ${off.pips} pips`);
  if (off.transform !== "none") fail("flattened, the die is still turned in space");
  if (off.animation !== "none") fail("flattened, the die still tumbles");

  // And the setting is in Settings, where the theme and the text size are.
  await page.evaluate(async () => {
    const { Settings } = await import("../src/settings.js");
    const { applyDepth } = await import("../src/screens.js");
    Settings.set("depth", true); applyDepth();
  });
  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(300);
  const settings = await page.locator("#screen").innerText();
  if (!/depth/i.test(settings)) fail("Settings never offers to flatten the app");
  if (errors.length) fail(`console error around the dice: ${errors[0].slice(0, 140)}`);
  await ctx.close();
}

// 8q. a player who asked for less motion gets none of it
{
  const c = await browser.newContext({ viewport: { width: 390, height: 780 }, reducedMotion: "reduce" });
  const page = await c.newPage();
  await seed(page, base, "mid-session");
  const anim = await page.evaluate(async () => {
    const ui = await import("../src/ui.js");
    const row = document.createElement("div");
    row.className = "dice";
    row.appendChild(ui.dieFace(4));
    document.querySelector("#screen").appendChild(row);
    const t = row.querySelector(".tumble");
    return { tumble: getComputedStyle(t).animationName, rain: getComputedStyle(document.body, "::after").animationName };
  });
  if (anim.tumble !== "none") fail(`reduced motion still tumbles the dice (${anim.tumble})`);
  if (anim.rain !== "none") fail(`reduced motion still runs the rain (${anim.rain})`);
  if (!failures.length) ok("the dice land as cubes, flatten on request, and stop for reduced motion");
  await c.close();
}

// 8x. the two floors, swept rather than sampled
// Both were checked against a hand-written list of selectors, and both lists
// were already stale: --ink-3 was measured on --panel, where it passes, and not
// on --panel-2, where it was 3.85:1 under every table row's d66 index; the size
// check named five selectors while .action-context sat under every action
// button in the app at 10.6px. This walks every text node instead.
{
  const { ctx, page, errors } = await newPage();
  const misses = new Map();
  for (const theme of ["light", "dark"]) {
    await seed(page, base, "stress", { theme, rivals: true });
    for (const route of ROUTES) {
      await page.goto(`${base}#/${route}`);
      await page.waitForTimeout(160);
      const bad = await page.evaluate(sweep, DRAWN);
      for (const b of bad) if (!misses.has(b)) misses.set(b, `${theme}/${route}`);
    }
  }
  for (const [what, where] of misses) fail(`${where}: ${what}`);
  if (errors.length) fail(`console error during the sweep: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok(`every text node on ${ROUTES.length} routes clears 11px and AA, in both themes`);
  await ctx.close();
}

// 8r. the frame reads: contrast, size, and nothing cut off
// The section nav never scrolled its current pill into view, so the tab you
// were on was the one clipped by the right edge. --ink-3 carried every small
// uppercase label in the app at under 3:1, and those labels were 9-11px.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");

  const rgbOf = (c) => {
    const hex = c.trim().match(/^#([0-9a-f]{6})$/i);
    if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
    return c.match(/[\d.]+/g).slice(0, 3).map(Number);
  };
  const lum = (rgb) => {
    const [r, g, b] = rgbOf(rgb).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  for (const theme of ["light", "dark"]) {
    await page.evaluate(async (t) => {
      const { Settings } = await import("../src/settings.js");
      const { applyTheme } = await import("../src/screens.js");
      Settings.set("theme", t); applyTheme();
    }, theme);
    await page.goto(`${base}#/sheet`);
    await page.waitForTimeout(250);
    const tone = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const probe = document.createElement("div");
      probe.style.cssText = "color:var(--ink-3);background:var(--panel)";
      document.body.append(probe);
      const got = { ink3: getComputedStyle(probe).color, panel: getComputedStyle(probe).backgroundColor };
      probe.remove();
      return { ...got, scheme: cs.colorScheme };
    });
    const r = ratio(tone.ink3, tone.panel);
    if (r < 4.5) fail(`${theme}: --ink-3 on --panel is ${r.toFixed(2)}:1, under the 4.5 AA floor`);
    if (!tone.scheme.startsWith(theme)) fail(`${theme}: color-scheme reads "${tone.scheme}", so UA widgets follow the system instead`);
    const meta = await page.getAttribute('meta[name="theme-color"]', "content");
    const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (ratio(meta, paper) > 1.6) fail(`${theme}: the browser chrome is painted ${meta} over a ${paper} app`);
  }

  // Nothing load-bearing is drawn under 11px.
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(300);
  const small = await page.evaluate(() => {
    const out = [];
    for (const sel of [".res span", ".stage-step", ".tab", "h3", ".explain summary"]) {
      const node = document.querySelector(sel);
      if (node) out.push([sel, parseFloat(getComputedStyle(node).fontSize)]);
    }
    return out;
  });
  for (const [sel, px] of small) if (px < 11) fail(`${sel} is drawn at ${px}px, under the 11px floor`);

  // The pill you are on is the one you can see.
  for (const route of ["settings", "journal", "case-sheet"]) {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(300);
    const cut = await page.evaluate(() => {
      const nav = document.querySelector(".section-nav");
      const here = nav && nav.querySelector('[aria-current="page"]');
      if (!here) return null;
      const n = nav.getBoundingClientRect(), h = here.getBoundingClientRect();
      return { over: Math.round(Math.max(0, h.right - n.right) + Math.max(0, n.left - h.left)) };
    });
    if (cut && cut.over > 1) fail(`${route}: the pill you are on is cut off by ${cut.over}px`);
  }

  // A struck attribute is marked, not faded out of contrast.
  await page.goto(`${base}#/sheet`);
  await page.waitForTimeout(300);
  const struck = await page.evaluate(() => {
    const a = document.querySelector(".attr.struck");
    return a ? { opacity: parseFloat(getComputedStyle(a).opacity), text: a.innerText.trim() } : null;
  });
  if (struck && struck.opacity < 0.95) fail(`a struck attribute is drawn at ${struck.opacity} opacity, on top of muted ink`);

  if (errors.length) fail(`console error in the frame: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the frame reads: AA contrast, an 11px floor, and the pill you are on in view");
  await ctx.close();
}

// 8s. what is on top of a screen is what that screen is for
// The guide was the same full card on all fifteen routes, so on Tables or
// Settings it was 40% of the first viewport saying something about a scene you
// were not looking at — and on Play it pushed the stage rail, the one piece of
// state a scene turns on, below the fold.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");

  const shape = async (route) => {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(320);
    return page.evaluate(() => {
      const coach = document.querySelector(".coach");
      const rail = document.querySelector(".stages");
      const h1 = document.querySelector("#screen h1");
      const box = (n) => (n ? Math.round(n.getBoundingClientRect().height) : 0);
      const top = (n) => (n ? Math.round(n.getBoundingClientRect().top) : -1);
      return {
        coach: box(coach), compact: coach ? coach.classList.contains("compact") : null,
        expandable: !!(coach && coach.querySelector(".coach-toggle")),
        rail: top(rail), h1: top(h1), viewport: window.innerHeight,
        explainInline: !!document.querySelector("#screen .heading-row .explain"),
      };
    });
  };

  // On the Table the guide is one line by the Next button, and the stage rail is above the fold.
  const play = await shape("play");
  if (!play.compact || !play.expandable) fail("the guide on the Table is not one line that opens");
  if (play.rail < 0) fail("the play screen has no stage rail");
  else if (play.rail > play.viewport - 80) fail(`the stage rail starts at ${play.rail}px of a ${play.viewport}px screen`);

  // On a reference screen it is one line, and it opens on request.
  for (const route of ["tables", "settings", "rules", "careers"]) {
    const ref = await shape(route);
    if (!ref.compact) fail(`${route}: the guide is still the full card`);
    if (!ref.expandable) fail(`${route}: the collapsed guide cannot be opened`);
    if (ref.coach > 76) fail(`${route}: the collapsed guide is ${ref.coach}px tall`);
  }

  // Opening it gives back the whole thing, and it stays open while you are there.
  await page.goto(`${base}#/tables`);
  await page.waitForTimeout(300);
  await page.locator(".coach-toggle").click();
  await page.waitForTimeout(250);
  const opened = await page.evaluate(() => {
    const c = document.querySelector(".coach");
    return { compact: c.classList.contains("compact"), why: !!c.querySelector(".coach-row .btn") };
  });
  if (opened.compact) fail("opening the collapsed guide did not open it");
  if (!opened.why) fail("the opened guide does not carry its buttons");

  // "What this screen does" is an affordance beside the heading, not a band under it.
  const heading = await shape("journal");
  if (!heading.explainInline) fail("the what-this-does note is still a full-width band under the heading");

  if (errors.length) fail(`console error around the guide: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the guide is one line that opens, everywhere; the rail is above the fold");
  await ctx.close();
}

// 8t. the numbers get out of the way of the reading
// Header, numbers, action bar and tab bar together took about a third of a
// small phone. The numbers go when you scroll into the text and come back the
// moment you scroll up or one of them changes.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");
  await page.goto(`${base}#/journal`);
  await page.waitForTimeout(350);
  const hidden = await page.evaluate(async () => {
    const h = document.querySelector("#resource-header");
    const before = h.getBoundingClientRect().top;
    window.scrollTo(0, 600);
    await new Promise((r) => setTimeout(r, 420));
    const away = h.getBoundingClientRect().bottom <= 60 || h.classList.contains("tucked");
    window.scrollTo(0, 240);
    await new Promise((r) => setTimeout(r, 420));
    const back = !h.classList.contains("tucked");
    return { before, away, back };
  });
  if (!hidden.away) fail("the numbers stay put when you scroll down into the reading");
  if (!hidden.back) fail("the numbers do not come back when you scroll up");

  // A premise you cannot read is not a premise: it shows without being opened.
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(350);
  const premise = await page.evaluate(() => {
    const n = [...document.querySelectorAll("#screen .premise, #screen .clamp")].find((x) => x.innerText.trim().length > 20);
    return n ? { text: n.innerText.trim().slice(0, 40), visible: n.getBoundingClientRect().height > 0 } : null;
  });
  if (!premise || !premise.visible) fail("the premise is behind a closed accordion on the play screen");

  if (errors.length) fail(`console error around the chrome: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the numbers tuck away as you read and come back as you climb, and the premise is on the page");
  await ctx.close();
}

// 8u. one primary, one control, one way back up
// Blue was doing two jobs: the action you are meant to take, and whichever
// option of a set was selected. A screen with three blue buttons has none.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");

  for (const route of ROUTES) {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(320);
    const primaries = await page.evaluate(() =>
      [...document.querySelectorAll("#screen .btn.primary, #action-host .btn.primary")]
        .filter((b) => !b.closest(".coach"))
        .map((b) => b.innerText.replace(/\s+/g, " ").trim()));
    if (primaries.length > 1) fail(`${route}: ${primaries.length} primary buttons — ${primaries.join(" / ")}`);
  }

  // A set of options is one control, not a row of buttons that look like actions.
  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(320);
  const segs = await page.evaluate(() => {
    const out = [];
    for (const seg of document.querySelectorAll("#screen .seg")) {
      const opts = [...seg.querySelectorAll("[role='radio']")];
      out.push({
        count: opts.length,
        checked: opts.filter((o) => o.getAttribute("aria-checked") === "true").length,
        primary: opts.filter((o) => o.classList.contains("primary")).length,
        role: seg.getAttribute("role"),
      });
    }
    return out;
  });
  if (!segs.length) fail("Settings still lays its option sets out as loose buttons");
  for (const g of segs) {
    if (g.role !== "radiogroup") fail(`a segmented control is a ${g.role}, not a radiogroup`);
    if (g.checked !== 1) fail(`a segmented control has ${g.checked} options marked as chosen`);
    if (g.primary) fail("a segmented control still paints its chosen option as a primary action");
  }

  // A feature flag is a switch, and the whole row is its target.
  const flags = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#screen label.opt")];
    return { rows: rows.length, switches: rows.filter((r) => r.classList.contains("switch")).length };
  });
  if (!flags.rows) fail("Settings has no toggle rows at all");
  if (flags.switches !== flags.rows) fail(`${flags.rows - flags.switches} of ${flags.rows} toggles are still bare checkboxes`);

  // Long screens can be climbed without a swipe marathon.
  await page.goto(`${base}#/rules`);
  await page.waitForTimeout(320);
  const top = await page.evaluate(async () => {
    window.scrollTo(0, 2000);
    await new Promise((r) => setTimeout(r, 360));
    const b = document.querySelector(".to-top");
    if (!b) return null;
    const shown = getComputedStyle(b).opacity !== "0" && b.getBoundingClientRect().width > 0;
    b.click();
    await new Promise((r) => setTimeout(r, 1200));
    return { shown, y: Math.round(window.scrollY) };
  });
  if (!top) fail("a screen thousands of pixels long has no way back to the top");
  else {
    if (!top.shown) fail("the back-to-top control never appears");
    if (top.y > 4) fail(`back to the top left the page at ${top.y}px`);
  }

  // The search can be emptied without selecting the text by hand.
  await page.goto(`${base}#/tables`);
  await page.waitForTimeout(320);
  await page.locator("#screen input[type='search'], #screen .input").first().fill("morgue");
  await page.waitForTimeout(260);
  const search = await page.evaluate(() => {
    const clear = document.querySelector("#screen .field-clear");
    const count = document.querySelector("#screen .field-count");
    return { clear: !!clear, count: count ? count.innerText.trim() : null };
  });
  if (!search.clear) fail("the table search cannot be cleared in one tap");
  if (!search.count) fail("the table search never says how many rows it found");

  // The focus ring has to be visible on the button it is most often on.
  const ring = await page.evaluate(() => {
    const b = document.querySelector(".action-bar .btn.primary") || document.querySelector(".btn.primary");
    if (!b) return null;
    b.focus();
    const cs = getComputedStyle(b);
    return { color: cs.outlineColor, width: cs.outlineWidth, shadow: cs.boxShadow };
  });
  if (ring && !/0px 0px 0px 2px|inset/.test(ring.shadow || "")) fail("a focused primary button has no ring that survives its own fill");

  if (errors.length) fail(`console error around the controls: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("one primary per screen, option sets are one control, and a long screen can be climbed");
  await ctx.close();
}

// 8v. the surface: paper by day, weather by night, and the dial in the header
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");

  // The clock is the game's own icon and it already exists. The header drew it
  // as "3/4" while the drawn dial sat two screens away on the sheet. (The Table
  // carries no bar; a drawer does.)
  await page.goto(`${base}#/sheet`);
  await page.waitForTimeout(320);
  const head = await page.evaluate(() => {
    const dial = document.querySelector("#resource-header .clock svg");
    const text = document.querySelector("#resource-header").innerText;
    return { dial: !!dial, text };
  });
  if (!head.dial) fail("the header still spells the clock out instead of drawing it");

  // Body copy and the fields the player types into are the same size.
  const sizes = await page.evaluate(() => ({
    body: parseFloat(getComputedStyle(document.body).fontSize),
    input: (() => { const i = document.createElement("input"); i.className = "input"; document.body.append(i);
      const px = parseFloat(getComputedStyle(i).fontSize); i.remove(); return px; })(),
  }));
  if (sizes.body < 15.9) fail(`body copy is ${sizes.body}px against ${sizes.input}px fields`);

  // Night: the weather passes behind the paper rather than stopping at its edge.
  for (const [theme, want] of [["dark", true], ["light", false]]) {
    await page.evaluate(async (t) => {
      const { Settings } = await import("../src/settings.js");
      const { applyTheme, applyDepth } = await import("../src/screens.js");
      Settings.set("theme", t); Settings.set("depth", true); applyTheme(); applyDepth();
    }, theme);
    await page.waitForTimeout(220);
    const surface = await page.evaluate(() => {
      const card = document.querySelector("#screen .card");
      const cs = getComputedStyle(card);
      const alpha = (cs.backgroundColor.match(/[\d.]+/g) || [])[3];
      return { alpha: alpha === undefined ? 1 : Number(alpha), image: cs.backgroundImage };
    });
    if (want && surface.alpha >= 0.99) fail("at night the cards are solid, so the rain stops at their edge");
    if (!want && surface.image === "none") fail("by day the paper has no grain at all");
  }

  // And one attribute takes the whole surface away again.
  await page.evaluate(async () => {
    const { Settings } = await import("../src/settings.js");
    const { applyDepth } = await import("../src/screens.js");
    Settings.set("depth", false); applyDepth();
  });
  await page.waitForTimeout(200);
  const flat = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector("#screen .card"));
    const alpha = (cs.backgroundColor.match(/[\d.]+/g) || [])[3];
    return { alpha: alpha === undefined ? 1 : Number(alpha), image: cs.backgroundImage };
  });
  if (flat.alpha < 0.99 || flat.image !== "none") fail("flattened, the cards keep their grain and their translucency");

  if (errors.length) fail(`console error around the surface: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the dial is in the header, the body reads at field size, and the surface is paper or weather");
  await ctx.close();
}

// 8w. things arrive rather than appear, and stop when asked
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");
  await page.evaluate(async () => {
    const { Settings } = await import("../src/settings.js");
    const { applyDepth } = await import("../src/screens.js");
    Settings.set("depth", true); applyDepth();
  });
  await page.goto(`${base}#/tables`);
  await page.waitForTimeout(300);
  const moves = await page.evaluate(async () => {
    const ui = await import("../src/ui.js");
    ui.modal({ title: "Probe", body: document.createElement("p"), actions: [{ label: "Close" }] });
    await new Promise((r) => setTimeout(r, 30));
    const card = document.querySelector(".modal-card");
    const anim = getComputedStyle(card).animationName;
    document.querySelector(".modal-overlay").remove();
    const screen = document.querySelector("#screen");
    return { modal: anim, route: getComputedStyle(screen).animationName };
  });
  if (moves.modal === "none") fail("a dialog appears rather than arrives");
  if (moves.route === "none") fail("a screen replaces the last one with no transition at all");

  // Flattened, none of it runs.
  await page.evaluate(async () => {
    const { Settings } = await import("../src/settings.js");
    const { applyDepth } = await import("../src/screens.js");
    Settings.set("depth", false); applyDepth();
  });
  await page.goto(`${base}#/rules`);
  await page.waitForTimeout(260);
  const still = await page.evaluate(async () => {
    const ui = await import("../src/ui.js");
    ui.modal({ title: "Probe", body: document.createElement("p"), actions: [{ label: "Close" }] });
    await new Promise((r) => setTimeout(r, 30));
    const anim = getComputedStyle(document.querySelector(".modal-card")).animationName;
    document.querySelector(".modal-overlay").remove();
    return { modal: anim, route: getComputedStyle(document.querySelector("#screen")).animationName };
  });
  if (still.modal !== "none" || still.route !== "none") fail("flattened, the app still animates");

  if (errors.length) fail(`console error around the motion: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("dialogs and screens arrive, and one setting stops all of it");
  await ctx.close();
}

// 8y. the second audit: what the first pass left half-done
{
  const { ctx, page, errors } = await newPage();

  // A blank app: one voice, and no tabs to screens with nothing on them.
  await seed(page, base, "fresh");
  await page.goto(`${base}#/home`);
  await page.waitForTimeout(350);
  const blank = await page.evaluate(() => ({
    compact: !!document.querySelector(".coach.compact"),
    full: !!document.querySelector(".coach:not(.compact)"),
    nav: [...document.querySelectorAll("#screen .section-nav a")].map((a) => a.innerText.trim()),
  }));
  if (blank.full) fail("a blank app explains Start playing twice: the full guide and the onboarding card");
  for (const empty of ["Investigator", "Mystery", "Journal"])
    if (blank.nav.some((t) => new RegExp(empty, "i").test(t))) fail(`a blank app offers the ${empty} tab with nothing behind it`);

  // The wizard: the guide names the button that is actually on the screen.
  await page.goto(`${base}#/wizard`);
  await page.waitForTimeout(350);
  // Open the guide if it is folded, then read what it names.
  const toggle = page.locator(".coach-toggle");
  if (await toggle.count()) await toggle.click();
  await page.waitForTimeout(150);
  const wiz = await page.evaluate(() => {
    const here = document.querySelector(".coach-here");
    const bar = document.querySelector(".action-bar .btn span");
    return {
      names: here ? (here.innerText.match(/\u201c(.+?)\u201d/) || [])[1] : null,
      bar: bar ? bar.innerText.trim() : null,
      steps: document.querySelectorAll(".steps .step-seg").length,
      navLookalike: !!document.querySelector("#screen .card .section-nav"),
      radios: document.querySelectorAll("#screen .seg [role='radio']").length,
      loose: document.querySelectorAll("#screen .btn.chosen, #screen .btn[aria-pressed]").length,
    };
  });
  if (wiz.names && wiz.bar && wiz.names !== wiz.bar) fail(`the wizard's guide says press "${wiz.names}" while the button says "${wiz.bar}"`);
  if (wiz.steps !== 4) fail(`the wizard's progress is drawn as ${wiz.steps} segments, not four`);
  if (wiz.navLookalike) fail("the wizard's step rail still looks like the section nav");
  if (wiz.radios < 9) fail(`the 2/1/0 picker is ${wiz.radios} radios, not three segmented controls of three`);
  if (wiz.loose) fail(`the wizard still has ${wiz.loose} loose option buttons`);

  // The opened note is a note on its own line, not a glyph on the heading.
  await seed(page, base, "stress");
  await page.goto(`${base}#/clues`);
  await page.waitForTimeout(300);
  await page.locator(".heading-row .explain summary").click();
  await page.waitForTimeout(200);
  const note = await page.evaluate(() => {
    const h1 = document.querySelector(".heading-row h1").getBoundingClientRect();
    const sum = document.querySelector(".heading-row .explain summary");
    const r = sum.getBoundingClientRect();
    const label = sum.querySelector(".vh");
    return {
      overlaps: !(r.top >= h1.bottom - 1 || r.bottom <= h1.top + 1 || r.left >= h1.right || r.right <= h1.left),
      labelDrawn: label ? label.getBoundingClientRect().width > 4 : false,
    };
  });
  if (note.overlaps) fail("the opened what-this-does note is drawn on top of the heading");
  if (!note.labelDrawn) fail("the opened note is a bare ? with nothing to say what it is");

  // The solve guides itself: no second voice at the climax.
  await page.goto(`${base}#/solve`);
  await page.waitForTimeout(300);
  if (await page.locator(".coach").count()) fail("the solve still carries the guide's line about a scene you left");

  // The reveal: three cards, on a stage, turned one after another.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const m = s.careers[s.activeId].mystery;
    m.ended = true; m.solved = true; m.endTrigger = "chosen";
    m.results = m.setAside.map((c) => ({ guess: c, correct: true }));
    m.correct = 3; m.answers = [];
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/solve`);
  await page.waitForTimeout(400);
  const reveal = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".reveal .pcard")];
    return {
      count: cards.length,
      width: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : 0,
      delays: cards.map((c) => getComputedStyle(c).animationDelay),
    };
  });
  if (reveal.count !== 3) fail(`the reveal shows ${reveal.count} cards`);
  if (reveal.width < 56) fail(`the reveal's cards are ${reveal.width}px, the size of a clue set`);
  if (new Set(reveal.delays).size < 3) fail("the reveal turns all three cards over at once");

  // Careers: a status is not a control beside a destructive one.
  await page.goto(`${base}#/careers`);
  await page.waitForTimeout(300);
  const status = await page.evaluate(() =>
    [...document.querySelectorAll("#screen .btn-row")].some((r) => r.querySelector(".pill") && r.querySelector(".btn.danger")));
  if (status) fail("the Current pill still sits in a button row beside Delete");

  if (errors.length) fail(`console error in the second audit: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("one voice on a blank app, the guide names what is there, the note opens cleanly, the reveal is staged");
  await ctx.close();
}

// 8z. a message never sits on the button you came to press
// The update toast was pinned at exactly the action bar's height, so a deploy
// landing mid-scene covered "Get out" — found when one landed during this suite.
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");
  for (const route of ["play", "home", "clues"]) {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(300);
    const hit = await page.evaluate(async () => {
      const ui = await import("../src/ui.js");
      ui.actionToast({ text: "Update available. Reloading keeps everything you have.", actionLabel: "Reload" });
      ui.showToast("A plain message");
      await new Promise((r) => setTimeout(r, 400));
      const bar = document.querySelector(".action-bar");
      if (!bar) return null;
      const b = bar.getBoundingClientRect();
      const over = (sel) => { const n = document.querySelector(sel); if (!n) return false;
        const r = n.getBoundingClientRect();
        return r.bottom > b.top + 1 && r.top < b.bottom - 1 && r.width > 0; };
      const out = { action: over(".toast-action"), plain: over(".toast.show") };
      ui.dismissActionToast && ui.dismissActionToast();
      return out;
    });
    if (!hit) continue;
    if (hit.action) fail(`${route}: the update toast sits on top of the action bar`);
    if (hit.plain) fail(`${route}: a toast sits on top of the action bar`);
  }
  if (errors.length) fail(`console error around the toasts: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok("a toast never covers the button you came to press");
  await ctx.close();
}

// 8aa. the graphics pass: state drawn as the thing it is
// Twenty-eight drawings, each checked for being there and for saying what it
// shows. A data graphic has to agree with the state it draws; a glyph has to
// be in the right place; motion has to stop when stillness is asked for.
{
  const { ctx, page, errors } = await newPage();
  const q = (fn, arg) => page.evaluate(fn, arg);
  await seed(page, base, "stress", { rivals: true });

  // Clues: the twelve face cards, the decks as stacks, sets fanned, truths upright, false leads torn.
  await page.goto(`${base}#/clues`);
  await page.waitForTimeout(350);
  const clues = await q(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const m = s.careers[s.activeId].mystery;
    const grid = document.querySelector(".face-grid");
    const seen = new Set(m.truthRevealed.map((c) => c.rank + c.suit)).size;
    const truthCard = document.querySelector(".clue-set.truth .pcard");
    return {
      grid: grid ? grid.children.length : 0,
      ruled: grid ? grid.querySelectorAll(".pcard.ruled").length : -1,
      backs: grid ? grid.querySelectorAll(".pcard.back").length : -1,
      seen,
      gridFirst: grid ? grid.closest(".card").querySelector(".face-grid") === grid.closest(".card").children[1] : false,
      stacks: document.querySelectorAll(".deck-stack").length,
      fanned: !!document.querySelector(".clue-set:not(.truth) .hand.fan"),
      truthTurn: truthCard ? getComputedStyle(truthCard).transform : "none",
      pinned: !!document.querySelector(".clue-set.truth .pcard.pinned"),
      torn: !!document.querySelector(".clue-set.false .pcard.torn"),
      backImage: (() => { const b = document.querySelector(".pcard.back"); return b ? getComputedStyle(b).backgroundImage : ""; })(),
    };
  });
  if (clues.grid !== 12) fail(`the case board draws ${clues.grid} face cards, not twelve`);
  if (clues.ruled !== clues.seen) fail(`the card grid strikes ${clues.ruled} cards while ${clues.seen} are ruled out`);
  if (clues.backs !== 12 - clues.seen) fail(`the card grid shows ${clues.backs} unseen cards face down, not ${12 - clues.seen}`);
  if (!clues.gridFirst) fail("the card grid is not what the case board leads with");
  if (clues.stacks < 3) fail(`the decks are drawn as ${clues.stacks} stacks, not three`);
  if (!clues.fanned) fail("an open clue set lies flat instead of fanned like a held hand");
  if (clues.truthTurn !== "none" && clues.truthTurn !== "matrix(1, 0, 0, 1, 0, 0)") fail("an established truth's cards are still turned on their side");
  if (!clues.pinned) fail("an established truth's cards carry no pinned mark");
  if (!clues.torn) fail("a false lead shows no torn card");
  if (!/repeating-linear-gradient/.test(clues.backImage)) fail("a face-down card has no rain on its back");

  // Play mid-scene: the stage path, threat meters, danger gauge, the case file.
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(350);
  const play = await q(() => {
    const path = document.querySelector(".stage-path");
    const named = path ? [...path.querySelectorAll(".stage-name")].filter((n) => !n.classList.contains("vh")) : [];
    const threat = document.querySelector(".threat");
    const problem = [...document.querySelectorAll("#screen .card")].find((c) => /the problem/i.test(c.innerText));
    return {
      steps: path ? path.querySelectorAll("li").length : 0,
      now: path ? path.querySelectorAll("li.now").length : 0,
      named: named.length,
      marks: threat ? (threat.querySelector(".marks") || {}).getAttribute?.("aria-label") : null,
      bars: threat ? (threat.querySelector(".level-bars") || {}).getAttribute?.("aria-label") : null,
      // On the Table, danger is a gauge on the desk and the case sits on its strip.
      gauge: !!document.querySelector("#screen .desk .danger-gauge"),
      file: !!document.querySelector('#screen a.case-strip[href="#/case-sheet"] .genre-art'),
    };
  });
  if (play.steps !== 4) fail(`the stage path draws ${play.steps} stages, not the book's four`);
  if (play.now !== 1) fail(`the stage path marks ${play.now} stages as where you are`);
  if (play.named !== 1) fail(`the stage path names ${play.named} stages on screen instead of only the one you are in`);
  if (!play.marks || !/of \d marks/.test(play.marks)) fail("a threat's marks are not drawn as boxes to fill");
  if (!play.bars || !/Level \d of 3/.test(play.bars)) fail("a threat's level is not drawn as a meter");
  if (!play.gauge) fail("the Table shows danger as a bare number, with no gauge");
  if (!play.file) fail("the Table's case is not on its strip with the genre's mark");

  // The genre watermark is behind every screen while a case is open, and gone when flattened.
  const mark = await q(() => {
    const n = document.querySelector(".genre-mark");
    return { genre: document.body.dataset.genre || null, image: n ? getComputedStyle(n).backgroundImage : "none", z: n ? getComputedStyle(n).zIndex : null };
  });
  if (!mark.genre) fail("an open case does not tell the page its genre");
  if (!/data:image\/svg/.test(mark.image)) fail("an open case has no genre watermark behind it");

  // A roll: the result scale, and a consequence scale when there is one.
  await page.locator(".action-bar .btn").click();
  let scaled = false, conseq = false;
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(220);
    if (await page.locator(".modal-overlay .roll-scale").count()) {
      scaled = true;
      conseq = conseq || !!(await page.locator(".modal-overlay .roll-scale.consequence").count());
      break;
    }
    const choice = page.locator(".modal-overlay .choice").first();
    const act = page.locator(".modal-actions .btn").first();
    if (await choice.count()) await choice.click();
    else if (await act.count()) await act.click();
    else break;
  }
  if (!scaled) fail("a test's result shows the dice but not where the total landed");
  await page.keyboard.press("Escape").catch(() => {});

  // Home: result pips on closed cases, rival slots as die faces.
  await page.goto(`${base}#/home`);
  await page.waitForTimeout(350);
  const home = await q(() => ({
    pips: document.querySelectorAll("#screen .result-pips").length,
    rivalDice: document.querySelectorAll("#screen .rival-die .d66-die").length,
    rivals: (() => { const s = JSON.parse(localStorage.getItem("citr:v1")); return s.careers[s.activeId].rivals.length; })(),
  }));
  if (!home.pips) fail("closed cases show their result as text only");
  if (home.rivals && home.rivalDice !== home.rivals) fail(`${home.rivals} rivals, ${home.rivalDice} drawn as the die slot they return on`);

  // The sheet: signature keywords carry the drawn seal, not a typed star.
  await page.goto(`${base}#/sheet`);
  await page.waitForTimeout(300);
  const sig = await q(() => ({
    seal: document.querySelectorAll("#screen .chip.signature .glyph-seal").length,
    star: /★/.test(document.querySelector("#screen").innerText),
  }));
  if (!sig.seal) fail("a signature keyword has no drawn seal");
  if (sig.star) fail("a typed ★ is still standing in for the signature mark");

  // The journal: a glyph on each day, and a drop cap opening it.
  await page.goto(`${base}#/journal`);
  await page.waitForTimeout(300);
  const journal = await q(() => ({
    days: document.querySelectorAll("#screen .story-day .glyph-day").length,
    dropcap: !!document.querySelector("#screen .story-line.opens"),
  }));
  if (!journal.days) fail("the story's days are dividers with no mark");
  if (!journal.dropcap) fail("a day in the story opens without a drop cap");

  // The oracle: the yes/no lands on a die and a banded strip.
  await page.goto(`${base}#/oracle`);
  await page.waitForTimeout(300);
  await page.locator("#screen .btn", { hasText: /^Ask$/ }).click();
  await page.waitForTimeout(700);
  const oracle = await q(() => ({ die: !!document.querySelector("#screen .die"), scale: !!document.querySelector("#screen .roll-scale") }));
  if (!oracle.die || !oracle.scale) fail("the yes/no answer is a line of text, with no die and no strip");

  // The scene picker: a glyph on every scene. The rolls above are live dice and
  // can end the case, which puts the end card where the picker would be.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const m = s.careers[s.activeId].mystery; m.scene = null; m.threats = []; m.ended = false; m.endTrigger = null;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(350);
  const picker = await q(() => [...document.querySelectorAll("#screen .choice-list .choice")].map((c) => !!c.querySelector(".glyph")));
  if (!picker.length || picker.some((x) => !x)) fail("the scene choices are text with no glyph");

  // The clue dialog: the card is drawn off a deck in front of you.
  const drew = await q(async () => {
    const { getPrompts } = await import("../src/roller.js");
    const set = { rank: "5", cards: [{ id: "a", rank: "5", suit: "S" }, { id: "b", rank: "5", suit: "H" }], entries: [], prompts: [] };
    const p = getPrompts().describeClue({ set, card: set.cards[1], oracle: "Reveal", clue: "a note", isNew: false });
    await new Promise((r) => setTimeout(r, 120));
    const fig = document.querySelector(".modal-overlay .draw-figure");
    const out = { fig: !!fig, drawn: fig ? !!fig.querySelector(".pcard.drawn") : false, deck: fig ? !!fig.querySelector(".deck-stack") : false,
      anim: fig && fig.querySelector(".pcard.drawn") ? getComputedStyle(fig.querySelector(".pcard.drawn")).animationName : "none" };
    document.querySelector(".modal-overlay .btn.ghost")?.click();
    await p;
    return out;
  });
  if (!drew.fig || !drew.drawn || !drew.deck) fail("a clue is drawn with no deck and no card coming off it");
  if (drew.anim === "none") fail("the drawn card appears rather than coming off the deck");

  // Flattened: the watermark goes and nothing moves.
  await page.evaluate(async () => {
    const { Settings } = await import("../src/settings.js");
    const { applyDepth } = await import("../src/screens.js");
    Settings.set("depth", false); applyDepth();
  });
  await page.goto(`${base}#/clues`);
  await page.waitForTimeout(300);
  const flat = await q(() => {
    const n = document.querySelector(".genre-mark");
    return { image: n ? getComputedStyle(n).backgroundImage : "none", hidden: n ? getComputedStyle(n).display === "none" : true };
  });
  if (!flat.hidden && flat.image !== "none") fail("flattened, the genre watermark is still behind the screen");
  await page.evaluate(async () => {
    const { Settings } = await import("../src/settings.js");
    const { applyDepth } = await import("../src/screens.js");
    Settings.set("depth", true); applyDepth();
  });

  // The solve: a pool of light behind the three cards.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const m = s.careers[s.activeId].mystery;
    m.ended = true; m.solved = true; m.endTrigger = "chosen";
    m.results = m.setAside.map((c) => ({ guess: c, correct: true })); m.correct = 3; m.answers = [];
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/solve`);
  await page.waitForTimeout(400);
  const lit = await q(() => { const r = document.querySelector(".reveal"); return r ? getComputedStyle(r).backgroundImage : "none"; });
  if (!/radial-gradient/.test(lit)) fail("the reveal has no light on it");

  // Empty states and the first screen carry their drawings; no case, no watermark.
  await seed(page, base, "fresh");
  await page.goto(`${base}#/home`);
  await page.waitForTimeout(300);
  const blank = await q(() => ({ hero: !!document.querySelector("#screen .illustration-hero"), genre: document.body.dataset.genre || null }));
  if (!blank.hero) fail("the first screen of all has no picture on it");
  if (blank.genre) fail("a blank app carries a genre watermark with no case open");
  for (const [route, art] of [["clues", ".empty .illustration-mystery"], ["play", ".intro-panel .illustration-scene"], ["solve", ".empty .illustration-mystery"]]) {
    await page.goto(`${base}#/${route}`);
    await page.waitForTimeout(250);
    if (!(await page.locator(`#screen ${art}`).count())) fail(`${route}: the empty state is words with no drawing`);
  }

  if (errors.length) fail(`console error in the graphics pass: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the graphics pass: every drawing is there, agrees with the state, and stops when asked");
  await ctx.close();
}

// 8ab. the day turns, and the dialog shows the dawn
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    for (const i of c.investigators) i.clock = 3;
    c.mystery.threats = [];
    if (c.mystery.scene) c.mystery.scene.done = true;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(350);
  await page.locator(".action-bar .btn").click();
  let dawn = false;
  for (let i = 0; i < 5 && !dawn; i++) {
    await page.waitForTimeout(250);
    dawn = !!(await page.locator(".modal-overlay .glyph-dawn").count());
    if (dawn) break;
    const act = page.locator(".modal-actions .btn").first();
    if (await act.count()) await act.click(); else break;
  }
  if (!dawn) fail("the day turns with no dawn drawn in its dialog");
  if (errors.length) fail(`console error at the day's turn: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok("the day turns under a drawn dawn");
  await ctx.close();
}

// 8ac. what just changed moves, once, and nothing else does
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    c.investigators[0].fatigue = 1; c.investigators[0].clock = 1; c.mystery.danger = 3;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/sheet`);
  await page.waitForTimeout(350);
  const before = await page.evaluate(() => ({
    fresh: document.querySelectorAll(".box.fresh, .clock .seg-on.fresh").length,
  }));
  if (before.fresh) fail("a screen seen for the first time animates marks that were already there");
  const after = await page.evaluate(async () => {
    const { Store } = await import("../src/store.js");
    const { render } = await import("../src/router.js");
    Store.update("probe", () => { const i = Store.investigator; i.fatigue += 1; i.clock += 1; Store.mystery.danger += 4; });
    await render();
    await new Promise((r) => setTimeout(r, 60));
    const box = document.querySelector(".box.fresh");
    const seg = document.querySelector(".clock .seg-on.fresh");
    return {
      boxes: document.querySelectorAll(".box.fresh").length,
      stamp: box ? getComputedStyle(box, "::before").animationName : "none",
      segs: document.querySelectorAll("#screen .clock .seg-on.fresh").length,
      sweep: seg ? getComputedStyle(seg).animationName : "none",
      ticking: !!document.querySelector("#resource-header .res b.ticking"),
    };
  });
  if (after.boxes !== 1) fail(`marking one fatigue stamped ${after.boxes} boxes`);
  if (after.stamp === "none") fail("a newly marked fatigue box appears rather than being stamped in");
  if (after.segs !== 1) fail(`marking one clock segment swept ${after.segs} segments on the sheet`);
  if (after.sweep === "none") fail("a newly marked clock segment appears rather than sweeping in");
  if (!after.ticking) fail("the header's danger jumps to its new value instead of counting to it");
  // A render with nothing changed moves nothing.
  const again = await page.evaluate(async () => {
    const { render } = await import("../src/router.js");
    await render();
    return document.querySelectorAll("#screen .box.fresh, #screen .clock .seg-on.fresh").length;
  });
  if (again) fail(`re-rendering with nothing changed replayed ${again} animations`);
  if (errors.length) fail(`console error around the motion: ${errors[0].slice(0, 120)}`);
  if (!failures.length) ok("a mark is stamped, a segment sweeps and danger counts — once, when it changes");
  await ctx.close();
}

// 8ad. the second graphics pass: the dialogs, the solve's picker, the dice you tap
{
  const { ctx, page, errors } = await newPage();
  const q = (fn, arg) => page.evaluate(fn, arg);
  const closeAll = () => q(() => { document.querySelectorAll(".modal-overlay").forEach((n) => n.remove()); });
  await seed(page, base, "stress", { rivals: true, theme: "light" });

  // 2. the watermark: fainter, and thinning out toward the top
  await page.goto(`${base}#/oracle`);
  await page.waitForTimeout(300);
  const wm = await q(() => { const n = document.querySelector(".genre-mark"); const cs = getComputedStyle(n);
    return { op: parseFloat(cs.opacity), mask: cs.maskImage || cs.webkitMaskImage || "none" }; });
  if (wm.op > 0.06) fail(`the genre watermark is drawn at ${wm.op} by day, loud on a short screen`);
  if (!/linear-gradient/.test(wm.mask)) fail("the genre watermark does not thin out toward the top");

  // 15. the subject oracle's words as tiles
  await page.locator("#screen .btn", { hasText: /^Two words$/ }).click();
  await page.waitForTimeout(300);
  const tiles = await q(() => document.querySelectorAll("#screen .word-tile").length);
  if (tiles !== 2) fail(`two oracle words are drawn as ${tiles} tiles`);

  // 10. dice you tap: one die, two dice, the dialog closes itself
  const one = await q(async () => {
    const { getPrompts } = await import("../src/roller.js");
    const p = getPrompts().enterDie("Rest");
    await new Promise((r) => setTimeout(r, 120));
    const faces = document.querySelectorAll(".modal-overlay .dice-pick .die-choice").length;
    const typing = !!document.querySelector(".modal-overlay .input");
    document.querySelector(".modal-overlay .die-choice[data-face='5']")?.click();
    const v = await Promise.race([p, new Promise((r) => setTimeout(() => r("timeout"), 800))]);
    return { faces, typing, v, open: !!document.querySelector(".modal-overlay") };
  });
  if (one.faces !== 6) fail(`a d6 is entered from ${one.faces} faces, not six`);
  if (one.typing) fail("entering a die still opens a text field");
  if (one.v !== 5) fail(`tapping the 5 entered ${one.v}`);
  if (one.open) fail("the die dialog stays open after the only die is chosen");
  const two = await q(async () => {
    const ui = await import("../src/ui.js");
    const p = ui.pickDice("Test", 2);
    await new Promise((r) => setTimeout(r, 120));
    const rows = document.querySelectorAll(".modal-overlay .dice-pick").length;
    document.querySelectorAll(".modal-overlay .dice-pick")[0]?.querySelector(".die-choice[data-face='4']")?.click();
    await new Promise((r) => setTimeout(r, 60));
    const stillOpen = !!document.querySelector(".modal-overlay");
    document.querySelectorAll(".modal-overlay .dice-pick")[1]?.querySelector(".die-choice[data-face='3']")?.click();
    const v = await Promise.race([p, new Promise((r) => setTimeout(() => r("timeout"), 800))]);
    return { rows, stillOpen, v };
  });
  if (two.rows !== 2) fail(`two dice are entered from ${two.rows} rows of faces`);
  if (!two.stillOpen) fail("the dice dialog closed after only one of two dice");
  if (JSON.stringify(two.v) !== "[4,3]") fail(`tapping 4 then 3 entered ${JSON.stringify(two.v)}`);

  // 7, 8, 9. the joker, the doubles, the keyword gained
  const faces = await q(async () => {
    const { getPrompts } = await import("../src/roller.js");
    const P = getPrompts();
    const sets = [{ rank: "5", cards: [{ id: "a", rank: "5", suit: "S" }], description: "" }];
    const a = P.pickFalseLead(sets);
    await new Promise((r) => setTimeout(r, 120));
    const joker = !!document.querySelector(".modal-overlay .pcard.joker");
    document.querySelector(".modal-overlay .choice")?.click(); await a;
    const b = P.randomEvent({ words: ["Reveal", "old"], dice: [3, 3] });
    await new Promise((r) => setTimeout(r, 120));
    const doubles = document.querySelectorAll(".modal-overlay .die.doubles").length;
    document.querySelector(".modal-actions .btn")?.click(); await b;
    const c = P.describeKeyword({ suggestion: "Backdoor", oracle: "Hide · old" });
    await new Promise((r) => setTimeout(r, 120));
    const tag = !!document.querySelector(".modal-overlay .chip.tag.new");
    document.querySelector(".modal-actions .btn.ghost, .modal-actions .btn")?.click(); await c;
    return { joker, doubles, tag };
  });
  if (!faces.joker) fail("a joker is announced with no joker drawn");
  if (faces.doubles !== 2) fail(`doubles are announced with ${faces.doubles} dice showing`);
  if (!faces.tag) fail("a keyword is gained with no tag drawn for it");
  await closeAll();

  // 16. the tutorial as a route
  await page.goto(`${base}#/tutorial`);
  await page.waitForTimeout(300);
  const route = await q(() => ({ steps: document.querySelectorAll("#screen .route .route-step").length,
    glyphs: document.querySelectorAll("#screen .route .route-step .glyph").length }));
  if (route.steps !== 10 || route.glyphs !== 10) fail(`the tutorial's steps are a route of ${route.steps} with ${route.glyphs} glyphs`);

  // 18. theme options carry their sun and moon
  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(300);
  const themeGlyphs = await q(() => document.querySelectorAll("#screen .seg[aria-label='Theme'] .glyph").length);
  if (themeGlyphs !== 3) fail(`the theme options carry ${themeGlyphs} glyphs, not three`);

  // 12, 19. the sheet: attribute pips out of three, keywords as tags, obligations housed
  await page.goto(`${base}#/sheet`);
  await page.waitForTimeout(300);
  const sheet = await q(() => {
    const tiles = [...document.querySelectorAll("#screen .attr")];
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const inv = s.careers[s.activeId].investigators[0];
    return {
      pips: tiles.map((t) => t.querySelectorAll(".attr-pips .on").length),
      want: ["power", "insight", "method"].map((k) => inv.attributes[k]),
      slots: tiles.map((t) => t.querySelectorAll(".attr-pips > *").length),
      tags: document.querySelectorAll("#screen .chip.tag").length,
      houses: document.querySelectorAll("#screen .chip .glyph-obligation").length,
    };
  });
  if (JSON.stringify(sheet.pips) !== JSON.stringify(sheet.want)) fail(`attribute pips read ${sheet.pips} for values ${sheet.want}`);
  if (sheet.slots.some((n) => n !== 3)) fail("an attribute is not drawn out of its three slots");
  if (!sheet.tags) fail("keywords are chips, not tags");
  if (!sheet.houses) fail("obligations carry no house");

  // 13. careers: each benefit's cost as pips
  await page.goto(`${base}#/careers`);
  await page.waitForTimeout(300);
  if (!(await page.locator("#screen .cost-pips").count())) fail("experience costs are text with no pips");

  // 14. tables: every code as two dice, and a roll tumbles two
  await page.goto(`${base}#/tables`);
  await page.waitForTimeout(300);
  const d66 = await q(() => { const c = document.querySelector("#screen .table-row .code"); const d = c && c.querySelector(".d66-die");
    return { cls: c ? c.className : "", img: d ? getComputedStyle(d).backgroundImage : "none", dice: c ? c.querySelectorAll(".d66-die").length : 0 }; });
  if (!/d66/.test(d66.cls) || !/radial-gradient/.test(d66.img) || d66.dice !== 2) fail("a d66 code is a numeral, not two dice");
  await page.locator("#screen details.acc summary").first().click();
  await page.locator("#screen .btn", { hasText: "Roll 1d66" }).first().click();
  await page.waitForTimeout(400);
  if ((await page.locator("#screen .card .die").count()) < 2) fail("a table roll lands with no dice");
  // replaceChildren() writes a null out as the word "null"; a roll with no
  // filter note printed "nullnull" under its result.
  const rolled = await q(() => [...document.querySelectorAll("#screen .card")].find((c) => c.querySelector(".die"))?.innerText || "");
  if (/null/.test(rolled)) fail(`a table roll prints its missing notes as text: ${JSON.stringify(rolled.slice(-40))}`);

  // 17. the story: scenes open with their glyph
  await page.goto(`${base}#/journal`);
  await page.waitForTimeout(300);
  if (!(await page.locator("#screen .story-scene .glyph").count())) fail("a scene in the story opens with no mark of what kind it was");

  // 22. the active tab is drawn filled
  const tabFill = await q(() => { const p = document.querySelector('.tab[aria-current="page"] svg'); return p ? getComputedStyle(p).fill : "none"; });
  if (!tabFill || tabFill === "none") fail("the active tab's icon is drawn the same as the others");

  // 21. the printed sheets carry the drawings
  const printed = await q(async () => {
    const paper = await import("../src/paper.js");
    const { Store } = await import("../src/store.js");
    const h = paper.sheetsHtml(Store.career, Store.investigator, Store.mystery);
    return (h.match(/<svg/g) || []).length;
  });
  if (printed < 3) fail(`the printed sheets carry ${printed} drawings`);

  // 3, 6. the investigation roll and the rest, drawn
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId]; const m = c.mystery; m.scene = null; m.threats = []; m.ended = false; m.endTrigger = null;
    c.investigators[0].fatigue = 4; c.investigators[0].clock = 0;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(300);
  // The bar follows the guide's advice (tired: rest), so press the scene itself.
  await page.locator("#screen .choice", { hasText: /^Investigation/ }).first().click();
  let inv = null;
  for (let i = 0; i < 5 && !inv; i++) {
    await page.waitForTimeout(250);
    const t = await page.locator(".modal-title").innerText().catch(() => "");
    if (/^Investigation$/.test(t.trim())) {
      inv = await q(() => ({ die: !!document.querySelector(".modal-overlay .die"), strip: !!document.querySelector(".modal-overlay .roll-scale") }));
      break;
    }
    const ch = page.locator(".modal-overlay .choice").first();
    if (await ch.count()) await ch.click(); else break;
  }
  if (!inv || !inv.die || !inv.strip) fail("the investigation roll is a sum with no die and no strip");
  await closeAll();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId]; c.mystery.scene = null; c.mystery.threats = []; c.mystery.scenesPlayed = 3; c.mystery.ended = false;
    c.investigators[0].fatigue = 4; c.investigators[0].clock = 0;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(300);
  await page.locator("#screen .choice", { hasText: /^Rest/ }).first().click();
  await page.waitForTimeout(400);
  const rest = await q(() => ({ die: !!document.querySelector(".modal-overlay .die"),
    clearing: document.querySelectorAll(".modal-overlay .track .box.clearing").length }));
  if (!rest.die || !rest.clearing) fail("a rest clears fatigue with no die and no boxes emptying");
  await closeAll();

  // 4. a truth scene turns its cards over
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId]; c.mystery.scene = null; c.mystery.threats = []; c.mystery.scenesPlayed = 3; c.mystery.ended = false;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/clues`);
  await page.waitForTimeout(300);
  await page.locator(".action-bar .btn").click();
  await page.waitForTimeout(250);
  await page.locator(".modal-overlay .choice").first().click();
  await page.waitForTimeout(350);
  const turned = await q(() => ({ cards: document.querySelectorAll(".modal-overlay .reveal-row .pcard.flip").length,
    delays: [...document.querySelectorAll(".modal-overlay .reveal-row .pcard")].map((c) => getComputedStyle(c).animationDelay) }));
  if (!turned.cards) fail("a truth scene names its cards instead of turning them over");
  else if (turned.cards > 1 && new Set(turned.delays).size < 2) fail("a truth scene turns its cards over all at once");
  await closeAll();

  // 1, 11. the solve: the grid is the picker, and nothing under "Still unseen" lies
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const m = s.careers[s.activeId].mystery; m.ended = true; m.endTrigger = "chosen"; m.guesses = [null, null, null];
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.goto(`${base}#/solve`);
  await page.waitForTimeout(350);
  const solve = await q(() => {
    const know = [...document.querySelectorAll("#screen .card")].find((c) => /what you know/i.test(c.innerText));
    return { liarHand: know ? !!know.querySelector(".hand") : false, selects: document.querySelectorAll("#screen select").length,
      picks: document.querySelectorAll("#screen .face-grid.picker button").length };
  });
  if (solve.liarHand) fail("the ruled-out cards still sit under \"Still unseen\"");
  if (solve.selects) fail(`the guesses are still ${solve.selects} dropdowns`);
  if (solve.picks !== 12) fail(`the solve's card grid has ${solve.picks} cards to pick, not twelve`);
  const unseen = page.locator("#screen .face-grid.picker button:not(.ruled)");
  for (let i = 0; i < 3; i++) await unseen.nth(i).click();
  await page.waitForTimeout(200);
  const picked = await q(() => ({
    badges: [...document.querySelectorAll("#screen .face-grid.picker .guess-no")].map((b) => b.textContent.trim()).sort().join(","),
    stored: (() => { const s = JSON.parse(localStorage.getItem("citr:v1")); return s.careers[s.activeId].mystery.guesses.filter(Boolean).length; })(),
    ready: /all three named/i.test(document.querySelector(".action-bar")?.innerText || ""),
  }));
  if (picked.badges !== "1,2,3") fail(`three taps numbered the cards ${picked.badges || "not at all"}`);
  if (picked.stored !== 3) fail(`three taps stored ${picked.stored} guesses`);
  if (!picked.ready) fail("three cards picked and the reveal still says to guess first");
  await unseen.nth(1).click();
  await page.waitForTimeout(200);
  const back = await q(() => (() => { const s = JSON.parse(localStorage.getItem("citr:v1")); return s.careers[s.activeId].mystery.guesses.filter(Boolean).length; })());
  if (back !== 2) fail(`tapping a picked card again left ${back} guesses, not two`);

  if (errors.length) fail(`console error in the second graphics pass: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the dialogs are drawn, the dice are tapped, and the solve is picked from its cards");
  await ctx.close();
}

// 8af. the third graphics pass: typed glyphs drawn, the same state drawn the same way everywhere
{
  const { ctx, page, errors } = await newPage();
  const q = (fn, arg) => page.evaluate(fn, arg);
  const at = async (route, ms = 350) => { await page.goto(`${base}#/${route}`); await page.waitForTimeout(ms); };
  await seed(page, base, "stress", { rivals: true, career: true, theme: "light" });
  const n = (sel) => q((s) => document.querySelectorAll(s).length, sel);

  // 1, 19, 20. home: rival dice drawn flat, closed cases as tabs, the investigator drawn
  await at("home");
  const home = await q(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1")); const c = s.careers[s.activeId];
    return { rivals: c.rivals.length, history: Math.min(5, c.history.length),
      flat: [...document.querySelectorAll("#screen .rival-die .d66-die")].filter((d) => d.getBoundingClientRect().width >= 16).length,
      cubes: document.querySelectorAll("#screen .rival-die .die").length,
      tabs: document.querySelectorAll("#screen .case-tab").length,
      pips: document.querySelectorAll("#screen .inv-card .attr-pips").length,
      track: document.querySelectorAll("#screen .inv-card .fatigue-mini").length,
      clock: document.querySelectorAll("#screen .inv-card .clock").length };
  });
  if (home.flat !== home.rivals || home.cubes) fail(`rival slots: ${home.flat} flat dice drawn at size and ${home.cubes} broken cubes for ${home.rivals} rivals`);
  if (home.tabs !== home.history) fail(`closed cases: ${home.tabs} case tabs for ${home.history} cases`);
  if (home.pips !== 3 || !home.track || !home.clock) fail("the home investigator card is text, not pips, a track and a clock");

  // 6, 7, 8, 9. the frame: drawn header buttons, drawn disclosure, deck and card in the numbers, a toast with its mark
  const frame = await q(() => ({
    undo: !!document.querySelector("#undo-btn svg"), theme: !!document.querySelector("#theme-btn .glyph-sun"),
    typed: /[↶◑◗]/.test(document.querySelector(".header-tools").textContent),
    mark: !!document.querySelector(".coach-mark svg"),
    deck: !!document.querySelector("#resource-header .deck-stack"), card: !!document.querySelector("#resource-header .pcard"),
  }));
  if (!frame.undo || !frame.theme || frame.typed) fail("the header's undo and theme buttons are typed characters");
  if (!frame.mark) fail("the guide's mark is a typed ›");
  if (!frame.deck || !frame.card) fail("the clue deck and truths in the numbers are bare figures");
  await page.locator("#theme-btn").click();
  await page.waitForTimeout(150);
  if (!(await n("#theme-btn .glyph-moon"))) fail("the theme button does not show the theme it switched to");
  await page.locator("#theme-btn").click(); await page.locator("#theme-btn").click();
  await page.waitForTimeout(150);
  if (!(await n("#toast .glyph"))) fail("a toast is a line of text with no mark");

  // 10, 11, 12, 13, 3. play
  await at("play");
  const play = await q(() => ({
    nodes: document.querySelectorAll("#screen .stage-path .node .glyph").length,
    eyes: document.querySelectorAll("#screen .threat .threat-head .glyph-threat").length,
    threats: document.querySelectorAll("#screen .threat").length,
    h1: !!document.querySelector("#screen h1 .glyph"),
    framing: document.querySelectorAll("#screen .framing .btn .glyph").length,
    kw: [...document.querySelectorAll("#screen .card")].filter((c) => /keywords ready/i.test(c.querySelector(".card-title, h2, h3")?.textContent || ""))
      .flatMap((c) => [...c.querySelectorAll(".chip")]).map((c) => !!c.querySelector(".glyph")),
  }));
  if (play.nodes !== 4) fail(`the stage path draws ${play.nodes} of four stage marks`);
  if (!play.threats || play.eyes !== play.threats) fail("a threat card carries no mark of what it is");
  if (!play.h1) fail("the scene heading carries no scene mark");
  if (play.framing < 3) fail(`the framing buttons carry ${play.framing} glyphs`);
  if (!play.kw.length || play.kw.some((x) => !x)) fail("a keyword ready to spend is a bare chip");
  const disclosure = await q(() => { const s = document.querySelector("#screen details.acc > summary"); return s ? getComputedStyle(s, "::after").content : "none"; });
  if (/[+–]/.test(disclosure)) fail(`an accordion still opens on a typed ${disclosure}`);

  // 5. clues: a false lead shows the rank it was
  await at("clues");
  const torn = await q(() => [...document.querySelectorAll("#screen .clue-set.false")].map((s) => s.querySelector(".pcard.torn .rank")?.textContent || ""));
  if (!torn.length || torn.some((t) => !t)) fail("a false lead is a blank torn shape with no rank");

  // 4. the mystery sheet draws what the other screens draw
  await at("case-sheet");
  const sheet = await q(() => ({ marks: document.querySelectorAll("#screen .marks").length, bars: document.querySelectorAll("#screen .level-bars").length,
    rivalDice: document.querySelectorAll("#screen .d66-die").length, stacks: document.querySelectorAll("#screen .deck-stack").length }));
  if (!sheet.marks || !sheet.bars || !sheet.rivalDice || sheet.stacks < 3) fail(`the mystery sheet draws ${JSON.stringify(sheet)}`);

  // 21. careers
  await at("careers");
  if (!(await n("#screen .xp-tokens")) || !(await n("#screen .glyph-seal"))) fail("experience is a number and Current is a pill");

  // 22. oracles, before anything is asked
  await at("oracle");
  if ((await n("#screen .word-tile.blank")) < 2 || !(await n("#screen .idle-die"))) fail("the oracles show nothing until asked");

  // 23, 24. rules and tables
  await at("rules");
  const rules = await q(() => [...document.querySelectorAll("#screen .card")].filter((c) => c.querySelector("details.acc")).map((c) => !!c.querySelector(".card-title .glyph, h2 .glyph, h3 .glyph")));
  if (!rules.length || rules.some((x) => !x)) fail("a rules section has no mark");
  await at("tables");
  const tbl = await q(() => [...document.querySelectorAll("#screen details.acc > summary")].slice(0, 6).map((s) => !!s.querySelector(".glyph")));
  if (tbl.some((x) => !x)) fail("a genre table's header has no mark of what it holds");

  // 25, 26. journal: rolls as dice, the distribution as bars, the cast as cards
  await q(() => { const s = JSON.parse(localStorage.getItem("citr:v1")); s.careers[s.activeId].cast = [{ id: "p1", name: "The night supervisor", note: "Saw the van." }]; localStorage.setItem("citr:v1", JSON.stringify(s)); });
  await page.reload();
  await at("journal");
  if (!(await n("#screen .log-entry .dice-art"))) fail("the roll log writes its dice out as sums");
  if (!(await n("#screen .cast-card"))) fail("people and places are rows, not cards");
  await page.locator("#screen details.acc summary", { hasText: /Roll log/ }).click();
  await page.locator("#screen .btn", { hasText: "Face distribution" }).click();
  await page.waitForTimeout(200);
  const dist = await q(() => ({ bars: document.querySelectorAll(".modal-overlay .dist-bar").length, text: document.querySelector(".modal-overlay")?.innerText || "" }));
  if (dist.bars !== 6) fail(`the face distribution is ${dist.bars} bars, not six`);
  if (/typed in/.test(dist.text)) fail("the face distribution still says dice are typed in");
  await q(() => document.querySelectorAll(".modal-overlay").forEach((x) => x.remove()));

  // 2, 27, 28. settings
  await at("settings");
  await page.locator("#screen details.settings-more > summary").click();
  const set = await q(() => ({ rows: document.querySelectorAll("#screen .opt.switch").length, glyphs: document.querySelectorAll("#screen .opt.switch .glyph").length,
    typeCopy: /Type the faces/.test(document.querySelector("#screen").innerText),
    data: [...document.querySelectorAll("#screen .btn")].filter((b) => /Export backup|Import backup/.test(b.innerText)).map((b) => !!b.querySelector(".glyph")) }));
  if (set.typeCopy) fail("Manual dice still says to type the faces");
  if (!set.rows || set.glyphs !== set.rows) fail(`${set.glyphs} of ${set.rows} switches carry their mark`);
  if (set.data.length !== 2 || set.data.some((x) => !x)) fail("export and import have no arrows");

  // 29. the printed mystery sheet
  const printed = await q(async () => { const p = await import("../src/paper.js"); const { Store } = await import("../src/store.js"); return p.sheetsHtml(Store.career, Store.investigator, Store.mystery); });
  if (!/class="case-file"/.test(printed) || !/class="mk/.test(printed)) fail("the printed mystery sheet has no case file and no marks");

  // 30. the guide's sentence arrives when it changes, and only then
  await at("play");
  const arrive = await q(async () => {
    const r = await import("../src/router.js"); const { Store } = await import("../src/store.js");
    await r.render(); const still = !!document.querySelector(".coach-say.arrive, .coach-line.arrive");
    Store.update("test", () => { Store.mystery.scene = null; Store.mystery.threats = []; });
    await r.render(); const moved = !!document.querySelector(".coach-say.arrive, .coach-line.arrive");
    await r.render(); const again = !!document.querySelector(".coach-say.arrive, .coach-line.arrive");
    return { still, moved, again };
  });
  if (arrive.still || arrive.again) fail("the guide's sentence moves on a re-render that changed nothing");
  if (!arrive.moved) fail("a new step in the guide lands without arriving");

  // 14. the reveal stamps each turned card
  await q(() => { const s = JSON.parse(localStorage.getItem("citr:v1")); const m = s.careers[s.activeId].mystery;
    const a = m.setAside; m.ended = true; m.solved = true; m.guesses = [a[0], { rank: "J", suit: "S" }, a[2]];
    m.results = m.guesses.map((g, i) => ({ guess: g, correct: i !== 1 })); m.correct = 2;
    localStorage.setItem("citr:v1", JSON.stringify(s)); });
  await page.reload();
  await at("solve");
  const stamps = await q(() => ({ all: document.querySelectorAll("#screen .reveal .stamp").length, hit: document.querySelectorAll("#screen .reveal .stamp.hit").length }));
  if (stamps.all !== 3) fail(`the reveal stamps ${stamps.all} of three cards`);
  await ctx.close();

  // 15, 16, 17, 18. the wizards, from a blank app
  const w = await newPage();
  await seed(w.page, base, "fresh");
  await w.page.goto(`${base}#/wizard`); await w.page.waitForTimeout(300);
  const wz = await w.page.evaluate(() => ({ card: !!document.querySelector("#screen .index-card"), pips: document.querySelectorAll("#screen .seg .attr-pips").length }));
  if (!wz.card) fail("the investigator wizard has no index card filling in");
  if (wz.pips !== 9) fail(`the attribute choices draw ${wz.pips} pip sets, not nine`);
  await w.page.evaluate(async () => { const r = await import("../src/wizard.js"); r.expressStart(); });
  await w.page.goto(`${base}#/mystery`); await w.page.waitForTimeout(300);
  const put = await w.page.evaluate(async () => { const { Store } = await import("../src/store.js"); Store.update("drop", () => { Store.career.mystery = null; }); });
  void put;
  await w.page.goto(`${base}#/home`); await w.page.goto(`${base}#/mystery`); await w.page.waitForTimeout(300);
  const mz = await w.page.evaluate(() => ({ genre: document.querySelectorAll("#screen .seg[aria-label='Genre'] .glyph").length,
    preview: document.querySelectorAll("#screen .truth-preview .pcard").length, blanks: document.querySelectorAll("#screen .blank").length }));
  if (mz.genre !== 4) fail(`the genre options carry ${mz.genre} marks`);
  if (!mz.preview) fail("the difficulty is words, with no truth deck drawn");
  if (mz.blanks < 3) fail(`an unrolled problem shows ${mz.blanks} blanks`);
  await w.page.locator("#screen .btn", { hasText: "Roll all three" }).click();
  await w.page.waitForTimeout(250);
  if ((await w.page.locator("#screen .d66-die").count()) < 6) fail("a rolled problem lands with no dice");
  if (w.errors.length) fail(`console error in the wizards: ${w.errors[0].slice(0, 140)}`);
  await w.ctx.close();

  if (errors.length) fail(`console error in the third graphics pass: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("typed glyphs are drawn, and the same state is drawn the same way everywhere");
}

// 8ag. the fourth pass: the numbers answer a tap, the result dialog reads at a glance, nothing truncates
{
  const { ctx, page, errors } = await newPage(360);
  const q = (fn, arg) => page.evaluate(fn, arg);
  const at = async (route, ms = 350) => { await page.goto(`${base}#/${route}`); await page.waitForTimeout(ms); };
  const n = (sel) => q((s) => document.querySelectorAll(s).length, sel);
  // Typed dice, so the stage test below fails on 1 + 2 and always rolls a consequence.
  await seed(page, base, "mid-session", { career: true, rivals: true, manualDice: true, autoOracle: true });

  // 1. a segmented option never cuts its own label
  await at("journal");
  const cut = await q(() => [...document.querySelectorAll("#screen .seg-opt")].filter((o) => o.scrollWidth > o.clientWidth + 1 || [...o.querySelectorAll("*")].some((c) => c.scrollWidth > c.clientWidth + 1)).map((o) => o.textContent.trim()));
  if (cut.length) fail(`a segmented option truncates its label: ${cut.join(", ")}`);

  // 3, 6, 7, 8. the numbers: all five in view at 360, truths drawn filling, the clock's segments visible, a tap explains
  // (on a drawer: the Table draws the same numbers as its desk)
  await at("sheet");
  const bar = await q(() => {
    const host = document.querySelector("#resource-header"); const hr = host.getBoundingClientRect();
    const cells = [...host.querySelectorAll(".res")];
    // Colours come back with alpha; composite the stroke over what it is drawn on.
    const rgba = (c) => { const p = (c.match(/[\d.]+/g) || []).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
    const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
    const lum = (p) => { const f = p.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
    const seg = host.querySelector(".clock .seg-off");
    const under = over(rgba(getComputedStyle(host).backgroundColor), rgba(getComputedStyle(document.body).backgroundColor));
    const stroke = seg ? over(rgba(getComputedStyle(seg).stroke), under) : under;
    const [a, b] = [lum(stroke), lum(under)].sort((x, y) => y - x);
    return { hidden: cells.filter((c) => c.getBoundingClientRect().right > hr.right + 1).map((c) => c.textContent.trim().slice(0, 12)),
      truth: host.querySelector(".truth-card[role=img]")?.getAttribute("aria-label") || "", fill: !!host.querySelector(".truth-card .truth-fill"),
      segRatio: seg ? (a + 0.05) / (b + 0.05) : 0, buttons: host.querySelectorAll("button.res").length };
  });
  if (bar.hidden.length) fail(`the numbers hide ${bar.hidden.join(", ")} past the edge at 360px`);
  if (!/of/.test(bar.truth) || !bar.fill) fail("truths in the numbers are a blank card, not one filling as they are found");
  if (bar.segRatio < 3) fail(`the clock's empty segments are drawn at ${bar.segRatio.toFixed(2)}:1, under the 3:1 a graphic needs`);
  if (bar.buttons < 4) fail(`${bar.buttons} of the numbers answer a tap`);
  else {
    await page.locator("#resource-header button.res").first().click();
    await page.waitForTimeout(250);
    if (!(await n(".modal-overlay .rule-sheet"))) fail("tapping a number opens nothing about its rule");
    await q(() => document.querySelectorAll(".modal-overlay").forEach((x) => x.remove()));
  }

  // 13, 14, 9, 10, 11, 12. one stage test, dialog by dialog
  await at("play");
  await page.locator(".action-bar .btn").click();
  await page.waitForTimeout(300);
  const chooser = await q(() => { const cs = [...document.querySelectorAll(".modal-overlay .choice")];
    return { n: cs.length, odds: cs.filter((c) => c.querySelector(".odds-strip[role=img]")).length,
      pips: cs.filter((c) => { const p = c.querySelector(".attr-pips"); return p && p.getBoundingClientRect().width >= 18; }).length }; });
  if (!chooser.n || chooser.odds !== chooser.n || chooser.pips !== chooser.n) fail(`the attribute chooser draws ${chooser.odds} odds strips and ${chooser.pips} pip sets at size for ${chooser.n} options`);
  await page.locator(".modal-overlay .choice").first().click();
  let result = null, clueTiles = null;
  for (let i = 0; i < 10 && !result; i++) {
    await page.waitForTimeout(700);
    const st = await q(() => ({ title: document.querySelector(".modal-title")?.textContent || "", outcome: !!document.querySelector(".modal-overlay .outcome") }));
    if (st.outcome) {
      result = await q(() => {
        const lis = [...document.querySelectorAll(".modal-overlay .events li")];
        return { stamp: !!document.querySelector(".modal-overlay .outcome-stamp"),
          lis: lis.length, marked: lis.filter((l) => l.querySelector(".glyph")).length,
          cons: lis.filter((l) => /^Consequence/.test(l.textContent)).length,
          inline: lis.filter((l) => /^Consequence/.test(l.textContent) && l.querySelector(".roll-scale")).length,
          stray: document.querySelectorAll(".modal-overlay .modal-body > .roll-scale.consequence").length,
          sticky: getComputedStyle(document.querySelector(".modal-overlay .modal-actions")).position };
      });
      break;
    }
    const dice = page.locator(".modal-overlay .dice-pick");
    if (await dice.count()) { const f = [1, 2]; for (let r = 0; r < await dice.count(); r++) await dice.nth(r).locator(`.die-choice[data-face='${f[r]}']`).click(); continue; }
    const ch = page.locator(".modal-overlay .choice").first();
    if (await ch.count()) { await ch.click(); continue; }
    const b = page.locator(".modal-actions .btn").first(); if (await b.count()) await b.click(); else break;
  }
  if (!result) fail("a stage test never reached its result dialog, so its checks could not run");
  else {
    if (!result.stamp) fail("the outcome is a line of coloured text with no stamp");
    if (result.marked !== result.lis) fail(`${result.marked} of ${result.lis} event lines carry their mark`);
    if (result.inline !== result.cons || result.stray) fail("a consequence's strip sits apart from its line");
    if (result.sticky !== "sticky") fail("a long result dialog scrolls its buttons away");
  }
  if (!result || !result.cons) fail("a failed stage test rolled no consequence, so its strip could not be checked");
  await q(() => document.querySelectorAll(".modal-overlay").forEach((x) => x.remove()));
  clueTiles = await q(async () => {
    const { getPrompts } = await import("../src/roller.js");
    const p = getPrompts().describeClue({ set: { rank: "2", cards: [] }, card: { id: "c", rank: "2", suit: "D" }, oracle: "Demand · Abandoned · Insight", clue: "Anonymous phone call", isNew: true });
    await new Promise((r) => setTimeout(r, 150));
    const tiles = document.querySelectorAll(".modal-overlay .word-tile").length;
    document.querySelector(".modal-actions .btn.ghost")?.click(); await p;
    return tiles;
  });
  if (clueTiles !== 4) fail(`a new clue's prompts are drawn as ${clueTiles} tiles, not the clue and its three words`);

  // 15, 16. Why?: the four endings drawn, and the guess worth drawn
  await at("play");
  await openGuide(page);
  await page.locator(".coach .btn", { hasText: "Why?" }).click();
  await page.waitForTimeout(250);
  const why = await q(() => ({ meters: document.querySelectorAll(".modal-overlay .ending-meter").length, worth: !!document.querySelector(".modal-overlay .guess-worth") }));
  if (why.meters !== 4) fail(`Why? draws ${why.meters} of the four endings`);
  if (!why.worth) fail("what a guess is worth now is a sentence with nothing drawn");
  await q(() => document.querySelectorAll(".modal-overlay").forEach((x) => x.remove()));

  // 4. the picker's primary is the scene the guide names
  await q(() => { const s = JSON.parse(localStorage.getItem("citr:v1")); const m = s.careers[s.activeId].mystery; m.scene = null; m.threats = [];
    m.clueSets = { 7: { rank: "7", cards: [{ id: "x1", rank: "7", suit: "S" }, { id: "x2", rank: "7", suit: "H" }], entries: [], description: "", prompts: [], truth: false, falseLead: false, truthCards: [] } };
    localStorage.setItem("citr:v1", JSON.stringify(s)); });
  await page.reload(); await at("play");
  const pick = await q(() => ({ say: document.querySelector(".coach-line, .coach-say")?.textContent || "", bar: document.querySelector(".action-bar .btn")?.innerText || "" }));
  if (/Turn the/.test(pick.say) && !/Truth/.test(pick.bar)) fail(`the guide says "${pick.say.slice(0, 30)}…" while the bar offers ${pick.bar.split("\n")[0]}`);

  // 5. the oracle's idle tiles sit on one line
  await at("oracle");
  const tops = await q(() => { const ts = [...document.querySelectorAll("#screen .word-tile.blank")].map((t) => t.getBoundingClientRect().top);
    return ts.length ? 1 + ts.filter((t, i) => i && Math.abs(t - ts[i - 1]) > 4).length : 0; });
  if (tops !== 1) fail(`the idle oracle tiles wrap onto ${tops} lines`);

  // 17. search fields carry a lens
  for (const r of ["tables", "rules"]) {
    await at(r);
    if (!(await n("#screen .field .glyph-lens, #screen .search-field .glyph-lens"))) fail(`the ${r} search has no lens`);
  }

  // 2, 18. careers experience on one line; home attributes as one row of tiles
  await at("careers");
  const xp = await q(() => { const s = document.querySelector("#screen .xp-list .stacked"); if (!s) return 0;
    const kids = [...s.children].map((k) => Math.round(k.getBoundingClientRect().top + k.getBoundingClientRect().height / 2));
    const text = s.querySelector(":scope > span:not(.xp-tokens)"); return { mid: Math.max(...kids) - Math.min(...kids), lines: text ? text.getClientRects().length : 0 }; });
  if (!xp || xp.mid > 6 || xp.lines > 1) fail(`experience on Careers breaks across lines: ${JSON.stringify(xp)}`);
  await at("home");
  const tiles = await q(() => [...document.querySelectorAll("#screen .inv-card .attr-mini")].map((t) => Math.round(t.getBoundingClientRect().top)));
  if (tiles.length !== 3 || new Set(tiles).size !== 1) fail(`Home's attributes are ${tiles.length} tiles on ${new Set(tiles).size} lines`);

  // 19. a tab slides in from the side it lives on
  await page.locator(".tab", { hasText: "Notebook" }).click(); await page.waitForTimeout(80);
  const right = await q(() => document.querySelector("#screen").dataset.from || "");
  await page.locator(".tab", { hasText: "Table" }).click(); await page.waitForTimeout(80);
  const left = await q(() => document.querySelector("#screen").dataset.from || "");
  if (right !== "right" || left !== "left") fail(`tabs arrive from "${right}" and "${left}", not from their own side`);

  if (errors.length) fail(`console error in the fourth pass: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the numbers answer a tap, the result reads at a glance, and nothing truncates");
  await ctx.close();
}

// 8ah. every part that shows another part's state leads there, and every rule leads to its screen
{
  const { ctx, page, errors } = await newPage();
  const q = (fn, arg) => page.evaluate(fn, arg);
  const at = async (route, ms = 350) => { await page.goto(`${base}#/${route}`); await page.waitForTimeout(ms); };
  const hrefs = () => q(() => [...document.querySelectorAll("#screen a.xlink, #screen a.case-strip, #screen a.desk-item")].map((a) => a.getAttribute("href")));
  await seed(page, base, "stress", { career: true, rivals: true });
  const { RULES_LIBRARY } = await q(async () => ({ RULES_LIBRARY: (await import("../src/library.js")).RULES_LIBRARY.flatMap((g) => g.entries.map((e) => e.id)) }));
  const ruleIds = new Set(RULES_LIBRARY);

  // 1. the screens that automate a rule link back to it, and only to rules that exist
  const wantRule = { play: ["stages", "threats", "keywords"], clues: ["clues", "truths", "jokers"], sheet: ["fatigue", "clock", "keywords", "obligation"],
    careers: ["career"], home: ["rivals"], journal: ["solo-record"], oracle: ["solo-questions"] };
  for (const [route, ids] of Object.entries(wantRule)) {
    await at(route);
    const got = (await hrefs()).filter((h) => h.startsWith("#/rules?rule=")).map((h) => h.split("=")[1]);
    const missing = ids.filter((id) => !got.includes(id));
    if (missing.length) fail(`${route} does not link to its rule${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
    const bad = got.filter((id) => !ruleIds.has(id));
    if (bad.length) fail(`${route} links to rules that do not exist: ${bad.join(", ")}`);
  }
  // …and following one opens that entry
  await at("play");
  const stagesLink = page.locator('#screen a.xlink[href="#/rules?rule=stages"]').first();
  if (await stagesLink.count()) {
    // A section's links fold under its "More".
    await stagesLink.evaluate((a) => { const d = a.closest("details"); if (d) d.open = true; });
    await stagesLink.click(); await page.waitForTimeout(400);
  }
  if (!(await q(() => !!document.querySelector("#rule-stages[open]")))) fail("following a rule link does not open that rule");

  // 2. the mystery sheet leads to where each part of it is played
  await at("case-sheet");
  const cs = await hrefs();
  for (const r of ["#/clues", "#/play", "#/home"]) if (!cs.includes(r)) fail(`the mystery sheet has no way to ${r}`);
  // 3. Home: the problem to the whole sheet, the clue sets to Clues
  await at("home");
  const hm = await hrefs();
  for (const r of ["#/case-sheet", "#/clues"]) if (!hm.includes(r)) fail(`Home has no way to ${r}`);
  // 4. Play: the problem to the sheet, the keywords to the investigator
  await at("play");
  const pl = await hrefs();
  for (const r of ["#/case-sheet", "#/sheet"]) if (!pl.includes(r)) fail(`Play has no way to ${r}`);

  // 5. every rule names the screen that does it, and that screen exists
  await at("rules");
  const rl = await q(() => [...document.querySelectorAll("#screen details.acc[id^='rule-']")].map((d) => ({ id: d.id, href: d.querySelector("a.xlink")?.getAttribute("href") || "" })));
  const routes = (await import("./routes.mjs")).ROUTES;
  const noLink = rl.filter((r) => !r.href).map((r) => r.id);
  const dead = rl.filter((r) => r.href && !routes.includes(r.href.replace(/^#\//, "").split("?")[0])).map((r) => r.id);
  if (noLink.length) fail(`${noLink.length} rules lead nowhere in the app: ${noLink.slice(0, 4).join(", ")}…`);
  if (dead.length) fail(`rules link to screens that do not exist: ${dead.join(", ")}`);

  // 6. the tutorial's steps lead to their screens
  await at("tutorial");
  const tu = await q(() => [...document.querySelectorAll("#screen .route-step")].map((s) => s.querySelector("a.xlink")?.getAttribute("href") || ""));
  if (tu.length !== 10 || tu.some((h) => !h)) fail(`${tu.filter(Boolean).length} of ${tu.length} tutorial steps lead to their screen`);

  // 7. the story leads back to where its lines were made
  await q(() => { const s = JSON.parse(localStorage.getItem("citr:v1")); const c = s.careers[s.activeId];
    c.journal.push({ id: "j1", ts: Date.now(), kind: "scene", text: "The shutters were down.", day: 99, scene: "investigation" },
      { id: "j2", ts: Date.now(), kind: "oracle", text: "Asked the oracle: Hide · old", day: 99, scene: "investigation" });
    localStorage.setItem("citr:v1", JSON.stringify(s)); });
  await page.reload();
  await at("journal");
  const jr = await q(() => ({ scenes: document.querySelectorAll("#screen .story-scene").length, linked: document.querySelectorAll('#screen .story-scene a.xlink[href="#/play"]').length,
    oracles: document.querySelectorAll("#screen .story-oracle").length, oracleLinked: document.querySelectorAll('#screen .story-oracle a.xlink[href="#/oracle"]').length }));
  if (!jr.scenes || jr.linked !== jr.scenes) fail(`${jr.linked} of ${jr.scenes} scenes in the story lead back to Play`);
  if (!jr.oracles || jr.oracleLinked !== jr.oracles) fail(`${jr.oracleLinked} of ${jr.oracles} oracle lines lead to the Oracles`);

  if (errors.length) fail(`console error in the links pass: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("every part that shows another's state leads there, and every rule leads to its screen");
  await ctx.close();
}

// 8ai. the redesign: the Table and the Moment
{
  const { ctx, page, errors } = await newPage(360);
  const q = (fn, arg) => page.evaluate(fn, arg);
  const at = async (route, ms = 400) => { await page.goto(`${base}#/${route}`); await page.waitForTimeout(ms); };
  const n = (sel) => q((s) => document.querySelectorAll(s).length, sel);
  await seed(page, base, "mid-session", { career: true, rivals: true });

  // the shell: three tabs, a gear, no sub-tab bars, every drawer leads back to the table
  await at("play");
  const tabs = await q(() => [...document.querySelectorAll(".tab")].map((t) => t.querySelector("span:not(.badge):not(.tab-icon)")?.textContent.trim()));
  if (JSON.stringify(tabs) !== JSON.stringify(["Table", "Notebook", "Book"])) fail(`the tabs are ${tabs.join(", ")}`);
  if (!(await n("#settings-btn"))) fail("there is no gear for Settings in the header");
  const routes = (await import("./routes.mjs")).ROUTES;
  const TABBED = ["play", "journal", "rules", "tables", "oracle"];
  for (const r of routes) {
    await at(r, 250);
    if (await n("#screen .section-nav")) fail(`${r} still carries a sub-tab bar`);
    // A drawer off the Table leads back to it; the Book's own drawers back to the Book.
    const home = ["careers", "tutorial"].includes(r) ? "#/rules" : "#/play";
    if (!TABBED.includes(r) && !(await n(`#screen a.drawer-back[href="${home}"]`))) fail(`${r} has no way back to where it opened from`);
    if (["rules", "tables", "oracle"].includes(r) && (await n("#screen .book-switch .seg-opt")) !== 3) fail(`${r} is not switchable inside the Book`);
  }

  // the Table: case strip, a desk of four objects, no numbers bar, the guide beside Next
  await at("play");
  const table = await q(() => ({
    strip: document.querySelector('#screen a.case-strip[href="#/case-sheet"]') ? 1 : 0,
    genreArt: !!document.querySelector("#screen .case-strip .genre-art"),
    desk: [...document.querySelectorAll("#screen .desk .desk-item")].map((d) => d.getAttribute("href") || d.tagName),
    bar: !document.querySelector("#resource-header")?.hidden,
    topGuide: !!document.querySelector("#screen > .coach"),
    nextGuide: !!document.querySelector("#action-host .coach"),
    muted: [...document.querySelectorAll("#screen p.small.muted")].filter((p) => p.offsetParent && !p.closest("details:not([open])") && !p.closest(".modal-overlay")).length,
  }));
  if (!table.strip) fail("the Table has no case strip leading to the mystery sheet");
  if (!table.genreArt) fail("the case strip carries no genre art");
  if (table.desk.length !== 4) fail(`the desk holds ${table.desk.length} objects, not four`);
  if (table.bar) fail("the numbers bar sits over the Table, which already shows them as objects");
  if (table.topGuide || !table.nextGuide) fail("the guide is a card at the top, not a line beside Next");
  if (table.muted) fail(`the Table shows ${table.muted} helper paragraphs at once`);

  // the picker as tiles, two to a row
  await q(() => { const s = JSON.parse(localStorage.getItem("citr:v1")); const m = s.careers[s.activeId].mystery; m.scene = null; m.threats = []; localStorage.setItem("citr:v1", JSON.stringify(s)); });
  await page.reload(); await at("play");
  const tiles = await q(() => [...document.querySelectorAll("#screen .choice-list.tiles .choice")].map((c) => Math.round(c.getBoundingClientRect().top)));
  if (tiles.length !== 4 || new Set(tiles).size !== 2) fail(`the scene picker is ${tiles.length} tiles on ${new Set(tiles).size} rows, not four in two`);

  // a Moment: a stage test fills the screen and reads as one big word with dealt cards
  await q(() => { const s = JSON.parse(localStorage.getItem("citr:v1")); s.careers[s.activeId].mystery = null; localStorage.setItem("citr:v1", JSON.stringify(s)); });
  await seed(page, base, "mid-session", { career: true, rivals: true, manualDice: true });
  await at("play");
  await page.locator(".action-bar .btn").first().click();
  await page.waitForTimeout(300);
  const moment = await q(() => { const c = document.querySelector(".modal-overlay .modal-card"); return c ? { full: c.getBoundingClientRect().height >= innerHeight * 0.9, moment: !!document.querySelector(".modal-overlay.moment") } : null; });
  if (!moment || !moment.full || !moment.moment) fail("a decision is a small dialog, not a full-screen moment");
  await page.locator(".modal-overlay .choice").first().click();
  let result = null;
  for (let i = 0; i < 10 && !result; i++) {
    await page.waitForTimeout(600);
    if (await n(".modal-overlay .outcome")) {
      result = await q(() => ({ big: !!document.querySelector(".modal-overlay .outcome-big"),
        dealt: document.querySelectorAll(".modal-overlay .events.dealt li").length, lis: document.querySelectorAll(".modal-overlay .events li").length }));
      break;
    }
    const dice = page.locator(".modal-overlay .dice-pick");
    if (await dice.count()) { const f = [1, 2]; for (let r = 0; r < await dice.count(); r++) await dice.nth(r).locator(`.die-choice[data-face='${f[r]}']`).click(); continue; }
    const ch = page.locator(".modal-overlay .choice").first(); if (await ch.count()) { await ch.click(); continue; }
    const b = page.locator(".modal-actions .btn").first(); if (await b.count()) await b.click(); else break;
  }
  if (!result) fail("the stage test never reached its result");
  else {
    if (!result.big) fail("the result does not say its outcome in one big word");
    if (!result.lis || result.dealt !== result.lis) fail("the result's events are a list, not dealt cards");
  }
  await q(() => document.querySelectorAll(".modal-overlay").forEach((x) => x.remove()));

  // drawers: the investigator is a card that flips; clues are on a corkboard
  await at("sheet");
  const flip = await q(() => !!document.querySelector("#screen .inv-flip .inv-front") && !!document.querySelector("#screen .inv-flip .inv-back"));
  if (!flip) fail("the investigator is a page of sections, not a card with a front and back");
  else {
    await page.locator("#screen .inv-flip-btn").first().click();
    await page.waitForTimeout(200);
    if (!(await n("#screen .inv-flip.flipped"))) fail("the investigator card does not turn over");
  }
  await at("clues");
  if (!(await n("#screen .corkboard"))) fail("the clue sets are not pinned to a corkboard");
  // the numbers lose their labels, not their meaning
  const labels = await q(() => [...document.querySelectorAll("#resource-header .res > span:not(.res-top), #resource-header .res-stack > span")].filter((s) => s.offsetParent).length);
  if (labels) fail(`the numbers still print ${labels} labels`);

  // Settings in two groups, the rest folded; dark by default
  await at("settings");
  const set = await q(() => ({ titles: [...document.querySelectorAll("#screen .card-title")].map((t) => t.textContent.trim()) }));
  for (const t of ["Game rules", "Look"]) if (!set.titles.some((x) => x.startsWith(t))) fail(`Settings has no "${t}" group`);
  const theme = await q(async () => (await import("../src/settings.js")).Settings.defaults().theme);
  if (theme !== "dark") fail(`the default theme is ${theme}, not the night case`);

  // a first session: the Next button is pointed at
  if (!(await q(async () => { const { Store } = await import("../src/store.js"); return Store.career.history.length === 0; }))) {
    await q(() => { const s = JSON.parse(localStorage.getItem("citr:v1")); s.careers[s.activeId].history = []; localStorage.setItem("citr:v1", JSON.stringify(s)); });
    await page.reload();
  }
  await at("play");
  if (!(await n(".action-bar.hint"))) fail("a first session does not point at the Next button");

  // the dock grows with what the guide says; the page's foot still clears it
  for (const open of [false, true]) {
    await q(() => { const s = JSON.parse(localStorage.getItem("citr:v1")); const c = s.careers[s.activeId]; c.investigators[0].fatigue = 4; c.mystery.scene = null; localStorage.setItem("citr:v1", JSON.stringify(s)); });
    await page.reload(); await at("play");
    if (open) await openGuide(page);
    await page.waitForTimeout(250);
    const gap = await q(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const kids = [...document.querySelectorAll("#screen > *")].filter((k) => k.getClientRects().length);
      const last = kids[kids.length - 1].getBoundingClientRect().bottom;
      return Math.round(document.querySelector("#action-host").getBoundingClientRect().top - last);
    });
    if (gap < 0) fail(`with the guide ${open ? "opened" : "warning"}, the foot of the Table sits ${-gap}px under the dock`);
  }
  await ctx.close();

  // a blank app opens on three panels, not a page of text
  const b = await newPage(360);
  await seed(b.page, base, "fresh");
  await b.page.goto(`${base}#/play`); await b.page.waitForTimeout(400);
  const intro = await b.page.evaluate(() => document.querySelectorAll("#screen .intro-panel").length);
  if (intro !== 3) fail(`a blank app opens on ${intro} intro panels, not three`);
  await b.ctx.close();

  if (errors.length) fail(`console error in the redesign: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("the Table, the Moment, three tabs and drawers");
}

// 8ae. the first paint is the icon, not a blank screen
{
  const html = (await import("node:fs")).readFileSync(new URL("../index.html", import.meta.url), "utf8");
  if (!/class="splash"/.test(html)) fail("the app opens on a blank screen until its scripts load");
  const { ctx, page } = await newPage();
  await seed(page, base, "stress");
  await page.goto(`${base}#/home`);
  await page.waitForTimeout(400);
  if (await page.locator("#screen .splash").count()) fail("the splash outlives the first render");
  if (!failures.length) ok("launch shows the icon, and the first render replaces it");
  await ctx.close();
}

// 9. a roll keeps your place on the screen
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "stress");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(200);
  const room = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (room < 200) fail(`the play screen is too short to test scrolling (${room}px of scroll)`);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.scrollY);
  // Act against a threat: the scene carries on, so the screen keeps its length.
  await page.getByRole("button", { name: "Act against it" }).first().click();
  for (let i = 0; i < 6; i++) {
    await page.waitForSelector(".modal-overlay", { timeout: 1500 }).catch(() => {});
    const ch = page.locator(".modal-overlay .choice").first();
    const act = page.locator(".modal-actions .btn").first();
    if (await ch.count()) await ch.click();
    else if (await act.count()) await act.click();
    else break;
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(300);
  const { after, max } = await page.evaluate(() => ({
    after: window.scrollY,
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  }));
  // Keep where you were, or as close as a shorter screen allows.
  const expected = Math.min(before, max);
  if (before < 200) fail(`the page did not scroll before the roll (${before})`);
  else if (after < expected - 8) fail(`a roll threw the screen back up (${before} -> ${after}, ${max} available)`);
  else if (!errors.length) ok("a roll keeps your place on the screen");
  if (errors.length) fail(`console error during the roll: ${errors[0].slice(0, 120)}`);
  await ctx.close();
}

// 8aj. a toast goes away, and never sits on the button it is about
// A toast used to "hide" by sliding down 150% of its own height — less than the
// height it was lifted above the dock — so it stayed on the Next button for good.
{
  const { ctx, page, errors } = await newPage(390);
  for (const fixture of ["fresh", "mid-session"]) {
    await seed(page, base, fixture);
    await page.goto(`${base}#/play`);
    await page.waitForTimeout(400);
    await page.evaluate(async () => (await import("../src/ui.js")).showToast("Everything erased."));
    await page.waitForTimeout(300);
    const shown = await page.evaluate(() => {
      const t = document.querySelector("#toast").getBoundingClientRect();
      const dock = document.querySelector("#action-host").getBoundingClientRect();
      return { overlap: Math.round(t.bottom - dock.top), h: t.height };
    });
    if (shown.overlap > 0) fail(`on ${fixture} the toast covers the dock by ${shown.overlap}px`);
    await page.waitForTimeout(3800);
    const gone = await page.evaluate(() => {
      const t = document.querySelector("#toast"), cs = getComputedStyle(t), r = t.getBoundingClientRect();
      const visible = cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && r.top < innerHeight && r.bottom > 0;
      return visible;
    });
    if (gone) fail(`on ${fixture} the toast is still on screen 4 seconds later`);
  }
  if (errors.length) fail(`console error in the toast check: ${errors[0].slice(0, 140)}`);
  if (!failures.length) ok("a toast clears the dock and goes away");
  await ctx.close();
}

// 10. the two clean slates: put down the case, and erase everything
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "party", { multiplayer: true, career: true });
  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(150);
  await page.locator("#screen details.settings-more > summary").click();
  await page.getByRole("button", { name: "Put down this case" }).click();
  await page.waitForTimeout(200);
  await page.locator(".modal-actions .btn").first().click();
  await page.waitForTimeout(300);
  const kept = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    return { mystery: c.mystery, party: c.investigators.length, journal: c.journal.length, carry: c.carryDanger };
  });
  if (kept.mystery !== null) fail("putting down the case left the mystery behind");
  if (kept.party !== 2) fail(`putting down the case took the investigators with it (${kept.party} left)`);
  if (!kept.journal) fail("putting down the case wiped the journal");
  if (kept.carry) fail("an unfinished case carried danger forward");

  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(150);
  await page.locator("#screen details.settings-more > summary").click();
  await page.getByRole("button", { name: "Erase everything" }).click();
  await page.waitForTimeout(200);
  await page.locator(".modal-actions .btn").first().click();   // erase it all
  await page.waitForTimeout(200);
  await page.locator(".modal-actions .btn").first().click();   // last chance
  await page.waitForTimeout(400);
  const gone = await page.evaluate(() => {
    const raw = localStorage.getItem("citr:v1");
    const s = raw ? JSON.parse(raw) : { careers: {} };
    return { careers: Object.keys(s.careers || {}).length, multiplayer: JSON.parse(localStorage.getItem("citr:v1:settings") || "{}").multiplayer };
  });
  if (gone.careers) fail(`erasing everything left ${gone.careers} career(s)`);
  if (gone.multiplayer) fail("erasing everything left the settings as they were");
  const text = await page.locator("#screen").innerText();
  if (!/start playing|make an investigator/i.test(text)) fail("after erasing, the app does not offer a fresh start");
  if (errors.length) fail(`console error while clearing data: ${errors[0].slice(0, 120)}`);
  if (!gone.careers && !gone.multiplayer) ok("put down the case keeps the people; erase everything keeps nothing");
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} failed` : "\nsmoke clean");
process.exit(failures.length ? 1 : 0);
