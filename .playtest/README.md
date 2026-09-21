# Playtest harness

Not a unit test and not a smoke check. Both of those ask structural questions —
is this control reachable, does this rule fire — and both stayed green on an app
that could not be played past its first scene. This asks the other question:
**can a person sit down, start a session, play it through, and finish, pressing
only what the app offers?**

- `brief.md` — the game as the app itself states it: resolution, the loop,
  clocks, the oracle, the record, the ending. Written from `data.js` and the
  app's own tutorial, not from the rulebook.
- `driver.mjs` — a player's hands. One beat per invocation, state on disk between
  them, and every control found by the words printed on it, never by selector:
  a control a player cannot identify by reading the screen fails here rather
  than passing quietly.
- `audit.mjs` — the session's spine, played mechanically on several seeds.
  `npm run playtest`, or `node .playtest/audit.mjs 3 9 17` for named seeds.
  Exits non-zero on a stall, a beat with nothing to press, or a console error.

Two random streams, deliberately separate: the page's own `crypto.getRandomValues`
is seeded so a session reproduces, and the driver keeps its own generator for
which branch each chooser takes. Drawing the branch picks from the page's
generator would shift every later die, and not randomising them at all would
walk one path in five costumes.

Driving it by hand:

    node .playtest/driver.mjs --seed 5 new
    node .playtest/driver.mjs --seed 5 state
    node .playtest/driver.mjs --seed 5 screen play do "Investigation scene" choose "Set the scene"
    node .playtest/driver.mjs --seed 5 journal

Session files (`session.json`, `audit-*.json`) are working state, not fixtures.
