// Setting the scene — the book's own first instruction for playing solo, put
// where the play happens rather than left in a chapter nobody reopens.

import { el, add } from "./core.js";
import { SCENE_FRAMING } from "../data.js";
import * as R from "./rules.js";
import { Store } from "./store.js";
import { Settings } from "./settings.js";
import { btn, promptModal, showToast } from "./ui.js";

const rerender = () => import("./router.js").then((m) => m.render());

/**
 * The framing card for the scene in progress. Open until the scene has been
 * described, collapsed afterwards, and absent entirely if the player turns it off.
 */
export function framingCard(scene, opts = {}) {
  if (!Settings.get("sceneFraming")) return null;
  const written = scene && scene.framing;
  const wrap = el("details", { class: "acc framing", open: written ? null : true });
  const body = el("div", { class: "acc-body" });

  add(body, el("ul", { class: "ask" }, ...SCENE_FRAMING.questions.map((q) => el("li", { text: q }))));
  add(body, el("p", { class: "small muted", text: opts.note || SCENE_FRAMING.note }));
  if (written) add(body, el("p", { class: "framing-note", text: written }));

  const oracle = el("p", { class: "mono small", text: "" });
  add(body, oracle);
  add(body, el("div", { class: "btn-row" },
    btn(written ? "Rewrite it" : "Write it down", async () => {
      const text = await promptModal({
        title: "Set the scene",
        message: `${SCENE_FRAMING.questions.join("  ")}  ${SCENE_FRAMING.note}`,
        value: written || "",
        multiline: true,
      });
      if (text === null) return;
      Store.update("set the scene", () => { scene.framing = text; });
      if (text) Store.journal("scene", text, { framing: true });
      rerender();
    }, written ? "ghost" : "primary"),
    btn("Ask the oracle", () => {
      const words = R.subjectWords(R.rollSubject(true));
      oracle.textContent = words.join("  ·  ");
      keepOracle(`Asked the oracle: ${words.join(" · ")}`);
    }),
    btn("Yes or no", () => {
      const r = R.rollYesNo();
      oracle.textContent = `d6 ${r.die} — ${r.row.name}`;
      keepOracle(`Asked yes or no: d6 ${r.die} — ${r.row.name}`);
    })));
  add(body, el("p", { class: "small muted", text: SCENE_FRAMING.unsure }));

  add(wrap, el("summary", { text: written ? "The scene, as you set it" : "Set the scene" }), body);
  return wrap;
}

/**
 * The oracle's half of the conversation. A solo game is the player asking and
 * the game answering; an answer shown once and then dropped leaves the record
 * with half of it missing, and leaves a player coming back next week reading
 * their own notes about words they can no longer see.
 */
export function keepOracle(text) {
  if (!Store.career) return;
  Store.journal("oracle", text);
  showToast("Kept in the journal.");
}

/**
 * Used by the scene dialogs, which have their own body to add it to. A rest or
 * an obligation is as much a scene as an investigation is, so it gets the same
 * two questions and the same oracle to hand. The oracle lives in the body,
 * where pressing it does not close the dialog it belongs to; writing the answer
 * down has to replace the dialog, so it is an action — see framingAction.
 */
export function framingLines(who) {
  const oracle = el("p", { class: "mono small", text: "" });
  return el("div", {},
    el("ul", { class: "ask" }, ...SCENE_FRAMING.questions.map((q) => el("li", { text: q }))),
    el("p", { class: "small muted", text: who ? `${who} is at the centre of it. ${SCENE_FRAMING.note}` : SCENE_FRAMING.note }),
    oracle,
    el("div", { class: "btn-row" },
      btn("Ask the oracle", () => {
        const words = R.subjectWords(R.rollSubject(true));
        oracle.textContent = words.join("  ·  ");
        keepOracle(`Asked the oracle: ${words.join(" · ")}`);
      }),
      btn("Yes or no", () => {
        const r = R.rollYesNo();
        oracle.textContent = `d6 ${r.die} — ${r.row.name}`;
        keepOracle(`Asked yes or no: d6 ${r.die} — ${r.row.name}`);
      })));
}

/**
 * The dialog action that writes a dialog-borne scene down. A prompt replaces
 * whatever modal is open, so this cannot be a button inside the body: it closes
 * the scene dialog, asks, and keeps the answer on the scene and in the journal
 * exactly as the framing card keeps it.
 */
export function framingAction(who) {
  if (!Settings.get("sceneFraming")) return null;
  return {
    label: "Write it down",
    onClick: () => {
      const scene = Store.mystery && Store.mystery.scene;
      setTimeout(async () => {
        const text = await promptModal({
          title: "Set the scene",
          message: `${SCENE_FRAMING.questions.join("  ")}  ${who ? `${who} is at the centre of it.` : ""}`,
          value: (scene && scene.framing) || "",
          multiline: true,
        });
        if (!text) return;
        // The scene may already have been handed on; the journal keeps it either way.
        if (scene && Store.mystery && Store.mystery.scene === scene) {
          Store.update("set the scene", () => { scene.framing = text; });
        }
        Store.journal("scene", text, { framing: true });
        rerender();
      }, 40);
    },
  };
}

export { showToast };
