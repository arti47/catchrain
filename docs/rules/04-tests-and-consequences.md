# Attribute tests, consequences, fatigue and threats

## The test
2d6 + an unstruck attribute.

| Total | Outcome |
|---|---|
| 1–6 | Failure: gain a keyword, suffer consequences. |
| 7–9 | Success at a cost: suffer consequences. |
| 10+ | Success: gain a bonus clue. |

Then, in order: threats not acted against act; doubles add a random event; a
total below the current danger adds a level 1 threat and halves danger (rounded
up). A threat introduced by the test does not act on that same test.

A struck attribute cannot be chosen — the investigator must find another
approach.

## Consequences (1d6, + a threat's level when a threat acts)

| Total | Effect |
|---|---|
| 1–3 | Raise a threat's level by 1 (max 3); with no threat present, danger +1 (co-op: +3). |
| 4 | Discard a card from the clue deck (co-op: two). |
| 5–6 | Mark 1 fatigue. |
| 7–8 | Mark 2 fatigue. |
| 9+ | The investigation is over. Resolve the mystery. |

## Fatigue
Five boxes. Filling the track strikes the highest unstruck attribute (the player
chooses between ties), clears the track, and carries any excess into it.

## Threats
- Level 1–3, describing how close and how lethal.
- After every attribute test, each threat not acted against rolls 1d6 + its
  level on the consequences table.
- Acting against a threat is an attribute test: 7–9 marks it once, 10+ twice.
  Marks equal to its level removes it.

*Engine:* `roller.attributeTest`, `rollConsequence`, `applyConsequence`,
`markFatigue`, `threatActs`, `threatsAct`, `introduceThreat`.
