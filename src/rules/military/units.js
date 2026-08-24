// Units: the four types, what they are worth, and how an army is weighed.
//
// Refactor plan Phase 5.3. Pure.
//
// An "army array" throughout `rules/military` is four numbers in this order:
// [infantry, assault, air, naval]. It is the shape the battle code has always used and the
// shape the UI reads back, so it stays -- but the index is never written as a bare number
// here, because `defendingArmyRemaining[1 + Math.floor(...)]` instead of
// `defendingArmyRemaining[1] + Math.floor(...)` is exactly how a siege arrest set a
// territory's army to NaN, permanently (Phase 4.7, defect AL).

import { vehicleArmyPersonnelWorth, armyGoldPrices, armyProdPopPrices } from "../../config/balance.js";

/** The four unit types, in army-array order. */
export const UNIT_TYPES = Object.freeze(["infantry", "assault", "air", "naval"]);

/** Index of a unit type in an army array. */
export const UNIT_INDEX = Object.freeze({ infantry: 0, assault: 1, air: 2, naval: 3 });

/** Personnel worth per army-array slot, so an army array can be weighed by index. */
export const PERSONNEL_WORTH_BY_INDEX = Object.freeze(
    UNIT_TYPES.map((type) => vehicleArmyPersonnelWorth[type]));

/**
 * An army array as a single number: everyone it carries.
 *
 * This is the figure every rout and last-push threshold is measured against, and the figure
 * a territory's `armyForCurrentTerritory` holds.
 *
 * @param {number[]} army  [infantry, assault, air, naval]
 * @returns {number}
 */
export function combinedForce(army) {
    return UNIT_TYPES.reduce(
        (total, type, index) => total + (army[index] ?? 0) * PERSONNEL_WORTH_BY_INDEX[index], 0);
}

/** Total head count of an army array, ignoring what each unit is worth. */
export function unitCount(army) {
    return army.reduce((total, count) => total + count, 0);
}

/** True when an army has nothing left anywhere. */
export function isDestroyed(army) {
    return army.every((count) => count === 0);
}

/** Gold to buy one of each type in the quantities given. */
export function goldCostOf(army) {
    return UNIT_TYPES.reduce((total, type, index) => total + (army[index] ?? 0) * armyGoldPrices[type], 0);
}

/** Productive population to crew the quantities given. */
export function prodPopCostOf(army) {
    return UNIT_TYPES.reduce((total, type, index) => total + (army[index] ?? 0) * armyProdPopPrices[type], 0);
}
