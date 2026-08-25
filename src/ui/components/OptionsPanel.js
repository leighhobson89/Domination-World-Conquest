// The Options panel: a modal over the main menu, holding the theme picker.
//
// It is the first component that creates its OWN container rather than mounting
// into a <div> declared in index.html. That is deliberate and is the pattern the
// rest should move to -- a component that owns its element can be destroyed
// completely, which is what Phase 7.2's New Game needs.
//
// Theme selection previews live. Changing the dropdown applies the theme
// immediately without persisting, so the player judges it against the real UI
// rather than two swatches; Close commits the visible choice, Cancel restores
// whatever was in force when the panel opened. Anything else means choosing a
// theme by reading its name.
//
// There is no `update(state)`. The panel holds settings, which are facts about
// this browser rather than about the world, so it has nothing in the store to
// follow -- the same reason `Tooltip` and `MainMenu` have none.

import { ids } from "../core/registry.js";
import { el, mount, on } from "../core/dom.js";
import { applyTheme, availableThemes, currentThemeId } from "../theme/theme.js";
import { themeById } from "../theme/themes.js";

let root = null;
let select = null;
let description = null;
let preview = null;
let removers = [];
/** The theme in force when the panel was opened, for Cancel to restore. */
let themeOnOpen = null;

/** Two swatch chips plus the theme's one-line description. */
function renderPreview(id) {
    const theme = themeById(id);
    if (!theme) return;
    if (description) description.textContent = theme.description;
    if (!preview) return;
    preview.replaceChildren(
        ...theme.swatch.map((colour) =>
            el("span", { class: "theme-swatch", style: { background: colour } }),
        ),
    );
}

function onSelectChanged(event) {
    // persist: false -- the choice is not committed until Close.
    applyTheme(event.target.value, { persist: false });
    renderPreview(event.target.value);
}

export function create() {
    if (root) return root;

    select = el(
        "select",
        { id: ids.themeSelect, class: "options-select" },
        availableThemes().map((theme) =>
            el("option", { value: theme.id, text: theme.name }),
        ),
    );

    preview = el("div", { id: ids.themePreview, class: "theme-preview" });
    description = el("p", { id: ids.themeDescription, class: "options-description" });

    const panel = el("div", { id: ids.optionsPanel, class: "options-panel" }, [
        el("h2", { class: "options-title", text: "Options" }),

        el("div", { class: "options-row" }, [
            el("label", {
                class: "options-label",
                text: "Theme",
                attrs: { for: ids.themeSelect },
            }),
            el("div", { class: "options-control" }, [select, preview]),
        ]),
        description,

        el("div", { class: "options-actions" }, [
            el("button", {
                class: ["options-button", "options-button-ghost"],
                text: "Cancel",
                on: { click: cancel },
            }),
            el("button", {
                id: ids.optionsCloseBtn,
                class: ["options-button", "options-button-primary"],
                text: "Done",
                on: { click: () => close(true) },
            }),
        ]),
    ]);

    root = el("div", { id: ids.optionsContainer, class: "options-scrim" }, panel);
    // Clicking the scrim -- but not the panel -- cancels, which is what every
    // modal does and what the Escape key below does too.
    removers.push(
        on(root, "click", (event) => {
            if (event.target === root) cancel();
        }),
    );
    removers.push(on(select, "change", onSelectChanged));

    root.style.display = "none";
    mount(document.body, root);
    return root;
}

/** Escape closes the panel without committing. Installed only while it is open. */
function onKeyDown(event) {
    if (event.key === "Escape") {
        event.stopPropagation();
        cancel();
    }
}

export function open() {
    if (!root) create();
    themeOnOpen = currentThemeId();
    select.value = themeOnOpen;
    renderPreview(themeOnOpen);
    root.style.display = "flex";
    // Captured, so the panel gets Escape before the map's own handler does.
    document.addEventListener("keydown", onKeyDown, true);
}

/** @param {boolean} commit `true` to persist the previewed theme. */
export function close(commit) {
    if (!root) return;
    if (commit) applyTheme(select.value);
    root.style.display = "none";
    document.removeEventListener("keydown", onKeyDown, true);
}

/** Close, putting back the theme that was in force when the panel opened. */
export function cancel() {
    if (themeOnOpen !== null) applyTheme(themeOnOpen);
    close(false);
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
    select = null;
    preview = null;
    description = null;
    themeOnOpen = null;
}

export const optionsPanel = { create, open, close, cancel, isOpen, destroy };
