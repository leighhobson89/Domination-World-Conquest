// What a territory is WORTH having -- as distinct from how hard it is to take.
//
// Moved out of `targeting.js` (which still re-exports it, so every existing importer and its
// tests are unaffected) because two modules need it and importing one from the other would
// have closed a cycle: `targeting.js` imports `strategy.js`, `strategy.js` imports
// `theatre.js`, and `theatre.js` needs exactly this one function to decide which neighbouring
// country is worth absorbing. A leaf module with no imports of its own ends the argument.
//
// Deliberately NOT a measure of military strength -- that is what the odds already say. This
// is what OWNING it does for you, which is the fact the AI had no representation of at all: a
// developed European territory is worth several times a bare island of the same size.

import { targetValueWeights } from "../config/balance.js";

/**
 * What a territory is worth having, on a roughly 0..1 scale.
 *
 * @param {object} territory
 * @returns {number}
 */
export function territoryValue(territory) {
    if (!territory) {
        return 0;
    }
    const weights = targetValueWeights;
    const area = Math.min(1, (Number(territory.area) || 0) / weights.areaSaturation);
    const buildings = (territory.farmsBuilt ?? 0) + (territory.forestsBuilt ?? 0) +
        (territory.oilWellsBuilt ?? 0);
    const resources = Math.min(1, buildings / 9);

    return (Number(territory.continentModifier) || 0.5) * weights.continentModifier +
        (Number(territory.devIndex) || 0.5) * weights.devIndex +
        area * weights.area +
        resources * weights.resources;
}
