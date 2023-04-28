import { pageLoaded } from './ui.js';
import { currentTurn } from './gameTurnsLoop.js';
import { countryResourceData } from './ui.js';
import { exportPop } from './ui.js';
import { exportArea } from './ui.js';
import { startingArmy } from './ui.js';

let arrayOfArmyAndResourceProportions;
export let arrayOfArmyAndResourceProportionsUI;
export const newArrayOfTerritorySpecificArmyAndResources = [];

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
                console.log(pageLoaded);

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

            // Calculate new army value for current element
            let armyForCurrentTerritory = totalArmyForCountry * percentOfWholeArea;
            let GoldForCurrentTerritory = totalGoldForCountry * (percentOfWholeArea * (population/10000000));
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
    console.log(newArrayOfTerritorySpecificArmyAndResources);
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
        let randomGoldFactor = Math.floor(Math.random() * 60) + 2;
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
    let totalGold = 0;
    let totalOil;
    let totalFood;
    let totalConsMats;
    let totalArea;
    let totalPop;
    let totalArmy;
    let playerDevIndex;

    //read all paths and add all those with "owner = 'player'" to an array
    const svgMap = document.getElementById('svg-map').contentDocument;
    const paths = Array.from(svgMap.querySelectorAll('path'));
    let playerOwnedTerritories = [];

    for (const path of paths) {
        if (path.getAttribute("owner") === "player") {
            playerOwnedTerritories.push(path);
        }
    }
    for (let i = 0; i < playerOwnedTerritories.length; i++) {
        console.log("Player owns:" + playerOwnedTerritories[i].getAttribute("data-name") + " [" + playerOwnedTerritories[i].getAttribute("territory-id") + "]");
    }

    if (currentTurn === 1) {
        document.getElementById("top-table").rows[0].cells[0].style.whiteSpace = "pre";
/*      document.getElementById("top-table").rows[0].cells[2].innerHTML = Math.ceil(countryResourceData.goldForCurrentTerritory);
        document.getElementById("top-table").rows[0].cells[4].innerHTML = Math.ceil(countryResourceData.oilForCurrentTerritory);
        document.getElementById("top-table").rows[0].cells[6].innerHTML = Math.ceil(countryResourceData.foodForCurrentTerritory);
        document.getElementById("top-table").rows[0].cells[8].innerHTML = Math.ceil(countryResourceData.consMatsForCurrentTerritory); */
        document.getElementById("top-table").rows[0].cells[10].innerHTML = exportPop;
        document.getElementById("top-table").rows[0].cells[12].innerHTML = exportArea + " (km²)";
        document.getElementById("top-table").rows[0].cells[14].innerHTML = startingArmy;
    } else {
        console.log(arrayOfArmyAndResourceProportionsUI);
        //add up resources from all territories and put in top-table
        for (let i = 0; i < playerOwnedTerritories.length; i++) {
            for (let j = 0; j < arrayOfArmyAndResourceProportionsUI.length; j++) {
                if (playerOwnedTerritories[i].getAttribute("uniqueid") === arrayOfArmyAndResourceProportionsUI[j].uniqueId) {
                    //todo                    
                }
            }
        }
        console.log("New Total Gold: " + totalGold);
    }
    
    //for each territory in the array apply calculations based on population, 
    //area, dev_index, country_modifier, upgrade level to augment the various resource levels
    //apply a bonus for total area of all owned territories
    //add these values to the existing values
    //set these new totals in the table
    //return a popup to the user with a confirm button to remove it, stating what the player gained that turn
}










