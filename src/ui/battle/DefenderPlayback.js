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
import { clashPanel } from "./ClashPanel.js";
import { diceStage } from "./DiceStage.js";
import { forceLedger } from "./ForceLedger.js";

/**
 * How long one PAIRING takes to close and resolve in the clash panel, in milliseconds.
 *
 * It is `PAIR_STEP_MS` from `ClashPanel.js`, restated rather than imported because it is a
 * timing this module needs in order to know when the panel has FINISHED, and the panel does not
 * report that. Both numbers describe the same animation, so if one moves the other has to.
 */
const PAIR_STEP_MS = 420;

/**
 * How long a resolved round is left on screen before the next one starts, in milliseconds.
 *
 * ~~`ROUND_INTERVAL = 900`, on a `setInterval`.~~ That was the whole pacing of a playback and it
 * was wrong in two ways at once. It was far faster than the player's own experience of a round --
 * a throw takes up to 2.2 seconds to settle by itself -- so the dice of round two were being
 * thrown while round one's were still tumbling, and the clash panel (which is chained to the dice
 * coming to REST) never got the chance to say anything. And because it was a fixed interval
 * rather than a chain, it could not adapt: a round with five pairings needs longer than a round
 * with one, and no single number is right for both.
 *
 * So a round is now CHAINED off the dice settling, exactly as the player's own rounds are, the
 * clash panel is revealed at that moment, and this is the beat afterwards in which the account of
 * the round is read. The next round begins when the last pairing has resolved plus this.
 *
 * It is deliberately shorter than the clash panel's own `LINGER_MS` (7.2s): that is how long the
 * panel waits before fading when nothing follows it, and a turn can queue several battles of
 * several rounds each. `play()` clears the pending fade, so the panel stays up continuously
 * through a battle rather than fading and reopening between rounds.
 */
const ROUND_READ_MS = 1500;

/** Remembered across sessions, so a player who does not want to watch is only asked once. */
const SKIP_PREFERENCE_KEY = "battlePlayback.alwaysSkip";

let timer = null;
let onFinished = null;
/** Bumped by anything that abandons the chain, so a settle in flight knows it is stale. */
let generation = 0;

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

    //THE CLASH PANEL IS NOT REVERSED, AND THAT IS DELIBERATE -- it is the one thing in this
    //file that is not. The ledger's columns are YOU and THEM, unlabelled by country, so they
    //have to be swapped or the player reads their own defeat as their attack. The panel names
    //both sides, so there is nothing to misread; and mirroring it would make it state the rules
    //WRONGLY. "tie -- defender holds" is the defender's structural advantage in this model, and
    //under a mirror the tie would be shown going to the side the panel calls the attacker. The
    //rules' attacker here is the AI, so the panel shows the round as it was actually fought,
    //with the two countries named -- and a player watching a tie go their way learns something
    //true about defending.
    clashPanel.play(record, {
        attacker: battle.attackerCountry,
        defender: battle.defenderCountry
    });

    //The dice, on the other hand, ARE the player's first -- `rollDiceOnScreen()` paints the
    //leading `attackerCount` in the player's own colour. A pile of dice has no left and right,
    //so there is no orientation here to disagree with the panel about; there is only whose
    //colour each die is.
    //
    //The attacker's colour is read off the RECORD, which copied it at the moment the battle was
    //fought. Reading it back off the world now would ask the territory who owns it after the
    //battle, which is the trap that made the Wars & Sieges tab draw the winner's flag on both
    //sides of a war (known-issues AS). When the record carries none, DiceStage resolves a theme
    //token itself -- a literal here would be a colour decision made outside the layer that draws.
    return diceStage.showRound(
        { attackerFaces: record.defenderFaces, defenderFaces: record.attackerFaces },
        battle.attackerColour || deps.attackerColour);
}

/** Stop the pending round. */
function stop() {
    if (timer !== null) {
        clearTimeout(timer);
        timer = null;
    }
    //A round already in flight must not go on to schedule the next one. The chain is driven by
    //a promise that cannot be cancelled, so the generation counter is what cancels it: `skip()`
    //and `reset()` bump it, and a settle that belongs to a previous generation does nothing.
    generation += 1;
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

    stop();
    playRound(battle, 0, deps, generation);
}

/**
 * One round of a replay, and then the next.
 *
 * A CHAIN, not an interval. Everything the player is shown about a round is timed off the dice
 * coming to REST -- the clash panel's reveal most of all, because a panel that filled itself in
 * on a fixed delay would sometimes print the result while the dice were still in the air, which
 * makes the roll look like an animation played over an answer the game had already given. That
 * is the reasoning `battle.js` records for the player's own rounds, and the whole point of this
 * change is that a replay is paced the same way a played battle is.
 *
 * `showRound()` resolves immediately when the dice cannot be drawn at all -- no GPU, a lost
 * context, a headless run -- so the chain never stalls on a render loop, and a skip settles the
 * dice, which resolves it early by the same route a player's click does.
 *
 * @param {number} era  the generation this chain belongs to; a stale settle does nothing
 */
function playRound(battle, index, deps, era) {
    const record = battle.records[index];
    if (!record) {
        playNext(deps);
        return;
    }

    const rolled = drawRound(battle, record, deps);

    Promise.resolve(rolled).catch(() => {
        //`showRound()` already swallows its own failures; this is only here so that a rejected
        //promise cannot break the chain and leave the replay half-shown forever.
    }).then(() => {
        if (era !== generation) {
            return;
        }
        //The dice have landed, so the panel may now say what they meant.
        clashPanel.reveal();
        //And the next round starts once the last pairing has resolved and been read. A round
        //with five pairings takes longer to play out than one with a single pairing, which is
        //exactly what a fixed interval could not express.
        const pairings = Array.isArray(record.pairings) ? record.pairings.length : 0;
        const dwell = pairings * PAIR_STEP_MS + ROUND_READ_MS;
        timer = setTimeout(() => {
            timer = null;
            if (era === generation) {
                playRound(battle, index + 1, deps, era);
            }
        }, dwell);
    });
}

/** Cut the current playback short and move on. Wired to the skip control. */
export function skip(deps) {
    stop();
    diceStage.skip();
    //The panel is transient and belongs to the round being skipped past. Taking it down here is
    //what stops a pairing animation playing over the NEXT battle's opening frame.
    clashPanel.hide();
    playNext(deps);
}

/** Abandon everything -- a new game, or a load. */
export function reset() {
    stop();
    clashPanel.hide();
    onFinished = null;
}

export const defenderPlayback = {
    playQueuedDefences,
    skip,
    reset,
    alwaysSkip,
    setAlwaysSkip
};
