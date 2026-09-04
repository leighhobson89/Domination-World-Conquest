// rules/military/{units,probability}.js -- Phase 5.3/5.6.
//
// The numeric tests the e2e suite deliberately does not carry: section 4 of the e2e plan puts
// formulas here. Every test below passes its own `rng`, so a branch is reached on purpose
// rather than waited for.
//
// Until Phase 5.8 this was the ONLY place a combat outcome could be asserted exactly.
// `addSparklesRegularly()` drew from the same global stream as combat, so seeding could not
// make two runs of the same battle agree (audit 5.3 Y). That is closed -- cosmetic randomness
// has its own stream now and `battle/rout.spec.js` asserts an exact outcome end to end -- but
// the split still holds: the arithmetic belongs here and the behaviour belongs there.
//
// Battle overhaul B.10. The third file this covered, `src/rules/military/battle.js`, is
// DELETED -- it was the five-round skirmish model, superseded by the dice model in B.4/B.5 and
// unreachable from anything afterwards. Its coverage moved to `rules-battle-model.spec.js` and
// `rules-dice.spec.js`, which assert the model that actually runs. Nothing was relaxed on the
// way: the old assertions described the old arithmetic, so keeping them would have meant
// keeping the arithmetic alive to satisfy them, which is the drift the overhaul exists to end.

import { describe, expect, it } from "vitest";

import {
    PERSONNEL_WORTH_BY_INDEX,
    UNIT_INDEX,
    UNIT_TYPES,
    combinedForce,
    goldCostOf,
    isDestroyed,
    prodPopCostOf,
    unitCount
} from "../../src/rules/military/units.js";
import {
    areaBonusFor,
    attackingDevelopmentIndex,
    combatContinentModifierFor,
    defenseMultiplierFor,
    winProbability
} from "../../src/rules/military/probability.js";
import {
    AREA_BONUS_DAMPENING,
    ATTACK_ADVANTAGE,
    DEFENSE_BONUS_DIVISOR,
    MAX_AREA_THRESHOLD,
    armyGoldPrices,
    combatContinentModifiers,
    vehicleArmyPersonnelWorth
} from "../../src/config/balance.js";

describe("units", () => {
    it("names the four types in army-array order", () => {
        expect(UNIT_TYPES).toEqual(["infantry", "assault", "air", "naval"]);
        expect(UNIT_INDEX).toEqual({ infantry: 0, assault: 1, air: 2, naval: 3 });
        expect(PERSONNEL_WORTH_BY_INDEX[UNIT_INDEX.naval])
            .toBe(vehicleArmyPersonnelWorth.naval);
    });

    it("weighs an army by what each unit carries, not by head count", () => {
        expect(combinedForce([100, 0, 0, 0])).toBe(100);
        expect(combinedForce([0, 1, 0, 0])).toBe(vehicleArmyPersonnelWorth.assault);
        expect(unitCount([100, 1, 1, 1])).toBe(103);
    });

    it("treats a missing slot as empty rather than as NaN", () => {
        expect(combinedForce([5])).toBe(5);
    });

    it("knows when an army is gone", () => {
        expect(isDestroyed([0, 0, 0, 0])).toBe(true);
        expect(isDestroyed([0, 0, 1, 0])).toBe(false);
    });

    it("prices an army in gold and in crew", () => {
        expect(goldCostOf([2, 0, 0, 0])).toBe(2 * armyGoldPrices.infantry);
        expect(prodPopCostOf([0, 0, 0, 0])).toBe(0);
    });
});

describe("probability", () => {
    it("gives every territory up to the threshold the same flat 1", () => {
        //KNOWN DEFECT, known-issues AR: the comparison is `Math.min(1, THRESHOLD / area)`,
        //so it can never exceed 1. Everything at or below the threshold scores exactly 1 --
        //there is no small-territory bonus at all -- and everything above it is PENALISED.
        //That is the reverse of the intent. Asserted as it behaves, not as it should.
        expect(areaBonusFor({ area: 1 })).toBe(1);
        expect(areaBonusFor({ area: MAX_AREA_THRESHOLD })).toBe(1);
    });

    it("penalises a territory larger than the threshold", () => {
        expect(areaBonusFor({ area: MAX_AREA_THRESHOLD * 10 })).toBeLessThan(1);
    });

    it("dampens the area term halfway back towards 1", () => {
        const area = MAX_AREA_THRESHOLD * 10;
        const raw = Math.min(1, MAX_AREA_THRESHOLD / area);
        expect(areaBonusFor({ area: area }))
            .toBeCloseTo(1 + (raw - 1) * AREA_BONUS_DAMPENING, 10);
    });

    it("treats an unknown or missing continent as neutral", () => {
        expect(combatContinentModifierFor(null)).toBe(1);
        expect(combatContinentModifierFor({ continent: "Atlantis" })).toBe(1);
        expect(combatContinentModifierFor({ continent: "Asia" }))
            .toBe(combatContinentModifiers.Asia);
    });

    it("makes a single fort matter, because the multiplier is a ceiling", () => {
        const undefended = { defenseBonus: 0, mountainDefenseBonus: 0 };
        const barelyDefended = { defenseBonus: 1, mountainDefenseBonus: 0 };
        expect(defenseMultiplierFor(undefended)).toBe(0);
        expect(defenseMultiplierFor(barelyDefended)).toBe(1);
        expect(defenseMultiplierFor({
            defenseBonus: DEFENSE_BONUS_DIVISOR + 1,
            mountainDefenseBonus: 0
        })).toBe(2);
    });

    it("returns 0 rather than NaN when both armies are empty", () => {
        const territory = { defenseBonus: 0, mountainDefenseBonus: 0, area: 1000 };
        expect(winProbability([0, 0, 0, 0], [0, 0, 0, 0], territory, {
            attackingDevelopmentIndex: 1,
            combatContinentModifier: 1
        })).toBe(0);
    });

    it("is the attacker's share of the combined strength", () => {
        //An undefended territory has a defence multiplier of 0, so the defender contributes
        //nothing and the attacker's share is the whole of it.
        const territory = { defenseBonus: 0, mountainDefenseBonus: 0, area: MAX_AREA_THRESHOLD };
        expect(winProbability([100, 0, 0, 0], [100, 0, 0, 0], territory, {
            attackingDevelopmentIndex: 1,
            combatContinentModifier: 1
        })).toBe(100);
    });

    it("gives the attacker ATTACK_ADVANTAGE over an otherwise identical defender", () => {
        //The dial, pinned. Two identical armies over a territory whose fortifications
        //exactly double its defence: without the advantage this is 1 : 2 and the attacker
        //is on 33.3%. With it the RATIO improves by exactly the advantage, which is what
        //the constant means -- not that the probability itself goes up by that much.
        const territory = {
            defenseBonus: DEFENSE_BONUS_DIVISOR + 1,
            mountainDefenseBonus: 0,
            area: MAX_AREA_THRESHOLD
        };
        const probability = winProbability([100, 0, 0, 0], [100, 0, 0, 0], territory, {
            attackingDevelopmentIndex: 1,
            combatContinentModifier: 1
        });
        const expected = (ATTACK_ADVANTAGE / (ATTACK_ADVANTAGE + 2)) * 100;
        expect(probability).toBeCloseTo(expected, 10);

        //And it is a strength multiplier, so it can never carry a probability past 100 --
        //which is the whole reason it is applied here and not to the answer.
        expect(probability).toBeLessThan(100);
    });

    it("averages the attackers' development index rather than summing it", () => {
        expect(attackingDevelopmentIndex([{ devIndex: "0.4" }, { devIndex: "0.8" }]))
            .toBeCloseTo(0.6, 10);
    });

    it("reports 0 for an attack launched from nowhere", () => {
        expect(attackingDevelopmentIndex([])).toBe(0);
    });
});
