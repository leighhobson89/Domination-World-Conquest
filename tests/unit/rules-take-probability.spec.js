// rules/military/takeProbability.js -- combat phase stage 1, closing known-issue C1.
//
// The claim this file has to hold up is not "the number looks reasonable". It is that the
// figure the AI decides on IS the dice model's own answer, and that the cache which makes it
// affordable does not change it. So the tests are of two kinds:
//
//   AGREEMENT   `takeProbability()` against `battleForecast()` at full trials, over a grid of
//               real shapes. The phase gate asks for +/-10 points; these assert it.
//   INVARIANCE  the cache key is (share, dice change, both face modifiers, small-count
//               signature). That is only sound if two setups agreeing on those play out the
//               same battle, and the second block is where the argument is checked rather
//               than assumed -- with EXPLICIT SEEDS, so it tests the model and not the cache.
//
// The invariance block exists because the first version of the argument was wrong. It held
// that composition survives attrition proportionally, so the face modifiers are constant
// through a battle. That is true of large counts and false of small ones: a side holding one
// air unit loses it to the integer casualty floor in the first round and its air superiority
// with it. Measured, two setups differing only in that scaling came out 41.6 points apart.
// `EXACT_COUNT_BELOW` is the answer and these are the tests that would have caught it.
//
// There is no test that `winProbability()` and `takeProbability()` are close, because they are
// not, and the whole phase is about that: see `docs/05-combat-and-conquest-audit.md` section
// 4.1, where the gap runs +95 to -77 points and changes sign on fortification.

import { beforeEach, describe, expect, it } from "vitest";

import {
    TAKE_PROBABILITY_TRIALS,
    clearTakeProbabilityCache,
    takeProbability,
    takeProbabilityCacheStats
} from "../../src/rules/military/takeProbability.js";
import { battleForecast } from "../../src/rules/military/forecast.js";
import { defenseMultiplierFor } from "../../src/rules/military/probability.js";

/** A featureless territory, so a case shows the effect it is about and nothing else. */
function territory(overrides = {}) {
    return {
        uniqueId: "spec",
        territoryName: "Spec",
        area: 120000,
        defenseBonus: 0,
        mountainDefenseBonus: 0,
        isCoastal: false,
        continent: "Nowhere",
        fortsBuilt: 0,
        ...overrides
    };
}

const NEUTRAL = { attackingDevelopmentIndex: 1, combatContinentModifier: 1 };
const infantry = (count) => [count, 0, 0, 0];

/** The model's own answer, at full trials and a stated seed. */
function forecast(attackers, defenders, place, seed) {
    return battleForecast(
        { attackers, defenders, territory: place, context: NEUTRAL },
        { trials: 500, seed }).takeProbability * 100;
}

describe("takeProbability -- agreement with the model it is quoting", () => {
    beforeEach(clearTakeProbabilityCache);

    const cases = [
        ["hopeless 1:4", infantry(100000), infantry(400000), territory()],
        ["outmatched 1:2", infantry(200000), infantry(400000), territory()],
        ["even 1:1", infantry(400000), infantry(400000), territory()],
        ["favoured 1.5:1", infantry(600000), infantry(400000), territory()],
        ["strong 2:1", infantry(800000), infantry(400000), territory()],
        ["overwhelming 5:1", infantry(2000000), infantry(400000), territory()],
        ["2:1 into mountains", infantry(800000), infantry(400000),
            territory({ mountainDefenseBonus: 30 })],
        ["4:1 into a fortress", infantry(1600000), infantry(400000),
            territory({ defenseBonus: 224, mountainDefenseBonus: 30, fortsBuilt: 5 })],
        ["combined arms 1:1", [200000, 1000, 200, 50], infantry(400000), territory()],
        ["no armour 1:1", infantry(400000), [300000, 1000, 0, 0], territory()],
        ["naval landing", [200000, 0, 0, 100], infantry(400000), territory({ isCoastal: true })]
    ];

    for (const [label, attackers, defenders, place] of cases) {
        it("agrees with battleForecast within 10 points -- " + label, () => {
            const mine = takeProbability(attackers, defenders, place, NEUTRAL);
            const theirs = battleForecast(
                { attackers, defenders, territory: place, context: NEUTRAL },
                { trials: 500 }).takeProbability * 100;
            expect(Math.abs(mine - theirs)).toBeLessThanOrEqual(10);
        });
    }

    it("is a percentage, not a fraction", () => {
        const answer = takeProbability(infantry(2000000), infantry(100000), territory(), NEUTRAL);
        expect(answer).toBeGreaterThan(50);
        expect(answer).toBeLessThanOrEqual(100);
    });

    it("resolves the two settled cases rather than sampling them", () => {
        expect(takeProbability(infantry(0), infantry(400000), territory(), NEUTRAL)).toBe(0);
        expect(takeProbability(infantry(400000), infantry(0), territory(), NEUTRAL)).toBe(100);
    });

    it("never falls materially as the attacker sends more", () => {
        //Not strict monotonicity: 200 trials carries a few points of sampling error and the
        //model is a step function, so adjacent rungs can tie. What must not happen is a real
        //inversion, which would make `sizeCommitment()`'s ladder stop at the wrong rung.
        const place = territory({ mountainDefenseBonus: 20 });
        let best = -1;
        for (const force of [100000, 200000, 400000, 800000, 1600000, 3200000]) {
            const answer = takeProbability(infantry(force), infantry(400000), place, NEUTRAL);
            expect(answer).toBeGreaterThanOrEqual(best - 6);
            best = Math.max(best, answer);
        }
    });
});

describe("takeProbability -- the model really is scale-free above the floor", () => {
    //These assert the PROPERTY the cache key relies on, using the real forecast at a fixed
    //seed. They would still be true with the cache deleted, which is the point: if one of
    //them fails, the key is unsound and the cache is answering one battle with another's
    //number.
    it("gives an identical answer at any scale from 2,000 upward", () => {
        const place = territory({ mountainDefenseBonus: 30 });
        const answers = [2000, 20000, 200000, 2000000].map(
            (defenders) => forecast(infantry(defenders * 1.5), infantry(defenders), place, 12345));
        expect(new Set(answers).size).toBe(1);
    });

    it("does NOT hold when a unit type is small enough to be floored away", () => {
        //The measurement that corrected the design: one air unit dies in the first round and
        //takes air superiority with it; a thousand does not. If this ever starts passing as an
        //equality, `EXACT_COUNT_BELOW` has become unnecessary and can be reconsidered.
        const place = territory({ mountainDefenseBonus: 30 });
        const tiny = forecast([300000, 1, 1, 1], [200000, 1, 0, 0], place, 77);
        const scaled = forecast(
            [300000000, 1000, 1000, 1000], [200000000, 1000, 0, 0], place, 77);
        expect(Math.abs(tiny - scaled)).toBeGreaterThan(10);
    });
});

describe("takeProbability -- the cache", () => {
    beforeEach(clearTakeProbabilityCache);

    it("reuses a cell rather than re-forecasting it", () => {
        takeProbability(infantry(800000), infantry(400000), territory(), NEUTRAL);
        expect(takeProbabilityCacheStats().misses).toBe(1);
        takeProbability(infantry(800000), infantry(400000), territory(), NEUTRAL);
        expect(takeProbabilityCacheStats()).toMatchObject({ misses: 1, hits: 1 });
    });

    it("answers the same cell for the same ratio at a different scale", () => {
        const small = takeProbability(infantry(300000), infantry(200000), territory(), NEUTRAL);
        const large = takeProbability(infantry(3000000), infantry(2000000), territory(), NEUTRAL);
        expect(large).toBe(small);
        expect(takeProbabilityCacheStats()).toMatchObject({ cells: 1, hits: 1 });
    });

    it("does not share a cell between different fortifications", () => {
        const open = takeProbability(infantry(800000), infantry(400000), territory(), NEUTRAL);
        const walled = takeProbability(infantry(800000), infantry(400000),
            territory({ defenseBonus: 224, mountainDefenseBonus: 30, fortsBuilt: 5 }), NEUTRAL);
        expect(takeProbabilityCacheStats().cells).toBe(2);
        expect(open).toBeGreaterThan(walled);
    });

    it("does not share a cell between armies whose small counts differ", () => {
        //Same share to within a bucket, same terrain; one air unit against two. Without the
        //count signature these collapse into one cell and the answers drift by tens of points.
        takeProbability([400000, 0, 1, 0], infantry(400000), territory(), NEUTRAL);
        takeProbability([400000, 0, 2, 0], infantry(400000), territory(), NEUTRAL);
        expect(takeProbabilityCacheStats().cells).toBe(2);
    });

    it("collapses large counts to one cell, so the cache does not explode", () => {
        //500 and 501, not 500 and 900: a vehicle carries a lot of personnel worth, so a big
        //change in the COUNT is also a big change in the combined force and therefore in the
        //share, which is a different cell for a legitimate reason. What is asserted here is
        //only that the count SIGNATURE stops distinguishing them once both are past
        //`EXACT_COUNT_BELOW`.
        takeProbability([400000, 0, 500, 0], infantry(400000), territory(), NEUTRAL);
        takeProbability([400000, 0, 501, 0], infantry(400000), territory(), NEUTRAL);
        expect(takeProbabilityCacheStats()).toMatchObject({ cells: 1, hits: 1 });
    });

    it("refuses to cache a battle small enough for the casualty floor to bite", () => {
        takeProbability(infantry(150), infantry(100), territory(), NEUTRAL);
        expect(takeProbabilityCacheStats()).toMatchObject({ uncacheable: 1, cells: 0 });
    });

    it("states its trial count, so a caller can reason about the error", () => {
        expect(TAKE_PROBABILITY_TRIALS).toBeGreaterThanOrEqual(100);
    });
});

describe("defenseMultiplierFor -- known-issue C2", () => {
    it("defends at face value with no forts, no mountains and no land-locked bonus", () => {
        //Its own comment promises exactly this. `Math.ceil(0 / 15)` is 0, which multiplied the
        //defending strength by nothing and made `winProbability()` report 100% against any
        //garrison at all. Latent on the shipped map -- every territory has a mountain factor of
        //at least 1 -- and reachable from a scenario or a map edit.
        expect(defenseMultiplierFor({ defenseBonus: 0, mountainDefenseBonus: 0 })).toBe(1);
    });

    it("still makes a single fort matter, because the multiplier is a ceiling", () => {
        expect(defenseMultiplierFor({ defenseBonus: 1, mountainDefenseBonus: 0 })).toBe(1);
        expect(defenseMultiplierFor({ defenseBonus: 20, mountainDefenseBonus: 0 })).toBe(2);
        expect(defenseMultiplierFor({ defenseBonus: 0, mountainDefenseBonus: 30 })).toBe(2);
        expect(defenseMultiplierFor({ defenseBonus: 224, mountainDefenseBonus: 30 })).toBe(17);
    });
});
