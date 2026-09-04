// Is this game over, and for whom?
//
// `src/ai/victory.js` answers the measurement question -- has a given country met the
// condition. This turns that into an OUTCOME, and the two are separate because they are
// asked by different things: the AI asks the first every turn for all 207 countries and
// acts on the answer, while this is asked once, at the end of a turn, and ends the game.
//
// Three properties are worth stating because each one was a decision:
//
//   * **The goal is a shared race.** Every country plays for the same condition, so an AI
//     getting there first is the player's DEFEAT rather than a curiosity. That is what
//     puts a clock on the map, and it is why this scans every country rather than only
//     the player.
//   * **Elimination runs underneath every goal.** Holding nothing is losing whatever you
//     were playing for. It was written into the enum as a victory condition and never was
//     one, so `hasWon()` answers `false` for it and the rule lives here instead.
//   * **The result is deterministic.** Two countries can complete their third continent on
//     the same turn, and a timed game can end with two empires of equal size. Ties are
//     broken explicitly rather than by map order, or a seeded run would not reproduce its
//     own ending.
//
// Pure: imports `config/` and `state/selectors.js` through `victory.js` and nothing else,
// so it runs in Node and the unit suite can play out an ending on a seven-territory world.

import {
    activeVictoryCondition,
    hasWon,
    VictoryCondition,
    worldStandings
} from "../ai/victory.js";

/**
 * @typedef {object} VictoryResult
 * @property {"VICTORY"|"DEFEAT"|"DECIDED"} outcome from the PLAYER's point of view;
 *   `DECIDED` is a game with no player in it, which is spectator mode
 * @property {string|null} winner the country that won, or null if the player was eliminated
 *   without anybody having met the condition
 * @property {"CONDITION_MET"|"TURN_LIMIT"|"ELIMINATED"} reason
 * @property {number} turn
 * @property {object} condition the condition that was being played for
 */

/**
 * Ask once, at the end of a turn, before the turn counter advances.
 *
 * The ordering that matters is inside the caller rather than here: `endTurn: advanceTurn`
 * in `gameTurnsLoop.js` means the counter moves AFTER the hooks run, so the check during
 * turn N sees `turn === N` and a game with a limit of 200 ends at the end of turn 200.
 *
 * @param {{turn: number, playerCountry: string|null, condition?: object, standings?: object}} options
 * @returns {VictoryResult|null} null while the game is still being played
 */
export function checkForVictory({
    turn = 0,
    playerCountry = null,
    condition = activeVictoryCondition(),
    standings = worldStandings()
} = {}) {
    //Elimination first. A player who has been driven off the map has lost whatever else is
    //true of the world, and reporting a rival's victory instead would be a strictly worse
    //account of the same ending.
    if (playerCountry && !(standings.byCountry.get(playerCountry)?.territories > 0)) {
        return {
            outcome: "DEFEAT",
            winner: null,
            reason: "ELIMINATED",
            turn,
            condition
        };
    }

    //Sorted by name so that two countries meeting the condition on the same turn resolve
    //the same way every time. `byCountry` holds only countries that still own something,
    //which is the right set: nothing wins from nothing.
    const winners = [...standings.byCountry.keys()]
        .filter(country => hasWon(country, condition, standings, turn))
        .sort((a, b) => a.localeCompare(b));

    if (winners.length === 0) {
        return null;
    }

    //The player takes a shared ending. If they and an AI both completed the condition on
    //this turn, the game they were playing is the one that gets reported.
    const playerWon = playerCountry !== null && winners.includes(playerCountry);
    const winner = playerWon ? playerCountry : winners[0];

    return {
        outcome: playerWon ? "VICTORY" : (playerCountry === null ? "DECIDED" : "DEFEAT"),
        winner,
        reason: condition.kind === VictoryCondition.TURN_LIMIT ? "TURN_LIMIT" : "CONDITION_MET",
        turn,
        condition
    };
}
