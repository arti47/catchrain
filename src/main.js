// Boot: storage, theme, prompts, routes, the service worker and the update toast.

import { $ } from "./core.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { register, start, render, setBadges } from "./router.js";
import { installPrompts } from "./prompts.js";
import { renderHome, renderTables, renderOracle, renderRules, renderJournal, renderSettings, renderCareers, applyTheme, applyTextScale, applyDepth, applyWakeLock } from "./screens.js";
import { renderSheet, renderResourceHeader, watchScroll } from "./sheet.js";
import { renderMysterySheet } from "./paper.js";
import { renderPlay } from "./play.js";
import { renderClues } from "./clues.js";
import { renderSolve } from "./solve.js";
import { renderWizard, renderMysteryWizard } from "./wizard.js";
import { renderTutorial } from "./tutorial.js";
import { showToast, installBackToTop } from "./ui.js";
import { initUpdates } from "./updates.js";
import { motifUrl, glyph } from "./art.js";

Store.init();
applyTheme();
applyTextScale();
applyDepth();
R.setBlocked(Settings.get("blocked") || []);
installPrompts();
applyWakeLock();

const noInvestigator = () => !Store.career || !Store.investigator;
const noMystery = () => !Store.mystery;

// Three places, not five tabs: the Table where the game is played (and every
// drawer that opens off it), the Notebook where it is written down, and the
// Book where it is looked up. Settings sits behind the gear.
register("play", { title: "Table", group: "table", render: renderPlay });
register("home", { title: "The case", group: "table", drawer: true, render: renderHome });
register("sheet", { title: "Investigator", group: "table", drawer: true, render: renderSheet, empty: noInvestigator });
register("case-sheet", { title: "Mystery", group: "table", drawer: true, render: renderMysterySheet, empty: noMystery });
register("clues", { title: "Clues", group: "table", drawer: true, render: renderClues });
register("solve", { title: "The solve", group: "table", drawer: true, render: renderSolve });
register("journal", { title: "Notebook", group: "notebook", render: renderJournal, empty: noInvestigator });
register("rules", { title: "Rules", group: "book", book: true, render: renderRules });
register("tables", { title: "Tables", group: "book", book: true, render: renderTables });
register("oracle", { title: "Oracles", group: "book", book: true, render: renderOracle });
register("tutorial", { title: "Tutorial", group: "book", drawer: true, render: renderTutorial });
register("careers", { title: "Careers", group: "book", drawer: true, render: renderCareers });
register("settings", { title: "Settings", group: "settings", drawer: true, render: renderSettings });
register("wizard", { title: "New investigator", group: "table", drawer: true, render: renderWizard });
register("mystery", { title: "New mystery", group: "table", drawer: true, render: renderMysteryWizard });

/** Live state travels: badges show a scene in progress or a mystery waiting to be solved. */
setBadges(() => {
  const m = Store.mystery, inv = Store.investigator;
  const out = {};
  if (!m || !inv) return out;
  if (m.ended && !m.solved) out.table = "!";
  else if (m.scene && !m.scene.done) out.table = "•";
  if (D.hasThreat(m) || inv.fatigue >= 4) out.table = "!";
  return out;
});

// Header controls
const undoBtn = $("#undo-btn");
undoBtn.replaceChildren(glyph("undo", 20));
$("#settings-btn").replaceChildren(glyph("gear", 20));
undoBtn.addEventListener("click", () => {
  const label = Store.undo();
  const left = Store.undoDepth();
  showToast(label ? `Undid: ${label}.${left ? ` ${left} more step${left === 1 ? "" : "s"} back if you need them.` : ""}` : "Nothing to undo.");
  render();
});
// A system theme is not a one-time read: the phone turns dark at sunset while
// the app is open, and the browser chrome has to follow it there.
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme());

$("#theme-btn").addEventListener("click", () => {
  const order = ["system", "light", "dark"];
  const next = order[(order.indexOf(Settings.get("theme")) + 1) % 3];
  Settings.set("theme", next);
  applyTheme();
  showToast(`Theme: ${next}`);
});

// The case's genre, drawn faintly behind every screen while a case is open:
// one layer for the whole app, under everything, never in front of a word.
const genreMark = document.createElement("div");
genreMark.className = "genre-mark";
genreMark.setAttribute("aria-hidden", "true");
document.body.prepend(genreMark);
function paintGenre() {
  const m = Store.mystery;
  const g = m && !m.solved ? m.genre : null;
  if (g) document.body.dataset.genre = g; else delete document.body.dataset.genre;
  genreMark.style.backgroundImage = g ? motifUrl(g, "#8a8f98") : "none";
}

function paintChrome() {
  paintGenre();
  renderResourceHeader(location.hash.replace(/^#\//, "").split("?")[0] || "home");
  undoBtn.disabled = !Store.canUndo();
  // The stack is twenty deep and the button looked like one step. Say so.
  const depth = Store.undoDepth();
  undoBtn.title = depth ? `Undo: ${Store.lastLabel()} (${depth} step${depth === 1 ? "" : "s"} back available)` : "Nothing to undo";
  undoBtn.setAttribute("aria-label", depth ? `Undo ${Store.lastLabel()}, ${depth} steps available` : "Nothing to undo");
}
Store.subscribe(paintChrome);
window.addEventListener("hashchange", paintChrome);

await start();
paintChrome();
watchScroll();
installBackToTop();

// PWA: registration, update checks and the update toast live in updates.js.
initUpdates();
