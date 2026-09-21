// The card engine: clue deck, truth deck, clue sets, false leads, jokers.
// Every draw returns an event list so the UI can narrate exactly what the
// rules did, and so the journal can record it.

import { shuffle, uid } from "./core.js";
import { DECK, DIFFICULTIES } from "../data.js";

export const cardName = (c) =>
  c.rank === "JOKER" ? "Joker" : `${c.rank}${{ S: "♠", H: "♥", D: "♦", C: "♣" }[c.suit]}`;
export const isRed = (c) => c.suit === "H" || c.suit === "D";

export function buildClueDeck() {
  const cards = [];
  for (const rank of DECK.clueRanks) for (const suit of DECK.suits) cards.push({ id: uid(), rank, suit });
  for (let i = 0; i < DECK.jokers; i++) cards.push({ id: uid(), rank: "JOKER", suit: null });
  return shuffle(cards);
}

/** Truth deck + the three set-aside cards. Difficulty adds red herrings or reveals cards. */
export function buildTruth(difficultyId) {
  const diff = DIFFICULTIES.find((d) => d.id === difficultyId) || DIFFICULTIES[1];
  let cards = [];
  for (const rank of DECK.truthRanks) for (const suit of DECK.suits) cards.push({ id: uid(), rank, suit });
  if (diff.redHerrings > 0) {
    const extra = shuffle(cards).slice(0, diff.redHerrings).map((c) => ({ id: uid(), rank: c.rank, suit: c.suit, herring: true }));
    cards = cards.concat(extra);
  }
  cards = shuffle(cards);
  const setAside = cards.splice(0, DECK.setAside);
  const revealed = cards.splice(0, diff.revealTruths); // easy/trivial start with cards already out
  return { truthDeck: cards, setAside, truthRevealed: revealed };
}

// --- Clue sets ----------------------------------------------------------------
export const setsOf = (m) => Object.values(m.clueSets);
export const eligibleForFalseLead = (m) => setsOf(m).filter((s) => !s.truth && !s.falseLead);
export const isFalseLeadRank = (m, rank) => !!(m.clueSets[rank] && m.clueSets[rank].falseLead);
export const isTruthRank = (m, rank) => !!(m.clueSets[rank] && m.clueSets[rank].truth);

/**
 * Draw one card for a clue (acquisition, or a 10+ bonus).
 * mode "gain" adds the card to a set; mode "discard" only discards it.
 * falseLeadPick(sets) chooses which set a joker burns.
 * Returns { events:[], card, set } — card is null when nothing was gained.
 */
export function drawClue(m, mode, falseLeadPick) {
  const events = [];
  let guard = 0;
  while (true) {
    if (++guard > 60) throw new Error("draw loop did not terminate");
    if (m.clueDeck.length === 0) { events.push({ t: "deck_empty" }); return { events, card: null, set: null }; }
    const card = m.clueDeck.shift();

    if (card.rank === "JOKER") {
      m.jokersDrawn = (m.jokersDrawn || 0) + 1;
      const options = eligibleForFalseLead(m);
      if (options.length === 0) {
        m.danger = m.danger * 2;
        events.push({ t: "joker_no_sets", danger: m.danger });
      } else {
        const chosen = falseLeadPick ? falseLeadPick(options) : options[0];
        chosen.falseLead = true;
        m.clueDiscard.push(...chosen.cards);
        events.push({ t: "false_lead", rank: chosen.rank, cards: chosen.cards.length });
        chosen.cards = [];
      }
      events.push({ t: "joker_removed" }); // jokers leave the game entirely
      continue; // "then draw a new card"
    }

    if (isFalseLeadRank(m, card.rank)) {
      m.clueDiscard.push(card);
      events.push({ t: "discard_false_lead", card });
      return { events, card: null, set: null }; // no replacement is drawn
    }

    if (mode === "discard") {
      m.clueDiscard.push(card);
      events.push({ t: "discarded", card });
      return { events, card, set: null };
    }

    if (isTruthRank(m, card.rank)) {
      m.clueDiscard.push(card);
      events.push({ t: "discard_established_truth", card });
      continue; // and draw a replacement
    }

    let set = m.clueSets[card.rank];
    if (!set) {
      set = m.clueSets[card.rank] = { rank: card.rank, cards: [], description: "", entries: [], truth: false, falseLead: false, truthCards: [] };
      set.cards.push(card);
      events.push({ t: "new_clue", card, set });
    } else {
      set.cards.push(card);
      events.push({ t: "strengthen_clue", card, set });
    }
    return { events, card, set };
  }
}

/** Consequence 4 / rest / obligation: discard one card from the clue deck. */
export const discardClue = (m, falseLeadPick) => drawClue(m, "discard", falseLeadPick);

/** Keyword action: search deck or discard for a card matching an established set. */
export function strengthenFromDeck(m, rank) {
  const set = m.clueSets[rank];
  if (!set || set.truth || set.falseLead) return null;
  let i = m.clueDeck.findIndex((c) => c.rank === rank);
  let card = null;
  if (i >= 0) { card = m.clueDeck.splice(i, 1)[0]; m.clueDeck = shuffle(m.clueDeck); }
  else {
    i = m.clueDiscard.findIndex((c) => c.rank === rank);
    if (i >= 0) card = m.clueDiscard.splice(i, 1)[0];
  }
  if (!card) return null;
  set.cards.push(card);
  return { card, set };
}

/** Truth scene: establish a set, removing that many truth cards from the game. */
export function establishTruth(m, rank) {
  const set = m.clueSets[rank];
  if (!set || set.truth || set.falseLead) return null;
  const n = set.cards.length;
  const drawn = m.truthDeck.splice(0, n); // fewer than n remaining: take what is left (A7)
  set.truth = true;
  set.truthCards = drawn.map((c) => c.id);
  m.truthRevealed.push(...drawn);
  return { set, drawn };
}

/** The solve: guesses are {rank,suit}. A card duplicated across deck + set-aside is a red herring. */
export function scoreGuesses(m, guesses) {
  const all = m.setAside.concat(m.truthDeck, m.truthRevealed);
  const count = (g) => all.filter((c) => c.rank === g.rank && c.suit === g.suit).length;
  const remaining = m.setAside.slice();
  return guesses.map((g) => {
    if (!g || !g.rank) return { guess: g, correct: false, reason: "no guess" };
    if (count(g) > 1) return { guess: g, correct: false, reason: "red herring" };
    const i = remaining.findIndex((c) => c.rank === g.rank && c.suit === g.suit);
    if (i < 0) return { guess: g, correct: false, reason: "not set aside" };
    remaining.splice(i, 1);
    return { guess: g, correct: true, reason: "set aside" };
  });
}
