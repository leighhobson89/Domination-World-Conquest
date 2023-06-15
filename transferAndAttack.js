let getLastClickedPathFn;
let selectedTerritoryUniqueId;

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
export function drawTransferAttackTable(table, validDestinationsArray, mainArray, playerOwnedTerritories, transferOrAttack) {
    table.innerHTML = "";

    let selectedRow = null; // Track the selected row
    let mainArrayElement;
    const disabledFlags = [true,true,true,true];

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
        // Create rows
        for (let i = 0; i < playerOwnedTerritories.length; i++) {
            if (playerOwnedTerritories[i].getAttribute("uniqueid") === getLastClickedPathFn().getAttribute("uniqueid")) {
                continue;
            }

            const multipleValuesArray = [1, 1, 1, 1]; // Initialize with default values for each row

            const territoryTransferRow = document.createElement("div");
            territoryTransferRow.classList.add("transfer-table-row-hoverable");

            // Create columns
            for (let j = 0; j < 2; j++) {
                const territoryTransferColumn = document.createElement("div");
                territoryTransferColumn.classList.add("transfer-table-outer-column");

                if (j === 0) {
                    territoryTransferColumn.style.width = "50%";
                    const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                    territoryTransferColumn.textContent = territoryName;
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
                                    imageField.src = "/resources/multipleIncrementerButtonGrey.png";
                                    imageField.style.height = "20px";
                                    imageField.style.width = "20px";
                                    innerColumn.appendChild(imageField);
                                    break;
                                case 1:
                                    // Second innerColumn
                                    const inputField = document.createElement("input");
                                    inputField.id = "multipleTextBox";
                                    inputField.classList.add("multipleTextField");
                                    inputField.value = "x1";
                                    innerColumn.appendChild(inputField);
                                    break;
                                case 2:
                                    // Third innerColumn
                                    const minusButton = document.createElement("img");
                                    minusButton.id = "minusButton";
                                    minusButton.classList.add("transferMinusButton");
                                    minusButton.src = "/resources/minusButtonGrey.png";
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
                                    plusButton.src = "/resources/plusButtonGrey.png";
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

                            if (disabledFlags[armyColumnIndex]) {
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

                            if (disabledFlags[armyColumnIndex]) {
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
                            const mainArrayValue = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false);
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
                                plusButton.src = "/resources/plusButtonGrey.png";
                            }

                            const armyColumnElements = Array.from(selectedRow.querySelectorAll('.army-type-column'));
                            const quantityTextBoxes = armyColumnElements.map((column) => column.querySelector("#quantityTextBox"));
                            updateTransferArray(selectedTerritoryUniqueId, quantityTextBoxes);
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

                            if (disabledFlags[armyColumnIndex]) {
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
                            const mainArrayValue = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false);
                            if (parseInt(quantityTextBox.value) < mainArrayValue) {
                                plusButton.src = "/resources/plusButton.png";
                            }

                            const armyColumnElements = Array.from(selectedRow.querySelectorAll('.army-type-column'));
                            const quantityTextBoxes = armyColumnElements.map((column) => column.querySelector("#quantityTextBox"));
                            updateTransferArray(selectedTerritoryUniqueId, quantityTextBoxes);
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
                        multipleTextBox.value = "x1";
                    } else {
                        // Reset values
                        quantityTextBox.value = "0";
                        multipleTextBox.value = "x1";
                    }
                    const mainArrayValueArray = getCurrentMainArrayValue(mainArrayElement, 0, true);

                    armyColumns.forEach((column, index) => {
                        const plusButton = column.querySelector("#plusButton");
                        const minusButton = column.querySelector("#minusButton");
                        const multipleIncrementCycler = column.querySelector("#multipleIncrementCycler");
                        const multipleTextBox = column.querySelector("#multipleTextBox");
                        const quantityTextBox = column.querySelector("#quantityTextBox");
                    
                        if (mainArrayValueArray[index] === 0) {
                            plusButton.src = "/resources/plusButtonGrey.png";
                            multipleTextBox.style.color = "grey";
                            quantityTextBox.style.color = "grey";
                            minusButton.src = "/resources/minusButtonGrey.png";
                            multipleIncrementCycler.src = "/resources/multipleIncrementerButtonGrey.png";
                        
                            disabledFlags[index] = true;
                        } else {
                            disabledFlags[index] = false;
                        }
                    });
                });
            });
        });

    } else if (transferOrAttack === 1) { // attack
        // Add attack logic here
    }
}


// Helper function to get the next multiple value
function getNextMultipleValue(currentValue) {
    const multiples = ["x1", "x10", "x100", "x1k", "x10k", "All"];
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
function getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, allRowCheck) {
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
  
    // Adjust quantityTextBox value based on the newMultipleValue and mainArrayElement
    const mainArrayValue = getCurrentMainArrayValue(mainArrayElement, armyColumnIndex, false);
    const newValue = currentValue + newMultipleValue;
  
    if (newValue <= mainArrayValue) {
      quantityTextBox.value = newValue.toString();
    } else {
      const difference = mainArrayValue - currentValue;
      quantityTextBox.value = (currentValue + difference).toString();
    }
  }
  
function updateTransferArray(mainArrayElement, quantityTextBoxes) {
    const mainArrayUniqueId = mainArrayElement;
    const clickedPathUniqueId = getLastClickedPathFn().getAttribute("uniqueid");
    const quantityValues = quantityTextBoxes.map((textBox) => textBox.value);

    transferQuantitiesArray = [mainArrayUniqueId, clickedPathUniqueId, ...quantityValues].map(value => parseInt(value));
}
  