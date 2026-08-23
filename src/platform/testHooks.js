// Test-only window hooks, active ONLY when the page is loaded with ?e2e=1.
//
// The numeric truth of this game lives in the territory model, not in the DOM.
// Asserting food capacity by reading a KMB-formatted table cell ("1.2M") tests the
// formatter, not the economy. This exposes a read-only view of the model so
// end-to-end tests can assert numbers directly, and behaviour through the DOM.
//
// Everything handed out is a deep copy: a test can never mutate live game state
// through this surface.
//
// See docs/03-refactor-plan.md Phase 1.6 and docs/04-e2e-test-plan.md section 2.3.

const ENABLED =
    typeof window !== "undefined" &&
    typeof window.location !== "undefined" &&
    new URLSearchParams(window.location.search).has("e2e");

let resolveReady;
const ready = new Promise((resolve) => {
    resolveReady = resolve;
});
let isReady = false;

/** Is the ?e2e=1 harness surface active? */
export function testHooksEnabled() {
    return ENABLED;
}

function snapshot(value) {
    if (value === null || value === undefined) {
        return value ?? null;
    }
    // Territory objects carry a `leader` object and otherwise only primitives, so a
    // structured clone is both safe and cheap. Fall back to a shallow copy if the
    // object ever gains something unclonable (a DOM node, a function).
    try {
        return structuredClone(value);
    } catch {
        return Array.isArray(value) ? value.map((v) => ({ ...v })) : { ...value };
    }
}

/**
 * Install window.__game. Called once during bootstrap; a no-op without ?e2e=1.
 *
 * @param {object} accessors  live readers into the game, supplied by the caller so
 *                            this module imports nothing and stays out of the
 *                            existing import cycle.
 */
export function installTestHooks(accessors) {
    if (!ENABLED) {
        return;
    }

    window.__game = {
        /** Resolves once the territory model is built and turn 1 has begun. */
        ready,
        isReady: () => isReady,
        seed: () => window.__seed ?? null,

        turn: () => accessors.turn(),
        phase: () => accessors.phase(),

        territory: (nameOrId) => snapshot(accessors.territory(nameOrId)),
        territoriesOwnedBy: (owner) => snapshot(accessors.territoriesOwnedBy(owner)),
        totals: () => snapshot(accessors.totals()),

        pathAreaComputations: () => accessors.pathAreaComputations(),
        sieges: () => snapshot(accessors.sieges()),
        wars: () => snapshot(accessors.wars()),
    };
}

/**
 * Extra hooks that only make sense once the adjacency data is loaded. Kept
 * separate so window.__game exists from the very first paint.
 */
export function installAdjacencyTestHooks(accessors) {
    if (!ENABLED || !window.__game) {
        return;
    }
    Object.assign(window.__game, {
        interactableFrom: (territoryName) => accessors.interactableFrom(territoryName),
        adjacencyExceptions: () => snapshot(accessors.adjacencyExceptions()),
        strandedTerritories: () => accessors.strandedTerritories(),
    });
}

/** Signal that initialisation has finished. */
export function signalReady() {
    if (!ENABLED) {
        return;
    }
    isReady = true;
    resolveReady();
}
