import {
    vehicleArmyPersonnelWorth,
    formatNumbersToKMB,
    colourTableText,
    setPlayerUseableNotUseableWeaponsDueToOilDemand,
    turnGainsArrayPlayer,
    oilRequirements
} from './resourceCalculations.js';
import {
    calculateProbabilityPreBattle
} from './battle.js';
// NOTE: this module and ui.js sit in an import cycle. getLastClickedPath used to
// be pulled in via `setTimeout(..., 1000)` before a dynamic import(), which is a
// race: on a slow load the binding was still undefined when first used. A plain
// static import is correct because getLastClickedPath is a hoisted function
// declaration, so it is initialised before any module body runs.
// See docs/03-refactor-plan.md Phase 1.7.
import {
    getLastClickedPath,
    setAttackProbabilityOnUI,
    transferAttackButtonState
} from './ui.js';
import {
    attackTargetPath
} from './src/ui/map/markers.js';
import {
    allTerritories
} from './src/state/selectors.js';
import {
    pathIsDeactivated
} from './src/state/pathState.js';
import {
    getTerritory
} from './src/state/selectors.js';
import {
    sel
} from './src/ui/core/registry.js';
import {
    bottomTable
} from './src/ui/components/BottomTable.js';
import {
    moveButton
} from './src/ui/components/MoveButton.js';
import {
    renderTransferTable
} from './src/ui/transferAttack/TransferTable.js';
import {
    renderAttackTable
} from './src/ui/transferAttack/AttackTable.js';
import { setCellEnabled } from './src/ui/controls/steppers.js';

//`selectedTerritoryUniqueId` moved into TransferTable.js in Phase 6.5 -- it is the
//window's selection, so it lives for exactly as long as one render of the window.
export const territoryUniqueIds = []; //attack only
export let probability;
let preAttackArray = [];
const disabledFlagsAttack = [];

//`const tooltip = document.getElementById(ids.tooltip)` stood here and was never read.
//It resolved at MODULE LOAD, before Tooltip.create() exists, so it was always null --
//a live example of why the tooltip is reached through its component handle now.

export let transferQuantitiesArray = [];

// Declare multipleValuesArray outside the drawTransferAttackTable function
/**
 * Fill the transfer/attack window's table with one of its two modes.
 *
 * Phase 6.5. This was 710 lines: two modes, one function, and eighty lines of
 * identical DOM construction written out twice. The row is built once now
 * (`src/ui/transferAttack/ArmyAllocationRow.js`), the multiplier cycle is one table
 * rather than six `if` chains (`multiples.js`), and each mode is its own module.
 *
 * What is left here is the wiring, for the same reason as `drawUITable()` in
 * `resourceCalculations.js`: this module holds the per-window scratch state -- the
 * allocation arrays, the pre-battle probability, the flat disabled-cell flags -- and
 * the two table modules are handed callbacks that write it. They import nothing from
 * the model, so they added no edge to a module graph that already has a cycle in it.
 */
export function drawAndHandleTransferAttackTable(table, mainArray, playerOwnedTerritories, territoriesAbleToAttackTarget, transferOrAttack) {
    table.innerHTML = "";

    const clickedUniqueId = getLastClickedPath().getAttribute("uniqueid");
    const sourceTerritory = mainArray.find(territory => territory.uniqueId === clickedUniqueId);

    playerOwnedTerritories.sort((a, b) => {
        const idA = parseInt(a.getAttribute("territory-id"));
        const idB = parseInt(b.getAttribute("territory-id"));
        return idA - idB;
    });

    if (transferOrAttack === 0) {
        renderTransferTable(table, {
            playerOwnedTerritories,
            sourcePath: getLastClickedPath(),
            sourceTerritory,
            maxAllocatable: getCurrentMainArrayValue,
            updateMultipleTextBox,
            recordAllocation: updateTransferArray,
            updateMoveButton: checkAndSetButtonAsConfirmOrCancel
        });
        return;
    }

    if (transferOrAttack === 1) {
        //A territory locked out after a conquest cannot join an attack. Filtering
        //rather than splicing while iterating: the original walked the array forwards
        //and decremented its own index on every removal, which is the shape that
        //produced audit 5.1 AA elsewhere in this codebase.
        const attackers = territoriesAbleToAttackTarget.filter(path => !pathIsDeactivated(path));
        territoriesAbleToAttackTarget.length = 0;
        territoriesAbleToAttackTarget.push(...attackers);

        attackers.forEach(path => territoryUniqueIds.push(path.getAttribute("uniqueid")));

        renderAttackTable(table, {
            attackerPaths: attackers,
            attackerUniqueIds: territoryUniqueIds,
            disabledFlags: disabledFlagsAttack,
            sourceTerritory,
            territoryById: (uniqueId) => allTerritories().find(territory => territory.uniqueId === uniqueId),
            maxAllocatable: getCurrentMainArrayValue,
            updateMultipleTextBox,
            recordAllocation: (boxes) => updateAttackArray(territoryUniqueIds, boxes),
            afterAllocation: () => {
                checkAndSetButtonAsAttackOrCancel(preAttackArray);
                probability = calculateProbabilityPreBattle(preAttackArray, allTerritories(), false);
                preAttackArray.length = 0;
                setAttackProbabilityOnUI(probability, 0);
            }
        });

        disableAttackScreenOptions(table, territoryUniqueIds);
    }
}


//getNextMultipleValue() and getInnerColumnId() moved to src/ui/transferAttack/ --
//the multiplier cycle to multiples.js, the row structure to ArmyAllocationRow.js.

// Helper function to get the current main array value based on armyColumnIndex
function getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, allRowCheck, buttonState) {
    if (allRowCheck) {
        const values = [];
        const selectedRow = document.querySelector(".selectedRow");
        const armyColumns = selectedRow.querySelectorAll(".army-type-column");

        armyColumns.forEach((armyColumn) => {
            let value;
            const childNumber = Array.from(armyColumn.parentNode.children).indexOf(armyColumn);

            switch (childNumber) {
                case 0:
                    value = mainArrayElement.infantryForCurrentTerritory;
                    break;
                case 1:
                    value = mainArrayElement.assaultForCurrentTerritory;
                    break;
                case 2:
                    value = mainArrayElement.airForCurrentTerritory;
                    break;
                case 3:
                    value = mainArrayElement.navalForCurrentTerritory;
                    break;
                default:
                    value = 0;
            }
            values.push(value);
        });

        return values;
    } else if (buttonState === 1) {
        const values = [];

        for (let i = 0; i < territoryUniqueIds.length; i++) {
            const matchingElement = allTerritories().find(element => element.uniqueId === territoryUniqueIds[i]);

            if (matchingElement) {
                values.push([
                    matchingElement.uniqueId,
                    matchingElement.infantryForCurrentTerritory,
                    matchingElement.useableAssault,
                    matchingElement.useableAir,
                    matchingElement.useableNaval,
                ]);
            }
        }

        if (values.length > 0) {
            return values;
        }
    } else {
        switch (armyColumnIndex) {
            case 0:
                return mainArrayElement.infantryForCurrentTerritory;
            case 1:
                return mainArrayElement.assaultForCurrentTerritory;
            case 2:
                return mainArrayElement.airForCurrentTerritory;
            case 3:
                return mainArrayElement.navalForCurrentTerritory;
            default:
                return 0;
        }
    }
}


function updateMultipleTextBox(newMultipleValue, armyTypeColumn, mainArrayElement, quantityTextBox, armyColumnIndex) {
    const multipleTextBox = armyTypeColumn.querySelector(sel.multipleTextBox);
    const currentValue = parseInt(quantityTextBox.value);
    let rowElement;
    if (transferAttackButtonState === 0) {
        rowElement = armyTypeColumn.closest('.transfer-table-row-hoverable');
    } else if (transferAttackButtonState === 1) {
        rowElement = armyTypeColumn.closest('.transfer-table-row');
    }
    const rowIndex = Array.from(rowElement.parentNode.children).indexOf(rowElement);

    if (newMultipleValue === 1) {
        multipleTextBox.value = "x1";
    } else if (newMultipleValue === 10) {
        multipleTextBox.value = "x10";
    } else if (newMultipleValue === 100) {
        multipleTextBox.value = "x100";
    } else if (newMultipleValue === 1000) {
        multipleTextBox.value = "x1k";
    } else if (newMultipleValue === 10000) {
        multipleTextBox.value = "x10k";
    }

    let arrayOfMainArrayValues;

    // Adjust quantityTextBox value based on the newMultipleValue and mainArrayElement
    if (transferAttackButtonState === 0) {
        arrayOfMainArrayValues = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false, 0);
    } else if (transferAttackButtonState === 1) {
        arrayOfMainArrayValues = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false, 1);
    }

    const newValue = currentValue + newMultipleValue;

    if (transferAttackButtonState === 0) {
        if (newValue <= arrayOfMainArrayValues) {
            quantityTextBox.value = newValue.toString();
        } else {
            const difference = arrayOfMainArrayValues - currentValue;
            quantityTextBox.value = (currentValue + difference).toString();
        }
    } else if (transferAttackButtonState === 1) {
        if (newValue <= arrayOfMainArrayValues[rowIndex][armyColumnIndex + 1]) {
            quantityTextBox.value = newValue.toString();
        } else {
            const difference = arrayOfMainArrayValues[rowIndex][armyColumnIndex + 1] - currentValue;
            quantityTextBox.value = (currentValue + difference).toString();
        }
    }
}

function updateTransferArray(mainArrayElement, quantityTextBoxes) {
    const mainArrayUniqueId = mainArrayElement;
    const clickedPathUniqueId = getLastClickedPath().getAttribute("uniqueid");
    const quantityValues = quantityTextBoxes.map((textBox) => textBox.value);

    transferQuantitiesArray = [mainArrayUniqueId, clickedPathUniqueId, ...quantityValues].map(value => parseInt(value));
}

function updateAttackArray(mainArrayElements, quantityTextBoxes) {
    const attackQuantitiesArray = [];

    for (let i = 0; i < mainArrayElements.length; i++) {
        const mainArrayUniqueId = mainArrayElements[i];
        const startIdx = i * 4;
        const quantityValues = quantityTextBoxes.slice(startIdx, startIdx + 4).map((textBox) => parseInt(textBox.value) || 0);

        const rowArray = [mainArrayUniqueId, ...quantityValues];
        attackQuantitiesArray.push(rowArray);
    }

    const attackedTerritoryUniqueId = getLastClickedPath().getAttribute("uniqueid");

    preAttackArray = [attackedTerritoryUniqueId, ...attackQuantitiesArray.flat().map((value) => parseInt(value))]; //change this line first
}

function checkAndSetButtonAsConfirmOrCancel(quantity) {
    const button = moveButton.element();

    if (quantity === 0) {
        moveButton.setLabel("CANCEL");
        moveButton.setVariant("open");
        button.style.color = "white";
        button.style.fontWeight = "normal";
    } else if (quantity >= 1) {
        moveButton.setLabel("CONFIRM");
        moveButton.setVariant("transfer");
        button.style.color = "yellow";
        button.style.fontWeight = "normal";
    }
}

export function transferArmyToNewTerritory(transferArray) { //will move new army, available immediately
    console.log("To: " + transferArray[0] + " From: " + transferArray[1] + " Infantry: " + transferArray[2] + ", Assault: " + transferArray[3] + ", Air: " + transferArray[4] + ", Naval: " + transferArray[5]);
    let newArmyValueTo = 0;
    let newArmyValueFrom = 0;
    let originalArmyValue;

    for (let i = 0; i < allTerritories().length; i++) {
        if (parseInt(allTerritories()[i].uniqueId) === transferArray[0]) { //To
            for (let j = 0; j < allTerritories().length; j++) {
                if (parseInt(allTerritories()[j].uniqueId) === transferArray[1]) { //From
                    allTerritories()[i].infantryForCurrentTerritory += transferArray[2];
                    newArmyValueTo += transferArray[2];
                    allTerritories()[i].assaultForCurrentTerritory += transferArray[3];
                    newArmyValueTo += transferArray[3] * vehicleArmyPersonnelWorth.assault;
                    allTerritories()[i].airForCurrentTerritory += transferArray[4];
                    newArmyValueTo += transferArray[4] * vehicleArmyPersonnelWorth.air;
                    allTerritories()[i].navalForCurrentTerritory += transferArray[5];
                    newArmyValueTo += transferArray[5] * vehicleArmyPersonnelWorth.naval;

                    originalArmyValue = allTerritories()[j].armyForCurrentTerritory;
                    allTerritories()[j].infantryForCurrentTerritory -= transferArray[2];
                    newArmyValueFrom -= transferArray[2];
                    allTerritories()[j].assaultForCurrentTerritory -= transferArray[3];
                    newArmyValueFrom -= transferArray[3] * vehicleArmyPersonnelWorth.assault;
                    allTerritories()[j].airForCurrentTerritory -= transferArray[4];
                    newArmyValueFrom -= transferArray[4] * vehicleArmyPersonnelWorth.air;
                    allTerritories()[j].navalForCurrentTerritory -= transferArray[5];
                    newArmyValueFrom -= transferArray[5] * vehicleArmyPersonnelWorth.naval;

                    allTerritories()[i].armyForCurrentTerritory += newArmyValueTo;
                    allTerritories()[j].armyForCurrentTerritory += newArmyValueFrom;

                    allTerritories()[i].territoryPopulation += newArmyValueTo;
                    allTerritories()[j].territoryPopulation += newArmyValueFrom;

                    if (allTerritories()[j].armyForCurrentTerritory < 0) {
                        allTerritories()[j].armyForCurrentTerritory = 0;
                        allTerritories()[j].territoryPopulation -= originalArmyValue;
                        allTerritories()[j].oilDemand = 0;
                    }

                    colourTableText(bottomTable.element(), allTerritories()[j]);
                    bottomTable.update({
                        army: formatNumbersToKMB(allTerritories()[j].armyForCurrentTerritory, 0),
                        population: formatNumbersToKMB(((((allTerritories()[j].territoryPopulation, 0) / 100) * 45) * allTerritories()[j].devIndex) - allTerritories()[j].armyForCurrentTerritory) + " (" + formatNumbersToKMB(allTerritories()[j].territoryPopulation, 0) + ")",
                    });
                    break;
                }
            }
        }
    }
}

//Takes the committed units out of the territories that supplied them. `attackArray` is
//the defending uniqueId followed by [uniqueId, infantry, assault, air, naval] per source.
//
//Closes audit 5.1 AD. This is called at INVADE! now, not only when a battle is converted
//into a siege, so a garrison cannot be committed to two attacks in the same turn and an
//attack that fails actually costs something. The army comes back through
//`retrievalArray` on a no-penalty retreat, so the round trip balances.
export function transferArmyOutOfTerritoryOnStartingInvasion(attackArray, mainArrayOfTerritoriesAndResources) {
    for (let i = 1; i < attackArray.length; i += 5) {
        const uniqueId = attackArray[i].toString();
        const infantry = attackArray[i + 1];
        const assault = attackArray[i + 2];
        const air = attackArray[i + 3];
        const naval = attackArray[i + 4];

        const matchingTerritory = getTerritory(uniqueId);
        if (!matchingTerritory) {
            continue;
        }

        turnGainsArrayPlayer.changeOilDemand -= (assault * oilRequirements.assault);
        turnGainsArrayPlayer.changeOilDemand -= (air * oilRequirements.air);
        turnGainsArrayPlayer.changeOilDemand -= (naval * oilRequirements.naval);
        matchingTerritory.infantryForCurrentTerritory -= infantry;
        matchingTerritory.assaultForCurrentTerritory -= assault;
        matchingTerritory.airForCurrentTerritory -= air;
        matchingTerritory.navalForCurrentTerritory -= naval;
        //BUG FIX: this was `-=` the sum of what REMAINS, which subtracts the whole
        //garrison a second time and drives armyForCurrentTerritory negative. The army
        //total is the sum of the units, so it is an assignment.
        matchingTerritory.armyForCurrentTerritory = matchingTerritory.infantryForCurrentTerritory + (matchingTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (matchingTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (matchingTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);

        matchingTerritory.oilDemand = ((oilRequirements.assault * matchingTerritory.assaultForCurrentTerritory) + (oilRequirements.air * matchingTerritory.airForCurrentTerritory) + (oilRequirements.naval * matchingTerritory.navalForCurrentTerritory));
        setPlayerUseableNotUseableWeaponsDueToOilDemand(mainArrayOfTerritoriesAndResources, matchingTerritory);
    }
}

function disableAttackScreenOptions(table, territoryUniqueIds) {
    const rows = Array.from(table.querySelectorAll('.transfer-table-row'));

    rows.forEach((row) => {
        const rowIndex = rows.indexOf(row);
        const armyColumns = Array.from(row.querySelectorAll('.army-type-column'));

        armyColumns.forEach((armyColumn, columnIndex) => {
            const matchingTerritory = allTerritories().find(territory =>
                territory.uniqueId === territoryUniqueIds[rowIndex]
            );

            if (matchingTerritory) {
                if (matchingTerritory.infantryForCurrentTerritory === 0 && columnIndex % 4 === 0) {
                    disabledFlagsAttack[rowIndex * 4 + columnIndex] = true;
                } else if (matchingTerritory.useableAssault === 0 && columnIndex % 4 === 1) {
                    disabledFlagsAttack[rowIndex * 4 + columnIndex] = true;
                } else if (matchingTerritory.useableAir === 0 && columnIndex % 4 === 2) {
                    disabledFlagsAttack[rowIndex * 4 + columnIndex] = true;
                } else disabledFlagsAttack[rowIndex * 4 + columnIndex] = matchingTerritory.useableNaval === 0 && columnIndex % 4 === 3;
                if (attackTargetPath().getAttribute("isCoastal") === "false" && columnIndex % 4 === 3) {
                    disabledFlagsAttack[rowIndex * 4 + columnIndex] = true;
                }
            }
        });
    });

    // Loop through the disabledFlags array to find if there are any true elements
    for (let index = 0; index < disabledFlagsAttack.length; index++) {
        const isDisabled = disabledFlagsAttack[index];
        if (isDisabled) {
            // Calculate row and column positions from the index
            const rowPosition = Math.floor(index / 4);
            const columnPosition = index % 4;

            // Get the targeted armyColumn using row and column positions
            const targetedArmyColumn = table.querySelector(`.transfer-table-row:nth-child(${rowPosition + 1}) .army-type-column:nth-child(${columnPosition + 1})`);

            if (targetedArmyColumn) {
                //Phase 7.11. Five writes stood here: two inline `style.color = "grey"`
                //and three image-source swaps to a `Grey.png` twin. All five said the
                //same thing -- this unit type cannot contribute to this attack -- in a
                //form nothing could read back and no theme could reach. One call now.
                setCellEnabled(targetedArmyColumn, false);
            }
        }
    }
}

function checkAndSetButtonAsAttackOrCancel(attackArray) {
    const button = moveButton.element();

    for (let i = 2; i < attackArray.length; i++) {
        if (i % 5 === 1) {
            continue;
        }
        if (attackArray[i] > 0) {
            moveButton.setVariant("attack");
            moveButton.setLabel("INVADE!");
            button.style.color = "rgb(235,235,0)";
            break;
        } else {
            moveButton.setVariant("open");
            moveButton.setLabel("CANCEL");
            button.style.color = "white";
        }

    }
}