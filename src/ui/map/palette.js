// What a country looks like: the map's palette, as arithmetic.
//
// The world used to be painted in 207 colours drawn as three independent channels in
// `[50, 200)`. That is the whole of why the map looked like a 1990s atlas: three independent
// channels give no control over saturation or lightness, so the map carried muddy olives, near
// blacks and a scattering of near-primaries all at once, and two neighbours could differ only
// in a channel the eye reads as brightness. A modern thematic map varies HUE and holds
// saturation and lightness inside a narrow band, so that every country reads as the same
// MATERIAL under the same light and the differences between them are differences of colour.
//
// **THE DRAW COUNT IS LOAD-BEARING.** `assignStartingColours()` runs during bootstrap and its
// `Math.random()` calls sit on the game's seeded stream, so anything that adds or removes a
// draw moves every seeded outcome in the game -- the note `generateDistinctRGBs()` left behind
// in CLAUDE.md, measured at the time as a country's starting gold moving by hundreds. This
// takes exactly THREE draws per country, in the same order as the three channels it replaces,
// which is why the palette could be modernised without re-baselining a single exact-outcome
// spec.
//
// It is pure and imports nothing, so `tests/unit/ui-map-palette.spec.js` can assert the band
// directly -- which is the only way to state "no country is ever nearly black" as a fact
// rather than as an intention.

/**
 * How many hues the map is cut into.
 *
 * Quantised rather than continuous, and 24 rather than 207: two countries whose hues differ by
 * a degree and a half are the same colour to anybody looking at a map, so a continuous hue
 * spread over 207 countries spends most of its range on distinctions nobody can see. Fifteen
 * degrees apart is a step the eye takes as a different colour.
 */
export const MAP_HUE_STEPS = 24;

/** The saturation band every country sits in. Low enough to read under the UI chrome. */
export const MAP_SATURATION = Object.freeze({ min: 0.3, max: 0.52 });

/**
 * The lightness band.
 *
 * The floor is what stops a country coming out nearly black, and the ceiling is what keeps it
 * off the sea: `resources/sea.png` averages `rgb(146, 160, 234)`, which is lightness 0.75, so
 * land stays darker than water at every hue and the coastline never has to do that work alone.
 */
export const MAP_LIGHTNESS = Object.freeze({ min: 0.46, max: 0.64 });

/** Mix a fraction of the way along a range. */
function within(range, fraction) {
    return range.min + (range.max - range.min) * fraction;
}

/**
 * HSL to RGB, channels 0..255.
 *
 * The standard conversion, written out rather than imported: the codebase has no colour
 * library and this is the only place that needs one.
 *
 * @param {number} hue 0..1
 * @param {number} saturation 0..1
 * @param {number} lightness 0..1
 * @returns {number[]} [r, g, b], each 0..255
 */
export function hslToRgb(hue, saturation, lightness) {
    const h = ((hue % 1) + 1) % 1;
    const s = Math.min(1, Math.max(0, saturation));
    const l = Math.min(1, Math.max(0, lightness));

    if (s === 0) {
        const flat = Math.round(l * 255);
        return [flat, flat, flat];
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const channel = (offset) => {
        let t = h + offset;
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    return [
        Math.round(channel(1 / 3) * 255),
        Math.round(channel(0) * 255),
        Math.round(channel(-1 / 3) * 255)
    ];
}

/**
 * One country's colour, from the three draws that used to be its three channels.
 *
 * The hue is quantised into `MAP_HUE_STEPS`; the other two draws move the colour inside the
 * saturation and lightness bands, which is what stops twenty countries in the same hue bucket
 * being literally the same colour. **The lightness is stepped by the hue bucket's parity**, so
 * that two adjacent hues are also two different weights of colour -- neighbours on this map
 * are frequently in adjacent buckets, and hue alone separates them less than it looks like it
 * should once the shapes are small.
 *
 * @param {number} hueDraw 0..1
 * @param {number} saturationDraw 0..1
 * @param {number} lightnessDraw 0..1
 * @returns {number[]} [r, g, b]
 */
export function countryColourFrom(hueDraw, saturationDraw, lightnessDraw) {
    const bucket = Math.min(MAP_HUE_STEPS - 1, Math.floor(hueDraw * MAP_HUE_STEPS));
    const hue = bucket / MAP_HUE_STEPS;

    const saturation = within(MAP_SATURATION, saturationDraw);
    //Half the band for the draw, and a step of the other half for the bucket's parity: every
    //colour still lands inside `MAP_LIGHTNESS`, and adjacent hues alternate light and dark.
    const span = (MAP_LIGHTNESS.max - MAP_LIGHTNESS.min) / 2;
    const lightness = MAP_LIGHTNESS.min + lightnessDraw * span + (bucket % 2) * span;

    return hslToRgb(hue, saturation, lightness);
}

/** `[r, g, b]` as the `rgb(r, g, b)` string every fill in this game is written as. */
export function rgbString(triple) {
    return `rgb(${triple[0]}, ${triple[1]}, ${triple[2]})`;
}
