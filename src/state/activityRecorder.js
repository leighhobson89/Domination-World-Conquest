// What gets written to the activity feed, and from where.
//
// Phase 7.4. `activityLog.js` is the record; this is the set of rules about when
// to add to it. Splitting them means the log can be unit-tested without any of the
// game's events, and the rules can be read in one place instead of being inferred
// from eight scattered call sites.
//
// There are two ways an entry gets in, and the division is deliberate.
//
// **Derived from state, where the state change IS the event.** A conquest is
// exactly "a territory's `dataName` changed", and a siege beginning is exactly
// "a siege was added". Both already emit through `state/events.js`, from
// `mutations.js`, which every code path must go through -- so deriving them here
// means a conquest cannot be missed by a new attack route that forgets to call a
// logger. That matters: there are eight places that take a territory today.
//
// **Reported explicitly, where the state change does not carry the reason.** A
// failed attack changes nothing about who owns what, so there is no state to
// derive it from. And a siege ENDING is one event with three meanings -- the
// besiegers were arrested, the siege broke into a battle the besieger won, or one
// they lost -- and the store cannot tell them apart after the fact. Those four
// callers say what happened.
//
// This module imports only from `state/`, so it stays loadable in Node.

import { ActivityKind, recordActivity } from "./activityLog.js";
import { Events, on } from "./events.js";
import { playerCountryName } from "./selectors.js";

let installed = false;

/**
 * Start deriving entries from state events.
 *
 * Idempotent, because bootstrap is two halves that finish out of order and this is
 * called from the earlier one. Returns the uninstaller, which is what a test uses
 * to put the world back.
 */
export function installActivityRecorder() {
    if (installed) {
        return () => {};
    }
    installed = true;

    const offTerritory = on(Events.TERRITORY_CHANGED, onTerritoryChanged);
    const offSiege = on(Events.SIEGE_CHANGED, onSiegeChanged);

    return () => {
        offTerritory();
        offSiege();
        installed = false;
    };
}

/**
 * A territory changed hands.
 *
 * `previous.dataName` is the country it was taken FROM and is why `updateTerritory()`
 * reports the values it overwrote -- by the time this runs the store only knows who
 * holds the territory now.
 *
 * Two changes are deliberately NOT conquests and both would otherwise be logged.
 * `initialiseGame()` sets the player's own starting territories to `owner: "Player"`
 * without touching `dataName`, so testing `dataName` rather than `owner` filters it
 * out; and a restore patches territories without emitting at all.
 */
function onTerritoryChanged({ territory, changed, previous }) {
    if (!changed?.includes("dataName")) {
        return;
    }
    const from = previous?.dataName;
    const to = territory?.dataName;
    if (!from || !to || from === to) {
        return;
    }

    const player = playerCountryName();
    recordActivity({
        kind: ActivityKind.CONQUEST,
        territory: territory.territoryName,
        defender: from,
        attacker: to,
        playerAttacking: to === player,
        playerDefending: from === player
    });
}

/**
 * A siege was added or removed.
 *
 * Only `add` is derived. A removal is handled by whichever caller removed it,
 * because "the siege is gone" does not say whether the besiegers were arrested,
 * stormed the place, or were thrown back -- and those are three different lines in
 * three different senses.
 */
function onSiegeChanged({ action, siege, territoryName, side }) {
    if (action !== "add" || !siege) {
        return;
    }

    const player = playerCountryName();
    const defender = siege.defendingTerritory?.dataName ?? siege.defendingCountry ?? "";
    const attacker = siege.attackingCountry ?? (side === "player" ? player : "");

    recordActivity({
        kind: ActivityKind.SIEGE_STARTED,
        territory: territoryName,
        defender: defender,
        attacker: attacker,
        playerAttacking: side === "player",
        playerDefending: siege.defendingTerritory?.owner === "Player"
    });
}

// --- the explicit half -----------------------------------------------------

/**
 * An attack was fought and the territory did not change hands.
 *
 * @param {{territory: string, defender: string, attacker: string,
 *          playerAttacking?: boolean, playerDefending?: boolean}} what
 */
export function recordFailedAttack(what) {
    return recordActivity({ kind: ActivityKind.ATTACK_FAILED, ...what });
}

/** A siege ended because the besieging army was arrested. */
export function recordSiegeLifted(what) {
    return recordActivity({ kind: ActivityKind.SIEGE_LIFTED, ...what });
}

/** A siege became a battle. `besiegerWon` picks which of the two lines is written. */
/**
 * A besieging country gave up and marched its army home (`src/ai/siegeReview.js`).
 *
 * Explicit for the same reason every other siege ending is: `SIEGE_CHANGED` fires for the
 * removal, but a removal alone cannot say which of the four endings this was.
 */
export function recordSiegeAbandoned(what) {
    return recordActivity({ kind: ActivityKind.SIEGE_ABANDONED, ...what });
}

export function recordSiegeResolved({ besiegerWon, ...what }) {
    return recordActivity({
        kind: besiegerWon ? ActivityKind.SIEGE_WON : ActivityKind.SIEGE_LOST,
        ...what
    });
}

/**
 * One line per siege still running, at the start of a turn.
 *
 * Called once from `beginTurn()` with both lists, rather than from
 * `incrementSiegeTurns()` -- which runs twice, and is a rule rather than a
 * narrator. A siege that started this turn is skipped: it already has a "lays
 * siege to" line above, and following it immediately with "still besieged, turn 1"
 * reads as a stutter.
 *
 * @param {Array<{side: "player"|"ai", territoryName: string, siege: object}>} running
 */
export function recordOngoingSieges(running) {
    const player = playerCountryName();
    const written = [];
    for (const { side, territoryName, siege } of running ?? []) {
        const turns = Number(siege?.turnsInSiege) || 0;
        if (turns < 2) {
            continue;
        }
        written.push(
            recordActivity({
                kind: ActivityKind.SIEGE_ONGOING,
                territory: territoryName,
                defender: siege.defendingTerritory?.dataName ?? siege.defendingCountry ?? "",
                attacker: siege.attackingCountry ?? (side === "player" ? player : ""),
                playerAttacking: side === "player",
                playerDefending: siege.defendingTerritory?.owner === "Player",
                turnsUnderSiege: turns
            })
        );
    }
    return written.filter(Boolean);
}
