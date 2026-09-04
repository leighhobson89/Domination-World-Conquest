// rules/military/siege.js -- Phase 5.4/5.6.
//
// A siege turn is one roll against a probability band, so before the RNG was injected no two
// runs of it agreed -- it drew from the same global `Math.random` that `addSparklesRegularly()`
// in ui.js was also burning three draws per tick on (audit 5.3 Y, closed in Phase 5.8). With
// `rng` a parameter, a scripted stream makes every branch reachable and exact, which is still
// the right place for band arithmetic even now that a seeded run repeats end to end.

import { describe, expect, it } from "vitest";

import {
    SIEGE_TARGETS,
    arrestGarrisonFor,
    collateralDamagePercent,
    destroyProbabilityFor,
    rollBuildingDestruction,
    rollSiegeHit,
    scoreDifferenceFor,
    siegeDamageDeltas,
    siegeDamageFor,
    siegeHitProbability,
    siegeScore,
    tickSiege
} from "../../src/rules/military/siege.js";
import {
    ATTACK_ADVANTAGE,
    SIEGE_HIT_ITERATIONS,
    armyTypeSiegeValues,
    siegeHitChance
} from "../../src/config/balance.js";

/** An RNG that returns the given values in order, then throws rather than silently repeating. */
function scriptedRng(values) {
    let index = 0;
    return () => {
        if (index >= values.length) {
            throw new Error(`scripted rng exhausted after ${values.length} draws`);
        }
        return values[index++];
    };
}

/** An RNG that always returns the same value. */
function constantRng(value) {
    return () => value;
}

function territory(overrides = {}) {
    return {
        uniqueId: "1",
        defenseBonus: 0,
        mountainDefenseBonus: 0,
        foodCapacity: 1000,
        fortsBuilt: 0,
        farmsBuilt: 0,
        forestsBuilt: 0,
        oilWellsBuilt: 0,
        devIndex: "1",
        isLandLockedBonus: 0,
        ...overrides
    };
}

describe("siegeScore", () => {
    it("weighs each unit type by its siege value", () => {
        expect(siegeScore([0, 1, 0, 0])).toBe(armyTypeSiegeValues.assault);
        expect(siegeScore([0, 0, 1, 0])).toBe(armyTypeSiegeValues.air);
        expect(siegeScore([0, 0, 0, 1])).toBe(armyTypeSiegeValues.naval);
    });

    it("floors, so infantry alone contribute almost nothing", () => {
        //Infantry are worth 0.0001 each: it takes ten thousand of them to match one point.
        expect(siegeScore([9999, 0, 0, 0])).toBe(0);
        expect(siegeScore([10000, 0, 0, 0])).toBe(1);
    });

    it("sums the four types", () => {
        const expected = Math.floor(
            (10000 * armyTypeSiegeValues.infantry) +
            (2 * armyTypeSiegeValues.assault) +
            (3 * armyTypeSiegeValues.air) +
            (4 * armyTypeSiegeValues.naval));
        expect(siegeScore([10000, 2, 3, 4])).toBe(expected);
    });
});

describe("scoreDifferenceFor", () => {
    //Expectations are DERIVED from ATTACK_ADVANTAGE rather than written out, so that the
    //dial can be retuned without editing arithmetic in a test -- and so that a test that
    //hard-codes today's value can never quietly become the reason the dial is not moved.
    it("subtracts both the forts and the mountains", () => {
        expect(scoreDifferenceFor(100, territory({ defenseBonus: 30, mountainDefenseBonus: 20 })))
            .toBeCloseTo((100 * ATTACK_ADVANTAGE) - 50, 10);
    });

    it("goes negative when the defences outweigh the besieging army", () => {
        expect(scoreDifferenceFor(10, territory({ defenseBonus: 60 })))
            .toBeCloseTo((10 * ATTACK_ADVANTAGE) - 60, 10);
    });

    it("scales the besieging score by the attacker's advantage, not the defences", () => {
        //The dial is proportional: doubling the besieging army doubles what the advantage
        //is worth. Subtracting a flat amount from the defences instead would hand a small
        //siege the same help as an overwhelming one, and would make a territory with no
        //fortifications at all easier to besiege than the rule intends.
        const undefended = territory({ defenseBonus: 0, mountainDefenseBonus: 0 });
        expect(scoreDifferenceFor(100, undefended)).toBeCloseTo(100 * ATTACK_ADVANTAGE, 10);
        expect(scoreDifferenceFor(200, undefended)).toBeCloseTo(200 * ATTACK_ADVANTAGE, 10);
    });
});

describe("siegeHitProbability", () => {
    it("is a coin flip when the two sides are evenly matched", () => {
        expect(siegeHitProbability(0)).toBe(siegeHitChance.base);
    });

    it("clamps to 0 and 1 rather than running off either end", () => {
        expect(siegeHitProbability(-100000)).toBe(0);
        expect(siegeHitProbability(100000)).toBe(1);
    });

    it("moves one point per scoreDivisor points of advantage", () => {
        expect(siegeHitProbability(siegeHitChance.scoreDivisor / 2))
            .toBeCloseTo(siegeHitChance.base + 0.5, 10);
    });
});

describe("rollSiegeHit", () => {
    it("takes the majority of SIEGE_HIT_ITERATIONS rolls", () => {
        expect(rollSiegeHit(1, constantRng(0))).toEqual({
            hit: true,
            hitCount: SIEGE_HIT_ITERATIONS
        });
        expect(rollSiegeHit(0, constantRng(0.99))).toEqual({ hit: false, hitCount: 0 });
    });

    it("treats an exact tie as a miss", () => {
        const half = SIEGE_HIT_ITERATIONS / 2;
        const hits = Array.from({ length: half }, () => 0);
        const misses = Array.from({ length: SIEGE_HIT_ITERATIONS - half }, () => 0.99);
        const result = rollSiegeHit(0.5, scriptedRng([...hits, ...misses]));
        expect(result.hitCount).toBe(half);
        expect(result.hit).toBe(false);
    });

    it("draws exactly SIEGE_HIT_ITERATIONS times", () => {
        //The draw count is what keeps the RNG stream aligned with the legacy loop.
        let draws = 0;
        rollSiegeHit(0.5, () => {
            draws++;
            return 0.5;
        });
        expect(draws).toBe(SIEGE_HIT_ITERATIONS);
    });
});

describe("destroyProbabilityFor", () => {
    it("is zero below the first band", () => {
        expect(destroyProbabilityFor(-1)).toBe(0);
        expect(destroyProbabilityFor(19)).toBe(0);
    });

    it("takes the highest band the siege has reached", () => {
        expect(destroyProbabilityFor(20)).toBe(0.3);
        expect(destroyProbabilityFor(69)).toBe(0.3);
        expect(destroyProbabilityFor(70)).toBe(0.5);
        expect(destroyProbabilityFor(1000)).toBe(1);
    });
});

describe("collateralDamagePercent", () => {
    it("rolls 1..damageMax inside a band, so a hit always costs something", () => {
        expect(collateralDamagePercent(10, constantRng(0))).toBe(1);
        expect(collateralDamagePercent(10, constantRng(0.999))).toBe(6);
    });

    it("uses the band the difference falls in", () => {
        expect(collateralDamagePercent(150, constantRng(0.999))).toBe(25);
    });

    it("returns 0 -- arrested -- below the lowest band on a high roll", () => {
        expect(collateralDamagePercent(-1, constantRng(0.99))).toBe(0);
    });

    it("returns 1 below the lowest band on a low roll: the siege scrapes by", () => {
        expect(collateralDamagePercent(-1, constantRng(0.1))).toBe(1);
    });
});

describe("rollBuildingDestruction", () => {
    it("destroys nothing when the destroy roll fails", () => {
        //difference 70 is a 0.5 destroy probability, so a high roll misses entirely.
        expect(rollBuildingDestruction(70, constantRng(0.999)))
            .toEqual({ forts: 0, farms: 0, forests: 0, oilWells: 0 });
    });

    it("cannot fail the destroy roll once the siege is overwhelming", () => {
        //At difference 280 the destroy probability is 1, so the only question left is which
        //of the two destruction rolls lands.
        expect(rollBuildingDestruction(1000, constantRng(0.999)))
            .toEqual({ forts: 0, farms: 0, forests: 0, oilWells: 2 });
    });

    it("destroys nothing below the strong threshold even on a successful destroy roll", () => {
        //difference 20 clears the destroy probability but neither destruction roll.
        expect(rollBuildingDestruction(20, scriptedRng([0])))
            .toEqual({ forts: 0, farms: 0, forests: 0, oilWells: 0 });
    });

    it("rolls once at the strong threshold", () => {
        //destroy roll, then the strong roll, then the target index.
        const result = rollBuildingDestruction(50, scriptedRng([0, 0.9, 0]));
        expect(result.forts).toBe(1);
        expect(result.farms + result.forests + result.oilWells).toBe(0);
    });

    it("rolls twice at the overwhelming threshold and can take out two", () => {
        const result = rollBuildingDestruction(200, scriptedRng([0, 0.9, 0, 0.9, 0.999]));
        expect(result.forts).toBe(1);
        expect(result.oilWells).toBe(1);
    });

    it("picks the target by index, in SIEGE_TARGETS order", () => {
        SIEGE_TARGETS.forEach((target, index) => {
            const pick = (index + 0.5) / SIEGE_TARGETS.length;
            const result = rollBuildingDestruction(50, scriptedRng([0, 0.9, pick]));
            expect(result[target]).toBe(1);
        });
    });
});

describe("siegeDamageFor", () => {
    it("draws the collateral roll before the destruction roll", () => {
        //Order matters: it is what the legacy RNG stream saw, and it is why an arrest is a
        //property of the band rather than of what was destroyed.
        const draws = [];
        const rng = () => {
            draws.push(draws.length);
            return 0.5;
        };
        siegeDamageFor(territory(), 10, rng);
        expect(draws.length).toBeGreaterThanOrEqual(2);
    });

    it("turns the collateral percentage into a food-capacity figure", () => {
        const damage = siegeDamageFor(
            territory({ foodCapacity: 1000 }), 10, scriptedRng([0.999, 0.999]));
        expect(damage.collateralPercent).toBe(6);
        expect(damage.foodCapacityDestroyed).toBe(60);
        expect(damage.arrested).toBe(false);
    });

    it("reports an arrest when the collateral roll comes back zero", () => {
        const damage = siegeDamageFor(territory(), -1, scriptedRng([0.99, 0.99]));
        expect(damage.arrested).toBe(true);
        expect(damage.foodCapacityDestroyed).toBe(0);
    });

    it("never leaves the food figure undefined -- defect AK", () => {
        //The legacy version assigned collateral damage in three of four paths and left it
        //undefined in the fourth (destroy roll succeeds, difference under 50), which made
        //this NaN and stuck it on the territory for the rest of the game.
        const damage = siegeDamageFor(territory(), 25, scriptedRng([0.5, 0]));
        expect(Number.isFinite(damage.foodCapacityDestroyed)).toBe(true);
        expect(damage.arrested).toBe(false);
    });
});

describe("siegeDamageDeltas", () => {
    it("subtracts the destroyed buildings and floors each at zero", () => {
        const patch = siegeDamageDeltas(
            territory({ fortsBuilt: 3, farmsBuilt: 1, forestsBuilt: 0, oilWellsBuilt: 2 }),
            {
                destroyed: { forts: 1, farms: 2, forests: 1, oilWells: 0 },
                foodCapacityDestroyed: 0
            });
        expect(patch.fortsBuilt).toBe(2);
        expect(patch.farmsBuilt).toBe(0);
        expect(patch.forestsBuilt).toBe(0);
        expect(patch.oilWellsBuilt).toBe(2);
    });

    it("recomputes the defence bonus from the surviving forts, not by decrementing", () => {
        //It is quadratic in the fort count, so a per-fort subtraction would give a different
        //answer depending on the order the forts fell.
        const before = territory({ fortsBuilt: 4, devIndex: "1", isLandLockedBonus: 0 });
        const patch = siegeDamageDeltas(before, {
            destroyed: { forts: 1, farms: 0, forests: 0, oilWells: 0 },
            foodCapacityDestroyed: 0
        });
        const threeForts = siegeDamageDeltas(territory({ fortsBuilt: 3 }), {
            destroyed: { forts: 0, farms: 0, forests: 0, oilWells: 0 },
            foodCapacityDestroyed: 0
        });
        expect(patch.defenseBonus).toBe(threeForts.defenseBonus);
    });

    it("clamps food capacity at zero", () => {
        const patch = siegeDamageDeltas(territory({ foodCapacity: 50 }), {
            destroyed: { forts: 0, farms: 0, forests: 0, oilWells: 0 },
            foodCapacityDestroyed: 900
        });
        expect(patch.foodCapacity).toBe(0);
    });

    it("leaves food capacity alone rather than writing NaN over it", () => {
        const patch = siegeDamageDeltas(territory({ foodCapacity: 500 }), {
            destroyed: { forts: 0, farms: 0, forests: 0, oilWells: 0 },
            foodCapacityDestroyed: Number.NaN
        });
        expect(patch).not.toHaveProperty("foodCapacity");
    });

    it("does not mutate the territory it is given", () => {
        const before = territory({ fortsBuilt: 3, foodCapacity: 500 });
        siegeDamageDeltas(before, {
            destroyed: { forts: 1, farms: 0, forests: 0, oilWells: 0 },
            foodCapacityDestroyed: 100
        });
        expect(before.fortsBuilt).toBe(3);
        expect(before.foodCapacity).toBe(500);
    });
});

describe("arrestGarrisonFor", () => {
    it("adds half the besiegers to the surviving defenders", () => {
        const patch = arrestGarrisonFor([10, 4, 2, 0], [20, 8, 4, 2]);
        expect(patch.infantryForCurrentTerritory).toBe(20);
        expect(patch.assaultForCurrentTerritory).toBe(8);
        expect(patch.airForCurrentTerritory).toBe(4);
        expect(patch.navalForCurrentTerritory).toBe(1);
    });

    it("keeps the army total consistent with its four parts -- defect AL", () => {
        //The legacy line read `defendingArmyRemaining[1 + Math.floor(attacking[1] * 0.5)]`,
        //indexing a four-element array by half the attacker's assault count. Two or more
        //assault units therefore produced `undefined`, and the total below came out NaN --
        //permanently, because every later turn recomputes from it.
        const patch = arrestGarrisonFor([10, 1, 0, 0], [0, 6, 0, 0]);
        expect(patch.assaultForCurrentTerritory).toBe(4);
        expect(Number.isFinite(patch.armyForCurrentTerritory)).toBe(true);
        expect(patch.armyForCurrentTerritory).toBeGreaterThan(0);
    });

    it("survives a short army array rather than producing NaN", () => {
        const patch = arrestGarrisonFor([5], [3]);
        expect(patch.infantryForCurrentTerritory).toBe(6);
        expect(Number.isFinite(patch.armyForCurrentTerritory)).toBe(true);
    });
});

describe("tickSiege", () => {
    const besieged = (overrides) => ({
        attackingArmyRemaining: [0, 0, 0, 20], //200 siege score
        defendingTerritory: territory(overrides)
    });

    it("reports a quiet turn on a miss, and does not go on to roll damage", () => {
        const result = tickSiege(besieged(), constantRng(0.999));
        expect(result.hit).toBe(false);
        expect(result.damage).toBeNull();
        expect(result.arrested).toBe(false);
        expect(result.continues).toBe(true);
    });

    it("returns the damage on a hit and lets the siege continue", () => {
        const result = tickSiege(besieged(), constantRng(0));
        expect(result.hit).toBe(true);
        expect(result.damage).not.toBeNull();
        expect(result.arrested).toBe(false);
        expect(result.continues).toBe(true);
    });

    it("ends the siege when the besieging force is arrested", () => {
        //An arrest needs BOTH a hit and a negative score difference, which is a narrow
        //window: past -500 the hit probability clamps to 0 and the siege can only ever miss.
        //A difference of -100 leaves a 40% hit chance and puts the collateral roll in the
        //arrest band. Ten hit rolls, then the collateral roll, then the destroy roll.
        const siege = besieged({ defenseBonus: 300 });
        const hitRolls = Array.from({ length: SIEGE_HIT_ITERATIONS }, () => 0);
        const result = tickSiege(siege, scriptedRng([...hitRolls, 0.99, 0.99]));
        expect(result.arrested).toBe(true);
        expect(result.continues).toBe(false);
    });

    it("carries the score and the difference it scored the turn on", () => {
        //`score` is the raw force -- it is what the siege screen shows the player -- while
        //`scoreDifference` is the contest, and only the second carries the advantage.
        const result = tickSiege(besieged({ defenseBonus: 50 }), constantRng(0.999));
        const difference = (200 * ATTACK_ADVANTAGE) - 50;
        expect(result.score).toBe(200);
        expect(result.scoreDifference).toBeCloseTo(difference, 10);
        expect(result.hitProbability)
            .toBeCloseTo(siegeHitChance.base + (difference / siegeHitChance.scoreDivisor), 10);
    });

    it("writes nothing: the territory is untouched", () => {
        const siege = besieged({ fortsBuilt: 3, foodCapacity: 900 });
        tickSiege(siege, constantRng(0));
        expect(siege.defendingTerritory.fortsBuilt).toBe(3);
        expect(siege.defendingTerritory.foodCapacity).toBe(900);
        expect(siege.attackingArmyRemaining).toEqual([0, 0, 0, 20]);
    });
});
