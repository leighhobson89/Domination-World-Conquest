// The single button under the map that reads TRANSFER / ATTACK / INVADE! /
// VIEW SIEGE / CANCEL, and the "attacking <territory>" strip above it.
//
// Refactor Phase 6.3 extracts the ELEMENTS. Phase 6.6 replaces the logic that
// decides what they say -- `handleMovePhaseTransferAttackButton()`, 310 lines
// of nested conditionals with a `setTimeout(..., 200)` debounce inside a click
// handler -- with `deriveMoveButtonState(state, selection)`. That is why this
// file has a `setVariant()` rather than a `variant` it computes: the deciding
// still lives in ui.js, and moving it and rewriting it in one step would make
// the rewrite unbisectable.
//
// What IS fixed here is the class handling. The button's state is carried by
// its background class, and six call sites each removed four classes by name
// before adding the fifth:
//
//     button.classList.remove("move-phase-button-green-background");
//     button.classList.remove("move-phase-button-brown-background");
//     button.classList.remove("move-phase-button-blue-background");
//     button.classList.remove("move-phase-button-grey-background");
//     button.classList.add("move-phase-button-red-background");
//
// Miss one of the removes and the button carries two backgrounds, which is a
// CSS coin-toss rather than an error. `setVariant()` takes the whole set off
// and puts one on.

import { ids, moveButtonClass } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

const ALL_VARIANTS = Object.values(moveButtonClass);

let button = null;
let destinationStrip = null;
let destinationText = null;
let leftFlag = null;
let rightFlag = null;

export function create() {
    if (button) return button;

    leftFlag = el("img", {
        id: ids.leftBattleImage,
        class: ["left-attack-image", "sizingIcons"],
    });
    destinationText = el("div", {
        id: ids.attackDestinationText,
        class: "attack-destination-text",
    });
    rightFlag = el("img", {
        id: ids.rightBattleImage,
        class: ["right-attack-image", "sizingIcons"],
    });

    destinationStrip = el(
        "div",
        { id: ids.attackDestinationContainer, class: "attack-destination-container" },
        [leftFlag, destinationText, rightFlag]
    );

    button = el("button", {
        id: ids.movePhaseButton,
        class: "move-phase-button",
        html: "TRANSFER",
    });

    mount(ids.attackDestinationContainers, destinationStrip);
    mount(
        ids.movePhaseButtonsContainer,
        el("div", { class: "move-phase-buttons-container" }, button)
    );
    return button;
}

export function element() {
    return button ?? document.getElementById(ids.movePhaseButton);
}

export function label() {
    return element()?.innerHTML ?? "";
}

export function setLabel(text) {
    const node = element();
    if (node) node.innerHTML = text;
}

export function setEnabled(enabled) {
    const node = element();
    if (node) node.disabled = !enabled;
}

/**
 * Swap the background class.
 *
 * @param {keyof typeof moveButtonClass} variant one of transfer, attack,
 *        viewSiege, disabled, open
 */
export function setVariant(variant) {
    const node = element();
    const className = moveButtonClass[variant];
    if (!node || !className) return;
    node.classList.remove(...ALL_VARIANTS);
    node.classList.add(className);
}

/** Which variant the button is currently showing, or null if none is set. */
export function variant() {
    const node = element();
    if (!node) return null;
    for (const [name, className] of Object.entries(moveButtonClass)) {
        if (node.classList.contains(className)) return name;
    }
    return null;
}

export function show() {
    const node = element();
    if (node) node.style.display = "flex";
}

export function hide() {
    const node = element();
    if (node) node.style.display = "none";
}

/** The "attacking <territory>" strip, with a flag either side of the name. */
export function showDestination(territoryName, flagSrc) {
    const strip = destinationStrip ?? document.getElementById(ids.attackDestinationContainer);
    if (!strip) return;
    if (destinationText) destinationText.innerHTML = territoryName;
    if (leftFlag) leftFlag.src = flagSrc;
    if (rightFlag) rightFlag.src = flagSrc;
    strip.style.display = "flex";
}

export function destinationElement() {
    return destinationStrip ?? document.getElementById(ids.attackDestinationContainer);
}

export function hideDestination() {
    const strip = destinationElement();
    if (strip) strip.style.display = "none";
}

export function destroy() {
    button?.parentElement?.remove();
    destinationStrip?.remove();
    button = destinationStrip = destinationText = leftFlag = rightFlag = null;
}

export const moveButton = {
    create,
    element,
    label,
    setLabel,
    setEnabled,
    setVariant,
    variant,
    show,
    hide,
    showDestination,
    hideDestination,
    destinationElement,
    destroy,
};
