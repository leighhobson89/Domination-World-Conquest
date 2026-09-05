// Territory upgrades: what one costs, and what it does to the territory.
//
// Economy phase, stage 1.1. Pure -- it takes a territory-shaped object and returns numbers or
// a patch, and the caller writes the patch through `state/mutations.js`. Imports only
// `config/` and its own sibling `capacity.js`, so it runs in Node like the rest of
// `src/rules/economy/`.
//
// It exists because there was no such thing, and the consequences were the largest defects in
// docs/05-economy-audit.md:
//
//   E1  The AI's upgrades raised NO capacity at all. The only upgrade-driven writes to
//       `foodCapacity` / `consMatsCapacity` / `oilCapacity` in the whole codebase were in
//       `addPlayerUpgrades()`, on the player's path, so every farm, forest and oil well the
//       AI ever bought was a pure cost -- and its own "should I build another?" logic reads a
//       ceiling that therefore never moved.
//   E2  The AI's forts never recomputed `defenseBonus`, so an AI fort did not move the die
//       band that forts exist to move.
//   E5  Six copies of the price formula, of which one disagreed.
//
// All three are the same defect wearing three hats: an upgrade was a thing each caller
// re-implemented rather than a thing the rules could do. There is one definition now, and both
// the player and the AI go through it.

import {
    maxFarms,
    maxForests,
    maxForts,
    maxOilWells,
    territoryUpgradeBaseCostsConsMats,
    territoryUpgradeBaseCostsGold
} from "../../config/balance.js";
import { defenseBonusFor } from "./capacity.js";

/**
 * Everything that differs between the four upgrades, in one table.
 *
 * Named once because five call sites have to agree about it, and because a typo in a field
 * name reads back as a capacity of zero rather than as an error -- the same reasoning as
 * `CAPACITY_FIELDS` in `capacity.js`.
 *
 * `consMatsExponentScale` is 1.1 for a farm and 1.05 for everything else. That is not a
 * rounding: it is in all five of the copies this module replaced, including the AI's, so it is
 * behaviour and is preserved rather than tidied.
 */
export const UPGRADES = Object.freeze({
    farm: Object.freeze({
        built: "farmsBuilt", capacity: "foodCapacity", max: maxFarms, consMatsExponentScale: 1.1
    }),
    forest: Object.freeze({
        built: "forestsBuilt", capacity: "consMatsCapacity", max: maxForests, consMatsExponentScale: 1.05
    }),
    oilWell: Object.freeze({
        built: "oilWellsBuilt", capacity: "oilCapacity", max: maxOilWells, consMatsExponentScale: 1.05
    }),
    //A fort raises no capacity. It is the one upgrade with a direct combat effect, and it is
    //applied as a recomputation of `defenseBonus` rather than as a delta -- there is one
    //defence formula (`defenseBonusFor()`), and known-issue AQ is what a second copy costs.
    fort: Object.freeze({
        built: "fortsBuilt", capacity: null, max: maxForts, consMatsExponentScale: 1.05
    })
});

/** The four kinds, in the order the upgrade table renders them. */
export const UPGRADE_KINDS = Object.freeze(["farm", "forest", "oilWell", "fort"]);

/** How much one upgrade raises the ceiling it acts on. */
export const CAPACITY_GAIN_PER_UPGRADE = 0.10;

/**
 * What the Nth of a kind costs on its own.
 *
 * QUADRATIC in `nth`, which `balance.js` documented as linear until this phase corrected it:
 * `ceil(base * n * (n * 1.05) * devIndex / 4)`. The fifth of a kind is about 26 times the
 * first.
 *
 * `nth` is the number that will be STANDING AFTER the purchase, which is what every correct
 * copy of this formula meant and what the one incorrect copy -- in
 * `calculateAvailableUpgrades()`, which priced everything as a first -- got wrong.
 *
 * A `devIndex` arrives as a string from `initialData.js` in some paths and as a number in
 * others, so it is parsed here rather than at four call sites.
 *
 * @param {"farm"|"forest"|"oilWell"|"fort"} kind
 * @param {number} nth
 * @param {number|string} devIndex
 * @returns {{gold: number, consMats: number}}
 */
export function upgradePriceFor(kind, nth, devIndex) {
    const spec = UPGRADES[kind];
    const count = Number(nth);
    const development = parseFloat(devIndex);
    if (!spec || !Number.isFinite(count) || count <= 0 || !Number.isFinite(development)) {
        return { gold: 0, consMats: 0 };
    }
    const scale = development / 4;
    return {
        gold: Math.ceil(territoryUpgradeBaseCostsGold[kind] * count * (count * 1.05) * scale),
        consMats: Math.ceil(
            territoryUpgradeBaseCostsConsMats[kind] * count *
            (count * spec.consMatsExponentScale) * scale)
    };
}

/**
 * What an ORDER of `quantity` costs, on top of `alreadyBuilt`.
 *
 * KNOWN DISCREPANCY, preserved deliberately -- docs/05-economy-audit.md section 4 E8. This is
 * the price of the LAST one in the order, not the sum of the ladder, because that is what the
 * upgrade table charges today: each row displays `upgradePriceFor(kind, built + quantity)` and
 * the confirm button sums the four displayed cells. So five farms bought in one transaction
 * cost `price(5)` -- about 26x base -- where five bought one a turn cost
 * `price(1) + ... + price(5)`, about 58x. Bulk buying is 2.2 times cheaper, and the AI, which
 * buys one at a time in a loop, pays the full ladder.
 *
 * It is left exactly as it is because stage 1 changes no balance number and this is a balance
 * number. Correcting it belongs in stage 3, where it can be measured. The point of routing it
 * through here is that the discrepancy is now stated once, in a function with a name, instead
 * of being an emergent property of a DOM cell.
 *
 * @param {"farm"|"forest"|"oilWell"|"fort"} kind
 * @param {number} alreadyBuilt
 * @param {number} quantity
 * @param {number|string} devIndex
 * @returns {{gold: number, consMats: number}}
 */
export function upgradeOrderPriceFor(kind, alreadyBuilt, quantity, devIndex) {
    const ordered = Number(quantity) || 0;
    if (ordered <= 0) {
        return { gold: 0, consMats: 0 };
    }
    return upgradePriceFor(kind, (Number(alreadyBuilt) || 0) + ordered, devIndex);
}

/** How many more of `kind` this territory may build. */
export function remainingCapacityFor(territory, kind) {
    const spec = UPGRADES[kind];
    if (!spec || !territory) {
        return 0;
    }
    return Math.max(0, spec.max - (Number(territory[spec.built]) || 0));
}

/**
 * What buying `count` of `kind` does to a territory, as a patch.
 *
 * Returns the new ABSOLUTE values of the fields that change, so the caller writes them rather
 * than computing a second time -- the same contract `planArmyStarvation()` has, and for the
 * same reason: two places computing one number is how they come to disagree.
 *
 * **The capacity gain is +10% of the ceiling BEFORE the transaction, per unit bought, and is
 * not compounded.** Buying three farms is +30%, not 1.1^3. That is audit 5.1 A, which was a
 * catastrophic compounding bug once already -- a fifth farm applied +50% on top of an
 * already-inflated figure -- and it is pinned by a unit test.
 *
 * Returns an empty patch rather than throwing for an unknown kind or a non-positive count, so
 * that a caller costing a hypothetical purchase gets "nothing happens" instead of a NaN
 * written into a capacity.
 *
 * @param {object} territory
 * @param {"farm"|"forest"|"oilWell"|"fort"} kind
 * @param {number} count  how many are being bought in this transaction
 * @returns {object} the fields that change, with their new values
 */
export function applyUpgrade(territory, kind, count) {
    const spec = UPGRADES[kind];
    const bought = Number(count) || 0;
    if (!spec || !territory || bought <= 0) {
        return {};
    }

    const built = (Number(territory[spec.built]) || 0) + bought;
    const patch = { [spec.built]: built };

    if (spec.capacity) {
        const before = Number(territory[spec.capacity]) || 0;
        patch[spec.capacity] = before + (before * CAPACITY_GAIN_PER_UPGRADE * bought);
        return patch;
    }

    //A fort. `defenseBonusFor()` reads `fortsBuilt`, `devIndex` and `isLandLockedBonus`, so it
    //is handed the territory with the new count already in it -- never a fourth copy of the
    //formula, which is known-issue AQ.
    patch.defenseBonus = defenseBonusFor({ ...territory, ...patch });
    return patch;
}
