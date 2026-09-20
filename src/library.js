// The rules library: one entry per rule the app automates, in the app's own
// words, grouped in the order a session uses them. Paraphrase, never the book's prose.

export const RULES_LIBRARY = [
  { name: "Setting up", entries: [
    { id: "setup", name: "The two decks", cite: "Ch.1, Game setup", text: [
      "The clue deck is ace through ten in all four suits, plus both jokers — 42 cards. The truth deck is the twelve face cards.",
      "Three truth cards are set aside face down before anything else happens. Those three are the mystery: the whole game is working out which.",
      "The app builds and shuffles both decks for you and never shows you the three set-aside cards until the solve.",
    ] },
    { id: "problem", name: "The problem", cite: "Ch.1, Creating a mystery", text: [
      "A location, an object, and a treachery that befell it: “It happened at the X. That's where the Y Z.”",
      "Six treacheries on the table need a second object; the app rolls that for you when they come up.",
      "Danger starts at 0 — unless you are carrying it over from a previous case in a career.",
    ] },
    { id: "investigator", name: "The investigator", cite: "Ch.1, Creating an investigator", text: [
      "Assign 2, 1 and 0 across Power, Insight and Method. One obligation, one signature keyword, a name and a trait.",
      "The signature keyword is the only keyword you can use more than once: a rest recharges it.",
    ] },
  ] },

  { name: "The shape of a session", entries: [
    { id: "scenes", name: "Choosing a scene", cite: "Ch.2, Flow of play", text: [
      "Four kinds of scene: investigation, truth, rest, obligation. Play one, mark the clock, then either choose another or resolve the mystery.",
      "Four scenes fill the clock and end the day.",
    ] },
    { id: "clock", name: "The clock and the day", cite: "Ch.2, The clock", text: [
      "Every scene marks one segment. When the fourth is marked: mark a fatigue for each obligation you did not attend, clear the clock and all obligation strikes, then a random event opens the new day.",
      "That event is resolved with an attribute test like any other — it does not cost a clock segment.",
    ] },
    { id: "rest", name: "Rest", cite: "Ch.2, Rest scenes", text: [
      "Clear 1d6 fatigue boxes from the right, clear every attribute strike, and recharge your signature keywords. Ordinary keywords stay spent.",
      "Then discard one card from the clue deck. It is not added to any clue set.",
    ] },
    { id: "obligation", name: "Obligations", cite: "Ch.2, Obligation scenes", text: [
      "Strike one obligation and play a short scene about it, with an oracle prompt if you want one. No test is rolled.",
      "Then discard a card from the clue deck. Obligations you never strike cost fatigue at the end of the day.",
    ] },
  ] },

  { name: "Investigating", entries: [
    { id: "investigation-roll", name: "The investigation roll", cite: "Ch.2, Investigation scenes", text: [
      "1d6 plus your current danger. 1–3: you are in quietly, starting at discovery. 4–5: start at infiltration with a level 1 threat. 6 or more: start at infiltration with a level 2 threat.",
      "Danger makes this roll worse, which is how the pressure compounds.",
    ] },
    { id: "stages", name: "The four stages", cite: "Ch.2, Investigation stages", text: [
      "Infiltration, discovery, acquisition, escape — each cleared by one successful attribute test, each success raising danger by 1.",
      "Acquisition is where you take the clue. If no threat is present the scene ends there; if one is, you must escape first, and escaping costs no further danger.",
    ] },
    { id: "test", name: "Attribute tests", cite: "Ch.2, Attribute tests", text: [
      "2d6 plus the attribute. 6 or less is failure: you gain a keyword and suffer consequences. 7–9 succeeds at a cost: consequences anyway. 10 or more succeeds and hands you a bonus clue.",
      "Doubles add a random event. A total below your current danger drops a level 1 threat into the scene and halves danger, rounded up.",
      "A struck attribute cannot be used: your investigator must find another approach.",
    ] },
    { id: "consequences", name: "Consequences", cite: "Ch.2, Consequences", text: [
      "1d6: 1–3 raises a threat's level by one, or danger by one when no threat is present. 4 discards a clue-deck card. 5–6 marks one fatigue, 7–8 marks two.",
      "9 or more ends the investigation entirely and sends you to the solve. Only a threat's level can push the roll that high.",
    ] },
    { id: "fatigue", name: "Fatigue", cite: "Ch.2, Fatigue", text: [
      "Five boxes. When the fifth is marked, strike your highest unstruck attribute, clear the track and carry any excess into it.",
      "Inside an investigation that also drops a threat in if none was present, and sends you straight to the escape stage.",
    ] },
    { id: "threats", name: "Threats", cite: "Ch.2, Threats", text: [
      "A threat has a level from 1 to 3 that says how close and how lethal it is. After every attribute test, each threat you did not act against rolls 1d6 plus its level on the consequences table.",
      "A threat introduced by that same test does not act on it.",
      "Acting against a threat is an attribute test: success marks it once, a 10+ marks it twice. Marks equal to its level and it is gone.",
    ] },
  ] },

  { name: "Clues and truths", entries: [
    { id: "clues", name: "Clues", cite: "Ch.1, Clues", text: [
      "A clue is a card rank plus your description. The first card of a rank starts a clue set; each further card of that rank makes it stronger and lets you write more.",
      "A bigger set reveals more truth cards when you establish it, so strengthening is never wasted.",
    ] },
    { id: "jokers", name: "Jokers and false leads", cite: "Ch.1, Jokers", text: [
      "Drawing a joker — even while discarding — turns one clue set that is not yet a truth into a false lead: its cards are discarded and it can never be established.",
      "Cards of that rank drawn later are discarded on sight with no replacement. If there is no eligible set at all, danger doubles instead.",
      "Both jokers leave the game once drawn, so this can happen at most twice.",
    ] },
    { id: "truths", name: "Truth scenes", cite: "Ch.2, Truth scenes", text: [
      "Turn a clue set sideways and reveal that many cards from the truth deck, removing them from the game. Each one is a card the three set aside cannot be.",
      "Establishing a set also protects it: a joker can never take it. Later cards of that rank are discarded and replaced.",
    ] },
    { id: "keywords", name: "Keywords", cite: "Ch.2, Keywords", text: [
      "Spend one to re-roll a test after seeing the result (keep either), to search the deck or discard for a card matching a clue set, or to remove a threat outright.",
      "Using one strikes it. Signature keywords come back when you rest; the rest are gone.",
    ] },
  ] },

  { name: "Ending it", entries: [
    { id: "end", name: "What ends a mystery", cite: "Ch.2, The solve", text: [
      "You choose to resolve it at the end of a scene, the clue deck runs out, or a consequence roll hits 9 or more.",
    ] },
    { id: "solve", name: "The solve", cite: "Ch.2, Resolving the mystery", text: [
      "Name the three cards set aside at the start, then turn them over. Each correct guess answers one question, in order: why the location mattered, why the object mattered, why the treachery happened.",
      "Whatever you answer is true. Wrong guesses are the parts your investigator never got to.",
    ] },
  ] },

  { name: "Optional rules", entries: [
    { id: "difficulty", name: "Difficulty", cite: "Ch.3, Difficulty", text: [
      "Hard adds two red herrings to the truth deck — duplicate face cards that make a guess wrong. Easy reveals three truth cards at the start, trivial reveals six.",
      "Harder mysteries run longer because there are more truth cards to reveal, and pay more experience.",
    ] },
    { id: "career", name: "Career", cite: "Ch.3, Career", text: [
      "Keep the investigator between mysteries: they carry fatigue, strikes and keywords, and danger carries over at half, rounded up.",
      "Each correct guess is 1 experience, plus 3 for a hard mystery, 2 for standard, 0 for easy, minus 1 for trivial.",
      "Lingering questions you note at the end can replace a rolled element in the next mystery.",
    ] },
    { id: "rivals", name: "Rivals", cite: "Ch.3, Rivals", text: [
      "A threat still standing when a scene ends can join a list of six rivals at level 2 or its own level, whichever is higher.",
      "When a new threat would arrive, 4–6 on 1d6 brings back a rival instead. Beating one for good hands you a keyword.",
    ] },
    { id: "coop", name: "Co-op", cite: "Ch.3, Multiplayer", text: [
      "Several investigators share one mystery and one clock. The consequences table is harsher: danger rises by 3 when no threat is present, and a discard result discards two cards.",
      "The app tracks one investigator per career — run a career each and keep the mystery's numbers on whichever device is sharing the screen.",
    ] },
  ] },
];
