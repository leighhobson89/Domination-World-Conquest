export function drawTransferAttackTable(table, validDestinationsArray, mainArray, playerOwnedTerritories, transferOrAttack) {
    table.innerHTML = "";

    playerOwnedTerritories.sort((a, b) => {
        const idA = parseInt(a.getAttribute("territory-id"));
        const idB = parseInt(b.getAttribute("territory-id"));
        return idA - idB;
    });

    if (transferOrAttack === 0) { //transfer
        // Create rows
        for (let i = 0; i < playerOwnedTerritories.length; i++) {
            const territoryTransferRow = document.createElement("div");
            territoryTransferRow.classList.add("transfer-table-row-hoverable");

            // Create columns
            for (let j = 0; j < 2; j++) {
                const territoryTransferColumn = document.createElement("div");
                territoryTransferColumn.classList.add("transfer-table-outer-column");
                if (j === 0) {
                    territoryTransferColumn.style.width = "50%";
                    // Set the value of the first column to the "territory-name" attribute
                    const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                    territoryTransferColumn.textContent = territoryName;
                } else {  
                    territoryTransferColumn.style.width = "50%";
                    const stuff = "stuff";
                    territoryTransferColumn.textContent = stuff;
                }   
                territoryTransferRow.appendChild(territoryTransferColumn);
            }    
            table.appendChild(territoryTransferRow);
        }
    } else if (transferOrAttack === 1) { //attack

    }
}


export function drawUITable(uiTableContainer, summaryTerritoryArmyTable) {
    uiTableContainer.innerHTML = "";
    uiTableContainer.style.display = "flex";
    
    playerOwnedTerritories.sort((a, b) => {
        const idA = parseInt(a.getAttribute("territory-id"));
        const idB = parseInt(b.getAttribute("territory-id"));
        return idA - idB;
    });
    
    // Create table element
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.tableLayout = "fixed";

    let countryGainsImageSources;
    let countryGainsHeaderColumns;
    let countryGainsHeaderRow;
    
    if (summaryTerritoryArmyTable === 0) {
        countryGainsHeaderRow = document.createElement("div");
        countryGainsHeaderRow.classList.add("ui-table-row");
        countryGainsHeaderRow.style.fontWeight = "bold";
    }

    countryGainsHeaderColumns = ["Territory", "Population(+/-)", "Gold(+/-)", "Oil(+/-)", "Oil Capacity", "Oil Demand", "Food(+/-)", "Food Capacity", "Food Consumption", "Construction Materials(+/-)", "Construction Materials Capacity", "Army Power", "Infantry", "Assault(useable)", "Air(useable)", "Naval(useable)"];
    countryGainsImageSources = ["flagUIIcon.png", "population.png", "gold.png", "oil.png", "oilCap.png", "oilDemand.png", "food.png", "foodCap.png", "foodConsumption.png", "consMats.png", "consMatsCap.png", "army.png", "infantry.png", "assault.png", "air.png", "naval.png"];

    for (let j = 0; j < countryGainsHeaderColumns.length; j++) {
        const countryGainsHeaderColumn = document.createElement("div");

        if (j === 0) {
            if (summaryTerritoryArmyTable === 0 ) {
                countryGainsHeaderColumn.style.width = "55%";
            } else {
                countryGainsHeaderColumn.style.width = "30%";
            }
        } else {
            countryGainsHeaderColumn.classList.add("centerIcons");
        }

        countryGainsHeaderColumn.classList.add("ui-table-column");

        countryGainsHeaderColumn.addEventListener("mouseover", (e) => {
            const x = e.clientX;
            const y = e.clientY;
        
            tooltip.style.left = x - 60 + "px";
            tooltip.style.top = 25 + y + "px";
        
            tooltip.innerHTML = countryGainsHeaderColumns[j];
            tooltip.style.display = "block";
        
            document.body.appendChild(tooltip);
        });

        countryGainsHeaderColumn.addEventListener("mouseout", (e) => {
            tooltip.innerHTML = "";
            tooltip.style.display = "none";
        });

        // Create an <img> tag with the image source
        const imageSource = "/resources/" + countryGainsImageSources[j];
        const imageElement = document.createElement("img");
        imageElement.src = imageSource;
        imageElement.alt = countryGainsHeaderColumns[j];
        imageElement.classList.add("sizingIcons");

        countryGainsHeaderColumn.appendChild(imageElement);
        if (summaryTerritoryArmyTable === 0 && j === 0) {
            countryGainsHeaderColumn.innerHTML = "Gains Last Turn > This Turn:";
        }
        if (summaryTerritoryArmyTable === 0) {
            countryGainsHeaderRow.appendChild(countryGainsHeaderColumn);
        }
    }

    if (summaryTerritoryArmyTable === 0) {
        table.appendChild(countryGainsHeaderRow);

        // Create a single row under the first header row
        const countryGainsRow = document.createElement("div");
        countryGainsRow.classList.add("ui-table-row");

        // Create columns
        for (let j = 0; j < countryGainsHeaderColumns.length; j++) {
            const countryGainscolumn = document.createElement("div");
            countryGainscolumn.classList.add("ui-table-column");

            if (j === 0) {
                countryGainscolumn.style.width = "55%";
                // Set the value of the first column to a custom value
                countryGainscolumn.textContent = playerCountry;
            } else {
                countryGainscolumn.classList.add("centerIcons");
                let displayText;
                switch (j) {
                case 1:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changePop);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changePop);
                    break;
                case 2:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeGold);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeGold);
                    break;
                case 3:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeOil);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeOil);
                    break;
                case 4:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeOilCapacity);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeOilCapacity);
                    break;
                case 5:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeOilDemand);
                    setGainsRowTextColor(countryGainscolumn, -turnGainsArrayLastTurn.changeOilDemand); // Reverse sign
                    break;
                case 6:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeFood);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeFood);
                    break;
                case 7:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeFoodCapacity);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeFoodCapacity);
                    break;
                case 8:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeFoodConsumption);
                    setGainsRowTextColor(countryGainscolumn, -turnGainsArrayLastTurn.changeFoodConsumption); // Reverse sign
                    break;
                case 9:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeConsMats);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeConsMats);
                    break;
                case 10:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeConsMatsCapacity);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeConsMatsCapacity);
                    break;
                case 11:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeArmy);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeArmy);
                    break;
                case 12:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeInfantry);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeInfantry);
                    break;
                case 13:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeAssault);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeAssault);
                    break;
                case 14:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeAir);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeAir);
                    break;
                case 15:
                    countryGainscolumn.textContent = formatNumbersToKMB(turnGainsArrayLastTurn.changeNaval);
                    setGainsRowTextColor(countryGainscolumn, turnGainsArrayLastTurn.changeNaval);
                    break;
                }
            }

            countryGainsRow.appendChild(countryGainscolumn);
        }

        table.appendChild(countryGainsRow);

        //create empty row
        const emptyRow = document.createElement("div");
        emptyRow.classList.add("ui-empty-row");
        emptyRow.style.height = "20px"; // Adjust the height as needed
        table.appendChild(emptyRow);
    }

    let countrySummaryImageSources;
    let countrySummaryHeaderColumns;
    const countrySummaryHeaderRow = document.createElement("div");
    countrySummaryHeaderRow.classList.add("ui-table-row");
    countrySummaryHeaderRow.style.fontWeight = "bold";

    if (summaryTerritoryArmyTable === 0) {
        countrySummaryHeaderColumns = ["Territory", "Population(+/-)", "Gold(+/-)", "Oil(+/-)", "Oil Capacity", "Oil Demand", "Food(+/-)", "Food Capacity", "Food Consumption", "Construction Materials(+/-)", "Construction Materials Capacity", "Army Power", "Infantry", "Assault(useable)", "Air(useable)", "Naval(useable)"];
        countrySummaryImageSources = ["flagUIIcon.png", "population.png", "gold.png", "oil.png", "oilCap.png", "oilDemand.png", "food.png", "foodCap.png", "foodConsumption.png", "consMats.png", "consMatsCap.png", "army.png", "infantry.png", "assault.png", "air.png", "naval.png"];
    } else if (summaryTerritoryArmyTable === 1) {
        countrySummaryHeaderColumns = ["Territory", "Productive Population", "Population", "Area", "Gold", "Oil", "Food", "Construction Materials", "Upgrade"];
        countrySummaryImageSources = ["flagUIIcon.png", "prodPopulation.png", "Population.png", "landArea.png", "gold.png", "oil.png", "food.png", "consMats.png", "upgrade.png"];
    } else if (summaryTerritoryArmyTable === 2) {
        countrySummaryHeaderColumns = ["Territory", "Army", "Infantry", "Assault", "Air", "Naval", "Gold", "Oil", "Buy"];
        countrySummaryImageSources = ["flagUIIcon.png", "army.png", "infantry.png", "assault.png", "air.png", "naval.png", "gold.png", "oil.png", "buy.png"];
    }

    for (let j = 0; j < countrySummaryHeaderColumns.length; j++) {
        const countrySummaryHeaderColumn = document.createElement("div");

        if (j === 0) {
            if (summaryTerritoryArmyTable === 0 ) {
                countrySummaryHeaderColumn.style.width = "55%";
            } else {
                countrySummaryHeaderColumn.style.width = "30%";
            }
        } else {
            countrySummaryHeaderColumn.classList.add("centerIcons");
        }

        countrySummaryHeaderColumn.classList.add("ui-table-column");

        countrySummaryHeaderColumn.addEventListener("mouseover", (e) => {
            const x = e.clientX;
            const y = e.clientY;
        
            tooltip.style.left = x - 60 + "px";
            tooltip.style.top = 25 + y + "px";
        
            tooltip.innerHTML = countrySummaryHeaderColumns[j];
            tooltip.style.display = "block";
        
            // Add the tooltip to the document body
            document.body.appendChild(tooltip);
        });

        countrySummaryHeaderColumn.addEventListener("mouseout", (e) => {
            tooltip.innerHTML = "";
            tooltip.style.display = "none";
        });

        // Create an <img> tag with the image source
        const imageSource = "/resources/" + countrySummaryImageSources[j];
        const imageElement = document.createElement("img");
        imageElement.src = imageSource;
        imageElement.alt = countrySummaryHeaderColumns[j];
        imageElement.classList.add("sizingIcons");

        countrySummaryHeaderColumn.appendChild(imageElement);
        if (summaryTerritoryArmyTable === 0 && j === 0) {
            countrySummaryHeaderColumn.innerHTML = "Country Summary:";
        }
        countrySummaryHeaderRow.appendChild(countrySummaryHeaderColumn);
    }

    table.appendChild(countrySummaryHeaderRow);

    if (summaryTerritoryArmyTable === 0) {
        // Create a single row under the first header row
        const countrySummaryRow = document.createElement("div");
        countrySummaryRow.classList.add("ui-table-row");

        // Create columns
        for (let j = 0; j < countrySummaryHeaderColumns.length; j++) {
            const countrySummarycolumn = document.createElement("div");
            countrySummarycolumn.classList.add("ui-table-column");

            if (j === 0) {
                countrySummarycolumn.style.width = "55%";
                // Set the value of the first column to a custom value
                countrySummarycolumn.textContent = playerCountry;
            } else {
                countrySummarycolumn.classList.add("centerIcons");
                let displayText;
                switch (j) {
                    case 1:
                        countrySummarycolumn.textContent = formatNumbersToKMB(totalPlayerResources[0].totalPop);
                        break;
                    case 2:
                        countrySummarycolumn.textContent = formatNumbersToKMB(totalPlayerResources[0].totalGold);
                        break;
                    case 3:
                        countrySummarycolumn.textContent = formatNumbersToKMB(totalPlayerResources[0].totalOil);
                        break;
                    case 4:
                        countrySummarycolumn.textContent = formatNumbersToKMB(capacityArray.totalOilCapacity);
                        break;
                    case 5:
                        countrySummarycolumn.textContent = formatNumbersToKMB(demandArray.totalOilDemand);
                        break;
                    case 6:
                        countrySummarycolumn.textContent = formatNumbersToKMB(totalPlayerResources[0].totalFood);
                        break;
                    case 7:
                        countrySummarycolumn.textContent = formatNumbersToKMB(capacityArray.totalFoodCapacity);
                        break;
                    case 8:
                        countrySummarycolumn.textContent = formatNumbersToKMB(demandArray.totalFoodConsumption);
                        break;
                    case 9:
                        countrySummarycolumn.textContent = formatNumbersToKMB(totalPlayerResources[0].totalConsMats);
                        break;
                    case 10:
                        countrySummarycolumn.textContent = formatNumbersToKMB(capacityArray.totalConsMatsCapacity);
                        break;
                    case 11:
                        countrySummarycolumn.textContent = formatNumbersToKMB(totalPlayerResources[0].totalArmy);
                        break;
                    case 12:
                        countrySummarycolumn.textContent = formatNumbersToKMB(totalPlayerResources[0].totalInfantry);
                        break;
                    case 13:
                        const useableAssault = formatNumbersToKMB(totalPlayerResources[0].totalUseableAssault);
                        const assault = formatNumbersToKMB(totalPlayerResources[0].totalAssault);
                        displayText = (totalPlayerResources[0].totalUseableAssault < totalPlayerResources[0].totalAssault) ? `<span style="font-weight: bold; color:rgb(220, 120, 120)">${useableAssault}</span>` : useableAssault;
                        displayText += `/${assault}`;
                        countrySummarycolumn.innerHTML = displayText;
                        break;
                    case 14:
                        const useableAir = formatNumbersToKMB(totalPlayerResources[0].totalUseableAir);
                        const air = formatNumbersToKMB(totalPlayerResources[0].totalAir);
                        displayText = (totalPlayerResources[0].totalUseableAir < totalPlayerResources[0].totalAir) ? `<span style="font-weight: bold; color:rgb(220, 120, 120)">${useableAir}</span>` : useableAir;
                        displayText += `/${air}`;
                        countrySummarycolumn.innerHTML = displayText;
                        break;
                    case 15:
                        const useableNaval = formatNumbersToKMB(totalPlayerResources[0].totalUseableNaval);
                        const naval = formatNumbersToKMB(totalPlayerResources[0].totalNaval);
                        displayText = (totalPlayerResources[0].totalUseableNaval < totalPlayerResources[0].totalNaval) ? `<span style="font-weight: bold; color:rgb(220, 120, 120)">${useableNaval}</span>` : useableNaval;
                        displayText += `/${naval}`;
                        countrySummarycolumn.innerHTML = displayText;
                        break;
                }
            }

            countrySummaryRow.appendChild(countrySummarycolumn);
        }

        table.appendChild(countrySummaryRow);
        // Create an empty row
        const secondEmptyRow = document.createElement("div");
        secondEmptyRow.classList.add("ui-empty-row");
        secondEmptyRow.style.height = "20px"; // Adjust the height as needed
        table.appendChild(secondEmptyRow);
    
        // Add the second header row
        const territorySummaryHeaderRow = document.createElement("div");
        territorySummaryHeaderRow.classList.add("ui-table-row");
        territorySummaryHeaderRow.style.fontWeight = "bold";
    
        const territorySummaryHeaderColumns = ["Territory", "Population(+/-)", "Gold(+/-)", "Oil(+/-)", "Oil Capacity", "Oil Demand", "Food(+/-)", "Food Capacity", "Food Consumption", "Construction Materials(+/-)", "Construction Materials Capacity", "Army Power", "Infantry", "Assault(useable)", "Air(useable)", "Naval(useable)"];
        const territorySummaryImageSources = ["flagUIIcon.png", "population.png", "gold.png", "oil.png", "oilCap.png", "oilDemand.png", "food.png", "foodCap.png", "foodConsumption.png", "consMats.png", "consMatsCap.png", "army.png", "infantry.png", "assault.png", "air.png", "naval.png"];
    
        for (let j = 0; j < territorySummaryHeaderColumns.length; j++) {
            const territorySummaryHeaderColumn = document.createElement("div");
            territorySummaryHeaderColumn.classList.add("ui-table-column");

            territorySummaryHeaderColumn.addEventListener("mouseover", (e) => {
                const x = e.clientX;
                const y = e.clientY;
            
                tooltip.style.left = x - 60 + "px";
                tooltip.style.top = 25 + y + "px";
            
                tooltip.innerHTML = territorySummaryHeaderColumns[j];
                tooltip.style.display = "block";
            
                // Add the tooltip to the document body
                document.body.appendChild(tooltip);
              });
        
              territorySummaryHeaderColumn.addEventListener("mouseout", (e) => {
                tooltip.innerHTML = "";
                tooltip.style.display = "none";
              });
    
            if (j === 0) {
                territorySummaryHeaderColumn.style.width = "55%";
            } else {
                territorySummaryHeaderColumn.classList.add("centerIcons");
    
                // Create an <img> tag with the custom image source
                const territorySummaryImageSource = "/resources/" + territorySummaryImageSources[j];
                const territorySummaryImageElement = document.createElement("img");
                territorySummaryImageElement.src = territorySummaryImageSource;
                territorySummaryImageElement.alt = territorySummaryHeaderColumns[j];
                territorySummaryImageElement.classList.add("sizingIcons");
                territorySummaryHeaderColumn.appendChild(territorySummaryImageElement);
            }

            if (summaryTerritoryArmyTable === 0 && j === 0) {
                territorySummaryHeaderColumn.innerHTML = "Territories Summary:";
            }
    
            territorySummaryHeaderRow.appendChild(territorySummaryHeaderColumn);
        }
    
        table.appendChild(territorySummaryHeaderRow);
    }

    // Create rows
    for (let i = 0; i < playerOwnedTerritories.length; i++) {
        const territorySummaryRow = document.createElement("div");
        territorySummaryRow.classList.add("ui-table-row-hoverable");
        if (summaryTerritoryArmyTable === 0) {
    // Create columns
    for (let j = 0; j < 16; j++) {
        const territorySummaryColumn = document.createElement("div");
        territorySummaryColumn.classList.add("ui-table-column");
        if (j === 0) {
            territorySummaryColumn.style.width = "55%";
            // Set the value of the first column to the "territory-name" attribute
            const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
            territorySummaryColumn.textContent = territoryName;
        } else {  
            let displayText;          
            territorySummaryColumn.classList.add("centerIcons");
            const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
            const territoryData = mainArrayOfTerritoriesAndResources.find(t => t.uniqueId === uniqueId);
            switch (j) {
                case 1:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.territoryPopulation);
                    break;
                case 2:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.goldForCurrentTerritory);
                    break;
                case 3:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.oilForCurrentTerritory);
                    break;
                case 4:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.oilCapacity);
                    break;
                case 5:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.oilDemand);
                    break;
                case 6:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.foodForCurrentTerritory);
                    break;
                case 7:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.foodCapacity);
                    break;
                case 8:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.foodConsumption);
                    break;
                case 9:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.consMatsForCurrentTerritory);
                    break;
                case 10:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.consMatsCapacity);
                    break;
                case 11:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.armyForCurrentTerritory);
                    break;
                case 12:
                    territorySummaryColumn.textContent = formatNumbersToKMB(territoryData.infantryForCurrentTerritory);
                    break;
                case 13:
                    const useableAssault = formatNumbersToKMB(territoryData.useableAssault);
                    const assaultForCurrentTerritory = formatNumbersToKMB(territoryData.assaultForCurrentTerritory);
                    displayText = (territoryData.useableAssault < territoryData.assaultForCurrentTerritory) ? `<span style="font-weight: bold; color:rgb(220, 120, 120)">${useableAssault}</span>` : useableAssault;
                    displayText += `/${assaultForCurrentTerritory}`;
                    territorySummaryColumn.innerHTML = displayText;
                    break;
                case 14:
                    const useableAir = formatNumbersToKMB(territoryData.useableAir);
                    const airForCurrentTerritory = formatNumbersToKMB(territoryData.airForCurrentTerritory);
                    displayText = (territoryData.useableAir < territoryData.airForCurrentTerritory) ? `<span style="font-weight: bold; color:rgb(220, 120, 120)">${useableAir}</span>` : useableAir;
                    displayText += `/${airForCurrentTerritory}`;
                    territorySummaryColumn.innerHTML = displayText;
                    break;
                case 15:
                    const useableNaval = formatNumbersToKMB(territoryData.useableNaval);
                    const navalForCurrentTerritory = formatNumbersToKMB(territoryData.navalForCurrentTerritory);
                    displayText = (territoryData.useableNaval < territoryData.navalForCurrentTerritory) ? `<span style="font-weight: bold; color:rgb(220, 120, 120)">${useableNaval}</span>` : useableNaval;
                    displayText += `/${navalForCurrentTerritory}`;
                    territorySummaryColumn.innerHTML = displayText;
                    break;
            }
        }
        territorySummaryRow.appendChild(territorySummaryColumn);
    }
        } else if (summaryTerritoryArmyTable === 1) { //setup territory table
            // Create columns
            for (let j = 0; j < 9; j++) {
                const column = document.createElement("div");
                column.classList.add("ui-table-column");
                if (j === 0) {
                    column.style.width = "30%";
                    // Set the value of the first column to the "territory-name" attribute
                    const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                    column.textContent = territoryName;
                } else {
                    column.classList.add("centerIcons");
                    const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                    const territoryData = mainArrayOfTerritoriesAndResources.find(t => t.uniqueId === uniqueId);
                    switch (j) {
                    case 1:
                        column.textContent = formatNumbersToKMB(territoryData.productiveTerritoryPop);
                        break;
                    case 2:
                        column.textContent = formatNumbersToKMB(territoryData.territoryPopulation);
                        break;
                    case 3:
                        column.textContent = formatNumbersToKMB(territoryData.area);
                        break;
                    case 4:
                        column.textContent = Math.ceil(territoryData.goldForCurrentTerritory);
                        break;
                    case 5:
                        column.textContent = Math.ceil(territoryData.oilForCurrentTerritory);
                        break;
                    case 6:
                        column.textContent = Math.ceil(territoryData.foodForCurrentTerritory);
                        break;
                    case 7:
                        column.textContent = Math.ceil(territoryData.consMatsForCurrentTerritory);
                        break;
                    case 8:
                        const upgradeButtonImageElement = document.createElement("img");
                        // Create upgrade button div
                        const upgradeButtonDiv = document.createElement("div");
                        if (currentTurnPhase === 0) {
                            upgradeButtonDiv.classList.add("upgrade-button");
                            upgradeButtonImageElement.src = "/resources/upgradeButtonIcon.png";
                        } else {
                            upgradeButtonImageElement.src = "/resources/upgradeButtonGreyedOut.png";
                        }
                
                        // Create upgrade button image element
                        upgradeButtonImageElement.alt = "Upgrade Territory";
                        upgradeButtonImageElement.classList.add("sizeUpgradeButton");
            
                        // Add event listeners for click and mouseup events
                        upgradeButtonDiv.addEventListener("mousedown", () => {
                        if (currentTurnPhase === 0) {
                            playSoundClip();
                            upgradeButtonImageElement.src = "/resources/upgradeButtonIconPressed.png";
                        }
                        });
            
                        upgradeButtonDiv.addEventListener("mouseup", () => {
                        if (currentTurnPhase === 0) {
                            populateUpgradeTable(territoryData);
                            toggleUpgradeMenu(true, territoryData);
                            currentlySelectedTerritoryForUpgrades = territoryData;
                            upgradeButtonImageElement.src = "/resources/upgradeButtonIcon.png";
                            setUpgradeOrBuyWindowOnScreenToTrue(1);
                        }
                        });
            
                        upgradeButtonDiv.appendChild(upgradeButtonImageElement);
                        column.appendChild(upgradeButtonDiv);
                        break;
                }
            }
            territorySummaryRow.addEventListener("mouseover", (e) => {
                const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                const territoryData = mainArrayOfTerritoriesAndResources.find((t) => t.uniqueId === uniqueId);
        
                tooltipUITerritoryRow(territorySummaryRow, territoryData, e);
            });
            territorySummaryRow.addEventListener("mouseout", () => {
                tooltip.style.display = "none";
                territorySummaryRow.style.cursor = "default";
                });
            territorySummaryRow.appendChild(column);
            }
        } else if (summaryTerritoryArmyTable === 2) { //setup army table
            // Create columns
            for (let j = 0; j < 9; j++) {
                const column = document.createElement("div");
                column.classList.add("ui-table-column");
                if (j === 0) {
                    column.style.width = "30%";
                    // Set the value of the first column to the "territory-name" attribute
                    const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                    column.textContent = territoryName;
                } else {
                    column.classList.add("centerIcons");
                    const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                    const territoryData = mainArrayOfTerritoriesAndResources.find(t => t.uniqueId === uniqueId);
                    switch (j) {
                    case 1:
                        column.textContent = formatNumbersToKMB(territoryData.armyForCurrentTerritory);
                        break;
                    case 2:
                        column.textContent = formatNumbersToKMB(territoryData.infantryForCurrentTerritory);
                        break;
                    case 3:
                        column.textContent = formatNumbersToKMB(territoryData.assaultForCurrentTerritory);
                        break;
                    case 4:
                        column.textContent = Math.ceil(territoryData.airForCurrentTerritory);
                        break;
                    case 5:
                        column.textContent = Math.ceil(territoryData.navalForCurrentTerritory);
                        break;
                    case 6:
                        column.textContent = Math.ceil(territoryData.goldForCurrentTerritory);
                        break;
                    case 7:
                        column.textContent = Math.ceil(territoryData.oilForCurrentTerritory);
                        break;
                    case 8:
                    const buyButtonImageElement = document.createElement("img");
                    // Create buy button div
                    const buyButtonDiv = document.createElement("div");
                    if (currentTurnPhase === 0) {
                        buyButtonDiv.classList.add("buy-button");
                        buyButtonImageElement.src = "/resources/buyButtonIcon.png";
                    } else {
                        buyButtonImageElement.src = "/resources/buyButtonGreyedOut.png";
                    }
            
                    // Create upgrade button image element
                    buyButtonImageElement.alt = "Buy Military";
                    buyButtonImageElement.classList.add("sizeBuyButton");
        
                    // Add event listeners for click and mouseup events
                    buyButtonDiv.addEventListener("mousedown", () => {
                    if (currentTurnPhase === 0) {
                        playSoundClip();
                        buyButtonImageElement.src = "/resources/buyButtonIconPressed.png";
                    }
                    });
        
                    buyButtonDiv.addEventListener("mouseup", () => {
                    if (currentTurnPhase === 0) {
                        populateBuyTable(territoryData);
                        toggleBuyMenu(true, territoryData);
                        currentlySelectedTerritoryForPurchases = territoryData;
                        buyButtonImageElement.src = "/resources/buyButtonIcon.png";
                        setUpgradeOrBuyWindowOnScreenToTrue(2);
                    }
                    });
        
                    buyButtonDiv.appendChild(buyButtonImageElement);
                    column.appendChild(buyButtonDiv);
                    break;
                }
            }
            territorySummaryRow.addEventListener("mouseover", (e) => {
                const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                const territoryData = mainArrayOfTerritoriesAndResources.find((t) => t.uniqueId === uniqueId);
        
                tooltipUIArmyRow(territorySummaryRow, territoryData, e);
            });
            territorySummaryRow.addEventListener("mouseout", () => {
                tooltip.style.display = "none";
                territorySummaryRow.style.cursor = "default";
                });
            territorySummaryRow.appendChild(column);
            }
        }     
    table.appendChild(territorySummaryRow);
    }

    uiTableContainer.appendChild(table);
}