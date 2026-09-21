# Setup and creation

## The decks
- Clue deck: ace–10 in four suits (40) plus both jokers = 42 cards.
- Truth deck: the twelve face cards. Three are set aside, face down, before play.
- Difficulty changes the truth deck before the three are set aside: hard adds two
  duplicate face cards (red herrings), easy reveals three cards, trivial six.

*Engine:* `deck.buildClueDeck`, `deck.buildTruth`. *Screen:* mystery wizard.

## The investigator
- Attributes: Power, Insight, Method, assigned 2 / 1 / 0.
- One obligation, one signature keyword, a name, a trait. Fatigue 0, clock 0.
- Maximum attribute value is 3, reachable only through career advancement.

*Engine:* `wizard.finishInvestigator`, `derived.normalizeInvestigator`.

## The problem
- Roll a location and an object from the chosen genre, and a treachery from the
  general table. Treacheries 61–66 name a second object, which is rolled too.
- Reads as: *It happened at the [location]. That's where the [object] [treachery].*
- Pick a motivation. Danger starts at 0, or at half the previous mystery's danger
  (rounded up) in a career.

*Engine:* `rules.randomProblem`, `rules.problemText`, `wizard.startMystery`.
