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

const evenFight = () => ({
    attackers: [400000, 0, 0, 0],
    defenders: [400000, 0, 0, 0],
    territory: territory(),
    context: { attackingDevelopmentIndex: 1, combatContinentModifier: 1 }
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
        // The design claim of docs/battle_overhaul.md section 4.3, as a test: at equal force,
        // no terrain and no composition edge, the defender's tie advantage decides it.
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
