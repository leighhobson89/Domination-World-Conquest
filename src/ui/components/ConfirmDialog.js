// One yes/no modal, shared.
//
// Refactor plan Phase 7.2. New Game is the reason it exists: until now it was the
// only button in the game that destroyed something -- a game in progress, or an
// autosave that had not been exported -- and it did so on a single click with no
// way back. Loading a save over a live game is the same shape of decision, so both
// ask through this.
//
// It follows OptionsPanel's pattern rather than MainMenu's: the component creates
// its own scrim, so it can be destroyed completely and there is nothing in
// index.html to keep in step. It has no `update(state)` because it holds no world
// state -- what it says is passed in at `open()`.
//
// `open()` returns a Promise<boolean> rather than taking two callbacks, because
// every caller is of the form "ask, and if they say yes, do the thing", and that
// reads as one `if (await confirm(...))` instead of an inverted pair of closures.
// Escape and a click on the scrim both resolve `false`: a dialog that can only be
// dismissed by choosing is a dialog that traps a player who opened it by accident.

import { ids } from "../core/registry.js";
import { el, mount, on } from "../core/dom.js";

let root = null;
let titleNode = null;
let messageNode = null;
let confirmButton = null;
let cancelButton = null;
let removers = [];
/** Resolver of the promise `open()` handed out, or null when closed. */
let settle = null;

function finish(answer) {
    if (!settle) {
        return;
    }
    const resolve = settle;
    settle = null;
    if (root) {
        root.style.display = "none";
    }
    document.removeEventListener("keydown", onKeyDown, true);
    resolve(answer);
}

/**
 * Escape cancels, Enter confirms. Captured, so the map's own Escape handler --
 * which opens and closes the main menu -- never sees a keypress meant for a modal
 * sitting on top of it.
 */
function onKeyDown(event) {
    if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        finish(false);
    } else if (event.key === "Enter") {
        event.stopPropagation();
        event.preventDefault();
        finish(true);
    }
}

export function create() {
    if (root) return root;

    titleNode = el("h2", { id: ids.confirmDialogTitle, class: "confirm-title" });
    messageNode = el("p", { id: ids.confirmDialogMessage, class: "confirm-message" });

    cancelButton = el("button", {
        id: ids.confirmDialogCancel,
        class: ["options-button", "options-button-ghost"],
        on: { click: () => finish(false) },
    });
    confirmButton = el("button", {
        id: ids.confirmDialogConfirm,
        class: ["options-button", "options-button-danger"],
        on: { click: () => finish(true) },
    });

    const panel = el("div", { id: ids.confirmDialog, class: "confirm-panel" }, [
        titleNode,
        messageNode,
        el("div", { class: "options-actions" }, [cancelButton, confirmButton]),
    ]);

    root = el("div", { id: ids.confirmDialogContainer, class: "options-scrim confirm-scrim" },
        panel);
    removers.push(
        on(root, "click", (event) => {
            if (event.target === root) finish(false);
        }),
    );

    root.style.display = "none";
    mount(document.body, root);
    return root;
}

/**
 * Ask the player something.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmLabel]  defaults to "Yes"
 * @param {string} [options.cancelLabel]   defaults to "Cancel"
 * @returns {Promise<boolean>}
 */
export function open({ title, message, confirmLabel = "Yes", cancelLabel = "Cancel" } = {}) {
    if (!root) create();
    // A second ask while one is open resolves the first as a cancel rather than
    // stranding its promise forever.
    finish(false);

    titleNode.textContent = title ?? "Are you sure?";
    messageNode.textContent = message ?? "";
    confirmButton.textContent = confirmLabel;
    cancelButton.textContent = cancelLabel;

    root.style.display = "flex";
    document.addEventListener("keydown", onKeyDown, true);
    // Focus lands on Cancel, not on the destructive button: an Enter left over from
    // whatever the player was doing a moment ago must not confirm the dialog.
    cancelButton.focus();

    return new Promise((resolve) => {
        settle = resolve;
    });
}

export function isOpen() {
    return Boolean(root) && root.style.display !== "none";
}

export function destroy() {
    finish(false);
    for (const remove of removers) remove();
    removers = [];
    root?.remove();
    root = null;
    titleNode = null;
    messageNode = null;
    confirmButton = null;
    cancelButton = null;
}

export const confirmDialog = { create, open, isOpen, destroy };
