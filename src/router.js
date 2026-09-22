// Bottom-nav routing plus the section nav every multi-route tab carries.

import { el, add, clear } from "./core.js";
import { coachBar } from "./coach.js";

const routes = new Map();
/**
 * Icons are inline SVG on one 24px grid at one stroke weight, so the bar reads
 * as a set rather than as five glyphs borrowed from a font.
 */
const ICON = {
  case: "<circle cx='10.5' cy='10.5' r='6.2'/><path d='M15.2 15.2 20 20'/>",
  play: "<rect x='4' y='4' width='16' height='16' rx='3.4'/><circle cx='9' cy='9' r='1.15' fill='currentColor' stroke='none'/><circle cx='15' cy='15' r='1.15' fill='currentColor' stroke='none'/><circle cx='12' cy='12' r='1.15' fill='currentColor' stroke='none'/>",
  clues: "<rect x='3.4' y='6.6' width='10.5' height='13.5' rx='2'/><path d='M8.4 4.2h9.2a2 2 0 0 1 2 2v9.4'/>",
  tables: "<rect x='3.5' y='4.5' width='17' height='15' rx='2'/><path d='M3.5 9.5h17M9.2 9.5v10'/>",
  more: "<circle cx='5.5' cy='12' r='1.3'/><circle cx='12' cy='12' r='1.3'/><circle cx='18.5' cy='12' r='1.3'/>",
};
const icon = (id) => {
  const holder = el("span", { class: "tab-icon", "aria-hidden": "true" });
  holder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[id] || ""}</svg>`;
  return holder;
};

export const TABS = [
  { id: "case", label: "Case", route: "home" },
  { id: "play", label: "Play", route: "play" },
  { id: "clues", label: "Clues", route: "clues" },
  { id: "tables", label: "Tables", route: "tables" },
  { id: "more", label: "More", route: "rules" },
];

export function register(name, def) { routes.set(name, def); }
export const route = () => (location.hash.replace(/^#\//, "").split("?")[0] || "home");
export const go = (name) => { location.hash = `#/${name}`; };

let badgeFn = () => ({});
let lastRoute = null;

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
    }, icon(t.id),
       el("span", { text: t.label }),
       badges[t.id] ? el("span", { class: "badge", title: `${t.label} needs attention`, text: String(badges[t.id]) }) : null));
  }
}

export async function render() {
  const name = route();
  const def = routes.get(name) || routes.get("home");
  // Re-rendering the screen you are already on keeps your place: a roll mid-way
  // down a scene should not throw you back to the top of it.
  const sameScreen = name === lastRoute;
  const keepTo = sameScreen ? window.scrollY : 0;
  const host = document.querySelector("#screen");
  const actionHost = document.querySelector("#action-host");
  clear(host); clear(actionHost);
  host.classList.remove("has-action");
  const nav = sectionNav(name);
  if (nav) add(host, nav);
  // The guide sits above every screen rather than inside each one, so a screen
  // added later cannot quietly ship without it.
  add(host, coachBar(name));
  const out = await def.render(host);
  if (out && out.action) {
    host.classList.add("has-action");
    add(actionHost, out.action[1]);
    add(host, out.action[0]);
  }
  renderTabs();
  host.focus({ preventScroll: true });
  window.scrollTo(0, keepTo); // the browser clamps if the screen got shorter
  lastRoute = name;
  document.title = `${def.title} · Caught in the Rain`;
}

export function start() {
  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#/home";
  return render();
}
