import { mainArrayOfTerritoriesAndResources, vehicleArmyWorth, formatNumbersToKMB, colourTableText, setUseableNotUseableWeaponsDueToOilDemand, turnGainsArrayPlayer, oilRequirements } from './resourceCalculations.js';
import { calculateProbabilityPreBattle, finalAttackArray } from './battle.js';
import { setAttackProbabilityOnUI, territoryAboutToBeAttackedOrSieged, transferAttackButtonState } from './ui.js';

let getLastClickedPathFn;
let selectedTerritoryUniqueId; // transfer only
export let territoryUniqueIds = []; //attack only
export let probability;
let preAttackArray = [];
const disabledFlagsAttack = [];

const tooltip = document.getElementById("tooltip");

export let transferQuantitiesArray = [];

function handleImportedModule(module) {
    const {
        getLastClickedPath
    } = module;
    getLastClickedPathFn = getLastClickedPath;
}

function importModuleWithTimeout() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            import('./ui.js')
                .then(module => {
                    resolve(module);
                })
                .catch(error => {
                    reject(error);
                });
        }, 1000);
    });
}

importModuleWithTimeout()
    .then(module => {
        handleImportedModule(module);
    })
    .catch(error => {
        console.log(error);
    });

// Declare multipleValuesArray outside the drawTransferAttackTable function
export function drawAndHandleTransferAttackTable(table, mainArray, playerOwnedTerritories, territoriesAbleToAttackTarget, transferOrAttack) {
    let navalDisabled = false;
    table.innerHTML = "";

    let selectedRow = null; // Track the selected row
    let mainArrayElement;

    for (let i = 0; i < mainArray.length; i++) {
        if (mainArray[i].uniqueId === getLastClickedPathFn().getAttribute("uniqueid")) {
            mainArrayElement = mainArray[i];
        }
    }

    playerOwnedTerritories.sort((a, b) => {
        const idA = parseInt(a.getAttribute("territory-id"));
        const idB = parseInt(b.getAttribute("territory-id"));
        return idA - idB;
    });

    if (transferOrAttack === 0) { // transfer
        let disabledFlagsTransfer = [true,true,true,true];
        // Create rows
        for (let i = 0; i < playerOwnedTerritories.length; i++) {
            if (playerOwnedTerritories[i].getAttribute("uniqueid") === getLastClickedPathFn().getAttribute("uniqueid")) {
                continue;
            }

            const multipleValuesArray = [100000000, 100000000, 100000000, 100000000]; // Initialize with default values for each row

            const territoryTransferRow = document.createElement("div");
            territoryTransferRow.classList.add("transfer-table-row-hoverable");

            // Create columns
            for (let j = 0; j < 2; j++) {
                const territoryTransferColumn = document.createElement("div");
                territoryTransferColumn.classList.add("transfer-table-outer-column");

                if (j === 0) {
                    territoryTransferColumn.style.width = "50%";
                    const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                    let coastalOrNot;
                    if (playerOwnedTerritories[i].getAttribute("isCoastal") === "true") {
                        coastalOrNot = "Coastal";
                    } else {
                        coastalOrNot = "Landlocked";
                    }
                    territoryTransferColumn.textContent = territoryName + " (" + coastalOrNot + ")";
                    coastalOrNot = "";
                } else {
                    for (let k = 0; k < 4; k++) {
                        const armyTypeColumn = document.createElement("div");
                        armyTypeColumn.classList.add("army-type-column");

                        // Create inner columns
                        for (let m = 0; m < 5; m++) {
                            const innerColumn = document.createElement("div");
                            innerColumn.id = `${getInnerColumnId(m)}`; // Assign ID to innerColumn
                            armyTypeColumn.appendChild(innerColumn);

                            switch (m) {
                                case 0:
                                    // First innerColumn
                                    const imageField = document.createElement("img");
                                    imageField.id = "multipleIncrementCycler";
                                    imageField.classList.add("multipleIncrementerButton");
                                    imageField.src = "resources/multipleIncrementerButtonGrey.png";
                                    imageField.style.height = "20px";
                                    imageField.style.width = "20px";
                                    innerColumn.appendChild(imageField);
                                    break;
                                case 1:
                                    // Second innerColumn
                                    const inputField = document.createElement("input");
                                    inputField.id = "multipleTextBox";
                                    inputField.classList.add("multipleTextField");
                                    inputField.value = "All";
                                    innerColumn.appendChild(inputField);
                                    break;
                                case 2:
                                    // Third innerColumn
                                    const minusButton = document.createElement("img");
                                    minusButton.id = "minusButton";
                                    minusButton.classList.add("transferMinusButton");
                                    minusButton.src = "resources/minusButtonGrey.png";
                                    minusButton.style.height = "20px";
                                    minusButton.style.width = "20px";
                                    innerColumn.appendChild(minusButton);
                                    break;
                                case 3:
                                    // Fourth innerColumn
                                    const quantityTextBox = document.createElement("input");
                                    quantityTextBox.id = "quantityTextBox";
                                    quantityTextBox.classList.add("quantityTextField");
                                    quantityTextBox.value = "0";
                                    innerColumn.appendChild(quantityTextBox);
                                    break;
                                case 4:
                                    // Fifth innerColumn
                                    const plusButton = document.createElement("img");
                                    plusButton.id = "plusButton";
                                    plusButton.classList.add("transferPlusButton");
                                    plusButton.src = "resources/plusButtonGrey.png";
                                    plusButton.style.height = "20px";
                                    plusButton.style.width = "20px";
                                    innerColumn.appendChild(plusButton);
                                    break;
                            }
                        }

                        // Add click event listener to "multipleIncrementCycler" button
                        const multipleIncrementCycler = armyTypeColumn.querySelector("#multipleIncrementCycler");
                        const multipleTextBox = armyTypeColumn.querySelector("#multipleTextBox");

                        multipleIncrementCycler.addEventListener("click", () => {

                            if (armyTypeColumn.parentNode.parentNode !== selectedRow) {
                                return;
                            }

                            const armyColumnIndex = Array.from(armyTypeColumn.parentNode.children).indexOf(armyTypeColumn);

                            if (disabledFlagsTransfer[armyColumnIndex]) {
                                return;
                            }

                            const currentValue = multipleTextBox.value;
                            const newValue = getNextMultipleValue(currentValue);
                            multipleTextBox.value = newValue;

                            let parsedValue;
                            if (newValue === "x1k") {
                                parsedValue = 1000;
                            } else if (newValue === "x10k") {
                                parsedValue = 10000;
                            } else if (newValue === "All") {
                                parsedValue = 100000000;
                            } else {
                                parsedValue = parseInt(newValue.substring(1), 10);
                            }
                            multipleValuesArray[armyColumnIndex] = parsedValue;
                        });

                        // Add click event listener to "plusButton"
                        const plusButton = armyTypeColumn.querySelector("#plusButton");
                        plusButton.addEventListener("click", () => {

                            if (armyTypeColumn.parentNode.parentNode !== selectedRow) {
                                return;
                            }

                            const armyColumn = plusButton.closest(".army-type-column");
                            const quantityTextBox = armyColumn.querySelector("#quantityTextBox");
                            const currentValue = parseInt(quantityTextBox.value);
                            const armyColumnIndex = Array.from(armyColumn.parentNode.children).indexOf(armyColumn);
                            const multipleValue = multipleValuesArray[armyColumnIndex];

                            if (disabledFlagsTransfer[armyColumnIndex]) {
                                return;
                            }

                            let newValue;
                            if (multipleValue === 1) {
                                newValue = currentValue + 1;
                            } else if (multipleValue === 100000000) { //all
                                newValue = mainArrayElement
                                switch (armyColumnIndex) {
                                    case 0:
                                        newValue = mainArrayElement.infantryForCurrentTerritory;
                                        break;
                                    case 1:
                                        newValue = mainArrayElement.assaultForCurrentTerritory;
                                        break;
                                    case 2:
                                        newValue = mainArrayElement.airForCurrentTerritory;
                                        break;
                                    case 3:
                                        newValue = mainArrayElement.navalForCurrentTerritory;
                                        break;
                                }
                            } else {
                                const multiplier = Math.pow(10, Math.floor(Math.log10(multipleValue)));
                                newValue = currentValue + (multiplier > 1 ? multiplier : multipleValue);
                            }

                            // Compare with main array values
                            const mainArrayValue = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false, 0);
                            if (newValue <= mainArrayValue) {
                                quantityTextBox.value = newValue.toString();
                            } else {
                                // Ignore click and reduce multiple value
                                if (multipleValue > 1) {
                                    let newMultipleValue = Math.floor(multipleValue / 10);
                                    if (parseInt(quantityTextBox.value) === mainArrayValue) {
                                        newMultipleValue = 1;
                                    }
                                    multipleValuesArray[armyColumnIndex] = newMultipleValue;
                                    updateMultipleTextBox(newMultipleValue, armyTypeColumn, mainArrayElement, quantityTextBox, armyColumnIndex);
                                }
                            }

                            // Check if the quantity has reached the maximum limit
                            if (parseInt(quantityTextBox.value) === mainArrayValue) {
                                plusButton.src = "resources/plusButtonGrey.png";
                            }

                            const armyColumnElements = Array.from(selectedRow.querySelectorAll('.army-type-column'));
                            const quantityTextBoxes = armyColumnElements.map((column) => column.querySelector("#quantityTextBox"));
                            updateTransferArray(selectedTerritoryUniqueId, quantityTextBoxes);
                            checkAndSetButtonAsConfirmOrCancel(parseInt(quantityTextBox.value));
                        });

                        // Add click event listener to "minusButton"
                        const minusButton = armyTypeColumn.querySelector("#minusButton");
                        minusButton.addEventListener("click", () => {

                            if (armyTypeColumn.parentNode.parentNode !== selectedRow) {
                                return;
                            }

                            const armyColumn = minusButton.closest(".army-type-column");
                            const quantityTextBox = armyColumn.querySelector("#quantityTextBox");
                            const currentValue = parseInt(quantityTextBox.value);
                            const armyColumnIndex = Array.from(armyColumn.parentNode.children).indexOf(armyColumn);
                            const multipleValue = multipleValuesArray[armyColumnIndex];

                            if (currentValue === 0) {
                                return;
                            }

                            if (disabledFlagsTransfer[armyColumnIndex]) {
                                return;
                            }

                            let newValue = currentValue;
                            let newMultipleValue = multipleValue;

                            if (multipleValue > 1) {
                                let multiplier = Math.pow(10, Math.floor(Math.log10(multipleValue)));
                                while (newValue - multiplier < 0) {
                                    newMultipleValue = Math.floor(multiplier / 10);
                                    multiplier = Math.pow(10, Math.floor(Math.log10(newMultipleValue)));
                                }
                            }

                            if (multipleValue === 1) {
                                newValue = newValue - 1;
                            } else {
                                const multiplier = Math.pow(10, Math.floor(Math.log10(newMultipleValue)));
                                newValue = newValue - (multiplier > 1 ? multiplier : newMultipleValue);
                            }

                            quantityTextBox.value = newValue.toString();
                            multipleValuesArray[armyColumnIndex] = newMultipleValue;

                            // Update the displayed string in the multipleTextBox
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
                            } else if (newMultipleValue === 100000000) {
                                multipleTextBox.value = "All";
                            }

                            // Check if the quantity has reached the maximum limit
                            const mainArrayValue = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false, 0);
                            if (parseInt(quantityTextBox.value) < mainArrayValue) {
                                plusButton.src = "resources/plusButton.png";
                            }

                            const armyColumnElements = Array.from(selectedRow.querySelectorAll('.army-type-column'));
                            const quantityTextBoxes = armyColumnElements.map((column) => column.querySelector("#quantityTextBox"));
                            updateTransferArray(selectedTerritoryUniqueId, quantityTextBoxes);
                            checkAndSetButtonAsConfirmOrCancel(parseInt(quantityTextBox.value));
                        });

                        territoryTransferColumn.appendChild(armyTypeColumn);
                    }
                }

                territoryTransferRow.appendChild(territoryTransferColumn);
            }

            // Add click event listener to each row
            territoryTransferRow.addEventListener("click", () => {
                selectedTerritoryUniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
            });

            table.appendChild(territoryTransferRow);
        }

        // Add click event listener to territoryTransferColumn:first-child elements
        const territoryTransferColumns = document.querySelectorAll(".transfer-table-outer-column:first-child");
        territoryTransferColumns.forEach((column) => {
            column.addEventListener("click", () => {
                const territoryTextString = document.getElementById("territoryTextString"); // change title to white text when selected a row
                territoryTextString.style.color = "white";
                territoryTextString.style.fontWeight = "normal";
                territoryTextString.innerHTML = column.innerHTML;

                const territoryTransferRow = column.parentNode;

                if (selectedRow === territoryTransferRow) {
                    return;
                }

                if (selectedRow !== null) {
                    selectedRow.classList.remove("selectedRow");
                }

                selectedRow = territoryTransferRow;
                selectedRow.classList.add("selectedRow");

                // Enable/disable army columns based on selection
                const armyColumns = Array.from(territoryTransferRow.querySelectorAll(".army-type-column"));
                const allArmyColumns = Array.from(document.querySelectorAll(".army-type-column"));

                armyColumns.forEach((column) => {
                    const multipleIncrementCycler = column.querySelector("#multipleIncrementCycler");
                    const transferMinusButton = column.querySelector("#minusButton");
                    const transferPlusButton = column.querySelector("#plusButton");
                    const quantityTextBox = column.querySelector("#quantityTextBox");
                    const multipleTextBox = column.querySelector("#multipleTextBox");

                    // Enable selected row army columns
                    if (multipleIncrementCycler.src.includes("Grey")) {
                        multipleIncrementCycler.src = multipleIncrementCycler.src.replace("Grey.png", ".png");
                    }
                    if (transferMinusButton.src.includes("Grey")) {
                        transferMinusButton.src = transferMinusButton.src.replace("Grey.png", ".png");
                    }
                    if (transferPlusButton.src.includes("Grey")) {
                        transferPlusButton.src = transferPlusButton.src.replace("Grey.png", ".png");
                    }
                    quantityTextBox.style.color = "white";
                    multipleTextBox.style.color = "white";
                });

                allArmyColumns.forEach((column) => {
                    const multipleIncrementCycler = column.querySelector("#multipleIncrementCycler");
                    const transferMinusButton = column.querySelector("#minusButton");
                    const transferPlusButton = column.querySelector("#plusButton");
                    const quantityTextBox = column.querySelector("#quantityTextBox");
                    const multipleTextBox = column.querySelector("#multipleTextBox");

                    if (!armyColumns.includes(column)) {
                        // Disable non-selected row army columns
                        if (!multipleIncrementCycler.src.includes("Grey")) {
                            multipleIncrementCycler.src = multipleIncrementCycler.src.replace(".png", "Grey.png");
                        }
                        if (!transferMinusButton.src.includes("Grey")) {
                            transferMinusButton.src = transferMinusButton.src.replace(".png", "Grey.png");
                        }
                        if (!transferPlusButton.src.includes("Grey")) {
                            transferPlusButton.src = transferPlusButton.src.replace(".png", "Grey.png");
                        }
                        quantityTextBox.style.color = "grey";
                        multipleTextBox.style.color = "grey";

                        // Reset values
                        quantityTextBox.value = "0";
                        multipleTextBox.value = "All";
                    } else {
                        // Reset values
                        quantityTextBox.value = "0";
                        multipleTextBox.value = "All";
                    }
                    const mainArrayValueArray = getCurrentMainArrayValue(mainArrayElement, 0, true, 0);

                    armyColumns.forEach((column, index) => {
                        const plusButton = column.querySelector("#plusButton");
                        const minusButton = column.querySelector("#minusButton");
                        const multipleIncrementCycler = column.querySelector("#multipleIncrementCycler");
                        const multipleTextBox = column.querySelector("#multipleTextBox");
                        const quantityTextBox = column.querySelector("#quantityTextBox");

                        for (let i = 0; i < playerOwnedTerritories.length; i++) {
                            const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                            const regex = /^([^(\s]+)\s?\(/;
                            const match = selectedRow.textContent.match(regex);

                            if (match && match[1] === territoryName) {
                                navalDisabled = playerOwnedTerritories[i].getAttribute("isCoastal") === "false";
                            }
                        }
                    
                        if (mainArrayValueArray[index] === 0) {
                            plusButton.src = "resources/plusButtonGrey.png";
                            multipleTextBox.style.color = "grey";
                            quantityTextBox.style.color = "grey";
                            minusButton.src = "resources/minusButtonGrey.png";
                            multipleIncrementCycler.src = "resources/multipleIncrementerButtonGrey.png";
                        
                            disabledFlagsTransfer[index] = true;
                        } else if (navalDisabled) { //if territory is coastal
                            if (index === 3) { //if last column i.e. naval
                                plusButton.src = "resources/plusButtonGrey.png";
                                multipleTextBox.style.color = "grey";
                                quantityTextBox.style.color = "grey";
                                minusButton.src = "resources/minusButtonGrey.png";
                                multipleIncrementCycler.src = "resources/multipleIncrementerButtonGrey.png";
                                disabledFlagsTransfer[index] = true;
                            }
                        } else {
                            disabledFlagsTransfer[index] = false;
                        }
                    });
                });
            });
        });

    } else if (transferOrAttack === 1) { // attack
        //remove deactivated territories from territoriesAbleToAttackArray 
        for (let i = 0; i < territoriesAbleToAttackTarget.length; i++) {
            if (territoriesAbleToAttackTarget[i].getAttribute("deactivated") === "true") {
              territoriesAbleToAttackTarget.splice(i, 1);
              i--;
            }
          }
        // Create rows
        for (let i = 0; i < territoriesAbleToAttackTarget.length; i++) {
            territoryUniqueIds.push(territoriesAbleToAttackTarget[i].getAttribute("uniqueid"));
    
            const multipleValuesArray = [100000000, 100000000, 100000000, 100000000]; // Initialize with default values for each row
    
            const territoryAttackFromRow = document.createElement("div");
            territoryAttackFromRow.classList.add("transfer-table-row");
    
            // Create columns
            for (let j = 0; j < 2; j++) {
                const territoryAttackFromColumn = document.createElement("div");
                territoryAttackFromColumn.classList.add("transfer-table-outer-column");
    
                if (j === 0) {
                    territoryAttackFromColumn.style.width = "50%";
                    const territoryAttackFromName = territoriesAbleToAttackTarget[i].getAttribute("territory-name");
                    territoryAttackFromColumn.textContent = territoryAttackFromName;
                } else {
                    const armyColumns = []; // Store army columns for each territory
    
                    for (let k = 0; k < 4; k++) {
                        const armyTypeColumn = document.createElement("div");
                        armyTypeColumn.classList.add("army-type-column");
    
                        // Create inner columns
                        for (let m = 0; m < 5; m++) {
                            const innerColumn = document.createElement("div");
                            innerColumn.id = `${getInnerColumnId(m)}`; // Assign ID to innerColumn
                            armyTypeColumn.appendChild(innerColumn);

                            switch (m) {
                                case 0:
                                    // First innerColumn
                                    const imageField = document.createElement("img");
                                    imageField.id = "multipleIncrementCycler";
                                    imageField.classList.add("multipleIncrementerButton");
                                    imageField.src = "resources/multipleIncrementerButton.png";
                                    imageField.style.height = "20px";
                                    imageField.style.width = "20px";
                                    innerColumn.appendChild(imageField);
                                    break;
                                case 1:
                                    // Second innerColumn
                                    const inputField = document.createElement("input");
                                    inputField.id = "multipleTextBox";
                                    inputField.classList.add("multipleTextField");
                                    inputField.classList.add("attackWhiteDefault");
                                    inputField.value = "All";
                                    innerColumn.appendChild(inputField);
                                    break;
                                case 2:
                                    // Third innerColumn
                                    const minusButton = document.createElement("img");
                                    minusButton.id = "minusButton";
                                    minusButton.classList.add("transferMinusButton");
                                    minusButton.src = "resources/minusButton.png";
                                    minusButton.style.height = "20px";
                                    minusButton.style.width = "20px";
                                    innerColumn.appendChild(minusButton);
                                    break;
                                case 3:
                                    // Fourth innerColumn
                                    const quantityTextBox = document.createElement("input");
                                    quantityTextBox.id = "quantityTextBox";
                                    quantityTextBox.classList.add("quantityTextField");
                                    quantityTextBox.classList.add("attackWhiteDefault");
                                    quantityTextBox.value = "0";
                                    innerColumn.appendChild(quantityTextBox);
                                    break;
                                case 4:
                                    // Fifth innerColumn
                                    const plusButton = document.createElement("img");
                                    plusButton.id = "plusButton";
                                    plusButton.classList.add("transferPlusButton");
                                    plusButton.src = "resources/plusButton.png";
                                    plusButton.style.height = "20px";
                                    plusButton.style.width = "20px";
                                    innerColumn.appendChild(plusButton);
                                    break;
                            }
                        }

                        armyColumns.push(armyTypeColumn); // Store the army column

                        // Add click event listener to "multipleIncrementCycler" button
                        const multipleIncrementCycler = armyTypeColumn.querySelector("#multipleIncrementCycler");
                        const multipleTextBox = armyTypeColumn.querySelector("#multipleTextBox");

                        multipleIncrementCycler.addEventListener("click", () => {

                            const rowIndex = Array.from(table.querySelectorAll('.transfer-table-row')).indexOf(armyTypeColumn.closest('.transfer-table-row'));
                            const armyColumnIndex = Array.from(armyTypeColumn.parentNode.children).indexOf(armyTypeColumn);

                            if (disabledFlagsAttack[rowIndex * 4 + armyColumnIndex]) {
                                return;
                            }

                            const currentValue = multipleTextBox.value;
                            const newValue = getNextMultipleValue(currentValue);
                            multipleTextBox.value = newValue;

                            let parsedValue;
                            if (newValue === "x1k") {
                                parsedValue = 1000;
                            } else if (newValue === "x10k") {
                                parsedValue = 10000;
                            } else if (newValue === "All") {
                                parsedValue = 100000000;
                            } else {
                                parsedValue = parseInt(newValue.substring(1), 10);
                            }
                            multipleValuesArray[armyColumnIndex] = parsedValue;
                        });

                        // Append the army columns to the territoryAttackFromColumn
                        armyColumns.forEach(armyColumn => {
                            territoryAttackFromColumn.appendChild(armyColumn);
                        });

                        // Add click event listener to "plusButton"
                        const plusButton = armyTypeColumn.querySelector("#plusButton");
                        plusButton.addEventListener("click", () => {

                            const armyColumn = plusButton.closest(".army-type-column");
                            const quantityTextBox = armyColumn.querySelector("#quantityTextBox");
                            const currentValue = parseInt(quantityTextBox.value);
                            const armyColumnIndex = Array.from(armyColumn.parentNode.children).indexOf(armyColumn);
                            const multipleValue = multipleValuesArray[armyColumnIndex];
                            const rowIndex = Array.from(table.querySelectorAll('.transfer-table-row')).indexOf(armyTypeColumn.closest('.transfer-table-row'));

                            if (disabledFlagsAttack[rowIndex * 4 + armyColumnIndex]) {
                                return;
                              }

                            let newValue;
                            if (multipleValue === 1) {
                                newValue = currentValue + 1;
                            } else if (multipleValue === 100000000) {
                                for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
                                    if (mainArrayOfTerritoriesAndResources[i].uniqueId === territoryUniqueIds[rowIndex]) {
                                        switch (armyColumnIndex) {
                                            case 0:
                                                newValue = mainArrayOfTerritoriesAndResources[i].infantryForCurrentTerritory;
                                                break;
                                            case 1:
                                                newValue = mainArrayOfTerritoriesAndResources[i].useableAssault;
                                                break;
                                            case 2:
                                                newValue = mainArrayOfTerritoriesAndResources[i].useableAir;
                                                break;
                                            case 3:
                                                newValue = mainArrayOfTerritoriesAndResources[i].useableNaval;
                                                break;
                                        }
                                        break;
                                    }
                                }
                            } else {
                                const multiplier = Math.pow(10, Math.floor(Math.log10(multipleValue)));
                                newValue = currentValue + (multiplier > 1 ? multiplier : multipleValue);
                            }

                            // Compare with main array values
                            const arrayOfMainArrayValues = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false, 1);
                            if (newValue <= arrayOfMainArrayValues[rowIndex][armyColumnIndex + 1]) {
                                quantityTextBox.value = newValue.toString();
                            } else {
                                // Ignore click and reduce multiple value
                                if (multipleValue > 1) {
                                    let newMultipleValue = Math.floor(multipleValue / 10);
                                    if (parseInt(quantityTextBox.value) === arrayOfMainArrayValues[rowIndex][armyColumnIndex + 1]) {
                                        newMultipleValue = 1;
                                    }
                                    multipleValuesArray[armyColumnIndex] = newMultipleValue;
                                    updateMultipleTextBox(newMultipleValue, armyTypeColumn, mainArrayElement, quantityTextBox, armyColumnIndex);
                                }
                            }

                            // Check if the quantity has reached the maximum limit
                            if (parseInt(quantityTextBox.value) === arrayOfMainArrayValues[rowIndex][armyColumnIndex + 1]) {
                                plusButton.src = "resources/plusButtonGrey.png";
                            }

                            const rowRightHalfElements = Array.from(table.querySelectorAll('.transfer-table-outer-column:last-child'));
                            const armyColumnElements = rowRightHalfElements.map(rowRightHalfElement => Array.from(rowRightHalfElement.querySelectorAll('.army-type-column')));
                            const quantityTextBoxes = armyColumnElements.flatMap((row) => row.map((column) => column.querySelector("#quantityTextBox")));

                            updateAttackArray(territoryUniqueIds, quantityTextBoxes);
                            checkAndSetButtonAsAttackOrCancel(preAttackArray);
                            probability = calculateProbabilityPreBattle(preAttackArray, mainArrayOfTerritoriesAndResources, false);
                            console.log("pre probability: " + probability);
                            console.log("attackArray: " + finalAttackArray);
                            preAttackArray.length = 0;
                            setAttackProbabilityOnUI(probability, 0);
                        });

                        // Add click event listener to "minusButton"
                        const minusButton = armyTypeColumn.querySelector("#minusButton");
                        minusButton.addEventListener("click", () => {

                            const armyColumn = minusButton.closest(".army-type-column");
                            const quantityTextBox = armyColumn.querySelector("#quantityTextBox");
                            const currentValue = parseInt(quantityTextBox.value);
                            const armyColumnIndex = Array.from(armyColumn.parentNode.children).indexOf(armyColumn);
                            const multipleValue = multipleValuesArray[armyColumnIndex];
                            const rowIndex = Array.from(table.querySelectorAll('.transfer-table-row')).indexOf(armyTypeColumn.closest('.transfer-table-row'));

                            if (currentValue === 0) {
                                return;
                            }

                            if (disabledFlagsAttack[rowIndex * 4 + armyColumnIndex]) {
                                return;
                              }

                            let newValue = currentValue;
                            let newMultipleValue = multipleValue;

                            if (multipleValue > 1) {
                                let multiplier = Math.pow(10, Math.floor(Math.log10(multipleValue)));
                                while (newValue - multiplier < 0) {
                                    newMultipleValue = Math.floor(multiplier / 10);
                                    multiplier = Math.pow(10, Math.floor(Math.log10(newMultipleValue)));
                                }
                                if (multipleValue === 100000) {
                                    newMultipleValue = 10000;
                                }
                            }

                            if (multipleValue === 1) {
                                newValue = newValue - 1;
                            } else {
                                const multiplier = Math.pow(10, Math.floor(Math.log10(newMultipleValue)));
                                newValue = newValue - (multiplier > 1 ? multiplier : newMultipleValue);
                            }

                            quantityTextBox.value = newValue.toString();
                            multipleValuesArray[armyColumnIndex] = newMultipleValue;

                            // Update the displayed string in the multipleTextBox
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
                            } else if (newMultipleValue === 100000000) {
                                multipleTextBox.value = "All";
                            }

                            // Check if the quantity has reached the maximum limit
                            const arrayOfMainArrayValues = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false, 1);
                            if (parseInt(quantityTextBox.value) < arrayOfMainArrayValues[rowIndex][armyColumnIndex + 1]) {
                                plusButton.src = "resources/plusButton.png";
                            }

                            const rowRightHalfElements = Array.from(table.querySelectorAll('.transfer-table-outer-column:last-child'));
                            const armyColumnElements = rowRightHalfElements.map(rowRightHalfElement => Array.from(rowRightHalfElement.querySelectorAll('.army-type-column')));
                            const quantityTextBoxes = armyColumnElements.flatMap((row) => row.map((column) => column.querySelector("#quantityTextBox")));

                            updateAttackArray(territoryUniqueIds, quantityTextBoxes);
                            checkAndSetButtonAsAttackOrCancel(preAttackArray);
                            probability = calculateProbabilityPreBattle(preAttackArray, mainArrayOfTerritoriesAndResources, false);
                            console.log("pre probability: " + probability);
                            console.log("attackArray: " + finalAttackArray);
                            preAttackArray.length = 0;
                            setAttackProbabilityOnUI(probability, 0);
                        });
                        territoryAttackFromColumn.appendChild(armyTypeColumn);
                    }
                }
                territoryAttackFromRow.appendChild(territoryAttackFromColumn);
            }
            table.appendChild(territoryAttackFromRow);
        }
        disableAttackScreenOptions(table, territoryUniqueIds);
    }
}


// Helper function to get the next multiple value
function getNextMultipleValue(currentValue) {
    const multiples = ["All", "x1", "x10", "x100", "x1k", "x10k"];
    const currentIndex = multiples.indexOf(currentValue);
    const nextIndex = (currentIndex + 1) % multiples.length;
    return multiples[nextIndex];
}

// Helper function to generate the ID for innerColumn elements
function getInnerColumnId(m) {
    let id = "";
    switch (m) {
        case 0:
            id = "multipleIncrementCyclerContainer";
            break;
        case 1:
            id = "multipleTextFieldContainer";
            break;
        case 2:
            id = "quantityMinusContainer";
            break;
        case 3:
            id = "quantityTextFieldContainer";
            break;
        case 4:
            id = "quantityPlusContainer";
            break;
    }
    return id;
}


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
          const matchingElement = mainArrayOfTerritoriesAndResources.find(element => element.uniqueId === territoryUniqueIds[i]);
      
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
    const multipleTextBox = armyTypeColumn.querySelector("#multipleTextBox");
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
    const clickedPathUniqueId = getLastClickedPathFn().getAttribute("uniqueid");
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
  
    const attackedTerritoryUniqueId = getLastClickedPathFn().getAttribute("uniqueid");
  
    preAttackArray = [attackedTerritoryUniqueId, ...attackQuantitiesArray.flat().map((value) => parseInt(value))]; //change this line first
  }
  
function checkAndSetButtonAsConfirmOrCancel(quantity) {
    const button = document.getElementById("move-phase-button");
  
    if (quantity === 0) {

      button.innerHTML = "CANCEL";
      
      button.classList.remove("move-phase-button-red-background");
      button.classList.remove("move-phase-button-grey-background");
      button.classList.remove("move-phase-button-green-background");
      button.classList.add("move-phase-button-blue-background");

      button.style.color = "white";
      button.style.fontWeight = "normal";

    } else if (quantity >= 1) {

      button.innerHTML = "CONFIRM";

      button.classList.remove("move-phase-button-red-background");
      button.classList.remove("move-phase-button-grey-background");
      button.classList.remove("move-phase-button-blue-background");
      button.classList.add("move-phase-button-green-background");

      button.style.color = "yellow";
      button.style.fontWeight = "normal";

    }
  }

export function transferArmyToNewTerritory(transferArray) { //will move new army, available immediately
    console.log("To: " + transferArray[0] + " From: " + transferArray[1] + " Infantry: " + transferArray[2] + ", Assault: " + transferArray[3] + ", Air: " + transferArray[4] + ", Naval: " + transferArray[5]);
    let newArmyValueTo = 0;
    let newArmyValueFrom = 0;
    let originalArmyValue;

    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (parseInt(mainArrayOfTerritoriesAndResources[i].uniqueId) === transferArray[0]) { //To
          for (let j = 0; j < mainArrayOfTerritoriesAndResources.length; j++) {
            if (parseInt(mainArrayOfTerritoriesAndResources[j].uniqueId) === transferArray[1]) { //From
              mainArrayOfTerritoriesAndResources[i].infantryForCurrentTerritory += transferArray[2];
              newArmyValueTo += transferArray[2];
              mainArrayOfTerritoriesAndResources[i].assaultForCurrentTerritory += transferArray[3];
              newArmyValueTo += transferArray[3] * vehicleArmyWorth.assault;
              mainArrayOfTerritoriesAndResources[i].airForCurrentTerritory += transferArray[4];
              newArmyValueTo += transferArray[4] * vehicleArmyWorth.air;
              mainArrayOfTerritoriesAndResources[i].navalForCurrentTerritory += transferArray[5];
              newArmyValueTo += transferArray[5] * vehicleArmyWorth.naval;
      
              originalArmyValue = mainArrayOfTerritoriesAndResources[j].armyForCurrentTerritory;
              mainArrayOfTerritoriesAndResources[j].infantryForCurrentTerritory -= transferArray[2];
              newArmyValueFrom -= transferArray[2];
              mainArrayOfTerritoriesAndResources[j].assaultForCurrentTerritory -= transferArray[3];
              newArmyValueFrom -= transferArray[3] * vehicleArmyWorth.assault;
              mainArrayOfTerritoriesAndResources[j].airForCurrentTerritory -= transferArray[4];
              newArmyValueFrom -= transferArray[4] * vehicleArmyWorth.air;
              mainArrayOfTerritoriesAndResources[j].navalForCurrentTerritory -= transferArray[5];
              newArmyValueFrom -= transferArray[5] * vehicleArmyWorth.naval;
      
              mainArrayOfTerritoriesAndResources[i].armyForCurrentTerritory += newArmyValueTo;
              mainArrayOfTerritoriesAndResources[j].armyForCurrentTerritory += newArmyValueFrom;
      
              mainArrayOfTerritoriesAndResources[i].territoryPopulation += newArmyValueTo;
              mainArrayOfTerritoriesAndResources[j].territoryPopulation += newArmyValueFrom;
      
              if (mainArrayOfTerritoriesAndResources[j].armyForCurrentTerritory < 0) {
                mainArrayOfTerritoriesAndResources[j].armyForCurrentTerritory = 0;
                mainArrayOfTerritoriesAndResources[j].territoryPopulation -= originalArmyValue;
                mainArrayOfTerritoriesAndResources[j].oilDemand = 0;
              }
      
              colourTableText(document.getElementById("bottom-table"), mainArrayOfTerritoriesAndResources[j]);
              document.getElementById("bottom-table").rows[0].cells[17].innerHTML = formatNumbersToKMB(mainArrayOfTerritoriesAndResources[j].armyForCurrentTerritory);
              document.getElementById("bottom-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(((((mainArrayOfTerritoriesAndResources[j].territoryPopulation) / 100) * 45) * mainArrayOfTerritoriesAndResources[j].devIndex) - mainArrayOfTerritoriesAndResources[j].armyForCurrentTerritory) + " (" + formatNumbersToKMB(mainArrayOfTerritoriesAndResources[j].territoryPopulation) + ")";
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
  
      const matchingTerritory = mainArrayOfTerritoriesAndResources.find(
        territory => territory.uniqueId === uniqueId
      );
  
      if (matchingTerritory) {
        turnGainsArrayPlayer.changeOilDemand -= (assault * oilRequirements.assault);
        turnGainsArrayPlayer.changeOilDemand -= (air * oilRequirements.air);
        turnGainsArrayPlayer.changeOilDemand -= (naval * oilRequirements.naval);
        matchingTerritory.infantryForCurrentTerritory -= infantry;
        matchingTerritory.assaultForCurrentTerritory -= assault;
        matchingTerritory.airForCurrentTerritory -= air;
        matchingTerritory.navalForCurrentTerritory -= naval;
        matchingTerritory.armyForCurrentTerritory -= (matchingTerritory.infantryForCurrentTerritory + (matchingTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (matchingTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (matchingTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval));
      }
      matchingTerritory.oilDemand = ((oilRequirements.assault * matchingTerritory.assaultForCurrentTerritory) + (oilRequirements.air * matchingTerritory.airForCurrentTerritory) + (oilRequirements.naval * matchingTerritory.navalForCurrentTerritory));
      setUseableNotUseableWeaponsDueToOilDemand(mainArrayOfTerritoriesAndResources, matchingTerritory);
    }
  }  

function disableAttackScreenOptions(table, territoryUniqueIds) {
    const rows = Array.from(table.querySelectorAll('.transfer-table-row'));
  
    rows.forEach((row) => {
      const rowIndex = rows.indexOf(row);
      const armyColumns = Array.from(row.querySelectorAll('.army-type-column'));
  
      armyColumns.forEach((armyColumn, columnIndex) => {
        const matchingTerritory = mainArrayOfTerritoriesAndResources.find(territory =>
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
          if (territoryAboutToBeAttackedOrSieged.getAttribute("isCoastal") === "false" && columnIndex % 4 === 3) {
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
                // Apply styling changes to the targeted armyColumn
                const quantityTextBox = targetedArmyColumn.querySelector("#quantityTextBox");
                const multipleTextBox = targetedArmyColumn.querySelector("#multipleTextBox");
                const multipleIncrementCycler = targetedArmyColumn.querySelector("#multipleIncrementCycler");
                const plusButton = targetedArmyColumn.querySelector("#plusButton");
                const minusButton = targetedArmyColumn.querySelector("#minusButton");

                if (quantityTextBox) {
                    quantityTextBox.style.color = "grey";
                }
                if (multipleTextBox) {
                    multipleTextBox.style.color = "grey";
                }
                if (multipleIncrementCycler) {
                    multipleIncrementCycler.src = "resources/multipleIncrementerButtonGrey.png";
                }
                if (plusButton) {
                    plusButton.src = "resources/plusButtonGrey.png";
                }
                if (minusButton) {
                    minusButton.src = "resources/minusButtonGrey.png";
                }
            }
        }
    }
}

function checkAndSetButtonAsAttackOrCancel(attackArray) {
    let button = document.getElementById("move-phase-button");

    for (let i = 2; i < attackArray.length; i++) {
      if (i % 5 === 1) {
        continue;
      }
      if (attackArray[i] > 0) {
        button.classList.remove("move-phase-button-blue-background");
        button.classList.add("move-phase-button-red-background");
        button.innerHTML = "INVADE!";
        button.style.color = "rgb(235,235,0)";
        break;
      } else {
        button.classList.remove("move-phase-button-red-background");
        button.classList.add("move-phase-button-blue-background");
        button.innerHTML = "CANCEL";
        button.style.color = "white";
      }

    }}
    