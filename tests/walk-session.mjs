// Flow walk: play a whole session through the app and print the path, so a
// terminal state with no onward route, or a step that needs a screen you have
// never opened, shows up as a line rather than as a feeling.
import { chromium } from "playwright-core";
import { serve, launch, seed } from "./server.mjs";

const { server, port } = await serve();
const browser = await launch(chromium);
const base = `http://127.0.0.1:${port}/index.html`;
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => { window.addEventListener("unhandledrejection", (e) => console.error("rejection: " + (e.reason && e.reason.message || e.reason))); });

let taps = 0;
const findings = [];
const played = new Set();
// Scene types in the order a real session reaches for them. A type is only
// taken when the picker is actually up, so ending a scene never eats a turn.
const queue = ["Rest", "Obligation", "Truth"];
const state = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("citr:v1") || "{}");
  const c = s.careers && s.activeId ? s.careers[s.activeId] : null;
  if (!c) return { none: true };
  const inv = (c.investigators || []).find((i) => i.id === c.activeInvestigatorId) || (c.investigators || [])[0];
  if (!inv) return { none: true };
  const m = c.mystery;
  return {
    day: inv.day, clock: inv.clock, fatigue: inv.fatigue, party: c.investigators.length,
    danger: m && m.danger, deck: m && m.clueDeck.length, sets: m ? Object.keys(m.clueSets).length : 0,
    truths: m ? m.truthRevealed.length : 0, ended: m && m.ended, trigger: m && m.endTrigger, solved: m && m.solved,
    log: c.rollLog.slice(-3).map((r) => `${r.kind}:${(r.dice||[]).join("+")}=${r.total}:${r.outcome||""}`),
    scene: m && m.scene ? `${m.scene.type}:${m.scene.stage || "-"}${m.scene.done ? " done" : ""}` : "none",
    history: c.history.length, xp: c.xp,
  };
});
const tap = async (locator, what) => {
  taps++;
  await locator.click({ timeout: 4000 }).catch((e) => findings.push(`could not tap ${what}: ${e.message.split("\n")[0]}`));
  await page.waitForTimeout(90);
};
const clearDialogs = async (max = 8) => {
  for (let i = 0; i < max; i++) {
    const choice = page.locator(".modal-overlay .choice").first();
    const input = page.locator(".modal-overlay .input").first();
    const act = page.locator(".modal-actions .btn").first();
    if (await choice.count()) { await choice.click(); }
    else if (await input.count()) { await input.fill("A note written during the walk."); await act.click(); }
    else if (await act.count()) { await act.click(); }
    else return;
    await page.waitForTimeout(70);
  }
};
const log = async (label) => console.log(label.padEnd(38) + JSON.stringify(await state()));

await seed(page, base, "fresh");

// creation
await page.goto(`${base}#/wizard`);
await tap(page.getByRole("button", { name: "2", exact: true }).first(), "power 2");
await tap(page.locator(".defrow").nth(1).getByRole("button", { name: "1", exact: true }), "insight 1");
await tap(page.locator(".defrow").nth(2).getByRole("button", { name: "0", exact: true }), "method 0");
await tap(page.locator(".action-bar .btn"), "next");
await tap(page.getByRole("button", { name: "Roll one" }), "roll obligation");
await tap(page.locator(".action-bar .btn"), "next");
await tap(page.getByRole("button", { name: "Roll one" }), "roll signature");
await tap(page.locator(".action-bar .btn"), "next");
await tap(page.getByRole("button", { name: "Roll a name" }), "roll name");
await tap(page.getByRole("button", { name: "Roll a trait" }), "roll trait");
await tap(page.locator(".action-bar .btn"), "create");
await tap(page.getByRole("button", { name: "Roll all three" }), "roll problem");
await tap(page.getByRole("button", { name: "Roll one" }), "roll motivation");
await tap(page.locator(".action-bar .btn"), "start mystery");
await log("after creation");

// play scenes until the mystery ends or twelve scenes pass
for (let scene = 0; scene < 12; scene++) {
  const s = await state();
  if (s.ended) break;
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(90);
  const bar = page.locator(".action-bar .btn");
  if (!(await bar.count())) { findings.push(`no action on the play screen (scene ${scene})`); break; }
  const label = (await bar.innerText()).split("\n")[0];
  if (/End the scene/.test(label)) { await tap(bar, "end scene"); await clearDialogs(); continue; }
  if (/Resolve/.test(label)) break;
  // Mix the scene types the way a session does. The picker's buttons carry
  // their explanation, so match the heading, not the whole accessible name.
  const pick = (name) => page.locator("#screen .choice", { has: page.locator(".choice-label", { hasText: new RegExp(`^${name}$`) }) }).first();
  const want = queue.length && (await pick(queue[0]).count()) ? queue.shift() : null;
  if (want) {
    await tap(pick(want), `${want.toLowerCase()} scene`);
    await clearDialogs();
    played.add(want);
  } else {
    await tap(bar, "investigation scene");
    await clearDialogs();
    for (let step = 0; step < 10; step++) {
      const b = page.locator(".action-bar .btn");
      if (!(await b.count())) break;
      const l = (await b.innerText()).split("\n")[0];
      if (/End the scene|Resolve|Investigation scene/.test(l)) break;
      await tap(b, l);
      await clearDialogs();
    }
  }
  await log(`scene ${scene}`);
  const b2 = page.locator(".action-bar .btn");
  if (await b2.count() && /End the scene/.test((await b2.innerText()).split("\n")[0])) {
    await tap(b2, "end scene");
    await clearDialogs();
  }
}
await log("after the scenes");

// the solve, however the mystery got here
await page.goto(`${base}#/play`);
await page.waitForTimeout(90);
if (!(await state()).ended) {
  const resolve = page.getByRole("button", { name: "Resolve the mystery" }).first();
  if (await resolve.count()) { await tap(resolve, "resolve"); await clearDialogs(); }
}
await page.goto(`${base}#/solve`);
await page.waitForTimeout(120);
const selects = page.locator("#screen select");
const n = await selects.count();
if (n !== 3) findings.push(`the solve offers ${n} guess pickers, expected 3`);
for (let i = 0; i < n; i++) { await selects.nth(i).selectOption({ index: 1 + i }); taps++; }
await tap(page.locator(".action-bar .btn"), "reveal");
await clearDialogs();
await log("after the solve");

const outcome = await page.locator("#screen").innerText();
if (!/of 3/.test(outcome)) findings.push("the solve outcome does not state the score");
const onward = await page.locator(".action-bar .btn").count();
if (!onward) findings.push("the solve outcome has no onward route");

// close the case and check the career picks up
await tap(page.locator(".action-bar .btn"), "close the case");
await clearDialogs();
await page.waitForTimeout(150);
const after = await state();
await log("after closing the case");
if (!after.history) findings.push("the closed case never reached the career history");
const homeAction = await page.locator(".action-bar .btn").innerText().catch(() => "");
if (!/mystery/i.test(homeAction)) findings.push(`home does not name the next step (found "${homeAction.split("\n")[0]}")`);

// The other three scene types, each from the mid-session fixture with the
// picker up, so a random session cannot leave one unexercised.
async function atPicker() {
  await seed(page, base, "mid-session");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("citr:v1"));
    const c = s.careers[s.activeId];
    c.mystery.scene = null;
    c.mystery.threats = [];
    const inv = c.investigators.find((i) => i.id === c.activeInvestigatorId) || c.investigators[0];
    inv.fatigue = 4;                      // so a rest has something to clear
    inv.struck = { insight: true };
    inv.keywords[0].struck = true;
    localStorage.setItem("citr:v1", JSON.stringify(s));
  });
  await page.goto(`${base}#/play`);
  await page.reload();
  await page.goto(`${base}#/play`);
  await page.waitForTimeout(120);
}
const pickScene = (name) => page.locator("#screen .choice", { has: page.locator(".choice-label", { hasText: new RegExp(`^${name}$`) }) }).first();

await atPicker();
const beforeRest = await state();
await tap(pickScene("Rest"), "rest scene");
await clearDialogs();
const afterRest = await state();
if (!(afterRest.fatigue < beforeRest.fatigue)) findings.push("a rest scene cleared no fatigue");
const recharged = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("citr:v1"));
  const c = s.careers[s.activeId];
  const inv = c.investigators.find((i) => i.id === c.activeInvestigatorId) || c.investigators[0];
  return { struck: Object.values(inv.struck).filter(Boolean).length, sig: inv.keywords[0].struck };
});
if (recharged.struck) findings.push("a rest scene left an attribute struck");
if (recharged.sig) findings.push("a rest scene left the signature keyword struck");
if (!(afterRest.deck < beforeRest.deck)) findings.push("a rest scene discarded no clue card");
console.log("rest scene".padEnd(38) + JSON.stringify(afterRest));

await atPicker();
const beforeOb = await state();
await tap(pickScene("Obligation"), "obligation scene");
await clearDialogs();
const afterOb = await state();
const struck = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("citr:v1"));
  const c = s.careers[s.activeId];
  const inv = c.investigators.find((i) => i.id === c.activeInvestigatorId) || c.investigators[0];
  return inv.obligations.filter((o) => o.struck).length;
});
if (!struck) findings.push("an obligation scene struck no obligation");
if (!(afterOb.deck < beforeOb.deck)) findings.push("an obligation scene discarded no clue card");
console.log("obligation scene".padEnd(38) + JSON.stringify(afterOb));

await atPicker();
const beforeTruth = await state();
await tap(pickScene("Truth"), "truth scene");
await clearDialogs();
const afterTruth = await state();
if (!(afterTruth.truths > beforeTruth.truths)) findings.push("a truth scene revealed no truth card");
console.log("truth scene".padEnd(38) + JSON.stringify(afterTruth));

console.log(`\n${taps} taps for a whole session`);
if (errors.length) findings.push(`console: ${errors[0].slice(0, 140)}`);
if (findings.length) { console.log("findings:"); for (const f of findings) console.log("  " + f); }
else console.log("flow walk clean");
await browser.close();
server.close();
process.exit(findings.length ? 1 : 0);
