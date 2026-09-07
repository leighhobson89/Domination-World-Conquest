// The selected territory's figures, across the bottom of the screen.
//
// Refactor Phase 6.3. Unlike the top table this one was never built in JS --
// it is static markup in index.html -- so there is nothing to move. What there
// IS to move is the writing: thirty-odd statements across four files addressed
// its cells by index, `rows[0].cells[17].innerHTML = ...`, with the index
// repeated at every call site and recorded a second time in the e2e suite's
// `bottomTableCells` map. Get one wrong and the army figure lands in the land
// area column, which is a silent wrong number rather than a crash.
//
// The component owns the mapping. It adopts the existing markup rather than
// replacing it, because the markup is also what the page shows before any
// script has run.
//
// As with `TopTable`, there is no `state/events.js` subscription yet: what the
// bottom table shows is not "the state of a territory" but "the state of the
// SELECTED territory", and the selection still lives in ui.js module scope
// rather than in the store. That is Phase 6.7's `MapView` to fix; when the
// selection is state, this becomes a subscriber and `update()` loses its
// argument.

import { classNames, ids } from "../core/registry.js";
import { on } from "../core/dom.js";

/** Column index of each figure in the single <tr>. Written once, here. */
const COLUMN = Object.freeze({
    flag: 0,
    name: 1,
    mountainDefence: 3,
    gold: 5,
    oil: 7,
    food: 9,
    consMats: 11,
    population: 13,
    area: 15,
    army: 17,
});

function row() {
    return document.getElementById(ids.bottomTable)?.rows[0] ?? null;
}

/** The <table> itself, for `colourTableText()`, which restyles the whole row. */
export function element() {
    return document.getElementById(ids.bottomTable);
}

/**
 * Prepare the row. The flag cell holds a country name that can be wider than
 * the column, and `pre` is what stops it collapsing.
 */
export function create() {
    const cells = row()?.cells;
    if (cells) cells[COLUMN.flag].style.whiteSpace = "pre";
    return element();
}

/**
 * Write the figures. Keys are the names in `COLUMN`; every one is optional,
 * because most callers move a single number -- a battle updates the army and
 * nothing else, a purchase updates gold, population and army.
 */
export function update(values = {}) {
    const cells = row()?.cells;
    if (!cells) return;
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === null) continue;
        const index = COLUMN[key];
        if (index !== undefined) cells[index].innerHTML = value;
    }
}

/**
 * Back to the empty row index.html ships with.
 *
 * Phase 7.2. New Game from inside a running game leaves the row describing a
 * territory of the game that has just been thrown away -- the previous country's
 * flag, its name and its figures, one of them still coloured red by
 * `colourTableText()` from a shortfall that no longer exists. The colours are
 * cleared as well as the text, because they are inline styles: writing "-" over a
 * red cell leaves a red dash.
 */
export function reset() {
    const cells = row()?.cells;
    if (!cells) return;
    for (const cell of cells) {
        cell.style.color = "";
    }
    cells[COLUMN.flag].innerHTML = "";
    cells[COLUMN.name].innerHTML = "Select a Country";
    for (const key of ["mountainDefence", "gold", "oil", "food", "consMats", "population",
        "area", "army"]) {
        cells[COLUMN[key]].innerHTML = "-";
    }
}

/** True when `table` is this one -- `colourTableText()` treats it specially. */
export function is(table) {
    return table === element();
}

// --- the flag as a control -------------------------------------------------
//
// The bar describes the selected territory, and the thing a player most often
// wants after reading it is the Upgrade Territory window for that same
// territory -- which until now was only reachable by opening the info panel and
// finding the territory's row again. Clicking the FLAG opens it.
//
// The flag cell rather than the whole bar: the bar is thirty pixels of figures a
// player is reading, and a strip that wide swallowing a click is a strip that
// opens a window every time somebody clicks near the bottom of the screen. The
// flag is a single small target that already stands for "this territory".
//
// The listener is installed ONCE, from bootstrap, and never from `create()`.
// `create()` runs on every selection, so installing there would add a listener
// per click, and `removeEventListener` could not take the previous one off
// because each call builds a new function object -- which is exactly the defect
// the move button carried for months (see the move-button note in CLAUDE.md).
//
// The <td> itself is stable for the life of the page: it is static markup in
// index.html and `update()` writes its `innerHTML`, replacing the cell's
// children and never the cell.

let removeActivation = null;

/** The flag cell, which is both the click target and what carries the cursor. */
function flagCell() {
    return row()?.cells?.[COLUMN.flag] ?? null;
}

/**
 * Make the flag open something when it is clicked.
 *
 * The handler does its own guarding -- the bar is written for enemy territories
 * too, and outside the Buy/Upgrade phase -- so this deliberately knows nothing
 * about phases or ownership.
 *
 * @param {() => void} onActivate
 * @returns {() => void} a remover, for symmetry with `dom.on()`
 */
export function installActivation(onActivate) {
    const cell = flagCell();
    if (!cell || removeActivation) {
        return removeActivation ?? (() => {});
    }
    cell.title = "Upgrade this territory";
    removeActivation = on(cell, "click", onActivate);
    return () => {
        removeActivation?.();
        removeActivation = null;
    };
}

/**
 * Whether the flag currently leads anywhere, which is what decides the cursor.
 *
 * A control that looks clickable and is not is worse than one that never looked
 * it, so this is refreshed on every selection and whenever the phase moves.
 */
export function setActionable(actionable) {
    flagCell()?.classList.toggle(classNames.isActionable, Boolean(actionable));
}

export const bottomTable = {
    create, update, reset, element, is, installActivation, setActionable, COLUMN
};
