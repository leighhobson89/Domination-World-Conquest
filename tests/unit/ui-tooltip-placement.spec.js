// Where the hover tooltip goes.
//
// Leigh, playing the game: *"tooltips near the bottom should move above the mouse pointer
// because they are causing the browser to flicker and resize when they get too near the
// bottom"*. Two separate faults produced that, and only one of them is arithmetic:
//
//   THE RESIZE was `#tooltip` being `position: absolute`, so a box placed near the foot of
//   the window extended the DOCUMENT, raised a scrollbar and reflowed the page — which moved
//   whatever the pointer was over, which moved the tooltip. It is `position: fixed` now and
//   a fixed box cannot extend anything. That half is one line of CSS and is asserted in the
//   stylesheet spec, not here.
//
//   THE PLACEMENT is this file. There were EIGHT copies of the decision across `ui.js`,
//   `resourceCalculations.js`, `InfoTable.js` and `tableDom.js`, lifting the box by 30, by
//   50, by its height, or by its height plus 25 — and three of them decided "near the
//   bottom" with a fixed 100px, which is wrong for any tooltip taller than 100px. The
//   territory tooltip with a leader line, a continent line, four upgrade rows and six
//   relation rows is a great deal taller than 100px.
//
// `placementFor()` is pure so the four edge cases can be stated here rather than reached by
// hovering the right pixel of a live map, which is what made this bug survive so long.

import { describe, expect, it } from "vitest";

import { placementFor } from "../../src/ui/components/Tooltip.js";

/** A 1280x720 window and a 200x120 box, unless a case says otherwise. */
function place(overrides = {}) {
    return placementFor({
        x: 640,
        y: 360,
        width: 200,
        height: 120,
        viewportWidth: 1280,
        viewportHeight: 720,
        ...overrides
    });
}

describe("the vertical rule", () => {
    it("sits below the pointer when the whole box fits", () => {
        expect(place({ y: 100 }).top).toBe(125);
    });

    it("lifts the box ABOVE the pointer when it would not fit below", () => {
        //The heart of the report. At y=650 a 120px box placed below would end at 795,
        //seventy-five pixels past the bottom of a 720px window.
        const top = place({ y: 650 }).top;
        expect(top).toBeLessThan(650);
        expect(top + 120).toBeLessThanOrEqual(650);
    });

    it("lifts by the box's OWN height, not by a constant", () => {
        //A tall tooltip and a short one at the same pointer position must both end up
        //fully on screen. The old code lifted by 30 or by 50, so a tall box moved up by
        //less than its own height and still ran off the end -- which is precisely the
        //case that grew the document.
        for (const height of [40, 120, 300, 500]) {
            const { top } = place({ y: 700, height });
            expect(top).toBeGreaterThanOrEqual(0);
            expect(top + height).toBeLessThanOrEqual(720);
        }
    });

    it("keeps the box on screen at the very bottom pixel", () => {
        const { top } = place({ y: 719, height: 300 });
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top + 300).toBeLessThanOrEqual(720);
    });

    it("starts at the top when the box is taller than the room above the pointer", () => {
        //Unavoidable, and harmless: the tooltip carries `pointer-events: none`, so
        //overlapping the pointer still cannot cost anybody a click. What matters is that
        //it does not go NEGATIVE, which would put the first line off the top of the screen.
        expect(place({ y: 40, height: 600 }).top).toBeGreaterThanOrEqual(0);
    });

    it("never returns a negative top for any pointer position", () => {
        for (let y = 0; y <= 720; y += 20) {
            for (const height of [30, 150, 400, 900]) {
                expect(place({ y, height }).top).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

describe("the horizontal rule", () => {
    it("sits to the left of the pointer by the standard offset", () => {
        expect(place({ x: 640 }).left).toBe(600);
    });

    it("pulls the box back from the right-hand edge", () => {
        const { left } = place({ x: 1275, width: 400 });
        expect(left + 400).toBeLessThanOrEqual(1280);
    });

    it("does not push the box off the left-hand edge", () => {
        expect(place({ x: 5 }).left).toBeGreaterThanOrEqual(0);
    });

    it("honours a caller's own horizontal offset", () => {
        //`tableDom.js` uses 60 rather than 40, because its rows are wider.
        expect(place({ x: 640, offsetLeft: 60 }).left).toBe(580);
    });

    it("never returns a negative left for any pointer position", () => {
        for (let x = 0; x <= 1280; x += 40) {
            for (const width of [80, 300, 900, 2000]) {
                expect(place({ x, width }).left).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

describe("a small window", () => {
    it("still keeps the box inside a phone-sized viewport", () => {
        //A box bigger than the window can only be clamped to the corner. What must not
        //happen is a negative coordinate, which is what puts content out of reach.
        const { left, top } = placementFor({
            x: 200, y: 300, width: 400, height: 500,
            viewportWidth: 360, viewportHeight: 640
        });
        expect(left).toBeGreaterThanOrEqual(0);
        expect(top).toBeGreaterThanOrEqual(0);
    });
});
