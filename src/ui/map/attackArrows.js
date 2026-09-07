// The animated attack arrows: one curved band running from the territory the player
// has selected to each enemy territory it may attack.
//
// The reachable-destination highlight already existed -- clicking your own territory in
// the move/attack phase paints every valid destination with a diagonal pattern -- but
// the pattern says "this one is reachable" and does not say WHERE FROM, and a player
// looking at eight hatched territories in a crowded theatre cannot see which of their
// own provinces the offer belongs to. An arrow states both halves of the fact.
//
// Where the arrows GO is `arrowGeometry.js`, which is pure and unit-tested. This module
// is the only thing that turns that plan into elements, and the only thing that puts
// them on or takes them off. Four things about how it does it.
//
// **It draws into the MAP's document, and that is the whole difficulty** -- the same
// difficulty `src/ui/siegeOverlay.js` records. `#svg-map` is an `<object>`, so the SVG
// inside it has its own document: `style.css` does not reach it, the theme's custom
// properties on the host root do not cascade into it, and `currentColor` therefore has
// nothing to resolve against. The colour is read off the HOST root with
// `getComputedStyle` and written on as a literal, and every arrow is redrawn on
// `THEME_CHANGED`.
//
// **The animation is SMIL, not CSS.** A `<style>` element injected into a foreign
// document would be a second stylesheet nobody reading `style.css` would know about,
// and the band's travel is a per-arrow distance -- every arrow is a different length --
// so it could not be one keyframes rule anyway. An `<animate>` child carries its own
// numbers, goes in and out with the element it animates, and leaves nothing behind:
// the same "self-contained group that can be dropped in and taken out again" rule the
// siege marker follows.
//
// **The band's timing is derived from the path's own length**, which is why
// `animateBand()` runs AFTER the shaft is in the document -- `getTotalLength()` needs a
// laid-out path, and a Bezier's length is not its chord.
//
// **A zoom redraws everything.** The geometry is sized in screen pixels, so every
// number in it changes when the magnification does; `onZoomChanged()` on the camera
// exists for this subscription and has no other subscriber.
//
// Undoing the arrows is a repaint, exactly as it is for every other decoration on the
// map: `repaintMap()` clears them. There is no second way to take them off.

import { ids, dynamicIds } from "../core/registry.js";
import { THEME_CHANGED } from "../theme/theme.js";
import { userUnitsPerPixel, onZoomChanged } from "./camera.js";
import { planAttackArrows, bandFor } from "./arrowGeometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** How much wider the moving band is drawn than the track underneath it. */
const BAND_WIDTH_FACTOR = 1.6;

/** How faint the full-length track is. It is what keeps the two territories joined in
 *  the moment the band is at the far end -- without it the arrow is only a moving
 *  dash, and for part of every cycle there is nothing joining them at all. */
const TRACK_OPACITY = "0.45";

/**
 * The dark casing under every arrow, in screen pixels each side.
 *
 * The arrows are drawn over whatever the map happens to be: the hatched destination
 * pattern, a light territory, a dark one, and in six themes. One colour cannot read
 * against all of that on its own, which is how the first pass came out as red
 * hairlines over a white hatch. The casing is the same trick a route line on a road
 * map uses -- a dark edge under a bright core -- and it is what makes the arrow's
 * colour a decoration rather than the only thing holding it up.
 */
const CASING_PX = 1.3;
const CASING_COLOUR = "rgba(0, 0, 0, 0.55)";

let arrowDocument = null;

/** What is currently drawn -- the source path and its targets -- so that a redraw needs
 *  no argument. Cleared with the arrows themselves. */
let sourcePath = null;
let targetPaths = [];

/** Point the arrow layer at the map's contentDocument. Called from `svgMapLoaded()`. */
export function attachArrowLayer(svgDocument) {
    arrowDocument = svgDocument;
}

/**
 * The colour an arrow is painted, resolved from the theme in force.
 *
 * `--negative` rather than `--accent`, for the reason the siege marker gives: this is a
 * threat drawn on the map, and the accent is already the colour of the chrome the
 * player clicks. The fallback covers the bootstrap window in which the token has not
 * been written yet.
 */
function arrowColour() {
    try {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue("--negative")
            .trim();
        return value || "#c0392b";
    } catch {
        return "#c0392b";
    }
}

function centroidOf(path) {
    const bounds = path.getBBox();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/** Half the smaller side of a territory's bounding box: the radius the tails ring. */
function radiusOf(path) {
    const bounds = path.getBBox();
    return Math.min(bounds.width, bounds.height) / 2;
}

/**
 * The `<g>` every arrow lives in, created on demand and always re-appended last.
 *
 * Re-appending is the z-order fix `raiseAttackMarker()` makes for the battle marker:
 * anything that re-appends a territory path -- escaping out of the menu does -- puts
 * that path over whatever was drawn before it.
 */
function arrowLayer(parent) {
    let layer = arrowDocument.getElementById(ids.attackArrowLayer);
    if (!layer) {
        layer = arrowDocument.createElementNS(SVG_NS, "g");
        layer.setAttribute("id", ids.attackArrowLayer);
        //A decoration must never intercept a click (audit 5.3 AW). These run right
        //across the middle of the territories they point at, so without this the hit
        //test at an attackable territory returns an arrow and the player cannot select
        //the very thing the arrow is advertising.
        layer.setAttribute("style", "pointer-events: none");
    }
    parent.appendChild(layer);
    return layer;
}

/**
 * Give a shaft its travelling band.
 *
 * `stroke-dasharray: band, total` leaves exactly one dash on the path, because the
 * pattern's period is longer than the path itself. Running `stroke-dashoffset` from
 * `band` -- the dash sitting entirely before the start, so invisible -- to `-total`,
 * entirely past the end, walks that one dash the whole way along and repeats. That is
 * the band running towards the head over and over that this exists to draw.
 */
function animateBand(shaft, unit) {
    let total;
    try {
        total = shaft.getTotalLength();
    } catch {
        return; // not laid out; the next draw will try again
    }
    if (!Number.isFinite(total) || total <= 0) {
        return;
    }

    const { band, seconds, from, to } = bandFor(total, unit);
    shaft.setAttribute("stroke-dasharray", band + " " + total);

    const animate = shaft.ownerDocument.createElementNS(SVG_NS, "animate");
    animate.setAttribute("attributeName", "stroke-dashoffset");
    animate.setAttribute("from", String(from));
    animate.setAttribute("to", String(to));
    animate.setAttribute("dur", seconds.toFixed(2) + "s");
    animate.setAttribute("repeatCount", "indefinite");
    shaft.appendChild(animate);
}

function strokedPath(document_, d, colour, width) {
    const element = document_.createElementNS(SVG_NS, "path");
    element.setAttribute("d", d);
    element.setAttribute("fill", "none");
    element.setAttribute("stroke", colour);
    element.setAttribute("stroke-width", String(width));
    element.setAttribute("stroke-linecap", "round");
    return element;
}

/** One arrow: the faint full-length track, the travelling band over it, and the head. */
function buildArrow(document_, plan, colour) {
    const group = document_.createElementNS(SVG_NS, "g");
    group.setAttribute("id", dynamicIds.attackArrow(plan.uniqueId));

    const casing = strokedPath(
        document_, plan.shaftD, CASING_COLOUR,
        plan.strokeWidth * BAND_WIDTH_FACTOR + 2 * CASING_PX * plan.unit
    );
    group.appendChild(casing);

    const track = strokedPath(document_, plan.shaftD, colour, plan.strokeWidth);
    track.setAttribute("stroke-opacity", TRACK_OPACITY);
    group.appendChild(track);

    const shaft = strokedPath(
        document_, plan.shaftD, colour, plan.strokeWidth * BAND_WIDTH_FACTOR
    );
    group.appendChild(shaft);

    const head = document_.createElementNS(SVG_NS, "path");
    head.setAttribute("d", plan.headD);
    head.setAttribute("fill", colour);
    head.setAttribute("stroke", CASING_COLOUR);
    head.setAttribute("stroke-width", String(2 * CASING_PX * plan.unit));
    head.setAttribute("stroke-linejoin", "round");
    group.appendChild(head);

    return { group, shaft };
}

/**
 * Draw one arrow from `source` to each of `targets`.
 *
 * Replaces whatever was drawn before, so it is safe to call on every click.
 *
 * @param {Element} source     the player's territory, the arrows' common origin
 * @param {Element[]} targets  the enemy territories it may attack
 */
export function showAttackArrows(source, targets) {
    clearAttackArrows();

    if (!arrowDocument || !source || !targets || targets.length === 0) {
        return;
    }

    sourcePath = source;
    targetPaths = targets.slice();
    drawArrows();
}

/** Redraw what is already shown -- after a zoom, or a theme change. */
export function refreshAttackArrows() {
    if (!sourcePath || targetPaths.length === 0) {
        return;
    }
    removeLayer();
    drawArrows();
}

function drawArrows() {
    //getBBox() throws on a path that is not rendered yet. A missing arrow is cosmetic;
    //a throw here would escape into the map's click handler, which has no catch
    //anywhere above it.
    try {
        const unit = userUnitsPerPixel();
        const colour = arrowColour();
        const from = centroidOf(sourcePath);

        const plans = planAttackArrows(
            from,
            targetPaths.map(path => {
                const centre = centroidOf(path);
                return {
                    uniqueId: path.getAttribute("uniqueid"),
                    x: centre.x,
                    y: centre.y
                };
            }),
            unit,
            radiusOf(sourcePath)
        );

        const layer = arrowLayer(sourcePath.parentNode);

        for (const plan of plans) {
            const { group, shaft } = buildArrow(arrowDocument, plan, colour);
            layer.appendChild(group);
            //After the append, because the band's length and cycle are derived from
            //`getTotalLength()`, which wants the path in a laid-out document.
            animateBand(shaft, unit);
        }
    } catch {
        // not laid out yet; the next selection or zoom will try again
    }
}

function removeLayer() {
    //audit 5.2 AI: getElementById, never a selector, for anything inside the map.
    arrowDocument?.getElementById(ids.attackArrowLayer)?.remove();
}

/** Take every arrow off the map and forget what was drawn. */
export function clearAttackArrows() {
    removeLayer();
    sourcePath = null;
    targetPaths = [];
}

/** How many arrows are on the map. Used by the specs and by nothing else. */
export function attackArrowCount() {
    return arrowDocument?.getElementById(ids.attackArrowLayer)?.childElementCount ?? 0;
}

if (typeof window !== "undefined") {
    window.addEventListener(THEME_CHANGED, refreshAttackArrows);
}

// The arrows are sized in screen pixels, so a change of magnification changes every
// number in them. This is the subscription that makes the redraw happen.
onZoomChanged(refreshAttackArrows);
