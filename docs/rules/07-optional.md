# Optional rules (Chapter 3)

## Difficulty
Hard: +2 red herrings, +3 experience. Standard: +2 experience. Easy: reveal three
truth cards, no bonus. Trivial: reveal six, −1 experience.

## Career
The investigator keeps fatigue, strikes, keywords and experience between
mysteries; danger carries over at half, rounded up. Each correct guess is 1
experience plus the difficulty bonus. Lingering questions noted at the end can
replace a rolled element of the next problem.

Benefits: 1 reduce danger · 2 reduce a rival's level · 3 drop an obligation (if
more than one) · 3 clear all fatigue and strikes · 4 a second signature keyword
and a new obligation · 6 raise an attribute (max 3) and a new obligation.
Taking on a new obligation voluntarily between mysteries pays 2 experience;
replacing one that no longer fits is free and pays nothing.

## Rivals
A threat still standing at the end of a scene may join a list of six, at level 2
or its own level if higher. When a threat would be introduced, 4–6 on 1d6 brings
back a rival instead (rolled on the list of six). Defeating a rival removes it
from the list and hands you a keyword. A full list may be replaced by a rival of
matching level.

## Co-op
Several investigators, one mystery, one clock. The consequences table changes:
danger rises by 3 rather than 1 when no threat is present, and a discard result
discards two cards. The app tracks one investigator per career.

*Engine:* `deck.buildTruth`, `solve.reveal`, `screens.spendXP`,
`lifecycle.addRival`, `lifecycle.replaceRival`, `roller.introduceThreat`,
`roller.applyConsequence`.
