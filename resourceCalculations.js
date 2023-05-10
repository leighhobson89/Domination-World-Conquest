import { pageLoaded } from './ui.js';
import { currentTurn } from './gameTurnsLoop.js';
import { dataTableCountriesInitialState } from './ui.js';
import { setFlag } from './ui.js';
import { currentPath } from './ui.js';
import { playerCountry } from './ui.js';

export let allowSelectionOfCountry = false;

let arrayOfArmyAndResourceProportions;

let totalPlayerResources = [];
let continentModifier;

let startingPop;
let totalPop;
let totalArea = 0;
let totalArmy = 0;
let totalGold = 0;
let totalOil = 0;
let totalFood = 0;
let totalConsMats = 0;
let territoryPopulation;

/* const turnLabel = document.getElementById('turn-label'); */
if (!pageLoaded) {
    Promise.all([calculatePathAreasWhenPageLoaded(), createArrayOfInitialData()])
        .then(([pathAreas, armyArray]) => {
            arrayOfArmyAndResourceProportions = randomiseArmyAndResources(arrayOfArmyAndResourceProportions);
        })
        .catch(error => {
            console.log(error);
        });
}

function calculatePathAreasWhenPageLoaded() {
    return new Promise((resolve, reject) => {
        let intervalId = setInterval(function() {
            if (pageLoaded === true) {

                let svgFile = document.getElementById('svg-map').contentDocument;
                let pathAreas = calculatePathAreas(svgFile);
                allowSelectionOfCountry = true;

                clearInterval(intervalId);

                resolve(pathAreas);
            }
        }, 1000); // check every 1 second
    });
}

function calculatePathAreas(svgFile) {
    let pathAreas = [];
    // Get all the path elements from the SVG file
    const paths = svgFile.querySelectorAll('path');

    // Calculate the area of each path and store it in an array
    let totalAreaPath = 0;
    for (let i = 0; i < paths.length; i++) {
        let path = paths[i];
        let pathLength = path.getTotalLength();
        let numPoints = 80; // Change this to increase or decrease the number of points
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
    
    // Calculate the scaling factor
    let scalingFactor = 136067649 / totalAreaPath;
    
    // Scale the area of each path to its actual area in km2
    for (let i = 0; i < pathAreas.length; i++) {
        pathAreas[i].area *= scalingFactor;
    }
    
    // Return the array of path areas
    return pathAreas;
}

function assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState) {
    let arrayOfArmyAndResourceProportions = [];
    // Create a new array to store the updated path data

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
            let population = matchingCountry.startingPop;
            let continent = matchingCountry.continent;
            let dev_index = matchingCountry.dev_index;
            let country_modifier = matchingCountry.country_modifier;
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

            // Calculate new army value for current element
            let armyForCurrentTerritory = totalArmyForCountry * percentOfWholeArea;
            let GoldForCurrentTerritory = (totalGoldForCountry * ((area/8000000) * dev_index) + (percentOfWholeArea * (population/50000)) * continentModifier);
            let OilForCurrentTerritory = totalOilForCountry * (percentOfWholeArea * (area/100000));
            let FoodForCurrentTerritory = totalFoodForCountry * (percentOfWholeArea * (area/100000));
            let ConsMatsForCurrentTerritory = totalConsMatsForCountry * (percentOfWholeArea * (area/100000));

            // Add updated path data to the new array
            arrayOfArmyAndResourceProportions.push({
                uniqueId: uniqueId,
                dataName: dataName,
                territoryId: territoryId,
                area: area,
                continent: continent,
                armyForCurrentTerritory: armyForCurrentTerritory,
                goldForCurrentTerritory: GoldForCurrentTerritory,
                oilForCurrentTerritory: OilForCurrentTerritory,
                foodForCurrentTerritory: FoodForCurrentTerritory,
                consMatsForCurrentTerritory: ConsMatsForCurrentTerritory,
                devIndex: dev_index,
                countryModifier: country_modifier
            });
        }
    }
    return arrayOfArmyAndResourceProportions;
}

function createArrayOfInitialData() {
    return calculatePathAreasWhenPageLoaded().then(pathAreas => {
        return new Promise((resolve, reject) => {
            arrayOfArmyAndResourceProportions = assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState);
            resolve(arrayOfArmyAndResourceProportions);
        });
    });
}

function randomiseArmyAndResources(armyResourceArray) {
    armyResourceArray.forEach((country) => {
        let randomGoldFactor = Math.floor(Math.random() * 20) + 2;
        let randomOilFactor = Math.floor(Math.random() * 80) + 2;
        let randomFoodFactor = Math.floor(Math.random() * 90) + 2;
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

export function newTurnResources(playerCountry) {
    let totalGoldChange = [];
    let totalOilChange = [];
    let totalFoodChange = [];
    let totalConsMatsChange = [];
    let totalPopChange = [];
    let totalAreaArray = [];
    let changeArrayForTerritory = [];

    //read all paths and add all those with "owner = 'player'" to an array
    const svgMap = document.getElementById('svg-map').contentDocument;
    const paths = Array.from(svgMap.querySelectorAll('path'));
    let playerOwnedTerritories = [];

    for (const path of paths) {
        if (path.getAttribute("owner") === "Player") {
            playerOwnedTerritories.push(path);
        }
    }
    for (let i = 0; i < playerOwnedTerritories.length; i++) {
        console.log("Player owns:" + playerOwnedTerritories[i].getAttribute("territory-name") + " [" + playerOwnedTerritories[i].getAttribute("territory-id") + "]");
    }

    if (currentTurn === 1) {
        document.getElementById("top-table").rows[0].cells[0].style.whiteSpace = "pre";
        document.getElementById("top-table").rows[0].cells[3].innerHTML = Math.ceil(totalGold);
        document.getElementById("top-table").rows[0].cells[5].innerHTML = Math.ceil(totalOil);
        document.getElementById("top-table").rows[0].cells[7].innerHTML = Math.ceil(totalFood);
        document.getElementById("top-table").rows[0].cells[9].innerHTML = Math.ceil(totalConsMats);
        document.getElementById("top-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(startingPop);
        document.getElementById("top-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(totalArea) + " (km²)";
        document.getElementById("top-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(totalArmy);

        totalPlayerResources = [totalGold, totalOil, totalFood, totalConsMats, parseInt(startingPop), totalArea, totalArmy];
    } else if (currentTurn > 1) {
        //add up resources from all territories and put in top-table
        for (let i = 0; i < playerOwnedTerritories.length; i++) {
            for (let j = 0; j < arrayOfArmyAndResourceProportions.length; j++) {
                if (playerOwnedTerritories[i].getAttribute("uniqueid") === arrayOfArmyAndResourceProportions[j].uniqueId) {
                    //call functions to update players country:
                    console.log(playerOwnedTerritories[i].getAttribute("data-name") + playerOwnedTerritories[i].getAttribute("territory-id"));
                    changeArrayForTerritory = calculateTerritoryResourceIncomesEachTurn(territoryPopulation, arrayOfArmyAndResourceProportions[j].area, parseFloat(arrayOfArmyAndResourceProportions[j].devIndex), arrayOfArmyAndResourceProportions[j].continent);        
                    //resources
                    totalGoldChange.push(changeArrayForTerritory[0]);
                    totalOilChange.push(changeArrayForTerritory[1]);
                    totalFoodChange.push(changeArrayForTerritory[2]);
                    totalConsMatsChange.push(changeArrayForTerritory[3]);
                    //population
                    totalPopChange.push(changeArrayForTerritory[4]);
                    //area
                    totalAreaArray.push(arrayOfArmyAndResourceProportions[j].area);

                    arrayOfArmyAndResourceProportions[j].goldForCurrentTerritory = changeArrayForTerritory[0];
                    arrayOfArmyAndResourceProportions[j].oilForCurrentTerritory = changeArrayForTerritory[1];
                    arrayOfArmyAndResourceProportions[j].foodForCurrentTerritory = changeArrayForTerritory[2];
                    arrayOfArmyAndResourceProportions[j].consMatsForCurrentTerritory = changeArrayForTerritory[3];
                }
            }
        }
        
        totalGoldChange = totalGoldChange.reduce((a, b) => a + b, 0);
        totalOilChange = totalOilChange.reduce((a, b) => a + b, 0);
        totalFoodChange = totalFoodChange.reduce((a, b) => a + b, 0);
        totalConsMatsChange = totalConsMatsChange.reduce((a, b) => a + b, 0);
        totalPopChange = totalPopChange.reduce((a, b) => a + b, 0);
        totalAreaArray = totalAreaArray.reduce((a, b) => a + b, 0);

        totalPlayerResources[0] += totalGoldChange;
        totalPlayerResources[1] += totalOilChange;
        totalPlayerResources[2] += totalFoodChange;
        totalPlayerResources[3] += totalConsMatsChange;
        totalPlayerResources[4] += totalPopChange;
        totalPlayerResources[5] = totalAreaArray;
        //totalPlayerResources[6] = //army wont change on turn flip

        document.getElementById("top-table").rows[0].cells[0].style.whiteSpace = "pre";
        document.getElementById("top-table").rows[0].cells[3].innerHTML = Math.ceil(totalPlayerResources[0]);
        document.getElementById("top-table").rows[0].cells[5].innerHTML = Math.ceil(totalPlayerResources[1]);
        document.getElementById("top-table").rows[0].cells[7].innerHTML = Math.ceil(totalPlayerResources[2]);
        document.getElementById("top-table").rows[0].cells[9].innerHTML = Math.ceil(totalPlayerResources[3]);
        document.getElementById("top-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(Math.ceil(totalPlayerResources[4]));
        document.getElementById("top-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(totalPlayerResources[5]) + " (km²)";
       /* document.getElementById("top-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(totalPlayerResources[6]); */

        console.log(totalPlayerResources[4]);
    }
    
    //set these new totals in the table
    //return a popup to the user with a confirm button to remove it, stating what the player gained that turn
}

    function calculateTerritoryResourceIncomesEachTurn(territoryPopulation, territoryArea, devIndex, continent) {
        let continentModifier;
        if (continent === "Europe") {
            continentModifier = 1;
        } else if (continent === "North America") {
            continentModifier = 1;
        } else if (continent === "Asia") {
            continentModifier = 0.7;
        } else if (continent === "Oceania") {
            continentModifier = 0.6;
        } else if (continent === "South America") {
            continentModifier = 0.6;
        } else if (continent === "Africa") {
            continentModifier = 0.5;
        }

        let changeArray = [0,0,0,0,0];
        changeArray[0] = 0;
       /*  changeArray[1] = totalPlayerResources[2] + ((baseIncrease * continentModifier * devIndex) * (currentPop / 100000000000));
        changeArray[2] = totalPlayerResources[2] + ((baseIncrease * continentModifier * devIndex) * (currentPop / 100000000000));
        changeArray[3] = totalPlayerResources[3] + ((baseIncrease * continentModifier * devIndex) * (currentPop / 100000000000)); */
        changeArray[4] = totalPlayerResources[1] + calculatePopulationIncrease(territoryPopulation, territoryArea, devIndex, totalPlayerResources[2]);
        console.log(changeArray[4] + "increase for playerCountry of: " + playerCountry);
        return changeArray;
    }

    export function populateBottomTableWhenSelectingACountry(countryPath) {
        let countryResourceData  = [];
    
        let territoryArea;
        let startingArmy;
        let territoryPop;

        totalGold = 0;
        totalOil = 0;
        totalFood = 0;
        totalConsMats = 0;
        totalArea = 0;
        totalArmy = 0;

        // Loop through arrayOfArmyAndResourceProportions to find the data for the corresponding territories of the country
        for (let i = 0; i < arrayOfArmyAndResourceProportions.length; i++) {
            if (arrayOfArmyAndResourceProportions[i].dataName === currentPath.getAttribute("data-name")) {
            countryResourceData.push(arrayOfArmyAndResourceProportions[i]);      
            totalGold += arrayOfArmyAndResourceProportions[i].goldForCurrentTerritory;
            totalOil += arrayOfArmyAndResourceProportions[i].oilForCurrentTerritory;
            totalFood += arrayOfArmyAndResourceProportions[i].foodForCurrentTerritory;
            totalConsMats += arrayOfArmyAndResourceProportions[i].consMatsForCurrentTerritory;    
            }
        }
    
        // Update the table with the response data
        document.getElementById("bottom-table").rows[0].cells[0].style.whiteSpace = "pre";
    
        setFlag(countryPath.getAttribute("data-name"),2); //set flag for territory clicked on (bottom table)

        for (let i = 0; i < dataTableCountriesInitialState.length; i++) {
            if (dataTableCountriesInitialState[i].country === countryPath.getAttribute("data-name")) {
                for (let i = 0; i < arrayOfArmyAndResourceProportions.length; i++) {
                    if (arrayOfArmyAndResourceProportions[i].dataName === countryPath.getAttribute("data-name")) {
                    totalArmy += arrayOfArmyAndResourceProportions[i].armyForCurrentTerritory;
                    totalArea += arrayOfArmyAndResourceProportions[i].area;
                    }
                }
                
                document.getElementById("bottom-table").rows[0].cells[1].innerHTML = countryPath.getAttribute("territory-name") + " (" + dataTableCountriesInitialState[i].continent + ")";

                const population = dataTableCountriesInitialState[i].startingPop;
                startingPop = population;
                for (let i = 0; i < arrayOfArmyAndResourceProportions.length; i++) {
                    if (arrayOfArmyAndResourceProportions[i].uniqueId === countryPath.getAttribute("uniqueid")) {
                        territoryPop = formatNumbersToKMB((population / totalArea) * arrayOfArmyAndResourceProportions[i].area);
                        territoryPopulation = (population / totalArea) * arrayOfArmyAndResourceProportions[i].area; 
                        break;
                    }
                }
                document.getElementById("bottom-table").rows[0].cells[11].innerHTML = territoryPop;
                
                for (let i = 0; i < arrayOfArmyAndResourceProportions.length; i++) {
                    if (arrayOfArmyAndResourceProportions[i].territoryId === countryPath.getAttribute("territory-id") && arrayOfArmyAndResourceProportions[i].dataName === countryPath.getAttribute("data-name")) {
                    startingArmy = Math.ceil(arrayOfArmyAndResourceProportions[i].armyForCurrentTerritory);
                    startingArmy = formatNumbersToKMB(startingArmy);
                    document.getElementById("bottom-table").rows[0].cells[15].innerHTML = startingArmy;
                    break;
                    }
                }
            }
        }
    
        for (let i = 0; i < countryResourceData.length; i++) {
            if (countryResourceData[i].uniqueId === countryPath.getAttribute("uniqueid")) {
            document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(countryResourceData[i].goldForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[5].innerHTML = Math.ceil(countryResourceData[i].oilForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[7].innerHTML = Math.ceil(countryResourceData[i].foodForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(countryResourceData[i].consMatsForCurrentTerritory);
            }
        }  
    
        for (let i = 0; i < arrayOfArmyAndResourceProportions.length; i++) {
            if (arrayOfArmyAndResourceProportions[i].uniqueId === countryPath.getAttribute("uniqueid")) {
                territoryArea = formatNumbersToKMB(arrayOfArmyAndResourceProportions[i].area);
                document.getElementById("bottom-table").rows[0].cells[13].innerHTML = territoryArea + " (km²)";
                break;
            }
        }          
    }

    function calculatePopulationIncrease(uniqueid, territoryPopulation, area, devIndex, food) {

        let foodCapacity = food * 1000;
        let populationGrowth = (territoryPopulation + foodCapacity - food * 500) / 100 * (1 - devIndex / 4);
        
        if (populationGrowth < 0) { // If there is a food shortage, population will shrink based on the shortage
          territoryPopulation += populationGrowth;
        } else if (populationGrowth > foodCapacity - territoryPopulation) { // Limit growth to food capacity
          territoryPopulation = foodCapacity;
        } else {
          territoryPopulation += populationGrowth;
        }
        
        let result = territoryPopulation - territoryPopulation / (1 + Math.exp(-devIndex * 10)) + area / 10000;
        
        if (area <= 22000 || territoryPopulation <= 100000) { // Apply *10 scaling factor for small situations
          result *= 10;
        } else if (area >= 6070000 || territoryPopulation >= 300000000) { // Apply /5 scaling factor for large situations
          result /= 5;
        }
      
        return result;
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