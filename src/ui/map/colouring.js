// What colour a territory is, and why.
//
// Phase 6.7. Colour used to be answered by a SNAPSHOT: `saveMapColorState()` walked
// all 359 paths, recorded `[uniqueId, fill, stroke-width]` into
// `currentMapColorAndStrokeArray`, and `restoreMapColorState()` replayed it. Thirty
// or so call sites saved and restored around anything that decorated the map, which
// meant every one of them had to agree on when the map was "clean". They did not:
// audit 5.3 records `false` and `"true"` both being passed as the same flag, and the
// besieged-territory mis-paint (every besieged territory taking the PLAYER's colour)
// survived for as long as it did because the snapshot captured the wrong colour and
// replayed it forever.
//
// The replacement is this module plus `MapView.js`: a territory's colour is a pure
// function of the store, so there is nothing to snapshot. What this file owns is the
// one thing that genuinely is not derivable -- the arbitrary per-country colour the
// world is painted in at bootstrap.
//
// **THE PALETTE ITSELF IS `palette.js`**, and the split is the same one the military view
// makes: the arithmetic that decides a colour is pure and unit-tested, and this file is the
// part that walks the paths and writes fills. What that bought is a modern map -- hue varying
// over a fixed saturation and lightness band, rather than three independent channels -- for
// exactly the same three `Math.random()` draws per country, which is what kept every seeded
// outcome in the game where it was.
//
// `startingColours` IS state, but it is view state and it is written exactly once,
// by `assignStartingColours()` during bootstrap. `pushColorsToMainArray()` then
// copies it into each territory's `countryColor`, and from that point the store is
// authoritative and this table is only consulted for the country-selection screen
// (which runs before `countryColor` exists) and for the locked-country muting.

/**
 * The six continents, as colours.
 *
 * Rebalanced with the palette: the original set was three near-primaries, a pure yellow and a
 * magenta, chosen for separation alone and mixed in with no common saturation or lightness --
 * so the boundary bands read as six unrelated inks rather than as one legend. These are the
 * same six hues, pulled into the band the country palette sits in and lightened, because a
 * boundary is drawn OVER the land and has to stay brighter than everything it crosses while
 * still belonging to the same picture. Separation is preserved: no two are within 40 degrees.
 */
import { countryColourFrom, rgbString } from "./palette.js";
import { HAIRLINE_PX, setPathStrokePx } from "./strokes.js";
import { mapInk } from "./themeColours.js";

export const CONTINENT_COLOR_ARRAY = [
    ["Africa", [214, 178, 62]],
    ["Asia", [201, 96, 74]],
    ["Europe", [143, 186, 96]],
    ["North America", [96, 126, 199]],
    ["South America", [172, 106, 194]],
    ["Oceania", [82, 179, 194]]
];

export const GREY_OUT_COLOR = "rgb(170,170,170)";

//How far a locked country's own colour is pulled toward GREY_OUT_COLOR. Phase 5.8: they
//used to be painted FLAT grey, which read as "this country failed to render" rather than
//"you may not play this one" -- and, because the confirm button was gated on that exact
//fill string, repainting one through the colour picker made it selectable. Keeping the
//country's hue and muting it says the same thing without the fill being load-bearing.
const LOCKED_COUNTRY_MUTING = 0.65;

/** uniqueId -> the `rgb(r, g, b)` this territory was painted at bootstrap. */
const startingColours = new Map();

/** country name -> the same colour, so a whole country can be answered at once. */
const startingCountryColours = new Map();

/**
 * One country's colour: three draws, through the palette.
 *
 * **EXACTLY THREE `Math.random()` CALLS, in this order.** They used to be the three channels
 * of an `rgb()` and are now hue, saturation and lightness through `countryColourFrom()`. The
 * count is what matters and it is not a detail: these draws sit on the game's seeded stream
 * during bootstrap, so adding or removing one moves every seeded outcome in the game (the
 * lesson `generateDistinctRGBs()` left behind -- a country's starting gold moved by hundreds).
 * Keeping the count identical is what let the palette be modernised without re-baselining a
 * single exact-outcome spec.
 */
function randomCountryTriple() {
    const hue = Math.random();
    const saturation = Math.random();
    const lightness = Math.random();
    return countryColourFrom(hue, saturation, lightness);
}

/**
 * Give every country one colour and paint it on.
 *
 * Runs during the bootstrap window, BEFORE `seedTerritories()` -- so it groups paths
 * by the `data-name` attribute rather than by the store, which has no territories in
 * it yet. Answering it from the empty store put all 359 paths in one group and the
 * whole map came out a single flat colour (see the bootstrap-window note in
 * CLAUDE.md); `pathCountry()` is what handles that, and it is the caller's job to
 * pass a reader that does.
 *
 * @param {Element[]} paths
 * @param {(path: Element) => string|null} countryOfPath
 */
export function assignStartingColours(paths, countryOfPath) {
    startingColours.clear();
    startingCountryColours.clear();
    const ink = mapInk();

    paths.forEach(path => {
        const uniqueId = path.getAttribute("uniqueid");
        const country = countryOfPath(path);

        let colour = startingCountryColours.get(country);
        if (colour === undefined) {
            colour = rgbString(randomCountryTriple());
            startingCountryColours.set(country, colour);
        }

        startingColours.set(uniqueId, colour);
        path.setAttribute("fill", colour);
        //THE LINE WORK IS PART OF THE BOOTSTRAP PAINT, not something the first repaint gets
        //round to. The SVG ships with a flat black 1-unit stroke on every path, so a map that
        //only had its fills written here wore the file's outlines until something happened to
        //repaint it -- which on the country-selection screen is nothing at all.
        path.style.stroke = ink;
        setPathStrokePx(path, HAIRLINE_PX);
    });
}

/** The bootstrap colour of one territory, or null if it was never painted. */
export function startingColourFor(uniqueId) {
    return startingColours.get(uniqueId) ?? null;
}

/** The bootstrap colour of a whole country. */
export function startingColourForCountry(countryName) {
    return startingCountryColours.get(countryName) ?? null;
}

/**
 * The muted form of a country colour, for a country the player may not choose.
 *
 * Falls back to flat grey only if the fill is not an `rgb(...)` triple, which no path
 * on this map has once `assignStartingColours()` has run.
 */
export function lockedCountryFill(baseFill) {
    const base = typeof baseFill === "string" ? baseFill.match(/\d+/g) : null;
    if (!base || base.length < 3) {
        return GREY_OUT_COLOR;
    }
    const grey = GREY_OUT_COLOR.match(/\d+/g).map(Number);
    const muted = base.slice(0, 3).map((channel, index) => {
        const value = Number(channel);
        return Math.round(value + (grey[index] - value) * LOCKED_COUNTRY_MUTING);
    });
    return "rgb(" + muted[0] + "," + muted[1] + "," + muted[2] + ")";
}

/** `0`: hex to `rgb(...)`. `1`: `rgb(...)` to hex. */
export function convertHexValueToRGBOrViceVersa(value, direction) {
    if (direction === 0) {
        const hex = value.replace(/^#/, "");
        const intValue = parseInt(hex, 16);
        const red = (intValue >> 16) & 0xff;
        const green = (intValue >> 8) & 0xff;
        const blue = intValue & 0xff;
        return `rgb(${red},${green},${blue})`;
    } else if (direction === 1) {
        const rgb = value.slice(4, -1).split(",");
        const red = parseInt(rgb[0]);
        const green = parseInt(rgb[1]);
        const blue = parseInt(rgb[2]);
        const hexValue = ((red << 16) | (green << 8) | blue).toString(16);
        return `#${hexValue.padStart(6, "0")}`;
    }
}

