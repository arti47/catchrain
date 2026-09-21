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
    }),
    btn("Yes or no", () => {
      const r = R.rollYesNo();
      oracle.textContent = `d6 ${r.die} — ${r.row.name}`;
    })));
  add(body, el("p", { class: "small muted", text: SCENE_FRAMING.unsure }));

  add(wrap, el("summary", { text: written ? "The scene, as you set it" : "Set the scene" }), body);
  return wrap;
}

/** Used by the scene dialogs, which have their own body to add it to. */
export function framingLines(who) {
  return el("div", {},
    el("ul", { class: "ask" }, ...SCENE_FRAMING.questions.map((q) => el("li", { text: q }))),
    el("p", { class: "small muted", text: who ? `${who} is at the centre of it. ${SCENE_FRAMING.note}` : SCENE_FRAMING.note }));
}

export { showToast };
