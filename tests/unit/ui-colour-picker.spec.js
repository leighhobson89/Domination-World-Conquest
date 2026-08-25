// The swatch palette.
//
// `buildPalette()` is the whole of what the colour picker offers, and it is pure,
// so the properties that matter are worth stating rather than counting by eye in a
// screenshot: there are 256 of them, no two are the same colour, and every one is
// a `#rrggbb` string an `<input type="color">` will accept -- that last one is not
// pedantry, because the input silently keeps its previous value when handed
// something it cannot parse, which would show up as a swatch that does nothing.
//
// The component imports `core/dom.js` but touches the DOM only inside `create()`,
// so this file imports cleanly in Node.

import { describe, expect, it } from "vitest";

import { buildPalette } from "../../src/ui/components/ColourPicker.js";

const HEX = /^#[0-9a-f]{6}$/;

describe("colour picker palette", () => {
    const palette = buildPalette();

    it("offers 256 swatches", () => {
        expect(palette).toHaveLength(256);
    });

    it("is every one a valid lower-case hex colour", () => {
        const bad = palette.filter((colour) => !HEX.test(colour));
        expect(bad).toEqual([]);
    });

    it("has no duplicates", () => {
        expect(new Set(palette).size).toBe(palette.length);
    });

    it("opens with a greyscale ramp from white to black", () => {
        const greys = palette.slice(0, 16);
        expect(greys[0]).toBe("#ffffff");
        expect(greys[15]).toBe("#000000");
        // A grey is a colour whose three channels agree.
        for (const grey of greys) {
            const [r, g, b] = [1, 3, 5].map((at) => grey.slice(at, at + 2));
            expect([g, b], `${grey} is not a grey`).toEqual([r, r]);
        }
    });

    it("walks the hue wheel across each row and darkens down the rows", () => {
        // Column 0 of the coloured rows is hue 0 -- a red -- and it gets darker with
        // every row. Comparing luminance rather than the hex string is what makes
        // this a statement about the palette rather than about the arithmetic.
        const luminance = (hex) =>
            0.2126 * parseInt(hex.slice(1, 3), 16) +
            0.7152 * parseInt(hex.slice(3, 5), 16) +
            0.0722 * parseInt(hex.slice(5, 7), 16);

        let previous = Infinity;
        for (let row = 1; row < 16; row++) {
            const current = luminance(palette[row * 16]);
            expect(current, `row ${row} is not darker than row ${row - 1}`).toBeLessThan(previous);
            previous = current;
        }
    });
});
