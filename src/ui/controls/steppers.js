// The plus / minus / step-multiplier controls, as buttons rather than as images.
//
// Phase 7.11. Every quantity in this game -- how many forts to build, how many
// infantry to buy, how many tanks to send -- is set with the same three
// controls, and until now all three were `<img>` elements swapping between a lit
// PNG and a `Grey.png` twin. Two things followed from that, and both are what
// this module exists to end.
//
// **The image WAS the state.** There was no other record of whether a control
// was live, so eleven call sites across four files asked
// `button.src.includes("Grey.png")` and answered a question about game rules by
// reading a file path. A typo in the path did not throw; it silently made a
// disabled button clickable.
//
// **A PNG cannot take a theme.** `src/ui/theme/` recolours the whole UI by
// writing tokens onto the root element, and a picture of a grey plus sign stays
// a picture of a grey plus sign in all six themes -- exactly the reason the map
// chrome was redrawn in Phase 7.4.
//
// So: a real `<button>`, an inline SVG that inherits `currentColor`, and the
// enabled flag on the element where it belongs.
//
// One deliberate choice about how "disabled" is expressed. These are NOT given
// the `disabled` property, which would stop the click event being dispatched at
// all. The greyed PNGs still received clicks -- the handlers simply did nothing
// with them -- and several of those handlers do other work on the way past (the
// buy window raises its row tooltip from the same gesture). `aria-disabled` plus
// the `is-disabled` class keeps the event flowing and keeps the guard explicit,
// and it is what `isStepperEnabled()` reads.

import { el } from "../core/dom.js";
import { classNames } from "../core/registry.js";
import { cycleIcon, minusIcon, plusIcon } from "../icons.js";

const ART = {
    plus: plusIcon,
    minus: minusIcon,
    cycle: cycleIcon,
};

const KIND_CLASS = {
    plus: classNames.stepperPlus,
    minus: classNames.stepperMinus,
    cycle: classNames.stepperCycle,
};

const DEFAULT_LABEL = {
    plus: "Add",
    minus: "Remove",
    cycle: "Change step size",
};

/**
 * Build one stepper button.
 *
 * @param {object} options
 * @param {"plus"|"minus"|"cycle"} options.kind
 * @param {string} [options.id]        an id from `registry.js`, where a caller needs one
 * @param {string|string[]} [options.className] extra classes the old layout rules key off
 * @param {boolean} [options.enabled]  starts live unless told otherwise
 * @param {string} [options.label]     accessible name; defaults per kind
 * @param {(event: MouseEvent) => void} [options.onClick]
 * @returns {HTMLButtonElement}
 */
export function stepperButton({ kind, id, className, enabled = true, label, onClick } = {}) {
    const art = ART[kind];
    if (!art) {
        throw new Error(`stepperButton: unknown kind "${kind}"`);
    }

    const classes = [classNames.stepperButton, KIND_CLASS[kind]];
    if (className) {
        classes.push(...(Array.isArray(className) ? className : [className]));
    }

    const button = el(
        "button",
        {
            id,
            type: "button",
            class: classes,
            attrs: { "aria-label": label ?? DEFAULT_LABEL[kind] },
            on: onClick ? { click: onClick } : undefined,
        },
        art()
    );

    setStepperEnabled(button, enabled);
    return button;
}

/**
 * Turn a stepper live or inert.
 *
 * Tolerates a missing element on purpose: the greying passes it replaces walked
 * rows by `nth-child` and guarded every lookup with `if (button)`, because a
 * table can be mid-rebuild when a price recalculation lands.
 */
export function setStepperEnabled(button, enabled) {
    if (!button) return;
    button.classList.toggle(classNames.isDisabled, !enabled);
    button.setAttribute("aria-disabled", enabled ? "false" : "true");
}

/** Is this stepper live? The replacement for `src.includes("Grey.png")`. */
export function isStepperEnabled(button) {
    return Boolean(button) && !button.classList.contains(classNames.isDisabled);
}

/**
 * Grey or un-grey a whole army-allocation cell: its three buttons and its two
 * read-only text boxes.
 *
 * The text boxes used to be written `style.color = "grey"` inline, which is a
 * literal colour in a themed UI and, worse, one that beat the stylesheet on
 * specificity. The class carries it now.
 */
export function setCellEnabled(cell, enabled) {
    if (!cell) return;
    cell.classList.toggle(classNames.isDisabled, !enabled);
    cell.querySelectorAll("." + classNames.stepperButton).forEach((button) => {
        setStepperEnabled(button, enabled);
    });
}
