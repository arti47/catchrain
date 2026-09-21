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
  `--coop` plays a party of two sharing one case; `--manual` types every
  resolution roll in. Exits non-zero on a stall, a beat with nothing to press,
  or a console error.

Two modes, and they find different things. The runner above proves the
machinery holds; it decides nothing for a reason and writes not a word, so its
record is a log. Playing one session by hand — reading each situation, choosing
because of it, writing after every beat — is what reaches the prose surfaces:
the journal, the clue prompts, the oracle, the framing questions. Both findings
in cycle 20 came from that half and neither was visible to the spine.

Two random streams, deliberately separate: the page's own `crypto.getRandomValues`
is seeded so a session reproduces, and the driver keeps its own generator for
which branch each chooser takes. Drawing the branch picks from the page's
generator would shift every later die, and not randomising them at all would
walk one path in five costumes.

Driving it by hand, one invocation at a time:

    node .playtest/driver.mjs --seed 5 new
    node .playtest/driver.mjs --seed 5 state
    node .playtest/driver.mjs --seed 5 screen play do "Investigation scene" choose "Set the scene"
    node .playtest/driver.mjs --seed 5 journal

Every press that opens a dialog must be answered in the same invocation: the
page reloads between two of them and an open dialog does not survive it, so the
transaction behind it is never committed and the beat is silently lost. To play
properly — look at a dialog, think, then answer it — hold the session open:

    mkfifo /tmp/citr.fifo
    sleep 100000 > /tmp/citr.fifo &
    node .playtest/driver.mjs --state .playtest/play.json --seed 1977 repl < /tmp/citr.fifo | tee /tmp/citr.log
    # then, one beat at a time:
    echo 'do "Take the clue" choose "Power"' > /tmp/citr.fifo

The browser is never reloaded, each line prints its result and ends with
`--- END ---`, and `quit` closes the session and saves.

- `transcript.mjs` — a played session as something you would read: the fiction
  in a serif, the machinery in a sans, oldest first, a day to a heading, every
  roll in a table at the back. `npm run transcript [session.json] [out.pdf]`.
  It renders through the same headless Chromium the harnesses use, so it needs
  no network and no new dependency, and it reads a driver session file or a
  plain export of the app's own storage.

Session files (`session.json`, `audit-*.json`) are working state, not fixtures.
