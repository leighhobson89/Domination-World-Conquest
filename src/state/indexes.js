// O(1) lookups for the two collections the game scans constantly.
//
// Nearly every lookup in the legacy code is a linear scan:
//
//     for (let i = 0; i < mainGameArray.length; i++) {
//         if (mainGameArray[i].uniqueId === someId) { ... break; }
//     }
//
// There are around ninety of these, several of them nested inside per-turn loops
// over all 359 paths -- see docs/01-codebase-audit.md section 4.2. These indexes
// replace them.
//
// Note that `mainGameArray` is sorted by defenseBonus immediately after it is
// built, so a territory's position in the array has nothing to do with its
// uniqueId. Anything that indexes it positionally is already wrong; that is
// exactly what these lookups are here to prevent.
//
// This module imports nothing.

/** @type {Map<string, object> | null} */
let pathsByUniqueId = null;
/** @type {Map<string, object> | null} */
let pathsByName = null;

/** @type {Map<string, object> | null} */
let territoriesByUniqueId = null;
/** @type {Map<string, object> | null} */
let territoriesByName = null;

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

/**
 * Index the territory objects. Call once after the territory model is built, and
 * again if the array is rebuilt.
 *
 * @param {Iterable<object>} territories
 */
export function buildTerritoryIndex(territories) {
    territoriesByUniqueId = new Map();
    territoriesByName = new Map();

    for (const territory of territories) {
        if (territory?.uniqueId !== undefined && territory.uniqueId !== null) {
            territoriesByUniqueId.set(String(territory.uniqueId), territory);
        }
        if (territory?.territoryName) {
            territoriesByName.set(territory.territoryName, territory);
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

/** The territory object for a uniqueId, or null. */
export function getTerritoryByUniqueId(uniqueId) {
    return requireIndex(territoriesByUniqueId, "buildTerritoryIndex").get(String(uniqueId)) ?? null;
}

/** The territory object for a territory name, or null. */
export function getTerritoryByName(territoryName) {
    return requireIndex(territoriesByName, "buildTerritoryIndex").get(territoryName) ?? null;
}

export function isPathIndexBuilt() {
    return pathsByUniqueId !== null;
}

export function isTerritoryIndexBuilt() {
    return territoriesByUniqueId !== null;
}

/** Test seam. */
export function __resetIndexesForTests() {
    pathsByUniqueId = null;
    pathsByName = null;
    territoriesByUniqueId = null;
    territoriesByName = null;
}
