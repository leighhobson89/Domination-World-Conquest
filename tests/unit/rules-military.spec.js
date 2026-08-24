// rules/military/{units,probability,battle}.js -- Phase 5.3/5.6.
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
    WarOutcome,
    applyWarWeariness,
    chooseDefendingUnitTypeIndex,
    classifyOutcome,
    countPossibleSkirmishes,
    likeForLikeSkirmishes,
    occupyingArmyFor,
    resolveRound,
    skirmishOdds
} from "../../src/rules/military/battle.js";
import {
    AREA_BONUS_DAMPENING,
    DEFENSE_BONUS_DIVISOR,
    MAX_AREA_THRESHOLD,
    SKIRMISH_ODDS_CAP,
    UNIT_MATCHUP_EFFECTIVENESS,
    armyGoldPrices,
    battleOutcomeEffects,
    battleOutcomeThresholds,
    combatContinentModifiers,
    vehicleArmyPersonnelWorth
} from "../../src/config/balance.js";

function constantRng(value) {
    return () => value;
}

/** An rng that cycles a fixed list, so a whole round can be scripted without running out. */
function cyclingRng(values) {
    let index = 0;
    return () => values[index++ % values.length];
}

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

    it("averages the attackers' development index rather than summing it", () => {
        expect(attackingDevelopmentIndex([{ devIndex: "0.4" }, { devIndex: "0.8" }]))
            .toBeCloseTo(0.6, 10);
    });

    it("reports 0 for an attack launched from nowhere", () => {
        expect(attackingDevelopmentIndex([])).toBe(0);
    });
});

describe("chooseDefendingUnitTypeIndex", () => {
    it("prefers the attacker's own type", () => {
        expect(chooseDefendingUnitTypeIndex(UNIT_INDEX.air, [5, 5, 5, 5]))
            .toBe(UNIT_INDEX.air);
    });

    it("falls back to whatever it is most effective against -- audit 5.2 K", () => {
        //An all-infantry attack on an all-naval defender used to produce zero possible
        //skirmishes: the battle could neither progress nor resolve, and hung.
        const chosen = chooseDefendingUnitTypeIndex(UNIT_INDEX.infantry, [0, 0, 0, 4]);
        expect(chosen).toBe(UNIT_INDEX.naval);
    });

    it("picks the best matchup among several survivors", () => {
        const attacker = UNIT_INDEX.assault;
        const defenders = [0, 0, 3, 3];
        const chosen = chooseDefendingUnitTypeIndex(attacker, defenders);
        const best = UNIT_MATCHUP_EFFECTIVENESS[attacker][UNIT_INDEX.air] >=
            UNIT_MATCHUP_EFFECTIVENESS[attacker][UNIT_INDEX.naval]
            ? UNIT_INDEX.air
            : UNIT_INDEX.naval;
        expect(chosen).toBe(best);
    });

    it("returns -1 when the defender has nothing left", () => {
        expect(chooseDefendingUnitTypeIndex(0, [0, 0, 0, 0])).toBe(-1);
    });
});

describe("skirmish bookkeeping", () => {
    it("counts pairings as the smaller of the two head counts", () => {
        expect(countPossibleSkirmishes([10, 0, 0, 0], [3, 0, 0, 0])).toBe(3);
        expect(countPossibleSkirmishes([10, 0, 0, 0], [0, 0, 0, 0])).toBe(0);
    });

    it("reports like-for-like pairings per type, for display", () => {
        expect(likeForLikeSkirmishes([5, 2, 0, 1], [3, 4, 7, 0])).toEqual([3, 2, 0, 0]);
    });

    it("caps the odds of one skirmish however lopsided the battle is", () => {
        expect(skirmishOdds(100, UNIT_INDEX.air, UNIT_INDEX.infantry))
            .toBeLessThanOrEqual(SKIRMISH_ODDS_CAP);
        expect(skirmishOdds(1000000, 0, 0)).toBe(SKIRMISH_ODDS_CAP);
    });
});

describe("resolveRound", () => {
    const context = { skirmishesPerRound: 4, probabilityPercent: 50 };

    it("does not mutate the arrays it is given", () => {
        const attackers = [10, 0, 0, 0];
        const defenders = [10, 0, 0, 0];
        resolveRound(attackers, defenders, context, cyclingRng([0.1, 0.9]));
        expect(attackers).toEqual([10, 0, 0, 0]);
        expect(defenders).toEqual([10, 0, 0, 0]);
    });

    //Every army below has units of ALL FOUR types. The type order is randomised and the
    //round stops at the first type that cannot fight, so a single-type army only fights when
    //its type happens to be drawn first -- which makes the outcome depend on the rng's
    //effect on `sort`, not on the combat. A full army fights whatever order comes out.
    const fullArmy = () => [10, 10, 10, 10];

    it("kills exactly one unit per skirmish -- there are no partial casualties", () => {
        const result = resolveRound(fullArmy(), fullArmy(), context, constantRng(0));
        const lost = (before, after) =>
            before.reduce((total, count, index) => total + (count - after[index]), 0);
        const casualties = lost(fullArmy(), result.attackers) + lost(fullArmy(), result.defenders);
        expect(casualties).toBe(result.skirmishesFought);
    });

    it("kills the defender when the roll beats the odds and the attacker when it does not", () => {
        //rng 0 is always <= the odds, so every skirmish is an attacker win.
        const won = resolveRound(fullArmy(), fullArmy(), context, constantRng(0));
        expect(won.attackers).toEqual(fullArmy());
        expect(won.defenders.reduce((sum, count) => sum + count, 0))
            .toBe(40 - context.skirmishesPerRound);

        //rng 0.99 never beats the capped odds, so every skirmish costs the attacker.
        const lost = resolveRound(fullArmy(), fullArmy(), context, constantRng(0.99));
        expect(lost.defenders).toEqual(fullArmy());
        expect(lost.attackers.reduce((sum, count) => sum + count, 0))
            .toBe(40 - context.skirmishesPerRound);
    });

    it("never spends more than the round's skirmish budget", () => {
        const result = resolveRound(
            [100, 100, 100, 100], [100, 100, 100, 100], context, constantRng(0));
        expect(result.skirmishesFought).toBe(context.skirmishesPerRound);
    });

    it("reports a round in which there was nothing to fight", () => {
        const result = resolveRound([0, 0, 0, 0], [5, 0, 0, 0], context, constantRng(0));
        expect(result.skirmishesFought).toBe(0);
        expect(result.halted).toBe("noAttackers");
    });

    it("reports a defender that was already wiped out", () => {
        const result = resolveRound([5, 0, 0, 0], [0, 0, 0, 0], context, constantRng(0));
        expect(result.halted).toBe("noDefenders");
    });

    it("stops at the first type that cannot fight, rather than skipping over it", () => {
        //Load-bearing: the type order is random, so a round whose first drawn type is empty
        //is a quiet round. Skipping would make every battle shorter and every attacker
        //stronger -- a balance change, not an extraction. Here only naval has units, so
        //three of the four draws stop the round dead.
        const rounds = Array.from({ length: 20 }, () =>
            resolveRound([0, 0, 0, 5], [0, 0, 0, 5], context, cyclingRng([0.5, 0.1, 0.9])));
        expect(rounds.some((round) => round.skirmishesFought === 0)).toBe(true);
    });
});

describe("classifyOutcome", () => {
    const start = { startingAttackForce: 1000, startingDefendForce: 1000 };

    it("is an attacker win when the defender is gone", () => {
        expect(classifyOutcome([5, 0, 0, 0], [0, 0, 0, 0], start))
            .toBe(WarOutcome.ATTACKER_WON);
    });

    it("is a defender win when the attacker is gone", () => {
        expect(classifyOutcome([0, 0, 0, 0], [5, 0, 0, 0], start))
            .toBe(WarOutcome.DEFENDER_WON);
    });

    it("measures each threshold against that side's OWN starting force -- audit 5.1 E", () => {
        //All three used to be compared against the attacker's starting force, so a battle
        //resolved at the wrong moment whenever the two armies differed in size.
        const routed = battleOutcomeThresholds.defenderRout * 1000 - 1;
        expect(classifyOutcome([500, 0, 0, 0], [routed, 0, 0, 0], {
            startingAttackForce: 100000,
            startingDefendForce: 1000
        })).toBe(WarOutcome.DEFENDER_ROUTED);
    });

    it("calls a last push when the defender is weak but not routed", () => {
        const lastPush = Math.floor(
            ((battleOutcomeThresholds.defenderRout + battleOutcomeThresholds.defenderLastPush) / 2) * 1000);
        expect(classifyOutcome([900, 0, 0, 0], [lastPush, 0, 0, 0], start))
            .toBe(WarOutcome.LAST_PUSH);
    });

    it("routs the attacker when it is the one that has collapsed", () => {
        const routed = Math.floor(battleOutcomeThresholds.attackerRout * 1000) - 1;
        expect(classifyOutcome([routed, 0, 0, 0], [999, 0, 0, 0], start))
            .toBe(WarOutcome.ATTACKER_ROUTED);
    });

    it("fights again when neither side has broken", () => {
        expect(classifyOutcome([900, 0, 0, 0], [900, 0, 0, 0], start))
            .toBe(WarOutcome.FIGHT_AGAIN);
    });

    it("uses the caller's lagged forces when it is given them", () => {
        //The game measures the forces at the START of the round, before its casualties --
        //a full round of lag. The two are separate parameters precisely so it is visible.
        expect(classifyOutcome([900, 0, 0, 0], [900, 0, 0, 0], {
            ...start,
            defendForce: 1
        })).toBe(WarOutcome.DEFENDER_ROUTED);
    });
});

describe("applyWarWeariness", () => {
    it("costs the attacker a share of what is left, so a stalemate is not free", () => {
        const worn = applyWarWeariness([100, 10, 0, 0]);
        expect(worn[0]).toBe(Math.floor(100 * battleOutcomeEffects.warWearinessSurvivorShare));
        expect(worn[1]).toBe(Math.floor(10 * battleOutcomeEffects.warWearinessSurvivorShare));
    });

    it("never goes negative", () => {
        expect(applyWarWeariness([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    });
});

describe("occupyingArmyFor", () => {
    const attackers = [100, 10, 4, 2];
    const defenders = [80, 8, 2, 0];

    it("keeps everything that survived a clean win", () => {
        expect(occupyingArmyFor(WarOutcome.ATTACKER_WON, attackers, defenders))
            .toEqual(attackers);
    });

    it("absorbs a share of a routed defender -- they surrendered rather than died", () => {
        const occupying = occupyingArmyFor(WarOutcome.DEFENDER_ROUTED, attackers, defenders);
        expect(occupying[0]).toBe(
            100 + Math.floor(80 * battleOutcomeEffects.routCaptureShare));
    });

    it("charges a last push a share of the attacker", () => {
        const occupying = occupyingArmyFor(WarOutcome.LAST_PUSH, attackers, defenders);
        expect(occupying[0]).toBe(
            Math.floor(100 * battleOutcomeEffects.lastPushSurvivorShare));
    });

    it("reports null when the attacker did not take the territory", () => {
        expect(occupyingArmyFor(WarOutcome.DEFENDER_WON, attackers, defenders)).toBeNull();
        expect(occupyingArmyFor(WarOutcome.FIGHT_AGAIN, attackers, defenders)).toBeNull();
    });

    it("does not mutate the attacking army it is given", () => {
        const army = [10, 0, 0, 0];
        occupyingArmyFor(WarOutcome.ATTACKER_WON, army, defenders);
        expect(army).toEqual([10, 0, 0, 0]);
    });
});
