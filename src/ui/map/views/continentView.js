// The continent boundaries: which of the six a coastline belongs to.
//
// One of the four map views, extracted from `setContinentStrokes()` in `ui.js`. It is the
// smallest of them and it is the DEFAULT one, because a continent is a thing a player wins
// something for holding and a boundary a player has to go looking for is a boundary they will
// not plan around.
//
// It draws on the COAST-LINE document rather than on the territory map: a boundary follows a
// landmass, not a border, and one coast path can carry several countries. Its continent comes
// from that path's `shadow` attribute, which is the third of the three places that have an
// opinion about which continent something is in -- `initialData.js` is authoritative for a
// TERRITORY, `svgMaster.svg`'s `continent=` is a copy nothing reads, and this one is about
// coastlines and has no territory identity at all. `tests/unit/data-continents.spec.js`
// reconciles all three.
//
// **A LANDMASS THAT SPANS TWO CONTINENTS HAS TO BE CUT BY HAND.** The Americas are one outline
// from Alaska to Tierra del Fuego, and the model puts Mexico in North America while everything
// south of it is South American -- so that ring is two paths, cut along Mexico's Guatemalan
// and Belizean border. Anything that changes a country's continent has to ask this question
// again: the outline does not follow it.

import { CONTINENT_COLOR_ARRAY } from "../colouring.js";
import { plainCoastStroke } from "../themeColours.js";

/**
 * Boundary weights, in the coast document's user units.
 *
 * The boundaries are drawn thinner over the relief map because the relief is already carrying
 * a continent tint underneath them -- at 6 the two read as one heavy band.
 */
const BOUNDARY_WIDTH = "6px";
const BOUNDARY_WIDTH_OVER_RELIEF = "5px";

/** Plain coast weights. An island is a small closed shape and takes a finer line. */
const COAST_WIDTH = "5px";
const ISLAND_COAST_WIDTH = "2px";

function continentStroke(coastPath) {
    const continent = coastPath.getAttribute("shadow");
    const row = CONTINENT_COLOR_ARRAY.find(([name]) => name === continent);
    return row ? `rgb(${row[1].join(", ")})` : null;
}

/**
 * Draw the continent boundaries, or put the plain coast back.
 *
 * @param {boolean} on
 * @param {object} context
 * @param {Element[]} context.coastPaths
 * @param {boolean} context.overRelief  is the relief map underneath?
 */
export function applyContinentBoundaries(on, { coastPaths, overRelief = false }) {
    const plain = plainCoastStroke();

    for (const coastPath of coastPaths) {
        if (on) {
            const stroke = continentStroke(coastPath);
            if (stroke) {
                coastPath.style.stroke = stroke;
            }
            coastPath.style.strokeWidth = overRelief ? BOUNDARY_WIDTH_OVER_RELIEF : BOUNDARY_WIDTH;
            continue;
        }
        coastPath.style.stroke = plain;
        coastPath.style.strokeWidth =
            coastPath.getAttribute("isisland") === "true" ? ISLAND_COAST_WIDTH : COAST_WIDTH;
    }
}
