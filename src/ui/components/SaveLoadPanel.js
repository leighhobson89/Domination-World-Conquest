// Save and load, as two text boxes.
//
// Refactor plan Phase 7.3. The whole game compresses to a code of a few thousand
// characters, so a save slot can be a string the player owns rather than a file the
// browser owns: select it, copy it, keep it wherever they keep things, paste it
// back. That is the entire storage model for a single-player game of this size, and
// it needs no file pickers, no permissions and no server.
//
// It lives in the main menu next to New Game, and it is built from the same tokens
// as the Options panel -- it is deliberately the same object as that panel with a
// different body, down to sharing `.options-scrim`, `.options-button` and
// `.options-actions`, because two modals that open from the same menu and behave
// the same way should not look like two different products.
//
// Three decisions worth recording:
//
//   * **The save code is generated on open, not on a click.** The player came here
//     to copy it; making them press Generate first is a step that exists only
//     because it was easier to write.
//   * **Loading asks for confirmation** through `ConfirmDialog`, for the same
//     reason New Game does: it overwrites a game in progress.
//   * **The status line is one element and says one thing at a time.** Errors from
//     `storage.js` are written straight into it, which is why those messages are
//     phrased for a player ("That save code is damaged") rather than for a log.
//
// Everything to do with what a save CONTAINS is in `src/platform/storage.js`. This
// file knows only that a save is a string.

import { ids } from "../core/registry.js";
import { el, mount, on } from "../core/dom.js";
import { confirmDialog } from "./ConfirmDialog.js";

let root = null;
let saveField = null;
let loadField = null;
let statusNode = null;
let removers = [];
/** Supplied by bootstrap: the two things this panel cannot do for itself. */
let handlers = { captureSave: null, applySave: null, isGameInProgress: () => false };

function setStatus(message, tone = "info") {
    if (!statusNode) return;
    statusNode.textContent = message ?? "";
    statusNode.dataset.tone = tone;
}

function fillSaveField() {
    if (!saveField) return;
    let code = null;
    try {
        code = handlers.captureSave ? handlers.captureSave() : null;
    } catch (error) {
        console.error("SaveLoadPanel: capturing the save threw", error);
        code = null;
    }
    if (code) {
        saveField.value = code;
        saveField.disabled = false;
        setStatus("Save code ready. Copy it and keep it somewhere safe.");
    } else {
        saveField.value = "";
        saveField.disabled = true;
        setStatus("There is no game to save yet. Start one first.", "warn");
    }
}

async function copyCode() {
    if (!saveField?.value) return;
    saveField.focus();
    saveField.select();
    try {
        // `navigator.clipboard` is unavailable over plain http and on an unfocused
        // document, and it rejects rather than returning false. The selection above
        // is the fallback: the text is already highlighted, so Ctrl+C works.
        await navigator.clipboard.writeText(saveField.value);
        setStatus("Save code copied to the clipboard.", "good");
    } catch {
        setStatus("Could not reach the clipboard -- the code is selected, press Ctrl+C.",
            "warn");
    }
}

async function loadCode() {
    const code = loadField?.value ?? "";
    if (code.trim() === "") {
        setStatus("Paste a save code into the box first.", "warn");
        return;
    }

    if (handlers.isGameInProgress()) {
        const proceed = await confirmDialog.open({
            title: "Load this game?",
            message:
                "Loading replaces the game you are playing now. Any progress since your " +
                "last save will be lost.",
            confirmLabel: "Load",
        });
        if (!proceed) {
            setStatus("Load cancelled.");
            return;
        }
    }

    setStatus("Loading...");
    try {
        await handlers.applySave(code);
        // On success the panel is closed by whoever loaded, because the menu behind
        // it is going away too.
    } catch (error) {
        setStatus(error?.message ?? "That save code could not be loaded.", "bad");
    }
}

/**
 * @param {object} options
 * @param {() => string|null} options.captureSave     the current game as a code
 * @param {(code: string) => Promise<void>} options.applySave  load one; throws with
 *        a message meant to be shown to the player
 * @param {() => boolean} [options.isGameInProgress]
 */
export function create(options = {}) {
    handlers = { ...handlers, ...options };
    if (root) return root;

    saveField = el("textarea", {
        id: ids.saveCodeField,
        class: "save-code-field",
        readOnly: true,
        spellcheck: false,
        attrs: { rows: "4", "aria-label": "Save code" },
    });

    loadField = el("textarea", {
        id: ids.loadCodeField,
        class: "save-code-field",
        spellcheck: false,
        attrs: { rows: "4", placeholder: "Paste a save code here", "aria-label": "Load code" },
    });

    statusNode = el("p", { id: ids.saveLoadStatus, class: "save-load-status" });

    const panel = el("div", { id: ids.saveLoadPanel, class: "options-panel save-load-panel" }, [
        el("h2", { class: "options-title", text: "Save / Load" }),

        el("section", { class: "save-load-section" }, [
            el("h3", { class: "save-load-heading", text: "Save" }),
            el("p", {
                class: "options-description save-load-hint",
                text: "This code is your whole game. Copy it and keep it somewhere safe.",
            }),
            saveField,
            el("div", { class: "save-load-row" }, [
                el("button", {
                    id: ids.saveCodeGenerateBtn,
                    class: ["options-button", "options-button-ghost"],
                    text: "Refresh",
                    on: { click: fillSaveField },
                }),
                el("button", {
                    id: ids.saveCodeCopyBtn,
                    class: ["options-button", "options-button-primary"],
                    text: "Copy",
                    on: { click: copyCode },
                }),
            ]),
        ]),

        el("section", { class: "save-load-section" }, [
            el("h3", { class: "save-load-heading", text: "Load" }),
            loadField,
            el("div", { class: "save-load-row" }, [
                el("button", {
                    id: ids.loadCodeBtn,
                    class: ["options-button", "options-button-primary"],
                    text: "Load Game",
                    on: { click: loadCode },
                }),
            ]),
        ]),

        statusNode,

        el("div", { class: "options-actions" }, [
            el("button", {
                id: ids.saveLoadCloseBtn,
                class: ["options-button", "options-button-ghost"],
                text: "Close",
                on: { click: close },
            }),
        ]),
    ]);

    root = el("div", { id: ids.saveLoadContainer, class: "options-scrim" }, panel);
    removers.push(
        on(root, "click", (event) => {
            if (event.target === root) close();
        }),
    );

    root.style.display = "none";
    mount(document.body, root);
    return root;
}

function onKeyDown(event) {
    if (event.key === "Escape") {
        event.stopPropagation();
        close();
    }
}

export function open() {
    if (!root) create();
    loadField.value = "";
    fillSaveField();
    root.style.display = "flex";
    document.addEventListener("keydown", onKeyDown, true);
}

export function close() {
    if (!root) return;
    root.style.display = "none";
    document.removeEventListener("keydown", onKeyDown, true);
}

export function isOpen() {
    return Boolean(root) && root.style.display !== "none";
}

export function destroy() {
    document.removeEventListener("keydown", onKeyDown, true);
    for (const remove of removers) remove();
    removers = [];
    root?.remove();
    root = null;
    saveField = null;
    loadField = null;
    statusNode = null;
}

export const saveLoadPanel = { create, open, close, isOpen, destroy, setStatus };
