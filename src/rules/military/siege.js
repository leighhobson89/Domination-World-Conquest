// Sieges: what one turn of a siege does to the territory under it.
//
// Refactor plan Phase 5.4. Pure, with the RNG injected. `tickSiege()` reads a siege and
// returns a `SiegeTickResult` describing what happened; it writes nothing. The caller turns
// that into a patch with `siegeDamageDeltas()` and applies it through `state/mutations.js`.
//
// A siege is the slow half of the war model. An open battle is five rounds of skirmishes
// resolved in one sitting (see battle.js in this folder); a siege is one roll per turn,
// repeated until the attacker breaks the territory, the defender is relieved, or the
// besieging force is arrested. The three questions each turn are always the same:
//
//   1. Did the siege land a hit? -- `siegeHitProbability()`, rolled `SIEGE_HIT_ITERATIONS`
//      times, majority wins.
//   2. If so, did it destroy anything? -- `rollBuildingDestruction()`.
//   3. How much collateral damage did it do? -- `collateralDamagePercent()`, which doubles
//      as the arrest signal: zero collateral means the besieging force was rounded up.
//
// The whole thing turns on ONE number, `scoreDifference`: the siege score of the attacking
// army minus the defending territory's fortifications and mountains. Every probability in
// the turn is a band on that number.
//
// Two long-standing defects are fixed by construction here rather than by a guard.
// `calculateCollateralDamage()` was called from one branch of `calculateDamageDone()` and
// left `undefined` in another, which made `foodCapacityDestroyed` NaN and the `arrested`
// flag silently false (Phase 4.7, defect AK). And `handleEndSiegeDueArrest()` indexed the
// defender's army array by half the attacker's assault count instead of adding the two
// (defect AL). Both are now single expressions with one caller each.

import {
    armyTypeSiegeValues,
    ATTACK_ADVANTAGE,
    SIEGE_ARREST_CAPTURE_SHARE,
    SIEGE_ARREST_CHANCE,
    SIEGE_HIT_ITERATIONS,
    siegeCollateralBands,
    siegeDestroySlidingScale,
    siegeDestructionRolls,
    siegeHitChance,
    vehicleArmyPersonnelWorth
} from "../../config/balance.js";
import { defenseBonusFor } from "../economy/capacity.js";
import { UNIT_INDEX } from "./units.js";

/**
 * The four things a siege can destroy, in the order the legacy damage array carried them.
 * The order is load-bearing: the destroy roll picks one at random by index, so changing it
 * changes which building a given RNG stream takes out.
 */
export const SIEGE_TARGETS = Object.freeze(["forts", "farms", "forests", "oilWells"]);

/** Which territory field each target counts. */
const TARGET_FIELDS = Object.freeze({
    forts: "fortsBuilt",
    farms: "farmsBuilt",
    forests: "forestsBuilt",
    oilWells: "oilWellsBuilt"
});

/** No buildings destroyed. A fresh object each call -- callers add to it. */
function noDestruction() {
    return { forts: 0, farms: 0, forests: 0, oilWells: 0 };
}

/**
 * How much pressure a besieging army applies.
 *
 * Vehicles dominate: one naval unit is worth 100,000 infantry. That is deliberate -- a siege
 * is broken by artillery and blockade, not by numbers -- and it is why an infantry-only
 * besieger can sit outside a fortified territory indefinitely without ever landing a hit.
 *
 * @param {number[]} attackingArmy  [infantry, assault, air, naval]
 * @returns {number}
 */
export function siegeScore(attackingArmy) {
    return Math.floor(
        (attackingArmy[UNIT_INDEX.infantry] * armyTypeSiegeValues.infantry) +
        (attackingArmy[UNIT_INDEX.assault] * armyTypeSiegeValues.assault) +
        (attackingArmy[UNIT_INDEX.air] * armyTypeSiegeValues.air) +
        (attackingArmy[UNIT_INDEX.naval] * armyTypeSiegeValues.naval));
}

/**
 * The single number the whole turn is scored on: how far the siege outweighs the defences.
 *
 * Negative means the territory's forts and mountains are worth more than the army outside
 * it, which is the band in which the besieging force risks being arrested.
 *
 * The besieging score is multiplied by `ATTACK_ADVANTAGE` before the defences come off it,
 * and this is the ONE place a siege reads that dial. Everything else in this file -- the
 * hit probability, the destroy scale, the collateral bands, the arrest -- is a function of
 * the number this returns, so raising the dial makes a siege land more often, break more
 * buildings and be arrested less, all from one multiplication. Applying it to the SCORE
 * rather than subtracting it from the defences is what makes it proportional: a siege twice
 * the size gets twice the benefit, which is the same shape the open-battle multiplier has.
 *
 * `siegeScore()` itself is left alone, because that figure is shown to the player on the
 * siege screen and it is a fact about the army, not about the contest.
 *
 * @param {number} score  from `siegeScore()`
 * @param {object} territory  the defending territory
 * @returns {number}
 */
export function scoreDifferenceFor(score, territory) {
    return (score * ATTACK_ADVANTAGE) - (territory.defenseBonus + territory.mountainDefenseBonus);
}

/**
 * Chance that one roll of the siege lands a hit, clamped to 0..1.
 *
 * Evenly matched (`scoreDifference` of 0) is a coin flip, and it takes a thousand points of
 * advantage to make a hit certain.
 */
export function siegeHitProbability(scoreDifference) {
    const probability = siegeHitChance.base + (scoreDifference / siegeHitChance.scoreDivisor);
    return Math.max(0, Math.min(1, probability));
}

/**
 * Roll the hit, `SIEGE_HIT_ITERATIONS` times, and take the majority.
 *
 * Rolling repeatedly and taking the majority rather than rolling once is what stops a siege
 * being a coin flip per turn: it pulls the outcome towards the probability, so a siege that
 * is genuinely winning wins most turns instead of most-turns-on-average-over-fifty.
 *
 * A tie is NOT a hit -- `hitCount > iterations / 2`, strictly -- so an evenly matched siege
 * lands slightly under half its turns.
 *
 * @param {number} hitProbability
 * @param {() => number} [rng]
 * @returns {{hit: boolean, hitCount: number}}
 */
export function rollSiegeHit(hitProbability, rng = Math.random) {
    let hitCount = 0;
    for (let iteration = 0; iteration < SIEGE_HIT_ITERATIONS; iteration++) {
        if (rng() < hitProbability) {
            hitCount++;
        }
    }
    return { hit: hitCount > SIEGE_HIT_ITERATIONS / 2, hitCount: hitCount };
}

/**
 * Chance that a landed hit destroys a building at all.
 *
 * The highest band the siege has reached wins; below the first band it is zero, so a siege
 * that only just outweighs the defences does collateral damage and nothing else.
 */
export function destroyProbabilityFor(scoreDifference) {
    return siegeDestroySlidingScale.reduce(
        (best, band) => (scoreDifference >= band.scoreDifference ? band.destroyProbability : best),
        0);
}

/**
 * Collateral damage this turn, as a percentage of the territory's food capacity.
 *
 * Returns 0 to mean ARRESTED. That is not a sentinel bolted on afterwards: below the lowest
 * band the besieging army cannot even match the territory's defences, and the two possible
 * outcomes are that it is rounded up (0) or that it scrapes a single percent (1). Every
 * other band rolls `1..damageMax`, so 0 is unambiguous.
 *
 * @param {number} scoreDifference
 * @param {() => number} [rng]
 * @returns {number} 0 = arrested, otherwise a percentage
 */
export function collateralDamagePercent(scoreDifference, rng = Math.random) {
    const band = siegeCollateralBands.find(
        (candidate) => scoreDifference >= candidate.min && scoreDifference < candidate.max);
    if (band) {
        return Math.floor(rng() * band.damageMax) + 1;
    }
    return rng() > SIEGE_ARREST_CHANCE ? 0 : 1;
}

/**
 * Which buildings a landed hit takes out.
 *
 * An overwhelming siege rolls twice, a strong one once, anything weaker not at all -- and
 * each roll first has to beat its own chance, THEN picks a target at random. So even an
 * overwhelming siege destroys nothing on most turns; what it buys is the possibility of
 * losing two buildings in one.
 *
 * The roll chances read `rng() > chance`, not `<`. That is the legacy comparison and it is
 * kept: `overwhelmingFirstRollChance: 0.3` therefore means a 70% chance of destroying
 * something, not 30%.
 *
 * @param {number} scoreDifference
 * @param {() => number} [rng]
 * @returns {{forts: number, farms: number, forests: number, oilWells: number}}
 */
export function rollBuildingDestruction(scoreDifference, rng = Math.random) {
    const destroyed = noDestruction();

    if (rng() >= destroyProbabilityFor(scoreDifference)) {
        return destroyed;
    }

    const destroyOne = () => {
        destroyed[SIEGE_TARGETS[Math.floor(rng() * SIEGE_TARGETS.length)]]++;
    };

    if (scoreDifference >= siegeDestructionRolls.overwhelmingThreshold) {
        if (rng() > siegeDestructionRolls.overwhelmingFirstRollChance) {
            destroyOne();
        }
        if (rng() > siegeDestructionRolls.overwhelmingSecondRollChance) {
            destroyOne();
        }
    } else if (scoreDifference >= siegeDestructionRolls.strongThreshold) {
        if (rng() > siegeDestructionRolls.strongRollChance) {
            destroyOne();
        }
    }

    return destroyed;
}

/**
 * Everything a landed hit does, in one object.
 *
 * The collateral roll happens FIRST and unconditionally, before the destruction roll. That
 * ordering is what the RNG stream has always seen and it is also what makes the arrest
 * decidable: the arrest is a property of the band, not of what happened to be destroyed.
 *
 * @param {object} territory  the defending territory
 * @param {number} scoreDifference
 * @param {() => number} [rng]
 * @returns {{destroyed: object, collateralPercent: number, foodCapacityDestroyed: number,
 *            arrested: boolean}}
 */
export function siegeDamageFor(territory, scoreDifference, rng = Math.random) {
    const collateralPercent = collateralDamagePercent(scoreDifference, rng);
    const destroyed = rollBuildingDestruction(scoreDifference, rng);

    return {
        destroyed: destroyed,
        collateralPercent: collateralPercent,
        foodCapacityDestroyed: Math.floor(territory.foodCapacity * collateralPercent / 100),
        arrested: collateralPercent === 0
    };
}

/**
 * One turn of one siege. Pure: reads the siege, writes nothing.
 *
 * @param {object} siege  needs `attackingArmyRemaining` and a `defendingTerritory`
 * @param {() => number} [rng]
 * @returns {{score: number, scoreDifference: number, hitProbability: number, hit: boolean,
 *            hitCount: number, arrested: boolean, damage: object|null, continues: boolean}}
 */
export function tickSiege(siege, rng = Math.random) {
    const territory = siege.defendingTerritory;
    const score = siegeScore(siege.attackingArmyRemaining);
    const scoreDifference = scoreDifferenceFor(score, territory);
    const hitProbability = siegeHitProbability(scoreDifference);
    const { hit, hitCount } = rollSiegeHit(hitProbability, rng);

    //A miss is a quiet turn, not an event. audit 5.1 D: the legacy loop `return`ed here,
    //which abandoned every OTHER siege's turn as well.
    if (!hit) {
        return {
            score: score,
            scoreDifference: scoreDifference,
            hitProbability: hitProbability,
            hit: false,
            hitCount: hitCount,
            arrested: false,
            damage: null,
            continues: true
        };
    }

    const damage = siegeDamageFor(territory, scoreDifference, rng);

    return {
        score: score,
        scoreDifference: scoreDifference,
        hitProbability: hitProbability,
        hit: true,
        hitCount: hitCount,
        arrested: damage.arrested,
        damage: damage,
        //An arrest ends the siege; a hit that lands damage does not.
        continues: !damage.arrested
    };
}

/**
 * The territory patch a turn of siege damage amounts to.
 *
 * Building counts floor at zero, and the defence bonus is recomputed from the surviving
 * forts rather than decremented -- it is quadratic in the fort count, so subtracting a
 * per-fort amount would give a different answer depending on the order the forts fell.
 *
 * `foodCapacity` is clamped and guarded. Neither should be reachable now that the collateral
 * figure is always defined, but a NaN here used to persist for the rest of the game, because
 * every later turn recomputes the territory's food from it (Phase 4.7, defect AK).
 *
 * @param {object} territory
 * @param {{destroyed: object, foodCapacityDestroyed: number}} damage
 * @returns {object} a patch for `updateTerritory()`
 */
export function siegeDamageDeltas(territory, damage) {
    const patch = {};

    for (const target of SIEGE_TARGETS) {
        const field = TARGET_FIELDS[target];
        patch[field] = Math.max(0, territory[field] - damage.destroyed[target]);
    }

    patch.defenseBonus = defenseBonusFor({ ...territory, ...patch });

    if (territory.foodCapacity > 0 && Number.isFinite(damage.foodCapacityDestroyed)) {
        patch.foodCapacity = Math.max(0, territory.foodCapacity - damage.foodCapacityDestroyed);
    }

    return patch;
}

/**
 * The garrison a territory is left holding when it arrests the force besieging it.
 *
 * The survivors of the defence, plus half of the besiegers -- they surrendered rather than
 * died, and they change sides. `armyForCurrentTerritory` is recomputed from the four counts
 * so the total cannot disagree with its parts.
 *
 * @param {number[]} defendingArmyRemaining
 * @param {number[]} attackingArmyRemaining
 * @returns {object} a patch for `updateTerritory()`
 */
export function arrestGarrisonFor(defendingArmyRemaining, attackingArmyRemaining) {
    const captured = (index) =>
        (defendingArmyRemaining[index] ?? 0) +
        Math.floor((attackingArmyRemaining[index] ?? 0) * SIEGE_ARREST_CAPTURE_SHARE);

    const infantry = captured(UNIT_INDEX.infantry);
    const assault = captured(UNIT_INDEX.assault);
    const air = captured(UNIT_INDEX.air);
    const naval = captured(UNIT_INDEX.naval);

    return {
        infantryForCurrentTerritory: infantry,
        assaultForCurrentTerritory: assault,
        airForCurrentTerritory: air,
        navalForCurrentTerritory: naval,
        armyForCurrentTerritory:
            infantry +
            (assault * vehicleArmyPersonnelWorth.assault) +
            (air * vehicleArmyPersonnelWorth.air) +
            (naval * vehicleArmyPersonnelWorth.naval)
    };
}
