// The country-selection screen: the colour picker, and the naming of whichever
// country the player has just clicked.
//
// Refactor Phase 6.3. This is the presentation half of country selection. The
// other half -- which countries are locked, and what the map is painted -- is
// state and map rendering, and stays where it is until Phase 6.7 extracts
// `ui/map/*`. What lives here is: the `<input type="color">`, the text in the
// phase bar's body cell while selecting, and whether the confirm button is
// offered at all.
//
// Two things worth knowing about the code that moved:
//
//   * `adjustTextToFit()` and its two canvas helpers came with it. They exist
//     only to shrink a long country name into the body cell ("Democratic
//     Republic of the Congo" at 35px is four lines) and had no other caller.
//
//   * Whether the confirm button appears is asked of the STORE, never of a
//     fill colour. Gating it on `fill === GREY_OUT_COLOR` is what made the lock
//     bypassable in three clicks (audit 5.2 Z): click a locked country, change
//     the colour picker -- which repaints every locked country -- then click it
//     again, and the fill no longer matched so the button came back. The caller
//     passes `locked`, and it gets that from `pathIsGreyedOut()`.

import { on } from "../core/dom.js";
import { colourPicker } from "./ColourPicker.js";
import { phaseBar } from "./PhaseBar.js";

const MAX_FONT_SIZE = 35;
const MIN_FONT_SIZE = 12;
const MAX_LINES = 3;
const LINE_HEIGHT_RATIO = 1.2;

let picker = null;
let unsubscribe = null;

/**
 * Wire the change event of the element that holds the chosen colour.
 *
 * That element used to be an `<input type="color">` declared in index.html, which
 * the browser answered with its own operating-system dialog -- the one thing in
 * the game a theme could not restyle, and a control that did not repaint the map
 * until it was dismissed. `ColourPicker.js` builds a themed grid of 256 swatches
 * instead, and creates the input itself as an off-screen value holder. Everything
 * below is unchanged: the value is still read from one input and the map still
 * repaints on that input's `change`.
 */
export function create({ onColourChange } = {}) {
    colourPicker.create();
    picker = colourPicker.inputElement();
    if (picker && onColourChange) {
        unsubscribe = on(picker, "change", onColourChange);
    }
    return picker;
}

/** The picker's current value, as the `#rrggbb` string the input holds. */
export function colour() {
    return picker?.value ?? null;
}

/**
 * Seed the picker from the store.
 *
 * Phase 5.8: the markup shipped `#000000` while `playerColour()` was white, so
 * any `change` -- including the one the browser fires when the player opens the
 * dialog and accepts what is already selected -- adopted BLACK, and the next
 * country they clicked was painted the same colour as the map strokes. It read
 * as a hole rather than a selection.
 */
export function setColour(hex) {
    colourPicker.setValue(hex);
}

/** Open the swatch grid. The phase bar's colour label is what asks. */
export function showPicker() {
    colourPicker.open();
}

/** Open it if it is closed, close it if it is open. */
export function togglePicker() {
    colourPicker.toggle();
}

/**
 * Put the grid away.
 *
 * It is a floating panel with no scrim, so nothing dismisses it as a side effect of
 * something else happening -- hiding the control that opened it does not close it.
 * Confirming a country is one of the moments that has to say so.
 */
export function closePicker() {
    colourPicker.close();
}

/** Once the game has started the colour is fixed. */
export function lockPicker() {
    colourPicker.lock();
}

/**
 * Name the country the player has just clicked, and offer or withhold the
 * confirm button.
 *
 * @param {string} countryName
 * @param {{ locked: boolean }} options `locked` comes from the store, never a fill
 */
export function nameCountry(countryName, { locked }) {
    const body = phaseBar.bodyElement();
    const button = phaseBar.buttonElement();
    if (!body || !button) return;

    if (locked) {
        adjustTextToFit(body, countryName + " - too strong to play");
        button.style.display = "none";
        return;
    }
    adjustTextToFit(body, countryName);
    button.classList.add("greenBackground");
    button.style.display = "block";
}

export function destroy() {
    unsubscribe?.();
    unsubscribe = null;
    colourPicker.destroy();
    picker = null;
}

/**
 * Shrink `text` until it fits `element` in at most three lines, then write it.
 *
 * Exported because nothing else should be measuring text, but the selection
 * screen is not the only thing that could need it later.
 */
export function adjustTextToFit(element, text) {
    const maxWidth = element.offsetWidth;
    const maxHeight = element.offsetHeight;
    const words = text.split(" ");
    let fontSize = MAX_FONT_SIZE;

    while (fontSize > MIN_FONT_SIZE) {
        const lines = [];
        let currentLine = "";
        let lineCount = 0;

        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + " " + words[i];
            if (measureWidth(testLine, fontSize) > maxWidth && i > 0) {
                lines.push(currentLine.trim());
                currentLine = words[i];
                lineCount++;
            } else {
                currentLine = testLine;
            }
            if (lineCount === MAX_LINES) break;
        }
        lines.push(currentLine.trim());

        if (measureHeight(lines, fontSize) <= maxHeight && lines.length <= MAX_LINES) {
            break;
        }
        fontSize--;
    }

    element.style.fontSize = fontSize + "px";
    element.textContent = words.join(" ");
}

function measureContext(fontSize) {
    const context = document.createElement("canvas").getContext("2d");
    context.font = fontSize + "px Arial";
    return context;
}

function measureWidth(text, fontSize) {
    return measureContext(fontSize).measureText(text).width;
}

function measureHeight(lines, fontSize) {
    return lines.length * fontSize * LINE_HEIGHT_RATIO;
}

export const countrySelect = {
    create,
    colour,
    setColour,
    showPicker,
    togglePicker,
    closePicker,
    lockPicker,
    nameCountry,
    adjustTextToFit,
    destroy,
};
