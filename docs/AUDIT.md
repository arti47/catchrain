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
