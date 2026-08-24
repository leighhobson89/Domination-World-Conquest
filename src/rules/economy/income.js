// Per-turn resource income: gold, oil, food and construction materials.
//
// Refactor plan Phase 5.2. Pure: `(territory, context) -> delta`. Nothing here writes to a
// territory, touches the DOM or reads a module global -- the random event, which used to be
// read straight off `gameTurnsLoop.js`, arrives in the context.
//
// The three commodity resources all work the same way: a territory holds a stock, has a
// capacity, and moves towards the capacity each turn -- faster upwards than downwards, so
// recovery outpaces spoilage. Gold is different: it is earned rather than stored, from the
// productive population, and is the only income the army is a drain on.

import {
    FOOD_UNIT_SCALE,
    goldContinentModifiers,
    goldIncome as goldIncomeBalance,
    resourceRegeneration
} from "../../config/balance.js";

/**
 * @typedef {object} EconomyContext
 * @property {boolean} randomEventHappening  is a disaster in progress this turn
 * @property {string} randomEvent            which one, if so
 * @property {boolean} [isSimulation]        true when costing a hypothetical purchase, which
 *                                           suppresses disaster damage
 */

/** The default context: a quiet turn. */
export const QUIET_TURN = Object.freeze({ randomEventHappening: false, randomEvent: "" });

/**
 * How a stock moves towards its capacity in one turn.
 *
 * Below capacity it recovers `growth` of the shortfall; above it, it loses `decay` of the
 * excess. A disaster turn suppresses both -- the player gets a turn to react to the loss
 * before regeneration papers over it.
 *
 * @param {number} stock
 * @param {number} capacity
 * @param {{growth: number, decay: number}} rates
 * @param {EconomyContext} context
 * @returns {number} the change, in stock units
 */
export function regenerationTowardsCapacity(stock, capacity, rates, context) {
    if (context.randomEventHappening) {
        return 0;
    }
    if (capacity > stock) {
        return Math.ceil((capacity - stock) * rates.growth);
    }
    if (capacity < stock) {
        return -Math.ceil((stock - capacity) * rates.decay);
    }
    return 0;
}

/** Construction materials earned or spoiled this turn. */
export function consMatsChangeFor(territory, context = QUIET_TURN) {
    return regenerationTowardsCapacity(
        territory.consMatsForCurrentTerritory,
        territory.consMatsCapacity,
        resourceRegeneration.consMats,
        context);
}

/** Oil pumped or lost this turn. */
export function oilChangeFor(territory, context = QUIET_TURN) {
    return regenerationTowardsCapacity(
        territory.oilForCurrentTerritory,
        territory.oilCapacity,
        resourceRegeneration.oil,
        context);
}

/**
 * Food grown or spoiled this turn.
 *
 * Food is the one resource stored in scaled units -- one unit feeds `FOOD_UNIT_SCALE`
 * people -- so the comparison happens in people and the answer is converted back.
 */
export function foodChangeFor(territory, context = QUIET_TURN) {
    const change = regenerationTowardsCapacity(
        territory.foodForCurrentTerritory * FOOD_UNIT_SCALE,
        territory.foodCapacity,
        resourceRegeneration.food,
        context);
    return change / FOOD_UNIT_SCALE;
}

/**
 * Gold earned this turn, before army maintenance.
 *
 * A mutiny suppresses income entirely for the turn -- the damage it does to the stock is
 * separate, and lives in `rules/events/randomEvents.js`.
 *
 * audit 5.2 AJ: `log10` of a negative is NaN and `log10(1)` is 0, so an emptied territory
 * used to produce either NaN or a division by zero -- and one NaN in a gold balance never
 * recovers. Nothing productive left means nothing earned, which is also the honest answer.
 *
 * audit 5.2 P: the area term read `Math.max(territory.area / 10000000), 1` -- `Math.max` of
 * one argument returns that argument and the comma operator then discarded it and yielded 1,
 * so territory AREA had no effect on gold income at all.
 */
export function goldChangeFor(territory, context = QUIET_TURN) {
    if (context.randomEventHappening && context.randomEvent === "Mutiny") {
        return 0;
    }

    const continentModifier = goldContinentModifiers[territory.continent];
    const areaScalingFactor = Math.log10(Math.max(0, territory.area) + 1);
    const populationScalingFactor = Math.log10(Math.max(0, territory.productiveTerritoryPop) + 1);
    const areaBonus = Math.max(territory.area / goldIncomeBalance.areaDivisor, 1);

    const raw = areaBonus *
        parseFloat(territory.devIndex) *
        continentModifier *
        (territory.productiveTerritoryPop * goldIncomeBalance.productivePopRate);

    const modifier = areaScalingFactor * populationScalingFactor;
    const scaled = modifier > 0 ? Math.ceil(raw / modifier) * goldIncomeBalance.scale : 0;

    //Normalised onto a fixed window so that the gap between the smallest and largest
    //economies stays playable. Without it a territory's income tracks its raw size, and
    //the map's biggest countries snowball out of reach on turn one.
    const normalised = (scaled - goldIncomeBalance.normaliseMin) /
        (goldIncomeBalance.normaliseMax - goldIncomeBalance.normaliseMin);
    return normalised * 100;
}
