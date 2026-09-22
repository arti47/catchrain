// The app's routes, read from the app rather than kept by hand in three places.
//
// Three harnesses each held their own copy of this list. A hand-kept copy rots
// the first time a screen is added: the new screen is the one least likely to
// have been measured, and the lists that would have caught that are the ones
// that quietly stop covering it. Same failure as the deploy test's shell list
// (F53), so it gets the same treatment.
import { readFileSync } from "node:fs";

export const ROUTES = [...readFileSync(new URL("../src/main.js", import.meta.url), "utf8")
  .matchAll(/register\("([^"]+)"/g)].map((m) => m[1]);
