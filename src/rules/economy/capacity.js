// Capacities, demands, and the oil gate on how much of an army can actually fight.
//
// Refactor plan Phase 5.2. Pure.
//
// The oil gate is the game's most distinctive economic idea and the least obvious: buying a
// naval unit is not the same as being able to sail it. A territory's vehicles demand oil
// every turn, and if the territory does not hold enough, some of them are grounded --
// present in `navalForCurrentTerritory`, absent from `useableNaval`, and absent from the
// army total that a battle is fought with.

import {
    oilRequirements,
    vehicleArmyPersonnelWorth,
    FORT_DEFENSE_SCALE
} from "../../config/balance.js";

/**
 * The three stored capacities, by the short resource name the rest of the economy uses.
 *
 * Named once because four modules have to agree about them, and because a typo in a field
 * name here reads back as a capacity of zero rather than as an error.
 */
export const CAPACITY_FIELDS = Object.freeze({
    oil: "oilCapacity",
    food: "foodCapacity",
    consMats: "consMatsCapacity"
});

/**
 * A territory's capacity for one resource, INCLUDING the continent bonus -- derived, never
 * stored.
 *
 * The stored `oilCapacity` / `foodCapacity` / `consMatsCapacity` are built at world creation
 * and raised by upgrades (+10% per farm, forest or oil well). The continent bonus must NOT be
 * written into them: losing the last territory of a continent would then need an exact
 * inverse write, the two would disagree the first time any path forgot, and a player would
 * keep a bonus for a continent they no longer held -- silently, because nothing anywhere
 * compares a stored capacity against what it should be. Derived at the point of use, losing
 * the continent is simply the next turn's answer.
 *
 * A nonsense bonus falls back to 1 rather than propagating. These capacities feed
 * `regenerationTowardsCapacity()`, whose output is added to a stock that every later turn
 * recomputes from -- so one NaN here would never wash out.
 *
 * @param {object} territory
 * @param {"oil"|"food"|"consMats"} resource
 * @param {number} [bonus]  the continent multiplier, 1 when the continent is not held whole
 * @returns {number}
 */
export function effectiveCapacityFor(territory, resource, bonus = 1) {
    const field = CAPACITY_FIELDS[resource];
    if (!field || !territory) {
        return 0;
    }
    const stored = Number(territory[field]) || 0;
    return stored * bonusMultiplier(bonus);
}

/**
 * A usable bonus multiplier, or 1.
 *
 * Exported because gold uses the same guard, and because every reader outside the economy --
 * the tooltip, the info panel, the upgrade preview -- has to fall back the same way. A
 * nonsense bonus must degrade to "no bonus", never to NaN.
 */
export function bonusMultiplier(bonus) {
    return Number.isFinite(bonus) && bonus > 0 ? bonus : 1;
}

/** Oil a territory's vehicles demand per turn. Infantry demand none. */
export function oilDemandFor(territory) {
    return (oilRequirements.assault * territory.assaultForCurrentTerritory) +
        (oilRequirements.air * territory.airForCurrentTerritory) +
        (oilRequirements.naval * territory.navalForCurrentTerritory);
}

/**
 * A territory's army as one head count, from its USEABLE units.
 *
 * This is what `armyForCurrentTerritory` holds and what a battle weighs. Grounded vehicles
 * are excluded, which is the whole point of the oil gate.
 */
export function armyTotalFor(units) {
    return units.infantryForCurrentTerritory +
        (units.useableAssault * vehicleArmyPersonnelWorth.assault) +
        (units.useableAir * vehicleArmyPersonnelWorth.air) +
        (units.useableNaval * vehicleArmyPersonnelWorth.naval);
}

/**
 * Which of a territory's vehicles it can fuel this turn.
 *
 * When demand exceeds the oil held, units are grounded in rotation -- naval, air, assault,
 * naval, air, assault -- rather than emptying one type at a time. That keeps a shortfall
 * from wiping out a whole arm of the military and leaves an army that still has a shape.
 * Naval leads the rotation because it is the thirstiest, so the shortfall closes fastest.
 *
 * @param {object} territory
 * @returns {{useableAssault: number, useableAir: number, useableNaval: number,
 *            armyForCurrentTerritory: number}}
 */
export function useableUnitsFor(territory) {
    let useableAssault = territory.assaultForCurrentTerritory;
    let useableAir = territory.airForCurrentTerritory;
    let useableNaval = territory.navalForCurrentTerritory;

    let shortfall = territory.oilDemand - territory.oilForCurrentTerritory;
    const rotation = ["naval", "air", "assault"];
    let index = 0;

    while (shortfall > 0) {
        const type = rotation[index];
        if (type === "naval" && useableNaval > 0) {
            useableNaval--;
            shortfall -= oilRequirements.naval;
        } else if (type === "air" && useableAir > 0) {
            useableAir--;
            shortfall -= oilRequirements.air;
        } else if (type === "assault" && useableAssault > 0) {
            useableAssault--;
            shortfall -= oilRequirements.assault;
        } else if (useableNaval === 0 && useableAir === 0 && useableAssault === 0) {
            //Nothing left to ground. Without this the loop spins forever on a territory
            //whose oil demand outlives its vehicles -- reachable through a scenario, and
            //through a disaster that empties the oil in the same turn a fleet is bought.
            break;
        }
        index = (index + 1) % rotation.length;
    }

    const useable = {
        infantryForCurrentTerritory: territory.infantryForCurrentTerritory,
        useableAssault: useableAssault,
        useableAir: useableAir,
        useableNaval: useableNaval
    };
    return {
        useableAssault: useableAssault,
        useableAir: useableAir,
        useableNaval: useableNaval,
        armyForCurrentTerritory: armyTotalFor(useable)
    };
}

/**
 * Defence bonus from a territory's forts.
 *
 * Quadratic in the fort count, scaled by the development index, plus a fixed bonus for being
 * land-locked. Written out inline in three places before Phase 5.2, which is how a siege and
 * a purchase could disagree about a territory's defence.
 */
export function defenseBonusFor(territory) {
    return Math.ceil(
        (territory.fortsBuilt * (territory.fortsBuilt + 1) * FORT_DEFENSE_SCALE) *
        parseFloat(territory.devIndex) +
        territory.isLandLockedBonus);
}

/**
 * Sum a set of territories' EFFECTIVE capacities.
 *
 * `bonusFor` is injected rather than looked up, because a continent bonus is a fact about the
 * whole world -- who else holds what -- and this module is pure and runs in Node. The caller
 * that has the store in scope passes `continentCapacityBonusFor` from
 * `src/state/continentBonus.js`; the default is "no bonus", which is today's game.
 *
 * @param {object[]} territories
 * @param {(territory: object) => number} [bonusFor]
 */
export function totalCapacities(territories, bonusFor = () => 1) {
    return territories.reduce((totals, territory) => {
        const bonus = bonusFor(territory);
        return {
            totalOilCapacity: totals.totalOilCapacity +
                effectiveCapacityFor(territory, "oil", bonus),
            totalFoodCapacity: totals.totalFoodCapacity +
                effectiveCapacityFor(territory, "food", bonus),
            totalConsMatsCapacity: totals.totalConsMatsCapacity +
                effectiveCapacityFor(territory, "consMats", bonus)
        };
    }, { totalOilCapacity: 0, totalFoodCapacity: 0, totalConsMatsCapacity: 0 });
}

/**
 * Sum a set of territories' demands.
 * @param {object[]} territories
 */
export function totalDemands(territories) {
    return territories.reduce((totals, territory) => ({
        totalOilDemand: totals.totalOilDemand + territory.oilDemand,
        totalFoodConsumption: totals.totalFoodConsumption + territory.foodConsumption
    }), { totalOilDemand: 0, totalFoodConsumption: 0 });
}
