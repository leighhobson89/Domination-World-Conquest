// The map's palette, as a band rather than as an intention.
//
// The world is painted in 207 colours and nobody can look at all of them, so "no country is
// ever nearly black" and "no country is ever brighter than the sea" have to be facts a test
// can state. That is the whole reason the palette is arithmetic in a module of its own rather
// than three `Math.random()` calls inline: the old code could not be tested at all, and what
// it produced -- three independent channels in [50, 200) -- included muddy olives, near-blacks
// and near-primaries side by side.
//
// **THE DRAW COUNT IS THE OTHER INVARIANT and it is asserted in `colouring.js`'s own spec**,
// not here: these draws sit on the game's seeded stream during bootstrap, so adding or
// removing one moves every seeded outcome in the game.

import { describe, expect, it } from "vitest";

import {
    MAP_HUE_STEPS,
    MAP_LIGHTNESS,
    MAP_SATURATION,
    countryColourFrom,
    hslToRgb,
    rgbString
} from "../../src/ui/map/palette.js";

/** Relative luminance-ish lightness, the same quantity `MAP_LIGHTNESS` is expressed in. */
function lightnessOf([r, g, b]) {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    return (max + min) / 2;
}

function saturationOf([r, g, b]) {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const lightness = (max + min) / 2;
    if (max === min) {
        return 0;
    }
    return lightness > 0.5
        ? (max - min) / (2 - max - min)
        : (max - min) / (max + min);
}

/** Every colour the palette can produce, sampled finely enough to catch an edge. */
function sweep(step = 0.05) {
    const colours = [];
    for (let hue = 0; hue < 1; hue += step) {
        for (let saturation = 0; saturation <= 1; saturation += step * 4) {
            for (let lightness = 0; lightness <= 1; lightness += step * 4) {
                colours.push(countryColourFrom(hue, saturation, lightness));
            }
        }
    }
    return colours;
}

describe("hslToRgb", () => {
    it("agrees with the standard conversion at the corners", () => {
        expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);
        expect(hslToRgb(1 / 3, 1, 0.5)).toEqual([0, 255, 0]);
        expect(hslToRgb(2 / 3, 1, 0.5)).toEqual([0, 0, 255]);
        expect(hslToRgb(0, 0, 0.5)).toEqual([128, 128, 128]);
    });

    it("wraps the hue rather than clamping it, so 1.0 is 0.0", () => {
        expect(hslToRgb(1, 1, 0.5)).toEqual(hslToRgb(0, 1, 0.5));
        expect(hslToRgb(-1 / 3, 1, 0.5)).toEqual(hslToRgb(2 / 3, 1, 0.5));
    });
});

describe("the country palette", () => {
    it("never produces a colour outside the lightness band", () => {
        //The floor is what stops a country coming out nearly black -- the old palette's worst
        //case was rgb(50, 50, 50) -- and the ceiling is what keeps land darker than the ocean,
        //which averages lightness 0.75.
        for (const colour of sweep()) {
            const lightness = lightnessOf(colour);
            expect(lightness).toBeGreaterThanOrEqual(MAP_LIGHTNESS.min - 0.01);
            expect(lightness).toBeLessThanOrEqual(MAP_LIGHTNESS.max + 0.01);
        }
    });

    it("holds every country inside one saturation band", () => {
        //This is what makes 207 arbitrary colours read as one map: the same material under the
        //same light, differing in hue. Three independent channels cannot express it.
        for (const colour of sweep()) {
            const saturation = saturationOf(colour);
            expect(saturation).toBeGreaterThanOrEqual(MAP_SATURATION.min - 0.02);
            expect(saturation).toBeLessThanOrEqual(MAP_SATURATION.max + 0.02);
        }
    });

    it("quantises the hue, so two countries are either the same colour or a visible step apart", () => {
        //Within one bucket the hue is identical; the draws move saturation and lightness only.
        const low = countryColourFrom(0.001, 0.5, 0.5);
        const alsoLow = countryColourFrom(1 / MAP_HUE_STEPS - 0.001, 0.5, 0.5);
        expect(low).toEqual(alsoLow);

        const nextBucket = countryColourFrom(1 / MAP_HUE_STEPS + 0.001, 0.5, 0.5);
        expect(nextBucket).not.toEqual(low);
    });

    it("alternates weight between neighbouring hues", () => {
        //Small shapes packed together separate on hue less than it looks like they should, so
        //adjacent buckets are also different weights of colour.
        const even = lightnessOf(countryColourFrom(0.01, 0.5, 0.5));
        const odd = lightnessOf(countryColourFrom(1 / MAP_HUE_STEPS + 0.01, 0.5, 0.5));
        expect(Math.abs(even - odd)).toBeGreaterThan(0.04);
    });

    it("is deterministic: the same draws are the same colour", () => {
        expect(countryColourFrom(0.3, 0.7, 0.2)).toEqual(countryColourFrom(0.3, 0.7, 0.2));
    });

    it("writes the rgb form every fill in this game is written in", () => {
        expect(rgbString([1, 2, 3])).toBe("rgb(1, 2, 3)");
    });
});
