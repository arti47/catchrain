// Keeping an installed app up to date.
//
// A home-screen install is the hard case: it is resumed from the app switcher
// rather than loaded, so nothing checks for a new version unless we ask. We ask
// at boot and every time the app comes back to the foreground; the worker's own
// shell check covers the case where the app's files changed but the worker did
// not, which otherwise leaves the old cache serving forever.

import { actionToast } from "./ui.js";

/**
 * `check()` answers "update" (a new version is ready and the toast is up),
 * "current", "offline", "throttled" or "unsupported". `updateViaCache: "none"`
 * stops the worker script itself being served from a stale HTTP cache.
 */
export const Updates = { check: async () => "unsupported", version: async () => null };

export function initUpdates() {
  if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;
  // A toast, not a modal: an update is worth a tap, not an interruption in the
  // middle of a scene. "Not now" means not now, so it is offered again later.
  const offerUpdate = (apply) => actionToast({
    text: "Update available. Reloading keeps everything you have saved.",
    actionLabel: "Reload",
    dismissLabel: "Not now",
    onAction: apply,
  });
  const offerWaiting = (worker) => offerUpdate(() => { worker.postMessage("skip-waiting"); location.reload(); });

  let registration = null;
  let lastCheck = 0;
  let reloading = false;

  const ask = (message) => new Promise((resolve) => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) { resolve(null); return; }
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 12000);
    channel.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data); };
    worker.postMessage(message, [channel.port2]);
  });

  /** Ask both ways: is there a new worker, and did any shipped file change? */
  Updates.check = async ({ force = false } = {}) => {
    if (!registration) return "unsupported";
    if (!force && Date.now() - lastCheck < 60000) return "throttled";
    lastCheck = Date.now();
    try { await registration.update(); } catch { /* offline */ }
    if (registration.waiting && navigator.serviceWorker.controller) {
      offerWaiting(registration.waiting);
      return "update";
    }
    const reply = await ask("check-update");
    if (reply && reply.type === "update-ready") { offerUpdate(() => location.reload()); return "update"; }
    if (reply && reply.type === "offline") return "offline";
    return reply ? "current" : "unknown";
  };
  Updates.version = async () => {
    const reply = await ask("version");
    return reply ? reply.version : null;
  };

  navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" }).then((reg) => {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) offerWaiting(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) offerWaiting(sw);
      });
    });
    // The shell check covers a deploy that changed the app's files but not the worker.
    setTimeout(() => Updates.check({ force: true }), 1500);
  }).catch(() => { /* offline install is a bonus, never a blocker */ });

  // Coming back to the app is the only "load" a home-screen install gets.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") Updates.check();
  });
  window.addEventListener("focus", () => Updates.check());

  // A new worker taking over a page that already had one (another tab accepted
  // the update) means this page is now running old code: reload it once. The
  // first install also fires this, with no controller before it, and that one
  // must not reload — the page is already the new code.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  // The worker can also speak first, when a check it was running finishes.
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "update-ready") offerUpdate(() => location.reload());
  });
}
