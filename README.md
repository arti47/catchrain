# Caught in the Rain

A player app for *Caught in the Rain*, the solo mystery roleplaying game by
Nicholas Robinia (The Ravensridge Emporium, 2025). It holds both decks, rolls
every table, enforces the rules that are easy to drop mid-scene, and keeps a
journal of the case.

This is a personal play aid built from the owner's copy of the book. It is not
the book: it paraphrases the rules it automates and reproduces none of its prose,
art or setting text.

## Running it

No build step, no dependencies, no account. Serve the folder and open it:

```sh
python3 -m http.server 8000     # or any static server
# then open http://localhost:8000
```

Opening `index.html` from the filesystem will not work — ES modules and the
service worker need an origin. On a phone, open the URL and use "Add to home
screen": it installs as an app and works offline afterwards.

## What it does

- **Creation** — the investigator wizard (2/1/0, an obligation, a signature
  keyword, a name and a trait) and the mystery wizard (genre, difficulty,
  location, object, treachery, motivation), with every table rollable.
- **The scene loop** — investigation scenes stage by stage, truth scenes, rest
  and obligation scenes, the clock and the day boundary, all with a confirmation
  summary and one-step undo.
- **The card engine** — both decks, clue sets, false leads, jokers, and the
  four draw rules that look alike and are not.
- **The dice** — `crypto.getRandomValues`, individual faces always shown, every
  roll in a filterable log with a face-distribution view. Prefer real dice?
  Settings has a manual-entry mode that keeps everything else.
- **The solve** — a guided procedure: name the three cards, reveal, and answer
  one question per correct guess.
- **Reference** — every d66 table with a roll button, both oracles, a searchable
  rules library, and a tutorial that walks a whole first session.
- **Optional rules** — career, rivals and the co-op consequences table, each
  behind its own toggle in Settings.

## Your data

Everything is stored on the device as plain JSON under `citr:v1`, and Settings
exports and re-imports it in one tap. Nothing is sent anywhere; there is no
account and no server.

One warning: the three set-aside truth cards live in that same JSON. The app
never shows them before the solve, but if you read your own backup you will spoil
your own mystery.

## Development

```sh
npm install          # playwright-core, dev only
npm test             # parse gate + rules invariants
npm run smoke        # every route, three phone widths, the end-to-end walk
npm run interact     # clicks every control in isolation, flags no-ops
node tests/scan-dead.mjs           # exports nothing reads, imports nothing uses
node tests/probe-layout.mjs stress # the measurement table, per route
node tests/probe-flow.mjs          # tap counts for the common sequences
```

`CLAUDE.md` is the canonical spec: the system profile, the rulings taken where
the book was ambiguous, the extraction and traceability ledgers, and the
changelog. `docs/rules/` holds the distilled rules the audit reads against the
engine, and `docs/AUDIT.md` the findings.

## Licensing

Built from the user's own book for personal use. If you publish or distribute
this app, the licensing is yours to sort out with the publisher; openly licensed
material is the safe basis for anything public.
