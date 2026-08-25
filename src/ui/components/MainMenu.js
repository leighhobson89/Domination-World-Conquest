// The start menu: title, subtitle, Resume Game, New Game, Save / Load, Options,
// Toggle Music, Help.
//
// Refactor Phase 6.3. Small, and the last component with no store state at all
// -- the menu is either up or it is not, and that is a fact about the UI rather
// than about the world. It has no `update(state)` for the same reason `Tooltip`
// has none.
//
// It owns two things that were spread out before:
//
//   * `enableNewGameButton()`, which lived in ui.js and reached across the
//     document to flip `disabled` once the territory model finished building.
//     It is `setNewGameEnabled(true)` here.
//   * The show/hide of the container, which three places did by writing
//     `style.display` on `#menu-container` directly.
//
// The theme overhaul rebuilt the markup. What was there before was five
// `.menu-option` elements at `height: 25%` -- which came to 125% and relied on
// flex to shrink them back -- two of which were `<td>` elements outside any
// table, and whose classes were POSITIONAL (`.option-3`, `.option-4`,
// `.option-5`). Adding Options as a sixth item would have meant either renaming
// every rule or calling the new button `.option-6`. The classes are now
// semantic, the two cells are an `<h1>` and a `<p>`, and every colour, radius
// and font comes from a design token, so a theme restyles the menu without
// touching this file.
//
// Phase 7.2 added Resume Game and Phase 7.3 added Save / Load, and both are
// disabled rather than hidden when they have nothing to do. Hiding them would move
// every button below them, so the menu would be a different shape before and
// during a game and muscle memory would land on the wrong item; a greyed-out row
// also says the feature exists and what would make it available.
//
// Resume means one of two things depending on where it is pressed, and the caller
// decides which -- this component only reports the click:
//
//   * with a game running behind the menu, it closes the menu and hands the map
//     back (that is what Escape has always done, now with a button on it);
//   * on a cold start with an autosave in localStorage, it loads that autosave.
//
// The Help button has no handler. It is inert today and stays inert; wiring it
// is Phase 7.6, which is also where there will be something for it to say. It
// now carries an id so that Phase can find it without a positional selector.
//
// Music is deliberately NOT here. `music.js` finds `#toggle-music-btn` itself
// and owns the audio element and the isPlaying/isNotPlaying classes; the menu
// only has to make sure the button exists and that those two classes have
// somewhere to land.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";
import { optionsPanel } from "./OptionsPanel.js";

let root = null;
let newGameButton = null;
let resumeButton = null;
let saveLoadButton = null;

export function create({ onNewGame, onOptions, onResume, onSaveLoad } = {}) {
    if (root) return root;

    resumeButton = el("button", {
        id: ids.resumeGameBtn,
        class: ["menu-button", "menu-button-primary"],
        text: "Resume Game",
        // Nothing to resume until either a game is running or an autosave is found.
        disabled: true,
        on: { click: onResume },
    });

    newGameButton = el("button", {
        id: ids.newGameBtn,
        class: "menu-button",
        text: "New Game",
        // Nothing can be started until the territory model exists; the bootstrap
        // enables it through `setNewGameEnabled()`.
        disabled: true,
        on: { click: onNewGame },
    });

    saveLoadButton = el("button", {
        id: ids.saveLoadBtn,
        class: "menu-button",
        text: "Save / Load",
        // A load needs the territory model, exactly as New Game does, so this is
        // enabled by the same bootstrap call.
        disabled: true,
        on: { click: onSaveLoad },
    });

    // The panel creates itself on first open, but creating it here means the
    // player's stored theme is on screen before anything is clicked.
    optionsPanel.create();

    root = el("div", { class: "menu-panel" }, [
        el("div", { class: "menu-brand" }, [
            el("h1", { class: "menu-title", text: "Domination" }),
            el("p", { class: "menu-subtitle", text: "World Conquest" }),
        ]),
        el("nav", { class: "menu-actions" }, [
            resumeButton,
            newGameButton,
            saveLoadButton,
            el("button", {
                id: ids.optionsBtn,
                class: "menu-button",
                text: "Options",
                on: { click: onOptions ?? (() => optionsPanel.open()) },
            }),
            el("button", {
                id: ids.toggleMusicBtn,
                class: ["menu-button", "menu-button-music"],
                text: "Toggle Music",
            }),
            el("button", { id: ids.helpBtn, class: "menu-button", text: "Help" }),
        ]),
    ]);

    mount(ids.menuContainer, root);
    return root;
}

/**
 * Enable the two buttons that need the territory model to exist.
 *
 * Save / Load moves with New Game rather than with Resume, because a load has the
 * same prerequisite a new game does -- `restoreState()` patches the seeded
 * territories, so there must be territories to patch.
 */
export function setNewGameEnabled(enabled) {
    if (newGameButton) newGameButton.disabled = !enabled;
    if (saveLoadButton) saveLoadButton.disabled = !enabled;
}

/** Enable or grey out Resume Game. */
export function setResumeEnabled(enabled) {
    if (resumeButton) resumeButton.disabled = !enabled;
}

export function isResumeEnabled() {
    return Boolean(resumeButton) && !resumeButton.disabled;
}

/**
 * What Resume offers right now. "Resume Game" while a game is running behind the
 * menu; "Continue Saved Game" when the only thing to go back to is the autosave
 * found at page load, because those are two different promises and a button that
 * says the wrong one is worse than a button that says nothing.
 */
export function setResumeLabel(label) {
    if (resumeButton) resumeButton.textContent = label;
}

/** The container, not the inner menu -- that is what the CSS blurs. */
function container() {
    return document.getElementById(ids.menuContainer);
}

export function show() {
    const node = container();
    // `flex`, not `block` -- the container centres the panel with flexbox now.
    if (node) node.style.display = "flex";
}

export function hide() {
    const node = container();
    if (node) node.style.display = "none";
}

export function isVisible() {
    return container()?.style.display !== "none";
}

export function destroy() {
    root?.remove();
    root = null;
    newGameButton = null;
    resumeButton = null;
    saveLoadButton = null;
}

export const mainMenu = {
    create,
    setNewGameEnabled,
    setResumeEnabled,
    isResumeEnabled,
    setResumeLabel,
    show,
    hide,
    isVisible,
    destroy,
};
