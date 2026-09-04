// Showing the player a battle they defended.
//
// Battle overhaul B.8. The AI attacks a player territory; `doAttack()` fights it to a conclusion
// and queues the record (`src/state/battlePlayback.js`); this replays it in the battle window
// with the sides reversed, one round at a time, on a timer.
//
// NO INPUT, BY DESIGN. The plan (section 4.11) is explicit: the AI moves in its own phase, and a
// phase that waited on the player would stall the turn loop. So there is nothing to decide here
// -- the player watches their garrison hold or break, and sees WHY, in the same ledger the
// attacking player reads. The only control is Skip.
//
// THE SIDES ARE REVERSED. In the record, "attacker" is the AI. On screen the player's own
// garrison is what they are looking at, so the ledger's THEM column is the record's attacker and
// its YOU column is the record's defender. Getting this backwards would be worse than not
// building it: a player watching their own defeat labelled as their attack would trust nothing
// else in the window.
//
// It is a RENDERING of something that already happened. Skipping it changes nothing, which is
// exactly why skipping is safe to offer.

import { ids } from "../core/registry.js";
import { pendingDefences, takeNextDefence } from "../../state/battlePlayback.js";
import { diceStage } from "./DiceStage.js";
import { forceLedger } from "./ForceLedger.js";

/** How long one round sits on screen before the next, in milliseconds. */
const ROUND_INTERVAL = 900;

/** Remembered across sessions, so a player who does not want to watch is only asked once. */
const SKIP_PREFERENCE_KEY = "battlePlayback.alwaysSkip";

let timer = null;
let onFinished = null;

/** Whether the player has asked never to be shown these. */
export function alwaysSkip() {
    try {
        return window.localStorage?.getItem(SKIP_PREFERENCE_KEY) === "1";
    } catch {
        //A private window, or site data blocked. Not a reason to fail; just show the playback.
        return false;
    }
}

export function setAlwaysSkip(value) {
    try {
        window.localStorage?.setItem(SKIP_PREFERENCE_KEY, value ? "1" : "0");
    } catch {
        //Nothing to do -- the preference is a convenience, not state the game depends on.
    }
}

/** The ledger view for one recorded round, with the sides swapped for the defender's eye. */
function ledgerViewFor(record) {
    return {
        //The record's DEFENDER is the player, so it goes in the YOU column.
        attackerDice: record.defenderDice,
        defenderDice: record.attackerDice,
        attackerFaces: record.defenderFaces,
        defenderFaces: record.attackerFaces,
        modifiers: {
            attacker: record.modifiers?.defender,
            defender: record.modifiers?.attacker
        }
    };
}

/**
 * Draw one round of a recorded battle.
 *
 * @param {object} battle   from the playback queue
 * @param {object} record   one of its rounds
 * @param {object} deps     the ui.js functions that write the window
 */
function drawRound(battle, record, deps) {
    //`setArmyTextValues(..., 1, id)` takes eight numbers: the left half then the right half. The
    //player is on the left, so the record's defender goes first.
    deps.setArmyTextValues(
        [...record.defendersAfter, ...record.attackersAfter], 1, battle.territoryId);
    forceLedger.update(ledgerViewFor(record));
    //No fallback literal: DiceStage resolves a theme token when it is handed nothing (B.10.2).
    diceStage.showRound(
        { attackerFaces: record.defenderFaces, defenderFaces: record.attackerFaces },
        deps.attackerColour);
}

/** Stop the timer. */
function stop() {
    if (timer !== null) {
        clearInterval(timer);
        timer = null;
    }
}

/**
 * Show every queued defence, one after another.
 *
 * @param {{setArmyTextValues: Function, openWindow: Function, closeWindow: Function,
 *          setTitle: Function, attackerColour?: string}} deps
 * @returns {Promise<void>} resolves when the last one has finished or been skipped
 */
export function playQueuedDefences(deps) {
    if (pendingDefences() === 0) {
        return Promise.resolve();
    }
    if (alwaysSkip()) {
        //Drain it. The battles have already been fought; the player has said they do not want to
        //watch, and leaving them queued would show them at the start of some later turn.
        while (takeNextDefence()) {
            //drained
        }
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        onFinished = resolve;
        playNext(deps);
    });
}

function playNext(deps) {
    const battle = takeNextDefence();
    if (!battle) {
        stop();
        deps.closeWindow?.();
        const finish = onFinished;
        onFinished = null;
        finish?.();
        return;
    }

    deps.openWindow?.(battle);
    deps.setTitle?.(battle);
    forceLedger.show(true);

    let index = 0;
    stop();
    timer = setInterval(() => {
        const record = battle.records[index];
        index += 1;
        if (!record) {
            stop();
            playNext(deps);
            return;
        }
        drawRound(battle, record, deps);
    }, ROUND_INTERVAL);
}

/** Cut the current playback short and move on. Wired to the skip control. */
export function skip(deps) {
    stop();
    diceStage.skip();
    playNext(deps);
}

/** Abandon everything -- a new game, or a load. */
export function reset() {
    stop();
    onFinished = null;
}

export const defenderPlayback = {
    playQueuedDefences,
    skip,
    reset,
    alwaysSkip,
    setAlwaysSkip
};
