// The attack arrows' geometry, which is pure arithmetic and therefore settled here
// rather than by looking at the map.
//
// Three claims are worth a test, and all three are things the feature was ASKED for:
// one arrow per attackable territory, arrows that do not lie on top of one another,
// and no arrow so short the player cannot see it. The first is trivial, the second is
// what the bow clustering is for, and the third is what the tail extension is for --
// and the third is also the one that changes with the zoom, which is why every
// assertion below passes `unit` explicitly.

import { describe, it, expect } from "vitest";
import {
    planAttackArrows,
    bowsFor,
    arrowSpineFor,
    arrowHeadFor,
    bandFor,
    MIN_ARROW_PX,
    MAX_TAIL_EXTENSION_PX,
    HEAD_LENGTH_PX
} from "../../src/ui/map/arrowGeometry.js";

const ORIGIN = { x: 0, y: 0 };

/** A target at a bearing (degrees, clockwise from east) and a distance. */
function at(uniqueId, degrees, distance) {
    const radians = (degrees * Math.PI) / 180;
    return {
        uniqueId,
        x: Math.cos(radians) * distance,
        y: Math.sin(radians) * distance
    };
}

/** Sample a quadratic Bezier, which is how two curves are compared for overlap. */
function sample(plan, steps = 40) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const inverse = 1 - t;
        points.push({
            x: inverse * inverse * plan.start.x
                + 2 * inverse * t * plan.control.x
                + t * t * plan.tip.x,
            y: inverse * inverse * plan.start.y
                + 2 * inverse * t * plan.control.y
                + t * t * plan.tip.y
        });
    }
    return points;
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("planAttackArrows", () => {
    it("plans exactly one arrow per target", () => {
        const targets = [at("1", 0, 200), at("2", 90, 200), at("3", 200, 300)];
        expect(planAttackArrows(ORIGIN, targets, 1)).toHaveLength(3);
    });

    it("puts every head on its own target's centre, whatever else it moves", () => {
        const targets = [at("1", 10, 40), at("2", 14, 300), at("3", 190, 25)];
        for (const plan of planAttackArrows(ORIGIN, targets, 1)) {
            const target = targets.find(candidate => candidate.uniqueId === plan.uniqueId);
            expect(plan.tip.x).toBeCloseTo(target.x, 6);
            expect(plan.tip.y).toBeCloseTo(target.y, 6);
        }
    });

    it("drops a target sitting exactly on the source rather than dividing by zero", () => {
        const plans = planAttackArrows(ORIGIN, [
            { uniqueId: "1", x: 0, y: 0 },
            at("2", 45, 200)
        ], 1);
        expect(plans.map(plan => plan.uniqueId)).toEqual(["2"]);
    });

    it("returns the arrows in bearing order, so drawing order is a walk round the compass", () => {
        const plans = planAttackArrows(ORIGIN, [
            at("east", 5, 200), at("south", 95, 200), at("west", 185, 200)
        ], 1);
        expect(plans.map(plan => plan.uniqueId)).toEqual(["east", "south", "west"]);
    });
});

describe("separation", () => {
    it("bows a lone arrow one way, so a set of them reads as one family", () => {
        expect(bowsFor([{ bearing: 0 }])).toEqual([bowsFor([{ bearing: 0 }])[0]]);
        expect(bowsFor([{ bearing: 0 }])[0]).toBeGreaterThan(0);
    });

    it("spreads a cluster symmetrically about the base bow", () => {
        const bows = bowsFor([{ bearing: 0 }, { bearing: 0.1 }, { bearing: 0.2 }]);
        expect(bows[0]).toBeLessThan(bows[1]);
        expect(bows[1]).toBeLessThan(bows[2]);
        // Symmetric: the middle member keeps the base bow.
        expect(bows[0] + bows[2]).toBeCloseTo(2 * bows[1], 10);
    });

    it("leaves well-separated bearings alone -- they do not need spreading", () => {
        const bows = bowsFor([{ bearing: 0 }, { bearing: 1.5 }, { bearing: 3 }]);
        expect(new Set(bows).size).toBe(1);
    });

    it("closes the wrap: two arrows either side of due east are one cluster", () => {
        // 0.05 rad and 6.23 rad are 0.1 rad apart across the seam, not 6.18 apart.
        const bows = bowsFor([{ bearing: 0.05 }, { bearing: 2.5 }, { bearing: 6.23 }]);
        expect(bows[0]).not.toBeCloseTo(bows[2], 6);
    });

    it("keeps two arrows on nearly the same bearing off one another", () => {
        // Same direction, very different lengths: the short one would otherwise lie
        // along the first third of the long one for its whole life.
        const plans = planAttackArrows(ORIGIN, [
            at("near", 40, 120), at("far", 46, 420)
        ], 1);
        const [a, b] = plans.map(plan => sample(plan));

        let closest = Infinity;
        for (const pointA of a) {
            for (const pointB of b) {
                closest = Math.min(closest, distance(pointA, pointB));
            }
        }
        // They share a tail ring and two distinct heads, so they are never disjoint at
        // the very start; what matters is that the bodies part company.
        const bodyA = a.slice(8);
        const bodyB = b.slice(8);
        let closestBody = Infinity;
        for (const pointA of bodyA) {
            for (const pointB of bodyB) {
                closestBody = Math.min(closestBody, distance(pointA, pointB));
            }
        }
        expect(closest).toBeLessThan(closestBody + 1e-9);
        expect(closestBody).toBeGreaterThan(4);
    });
});

describe("length", () => {
    it("extends an arrow too short to see, and does it by moving the TAIL", () => {
        const target = at("close", 0, 30);
        const [plan] = planAttackArrows(ORIGIN, [target], 1);

        expect(plan.length).toBeCloseTo(MIN_ARROW_PX, 6);
        // The head is untouched; it is the tail that has gone back past the source.
        expect(plan.tip.x).toBeCloseTo(target.x, 6);
        expect(plan.start.x).toBeLessThan(0);
    });

    it("never drags a tail far past the source, which is what would draw a star", () => {
        // Germany has eleven attackable neighbours. A generous pull-back sends every
        // one of those tails to the OPPOSITE side of Germany from its own target, and
        // eleven arrows crossing in the middle of the territory the player just clicked
        // is a star, not a fan.
        for (const chord of [1, 6, 12, 24]) {
            const [plan] = planAttackArrows(ORIGIN, [at("near", 0, chord)], 1);
            expect(-plan.start.x).toBeLessThanOrEqual(chord * 0.5 + 1e-9);
            expect(-plan.start.x).toBeLessThanOrEqual(MAX_TAIL_EXTENSION_PX + 1e-9);
        }
        // And past the cap the arrow is simply drawn short rather than stretched.
        expect(planAttackArrows(ORIGIN, [at("touching", 0, 1)], 1)[0].length)
            .toBeLessThan(MIN_ARROW_PX);
    });

    it("rings the tails inside the source, so a big territory fans them wider", () => {
        const targets = [at("t", 0, 400)];
        const island = planAttackArrows(ORIGIN, targets, 1, 0)[0];
        const continentSized = planAttackArrows(ORIGIN, targets, 1, 80)[0];
        expect(continentSized.start.x).toBeGreaterThan(island.start.x);
    });

    it("clamps the tail ring, so a huge source does not start its arrows out at sea", () => {
        const targets = [at("t", 0, 900)];
        const big = planAttackArrows(ORIGIN, targets, 1, 400)[0];
        const enormous = planAttackArrows(ORIGIN, targets, 1, 4000)[0];
        expect(enormous.start.x).toBeCloseTo(big.start.x, 6);
    });

    it("leaves a long arrow alone", () => {
        const [plan] = planAttackArrows(ORIGIN, [at("far", 0, 400)], 1);
        expect(plan.start.x).toBeGreaterThan(0);
        expect(plan.length).toBeLessThan(400);
        expect(plan.length).toBeGreaterThan(380);
    });

    it("never lets the tail ring eat a short arrow", () => {
        // The ring is sized from the SOURCE, so on a close pairing it would otherwise
        // be most of the distance to the target.
        const [plan] = planAttackArrows(ORIGIN, [at("near", 0, 20)], 1, 200);
        expect(plan.start.x).toBeLessThanOrEqual(20 * 0.35 + 1e-9);
    });

    it("needs no extension at all once the map is zoomed in", () => {
        // 12 user units is a smudge at zoom 1 and a real distance at zoom 6, where one
        // screen pixel covers a fifth as much ground.
        const target = at("close", 0, 12);
        const zoomedOut = planAttackArrows(ORIGIN, [target], 1)[0];
        const zoomedIn = planAttackArrows(ORIGIN, [target], 0.2)[0];

        expect(zoomedOut.start.x).toBeLessThan(0);
        expect(zoomedIn.start.x).toBeGreaterThan(0);
    });

    it("scales the shaft and head with the zoom, so both stay one size on screen", () => {
        const targets = [at("t", 0, 400)];
        const wide = planAttackArrows(ORIGIN, targets, 1)[0];
        const close = planAttackArrows(ORIGIN, targets, 0.25)[0];
        expect(close.strokeWidth).toBeCloseTo(wide.strokeWidth * 0.25, 10);
    });
});

describe("arrowHeadFor", () => {
    it("points the triangle along the curve's tangent at the tip", () => {
        const spine = arrowSpineFor(ORIGIN, { x: 300, y: 0 }, 0, 1);
        const head = arrowHeadFor(spine.control, spine.tip, 1);
        // Travelling due east: the tip is the easternmost point of the triangle.
        expect(head.points[0].x).toBeGreaterThan(head.points[1].x);
        expect(head.points[0].x).toBeGreaterThan(head.points[2].x);
        // and the base straddles the axis.
        expect(Math.sign(head.points[1].y)).toBe(-Math.sign(head.points[2].y));
    });

    it("stops the shaft short of the tip so the line does not show through", () => {
        const spine = arrowSpineFor(ORIGIN, { x: 300, y: 0 }, 0, 1);
        const head = arrowHeadFor(spine.control, spine.tip, 1);
        const setback = distance(head.shaftEnd, spine.tip);
        expect(setback).toBeGreaterThan(0);
        expect(setback).toBeLessThan(HEAD_LENGTH_PX);
    });
});

describe("bandFor", () => {
    it("runs one band at a time: the dash period is longer than the path", () => {
        const { band } = bandFor(500, 1);
        expect(band).toBeLessThan(500);
        expect(band).toBeGreaterThan(0);
    });

    it("travels from before the start to past the end", () => {
        const { band, from, to } = bandFor(500, 1);
        expect(from).toBe(band);
        expect(to).toBe(-500);
    });

    it("keeps the apparent speed the same on a long arrow and a short one", () => {
        // Both inside the clamps, which is where the derivation rather than a limit
        // is deciding the answer.
        const short = bandFor(120, 1);
        const long = bandFor(200, 1);
        const shortSpeed = (120 + short.band) / short.seconds;
        const longSpeed = (200 + long.band) / long.seconds;
        expect(shortSpeed).toBeCloseTo(longSpeed, 6);
    });

    it("clamps the cycle so a very long arrow's band does not crawl", () => {
        expect(bandFor(20000, 1).seconds).toBeLessThanOrEqual(2.6);
        expect(bandFor(1, 1).seconds).toBeGreaterThanOrEqual(0.55);
    });
});
