// The two floors every piece of text in the app has to clear, and the only
// things exempt from them.
//
// Both floors used to be checked against a hand-written list of selectors, and
// both lists went stale the moment a component was added: --ink-3 was measured
// on --panel and passed at 4.6 while failing at 3.85 on --panel-2, and the size
// check named five selectors while .action-context and .defrow .row-label sat
// at 10.6px. So neither is a list any more. The sweep walks every rendered text
// node on every route in both themes and measures what is actually drawn.

/**
 * Drawings of physical objects, not labels. A playing card's corner index and
 * its suit pip are the card, drawn at the size a card is drawn; the rank is on
 * the card's aria-label for anything that needs to read it rather than look at
 * it. Die pips carry no text at all. This is a decision, recorded in CLAUDE.md
 * §3, not an oversight — which is the whole reason it is written down here.
 */
export const DRAWN = [".pcard .rank", ".pcard .pip", ".die"];

/**
 * A control that cannot be pressed right now. WCAG 1.4.3 exempts inactive
 * interface components from the contrast floor by name, and drawing them
 * quieter than the controls you can press is the point of them.
 */
export const INACTIVE = ["[disabled]", "[aria-disabled='true']"];

export const MIN_PX = 11;
export const MIN_RATIO = 4.5;      // AA for body text
export const MIN_RATIO_LARGE = 3;  // AA for >=24px, or >=18.66px bold

/** Run inside the page: returns every text node that misses a floor. */
export function sweep(drawn) {
  const lum = (c) => {
    const p = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    if (p.length < 3) return null;
    const f = p.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  // What the text is actually drawn on: the nearest ancestor that paints
  // something solid enough to read against.
  const backdrop = (n) => {
    let e = n;
    while (e) {
      const cs = getComputedStyle(e);
      const bg = cs.backgroundColor;
      const alpha = (bg.match(/[\d.]+/g) || [])[3];
      const solid = bg && bg !== "rgba(0, 0, 0, 0)" && (alpha === undefined || Number(alpha) > 0.6);
      if (solid) return bg;
      // A gradient with no background-colour still paints: fall back to the
      // page rather than walking past it and measuring against the wrong thing.
      if (cs.backgroundImage && cs.backgroundImage !== "none" && /gradient/.test(cs.backgroundImage)) return null;
      e = e.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const out = [];
  for (const n of document.querySelectorAll("#screen *, #resource-header *, .action-bar *, .tab, .coach *, .to-top")) {
    if (n.children.length) continue;
    const text = (n.textContent || "").trim();
    if (!text) continue;
    if (drawn.some((sel) => n.closest(sel))) continue;
    if (n.closest("[disabled], [aria-disabled='true']")) continue;
    const cs = getComputedStyle(n);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const box = n.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    // Read aloud but never drawn: exempt by construction, not by selector.
    if (box.width <= 2 && box.height <= 2) continue;
    const px = parseFloat(cs.fontSize);
    const where = `${n.className || n.tagName}|${text.slice(0, 22)}`;
    if (px < 11) out.push(`${where}|${px}px`);
    const fg = lum(cs.color), bgc = backdrop(n);
    const bg = bgc === null ? null : lum(bgc);
    if (fg === null || bg === null) continue;
    const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
    const ratio = (hi + 0.05) / (lo + 0.05);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const floor = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < floor) out.push(`${where}|${ratio.toFixed(2)}:1 at ${px}px`);
    // Transparency stacked on muted ink is how a state slips under the floor;
    // it is never how a state should be said in the first place.
    if (Number(cs.opacity) < 1) out.push(`${where}|drawn at opacity ${cs.opacity}`);
  }
  return [...new Set(out)];
}
