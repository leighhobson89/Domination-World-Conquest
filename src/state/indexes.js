// O(1) lookups for the SVG territory paths.
//
// Nearly every lookup in the legacy code is a linear scan:
//
//     for (let i = 0; i < paths.length; i++) {
//         if (paths[i].getAttribute("uniqueid") === someId) { ... break; }
//     }
//
// There were around ninety of these, several of them nested inside per-turn loops
// over all 359 paths -- see docs/01-codebase-audit.md section 4.2. This index
// replaces them.
//
// The territory half of this module has gone. It indexed `mainGameArray` by
// uniqueId and by name, which is exactly what `GameState` does now, so keeping it
// would have meant two Maps over the same objects and a second thing to rebuild.
// Territory lookups are `getTerritory()` and `getTerritoryByName()` in
// `state/selectors.js`. See docs/archived/03-refactor-plan.md Phase 4.1.
//
// This module imports nothing.

/** @type {Map<string, object> | null} */
let pathsByUniqueId = null;
/** @type {Map<string, object> | null} */
let pathsByName = null;

/**
 * Index the SVG territory paths. Call once after the map loads, and again after
 * anything that replaces the path list.
 *
 * Elements without a `uniqueid` (the background <rect>, siege overlay images) are
 * skipped rather than indexed under a null key.
 *
 * @param {ArrayLike<object>} paths
 */
export function buildPathIndex(paths) {
    pathsByUniqueId = new Map();
    pathsByName = new Map();

    for (const path of paths) {
        const uniqueId = path.getAttribute("uniqueid");
        if (uniqueId === null || uniqueId === undefined) {
            continue;
        }
        pathsByUniqueId.set(String(uniqueId), path);

        const territoryName = path.getAttribute("territory-name");
        if (territoryName) {
            pathsByName.set(territoryName, path);
        }
    }
}

function requireIndex(index, builder) {
    if (index === null) {
        throw new Error(`Index not built. Call ${builder}() first.`);
    }
    return index;
}

/** The SVG path for a uniqueId, or null. */
export function getPathByUniqueId(uniqueId) {
    return requireIndex(pathsByUniqueId, "buildPathIndex").get(String(uniqueId)) ?? null;
}

/** The SVG path for a territory name, or null. */
export function getPathByName(territoryName) {
    return requireIndex(pathsByName, "buildPathIndex").get(territoryName) ?? null;
}

export function isPathIndexBuilt() {
    return pathsByUniqueId !== null;
}

/** Test seam. */
export function __resetIndexesForTests() {
    pathsByUniqueId = null;
    pathsByName = null;
}
