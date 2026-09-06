// Army upkeep.
//
// Refactor plan Phase 5.2. Pure.
//
// audit 5.2 R: this was fully implemented and then commented out of the turn loop, so
// standing armies were free. That removed the principal economic brake on militarisation and
// made a permanent siege costless. It was re-enabled in Phase 3.16, and the rates in
// `config/balance.js` were re-tuned at the same time -- at the original rates every major
// power was bankrupt inside forty turns with no way to respond.

import {
    ARMY_DESERTION_RATE,
    armyCostPerTurn,
    INITIAL_ARMY_ADJUSTMENT_COST_PER_UNIT
} from "../../config/balance.js";
import { planArmyStarvation } from "./population.js";

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

/**
 * What a territory could not pay of this turn's upkeep, in gold.
 *
 * The income pass clamps the treasury at zero (`Math.max(0, gold + change)`), which is what
 * made unpaid upkeep costless: the shortfall was simply discarded. This is that discarded
 * number, recovered before the clamp throws it away.
 *
 * @param {number} goldHeld       the treasury BEFORE this turn's change is applied
 * @param {number} goldChange     this turn's net change, upkeep already subtracted from it
 * @returns {number}  gold owed and not paid; zero when the territory covered its bill
 */
export function upkeepShortfall(goldHeld, goldChange) {
    const balance = (Number(goldHeld) || 0) + (Number(goldChange) || 0);
    return balance < 0 ? -balance : 0;
}

/**
 * Who deserts when the upkeep is not paid.
 *
 * The share of the army that leaves is the share of the BILL that went unpaid, times
 * `ARMY_DESERTION_RATE`. That is self-limiting by construction -- miss a tenth of the bill,
 * lose a tenth of the army, and next turn the bill is a tenth smaller -- so a territory
 * converges on the army it can afford rather than collapsing, and the rule needs no separate
 * argument for why it terminates.
 *
 * The walk is `planArmyStarvation()`, so deserters come out of the infantry first and the
 * crews last. That is deliberate rather than convenient: an unpaid soldier goes home, and a
 * vehicle is a smaller number of people to keep.
 *
 * Returns null when nothing deserts, so the caller can skip the write entirely -- a no-op
 * patch through `mutations.js` would still emit a TERRITORY_CHANGED for every solvent
 * territory on the map, every turn.
 *
 * @param {object} territory
 * @param {number} shortfall   gold owed and not paid, from `upkeepShortfall()`
 * @returns {object|null}  the same shape `planArmyStarvation()` returns
 */
export function planArmyDesertion(territory, shortfall) {
    const owed = armyMaintenanceFor(territory);
    if (!(shortfall > 0) || !(owed > 0)) {
        return null;
    }

    //Capped at the whole bill: a territory can be short by more than its upkeep (its other
    //costs are in the same number), and an uncapped share would desert an army several times
    //over on one bad turn.
    const unpaidShare = Math.min(1, shortfall / owed);
    const losses = Math.floor(
        (Number(territory.armyForCurrentTerritory) || 0) * unpaidShare * ARMY_DESERTION_RATE);
    if (losses <= 0) {
        return null;
    }
    return planArmyStarvation(territory, -losses);
}
