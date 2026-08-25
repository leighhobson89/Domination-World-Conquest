// The attack half of the transfer/attack window: every territory in range of the
// target contributes at once.
//
// Phase 6.5. See the note at the top of `TransferTable.js` for what separates the two
// modes. The differences that matter here:
//
//  * **No row selection.** Every listed territory can commit units simultaneously, so
//    the spinners start lit and each cell's live/inert state is per CELL, tracked in
//    `disabledFlags` as a flat `row * 4 + slot` index. That flat index is why the
//    array is passed in rather than rebuilt: `disableAttackScreenOptions()` fills it
//    after the rows exist.
//  * **"All" means the USEABLE count, not the owned count.** A territory holding ten
//    grounded aircraft can commit none of them, and the ceiling has to say so --
//    otherwise the player allocates an army that the battle cannot field.
//  * **Every change recomputes the odds.** The probability bar follows the allocation
//    live, which is why each handler ends in the same four-line tail.

import { armyAllocationRow } from "./ArmyAllocationRow.js";
import { multipleValueOf, nextMultipleLabel, showMultiple, ALL } from "./multiples.js";
import { sel } from "../core/registry.js";
import { setStepperEnabled } from "../controls/steppers.js";

const UNIT_SLOTS = 4;

/**
 * @param {Element} table
 * @param {object} deps
 * @param {Element[]} deps.attackerPaths      territories able to reach the target
 * @param {string[]} deps.attackerUniqueIds   the same, as ids, in the same order
 * @param {boolean[]} deps.disabledFlags      flat `row * 4 + slot`
 * @param {object} deps.sourceTerritory       the clicked territory's model entry
 * @param {(uniqueId: string) => object|undefined} deps.territoryById
 * @param {(territory: object, slot: number, allSlots: boolean, mode: number) => any} deps.maxAllocatable
 * @param {Function} deps.updateMultipleTextBox
 * @param {(boxes: Element[]) => void} deps.recordAllocation
 * @param {() => void} deps.afterAllocation   updates the move button and the odds
 */
export function renderAttackTable(table, deps) {
    const {
        attackerPaths,
        attackerUniqueIds,
        disabledFlags,
        sourceTerritory,
        territoryById,
        maxAllocatable,
        updateMultipleTextBox,
        recordAllocation,
        afterAllocation
    } = deps;

    attackerPaths.forEach((attacker, rowIndex) => {
        const steps = [ALL, ALL, ALL, ALL];

        const { row, armyColumns } = armyAllocationRow({
            rowClass: "transfer-table-row",
            label: attacker.getAttribute("territory-name"),
            enabled: true,
            textClass: "attackWhiteDefault"
        });

        armyColumns.forEach((armyTypeColumn, slot) => {
            const multipleTextBox = armyTypeColumn.querySelector(sel.multipleTextBox);
            const quantityTextBox = armyTypeColumn.querySelector(sel.quantityTextBox);
            const plusButton = armyTypeColumn.querySelector(sel.plusButton);
            const minusButton = armyTypeColumn.querySelector(sel.minusButton);
            const cycler = armyTypeColumn.querySelector(sel.multipleIncrementCycler);

            const inert = () => disabledFlags[rowIndex * UNIT_SLOTS + slot];

            /** The most this cell may hold, from the per-row ceiling table. */
            const ceiling = () => maxAllocatable(sourceTerritory, slot, false, 1)[rowIndex][slot + 1];

            const commit = () => {
                const boxes = Array.from(table.querySelectorAll(".transfer-table-outer-column:last-child"))
                    .flatMap(half => Array.from(half.querySelectorAll(".army-type-column")))
                    .map(column => column.querySelector(sel.quantityTextBox));
                recordAllocation(boxes);
                afterAllocation();
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
                    next = wholeUseableHolding(territoryById(attackerUniqueIds[rowIndex]), slot);
                } else {
                    const rounded = Math.pow(10, Math.floor(Math.log10(step)));
                    next = current + (rounded > 1 ? rounded : step);
                }

                const limit = ceiling();
                if (next <= limit) {
                    quantityTextBox.value = next.toString();
                } else if (step > 1) {
                    const reduced = parseInt(quantityTextBox.value) === limit ? 1 : Math.floor(step / 10);
                    steps[slot] = reduced;
                    updateMultipleTextBox(reduced, armyTypeColumn, sourceTerritory, quantityTextBox, slot);
                }

                if (parseInt(quantityTextBox.value) === limit) {
                    setStepperEnabled(plusButton, false);
                }

                commit();
            });

            minusButton.addEventListener("click", () => {
                const current = parseInt(quantityTextBox.value);
                if (current === 0 || inert()) {
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
                    //Preserved verbatim: 100000 has no label, so stepping down from it
                    //left the multiplier box showing something stale. The attack side
                    //special-cased it and the transfer side did not.
                    if (step === 100000) {
                        reduced = 10000;
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

                if (parseInt(quantityTextBox.value) < ceiling()) {
                    setStepperEnabled(plusButton, true);
                }

                commit();
            });
        });

        table.appendChild(row);
    });
}

/**
 * Everything of one unit type a territory can actually field.
 *
 * Infantry need no oil, so all of them count. The three vehicle types are capped at
 * the useable figure -- what oil demand has left in service.
 */
function wholeUseableHolding(territory, slot) {
    if (!territory) {
        return 0;
    }
    switch (slot) {
        case 0: return territory.infantryForCurrentTerritory;
        case 1: return territory.useableAssault;
        case 2: return territory.useableAir;
        case 3: return territory.useableNaval;
        default: return 0;
    }
}
