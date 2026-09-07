// src/rules/military/forecast.js -- battle overhaul B.2.
//
// The number the attack screen shows. Two properties matter more than the figure itself:
// it must be STABLE for a given allocation, and it must not touch the game's random stream.
// Both are tested here, because both are the kind of thing that fails silently and only shows
// up as "two runs of the same seed diverged" a hundred turns later.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { battleForecast, forecastSeedFor, FORECAST_TRIALS } from "../../src/rules/military/forecast.js";
import { BattleState } from "../../src/rules/military/battleModel.js";

function territory(overrides = {}) {
    return {
        uniqueId: "t1",
        territoryName: "Testland",
        area: 350000,
        defenseBonus: 0,
        mountainDefenseBonus: 0,
        isCoastal: false,
        continent: "Nowhere",
        ...overrides
    };
}

/**
 * The MEDIAN real attacker, not an idealised one -- combat stage 3.
 *
 * This used to be `{ attackingDevelopmentIndex: 1, combatContinentModifier: 1 }`, which is an
 * attacker that does not exist: development index tops out at 0.962 (Monaco) and the friendliest
 * continent modifier is 0.99 (North America), so the strongest attacker on the map is 0.95 and
 * the median over all 1,888 adjacent enemy pairings is 0.648. Measured with
 * `node tools/combat-lab.mjs terrain`.
 *
 * It mattered because "an even fight favours the defender" -- the design claim of
 * docs/archived/battle_overhaul.md section 4.3 -- was being asserted about a country that could
 * never take the field. For the attackers who actually exist it was not merely untrue, it was
 * untrue by a mile: at x0.63 the median attacker LOST an even fight overwhelmingly, which is
 * known-issue G2. `DICE_ATTACK_ADVANTAGE` is 1.54 now precisely so that 0.648 x 1.54 = 1.00, and
 * the claim holds where it means something.
 */
const MEDIAN_REAL_ATTACKER = Object.freeze({
    attackingDevelopmentIndex: 0.745,
    combatContinentModifier: 0.87
});

const evenFight = () => ({
    attackers: [400000, 0, 0, 0],
    defenders: [400000, 0, 0, 0],
    territory: territory(),
    context: { ...MEDIAN_REAL_ATTACKER }
});

describe("forecastSeedFor", () => {
    it("is stable for the same setup", () => {
        expect(forecastSeedFor(evenFight())).toBe(forecastSeedFor(evenFight()));
    });

    it("changes when the allocation changes", () => {
        const more = { ...evenFight(), attackers: [400001, 0, 0, 0] };
        expect(forecastSeedFor(more)).not.toBe(forecastSeedFor(evenFight()));
    });

    it("notices a change in a high byte of a large army", () => {
        // Folding only the low byte would collide here, and two visibly different allocations
        // would forecast identically.
        const a = { ...evenFight(), attackers: [400000, 0, 0, 0] };
        const b = { ...evenFight(), attackers: [400256, 0, 0, 0] };
        expect(forecastSeedFor(a)).not.toBe(forecastSeedFor(b));
    });

    it("notices the territory's defences", () => {
        const bare = evenFight();
        const fortified = { ...bare, territory: territory({ defenseBonus: 120 }) };
        expect(forecastSeedFor(fortified)).not.toBe(forecastSeedFor(bare));
    });

    it("ignores things the model does not read", () => {
        // Two identical fights on differently NAMED territories must forecast the same.
        const a = { ...evenFight(), territory: territory({ territoryName: "Aland" }) };
        const b = { ...evenFight(), territory: territory({ territoryName: "Bland" }) };
        expect(forecastSeedFor(a)).toBe(forecastSeedFor(b));
    });
});

describe("battleForecast", () => {
    it("is stable across calls -- the figure does not flicker as the player allocates", () => {
        const first = battleForecast(evenFight(), { trials: 200 });
        const second = battleForecast(evenFight(), { trials: 200 });
        expect(second.takeProbability).toBe(first.takeProbability);
        expect(second.medianRounds).toBe(first.medianRounds);
        expect(second.expectedSurvivors).toBe(first.expectedSurvivors);
    });

    it("does not draw from Math.random", () => {
        // The attack window recomputes this on every plus and minus press. On the game's stream
        // that would make the eventual battle depend on how many times the player nudged the
        // allocation -- the same class of defect as audit 5.3 Y.
        const spy = vi.spyOn(Math, "random");
        battleForecast(evenFight(), { trials: 50 });
        expect(spy).not.toHaveBeenCalled();
    });

    it("reports a probability between zero and one", () => {
        const forecast = battleForecast(evenFight(), { trials: 200 });
        expect(forecast.takeProbability).toBeGreaterThanOrEqual(0);
        expect(forecast.takeProbability).toBeLessThanOrEqual(1);
    });

    it("counts every trial into exactly one outcome", () => {
        const forecast = battleForecast(evenFight(), { trials: 300 });
        const counted = Object.values(forecast.outcomes).reduce((sum, n) => sum + n, 0);
        expect(counted).toBe(300);
    });

    it("is near-certain for an overwhelming attacker and hopeless for a doomed one", () => {
        const overwhelming = battleForecast({
            ...evenFight(),
            attackers: [4000000, 0, 0, 0]
        }, { trials: 300 });
        expect(overwhelming.takeProbability).toBeGreaterThan(0.95);

        const doomed = battleForecast({
            ...evenFight(),
            attackers: [40000, 0, 0, 0]
        }, { trials: 300 });
        expect(doomed.takeProbability).toBeLessThan(0.05);
    });

    it("says an even attack is a losing proposition", () => {
        // The design claim of docs/archived/battle_overhaul.md section 4.3, as a test: at equal force,
        // no terrain and no composition edge, the defender's tie advantage decides it.
        // Asserted about the MEDIAN REAL ATTACKER -- see the note on that constant for why the
        // idealised one this used to use made the claim unfalsifiable in the wrong direction.
        const forecast = battleForecast(evenFight(), { trials: 1000 });
        expect(forecast.takeProbability).toBeLessThan(0.5);
    });

    it("makes a fortress meaningfully harder than open ground", () => {
        const open = battleForecast({ ...evenFight(), attackers: [800000, 0, 0, 0] }, { trials: 500 });
        const fortress = battleForecast({
            ...evenFight(),
            attackers: [800000, 0, 0, 0],
            territory: territory({ defenseBonus: 120 })
        }, { trials: 500 });
        expect(fortress.takeProbability).toBeLessThan(open.takeProbability);
    });

    it("never reports a stalemate -- the round cap is a bug detector, not a balance number", () => {
        for (const attackers of [[100000, 0, 0, 0], [400000, 0, 0, 0], [2000000, 0, 0, 0]]) {
            const forecast = battleForecast({ ...evenFight(), attackers }, { trials: 300 });
            expect(forecast.outcomes[BattleState.STALEMATE]).toBe(0);
            expect(forecast.stalemateRate).toBe(0);
        }
    });

    it("reports rounds as a range, because the distribution is skewed", () => {
        const forecast = battleForecast(evenFight(), { trials: 500 });
        expect(forecast.roundsRange[0]).toBeLessThanOrEqual(forecast.medianRounds);
        expect(forecast.roundsRange[1]).toBeGreaterThanOrEqual(forecast.medianRounds);
    });

    it("defaults to enough trials for the figure to be steady", () => {
        expect(FORECAST_TRIALS).toBeGreaterThanOrEqual(200);
    });
});
