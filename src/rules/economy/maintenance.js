// Army upkeep.
//
// Refactor plan Phase 5.2. Pure.
//
// audit 5.2 R: this was fully implemented and then commented out of the turn loop, so
// standing armies were free. That removed the principal economic brake on militarisation and
// made a permanent siege costless. It was re-enabled in Phase 3.16, and the rates in
// `config/balance.js` were re-tuned at the same time -- at the original rates every major
// power was bankrupt inside forty turns with no way to respond.

import { armyCostPerTurn, INITIAL_ARMY_ADJUSTMENT_COST_PER_UNIT } from "../../config/balance.js";

/**
 * Gold a territory owes in upkeep this turn.
 *
 * Charged on USEABLE vehicles, not on owned ones: a unit grounded for want of oil is not
 * also billed for. Infantry are charged on the full count, because there is no such thing
 * as an unuseable infantryman.
 *
 * @param {object} territory
 * @returns {number}
 */
export function armyMaintenanceFor(territory) {
    return territory.infantryForCurrentTerritory * armyCostPerTurn.infantry +
        territory.useableAssault * armyCostPerTurn.assault +
        territory.useableAir * armyCostPerTurn.air +
        territory.useableNaval * armyCostPerTurn.naval;
}

/**
 * Upkeep used when sizing a country's opening army, which is charged on a single head count
 * rather than per unit type -- the split into unit types has not happened yet at that point.
 */
export function initialArmyAdjustmentCost(totalArmyForCountry) {
    return totalArmyForCountry * INITIAL_ARMY_ADJUSTMENT_COST_PER_UNIT;
}
