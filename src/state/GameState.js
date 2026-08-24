// The single source of truth for game state.
//
// Before Phase 4 the same fact lived in three places at once: the `mainGameArray`
// territory object, the SVG path's attributes, and whatever copy a siege or war
// object happened to be holding. Keeping those three in step was the job of a
// scattering of manual sync-backs (`setMainArrayToArmyRemaining`,
// `normalizeSiegeState`, the buildings copy-back loops in `battle.js`), and they
// did not always win. See docs/01-codebase-audit.md section 3.
//
// This module owns the state. It imports nothing -- not the UI, not the rules, not
// the DOM -- so it can be loaded in Node and cannot join the legacy import cycle.
//
// Access rules:
//   * read through `state/selectors.js`
//   * write through `state/mutations.js`
//   * never reach in here directly from game code
//
// The store is deliberately plain and serialisable: Phase 7.3 (save/load) is a
// `JSON.stringify` away once the last territory copies are gone.
//
// See docs/03-refactor-plan.md Phase 4.1.

import { Phase } from "./phases.js";

/**
 * @typedef {object} Store
 * @property {Map<string, object>} territories      uniqueId -> territory
 * @property {Map<string, object>} territoriesByName  territoryName -> territory
 * @property {object[]} territoryOrder              the same objects, sorted by defenseBonus
 * @property {object} players
 * @property {number} turn
 * @property {number} phase
 * @property {object} wars
 * @property {object} sieges
 */

/** @type {Store} */
const store = {
    territories: new Map(),
    territoriesByName: new Map(),
    territoryOrder: [],

    players: {
        // The country the human chose on the selection screen, e.g. "France".
        playerCountry: null,
        playerColour: "rgb(255,255,255)",
        flag: null
    },

    turn: 1,
    phase: Phase.BUY_UPGRADE,

    wars: {
        historic: [],
        historicAi: [],
        currentWarId: undefined,
        currentAiWarId: undefined,
        nextWarId: 0,
        nextAiWarId: 0
    },

    // Both keyed by territoryName, which is the stable identity of a territory --
    // `dataName` is the current owner and changes on conquest.
    sieges: {
        player: {},
        ai: {}
    },

    // Transient selection state that used to be stored on the SVG paths as the
    // `greyedOut` and `attackableTerritory` attributes. It is UI state rather than
    // world state, but Phase 4.4's rule is that no game fact is read back out of a
    // DOM attribute, and these two were.
    ui: {
        /** Country names the player may not choose. Empty once the game starts. */
        greyedOutCountries: new Set(),
        /** uniqueIds currently highlighted as attack destinations. */
        attackableTerritories: new Set()
    },

    seeded: false
};

// --- the write guard -------------------------------------------------------
//
// Phase 4 establishes the layer; Phase 5 is what finishes routing the economy and
// combat rules through it, because those rules have to become pure first. Until
// then a great many callers still hold a territory object and assign to it
// directly, so a guard that threw unconditionally would take the game offline for
// a whole phase.
//
// So the guard is a diagnostic, not a wall. It is off unless the page is loaded
// with `?stateGuard=1`, and in that mode every direct write is recorded (and
// logged once per field) instead of being silently accepted. `?stateGuard=strict`
// escalates to throwing, which is what a Phase 5 rules test will run under.
//
// `mutations.js` opens a write window around its own assignments, so writes made
// through the proper channel never register.

const GuardMode = Object.freeze({ OFF: "off", WARN: "warn", STRICT: "strict" });

function guardModeFromLocation() {
    if (typeof window === "undefined" || typeof window.location === "undefined") {
        return GuardMode.OFF;
    }
    const value = new URLSearchParams(window.location.search).get("stateGuard");
    if (value === null) {
        return GuardMode.OFF;
    }
    return value === "strict" ? GuardMode.STRICT : GuardMode.WARN;
}

let guardMode = guardModeFromLocation();
let writeWindowDepth = 0;
/** @type {{ territory: string, field: string, stack: string }[]} */
const violations = [];
const reportedFields = new Set();

/** Called by mutations.js around its own writes. Not exported to game code. */
export function openWriteWindow() {
    writeWindowDepth++;
}

export function closeWriteWindow() {
    writeWindowDepth = Math.max(0, writeWindowDepth - 1);
}

export function isGuardActive() {
    return guardMode !== GuardMode.OFF;
}

/** Everything the guard caught this session. Surfaced on `window.__game`. */
export function getGuardViolations() {
    return violations.map((v) => ({ ...v }));
}

export function __setGuardModeForTests(mode) {
    guardMode = mode;
}

function recordViolation(territory, field) {
    const key = `${territory}.${field}`;
    violations.push({
        territory,
        field,
        stack: new Error().stack ?? ""
    });
    if (guardMode === GuardMode.STRICT) {
        throw new Error(
            `state guard: direct write to ${key}. Territory state is written through state/mutations.js.`
        );
    }
    if (!reportedFields.has(key)) {
        reportedFields.add(key);
        console.warn(`state guard: direct write to ${key} (first occurrence)`);
    }
}

function guarded(territory) {
    if (guardMode === GuardMode.OFF) {
        return territory;
    }
    return new Proxy(territory, {
        set(target, field, value, receiver) {
            if (writeWindowDepth === 0) {
                recordViolation(target.territoryName ?? target.uniqueId ?? "?", String(field));
            }
            return Reflect.set(target, field, value, receiver);
        },
        deleteProperty(target, field) {
            if (writeWindowDepth === 0) {
                recordViolation(target.territoryName ?? target.uniqueId ?? "?", String(field));
            }
            return Reflect.deleteProperty(target, field);
        }
    });
}

// --- seeding ---------------------------------------------------------------

/**
 * Load the territory model into the store.
 *
 * Phase 4.1 deliberately does NOT rewrite the construction logic: the array that
 * `assignArmyAndResourcesToPaths()` builds today is handed straight here, and this
 * is where it stops being a free-floating module-level `let` and starts being
 * state. Rewriting construction is Phase 5.
 *
 * The array arrives sorted by `defenseBonus`, and a handful of legacy loops still
 * depend on seeing it in that order, so the order is preserved as
 * `territoryOrder` rather than being thrown away for the Map.
 *
 * @param {object[]} territories
 */
export function seedTerritories(territories) {
    store.territories.clear();
    store.territoriesByName.clear();
    store.territoryOrder = [];

    for (const raw of territories) {
        const territory = guarded(raw);
        store.territoryOrder.push(territory);
        if (raw.uniqueId !== undefined && raw.uniqueId !== null) {
            store.territories.set(String(raw.uniqueId), territory);
        }
        if (raw.territoryName) {
            store.territoriesByName.set(raw.territoryName, territory);
        }
    }

    store.seeded = true;
    return store.territoryOrder;
}

export function isSeeded() {
    return store.seeded;
}

/**
 * The store itself. Exported for `selectors.js` and `mutations.js` only -- they are
 * the public face of it. Nothing else should import this.
 */
export function __store() {
    return store;
}

/** Test seam: back to a fresh, unseeded store. */
export function __resetStateForTests() {
    store.territories.clear();
    store.territoriesByName.clear();
    store.territoryOrder = [];
    store.players = { playerCountry: null, playerColour: "rgb(255,255,255)", flag: null };
    store.turn = 1;
    store.phase = Phase.BUY_UPGRADE;
    store.wars = {
        historic: [],
        historicAi: [],
        currentWarId: undefined,
        currentAiWarId: undefined,
        nextWarId: 0,
        nextAiWarId: 0
    };
    store.sieges = { player: {}, ai: {} };
    store.ui = { greyedOutCountries: new Set(), attackableTerritories: new Set() };
    store.seeded = false;
    violations.length = 0;
    reportedFields.clear();
    writeWindowDepth = 0;
}
