// "Saving..." -- a spinner that appears, holds, and fades out.
//
// Refactor plan Phase 7.3. The autosave is on a timer, so it happens while the
// player is doing something else. Without a visible acknowledgement the only two
// possible beliefs about it are "it might have saved" and "it does not work"; with
// one, closing the tab is an informed decision.
//
// The shape of the animation is deliberate and is not a loading spinner in
// disguise. It shows for about two seconds and then fades to transparent over
// half a second -- long enough to be noticed in peripheral vision, short enough
// that it is not still on screen when the player looks back. The write itself
// takes single-digit milliseconds, so the spinner is not tracking work; it is
// telling the player something happened.
//
// The fade is CSS (`opacity` plus a transition), not a JS loop: the element is
// pinned above the map and a per-frame style write there is exactly the kind of
// cosmetic timer that Phase 5.8 spent a day removing from the game's random
// stream. This one draws no randomness at all.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

/** How long the indicator stays fully visible. */
const HOLD_MS = 2000;
/** Must match the `transition` duration on `.save-indicator` in style.css. */
const FADE_MS = 500;

let root = null;
let hideTimer = null;
let removeTimer = null;

export function create() {
    if (root) return root;
    root = el("div", {
        id: ids.saveIndicator,
        class: "save-indicator",
        attrs: { role: "status", "aria-live": "polite" },
    }, [
        el("span", { class: "save-spinner" }),
        el("span", { class: "save-indicator-label", text: "Saving" }),
    ]);
    mount(document.body, root);
    return root;
}

/**
 * Flash the indicator.
 *
 * Re-entrant: a second save while one is still showing restarts the hold rather
 * than stacking a second element or leaving the first one half-faded.
 *
 * @param {string} [label]  "Saving" unless a caller has something better to say
 */
export function flash(label = "Saving") {
    if (!root) create();
    clearTimeout(hideTimer);
    clearTimeout(removeTimer);

    root.querySelector(".save-indicator-label").textContent = label;
    root.classList.add("is-visible");
    root.classList.remove("is-fading");

    hideTimer = setTimeout(() => {
        // Two classes rather than one: `is-fading` runs the opacity transition,
        // and `is-visible` is what takes the element out of the layout once it is
        // over. Dropping both at once would make it disappear instantly.
        root.classList.add("is-fading");
        removeTimer = setTimeout(() => {
            root.classList.remove("is-visible", "is-fading");
        }, FADE_MS);
    }, HOLD_MS);
}

export function isVisible() {
    return Boolean(root?.classList.contains("is-visible"));
}

export function destroy() {
    clearTimeout(hideTimer);
    clearTimeout(removeTimer);
    hideTimer = null;
    removeTimer = null;
    root?.remove();
    root = null;
}

export const saveIndicator = { create, flash, isVisible, destroy };
