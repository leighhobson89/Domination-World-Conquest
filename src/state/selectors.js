// Pure reads over the store. No writes, no DOM, no side effects.
//
// Everything the game used to learn by scanning `mainGameArray` or by asking an
// SVG path for an attribute is answered from here instead. That is the whole point
// of Phase 4: the path renders the truth, it is not the truth.
//
// Two rules for anything added to this file:
//   1. it must not mutate -- if it needs to change something it belongs in
//      `mutations.js`;
//   2. it must not touch the DOM -- these have to keep working in Node so Phase 5's
//      rules tests can use them.
//
// See docs/archived/03-refactor-plan.md Phase 4.2.

import { __store, isSeeded } from "./GameState.js";
import { Phase } from "./phases.js";

// --- territories -----------------------------------------------------------

/**
 * Every territory, in `defenseBonus` order.
 *
 * This is the replacement for `mainGameArray`, and it returns the live array
 * rather than a copy: the callers are per-turn loops over 359 territories and
 * several of them are already nested, so copying here would undo the Phase 1 work.
 * Treat it as read-only -- the write guard (`?stateGuard=1`) is what catches you if
 * you do not.
 *
 * The order is `defenseBonus` descending, never `uniqueId`. Nothing may index it
 * positionally.
 *
 * @returns {object[]}
 */
export function allTerritories() {
    return __store().territoryOrder;
}

/** How many territories exist. */
export function territoryCount() {
    return __store().territoryOrder.length;
}

/** Has the territory model been built yet? */
export function territoriesReady() {
    return isSeeded();
}

/**
 * The territory with this uniqueId, or null.
 * @param {string|number} uniqueId
 */
export function getTerritory(uniqueId) {
    if (uniqueId === null || uniqueId === undefined) {
        return null;
    }
    return __store().territories.get(String(uniqueId)) ?? null;
}

/**
 * The territory with this stable name, or null.
 *
 * `territoryName` is the identity that survives conquest; `dataName` is the
 * current owner and changes.
 *
 * @param {string} territoryName
 */
export function getTerritoryByName(territoryName) {
    if (!territoryName) {
        return null;
    }
    return __store().territoriesByName.get(territoryName) ?? null;
}

/**
 * Every territory whose current owner (`dataName`) is `countryName`.
 * @param {string} countryName
 */
export function territoriesOwnedByCountry(countryName) {
    return __store().territoryOrder.filter((territory) => territory.dataName === countryName);
}

/**
 * Every territory whose `owner` field is `owner` -- "Player" for the human, the
 * country name otherwise.
 * @param {string} owner
 */
export function territoriesWithOwner(owner) {
    return __store().territoryOrder.filter((territory) => territory.owner === owner);
}

/** Every territory the human player holds. */
export function playerTerritories() {
    return territoriesWithOwner("Player");
}

// --- the fields that used to live on the SVG path --------------------------

/** The `owner` attribute's replacement: "Player", or the owning country's name. */
export function ownerOf(uniqueId) {
    return getTerritory(uniqueId)?.owner ?? null;
}

/** The `data-name` attribute's replacement: the current owning country. */
export function countryOf(uniqueId) {
    return getTerritory(uniqueId)?.dataName ?? null;
}

/** Is this territory the human player's? */
export function isPlayerOwned(uniqueId) {
    return ownerOf(uniqueId) === "Player";
}

/** The `deactivated` attribute's replacement. A conquered territory sits out a turn. */
export function isDeactivated(uniqueId) {
    return getTerritory(uniqueId)?.isDeactivated === true;
}

/**
 * The `underSiege` attribute's replacement -- and, crucially, a derivation rather
 * than a stored flag.
 *
 * `normalizeSiegeState()` existed because the flag and the siege lists were two
 * separate facts that drifted apart. Deriving it means they cannot: a territory is
 * under siege exactly when a siege names it. See Phase 4.5.
 *
 * @param {string} territoryName
 */
export function isUnderSiege(territoryName) {
    if (!territoryName) {
        return false;
    }
    const { sieges } = __store();
    return (
        Object.prototype.hasOwnProperty.call(sieges.player, territoryName) ||
        Object.prototype.hasOwnProperty.call(sieges.ai, territoryName)
    );
}

/** As `isUnderSiege`, but keyed by uniqueId. */
export function isUnderSiegeById(uniqueId) {
    return isUnderSiege(getTerritory(uniqueId)?.territoryName);
}

/**
 * The name of the country conducting the siege on this territory, or `null` when it
 * is not besieged.
 *
 * A player siege object carries no `attackingCountry` -- the besieger is always the
 * player -- so it is answered from `players.country`. An AI siege records the
 * attacking territory's `dataName`, which is its owner at the moment the siege began.
 */
export function besiegerOf(territoryName) {
    if (!territoryName) {
        return null;
    }
    const { sieges } = __store();
    if (Object.prototype.hasOwnProperty.call(sieges.player, territoryName)) {
        return playerCountryName();
    }
    const aiSiege = sieges.ai[territoryName];
    return aiSiege ? (aiSiege.attackingCountry ?? null) : null;
}

/** The `greyedOut` attribute's replacement: a country the player may not choose. */
export function isCountryGreyedOut(countryName) {
    return __store().ui.greyedOutCountries.has(countryName);
}

/** Every country the selection screen has locked, as names. */
export function greyedOutCountryNames() {
    return [...__store().ui.greyedOutCountries];
}

/** Are any countries greyed out at all? (The selection screen has ended if not.) */
export function anyCountryGreyedOut() {
    return __store().ui.greyedOutCountries.size > 0;
}

/** The `attackableTerritory` attribute's replacement. */
export function isAttackable(uniqueId) {
    return __store().ui.attackableTerritories.has(String(uniqueId));
}

// --- turn and phase --------------------------------------------------------

/** The current turn number, 1-based. */
export function currentTurn() {
    return __store().turn;
}

/** The current phase. Compare against the `Phase` enum, not a bare number. */
export function currentPhase() {
    return __store().phase;
}

export function isBuyPhase() {
    return __store().phase === Phase.BUY_UPGRADE;
}

export function isMovePhase() {
    return __store().phase === Phase.MOVE_ATTACK;
}

export function isAiPhase() {
    return __store().phase === Phase.AI;
}

// --- the player ------------------------------------------------------------

/** The country the human chose, or null before the selection screen is answered. */
export function playerCountryName() {
    return __store().players.playerCountry;
}

export function playerColour() {
    return __store().players.playerColour;
}

export function playerFlag() {
    return __store().players.flag;
}

// --- sieges ----------------------------------------------------------------

/** The player's sieges, keyed by the besieged territory's name. */
export function playerSieges() {
    return __store().sieges.player;
}

/** The AI's sieges, keyed by the besieged territory's name. */
export function aiSieges() {
    return __store().sieges.ai;
}

/** The siege on this territory, from either list, or null. */
export function siegeOn(territoryName) {
    const { sieges } = __store();
    return sieges.player[territoryName] ?? sieges.ai[territoryName] ?? null;
}

/** Names of every besieged territory. */
export function besiegedTerritoryNames() {
    const { sieges } = __store();
    return [...new Set([...Object.keys(sieges.player), ...Object.keys(sieges.ai)])];
}

// --- wars ------------------------------------------------------------------

export function historicWarsList() {
    return __store().wars.historic;
}

export function historicAiWarsList() {
    return __store().wars.historicAi;
}

export function warIds() {
    const { wars } = __store();
    return {
        currentWarId: wars.currentWarId,
        currentAiWarId: wars.currentAiWarId,
        nextWarId: wars.nextWarId,
        nextAiWarId: wars.nextAiWarId
    };
}
