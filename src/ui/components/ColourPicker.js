// The player's colour: a themed grid of 256 swatches.
//
// What this replaces is the browser's own `<input type="color">` dialog. That is a
// perfectly good control and it was the wrong one here for three reasons. It is
// the only piece of the game that ignores the theme completely -- it is drawn by
// the operating system, so a player in Parchment or Terminal got a Windows dialog
// in the middle of a map. It offers 16.7 million colours to answer a question with
// perhaps a dozen sensible answers, and half of those answers are wrong: the map
// strokes are near-black, so picking black paints a hole rather than a country
// (audit-adjacent, and the reason `setColour()` exists). And on Windows it does
// not repaint the map until the dialog is dismissed, because the input fires
// `change` on close -- so choosing a colour by looking at the map, which is the
// only way to choose one sensibly, was not possible.
//
// The grid fixes all three: it is built from tokens, it offers a browsable
// spectrum rather than a continuum, and clicking a swatch repaints the map on the
// spot.
//
// **The `<input type="color">` is still here.** It is off screen and it is the
// VALUE: `countrySelect.colour()` reads it, the phase bar's label points at it,
// the e2e suite sets it, and clicking a swatch writes it and dispatches `change`.
// Keeping one element as the value meant the picker could be replaced without
// touching a single reader.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

/** 16 columns by 16 rows. See `buildPalette()`. */
const COLUMNS = 16;
const ROWS = 16;

let root = null;
let panel = null;
let grid = null;
let preview = null;
let input = null;
let swatches = [];
let onPick = null;

/**
 * `hsl` to `#rrggbb`.
 *
 * Written out rather than left to the browser because the swatch values are
 * needed as hex: the `<input type="color">` that holds the answer accepts nothing
 * else, and the map painter compares hex strings.
 */
function hslToHex(h, s, l) {
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const hue = (((h % 360) + 360) % 360) / 60;
    const second = chroma * (1 - Math.abs((hue % 2) - 1));
    const match = l - chroma / 2;

    let rgb;
    if (hue < 1) rgb = [chroma, second, 0];
    else if (hue < 2) rgb = [second, chroma, 0];
    else if (hue < 3) rgb = [0, chroma, second];
    else if (hue < 4) rgb = [0, second, chroma];
    else if (hue < 5) rgb = [second, 0, chroma];
    else rgb = [chroma, 0, second];

    return (
        "#" +
        rgb
            .map((channel) => {
                const level = Math.round((channel + match) * 255);
                return Math.min(255, Math.max(0, level)).toString(16).padStart(2, "0");
            })
            .join("")
    );
}

/**
 * The 256 colours, in the order they are laid out.
 *
 * A 16x16 grid: the first row is a greyscale ramp, and the fifteen below it are
 * the hue wheel in sixteen steps, walked from near-white down to near-black. That
 * is a spectrum a player can scan rather than a continuum they have to hunt in,
 * which is the whole difference between this and the dialog it replaces.
 *
 * Exported because it is pure and worth asserting on: 256 entries, all distinct,
 * all valid hex.
 */
export function buildPalette() {
    const colours = [];

    // Row 0: greys, white on the left through to black on the right.
    for (let column = 0; column < COLUMNS; column++) {
        const level = 1 - column / (COLUMNS - 1);
        colours.push(hslToHex(0, 0, level));
    }

    // Rows 1..15: hue across, lightness down.
    for (let row = 1; row < ROWS; row++) {
        const lightness = 0.92 - (row - 1) * 0.058;
        // Saturation eases off at the very light and very dark ends, where a fully
        // saturated colour is indistinguishable from its neighbour anyway.
        const saturation = 0.9 - Math.abs(row - 8) * 0.022;
        for (let column = 0; column < COLUMNS; column++) {
            colours.push(hslToHex((column * 360) / COLUMNS, saturation, lightness));
        }
    }

    return colours;
}

const PALETTE = buildPalette();

/** The `#rrggbb` in force. */
export function value() {
    return input?.value ?? null;
}

/** Mark whichever swatch matches the current value, and none of the others. */
function paintSelection() {
    const current = (value() ?? "").toLowerCase();
    for (const swatch of swatches) {
        swatch.classList.toggle("is-selected", swatch.dataset.colour === current);
    }
    if (preview) preview.style.background = current || "transparent";
}

/**
 * Adopt a colour.
 *
 * The `change` event is dispatched by hand because setting `input.value` from
 * script does not fire one, and `change` is what every existing listener is bound
 * to -- `CountrySelect.create()` wires the map repaint to it. The panel stays OPEN
 * afterwards, on purpose: the player is choosing by looking at the map, so closing
 * on the first click would defeat the point of repainting live.
 */
function pick(hex) {
    if (!input) return;
    input.value = hex;
    paintSelection();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    onPick?.(hex);
}

/**
 * @param {object} options
 * @param {(hex: string) => void} [options.onPick] fired after the input's `change`
 */
export function create({ onPick: pickHandler } = {}) {
    if (root) return root;
    onPick = pickHandler ?? null;

    // The value holder. Off screen rather than `display: none` -- a hidden input
    // still holds and reports a value, and this way the label in the phase bar
    // still has something real to point `for` at.
    input = el("input", {
        id: ids.playerColorPicker,
        type: "color",
        value: "#ffffff",
        class: "colour-picker-value",
        attrs: { name: ids.playerColorPicker, "aria-label": "Player colour" },
    });

    grid = el(
        "div",
        {
            id: ids.colourPickerGrid,
            class: "colour-picker-grid",
            attrs: { role: "listbox", "aria-label": "Player colours" },
        },
        PALETTE.map((hex) => {
            const swatch = el("button", {
                class: "colour-swatch",
                attrs: { type: "button", role: "option", title: hex, "aria-label": hex },
                dataset: { colour: hex },
                style: { background: hex },
                on: { click: () => pick(hex) },
            });
            swatches.push(swatch);
            return swatch;
        })
    );

    preview = el("span", { id: ids.colourPickerPreview, class: "colour-picker-preview" });

    panel = el("div", { id: ids.colourPickerPanel, class: "colour-picker-panel" }, [
        el("div", { class: "colour-picker-header" }, [
            el("span", { class: "colour-picker-title", text: "Player Colour" }),
            preview,
            el("button", {
                id: ids.colourPickerCloseBtn,
                class: "colour-picker-close",
                text: "×",
                attrs: { type: "button", "aria-label": "Close" },
                on: { click: () => close() },
            }),
        ]),
        grid,
        el("p", {
            class: "colour-picker-hint",
            text: "The map repaints as you choose.",
        }),
    ]);

    root = el("div", { id: ids.colourPickerContainer, class: "colour-picker-container" }, [
        input,
        panel,
    ]);
    root.style.display = "none";
    mount(document.body, root);

    paintSelection();
    return root;
}

/** Escape closes the panel. Installed only while it is open, like the modals. */
function onKeyDown(event) {
    if (event.key === "Escape") {
        event.stopPropagation();
        close();
    }
}

export function open() {
    if (!root) create();
    paintSelection();
    anchorAbovePhaseBar();
    root.style.display = "block";
    document.addEventListener("keydown", onKeyDown, true);
}

/**
 * Sit the grid directly above the phase bar, whatever height that is today.
 *
 * The offset used to be a constant in `style.css` -- `calc(8% + 40% + 10px)`, the
 * bar's `bottom` plus its `height` -- and it was correct for exactly as long as
 * the bar had a fixed height. Phase 7.4 made the bar fold, so its height is its
 * content and changes while the player is looking at it. Measuring is the only
 * honest answer; the stylesheet keeps the old constant as the fallback for the
 * case where the bar is not on screen at all.
 */
function anchorAbovePhaseBar() {
    const bar = document.querySelector(".popup-with-confirm-container");
    if (!bar || !root) {
        return;
    }
    const rect = bar.getBoundingClientRect();
    if (rect.height === 0) {
        return;
    }
    root.style.setProperty("--phase-bar-top", window.innerHeight - rect.top + 10 + "px");
}

export function close() {
    if (!root) return;
    root.style.display = "none";
    document.removeEventListener("keydown", onKeyDown, true);
}

export function toggle() {
    if (isOpen()) close();
    else open();
}

export function isOpen() {
    return Boolean(root) && root.style.display !== "none";
}

/** The value holder, for the readers that had a reference to the old input. */
export function inputElement() {
    return input;
}

/**
 * Seed the value from the store.
 *
 * Phase 5.8: the markup shipped `#000000` while `playerColour()` was white, so any
 * `change` -- including the one the browser fired when the player opened the
 * dialog and accepted what was already selected -- adopted BLACK, and the next
 * country they clicked was painted the same colour as the map strokes. It read as
 * a hole rather than a selection. The grid cannot reproduce that (nothing is
 * "already selected" until a swatch is clicked) but the seed is still what makes
 * the preview and the highlighted swatch right on first open.
 */
export function setValue(hex) {
    if (!input || typeof hex !== "string") return;
    input.value = hex;
    paintSelection();
}

/** Once the game has started the colour is fixed. */
export function lock() {
    if (input) input.disabled = true;
    for (const swatch of swatches) swatch.disabled = true;
    close();
}

export function destroy() {
    document.removeEventListener("keydown", onKeyDown, true);
    root?.remove();
    root = null;
    panel = null;
    grid = null;
    preview = null;
    input = null;
    swatches = [];
    onPick = null;
}

export const colourPicker = {
    create,
    open,
    close,
    toggle,
    isOpen,
    value,
    setValue,
    lock,
    inputElement,
    buildPalette,
    destroy,
};
