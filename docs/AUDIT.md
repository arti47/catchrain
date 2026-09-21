# Audit log

Findings are numbered, with the rule they touch, where it lives, what was done
and why it mattered. A finding is only closed when a check exists that would
catch its return, and that check has been watched failing against the unfixed
code.

## Cycle 1 — harnesses, smoke, dead-data, interaction, measured layout, stress

### F1 — A toast swallowed the tap behind it
*Rule:* none — interaction. *Target:* `styles.css` `.toast`.
*Fix:* `pointer-events: none`. *Why it mattered:* after any roll that toasted,
the next control under the toast was unclickable for three seconds — during the
exact sequence a player repeats most.
*Caught by:* browser smoke (the walk timed out on an intercepted click).

### F2 — `[hidden]` lost to `display: flex`
*Target:* `styles.css`. *Fix:* `[hidden] { display: none !important; }`.
*Why it mattered:* the resource header hid itself by setting `hidden`, and the
declaration on `.resource-header` overruled it, so an empty bar sat under the
app header on every reference screen.
*Caught by:* the layout probe (an element with no text occupying space).

### F3 — A choice dialog resolved its cancel path before the choice
*Target:* `src/ui.js` `chooseModal`. *Fix:* record the pick, then close; the
same guard added to `confirmModal` and `promptModal`.
*Why it mattered:* `closeModal()` fires `onClose`, which resolved `null` first,
so every attribute choice was discarded and **no test could be rolled at all**.
The app looked alive and did nothing.
*Caught by:* the smoke walk (the stage never advanced).

### F4 — Five rules extracted and never called
*Target:* `data.js` → `src/sheet.js`, `src/play.js`, `src/lifecycle.js`,
`src/screens.js`.
*Fix:* the keyword-action list, the end-of-game triggers and the rival-slot
limit now drive their screens instead of being retyped; `replaceRival` is
reachable when the rival list is full; the two experience points for taking on
a new obligation have a control.
*Why it mattered:* the §0 defect class. Two of them (rival replacement, the
obligation experience) were rules a player simply could not use.
*Caught by:* the dead-data scan.

### F5 — Wizard drafts leaked between careers
*Target:* `src/screens.js`. *Fix:* `resetDrafts()` on switching, deleting or
starting a career. *Why it mattered:* a half-made investigator would reappear
inside a different career's creation flow.
*Caught by:* the dead-data scan (an export nothing called).

### F6 — Future wizard steps were dead links
*Target:* `src/wizard.js`. *Fix:* steps ahead of the current one render as
disabled text rather than as links that silently refuse.
*Caught by:* the interaction audit ("changes nothing").

### F7 — Selected options were indistinguishable from inert ones
*Target:* `src/ui.js` `optionBtn`, used by both wizards, settings and tables.
*Fix:* the chosen option carries `aria-pressed="true"`.
*Why it mattered:* a screen reader could not tell which genre or theme was
selected, and the interaction audit could not tell a correct no-op from a broken
control.
*Caught by:* the interaction audit.

### F8 — Tap targets at 38px, and a roll log that grew without bound
*Target:* `styles.css`, `src/screens.js`. *Fix:* fatigue boxes, clock segments
and chips raised to 44px; the roll log folds and states how many it is showing.
*Caught by:* the measured-layout pass under the stress fixture (journal at 8.3
viewports; smallest target 38px).

### F9 — The sheet was a dead end, and keywords were three taps from the scene
*Target:* `src/sheet.js`, `src/play.js`. *Fix:* the sheet carries an action bar
back into the scene; ready keywords appear on the play screen during a scene.
*Caught by:* the flow probe (using a keyword cost four taps from play).

## Cycle 2 — rules read-through against the engine

### F10 — Danger was charged for ending a scene
*Rule:* "To move to the next stage… increase the danger by 1" (Ch.2), and the
flowchart, which puts +1 on the arrows *between* stages only.
*Target:* `lifecycle.completeStage`. *Fix:* danger is paid for moving on, so
taking the clue with no threat present — which ends the scene — costs nothing.
*Why it mattered:* every quiet scene overcharged danger by 1, and danger drives
the investigation roll, the sub-danger threat rule and the carry-over between
mysteries, so the error compounded across a whole career.
*Guard:* `danger rises only when a next stage follows` — watched failing (1 ≠ 0)
before the fix.

### F11 — A rival eliminated by a keyword stayed on the rival list
*Rule:* "If a rival is defeated, remove them from your list and gain a keyword"
(Ch.3) — the keyword action removes a threat "as if you had defeated it".
*Target:* `roller.useKeyword`. *Fix:* the rival branch now runs for both routes.
*Guard:* `a rival eliminated by a keyword still leaves the rival list`.

## Cycle 3 — flow walk

### F12 — Journal and roll-log entries written outside a transaction were lost
*Target:* `src/store.js`. *Fix:* both records save themselves, since callers
legitimately write them either side of an undo transaction.
*Why it mattered:* the journal is the deliverable of a journaling game, and
entries written at a scene boundary vanished on reload with no sign anything
had gone wrong.
*Guard:* `a journal note written outside a transaction still persists` —
watched failing (0 ≠ 1).

### Flow-walk notes (no finding)
- A whole session — creation, twelve scenes across four days, the solve and
  closing the case — runs in about 35 taps, with no terminal state left without
  an onward route.
- Rest, obligation and truth scenes are each exercised from the shared
  mid-session fixture, since a random session may never reach one.

## Cycle 4 — ability sweep

### F13 — The re-roll keyword was an instruction, not a re-roll
*Rule:* "Reroll an attribute test after determining the outcome. You can choose
to use the new outcome or the previous outcome" (Ch.2, Keywords).
*Target:* `src/sheet.js` → `src/play.js` `rerollFlow`, `roller.previewTest`.
*Fix:* the result dialog offers the re-roll. Spending a keyword undoes the test
that just happened, rolls again, shows both outcomes, and applies whichever the
player keeps.
*Why it mattered:* the classic `rule`-kind ability shipped inert (D-3). The app
struck the keyword and then told the player to roll again themselves, so the one
keyword action a player reaches for most often charged them for nothing and left
the comparison — the actual rule — to memory.
*Guards:* `previewTest reports an outcome without applying anything`,
`a re-rolled test can be undone back to before the first roll`, and a smoke
assertion that a test result offers the re-roll.

### Sweep result
The game has exactly three `rule`-kind abilities, all keyword actions. After
F13: re-roll is `play.rerollFlow`, strengthen is `deck.strengthenFromDeck`,
eliminate is `roller.useKeyword`. None is displayed-only.

## Cycle 5 — optional rules read-through, and a flake worth chasing

### F14 — Drawing a joker threw, and burned the wrong lead
*Rule:* "choose a clue set that has not been established as a truth and make it
a false lead" (Ch.1, Jokers).
*Target:* `deck.drawClue`. *Fix:* the draw is async and awaits the choice.
*Why it mattered:* the picker is a dialog, so it returns a promise. Taking its
result without awaiting spread a promise and threw inside the draw — the
player's choice was never read, and the clue they had just earned was lost. It
reproduced in about one smoke run in six, because a joker is two cards in
forty-two.
*Guards:* `the joker's false-lead choice is awaited, not assumed` (unit) and a
`joker` fixture whose next card is a joker, driven through the UI in the smoke
run. Both watched failing against the unfixed code.
*Also:* the smoke walk's step cap was a step budget rather than a stall
detector, so a run of failed tests reported a stall that was not one (D-15).

### F15 — Manual dice only covered the rolls the player starts
*Target:* `roller.rollD6`, `prompts.enterDie`, `lifecycle.restScene`.
*Fix:* with manual dice on, consequences, threat actions, the rival check and
the rest roll all ask for the face you rolled. Table rolls stay digital, and
the toggle says so.
*Why it mattered:* manual entry is a trust feature, not a degraded mode. Half
of a physical-dice session being rolled by the app is worse than either choice
made cleanly.

### F16 — Two career benefits were vaguer than the book
*Target:* `screens.spendXP`. *Fix:* "reduce a rival's level" asks which rival;
"reduce the danger" refuses, with the reason, when no danger is carrying over,
instead of silently eating the point.
*Also:* difficulty is Chapter 3's own rule, so it no longer hides behind the
career toggle; only its experience line does.

## Cycle 6 — the two things you cannot see by looking

### F17 — The content filter leaked
*Target:* `rules.rollTable`. *Fix:* a blocked row redirects the roll to an
allowed one and says so, instead of re-rolling twenty times and giving up.
*Why it mattered:* with thirty of thirty-six rows filtered, a best-effort
re-roll leaks about one roll in forty. A safety tool that mostly works is not
one. *Guard:* `the content filter skips the rows a player blocked` — 200 rolls
against a table with six rows left, asserting no leak and that all six remain
reachable. It failed against the old implementation on its first run.

### The service-worker update path now has a test
Not a finding, a gap: nothing proved a deploy reaches a player who already has
the app installed. `npm run sw` copies the project, installs the worker, ships
a change, reloads, and asserts both the update prompt and that accepting it
activates the new cache.

## Cycle 7 — engine read-through

### F18 — Only some paths noticed the clue deck running out
*Rule:* "The end of the game is triggered when… the clue deck is empty" (Ch.2).
*Target:* `roller.checkDeckEmpty`, called from every path that removes a card.
*Fix:* one function, called after consequence discards, clue draws, the rest and
obligation discards, and the keyword search that pulls a card out of the deck.
*Why it mattered:* a rest that emptied the deck left the mystery running until
the next draw, and the keyword search could empty it with nothing watching at
all. One of the game's four end conditions fired late or not at all, depending
on which door you left by.
*Guards:* `emptying the clue deck on a rest ends the mystery too` and
`searching the deck with a keyword can also empty it` — the first watched
failing.

## Cycle 8 — a clean cycle

Every pass run against the current head with no finding: parse gate and 47 unit
invariants, the dead-data scan, the browser smoke at 320/360/390 under the
stress fixture, the interaction audit, the whole-session flow walk, the layout
probes at both mid-session and stress, and the service-worker update path.

By the stopping rule — a complete cycle of every pass producing nothing — the
build is done. The one item recorded during this cycle is a ruling, not a
defect: A16, the career danger carry-over is `ceil(danger / 2)`, matching the
in-play halving rather than the stricter reading of "reduce by half".

## Cycle 9 — the two gaps closed (co-op, and the book's solo guidance)

Both were gaps rather than defects: Chapter 3's multiplayer existed only as its
consequences table, and Chapter 1's solo advice existed only as the app's own
paraphrase in `explain()` notes. Closing them turned up two findings.

### F19 — An investigator could take two scenes in one round
*Rule:* "investigators can each do a different scene for that segment of the
clock. Once all scenes are finished, all investigators mark a segment"
(Ch.3, Game turns).
*Target:* `play.canTakeScene`, and the hand-over panel on the play screen.
*Fix:* an investigator who has had their scene is offered the next person, not
a second scene; the starters refuse one either way.
*Why it mattered:* the first co-op browser run walked straight into it — the
picker cheerfully offered Amine a second rest while Percy had had none, which
would have quietly given one player twice the turns.
*Guard:* the co-op smoke run asserts the hand-over, then that the clock
advances for both only after each has had a scene.

### F20 — The flow-walk harness still read the pre-party shape
*Target:* `tests/walk-session.mjs`, `tests/make-fixtures.mjs`.
*Fix:* the harness reads the active investigator out of the party, and every
fixture ships in the current shape — with one deliberately old `legacy` fixture
kept so the migration has a fixture of its own (§10.17) and the browser proves a
pre-party save still opens, migrates and keeps its experience.

### Rules read-through of Ch.3 and Ch.1
Everything else in both chapters is now implemented or recorded: rounds, shared
versus separate scenes, threat attachment and re-attachment, per-investigator
obligations and experience, the narration guidance in the "Who acts?" chooser,
the scene-framing questions, the oracle at the point of use, and the recording
methods. Rulings A17–A20 cover where the book is written for one investigator
and co-op needs an answer.

## Verified clean

Settled ground; later passes need not re-litigate these without new evidence.

- All 34 d66 tables: 36 rows, no duplicates, indices 11–66 mapped correctly.
- Every resolution-table boundary: 3/4 and 5/6 on the investigation roll, 6/7
  and 9/10 on the test, 3/4, 6/7, 8/9 on both consequences tables.
- The four asymmetric draw rules, each with its own test.
- Truth-scene reveal count, including the short-deck case (ruling A7).
- Red-herring scoring at the solve.
- Fatigue overflow: strike, clear, carry, and the forced escape.
- The day boundary bundle, and that it clears obligation strikes.
- Undo restores a whole prompted procedure as one step.
- Export round-trips; pre-normalization saves load without crashing.
- Zero horizontal overflow at 320/360/390px under the stress fixture.
- Every route: a heading, an `explain()` note collapsed by default, no stray
  `null`/`undefined`/`NaN`, no console errors, nothing under the tab bar.
- Every visible control does something (interaction audit clean).
- All three keyword actions fire in the engine, not in prose.
- The joker path: the chosen lead burns, exactly one set per joker, no error.
- Manual-dice mode covers every resolution roll.
- The content filter never shows a blocked row and never collapses the table.
- A deploy reaches an already-installed app, and accepting the prompt activates
  the new version.
- Every path that removes a clue card checks the deck-empty end condition.
- Co-op: one scene each per round, one clock for everyone, threats that stay on
  the investigator who drew them.
- A pre-party save opens, migrates into a party of one, and keeps its experience.
- Every scene carries the book's framing questions, and what is written reaches
  the journal.
- A whole session runs end to end: creation → scenes → day boundaries → the
  solve → closing the case → the career history picking it up.
- No export unread, no import unused (dead-data scan clean).

## Known gaps, stated rather than hidden

- Career-level rules (experience spends, rivals across mysteries, danger
  carry-over) are covered by the flow walk and the dead-data scan, not by unit
  tests. They are marked `guidance: verified in the flow walk` in the
  traceability ledger.
- The three set-aside truth cards sit in plain JSON in the export. Reading your
  own backup spoils your own mystery; the README says so.
