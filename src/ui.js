// Themed modal / toast / confirm / prompt, the explain() note, and the pinned action bar.
// No native alert/confirm/prompt anywhere in the app.

import { el, add, clear, $ } from "./core.js";

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
  let host = $("#toast");
  if (!host) { host = el("div", { id: "toast", class: "toast", role: "status", "aria-live": "polite" }); document.body.append(host); }
  host.className = `toast show ${kind}`;
  host.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.className = "toast"; }, 3200);
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

export const pill = (text, kind = "") => el("span", { class: `pill ${kind}`, text });

export const emptyState = (text, actionLabel, onAction) =>
  el("div", { class: "empty" }, el("p", { text }), actionLabel ? btn(actionLabel, onAction, "primary") : null);

export { clear };
