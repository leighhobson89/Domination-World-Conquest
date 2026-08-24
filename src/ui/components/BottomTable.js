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

import { ids } from "../core/registry.js";

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

/** True when `table` is this one -- `colourTableText()` treats it specially. */
export function is(table) {
    return table === element();
}

export const bottomTable = { create, update, element, is, COLUMN };
