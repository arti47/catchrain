// House aids — the app's own additions, never the book's (template §2.2).
//
// Kept out of data.js on purpose: data.js is extracted rulebook content and is
// the one file a human can proofread against the book. Anything invented lives
// here instead, carries the flag, and is labelled wherever it surfaces — so a
// player can always tell which of the two is talking to them.

export const HOUSE_AID = true;

export const HOUSE_AIDS = {
  contentFilter: {
    id: "contentFilter",
    name: "Content filter",
    label: "house aid",
    text: "The book supplies no safety tools. This lets you list table rows to skip; a roll that lands on one is moved to a row you did not block, and says so.",
  },
  cast: {
    id: "cast",
    name: "People and places",
    label: "house aid",
    text: "The oracles make words and you make the people out of them, and nothing in the book remembers who they were. This does, so a name you invented on day one is still here on day four.",
  },
};

/** The suffix a surface puts on itself, read rather than retyped. */
export const houseAidLabel = (id) => `(${HOUSE_AIDS[id].label})`;
export const houseAidTitle = (id) => `${HOUSE_AIDS[id].name} · ${HOUSE_AIDS[id].label}`;
