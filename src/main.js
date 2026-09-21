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
import { showToast, actionToast } from "./ui.js";

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
  showToast(label ? `Undid: ${label}` : "Nothing to undo.");
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
  undoBtn.title = Store.canUndo() ? `Undo: ${Store.lastLabel()}` : "Nothing to undo";
}
Store.subscribe(paintChrome);
window.addEventListener("hashchange", paintChrome);

await start();
paintChrome();

// PWA: register, and tell the player when a new version is waiting.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  // A toast, not a modal: an update is worth a tap, not an interruption in the
  // middle of a scene. "Not now" means not now, so a waiting version is offered
  // again on the next load rather than never again.
  const offerUpdate = (worker) => actionToast({
    text: "Update available. Reloading keeps everything you have saved.",
    actionLabel: "Reload",
    dismissLabel: "Not now",
    onAction: () => { worker.postMessage("skip-waiting"); location.reload(); },
  });

  navigator.serviceWorker.register("service-worker.js").then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) offerUpdate(sw);
      });
    });
  }).catch(() => { /* offline install is a bonus, never a blocker */ });
}
