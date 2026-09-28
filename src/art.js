// Everything the app draws that is not a die face, a card face or the clock.
//
// One family: ink line art on a 24-unit grid at the tab icons' stroke weight,
// round caps, no fill except where a fill is the information (a filled mark, a
// done stage). Colour only where it already means something — danger amber,
// truth blue, loss rust, settled green — and ink everywhere else, so nothing
// here spends the colour budget on decoration. No people (product decision 9),
// no image files, nothing imported: every picture is a string of SVG or a CSS
// rule, so it themes with currentColor and costs the cache nothing.
//
// Two kinds of thing live here, and they are told apart by how they are
// labelled. A data graphic shows state the game turns on, so it is role="img"
// with the state in words on its aria-label. A glyph or an illustration shows
// nothing a screen reader is missing, so it is aria-hidden.

import { el, add } from "./core.js";
import { DECK, STAGES, TEST_OUTCOMES, CONSEQUENCES_SOLO, YES_NO, INVESTIGATION_ROLL, FATIGUE_BOXES } from "../data.js";
import { cardFace, dieFace } from "./ui.js";

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

/** An SVG element from a viewBox and its insides. Decorative unless given a label. */
export function svg(viewBox, inner, { cls = "", label = null, w = null, h = null } = {}) {
  const holder = el("span", {
    class: `art ${cls}`.trim(),
    role: label ? "img" : null,
    "aria-label": label,
    "aria-hidden": label ? null : "true",
  });
  const size = `${w ? ` width="${w}"` : ""}${h ? ` height="${h}"` : ""}`;
  holder.innerHTML = `<svg viewBox="${viewBox}"${size} focusable="false">${inner}</svg>`;
  return holder;
}

// --- Glyphs -------------------------------------------------------------------
// The tab icons' family: 24x24, one stroke, round everything.
const GLYPHS = {
  // A door left ajar: somewhere you are about to go in.
  investigation: `<path ${STROKE} d="M6 21V3.5h12V21M3.5 21h17"/><path ${STROKE} d="M6 3.5 12.5 5.6V22.4L6 21"/><circle cx="11" cy="13" r=".9" fill="currentColor"/>`,
  // A card with the arrow that turns it over.
  truth: `<rect ${STROKE} x="4.5" y="4" width="10.5" height="15.5" rx="1.8"/><path ${STROKE} d="M18.2 7.5a6.2 6.2 0 0 1 0 8.6"/><path ${STROKE} d="M18.4 16.3l-2.3.2.4-2.2"/><path ${STROKE} d="M8 9.5l1.8 1.8L8 13.1 6.2 11.3z"/>`,
  // A cup with the steam still coming off it.
  rest: `<path ${STROKE} d="M5 10.5h11V15a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 15z"/><path ${STROKE} d="M16 11.5h1.4a2.2 2.2 0 0 1 0 4.4H16"/><path ${STROKE} d="M9 3.8c-1.1 1.5 1.1 2.1 0 3.8M12.4 3.8c-1.1 1.5 1.1 2.1 0 3.8"/>`,
  // The rest of their life: a door with a light on above it.
  obligation: `<path ${STROKE} d="M4 11.2 12 4.2l8 7"/><path ${STROKE} d="M6.2 9.4V20.5h11.6V9.4"/><path ${STROKE} d="M10 20.5v-5.3h4v5.3"/><path ${STROKE} d="M12 11.6h.01"/>`,
  // A signature keyword: a rosette with its ribbons, not a typed star.
  seal: `<circle ${STROKE} cx="12" cy="9.5" r="5.6"/><circle ${STROKE} cx="12" cy="9.5" r="2.4"/><path ${STROKE} d="M8.6 14 7 21l2.6-1.4L11.3 21M15.4 14 17 21l-2.6-1.4L12.7 21"/>`,
  // Dawn: the day that turns.
  dawn: `<path ${STROKE} d="M3 17.5h18M6.5 17.5a5.5 5.5 0 0 1 11 0"/><path ${STROKE} d="M12 5.5v2.4M5.2 9.3l1.7 1.7M18.8 9.3l-1.7 1.7M3 13.8h2.2M18.8 13.8H21"/><path ${STROKE} d="M8 21h8"/>`,
  // A small clock face for a day in the journal.
  day: `<circle ${STROKE} cx="12" cy="12" r="8"/><path ${STROKE} d="M12 7.5V12l3 2"/>`,
  // The title bar's drop.
  drop: `<path ${STROKE} d="M12 3.5c3.2 4.3 5.5 7.4 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.9 8.8 7.8 12 3.5z"/>`,
  // Light, dark, and the system's own choice between them.
  sun: `<circle ${STROKE} cx="12" cy="12" r="4.2"/><path ${STROKE} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>`,
  moon: `<path ${STROKE} d="M19 14.6A7.6 7.6 0 1 1 9.4 5a6 6 0 0 0 9.6 9.6z"/>`,
  system: `<circle ${STROKE} cx="12" cy="12" r="7.6"/><path d="M12 4.4a7.6 7.6 0 0 1 0 15.2z" fill="currentColor"/>`,
  // Depth: a cube.
  cube: `<path ${STROKE} d="M12 3.5 19.5 7.7v8.6L12 20.5l-7.5-4.2V7.7z"/><path ${STROKE} d="M4.5 7.7 12 12l7.5-4.3M12 12v8.5"/>`,
  // A keyword: a tag on its string.
  tag: `<path ${STROKE} d="M4 12.2V5.5A1.5 1.5 0 0 1 5.5 4h6.7L20 11.8 11.8 20z"/><circle ${STROKE} cx="8.4" cy="8.4" r="1.4"/>`,
  // A case: the folder it is kept in.
  folder: `<path ${STROKE} d="M3.5 7V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5h-7L10 5H5a1.5 1.5 0 0 0-1.5 1.5z"/>`,
  // A clue: one card.
  card: `<rect ${STROKE} x="6" y="3.5" width="12" height="17" rx="2"/><path ${STROKE} d="M12 9.5l2.2 2.5L12 14.5 9.8 12z"/>`,
  // A threat: an eye in the dark, open.
  threat: `<path ${STROKE} d="M2.8 12S6.2 6 12 6s9.2 6 9.2 6-3.4 6-9.2 6S2.8 12 2.8 12z"/><circle ${STROKE} cx="12" cy="12" r="2.6"/>`,
  // Company: two chairs at one table, nobody in them.
  chairs: `<path ${STROKE} d="M3 12h18M7 12v7M17 12v7"/><path ${STROKE} d="M4 12V6.5M4 9h3.5M20 12V6.5M20 9h-3.5"/>`,
  // A single die, for the oracle's lines in the story.
  die: `<rect ${STROKE} x="4.5" y="4.5" width="15" height="15" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>`,
  // The three set aside, turned over.
  // --- The third pass ---
  // Undo: the arrow that goes back on itself.
  undo: `<path ${STROKE} d="M9 5 4.5 9.5 9 14"/><path ${STROKE} d="M4.5 9.5H14a5 5 0 0 1 0 10h-3"/>`,
  // An update: the arrows that come round again.
  refresh: `<path ${STROKE} d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9"/><path ${STROKE} d="M18.2 3.6v3.7h-3.7M5.8 20.4v-3.7h3.7"/>`,
  // The guide's mark: a signpost's arrow.
  arrow: `<path ${STROKE} d="M5 12h13M13 7l5 5-5 5"/>`,
  // The four stages: a key, a lens, a hand-held card, a door with the way out.
  key: `<circle ${STROKE} cx="8" cy="12" r="3.6"/><path ${STROKE} d="M11.6 12H20M17 12v3M20 12v2.4"/>`,
  lens: `<circle ${STROKE} cx="10.5" cy="10.5" r="5.5"/><path ${STROKE} d="M14.6 14.6 20 20"/>`,
  take: `<rect ${STROKE} x="8" y="3.5" width="9" height="13" rx="1.6" transform="rotate(10 12.5 10)"/><path ${STROKE} d="M4 20.5c2.5-2.2 5-2.6 8-2.2l4.5.6"/>`,
  exit: `<path ${STROKE} d="M13.5 4H6v16h7.5"/><path ${STROKE} d="M11 12h9.5M17 8.5l3.5 3.5-3.5 3.5"/>`,
  // Writing it down.
  pen: `<path ${STROKE} d="M4.5 19.5 5.6 15 16.2 4.4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L9 18.4z"/><path ${STROKE} d="M14.6 6 18 9.4M4.5 19.5h15"/>`,
  // Oracle words: two tiles.
  tiles: `<rect ${STROKE} x="3" y="8" width="8" height="8" rx="1.5"/><rect ${STROKE} x="13" y="8" width="8" height="8" rx="1.5"/>`,
  // Leaving and arriving: the backup's two directions.
  out: `<path ${STROKE} d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path ${STROKE} d="M4.5 13v5.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V13"/>`,
  in: `<path ${STROKE} d="M12 3.5V15M7.5 10.5 12 15l4.5-4.5"/><path ${STROKE} d="M4.5 13v5.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V13"/>`,
  // A filter: the shield in front of what you asked not to see.
  shield: `<path ${STROKE} d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/>`,
  // A lamp kept on.
  lamp: `<path ${STROKE} d="M8 4.5h8l2.5 7h-13z"/><path ${STROKE} d="M12 11.5v6M8.5 20.5h7M12 17.5v3"/>`,
  // A thing: a parcel tied with string.
  parcel: `<path ${STROKE} d="M4 8.5 12 4.5l8 4v8l-8 4-8-4z"/><path ${STROKE} d="M4 8.5 12 12.5l8-4M12 12.5v8"/>`,
  // A name: a card with a line on it.
  label: `<rect ${STROKE} x="3.5" y="6.5" width="17" height="11" rx="2"/><path ${STROKE} d="M7 10.5h10M7 13.5h6"/>`,
  // The four genres, each from its own watermark: blinds, a tower, a door, a trace.
  noir: `<rect ${STROKE} x="4" y="4" width="16" height="16" rx="1.5"/><path ${STROKE} d="M4 8.5h16M4 12h16M4 15.5h16"/>`,
  fantasy: `<path ${STROKE} d="M7 20.5V11l-1.5-1.5V6h2.5v1.8h2V6h4v1.8h2V6h2.5v3.5L17 11v9.5z"/><path ${STROKE} d="M12 6V2.8l3.5 1.2L12 5.2"/>`,
  horror: `<path ${STROKE} d="M6.5 20.5 7.2 4l10.3.8-.4 15.7"/><circle cx="14" cy="12.5" r="1" fill="currentColor"/><path ${STROKE} d="M14 13.5v2"/>`,
  scifi: `<path ${STROKE} d="M3.5 7h6l3 3h8M3.5 15h9l2.5 2.5h5"/><circle ${STROKE} cx="20.5" cy="10" r="1"/><circle ${STROKE} cx="20.5" cy="17.5" r="1"/>`,
  reveal: `<rect ${STROKE} x="2.5" y="6" width="7" height="11" rx="1.4" transform="rotate(-10 6 11.5)"/><rect ${STROKE} x="8.5" y="5" width="7" height="11" rx="1.4"/><rect ${STROKE} x="14.5" y="6" width="7" height="11" rx="1.4" transform="rotate(10 18 11.5)"/>`,
};

export const glyph = (name, size = 22, cls = "") =>
  svg("0 0 24 24", GLYPHS[name] || "", { cls: `glyph glyph-${name} ${cls}`.trim(), w: size, h: size });

// --- Illustrations ------------------------------------------------------------
// Bigger drawings in the same hand, for the places a screen has nothing in it
// yet and for the one screen a first-timer reads hardest.
const ILLUSTRATIONS = {
  // No investigator yet: a coat and a hat on the peg, nobody in them.
  investigator: ["0 0 160 110", `
    <path ${STROKE} d="M20 18h120"/><path ${STROKE} d="M80 18v10"/>
    <path ${STROKE} d="M80 28c-4 0-6 3-6 6"/>
    <path ${STROKE} d="M74 34 52 48l-6 50h68l-6-50-22-14"/>
    <path ${STROKE} d="M80 34v64M66 58h8M86 58h8"/>
    <path ${STROKE} d="M60 48l-4 28M100 48l4 28"/>
    <ellipse ${STROKE} cx="118" cy="27" rx="16" ry="3.5"/>
    <path ${STROKE} d="M106 27c0-9 4-13 12-13s12 4 12 13"/><path ${STROKE} d="M107 22.5h22"/>`],
  // No case yet: a folder, closed, with nothing clipped to it.
  mystery: ["0 0 160 110", `
    <path ${STROKE} d="M28 30h36l8 9h60v56H28z"/><path ${STROKE} d="M28 46h104"/>
    <path ${STROKE} d="M44 66h48M44 76h32" opacity=".55"/>
    <rect ${STROKE} x="104" y="60" width="18" height="22" rx="3" transform="rotate(-8 113 71)"/>`],
  // No clues yet: a corkboard with two pins and a string between them, slack.
  clues: ["0 0 160 110", `
    <rect ${STROKE} x="22" y="16" width="116" height="78" rx="3"/>
    <circle cx="52" cy="38" r="3" fill="currentColor"/><circle cx="110" cy="46" r="3" fill="currentColor"/>
    <path ${STROKE} d="M52 38c16 30 42 30 58 8" stroke-dasharray="3 3"/>
    <rect ${STROKE} x="40" y="60" width="22" height="16" rx="1.5" opacity=".55"/>
    <rect ${STROKE} x="96" y="58" width="16" height="22" rx="1.5" opacity=".55"/>`],
  // An empty journal: the book open, the pen across it.
  journal: ["0 0 160 110", `
    <path ${STROKE} d="M80 26c-12-6-30-8-50-4v64c20-4 38-2 50 4 12-6 30-8 50-4V22c-20-4-38-2-50 4z"/>
    <path ${STROKE} d="M80 26v64"/>
    <path ${STROKE} d="M42 40h26M42 50h22M92 40h26M92 50h18" opacity=".55"/>
    <path ${STROKE} d="M108 76 136 48l5 5-28 28-7 2z"/>`],
  // The first screen: rain on a window at night, a lamp across the street.
  hero: ["0 0 320 128", `
    <rect ${STROKE} x="16" y="10" width="288" height="108" rx="4"/>
    <path ${STROKE} d="M160 10v108M16 64h288"/>
    <g opacity=".55">
      <path ${STROKE} d="M44 22l-8 24M78 18l-8 24M112 26l-8 24M190 20l-8 24M232 16l-8 24M270 24l-8 24M58 74l-8 24M100 80l-8 24M206 76l-8 24M252 82l-8 24"/>
    </g>
    <path ${STROKE} d="M122 118V84M122 84c0-6 4-9 9-9h6"/><path ${STROKE} d="M134 75h8l-2 5h-4z"/>
    <path ${STROKE} d="M126 118h-10M292 118h-44l-8-14h-30l-8 14" opacity=".55"/>`],
};

export function illustration(name, cls = "") {
  const [box, inner] = ILLUSTRATIONS[name] || ILLUSTRATIONS.mystery;
  return svg(box, inner, { cls: `illustration illustration-${name} ${cls}`.trim() });
}

// --- Genre watermarks -----------------------------------------------------------
// One faint drawing per genre, behind every screen while a case is open. Ink
// only, and drawn as a CSS background so it can never sit in front of anything.
const MOTIFS = {
  // Light through venetian blinds across a wall.
  noir: `<g transform="rotate(-14 200 200)">${Array.from({ length: 11 }, (_, i) => `<rect x="40" y="${40 + i * 30}" width="320" height="13" rx="2"/>`).join("")}</g><rect x="30" y="30" width="340" height="340" rx="6" fill="none" stroke-width="4"/>`,
  // A tower with its pennant.
  fantasy: `<path d="M150 380V170l-22-22v-40h24v20h20v-20h24v20h20v-20h24v40l-22 22v210z" fill="none" stroke-width="5"/><path d="M200 108V40l52 18-52 18" fill="none" stroke-width="5"/><path d="M182 380v-70a18 18 0 0 1 36 0v70" fill="none" stroke-width="5"/><path d="M176 200h48M176 250h48" stroke-width="4"/>`,
  // A crooked door, the keyhole lit.
  horror: `<path d="M120 380 132 70l150 12-6 298" fill="none" stroke-width="5"/><path d="M146 360 154 96l110 10-4 254" fill="none" stroke-width="4"/><circle cx="240" cy="240" r="9"/><path d="M240 248l-6 26h12z"/><path d="M60 380h280" stroke-width="5"/>`,
  // Circuit traces running to their pads.
  scifi: `<g fill="none" stroke-width="5"><path d="M40 90h110l40 40h170"/><path d="M40 170h70l30-30h60"/><path d="M40 250h150l40 40h130"/><path d="M110 330h90l30-30h130"/><path d="M270 40v60M320 130v120"/></g><g>${[[150, 90], [360, 130], [200, 140], [190, 250], [360, 290], [230, 300], [270, 40], [320, 250], [110, 330]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join("")}</g>`,
};

/** The data: URI for a genre's watermark, in the ink colour passed. */
export function motifUrl(genreId, ink) {
  const inner = MOTIFS[genreId];
  if (!inner) return "none";
  const body = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' fill='${ink}' stroke='${ink}'>${inner.replace(/"/g, "'")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(body)}")`;
}

// --- Data graphics ------------------------------------------------------------

/** The twelve face cards — the whole deduction — as the cards themselves. */
export function faceGrid(m) {
  const seen = new Set((m.truthRevealed || []).map((c) => `${c.rank}${c.suit}`));
  const ruled = [...seen].length;
  const grid = el("div", {
    class: "face-grid", role: "img",
    "aria-label": `The twelve face cards: ${ruled} ruled out, ${DECK.truthRanks.length * DECK.suits.length - ruled} still unseen.`,
  });
  for (const rank of DECK.truthRanks) {
    for (const suit of DECK.suits) {
      const key = `${rank}${suit}`;
      if (seen.has(key)) {
        const face = cardFace({ rank, suit });
        face.classList.add("ruled");
        face.setAttribute("aria-hidden", "true");
        add(grid, face);
      } else {
        add(grid, cardBack());
      }
    }
  }
  return grid;
}

/** A face-down card: the icon's rain, on card stock. */
export const cardBack = (cls = "") => el("span", { class: `pcard back ${cls}`.trim(), "aria-hidden": "true" });

/** A stack of face-down cards, as thick as the count it stands for. */
export function deckStack(count, label) {
  const layers = count <= 0 ? 0 : Math.min(7, Math.max(1, Math.ceil(count / 6)));
  const stack = el("span", { class: `deck-stack ${count ? "" : "empty"}`.trim(), role: "img", "aria-label": `${label}: ${count}` });
  for (let i = 0; i < layers; i++) {
    const b = cardBack("mini");
    b.style.setProperty("--layer", String(i));
    add(stack, b);
  }
  if (!layers) add(stack, el("span", { class: "pcard mini hollow", "aria-hidden": "true" }));
  stack.style.setProperty("--layers", String(layers));
  return stack;
}

/** Boxes to fill: marks against a threat's level, the way fatigue is marked. */
export function markBoxes(marks, level) {
  const inner = Array.from({ length: level }, (_, i) =>
    `<rect x="${1 + i * 11}" y="1" width="8" height="10" rx="1.6" class="${i < marks ? "on" : "off"}"/>`).join("");
  return svg(`0 0 ${level * 11} 12`, inner, { cls: "marks", label: `${marks} of ${level} marks`, w: level * 11, h: 12 });
}

/** Three notches, filled to a threat's level: how close it is to you. */
export function levelBars(level) {
  const inner = [0, 1, 2].map((i) =>
    `<rect x="${i * 5}" y="${8 - i * 3.5}" width="3.4" height="${4 + i * 3.5}" rx="1" class="${i < level ? "on" : "off"}"/>`).join("");
  return svg("0 0 14 12", inner, { cls: "level-bars", label: `Level ${level} of 3`, w: 14, h: 12 });
}

/** Danger on a gauge, banded the way the app already reads it. */
export function dangerGauge(danger) {
  const top = 12;
  const cells = Array.from({ length: top }, (_, i) => {
    const v = i + 1;
    const band = v <= 2 ? "low" : v <= 5 ? "mid" : v <= 8 ? "high" : "extreme";
    return `<rect x="${i * 7}" y="2" width="5.4" height="8" rx="1.2" class="${band} ${v <= danger ? "on" : "off"}"/>`;
  }).join("");
  const over = danger > top ? `<path d="M${top * 7 + 1} 3l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` : "";
  const band = danger <= 2 ? "low" : danger <= 5 ? "moderate" : danger <= 8 ? "high" : "extreme";
  return svg(`0 0 ${top * 7 + (over ? 7 : 0)} 12`, cells + over, { cls: "danger-gauge", label: `Danger ${danger}, ${band}`, w: top * 7 + (over ? 7 : 0), h: 12 });
}

/**
 * A strip of the totals a roll can make, banded by what each total does, with
 * the roll marked on it — and, inside an investigation, the danger it had to
 * clear. `bands` is a resolution table from data.js; nothing here knows a rule.
 */
function scale({ lo, hi, bands, bandClass, total, danger = null, label }) {
  const cell = 16, span = hi - lo + 1, w = span * cell;
  let inner = "";
  for (let v = lo; v <= hi; v++) {
    const row = bands.find((b) => v >= b.min && v <= b.max) || bands[bands.length - 1];
    inner += `<rect x="${(v - lo) * cell + 1}" y="10" width="${cell - 2}" height="10" rx="2" class="band ${bandClass(row)}${v === total ? " hit" : ""}"/>`;
  }
  // No total yet (an oracle not asked): the bands alone, waiting for a marker.
  if (total !== null) {
    const at = (Math.min(Math.max(total, lo), hi) - lo) * cell + cell / 2;
    inner += `<path d="M${at - 5} 1h10l-5 7z" class="marker"/>`;
  }
  if (danger !== null && danger >= lo && danger <= hi + 1) {
    const dx = (Math.min(danger, hi + 1) - lo) * cell;
    inner += `<path d="M${dx} 8v15" class="danger-line"/>`;
  }
  return svg(`0 0 ${w} 24`, inner, { cls: "roll-scale", label, w, h: 24 });
}

export function testScale(total, dangerAtRoll = null) {
  const row = TEST_OUTCOMES.find((b) => total >= b.min && total <= b.max);
  const words = TEST_OUTCOMES.map((b) => `${b.name.toLowerCase()} ${b.min < 0 ? `up to ${b.max}` : b.max > 50 ? `from ${b.min}` : `${b.min} to ${b.max}`}`).join(", ");
  return scale({
    lo: 2, hi: 15, bands: TEST_OUTCOMES, bandClass: (b) => b.id, total, danger: dangerAtRoll,
    label: `Total ${total}: ${row ? row.name.toLowerCase() : ""}. ${words}.${dangerAtRoll !== null ? ` Danger was ${dangerAtRoll}.` : ""}`,
  });
}

export function consequenceScale(total) {
  const row = CONSEQUENCES_SOLO.find((b) => total >= b.min && total <= b.max);
  return scale({
    lo: 1, hi: 9, bands: CONSEQUENCES_SOLO, bandClass: (b) => `c-${b.id}`, total,
    label: `Consequence ${total}${row && row.id === "end" ? ", which ends the investigation" : ""}. Nine or more ends it.`,
  });
}

export function yesNoScale(die) {
  const row = YES_NO.find((b) => die >= b.min && die <= b.max);
  return scale({
    lo: 1, hi: 6, bands: YES_NO, bandClass: (b) => `yn-${b.id}`, total: die,
    label: die === null ? `The yes/no bands: ${YES_NO.map((b) => `${b.min}\u2013${b.max} ${b.name.toLowerCase()}`).join(", ")}.` : `Rolled ${die}: ${row ? row.name.toLowerCase() : ""}.`,
  });
}

/** Three marks for three guesses: a closed case's record at a glance. */
export function resultPips(correct) {
  const inner = [0, 1, 2].map((i) => `<circle cx="${5 + i * 11}" cy="5" r="3.6" class="${i < correct ? "on" : "off"}"/>`).join("");
  return svg("0 0 32 10", inner, { cls: "result-pips", label: `${correct} of 3 correct`, w: 32, h: 10 });
}

/**
 * The book's flowchart (p.26): four stages on a line. Done ones are filled, the
 * one you are in is ringed and named, the ones ahead are open, and a stage this
 * scene does not include — infiltration when the roll was quiet, escape when
 * nothing is after you — is dashed rather than missing.
 */
export function stagePath(scene) {
  const order = scene.order || [];
  const path = el("ol", { class: "stages stage-path", "aria-label": "Stages of this investigation" });
  const nowId = order[scene.index];
  for (const st of STAGES) {
    const i = order.indexOf(st.id);
    const state = i < 0 ? "skipped" : i < scene.index ? "done" : st.id === nowId ? "now" : "ahead";
    const words = { skipped: "not part of this scene", done: "done", now: "where you are", ahead: "ahead" }[state];
    add(path, el("li", { class: `stage-step ${state}`, "aria-current": state === "now" ? "step" : null },
      el("span", { class: "node", "aria-hidden": "true" }, glyph(STAGE_GLYPHS[st.id] || "drop", 12)),
      el("span", { class: state === "now" ? "stage-name" : "stage-name vh", text: st.name }),
      el("span", { class: "vh", text: `, ${words}` })));
  }
  return path;
}

// --- Case file ----------------------------------------------------------------
/** Dress a problem card as the case file it is: a tab, a clip, a stamped number. */
export function caseFile(card, number) {
  card.classList.add("case-file");
  add(card, svg("0 0 24 48", `<path ${STROKE} d="M8 6v28a6 6 0 0 0 12 0V10a4 4 0 0 0-8 0v22a2 2 0 0 0 4 0V12"/>`, { cls: "case-clip", w: 18, h: 36 }));
  if (number) add(card, el("span", { class: "case-stamp", "aria-hidden": "true", text: `№ ${number}` }));
  return card;
}

// --- Motion helpers -----------------------------------------------------------
/** Whether the player has asked for stillness, in the app or on the device. */
export const stillness = () =>
  document.documentElement.getAttribute("data-depth") === "off" ||
  (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Count a number from one value to another, unless stillness was asked for. */
export function tick(node, from, to, ms = 420) {
  if (!node || from === to || stillness() || typeof requestAnimationFrame !== "function") return;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    node.textContent = String(Math.round(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(step);
    else node.textContent = String(to);
  };
  node.textContent = String(from);
  node.classList.add("ticking");
  requestAnimationFrame(step);
  setTimeout(() => node.classList.remove("ticking"), ms + 60);
}

/**
 * A clue card drawn in front of you: a small deck, the set you already hold,
 * and the new card sliding off the deck and turning face up beside them.
 */
export function drawFigure(set, card, deckCount) {
  const fig = el("div", { class: "draw-figure", role: "img", "aria-label": `Drew the ${card.rank} of ${{ S: "spades", H: "hearts", D: "diamonds", C: "clubs" }[card.suit] || ""}.` });
  add(fig, deckStack(deckCount, "Clue deck"));
  const held = el("div", { class: "hand fan", "aria-hidden": "true" });
  for (const c of (set.cards || []).filter((x) => x.id !== card.id)) add(held, cardFace(c));
  const drawn = cardFace(card);
  drawn.classList.add("drawn");
  drawn.setAttribute("aria-hidden", "true");
  add(held, drawn);
  add(fig, held);
  return fig;
}


// --- The second pass: dialogs, the solve's picker, the sheet's small marks -----

/** The investigation roll on its strip: quiet, something in the way, noticed. */
export function investigationScale(total) {
  const row = INVESTIGATION_ROLL.find((b) => total >= b.min && total <= b.max);
  const band = (b) => (b.threatLevel === 0 ? "i-quiet" : b.threatLevel === 1 ? "i-way" : "i-noticed");
  return scale({
    lo: 1, hi: 9, bands: INVESTIGATION_ROLL, bandClass: band, total,
    label: `Investigation roll ${total}: ${row ? row.text : ""}`,
  });
}

/** A pair (or a single) of dice as they came up, small and still. */
export function diceArt(dice, doubles = false) {
  const pair = el("span", { class: "dice-art", role: "img", "aria-label": dice.join(" and ") });
  for (const d of dice) add(pair, dieFace(d, `mini still${doubles ? " doubles" : ""}`));
  return pair;
}

/** The joker's face: the card that turns a lead false. */
export function jokerCard() {
  const card = el("span", { class: "pcard joker", role: "img", "aria-label": "Joker" });
  add(card, svg("0 0 24 24", `<path ${STROKE} d="M5 16 7 7l3.5 5L12 5l1.5 7L17 7l2 9z"/><path ${STROKE} d="M5 16h14v2.5H5z"/><circle cx="7" cy="6.2" r="1.3" fill="currentColor"/><circle cx="12" cy="4.2" r="1.3" fill="currentColor"/><circle cx="17" cy="6.2" r="1.3" fill="currentColor"/>`, { cls: "joker-mark", w: 22, h: 22 }));
  return card;
}

/** Oracle words laid out as tiles, one word to a tile. */
export function wordTiles(words) {
  const row = el("div", { class: "word-tiles", role: "list" });
  for (const w of words) add(row, el("span", { class: "word-tile", role: "listitem", text: w }));
  return row;
}

/** An attribute out of its three slots. */
export function attrPips(value, max = 3) {
  const pips = el("span", { class: "attr-pips", "aria-hidden": "true" });
  for (let i = 0; i < max; i++) add(pips, el("i", { class: i < value ? "on" : "off" }));
  return pips;
}

/** What a benefit costs, as pips, lit as far as the experience you hold reaches. */
export function costPips(cost, have) {
  const inner = Array.from({ length: cost }, (_, i) =>
    `<circle cx="${5 + i * 10}" cy="5" r="3.4" class="${i < have ? "on" : "off"}"/>`).join("");
  return svg(`0 0 ${cost * 10} 10`, inner, { cls: "cost-pips", label: `Costs ${cost}; you hold ${have}`, w: cost * 10, h: 10 });
}

/** The fatigue track after a rest: what is left, and the boxes the die emptied. */
export function clearingTrack(fatigue, cleared) {
  const track = el("div", { class: "track still", role: "img", "aria-label": `Fatigue ${fatigue} of ${FATIGUE_BOXES}; ${cleared} cleared` });
  for (let i = 0; i < FATIGUE_BOXES; i++) {
    const cls = i < fatigue ? "on" : i < fatigue + cleared ? "clearing" : "";
    const box = el("span", { class: `box ${cls}`.trim(), "aria-hidden": "true" });
    if (cls === "clearing") box.style.setProperty("--turn", `${(fatigue + cleared - 1 - i) * 120}ms`);
    add(track, box);
  }
  return track;
}

/**
 * A d66 index drawn as the two dice that land on it. The numeral stays in the
 * text, visually hidden, so the page's own find and a screen reader both read
 * "41" where a player sees a four and a one.
 */
export function d66Code(code) {
  const s = String(code);
  const wrap = el("span", { class: "code d66", title: s });
  for (const d of s) add(wrap, el("i", { class: "d66-die", "data-face": d, "aria-hidden": "true" }));
  add(wrap, el("span", { class: "vh", text: s }));
  return wrap;
}

// --- The third pass: one drawing per piece of state, wherever it is shown -------

/** A die drawn flat in CSS pips — small enough for a row, and no cube to shear. */
export const flatDie = (n, cls = "") => el("i", { class: `d66-die ${cls}`.trim(), "data-face": String(n), "aria-hidden": "true" });

/** What each stage looks like on the flowchart. */
export const STAGE_GLYPHS = { infiltration: "key", discovery: "lens", acquisition: "take", escape: "exit" };

/** A label with its mark in front: for buttons and options. */
export const withGlyph = (name, text, size = 16) =>
  el("span", { class: "with-glyph" }, glyph(name, size), el("span", { text }));

/** A false lead: the rank it was, torn across. */
export function tornCard(rank) {
  return el("span", { class: "pcard torn", role: "img", "aria-label": `The ${rank}s, a false lead` },
    el("span", { class: "rank", text: rank }), el("span", { class: "pip torn-rank", text: rank }));
}

/** The fatigue track in small, for a row that is not the sheet. */
export function fatigueMini(fatigue) {
  // Not .box: that is the sheet's control, and this one is only a picture of it.
  const track = el("span", { class: "fatigue-mini", role: "img", "aria-label": `Fatigue ${fatigue} of ${FATIGUE_BOXES}` });
  for (let i = 0; i < FATIGUE_BOXES; i++) add(track, el("i", { class: i < fatigue ? "on" : "" }));
  return track;
}

/** Experience as tokens: one per point, the tail counted once it runs long. */
export function xpTokens(xp, max = 12) {
  const shown = Math.min(xp, max);
  const inner = Array.from({ length: shown }, (_, i) => `<circle cx="${5 + i * 9}" cy="5" r="3.3"/>`).join("");
  const wrap = el("span", { class: "xp-tokens", role: "img", "aria-label": `${xp} experience` });
  if (shown) add(wrap, svg(`0 0 ${shown * 9 + 1} 10`, inner, { w: shown * 9 + 1, h: 10 }));
  if (xp > max) add(wrap, el("span", { class: "small", text: `+${xp - max}` }));
  return wrap;
}

/**
 * The truth deck a difficulty builds: the twelve face cards, with the ones it
 * reveals turned up and the red herrings it adds drawn in after them.
 */
export function truthPreview(diff) {
  const total = DECK.truthRanks.length * DECK.suits.length;
  const wrap = el("div", { class: "truth-preview", role: "img",
    "aria-label": `${total} face cards${diff.revealTruths ? `, ${diff.revealTruths} revealed at the start` : ""}${diff.redHerrings ? `, ${diff.redHerrings} red herrings added` : ""}` });
  for (let i = 0; i < total; i++) {
    const up = i < diff.revealTruths;
    add(wrap, up ? el("span", { class: "pcard mini ruled", "aria-hidden": "true" }) : cardBack("mini"));
  }
  for (let i = 0; i < diff.redHerrings; i++) add(wrap, cardBack("mini herring"));
  return wrap;
}

/** A blank on the form: nothing rolled here yet. */
export const blank = (what = "not rolled yet") =>
  el("span", { class: "blank" }, el("span", { class: "vh", text: what }));

/** A rolled table entry with the two dice it came from. */
export function rolledValue(value, code) {
  return el("span", { class: "rolled" },
    code ? d66Code(code) : null,
    el("span", { class: "rolled-value", text: value }));
}

/** The face distribution: six bars, each under the face it counts. */
export function distribution(counts) {
  const n = counts.reduce((a, b) => a + b, 0);
  const top = Math.max(1, ...counts);
  const wrap = el("div", { class: "dist", role: "img",
    "aria-label": counts.map((v, i) => `${i + 1}: ${v}`).join(", ") });
  counts.forEach((v, i) => {
    add(wrap, el("div", { class: "dist-col" },
      el("span", { class: "dist-n", text: `${n ? Math.round((v / n) * 100) : 0}%` }),
      el("span", { class: "dist-bar", style: `--h:${Math.round((v / top) * 100)}%` }),
      flatDie(i + 1, "big")));
  });
  return wrap;
}

/** A stamp on a turned card: named, or missed. */
export function stamp(hit) {
  const inner = hit
    ? `<path ${STROKE} d="M5 12.5 10 17.5 19 7"/>`
    : `<path ${STROKE} d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>`;
  return svg("0 0 24 24", inner, { cls: `stamp ${hit ? "hit" : "miss"}`, label: hit ? "Named" : "Missed", w: 22, h: 22 });
}
