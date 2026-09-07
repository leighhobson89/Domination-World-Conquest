// Painting the world at bootstrap, and the one thing about it that is not cosmetic.
//
// **`assignStartingColours()` DRAWS FROM THE GAME'S SEEDED STREAM.** It runs inside the
// bootstrap window, so its `Math.random()` calls are interleaved with the ones that decide
// starting gold, starting army and everything else a `?seed=` run reproduces. Adding or
// removing a single draw shifts every one of those -- the lesson `generateDistinctRGBs()` left
// behind, where deleting a dead function moved the United Kingdom's starting gold by four
// hundred and West Papua's by double.
//
// That is why this spec exists and why it counts calls rather than looking at colours. The
// palette was modernised from three raw channels to hue/saturation/lightness through
// `palette.js`, and the ONLY reason that could be done without re-baselining the exact-outcome
// specs is that it takes the same three draws per country, in the same order. A future change
// to the palette is free to produce any colour it likes; it is not free to draw a fourth time.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
    assignStartingColours,
    lockedCountryFill,
    startingColourFor,
    startingColourForCountry
} from "../../src/ui/map/colouring.js";

/**
 * A path stub: the two attributes the assignment reads, a fill it can be given, and a `style`.
 *
 * The `style` is not decoration. The bootstrap paint writes the LINE WORK as well as the fill
 * -- the SVG ships with its own flat black stroke on every path and the country-selection
 * screen never repaints, so a map that only had its fills written here wore the file's
 * outlines for the whole of that screen.
 */
function path(uniqueId, country) {
    const attributes = { uniqueid: String(uniqueId) };
    return {
        country,
        style: {},
        getAttribute: (name) => attributes[name] ?? null,
        setAttribute: (name, value) => {
            attributes[name] = value;
        }
    };
}

const countryOf = (candidate) => candidate.country;

describe("assignStartingColours", () => {
    beforeEach(() => {
        vi.spyOn(Math, "random");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("draws exactly three times per COUNTRY, never per territory", () => {
        const paths = [
            path(1, "Alpha"),
            path(2, "Alpha"),
            path(3, "Alpha"),
            path(4, "Beta")
        ];

        assignStartingColours(paths, countryOf);

        //Two countries, six draws. Per-territory would be twelve, and every seeded outcome in
        //the game after the map is coloured would move.
        expect(Math.random).toHaveBeenCalledTimes(6);
    });

    it("paints every territory of a country the same colour", () => {
        const paths = [path(1, "Alpha"), path(2, "Alpha"), path(3, "Beta")];

        assignStartingColours(paths, countryOf);

        expect(startingColourFor("1")).toBe(startingColourFor("2"));
        expect(startingColourFor("1")).not.toBe(startingColourFor("3"));
        expect(startingColourForCountry("Alpha")).toBe(startingColourFor("1"));
    });

    it("writes the colour AND the line work onto the path, because bootstrap has no store", () => {
        const only = path(1, "Alpha");

        assignStartingColours([only], countryOf);

        expect(only.getAttribute("fill")).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        //The themed ink and a stroke width in the map's own units, from the pixel figure.
        expect(only.style.stroke).toBeTruthy();
        expect(Number(only.getAttribute("stroke-width"))).toBeGreaterThan(0);
    });

    it("forgets the previous game's colours when it runs again", () => {
        assignStartingColours([path(1, "Alpha")], countryOf);
        assignStartingColours([path(2, "Beta")], countryOf);

        expect(startingColourFor("1")).toBeNull();
        expect(startingColourForCountry("Alpha")).toBeNull();
    });
});

describe("lockedCountryFill", () => {
    it("mutes a country toward grey rather than replacing it", () => {
        //Flat grey read as "this country failed to render", and gating the confirm button on
        //that exact fill string is what once made a locked country selectable in three clicks.
        const muted = lockedCountryFill("rgb(200, 100, 50)");
        const [r, g, b] = muted.match(/\d+/g).map(Number);

        expect(muted).not.toBe("rgb(200, 100, 50)");
        //Still recognisably the same country: red is the largest channel before and after.
        expect(r).toBeGreaterThan(g);
        expect(g).toBeGreaterThan(b);
    });

    it("falls back to flat grey only when the fill is not an rgb triple", () => {
        expect(lockedCountryFill("chartreuse")).toBe("rgb(170,170,170)");
    });
});
