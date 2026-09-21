// Browser smoke: every route renders, nothing overflows, no stray null text,
// no console errors, and the end-to-end walk works.
import { chromium } from "playwright-core";
import { serve, launch, seed } from "./server.mjs";

const ROUTES = ["home", "sheet", "journal", "play", "clues", "solve", "tables", "oracle", "rules", "tutorial", "careers", "settings", "wizard", "mystery"];
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
    const header = await page.locator("#resource-header").innerText();
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
    const hits = await page.evaluate(() => {
      const bad = [];
      for (const n of document.querySelectorAll("#screen .btn, #screen .chip, #screen .box, #screen label.opt, #screen .section-nav a, .tab")) {
        const r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (Math.min(r.width, r.height) < 24) bad.push(`${n.className}:${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      for (const i of document.querySelectorAll("#screen input:not([type=checkbox]):not([type=radio]), #screen select, #screen textarea")) {
        if (parseFloat(getComputedStyle(i).fontSize) < 16) bad.push(`input font ${getComputedStyle(i).fontSize}`);
      }
      return bad;
    });
    if (hits.length) small.push(`${route}: ${hits.slice(0, 3).join(", ")}`);
  }
  if (small.length) fail("small targets — " + small.join(" | "));
  else ok("every tap target clears 24px and inputs are 16px");
  await ctx.close();
}

// 5. section nav reaches every sibling and marks the current route
{
  const { ctx, page } = await newPage();
  await withSeed(page, true);
  await page.goto(`${base}#/home`);
  const links = await page.locator(".section-nav a").count();
  if (links < 3) fail(`case group section nav has ${links} links`);
  const current = await page.locator('.section-nav a[aria-current="page"]').count();
  if (current !== 1) fail("section nav does not mark exactly one current route");
  ok("section nav reaches siblings and marks the current route");
  await ctx.close();
}

// 6. end-to-end: create an investigator, start a mystery, run a scene, take a clue
{
  const { ctx, page, errors } = await newPage();
  await withSeed(page, false);
  await page.goto(`${base}#/wizard`);
  await page.getByRole("button", { name: "2", exact: true }).first().click();
  await page.locator(".defrow").nth(1).getByRole("button", { name: "1", exact: true }).click();
  await page.locator(".defrow").nth(2).getByRole("button", { name: "0", exact: true }).click();
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
  const header = await page.locator("#resource-header").innerText();
  if (!/danger/i.test(header)) fail("the resource header is missing in play");
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
  const dice = page.locator(".modal-overlay .input").first();
  await dice.waitFor({ timeout: 2000 });
  await dice.fill("6 6");                                     // a certain success
  await page.locator(".modal-actions .btn").first().click();
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
    const text = await framing.innerText();
    if (!/where is this scene taking place/i.test(text)) fail("the framing card does not carry the book's questions");
    if (!(await framing.evaluate((n) => n.open))) fail("the framing card starts collapsed on an unset scene");
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

  const header = await page.locator("#resource-header").innerText();
  if (!/AMINE|Amine/i.test(header)) fail("the header does not say who is in context");

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
    const gaps = boxes.slice(1).map((b, i) => Math.round(b.top - boxes[i].bottom));
    return { count: boxes.length, widths, gaps };
  });
  if (!geo) fail("the scene picker offered fewer than two choices");
  else {
    if (new Set(geo.widths).size !== 1) fail(`the choices are different widths (${geo.widths.join(", ")})`);
    if (geo.gaps.some((g) => g < 4)) fail(`the choices are clumped together (gaps ${geo.gaps.join(", ")}px)`);
    if (!failures.length) ok("the scene picker reads as a list: one width, real gaps");
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

  // Mid-scene the premise folds away; between scenes it is a card again.
  await seed(page, base, "mid-session");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(180);
  const folded = await page.evaluate(() => {
    const d = [...document.querySelectorAll("#screen details")].find((n) => /The problem/.test(n.querySelector("summary").textContent));
    return d ? { open: d.open } : null;
  });
  if (!folded) fail("mid-scene the premise is not folded away");
  else if (folded.open) fail("the premise fold starts open mid-scene");

  await patch("(c) => { c.mystery.scene = null; c.mystery.threats = []; }");
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(180);
  const premise = await page.evaluate(() => !!document.querySelector("#screen .card .premise"));
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
    if (await input.count()) {
      await input.fill(/Enter your dice/i.test(title) ? "1 1" : /Enter your die/i.test(title) ? "1" : "A line written at the table.");
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
        if (await input.count()) {
          await input.fill(/Enter your dice/i.test(title) ? "6 6" : /Enter your die/i.test(title) ? "1" : "A line written at the table.");
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

// 10. the two clean slates: put down the case, and erase everything
{
  const { ctx, page, errors } = await newPage();
  await seed(page, base, "party", { multiplayer: true, career: true });
  await page.goto(`${base}#/settings`);
  await page.waitForTimeout(150);
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
  if (!/create an investigator/i.test(text)) fail("after erasing, the app does not offer a fresh start");
  if (errors.length) fail(`console error while clearing data: ${errors[0].slice(0, 120)}`);
  if (!gone.careers && !gone.multiplayer) ok("put down the case keeps the people; erase everything keeps nothing");
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} failed` : "\nsmoke clean");
process.exit(failures.length ? 1 : 0);
