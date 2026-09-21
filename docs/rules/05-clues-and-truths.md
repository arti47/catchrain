# Clues, jokers, truths and keywords

## Clues
- A clue is a card rank plus a written description. The first card of a rank
  starts a clue set; each further card of that rank strengthens it.
- Clues arrive from clearing the acquisition stage and from any 10+ test, in any
  scene.

## The four draw rules that look alike
1. **A joker** — even when drawn while discarding — turns one clue set that is
   not yet a truth into a false lead: its cards are discarded, the joker leaves
   the game, and the draw continues with a new card.
2. **A joker with no eligible set** doubles danger instead.
3. **A card matching a false lead** is discarded with **no replacement**.
4. **A card matching an established truth** is discarded **and replaced**.

## Truths
Turn a clue set sideways and reveal cards from the truth deck equal to the set's
size, removing them from the game. Fewer cards left than the set's size: take
what remains. An established set can never become a false lead.

## Keywords
Three actions, each striking the keyword: re-roll an attribute test after seeing
the outcome and keep either result; search deck or discard for a card matching a
clue set; remove a threat as if defeated. Signature keywords recharge on a rest.

*Engine:* `deck.drawClue`, `deck.establishTruth`, `deck.strengthenFromDeck`,
`roller.gainClue`, `roller.useKeyword`.
