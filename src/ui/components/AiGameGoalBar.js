// The strip across the top of a spectated game: what this world is being played FOR.
//
// A played game fills that space with the player's top table -- gold, oil, food, army. A
// spectated game has no player, so `applySpectatorChrome()` takes the top table down and
// leaves the width of the screen empty. This is what goes there instead, and it answers the
// only question that space can usefully answer when there is nobody to describe: which
// victory condition the two hundred countries below are racing for, and who is winning it.
//
// **The goal is chosen at random when a spectated game starts.** That is the point of it: a
// debug mode fixed to the default condition would only ever exercise the default condition,
// and the doctrine layer's whole claim is that five goals produce five different worlds. The
// draw comes from `Math.random()` rather than from `cosmeticRandom()` deliberately -- the
// goal is a rule of the game and not a decoration, and taking it from the seeded stream is
// what makes `?seed=alpha` reproduce the same world INCLUDING what it was playing for.
//
// It is debug chrome, so it takes `--debug-surface` / `--debug-ink` like the AI Game button
// and the spectator console: a debug surface that matches the theme is a debug surface
// somebody ships.
//
// It follows `TURN_CHANGED` and nothing else. The leader can only move when territory
// changes hands, and re-deriving the world standings more often than once a turn would put a
// 359-territory pass in front of every repaint.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";
import { Events, on as onStateEvent } from "../../state/events.js";
import { describeCondition } from "../goals/goalCatalogue.js";

let root = null;
let goalText = null;
let leaderText = null;
let finishButton = null;
let unsubscribe = null;
/** Where the numbers come from. Injected so this file imports nothing from the AI. */
let readWorld = null;

/**
 * @param {object} deps
 * @param {() => object} [deps.readWorld]  the active condition and who is leading it
 * @param {() => void}   [deps.onFinish]   end the spectated session
 * @param {() => void}   [deps.onSound]
 */
export function create({ readWorld: reader, onFinish, onSound } = {}) {
    if (root) return root;
    readWorld = reader ?? null;

    goalText = el("span", { class: "ai-game-goal-text" });
    leaderText = el("span", { class: "ai-game-goal-leader" });

    // FINISH LIVES HERE RATHER THAN IN THE CONSOLE, and it is not merely a nicer place for
    // it. The console can now be closed and pushed off screen -- that is what its X does and
    // what the joystick button over the map undoes -- so a control that ENDS the session
    // cannot live inside it: the one action you cannot take back would be the one action
    // hidden behind a window you had just tidied away.
    //
    // It is a CHILD of the bar rather than a separate fixed element, because the bar is
    // centred with `translateX(-50%)` and its width follows the length of the goal text. A
    // sibling positioned "to the right of it" would have to be re-measured whenever the
    // leader changed name; a child is simply the last thing in the strip.
    finishButton = el("button", {
        id: ids.aiGameFinishBtn,
        class: "ai-game-goal-finish",
        text: "FINISH",
        attrs: { type: "button", title: "End the AI game and return to the main menu" },
        on: {
            click() {
                onSound?.();
                onFinish?.();
            }
        }
    });

    root = el("div", { id: ids.aiGameGoalBar, class: "ai-game-goal-bar" },
        [goalText, leaderText, finishButton]);
    mount(document.body, root);

    unsubscribe = onStateEvent(Events.TURN_CHANGED, () => update());
    return root;
}

/**
 * Repaint from the active condition and the world standings.
 *
 * Silent when the bar is not on screen, which is every ordinary game -- the subscription
 * above is live for the whole session and this is the guard that makes that cost nothing.
 */
export function update() {
    if (!root || !readWorld || root.style.display === "none") {
        return;
    }
    const world = readWorld();
    if (!world) {
        return;
    }
    goalText.textContent = "GOAL: " + describeCondition(world.condition).toUpperCase();
    leaderText.textContent = world.leader
        ? "Leading: " + world.leader + " (" + world.leaderProgress + ")"
        : "";
}

export function show() {
    if (!root) create();
    root.style.display = "";
    root.classList.add("is-visible");
    update();
}

export function hide() {
    if (!root) return;
    root.classList.remove("is-visible");
    root.style.display = "none";
}

export function isVisible() {
    return Boolean(root) && root.classList.contains("is-visible");
}

/** What the bar reads. The e2e harness and the spectator specs ask this way. */
export function text() {
    return root ? root.textContent : "";
}

export function destroy() {
    unsubscribe?.();
    unsubscribe = null;
    root?.remove();
    root = null;
    goalText = leaderText = finishButton = readWorld = null;
}

export const aiGameGoalBar = { create, update, show, hide, isVisible, text, destroy };
