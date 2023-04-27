import { pageLoaded } from "./ui.js";

// let turn = 0;
let arrayOfArmyAndResourceProportions;
export let arrayOfArmyAndResourceProportionsUI;

const turnLabel = document.getElementById('turn-label');
// turnLabel.textContent += turn;
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

                var svgFile = document.getElementById('svg-map').contentDocument;
                var pathAreas = calculatePathAreas(svgFile);

                clearInterval(intervalId);

                resolve(pathAreas);
            }
        }, 1000); // check every 1 second
    });
}

function calculatePathAreas(svgFile) {
    // Get all the path elements from the SVG file
    var paths = svgFile.querySelectorAll('path');

    // Calculate the total length of all paths
    var totalLength = 0;
    for (var i = 0; i < paths.length; i++) {
        totalLength += paths[i].getTotalLength();
    }

    // Calculate the area of each path and store it in an array
    var pathAreas = [];
    for (var i = 0; i < paths.length; i++) {
        var path = paths[i];
        var pathLength = path.getTotalLength();
        var numPoints = 80; // Change this to increase or decrease the number of points
        var points = [];
        for (var j = 0; j < numPoints; j++) {
            var point = path.getPointAtLength(j / numPoints * pathLength);
            points.push({ x: point.x, y: point.y });
        }
        var area = 0;
        for (var j = 0; j < points.length; j++) {
            var k = (j + 1) % points.length;
            area += points[j].x * points[k].y - points[j].y * points[k].x;
        }
        area = Math.abs(area / 2);
        var pathArea = area * (136067649 / totalLength);
        var dataName = path.getAttribute('data-name');
        var territoryId = path.getAttribute('territory-id');
        pathAreas.push({ dataName: dataName, territoryId: territoryId, area: pathArea });
    }

    // Return the array of path areas
    return pathAreas;
}

function assignArmyAndResourcesToPaths(pathAreas, armyResourcesDataArray) {
    // Create a new array to store the updated path data
    const newArrayOfTerritorySpecificArmyAndResources = [];

    // Loop through each element in pathAreas array
    for (var i = 0; i < pathAreas.length; i++) {
        var dataName = pathAreas[i].dataName;
        var territoryId = pathAreas[i].territoryId;
        var area = pathAreas[i].area;

        // Find matching country in armyArray
        var matchingCountry = armyResourcesDataArray.find(function(country) {
            return country.countryName === dataName;
        });

        if (matchingCountry) {
            var totalArmyForCountry = matchingCountry.totalArmyForCountry;
            var totalGoldForCountry = matchingCountry.totalGoldForCountry;
            var totalOilForCountry = matchingCountry.totalOilForCountry;
            var totalFoodForCountry = matchingCountry.totalFoodForCountry;
            var totalConsMatsForCountry = matchingCountry.totalConsMatsForCountry;
            var population = matchingCountry.population;
            var continent = matchingCountry.continente;
            var dev_index = matchingCountry.devIndex;
            var country_modifier = matchingCountry.countryModifier;
            var percentOfWholeArea = 0;

            // Calculate percentOfWholeArea based on number of paths per dataName
            var numPaths = pathAreas.filter(function(path) {
                return path.dataName === dataName;
            }).length;

            if (numPaths === 1) {
                percentOfWholeArea = 1;
            } else {
                var pathsForDataName = pathAreas.filter(function(path) {
                    return path.dataName === dataName;
                });
                var areaSum = pathsForDataName.reduce(function(acc, path) {
                    return acc + path.area;
                }, 0);
                var areaForTerritoryId = pathsForDataName.find(function(path) {
                    return path.territoryId === territoryId;
                }).area;
                percentOfWholeArea = areaForTerritoryId / areaSum;
            }

            // Calculate new army value for current element
            var armyForCurrentTerritory = totalArmyForCountry * percentOfWholeArea;
            var GoldForCurrentTerritory = totalGoldForCountry * (percentOfWholeArea * (population/10000000));
            var OilForCurrentTerritory = totalOilForCountry * (percentOfWholeArea * (area/100000));
            var FoodForCurrentTerritory = totalFoodForCountry * (percentOfWholeArea * (area/100000));
            var ConsMatsForCurrentTerritory = totalConsMatsForCountry * (percentOfWholeArea * (area/100000));

            // Add updated path data to the new array
            newArrayOfTerritorySpecificArmyAndResources.push({
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










