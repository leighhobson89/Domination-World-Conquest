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

/** A music note: the audio panel, which is where the sound lives. */
export function musicNoteIcon() {
    return icon("chrome-icon-music", [
        svgEl("path", { attrs: { d: "M9 18V5.6l10-2v12.4" } }),
        svgEl("circle", { attrs: { cx: "6.5", cy: "18", r: "2.5" } }),
        svgEl("circle", { attrs: { cx: "16.5", cy: "16", r: "2.5" } }),
    ]);
}

/** A right-pointing triangle. Play. */
export function playIcon() {
    return icon("chrome-icon-play", [
        svgEl("path", { attrs: { d: "M8 5.5 19 12 8 18.5z", fill: "currentColor" } }),
    ]);
}

/** Two bars. Pause. */
export function pauseIcon() {
    return icon("chrome-icon-pause", [
        svgEl("rect", { attrs: { x: "7.5", y: "5.5", width: "3.4", height: "13", rx: "1", fill: "currentColor", stroke: "none" } }),
        svgEl("rect", { attrs: { x: "13.1", y: "5.5", width: "3.4", height: "13", rx: "1", fill: "currentColor", stroke: "none" } }),
    ]);
}

/** Triangle into a bar: skip to the next track in the playthrough. */
export function skipIcon() {
    return icon("chrome-icon-skip", [
        svgEl("path", { attrs: { d: "M5 5.5 15 12 5 18.5z", fill: "currentColor" } }),
        svgEl("rect", { attrs: { x: "16.6", y: "5.5", width: "2.9", height: "13", rx: "1", fill: "currentColor", stroke: "none" } }),
    ]);
}

/** A speaker with two arcs coming off it. Sound on. */
export function speakerIcon() {
    return icon("chrome-icon-speaker", [
        svgEl("path", { attrs: { d: "M4 9.5h3.4L12 5.5v13L7.4 14.5H4z", fill: "currentColor" } }),
        svgEl("path", { attrs: { d: "M15.4 9.2a4 4 0 0 1 0 5.6" } }),
        svgEl("path", { attrs: { d: "M18 6.8a7.6 7.6 0 0 1 0 10.4" } }),
    ]);
}

/** The same speaker with a cross where the arcs were. Muted. */
export function speakerMutedIcon() {
    return icon("chrome-icon-speaker-muted", [
        svgEl("path", { attrs: { d: "M4 9.5h3.4L12 5.5v13L7.4 14.5H4z", fill: "currentColor" } }),
        svgEl("line", { attrs: { x1: "15.4", y1: "9.4", x2: "20.4", y2: "14.6" } }),
        svgEl("line", { attrs: { x1: "20.4", y1: "9.4", x2: "15.4", y2: "14.6" } }),
    ]);
}

/**
 * Two crossed swords: WAR.
 *
 * This replaces `sword.png`, which was one upright blade and could not be told
 * apart from `shield.png` at 18px in a table row -- both read as "a grey shape".
 * Crossed swords are unmistakable at any size, which is the whole job of an icon
 * in a thirteen-column table where the only other explanation is a hover tooltip.
 *
 * Each sword is a blade (a long stroke), a cross-guard across it and a pommel at
 * the hilt end, mirrored about the vertical. Drawn with `currentColor` so it takes
 * the theme, which is what no PNG in this game ever did.
 */
export function crossedSwordsIcon() {
    return icon("chrome-icon-war", [
        // Blades, hilt at the bottom, tip at the opposite top corner.
        svgEl("path", { attrs: { d: "M3.6 3.2h3.1l10 10-3.1 3.1-10-10z", fill: "currentColor", stroke: "none" } }),
        svgEl("path", { attrs: { d: "M20.4 3.2h-3.1l-10 10 3.1 3.1 10-10z", fill: "currentColor", stroke: "none" } }),
        // Cross-guards and grips.
        svgEl("path", { attrs: { d: "M14.2 17.4 17 20.2M16 15.6l2.8 2.8" } }),
        svgEl("path", { attrs: { d: "M9.8 17.4 7 20.2M8 15.6l-2.8 2.8" } }),
        svgEl("circle", { attrs: { cx: "18.9", cy: "21.1", r: "1.5" } }),
        svgEl("circle", { attrs: { cx: "5.1", cy: "21.1", r: "1.5" } }),
    ]);
}

/**
 * A shield with a castle keep on it: SIEGE.
 *
 * A siege is a fortification being held, so the icon says both halves: the shield
 * is the defence, the crenellated keep inside it is the thing being defended. It
 * replaces `siege.png` on the map and in the table, and `shield.png`, which at
 * row height was indistinguishable from the sword beside it.
 *
 * The keep is drawn as an outline INSIDE a filled shield so it stays legible when
 * the whole thing is one flat theme colour -- a filled keep on a filled shield is
 * a blob. `evenodd` is what punches it out.
 */
export function castleShieldIcon() {
    return icon("chrome-icon-siege", [
        svgEl("path", {
            attrs: {
                d: SIEGE_SHIELD_PATH,
                "fill-rule": "evenodd",
                fill: "currentColor",
                stroke: "none",
            },
        }),
    ]);
}

/**
 * A bare shield: the DEFENDER.
 *
 * Deliberately the siege icon with the keep taken out, so the two read as a pair
 * -- "defending" and "defending a fortification" -- rather than as two unrelated
 * pictures. It replaces `shield.png`, which at row height was a grey blob
 * indistinguishable from `sword.png` next to it.
 */
export function shieldIcon() {
    return icon("chrome-icon-shield", [
        svgEl("path", {
            attrs: {
                d: "M12 2.2 20.4 5v6.5c0 4.6-3.4 8.6-8.4 10.3C7 20.1 3.6 16.1 3.6 11.5V5z",
            },
        }),
    ]);
}

/**
 * The siege shield as a bare path, on a 24x24 grid.
 *
 * Exported because the map marker needs the same shape drawn into a DIFFERENT
 * document -- the map is an `<object>`, so the SVG inside it is its own document
 * and neither the stylesheet nor `currentColor` reaches across. `siegeOverlay.js`
 * builds the element there and paints it with a colour it resolves from the theme
 * itself. One shape, one definition, two places that draw it.
 */
export const SIEGE_SHIELD_PATH =
    // The shield: flat top, straight sides, drawn to a point.
    "M12 2.2 20.4 5v6.5c0 4.6-3.4 8.6-8.4 10.3" +
    "C7 20.1 3.6 16.1 3.6 11.5V5z" +
    // The keep, wound the other way so evenodd cuts it out: three merlons across
    // the top, then the body down to the base.
    "M8.2 8.1v2.1h1.3V8.1h1.9v2.1h1.3V8.1h1.9v2.1h1.3V8.1" +
    "v7.9H8.2z" +
    // The gate arch, cut out of the keep in turn.
    "M11 16v-2.7a1 1 0 0 1 2 0V16z";

/**
 * A panel with a circular arrow over it: "open this again at the start of every
 * turn".
 *
 * The control used to be a bare tick, which says "yes" and nothing else -- a tick
 * next to three tab buttons reads as a fourth tab, or as a confirm. What the
 * option actually means is recurrence, so the icon is the panel it opens with the
 * repeat arrow around it, and the tooltip that explains it is unchanged.
 */
export function repeatPanelIcon() {
    return icon("chrome-icon-repeat-panel", [
        // The panel: a window with a title bar, sitting low so the arrow above it
        // reads as sweeping OVER it rather than as part of its frame.
        svgEl("rect", { attrs: { x: "7.2", y: "10.4", width: "13.2", height: "9.4", rx: "1.4" } }),
        svgEl("line", { attrs: { x1: "7.2", y1: "13.4", x2: "20.4", y2: "13.4" } }),
        // The recurrence arrow, sweeping round the top-left corner.
        svgEl("path", { attrs: { d: "M15 4.4a6.6 6.6 0 0 0-11 4.6" } }),
        svgEl("path", { attrs: { d: "M12.4 2.2 15.3 4.4 13 6.9" } }),
    ]);
}

/* ---------------------------------------------------------------------------
   STEPPER AND ACTION ICONS (Phase 7.11)

   The plus, minus and step-multiplier controls used to be six PNGs --
   `plusButton.png` / `plusButtonGrey.png` and the same pair for minus and for
   the multiplier cycler -- and the greyed member of each pair was the ONLY
   record anywhere that a control was disabled. That is why the codebase was
   full of `if (button.src.includes("Grey.png"))`: the image WAS the state.

   Drawn instead, the state moves onto the element (`aria-disabled`, and the
   `is-disabled` class the stylesheet reads) and the colour comes from a token,
   so the same three controls take every theme. See `src/ui/controls/steppers.js`
   for the buttons these sit inside.
   ------------------------------------------------------------------------ */

/** A plus. Add one step of whatever the multiplier says. */
export function plusIcon() {
    return icon("chrome-icon-plus", [
        svgEl("line", { attrs: { x1: "12", y1: "5", x2: "12", y2: "19" } }),
        svgEl("line", { attrs: { x1: "5", y1: "12", x2: "19", y2: "12" } }),
    ]);
}

/** A minus. The other half of the pair, and deliberately the same weight. */
export function minusIcon() {
    return icon("chrome-icon-minus", [
        svgEl("line", { attrs: { x1: "5", y1: "12", x2: "19", y2: "12" } }),
    ]);
}

/**
 * A ring of two arrows: the step multiplier, which CYCLES rather than toggling.
 *
 * `multipleIncrementerButton.png` was a pair of chevrons and read as "sort", so
 * players clicked it expecting the column to reorder. Two arrows chasing each
 * other round a circle is the standard sign for "this walks a list and wraps",
 * which is exactly what x1 -> x10 -> x100 -> x1k -> All -> x1 does.
 */
export function cycleIcon() {
    return icon("chrome-icon-cycle", [
        svgEl("path", { attrs: { d: "M20.2 11.4a8.2 8.2 0 0 0-14.1-4.3L3.8 9.4" } }),
        svgEl("path", { attrs: { d: "M3.8 4.9v4.5h4.5" } }),
        svgEl("path", { attrs: { d: "M3.8 12.6a8.2 8.2 0 0 0 14.1 4.3l2.3-2.3" } }),
        svgEl("path", { attrs: { d: "M20.2 19.1v-4.5h-4.5" } }),
    ]);
}

/**
 * A tower rising out of a base plate, with a chevron over it: UPGRADE.
 *
 * The four things this button opens are farms, forests, oil wells and forts --
 * "build something on this territory". A bare up-arrow would say "increase",
 * which is what the plus button already says two columns away.
 */
export function upgradeIcon() {
    return icon("chrome-icon-upgrade", [
        svgEl("path", { attrs: { d: "M7 4.6 12 2l5 2.6" } }),
        svgEl("path", { attrs: { d: "M7 9.4 12 6.8l5 2.6" } }),
        svgEl("path", { attrs: { d: "M4.5 20.5h15" } }),
        svgEl("path", { attrs: { d: "M8.4 20.5v-6.9h7.2v6.9" } }),
    ]);
}

/**
 * A chevron in a bracket over a bar: BUY MILITARY.
 *
 * Not a shopping cart. The window it opens buys infantry, assault, air and
 * naval units, and a supermarket trolley next to a row of tanks reads as a
 * joke; a unit being dropped onto a muster line does not.
 */
export function buyIcon() {
    return icon("chrome-icon-buy", [
        svgEl("path", { attrs: { d: "M12 3v9.6" } }),
        svgEl("path", { attrs: { d: "M8.2 9.2 12 13l3.8-3.8" } }),
        svgEl("path", { attrs: { d: "M4.5 15.4v3.6a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.6" } }),
    ]);
}

/**
 * A sheet of paper with ruled lines and a folded corner: the ACTIVITY LOG.
 *
 * Phase 7.4. The button that opens the military feed sits under the info-panel
 * globe, so it has to read as a different KIND of thing at 22px, not as a second
 * globe. A document with a turned corner is the one shape everybody already reads
 * as "a log file", and the ruled lines are what stop it reading as a blank card.
 */
export function activityLogIcon() {
    return icon("chrome-icon-activity", [
        // The sheet, with the top-right corner cut away.
        svgEl("path", { attrs: { d: "M14.2 2.8H6.6a1.8 1.8 0 0 0-1.8 1.8v14.8a1.8 1.8 0 0 0 1.8 1.8h10.8a1.8 1.8 0 0 0 1.8-1.8V7.6z" } }),
        // The fold.
        svgEl("path", { attrs: { d: "M14.2 2.8v4.8h5" } }),
        // Three ruled lines, the last one short, which is what says "entries" and
        // not "a table".
        svgEl("line", { attrs: { x1: "8.2", y1: "11.4", x2: "15.8", y2: "11.4" } }),
        svgEl("line", { attrs: { x1: "8.2", y1: "14.6", x2: "15.8", y2: "14.6" } }),
        svgEl("line", { attrs: { x1: "8.2", y1: "17.8", x2: "12.6", y2: "17.8" } }),
    ]);
}

/** A chevron. The activity feed's per-turn sections open and close with one. */
export function chevronIcon() {
    return icon("chrome-icon-chevron", [
        svgEl("path", { attrs: { d: "M8.4 5.2 15.6 12l-7.2 6.8" } }),
    ]);
}
