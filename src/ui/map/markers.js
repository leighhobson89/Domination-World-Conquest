// The decoration drawn on top of a territory: the attack marker, and removal of the
// siege markers `src/ui/siegeOverlay.js` renders.
//
// Phase 6.7, and this is what closes audit 5.2 AE -- "the attack marker survives a
// cancel". The marker used to be an `<image>` that `setTerritoryForAttack()` appended
// and that six separate call sites removed by hand:
//
//     if (svgMap.querySelector("#attackImage")) svgMap.getElementById("attackImage").remove();
//
// while `territoryAboutToBeAttackedOrSieged` -- the fact the marker was DRAWING --
// was a plain `let` that a seventh site set to null without removing anything. Two
// representations of one fact, and the cancel path only ever updated one of them.
//
// There is one representation now. `attackTarget` is private to this module and the
// marker is drawn from it, so setting the target draws the marker and clearing the
// target removes it. There is no way to clear one without the other.
//
// A marker is decoration and must never intercept a click (audit 5.3 AW): the
// `<image>` sits over the middle of the territory it marks, so without
// `pointer-events: none` the hit test returns the marker and the player cannot select
// the territory underneath it.

import { ids, dynamicIds } from "../core/registry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const ATTACK_MARKER_HREF = "battle.png";

let markerDocument = null;

/** The path the player is about to attack or besiege, or null. */
let attackTarget = null;

/** Whether that target carries a battle marker. A siege target does not: it already
 *  has a siege overlay, and two images on one territory is a mess. */
let attackTargetHasMarker = false;

/** Point the marker layer at the map's contentDocument. Called from `svgMapLoaded()`. */
export function attachMarkerLayer(svgDocument) {
    markerDocument = svgDocument;
}

/**
 * Draw a centred image over a path, at 70 % of the smaller of its bounding-box
 * dimensions.
 *
 * @param {Element} pathElement
 * @param {string} href
 * @param {string} id
 */
function drawMarker(pathElement, href, id) {
    const bounds = pathElement.getBBox();

    const size = Math.min(bounds.width * 0.7, bounds.height * 0.7);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    const image = document.createElementNS(SVG_NS, "image");
    image.setAttributeNS(XLINK_NS, "href", href);
    image.setAttribute("x", (centerX - size / 2).toString());
    image.setAttribute("y", (centerY - size / 2).toString());
    image.setAttribute("width", size.toString());
    image.setAttribute("height", size.toString());
    image.setAttribute("z-index", "9999");
    image.setAttribute("id", id);
    //audit 5.3 AW. Decoration never intercepts a click.
    image.style.pointerEvents = "none";

    pathElement.parentNode.appendChild(image);
    return image;
}

function removeAttackMarker() {
    //audit 5.2 AI: getElementById, never a selector. Six territory names carry real
    //parentheses, and this id family has grown one before.
    markerDocument?.getElementById(ids.attackImage)?.remove();
}

/** The territory the player is about to attack or besiege, or null. */
export function attackTargetPath() {
    return attackTarget;
}

/**
 * Set -- or, with `null`, clear -- the territory the player is about to attack.
 *
 * This is the ONLY way the attack marker appears or disappears. Clearing the target
 * removes the marker as one operation, which is what makes audit 5.2 AE unreachable
 * rather than fixed.
 *
 * @param {Element|null} path
 * @param {{marker?: boolean}} options  `marker: false` for a siege target, which
 *                                      already carries a siege overlay
 */
export function setAttackTarget(path, { marker = true } = {}) {
    removeAttackMarker();
    attackTarget = path ?? null;
    attackTargetHasMarker = Boolean(attackTarget && marker);

    if (attackTargetHasMarker) {
        drawMarker(attackTarget, ATTACK_MARKER_HREF, ids.attackImage);
    }
}

/** Clear the target and its marker. */
export function clearAttackTarget() {
    setAttackTarget(null);
}

/**
 * Redraw the marker so it sits above the path again.
 *
 * Anything that re-appends a territory's path -- escaping out of the menu does --
 * puts it over the marker. This is a z-order fix, not a state change.
 */
export function raiseAttackMarker() {
    if (!attackTargetHasMarker) {
        return;
    }
    removeAttackMarker();
    drawMarker(attackTarget, ATTACK_MARKER_HREF, ids.attackImage);
}

/** Is the attack marker currently on the map? Used by the specs and by nothing else. */
export function attackMarkerVisible() {
    return Boolean(markerDocument?.getElementById(ids.attackImage));
}

/**
 * Take the siege marker off a territory by name.
 *
 * `src/ui/siegeOverlay.js` renders siege markers from the `siegeChanged` event, so
 * this exists only for the two call sites that have to remove one before the store
 * catches up -- entering a battle from a siege, and the AI ending one.
 */
export function removeSiegeMarker(territoryName) {
    if (!territoryName) {
        return;
    }
    //audit 5.2 AI again: `#siegeImage_Andros_Island_(Bahamas)` is not a valid selector.
    markerDocument?.getElementById(dynamicIds.siegeOverlay(territoryName))?.remove();
}
