// The only module that writes game state.
//
// Every function here does three things in the same order: open the write window
// (so the `?stateGuard=1` proxy does not flag its own assignments), change the
// store, then emit. Callers get told what changed rather than having to guess, and
// `state/events.js` is what the UI subscribes to.
//
// This module imports nothing from the game, only its two siblings, so it stays
// loadable in Node.
//
// See docs/03-refactor-plan.md Phase 4.2.

import { vehicleArmyPersonnelWorth } from "../config/balance.js";
import { __store, openWriteWindow, closeWriteWindow } from "./GameState.js";
import { emit, Events } from "./events.js";
import { isPhase, phaseName } from "./phases.js";

/** Run `fn` with the write guard held open. */
function write(fn) {
    openWriteWindow();
    try {
        return fn();
    } finally {
        closeWriteWindow();
    }
}

// --- territories -----------------------------------------------------------

/**
 * Apply a patch to a territory and announce it.
 *
 * The patch is a plain object of field -> value. Fields whose value is unchanged
 * are dropped, so a no-op patch emits nothing and the UI does not redraw.
 *
 * @param {string|number} uniqueId
 * @param {Record<string, unknown>} patch
 * @returns {object|null} the territory, or null if there is no such territory
 */
export function updateTerritory(uniqueId, patch) {
    const territory = __store().territories.get(String(uniqueId));
    if (!territory) {
        console.warn("mutations.updateTerritory: no territory with uniqueId " + uniqueId);
        return null;
    }

    const changed = [];
    //Phase 7.4. `previous` carries the value each changed field HELD, and it exists for
    //one listener: the activity feed derives "X (Spain) conquered by Libya" from an
    //ownership change, and the country it was taken FROM is gone by the time the event
    //arrives. Recording that at every conquest site instead was the alternative, and
    //there are eight of them across battle.js and aiCalculations.js -- a list that is
    //one new code path away from being wrong, and silently.
    const previous = {};
    write(() => {
        for (const [field, value] of Object.entries(patch)) {
            if (territory[field] !== value) {
                previous[field] = territory[field];
                territory[field] = value;
                changed.push(field);
            }
        }
    });

    if (changed.length > 0) {
        emit(Events.TERRITORY_CHANGED, { uniqueId: String(uniqueId), territory, changed, previous });
    }
    return territory;
}

/**
 * Change who holds a territory.
 *
 * `owner` is "Player" or a country name; `country` is what used to be written to
 * the path's `data-name`. They are set together because every conquest sets both
 * and the two drifting apart was a live bug (`setCountryNameOnPath` wrote
 * `territory.owner` into `data-name`).
 *
 * @param {string|number} uniqueId
 * @param {string} owner
 * @param {string} country  current owning country; defaults to `owner`
 */
/**
 * Set a territory's garrison from a four-slot army array, keeping the total honest.
 *
 * `armyForCurrentTerritory` is a STORED total, not a derived one, so the four unit counts and
 * the total can disagree -- and when they do, the probability calculation reads one number while
 * the bottom table reads another. CLAUDE.md records the same trap for test scenarios ("a
 * scenario must patch `armyForCurrentTerritory` as well as the four unit counts"), and the
 * retreat handler in ui.js used to rebuild it by hand, identically, in four separate places.
 * Computing it here is what makes that impossible to get wrong.
 *
 * Writes the OWNED counts, not the `useable*` ones -- those are the oil gate and are recomputed
 * by `setPlayerUseableNotUseableWeaponsDueToOilDemand()`.
 *
 * @param {string|number} uniqueId
 * @param {number[]} army  [infantry, assault, air, naval]
 */
export function setTerritoryArmy(uniqueId, army) {
    const infantry = army[0] ?? 0;
    const assault = army[1] ?? 0;
    const air = army[2] ?? 0;
    const naval = army[3] ?? 0;
    return updateTerritory(uniqueId, {
        infantryForCurrentTerritory: infantry,
        assaultForCurrentTerritory: assault,
        airForCurrentTerritory: air,
        navalForCurrentTerritory: naval,
        armyForCurrentTerritory:
            infantry
            + (assault * vehicleArmyPersonnelWorth.assault)
            + (air * vehicleArmyPersonnelWorth.air)
            + (naval * vehicleArmyPersonnelWorth.naval)
    });
}

export function setTerritoryOwner(uniqueId, owner, country = owner) {
    return updateTerritory(uniqueId, { owner: owner, dataName: country });
}

/** Deactivate or reactivate a territory (a conquest sits the territory out a turn). */
export function setTerritoryDeactivated(uniqueId, isDeactivated) {
    return updateTerritory(uniqueId, { isDeactivated: Boolean(isDeactivated) });
}

/** Reactivate every territory. Called at the top of the player's turn. */
export function reactivateAllTerritories() {
    const touched = [];
    write(() => {
        for (const territory of __store().territoryOrder) {
            if (territory.isDeactivated) {
                territory.isDeactivated = false;
                touched.push(territory);
            }
        }
    });
    for (const territory of touched) {
        emit(Events.TERRITORY_CHANGED, {
            uniqueId: String(territory.uniqueId),
            territory,
            changed: ["isDeactivated"]
        });
    }
    return touched.length;
}

// --- turn and phase --------------------------------------------------------

/** Set the turn number. */
export function setTurn(turn) {
    const store = __store();
    if (store.turn === turn) {
        return turn;
    }
    const previous = store.turn;
    write(() => {
        store.turn = turn;
    });
    emit(Events.TURN_CHANGED, { turn: turn, previous: previous });
    return turn;
}

/** Advance to the next turn. */
export function advanceTurn() {
    return setTurn(__store().turn + 1);
}

/**
 * Set the phase.
 *
 * Takes a `Phase` value. A number outside the enum is a bug in the caller, so it
 * is rejected loudly rather than stored -- the old code let the phase counter run
 * to 3 and relied on the next branch not matching.
 */
export function setPhase(phase) {
    if (!isPhase(phase)) {
        console.warn("mutations.setPhase: " + phase + " is not a phase");
        return __store().phase;
    }
    const store = __store();
    if (store.phase === phase) {
        return phase;
    }
    const previous = store.phase;
    write(() => {
        store.phase = phase;
    });
    emit(Events.PHASE_CHANGED, { phase: phase, previous: previous, name: phaseName(phase) });
    return phase;
}

// --- the player ------------------------------------------------------------

export function setPlayerCountry(countryName) {
    const store = __store();
    write(() => {
        store.players.playerCountry = countryName;
    });
    return countryName;
}

export function setPlayerColour(colour) {
    const store = __store();
    write(() => {
        store.players.playerColour = colour;
    });
    return colour;
}

export function setPlayerFlag(flag) {
    const store = __store();
    write(() => {
        store.players.flag = flag;
    });
    return flag;
}

// --- selection state -------------------------------------------------------

/** Replace the set of countries the player may not choose. */
export function setGreyedOutCountries(countryNames) {
    const store = __store();
    write(() => {
        store.ui.greyedOutCountries = new Set(countryNames);
    });
    emit(Events.SELECTION_CHANGED, { what: "greyedOut" });
}

/** Clear it. Called when the game starts and the selection screen is done. */
export function clearGreyedOutCountries() {
    const store = __store();
    write(() => {
        store.ui.greyedOutCountries.clear();
    });
    emit(Events.SELECTION_CHANGED, { what: "greyedOut" });
}

/** Replace the set of territories highlighted as attack destinations. */
export function setAttackableTerritories(uniqueIds) {
    const store = __store();
    write(() => {
        store.ui.attackableTerritories = new Set([...uniqueIds].map(String));
    });
    emit(Events.SELECTION_CHANGED, { what: "attackable" });
}

export function clearAttackableTerritories() {
    const store = __store();
    write(() => {
        store.ui.attackableTerritories.clear();
    });
    emit(Events.SELECTION_CHANGED, { what: "attackable" });
}

// --- sieges ----------------------------------------------------------------

/**
 * Record a siege.
 *
 * Sieges are keyed by the besieged territory's stable name and hold a
 * `defendingTerritoryId`, not a copy of the territory -- see Phase 4.7. The
 * `underSiege` flag is derived from these lists rather than stored, so adding a
 * siege here is the only thing needed to put a territory under siege.
 *
 * @param {"player"|"ai"} side  who is doing the besieging
 * @param {string} territoryName  the besieged territory
 * @param {object} siege
 */
export function addSiege(side, territoryName, siege) {
    const store = __store();
    write(() => {
        store.sieges[side][territoryName] = siege;
    });
    emit(Events.SIEGE_CHANGED, {
        side: side,
        territoryName: territoryName,
        siege: siege,
        action: "add"
    });
    return siege;
}

/** Remove a siege. Returns the removed siege, or null. */
export function removeSiege(side, territoryName) {
    const store = __store();
    const siege = store.sieges[side][territoryName] ?? null;
    if (!siege) {
        return null;
    }
    write(() => {
        delete store.sieges[side][territoryName];
    });
    emit(Events.SIEGE_CHANGED, {
        side: side,
        territoryName: territoryName,
        siege: siege,
        action: "remove"
    });
    return siege;
}

/**
 * Apply a patch to an existing siege.
 * @param {"player"|"ai"} side
 */
export function updateSiege(side, territoryName, patch) {
    const store = __store();
    const siege = store.sieges[side][territoryName];
    if (!siege) {
        return null;
    }
    write(() => {
        Object.assign(siege, patch);
    });
    emit(Events.SIEGE_CHANGED, {
        side: side,
        territoryName: territoryName,
        siege: siege,
        action: "update"
    });
    return siege;
}

/**
 * Drop every siege whose besieged territory no longer exists.
 *
 * This is the last remnant of `normalizeSiegeState()`, and it only has to run when
 * the map itself changes -- not every turn, because the flag it used to reconcile
 * is now derived.
 *
 * @param {(territoryName: string) => boolean} exists
 */
export function pruneSiegesForMissingTerritories(exists) {
    let removed = 0;
    for (const side of ["player", "ai"]) {
        for (const territoryName of Object.keys(__store().sieges[side])) {
            if (!exists(territoryName)) {
                removeSiege(side, territoryName);
                removed++;
            }
        }
    }
    return removed;
}

// --- wars ------------------------------------------------------------------

/** Append to the player's historic war list, ignoring a duplicate warId. */
export function recordHistoricWar(war) {
    const store = __store();
    if (store.wars.historic.some((existing) => existing.warId === war.warId)) {
        return false;
    }
    write(() => {
        store.wars.historic.push(war);
    });
    emit(Events.WAR_CHANGED, { war: war, side: "player", action: "record" });
    return true;
}

/** Append to the AI's historic war list, ignoring a duplicate warId. */
export function recordHistoricAiWar(war) {
    const store = __store();
    if (store.wars.historicAi.some((existing) => existing.warId === war.warId)) {
        return false;
    }
    write(() => {
        store.wars.historicAi.push(war);
    });
    emit(Events.WAR_CHANGED, { war: war, side: "ai", action: "record" });
    return true;
}

export function setCurrentWarId(warId) {
    const store = __store();
    write(() => {
        store.wars.currentWarId = warId;
    });
    return warId;
}

export function setCurrentAiWarId(warId) {
    const store = __store();
    write(() => {
        store.wars.currentAiWarId = warId;
    });
    return warId;
}

export function setNextWarId(warId) {
    const store = __store();
    write(() => {
        store.wars.nextWarId = warId;
    });
    return warId;
}

export function setNextAiWarId(warId) {
    const store = __store();
    write(() => {
        store.wars.nextAiWarId = warId;
    });
    return warId;
}

/**
 * A write window for legacy code that still assigns to a territory object it is
 * holding. Wrap the assignment and the guard will not flag it.
 *
 * This exists so the guard can be switched on for a whole playthrough while Phase
 * 5 is still in progress. Every call site is a Phase 5 to-do; there should be none
 * left when `rules/` is pure.
 */
export function legacyDirectWrite(fn) {
    return write(fn);
}
