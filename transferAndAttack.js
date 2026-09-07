import {
    vehicleArmyPersonnelWorth,
    formatNumbersToKMB,
    colourTableText,
    setPlayerUseableNotUseableWeaponsDueToOilDemand,
    turnGainsArrayPlayer,
    oilRequirements
} from './resourceCalculations.js';
import {
    calculateProbabilityPreBattle,
    preBattleSetup
} from './battle.js';
import {
    attackPreview
} from './src/ui/battle/AttackPreview.js';
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
import { takeProbability } from './src/rules/military/takeProbability.js';

export const territoryUniqueIds = [];
/**
 * The strength-ratio figure, from `winProbability()`. It drives the attack window's BAR.
 *
 * It is not the chance of taking the territory and never was -- known-issue C1, and combat
 * checklist item 1.9 is the open question of what the player should be shown instead. It is
 * left alone here on purpose, so that stage 1 changes what the AI DECIDES on without changing
 * what the player SEES in the same step.
 */
export let probability;
/**
 * What the battle will actually do, from the dice model itself.
 *
 * Separate from `probability` because the two answer different questions and, until 1.9 is
 * settled, the bar keeps its old source. This one exists so that
 * `PROBABILITY_THRESHOLD_FOR_SIEGE` means ONE thing everywhere: the AI's gate and the player's
 * Siege button are now compared against the same quantity, which is the whole point of the
 * stage. Comparing the player's gate against the strength ratio while the AI's is compared
 * against a real probability would have put the drift back in a new place.
 */
export let takeOdds = 0;
let preAttackArray = [];
const disabledFlagsAttack = [];

export let transferQuantitiesArray = [];

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
                //`calculateProbabilityPreBattle()` has just built the setup, so this scores the
                //same one rather than unpacking the attack array a second time.
                const setup = preBattleSetup();
                takeOdds = setup
                    ? takeProbability(setup.attackers, setup.defenders, setup.territory,
                        setup.context, { siegeTurns: setup.siegeTurns })
                    : 0;
                preAttackArray.length = 0;
                setAttackProbabilityOnUI(probability, 0);
                attackPreview.update(preBattleSetup());
            }
        });

        disableAttackScreenOptions(table, territoryUniqueIds);
    }
}

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

    preAttackArray = [attackedTerritoryUniqueId, ...attackQuantitiesArray.flat().map((value) => parseInt(value))];
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

export function transferArmyToNewTerritory(transferArray) {
    console.log("To: " + transferArray[0] + " From: " + transferArray[1] + " Infantry: " + transferArray[2] + ", Assault: " + transferArray[3] + ", Air: " + transferArray[4] + ", Naval: " + transferArray[5]);
    let newArmyValueTo = 0;
    let newArmyValueFrom = 0;
    let originalArmyValue;

    for (let i = 0; i < allTerritories().length; i++) {
        if (parseInt(allTerritories()[i].uniqueId) === transferArray[0]) {
            for (let j = 0; j < allTerritories().length; j++) {
                if (parseInt(allTerritories()[j].uniqueId) === transferArray[1]) {
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

    for (let index = 0; index < disabledFlagsAttack.length; index++) {
        const isDisabled = disabledFlagsAttack[index];
        if (isDisabled) {
            const rowPosition = Math.floor(index / 4);
            const columnPosition = index % 4;

            const targetedArmyColumn = table.querySelector(`.transfer-table-row:nth-child(${rowPosition + 1}) .army-type-column:nth-child(${columnPosition + 1})`);

            if (targetedArmyColumn) {
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