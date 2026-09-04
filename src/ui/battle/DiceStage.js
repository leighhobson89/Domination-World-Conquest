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
 * How long the settled dice stay at full strength before they fade, in milliseconds.
 *
 * The dice are ON TOP of the clash panel, deliberately -- they are the thing that just happened
 * and the panel is the explanation of it, so the roll must not be obscured by its own commentary.
 * But the moment they have settled the roll is over and the explanation is what matters, and a
 * pile of dice sitting over the pairings is then just clutter. So they hold for a beat, long
 * enough to read the faces, and then get out of the way.
 *
 * It is counted from the dice coming to REST, not from the round resolving, because how long a
 * throw takes to settle varies with how many dice are in it and what they hit on the way down. A
 * skip settles them early and the beat starts early with it, which is the right behaviour: a
 * player who skipped the animation is asking to get on with it.
 */
const SETTLED_LINGER_MS = 2000;

/**
 * The longest a throw may take to come to rest, in milliseconds.
 *
 * A CAP, not a target. The physics runs in real time -- `render()` drives the world from
 * `fixedStep()`, which reads the wall clock -- so how long a roll takes is whatever the dice
 * happen to do, and measured throws ran to three and a half seconds while the dice nudged each
 * other around the tray. Damping and friction shorten the skid but cannot bound the tail, because
 * what makes a roll long is five dice settling against each other rather than any one of them
 * travelling far.
 *
 * Everything downstream is timed off the settle -- the two-second hold, the fade, and the clash
 * panel underneath waiting to be read -- so an unbounded tail is not a cosmetic problem, it is the
 * sequence coming apart. Past the cap the dice are settled the same way a click settles them, and
 * `skipRoll()` is used rather than a second mechanism precisely because that path is the one the
 * player exercises every time they click through an animation.
 */
const MAX_ROLL_MS = 2200;

/** The pending fade, so a new roll can cancel one that has not fired yet. */
let fadeTimer = null;

/** The pending cap, so a roll that settles on its own does not get stopped afterwards. */
let capTimer = null;

function cancelCap() {
    if (capTimer !== null) {
        clearTimeout(capTimer);
        capTimer = null;
    }
}

function cancelFade() {
    if (fadeTimer !== null) {
        clearTimeout(fadeTimer);
        fadeTimer = null;
    }
}

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

/** Show the canvas, at full strength. */
function showCanvas() {
    cancelFade();
    const container = document.getElementById(ids.threeCanvasForDice);
    if (container) {
        container.style.display = "block";
        //A previous round may have left it faded out. The class is the whole of the state, so
        //taking it off is the whole of the reset -- and it has to happen BEFORE the new dice are
        //drawn, or the first frame of the next roll is invisible.
        container.classList.remove("is-settled");
    }
}

/** Fade the settled dice away, leaving the clash panel to be read. */
function fadeCanvas() {
    fadeTimer = null;
    const container = document.getElementById(ids.threeCanvasForDice);
    //Only if nothing has started rolling in the meantime. Two rounds clicked quickly would
    //otherwise have the first round's fade land on the second round's dice.
    if (container && !rolling) {
        container.classList.add("is-settled");
    }
}

/** Hide it. */
function hideCanvas() {
    cancelFade();
    const container = document.getElementById(ids.threeCanvasForDice);
    if (container) {
        container.style.display = "none";
        container.classList.remove("is-settled");
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
    cancelCap();
    capTimer = setTimeout(() => {
        capTimer = null;
        if (rolling) {
            skipRoll();
        }
    }, MAX_ROLL_MS);
    return rollDiceOnScreen(faces, record.attackerFaces.length, enemyColour || neutralColour())
        .catch((error) => {
            //A dice roll must never be able to take the battle down with it. WebGL can fail for
            //reasons that have nothing to do with this game -- a lost context, a headless run
            //with no GPU -- and the round has already been decided by the time we get here.
            console.warn("dice stage: the roll could not be rendered", error);
        })
        .finally(() => {
            rolling = false;
            cancelCap();
            //Settled. Hold the faces for a beat, then get out of the clash panel's way.
            cancelFade();
            fadeTimer = setTimeout(fadeCanvas, SETTLED_LINGER_MS);
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
    cancelCap();
    hideCanvas();
}

/** Release the GL context. Called when the battle window is destroyed. */
export function destroy() {
    rolling = false;
    cancelCap();
    cancelFade();
    disposeDiceStage();
    hideCanvas();
}

export const diceStage = { showRound, skip, isRolling, hide, destroy };
