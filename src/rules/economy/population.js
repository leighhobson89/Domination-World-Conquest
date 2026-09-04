// Population: how many people a territory has, how many of them work, and what a famine
// does to them.
//
// Refactor plan Phase 5.2. Pure: no DOM, no store, no writes. Everything here takes a
// territory-shaped object and returns numbers or a plan; the caller applies them through
// `state/mutations.js`.
//
// The territory-shaped object is anything with the fields named below -- a real territory,
// a scenario fixture, or a plain object in a unit test. Nothing here looks the territory up.

import {
    FOOD_UNIT_SCALE,
    PRODUCTIVE_POP_PERCENT,
    population as populationBalance,
    vehicleArmyPersonnelWorth
} from "../../config/balance.js";

/**
 * The productive population for a given head count and development index.
 *
 * `PRODUCTIVE_POP_PERCENT` of the population is of working age; the development index is
 * how much of that is actually productive. This formula was written out inline in five
 * places, twice with a different sign on the population it was given (audit 5.1 F).
 *
 * @param {number} population
 * @param {number|string} devIndex
 * @returns {number}
 */
export function productivePopulationFor(population, devIndex) {
    return ((population / 100) * PRODUCTIVE_POP_PERCENT) * parseFloat(devIndex);
}

/** The productive population a territory has right now. */
export function productivePopulationOf(territory) {
    return productivePopulationFor(territory.territoryPopulation, territory.devIndex);
}

/**
 * Everyone a territory has to feed: the civilians plus the army, with each vehicle counted
 * as the crew it carries.
 *
 * Note that this counts the ARMY as bought, not as useable -- a grounded aircraft still has
 * a crew that eats.
 */
export function fedPopulationOf(territory) {
    return territory.territoryPopulation +
        territory.infantryForCurrentTerritory +
        (territory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) +
        (territory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) +
        (territory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
}

/** What one turn's food consumption comes to. */
export function foodConsumptionOf(territory) {
    return territory.territoryPopulation + territory.armyForCurrentTerritory;
}

/**
 * Whether a territory cannot feed everyone it has to feed.
 *
 * Separate from `populationChangeFor()` because a besieged territory rolls for whether the
 * garrison starves ahead of the civilians, and that roll happens exactly when this is true
 * -- which is not the same as "the population change came out negative": a territory whose
 * civilians are already all dead is still starving, and still costs its garrison.
 */
export function isStarving(territory) {
    return territory.foodForCurrentTerritory * FOOD_UNIT_SCALE < fedPopulationOf(territory);
}

/**
 * How the population would change this turn on food alone.
 *
 * Positive is growth, negative is famine. Growth is capped by the food surplus, so a
 * territory cannot grow past what it can feed; famine is capped three ways -- by the size of
 * the shortage, by the fed population, and by the civilian population, because the change is
 * applied to the civilians alone (audit 5.2 AJ: without the third cap a famine could kill
 * more civilians than the territory had and drive the count negative).
 *
 * @param {object} territory
 * @returns {number}
 */
export function populationChangeFor(territory) {
    const fedPopulation = fedPopulationOf(territory);
    const devIndex = parseFloat(territory.devIndex);
    const food = territory.foodForCurrentTerritory * FOOD_UNIT_SCALE;

    if (food < fedPopulation) {
        const foodShortage = Math.ceil((fedPopulation - food) / populationBalance.shortagePerDeathRoll);
        const deathRate = Math.round(
            populationBalance.deathRateScale * (1 - devIndex) * populationBalance.deathRateFactor);
        return -Math.min(foodShortage * deathRate, fedPopulation, territory.territoryPopulation);
    }

    const maxGrowth = food - fedPopulation;
    const growthPotential = Math.floor(devIndex * fedPopulation * populationBalance.growthRate);
    return Math.min(maxGrowth, growthPotential);
}

/**
 * Whether the army should starve instead of the civilians.
 *
 * It should when applying the change would leave the territory with a negative productive
 * population -- meaning the army is already larger than the workforce that supports it.
 *
 * audit 5.1 F: this simulation used to SUBTRACT the population change, which is negative
 * during a famine, so the simulated population went up exactly when it should have gone
 * down. The branch never fired during an actual famine and fired spuriously during growth.
 *
 * @param {object} territory
 * @param {number} populationChange  the change from `populationChangeFor()`
 */
export function armyStarvesInstead(territory, populationChange) {
    const simulated =
        productivePopulationFor(territory.territoryPopulation + populationChange, territory.devIndex) -
        territory.armyForCurrentTerritory;
    return simulated < 0;
}

/**
 * What a besieged territory's famine costs its army rather than its civilians.
 *
 * A siege starves the garrison in proportion to how much of the territory the garrison is,
 * amplified because a besieged army has no supply line.
 */
export function siegeArmyStarvationChange(territory, populationChange) {
    const proportion = territory.armyForCurrentTerritory / territory.territoryPopulation;
    return Math.floor(proportion * populationChange) * populationBalance.siegeArmyStarvationFactor;
}

/**
 * Work out which units a famine takes, without taking them.
 *
 * Infantry starve first, then the useable vehicles in order of how many people they carry
 * -- assault, air, naval -- because a vehicle whose crew has starved is not useable, but the
 * vehicle itself is not destroyed. Returns the new absolute counts, so the caller writes
 * them rather than computing a second time.
 *
 * audit 5.2 AJ: the legacy version zeroed the infantry and ate into the vehicles but never
 * touched `armyForCurrentTerritory`, so the total drifted away from the units it summarises
 * -- observed at -32,263 on a territory still holding 549,615 infantry. The army total here
 * is always recomputed from what is left.
 *
 * @param {object} territory
 * @param {number} populationChange  negative; its magnitude is the number of people lost
 * @returns {{infantryForCurrentTerritory: number, useableAssault: number,
 *            useableAir: number, useableNaval: number, armyForCurrentTerritory: number}}
 */
export function planArmyStarvation(territory, populationChange) {
    const losses = Math.abs(populationChange);

    if (territory.infantryForCurrentTerritory > losses) {
        return {
            infantryForCurrentTerritory: Math.max(0, territory.infantryForCurrentTerritory - losses),
            useableAssault: territory.useableAssault,
            useableAir: territory.useableAir,
            useableNaval: territory.useableNaval,
            armyForCurrentTerritory: Math.max(0, territory.armyForCurrentTerritory - losses)
        };
    }

    let remaining = losses - territory.infantryForCurrentTerritory;
    const survivors = {
        infantryForCurrentTerritory: 0,
        useableAssault: territory.useableAssault,
        useableAir: territory.useableAir,
        useableNaval: territory.useableNaval
    };

    for (const [field, type] of [
        ["useableAssault", "assault"],
        ["useableAir", "air"],
        ["useableNaval", "naval"]
    ]) {
        const worth = vehicleArmyPersonnelWorth[type];
        const available = survivors[field] * worth;
        if (remaining > 0 && remaining < available) {
            const lost = Math.min(Math.ceil(remaining / worth), survivors[field]);
            survivors[field] -= lost;
            remaining -= lost * worth;
        } else {
            //KNOWN DEFECT, preserved deliberately (docs/04-known-issues.md, Phase 5.2 note).
            //`remaining === 0` reaches this branch, so a famine that exactly matches the
            //infantry wipes out every vehicle as well. The extraction is behaviour-
            //preserving by design; fixing it is a balance change and belongs in its own
            //commit, not inside a move.
            remaining -= available;
            survivors[field] = 0;
        }
    }

    survivors.armyForCurrentTerritory = Math.max(0,
        survivors.infantryForCurrentTerritory +
        (survivors.useableAssault * vehicleArmyPersonnelWorth.assault) +
        (survivors.useableAir * vehicleArmyPersonnelWorth.air) +
        (survivors.useableNaval * vehicleArmyPersonnelWorth.naval));

    return survivors;
}
