# Scenes, the clock and the day

Four scene types: investigation, truth, rest, obligation. Play one, then either
mark the clock and choose again, or resolve the mystery.

- Four clock segments make a day.
- **Day boundary:** mark one fatigue for every obligation not struck that day,
  clear the clock and every obligation strike, then generate a random event and
  resolve it with an attribute test. The event costs no clock segment.
- **Rest:** clear 1d6 fatigue boxes right to left, clear every attribute strike,
  recharge signature keywords (ordinary keywords stay struck), discard one card
  from the clue deck.
- **Obligation:** strike one obligation, play a short scene (a subject-oracle
  prompt is offered), discard one card from the clue deck. No test is rolled.
- **Truth:** see `05-clues-and-truths.md`. No test is rolled.
- In co-op, a segment of the clock covers a scene for everybody: see
  `08-coop.md`.
- Threats do not survive the end of a scene. With the rivals rule, one leftover
  threat may be kept as a rival.

*Engine:* `lifecycle.endScene`, `dayBoundary`, `applyDayBoundary`, `restScene`,
`obligationScene`. *Screen:* play, with a confirmation summary and one-step undo.
