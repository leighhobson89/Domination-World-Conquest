// The transfer half of the transfer/attack window: pick one destination, then move
// units into it from the territory you clicked.
//
// Phase 6.5. This and `AttackTable.js` were the two halves of
// `drawAndHandleTransferAttackTable()`, a 710-line function whose two modes shared
// their DOM and almost nothing else. They shared it by being written out twice.
//
// What distinguishes transfer from attack, and is worth knowing before changing
// either:
//
//  * **Transfer has a selected row; attack does not.** Every spinner here is inert
//    until a destination is chosen, which is why the buttons are built greyed and why
//    every handler starts by checking it belongs to the selected row.
//  * **The selection handler is on the row's NAME column**, not on the row. That is a
//    real quirk -- it is why the e2e page objects click the first column -- and it is
//    preserved here rather than quietly widened, because widening it changes which
//    clicks select a destination.
//  * **Naval is disabled for a landlocked destination.** Ships cannot be moved inland.
//
// Everything from the model is injected. This module reads no game state and writes
// none; it is handed the source territory and the callbacks that record what the
// player allocated.

import { armyAllocationRow } from "./ArmyAllocationRow.js";
import { multipleValueOf, nextMultipleLabel, showMultiple, ALL } from "./multiples.js";
import { ids, sel } from "../core/registry.js";

const GREYED = "Grey.png";

/** Turn one army-type column's art and text lit or grey. */
function setColumnEnabled(column, enabled) {
    const parts = [
        column.querySelector(sel.multipleIncrementCycler),
        column.querySelector(sel.minusButton),
        column.querySelector(sel.plusButton)
    ];
    parts.forEach(part => {
        if (enabled && part.src.includes(GREYED)) {
            part.src = part.src.replace(GREYED, ".png");
        } else if (!enabled && !part.src.includes(GREYED)) {
            part.src = part.src.replace(".png", GREYED);
        }
    });

    const colour = enabled ? "white" : "grey";
    column.querySelector(sel.quantityTextBox).style.color = colour;
    column.querySelector(sel.multipleTextBox).style.color = colour;
}

/** Reset one column's spinner to nothing allocated, at the "All" step. */
function resetColumn(column) {
    column.querySelector(sel.quantityTextBox).value = "0";
    column.querySelector(sel.multipleTextBox).value = "All";
}

/**
 * @param {Element} table
 * @param {object} deps
 * @param {Element[]} deps.playerOwnedTerritories  sorted, including the source
 * @param {Element} deps.sourcePath                the territory being transferred FROM
 * @param {object} deps.sourceTerritory            its model entry
 * @param {(territory: object, slot: number, allSlots: boolean, mode: number) => any} deps.maxAllocatable
 * @param {Function} deps.updateMultipleTextBox
 * @param {(uniqueId: string, boxes: Element[]) => void} deps.recordAllocation
 * @param {(quantity: number) => void} deps.updateMoveButton
 */
export function renderTransferTable(table, deps) {
    const {
        playerOwnedTerritories,
        sourcePath,
        sourceTerritory,
        maxAllocatable,
        updateMultipleTextBox,
        recordAllocation,
        updateMoveButton
    } = deps;

    // Which destination row is selected, and which of its four unit types are
    // spendable. Both are per-render, which is why they are closed over here rather
    // than living at module scope as they used to.
    let selectedRow = null;
    let selectedTerritoryUniqueId = null;
    const disabled = [true, true, true, true];
    let navalDisabled = false;

    const sourceId = sourcePath.getAttribute("uniqueid");

    playerOwnedTerritories.forEach(destination => {
        if (destination.getAttribute("uniqueid") === sourceId) {
            return; // a territory cannot transfer to itself
        }

        const steps = [ALL, ALL, ALL, ALL];
        const coastal = destination.getAttribute("isCoastal") === "true";
        const label = destination.getAttribute("territory-name") + (coastal ? " (Coastal)" : " (Landlocked)");

        const { row, nameColumn, armyColumns } = armyAllocationRow({
            rowClass: "transfer-table-row-hoverable",
            label,
            enabled: false
        });

        armyColumns.forEach((armyTypeColumn, slot) => {
            const multipleTextBox = armyTypeColumn.querySelector(sel.multipleTextBox);
            const quantityTextBox = armyTypeColumn.querySelector(sel.quantityTextBox);
            const plusButton = armyTypeColumn.querySelector(sel.plusButton);
            const minusButton = armyTypeColumn.querySelector(sel.minusButton);
            const cycler = armyTypeColumn.querySelector(sel.multipleIncrementCycler);

            /** Is this cell live? Only the selected row's enabled unit types are. */
            const inert = () => row !== selectedRow || disabled[slot];

            const commit = () => {
                const boxes = Array.from(selectedRow.querySelectorAll(".army-type-column"))
                    .map(column => column.querySelector(sel.quantityTextBox));
                recordAllocation(selectedTerritoryUniqueId, boxes);
                updateMoveButton(parseInt(quantityTextBox.value));
            };

            cycler.addEventListener("click", () => {
                if (inert()) {
                    return;
                }
                const label = nextMultipleLabel(multipleTextBox.value);
                multipleTextBox.value = label;
                steps[slot] = multipleValueOf(label);
            });

            plusButton.addEventListener("click", () => {
                if (inert()) {
                    return;
                }

                const current = parseInt(quantityTextBox.value);
                const step = steps[slot];
                let next;

                if (step === 1) {
                    next = current + 1;
                } else if (step === ALL) {
                    next = wholeHolding(sourceTerritory, slot);
                } else {
                    const rounded = Math.pow(10, Math.floor(Math.log10(step)));
                    next = current + (rounded > 1 ? rounded : step);
                }

                const ceiling = maxAllocatable(sourceTerritory, slot, false, 0);
                if (next <= ceiling) {
                    quantityTextBox.value = next.toString();
                } else if (step > 1) {
                    //Overshoot: drop a decade rather than clamping, so the next click
                    //lands. Falling straight to x1 when the cell is already full is
                    //what stops the multiplier oscillating.
                    const reduced = parseInt(quantityTextBox.value) === ceiling ? 1 : Math.floor(step / 10);
                    steps[slot] = reduced;
                    updateMultipleTextBox(reduced, armyTypeColumn, sourceTerritory, quantityTextBox, slot);
                }

                if (parseInt(quantityTextBox.value) === ceiling) {
                    plusButton.src = "resources/plusButtonGrey.png";
                }

                commit();
            });

            minusButton.addEventListener("click", () => {
                const current = parseInt(quantityTextBox.value);
                if (inert() || current === 0) {
                    return;
                }

                const step = steps[slot];
                let next = current;
                let reduced = step;

                if (step > 1) {
                    let rounded = Math.pow(10, Math.floor(Math.log10(step)));
                    while (next - rounded < 0) {
                        reduced = Math.floor(rounded / 10);
                        rounded = Math.pow(10, Math.floor(Math.log10(reduced)));
                    }
                }

                if (step === 1) {
                    next -= 1;
                } else {
                    const rounded = Math.pow(10, Math.floor(Math.log10(reduced)));
                    next -= rounded > 1 ? rounded : reduced;
                }

                quantityTextBox.value = next.toString();
                steps[slot] = reduced;
                showMultiple(multipleTextBox, reduced);

                if (parseInt(quantityTextBox.value) < maxAllocatable(sourceTerritory, slot, false, 0)) {
                    plusButton.src = "resources/plusButton.png";
                }

                commit();
            });
        });

        //The row-level listener records which destination was clicked. The visual
        //selection is on the NAME column below -- two listeners for one gesture, and
        //they are not interchangeable: this one fires anywhere in the row.
        row.addEventListener("click", () => {
            selectedTerritoryUniqueId = destination.getAttribute("uniqueid");
        });

        nameColumn.addEventListener("click", () => {
            selectDestination(row, nameColumn, destination);
        });

        table.appendChild(row);
    });

    /** Make one row the destination, and light up what can be sent to it. */
    function selectDestination(row, nameColumn, destination) {
        const title = document.getElementById(ids.territoryTextString);
        title.style.color = "white";
        title.style.fontWeight = "normal";
        title.innerHTML = nameColumn.innerHTML;

        if (selectedRow === row) {
            return;
        }
        selectedRow?.classList.remove("selectedRow");
        selectedRow = row;
        selectedRow.classList.add("selectedRow");

        //Ships cannot be moved inland, so a landlocked destination greys its naval
        //column. This used to be found by matching the selected row's TEXT against
        //every territory name with a regular expression; the destination element is
        //right here.
        navalDisabled = destination.getAttribute("isCoastal") === "false";

        const rowColumns = Array.from(row.querySelectorAll(".army-type-column"));
        const everyColumn = Array.from(table.querySelectorAll(".army-type-column"));

        everyColumn.forEach(column => {
            const inThisRow = rowColumns.includes(column);
            setColumnEnabled(column, inThisRow);
            resetColumn(column);
        });

        //`maxAllocatable(..., true, 0)` answers all four slots at once.
        const ceilings = maxAllocatable(sourceTerritory, 0, true, 0);

        rowColumns.forEach((column, slot) => {
            if (ceilings[slot] === 0) {
                setColumnEnabled(column, false);
                disabled[slot] = true;
            } else if (navalDisabled && slot === 3) {
                setColumnEnabled(column, false);
                disabled[slot] = true;
            } else {
                disabled[slot] = false;
            }
        });
    }
}

/** Everything of one unit type the source territory holds. */
function wholeHolding(territory, slot) {
    switch (slot) {
        case 0: return territory.infantryForCurrentTerritory;
        case 1: return territory.assaultForCurrentTerritory;
        case 2: return territory.airForCurrentTerritory;
        case 3: return territory.navalForCurrentTerritory;
        default: return 0;
    }
}
