// A serialisable picture of the store, and the way back.
//
// Refactor plan Phase 7.3. GameState.js has said since Phase 4 that the store is
// "deliberately plain and serialisable"; this is the module that cashes that in.
// It is the only place that knows how to turn the store into JSON and back, and it
// imports nothing from the UI or the rules, so it runs in Node and is unit-tested
// there.
//
// Three things about the store are not JSON.stringify-safe, and each is handled
// here rather than by whoever calls us:
//
//   1. A siege's `defendingTerritory` is a live getter onto the real territory (see
//      sieges.js), and it is enumerable -- deliberately, so a snapshot can see it.
//      Serialising it would put a whole copy of the territory inside every siege
//      and, worse, restore it as a DEAD copy: writing through the siege would no
//      longer write the world. `captureState` drops it and keeps
//      `defendingTerritoryId`; `restoreState` puts the getter back with
//      `referenceDefendingTerritory()`.
//   2. `greyedOutCountries` and `attackableTerritories` are Sets, which stringify
//      to `{}`. They travel as arrays.
//   3. Several collections are aliased by module-level `const`s elsewhere.
//      battle.js does `export const playerSiegeWarsList = playerSieges()` at module
//      load -- a reference to the store's own object, held for the life of the page
//      by ~60 read sites. So a restore must never REPLACE `store.sieges.player`,
//      `store.sieges.ai`, `store.wars.historic` or `store.wars.historicAi`; it
//      empties and refills them in place. The same reasoning applies to the
//      territory objects: `restoreState` patches each one rather than seeding new
//      ones, so anything already holding a territory (a siege, the AI's leader
//      array, the path index) still holds the right one.
//
// What this does NOT do is tell the UI to redraw. A restore touches essentially
// every territory, and 359 TERRITORY_CHANGED events to produce one repaint is the
// wrong shape; the loader calls renderAllTerritories() and repaintMap() once
// instead. Turn and phase DO emit, because PhaseBar follows them and there is
// exactly one of each.

import { __store, isSeeded, openWriteWindow, closeWriteWindow } from "./GameState.js";
import { referenceDefendingTerritory } from "./sieges.js";
import { emit, Events } from "./events.js";
import { isPhase, phaseName } from "./phases.js";

/** Bumped when the shape below changes in a way an older save cannot satisfy. */
export const SNAPSHOT_VERSION = 1;

/** Run `fn` with the `?stateGuard=1` write window held open. */
function write(fn) {
    openWriteWindow();
    try {
        return fn();
    } finally {
        closeWriteWindow();
    }
}

/** A siege or historic war without its live `defendingTerritory` getter. */
function plainWarLike(warLike) {
    const copy = {};
    for (const key of Object.keys(warLike)) {
        if (key !== "defendingTerritory") {
            copy[key] = warLike[key];
        }
    }
    return copy;
}

function plainSiegeMap(sieges) {
    const out = {};
    for (const [territoryName, siege] of Object.entries(sieges)) {
        out[territoryName] = plainWarLike(siege);
    }
    return out;
}

/**
 * Everything in the store, as plain JSON-safe data.
 *
 * @returns {object|null} null if the store has not been seeded yet -- there is no
 *          game to save before the territory model exists.
 */
export function captureState() {
    if (!isSeeded()) {
        return null;
    }
    const store = __store();
    return {
        version: SNAPSHOT_VERSION,
        // Spread, not the object itself: under `?stateGuard=1` a territory is a Proxy,
        // and a Proxy is not something to hand to JSON.stringify.
        territories: store.territoryOrder.map((territory) => ({ ...territory })),
        players: { ...store.players },
        turn: store.turn,
        phase: store.phase,
        wars: {
            historic: store.wars.historic.map(plainWarLike),
            historicAi: store.wars.historicAi.map(plainWarLike),
            currentWarId: store.wars.currentWarId ?? null,
            currentAiWarId: store.wars.currentAiWarId ?? null,
            nextWarId: store.wars.nextWarId,
            nextAiWarId: store.wars.nextAiWarId
        },
        sieges: {
            player: plainSiegeMap(store.sieges.player),
            ai: plainSiegeMap(store.sieges.ai)
        },
        ui: {
            greyedOutCountries: [...store.ui.greyedOutCountries],
            attackableTerritories: [...store.ui.attackableTerritories]
        }
    };
}

/** Empty an object in place, keeping its identity. See note 3 at the top. */
function emptyInPlace(target) {
    for (const key of Object.keys(target)) {
        delete target[key];
    }
}

function restoreTerritories(store, saved) {
    const missing = [];
    for (const savedTerritory of saved) {
        const territory = store.territories.get(String(savedTerritory.uniqueId));
        if (!territory) {
            missing.push(String(savedTerritory.uniqueId));
            continue;
        }
        // Drop live fields the save does not carry, so a restore replaces the
        // territory rather than merging with whatever the abandoned game left there.
        for (const key of Object.keys(territory)) {
            if (!Object.prototype.hasOwnProperty.call(savedTerritory, key)) {
                delete territory[key];
            }
        }
        Object.assign(territory, savedTerritory);
    }
    return missing;
}

/**
 * Put the store back to a captured state.
 *
 * @param {object} snapshot  the output of `captureState()`
 * @returns {{turn: number, phase: number, missingTerritories: string[]}}
 * @throws if the snapshot is unusable -- a wrong version, or a store with no
 *         territories to patch. A caller that wants to say "that code is not a
 *         saved game" needs to be told, not handed a half-restored world.
 */
export function restoreState(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
        throw new Error("restoreState: not a snapshot");
    }
    if (snapshot.version !== SNAPSHOT_VERSION) {
        throw new Error(
            "restoreState: snapshot version " + snapshot.version +
            ", expected " + SNAPSHOT_VERSION);
    }
    if (!isSeeded()) {
        throw new Error("restoreState: the territory model is not built yet");
    }
    if (!Array.isArray(snapshot.territories) || snapshot.territories.length === 0) {
        throw new Error("restoreState: snapshot carries no territories");
    }

    const store = __store();
    const previousTurn = store.turn;
    const previousPhase = store.phase;
    let missing = [];

    write(() => {
        missing = restoreTerritories(store, snapshot.territories);

        Object.assign(store.players, snapshot.players ?? {});

        store.turn = snapshot.turn;
        if (isPhase(snapshot.phase)) {
            store.phase = snapshot.phase;
        }

        // In place, all four -- battle.js holds module-level references to them.
        store.wars.historic.length = 0;
        for (const war of snapshot.wars?.historic ?? []) {
            store.wars.historic.push(
                referenceDefendingTerritory({ ...war }, war.defendingTerritoryId));
        }
        store.wars.historicAi.length = 0;
        for (const war of snapshot.wars?.historicAi ?? []) {
            store.wars.historicAi.push(
                referenceDefendingTerritory({ ...war }, war.defendingTerritoryId));
        }
        store.wars.currentWarId = snapshot.wars?.currentWarId ?? undefined;
        store.wars.currentAiWarId = snapshot.wars?.currentAiWarId ?? undefined;
        store.wars.nextWarId = snapshot.wars?.nextWarId ?? 0;
        store.wars.nextAiWarId = snapshot.wars?.nextAiWarId ?? 0;

        for (const side of ["player", "ai"]) {
            emptyInPlace(store.sieges[side]);
            for (const [territoryName, siege] of Object.entries(snapshot.sieges?.[side] ?? {})) {
                store.sieges[side][territoryName] =
                    referenceDefendingTerritory({ ...siege }, siege.defendingTerritoryId);
            }
        }

        store.ui.greyedOutCountries = new Set(snapshot.ui?.greyedOutCountries ?? []);
        store.ui.attackableTerritories = new Set(snapshot.ui?.attackableTerritories ?? []);
    });

    if (store.turn !== previousTurn) {
        emit(Events.TURN_CHANGED, { turn: store.turn, previous: previousTurn });
    }
    if (store.phase !== previousPhase) {
        emit(Events.PHASE_CHANGED, {
            phase: store.phase,
            previous: previousPhase,
            name: phaseName(store.phase)
        });
    }

    if (missing.length > 0) {
        console.warn(
            "restoreState: " + missing.length + " saved territories are not on this map and " +
            "were skipped. The save was probably taken against a different svgMaster.svg.");
    }

    return { turn: store.turn, phase: store.phase, missingTerritories: missing };
}
