// Boot: storage, theme, prompts, routes, the service worker and the update toast.

import { $ } from "./core.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import * as R from "./rules.js";
import * as D from "./derived.js";
import { register, start, render, setBadges } from "./router.js";
import { installPrompts } from "./prompts.js";
import { renderHome, renderTables, renderOracle, renderRules, renderJournal, renderSettings, renderCareers, applyTheme, applyTextScale, applyWakeLock } from "./screens.js";
import { renderSheet, renderResourceHeader } from "./sheet.js";
import { renderPlay } from "./play.js";
import { renderClues } from "./clues.js";
import { renderSolve } from "./solve.js";
import { renderWizard, renderMysteryWizard } from "./wizard.js";
import { renderTutorial } from "./tutorial.js";
import { showToast } from "./ui.js";
import { initUpdates } from "./updates.js";

Store.init();
applyTheme();
applyTextScale();
R.setBlocked(Settings.get("blocked") || []);
installPrompts();
applyWakeLock();

register("home", { title: "Case", group: "case", render: renderHome });
register("sheet", { title: "Investigator", group: "case", render: renderSheet });
register("journal", { title: "Journal", group: "case", render: renderJournal });
register("play", { title: "Play", group: "play", render: renderPlay });
register("clues", { title: "Clues", group: "clues", render: renderClues });
register("solve", { title: "The solve", group: "clues", render: renderSolve });
register("tables", { title: "Tables", group: "tables", render: renderTables });
register("oracle", { title: "Oracles", group: "tables", render: renderOracle });
register("rules", { title: "Rules", group: "more", render: renderRules });
register("tutorial", { title: "Tutorial", group: "more", render: renderTutorial });
register("careers", { title: "Careers", group: "more", render: renderCareers });
register("settings", { title: "Settings", group: "more", render: renderSettings });
register("wizard", { title: "New investigator", render: renderWizard });
register("mystery", { title: "New mystery", render: renderMysteryWizard });

/** Live state travels: badges show a scene in progress or a mystery waiting to be solved. */
setBadges(() => {
  const m = Store.mystery, inv = Store.investigator;
  const out = {};
  if (!m || !inv) return out;
  if (m.ended && !m.solved) { out.clues = "!"; out.solve = "ready"; }
  else if (m.scene && !m.scene.done) { out.play = "•"; }
  if (D.hasThreat(m)) out.play = "!";
  if (inv.fatigue >= 4) out.case = "!";
  return out;
});

// Header controls
const undoBtn = $("#undo-btn");
undoBtn.addEventListener("click", () => {
  const label = Store.undo();
  const left = Store.undoDepth();
  showToast(label ? `Undid: ${label}.${left ? ` ${left} more step${left === 1 ? "" : "s"} back if you need them.` : ""}` : "Nothing to undo.");
  render();
});
$("#theme-btn").addEventListener("click", () => {
  const order = ["system", "light", "dark"];
  const next = order[(order.indexOf(Settings.get("theme")) + 1) % 3];
  Settings.set("theme", next);
  applyTheme();
  showToast(`Theme: ${next}`);
});

function paintChrome() {
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

// PWA: registration, update checks and the update toast live in updates.js.
initUpdates();
