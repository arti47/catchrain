# Playtest brief — Caught in the Rain (player app)

Built from the app's own data and screens (`data.js`, `src/tutorial.js`,
`src/library.js`, `CLAUDE.md`). Nothing below comes from memory of the book.

## Resolution
2d6 + one attribute (Power / Insight / Method, 0–3). `data.js TEST_OUTCOMES`:
- 1–6 **Failure** — "Your investigator fails in their approach. What's in their
  way?" Gain a keyword, roll consequences.
- 7–9 **Success at a cost** — "Your investigator succeeds, but there is a
  complication." Roll consequences.
- 10+ **Success** — "Your investigator succeeds in their approach." Bonus clue.

Doubles add a random event. A total below current danger adds a level 1 threat
and halves danger. Investigation scenes open on a separate roll: 1d6 + danger
(`INVESTIGATION_ROLL`), 3− quiet, 4–5 "Something or someone is in your
investigator's way" (threat 1), 6+ "…has noticed your investigator!" (threat 2).

## The loop
The app states it on the Play screen and in its own tutorial, quoted:
1. "Set every scene, then play it" — two questions at the top of the screen
   before anything is rolled.
2. "Play → Investigation scene. The app rolls 1d6 and adds your danger."
   Stages in order (`STAGES`): Infiltration (only if the roll was 4+),
   Discovery, Acquisition ("Taking the clue", grants a clue), Escape (only if a
   threat is present).
3. "Each stage is one test."
4. "Clearing the acquisition stage draws a card."
5. "Play → End the scene marks the clock. Four marks and the day turns over."
6. Between scenes: Rest, Obligation, Truth scenes. "Both cost you a clue card
   from the deck — there is no free time."
7. "When the deck runs out, a consequence forces you out, or you decide you have
   enough, go to the solve."

## Clocks and pressure
- **Danger** (per mystery, starts 0): +1 per stage moved to; feeds the
  investigation roll; halved when a test total falls under it; doubled by a
  joker with no eligible clue set.
- **Clock**: `CLOCK_SEGMENTS = 4`. One mark per scene ended. Four = a day turns:
  1 fatigue per unstruck obligation, strikes cleared, a random event.
- **Fatigue**: `FATIGUE_BOXES = 5`. Full → strike the highest unstruck
  attribute, and inside a scene add a threat and skip to Escape.
- **Threat marks**: removed at marks = level. A threat acts on 1d6 + level after
  every test it was not acted against.
- **The clue deck itself**: 42 cards + 2 jokers. Empty = the mystery ends.

## The oracle
Three, all in-app. Yes/no (1d6, four bands, `rules.rollYesNo`); the subject
oracles (action / descriptor / focus, 36 rows each, `rules.rollSubject`); and 34
d66 content tables in the Tables tab. Every scene's framing card carries "Ask
the oracle" and "Yes or no" buttons next to the two questions. No gap here.

## The record
`Store.journal` → `citr:v1` in localStorage, capped 500 entries, shown on the
Journal screen, exportable as JSON. The roll log (capped 200) is separate.
Framing answers, clue descriptions and scene events all land in the journal.

## Ending
Three triggers (`END_TRIGGERS`): "You chose to resolve the mystery at the end of
a scene", "The clue deck is empty", "You rolled 9+ on the consequences table."
The solve asks three guesses, scores them against the set-aside cards, and each
correct guess buys one of `SOLVE_QUESTIONS`. Experience (correct guesses +
difficulty bonus) only exists once the case closes, and is spent on the Careers
screen — gated behind the ending, as expected.

No heading is unanswered.
