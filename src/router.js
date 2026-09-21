// Bottom-nav routing plus the section nav every multi-route tab carries.

import { el, add, clear } from "./core.js";

const routes = new Map();
export const TABS = [
  { id: "case", label: "Case", icon: "◈", route: "home" },
  { id: "play", label: "Play", icon: "▶", route: "play" },
  { id: "clues", label: "Clues", icon: "♣", route: "clues" },
  { id: "tables", label: "Tables", icon: "≡", route: "tables" },
  { id: "more", label: "More", icon: "•••", route: "rules" },
];

export function register(name, def) { routes.set(name, def); }
export const route = () => (location.hash.replace(/^#\//, "").split("?")[0] || "home");
export const go = (name) => { location.hash = `#/${name}`; };

let badgeFn = () => ({});

export function setBadges(fn) { badgeFn = fn; }

/** The pill row of sibling routes for the current tab group. */
export function sectionNav(current) {
  const def = routes.get(current);
  if (!def || !def.group) return null;
  const siblings = [...routes.entries()].filter(([, d]) => d.group === def.group && !d.hidden);
  if (siblings.length < 2) return null;
  const badges = badgeFn() || {};
  const nav = el("nav", { class: "section-nav", "aria-label": def.group });
  for (const [name, d] of siblings) {
    add(nav, el("a", {
      href: `#/${name}`,
      "aria-current": name === current ? "page" : null,
    }, d.title, badges[name] ? el("span", { class: "dot", title: badges[name] }) : null));
  }
  return nav;
}

export function renderTabs() {
  const bar = document.querySelector("#tab-bar");
  if (!bar) return;
  clear(bar);
  const current = routes.get(route());
  const badges = badgeFn() || {};
  for (const t of TABS) {
    const def = routes.get(t.route);
    const active = current && def && current.group === def.group;
    add(bar, el("a", {
      class: "tab", href: `#/${t.route}`, "aria-current": active ? "page" : null,
    }, el("span", { class: "tab-icon", "aria-hidden": "true", text: t.icon }),
       el("span", { text: t.label }),
       badges[t.id] ? el("span", { class: "badge", text: String(badges[t.id]) }) : null));
  }
}

export async function render() {
  const name = route();
  const def = routes.get(name) || routes.get("home");
  const host = document.querySelector("#screen");
  const actionHost = document.querySelector("#action-host");
  clear(host); clear(actionHost);
  host.classList.remove("has-action");
  const nav = sectionNav(name);
  if (nav) add(host, nav);
  const out = await def.render(host);
  if (out && out.action) {
    host.classList.add("has-action");
    add(actionHost, out.action[1]);
    add(host, out.action[0]);
  }
  renderTabs();
  host.focus({ preventScroll: true });
  if (!out || !out.keepScroll) window.scrollTo(0, 0);
  document.title = `${def.title} · Caught in the Rain`;
}

export function start() {
  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#/home";
  return render();
}
