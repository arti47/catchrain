// What your investigator knows: clue sets, established truths, false leads,
// and the state of both decks.

import { el, add } from "./core.js";
import { DECK } from "../data.js";
import { rankName } from "./deck.js";
import { startTruth, sceneBlocked } from "./play.js";
import * as D from "./derived.js";
import * as R from "./rules.js";
import { Store } from "./store.js";
import { readiness } from "./coach.js";
import { section, row, btn, pill, explain, promptModal, emptyState, actionBar, cardFace, showToast } from "./ui.js";
import { go } from "./router.js";

const rerender = () => import("./router.js").then((m) => m.render());


function setBlock(m, s) {
  const hand = el("div", { class: "hand" }, ...s.cards.map(cardFace));
  const box = el("div", { class: `clue-set ${s.truth ? "truth" : ""} ${s.falseLead ? "false" : ""}` },
    el("div", { class: "threat-head" },
      el("strong", { text: `The ${rankName(s.rank)}` }),
      s.truth ? pill("Truth", "truth") : s.falseLead ? pill("False lead", "loss") : pill(`${s.cards.length} card${s.cards.length === 1 ? "" : "s"}`)),
    s.cards.length ? hand : null,
    el("p", { class: "small", text: s.description || "No description yet." }),
    // The words the game offered when each card was drawn. Without these a set
    // left undescribed is a bare rank, and the prompt that would have told you
    // what it was is gone for good.
    !s.description && s.prompts && s.prompts.length
      ? el("p", { class: "mono small", text: `The prompts were: ${s.prompts.join("  \u00b7  ")}` })
      : null,
    s.falseLead ? el("p", { class: "small muted", text: "This rank is discarded on sight from now on, and can never become a truth." }) : null,
    s.truth ? el("p", { class: "small muted", text: "Established. Further cards of this rank are discarded and replaced." }) : null);
  if (!s.falseLead) {
    add(box, el("div", { class: "btn-row" }, btn(s.description ? "Add to this clue" : "Describe this clue", async () => {
      const t = await promptModal({
        title: `The ${rankName(s.rank)}`,
        message: s.prompts && s.prompts.length
          ? `The prompts were: ${s.prompts.join("  \u00b7  ")}. Add a word, a phrase, or a connection to another clue.`
          : "Add a word, a phrase, or a connection to another clue.",
        multiline: true,
      });
      if (t) { Store.update("describe clue", () => { s.entries.push(t); s.description = s.entries.join(" — "); }); rerender(); }
    })));
  }
  return box;
}

export function renderClues(host) {
  const m = Store.mystery;
  if (!m) {
    add(host, el("h1", { text: "Clues" }), explain("Every clue you find is a card and a description. Cards of the same rank stack into one set; the bigger the set, the more truth cards it reveals when you establish it."));
    add(host, emptyState("No mystery in progress.", "Set up a mystery", () => go("mystery")));
    return {};
  }
  const sets = D.clueSetList(m).sort((a, b) => DECK.clueRanks.indexOf(a.rank) - DECK.clueRanks.indexOf(b.rank));
  const open = sets.filter((s) => !s.truth && !s.falseLead);
  const truths = sets.filter((s) => s.truth);
  const dead = sets.filter((s) => s.falseLead);

  add(host, el("h1", { text: "Clues" }),
    explain("Each rank is one clue; drawing the same rank again makes it stronger. Establishing a set as a truth in a truth scene reveals that many face cards, which is how you narrow down the three cards set aside at the start."));

  // The case board: what you know, what is ruled out, and what a guess is worth
  // right now. The numbers existed; the read on them did not, and the read is
  // what you need when deciding whether to stop.
  const read = readiness(m);
  add(host, section("Where the case stands",
    el("div", { class: "hand" }, ...m.truthRevealed.map(cardFace)),
    el("p", { class: "small", text: read.guess }),
    ...read.pressure.map((t) => el("p", { class: "small", text: `${t[0].toUpperCase()}${t.slice(1)}.` })),
    open.length
      ? el("p", { class: "small muted", text: `${open.length} set${open.length === 1 ? "" : "s"} still open. A truth scene turns one over and rules out that many face cards \u2014 the biggest open set is worth the most.` })
      : el("p", { class: "small muted", text: "Nothing left to turn over. More truth cards means another investigation first." })));

  add(host, section("The decks",
    row("Clue deck", `${m.clueDeck.length} left`),
    row("Discarded", `${m.clueDiscard.length}`),
    row("Clue cards held", `${D.clueCount(m)} across ${D.clueSetList(m).filter((s) => !s.falseLead).length} set(s)`),
    row("Truth cards known", `${m.truthRevealed.length} of ${m.truthRevealed.length + m.truthDeck.length + 0}`),
    row("Jokers drawn", `${m.jokersDrawn || 0} of 2`),
    m.clueDeck.length <= 5 ? el("p", { class: "small", text: "The deck is nearly out. When it empties the mystery ends." }) : null));

  add(host, section(`Open clues (${open.length})`,
    open.length ? el("div", {}, ...open.map((s) => setBlock(m, s)))
      : el("p", { class: "muted small", text: "No clue sets yet. Take one in the acquisition stage of an investigation." })));

  if (truths.length) add(host, section(`Established truths (${truths.length})`, ...truths.map((s) => setBlock(m, s))));
  if (dead.length) add(host, section(`False leads (${dead.length})`, ...dead.map((s) => setBlock(m, s))));

  if (m.truthRevealed.length) {
    add(host, section("Face cards you have ruled out",
      el("div", { class: "hand" }, ...m.truthRevealed.map(cardFace)),
      el("p", { class: "small muted", text: "None of these are among the three set aside. Everything still unseen might be." })));
  }

  // The action follows the sequence of play, not the tab: resolve when the
  // mystery is over, get back to a scene in progress, mark the clock when one
  // has just finished, and otherwise play the truth scene from right here.
  const scene = m.scene;
  if (m.ended) return { action: actionBar("Resolve the mystery", () => go("solve"), "Name the three cards") };
  if (scene && !scene.done) return { action: actionBar("Back to the scene", () => go("play"), `${R.sceneType(scene.type).name} in progress`) };
  if (scene && scene.done) return { action: actionBar("End the scene", () => go("play"), "Mark the clock, then choose again") };
  const blocked = sceneBlocked("truth", m);
  return { action: actionBar("Establish a truth", () => (blocked ? showToast(blocked.why) : startTruth()),
    blocked ? blocked.why : "Turn a clue set over") };
}
