// One row of the transfer/attack window: a territory name, and four army-type
// spinners beside it.
//
// Phase 6.5. `drawAndHandleTransferAttackTable()` built this twice -- once for
// transfer and once for attack -- as a `for (j)` over two outer columns wrapping a
// `for (k)` over four unit types wrapping a `for (m)` over five inner elements, with
// a five-case `switch` inside that. Eighty lines each time, and the only differences
// between the two copies were the row's class, whether the buttons start greyed, and
// two extra CSS classes on the attack side's text boxes.
//
// The structure is here once. What differs is arguments.
//
// The five inner elements, in order, are: the multiplier cycler, the multiplier text
// box, minus, the quantity text box, plus. Their container ids are positional and are
// what `style.css` lays the row out from, so they are named rather than indexed.

import { ids } from "../core/registry.js";

/** Infantry, assault, air, naval -- in the order every array in the game uses. */
export const UNIT_SLOTS = 4;

/** The five inner containers of one army-type column, in order. */
const INNER_COLUMN_IDS = [
    "multipleIncrementCyclerContainer",
    "multipleTextFieldContainer",
    "quantityMinusContainer",
    "quantityTextFieldContainer",
    "quantityPlusContainer"
];

function image(id, className, src) {
    const element = document.createElement("img");
    element.id = id;
    element.classList.add(className);
    element.src = src;
    //Phase 6.8. `element.style.height = "20px"` and the matching width stood here.
    //`.multipleIncrementerButton`, `.transferMinusButton` and `.transferPlusButton`
    //in style.css each already set 20px by 20px, so the inline pair only ever
    //restated the stylesheet -- at a higher specificity, which is what would have
    //made the stylesheet look broken the first time someone tried to change it.
    return element;
}

function textBox(id, className, value, extraClass) {
    const element = document.createElement("input");
    element.id = id;
    element.classList.add(className);
    if (extraClass) {
        element.classList.add(extraClass);
    }
    element.value = value;
    return element;
}

/**
 * One army-type column: five inner containers holding the spinner.
 *
 * @param {{enabled: boolean, textClass?: string}} options
 *        `enabled` picks the lit or greyed art. Transfer rows start greyed, because
 *        nothing is transferable until a destination row is selected; attack rows
 *        start lit, because every listed territory can contribute at once.
 */
export function armyTypeColumn({ enabled, textClass } = {}) {
    const column = document.createElement("div");
    column.classList.add("army-type-column");

    const suffix = enabled ? ".png" : "Grey.png";

    const contents = [
        image(ids.multipleIncrementCycler, "multipleIncrementerButton", "resources/multipleIncrementerButton" + suffix),
        textBox(ids.multipleTextBox, "multipleTextField", "All", textClass),
        image(ids.minusButton, "transferMinusButton", "resources/minusButton" + suffix),
        textBox(ids.quantityTextBox, "quantityTextField", "0", textClass),
        image(ids.plusButton, "transferPlusButton", "resources/plusButton" + suffix)
    ];

    INNER_COLUMN_IDS.forEach((containerId, index) => {
        const inner = document.createElement("div");
        inner.id = containerId;
        inner.appendChild(contents[index]);
        column.appendChild(inner);
    });

    return column;
}

/**
 * A whole row: the name column on the left, four army-type columns on the right.
 *
 * @param {{rowClass: string, label: string, enabled: boolean, textClass?: string}} options
 * @returns {{row: Element, nameColumn: Element, armyColumns: Element[]}}
 */
export function armyAllocationRow({ rowClass, label, enabled, textClass } = {}) {
    const row = document.createElement("div");
    row.classList.add(rowClass);

    const nameColumn = document.createElement("div");
    nameColumn.classList.add("transfer-table-outer-column");
    //Phase 6.8 deliberately LEFT this one inline. style.css already carries
    //`.transfer-table-row-hoverable > .transfer-table-outer-column:first-of-type
    //{ width: 20% }`, which this inline write has always overridden -- so moving the
    //50% into a class of its own would lose to that selector on specificity and the
    //name column would jump from half the row to a fifth of it. Reconciling the two
    //is a visual decision, not a move.
    nameColumn.style.width = "50%";
    nameColumn.textContent = label;

    const spinnerColumn = document.createElement("div");
    spinnerColumn.classList.add("transfer-table-outer-column");

    const armyColumns = [];
    for (let slot = 0; slot < UNIT_SLOTS; slot += 1) {
        const column = armyTypeColumn({ enabled, textClass });
        armyColumns.push(column);
        spinnerColumn.appendChild(column);
    }

    row.appendChild(nameColumn);
    row.appendChild(spinnerColumn);

    return { row, nameColumn, spinnerColumn, armyColumns };
}
