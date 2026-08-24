// The bar at the bottom-left: a title, a subtitle and one button.
//
// Refactor Phase 6.3. This one element does two jobs. Before the game starts it
// is the country-select confirm -- "Select a Country..." over the clicked
// country's name, with a CONFIRM button. Once the game is running it is the
// phase-advance button, and its two labels are a pure function of the phase.
//
// They were not treated as one, which is the point of the component. Five
// places wrote the title and the label by hand, each next to its own
// `setPhase()` call:
//
//     popupTitle.innerText = "Military Phase";
//     popupConfirm.innerText = "END TURN";
//     setPhase(Phase.MOVE_ATTACK);
//
// -- three statements for one fact, and nothing stopped a sixth place setting
// the phase without the labels, or the labels without the phase. The labels are
// now derived: the component subscribes to `PHASE_CHANGED` and `setPhase()` is
// the only thing that has to be called. The e2e suite already had the mapping
// written down (`phaseTitle` / `phaseButtonLabel` in tests/support), which is
// the usual sign that it belonged in the app.
//
// The one thing that is NOT derived is the click handler. `TurnEngine` installs
// exactly one listener on this button (Phase 5.7) and that stays where it is --
// the component would otherwise have to know what a turn is.

import { ids } from "../core/registry.js";
import { el } from "../core/dom.js";
import { Events, on as onStateEvent } from "../../state/events.js";
import { Phase } from "../../state/phases.js";
import { currentPhase } from "../../state/selectors.js";

/**
 * What the bar reads in each phase. The e2e suite asserts these exact strings,
 * so this table and `tests/support/selectors.js` are the same fact -- if they
 * ever disagree, this one is right.
 */
const PHASE_TEXT = Object.freeze({
    [Phase.BUY_UPGRADE]: { title: "Buy / Upgrade Phase", button: "MILITARY" },
    [Phase.MOVE_ATTACK]: { title: "Military Phase", button: "END TURN" },
    [Phase.AI]: { title: "AI turn", button: "AI MOVING..." },
});

/**
 * The bar's own mode, which the phase does not describe.
 *
 * SELECTING and INITIALISING both happen before the first `setPhase()`, and
 * INITIALISING in particular must not be overwritten by a phase event -- the
 * button says "INITIAL SETUP" while `initialiseGame()` runs, and the first
 * phase is set at the end of that.
 */
export const Mode = Object.freeze({
    SELECTING: "selecting",
    INITIALISING: "initialising",
    PLAYING: "playing",
});

let root = null;
let titleCell = null;
let bodyCell = null;
let button = null;
let colourLabel = null;
let mode = Mode.SELECTING;
let unsubscribe = null;

export function create({ onColourLabelClick } = {}) {
    if (root) return root;

    titleCell = el("td", {
        id: ids.popupTitle,
        class: ["popup-option", "popup-option-title"],
        text: "Select a Country...",
    });

    colourLabel = el("label", {
        id: ids.popupColor,
        class: ["popup-option", "popup-option-color"],
        text: "Select Player Color",
        attrs: { for: ids.playerColorPicker },
        on: { click: onColourLabelClick },
    });

    bodyCell = el("td", {
        id: ids.popupBody,
        class: ["popup-option", "popup-option-subtitle"],
        text: "- - - -",
    });

    button = el("button", {
        id: ids.popupConfirm,
        class: ["popup-option", "popup-option-confirm"],
        text: "CONFIRM",
    });

    root = el("div", { class: "popup-with-confirm-container" }, [
        titleCell,
        colourLabel,
        bodyCell,
        button,
    ]);

    // A phase change is the only thing that repaints the bar once play starts.
    unsubscribe = onStateEvent(Events.PHASE_CHANGED, () => update());
    return root;
}

/**
 * Repaint from the current phase. Called by the `PHASE_CHANGED` subscription,
 * and directly by `setMode()` when play begins.
 */
export function update() {
    if (mode !== Mode.PLAYING) return;
    const text = PHASE_TEXT[currentPhase()];
    if (!text) return;
    titleCell.innerText = text.title;
    button.innerText = text.button;
}

/**
 * Move between the bar's three modes. `PLAYING` repaints immediately, so the
 * caller does not have to set the labels for the phase it has just entered.
 */
export function setMode(next) {
    mode = next;
    if (next === Mode.INITIALISING) {
        titleCell.innerText = "LOADING...";
        bodyCell.innerText = "";
        button.innerText = "INITIAL SETUP";
        return;
    }
    if (next === Mode.PLAYING) {
        bodyCell.innerText = "";
        update();
    }
}

export function currentMode() {
    return mode;
}

/** The country name shown while selecting. `adjustTextToFit()` writes it too. */
export function bodyElement() {
    return bodyCell;
}

export function bodyText() {
    return bodyCell?.innerHTML ?? "";
}

export function buttonElement() {
    return button;
}

export function colourLabelElement() {
    return colourLabel;
}

export function setButtonEnabled(enabled) {
    if (button) button.disabled = !enabled;
}

/** The subtitle is dimmed once the player has committed to a country. */
export function dimBody() {
    if (bodyCell) bodyCell.style.opacity = "0.5";
}

export function destroy() {
    unsubscribe?.();
    unsubscribe = null;
    root?.remove();
    root = null;
    titleCell = bodyCell = button = colourLabel = null;
    mode = Mode.SELECTING;
}

export const phaseBar = {
    Mode,
    create,
    update,
    setMode,
    currentMode,
    bodyElement,
    bodyText,
    buttonElement,
    colourLabelElement,
    setButtonEnabled,
    dimBody,
    destroy,
};
