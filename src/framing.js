// Setting the scene — the book's own first instruction for playing solo. The
// two questions themselves are the opening beat of every scene on the Table
// (story.framingBeat); what lives here is the oracle's half of the record.

import { Store } from "./store.js";
import { showToast } from "./ui.js";

/**
 * The oracle's half of the conversation. A solo game is the player asking and
 * the game answering; an answer shown once and then dropped leaves the record
 * with half of it missing, and leaves a player coming back next week reading
 * their own notes about words they can no longer see.
 */
export function keepOracle(text) {
  if (!Store.career) return;
  Store.journal("oracle", text);
  // On the Table the answer lands in the story itself; elsewhere, say where it went.
  if (document.body.dataset.route !== "play") showToast("Kept in the journal.");
}
