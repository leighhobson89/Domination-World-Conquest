// The dice on screen, for one round.
//
// Battle overhaul B.6.5. A thin adapter over `dices.js`: it knows which faces belong to which
// side and what colour each side is, and nothing else. `dices.js` knows physics and knows
// nothing about battles.
//
// THE ROLL DOES NOT BLOCK THE ROUND. The numbers in the battle window update the moment the
// round resolves, and the dice tumble over the top of them. Making the UI wait for the physics
// would put a second-and-a-half between every click and its result, and would make every e2e
// spec's timing depend on a render loop. The dice are a rendering OF the result, not a gate on
// it -- which is the same relationship they have to the rules (see the header of `dices.js`).
//
// The canvas carries `pointer-events: none`, so a roll in flight never swallows a click on the
// advance button underneath it.

import { rollDiceOnScreen, skipRoll, disposeDiceStage } from "../../../dices.js";
import { ids } from "../core/registry.js";

/** True while a roll is in flight, so the skip control knows whether it has anything to do. */
let rolling = false;

/**
 * The colour to roll in when the caller has none -- an unowned defender, or a replay whose
 * attacker colour was not passed.
 *
 * Battle overhaul B.10.2. Two call sites carried the literal `"rgb(128,128,128)"`. The dice are
 * drawn into a CANVAS, which no stylesheet reaches, so the token has to be resolved and passed
 * through as a value -- the same thing `src/ui/siegeOverlay.js` does for the markers drawn into
 * the map document, and for the same reason. Resolving it HERE rather than at each caller is what
 * keeps the colour decision in the layer that draws, and keeps `battle.js` free of colour
 * literals entirely.
 *
 * The hard-coded grey is a last resort for a document with no tokens on it at all (a detached
 * test DOM). It is not a theme colour and nothing should ever see it.
 */
function neutralColour() {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--text-muted").trim();
    return value || "#808080";
}

/** Show the canvas. */
function showCanvas() {
    const container = document.getElementById(ids.threeCanvasForDice);
    if (container) {
        container.style.display = "block";
    }
}

/** Hide it. */
function hideCanvas() {
    const container = document.getElementById(ids.threeCanvasForDice);
    if (container) {
        container.style.display = "none";
    }
}

/**
 * Roll the dice a round produced.
 *
 * @param {{attackerFaces: number[], defenderFaces: number[]}} record  from `resolveBattleRound()`
 * @param {string} enemyColour  the defender's colour as an rgb() string
 * @returns {Promise<void>} resolves when the dice settle; safe to ignore
 */
export function showRound(record, enemyColour) {
    const faces = [...(record?.attackerFaces ?? []), ...(record?.defenderFaces ?? [])];
    if (faces.length === 0) {
        return Promise.resolve();
    }
    showCanvas();
    rolling = true;
    return rollDiceOnScreen(faces, record.attackerFaces.length, enemyColour || neutralColour())
        .catch((error) => {
            //A dice roll must never be able to take the battle down with it. WebGL can fail for
            //reasons that have nothing to do with this game -- a lost context, a headless run
            //with no GPU -- and the round has already been decided by the time we get here.
            console.warn("dice stage: the roll could not be rendered", error);
        })
        .finally(() => {
            rolling = false;
        });
}

/** Settle the dice immediately. Wired to a click anywhere over the battle window. */
export function skip() {
    if (rolling) {
        skipRoll();
    }
}

/** True while dice are still tumbling. */
export function isRolling() {
    return rolling;
}

/** Close the stage down: the battle is over. */
export function hide() {
    rolling = false;
    hideCanvas();
}

/** Release the GL context. Called when the battle window is destroyed. */
export function destroy() {
    rolling = false;
    disposeDiceStage();
    hideCanvas();
}

export const diceStage = { showRound, skip, isRolling, hide, destroy };
