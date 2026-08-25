// The register of state that is NOT in the store.
//
// Refactor plan Phase 7.3. `state/snapshot.js` captures GameState, which is most of
// the game but not all of it: three legacy modules still hold durable facts in
// module-level variables that survive a turn, and a save that omits them loads a
// world that is subtly wrong rather than obviously broken --
//
//   * `battle.js` holds `retrievalArray` (armies committed to an attack and due
//     home on a later turn -- the credit half of audit 5.1 AD; lose it and the army
//     is destroyed) and the two `turnsDeactivatedArray`s (a conquered territory
//     sitting out its lockout; lose them and it stays deactivated forever);
//   * `resourceCalculations.js` holds the per-turn economy tables the top table and
//     the AI both read;
//   * `gameTurnsLoop.js` holds the running random-event probability, which climbs
//     each turn a disaster does not fire.
//
// Rather than have the saver import those three files -- which would pull `ui.js`
// into `platform/` through the back door and put a UI dependency in the save path
// -- each module registers its own capture/restore here at module load. The saver
// imports only this file. That keeps the knowledge of what a slice contains in the
// module that owns it, which is also the module that will be moved in Phase 6.9B.
//
// Order does not matter: `captureSlices()` walks whatever has registered by the
// time it is called, and `restoreSlices()` skips a key with no registered slice
// (an old save, or a module that has since been folded into the store) rather than
// failing the whole load.

/** @type {Map<string, {capture: () => unknown, restore: (data: unknown) => void}>} */
const slices = new Map();

/**
 * Declare a slice of savable state.
 *
 * @param {string} name  stable key in the save file. Renaming it invalidates saves.
 * @param {{capture: () => unknown, restore: (data: unknown) => void}} slice
 *        `capture` must return JSON-safe data; `restore` must put it back IN PLACE
 *        where the exported binding is a `const` array or object that other modules
 *        alias (`retrievalArray` is imported by reference in four files).
 */
export function registerSaveSlice(name, slice) {
    if (typeof slice?.capture !== "function" || typeof slice?.restore !== "function") {
        throw new Error("registerSaveSlice(" + name + "): needs capture and restore");
    }
    slices.set(name, slice);
}

/** Every registered slice, keyed by name. */
export function captureSlices() {
    const out = {};
    for (const [name, slice] of slices) {
        try {
            out[name] = slice.capture();
        } catch (error) {
            // One broken slice must not cost the player the rest of the save.
            console.error("captureSlices: slice \"" + name + "\" threw", error);
        }
    }
    return out;
}

/**
 * Put every slice present in `data` back.
 *
 * @param {Record<string, unknown>} data
 * @returns {string[]} the names that were restored
 */
export function restoreSlices(data) {
    const restored = [];
    for (const [name, value] of Object.entries(data ?? {})) {
        const slice = slices.get(name);
        if (!slice) {
            console.warn("restoreSlices: no slice registered for \"" + name + "\"; skipped");
            continue;
        }
        try {
            slice.restore(value);
            restored.push(name);
        } catch (error) {
            console.error("restoreSlices: slice \"" + name + "\" threw", error);
        }
    }
    return restored;
}

/** Which slices have registered. Diagnostics and unit tests. */
export function registeredSliceNames() {
    return [...slices.keys()];
}

/** Test seam. */
export function __resetSaveSlicesForTests() {
    slices.clear();
}
