// src/ai/siegeReview.js -- what a besieging country does about a siege it already has.
//
// The gap this closes: a siege was fire-and-forget. The rules ticked it every turn (a hit
// roll, building damage, the starve-out) but the country that laid it never looked at it
// again. `siegesRunBy()` counted them, the count shrank next turn's siege budget, and that
// was the whole of the AI's relationship with an army it had parked in front of a wall. So
// nothing happened between the turn a siege opened and the turn it starved out or was
// arrested -- and nothing about it appeared in the plan, which is how it was noticed.
//
// The reviewer answers one question per siege, every turn: press on, storm it, or go home.
// Pure, like the rest of `src/ai/` -- it takes the siege's own snapshots, the territory as
// it now stands and the odds an assault would face, and returns a verdict and a reason.

import { describe, expect, it } from "vitest";

import {
    reviewSiege,
    siegeProgress,
    SiegeVerdict
} from "../../src/ai/siegeReview.js";
import { Posture } from "../../src/ai/strategy.js";
import { siegeReview as tuning } from "../../src/config/balance.js";

/** A garrison at full strength, and the siege snapshot that matches it. */
function untouched(overrides = {}) {
    return {
        target: {
            territoryName: "Valletta",
            dataName: "Melita",
            continent: "Europe",
            owner: "Melita",
            territoryPopulation: 1000,
            foodCapacity: 500,
            productiveTerritoryPop: 400,
            defenseBonus: 20,
            fortsBuilt: 2,
            ...overrides.target
        },
        siege: {
            warId: 1,
            attackingCountry: "Alba",
            attackingTerritory: "Argyll",
            turnsInSiege: 1,
            startingTerritoryPop: 1000,
            startingFoodCapacity: 500,
            startingProdPop: 400,
            startingDefenseBonus: 20,
            attackingArmyRemaining: [800, 0, 0, 0],
            defendingArmyRemaining: [400, 0, 0, 0],
            ...overrides.siege
        },
        campaign: {
            country: "Alba",
            posture: Posture.EXPAND,
            attackOddsFloor: 34,
            siegeOddsFloor: 22,
            ...overrides.campaign
        },
        traits: { style_of_war: 0.5, ...overrides.traits },
        assaultOdds: overrides.assaultOdds ?? 20
    };
}

/** The same siege, worn down by `fraction` of everything the reviewer measures. */
function wornDown(fraction, overrides = {}) {
    const input = untouched(overrides);
    input.target.territoryPopulation = input.siege.startingTerritoryPop * (1 - fraction);
    input.target.foodCapacity = input.siege.startingFoodCapacity * (1 - fraction);
    input.target.productiveTerritoryPop = input.siege.startingProdPop * (1 - fraction);
    input.target.defenseBonus = input.siege.startingDefenseBonus * (1 - fraction);
    return input;
}

describe("siegeProgress", () => {
    it("is zero for a territory the siege has not touched yet", () => {
        const { siege, target } = untouched();
        expect(siegeProgress(siege, target)).toBe(0);
    });

    it("is one for a territory with nothing left", () => {
        const { siege, target } = wornDown(1);
        expect(siegeProgress(siege, target)).toBe(1);
    });

    it("reports the fraction worn away", () => {
        const { siege, target } = wornDown(0.4);
        expect(siegeProgress(siege, target)).toBeCloseTo(0.4, 5);
    });

    it("never goes negative when a besieged territory somehow grows", () => {
        const { siege, target } = untouched();
        target.territoryPopulation = siege.startingTerritoryPop * 2;
        expect(siegeProgress(siege, target)).toBeGreaterThanOrEqual(0);
    });

    it("treats a zero starting value as nothing to wear down rather than dividing by it", () => {
        const { siege, target } = untouched();
        siege.startingDefenseBonus = 0;
        target.defenseBonus = 0;
        expect(Number.isFinite(siegeProgress(siege, target))).toBe(true);
    });
});

describe("reviewSiege", () => {
    it("presses on early in a siege that is doing its job", () => {
        const review = reviewSiege(wornDown(0.2, { siege: { turnsInSiege: 2 } }));
        expect(review.verdict).toBe(SiegeVerdict.PRESS);
        expect(review.reason).toMatch(/\d/);
    });

    it("storms once the odds clear the attack floor by the assault margin", () => {
        const review = reviewSiege(wornDown(0.5, {
            siege: { turnsInSiege: 3 },
            assaultOdds: 34 + tuning.assaultOddsMargin + 5
        }));
        expect(review.verdict).toBe(SiegeVerdict.ASSAULT);
    });

    it("does not storm on odds that merely clear the floor", () => {
        const review = reviewSiege(wornDown(0.5, {
            siege: { turnsInSiege: 3 },
            assaultOdds: 35
        }));
        expect(review.verdict).toBe(SiegeVerdict.PRESS);
    });

    it("holds rather than storming when the defender is all but starved out", () => {
        //Nothing is worth risking an army on when the territory falls by itself next turn.
        const review = reviewSiege(wornDown(0.95, {
            siege: { turnsInSiege: 6 },
            assaultOdds: 90
        }));
        expect(review.verdict).toBe(SiegeVerdict.PRESS);
    });

    it("goes home from a siege that has achieved nothing for long enough", () => {
        const review = reviewSiege(wornDown(0.02, {
            siege: { turnsInSiege: tuning.basePatienceTurns + tuning.patienceSwing + 1 }
        }));
        expect(review.verdict).toBe(SiegeVerdict.LIFT);
    });

    it("gives a siege-minded leader longer to make it work than an impatient one", () => {
        //Odds above the siege floor, so the only thing separating these two is patience --
        //below it they would both be abandoned as hopeless and the trait would not show.
        const turns = tuning.basePatienceTurns + 1;
        const patient = reviewSiege(wornDown(0.02, {
            siege: { turnsInSiege: turns },
            traits: { style_of_war: 0 },
            assaultOdds: 25
        }));
        const impatient = reviewSiege(wornDown(0.02, {
            siege: { turnsInSiege: turns },
            traits: { style_of_war: 1 },
            assaultOdds: 25
        }));
        expect(patient.verdict).toBe(SiegeVerdict.PRESS);
        expect(impatient.verdict).toBe(SiegeVerdict.LIFT);
    });

    it("recalls the army early when the country itself is under pressure", () => {
        const review = reviewSiege(wornDown(0.05, {
            siege: { turnsInSiege: tuning.defendRecallTurns },
            campaign: { posture: Posture.DEFEND }
        }));
        expect(review.verdict).toBe(SiegeVerdict.LIFT);
        expect(review.reason).toMatch(/defend/i);
    });

    it("does not recall from a siege that is nearly won, even while defending", () => {
        const review = reviewSiege(wornDown(0.9, {
            siege: { turnsInSiege: 8 },
            campaign: { posture: Posture.DEFEND }
        }));
        expect(review.verdict).toBe(SiegeVerdict.PRESS);
    });

    it("goes home when the garrison now outguns the besiegers", () => {
        const review = reviewSiege(wornDown(0.05, {
            siege: { turnsInSiege: tuning.hopelessAfterTurns },
            assaultOdds: 3
        }));
        expect(review.verdict).toBe(SiegeVerdict.LIFT);
    });

    it("names the territory and the turn of the siege on every verdict", () => {
        const inputs = [
            wornDown(0.2),
            wornDown(0.95),
            wornDown(0.02, { siege: { turnsInSiege: 20 } })
        ];
        for (const input of inputs) {
            const review = reviewSiege(input);
            expect(review.target).toBe("Valletta");
            expect(review.turnsInSiege).toBe(input.siege.turnsInSiege);
        }
    });

    it("presses rather than throwing when the siege data is incomplete", () => {
        //A reviewer that threw would take the AI turn with it, and one that defaulted to
        //LIFT would silently dissolve sieges on a missing field.
        expect(reviewSiege({}).verdict).toBe(SiegeVerdict.PRESS);
        expect(reviewSiege({ siege: null, target: null }).verdict).toBe(SiegeVerdict.PRESS);
    });
});
