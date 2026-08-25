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
import { chevronIcon } from "../icons.js";
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
let collapsible = null;
let collapseButton = null;
let collapsed = false;
let mode = Mode.SELECTING;
let unsubscribe = null;
let playSound = null;

export function create({ onColourLabelClick, onSound } = {}) {
    if (root) return root;
    playSound = onSound ?? null;

    titleCell = el("td", {
        id: ids.popupTitle,
        class: ["popup-option", "popup-option-title"],
        text: "Select a Country...",
    });

    //A <label> with no `for`, deliberately. It used to point at the
    //`<input type="color">`, which is what made clicking it open the operating
    //system's colour dialog -- and that dialog now opens ON TOP of the themed
    //swatch grid this same click is meant to show. The input still exists and
    //still holds the value, but it is off screen and nothing must activate it:
    //`ColourPicker.js` writes it and dispatches its `change`.
    //
    //Phase 7.5: its text is the theme's and stays the theme's. Two places in ui.js
    //used to write `style.color = playerColour()` on it after every pick, which
    //made the words themselves the colour preview -- and unreadable whenever the
    //player picked something near the panel's own background. The swatch grid
    //marks the chosen swatch and previews it in its header, so the preview was
    //already there twice. Do not repaint this element from game state.
    colourLabel = el("label", {
        id: ids.popupColor,
        class: ["popup-option", "popup-option-color"],
        text: "Select Player Color",
        attrs: { role: "button", tabindex: "0" },
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

    //Phase 7.4. The bar collapses, and three things about how are deliberate.
    //
    //**It collapses DOWNWARDS.** The container is anchored by its BOTTOM edge and
    //its height comes from its content, so removing rows shortens it upwards and
    //the advance button -- the one control the player reaches for every turn --
    //does not move by a pixel. Anchoring the top and animating the height would
    //have slid that button up the screen mid-turn, which is the one thing a
    //phase-advance button must never do.
    //
    //**Only the two rows that are ABOUT the country collapse.** The flag and the
    //colour picker belong to choosing a country and to looking at one; the phase
    //title and the button are the turn loop and always stay. They are wrapped
    //together rather than hidden individually because a slide needs one box with
    //one height to animate.
    //
    //**The header stays.** It holds the control that expands the bar again, so
    //hiding it with the rest would collapse the bar permanently.
    collapseButton = el(
        "button",
        {
            id: ids.phaseBarCollapseButton,
            class: "phase-bar-collapse",
            attrs: {
                type: "button",
                "aria-expanded": "true",
                "aria-controls": ids.phaseBarCollapsible,
                title: "Collapse the phase panel",
            },
            on: { click: () => setCollapsed(!collapsed) },
        },
        chevronIcon()
    );

    const header = el("div", { id: ids.phaseBarHeader, class: "phase-bar-header" }, [
        collapseButton,
    ]);

    collapsible = el(
        "div",
        { id: ids.phaseBarCollapsible, class: "phase-bar-collapsible" },
        [colourLabel, bodyCell]
    );

    root = el("div", { class: "popup-with-confirm-container" }, [
        header,
        titleCell,
        collapsible,
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
    if (next === Mode.SELECTING) {
        //Phase 7.2. SELECTING used to be a starting value that nothing ever went back
        //to, so it needed no strings of its own -- the markup was already right the
        //first time. New Game from inside a running game DOES go back to it, and
        //without this the bar keeps the phase it was on: "Military Phase" over an END
        //TURN button, on the country-selection screen.
        //
        //Everything below is an inline style or a class that something else wrote
        //while the last game was running, and each has its own visible failure if it
        //is left behind: the previous country's flag stays behind the subtitle
        //(`setFlag` paints it there whenever the selection screen is up), the subtitle
        //keeps the font size `adjustTextToFit` chose for that country's name, the
        //confirm button stays green and offered before anything has been clicked, and
        //the colour label stays visible, which on a cold start it is not. The label's
        //colour is NOT cleared here -- nothing writes it any more, so there is nothing
        //left behind to undo.
        titleCell.innerText = "Select a Country...";
        bodyCell.innerText = "- - - -";
        bodyCell.style.opacity = "";
        bodyCell.style.fontSize = "";
        bodyCell.style.backgroundImage = "";
        button.innerText = "CONFIRM";
        button.disabled = false;
        button.classList.remove("greenBackground");
        button.style.display = "";
        //`.popup-option-confirm` ships at `opacity: 0` and selectCountry() writes 1
        //over it. Clearing the class alone leaves a grey CONFIRM button offered on a
        //screen where nothing has been selected.
        button.style.opacity = "";
        colourLabel.style.display = "";
        //A bar the previous game left folded up would hide the country name and the
        //colour picker on the selection screen -- the two things that screen is FOR.
        //Silent, because nothing was clicked.
        setCollapsed(false, { silent: true });
        return;
    }
    if (next === Mode.INITIALISING) {
        titleCell.innerText = "LOADING...";
        bodyCell.innerText = "";
        button.innerText = "INITIAL SETUP";
        return;
    }
    if (next === Mode.PLAYING) {
        bodyCell.innerText = "";
        //Phase 7.3. The button is invisible until something makes it visible:
        //`.popup-option-confirm` ships at `opacity: 0`, and in a game that was played
        //from the menu it was `selectCountry()` that wrote 1 over it and
        //`nameCountry()` that made it green. A LOADED game never passes through the
        //selection screen, so without this the phase bar has a title and no button --
        //and the phase cannot be advanced at all.
        button.style.opacity = "1";
        button.style.display = "block";
        button.classList.add("greenBackground");
        update();
    }
}

/**
 * The flag behind the subtitle.
 *
 * `setFlag()` in ui.js paints this as a side effect, but only while the selection
 * screen is up -- so a game that arrives from a save, which never sees that screen,
 * gets a blank bar where every other game has the player's flag. This is the same
 * write, addressed rather than incidental.
 *
 * @param {string} src  an image URL, or null to clear it
 */
export function setBrandFlag(src) {
    if (!bodyCell) return;
    bodyCell.style.backgroundImage = src ? `url(${src})` : "";
    bodyCell.style.backgroundSize = "100% 100%";
    bodyCell.style.backgroundPosition = "center";
}

export function currentMode() {
    return mode;
}

/**
 * Fold the flag and the colour picker away, or bring them back.
 *
 * The animation is CSS -- `max-height` on `.phase-bar-collapsible` -- and the one
 * number that has to be right is that max-height in the stylesheet: it is a
 * ceiling, not a measurement, so it must be comfortably larger than the two rows
 * ever are. Too small and the rows are clipped while expanded; enormous and the
 * open half of the transition spends most of its time animating empty space.
 *
 * @param {boolean} next
 * @param {{silent?: boolean}} [options]  `silent` skips the click, for a reset
 */
export function setCollapsed(next, { silent = false } = {}) {
    const wanted = Boolean(next);
    if (!root || collapsed === wanted) {
        return collapsed;
    }
    collapsed = wanted;
    root.classList.toggle("is-collapsed", collapsed);
    collapseButton?.setAttribute("aria-expanded", collapsed ? "false" : "true");
    collapseButton?.setAttribute(
        "title",
        collapsed ? "Expand the phase panel" : "Collapse the phase panel"
    );
    if (!silent) {
        playSound?.();
    }
    return collapsed;
}

export function isCollapsed() {
    return collapsed;
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

/**
 * Show or hide the bar itself.
 *
 * Phase 7.2. `resetGameState()` in ui.js used to reach for the element this
 * component builds and write `style.display` on it directly -- it could, because
 * `create()` hands the element back and the bootstrap kept the reference in scope.
 * Moving that function out of the `DOMContentLoaded` closure so New Game could call
 * it took the reference away, and the right answer to that is not a
 * `querySelector` on a class name: a component owns its own element's visibility.
 *
 * `flex`, not `block` -- the bar is a column of four children.
 */
export function setVisible(visible) {
    if (root) root.style.display = visible ? "flex" : "none";
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
    collapsible = collapseButton = null;
    collapsed = false;
    mode = Mode.SELECTING;
}

export const phaseBar = {
    Mode,
    create,
    update,
    setMode,
    setCollapsed,
    isCollapsed,
    currentMode,
    bodyElement,
    bodyText,
    buttonElement,
    setBrandFlag,
    setVisible,
    setButtonEnabled,
    dimBody,
    destroy,
};
