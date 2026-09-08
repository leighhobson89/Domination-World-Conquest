// Whose territory is this? -- answered on the map itself, with the flag of whoever holds it NOW.
//
// An experiment Leigh asked for, and the question it answers is the one the political map can
// only half answer: a colour tells you that two territories are held by the same country and
// never which country that is, so reading the map means hovering province by province. A flag
// says it outright, and it says it about the CURRENT owner -- Spain flies the Spanish flag
// until Italy takes it, and then it flies the Italian one.
//
// FOUR THINGS FOLLOW FROM WHERE IT IS DRAWN.
//
// **It is an overlay on EVERY view, not a view of its own** (Leigh's call). It is a label
// rather than a way of colouring the world, so it composes with the continent bands, the
// political map, the force ramp and the relief instead of replacing one of them. That is why it
// has its own button and does not sit on the map-view cycle.
//
// **IT DEFERS TO THE MILITARY VIEW'S FIGURES.** That view draws a garrison on the player's own
// land and on every enemy territory touching it, in the middle of the territory -- which is
// exactly where a flag wants to go. So while the military view is up, a flag is drawn only
// where a figure is NOT: the war zone is measured and the rest of the world is named.
// `militaryFrontierIds()` is asked live rather than the two overlays remembering what the other
// did, so they cannot disagree about a frame whichever redraws first.
//
// **IT IS SIZED IN SCREEN PIXELS AND REDRAWN ON ZOOM**, the rule `attackArrows.js` set and the
// force figures follow: a chip drawn in map user units is magnified with the land, so one size
// cannot be right at zoom 1 and at zoom 6. The zoom is also the decluttering -- a flag appears
// wherever the territory is big enough ON SCREEN to hold one, so the world map carries the
// large countries and zooming in fills in the rest.
//
// **THE CHIP IS A FIXED 3:2 PLATE AND THE FLAG IS FITTED INSIDE IT.** The artwork is not one
// aspect ratio -- Switzerland is square, Nepal is a tall pennant, the United States is 1.9:1 --
// so drawing each at its own shape gives a ragged map, and stretching them all to one shape
// distorts the ones that differ most. `preserveAspectRatio` set to `meet` fits the flag inside
// the plate without distortion and the plate shows through where it does not fill: a uniform
// chip, an undistorted flag, and a dark plate that also stops a white flag disappearing into
// pale terrain.

import { Events, on } from "../../state/events.js";
import { attachOverlayLayers, overlayGroup, removeOverlayGroup } from "./overlayLayers.js";
import { isMilitaryViewActive, militaryFrontierIds } from "./militaryView.js";
import { onZoomChanged, userUnitsPerPixel } from "./camera.js";
import { pathCountry } from "../../state/pathState.js";
import { ids } from "../core/registry.js";
import { mapInk } from "./themeColours.js";
import { THEME_CHANGED } from "../theme/theme.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/** The chip's height on screen, whatever the zoom. */
const FLAG_HEIGHT_PX = 11;

/** Its width, from the 3:2 the plate is fixed at. */
const FLAG_ASPECT = 1.5;

/** The plate's outline, in screen pixels. Enough to separate a pale flag from pale land. */
const FLAG_BORDER_PX = 0.9;

/**
 * How much bigger than the chip a territory has to be before it gets one.
 *
 * A flag drawn edge to edge inside a province reads as a fill rather than as a label, and at a
 * tri-point three of them touch. A fifth again in each direction is the margin that keeps a
 * chip looking like something placed ON the territory.
 */
const FIT_MARGIN = 1.2;

/**
 * How long a burst of world changes settles before the flags are redrawn.
 *
 * The same reasoning as the military view's: an AI turn writes hundreds of territory changes in
 * a few seconds and only a conquest can change a flag, so coalescing collapses the burst into
 * one redraw and is still faster than a player can look up from the map.
 */
const REFRESH_DELAY_MS = 160;

let mapDocument = null;
let active = false;
let mapPaths = [];
let stopZoom = null;
let unsubscribes = [];
let refreshQueued = false;

/** Point the overlay at the map's contentDocument. Called from `svgMapLoaded()`. */
export function attachFlagOverlay(svgDocument) {
    mapDocument = svgDocument;
    attachOverlayLayers(svgDocument);
}

export function isFlagOverlayActive() {
    return active;
}

/**
 * The flag image for a country, as an ABSOLUTE url.
 *
 * **A RELATIVE PATH CANNOT BE USED HERE, and it fails only in the build.** The map is an
 * `<object>` with its own document, so a relative href inside it resolves against the SVG's
 * own url -- and that url is not stable: the dev server hands the file over at
 * `/resources/svgMaster.svg`, while a production build hashes it into
 * `/assets/svgMaster-<hash>.svg`. So `flags/Spain.png` means `/resources/flags/Spain.png` under
 * `npm run dev` and `/assets/flags/Spain.png` in the build, where nothing is. It is worse than
 * a 404: the preview server answers every unknown path with `index.html` and a 200, so the
 * image simply never appears and no request looks like it failed.
 *
 * Resolving against the HOST document instead gives the same path the ~100 hand-written
 * `"resources/flags/" + country + ".png"` strings elsewhere in the game use, which is the one
 * layout `vite.config.mjs` guarantees by copying `resources/` verbatim. Encoded because a great
 * many countries have a space in their name.
 */
function flagHref(country) {
    const base = typeof window !== "undefined" ? window.location.href : "";
    return new URL(`resources/flags/${encodeURIComponent(country)}.png`, base).href;
}

/** The overlay's group inside the shared layer. */
function flagLayer() {
    return overlayGroup("flags", ids.flagLayer);
}

/**
 * Draw every flag that fits.
 *
 * Nothing is reconciled between redraws: a redraw happens on a zoom notch, a conquest or a
 * theme change, and building a few hundred small elements is cheaper than diffing them. The
 * images themselves are fetched once and served from the browser's cache thereafter, so
 * rebuilding the elements does not re-fetch 200 flags.
 */
export function renderFlags(paths = mapPaths) {
    const layer = flagLayer();
    if (!layer) {
        return;
    }
    layer.textContent = "";
    if (!active) {
        return;
    }
    mapPaths = paths;

    const scale = userUnitsPerPixel();
    const height = FLAG_HEIGHT_PX * scale;
    const width = height * FLAG_ASPECT;
    const ink = mapInk();
    //Empty unless the military view is up, in which case these territories carry a figure.
    const measured = isMilitaryViewActive() ? militaryFrontierIds() : new Set();

    for (const path of paths) {
        const uniqueId = path.getAttribute("uniqueid");
        if (uniqueId === null || measured.has(uniqueId)) {
            continue;
        }
        const country = pathCountry(path);
        if (!country) {
            continue;
        }

        let bounds;
        try {
            bounds = path.getBBox();
        } catch {
            //Not laid out yet. The next redraw will find it.
            continue;
        }
        if (bounds.width < width * FIT_MARGIN || bounds.height < height * FIT_MARGIN) {
            continue;
        }

        const x = bounds.x + bounds.width / 2 - width / 2;
        const y = bounds.y + bounds.height / 2 - height / 2;

        const plate = mapDocument.createElementNS(SVG_NS, "rect");
        plate.setAttribute("x", String(x));
        plate.setAttribute("y", String(y));
        plate.setAttribute("width", String(width));
        plate.setAttribute("height", String(height));
        plate.setAttribute("fill", "rgba(0, 0, 0, 0.55)");
        plate.setAttribute("stroke", ink);
        plate.setAttribute("stroke-width", String(FLAG_BORDER_PX * scale));
        layer.appendChild(plate);

        const image = mapDocument.createElementNS(SVG_NS, "image");
        image.setAttribute("x", String(x));
        image.setAttribute("y", String(y));
        image.setAttribute("width", String(width));
        image.setAttribute("height", String(height));
        //FITTED, NOT STRETCHED. The flags are not one aspect ratio; `meet` centres each inside
        //the plate at its own shape and lets the plate show where it does not reach.
        image.setAttribute("preserveAspectRatio", "xMidYMid meet");
        const href = flagHref(country);
        image.setAttribute("href", href);
        //`xlink:href` as well: the map document is served as image/svg+xml and older rendering
        //paths in that context still read the namespaced attribute.
        image.setAttributeNS(XLINK_NS, "xlink:href", href);
        image.setAttribute("data-flag", country);
        layer.appendChild(image);
    }
}

/**
 * Turn the overlay on or off.
 *
 * The subscriptions live exactly as long as the overlay does, and the world one is COALESCED
 * for the reason the military view's is: an AI turn is hundreds of territory events in a few
 * seconds and every one of them would otherwise rebuild several hundred elements.
 *
 * @param {boolean} enabled
 * @param {Element[]} paths  the map's path list
 */
export function setFlagOverlayActive(enabled, paths = mapPaths) {
    mapPaths = paths;
    if (enabled === active) {
        return;
    }
    active = enabled;

    if (!active) {
        stopZoom?.();
        stopZoom = null;
        unsubscribes.forEach(stop => stop());
        unsubscribes = [];
        removeOverlayGroup(ids.flagLayer);
        return;
    }

    stopZoom = onZoomChanged(() => renderFlags());
    const queue = () => {
        if (refreshQueued) {
            return;
        }
        refreshQueued = true;
        setTimeout(() => {
            refreshQueued = false;
            renderFlags();
        }, REFRESH_DELAY_MS);
    };
    unsubscribes = [
        //A conquest is the only thing that changes a flag, and it arrives as a territory change.
        on(Events.TERRITORY_CHANGED, queue),
        on(Events.TURN_CHANGED, queue)
    ];

    renderFlags(paths);
}

/** Redraw because something outside changed what should be drawn -- a map view, say. */
export function refreshFlagOverlay(paths = mapPaths) {
    if (active) {
        renderFlags(paths);
    }
}

if (typeof window !== "undefined") {
    //The plate's outline is a theme colour, so it is re-inked with everything else.
    window.addEventListener(THEME_CHANGED, () => refreshFlagOverlay());
}
