// The in-game menu button.
//
// Refactor plan Phase 7.2. Escape has opened the main menu mid-game since long
// before the refactor, and nothing on screen has ever said so -- which makes it a
// feature only someone who has read `setUnsetMenuOnEscape` knows about. This is the
// same door with a handle on it.
//
// It is three bars and no text, because it sits over the map at the top of the
// screen where there is no room for a word and no good place to put one. Every
// dimension, colour and radius is a theme token, so it is not a picture: the
// chrome buttons next to it (`UIToggleButton`, `mapModeButton`,
// `strokeHighlightButton`) were PNGs, which is why they were the only things in
// the UI that ignored the theme entirely. Adding a seventh set of PNGs would have
// made that worse; Phase 7.4 went the other way and redrew all of them, which is
// what `.chrome-button` below is -- this button's box, shared by all three.
//
// It is visible exactly when the player is in the game and not in the menu, and
// `ui.js` drives that through `show()` / `hide()` alongside the other chrome
// toggles.

import { ids } from "../core/registry.js";
import { el, mount, on } from "../core/dom.js";

let root = null;
let removers = [];

/**
 * @param {object} options
 * @param {() => void} options.onOpen  called on click; opens the main menu
 */
export function create({ onOpen } = {}) {
    if (root) return root;

    root = el("button", {
        id: ids.menuButton,
        class: "chrome-button hamburger-button",
        attrs: { type: "button", "aria-label": "Menu", title: "Menu (Esc)" },
    }, [
        el("span", { class: "hamburger-bar" }),
        el("span", { class: "hamburger-bar" }),
        el("span", { class: "hamburger-bar" }),
    ]);

    if (onOpen) {
        removers.push(on(root, "click", onOpen));
    }

    root.style.display = "none";
    mount(document.body, root);
    return root;
}

export function show() {
    if (root) root.style.display = "flex";
}

export function hide() {
    if (root) root.style.display = "none";
}

export function isVisible() {
    return Boolean(root) && root.style.display !== "none";
}

export function destroy() {
    for (const remove of removers) remove();
    removers = [];
    root?.remove();
    root = null;
}

export const menuButton = { create, show, hide, isVisible, destroy };
