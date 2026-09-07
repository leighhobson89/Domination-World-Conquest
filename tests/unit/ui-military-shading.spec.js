// What the military map says, tested where it is cheap to test.
//
// Register item E1. The view has two halves: `militaryShading.js` decides what each territory
// is worth saying, and `militaryView.js` turns that into elements inside the map's own
// document. Everything worth asserting is in the first half, deliberately -- the alternative
// is reading a fill colour back through an `<object>` boundary in Playwright, which is slow,
// and which would pin the exact rgb triple a theme happens to produce.
//
// THE ONE BUG THIS FILE EXISTS TO CATCH is the expensive-call bound. `oddsFor()` plays out two
// hundred battles per uncached shape, and the whole design rests on it being asked once per
// PLAYER territory and never for anyone else's. That is invisible in the running game -- the
// map looks identical either way, it simply takes a hundred times longer to draw -- so it is
// counted here.

import { describe, expect, it } from "vitest";

import {
    FORCE_BAND_COUNT,
    THREAT_CRITICAL,
    THREAT_NONE,
    THREAT_WARNED,
    forceBandFor,
    mixColour,
    planMilitaryView,
    rampFor,
    threatBandFor
} from "../../src/ui/map/militaryShading.js";

/** A territory with only the fields the view reads. */
function territory(uniqueId, dataName, army) {
    return {
        uniqueId,
        territoryName: uniqueId,
        dataName,
        armyForCurrentTerritory: army
    };
}

/**
 * A tiny world: two of the player's provinces, one behind the other, and two enemies.
 *
 *     Enemy A -- Front -- Rear      Enemy B stands alone beside Enemy A
 *
 * `Rear` touches no enemy, which is the interior case; `Front` touches one.
 */
function world() {
    const enemyA = territory("a", "Redland", 1000);
    const enemyB = territory("b", "Redland", 4000);
    const front = territory("f", "Blueland", 500);
    const rear = territory("r", "Blueland", 10);

    const links = new Map([
        ["a", [front, enemyB]],
        ["b", [enemyA]],
        ["f", [enemyA, rear]],
        ["r", [front]]
    ]);

    return {
        territories: [enemyA, enemyB, front, rear],
        enemyNeighboursOf: (subject) =>
            links.get(subject.uniqueId).filter(other => other.dataName !== subject.dataName),
        isPlayerOwned: (subject) => subject.dataName === "Blueland"
    };
}

describe("the force bands", () => {
    it("puts a territory nothing can reach in the top band, whatever it holds", () => {
        //An interior province cannot be attacked, so it is secure by definition. This is what
        //makes the frontier draw itself, which is the whole point of the view.
        expect(forceBandFor(0, 0)).toBe(FORCE_BAND_COUNT - 1);
        expect(forceBandFor(9_000_000, 0)).toBe(FORCE_BAND_COUNT - 1);
    });

    it("puts an empty garrison facing an enemy in the bottom band", () => {
        expect(forceBandFor(0, 1)).toBe(0);
    });

    it("rises with the ratio and not with the army", () => {
        //The same band at a thousand men and at a million: the shade is a RATIO, which is the
        //decision the module exists to keep. An absolute scale paints China dark and says
        //nothing about whether its borders are held.
        expect(forceBandFor(1_000, 1_000)).toBe(forceBandFor(1_000_000, 1_000_000));
        expect(forceBandFor(100, 1_000)).toBeLessThan(forceBandFor(1_000, 1_000));
        expect(forceBandFor(1_000, 1_000)).toBeLessThan(forceBandFor(10_000, 1_000));
    });

    it("never leaves the ramp", () => {
        for (const [held, faced] of [[0, 5], [1, 1e9], [1e9, 1], [7, 7]]) {
            const band = forceBandFor(held, faced);
            expect(band).toBeGreaterThanOrEqual(0);
            expect(band).toBeLessThan(FORCE_BAND_COUNT);
        }
    });
});

describe("the threat bands", () => {
    it("marks nothing below the warning odds", () => {
        expect(threatBandFor(0)).toBe(THREAT_NONE);
        expect(threatBandFor(34.9)).toBe(THREAT_NONE);
    });

    it("warns in the middle and calls it critical at the top", () => {
        expect(threatBandFor(35)).toBe(THREAT_WARNED);
        expect(threatBandFor(59.9)).toBe(THREAT_WARNED);
        expect(threatBandFor(60)).toBe(THREAT_CRITICAL);
        expect(threatBandFor(100)).toBe(THREAT_CRITICAL);
    });
});

describe("the plan", () => {
    it("asks for the odds once per player territory and never for anybody else's", () => {
        const asked = [];
        planMilitaryView({
            ...world(),
            oddsFor: (attacker, defender) => {
                asked.push(defender.uniqueId + " <- " + attacker.uniqueId);
                return 0;
            }
        });

        //`Front` is the only player territory with an enemy beside it. `Rear` has none, so
        //there is no pairing to forecast; the two enemy provinces are not the player's and are
        //never asked about, however they stand against each other.
        expect(asked).toEqual(["f <- a"]);
    });

    it("takes the odds against the STRONGEST thing that can reach the territory", () => {
        const enemyA = territory("a", "Redland", 1000);
        const enemyB = territory("b", "Redland", 9000);
        const front = territory("f", "Blueland", 500);
        const asked = [];

        planMilitaryView({
            territories: [enemyA, enemyB, front],
            enemyNeighboursOf: (subject) => (subject.uniqueId === "f" ? [enemyA, enemyB] : [front]),
            isPlayerOwned: (subject) => subject.dataName === "Blueland",
            oddsFor: (attacker) => {
                asked.push(attacker.uniqueId);
                return 70;
            }
        });

        expect(asked).toEqual(["b"]);
    });

    it("marks a border the model says would fall, and leaves the rest alone", () => {
        const plan = planMilitaryView({ ...world(), oddsFor: () => 88 });

        expect(plan.get("f").threat).toBe(THREAT_CRITICAL);
        //The interior province is not marked: nothing can reach it, so there is no border to
        //warn about however thin it is held.
        expect(plan.get("r").threat).toBe(THREAT_NONE);
        //And the enemy's own soft borders are not the player's warning to read.
        expect(plan.get("a").threat).toBe(THREAT_NONE);
    });

    it("warns nobody when there is no player, which is spectator mode", () => {
        const plan = planMilitaryView({
            ...world(),
            isPlayerOwned: () => false,
            oddsFor: () => 99
        });

        for (const entry of plan.values()) {
            expect(entry.threat).toBe(THREAT_NONE);
        }
        //The shading still means something with nobody playing -- it is a ratio between two
        //countries, and neither of them has to be the player.
        expect(plan.get("f").band).toBeLessThan(plan.get("r").band);
    });

    it("carries every territory's force, and leaves the drawing to the view", () => {
        const plan = planMilitaryView({ ...world(), oddsFor: () => 0 });

        //Which territories a figure is DRAWN on is decided at render time, from whether the
        //territory is big enough on screen to hold one -- so the plan reports the force for
        //all of them and chooses none. It used to hand back a subset (the player's land and
        //its neighbours), and a subset is a decision about what the player may compare; the
        //zoom is the better filter, because the player controls it.
        expect([...plan.values()].map(entry => entry.force)).toEqual([1000, 4000, 500, 10]);
    });

    it("keys on the uniqueId as a string, which is what a path attribute gives back", () => {
        const plan = planMilitaryView({
            territories: [territory(7, "Redland", 10)],
            enemyNeighboursOf: () => [],
            isPlayerOwned: () => false
        });

        //`path.getAttribute("uniqueid")` is a string and the store keys on `String(uniqueId)`.
        //A numeric key here would miss every lookup and the view would silently draw nothing.
        expect(plan.has("7")).toBe(true);
    });
});

describe("the ramp", () => {
    it("runs from the weak colour to the strong one, inclusive", () => {
        const ramp = rampFor({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 40 });

        expect(ramp).toHaveLength(FORCE_BAND_COUNT);
        expect(ramp[0]).toBe("rgb(0,0,0)");
        expect(ramp[FORCE_BAND_COUNT - 1]).toBe("rgb(100,200,40)");
    });

    it("clamps a mix rather than walking off either end", () => {
        const weak = { r: 10, g: 10, b: 10 };
        const strong = { r: 20, g: 20, b: 20 };

        expect(mixColour(weak, strong, -5)).toEqual(weak);
        expect(mixColour(weak, strong, 5)).toEqual(strong);
    });
});
