// Siege and war objects reference a territory; they no longer copy one.
//
// Phase 4.7. A siege used to be created with
//
//     defendingTerritory: { ...theTerritory }
//
// -- a shallow copy taken at the moment the siege began. From then on there were two
// territories: the one the map and the economy used, and the one the siege damaged.
// Keeping them together was the job of a scattering of manual sync-backs:
// `setMainArrayToArmyRemaining()`, the `farmsBuilt`/`forestsBuilt`/`oilWellsBuilt`/
// `fortsBuilt` copy-back loops in `battle.js`, and the food/population write-back in
// `resourceCalculations.js`. Miss one and a siege quietly diverged from the world.
// See docs/01-codebase-audit.md section 3 and section 5.1 AD.
//
// A siege now stores `defendingTerritoryId` and exposes `defendingTerritory` as a
// live lookup into `GameState`. Every existing reader -- and there are around sixty
// of `siege.defendingTerritory.something` -- keeps working unchanged, but now reads
// and writes the one real territory. There is nothing left to sync back.
//
// The property is defined rather than assigned so it cannot be overwritten by an
// `Object.assign` without the caller meaning to, and it stays enumerable so the
// `?e2e=1` snapshot and any future `JSON.stringify` save still see the territory.

import { getTerritory } from "./selectors.js";

/**
 * Give `holder` a `defendingTerritoryId` and a live `defendingTerritory`.
 *
 * @param {object} holder  a siege or historic-war object
 * @param {string|number|object} territoryOrId  the territory, or its uniqueId
 * @returns {object} the same holder
 */
export function referenceDefendingTerritory(holder, territoryOrId) {
    const uniqueId =
        territoryOrId && typeof territoryOrId === "object"
            ? territoryOrId.uniqueId
            : territoryOrId;

    holder.defendingTerritoryId = uniqueId === undefined || uniqueId === null
        ? null
        : String(uniqueId);

    Object.defineProperty(holder, "defendingTerritory", {
        get() {
            return getTerritory(this.defendingTerritoryId);
        },
        enumerable: true,
        configurable: true
    });

    return holder;
}

/** Does this object reference a territory that still exists? */
export function referencesLiveTerritory(holder) {
    return Boolean(holder && getTerritory(holder.defendingTerritoryId));
}
