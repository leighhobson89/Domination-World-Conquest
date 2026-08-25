// The inline SVG icons the map chrome is drawn with.
//
// Refactor plan Phase 7.4. Until now the three buttons floating over the map --
// the info-panel globe, the physical-map flip and the continent-boundary toggle --
// were PNGs (`globeNoStandButtonUI.png`, `mapMode1.png`, `strokeToggle2.png`).
// That made them the only chrome in the game a theme could not reach: a photo of
// a map is the same colour whichever palette is applied, which is exactly the
// reason `MenuButton.js` drew the hamburger out of three `<span>`s instead of
// shipping a fourth image.
//
// These are paths in the document, stroked with `currentColor`, so `style.css`
// gives them the same `var(--accent)` the hamburger's bars take and a theme
// change repaints them along with everything else. They are 24x24 and hairline
// on purpose: at 22px on screen anything more detailed reads as a smudge.
//
// This file knows nothing about the game. It builds elements and returns them.

import { svgEl } from "./core/dom.js";

/**
 * The frame every icon shares. `fill: none` / `stroke: currentColor` is the
 * outline default; the one filled icon (Africa) overrides both on its own path.
 */
function icon(className, children) {
    return svgEl(
        "svg",
        {
            class: ["chrome-icon", className],
            attrs: {
                viewBox: "0 0 24 24",
                width: "22",
                height: "22",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "1.7",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "aria-hidden": "true",
                focusable: "false",
            },
        },
        children
    );
}

/** A globe: the info panel, which is a world summary. */
export function globeIcon() {
    return icon("chrome-icon-globe", [
        svgEl("circle", { attrs: { cx: "12", cy: "12", r: "9" } }),
        svgEl("ellipse", { attrs: { cx: "12", cy: "12", rx: "4.2", ry: "9" } }),
        svgEl("line", { attrs: { x1: "3", y1: "12", x2: "21", y2: "12" } }),
        svgEl("path", { attrs: { d: "M5.2 6.9C8.8 9.2 15.2 9.2 18.8 6.9" } }),
        svgEl("path", { attrs: { d: "M5.2 17.1C8.8 14.8 15.2 14.8 18.8 17.1" } }),
    ]);
}

/** A folded paper map: the ordinary political view. */
export function mapSheetIcon() {
    return icon("chrome-icon-map", [
        svgEl("path", { attrs: { d: "M9 3.6 3 6.2v14.2l6-2.6 6 2.6 6-2.6V3.6l-6 2.6z" } }),
        svgEl("line", { attrs: { x1: "9", y1: "3.6", x2: "9", y2: "17.8" } }),
        svgEl("line", { attrs: { x1: "15", y1: "6.2", x2: "15", y2: "20.4" } }),
    ]);
}

/** A mountain range: the physical relief map. */
export function mountainIcon() {
    return icon("chrome-icon-mountain", [
        svgEl("path", { attrs: { d: "M2 19.5 8.8 6.5l4.4 8.4 2.5-3.6 6.3 8.2z" } }),
        svgEl("path", { attrs: { d: "M6.4 12.9 8.8 10.9l2.3 2" } }),
    ]);
}

/** Africa in silhouette: continent boundaries, without the relief underneath. */
export function continentIcon() {
    // Two attempts at this were a straight-edged silhouette and both read as a cut
    // gem, because "wide at the top, pointed at the bottom" describes a gem as
    // accurately as it describes Africa. What separates them is the detail:
    // the Horn on the east, the Gulf of Guinea bitten out of the west, and
    // Madagascar sitting off the south-east coast. Madagascar is the strongest of
    // the three and costs one extra path.
    return icon("chrome-icon-continent", [
        svgEl("path", {
            attrs: {
                d:
                    "M2 4.6C2.6 3.8 4 3.4 5.6 3.3L18.2 3.3l1.7 2.8" +
                    "c1.5 1 2.5 2 2.4 3.2l-4 1.2" +
                    "c-.5 2.9-1.6 5.7-3.3 8.2L13 22l-1.5-3.1" +
                    "c-1-2.1-1.5-3.9-1.9-5.2-2 -.4-3.9-1.1-5.4-2.3" +
                    "C2.3 9.9 1.5 7.3 2 4.6z",
                fill: "currentColor",
                stroke: "none",
            },
        }),
        svgEl("path", {
            // Madagascar.
            attrs: {
                d: "M19.4 13.9c.9.5 1.1 2.2.5 3.4-.9-.5-1.3-2.3-.5-3.4z",
                fill: "currentColor",
                stroke: "none",
            },
        }),
    ]);
}
