// One consistent way to write a garrison.
//
// Known-issue BJ. `armyForCurrentTerritory` is a STORED total, not a derived one, and before BJ
// was closed the AI maintained it by hand in six places and got it wrong in four of them:
//
//   * `doAttack()` subtracted the seven unit counts and never touched the total;
//   * `setSiege()` subtracted `useableAir` but not `airForCurrentTerritory`, on the store half
//     only -- the copy beside it had the line;
//   * the conquest path wrote the four counts and left the DEFEATED owner's `useable*` figures
//     and total standing;
//   * `musterAiArmies()` adjusted the total by the same delta as the infantry, which carries an
//     existing inconsistency forward for as long as the country keeps reinforcing.
//
// None of it threw. The battles were resolved correctly against the force that was actually
// sent, every turn completed, and the only witness was a number in the info panel: India at
// minus six and a half billion after 150 headless turns.
//
// Two invariants, and they are why this is a function rather than a convention:
//
//   * **No count may go negative.** A garrison the world cannot field is not a debt to be
//     repaid later; the force simply is not there.
//   * **`useable*` may never exceed the count it gates.** It is the oil gate. The player's half
//     rebuilds it every turn from oil demand (`setPlayerUseableNotUseableWeaponsDueToOilDemand()`),
//     but the AI has no equivalent and maintains it incrementally -- so a `useableAir` inherited
//     from a previous owner is aircraft the AI can spend and does not have, which is how the
//     counts went negative in the first place.
//
// This module is pure and imports only `config/`, so it runs in Node (CLAUDE.md, Phase 5).

import { vehicleArmyPersonnelWorth } from "../../config/balance.js";

const count = (value) => Math.max(0, Math.round(Number(value) || 0));

/**
 * A territory's four unit counts and its three oil-gated figures, in one object.
 *
 * @param {object} territory
 * @returns {{infantry: number, assault: number, air: number, naval: number,
 *            useable: {assault: number, air: number, naval: number}}}
 */
export function garrisonOf(territory) {
    return {
        infantry: Number(territory?.infantryForCurrentTerritory) || 0,
        assault: Number(territory?.assaultForCurrentTerritory) || 0,
        air: Number(territory?.airForCurrentTerritory) || 0,
        naval: Number(territory?.navalForCurrentTerritory) || 0,
        useable: {
            assault: Number(territory?.useableAssault) || 0,
            air: Number(territory?.useableAir) || 0,
            naval: Number(territory?.useableNaval) || 0
        }
    };
}

/**
 * The eight fields a garrison is, computed so that they cannot disagree.
 *
 * `useable` is optional and defaults to "all of them", which is what a garrison that has just
 * arrived or just been written from scratch means -- every vehicle that marched in is here.
 * Where a caller is adjusting an existing garrison it passes the useable figures it worked out,
 * and they are capped at the counts.
 *
 * @param {{infantry: number, assault: number, air: number, naval: number,
 *          useable?: {assault: number, air: number, naval: number}}} garrison
 * @returns {Record<string, number>} a patch, suitable for `state/mutations.js`
 */
export function garrisonFields(garrison) {
    const infantry = count(garrison.infantry);
    const assault = count(garrison.assault);
    const air = count(garrison.air);
    const naval = count(garrison.naval);

    const wanted = garrison.useable ?? { assault, air, naval };
    const useableAssault = Math.min(assault, count(wanted.assault));
    const useableAir = Math.min(air, count(wanted.air));
    const useableNaval = Math.min(naval, count(wanted.naval));

    return {
        infantryForCurrentTerritory: infantry,
        assaultForCurrentTerritory: assault,
        airForCurrentTerritory: air,
        navalForCurrentTerritory: naval,
        useableAssault: useableAssault,
        useableAir: useableAir,
        useableNaval: useableNaval,
        //The total counts the USEABLE vehicles, the same definition `armyTotalFor()` uses:
        //a grounded aircraft is not force in the field.
        armyForCurrentTerritory: infantry +
            (useableAssault * vehicleArmyPersonnelWorth.assault) +
            (useableAir * vehicleArmyPersonnelWorth.air) +
            (useableNaval * vehicleArmyPersonnelWorth.naval)
    };
}

/**
 * Write a garrison onto an object in place, and return it.
 *
 * Mutating is what the callers need: the AI holds a store territory, a shallow copy the goal
 * loop will patch back, or the `returning` object a lifted siege is assembled into, and all
 * three are objects it already has.
 */
export function writeGarrison(target, garrison) {
    return Object.assign(target, garrisonFields(garrison));
}

/**
 * The same fields as a patch, for the paths that write through `state/mutations.js`.
 *
 * `updateTerritory()` takes a field -> value patch and emits only what actually changed, so a
 * caller cannot hand it a mutated object -- it has to say what the new garrison IS. This builds
 * that from the territory plus whichever counts are changing.
 */
export function garrisonPatch(territory, overrides = {}) {
    const current = garrisonOf(territory);
    return garrisonFields({
        infantry: overrides.infantry ?? current.infantry,
        assault: overrides.assault ?? current.assault,
        air: overrides.air ?? current.air,
        naval: overrides.naval ?? current.naval,
        useable: overrides.useable ?? current.useable
    });
}
