# Investigation scenes

## The investigation roll
1d6 + current danger, before the scene starts:

| Total | Result |
|---|---|
| 1–3 | Quiet. Start at the discovery stage, no threat. |
| 4–5 | Something is in the way. Start at infiltration with a level 1 threat. |
| 6+ | Something has noticed you. Start at infiltration with a level 2 threat. |

## The stages
Infiltration → discovery → acquisition → escape. Each is cleared by one
successful attribute test.

- **Danger +1 is paid for moving to the next stage**, not for finishing one. So
  infiltration→discovery, discovery→acquisition and acquisition→escape each cost
  1. Ending the scene — by escaping, or by taking the clue with no threat
  present — costs nothing.
- Acquisition grants a clue.
- Escape is only played when a threat is present; then it is compulsory.
- If the fatigue track fills mid-scene, add a threat if none is present and skip
  straight to escape.

*Engine:* `lifecycle.beginInvestigation`, `lifecycle.completeStage`,
`rules.stageOrder`. *Screen:* the stage rail and the pinned stage action.
