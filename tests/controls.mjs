// Every selector that is something a thumb can press, in one place.
//
// Three harnesses each kept their own copy of this list, so a control added
// later was measured by none of them: the segmented control shipped at 38px
// under a 44px floor and every probe said 44. Same reason `routes.mjs` exists.

/** Anything inside a screen that a player presses. */
export const TAPPABLE = [
  "#screen .btn",
  "#screen .choice",
  "#screen summary",
  "#screen label.opt",
  "#screen .chip",
  "#screen .box",
  "#screen .seg-opt",
  "#screen .field-clear",
  "#screen .coach-toggle",
  "#screen .step-seg",
  "#screen .pick-card",
].join(", ");

/** The same, plus the chrome that lives outside the screen. */
export const TAPPABLE_ALL = [
  TAPPABLE,
  "#screen .section-nav a",
  ".tab",
  ".action-bar .btn",
  ".to-top",
  "#undo-btn",
  "#theme-btn",
].join(", ");
