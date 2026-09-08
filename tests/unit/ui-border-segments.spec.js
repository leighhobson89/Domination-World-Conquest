// Finding the stretch of outline where two territories actually touch.
//
// This is what lets the military view mark the border the danger is ON, rather than ringing a
// whole country in red because one of its seven neighbours is dangerous.
//
// **IT RESTS ENTIRELY ON THE WELD.** The test for "these two are the same point" is exact
// equality, and that is only a sane test because `tools/weld-map-borders.mjs` merged the two
// independently-digitised copies of every land border onto shared coordinates. Before it, of
// 9,508 anchors on the map exactly 15 coincided with a point on another path -- so the honest
// unit test of this function against the OLD map would have been "returns nothing, everywhere".
// The exactness is also the safety: a near-miss is two coastlines facing each other across
// water, and a tolerance here would draw a land border across a strait.

import { describe, expect, it } from "vitest";

import { anchorKeys, parseSegments, sharedBorderPath } from "../../src/ui/map/borderSegments.js";

/** Two squares sharing their vertical edge from (10,0) to (10,10). */
const LEFT = "M 0 0 L 10 0 L 10 10 L 0 10 Z";
const RIGHT = "M 10 0 L 20 0 L 20 10 L 10 10 Z";

describe("parseSegments", () => {
    it("closes a subpath explicitly, because a shared border can lie on the closing edge", () => {
        const [square] = parseSegments(LEFT);

        expect(square.start).toEqual([0, 0]);
        //Three drawn edges plus the closing one back to the start.
        expect(square.segs).toHaveLength(4);
        expect(square.segs[3]).toEqual(["L", [0, 0]]);
    });

    it("keeps a cubic as a cubic", () => {
        const [subpath] = parseSegments("M 0 0 C 1 2 3 4 5 6");

        expect(subpath.segs[0]).toEqual(["C", [1, 2], [3, 4], [5, 6]]);
    });

    it("gives up rather than guessing at a command it does not know", () => {
        //A wrong border is worse than no border: an unhandled command desynchronises the token
        //stream and everything after it would be read as the wrong kind of point.
        expect(parseSegments("M 0 0 A 1 1 0 0 1 5 5")).toEqual([]);
    });
});

describe("sharedBorderPath", () => {
    it("returns only the edge the two have in common", () => {
        const shared = sharedBorderPath(LEFT, anchorKeys(RIGHT));

        //Down the shared edge: (10,0) to (10,10). Not the other three sides of the square.
        expect(shared).toBe("M 10 0 L 10 10");
    });

    it("is empty for two territories that do not touch", () => {
        const island = "M 100 100 L 110 100 L 110 110 L 100 110 Z";

        expect(sharedBorderPath(LEFT, anchorKeys(island))).toBe("");
    });

    it("is empty for two that come close without sharing a point", () => {
        //The near-miss case, which is the whole reason the test is exact: a strait must not be
        //drawn as a border. A tenth of a unit apart is far closer than any real crossing.
        const nearly = "M 10.1 0 L 20 0 L 20 10 L 10.1 10 Z";

        expect(sharedBorderPath(LEFT, anchorKeys(nearly))).toBe("");
    });

    it("needs BOTH ends of a segment, so a tri-point does not sprout a spur", () => {
        //`corner` touches the left square at exactly one point. A test of "either end is
        //shared" would emit the whole edge leading away from it, drawing a warning across
        //land the two countries do not share at all.
        const corner = "M 10 10 L 20 20 L 0 20 Z";

        expect(sharedBorderPath(LEFT, anchorKeys(corner))).toBe("");
    });

    it("keeps a curved border curved rather than redrawing it as a chord", () => {
        const curved = "M 0 0 C 2 -2 8 -2 10 0 L 10 10 L 0 10 Z";
        const facing = "M 0 0 C 2 -2 8 -2 10 0 L 10 -10 L 0 -10 Z";

        expect(sharedBorderPath(curved, anchorKeys(facing))).toBe("M 0 0 C 2 -2 8 -2 10 0");
    });

    it("emits one run per stretch, so two separate borders do not join up", () => {
        //A territory that meets the same neighbour twice -- around a bay, or either side of an
        //enclave. Each run gets its own move, or the gap between them would be drawn as border.
        const subject = "M 0 0 L 10 0 L 10 5 L 20 5 L 20 10 L 10 10 L 10 20 L 0 20 Z";
        const neighbour = anchorKeys("M 10 0 L 10 5 L 20 5 L 20 10 L 10 10 L 10 20 L 30 20 L 30 0 Z");

        const shared = sharedBorderPath(subject, neighbour);

        expect(shared.match(/M /g)).toHaveLength(1);
        expect(shared).toContain("L 10 5");
        expect(shared).toContain("L 10 20");
    });
});
