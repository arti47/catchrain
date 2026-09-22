// A player's hands. One beat per invocation, state on disk, controls found by
// the words printed on them — never by selector, so a control a player cannot
// read is a finding rather than a silent pass.
//
//   node .playtest/driver.mjs [--seed N] [--state FILE] <verb> [arg] [verb] [arg] ...
//
//   new                    fresh career: investigator, mystery, land in play
//   state                  who am I, what is live, what is on screen
//   screen <name>          navigate
//   do "<visible label>"   press the control whose visible text is this
//   choose "<option>"      answer the dialog that is open
//   type "<text>"          fill the focused field
//   pick "<row> > <option>"  choose an option in a dropdown
//   write "<prose>"        add a note in the app's own journal
//   journal                the whole record, oldest first
//   repl                   hold the browser open and read commands from stdin,
//                          one line per beat — the only way to look at a dialog,
//                          think, and then answer it, because a dialog cannot
//                          survive the page reload between two invocations
//
// Steps run as a sequence in one invocation, because a dialog cannot survive
// the reload between two of them.
//
// Scoping: "Power > 2" presses the control labelled 2 inside the block whose
// label starts with Power — the way a player reads a row before tapping in it.

import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { serve, launch } from "../tests/server.mjs";

const KEYS = ["citr:v1", "citr:v1:settings", "__pt_rng"];
const CLICKABLE = "button, a[href], summary, .choice, [role='button']";

// --- the page's own dice, made reproducible -----------------------------------
// crypto.getRandomValues is what the app rolls with, so that is what is seeded.
// The stream's position rides in localStorage, so it continues across
// invocations exactly as the rest of the save does.
function seedScript(seed) {
  let s = seed >>> 0 || 1;
  const KEY = "__pt_rng";
  try { const v = localStorage.getItem(KEY); if (v !== null) s = (Number(v) >>> 0) || 1; } catch { /* first load */ }
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s || 1; };
  const real = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (arr) => {
    if (arr instanceof Uint32Array) { for (let i = 0; i < arr.length; i++) arr[i] = next(); }
    else if (arr instanceof Uint8Array) { for (let i = 0; i < arr.length; i++) arr[i] = next() & 255; }
    else return real(arr);
    try { localStorage.setItem(KEY, String(s >>> 0)); } catch { /* ignore */ }
    return arr;
  };
}

// --- the driver's own dice, deliberately a different stream -------------------
// Which branch a chooser takes must not be drawn from the page's generator: if
// it were, answering a dialog would shift every later die and the seed would
// stop reproducing.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
}

export async function open({ seed = 1, stateFile = null, width = 390, settings = null } = {}) {
  const { server, port } = await serve(process.cwd());
  const browser = await launch(chromium);
  const ctx = await browser.newContext({ viewport: { width, height: 780 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push((e && e.stack) ? e.stack.split("\n").slice(0, 5).join(" << ") : String(e)));
  await page.addInitScript(seedScript, seed);
  const base = `http://127.0.0.1:${port}/index.html`;
  await page.goto(base);

  const saved = stateFile && existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : null;
  await page.evaluate(({ store, keys, cfg }) => {
    localStorage.clear();
    for (const k of keys) if (store && store[k] != null) localStorage.setItem(k, store[k]);
    if (cfg) localStorage.setItem("citr:v1:settings", JSON.stringify({ ...JSON.parse(localStorage.getItem("citr:v1:settings") || "{}"), ...cfg }));
  }, { store: saved ? saved.local : null, keys: KEYS, cfg: settings });
  await page.reload();
  await page.waitForTimeout(220);

  const session = {
    page, errors, base,
    rng: makeRng((seed * 2654435761) >>> 0),
    rngCalls: saved ? (saved.rngCalls || 0) : 0,
    async save() {
      if (!stateFile) return;
      const local = await page.evaluate((keys) => {
        const o = {};
        for (const k of keys) { const v = localStorage.getItem(k); if (v != null) o[k] = v; }
        return o;
      }, KEYS);
      writeFileSync(stateFile, JSON.stringify({ local, rngCalls: session.rngCalls }, null, 0));
    },
    async close() { await session.save(); await ctx.close(); await browser.close(); server.close(); },
  };
  // Replay the driver's own stream to where it was left, so branch choices are
  // reproducible across invocations too.
  for (let i = 0; i < session.rngCalls; i++) session.rng();
  const roll = session.rng;
  session.rng = () => { session.rngCalls++; return roll(); };
  return session;
}

// --- finding a control the way a player does ----------------------------------
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

async function findControl(page, label, { inModal }) {
  return page.evaluate(({ label, inModal, sel }) => {
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
    document.querySelectorAll("[data-pt-target]").forEach((n) => n.removeAttribute("data-pt-target"));
    const overlay = document.querySelector(".modal-overlay");
    let root;
    if (inModal) { if (!overlay) return { error: "no dialog is open" }; root = overlay; }
    else { if (overlay) return { error: "a dialog is open: " + norm((overlay.querySelector(".modal-title") || {}).textContent) }; root = document.body; }

    let scope = root, want = label;
    const cut = label.split(" > ");
    if (cut.length === 2) {
      want = norm(cut[1]);
      const head = norm(cut[0]).toLowerCase();
      const block = [...root.querySelectorAll(".defrow, .row, .card, .threat, .clue-set, li, section")]
        .filter((n) => norm(n.textContent).toLowerCase().startsWith(head))
        .sort((a, b) => norm(a.textContent).length - norm(b.textContent).length)[0];
      if (!block) return { error: `no block labelled “${cut[0]}”` };
      scope = block;
    }

    const all = [...scope.querySelectorAll(sel)].filter((n) => n.offsetParent !== null || n.getClientRects().length);
    const texts = all.map((n) => norm(n.innerText || n.textContent));
    const w = want.toLowerCase();
    let i = texts.findIndex((t) => t.toLowerCase() === w);
    if (i < 0) i = texts.findIndex((t) => t.toLowerCase().startsWith(w));
    if (i < 0) i = texts.findIndex((t) => t.toLowerCase().includes(w));
    if (i < 0) return { error: `nothing on screen says “${label}”`, offered: texts.filter(Boolean) };
    const node = all[i];
    node.setAttribute("data-pt-target", "1");
    return {
      text: texts[i],
      disabled: !!(node.disabled || node.getAttribute("aria-disabled") === "true"),
      reason: norm(node.getAttribute("title") || ""),
    };
  }, { label, inModal, sel: CLICKABLE });
}

export async function press(s, label, { inModal = false } = {}) {
  const hit = await findControl(s.page, label, { inModal });
  if (hit.error) return { ok: false, ...hit };
  if (hit.disabled) return { ok: false, error: `“${hit.text}” is offered but cannot be pressed${hit.reason ? ": " + hit.reason : ""}` };
  await s.page.click("[data-pt-target]", { timeout: 5000 });
  await s.page.waitForTimeout(140);
  return { ok: true, pressed: hit.text };
}

export const doIt = (s, label) => press(s, label, { inModal: false });
export const choose = (s, label) => press(s, label, { inModal: true });

export async function typeText(s, text) {
  const box = s.page.locator(".modal-overlay .input").first();
  if (!(await box.count())) return { ok: false, error: "no field is open to type into" };
  await box.fill(text);
  return { ok: true, typed: text };
}

/** A dropdown is a control too: "Guess 1 > J of Spades". */
export async function pick(s, spec) {
  const [head, want] = spec.split(" > ");
  const r = await s.page.evaluate(({ head, want }) => {
    const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();
    const blocks = [...document.querySelectorAll(".defrow, .row, .card, label")]
      .filter((n) => norm(n.textContent).toLowerCase().startsWith(String(head).toLowerCase()) && n.querySelector("select"))
      .sort((a, b) => norm(a.textContent).length - norm(b.textContent).length);
    const sel = blocks[0] && blocks[0].querySelector("select");
    if (!sel) return { error: `no dropdown labelled \u201c${head}\u201d` };
    const opts = [...sel.options].map((o) => norm(o.textContent));
    const w = String(want).toLowerCase();
    let i = opts.findIndex((t) => t.toLowerCase() === w);
    if (i < 0) i = opts.findIndex((t) => t.toLowerCase().startsWith(w));
    if (i < 0) return { error: `\u201c${want}\u201d is not offered`, offered: opts };
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return { picked: opts[i] };
  }, { head, want });
  await s.page.waitForTimeout(120);
  return r.error ? { ok: false, ...r } : { ok: true, ...r };
}

export async function goScreen(s, name) {
  await s.page.evaluate((n) => { location.hash = `#/${n}`; }, name);
  await s.page.waitForTimeout(180);
  return { ok: true, screen: name };
}

// --- what a player can see ----------------------------------------------------
export async function readState(s) {
  return s.page.evaluate(({ sel }) => {
    const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();
    const save = JSON.parse(localStorage.getItem("citr:v1") || "{}");
    const c = save.careers && save.activeId ? save.careers[save.activeId] : null;
    const inv = c ? (c.investigators || []).find((i) => i.id === c.activeInvestigatorId) || (c.investigators || [])[0] : null;
    const m = c && c.mystery;
    const overlay = document.querySelector(".modal-overlay");
    const visible = (n) => n.offsetParent !== null || n.getClientRects().length;

    const out = {
      screen: (location.hash.replace(/^#\//, "").split("?")[0] || "home"),
      who: inv ? {
        name: inv.name, trait: inv.trait,
        attributes: Object.fromEntries(Object.entries(inv.attributes).map(([k, v]) => [k, (inv.struck || {})[k] ? `${v} (struck)` : v])),
        fatigue: `${inv.fatigue}/5`, clock: `${inv.clock}/4`, day: inv.day,
        obligations: (inv.obligations || []).map((o) => o.text + (o.struck ? " (attended)" : "")),
        keywords: (inv.keywords || []).map((k) => k.text + (k.signature ? " [signature]" : "") + (k.struck ? " (spent)" : "")),
      } : null,
      situation: m ? {
        premise: [m.location, m.object, m.treachery, m.secondObject].filter(Boolean).join(" / "),
        motivation: m.motivation, difficulty: m.difficulty,
        danger: m.danger, clueDeck: (m.clueDeck || []).length, discard: (m.clueDiscard || []).length,
        truthDeck: (m.truthDeck || []).length, revealed: (m.truthRevealed || []).map((t) => t.rank + t.suit),
        clueSets: Object.values(m.clueSets || {}).map((s2) => `${s2.rank}×${s2.cards.length}${s2.truth ? " TRUTH" : ""}${s2.falseLead ? " FALSE LEAD" : ""}${s2.description ? " — " + s2.description : ""}`),
        threats: (m.threats || []).filter((t) => !t.removed).map((t) => `${t.name} L${t.level} ${t.marks}/${t.level}`),
        scene: m.scene ? `${m.scene.type}${m.scene.stage ? " / " + m.scene.stage : ""}${m.scene.done ? " (done)" : ""}` : "none",
        round: m.round ? `${m.round.mode}: ${Object.keys(m.round.scenes || {}).length} of ${(c.investigators || []).length} have had a scene` : "none",
        party: (c.investigators || []).map((i) => i.name + (i.id === c.activeInvestigatorId ? " (in context)" : "")),
        ended: !!m.ended, endTrigger: m.endTrigger || null, solved: !!m.solved,
      } : null,
      journalTail: c ? (c.journal || []).slice(-4).map((e) => `d${e.day || 1} ${e.kind}: ${e.text}`) : [],
      lastRolls: c ? (c.rollLog || []).slice(-3).map((r) => `${r.kind} ${(r.dice || []).join("+")}${r.attrValue ? "+" + r.attrValue : ""}=${r.total} ${r.outcome || ""}`.trim()) : [],
    };

    if (overlay) {
      out.dialog = {
        title: norm((overlay.querySelector(".modal-title") || {}).textContent),
        says: norm((overlay.querySelector(".modal-body p") || {}).textContent),
        // The whole card, because the prompt a player reads before deciding is
        // often the oracle line or the event list, not the first paragraph.
        body: norm((overlay.querySelector(".modal-body") || {}).innerText),
        options: [...overlay.querySelectorAll(".choice")].map((n) => norm(n.innerText)),
        actions: [...overlay.querySelectorAll(".modal-actions .btn")].map((n) => norm(n.innerText)),
        field: !!overlay.querySelector(".input"),
      };
    } else {
      const heading = norm((document.querySelector("#screen h1") || {}).textContent);
      out.heading = heading;
      const coach = document.querySelector(".coach");
      if (coach) {
        const here = coach.querySelector(".coach-here");
        const nav = [...coach.querySelectorAll(".btn")].map((b) => norm(b.innerText)).find((t) => /^Go:/.test(t));
        out.guide = {
          say: norm((coach.querySelector(".coach-say") || {}).textContent),
          warn: norm((coach.querySelector(".coach-warn") || {}).textContent) || null,
          // What the guide tells you to press, and where: on this screen it
          // names the control, elsewhere it offers to take you there.
          press: here ? (norm(here.textContent).match(/\u201c([^\u201d]+)\u201d/) || [])[1] || null : null,
          goto: nav || null,
        };
      }
      out.lede = [...document.querySelectorAll("#screen .card-title, #screen .premise, #screen .mono")]
        .slice(0, 6).map((n) => norm(n.innerText)).filter(Boolean);
      out.dropdowns = [...document.querySelectorAll("#screen select")].map((n) => {
        const holder = n.closest(".defrow, .row, label");
        return `${norm((holder && holder.querySelector(".row-label") || {}).textContent) || n.getAttribute("aria-label") || "?"}: ${norm(n.options[n.selectedIndex] ? n.options[n.selectedIndex].textContent : "")} (${n.options.length} options)`;
      });
      out.controls = [...document.querySelectorAll(`#screen ${sel}, #action-host ${sel}`)]
        .filter(visible).map((n) => norm(n.innerText) + (n.getAttribute("aria-disabled") === "true" || n.disabled ? " [dimmed]" : ""))
        .filter(Boolean);
    }
    return out;
  }, { sel: CLICKABLE });
}

export async function readJournal(s) {
  return s.page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("citr:v1") || "{}");
    const c = save.careers && save.activeId ? save.careers[save.activeId] : null;
    if (!c) return [];
    return (c.journal || []).map((e) => `Day ${e.day || 1} · ${e.kind} · ${e.text}`);
  });
}

// --- a fresh career -----------------------------------------------------------
/** The investigator wizard, four steps, exactly as a player walks it. */
export async function makeInvestigator(s, { name = null } = {}) {
  const steps = [];
  const step = async (fn, what) => { const r = await fn(); steps.push({ what, ...r }); if (!r.ok) throw new Error(`${what}: ${r.error}`); };
  await goScreen(s, "wizard");
  await step(() => doIt(s, "Power > 2"), "Power 2");
  await step(() => doIt(s, "Insight > 1"), "Insight 1");
  await step(() => doIt(s, "Method > 0"), "Method 0");
  await step(() => doIt(s, "Next: obligation"), "to obligation");
  await step(() => doIt(s, "Roll one"), "roll obligation");
  await step(() => doIt(s, "Next: signature keyword"), "to signature");
  await step(() => doIt(s, "Roll one"), "roll signature");
  await step(() => doIt(s, "Next: who they are"), "to identity");
  if (name) {
    await step(() => doIt(s, "Type it"), "open name field");
    await step(() => typeText(s, name), "type name");
    await step(() => choose(s, "Save"), "save name");
  } else {
    await step(() => doIt(s, "Roll a name"), "roll name");
  }
  await step(() => doIt(s, "Roll a trait"), "roll trait");
  await step(() => doIt(s, "Create the investigator"), "create");
  return steps;
}

/** The mystery wizard: roll the problem, take a motivation, build both decks. */
export async function makeMystery(s) {
  const steps = [];
  const step = async (fn, what) => { const r = await fn(); steps.push({ what, ...r }); if (!r.ok) throw new Error(`${what}: ${r.error}`); };
  await goScreen(s, "mystery");
  await step(() => doIt(s, "Roll all three"), "roll the problem");
  await step(() => doIt(s, "Roll one"), "roll motivation");
  await step(() => doIt(s, "Start the mystery"), "start");
  return steps;
}

export async function startNew(s, opts = {}) {
  const a = await makeInvestigator(s, opts);
  const b = await makeMystery(s);
  return [...a, ...b];
}

// --- one line of commands -----------------------------------------------------
/** Split a command line the way a shell would: quoted strings stay whole. */
export function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  return out;
}

/** Run one sequence of verbs. Returns false when the session should end. */
export async function runVerbs(s, argv, show) {
  while (argv.length) {
    const verb = argv.shift();
    if (verb === "quit" || verb === "exit") return false;
    if (verb === "new") { const steps = await startNew(s); show({ new: `${steps.length} steps, all pressed` }); }
    else if (verb === "join") { const steps = await makeInvestigator(s, {}); show({ join: `${steps.length} steps, all pressed` }); }
    else if (verb === "state") show(await readState(s));
    else if (verb === "journal") show({ journal: await readJournal(s) });
    else if (verb === "screen") show(await goScreen(s, argv.shift()));
    else if (verb === "do") show(await doIt(s, argv.shift()));
    else if (verb === "choose") show(await choose(s, argv.shift()));
    else if (verb === "type") show(await typeText(s, argv.shift()));
    else if (verb === "pick") show(await pick(s, argv.shift()));
    else if (verb === "write") {
      await goScreen(s, "journal");
      const a = await doIt(s, "Add a note"); if (!a.ok) { show(a); continue; }
      const t = await typeText(s, argv.shift()); if (!t.ok) { show(t); continue; }
      show(await choose(s, "Save"));
    }
    else show({ ok: false, error: `unknown verb: ${verb}` });
  }
  return true;
}

// --- CLI ----------------------------------------------------------------------
const isMain = process.argv[1] && process.argv[1].endsWith("driver.mjs");
if (isMain) {
  const argv = process.argv.slice(2);
  let seed = 1, stateFile = ".playtest/session.json";
  while (argv[0] === "--seed" || argv[0] === "--state") {
    const k = argv.shift();
    if (k === "--seed") seed = Number(argv.shift());
    else stateFile = argv.shift();
  }
  mkdirSync(".playtest", { recursive: true });
  const fresh = argv[0] === "new";
  if (fresh && existsSync(stateFile)) writeFileSync(stateFile, JSON.stringify({ local: {}, rngCalls: 0 }));
  const s = await open({ seed, stateFile });
  let bad = false;
  const show = (o) => console.log(JSON.stringify(o, null, 2));

  // A held-open session: one line of commands per beat, the browser never
  // reloaded, so a dialog can be read, thought about, and then answered.
  if (argv[0] === "repl") {
    const { createInterface } = await import("node:readline");
    const rl = createInterface({ input: process.stdin });
    console.log("ready");
    for await (const line of rl) {
      const text = line.trim();
      if (!text || text.startsWith("#")) { console.log("--- END ---"); continue; }
      let keep = true;
      try { keep = await runVerbs(s, tokenize(text), show); }
      catch (e) { show({ ok: false, error: String(e && e.message || e) }); }
      if (s.errors.length) { console.log("console errors: " + s.errors.join(" ;; ")); s.errors.length = 0; bad = true; }
      await s.save();
      console.log("--- END ---");
      if (!keep) break;
    }
    await s.close();
    process.exit(bad ? 1 : 0);
  }

  while (argv.length) {
    const verb = argv.shift();
    if (verb === "new") { const steps = await startNew(s); console.log(`new: ${steps.length} steps, all pressed`); }
    else if (verb === "state") show(await readState(s));
    else if (verb === "journal") (await readJournal(s)).forEach((l, i) => console.log(`${String(i + 1).padStart(3)}  ${l}`));
    else if (verb === "screen") show(await goScreen(s, argv.shift()));
    else if (verb === "do") { const r = await doIt(s, argv.shift()); show(r); if (!r.ok) bad = true; }
    else if (verb === "choose") { const r = await choose(s, argv.shift()); show(r); if (!r.ok) bad = true; }
    else if (verb === "type") { const r = await typeText(s, argv.shift()); show(r); if (!r.ok) bad = true; }
    else if (verb === "pick") { const r = await pick(s, argv.shift()); show(r); if (!r.ok) bad = true; }
    else if (verb === "write") {
      await goScreen(s, "journal");
      const a = await doIt(s, "Add a note"); if (!a.ok) { show(a); bad = true; break; }
      const t = await typeText(s, argv.shift()); if (!t.ok) { show(t); bad = true; break; }
      const c2 = await choose(s, "Save"); show(c2); if (!c2.ok) bad = true;
    }
    else { console.log(`unknown verb: ${verb}`); bad = true; }
  }
  if (s.errors.length) { console.log("console errors:"); s.errors.forEach((e) => console.log("  " + e)); bad = true; }
  await s.close();
  process.exit(bad ? 1 : 0);
}
