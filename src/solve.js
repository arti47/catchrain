// The solve: the highest-stakes moment in the game, so it is a guided procedure
// with an onward route on every outcome.

import { el, add, uid } from "./core.js";
import { DECK, SOLVE_QUESTIONS } from "../data.js";
import * as R from "./rules.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import { scoreGuesses } from "./deck.js";
import { section, row, btn, pill, explain, promptModal, confirmModal, actionBar, emptyState, showToast, cardFace } from "./ui.js";
import { go } from "./router.js";

import { illustration } from "./art.js";
const rerender = () => import("./router.js").then((m) => m.render());
const SUIT_NAMES = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };

export function renderSolve(host) {
  const c = Store.career, m = Store.mystery;
  if (!m) {
    add(host, el("h1", { text: "The solve" }),
      explain("Where a mystery ends: you name the three face cards set aside before play, and every one you get right buys an answer about what really happened. There is nothing to resolve until a mystery is running."));
    add(host, emptyState("No mystery to resolve.", "Set up a mystery", () => go("mystery"), illustration("mystery")));
    return {};
  }

  if (m.solved) return renderOutcome(host, c, m);

  m.guesses = m.guesses || [null, null, null];
  add(host, el("h1", { text: "Name the truth" }),
    explain("Three face cards were set aside before play and never seen. Guess them one by one: every correct guess earns one answer about what really happened. Cards you revealed in truth scenes are already ruled out. With a party, the guesses and the answers belong to all of you."));

  add(host, section("What you know",
    el("p", { class: "premise", text: R.problemText(m) }),
    row("Face cards ruled out", `${m.truthRevealed.length}`),
    row("Still unseen", `${m.truthDeck.length + DECK.setAside}`)));

  // The twelve face cards are the picker: tap one to name it as your next
  // guess, tap it again to take it back. Ruled-out cards are struck but can
  // still be picked — the book never stops you guessing wrong.
  const ruledOut = new Set(m.truthRevealed.map((x) => x.rank + x.suit));
  const slotOf = (rank, suit) => m.guesses.findIndex((g) => g && g.rank === rank && g.suit === suit);
  const picker = el("div", { class: "face-grid picker", role: "group", "aria-label": "Pick three face cards" });
  for (const rank of DECK.truthRanks) for (const suit of DECK.suits) {
    const out = ruledOut.has(rank + suit);
    const slot = slotOf(rank, suit);
    const face = cardFace({ rank, suit });
    if (out) face.classList.add("ruled");
    face.setAttribute("aria-hidden", "true");
    add(picker, el("button", {
      class: `pick-card ${out ? "ruled" : ""} ${slot >= 0 ? "picked" : ""}`.replace(/\s+/g, " ").trim(), type: "button",
      "aria-pressed": slot >= 0 ? "true" : "false",
      "aria-label": `${rank} of ${SUIT_NAMES[suit]}${out ? ", ruled out" : ""}${slot >= 0 ? `, guess ${slot + 1}` : ""}`,
      onclick: () => pickCard(rank, suit),
    }, face, slot >= 0 ? el("span", { class: "guess-no", "aria-hidden": "true", text: String(slot + 1) }) : null));
  }
  const named = el("div", {});
  for (let i = 0; i < DECK.setAside; i++) {
    const g = m.guesses[i];
    add(named, row(`Guess ${i + 1}`, g ? `${g.rank} of ${SUIT_NAMES[g.suit]}${ruledOut.has(g.rank + g.suit) ? " (ruled out)" : ""}` : "not named yet"));
  }
  add(host, section("Your three guesses", picker, named,
    el("p", { class: "small muted", text: "Tap a card to name it; tap it again to take it back. Struck cards were ruled out in truth scenes, and can still be picked — the book never stops you guessing wrong." })));

  const ready = m.guesses.every((g) => g && g.rank);
  return { action: actionBar("Reveal the three cards", () => reveal(), ready ? "All three named" : "Guess all three first") };
}

function pickCard(rank, suit) {
  const m = Store.mystery;
  const at = m.guesses.findIndex((g) => g && g.rank === rank && g.suit === suit);
  if (at >= 0) {
    Store.update("guess", () => { m.guesses[at] = null; });
  } else {
    const free = m.guesses.findIndex((g) => !g || !g.rank);
    if (free < 0) { showToast("Three are named. Tap one of them to take it back."); return; }
    Store.update("guess", () => { m.guesses[free] = { rank, suit }; });
  }
  rerender();
}

async function reveal() {
  const m = Store.mystery;
  if (!m.guesses || !m.guesses.every((g) => g && g.rank)) { showToast("Name all three cards first."); return; }
  const ok = await confirmModal({ title: "Reveal?", message: "This turns the three set-aside cards face up and scores your guesses. It cannot be taken back.", confirmLabel: "Turn them over" });
  if (!ok) return;
  Store.begin("the solve");
  const results = scoreGuesses(m, m.guesses);
  m.results = results;
  m.solved = true;
  m.correct = results.filter((r) => r.correct).length;
  const diff = R.difficulty(m.difficulty);
  const c = Store.career;
  if (Settings.get("career")) {
    const gained = Math.max(0, m.correct + diff.xpBonus);
    m.xpGained = gained;
    // Everyone who worked the case earns it; in solo play that is one person.
    for (const inv of c.investigators) inv.xp += gained;
  }
  Store.journal("solve", `Resolved the mystery: ${m.correct} of 3 guesses correct.`);
  Store.commit();
  rerender();
}

function renderOutcome(host, c, m) {
  const correct = m.correct || 0;
  add(host, el("h1", { text: correct === 3 ? "You had it all along" : correct ? "Part of it, at least" : "Caught in the rain" }),
    explain("Each correct guess buys one answer, taken in order. Write the answers as true, then either start the next mystery or leave the case where it is."));

  const stage = el("div", { class: "reveal" });
  m.setAside.forEach((card, i) => {
    const face = cardFace(card, { flip: true });
    face.style.setProperty("--turn", `${i * 260}ms`);
    add(stage, face);
  });
  add(host, section("The cards", stage,
    ...(m.results || []).map((r, i) => row(`Guess ${i + 1}: ${r.guess.rank}${r.guess.suit}`,
      el("span", {}, r.correct ? pill("Correct", "ok") : pill(r.reason === "red herring" ? "Red herring" : "Wrong", "loss")))),
    row("Correct", `${correct} of 3`),
    Settings.get("career") && m.xpGained !== undefined ? row("Experience earned", `${m.xpGained} XP (${R.difficulty(m.difficulty).name})`) : null));

  const answers = el("div", {});
  m.answers = m.answers || [];
  for (let i = 0; i < correct; i++) {
    const q = SOLVE_QUESTIONS[i];
    add(answers, el("div", { class: "defrow" },
      el("span", { class: "row-label question", text: q }),
      el("div", { class: "defrow-value" },
        el("p", { text: m.answers[i] || "Not answered yet." }),
        btn(m.answers[i] ? "Rewrite" : "Answer", async () => {
          const t = await promptModal({ title: q, multiline: true, message: "Whatever you write here is true." });
          if (t) { Store.update("answer", () => { m.answers[i] = t; }); rerender(); }
        }))));
  }
  add(host, section("What you learned",
    correct ? answers : el("p", { class: "muted", text: "No correct guesses, so no answers. The truth stays out there — which is its own kind of ending." })));

  if (Settings.get("career")) {
    add(host, section("A question you still have",
      el("p", { class: "small muted", text: "Write down what still nags at you. The next mystery can be built from it instead of a random roll." }),
      el("p", { text: (c.questions[c.questions.length - 1] && !m.questionSaved) ? "" : "" }),
      btn("Note a lingering question", async () => {
        const t = await promptModal({ title: "Lingering question", multiline: true, placeholder: "Who was the resident really waiting for?" });
        if (t) { Store.update("lingering question", () => { c.questions.push({ id: uid(), text: t, from: R.problemText(m) }); m.questionSaved = true; }); showToast("Saved for the next mystery."); }
      })));
  }

  return { action: actionBar("Close the case", () => closeCase(), Settings.get("career") ? "Start the next mystery" : "Back to the case screen") };
}

async function closeCase() {
  const c = Store.career, m = Store.mystery;
  const ok = await confirmModal({
    title: "Close this case?",
    message: Settings.get("career")
      ? "The mystery moves to your career history. Everyone keeps their fatigue, strikes, keywords and experience; danger is halved, rounded up."
      : "The mystery moves to your career history and the case screen goes back to a blank slate.",
    confirmLabel: "Close it",
  });
  if (!ok) return;
  Store.update("close case", () => {
    c.history.push({
      id: m.id || uid(), problem: R.problemText(m), correct: m.correct || 0,
      difficulty: m.difficulty, answers: m.answers || [], closedAt: Date.now(),
      danger: m.danger, clues: Object.keys(m.clueSets).length,
    });
    c.carryDanger = Math.ceil((m.danger || 0) / 2);
    c.mystery = null;
  });
  go("home");
}
