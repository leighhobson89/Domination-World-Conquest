// The siege markers on the map, rendered from the siege lists.
//
// This is the surviving half of `normalizeSiegeState()` (Phase 4.5). That function
// ran once per turn and swept all 359 paths to do two jobs: reconcile the
// `underSiege` attribute against the siege lists, and reconcile the siege overlay
// images against the same lists. The first job no longer exists -- `underSiege` is
// derived from the lists, so it cannot disagree with them. The second is real work,
// because a marker element is not derived from anything; it has to be created and
// removed. So it moved here, and it is driven by `siegeChanged` rather than by a
// once-a-turn sweep.
//
// The id is `siegeImage_<territory name with spaces underscored>`. Six territory
// names carry real parentheses (audit 5.2 AI), which makes them invalid in a CSS
// selector, so this looks markers up with `getElementById` and never `querySelector`.
//
// The marker used to be an `<image>` pointing at `siege.png` (or `siegeai.png` for
// an AI siege) and was one of the last things in the game a theme could not reach:
// a bitmap of a cannon is the same colour whichever palette is applied. It is now
// the shield-and-keep path from `icons.js`, drawn into the map document.
//
// Drawing into the MAP document is the whole difficulty. `#svg-map` is an
// `<object>`, so the SVG inside it has its own document: `style.css` does not
// reach it, the custom properties on the host's root element do not cascade into
// it, and `currentColor` therefore has nothing to resolve against. The colour is
// read off the HOST root with `getComputedStyle` and written onto the marker as a
// literal fill, and every marker is repainted when the theme changes -- which is
// what `THEME_CHANGED` is subscribed to below.

import { SIEGE_SHIELD_PATH } from "./icons.js";
import { THEME_CHANGED } from "./theme/theme.js";
import { ids, SIEGE_OVERLAY_PREFIX } from "./core/registry.js";
import { isAiGameActive } from "../debug/aiGameMode.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The shield path is drawn on a 24x24 grid; the marker scales that to fit. */
const ICON_GRID = 24;

/** What an AI siege's marker is faded to, so the player's own stand out. */
const AI_OPACITY = 0.4;

/**
 * The smallest a marker may be drawn, in map user units.
 *
 * The size is a fraction of the territory's bounding box, which is the right rule
 * for Sweden and useless for an island. `Andaman and Nicobar Islands 3` produced a
 * shield 1.3 units across on a 1947-unit-wide map -- about one screen pixel, and at
 * the AI's 0.4 opacity indistinguishable from nothing at all. A besieged territory
 * you cannot see is a besieged territory you do not know about, so small territories
 * get a marker larger than themselves rather than no marker.
 */
const MIN_MARKER_SIZE = 9;

/**
 * Does the faded, shrunken AI treatment apply?
 *
 * It exists for exactly one reason: to make the PLAYER's sieges stand out from the
 * hundred-odd the AI has running. Spectator mode has no player, so every siege on
 * the map is an AI siege and the whole distinction collapses -- applying it there
 * fades the entire map's worth of markers to 40% at 60% size, which is what made
 * them read as absent while the console said sieges were being laid.
 */
function fadeAiSieges() {
    return !isAiGameActive();
}

function overlayId(territoryName) {
    return SIEGE_OVERLAY_PREFIX + territoryName.replace(/\s+/g, "_");
}

function existingOverlay(path, territoryName) {
    return path.ownerDocument?.getElementById(overlayId(territoryName)) ?? null;
}

/**
 * The colour a marker is painted, resolved from the theme in force.
 *
 * `--negative` rather than `--accent`: a siege on the map is a warning, and the
 * accent is already the colour of the chrome the player clicks. The fallback is
 * for the bootstrap window in which the token has not been written yet.
 */
function markerColour() {
    try {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue("--negative")
            .trim();
        return value || "#c0392b";
    } catch {
        return "#c0392b";
    }
}

/**
 * Build the marker in the MAP's document.
 *
 * A `<g>` holding one path, translated and scaled into place, rather than a
 * `<symbol>` or a `<use>`: the map document has no defs of ours to point at, and
 * a self-contained group can be dropped in and taken out again with no other
 * state. The stroke is the map's own dark ink so the shield reads against a
 * territory painted in a similar hue to the theme's negative colour.
 */
function buildMarker(document_, { id, x, y, size, aiSiege }) {
    const group = document_.createElementNS(SVG_NS, "g");
    group.setAttribute("id", id);
    const scale = size / ICON_GRID;
    group.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);

    // Phase 5.8. A marker is decoration and must never intercept a click. Without
    // this it sits over the middle of the territory it marks, and a hit test at the
    // centre of a besieged territory returns the marker rather than the path -- so
    // the player cannot click their own besieged territory, which is the only route
    // to VIEW SIEGE. Same class of bug as `#tooltip` having no `pointer-events`.
    group.setAttribute("style", "pointer-events: none");
    if (aiSiege && fadeAiSieges()) {
        group.setAttribute("opacity", String(AI_OPACITY));
    }
    // What kind of siege this is, as an attribute rather than as a file name. The
    // e2e suite used to assert `href` contained "siegeai"; there is no file to name
    // now, and "which variant" was always the question being asked.
    group.setAttribute("data-siege", aiSiege ? "ai" : "player");

    const shield = document_.createElementNS(SVG_NS, "path");
    shield.setAttribute("d", SIEGE_SHIELD_PATH);
    shield.setAttribute("fill-rule", "evenodd");
    shield.setAttribute("fill", markerColour());
    shield.setAttribute("stroke", "rgba(0, 0, 0, 0.55)");
    shield.setAttribute("stroke-width", "0.9");
    shield.setAttribute("stroke-linejoin", "round");
    group.appendChild(shield);

    return group;
}

/**
 * Put a siege marker on a territory, or take it off.
 *
 * @param {Element} path            the territory path
 * @param {string} territoryName    its stable name
 * @param {boolean} underSiege
 * @param {boolean} aiSiege         AI sieges get the smaller, faded marker
 */
export function renderSiegeOverlay(path, territoryName, underSiege, aiSiege) {
    if (!path || !territoryName) {
        return;
    }

    const existing = existingOverlay(path, territoryName);

    if (!underSiege) {
        existing?.remove();
        return;
    }
    if (existing) {
        return;
    }

    // getBBox() throws on a path that is not rendered yet, which is why the original
    // wrapped this. A missing marker is cosmetic; a throw here would escape into the
    // turn loop, which has no catch anywhere in it.
    try {
        const bounds = path.getBBox();
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        let size = Math.min(bounds.width * 0.7, bounds.height * 0.7);
        if (aiSiege && fadeAiSieges()) {
            size *= 0.6;
        }
        size = Math.max(size, MIN_MARKER_SIZE);

        const marker = buildMarker(path.ownerDocument, {
            id: overlayId(territoryName),
            x: centerX - size / 2,
            y: centerY - size / 2,
            size,
            aiSiege,
        });

        path.parentNode.appendChild(marker);
    } catch {
        // not laid out yet; the next siege change will try again
    }
}

/**
 * Repaint every marker in the map document.
 *
 * The map is a separate document, so a theme change cannot reach the markers
 * through the cascade the way it reaches everything else. This is the same write
 * `buildMarker()` makes, applied to what is already on screen.
 */
export function repaintSiegeOverlays() {
    const mapDocument = document.getElementById(ids.svgMap)?.contentDocument;
    if (!mapDocument) return;
    const colour = markerColour();
    for (const marker of mapDocument.querySelectorAll('[data-siege] > path')) {
        marker.setAttribute("fill", colour);
    }
}

if (typeof window !== "undefined") {
    window.addEventListener(THEME_CHANGED, repaintSiegeOverlays);
}
