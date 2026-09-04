// The path renders the truth.
//
// Six attributes on the SVG territory paths -- `owner`, `data-name`, `deactivated`,
// `underSiege`, `greyedOut` and `attackableTerritory` -- used to BE the game state.
// Code wrote them, other code read them back, and the territory model held a second
// copy that had to be assigned on the next line and often was not. See
// docs/01-codebase-audit.md section 3 and docs/archived/03-refactor-plan.md Phase 4.4.
//
// Since Phase 4 the store is the truth and these attributes are output. This module
// is the one place that writes them, driven by `state/events.js`, so:
//
//   * the map cannot disagree with the model -- there is nothing to keep in step;
//   * `normalizeSiegeState()`, which existed to reconcile `underSiege` against the
//     siege lists every turn, has nothing left to reconcile (Phase 4.5);
//   * the e2e suite can keep asserting on the attributes, because they still say
//     exactly what they always said.
//
// Reading them back is what stops here. `state/pathState.js` answers those questions
// from the store instead, and Phase 6.7 is what finally drops the attributes.

import { Events, on } from "../state/events.js";
import { getPathByUniqueId, isPathIndexBuilt } from "../state/indexes.js";
import {
    aiSieges,
    allTerritories,
    getTerritoryByName,
    isAttackable,
    isCountryGreyedOut,
    isUnderSiege,
    territoriesReady
} from "../state/selectors.js";
import { renderSiegeOverlay } from "../ui/siegeOverlay.js";

let started = false;

function boolAttribute(path, name, value) {
    path.setAttribute(name, value ? "true" : "false");
}

/**
 * Write every rendered attribute for one territory.
 * @param {object} territory
 */
export function renderTerritory(territory) {
    if (!territory || !isPathIndexBuilt()) {
        return;
    }
    const path = getPathByUniqueId(territory.uniqueId);
    if (!path) {
        return;
    }
    if (territory.owner !== undefined && territory.owner !== null) {
        path.setAttribute("owner", territory.owner);
    }
    if (territory.dataName !== undefined && territory.dataName !== null) {
        path.setAttribute("data-name", territory.dataName);
    }
    boolAttribute(path, "deactivated", territory.isDeactivated === true);
    boolAttribute(path, "greyedOut", isCountryGreyedOut(territory.dataName));
    boolAttribute(path, "attackableTerritory", isAttackable(territory.uniqueId));

    const underSiege = isUnderSiege(territory.territoryName);
    boolAttribute(path, "underSiege", underSiege);
    renderSiegeOverlay(
        path,
        territory.territoryName,
        underSiege,
        Object.prototype.hasOwnProperty.call(aiSieges(), territory.territoryName)
    );
}

/** Write every rendered attribute for every territory. */
export function renderAllTerritories() {
    if (!territoriesReady() || !isPathIndexBuilt()) {
        return;
    }
    for (const territory of allTerritories()) {
        renderTerritory(territory);
    }
}

/**
 * Subscribe to the store. Idempotent, so a second bootstrap does not double-write.
 *
 * Call once the path index and the territory model both exist; `renderAllTerritories()`
 * runs immediately so the map starts from a known state rather than from whatever the
 * SVG file happened to ship with.
 */
export function startMapAttributeSync() {
    if (started) {
        renderAllTerritories();
        return;
    }
    started = true;

    on(Events.TERRITORY_CHANGED, ({ territory }) => renderTerritory(territory));

    on(Events.SIEGE_CHANGED, ({ territoryName }) => {
        // Only the besieged territory can have changed, so this is one write rather
        // than the full-map sweep normalizeSiegeState() did every turn.
        const territory = getTerritoryByName(territoryName);
        if (territory) {
            renderTerritory(territory);
        }
    });

    // Both selection sets are replaced wholesale, and both are rare (the country
    // screen once, the attack highlight on a click), so a full sweep is fine.
    on(Events.SELECTION_CHANGED, () => renderAllTerritories());

    renderAllTerritories();
}

/** Test seam. */
export function __resetMapAttributeSyncForTests() {
    started = false;
}
