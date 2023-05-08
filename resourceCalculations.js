import { pageLoaded } from './ui.js';
import { currentTurn } from './gameTurnsLoop.js';
import { territoryPopUnformatted, exportPop, exportPopUnformatted } from './ui.js';
import { exportArea, exportAreaUnformatted } from './ui.js';
import { exportArmy, exportArmyUnformatted } from './ui.js';
import { exportGold, exportOil, exportFood, exportConsMats } from './ui.js';
import { formatNumbersToKMB } from './ui.js';

let arrayOfArmyAndResourceProportions;
export let arrayOfArmyAndResourceProportionsUI;
export const newArrayOfTerritorySpecificArmyAndResources = [];

let totalPlayerResources = [];
let continentModifier;

/* const turnLabel = document.getElementById('turn-label'); */
if (!pageLoaded) {
    Promise.all([listenForPageLoad(), connectAndCreateArmyArray()])
        .then(([pathAreas, armyArray]) => {
            arrayOfArmyAndResourceProportions = randomiseArmyAndResources(arrayOfArmyAndResourceProportions);
            arrayOfArmyAndResourceProportionsUI = arrayOfArmyAndResourceProportions;
        })
        .catch(error => {
            console.log(error);
        });
}

function listenForPageLoad() {
    return new Promise((resolve, reject) => {
        let intervalId = setInterval(function() {
            if (pageLoaded === true) {

                let svgFile = document.getElementById('svg-map').contentDocument;
                let pathAreas = calculatePathAreas(svgFile);

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

    // Calculate the total length of all paths
    let totalLength = 0;
    for (var i = 0; i < paths.length; i++) {
        totalLength += paths[i].getTotalLength();
    }

    // Calculate the area of each path and store it in an array
    let totalArea = 0;
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
        totalArea += area;
        let uniqueId = path.getAttribute('uniqueid');
        let dataName = path.getAttribute('data-name');
        let territoryId = path.getAttribute('territory-id');
        pathAreas.push({ uniqueId: uniqueId, dataName: dataName, territoryId: territoryId, area: area });
    }
    
    // Calculate the scaling factor
    let scalingFactor = 136067649 / totalArea;
    
    // Scale the area of each path to its actual area in km2
    for (let i = 0; i < pathAreas.length; i++) {
        pathAreas[i].area *= scalingFactor;
    }
    
    // Return the array of path areas
    return pathAreas;
}

function assignArmyAndResourcesToPaths(pathAreas, armyResourcesDataArray) {
    // Create a new array to store the updated path data

    // Loop through each element in pathAreas array
    for (let i = 0; i < pathAreas.length; i++) {
        let uniqueId = pathAreas[i].uniqueId;
        let dataName = pathAreas[i].dataName;
        let territoryId = pathAreas[i].territoryId;
        let area = pathAreas[i].area;

        // Find matching country in armyArray
        let matchingCountry = armyResourcesDataArray.find(function(country) {
            return country.countryName === dataName;
        });

        if (matchingCountry) {
            let totalArmyForCountry = matchingCountry.totalArmyForCountry;
            let totalGoldForCountry = matchingCountry.totalGoldForCountry;
            let totalOilForCountry = matchingCountry.totalOilForCountry;
            let totalFoodForCountry = matchingCountry.totalFoodForCountry;
            let totalConsMatsForCountry = matchingCountry.totalConsMatsForCountry;
            let population = matchingCountry.population;
            let continent = matchingCountry.continente;
            let dev_index = matchingCountry.devIndex;
            let country_modifier = matchingCountry.countryModifier;
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
            newArrayOfTerritorySpecificArmyAndResources.push({
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
    return newArrayOfTerritorySpecificArmyAndResources;
}

function connectAndCreateArmyArray() {
    return listenForPageLoad().then(pathAreas => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "http://localhost:8000/getCountryDataForArmyAndResourceCalculation.php", true);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.onreadystatechange = function () {
                if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
                    // Parse the response JSON data
                    const data = JSON.parse(xhr.responseText);

                    const armyAndResourceArray = [];

                    for (let i = 0; i < data.length; i++) {
                        armyAndResourceArray.push({
                            countryName: data[i].country,
                            population: data[i].startingPop,
                            totalArmyForCountry: data[i].startingArmy,
                            totalGoldForCountry: data[i].res_gold,
                            totalOilForCountry: data[i].res_oil,
                            totalFoodForCountry: data[i].res_food,
                            totalConsMatsForCountry: data[i].res_cons_mats,
                            continente: data[i].continent,
                            devIndex: data[i].dev_index,
                            countryModifier: data[i].country_modifier
                        });
                    }
                    arrayOfArmyAndResourceProportions = assignArmyAndResourcesToPaths(pathAreas, armyAndResourceArray);
                    resolve(arrayOfArmyAndResourceProportions);
                }
            };
            xhr.send();
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
    let totalArea = [];
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
        document.getElementById("top-table").rows[0].cells[3].innerHTML = Math.ceil(exportGold);
        document.getElementById("top-table").rows[0].cells[5].innerHTML = Math.ceil(exportOil);
        document.getElementById("top-table").rows[0].cells[7].innerHTML = Math.ceil(exportFood);
        document.getElementById("top-table").rows[0].cells[9].innerHTML = Math.ceil(exportConsMats);
        document.getElementById("top-table").rows[0].cells[11].innerHTML = exportPop;
        document.getElementById("top-table").rows[0].cells[13].innerHTML = exportArea + " (km²)";
        document.getElementById("top-table").rows[0].cells[15].innerHTML = exportArmy;

        totalPlayerResources = [exportGold, exportOil, exportFood, exportConsMats, parseInt(exportPopUnformatted), exportAreaUnformatted, exportArmyUnformatted];
    } else {
        //add up resources from all territories and put in top-table
        for (let i = 0; i < playerOwnedTerritories.length; i++) {
            for (let j = 0; j < arrayOfArmyAndResourceProportionsUI.length; j++) {
                if (playerOwnedTerritories[i].getAttribute("uniqueid") === arrayOfArmyAndResourceProportionsUI[j].uniqueId) {
                    //call functions to update players country:
                    changeArrayForTerritory = calculateTerritoryResourceIncomesEachTurn(territoryPopUnformatted, arrayOfArmyAndResourceProportionsUI[j].area, parseFloat(arrayOfArmyAndResourceProportionsUI[j].devIndex), arrayOfArmyAndResourceProportionsUI[j].continent);        
                    //resources
                    totalGoldChange.push(changeArrayForTerritory[0]);
                    totalOilChange.push(changeArrayForTerritory[1]);
                    totalFoodChange.push(changeArrayForTerritory[2]);
                    totalConsMatsChange.push(changeArrayForTerritory[3]);
                    //population
                    totalPopChange.push(changeArrayForTerritory[4]);
                    //area
                    totalArea.push(arrayOfArmyAndResourceProportionsUI[j].area);

                    arrayOfArmyAndResourceProportionsUI[j].goldForCurrentTerritory = changeArrayForTerritory[0];
                    arrayOfArmyAndResourceProportionsUI[j].oilForCurrentTerritory = changeArrayForTerritory[1];
                    arrayOfArmyAndResourceProportionsUI[j].foodForCurrentTerritory = changeArrayForTerritory[2];
                    arrayOfArmyAndResourceProportionsUI[j].consMatsForCurrentTerritory = changeArrayForTerritory[3];
                }
            }
        }
        
        totalGoldChange = totalGoldChange.reduce((a, b) => a + b, 0);
        totalOilChange = totalOilChange.reduce((a, b) => a + b, 0);
        totalFoodChange = totalFoodChange.reduce((a, b) => a + b, 0);
        totalConsMatsChange = totalConsMatsChange.reduce((a, b) => a + b, 0);
        totalPopChange = totalPopChange.reduce((a, b) => a + b, 0);
        totalArea = totalArea.reduce((a, b) => a + b, 0);

        totalPlayerResources[0] += totalGoldChange;
        totalPlayerResources[1] += totalOilChange;
        totalPlayerResources[2] += totalFoodChange;
        totalPlayerResources[3] += totalConsMatsChange;
        totalPlayerResources[4] += totalPopChange;
        totalPlayerResources[5] = totalArea;
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

    function calculateTerritoryResourceIncomesEachTurn(currentPop, territoryArea, devIndex, continent) {
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
        const baseIncrease = Math.sqrt(territoryArea) * 100;
        changeArray[0] = totalPlayerResources[0] + ((baseIncrease * continentModifier * devIndex) * (currentPop / 1000000000));
        changeArray[1] = totalPlayerResources[1] + ((baseIncrease * continentModifier * devIndex) * (currentPop / 1000000000));
        changeArray[2] = totalPlayerResources[2] + ((baseIncrease * continentModifier * devIndex) * (currentPop / 1000000000));
        changeArray[3] = totalPlayerResources[3] + ((baseIncrease * continentModifier * devIndex) * (currentPop / 1000000000));
        changeArray[4] = totalPlayerResources[4] + ((baseIncrease * (1 - devIndex * continentModifier)) * (currentPop / 1000000));
        return changeArray;
      }
    }










