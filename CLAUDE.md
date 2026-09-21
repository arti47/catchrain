# Caught in the Rain — player app: canonical spec

A personal play aid for *Caught in the Rain* (Nicholas Robinia, The Ravensridge
Emporium, 2025), built from the owner's own copy. This file is the project's
living spec: **every code change updates it in the same change.**

Source of record: a full text transcription of the rulebook supplied at project
start. Precedence: page images > the printed sheets > the transcript > any
summary. The transcript's d66 tables each carry their own index (`41 Morgue`),
so no table was de-interleaved and nothing is blocked.

## 1. What this is

| | |
|---|---|
| Game | *Caught in the Rain* — core rules, all four chapters |
| Audience | The solo player at the table |
| Platforms | One installable PWA: phone first, browser and desktop the same build |
| Core job | Investigator + mystery creation, the scene loop, the card engine, the solve |
| Backend | None. Everything is local JSON in `localStorage`, exportable in one tap |
| Theme | Wet asphalt and ink, one amber lamp for danger, cold blue for truths; light + dark, system default |

### 1.1 Product decisions

These were taken as the template's defaults for a solo game and are recorded so
later work does not re-open them.

1. **Usage mode — single device, local only.** There is no sync phase and no
   Firebase. Chapter 3's co-op rules ship in full, as a party sharing one device
   (or one device passed around): the party, the round structure, threat
   attachment and the harsher consequences table. What is *not* built is
   networked multiplayer — a device each, syncing.
2. **Seat — the player.** There is no GM in this game, so there is no GM screen.
   Every table in the book is player-facing and lives in the Tables tab.
3. **Dice — digital by default, manual entry available.** `crypto.getRandomValues`
   with rejection sampling; a Settings toggle switches to typing the faces you
   rolled on the table. There is no push economy, so manual entry is single-stage.
4. **Expansions — none supplied.**
5. **Device — phone first**, comfortable at 320px, centred to 720px on a desktop.
6. **Theme — follows the system**, with an in-app override and a text-size control.
7. **Many careers, not one.** The book's career rules make multiple mysteries a
   published rule, so the career list is in the schema from day one.

### 1.2 Template scope deliberately omitted

Recorded so a later pass does not rediscover the same non-decision.

| Omitted | Why |
|---|---|
| Bestiary / NPC compendium | The game has no stat blocks. A threat is a d66 word plus a level of 1–3. |
| Combat tracker | There is no combat. Acting against a threat is an ordinary attribute test. |
| Powers / spell automation | No such subsystem. |
| Inventory, encumbrance, wealth | No carrying model at all. Keywords are the nearest thing and are their own system. |
| Pregens | The book publishes none. |
| Group entity | Co-op play shares a mystery, not a party-level entity with its own stats. |
| GM screen, GM tables | No GM role exists. |
| Firebase, campaigns, join codes | See decision 1: co-op is played around one device, not across several. |

## 2. System Profile

**Family:** solo narrative / investigation. 2d6 + attribute, tiered outcomes
(PbtA-shaped), but the *state* of the game is a deck of cards. Dense in Lookup,
Permission, Cost and Threshold; it has **no Opposed rule and no Future-cost rule**.

**2.1 Resolution.** 2d6 + attribute (0–3). 1–6 failure: gain a keyword, suffer
consequences. 7–9 success at a cost: suffer consequences. 10+ success: gain a
bonus clue. Doubles add a random event. A total below the current danger adds a
level 1 threat and halves danger, rounded up. No push economy, no crit table.
The investigation roll is separate: 1d6 + danger.

**2.2 Opposed tests.** None. Threats never roll against the investigator; they
roll on the consequences table.

**2.3 Meta-currencies.** *Danger* (per mystery, starts 0, no cap, +1 per stage
completed, halved on a sub-danger roll, halved again between mysteries in a
career, doubled by a joker with no eligible clue set). *Keywords* (one use,
struck; signature keywords recharge on a rest). *Experience* (career only).

**2.3a Lose conditions.** `total < danger` → a new threat. `fatigue = 5` →
strike the highest unstruck attribute. `consequence ≥ 9` → the mystery ends.
`clue deck empty` → the mystery ends. All four sit in the persistent header.

**2.4 Attributes.** Power, Insight, Method; 2 / 1 / 0 at creation, maximum 3 by
career advancement.

**2.5 Derived stats.** Almost none, and that is load-bearing: five fatigue
boxes, four clock segments, a threat is removed at marks = level. Nothing else
is computed.

**2.6 Skills.** None. The trait and the keywords do that work in fiction.

**2.7 Creation.** Investigator: attribute array, one obligation, one signature
keyword, name and trait. Mystery (a second wizard): genre, difficulty, location,
object, treachery (+ a second object on treacheries 61–66), motivation.

**2.9 Conditions.** No condition list. The equivalents are *strikes* — on
attributes (until a rest), keywords (permanently, unless signature) and
obligations (until the day turns) — plus the fatigue track.

**2.10 Health and death.** No hit points, no death. The fatigue track converts
into attribute strikes; the terminal procedure is the solve, which gets the
guided UI the template reserves for a death procedure.

**2.11 Rest.** Clear 1d6 fatigue right to left, clear all attribute strikes,
recharge signature keywords, discard one clue-deck card.

**2.12 Lifecycle.** Scene → one clock segment. Four segments = a day. The day
boundary marks a fatigue per unstruck obligation, clears the clock and the
obligation strikes, and generates a random event resolved with an attribute
test. Between mysteries (career): reset both decks, set aside three new truth
cards, halve danger.

**2.13 Progress tasks.** Investigation stages and threat mark tracks.

**2.14 Abilities.** The three keyword actions, all of them `rule`-kind: re-roll a
resolved test keeping either outcome, search deck or discard to strengthen a
clue, remove a threat outright.

**2.15 Advancement.** Career only: 1 experience per correct guess plus the
difficulty bonus (hard +3, standard +2, easy 0, trivial −1). Six benefits at
1–6 points; two of them force a new obligation, and taking one voluntarily
between mysteries pays 2.

**2.16 Inventory.** None.

**2.17 Combat.** None. Threats act after every attribute test they were not
acted against, rolling 1d6 + level on the consequences table. A threat
introduced by a test does not act on that same test. In co-op a threat is
attached to an investigator and its consequences land on them; acting against
it re-attaches it to whoever acted.

**2.17a Co-op turns (Ch.3).** A career holds a party. An investigation or truth
scene is played by everybody; any other scene is taken separately, one each, and
the clock is marked only once every investigator has had a scene — then for all
of them together. The day boundary charges each investigator for their own
neglected obligations. The consequences table is the co-op one: danger +3 with
no threat present, and two discards.

**2.18 Bestiary.** None — see §1.2.

**2.20 Solo.** The whole game. Not a toggle. The chapter's *guidance* is treated
as content, not prose: the two scene-framing questions open every scene with an
oracle to hand, and the ways of keeping a record sit on the journal screen.

**2.22 Safety tools.** **The book supplies none.** The app adds a content
filter as a labelled house aid (§4).

### 2.3 Rule-shape census

Lookup ≈39 · Permission ≈10 · Cost ≈8 · Threshold ≈7 · Gate/Blocker ≈6 ·
Compulsion ≈5 · Conversion ≈4 · Exception ≈4 · Cascade 3 · Escalation 3 ·
Once-per-X 3 · Modifier 3 · Substitution 1 · **Opposed 0 · Future-cost 0**.

What that means for this app: it is judged on **prompting and deck integrity**,
not arithmetic. The riskiest shapes here are Permission (ten places the book
says *you may*), Conversion (clue set → truth, fatigue → strike, threat →
rival) and Exception (four asymmetric draw rules that look alike and are not).

### 2.4 Ambiguity rulings

| id | Point | Ruling |
|---|---|---|
| A1 | Does entering the escape stage cost +1 danger? | Yes. +1 on every successful stage transition; completing escape costs nothing further. (Flowchart p.26 and the worked example.) |
| A2 | Ties when striking "your highest unstruck attribute" | The player chooses. |
| A3 | Does the 10+ bonus clue apply outside investigation scenes? | Yes — "any attribute test in any scene", including the day-boundary event. |
| A4 | Does the sub-danger check use the raw 2d6 or the total? | The total, attribute included ("Sum less than Danger"). |
| A5 | Do threats persist between investigation scenes? | No. They clear at scene end; with the rivals rule, one may be kept as a rival. |
| A6 | A joker drawn *while discarding* | Resolve the false lead, then the replacement card is consumed by the instruction that caused the draw: a discard stays a discard. |
| A7 | A truth scene with fewer truth cards left than the set has | Reveal what remains; the set still counts as established. |
| A8 | Red herrings | A card that appears twice across the truth deck plus the set-aside cards is a red herring, and guessing it is wrong — the book's own duplicate check. |
| A9 | "Easy / Trivial: reveal N truth cards" | Reveal = remove from the truth deck and show it permanently, exactly as a truth scene does. |
| A10 | Does a rest clear ordinary keyword strikes? | No. Attributes and signature keywords only. |
| A11 | The yes/no oracle is 1d6, but the worked example rolls 2d6 against it | The table wins; the example is treated as an erratum and the app rolls 1d6. |
| A12 | *Which* threat rises when a consequence raises a level and several are present | The least advanced one, so the scene escalates broadly rather than spiking one threat to 3. The book does not say. |
| A17 | A filled fatigue track inside a co-op investigation | The forced escape applies to the scene, so the whole party leaves. The rule is written for one investigator's scene, and in co-op the scene is shared. |
| A18 | How many scenes an investigator takes in one round | One. A shared investigation or truth scene counts as that round's scene for everyone in it. |
| A19 | Whose clock advances, and when | Everyone's, together, once every investigator has taken a scene. The day turns when all the clocks are full, and each investigator marks fatigue for their own unstruck obligations. |
| A20 | Who earns a mystery's experience in co-op | Every investigator in the party, at the full amount. The book gives experience for solving the mystery, and they solved it together. |
| A16 | "Reduce the danger by half (rounded up)" between mysteries | The next mystery starts at `ceil(danger / 2)`, matching the in-play halving rule ("halve the danger, rounded up") rather than the stricter reading where the *reduction* is rounded up. |
| A15 | How much of a manual-dice session the app rolls | Every resolution roll is typed in (tests, investigation roll, consequences, threats, rest); d66 table lookups stay digital, since the app is rolling those on the player's behalf rather than resolving an action. |
| A13 | A rival roll landing on a blank slot | Introduce an ordinary new threat. The book offers "choose a rival or create a new one"; the app takes the second. |
| A14 | Danger for the stage that ends the scene | Danger is paid for moving to a stage, not for finishing one, so taking the clue with no threat present costs nothing. The flowchart puts +1 only on the arrows between stages, and the worked example charges it on each move. |

Three asymmetries the engine branches on everywhere, stated once: a clue card
matching an **established truth** is discarded **and replaced**; a card matching
a **false lead** is discarded with **no replacement**; a joker with **no
eligible clue set** doubles danger instead of burning one.

## 3. Architecture

No build step. Vanilla ES modules loaded by the browser. Installable PWA with a
versioned app-shell cache and network-first navigation. Storage is plain JSON in
`localStorage` under `citr:v1` (settings under `citr:v1:settings`), exportable
and re-importable in one tap. Dice come from `crypto.getRandomValues` with
rejection sampling, never `Math.random`. No native `alert`/`confirm`/`prompt`.

**The one piece of hidden state:** the three set-aside truth cards live in the
same JSON as everything else. The app never renders them before the solve, but a
player who reads their own export will spoil their own mystery. That is stated
in the README rather than hidden behind an encoding.

### 3.1 Files

| File | Purpose |
|---|---|
| `index.html` | Shell: header, resource header, screen mount, action host, tab bar |
| `styles.css` | Theme tokens (light + dark) and every component style |
| `data.js` | The whole rules library: 34 d66 tables, 6 resolution tables, every constant |
| `manifest.json`, `service-worker.js`, `icon.svg` | PWA |
| `tests/` | Harnesses, probes and the three seed fixtures (dev only) |
| `docs/rules/` | The distilled rules, one file per subsystem — what the audit reads against the engine |
| `docs/AUDIT.md` | Numbered findings, pass by pass, plus the verified-clean list |

| Module | Responsibility |
|---|---|
| `src/core.js` | Constants, DOM helpers (incl. the null-safe `add`), crypto dice, d66. No imports. |
| `src/ui.js` | Modals, toasts, `explain()`, `actionBar()`, option buttons. |
| `src/rules.js` | Pure lookups over `data.js`, table rolls, the content filter hook. |
| `src/derived.js` | Derivations over investigator and mystery state; normalization and migration. |
| `src/settings.js` | Toggles, all off unless the fiction's default is on. |
| `src/store.js` | Careers, persistence, journal, roll log, undo (`begin`/`commit`), export/import. |
| `src/deck.js` | The card engine: both decks, clue sets, false leads, jokers, the solve's scoring. |
| `src/roller.js` | Attribute tests, consequences, fatigue, threats, keyword actions, clue draws. |
| `src/lifecycle.js` | Scenes, stages, the clock, the day boundary, rest, obligations, truths, rivals. |
| `src/prompts.js` | The engine's player decisions wired to real dialogs; one event → one sentence. |
| `src/framing.js` | Setting the scene: the book's two questions, an oracle to hand, and the answer kept in the journal. |
| `src/wizard.js` | The investigator wizard and the mystery wizard. |
| `src/sheet.js` | The investigator sheet and the persistent resource header. |
| `src/play.js` | The scene loop: choosing, running stages, threats, boundaries. |
| `src/clues.js` | Clue sets, truths, false leads, deck state. |
| `src/solve.js` | The guided solve and its onward routes. |
| `src/screens.js` | Home, tables, oracles, rules, journal, careers, settings. |
| `src/library.js` | The rules-library content. |
| `src/tutorial.js` | The first-session walkthrough. |
| `src/router.js` | Routing, the tab bar, the section nav, live-state badges. |
| `src/main.js` | Boot: storage, theme, prompts, routes, service worker. |

Adding or moving a `src/` file updates this table **and** the service worker's
shell list, and bumps `CACHE_VERSION`, in the same change.

### 3.2 Data model

```
citr:v1
  activeId, careers/{id}:
    name, createdAt, defaultGenre, carryDanger
    activeInvestigatorId                  // who is in context
    investigators[ ... ]                  // the party: one solo, several in co-op
    rivals[{id,name,level}]         // Ch.3 rivals, max RIVAL_SLOTS
    history[{problem,correct,difficulty,answers,closedAt,danger,clues}]
    questions[{id,text,from}]       // lingering questions
    journal[{id,ts,kind,text,day,scene}]   // capped 500
    rollLog[{id,ts,kind,dice,attrValue,total,outcome,label,manual}]  // capped 200
      each: { id, name, trait, notes, xp, attributes{power,insight,method},
              struck{attrId:true}, fatigue, clock, day,
              obligations[{id,text,struck}], keywords[{id,text,signature,struck}] }
    mystery: { id, genre, difficulty, danger, motivation,
               location, object, treachery, secondObject,
               clueDeck[], clueDiscard[], truthDeck[], truthRevealed[], setAside[],
               clueSets{rank:{rank,cards[],entries[],description,truth,falseLead,truthCards[]}},
               threats[{id,name,level,marks,removed,rivalId,justIntroduced,attachedTo}],
               scene{id,type,stage,order[],index,done,forceEscape,actorId,participants[],rolls{},framing},
               round{mode:"shared"|"individual", scenes{invId:{type,done}}},
               jokersDrawn, ended, endTrigger, guesses[], results[], solved, correct, answers[], xpGained }
citr:v1:settings  { theme, textScale, manualDice, multiplayer, rivals, career,
                    safetyFilter, blocked[], wakeLock, autoOracle, sceneFraming }
```

Every schema addition ships a back-fill in `derived.normalize*` and is recorded
here in the same change.

## 4. House aids

One, labelled as such wherever it appears: the **content filter** in Settings.
The book supplies no safety tools, so the app lets a player list table rows to
skip; `rules.rollTable` re-rolls past them. It lives behind `Settings.blocked`
and is described in the UI as a house aid, not a rule.

## 5. Data Extraction Ledger

Every box ticked means the table is in `data.js`, verified for row count and
uniqueness by `tests/unit.mjs`, and read by the module named. An unticked box
would mean no UI may be built against it.

| id | Table | Rows | Consumer |
|---|---|---|---|
| T1 | Deck composition (clue, truth, set-aside) | — | `deck.buildClueDeck`, `deck.buildTruth` |
| T2 | Investigation roll | 3 | `roller.investigationRoll`, `lifecycle.beginInvestigation` |
| T3 | Investigation stages | 4 | `rules.stageOrder`, `play.renderInvestigation` |
| T4 | Attribute test outcomes | 3 | `roller.attributeTest` |
| T5 | Consequences (solo) | 5 | `roller.rollConsequence` |
| T6 | Consequences (co-op) | 5 | `roller.rollConsequence` under the multiplayer toggle |
| T7 | Threat levels 1–3 | 3 | `play.renderInvestigation` |
| T8 | Keyword actions | 3 | `sheet.useKeywordFlow` → `roller.useKeyword` |
| T9 | Scene types | 4 | `play.renderPlay` |
| T10 | Solve questions | 3 | `solve.renderOutcome` |
| T11 | End triggers | 3 | `play.renderPlay` |
| T12 | Difficulties | 4 | `wizard.renderMysteryWizard`, `deck.buildTruth`, `solve.reveal` |
| T13 | Experience benefits | 6 | `screens.renderCareers` |
| T14 | Yes/no oracle | 4 bands | `rules.rollYesNo` → `screens.renderOracle` |
| T15 | Subject oracle: action | 36 | `rules.rollSubject` |
| T16 | Subject oracle: descriptor | 36 | `rules.rollSubject` |
| T17 | Subject oracle: focus | 36 | `rules.rollSubject` |
| T18 | Treacheries (61–66 need a second object) | 36 | `rules.rollTreachery` |
| T19 | First names | 36 | `rules.rollName` |
| T20 | Last names | 36 | `rules.rollName` |
| T21 | Name prefixes | 36 | `rules.rollName("affix")` |
| T22 | Name suffixes | 36 | `rules.rollName("affix")` |
| T23 | Traits | 36 | `wizard.stepIdentity` |
| T24 | Motivations | 36 | `wizard.renderMysteryWizard` |
| T25–T30 | Noir: locations, objects, clues, keywords, obligations, threats | 6 × 36 | `rules.rollGenre` |
| T31–T36 | Fantasy: the same six | 6 × 36 | `rules.rollGenre` |
| T37–T42 | Horror: the same six | 6 × 36 | `rules.rollGenre` |
| T43–T48 | Sci-fi: the same six | 6 × 36 | `rules.rollGenre` |

All ticked. 34 d66 tables × 36 rows = 1,224 rows, plus six resolution tables.

## 6. Rules Traceability Ledger

One row per rule: shape, where its numbers live, what applies it, where a player
meets it, and the test that proves it fires. A gap in a row is the defect class
this whole document exists to prevent.

| Rule | Shape | Data | Engine | Surface | Test |
|---|---|---|---|---|---|
| 2d6 + attribute, tiered outcome | Modifier | `TEST_OUTCOMES` | `roller.attributeTest` | Result dialog | `test outcome boundaries are 6/7 and 9/10` |
| Investigation roll = 1d6 + danger | Modifier | `INVESTIGATION_ROLL` | `roller.investigationRoll` | Investigation dialog | `investigation roll boundaries are 3/4 and 5/6` |
| Each stage completed raises danger by 1; escaping does not | Cost | — | `lifecycle.completeStage` | Danger in the header | `each completed stage raises danger, but escaping does not` |
| Acquisition grants a clue | Cost | — | `lifecycle.completeStage` → `roller.gainClue` | Clue dialog | `completing acquisition without a threat ends the scene…` |
| A 10+ test grants a bonus clue, in any scene | Cost | `TEST_OUTCOMES` | `roller.attributeTest` | Result dialog | `a 10+ test grants a bonus clue in any scene` |
| A failure gains a keyword | Cost | genre keyword tables | `roller.gainKeyword` | Keyword prompt | `a failure gains a keyword and rolls consequences` |
| Consequences table, solo | Lookup | `CONSEQUENCES_SOLO` | `roller.applyConsequence` | Result dialog | `consequence boundaries, solo and co-op` |
| Consequences table, co-op | Exception | `CONSEQUENCES_MULTI` | `roller.applyConsequence` | Settings toggle | `co-op consequences raise danger by 3…` |
| A consequence of 9+ ends the mystery | Threshold | `CONSEQUENCES_SOLO` | `roller.applyConsequence` | Play screen end card | `a 9+ consequence ends the game` |
| An empty clue deck ends the mystery, whichever path emptied it | Threshold | — | `roller.checkDeckEmpty` | Clues screen, header | `an empty clue deck ends the game`, `emptying the clue deck on a rest ends the mystery too`, `searching the deck with a keyword can also empty it` |
| Fatigue full: strike the highest attribute, carry the excess | Conversion | `FATIGUE_BOXES` | `roller.markFatigue` | Sheet, header | `fatigue overflow strikes the highest attribute…` |
| …and inside a scene, add a threat and skip to escape | Compulsion | — | `roller.markFatigue` → `lifecycle.completeStage` | Stage rail | `the fatigue strike forces the escape stage…` |
| A struck attribute cannot be used | Gate | — | `play.chooseAttribute` | Attribute dialog refusal | smoke: attribute dialog omits struck attributes |
| Threats act after every test they were not acted against | Cascade | — | `roller.threatsAct` | Result dialog | `a threat just introduced does not act in the same test` |
| A threat acts on 1d6 + its level | Modifier | `CONSEQUENCES_SOLO` | `roller.threatActs` | Result dialog | (covered by the row above) |
| Marks equal to level removes a threat; 10+ marks twice | Threshold | — | `roller.attributeTest` + `derived.threatDone` | Threat card | `a threat is removed once its marks equal its level` |
| A total under danger adds a threat and halves danger | Escalation | — | `roller.attributeTest` | Result dialog | `rolling under danger introduces a threat and halves danger` |
| Doubles trigger a random event | Lookup | subject oracles | `roller.attributeTest` → `prompts.randomEvent` | Random-event dialog | smoke walk |
| A new clue set, or a stronger one | Conversion | — | `deck.drawClue` | Clues screen | `first card of a rank starts a set; a second strengthens it` |
| A joker burns a clue set | Compulsion | — | `deck.drawClue` | False-lead dialog | `a joker burns a clue set and the draw continues`, `the joker's false-lead choice is awaited, not assumed` |
| A joker with no eligible set doubles danger | Exception | — | `deck.drawClue` | Event list | `a joker with no eligible set doubles danger instead` |
| A false-lead rank is discarded with no replacement | Exception | — | `deck.drawClue` | Event list | `a false-lead rank is discarded with no replacement` |
| An established-truth rank is discarded and replaced | Exception | — | `deck.drawClue` | Event list | `a rank already established as truth is discarded AND replaced` |
| A truth scene reveals cards equal to the set size | Cost | — | `deck.establishTruth` | Clues screen | `establishing a truth removes that many cards…` |
| …taking what remains when the deck is short | Exception | — | `deck.establishTruth` | Clues screen | `a truth scene takes what remains when the deck is short (A7)` |
| Keyword: strengthen / eliminate | Permission | `KEYWORD_ACTIONS` | `roller.useKeyword` | Sheet and play chips | `keyword use strikes the keyword and does what it says` |
| Keyword: re-roll a test after seeing its outcome, keep either | Permission | `KEYWORD_ACTIONS` | `play.rerollFlow` + `roller.previewTest` | Result dialog action | `previewTest reports an outcome without applying anything`, `a re-rolled test can be undone back to before the first roll` |
| A rival removed by a keyword is still a rival beaten | Exception | — | `roller.useKeyword` | Result dialog | `a rival eliminated by a keyword still leaves the rival list` |
| A keyword is struck when used | Cost | — | `roller.useKeyword` | Struck chip | (same row) |
| Signature keywords recharge on a rest | Once-per-X | — | `lifecycle.restScene` | Sheet | `rest clears 1d6 fatigue, attribute strikes and signature keyword strikes` |
| Rest clears 1d6 fatigue and all attribute strikes | Cost | — | `lifecycle.restScene` | Rest dialog | (same row) |
| Rest and obligation scenes each discard a clue card | Cost | — | `lifecycle.restScene`, `obligationScene` | Event list | `an obligation scene strikes the obligation and discards a clue card` |
| An obligation scene strikes one obligation | Cost | — | `lifecycle.obligationScene` | Sheet chips | (same row) |
| Every scene marks the clock | Escalation | `CLOCK_SEGMENTS` | `lifecycle.endScene` | Header, clock | `ending a scene marks the clock and clears threats` |
| Threats do not survive the scene | Conversion | — | `lifecycle.endScene` | Event list | (same row) |
| The day boundary bites for each unstruck obligation | Compulsion | — | `lifecycle.applyDayBoundary` | Day dialog | `the day boundary marks fatigue per neglected obligation…` |
| The day boundary clears the clock and obligation strikes | Cost | — | `lifecycle.applyDayBoundary` | Day dialog | (same row) |
| The day's random event is resolved with a test | Lookup | subject oracles | `play.endSceneFlow` | Day dialog action | smoke walk |
| Resolve the mystery at the end of any scene | Permission | `END_TRIGGERS` | `play.confirmEnd` | Play screen | smoke: the end card names its trigger |
| The solve: three guesses, answers in order | Lookup | `SOLVE_QUESTIONS` | `deck.scoreGuesses`, `solve.renderOutcome` | Solve screen | `guesses score against the set-aside cards…` |
| Red herrings make a guess wrong | Exception | `DIFFICULTIES` | `deck.scoreGuesses` | Solve results | (same row) |
| Difficulty changes the truth deck | Cost | `DIFFICULTIES` | `deck.buildTruth` | Mystery wizard | `hard adds 2 red herrings, easy reveals 3, trivial reveals 6` |
| Experience: correct guesses + difficulty bonus | Cost | `DIFFICULTIES` | `solve.reveal` | Solve results, careers | guidance: verified in the flow walk |
| Experience benefits, two of which add an obligation | Cost | `XP_BENEFITS` | `screens.spendXP` | Careers screen | guidance: verified in the flow walk |
| A new obligation between mysteries pays 2 experience | Permission | `NEW_OBLIGATION_XP` | `screens.renderCareers` | Careers screen | guidance: verified in the flow walk |
| Danger halves between mysteries in a career | Cost | — | `solve.closeCase` → `wizard.startMystery` | Home screen | guidance: verified in the flow walk |
| A leftover threat may become a rival | Conversion | — | `lifecycle.addRival` | End-of-scene dialog | guidance: verified in the flow walk |
| A full rival list may be replaced at matching level | Permission | `RIVAL_SLOTS` | `lifecycle.replaceRival` | End-of-scene dialog | guidance: verified in the flow walk |
| A rival returns instead of a new threat on 4–6 | Lookup | `RIVAL_SLOTS` | `roller.introduceThreat` | Threat card | guidance: verified in the flow walk |
| Beating a rival hands you a keyword | Cost | — | `roller.attributeTest` | Result dialog | guidance: verified in the flow walk |
| Lingering questions seed the next mystery | Permission | — | `solve.renderOutcome`, `wizard.renderMysteryWizard` | Solve, mystery wizard | guidance only |
| Mix genre tables freely | Permission | `GENRES` | `rules.rollGenre` | Tables tab, both wizards | guidance only |
| Write your own clue descriptions | Permission | — | `prompts.describeClue` | Clue dialog, clues screen | guidance only |
| Co-op: the party shares one mystery, one clock, one danger track | Exception | — | `store.party`, `derived.normalizeCareer` | Party panel, header switcher | `a party can be joined, switched and thinned out`, `a pre-party save migrates into a party of one, with its experience` |
| Co-op: investigation and truth scenes are played by everyone | Compulsion | — | `lifecycle.SHARED_SCENES`, `startRound` | Scene picker labels, round panel | `an investigation scene is played by the whole party` |
| Co-op: any other scene is taken separately, one each | Compulsion | — | `lifecycle.recordRoundScene`, `play.canTakeScene` | Round panel, hand-over action | `an individual round is not finished until everyone has taken a scene`, smoke: the party round |
| Co-op: the clock is marked once everyone has had a scene | Threshold | `CLOCK_SEGMENTS` | `lifecycle.pendingInvestigators`, `endScene` | End-the-scene action and its refusal | `ending a scene marks every clock, and the day turns only when all are full` |
| Co-op: each investigator answers for their own obligations | Cost | — | `lifecycle.applyDayBoundary` | Day dialog | `the day boundary bites each investigator for their own obligations` |
| Co-op: a threat is attached to whoever drew it | Conversion | — | `roller.introduceThreat`, `attachedTo` | Threat card | `a threat is attached to the investigator whose test called it up` |
| Co-op: a threat's consequences land on the investigator it is on | Exception | `CONSEQUENCES_MULTI` | `roller.threatActs` | Result dialog | `a threat acts against whoever it is attached to` |
| Co-op: acting against a threat turns it on you | Conversion | — | `roller.attributeTest` | Threat card | `acting against a threat turns its attention on you` |
| Co-op: give everyone something to do | Permission | — | `play.chooseActor` | "Who acts?" chooser, with who has acted | guidance: the chooser names who has not acted |
| Co-op: everyone earns the mystery's experience | Cost | `DIFFICULTIES` | `solve.reveal` | Solve results | `everyone who worked the case earns its experience` |
| Solo: open a scene by saying where it is and who is there | Permission | `SCENE_FRAMING` | `framing.framingCard`, `framingLines` | Top of every scene; rest and obligation dialogs | smoke: setting the scene |
| Solo: ask the game when you do not know | Permission | oracles | `framing.framingCard` buttons | Oracle and yes/no on the framing card | smoke: the oracle button produces words |
| Solo: keep the record however you like | Permission | `RECORDING_METHODS` | `screens.renderJournal` | Journal screen, rules library | guidance only |
| Content filter (house aid) | Gate | `Settings.blocked` | `rules.rollTable` | Settings, and a note on any redirected roll | `the content filter skips the rows a player blocked` |

## 7. Roadmap

- [x] **Phase 0 — Foundations.** Every table extracted and verified; theme; PWA shell; router, frame, two-level nav, local storage.
- [x] **Phase 1 — Creation.** Investigator wizard and mystery wizard, legality enforced at each step, both decks built on start.
- [x] **Phase 2 — Tracker.** Sheet, fatigue and clock, keywords and obligations, persistent resource header, JSON export/import, normalization.
- [x] **Phase 3 — Engine.** Attribute tests, consequences, threats, clue draws with every asymmetry, keyword actions, manual dice, roll log, rules citations.
- [x] **Milestone — first session playable.** Wizard → sheet → scene → clue → truth → solve, end to end.
- [x] **Phase 4 — In-play systems.** The guided solve with onward routes, rest, the lifecycle bundle with one-step undo, the stage tracker, career advancement, rivals.
- [x] **Phase 6 — Conditional surfaces.** Career, rivals and co-op toggles; the tables browser; the rules library; the tutorial; the journal.
- [x] **Hardening.** Unit, smoke, interaction and dead-data harnesses; the layout and flow probes; the audit cycles in `docs/AUDIT.md`.
- [x] **Phase 7 — Co-op and the book's own guidance.** The party, the round
  structure, threat attachment, per-investigator boundaries and experience; the
  scene-framing questions, the oracle to hand, and the recording methods.
- [ ] **Backlog** (deliberately not built): a general snapshot stack beyond the current single-step undo; a rendered HTML character sheet alongside the JSON export; a tablet two-column layout.

## 8. Process rules

1. This file is canonical and is updated in the same change as the code.
2. Every rules number lives in `data.js`. No rules value is hardcoded in `src/`.
3. Any shipped-file change bumps `CACHE_VERSION` in `service-worker.js`.
4. `npm test` (parse gate + invariants) before every change; `npm run smoke`
   before every commit; `npm run interact` and `npm run scan` at the end of
   every feature; `npm run walk` and the probes at the end of every phase.
5. Every bug fix adds the check that would catch its return, and the check is
   watched failing first.
6. Copy that states a mechanic is either enforced in the same change or marked
   as guidance. Every flag has a setter, a reader and a clearer.

## 9. Changelog

| Date | Change | Verification | Cache |
|---|---|---|---|
| 2026-09-20 | Data library and engine: 34 d66 tables, both decks, tests, consequences, lifecycle, career storage with undo. | 38 unit invariants | citr-v1 |
| 2026-09-20 | The app: 14 routes, both wizards, the scene loop, clues, the solve, tables, library, tutorial, journal, settings. Fixed a toast that swallowed taps, `[hidden]` losing to `display:flex`, and a choice dialog that resolved its cancel path before the chosen value. | smoke clean at 320/360/390 | citr-v1 |
| 2026-09-21 | Co-op (Ch.3) in full: a career now holds a party sharing one mystery, one clock and one danger track; shared and individual rounds; threats attached to whoever drew them; per-investigator obligations, fatigue and experience. Old saves migrate into a party of one. | 58 unit invariants; co-op and legacy-save checks in the browser; interaction, scan, walk and probes clean | citr-v2 |
| 2026-09-21 | The book's solo guidance surfaced: every scene opens with its two questions and an oracle, the answer goes to the journal, and the recording methods sit on the journal screen and in the library. New `src/framing.js`; `sceneFraming` defaults on. | smoke: setting the scene | citr-v2 |
| 2026-09-21 | Audit cycle 8: every pass clean — unit, dead-data, smoke, interaction, walk, probes and the update path. Ruling A16 recorded for the career danger carry-over. | full cycle, no findings | citr-v1 |
| 2026-09-21 | Engine read-through: only some of the paths that remove a clue card noticed the deck running out. One `checkDeckEmpty` now guards them all. | 47 unit invariants; guard watched failing | citr-v1 |
| 2026-09-21 | The content filter leaked about one roll in forty; a blocked row now redirects the roll and says so. Added a service-worker update-path test (`npm run sw`). | 45 unit invariants; interaction, scan, walk, probes and the update path clean | citr-v1 |
| 2026-09-21 | Optional-rules read-through: drawing a joker threw and ignored the player's choice (the picker is async and was not awaited); manual dice now cover consequences, threats and rest; two career benefits ask what the book asks. | 44 unit invariants + a joker fixture driven through the UI; both guards watched failing | citr-v1 |
| 2026-09-21 | Ability sweep: the re-roll keyword was prose, not an engine path. It now undoes the test, re-rolls, and applies whichever outcome the player keeps. Journal and roll log save themselves. | 43 unit invariants; smoke asserts the offer; interaction, scan and walk clean | citr-v1 |
| 2026-09-21 | Flow walk: journal and roll-log entries written outside a transaction never reached storage. Both records now save themselves. `npm run walk` added. | 41 unit invariants, guard watched failing; flow walk clean | citr-v1 |
| 2026-09-21 | Rules read-through: danger was charged for ending a scene as well as for moving between stages (ruling A14), and a rival removed by a keyword stayed on the rival list. Rulings A12–A14 recorded. | 40 unit invariants, both guards watched failing | citr-v1 |
| 2026-09-21 | Audit tooling and what it found: keyword actions, end triggers, rival slots, rival replacement and the new-obligation experience were all data with no engine. Wizard drafts no longer leak between careers. Tap targets raised to 44px, the roll log folds, the sheet leads back to the scene, keywords are reachable mid-scene. | unit + smoke + interaction + dead-data clean; probes re-read | citr-v1 |
