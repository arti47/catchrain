// Themed modal / toast / confirm / prompt, the explain() note, and the pinned action bar.
// No native alert/confirm/prompt anywhere in the app.

import { el, add, clear } from "./core.js";

let openModal = null;

export function modal({ title, body, actions = [], dismissable = true, onClose }) {
  closeModal();
  const prev = document.activeElement;
  const card = el("div", { class: "modal-card", role: "document" });
  const head = el("div", { class: "modal-head" }, el("h2", { class: "modal-title", id: "modal-title", text: title || "" }));
  const content = el("div", { class: "modal-body" });
  add(content, body);
  const foot = el("div", { class: "modal-actions" });
  // Primary first, always (§6.4).
  actions.forEach((a, i) => {
    const btn = el("button", {
      class: `btn ${a.kind || (i === 0 ? "primary" : "ghost")}`,
      type: "button",
      onclick: () => { const keep = a.onClick && a.onClick(); if (!keep) closeModal(); },
    }, a.label);
    add(foot, btn);
  });
  add(card, head, content, actions.length ? foot : null);
  const overlay = el("div", { class: "modal-overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-title" }, card);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay && dismissable) closeModal(); });
  const onKey = (e) => {
    if (e.key === "Escape" && dismissable) { closeModal(); return; }
    if (e.key !== "Tab") return;
    const f = card.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
  openModal = { overlay, onKey, prev, onClose };
  const focusable = card.querySelector("button, input, textarea, select");
  if (focusable) focusable.focus();
  return { close: closeModal, card, content };
}

export function closeModal() {
  if (!openModal) return;
  const { overlay, onKey, prev, onClose } = openModal;
  document.removeEventListener("keydown", onKey);
  overlay.remove();
  openModal = null;
  if (prev && prev.focus) prev.focus();
  if (onClose) onClose();
}

export function confirmModal({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false }) {
  return new Promise((resolveRaw) => {
    let settled = false;
    const resolve = (v) => { if (!settled) { settled = true; resolveRaw(v); } };
    modal({
      title,
      body: el("p", { class: "muted", text: message }),
      dismissable: true,
      onClose: () => resolve(false),
      actions: [
        { label: confirmLabel, kind: danger ? "danger" : "primary", onClick: () => { resolve(true); } },
        { label: cancelLabel, kind: "ghost", onClick: () => resolve(false) },
      ],
    });
  });
}

export function promptModal({ title, message, value = "", placeholder = "", multiline = false, confirmLabel = "Save" }) {
  return new Promise((resolveRaw) => {
    let settled = false;
    const resolve = (v) => { if (!settled) { settled = true; resolveRaw(v); } };
    const input = multiline
      ? el("textarea", { class: "input", rows: 4, placeholder })
      : el("input", { class: "input", type: "text", placeholder });
    input.value = value;
    modal({
      title,
      body: el("div", {}, message ? el("p", { class: "muted", text: message }) : null, input),
      onClose: () => resolve(null),
      actions: [
        { label: confirmLabel, onClick: () => resolve(input.value.trim()) },
        { label: "Cancel", kind: "ghost", onClick: () => resolve(null) },
      ],
    });
    setTimeout(() => input.focus(), 30);
  });
}

export function chooseModal({ title, message, options, allowCancel = true }) {
  return new Promise((resolve) => {
    // closeModal() fires onClose, so the choice must be recorded before the
    // dialog closes or the cancel path resolves first and the pick is lost.
    let picked = false;
    const settle = (value) => { if (!picked) { picked = true; resolve(value); } };
    const list = el("div", { class: "choice-list" });
    options.forEach((o) => {
      add(list, el("button", {
        class: "choice", type: "button",
        onclick: () => { settle(o.value); closeModal(); },
      }, el("span", { class: "choice-label", text: o.label }), o.note ? el("span", { class: "choice-note", text: o.note }) : null));
    });
    modal({
      title,
      body: el("div", {}, message ? el("p", { class: "muted", text: message }) : null, list),
      dismissable: allowCancel,
      onClose: () => settle(null),
      actions: allowCancel ? [{ label: "Cancel", kind: "ghost", onClick: () => settle(null) }] : [],
    });
  });
}

let toastTimer = null;
export function showToast(text, kind = "") {
  let host = document.querySelector("#toast");
  if (!host) { host = el("div", { id: "toast", class: "toast", role: "status", "aria-live": "polite" }); document.body.append(host); }
  host.className = `toast show ${kind}`;
  host.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.className = "toast"; }, 3200);
}

/**
 * A toast that asks for one tap instead of blocking the game: it sits above the
 * tab bar, stays until it is answered or dismissed, and never covers the screen
 * the way a modal does. Used for the update prompt.
 */
let actionToastEl = null;
export function actionToast({ text, actionLabel, onAction, dismissLabel = "Dismiss" }) {
  dismissActionToast();
  const act = el("button", {
    class: "btn primary", type: "button",
    onclick: () => { dismissActionToast(); if (onAction) onAction(); },
  }, actionLabel);
  const close = el("button", {
    class: "icon-btn", type: "button", "aria-label": dismissLabel, title: dismissLabel,
    onclick: () => dismissActionToast(),
  }, "\u2715");
  actionToastEl = el("div", { class: "toast-action", role: "status", "aria-live": "polite" },
    el("span", { class: "toast-text", text }), act, close);
  document.body.append(actionToastEl);
  return { dismiss: dismissActionToast };
}
export function dismissActionToast() {
  if (actionToastEl) { actionToastEl.remove(); actionToastEl = null; }
}

/** The per-screen "what this does" note: collapsed by default, two to four sentences. */
export function explain(text) {
  const d = el("details", { class: "explain" });
  add(d, el("summary", { text: "What this screen does" }), el("p", { text }));
  return d;
}

/** Pinned primary action. Returns the bar and its spacer together so neither is forgotten. */
export function actionBar(label, onClick, context) {
  const bar = el("div", { class: "action-bar" },
    el("button", { class: "btn primary big", type: "button", onclick: onClick },
      el("span", { text: label }), context ? el("span", { class: "action-context", text: context }) : null));
  const spacer = el("div", { class: "action-spacer" });
  return [spacer, bar];
}

export const section = (title, ...children) =>
  el("section", { class: "card" }, title ? el("h3", { class: "card-title", text: title }) : null, ...children);

export const row = (label, value) =>
  el("div", { class: "row" }, el("span", { class: "row-label", text: label }), el("span", { class: "row-value" }, value));

/** Long values stack, short values sit inline (§6.5). */
export const defRow = (label, value) =>
  el("div", { class: "defrow" }, el("span", { class: "row-label", text: label }), el("div", { class: "defrow-value" }, value));

export const btn = (label, onClick, kind = "ghost", attrs = {}) =>
  el("button", { class: `btn ${kind}`, type: "button", onclick: onClick, ...attrs }, label);

/** One option out of a set: the chosen one is pressed, for screen readers and for the audit. */
export const optionBtn = (label, onClick, selected) =>
  btn(label, onClick, selected ? "primary" : "ghost", { "aria-pressed": selected ? "true" : "false" });

export const pill = (text, kind = "") => el("span", { class: `pill ${kind}`, text });

const SUIT_PIP = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
/**
 * One playing card, drawn as a card: corner index, suit pip, red suits in rust.
 * `opts.flip` turns it over as it arrives, for the one moment the game turns a
 * card over on purpose — the solve. The map callback passes an index here, so
 * options are read defensively.
 */
export const cardFace = (c, opts) => el("span", {
  class: `pcard ${c.suit === "H" || c.suit === "D" ? "red" : ""}${opts && opts.flip ? " flip" : ""}`,
  "aria-label": `${c.rank} of ${{ S: "spades", H: "hearts", D: "diamonds", C: "clubs" }[c.suit] || "?"}`,
}, el("span", { class: "rank", text: c.rank }), el("span", { class: "pip", text: SUIT_PIP[c.suit] || "?" }));

/** A die face as pips, not a digit. */
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const pipFace = (n) => {
  const face = el("span", { class: `face f${n}` });
  const on = new Set(PIPS[n] || []);
  for (let i = 0; i < 9; i++) add(face, on.has(i) ? el("i") : el("span"));
  return face;
};
/**
 * A die as a die: six pip faces on a cube that tumbles and lands on the number
 * that was rolled. The number itself is on the wrapper, so a screen reader —
 * or a flattened app, or a player who asked for less motion — reads the result
 * without any of the geometry. CSS does all of it; nothing is imported for it.
 */
export function dieFace(n, kind = "") {
  const die = el("span", { class: `die ${kind}`, role: "img", "aria-label": `${n}` });
  const cube = el("span", { class: "cube", "data-face": String(n), "aria-hidden": "true" });
  for (let f = 1; f <= 6; f++) add(cube, pipFace(f));
  add(die, el("span", { class: "tumble" }, cube));
  return die;
}

export const emptyState = (text, actionLabel, onAction) =>
  el("div", { class: "empty" }, el("p", { text }), actionLabel ? btn(actionLabel, onAction, "primary") : null);

export { clear };
