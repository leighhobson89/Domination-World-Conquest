// The start menu: title, subtitle, New Game, Toggle Music, Help.
//
// Refactor Phase 6.3. Small, and the last component with no store state at all
// -- the menu is either up or it is not, and that is a fact about the UI rather
// than about the world. It has no `update(state)` for the same reason `Tooltip`
// has none.
//
// It does own two things that were spread out before:
//
//   * `enableNewGameButton()`, which lived in ui.js and reached across the
//     document to flip `disabled` once the territory model finished building.
//     It is `setNewGameEnabled(true)` here.
//   * The show/hide of the container, which three places did by writing
//     `style.display` on `#menu-container` directly.
//
// The Help button has no handler. It is inert today and stays inert; wiring it
// is Phase 7.6, which is also where there will be something for it to say.
//
// Music is deliberately NOT here. `music.js` finds `#toggle-music-btn` itself
// and owns the audio element and the isPlaying/isNotPlaying classes; the menu
// only has to make sure the button exists.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

let root = null;
let newGameButton = null;

export function create({ onNewGame } = {}) {
    if (root) return root;

    newGameButton = el("button", {
        id: ids.newGameBtn,
        class: ["menu-option", "option-3"],
        text: "New Game",
        // Nothing can be started until the territory model exists; the bootstrap
        // enables it through `setNewGameEnabled()`.
        disabled: true,
        on: { click: onNewGame },
    });

    root = el("div", { class: "menu-container" }, [
        el("td", { class: ["menu-option", "title"], text: "Domination:" }),
        el("td", { class: ["menu-option", "subTitle"], text: "World Conquest" }),
        newGameButton,
        el("button", {
            id: ids.toggleMusicBtn,
            class: ["menu-option", "option-4"],
            text: "Toggle Music",
        }),
        el("button", { class: ["menu-option", "option-5"], text: "Help" }),
    ]);

    mount(ids.menuContainer, root);
    return root;
}

export function setNewGameEnabled(enabled) {
    if (newGameButton) newGameButton.disabled = !enabled;
}

/** The container, not the inner menu -- that is what the CSS blurs. */
function container() {
    return document.getElementById(ids.menuContainer);
}

export function show() {
    const node = container();
    if (node) node.style.display = "block";
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
}

export const mainMenu = { create, setNewGameEnabled, show, hide, isVisible, destroy };
