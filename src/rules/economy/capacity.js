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
 * Sum a set of territories' capacities.
 * @param {object[]} territories
 */
export function totalCapacities(territories) {
    return territories.reduce((totals, territory) => ({
        totalOilCapacity: totals.totalOilCapacity + territory.oilCapacity,
        totalFoodCapacity: totals.totalFoodCapacity + territory.foodCapacity,
        totalConsMatsCapacity: totals.totalConsMatsCapacity + territory.consMatsCapacity
    }), { totalOilCapacity: 0, totalFoodCapacity: 0, totalConsMatsCapacity: 0 });
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
