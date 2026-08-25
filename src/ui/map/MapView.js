// The map as a rendering of the store.
//
// Phase 6.7, and this is the point of the phase. `restoreMapColorState()` used to put
// the map back by replaying a snapshot taken by `saveMapColorState()`, and the two
// were called from about thirty places between `ui.js`, `battle.js`,
// `aiCalculations.js`, `gameTurnsLoop.js` and `resourceCalculations.js`. That made
// "what colour is this territory?" a question about WHEN the last snapshot was taken
// rather than about the world -- which is how a besieged territory could stay painted
// in the player's colour for the rest of a game (known-issues section 2), and how the
// country-selection lock could be lifted by a repaint (audit 5.3 AX).
//
// There is no snapshot now. `repaintMap()` computes every path's fill and stroke from
// `GameState` and writes them. Restoring the map after a selection, a cancel or a
// battle is the same call as painting it in the first place, so there is no clean
// moment to miss and nothing to get out of step.
//
// The decorations -- the selection highlight, the reachable-destination colours, the
// dashed siege stroke, the attack marker -- are still written imperatively onto paths
// by the interaction code. What changed is that undoing them is now a repaint rather
// than a replay, so a decoration cannot outlive the state that justified it.
//
// This module reads the store and writes the SVG. It is the only direction that is
// allowed: nothing here ever reads a game fact back off an attribute.

import {
    anyCountryGreyedOut,
    getTerritory,
    playerColour
} from "../../state/selectors.js";
import {
    pathCountry,
    pathIsDeactivated,
    pathIsGreyedOut,
    pathIsPlayerOwned,
    pathIsUnderSiege
} from "../../state/pathState.js";
import { lockedCountryFill, startingColourFor } from "./colouring.js";

let paths = [];

/** Hand the view the path list `svgMapLoaded()` built. */
export function attachMapView(pathList) {
    paths = pathList;
}

/**
 * The fill a territory has when nothing is decorating it.
 *
 * The player's territories take the colour the player picked; everything else takes
 * the colour its country was given at bootstrap, which `pushColorsToMainArray()`
 * copied into `countryColor` when the game started.
 */
export function baseFillFor(path) {
    if (pathIsPlayerOwned(path)) {
        return playerColour();
    }
    const territory = getTerritory(path.getAttribute("uniqueid"));
    if (typeof territory?.countryColor === "string" && territory.countryColor !== "") {
        return territory.countryColor;
    }
    //Before `pushColorsToMainArray()` there is no `countryColor`; the bootstrap table
    //is the same fact one step earlier. Painting the string "undefined" is what used
    //to render a territory black (audit 5.3 AY), so a missing colour paints nothing.
    return startingColourFor(path.getAttribute("uniqueid"));
}

/**
 * Repaint the whole map from the store.
 *
 * Replaces `restoreMapColorState(currentMapColorAndStrokeArray, false)` at every call
 * site. A besieged or deactivated territory keeps its stroke decoration -- the dashes
 * and the 5px width mean something and are removed when the siege ends, not here --
 * but its FILL is re-asserted like everything else, which is what repairs a territory
 * an earlier turn mis-painted.
 */
export function repaintMap() {
    paths.forEach(path => {
        const fill = baseFillFor(path);
        if (typeof fill === "string" && fill !== "") {
            path.setAttribute("fill", fill);
        }

        if (!isDecorated(path)) {
            path.style.stroke = "rgb(0,0,0)";
            path.setAttribute("stroke-width", "1");
            path.style.strokeDasharray = "none";
        }
    });
}

/** A territory whose stroke belongs to a siege or a lockout, not to the base render. */
function isDecorated(path) {
    return pathIsUnderSiege(path) || pathIsDeactivated(path);
}

/**
 * Repaint the country-selection screen from the store.
 *
 * Replaces `restoreMapColorState(currentMapColorAndStrokeArray, true)`. Every country
 * takes its bootstrap colour, the countries the player may not choose take the muted
 * form of theirs, and the country the player has picked takes the player's colour.
 *
 * The old form took "everything except the selected country" as its rule, which is
 * the same result stated as an exception rather than as a fact about each country --
 * and it is why a restore silently lifted the lock off all five locked countries and
 * `paintLockedCountries()` had to be called after every one of them.
 *
 * @param {string|null} selectedCountry  the country the player has clicked, if any
 */
export function repaintCountrySelection(selectedCountry) {
    const locked = anyCountryGreyedOut();

    paths.forEach(path => {
        const country = pathCountry(path);
        const base = startingColourFor(path.getAttribute("uniqueid"));

        if (locked && pathIsGreyedOut(path)) {
            path.setAttribute("fill", lockedCountryFill(base ?? path.getAttribute("fill")));
            return;
        }
        if (selectedCountry !== null && country === selectedCountry) {
            path.setAttribute("fill", playerColour());
            return;
        }
        if (base) {
            path.setAttribute("fill", base);
        }
    });
}

/**
 * Re-apply the locked treatment to every country the player may not choose.
 *
 * Idempotent. Kept as its own entry point because the colour picker repaints one
 * country at a time and has to put the lock back without touching anything else.
 */
export function paintLockedCountries() {
    if (!anyCountryGreyedOut()) {
        return;
    }
    paths.forEach(path => {
        if (!pathIsGreyedOut(path)) {
            return;
        }
        const base = startingColourFor(path.getAttribute("uniqueid"));
        path.setAttribute("fill", lockedCountryFill(base ?? path.getAttribute("fill")));
    });
}
