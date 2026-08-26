// What happened militarily, turn by turn.
//
// Refactor plan Phase 7.4 -- the AI activity feed, and the biggest "feel" gap in
// the game. Until now the answer to "what did the other 206 countries just do?"
// was a run of `console.log`s that the player never sees: a turn would pass, four
// territories would change hands somewhere in South America, and the only trace on
// screen was that the map had quietly changed colour.
//
// This module is the record. It knows nothing about how the record is drawn --
// `src/ui/components/ActivityPanel.js` does that -- and nothing about the DOM, so
// it runs in Node and is unit-tested there.
//
// Three decisions are worth stating, because each of them is a thing the panel
// would get wrong if it were left to work it out itself.
//
// **The log stores FACTS, not sentences.** An entry names a kind, a territory, an
// attacker and a defender; the wording and the colour are derived when it is
// drawn. Storing "Balearic Islands (Spain) conquered by Libya" would have baked
// today's phrasing into every save file, and would make the player-involvement
// rules -- which decide both the colour and the size -- unrecoverable after the
// fact.
//
// **What counts as military is decided HERE.** The brief is explicit: attacks,
// conquests, losses, battles between AIs, sieges in all four of their states, and
// anything that touches the player. Not economy, not bolstering, not planning.
// `ACTIVITY_KINDS` is that list, and `recordActivity()` rejects anything else --
// so an economic event cannot leak into the feed by someone passing a new string.
//
// **A turn is the grouping unit and it is explicit.** Entries carry the turn they
// happened on rather than being appended to "the current bucket", because the AI
// turn runs inside turn N while the engine is already thinking about N+1 in
// places, and a log grouped by "whenever this was called" produces a panel whose
// sections do not match the turn counter.

import { emit, Events } from "./events.js";
import { currentTurn } from "./selectors.js";

/**
 * Every kind of entry the feed can hold.
 *
 * Deliberately a closed set. The panel switches on these to pick a tone and a
 * sentence, so a kind it has never heard of would render as a blank row.
 */
export const ActivityKind = Object.freeze({
    /** A territory changed hands. Green, unless the player is the one who lost it. */
    CONQUEST: "conquest",
    /** An attack was fought and the attacker did not take the territory. Red. */
    ATTACK_FAILED: "attackFailed",
    /** A siege began. Amber. */
    SIEGE_STARTED: "siegeStarted",
    /** A siege is still running at the start of a turn. Amber. */
    SIEGE_ONGOING: "siegeOngoing",
    /** A siege ended without a battle -- the besiegers were arrested. Amber. */
    SIEGE_LIFTED: "siegeLifted",
    /**
     * A siege ended without a battle because the BESIEGER walked away -- it decided the
     * army was worth more at home than standing in front of a wall it was not going to
     * take. Distinct from SIEGE_LIFTED, which is the defender taking the besiegers: from
     * the store both are "a siege was removed", and a feed that called them the same thing
     * would tell the player their troops had been arrested when they had marched home.
     */
    SIEGE_ABANDONED: "siegeAbandoned",
    /** A siege became a battle and the besieger took the territory. */
    SIEGE_WON: "siegeWon",
    /** A siege became a battle and the defender held. */
    SIEGE_LOST: "siegeLost"
});

const KINDS = new Set(Object.values(ActivityKind));

/**
 * How many turns of history to keep.
 *
 * The log is saved with the game, so it is not free. Fifty turns of a busy map is
 * a few thousand entries and a handful of kilobytes against a ~460 KB envelope --
 * worth it. Two hundred turns is not, and a player who wants turn 3 back at turn
 * 240 is not a player this feature is for.
 */
export const MAX_TURNS_KEPT = 50;

/** @type {Map<number, object[]>} turn number -> entries, oldest turn first. */
const byTurn = new Map();

/** Monotonic, so the panel has a stable key and two identical entries stay distinct. */
let nextId = 1;

/**
 * Record something that happened.
 *
 * Returns the stored entry, or `null` when the kind is not a military one -- the
 * caller is never made to care, because every call site is a place where something
 * has just happened and none of them can usefully handle a rejection.
 *
 * @param {object} entry
 * @param {string} entry.kind        one of `ActivityKind`
 * @param {string} entry.territory   the territory the event is ABOUT
 * @param {string} [entry.defender]  the country holding it when this happened
 * @param {string} [entry.attacker]  the country acting on it
 * @param {boolean} [entry.playerAttacking]  the player is the attacker
 * @param {boolean} [entry.playerDefending]  the player is the defender
 * @param {number} [entry.turn]      defaults to the current turn
 * @param {number} [entry.turnsUnderSiege]  siege entries only
 */
export function recordActivity(entry) {
    if (!entry || !KINDS.has(entry.kind)) {
        console.warn("activityLog: refusing to record a non-military entry", entry);
        return null;
    }

    const turn = Number.isFinite(entry.turn) ? entry.turn : currentTurn();
    const stored = Object.freeze({
        id: nextId++,
        turn: turn,
        kind: entry.kind,
        territory: entry.territory ?? "",
        defender: entry.defender ?? "",
        attacker: entry.attacker ?? "",
        playerAttacking: Boolean(entry.playerAttacking),
        playerDefending: Boolean(entry.playerDefending),
        turnsUnderSiege: Number.isFinite(entry.turnsUnderSiege) ? entry.turnsUnderSiege : null
    });

    if (!byTurn.has(turn)) {
        byTurn.set(turn, []);
    }
    byTurn.get(turn).push(stored);
    trimToMaxTurns();

    emit(Events.ACTIVITY_LOGGED, { entry: stored });
    return stored;
}

/** Does the player have a stake in this entry, either side? */
export function involvesPlayer(entry) {
    return Boolean(entry.playerAttacking || entry.playerDefending);
}

/**
 * The whole log, newest turn first, each turn's entries in the order they happened.
 *
 * Newest first because that is what the panel opens on and what the player wants
 * without scrolling; within a turn, oldest first, because the entries are a
 * narrative of that turn and reading a battle's outcome above its start is
 * nonsense.
 */
export function activityTurns() {
    return [...byTurn.keys()]
        .sort((a, b) => b - a)
        .map((turn) => ({ turn: turn, entries: [...byTurn.get(turn)] }));
}

/** Just one turn's entries, oldest first. Empty array when there are none. */
export function activityForTurn(turn) {
    return [...(byTurn.get(turn) ?? [])];
}

/** How many entries are held, across every turn. Diagnostics and specs. */
export function activityCount() {
    let total = 0;
    for (const entries of byTurn.values()) {
        total += entries.length;
    }
    return total;
}

/** Which turns have anything in them, oldest first. */
export function activityTurnNumbers() {
    return [...byTurn.keys()].sort((a, b) => a - b);
}

/** Throw the whole log away. A new game, or a restart. */
export function clearActivityLog() {
    byTurn.clear();
    nextId = 1;
    emit(Events.ACTIVITY_LOGGED, { entry: null, cleared: true });
}

function trimToMaxTurns() {
    if (byTurn.size <= MAX_TURNS_KEPT) {
        return;
    }
    const oldestFirst = [...byTurn.keys()].sort((a, b) => a - b);
    while (byTurn.size > MAX_TURNS_KEPT) {
        byTurn.delete(oldestFirst.shift());
    }
}

// --- save / load -----------------------------------------------------------
//
// Registered as a slice by `gameTurnsLoop.js` rather than here, for the same
// reason `battle.js` registers its own: `platform/saveSlices.js` must not import
// game modules, and a module that registers itself at load time only works if
// something imports it. The two functions below are the slice's body.

/** JSON-safe snapshot of the whole log. */
export function captureActivityLog() {
    return {
        nextId: nextId,
        turns: [...byTurn.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([turn, entries]) => [turn, entries])
    };
}

/**
 * Put a captured log back.
 *
 * Tolerant of a missing or malformed payload: an activity feed is a nicety, and a
 * save from before this existed must still load. It refills the map in place for
 * the same reason every other slice does -- though nothing aliases this one today,
 * doing it differently from its neighbours is how the next person gets it wrong.
 */
export function restoreActivityLog(data) {
    byTurn.clear();
    nextId = 1;

    if (!data || !Array.isArray(data.turns)) {
        return;
    }

    for (const pair of data.turns) {
        if (!Array.isArray(pair) || pair.length < 2 || !Array.isArray(pair[1])) {
            continue;
        }
        const turn = Number(pair[0]);
        const entries = pair[1].filter((entry) => entry && KINDS.has(entry.kind));
        if (Number.isFinite(turn) && entries.length > 0) {
            byTurn.set(turn, entries.map((entry) => Object.freeze({ ...entry })));
        }
    }

    nextId = Number.isFinite(data.nextId) ? data.nextId : highestIdPlusOne();
    trimToMaxTurns();
    emit(Events.ACTIVITY_LOGGED, { entry: null, restored: true });
}

function highestIdPlusOne() {
    let highest = 0;
    for (const entries of byTurn.values()) {
        for (const entry of entries) {
            if (Number.isFinite(entry.id) && entry.id > highest) {
                highest = entry.id;
            }
        }
    }
    return highest + 1;
}
