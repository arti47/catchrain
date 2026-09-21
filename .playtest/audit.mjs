// Mode AUDIT: does a session hold together?
//
// Drives the session's spine mechanically — the app's own highlighted default at
// every chooser unless the driver's separate PRNG says otherwise — from a fresh
// career to a closed case, on several seeds. Two streams are seeded and kept
// apart: the page's dice (so a session reproduces) and the driver's branch
// picks (so different seeds walk different paths instead of the same path in
// different flavour text).
//
//   node .playtest/audit.mjs [seed ...]            solo, digital dice
//   node .playtest/audit.mjs --coop [seed ...]     a party of two sharing one case
//   node .playtest/audit.mjs --manual [seed ...]   every resolution roll typed in
//   node .playtest/audit.mjs --coop --manual ...   both
//
// Exits non-zero on a stall, a finding or a console error, so it works as a gate.

import { open, doIt, choose, typeText, pick, goScreen, readState, startNew, makeInvestigator } from "./driver.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const COOP = argv.includes("--coop");
const MANUAL = argv.includes("--manual");
const MODE = `${COOP ? "co-op" : "solo"}, ${MANUAL ? "dice typed in" : "digital dice"}`;
const TAG = `${COOP ? "coop" : "solo"}-${MANUAL ? "manual" : "digital"}`;
const SETTINGS = { career: true, rivals: true, multiplayer: COOP, manualDice: MANUAL };
const SEEDS = argv.filter((a) => !a.startsWith("--")).map(Number).filter(Boolean);
const seeds = SEEDS.length ? SEEDS : [1, 7, 11, 23, 42];
const MAX_BEATS = 220;
const RANKS = ["J", "Q", "K"], SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"];

const findings = [];
const note = (seed, beat, kind, text) => { findings.push({ seed, beat, kind, text }); console.log(`    ! ${kind}: ${text}`); };

/** Answer whatever dialog is open, and keep answering: one press often chains. */
async function settle(s, seed, beat, trail) {
  const chain = [];
  for (let i = 0; i < 24; i++) {
    const st = await readState(s);
    if (!st.dialog) return st;
    const d = st.dialog;
    chain.push(d.title);
    if (d.field) {
      // A typed-dice session asks for faces, not prose: roll them here, in the
      // driver's own stream, the way a player rolls them on the table.
      const face = () => 1 + Math.floor(s.rng() * 6);
      const answer = /enter your dice/i.test(d.title) ? `${face()} ${face()}`
        : /enter your die/i.test(d.title) ? String(face())
        : `Beat ${beat}: written at the table.`;
      await typeText(s, answer);
      const save = d.actions.find((a) => /save|done|confirm|keep/i.test(a)) || d.actions[0];
      if (!save) { note(seed, beat, "unanswerable prompt", `“${d.title}” asks for text and offers no way to submit it`); return st; }
      trail.push(`dialog “${d.title}” ← ${answer}, ${save}`);
      await choose(s, save);
      continue;
    }
    if (d.options.length) {
      const o = d.options[Math.floor(s.rng() * d.options.length)];
      trail.push(`dialog “${d.title}” ← ${o.split("\n")[0]}`);
      const r = await choose(s, o.split("\n")[0]);
      if (!r.ok) { note(seed, beat, "dead end", `“${d.title}” offered “${o}” and it could not be pressed: ${r.error}`); return st; }
      continue;
    }
    if (d.actions.length) {
      // The app puts its primary first; take it unless the coin says explore.
      const idx = d.actions.length > 1 && s.rng() < 0.18 ? 1 : 0;
      trail.push(`dialog “${d.title}” ← ${d.actions[idx]}`);
      const r = await choose(s, d.actions[idx]);
      if (!r.ok) { note(seed, beat, "dead end", `“${d.title}” offered “${d.actions[idx]}” and it could not be pressed: ${r.error}`); return st; }
      continue;
    }
    note(seed, beat, "STALL", `dialog “${d.title}” is open with nothing to press`);
    return st;
  }
  note(seed, beat, "STALL", `dialogs kept opening and never cleared: ${chain.join(" -> ")}`);
  return readState(s);
}

async function playSeed(seed) {
  console.log(`\n── seed ${seed} · ${MODE} ─────────────────────────────`);
  const stateFile = `.playtest/audit-${TAG}-${seed}.json`;
  mkdirSync(".playtest", { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ local: {}, rngCalls: 0 }));
  const s = await open({ seed, stateFile, settings: SETTINGS });
  const trail = [];
  let beat = 0, closed = false, lastSig = "", sameFor = 0;
  try {
    await startNew(s);
    if (COOP) {
      // A second investigator joins the case; the party shares one mystery,
      // one clock and one danger track (Ch.3).
      await makeInvestigator(s, {});
      const party = (await readState(s)).who;
      trail.push(`a second investigator joined; in context: ${party && party.name}`);
    }
    await goScreen(s, "play");
    for (; beat < MAX_BEATS; beat++) {
      let st = await settle(s, seed, beat, trail);

      const sig = JSON.stringify([st.screen, st.situation, st.who && st.who.fatigue, st.who && st.who.clock]);
      sameFor = sig === lastSig ? sameFor + 1 : 0;
      lastSig = sig;
      if (sameFor >= 4) { note(seed, beat, "STALL", `nothing moved for ${sameFor} beats on ${st.screen}; offered: ${(st.controls || []).join(" | ")}`); break; }

      const sit = st.situation;
      if (!sit) { note(seed, beat, "STALL", "no mystery is live and nothing offered a way back to one"); break; }

      // --- the solve ---------------------------------------------------------
      if (sit.solved) {
        const r = await doIt(s, "Close the case");
        if (!r.ok) { note(seed, beat, "STALL", `the case is solved and “Close the case” could not be pressed: ${r.error}`); break; }
        await settle(s, seed, beat, trail);
        trail.push("closed the case");
        closed = true;
        break;
      }
      if (sit.ended) {
        if (st.screen !== "solve") { await goScreen(s, "solve"); trail.push(`the mystery ended (${sit.endTrigger}) → the solve`); continue; }
        for (let g = 1; g <= 3; g++) {
          const card = `${RANKS[Math.floor(s.rng() * 3)]} of ${SUITS[Math.floor(s.rng() * 4)]}`;
          const r = await pick(s, `Guess ${g} > ${card}`);
          if (!r.ok) { note(seed, beat, "STALL", `guess ${g} could not be named: ${r.error}`); break; }
        }
        trail.push("named three cards");
        const rv = await doIt(s, "Reveal the three cards");
        if (!rv.ok) { note(seed, beat, "STALL", `“Reveal the three cards” could not be pressed: ${rv.error}`); break; }
        await settle(s, seed, beat, trail);
        continue;
      }

      // What to press is read off the screen, not out of the save: in co-op the
      // scene on record belongs to whoever played it, which is not necessarily
      // whoever the app is now asking.
      const controls = st.controls || [];
      const stage = controls.find((c) => /^(Find a way in|Find where the clue is|Take the clue|Get out)/.test(c));
      const legal = controls.filter((c) => /^(Investigation|Truth|Rest|Obligation)\b/.test(c) && !/\[dimmed\]/.test(c));
      const ender = controls.find((c) => /^End the scene/.test(c));
      const handOver = controls.find((c) => /^Play as/.test(c));

      // --- inside an investigation scene -------------------------------------
      if (stage) {
        if (sit.threats.length && s.rng() < 0.45) {
          const t = sit.threats[Math.floor(s.rng() * sit.threats.length)].split(" L")[0];
          const r = await doIt(s, `${t} > Act against it`);
          if (r.ok) { trail.push(`acted against ${t}`); await settle(s, seed, beat, trail); continue; }
        }
        const r = await doIt(s, stage.split(" ROLL")[0].split(" DANGER")[0].split(" INFILTRATION")[0].split("\n")[0]);
        if (!r.ok) { note(seed, beat, "STALL", `“${stage}” could not be pressed: ${r.error}`); break; }
        trail.push(`${sit.scene}: ${r.pressed.split("\n")[0]}`);
        await settle(s, seed, beat, trail);
        continue;
      }

      // --- the scene picker --------------------------------------------------
      if (legal.length) {
        let wanted = legal[0];
        if (s.rng() > 0.55) wanted = legal[Math.floor(s.rng() * legal.length)];
        const name = wanted.split("\n")[0].split(" ")[0];
        const r = await doIt(s, name);
        if (!r.ok) { note(seed, beat, "STALL", `“${wanted}” is offered and could not be started: ${r.error}`); break; }
        trail.push(`${st.who ? st.who.name + " chose " : "chose "}${name}`);
        await settle(s, seed, beat, trail);
        continue;
      }

      // --- the clock, or the next investigator -------------------------------
      if (ender) {
        const r = await doIt(s, "End the scene");
        if (!r.ok) { note(seed, beat, "STALL", `a finished ${sit.scene} scene offered no way to end it: ${r.error}`); break; }
        trail.push("ended the scene");
        await settle(s, seed, beat, trail);
        continue;
      }
      if (handOver) {
        const r = await doIt(s, handOver.split("\n")[0]);
        if (!r.ok) { note(seed, beat, "STALL", `“${handOver}” could not be pressed: ${r.error}`); break; }
        trail.push(`handed over: ${r.pressed.split("\n")[0]}`);
        await settle(s, seed, beat, trail);
        continue;
      }
      note(seed, beat, "STALL", `nothing here moves play on (scene ${sit.scene}, round ${sit.round}): ${controls.join(" | ")}`);
      break;
    }

    const end = await readState(s);
    if (!closed) note(seed, beat, "unfinished", `the session never reached a closed case; last screen ${end.screen}, ${end.situation ? `scene ${end.situation.scene}, ended=${end.situation.ended}` : "no mystery"}`);
    console.log(`    ${beat} beats, ${trail.length} presses, ${closed ? "case closed" : "NOT CLOSED"}`);
    console.log(`    who: ${JSON.stringify(end.who)}`);
    console.log(`    situation: ${JSON.stringify(end.situation)}`);
    if (process.env.PT_TRAIL) trail.slice(-40).forEach((t, i) => console.log(`      ${i}. ${t}`));
    for (const e of s.errors) note(seed, beat, "console error", e);
  } finally {
    await s.close();
  }
  return { seed, closed, trail };
}

const runs = [];
for (const seed of seeds) runs.push(await playSeed(seed));

console.log(`\n══ verdict · ${MODE} ══════════════════════`);
for (const r of runs) console.log(`  seed ${String(r.seed).padStart(3)}: ${r.closed ? "played to a closed case" : "DID NOT FINISH"} (${r.trail.length} presses)`);
if (findings.length) {
  console.log(`\n  ${findings.length} finding(s):`);
  for (const f of findings) console.log(`   - [${f.kind}] seed ${f.seed} beat ${f.beat}: ${f.text}`);
} else console.log("\n  no findings.");
process.exit(findings.length ? 1 : 0);
