// The battle window's controls.
//
// Battle overhaul B.6.2 / B.6.6. `src/ui/components/BattleUI.js` builds the window's elements --
// the flags, the probability bar, the sixteen army figures, the stat strip, the bottom bar -- and
// keeps doing so. What moved HERE is everything that decided what those five bottom-bar buttons
// SAY, whether they respond, how wide they are and what colour they go: roughly a hundred and
// eighty lines that lived inside `ui.js`'s `DOMContentLoaded` handler and in six exported setters
// beside it.
//
// Three rules, and they are the reason this is a module rather than a tidier `ui.js`:
//
// 1. THE STATE IS ONE OBJECT AND THE LABELS ARE DERIVED FROM IT. `buttonState.js` is pure and
//    unit-tested; this file is the only thing that turns its output into elements. A label is
//    never read back to decide anything -- the advance handler used to ask
//    `if (advanceButton.innerHTML === "Start Attack!")`, which is a question about the battle
//    answered by parsing the DOM, and which could never be true because nothing wrote that string.
//
// 2. DISABLED IS A CLASS, NOT A COLOUR. Eleven sites wrote `style.backgroundColor =
//    "rgb(128, 128, 128)"` to mean "inert", spread across `battle.js` and `ui.js`, and the six
//    mouseover/mouseout listeners that fought them wrote four more literals. Every one of those
//    is gone: `is-disabled` is the state and `style.css` owns the colours as theme tokens, which
//    is what the overhaul's B.10 asks for and what the stylesheet spec enforces.
//
// 3. THE HANDLERS STAY IN `ui.js`. What a press MEANS -- open a battle, resolve a round, garrison
//    a conquest, queue a retrieval -- is turn-loop work with the whole game behind it. This module
//    installs the listeners ONCE, from `create()`, and calls back; it never decides an outcome.
//    Installing once matters for the reason the move button records: a listener re-attached per
//    battle cannot be removed again, because `removeEventListener` is given a new function object
//    every time, and the press then fires once per battle opened.

import { ids } from "../core/registry.js";
import {
    AdvanceMode,
    ReservesState,
    RetreatMode,
    ThirdButton,
    VictoryKind,
    battleBarWidths,
    deriveBattleButtons,
    initialBattleButtons,
    siegeBattleButtons
} from "./buttonState.js";

let state = initialBattleButtons();
let handlers = {};
let installed = false;

function element(id) {
    return document.getElementById(id);
}

/** The five bottom-bar buttons plus the siege button in row 4, by the key `buttonState` uses. */
function elementsByKey() {
    return {
        retreat: element(ids.retreatButton),
        digIn: element(ids.digInButton),
        reserves: element(ids.reservesButton),
        advance: element(ids.advanceButton),
        third: element(ids.siegeBottomBarButton),
        siege: element(ids.siegeButton)
    };
}

/**
 * Write one button's description onto its element.
 *
 * `enabled` becomes `aria-disabled` and the `is-disabled` class rather than the `disabled`
 * PROPERTY, for the reason CLAUDE.md records for the steppers and the action buttons: a truly
 * disabled control swallows the event, and the battle container installs a capture listener that
 * has to see every click over the window in order to settle the dice. It is also what lets
 * Playwright report a control as inert instead of merely refusing to press it.
 */
function applyButton(node, spec) {
    if (!node || !spec) {
        return;
    }
    if (spec.visible === false) {
        node.style.display = "none";
        return;
    }
    node.style.display = "flex";
    if (typeof spec.label === "string" && node.innerHTML !== spec.label) {
        node.innerHTML = spec.label;
    }
    const enabled = spec.enabled !== false;
    node.classList.toggle("is-disabled", !enabled);
    node.setAttribute("aria-disabled", enabled ? "false" : "true");
    //The `disabled` property is deliberately cleared: several of these elements were left
    //`disabled = true` by the old code and would otherwise stay inert for the rest of the session.
    node.disabled = false;
    if (Object.prototype.hasOwnProperty.call(spec, "armed")) {
        node.classList.toggle("is-armed", Boolean(spec.armed));
    }
}

/** Is this control currently accepting presses? The guard every handler opens with. */
export function isBattleButtonEnabled(id) {
    const node = element(id);
    return Boolean(node) && node.getAttribute("aria-disabled") !== "true"
        && node.style.display !== "none";
}

/** Redraw the bar from the current state. Idempotent, so calling it twice costs nothing. */
export function refresh() {
    const spec = deriveBattleButtons(state);
    const nodes = elementsByKey();

    applyButton(nodes.retreat, spec.retreat);
    applyButton(nodes.digIn, spec.digIn);
    applyButton(nodes.reserves, spec.reserves);
    applyButton(nodes.advance, spec.advance);
    applyButton(nodes.third, spec.third);
    //The siege button is in row 4, not the bar, so it has a state but no width.
    applyButton(nodes.siege, { ...spec.siege, label: "Siege Territory" });

    const widths = battleBarWidths(spec);
    for (const [key, width] of Object.entries(widths)) {
        if (nodes[key]) {
            nodes[key].style.width = width;
        }
    }
    return spec;
}

/** Merge a partial state in and redraw. The single write path. */
export function setBattleButtons(patch) {
    state = { ...state, ...(patch ?? {}) };
    return refresh();
}

/** The state as it stands -- read by the handlers to decide what a press means. */
export function battleButtons() {
    return { ...state };
}

/** Open the window on a fresh attack. */
export function resetForAttack() {
    state = initialBattleButtons();
    return refresh();
}

/** Open the window on a siege that already stands. */
export function resetForSiege() {
    state = siegeBattleButtons();
    return refresh();
}

/**
 * Show or hide the two mid-battle decisions.
 *
 * Both are meaningless before a round has been fought -- there is nothing to dig in against and
 * the odds have not moved -- so they come up once the first round resolves.
 */
export function setMidBattleControlsVisible(visible) {
    return setBattleButtons({ midBattleControls: Boolean(visible) });
}

/** Offer, or withdraw, the last push (overhaul section 4.8). */
export function setLastPushOffered(offered) {
    if (offered) {
        return setBattleButtons({ third: ThirdButton.LAST_PUSH });
    }
    //Only withdraw the OFFER. A window opened over a siege carries "Assault!" in the same slot,
    //and clearing that would strand the player with no way back into the battle.
    return state.third === ThirdButton.LAST_PUSH
        ? setBattleButtons({ third: ThirdButton.NONE })
        : refresh();
}

/** Is the third button currently offering the last push rather than an assault? */
export function lastPushIsOffered() {
    return state.third === ThirdButton.LAST_PUSH;
}

/**
 * Install the bottom bar's listeners. Called ONCE, from bootstrap.
 *
 * @param {object} callbacks `advance`, `retreat`, `siege`, `assault`, `lastPush`, `digIn`,
 *        `reserves` -- each taking no arguments. What a press means stays in `ui.js`; this only
 *        decides WHICH meaning a press has and refuses one the state says is inert.
 */
export function create(callbacks) {
    handlers = callbacks ?? {};
    if (installed) {
        refresh();
        return;
    }
    installed = true;

    const nodes = elementsByKey();

    nodes.advance?.addEventListener("click", () => {
        if (!isBattleButtonEnabled(ids.advanceButton)) {
            return;
        }
        //The MODE decides, never the label. This is the branch that used to compare
        //`advanceButton.innerHTML` against two strings.
        //
        //SKIP is routed separately rather than being a case inside the battle's own handler.
        //It is not a battle decision at all -- the battle it belongs to was fought during the
        //AI phase and is only being replayed -- and letting it fall into the battle state
        //machine is exactly the bug B.8 shipped with: the Skip label was written straight onto
        //this button and the press did whatever the last real battle had left behind.
        if (state.advance === AdvanceMode.SKIP) {
            handlers.skip?.();
            return;
        }
        handlers.advance?.(state.advance);
    });

    nodes.retreat?.addEventListener("click", () => {
        if (!isBattleButtonEnabled(ids.retreatButton)) {
            return;
        }
        handlers.retreat?.(state.retreat);
    });

    nodes.siege?.addEventListener("click", () => {
        if (!isBattleButtonEnabled(ids.siegeButton)) {
            return;
        }
        handlers.siege?.();
    });

    nodes.third?.addEventListener("click", () => {
        if (!isBattleButtonEnabled(ids.siegeBottomBarButton)) {
            return;
        }
        //One element, two unrelated jobs, and which one it is doing is a question about the
        //BATTLE rather than about the button.
        if (state.third === ThirdButton.LAST_PUSH) {
            handlers.lastPush?.();
        } else {
            handlers.assault?.();
        }
    });

    nodes.digIn?.addEventListener("click", () => {
        if (!isBattleButtonEnabled(ids.digInButton)) {
            return;
        }
        setBattleButtons({ digInArmed: !state.digInArmed });
        handlers.digIn?.(state.digInArmed);
    });

    nodes.reserves?.addEventListener("click", () => {
        if (!isBattleButtonEnabled(ids.reservesButton)) {
            return;
        }
        //The handler reports what it managed to send, and the button says so. A button that
        //silently did nothing when the front was empty read as broken.
        const committed = handlers.reserves?.();
        setBattleButtons({
            reserves: committed ? ReservesState.IN_TRANSIT : ReservesState.EMPTY
        });
    });

    refresh();
}

export function destroy() {
    //The listeners are on the buttons, which `BattleUI.destroy()` removes with the window, so
    //there is nothing to detach -- but the flag has to come back or a rebuilt window gets none.
    installed = false;
    handlers = {};
    state = initialBattleButtons();
}

export { AdvanceMode, ReservesState, RetreatMode, ThirdButton, VictoryKind };

export const battleWindow = {
    create,
    destroy,
    refresh,
    setBattleButtons,
    battleButtons,
    resetForAttack,
    resetForSiege,
    setMidBattleControlsVisible,
    setLastPushOffered,
    lastPushIsOffered,
    isBattleButtonEnabled
};
