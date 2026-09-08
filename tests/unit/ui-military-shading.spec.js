// What the military map says, tested where it is cheap to test.
//
// Register item E1. The view has two halves: `militaryShading.js` decides what each territory
// is worth saying, and `militaryView.js` turns that into elements inside the map's own
// document. Everything worth asserting is in the first half, deliberately -- the alternative
// is reading a fill colour back through an `<object>` boundary in Playwright, which is slow,
// and which would pin the exact rgb triple a theme happens to produce.
//
// THE ONE BUG THIS FILE EXISTS TO CATCH is the expensive-call bound. `oddsFor()` plays out two
// hundred battles per uncached shape, and the whole design rests on it being asked only about
// CREDIBLE PAIRINGS ON THE PLAYER'S OWN FRONTIER -- never for anyone else's land, and never for
// a neighbour too weak to reach the warning band. That is invisible in the running game -- the
// map looks identical either way, it simply takes a hundred times longer to draw -- so it is
// counted here.

import { describe, expect, it } from "vitest";

import {
    FORCE_BAND_COUNT,
    THREAT_CANDIDATE_RATIO,
    THREAT_CRITICAL,
    THREAT_CRITICAL_ODDS,
    THREAT_NONE,
    THREAT_WARNED,
    THREAT_WARNED_ODDS,
    forceBandFor,
    mixColour,
    planMilitaryView,
    rampFor,
    threatBandFor,
    threatCandidatesFor
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
        expect(threatBandFor(THREAT_WARNED_ODDS - 0.1)).toBe(THREAT_NONE);
    });

    it("warns in the middle and calls it critical at the top", () => {
        expect(threatBandFor(THREAT_WARNED_ODDS)).toBe(THREAT_WARNED);
        expect(threatBandFor(THREAT_CRITICAL_ODDS - 0.1)).toBe(THREAT_WARNED);
        expect(threatBandFor(THREAT_CRITICAL_ODDS)).toBe(THREAT_CRITICAL);
        expect(threatBandFor(100)).toBe(THREAT_CRITICAL);
    });

    it("keeps the warning band wide enough to fire on the real map", () => {
        //THE MEASUREMENT BEHIND THESE TWO NUMBERS, pinned so that a later tuning pass has to
        //argue with it. At 35/60 the amber band was 14% wide in force ratio on open ground and
        //6% behind one fort -- a neighbour had to land inside a few per cent for a border to be
        //marked amber at all, so in a real game a border went from unmarked to red with nothing
        //in between. That is the cliff and not a bad threshold, and widening the band is the
        //only answer available from here: at 15/45 amber opens at 0.90:1 and red at 1.24:1, so
        //amber means "this border is roughly even" -- and parity loses the province 24.3% of
        //the time.
        expect(THREAT_WARNED_ODDS).toBeLessThanOrEqual(20);
        expect(THREAT_CRITICAL_ODDS - THREAT_WARNED_ODDS).toBeGreaterThanOrEqual(25);
    });
});

describe("the plan", () => {
    it("asks for the odds only on the player's own frontier", () => {
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

    it("asks about EVERY neighbour that could take the territory, strongest first", () => {
        //THE BUG THIS REPLACED. It used to ask about the strongest neighbour and nobody else,
        //so a province threatened from two directions was marked on one border and drawn
        //clean on the other -- which says *that one is safe* about a border that is not.
        //Leigh found it playing Canada: the United States is marked along the 49th parallel
        //and Alaska, no less dangerous, was left unmarked.
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

        expect(asked).toEqual(["b", "a"]);
    });

    it("lists a threat per neighbour, worst ODDS first rather than largest army first", () => {
        //The order is by the forecast and not by the headcount, because a smaller neighbour on
        //better ground is the more dangerous one -- which is the whole reason the mark is a
        //forecast rather than a second force comparison.
        const big = territory("b", "Redland", 9000);
        const small = territory("s", "Greenland", 1000);
        const front = territory("f", "Blueland", 500);

        const plan = planMilitaryView({
            territories: [big, small, front],
            enemyNeighboursOf: (subject) => (subject.uniqueId === "f" ? [big, small] : [front]),
            isPlayerOwned: (subject) => subject.dataName === "Blueland",
            oddsFor: (attacker) => (attacker.uniqueId === "s" ? 90 : 40)
        });

        const entry = plan.get("f");
        expect(entry.threats.map(threat => threat.id)).toEqual(["s", "b"]);
        expect(entry.threats.map(threat => threat.threat))
            .toEqual([THREAT_CRITICAL, THREAT_WARNED]);
        expect(entry.threats[0].country).toBe("Greenland");
        //The single figures describe the WORST of them, for a caller with room for one answer.
        expect(entry.threat).toBe(THREAT_CRITICAL);
        expect(entry.odds).toBe(90);
        //And the SHADE is still measured against the strongest ARMY that can reach it, which is
        //a different question and a different neighbour.
        expect(entry.faced).toBe(9000);
        expect(entry.facedId).toBe("b");
    });

    it("leaves an unthreatening neighbour out of the list rather than marking it none", () => {
        const plan = planMilitaryView({ ...world(), oddsFor: () => 10 });

        expect(plan.get("f").threats).toEqual([]);
        expect(plan.get("f").threat).toBe(THREAT_NONE);
    });

    it("never forecasts a neighbour too weak to reach the warning band", () => {
        //The bound that makes a call per PAIRING affordable. A real take probability at raw
        //parity is 24.3% and at 0.35:1 it is zero, so a neighbour well under the garrison
        //cannot reach 35% whatever it is made of -- and terrain and forts only lower it
        //further. Skipping those is what keeps a frontier province at one or two forecasts.
        const strong = territory("b", "Redland", 1000);
        const weak = territory("w", "Redland", 100);
        const front = territory("f", "Blueland", 1000);
        const asked = [];

        planMilitaryView({
            territories: [strong, weak, front],
            enemyNeighboursOf: (subject) => (subject.uniqueId === "f" ? [strong, weak] : [front]),
            isPlayerOwned: (subject) => subject.dataName === "Blueland",
            oddsFor: (attacker) => {
                asked.push(attacker.uniqueId);
                return 99;
            }
        });

        expect(asked).toEqual(["b"]);
    });

    it("keeps every neighbour of an EMPTY garrison, because anything can take it", () => {
        const attacker = territory("a", "Redland", 1);
        const empty = territory("f", "Blueland", 0);

        expect(threatCandidatesFor([attacker], 0)).toEqual([attacker]);
        expect(threatCandidatesFor([attacker], empty.armyForCurrentTerritory)).toHaveLength(1);
        //And an unarmed neighbour is never a candidate, whatever the garrison is.
        expect(threatCandidatesFor([territory("z", "Redland", 0)], 0)).toEqual([]);
        //The constant is a wide margin under parity, not a tuning knob near it.
        expect(THREAT_CANDIDATE_RATIO).toBeLessThan(1);
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

    it("marks the player's land and everything touching it as the frontier", () => {
        //WHAT THE FIGURES ARE DRAWN ON. 359 numbers is a great deal of ink for a question about
        //your own border, so the figures are the frontier's: the player's territories and every
        //enemy territory that touches one. Nothing is hidden by it -- the shade still covers the
        //whole world and the tooltip still answers for any territory under the pointer.
        const plan = planMilitaryView({ ...world(), oddsFor: () => 0 });

        //`Front` and `Rear` are the player's; `Enemy A` touches `Front`.
        expect(plan.get("f").frontier).toBe(true);
        expect(plan.get("r").frontier).toBe(true);
        expect(plan.get("a").frontier).toBe(true);
        //`Enemy B` stands behind `Enemy A` and touches nothing of the player's.
        expect(plan.get("b").frontier).toBe(false);
    });

    it("treats the whole world as frontier when there is no player at all", () => {
        //Spectator mode. A military map with no figures anywhere would say less than the view
        //it replaced, and there is no frontier to draw around nobody.
        const plan = planMilitaryView({
            ...world(),
            isPlayerOwned: () => false,
            oddsFor: () => 0
        });

        for (const entry of plan.values()) {
            expect(entry.frontier).toBe(true);
        }
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
