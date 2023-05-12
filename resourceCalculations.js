import { pageLoaded } from './ui.js';
import { currentTurn } from './gameTurnsLoop.js';
import { dataTableCountriesInitialState } from './ui.js';
import { setFlag } from './ui.js';
import { currentSelectedPath } from './ui.js';
import { paths } from './ui.js';

export let allowSelectionOfCountry = false;

let mainArrayOfTerritoriesAndResources = [];
let totalPlayerResources = [];
let playerOwnedTerritories = [];
let continentModifier;

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

            // Calculate population of each territory based on the startingPop for the whole country it belongs to
            territoryPopulation = startingPop * percentOfWholeArea;
            productiveTerritoryPop = (((territoryPopulation / 100) * 45) * dev_index)

            // Calculate new army value for current element
            let armyForCurrentTerritory = totalArmyForCountry * percentOfWholeArea;
            let GoldForCurrentTerritory = (totalGoldForCountry * ((area/8000000) * dev_index) + (percentOfWholeArea * (territoryPopulation/50000)) * continentModifier);
            let OilForCurrentTerritory = totalOilForCountry * (percentOfWholeArea * (area/100000));
            let FoodForCurrentTerritory = totalFoodForCountry * (percentOfWholeArea * (area/200000));
            let ConsMatsForCurrentTerritory = totalConsMatsForCountry * (percentOfWholeArea * (area/100000));

            // Add updated path data to the new array
            mainArrayOfTerritoriesAndResources.push({
                uniqueId: uniqueId,
                dataName: dataName,
                territoryId: territoryId,
                territoryPopulation: territoryPopulation,
                productiveTerritoryPop: productiveTerritoryPop,
                area: area,
                continent: continent,
                armyForCurrentTerritory: armyForCurrentTerritory,
                goldForCurrentTerritory: GoldForCurrentTerritory,
                oilForCurrentTerritory: OilForCurrentTerritory,
                foodForCurrentTerritory: FoodForCurrentTerritory,
                consMatsForCurrentTerritory: ConsMatsForCurrentTerritory,
                devIndex: dev_index,
                continentModifier: continentModifier
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
            country.oilForCurrentTerritory = country.oilForCurrentTerritory + (country.oilForCurrentTerritory * (randomOilFactor/100));
            country.foodForCurrentTerritory = country.foodForCurrentTerritory + (country.foodForCurrentTerritory * (randomFoodFactor/100));
            country.consMatsForCurrentTerritory = country.consMatsForCurrentTerritory + (country.consMatsForCurrentTerritory * (randomConsMatsFactor/100));
        } else {
            country.armyForCurrentTerritory = country.armyForCurrentTerritory - (country.armyForCurrentTerritory * (randomArmyFactor/100));
            country.goldForCurrentTerritory = country.goldForCurrentTerritory - (country.goldForCurrentTerritory * (randomGoldFactor/100));
            country.oilForCurrentTerritory = country.oilForCurrentTerritory - (country.oilForCurrentTerritory * (randomOilFactor/100));
            country.foodForCurrentTerritory = country.foodForCurrentTerritory - (country.foodForCurrentTerritory * (randomFoodFactor/100));
            country.consMatsForCurrentTerritory = country.consMatsForCurrentTerritory - (country.consMatsForCurrentTerritory * (randomConsMatsFactor/100));
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
/*                  changeGold = calculateGoldChange();
                    changeOil = calculateOilChange();
                    changeFood = calculateFoodChange();
                    changeConsMats = calculateConsMatsChange();
                    changePop = calculatePopulationChange(); */

                    changeGold = 10;
                    changeOil = 10;
                    changeFood = 10;
                    changeConsMats = 10;
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

    function calculatePopulationChange(territory) {
        const foodCapacity = territory.foodForCurrentTerritory * 10000;
        const currentPopulation = territory.productiveTerritoryPop;
        const devIndex = territory.devIndex;
      
        let populationChange = 0;
      
        if (foodCapacity < currentPopulation) {
          // Starvation situation
          const foodShortage = Math.ceil((currentPopulation - foodCapacity) / 1000);
          populationChange = -Math.min(foodShortage * 500, currentPopulation);
        } else {
          // Growth situation
          const maxGrowth = foodCapacity - currentPopulation;
          const growthPotential = Math.floor(devIndex * currentPopulation * 0.1);
          populationChange = Math.min(maxGrowth, growthPotential);
        }
      
        return populationChange;
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

    function getPlayerTerritories() {
        playerOwnedTerritories.length = 0;

        for (const path of paths) {
            if (path.getAttribute("owner") === "Player") {
                playerOwnedTerritories.push(path);
            }
        }
    }

    function writeBottomTableInformation(territory, userClickingANewTerritory, countryPath) {
        if (userClickingANewTerritory) {
                document.getElementById("bottom-table").rows[0].cells[0].style.whiteSpace = "pre";
                document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(territory.goldForCurrentTerritory);
                document.getElementById("bottom-table").rows[0].cells[5].innerHTML = Math.ceil(territory.oilForCurrentTerritory);
                document.getElementById("bottom-table").rows[0].cells[7].innerHTML = Math.ceil(territory.foodForCurrentTerritory);
                document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(territory.consMatsForCurrentTerritory);
                document.getElementById("bottom-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(territory.productiveTerritoryPop) + " (" + formatNumbersToKMB(territory.territoryPopulation) + ")";
                document.getElementById("bottom-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(territory.area) + " (km²)";
                document.getElementById("bottom-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(territory.armyForCurrentTerritory);
            } else { //turn update resources for selected territory
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