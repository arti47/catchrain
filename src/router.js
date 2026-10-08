// Bottom-nav routing plus the section nav every multi-route tab carries.

import { el, add, clear } from "./core.js";
import { coachBar } from "./coach.js";
import { attachLinks, xlink, ruleLink, seg, foldHelp } from "./ui.js";
import { Store } from "./store.js";

const routes = new Map();
/**
 * Icons are inline SVG on one 24px grid at one stroke weight, so the bar reads
 * as a set rather than as five glyphs borrowed from a font.
 */
const ICON = {
  // The Table: a desk top on its legs, a card lying on it.
  table: "<path d='M3 9.5h18M5 9.5V19M19 9.5V19'/><rect x='8.5' y='5' width='5' height='4.5' rx='.8'/>",
  // The Notebook: a bound book with its ribbon.
  notebook: "<rect x='5' y='3.5' width='14' height='17' rx='1.8'/><path d='M8.5 3.5v17M11.5 8h4.5M11.5 11.5h4.5'/><path d='M15 20.5v-4l1.3 1 1.3-1v4'/>",
  // The Book: two pages open.
  book: "<path d='M12 6.5c-2-1.4-5-1.8-8.5-1.2v13c3.5-.6 6.5-.2 8.5 1.2 2-1.4 5-1.8 8.5-1.2v-13c-3.5-.6-6.5-.2-8.5 1.2z'/><path d='M12 6.5v13'/>",
};
const icon = (id) => {
  const holder = el("span", { class: "tab-icon", "aria-hidden": "true" });
  holder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[id] || ""}</svg>`;
  return holder;
};

export const TABS = [
  { id: "table", label: "Table", route: "play" },
  { id: "notebook", label: "Notebook", route: "journal" },
  { id: "book", label: "Book", route: "rules" },
];

export function register(name, def) { routes.set(name, def); }
/** What a route is called, for a link that names where it goes. */
export const routeTitle = (name) => (routes.get(name) || {}).title || name;

/**
 * Where each screen's parts lead: to the rule a section automates, and to the
 * screen that owns state a section only shows. Kept in one table here, applied
 * after every render, so a screen written later is linked the same way and the
 * guard can read one list. A section that is not on screen right now is skipped.
 */
const LINKS = {
  home: () => ({
    "The problem": [xlink("case-sheet", "The whole mystery sheet"), xlink("clues", "The clues")],
    "Rivals": [ruleLink("rivals")],
    "Closed cases": [xlink("careers", "Your career")],
  }),
  "case-sheet": () => ({
    "Danger and the scene": [xlink("play", "Go to the scene")],
    "Clue sets": [xlink("clues", "Open the clues")],
    "The truth": [xlink("clues", "The case board"), xlink("solve", "The solve")],
    "Threats": [xlink("play", "Face them in the scene")],
    "Rivals": [xlink("home", "Rivals on the case screen")],
    "The decks": [xlink("clues", "The decks on the clues screen")],
  }),
  sheet: () => ({
    "Attributes": [ruleLink("test")],
    "Fatigue and time": [ruleLink("fatigue"), ruleLink("clock")],
    "Keywords": [ruleLink("keywords")],
    "Obligations": [ruleLink("obligation")],
  }),
  journal: () => ({ "How to read it": [ruleLink("solo-record")] }),
  play: () => ({
    "Stages": [ruleLink("stages")],
    "Threats": [ruleLink("threats")],
    "Keywords ready": [xlink("sheet", "Your keywords on the sheet"), ruleLink("keywords")],
    "Choose a scene": [ruleLink("scenes")],
  }),
  clues: () => ({
    "Where the case stands": [ruleLink("truths"), xlink("solve", "The solve")],
    "The decks": [ruleLink("clues"), ruleLink("jokers")],
  }),
  solve: () => ({ "What you know": [xlink("clues", "The case board")], "Your three guesses": [ruleLink("solve")] }),
  oracle: () => ({ "Yes or no": [ruleLink("solo-questions")] }),
  careers: () => ({ "Experience": [ruleLink("career")] }),
  wizard: () => ({ "Step": [ruleLink("investigator")] }),
  mystery: () => ({ "The problem": [ruleLink("problem")], "Difficulty": [ruleLink("difficulty")] }),
};
export const route = () => (location.hash.replace(/^#\//, "").split("?")[0] || "play");
export const go = (name) => { location.hash = `#/${name}`; };

let badgeFn = () => ({});
let lastRoute = null;

/**
 * The dock — guide line plus Next button — is fixed over the screen, and its
 * height changes with what the guide says (a warning adds a line, an opened
 * guide adds a card). The screen is padded by what it measures, not a guess,
 * so the last thing on the page always scrolls clear of it.
 */
let dockWatch = null;
function watchDock(actionHost) {
  const set = () => document.documentElement.style.setProperty("--dock", `${actionHost.getBoundingClientRect().height}px`);
  if (!dockWatch && typeof ResizeObserver === "function") { dockWatch = new ResizeObserver(set); dockWatch.observe(actionHost); }
  set();
}

export function setBadges(fn) { badgeFn = fn; }

/**
 * No sub-tab bars. A drawer — anything that opens off the Table, plus the
 * Book's own drawers — carries one way back; the Book's three pages carry one
 * switch between them.
 */
export function sectionNav(current) {
  const def = routes.get(current);
  if (!def) return null;
  if (def.book) {
    const sw = seg(["rules", "tables", "oracle"].map((r) => ({ value: r, label: routes.get(r).title })), current, (r) => go(r), "The Book");
    sw.classList.add("book-switch");
    return sw;
  }
  if (def.drawer) {
    const back = def.group === "book" ? "rules" : "play";
    return el("a", { class: "drawer-back", href: `#/${back}` }, el("span", { text: back === "play" ? "Table" : "Book" }));
  }
  return null;
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
  const def = routes.get(name) || routes.get("play");
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
  // The guide is one line, and it sits with the Next button: what to do and
  // the thing that does it, in one place under the thumb. A screen with no
  // Next button keeps the line at its top.
  const guide = coachBar(name);
  const out = await def.render(host);
  // The Book is reading matter; everywhere else, help folds under "More" —
  // and the links to a section's rule and owner fold in with it, so a section
  // shows its title, its drawing and its controls, and one "More".
  if (def.group !== "book") foldHelp(host);
  if (LINKS[name]) attachLinks(host, LINKS[name]());
  pairHeading(host);
  if (out && out.action) {
    host.classList.add("has-action");
    if (guide) { add(actionHost, guide); host.classList.add("has-guide"); }
    // A first session: the Next button is pointed at until the first case closes.
    const c = Store.career, inv = Store.investigator;
    if (c && inv && !c.history.length && (inv.day || 1) === 1) out.action[1].classList.add("hint");
    add(actionHost, out.action[1]);
    add(host, out.action[0]);
  } else if (guide) {
    host.insertBefore(guide, nav ? nav.nextSibling : host.firstChild);
  }
  host.classList.toggle("has-guide", !!(out && out.action && guide));
  watchDock(actionHost);
  renderTabs();
  // A screen that changed arrives; one that re-rendered under you does not, or
  // every roll would fade the page you are reading.
  if (!sameScreen) {
    // Changing tab, the new screen comes in from the side its tab is on; within
    // a tab it simply arrives.
    const tabOf = (r) => { const d = routes.get(r); return d ? TABS.findIndex((t) => { const td = routes.get(t.route); return td && td.group === d.group; }) : -1; };
    const was = lastRoute ? tabOf(lastRoute) : -1, now = tabOf(name);
    if (was >= 0 && now >= 0 && was !== now) host.dataset.from = now > was ? "right" : "left";
    else delete host.dataset.from;
    host.classList.remove("arriving");
    void host.offsetWidth;
    host.classList.add("arriving");
  }
  host.focus({ preventScroll: true });
  window.scrollTo(0, keepTo); // the browser clamps if the screen got shorter
  lastRoute = name;
  document.title = `${def.title} · Caught in the Rain`;
}

/**
 * "What this screen does" is a note about the heading, not a band across the
 * screen under it. Pairing them here rather than at twenty call sites means a
 * screen written later cannot get it wrong, which is the same reason the guide
 * lives in the router.
 */
function pairHeading(host) {
  const h1 = host.querySelector(":scope > h1");
  const note = h1 && h1.nextElementSibling;
  if (!h1 || !note || !note.classList.contains("explain")) return;
  const rowEl = el("div", { class: "heading-row" });
  h1.replaceWith(rowEl);
  add(rowEl, h1, note);
}

export function start() {
  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#/play";
  return render();
}
