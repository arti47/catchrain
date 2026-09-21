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

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} failed` : "\nsmoke clean");
process.exit(failures.length ? 1 : 0);
