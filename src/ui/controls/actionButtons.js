// The Upgrade and Buy buttons in the info panel's territory rows.
//
// Phase 7.11. These were six PNGs -- an idle, a pressed and a greyed-out plate
// for each -- swapped on `mousedown` / `mouseup`, which made them the last
// controls in the game that could not take a theme and the only ones whose
// pressed state was a second download rather than a CSS rule.
//
// They are `<button>` elements now: an icon from `src/ui/icons.js`, a label, and
// the glow in `style.css`. Three things follow that are worth knowing.
//
// **The enabled flag is on the element, not in the class list.** The old build
// added `.upgrade-button` only when the button was live, so "does this row have
// an element with that class" was how both the app and the page objects asked
// whether the button worked. That conflated identity with state: the class said
// what the control IS, and it was being used to say what it is DOING. The class
// is now always present and `aria-disabled` carries the state, which is also
// what a screen reader needs.
//
// **`mousedown` no longer does anything but make a noise.** The press was a
// third image; it is `:active` in the stylesheet. What is left of the pair is
// the click sound, which fires on press because that is when a button feels
// like it has been pressed.
//
// **The handler still re-checks.** A row is rebuilt on every repaint but a
// button can outlive the phase it was drawn in by a frame or two, so the guard
// that used to gate the image swap gates the action instead.

import { el } from "../core/dom.js";
import { classNames } from "../core/registry.js";
import { buyIcon, upgradeIcon } from "../icons.js";

const SPEC = {
    upgrade: {
        className: classNames.upgradeButton,
        label: "Upgrade",
        title: "Upgrade Territory",
        art: upgradeIcon,
    },
    buy: {
        className: classNames.buyButton,
        label: "Buy",
        title: "Buy Military",
        art: buyIcon,
    },
};

/**
 * Build one territory-row action button.
 *
 * @param {object} options
 * @param {"upgrade"|"buy"} options.kind
 * @param {() => boolean} options.isEnabled  re-asked on every press
 * @param {() => void} options.onPress       the click sound and nothing else
 * @param {() => void} options.onActivate    open the window
 * @returns {HTMLButtonElement}
 */
export function territoryActionButton({ kind, isEnabled, onPress, onActivate } = {}) {
    const spec = SPEC[kind];
    if (!spec) {
        throw new Error(`territoryActionButton: unknown kind "${kind}"`);
    }

    const live = () => (isEnabled ? Boolean(isEnabled()) : true);

    const button = el(
        "button",
        {
            type: "button",
            class: [classNames.actionButton, spec.className],
            attrs: { title: spec.title, "aria-label": spec.title },
            on: {
                mousedown: () => {
                    if (live() && onPress) onPress();
                },
                click: () => {
                    if (live() && onActivate) onActivate();
                },
            },
        },
        [spec.art(), el("span", { class: classNames.actionButtonLabel, text: spec.label })]
    );

    setActionButtonEnabled(button, live());
    return button;
}

/** Light the button or dim it. The only writer of its enabled state. */
export function setActionButtonEnabled(button, enabled) {
    if (!button) return;
    button.classList.toggle(classNames.isDisabled, !enabled);
    button.setAttribute("aria-disabled", enabled ? "false" : "true");
}

/** Is this action button live? */
export function isActionButtonEnabled(button) {
    return Boolean(button) && button.getAttribute("aria-disabled") !== "true";
}
