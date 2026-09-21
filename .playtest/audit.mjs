// Mode AUDIT: does a session hold together?
//
// Drives the session's spine mechanically — the app's own highlighted default at
// every chooser unless the driver's separate PRNG says otherwise — from a fresh
// career to a closed case, on several seeds. Two streams are seeded and kept
// apart: the page's dice (so a session reproduces) and the driver's branch
// picks (so different seeds walk different paths instead of the same path in
// different flavour text).
//
//   node .playtest/audit.mjs [seed ...]
//
// Exits non-zero on a stall, a finding or a console error, so it works as a gate.

import { open, doIt, choose, typeText, pick, goScreen, readState, startNew } from "./driver.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const SEEDS = process.argv.slice(2).map(Number).filter(Boolean);
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
      await typeText(s, `Beat ${beat}: written at the table.`);
      const save = d.actions.find((a) => /save|done|confirm|keep/i.test(a)) || d.actions[0];
      if (!save) { note(seed, beat, "unanswerable prompt", `“${d.title}” asks for text and offers no way to submit it`); return st; }
      trail.push(`dialog “${d.title}” ← typed, ${save}`);
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

/** The action bar's own label, which is the app's highlighted default. */
const defaultAction = (st) => (st.controls || []).filter((c) => !/\[dimmed\]/.test(c)).slice(-6)
  .find((c) => /^(Investigation scene|Rest scene|End the scene|Find a way in|Find where the clue is|Take the clue|Get out|Play as )/.test(c));

async function playSeed(seed) {
  console.log(`\n── seed ${seed} ─────────────────────────────`);
  const stateFile = `.playtest/audit-${seed}.json`;
  mkdirSync(".playtest", { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ local: {}, rngCalls: 0 }));
  const s = await open({ seed, stateFile });
  const trail = [];
  let beat = 0, closed = false, lastSig = "", sameFor = 0;
  try {
    await startNew(s);
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

      // --- inside a scene ----------------------------------------------------
      const inScene = sit.scene !== "none" && !/\(done\)/.test(sit.scene);
      if (inScene && /^investigation/.test(sit.scene)) {
        if (sit.threats.length && s.rng() < 0.45) {
          const t = sit.threats[Math.floor(s.rng() * sit.threats.length)].split(" L")[0];
          const r = await doIt(s, `${t} > Act against it`);
          if (r.ok) { trail.push(`acted against ${t}`); await settle(s, seed, beat, trail); continue; }
        }
        const act = defaultAction(st);
        if (!act) { note(seed, beat, "STALL", `in the ${sit.scene} stage with no stage action offered: ${(st.controls || []).join(" | ")}`); break; }
        const r = await doIt(s, act.split(" ROLL")[0].split(" DANGER")[0].split("\n")[0]);
        if (!r.ok) { note(seed, beat, "STALL", `“${act}” could not be pressed: ${r.error}`); break; }
        trail.push(`${sit.scene}: ${r.pressed.split("\n")[0]}`);
        await settle(s, seed, beat, trail);
        continue;
      }

      // --- between scenes ----------------------------------------------------
      if (/\(done\)/.test(sit.scene) || (inScene && !/^investigation/.test(sit.scene))) {
        const r = await doIt(s, "End the scene");
        if (!r.ok) { note(seed, beat, "STALL", `a finished ${sit.scene} scene offered no way to end it: ${r.error}`); break; }
        trail.push("ended the scene");
        await settle(s, seed, beat, trail);
        continue;
      }

      // --- the scene picker --------------------------------------------------
      const legal = (st.controls || []).filter((c) => /^(Investigation|Truth|Rest|Obligation)\b/.test(c) && !/\[dimmed\]/.test(c));
      if (!legal.length) { note(seed, beat, "STALL", `the picker offered no legal scene: ${(st.controls || []).join(" | ")}`); break; }
      const roll = s.rng();
      let wanted = legal[0];
      if (roll > 0.55) wanted = legal[Math.floor(s.rng() * legal.length)];
      const r = await doIt(s, wanted.split("\n")[0].split(" ")[0]);
      if (!r.ok) { note(seed, beat, "STALL", `“${wanted}” is offered and could not be started: ${r.error}`); break; }
      trail.push(`chose ${wanted.split("\n")[0].split(" ")[0]}`);
      await settle(s, seed, beat, trail);
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

console.log("\n══ verdict ══════════════════════════════");
for (const r of runs) console.log(`  seed ${String(r.seed).padStart(3)}: ${r.closed ? "played to a closed case" : "DID NOT FINISH"} (${r.trail.length} presses)`);
if (findings.length) {
  console.log(`\n  ${findings.length} finding(s):`);
  for (const f of findings) console.log(`   - [${f.kind}] seed ${f.seed} beat ${f.beat}: ${f.text}`);
} else console.log("\n  no findings.");
process.exit(findings.length ? 1 : 0);
