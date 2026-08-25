// Applying and remembering the player's theme.
//
// The mechanism is deliberately small: a theme is a map of CSS custom
// properties, and applying one writes that map onto the root element as inline
// custom properties. The stylesheet never learns the theme's name -- it only
// ever reads `var(--surface-panel)` and friends -- so adding a theme is one
// entry in `themes.js` and no CSS at all.
//
// Two consequences worth knowing:
//
//   * Selecting the DEFAULT theme REMOVES the inline properties rather than
//     writing a copy of them. The `:root` block in `style.css` is the single
//     definition of the default look; writing it back from JS would give it a
//     second definition that could drift.
//   * `data-theme` is also set on the root element. Nothing reads it for
//     colour -- that is what the tokens are for -- but it is the hook for the
//     handful of rules a token cannot express (a different background image,
//     say) and it is what an e2e spec asserts against.
//
// Everything that touches the DOM or storage is guarded, so this module imports
// cleanly in Node for the unit tests, and a browser with site data blocked gets
// the default theme instead of an exception.

import { TOKENS } from "./tokens.js";
import { DEFAULT_THEME_ID, THEMES, themeById } from "./themes.js";

const STORAGE_KEY = "domination.theme";

/** Fired on `window` after a theme is applied. `detail` is `{ id, theme }`. */
export const THEME_CHANGED = "domination:themechange";

let activeId = DEFAULT_THEME_ID;

/**
 * The id this input resolves to. Pure, and the reason the fallback is testable:
 * an unknown id, `null`, a number, a value left behind by an older build with
 * different theme names -- all of them land on the default rather than on a
 * half-applied palette.
 *
 * @param {*} id
 * @returns {string}
 */
export function resolveThemeId(id) {
    return typeof id === "string" && themeById(id) ? id : DEFAULT_THEME_ID;
}

function readStoredId() {
    // Throws outright in some embedded contexts, not just when empty.
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeStoredId(id) {
    try {
        window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
        // A player who cannot persist the choice still gets to make it for
        // this session; there is nothing useful to tell them about it.
    }
}

/**
 * Apply a theme. Unknown ids fall back to the default rather than doing nothing,
 * so a bad value in storage cannot leave the UI unstyled.
 *
 * @param {string} id
 * @param {{ persist?: boolean }} [options] `persist: false` for a preview
 * @returns {string} the id actually applied
 */
export function applyTheme(id, { persist = true } = {}) {
    const resolved = resolveThemeId(id);
    activeId = resolved;

    if (typeof document !== "undefined" && document.documentElement) {
        const root = document.documentElement;
        const theme = themeById(resolved);
        const tokens = theme.tokens;

        for (const token of TOKENS) {
            const value = tokens[token];
            // The default theme supplies nothing, which clears the inline
            // property and hands the question back to the stylesheet.
            if (value === undefined) root.style.removeProperty(token);
            else root.style.setProperty(token, value);
        }

        root.setAttribute("data-theme", resolved);

        if (typeof window !== "undefined" && typeof window.CustomEvent === "function") {
            window.dispatchEvent(
                new window.CustomEvent(THEME_CHANGED, { detail: { id: resolved, theme } }),
            );
        }
    }

    if (persist) writeStoredId(resolved);
    return resolved;
}

/** The id of the theme in force. */
export function currentThemeId() {
    return activeId;
}

/** The theme record in force. */
export function currentTheme() {
    return themeById(activeId);
}

/** Every theme, for the dropdown to render. */
export function availableThemes() {
    return THEMES;
}

/**
 * Read the remembered choice and apply it. Call once from bootstrap, before the
 * menu is built -- the tokens have defaults in the stylesheet, so there is no
 * unstyled flash either way, but applying first avoids a visible repaint.
 *
 * @returns {string} the id applied
 */
export function initTheme() {
    return applyTheme(readStoredId());
}
