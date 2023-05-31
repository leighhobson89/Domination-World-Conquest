import { pageLoaded } from './ui.js';
import { currentTurn, currentTurnPhase, randomEvent, randomEventHappening } from './gameTurnsLoop.js';
import { dataTableCountriesInitialState } from './ui.js';
import { setFlag } from './ui.js';
import { currentSelectedPath } from './ui.js';
import { paths } from './ui.js';
import { playSoundClip } from './sfx.js';
import { toggleUpgradeMenu } from './ui.js';

export let allowSelectionOfCountry = false;
export let playerOwnedTerritories = [];
export let mainArrayOfTerritoriesAndResources = [];
export let currentlySelectedTerritoryForUpgrades;
export let totalGoldPrice = 0;
export let totalConsMats = 0;

let totalPlayerResources = [];
let continentModifier;
let tooltip = document.getElementById("tooltip");
let simulatedCostsAll = [0,0,0,0,0,0,0,0];

/* const turnLabel = document.getElementById('turn-label'); */
if (!pageLoaded) {
    Promise.all([calculatePathAreasWhenPageLoaded(), createArrayOfInitialData()])
        .then(([pathAreas, armyArray]) => {
            mainArrayOfTerritoriesAndResources = randomiseArmyAndResources(mainArrayOfTerritoriesAndResources);
        })
        .catch(error => {
            console.log(error);
        });
}

export function getPlayerTerritories() {
    playerOwnedTerritories.length = 0;

    for (const path of paths) {
        if (path.getAttribute("owner") === "Player") {
            playerOwnedTerritories.push(path);
        }
    }
}

export function populateBottomTableWhenSelectingACountry(countryPath) {
    // Update the table with the response data
    document.getElementById("bottom-table").rows[0].cells[0].style.whiteSpace = "pre";
    setFlag(countryPath.getAttribute("data-name"),2); //set flag for territory clicked on (bottom table)     
            
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === countryPath.getAttribute("uniqueid")) {
            writeBottomTableInformation(mainArrayOfTerritoriesAndResources[i], false, countryPath);
            break;
        }
    }
}

function calculatePathAreasWhenPageLoaded() {
    return new Promise((resolve, reject) => {
        let intervalId = setInterval(function() {
            if (pageLoaded === true) {

                let pathAreas = calculatePathAreas();
                allowSelectionOfCountry = true;

                clearInterval(intervalId);

                resolve(pathAreas);
            }
        }, 800);
    });
}

function calculatePathAreas() {
    let pathAreas = [];

    let totalAreaPath = 0;
    for (let i = 0; i < paths.length; i++) {
        let path = paths[i];
        let pathLength = path.getTotalLength();
        let numPoints = 80;
        let points = [];
        for (let j = 0; j < numPoints; j++) {
            let point = path.getPointAtLength(j / numPoints * pathLength);
            points.push({ x: point.x, y: point.y });
        }
        let area = 0;
        for (let j = 0; j < points.length; j++) {
            let k = (j + 1) % points.length;
            area += points[j].x * points[k].y - points[j].y * points[k].x;
        }
        area = Math.abs(area / 2);
        totalAreaPath += area;
        let uniqueId = path.getAttribute('uniqueid');
        let dataName = path.getAttribute('data-name');
        let territoryId = path.getAttribute('territory-id');
        pathAreas.push({ uniqueId: uniqueId, dataName: dataName, territoryId: territoryId, area: area });
    }
    
    let scalingFactor = 136067649 / totalAreaPath;
    
    for (let i = 0; i < pathAreas.length; i++) {
        pathAreas[i].area *= scalingFactor;
    }
    
    return pathAreas;
}

function assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState) {
    // Loop through each element in pathAreas array
    for (let i = 0; i < pathAreas.length; i++) {
        let uniqueId = pathAreas[i].uniqueId;
        let dataName = pathAreas[i].dataName;
        let territoryId = pathAreas[i].territoryId;
        let territoryName;
        let area = pathAreas[i].area;

        // Find matching country in armyArray
        let matchingCountry = dataTableCountriesInitialState.find(function(country) {
            return country.country === dataName;
        });

        if (matchingCountry) {
            let totalArmyForCountry = matchingCountry.startingArmy;
            let totalGoldForCountry = matchingCountry.res_gold;
            let totalOilForCountry = matchingCountry.res_oil;
            let totalFoodForCountry = matchingCountry.res_food;
            let totalConsMatsForCountry = matchingCountry.res_cons_mats;
            let startingPop = parseInt(matchingCountry.startingPop);
            let territoryPopulation;
            let productiveTerritoryPop;
            let continent = matchingCountry.continent;
            let dev_index = matchingCountry.dev_index;
            let percentOfWholeArea = 0;

            // Calculate percentOfWholeArea based on number of paths per dataName
            let numPaths = pathAreas.filter(function(path) {
                return path.dataName === dataName;
            }).length;

            if (numPaths === 1) {
                percentOfWholeArea = 1;
            } else {
                let pathsForDataName = pathAreas.filter(function(path) {
                    return path.dataName === dataName;
                });
                let areaSum = pathsForDataName.reduce(function(acc, path) {
                    return acc + path.area;
                }, 0);
                let areaForTerritoryId = pathsForDataName.find(function(path) {
                    return path.territoryId === territoryId;
                }).area;
                percentOfWholeArea = areaForTerritoryId / areaSum;
            }

            //for initial setup, modify later for per turn calculations
            if (continent === "Europe") {
                continentModifier = 15;
            } else if (continent === "North America") {
                continentModifier = 15;
            } else if (continent === "Asia") {
                continentModifier = 1;
            } else if (continent === "Oceania") {
                continentModifier = 1;
            } else if (continent === "South America") {
                continentModifier = 1.8;
            } else if (continent === "Africa") {
                continentModifier = 2;
            }

            for (const path of paths) {
                if (path.getAttribute("uniqueid") === uniqueId) {
                    territoryName = path.getAttribute("territory-name");
                }
            }

            // Calculate population of each territory based on the startingPop for the whole country it belongs to
            territoryPopulation = startingPop * percentOfWholeArea;
            productiveTerritoryPop = (((territoryPopulation / 100) * 45) * dev_index)

            // Calculate new army value for current element
            let armyForCurrentTerritory = totalArmyForCountry * percentOfWholeArea;
            let goldForCurrentTerritory = (totalGoldForCountry * ((area/8000000) * dev_index) + (percentOfWholeArea * (territoryPopulation/50000)) * continentModifier);
            let oilForCurrentTerritory = initialOilCalculation(matchingCountry, area);
            let oilCapacity = oilForCurrentTerritory;
            let foodForCurrentTerritory = territoryPopulation / 10000; //set food to balance with population at beginning
            let foodCapacity = territoryPopulation; //set food capacity as permanent value until territory upgraded
            let consMatsForCurrentTerritory = initialConsMatsCalculation(matchingCountry, area);
            let consMatsCapacity = consMatsForCurrentTerritory;
            let defenseBonus = 1;
            let farmsBuilt = 0;
            let oilWellsBuilt = 0;
            let forestsBuilt = 0;
            let fortsBuilt = 0;

            // Add updated path data to the new array
            mainArrayOfTerritoriesAndResources.push({
                uniqueId: uniqueId,
                dataName: dataName,
                territoryId: territoryId,
                territoryName: territoryName,
                territoryPopulation: territoryPopulation,
                productiveTerritoryPop: productiveTerritoryPop,
                area: area,
                continent: continent,
                armyForCurrentTerritory: armyForCurrentTerritory,
                goldForCurrentTerritory: goldForCurrentTerritory,
                oilForCurrentTerritory: oilForCurrentTerritory,
                oilCapacity: oilCapacity,
                foodForCurrentTerritory: foodForCurrentTerritory,
                foodCapacity: foodCapacity,
                consMatsForCurrentTerritory: consMatsForCurrentTerritory,
                consMatsCapacity: consMatsCapacity,
                devIndex: dev_index,
                continentModifier: continentModifier,
                farmsBuilt: farmsBuilt,
                oilWellsBuilt: oilWellsBuilt,
                forestsBuilt: forestsBuilt,
                fortsBuilt: fortsBuilt,
                defenseBonus: defenseBonus
            });
        }
    }
    return mainArrayOfTerritoriesAndResources;
}

function createArrayOfInitialData() {
    return calculatePathAreasWhenPageLoaded().then(pathAreas => {
        return new Promise((resolve, reject) => {
            mainArrayOfTerritoriesAndResources = assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState);
            resolve(mainArrayOfTerritoriesAndResources);
        });
    });
}

function randomiseArmyAndResources(armyResourceArray) {
    armyResourceArray.forEach((country) => {
        let randomGoldFactor = Math.floor(Math.random() * 20) + 2;
        let randomOilFactor = Math.floor(Math.random() * 80) + 2;
        let randomFoodFactor = Math.floor(Math.random() * 10) + 2;
        let randomConsMatsFactor = Math.floor(Math.random() * 70) + 2;
        let randomArmyFactor = Math.floor(Math.random() * 15) + 2;
        let randomAddSubtract = Math.random() < 0.5; //add or subtract

        if (randomAddSubtract) {
            country.armyForCurrentTerritory = country.armyForCurrentTerritory + (country.armyForCurrentTerritory * (randomArmyFactor/100));
            country.goldForCurrentTerritory = (country.goldForCurrentTerritory + (country.goldForCurrentTerritory * (randomGoldFactor/100))) / country.devIndex;
        } else {
            country.armyForCurrentTerritory = country.armyForCurrentTerritory - (country.armyForCurrentTerritory * (randomArmyFactor/100));
            country.goldForCurrentTerritory = country.goldForCurrentTerritory - (country.goldForCurrentTerritory * (randomGoldFactor/100));
        }
    });
    return armyResourceArray;
}

export function newTurnResources() {
    //calculate new array data and set it
    if (currentTurn !== 1) {
        calculateTerritoryResourceIncomesEachTurn();
    }

    AddUpAllTerritoryResourcesForCountryAndWriteToTopTable();
}
    
    //todo : return a popup to the user with a confirm button to remove it, stating what the player gained that turn

function calculateTerritoryResourceIncomesEachTurn() {
    let changeGold;
    let changeOil;
    let changeFood;
    let changeConsMats;
    let changePop;

    //continent modifier or possibly handle upgrades in future
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        //set each turn so that we can make exceptions ater due to upgrades when introduced that code but HC for now
        if (mainArrayOfTerritoriesAndResources[i].continent === "Europe") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 1;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "North America") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 1;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "Asia") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 0.7;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "Oceania") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 0.6;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "South America") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 0.6;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "Africa") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 0.5;
        } 
    }

    //loop to update all new values for new turn
    for (const path of paths) {
        for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
            if (path.getAttribute("owner") === "Player" && path.getAttribute("uniqueid") === mainArrayOfTerritoriesAndResources[i].uniqueId) {
            /*    changeGold = calculateGoldChange();
                changeOil = calculateOilChange();
                changeFood = calculateFoodChange();
                changeConsMats = calculateConsMatsChange();
                changePop = calculatePopulationChange(); */

                changeGold = 10;
                changeOil = calculateOilChange(mainArrayOfTerritoriesAndResources[i], false);
                changeFood = calculateFoodChange(mainArrayOfTerritoriesAndResources[i], false);
                changeConsMats = calculateConsMatsChange(mainArrayOfTerritoriesAndResources[i], false);
                changePop = calculatePopulationChange(mainArrayOfTerritoriesAndResources[i]);

                mainArrayOfTerritoriesAndResources[i].goldForCurrentTerritory += changeGold;
                mainArrayOfTerritoriesAndResources[i].oilForCurrentTerritory += changeOil;
                mainArrayOfTerritoriesAndResources[i].foodForCurrentTerritory += changeFood;
                mainArrayOfTerritoriesAndResources[i].consMatsForCurrentTerritory += changeConsMats;
                mainArrayOfTerritoriesAndResources[i].territoryPopulation += changePop;
                mainArrayOfTerritoriesAndResources[i].productiveTerritoryPop = (((mainArrayOfTerritoriesAndResources[i].territoryPopulation / 100) * 45) * mainArrayOfTerritoriesAndResources[i].devIndex);
            }
        }
    }
}

function calculateConsMatsChange(territory, isSimulation) {
    let consMatsChange = 0;

    if (randomEventHappening && randomEvent === "Forest Fire" && !isSimulation) { //ConsMats disaster
        const isRandomlyTrue = Math.random() >= 0.5;
        if (isRandomlyTrue) {
            let tempConsMats = territory.consMatsForCurrentTerritory;
            territory.consMatsForCurrentTerritory /= 1.5;
            console.log(territory.dataName + "'s " + territory.territoryName + "was hit and  lost half its construction materials!");
            console.log("It had " + tempConsMats + " but now it has " + territory.consMatsForCurrentTerritory);
        } else {
            console.log(territory.dataName + "'s " + territory.territoryName + "escaped harm!");
        }
    }

    //if consMats is below consMats capacity then grow at 10% per turn
    if (!randomEventHappening && territory.consMatslCapacity > (territory.consMatsForCurrentTerritory)) {
        const consMatsDifference = territory.consMatsCapacity - (territory.consMatsForCurrentTerritory);
        consMatsChange = (Math.ceil(consMatsDifference * 0.1));
        }

        //if consMats is above consMats capacity then lose it at 10% per turn until it balances
        if (!randomEventHappening && territory.consMatsCapacity < (territory.consMatsForCurrentTerritory)) {
        const consMatsDifference = (territory.consMatsForCurrentTerritory) - territory.consMatsCapacity;
        consMatsChange = -(Math.ceil(consMatsDifference * 0.1));
    }

    /* if (territory.forests > 0) { //implement when do upgrading code
    } */

    return consMatsChange;
}

function calculateOilChange(territory, isSimulation) {
    let oilChange = 0;

    if (randomEventHappening && randomEvent === "Oil Well Fire" && !isSimulation) { //oil disaster
        const isRandomlyTrue = Math.random() >= 0.5;
        if (isRandomlyTrue) {
            let tempOil = territory.oilForCurrentTerritory;
            territory.oilForCurrentTerritory /= 1.5;
            console.log(territory.dataName + "'s " + territory.territoryName + "was hit and  lost half its oil!");
            console.log("It had " + tempOil + " but now it has " + territory.oilForCurrentTerritory);
        } else {
            console.log(territory.dataName + "'s " + territory.territoryName + "escaped harm!");
        }
    }

    //if oil is below oil capacity then grow at 10% per turn
    if (!randomEventHappening && territory.oilCapacity > (territory.oilForCurrentTerritory)) {
        const oilDifference = territory.oilCapacity - (territory.oilForCurrentTerritory);
        oilChange = (Math.ceil(oilDifference * 0.1));
        }

        //if oil is above oil capacity then lose it at 10% per turn until it balances
        if (!randomEventHappening && territory.oilCapacity < (territory.oilForCurrentTerritory)) {
        const oilDifference = (territory.oilForCurrentTerritory) - territory.oilCapacity;
        oilChange = -(Math.ceil(oilDifference * 0.1));
    }

    /* if (territory.oilWells > 0) { //implement when do upgrading code
    } */

    return oilChange;
}

function calculateFoodChange(territory, isSimulation) { 
    let foodChange = 0;

    if (randomEventHappening && randomEvent === "Food Disaster" && !isSimulation) { //food disaster
        const isRandomlyTrue = Math.random() >= 0.5;
        if (isRandomlyTrue) {
            let tempFood = territory.foodForCurrentTerritory;
            territory.foodForCurrentTerritory /= 2;
            console.log(territory.dataName + "'s " + territory.territoryName + "was hit and  lost half its food!");
            console.log("It had " + tempFood + " but now it has " + territory.foodForCurrentTerritory);
        } else {
            console.log(territory.dataName + "'s " + territory.territoryName + "escaped harm!");
        }
    }

    //if food is below food capacity then grow at 10% per turn
    if (!randomEventHappening && territory.foodCapacity > (territory.foodForCurrentTerritory * 10000)) {
        const foodDifference = territory.foodCapacity - (territory.foodForCurrentTerritory * 10000);
        foodChange = (Math.ceil(foodDifference * 0.1) / 10000);
        }

        //if food is above food capacity then lose it at 10% per turn until it balances
        if (!randomEventHappening && territory.foodCapacity < (territory.foodForCurrentTerritory * 10000)) {
        const foodDifference = (territory.foodForCurrentTerritory * 10000) - territory.foodCapacity;
        foodChange = -(Math.ceil(foodDifference * 0.1) / 10000);
    }
        
    
    /* if (territory.farms > 0) { //implement when do upgrading code
    } */
    
    return foodChange;
}     

function calculatePopulationChange(territory) {
    if (!randomEventHappening) {
        const currentPopulation = territory.territoryPopulation;
        const devIndex = territory.devIndex;
        const foodForCurrentTerritory = territory.foodForCurrentTerritory;

        let populationChange = 0;

        if (foodForCurrentTerritory * 10000 < currentPopulation) {
        // Starvation situation
        const foodShortage = Math.ceil((currentPopulation - foodForCurrentTerritory * 10000) / 1000);
        const deathRate = Math.round(100 * (1 - devIndex) * 3); // Number of people who die based on devIndex

        populationChange = -Math.min(foodShortage * deathRate, currentPopulation);
        } else {
        // Growth situation
        const maxGrowth = foodForCurrentTerritory * 10000 - currentPopulation;
        const growthPotential = Math.floor(devIndex * currentPopulation * 0.1);

        populationChange = Math.min(maxGrowth, growthPotential);
        }

        return populationChange;
    } else {
        return 0; //if random event just happened for food, dont lose any people immediately til the next turn so user can process it
    }
}
       
      

function formatNumbersToKMB(string) {
    if (string >= 1000000000) {
        return (string / 1000000000).toFixed(1) + 'B';
    } else if (string >= 1000000) {
        return (string / 1000000).toFixed(1) + 'M';
    } else if (string >= 1000) {
        return (string / 1000).toFixed(1) + 'k';
    } else {
        return string.toFixed(0);
    }
}

function AddUpAllTerritoryResourcesForCountryAndWriteToTopTable() {
    let totalGold = 0;
    let totalOil = 0;
    let totalFood = 0;
    let totalConsMats = 0;
    let totalPop = 0;
    let totalProdPop = 0;
    let totalArea = 0;
    let totalArmy = 0;

    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        for (const path of paths) {
            if (path.getAttribute("owner") === "Player" && path.getAttribute("uniqueid") === mainArrayOfTerritoriesAndResources[i].uniqueId) {
                totalGold += mainArrayOfTerritoriesAndResources[i].goldForCurrentTerritory;
                totalOil += mainArrayOfTerritoriesAndResources[i].oilForCurrentTerritory;
                totalFood += mainArrayOfTerritoriesAndResources[i].foodForCurrentTerritory;
                totalConsMats += mainArrayOfTerritoriesAndResources[i].consMatsForCurrentTerritory;
                totalPop += mainArrayOfTerritoriesAndResources[i].territoryPopulation;
                totalProdPop += mainArrayOfTerritoriesAndResources[i].productiveTerritoryPop;
                totalArea += mainArrayOfTerritoriesAndResources[i].area;
                totalArmy += mainArrayOfTerritoriesAndResources[i].armyForCurrentTerritory;
                if (path === currentSelectedPath && currentTurn !== 1) {
                    writeBottomTableInformation(mainArrayOfTerritoriesAndResources[i], true);
                }
            }
        }
    }

    totalPlayerResources.length = 0;

    totalPlayerResources.push({
        totalGold: totalGold,
        totalOil: totalOil,
        totalFood: totalFood,
        totalConsMats: totalConsMats,
        totalPop: totalPop,
        totalProdPop: totalProdPop,
        totalArea: totalArea,
        totalArmy: totalArmy});

    //write new data to top table
    document.getElementById("top-table").rows[0].cells[0].style.whiteSpace = "pre";
    document.getElementById("top-table").rows[0].cells[3].innerHTML = Math.ceil(totalPlayerResources[0].totalGold);
    document.getElementById("top-table").rows[0].cells[5].innerHTML = Math.ceil(totalPlayerResources[0].totalOil);
    document.getElementById("top-table").rows[0].cells[7].innerHTML = Math.ceil(totalPlayerResources[0].totalFood);
    document.getElementById("top-table").rows[0].cells[9].innerHTML = Math.ceil(totalPlayerResources[0].totalConsMats);
    document.getElementById("top-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalProdPop) + " (" + formatNumbersToKMB(totalPlayerResources[0].totalPop) + ")";
    document.getElementById("top-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalArea) + " (km²)";
    document.getElementById("top-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalArmy);
}

function writeBottomTableInformation(territory, userClickingANewTerritory, countryPath) {
    if (userClickingANewTerritory) {
            colourTableText(document.getElementById("bottom-table"), territory);
            document.getElementById("bottom-table").rows[0].cells[0].style.whiteSpace = "pre";
            document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(territory.goldForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[5].innerHTML = Math.ceil(territory.oilForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[7].innerHTML = Math.ceil(territory.foodForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(territory.consMatsForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(territory.productiveTerritoryPop) + " (" + formatNumbersToKMB(territory.territoryPopulation) + ")";
            document.getElementById("bottom-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(territory.area) + " (km²)";
            document.getElementById("bottom-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(territory.armyForCurrentTerritory);
        } else { //turn update resources for selected territory
        colourTableText(document.getElementById("bottom-table"), territory);
        document.getElementById("bottom-table").rows[0].cells[1].innerHTML = countryPath.getAttribute("territory-name") + " (" + territory.continent + ")";
        document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(territory.goldForCurrentTerritory);
        document.getElementById("bottom-table").rows[0].cells[5].innerHTML = Math.ceil(territory.oilForCurrentTerritory);
        document.getElementById("bottom-table").rows[0].cells[7].innerHTML = Math.ceil(territory.foodForCurrentTerritory);
        document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(territory.consMatsForCurrentTerritory);
        document.getElementById("bottom-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(territory.productiveTerritoryPop) + " (" + formatNumbersToKMB(territory.territoryPopulation) + ")";
        document.getElementById("bottom-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(territory.area) + " (km²)";
        document.getElementById("bottom-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(territory.armyForCurrentTerritory);
    }
}

function initialOilCalculation(path, area) {
    let developmentIndex = parseFloat(path.dev_index);
    let continentModifier;

    if (path.continent === "Europe") {
        continentModifier = 0.9;
    } else if (path.continent === "North America") {
        continentModifier = 1.3;
    } else if (path.continent === "Africa") {
        continentModifier = 1.8;
    } else if (path.continent === "South America") {
        continentModifier = 1.6;
    } else if (path.continent === "Oceania") {
        continentModifier = 0.8;
    } else if (path.continent === "Asia") {
        continentModifier = 1.1;
    }

    const term1 = (Math.abs(Math.pow(area / 1000, 1.5) * developmentIndex * (continentModifier - 1) * 0.1));
    const term2 = (Math.pow(area / 1000, 0.5) * developmentIndex * 50);
    const term3 = (Math.pow(area / 1000, 0.5) * continentModifier * 10);
    return term1 + term2 + term3;
}

function initialConsMatsCalculation(path, area) {
    let developmentIndex = parseFloat(path.dev_index);
    let continentModifier;

    if (path.continent === "Europe") {
        continentModifier = 1.2;
    } else if (path.continent === "North America") {
        continentModifier = 1.6;
    } else if (path.continent === "Africa") {
        continentModifier = 1.3;
    } else if (path.continent === "South America") {
        continentModifier = 1.8;
    } else if (path.continent === "Oceania") {
        continentModifier = 0.8;
    } else if (path.continent === "Asia") {
        continentModifier = 1.8;
    }

    const term1 = (Math.abs(Math.pow(area / 1000, 1.5) * developmentIndex * (continentModifier - 1) * 0.1));
    const term2 = (Math.pow(area / 1000, 0.5) * developmentIndex * 50);
    const term3 = (Math.pow(area / 1000, 0.5) * continentModifier * 10);
    return term1 + term2 + term3;
}

export function drawUITable(uiTableContainer, territoryOrArmyTable) {
    let imageSources;
    let headerColumns;
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

    const headerRow = document.createElement("div");
    headerRow.classList.add("ui-table-row");

    if (territoryOrArmyTable === 1) { // Create first row territory button
        headerColumns = ["Territory", "Army", "Population", "Area", "Gold", "Oil", "Food", "Construction Materials", "Upgrade"];
        imageSources = ["flagUIIcon.png", "army.png", "population.png", "landArea.png", "gold.png", "oil.png", "food.png", "consMats.png", "upgrade.png"];
    } else if (territoryOrArmyTable === 2) {
        headerColumns = ["Territory", "ProductivePopulation", "Infantry", "Assault", "Air", "Naval", "Gold", "Oil", "Buy"];
        imageSources = ["flagUIIcon.png", "prodPopulation.png", "infantry.png", "assault.png", "air.png", "naval.png", "gold.png", "oil.png", "buy.png"];
    }

    for (let j = 0; j < headerColumns.length; j++) {
    const headerColumn = document.createElement("div");

    if (j === 0) {
        headerColumn.style.width = "30%";
    } else {
        headerColumn.classList.add("centerIcons");
    }

    headerColumn.classList.add("ui-table-column");

    // Create an <img> tag with the image source
    const imageSource = "/resources/" + imageSources[j];
    const imageElement = document.createElement("img");
    imageElement.src = imageSource;
    imageElement.alt = headerColumns[j];
    imageElement.classList.add("sizingIcons");

    headerColumn.appendChild(imageElement);
    headerRow.appendChild(headerColumn);
    }

    table.appendChild(headerRow);
    
    // Create rows
    for (let i = 0; i < playerOwnedTerritories.length; i++) {
        const row = document.createElement("div");
        row.classList.add("ui-table-row-hoverable");

        if (territoryOrArmyTable === 1) { //setup territory table
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
                    }
                    });
        
                    upgradeButtonDiv.appendChild(upgradeButtonImageElement);
                    column.appendChild(upgradeButtonDiv);
                    break;
                }
            }
            row.addEventListener("mouseover", (e) => {
                const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                const territoryData = mainArrayOfTerritoriesAndResources.find((t) => t.uniqueId === uniqueId);
        
                tooltipUITerritoryRow(row, territoryData, e);
            });
            row.addEventListener("mouseout", () => {
                tooltip.style.display = "none";
                row.style.cursor = "default";
                });
            row.appendChild(column);
            }
        } else if (territoryOrArmyTable === 2) { //setup army table

        }
    
        
    table.appendChild(row);

        
    }
    uiTableContainer.appendChild(table);
}

function tooltipUITerritoryRow(row, territoryData, event) {
    // Get the coordinates of the mouse cursor
    const x = event.clientX;
    const y = event.clientY;

    // Set the content of the tooltip based on the territory data
    const territoryName = row.querySelector(".ui-table-column").textContent;
    const army = row.querySelector(".ui-table-column:nth-child(2)").textContent;
    const prodPopulation = territoryData.productiveTerritoryPop;
    const popNextTurnValue = calculatePopulationChange(territoryData);
    const area = row.querySelector(".ui-table-column:nth-child(4)").textContent;
    const gold = row.querySelector(".ui-table-column:nth-child(5)").textContent;
    /* const goldNextTurnValue = Math.ceil(calculateGoldChange(territoryData)); */
    const oilNextTurnValue = Math.ceil(calculateOilChange(territoryData, true));
    const oilCap = territoryData.oilCapacity;
    const foodNextTurnValue = Math.ceil(calculateFoodChange(territoryData, true));
    const foodCap = territoryData.foodCapacity;
    const consMatsNextTurnValue = Math.ceil(calculateConsMatsChange(territoryData, true));
    const consMatsCap = territoryData.consMatsCapacity;

    /* let goldNextTurnValue = "font-weight: bold; color: black;"; */
    let blackStyle = "font-weight: bold; color: black;";
    let popNextTurnStyle = "font-weight: bold; color: black;";
    let oilNextTurnStyle = "font-weight: bold; color: black;";
    let foodNextTurnStyle = "font-weight: bold; color: black;";
    let consMatsNextTurnStyle = "font-weight: bold; color: black;";

    if (popNextTurnValue > 0) {
        popNextTurnStyle = "color: rgb(0,235,0);";
    } else if (popNextTurnValue < 0) {
        popNextTurnStyle = "color: rgb(235,160,160);";
    }

    /* if (goldNextTurnValue > 0) {
        goldNextTurnStyle = "color: rgb(0,235,0);";
    } else if (goldNextTurnValue < 0) {
        goldNextTurnStyle = "color: rgb(235,160,160);";
    } */

    if (oilNextTurnValue > 0) {
        oilNextTurnStyle = "color: rgb(0,235,0);";
    } else if (oilNextTurnValue < 0) {
        oilNextTurnStyle = "color: rgb(235,160,160);";
    }

    if (foodNextTurnValue > 0) {
        foodNextTurnStyle = "color: rgb(0,235,0);";
    } else if (foodNextTurnValue < 0) {
        foodNextTurnStyle = "color: rgb(235,160,160);";
    }

    if (consMatsNextTurnValue > 0) {
        consMatsNextTurnStyle = "color: rgb(0,235,0);";
    } else if (consMatsNextTurnValue < 0) {
        consMatsNextTurnStyle = "color: rgb(235,160,160);";
    }

    const bonusPercentageFarms = territoryData.farmsBuilt > 0 ? territoryData.farmsBuilt * 10 : 0;
    const bonusPercentageForests = territoryData.forestsBuilt > 0 ? territoryData.forestsBuilt * 10 : 0;
    const bonusPercentageOilWells = territoryData.oilWellsBuilt > 0 ? territoryData.oilWellsBuilt * 10 : 0;
    const bonusPercentageForts = territoryData.fortsBuilt > 0 ? territoryData.fortsBuilt * 10 : 0;

    const tooltipContent = `
        <div><span style="color: rgb(235,235,0)">Territory: ${territoryName}</span></div>
        <div>Army: ${army}</div>
        <div>Defense Bonus Multiplier: <span style="${blackStyle}">x${territoryData.defenseBonus}</span></div>
        <br />
        <div>Productive Population: ${formatNumbersToKMB(prodPopulation)}</div>
        <div>Population Next Turn: <span style="${popNextTurnStyle}"> ${formatNumbersToKMB(popNextTurnValue)}</div>
        <div>Area: ${area}</div>
        <div>Oil Next Turn: <span style="${oilNextTurnStyle}">${oilNextTurnValue}</span></div>
        <div>Oil Cap: ${Math.ceil(oilCap)}</div>
        <div>Food Next Turn: <span style="${foodNextTurnStyle}">${foodNextTurnValue}</span></div>
        <div>Food Cap: ${formatNumbersToKMB(foodCap)}</div>
        <div>Cons. Mats. Next Turn: <span style="${consMatsNextTurnStyle}">${consMatsNextTurnValue}</span></div>
        <div>Cons. Mats. Cap: ${Math.ceil(consMatsCap)}</div>
        <br />
        <div>Farms: <span style="${blackStyle}">${territoryData.farmsBuilt}</span> (<span style="color: rgb(0,235,0)">+${bonusPercentageFarms}%</span> Food Cap.)</div>
        <div>Forests: <span style="${blackStyle}">${territoryData.forestsBuilt}</span> (<span style="color: rgb(0,235,0)">+${bonusPercentageForests}%</span> Cons. Mats. Cap.)</div>
        <div>Oil Wells: <span style="${blackStyle}">${territoryData.oilWellsBuilt}</span> (<span style="color: rgb(0,235,0)">+${bonusPercentageOilWells}%</span> Oil Cap.)</div>
        <div>Forts: <span style="${blackStyle}">${territoryData.fortsBuilt}</span> (<span style="color: rgb(0,235,0)">+${bonusPercentageForts}%</span> Def. Bonus)</div>
    `;

    // Get the last div in the row
    const lastDiv = row.querySelector(".ui-table-column:last-child img[alt='Upgrade Territory']");

    // Check if the mouse is hovering over the last div
    if (event.target === lastDiv) {
        if (currentTurnPhase == 0) {
            tooltip.innerHTML = "Click To Upgrade!";
        } else {
            tooltip.innerHTML = "Wrong Turn Phase To Upgrade";
        }
    } else {
        // Set the content of the tooltip based on the territory data
        tooltip.innerHTML = tooltipContent;
    }

    //<div>Gold Next Turn: <span style="${goldNextTurnStyle}">${goldNextTurnValue}</span></div>

    const tooltipHeight = tooltip.offsetHeight;
    const verticalThreshold = tooltipHeight + 25;

    if (window.innerHeight - y < verticalThreshold) {

    tooltip.style.left = x - 40 + "px";
    tooltip.style.top = y - tooltipHeight + "px";
    } else {
    tooltip.style.left = x - 40 + "px";
    tooltip.style.top = 25 + y + "px";
    }


    // Show the tooltip
    tooltip.style.display = "block";

    row.style.cursor = "pointer";
}

function colourTableText(table, territory) {
    /* let changeGold = calculateGoldChange(territory); */
    let changeOil = calculateOilChange(territory, true);
    let changeFood = calculateFoodChange(territory, true);
    let changeConsMats = calculateConsMatsChange(territory, true);
    let changePop = calculatePopulationChange(territory);

    /* const goldCell = table.rows[0].cells[3]; */
    const oilCell = table.rows[0].cells[5];
    const foodCell = table.rows[0].cells[7];
    const consMatsCell = table.rows[0].cells[9];
    const popCell = table.rows[0].cells[11];

    /* goldCell.style.color = "white"; */
    popCell.style.color = "white";
    oilCell.style.color = "white";
    foodCell.style.color = "white";
    consMatsCell.style.color = "white";        

    if (table === document.getElementById("bottom-table")) {
        if (changePop < -1) {
            popCell.style.color = "rgb(235,160,160)";
        } else if (changePop > 1) {
            popCell.style.color = "rgb(0,235,0)";
        }
        if (changeOil < -1) {
            oilCell.style.color = "rgb(235,160,160)";
        } else if (changeOil > 1) {
            oilCell.style.color = "rgb(0,235,0)";
        }
        if (changeFood < -1) {
            foodCell.style.color = "rgb(235,160,160)";
        } else if (changeFood > 1) {
            foodCell.style.color = "rgb(0,235,0)";
        }
        if (changeConsMats < -1) {
            consMatsCell.style.color = "rgb(235,160,160)";
        } else if (changeConsMats > 1) {
            consMatsCell.style.color = "rgb(0,235,0)";
        }
    }
}

function calculateAvailableUpgrades(territory) {
    const availableUpgrades = [];
  
    // Calculate the cost of upgrades
    const farmGoldCost = Math.max(simulatedCostsAll[0], 200 * 1);
    const farmConsMatsCost = Math.max(simulatedCostsAll[1], 1000 * 1);
    const forestGoldCost = Math.max(simulatedCostsAll[2], 200 * 1);
    const forestConsMatsCost = Math.max(simulatedCostsAll[3], 1000 * 1);
    const oilWellGoldCost = Math.max(simulatedCostsAll[4], 300 * 1);
    const oilWellConsMatsCost = Math.max(simulatedCostsAll[5], 2000 * 1);
    const fortGoldCost = Math.max(simulatedCostsAll[6], 500 * 1);
    const fortConsMatsCost = Math.max(simulatedCostsAll[7], 5000 * 1);

    // Check if the territory has enough gold and consMats for each upgrade
    const hasEnoughGoldForFarm = territory.goldForCurrentTerritory >= farmGoldCost;
    const hasEnoughGoldForForest = territory.goldForCurrentTerritory >= forestGoldCost;
    const hasEnoughGoldForOilWell = territory.goldForCurrentTerritory >= oilWellGoldCost;
    const hasEnoughGoldForFort = territory.goldForCurrentTerritory >= fortGoldCost;
  
    const hasEnoughConsMatsForFarm = territory.consMatsForCurrentTerritory >= farmConsMatsCost;
    const hasEnoughConsMatsForForest = territory.consMatsForCurrentTerritory >= forestConsMatsCost;
    const hasEnoughConsMatsForOilWell = territory.consMatsForCurrentTerritory >= oilWellConsMatsCost;
    const hasEnoughConsMatsForFort = territory.consMatsForCurrentTerritory >= fortConsMatsCost;
  
    // Create the upgrade row objects based on the availability and gold/consMats conditions
    if (hasEnoughGoldForFarm && hasEnoughConsMatsForFarm) {
      availableUpgrades.push({
        type: 'Farm',
        goldCost: farmGoldCost,
        consMatsCost: farmConsMatsCost,
        effect: "Food cap. +10%",
        condition: 'Can Build'
      });
    } else if (!hasEnoughGoldForFarm) {
      availableUpgrades.push({
        type: 'Farm',
        goldCost: farmGoldCost,
        consMatsCost: farmConsMatsCost,
        effect: "Food cap. +10%",
        condition: 'Not enough gold'
      });
    } else {
      availableUpgrades.push({
        type: 'Farm',
        goldCost: farmGoldCost,
        consMatsCost: farmConsMatsCost,
        effect: "Food cap. +10%",
        condition: 'Not enough consMats'
      });
    }
  
    if (hasEnoughGoldForForest && hasEnoughConsMatsForForest) {
      availableUpgrades.push({
        type: 'Forest',
        goldCost: forestGoldCost,
        consMatsCost: forestConsMatsCost,
        effect: "Cons Mats cap. +10%",
        condition: 'Can Build'
      });
    } else if (!hasEnoughGoldForForest) {
      availableUpgrades.push({
        type: 'Forest',
        goldCost: forestGoldCost,
        consMatsCost: forestConsMatsCost,
        effect: "Cons Mats cap. +10%",
        condition: 'Not enough gold'
      });
    } else {
      availableUpgrades.push({
        type: 'Forest',
        goldCost: forestGoldCost,
        consMatsCost: forestConsMatsCost,
        effect: "Cons Mats cap. +10%",
        condition: 'Not enough consMats'
      });
    }
  
    if (hasEnoughGoldForOilWell && hasEnoughConsMatsForOilWell) {
      availableUpgrades.push({
        type: 'Oil Well',
        goldCost: oilWellGoldCost,
        consMatsCost: oilWellConsMatsCost,
        effect: "Oil cap. +10%",
        condition: 'Can Build'
      });
    } else if (!hasEnoughGoldForOilWell) {
      availableUpgrades.push({
        type: 'Oil Well',
        goldCost: oilWellGoldCost,
        consMatsCost: oilWellConsMatsCost,
        effect: "Oil cap. +10%",
        condition: 'Not enough gold'
      });
    } else {
      availableUpgrades.push({
        type: 'Oil Well',
        goldCost: oilWellGoldCost,
        consMatsCost: oilWellConsMatsCost,
        effect: "Oil cap. +10%",
        condition: 'Not enough consMats'
      });
    }
  
    if (hasEnoughGoldForFort && hasEnoughConsMatsForFort) {
      availableUpgrades.push({
        type: 'Fort',
        goldCost: fortGoldCost,
        consMatsCost: fortConsMatsCost,
        effect: "Defence +10%",
        condition: 'Can Build'
      });
    } else if (!hasEnoughGoldForFort) {
      availableUpgrades.push({
        type: 'Fort',
        goldCost: fortGoldCost,
        consMatsCost: fortConsMatsCost,
        effect: "Defence +10%",
        condition: 'Not enough gold'
      });
    } else {
      availableUpgrades.push({
        type: 'Fort',
        goldCost: fortGoldCost,
        consMatsCost: fortConsMatsCost,
        effect: "Defence +10%",
        condition: 'Not enough consMats'
      });
    }
  
    return availableUpgrades;
  }
  
  function populateUpgradeTable(territory) {
    //reset confirm button status and totals when opening upgrade window
    document.getElementById("prices-info-column2").innerHTML = "0";
    document.getElementById("prices-info-column4").innerHTML = "0";
    document.getElementById("bottom-bar-confirm-button").innerHTML="Cancel";
    document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
        this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
    });
    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
        this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
    });

    let simulatedCosts;
    const upgradeTable = document.getElementById("upgrade-table");
    let totalSimulatedGoldPrice = 0;
    let totalSimulatedConsMatsPrice = 0;
  
    // Calculate available upgrades
    const availableUpgrades = calculateAvailableUpgrades(territory);
    upgradeTable.innerHTML = "";
  
    // Populate the table with available upgrade rows
    availableUpgrades.forEach((upgradeRow) => {
    const row = document.createElement("div");
    row.classList.add("upgrade-row");
  
    // Create and populate the image column
    const imageColumn = document.createElement("div");
    imageColumn.classList.add("upgrade-column");
    let image = document.createElement("img");
    image.src = getImagePath(upgradeRow.type, upgradeRow.condition); // Call a function to get the image path based on the upgrade type
    imageColumn.appendChild(image);
  
    // Create and populate other columns
    const column1 = document.createElement("div");
    column1.classList.add("upgrade-column");
    column1.textContent = upgradeRow.type;
  
    const column2 = document.createElement("div");
    column2.classList.add("upgrade-column");
    column2.textContent = upgradeRow.effect;
  
    const column3 = document.createElement("div");
    column3.classList.add("upgrade-column");
    column3.textContent = 0;
    const column4 = document.createElement("div");
    column4.classList.add("upgrade-column");
    column4.textContent = 0;


    const column5 = document.createElement("div");
    column5.classList.add("upgrade-column");
    column5.textContent = "";

    const column5A = document.createElement("div");
    column5A.classList.add("upgrade-column");
    column5A.classList.add("column5A");
    const imageMinus = document.createElement("img");
    if (upgradeRow.condition === "Can Build") {
        imageMinus.src = "/resources/minusButton.png";
    } else {
        imageMinus.src = "/resources/minusButtonGrey.png";
    }
    imageMinus.style.height = "21px";
    imageMinus.style.width = "21px";
    column5A.appendChild(imageMinus);

    const column5Wrapper = document.createElement("div");
    column5Wrapper.classList.add("column5-wrapper");

    const column5B = document.createElement("div");
    column5B.classList.add("upgrade-column");
    column5B.classList.add("column5B");
    const textField = document.createElement("input");
    textField.type = "text";
    textField.value = "0";
    column5B.appendChild(textField);

    const column5C = document.createElement("div");
    column5C.classList.add("upgrade-column");
    column5C.classList.add("column5C");
    const imagePlus = document.createElement("img");
    if (upgradeRow.condition === "Can Build") {
        imagePlus.src = "/resources/plusButton.png";
    } else {
        imagePlus.src = "/resources/plusButtonGrey.png";
    }
    imagePlus.style.height = "21px";
    imagePlus.style.width = "21px";
    column5C.appendChild(imagePlus);

  
    // Add columns to the row
    row.appendChild(imageColumn);
    row.appendChild(column1);
    row.appendChild(column2);
    row.appendChild(column3);
    row.appendChild(column4);
    row.appendChild(column5);
    column5Wrapper.appendChild(column5B);
    column5Wrapper.appendChild(column5C);
    column5.appendChild(column5A);
    column5.appendChild(column5Wrapper);
  
    upgradeTable.appendChild(row);

    const goldCost = upgradeRow.goldCost || 0;
    const consMatsCost = upgradeRow.consMatsCost || 0;

    totalGoldPrice += goldCost; 
    totalConsMats += consMatsCost; 

    simulatedCosts = incrementDecrementUpgrades(textField, -1, upgradeRow.type, territory, true);

    switch (simulatedCosts[2]) {
        case "Farm":
          simulatedCostsAll[0] = simulatedCosts[0];
          simulatedCostsAll[1] = simulatedCosts[1];
          break;
        case "Forest":
          simulatedCostsAll[2] = simulatedCosts[0];
          simulatedCostsAll[3] = simulatedCosts[1];
          break;
        case "Oil Well":
          simulatedCostsAll[4] = simulatedCosts[0];
          simulatedCostsAll[5] = simulatedCosts[1];
          break;
        case "Fort":
          simulatedCostsAll[6] = simulatedCosts[0];
          simulatedCostsAll[7] = simulatedCosts[1];
          break;
      }

    imageMinus.addEventListener("click", () => {
        if (imageMinus.src.includes("/resources/minusButton.png")) {
            if (parseInt(textField.value) > 0) {
                simulatedCosts = incrementDecrementUpgrades(textField, -1, upgradeRow.type, territory, false);
                switch (simulatedCosts[2]) {
                    case "Farm":
                      simulatedCostsAll[0] = simulatedCosts[0];
                      simulatedCostsAll[1] = simulatedCosts[1];
                      break;
                    case "Forest":
                      simulatedCostsAll[2] = simulatedCosts[0];
                      simulatedCostsAll[3] = simulatedCosts[1];
                      break;
                    case "Oil Well":
                      simulatedCostsAll[4] = simulatedCosts[0];
                      simulatedCostsAll[5] = simulatedCosts[1];
                      break;
                    case "Fort":
                      simulatedCostsAll[6] = simulatedCosts[0];
                      simulatedCostsAll[7] = simulatedCosts[1];
                      break;
                  }

                totalGoldPrice = calculateTotalGoldPrice(upgradeTable);
                totalConsMats = calculateTotalConsMats(upgradeTable);

                document.getElementById("prices-info-column2").innerHTML = totalGoldPrice;
                document.getElementById("prices-info-column4").innerHTML = totalConsMats;

                console.log(simulatedCostsAll);
                console.log("Total Gold Price:", totalGoldPrice);
                console.log("Total ConsMats:", totalConsMats);

                //code to check greying out here
                checkRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, "minus");

                if (atLeastOneRowWithValueGreaterThanOne(upgradeTable)) {
                    document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(0, 128, 0, 0.8)";
                    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
                        this.style.backgroundColor = "rgba(0, 158, 0, 0.8)";
                    });
                    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
                        this.style.backgroundColor = "rgba(0, 128, 0, 0.8)";
                    });
                } else if (allRowsWithValueZero(upgradeTable)) {
                    document.getElementById("bottom-bar-confirm-button").innerHTML="Cancel";
                    document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
                    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
                        this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
                    });
                    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
                        this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
                    });
                } 
            }
        }
    });
  
    imagePlus.addEventListener("click", () => {
        if (imagePlus.src.includes("/resources/plusButton.png")) {
          simulatedCosts = incrementDecrementUpgrades(textField, 1, upgradeRow.type, territory, false);
          switch (simulatedCosts[2]) {
            case "Farm":
              simulatedCostsAll[0] = simulatedCosts[0];
              simulatedCostsAll[1] = simulatedCosts[1];
              break;
            case "Forest":
              simulatedCostsAll[2] = simulatedCosts[0];
              simulatedCostsAll[3] = simulatedCosts[1];
              break;
            case "Oil Well":
              simulatedCostsAll[4] = simulatedCosts[0];
              simulatedCostsAll[5] = simulatedCosts[1];
              break;
            case "Fort":
              simulatedCostsAll[6] = simulatedCosts[0];
              simulatedCostsAll[7] = simulatedCosts[1];
              break;
          }

        totalGoldPrice = calculateTotalGoldPrice(upgradeTable);
        totalConsMats = calculateTotalConsMats(upgradeTable);

        document.getElementById("prices-info-column2").innerHTML = totalGoldPrice;
        document.getElementById("prices-info-column4").innerHTML = totalConsMats;

        totalSimulatedGoldPrice = simulatedCostsAll[0] + simulatedCostsAll[2] + simulatedCostsAll[4] + simulatedCostsAll[6];
        totalSimulatedConsMatsPrice = simulatedCostsAll[1] + simulatedCostsAll[3] + simulatedCostsAll[5] + simulatedCostsAll[7];

        console.log(simulatedCostsAll);
        console.log("Total Gold Price:", totalGoldPrice);
        console.log("Total ConsMats:", totalConsMats);
        console.log("Total SimGold Price:", totalSimulatedGoldPrice);
        console.log("Total SimConsMats:", totalSimulatedConsMatsPrice);

        //code to check greying out here
        checkRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, "plus");

        if (atLeastOneRowWithValueGreaterThanOne(upgradeTable)) {
            document.getElementById("bottom-bar-confirm-button").innerHTML="Confirm";
            document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(0, 128, 0, 0.8)";
            document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
                this.style.backgroundColor = "rgba(0, 158, 0, 0.8)";
            });
            document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
                this.style.backgroundColor = "rgba(0, 128, 0, 0.8)";
            });
        } else if (allRowsWithValueZero(upgradeTable)) {
            document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
            document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
                this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
            });
            document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
                this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
            });
        }                       
        }
      });
  });
  //console.log(simulatedCostsAll);
  }

  function incrementDecrementUpgrades(textField, increment, upgradeType, territory, simOnly) {
    let currentValueQuantity = parseInt(textField.value);
    currentValueQuantity += increment;
  
    if (currentValueQuantity < 0) {
      currentValueQuantity = 0;
    }

    if (!simOnly) {
        textField.value = currentValueQuantity.toString();
    }
  
    let currentValueQuantityTemp = currentValueQuantity;
  
    // Update gold and consMats costs based on upgrade type and number of upgrades already built
    const upgradeRow = textField.parentNode.parentNode.parentNode.parentNode;
    const goldCostElement = upgradeRow.querySelector(".upgrade-column:nth-child(4)");
    const consMatsCostElement = upgradeRow.querySelector(".upgrade-column:nth-child(5)");
  
    let goldBaseCost;
    let consMatsBaseCost;
  
    let farmsBuilt = territory.farmsBuilt;
    let forestsBuilt = territory.forestsBuilt;
    let oilWellsBuilt = territory.oilWellsBuilt;
    let fortsBuilt = territory.fortsBuilt;
  
    let goldCost;
    let consMatsCost;
    let simulationCosts = []; // Array to store simulated costs
  
    switch (upgradeType) {
      case "Farm":
        currentValueQuantityTemp += farmsBuilt;
        goldBaseCost = 200;
        consMatsBaseCost = 1000;
        farmsBuilt += increment;
        goldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
        consMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
        break;
      case "Forest":
        currentValueQuantityTemp += forestsBuilt;
        goldBaseCost = 200;
        consMatsBaseCost = 1000;
        forestsBuilt += increment;
        goldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
        consMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
        break;
      case "Oil Well":
        currentValueQuantityTemp += oilWellsBuilt;
        goldBaseCost = 300;
        consMatsBaseCost = 2000;
        oilWellsBuilt += increment;
        goldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
        consMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
        break;
      case "Fort":
        currentValueQuantityTemp += fortsBuilt;
        goldBaseCost = 500;
        consMatsBaseCost = 5000;
        fortsBuilt += increment;
        goldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
        consMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
        break;
    }
  
    if (currentValueQuantity === 0) {
      goldCost = 0;
      consMatsCost = 0;
    }
  
    if (!simOnly) {
        goldCostElement.textContent = goldCost;
        consMatsCostElement.textContent = consMatsCost;
    }
    
      // Simulate next increment and store costs in array
      currentValueQuantityTemp += Math.abs(increment); //always simulate clicking plus i.e. upward direction
      const simulatedGoldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
      const simulatedConsMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * territory.devIndex);
      const simulatedUpgradeType = upgradeType;
      simulationCosts.push(simulatedGoldCost);
      simulationCosts.push(simulatedConsMatsCost);
      simulationCosts.push(simulatedUpgradeType); // Include the upgrade type in the array
      return simulationCosts;
  }

  function getImagePath(type, condition) {
    if (type === "Farm") {
        if (condition === "Can Build") {
            return '/resources/farmIcon.png';
        } else {
            return '/resources/farmIconGrey.png';
        }
    } else if (type === "Oil Well") {
        if (condition === "Can Build") {
            return '/resources/oilWellIcon.png';
        } else {
            return '/resources/oilWellIconGrey.png';
        }
    } else if (type === "Forest") {
        if (condition === "Can Build") {
            return '/resources/forestIcon.png';
        } else {
            return '/resources/forestIconGrey.png';
        }
    } else if (type === "Fort") {
        if (condition === "Can Build") {
            return '/resources/fortIcon.png';
        } else {
            return '/resources/fortIconGrey.png';
        }
    }
  }

  
  // Function to calculate the total gold price for all rows
  function calculateTotalGoldPrice(upgradeTable) {
    let totalGold = 0;
    const goldElements = upgradeTable.querySelectorAll(".upgrade-column:nth-child(4)");
    goldElements.forEach((goldElement) => {
      const goldCost = parseInt(goldElement.textContent) || 0;
      totalGold += goldCost;
    });
    return totalGold;
  }

  // Function to calculate the total consMats for all rows
  function calculateTotalConsMats(upgradeTable) {
    let totalConsMats = 0;
    const consMatsElements = upgradeTable.querySelectorAll(".upgrade-column:nth-child(5)");
    consMatsElements.forEach((consMatsElement) => {
      const consMatsCost = parseInt(consMatsElement.textContent) || 0;
      totalConsMats += consMatsCost;
    });
    return totalConsMats;
  }

  function checkRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, button) {
    const simulatedgoldElements = [simulatedCostsAll[0], simulatedCostsAll[2], simulatedCostsAll[4], simulatedCostsAll[6]];
    const simulatedConsMatsElements = [simulatedCostsAll[1], simulatedCostsAll[3], simulatedCostsAll[5], simulatedCostsAll[7]];
  
    if (button === "plus") {
      simulatedgoldElements.forEach((simulatedGoldElement, index) => {
        if (territory.goldForCurrentTerritory - totalGoldPrice < simulatedGoldElement) {
            const rowIndex = index + 1;
            const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);
          
            // Get the image element in the first column
            const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
            if (imageElement) {
                if (!imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                }
            }
          
            // Get the plus button image in the fifth column
            const plusButton = upgradeRow.querySelector('.column5C img');
            if (plusButton) {
              if (!plusButton.src.includes('Grey.png')) {
                plusButton.src = plusButton.src.replace('.png', 'Grey.png');
              }
            }
          }     
      });
      simulatedConsMatsElements.forEach((simulatedConsMatsElement, index) => {
        if (territory.consMatsForCurrentTerritory - totalConsMats < simulatedConsMatsElement) {
            const rowIndex = index + 1;
            console.log(rowIndex);
            const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);
          
            // Get the image element in the first column
            const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
            if (imageElement) {
                if (!imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                }
            }
            // Get the plus button image in the fifth column
            const plusButton = upgradeRow.querySelector('.column5C img');
            if (plusButton) {
              // Update the plus button source
              if (!plusButton.src.includes('Grey.png')) {
                plusButton.src = plusButton.src.replace('.png', 'Grey.png');
              }
            }
          }     
      });
    } else if (button === "minus") {
        simulatedgoldElements.forEach((simulatedGoldElement, index) => {
            const rowIndex = index + 1;
            const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);
    
            // Get the image element in the first column
            const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
    
            // Get the plus button image in the fifth column
            const plusButton = upgradeRow.querySelector('.column5C img');
    
            const simulatedConsMatsElement = simulatedConsMatsElements[index];
    
            if (
                territory.goldForCurrentTerritory - totalGoldPrice >= simulatedGoldElement &&
                territory.consMatsForCurrentTerritory - totalConsMats >= simulatedConsMatsElement
            ) {
                // Both conditions are true, ungrey the row
                if (imageElement && imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('Grey.png', '.png');
                }
                if (plusButton && plusButton.src.includes('Grey.png')) {
                    plusButton.src = plusButton.src.replace('Grey.png', '.png');
                }
            }
        });
    }   
  }

  // Function to check if at least one row has a textField value greater than 1
  function atLeastOneRowWithValueGreaterThanOne(upgradeTable) {
    const rows = upgradeTable.getElementsByClassName("upgrade-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".column5B input");
        if (parseInt(textField.value) >= 1) {
            return true;
        }
    }
    return false;
}

// Function to check if all rows have a textField value of 0
function allRowsWithValueZero(upgradeTable) {
    const rows = upgradeTable.getElementsByClassName("upgrade-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".column5B input");
        if (parseInt(textField.value) !== 0) {
            return false;
        }
    }
    return true;
}

export function addPlayerUpgrades(upgradeTable, territory, totalGoldCost, totalConsMatsCost) {
    //push upgrades in table to an array
    let upgradeArray = [];
    const rows = upgradeTable.getElementsByClassName("upgrade-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".column5B input");
        upgradeArray.push(textField.value);
        textField.value = "0";
    }

    //update total player resources
    totalPlayerResources[0].totalGold -= totalGoldCost;
    totalPlayerResources[0].totalConsMats -= totalConsMatsCost;
    
    //update main array
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === territory.uniqueId) {
            mainArrayOfTerritoriesAndResources[i].goldForCurrentTerritory -= totalGoldCost; //subtract gold from territory
            mainArrayOfTerritoriesAndResources[i].consMatsForCurrentTerritory -= totalConsMatsCost; // subtract consMats from territory
            mainArrayOfTerritoriesAndResources[i].farmsBuilt += parseInt(upgradeArray[0]);
            mainArrayOfTerritoriesAndResources[i].forestsBuilt += parseInt(upgradeArray[1]);
            mainArrayOfTerritoriesAndResources[i].oilWellsBuilt += parseInt(upgradeArray[2]);
            mainArrayOfTerritoriesAndResources[i].fortsBuilt += parseInt(upgradeArray[3]);
            if (mainArrayOfTerritoriesAndResources[i].farmsBuilt > 0) {
                mainArrayOfTerritoriesAndResources[i].foodCapacity = mainArrayOfTerritoriesAndResources[i].foodCapacity + (mainArrayOfTerritoriesAndResources[i].foodCapacity * ((territory.farmsBuilt * 10) / 100)); //calculate new foodCapacity
            }
            if (mainArrayOfTerritoriesAndResources[i].forestsBuilt > 0) {
                mainArrayOfTerritoriesAndResources[i].consMatsCapacity = mainArrayOfTerritoriesAndResources[i].consMatsCapacity + (mainArrayOfTerritoriesAndResources[i].consMatsCapacity * ((territory.forestsBuilt * 10) / 100)); //calculate new consMatsCapacity
            }
            if (mainArrayOfTerritoriesAndResources[i].oilWellsBuilt > 0) {
                mainArrayOfTerritoriesAndResources[i].oilCapacity = mainArrayOfTerritoriesAndResources[i].oilCapacity + (mainArrayOfTerritoriesAndResources[i].oilCapacity * ((territory.oilWellsBuilt * 10) / 100)); //calculate new oilCapacity
            }
            if (mainArrayOfTerritoriesAndResources[i].fortsBuilt > 0) {
                mainArrayOfTerritoriesAndResources[i].defenseBonus = mainArrayOfTerritoriesAndResources[i].defenseBonus + (mainArrayOfTerritoriesAndResources[i].defenseBonus * ((territory.fortsBuilt * 10) / 100)); //calculate new defenseBonus
            }
        }
    }

    //update bottom table for selected territory
    document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(territory.goldForCurrentTerritory);
    document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(territory.consMatsForCurrentTerritory);

    //update top table for selected territory
    document.getElementById("top-table").rows[0].cells[3].innerHTML = Math.ceil(totalPlayerResources[0].totalGold);
    document.getElementById("top-table").rows[0].cells[9].innerHTML = Math.ceil(totalPlayerResources[0].totalConsMats);

    //close upgrade window for selected territory
    totalGoldPrice = 0;
    totalConsMats = 0;
}
  
  
  
  
  
  