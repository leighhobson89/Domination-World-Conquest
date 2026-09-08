// Every line on the map, measured in SCREEN pixels.
//
// The rule `attackArrows.js` established for the arrows and `militaryView.js` for the force
// figures, applied to the thing that draws most of the map: its borders. A stroke written in
// map user units is magnified with the land, so the 1-unit outline every territory carried was
// a hairline at zoom 1 and a five-pixel band at zoom 6 -- which is the reason a zoomed-in map
// looked heavy and dated, with small countries swallowed by their own outlines. A modern map
// holds its line weight constant however far in you go.
//
// **THE WIDTH IS REMEMBERED, NOT RE-DERIVED FROM THE ELEMENT.** A path does not know what it
// is for: a territory outline, a reachable destination and a besieged border are three
// different weights and the only way to rescale them all correctly on a zoom is to know which
// each one was asked for. So a `WeakMap` holds the intended width IN PIXELS per path, and a
// zoom re-applies each. Reading the current `stroke-width` back and multiplying it would
// compound rounding on every notch, and would have no way to tell a 3px highlight from a
// hairline that happened to be at the same zoom.
//
// A `WeakMap` rather than an attribute on the path, because the SVG's attributes are output
// and not state -- `src/ui/mapAttributeSync.js` is the only thing allowed to write them, and a
// presentational figure has no business among the game facts. Nothing here keeps a path alive.
//
// **THE WIDTH IS NOT CONSTANT ON SCREEN EITHER, AND THAT IS THE SECOND CORRECTION.** Holding a
// border at a fixed pixel width fixes the fattening, and then reads as THINNING: at zoom 6 the
// land is six times the size and the line bounding it has not moved, so the border looks like
// a hairline drawn on a much bigger picture. Leigh: *"although it stays the same it appears to
// get thinner because everything else gets larger."* So the weight grows with the zoom, but
// SUBLINEARLY -- see `ZOOM_GROWTH`.

import { currentZoomLevel, userUnitsPerPixel } from "./camera.js";

/**
 * The territory outline.
 *
 * **Set by eye, and revised once.** The first pass took it to 0.9px on the argument that a
 * border is a division between two fills rather than an object in its own right -- which is
 * true of a print atlas and wrong for a game board, where the border is what you trace when
 * you are working out who you can reach. Leigh's call: *"i like the fact that the strokes
 * don't get thicker just by zooming but they need to be thicker than they are now"*. At 1.8 a
 * border is a line a player can follow at world zoom and is still a line, not a band, at 6x --
 * where the old 1-unit stroke was drawing five pixels.
 *
 * If it moves again it moves HERE and nowhere else: every stroke on the map is a multiple of a
 * pixel figure now, so this one constant is the weight of the whole map.
 */
export const HAIRLINE_PX = 1.8;

/**
 * How fast a line thickens as the map is zoomed into: width scales with `zoom ** this`.
 *
 * The two ends of the range are both wrong and both have shipped. **1.0 is a width in map user
 * units**, which is what the map did originally: the 1-unit border was a hairline at zoom 1 and
 * a five-pixel band at zoom 6, swallowing small countries whole. **0 is a width in screen
 * pixels**, which was the first correction, and it reads as the line thinning as everything
 * around it grows.
 *
 * 0.4 is the middle and it is chosen against the actual range rather than by taste. Over the
 * camera's 1x to 6x it takes the ordinary border from 1.8 screen pixels to 3.7 -- a line that
 * is visibly heavier when you are in close, and is still a line rather than a band. The
 * decorated weights ride the same curve, so a threatened border stays proportionally louder
 * than the map around it at every zoom.
 */
const ZOOM_GROWTH = 0.4;

/**
 * The multiplier the current zoom puts on every remembered width.
 *
 * Exported because the military view draws overlays of its own -- the threatened border -- and
 * a line that did not ride this curve would be the one thing on the map whose weight behaved
 * differently from everything around it.
 */
export function zoomWeight() {
    return Math.pow(Math.max(1, currentZoomLevel()), ZOOM_GROWTH);
}

/** What a path was last asked to be drawn at, in screen pixels AT ZOOM 1. */
const widths = new WeakMap();

/**
 * Set a path's stroke width in screen pixels, and remember it for the next zoom.
 *
 * @param {Element} path
 * @param {number|string} pixels
 */
export function setPathStrokePx(path, pixels) {
    if (!path) {
        return;
    }
    const px = Number(pixels) || 0;
    //The figure REMEMBERED is the one at zoom 1, so that the zoom curve is applied once here
    //and once on every refresh, and never compounded onto a value that already carries it.
    widths.set(path, px);
    path.setAttribute("stroke-width", String(px * zoomWeight() * userUnitsPerPixel()));
}

/**
 * Re-apply every remembered width at the current zoom.
 *
 * Silent about a path nobody has set a width on: the coast-line document's boundaries are
 * sized in their own units by `continentView.js` and are not this module's business.
 *
 * @param {Element[]} paths
 */
export function refreshStrokeWidths(paths) {
    const scale = zoomWeight() * userUnitsPerPixel();
    for (const path of paths ?? []) {
        const px = widths.get(path);
        if (px !== undefined) {
            path.setAttribute("stroke-width", String(px * scale));
        }
    }
}
