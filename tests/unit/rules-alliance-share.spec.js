// What an alliance pays.
//
// Diplomacy stage 5.3. The one thing to understand before changing any of this is that it is
// a MUTUAL DIVIDEND and not a transfer: both allies earn more while the alliance stands,
// derived at the point of use and stored nowhere. A share taken out of one treasury and put
// into another has to be written onto a territory, and a stored transfer needs an exact
// inverse write the moment the alliance ends — which is the silent bug `continentBonus.js`
// exists to prevent, and the class of defect (known-issue BJ; the free-attack bug) that has
// cost this project the most.

import { describe, expect, it } from "vitest";

import { allianceShare } from "../../src/config/balance.js";
import {
    allianceCapacityMultiplier,
    allianceGoldMultiplier,
    countedAllies
} from "../../src/rules/economy/allianceShare.js";
import { capacityBonusOf, goldChangeFor, QUIET_TURN } from "../../src/rules/economy/income.js";

describe("how many allies count", () => {
    it("is nothing at all with no allies", () => {
        expect(allianceGoldMultiplier(0)).toBe(1);
        expect(allianceCapacityMultiplier(0)).toBe(1);
    });

    it("caps, so an alliance web is not a runaway", () => {
        //Without a cap every signature raises the income of everybody in it, which pays for
        //the army that wins the game — and a coalition against a runaway leader would become
        //an economic fact rather than a military one.
        expect(countedAllies(99)).toBe(allianceShare.maxAllies);
        expect(allianceGoldMultiplier(99)).toBe(allianceGoldMultiplier(allianceShare.maxAllies));
    });

    it("survives nonsense without producing NaN", () => {
        //One NaN in a gold balance never recovers — audit 5.2 AJ, in the same file.
        for (const value of [null, undefined, -4, "two", NaN]) {
            expect(Number.isFinite(allianceGoldMultiplier(value))).toBe(true);
            expect(allianceGoldMultiplier(value)).toBeGreaterThanOrEqual(1);
        }
    });

    it("pays more for gold than for capacity, and that is two dials on purpose", () => {
        //The economy phase established it: a ceiling compounds into gold a few turns later
        //while gold compounds into nothing, which is why the continent bonus has two dials.
        expect(allianceShare.gold).toBeGreaterThan(allianceShare.capacity);
    });
});

describe("the two multipliers compose", () => {
    it("multiplies the continent bonus rather than adding to it", () => {
        //Multiplying is the only composition that keeps each bonus meaning what it says on
        //its own, whichever order they arrived in.
        const bonus = capacityBonusOf({ continentCapacityBonus: 1.25, allianceCapacityBonus: 1.12 });
        expect(bonus).toBeCloseTo(1.25 * 1.12, 6);
    });

    it("falls back to 1 for a context that has not been taught about either", () => {
        expect(capacityBonusOf({})).toBe(1);
        expect(capacityBonusOf({ continentCapacityBonus: 0 })).toBe(1);
    });

    it("leaves a quiet turn exactly as it was", () => {
        //Every existing caller passes a context without these fields, and the game it plays
        //has to be the game it played before the alliance existed.
        expect(QUIET_TURN.allianceBonus).toBe(1);
        expect(QUIET_TURN.allianceCapacityBonus).toBe(1);
    });
});

describe("gold income", () => {
    const territory = () => ({
        //`goldContinentModifiers` is keyed by continent, so a fixture without one yields
        //`undefined` and the whole income becomes NaN. One NaN in a gold balance never
        //recovers -- audit 5.2 AJ, in the same file.
        continent: "Europe",
        territoryPopulation: 4_000_000,
        productiveTerritoryPop: 2_000_000,
        area: 100_000,
        devIndex: 0.745,
        farmsBuilt: 0,
        forestsBuilt: 0,
        oilWellsBuilt: 0,
        fortsBuilt: 0
    });

    it("pays the alliance share on top of the base and the earned part", () => {
        const alone = goldChangeFor(territory(), QUIET_TURN);
        const allied = goldChangeFor(territory(), { ...QUIET_TURN, allianceBonus: 1.2 });
        expect(allied).toBeCloseTo(alone * 1.2, 4);
    });

    it("stacks with a continent held whole", () => {
        const both = goldChangeFor(territory(), {
            ...QUIET_TURN, continentBonus: 1.5, allianceBonus: 1.2
        });
        const alone = goldChangeFor(territory(), QUIET_TURN);
        expect(both).toBeCloseTo(alone * 1.5 * 1.2, 3);
    });

    it("is worth more in absolute gold to the larger ally — Q5, symmetric", () => {
        //Leigh's standing rule about balance: being large stays an advantage, and the smaller
        //ally gets the larger PROPORTIONAL lift, which is the nudge. A rule that made the
        //strong subsidise the weak is the idea that was proposed for the economy and refused.
        const large = { ...territory(), productiveTerritoryPop: 40_000_000, territoryPopulation: 80_000_000 };
        const small = { ...territory(), productiveTerritoryPop: 20_000, territoryPopulation: 40_000 };
        const share = { ...QUIET_TURN, allianceBonus: 1.2 };

        const largeGain = goldChangeFor(large, share) - goldChangeFor(large, QUIET_TURN);
        const smallGain = goldChangeFor(small, share) - goldChangeFor(small, QUIET_TURN);
        expect(largeGain).toBeGreaterThan(smallGain);

        //And the proportion is the same for both, which is what "symmetric" means.
        expect(goldChangeFor(large, share) / goldChangeFor(large, QUIET_TURN))
            .toBeCloseTo(goldChangeFor(small, share) / goldChangeFor(small, QUIET_TURN), 4);
    });
});
