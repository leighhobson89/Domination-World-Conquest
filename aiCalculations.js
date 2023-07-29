import {paths} from "./ui.js";
import {findMatchingCountries} from "./manualExceptionsForInteractions.js";
import {vehicleArmyPersonnelWorth} from "./resourceCalculations.js";

function parseJSON(jsonData) {
    try {
        return JSON.parse(jsonData);
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
    }
}

function fetchJSONFile(url) {
    return fetch(url)
        .then(response => response.text())
        .then(data => parseJSON(data));
}

export function readClosestPointsJSON(uniqueId) {
    const jsonFileURL = './resources/closestPathsData.json';
    return fetchJSONFile(jsonFileURL)
        .then(data => {
            const targetData = data.find(entry => entry[0] === uniqueId.toString());
            if (targetData) {
                return [uniqueId, targetData[1]];
            } else {
                console.error("Error: Territory ID not found in JSON data.");
                return null;
            }
        })
        .catch(error => {
            console.error("Error fetching and parsing JSON file:", error);
            return null;
        });
}

export function addManualExceptionsAndRemoveDenials(allInteractableTerritoriesForUniqueId) {
    let pathObj;
    let matchingTerritories;
    let matchingDenials;

    const territory = allInteractableTerritoriesForUniqueId[1][0][0];
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("territory-name") === territory) {
            pathObj = paths[i];
            break;
        }
    }
    matchingTerritories = findMatchingCountries(pathObj, 1);
    matchingDenials = findMatchingCountries(pathObj, 0);

    const territoriesToAdd = matchingTerritories
        .filter((matchingTerritory) => {
            const territoryName = matchingTerritory.getAttribute("territory-name");
            return !allInteractableTerritoriesForUniqueId[1].some((arr) => arr.includes(territoryName));
        })
        .map((matchingTerritory) => matchingTerritory.getAttribute("territory-name"));

    for (const territory of territoriesToAdd) {
        allInteractableTerritoriesForUniqueId[1].push([territory]);
    }

    const matchingDenialsNames = matchingDenials.map((denial) => denial.getAttribute("territory-name"));
    allInteractableTerritoriesForUniqueId[1] = allInteractableTerritoriesForUniqueId[1].filter((arr) => {
        const territoryName = arr[0];
        return !matchingDenialsNames.includes(territoryName);
    });

    return allInteractableTerritoriesForUniqueId;
}

function formatAttackableTerritoriesArray(arr) {
    const uniqueElements = {};
    let result = [];

    for (const [name, coordinates, distance] of arr) {
        if (!uniqueElements[name]) {
            uniqueElements[name] = true;
            result.push([name, coordinates, distance]);
        }
    }

    result = result.map(item => item[0]);

    return result;
}

export function buildFullTerritoriesInRangeArray(arrayOfLeadersAndCountries, attackOptionsArray, i) {
    let fullTerritoriesInRange = [];
    for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) { //array of all AI players[whichAi][mainArrayObjectArrayForTerritoriesOwned]
        let territory = arrayOfLeadersAndCountries[i][2][j].uniqueId;
        fullTerritoriesInRange.push([[territory, arrayOfLeadersAndCountries[i][2][j].territoryName], attackOptionsArray[parseInt(territory)][1]]); //should return every territory in json for that unique id
    }
    return fullTerritoriesInRange;
}

export function buildAttackableTerritoriesInRangeArray(arrayOfLeadersAndCountries, fullTerritoriesInRange, i) {
    let attackableTerritoriesInRange = [];

    for (let j = 0; j < fullTerritoriesInRange.length; j++) {
        let isOwned = false;

        for (let k = 0; k < fullTerritoriesInRange[j][1].length; k++) {
            const territoryNameToCheck = fullTerritoriesInRange[j][1][k][0];
            for (let l = 0; l < arrayOfLeadersAndCountries[i][2].length; l++) {
                const ownedTerritoryName = arrayOfLeadersAndCountries[i][2][l].territoryName;
                if (territoryNameToCheck === ownedTerritoryName) {
                    isOwned = true;
                    break;
                }
            }
            if (!isOwned) {
                attackableTerritoriesInRange.push(fullTerritoriesInRange[j][1][k]);
            }
            isOwned = false;
        }
    }
    attackableTerritoriesInRange = formatAttackableTerritoriesArray(attackableTerritoriesInRange);
    return attackableTerritoriesInRange;
}

export function convertAttackableArrayStringsToMainArrayObjects(attackableTerritoriesInRange, paths, mainGameArray) {
    for (let i = 0; i < paths.length; i++) {
        for (let j = 0; j < mainGameArray.length; j++) {
            if (paths[i].getAttribute("uniqueid") === mainGameArray[j].uniqueId) {
                for (let k = 0; k < attackableTerritoriesInRange.length; k++) {
                    if (attackableTerritoriesInRange[k] === paths[i].getAttribute("territory-name")) {
                        attackableTerritoriesInRange[k] = mainGameArray[j];
                        break;
                    }
                }
                break;
            }
        }
    }
    return attackableTerritoriesInRange;
}

export function determineIfStillHasTurnInThisTurn(enemyTerritory, arrayOfLeadersAndCountries, aiPlayerIndex) {
    for (let i = 0; i < arrayOfLeadersAndCountries.length; i++) {
        const territoryArray = arrayOfLeadersAndCountries[i][2];
        for (let j = 0; j < territoryArray.length; j++) {
            if (territoryArray[j].uniqueId === enemyTerritory.uniqueId) {
                return i > aiPlayerIndex;
            }
        }
    }
    console.log("Didn't find a match in determineIfStillHasTurnInThisTurn() function call");
    return false;
}

export function retrieveArmyPowerOfTerritoryInRange(enemyTerritory) {
    let enemyTerritoryPotentialArmyTotalValue, enemyAssault, enemyAir, enemyNaval, useableEnemyAssault, useableEnemyAir, useableEnemyNaval;
    enemyAssault = enemyTerritory.assaultForCurrentTerritory;
    enemyAir = enemyTerritory.airForCurrentTerritory;
    enemyNaval = enemyTerritory.navalForCurrentTerritory;
    useableEnemyAssault = enemyTerritory.useableAssault;
    useableEnemyAir = enemyTerritory.useableAir;
    useableEnemyNaval = enemyTerritory.useableNaval;
    enemyTerritoryPotentialArmyTotalValue = enemyTerritory.armyForCurrentTerritory - ((enemyAssault - useableEnemyAssault) * vehicleArmyPersonnelWorth.assault) - ((enemyAir - useableEnemyAir) * vehicleArmyPersonnelWorth.air) - ((enemyNaval - useableEnemyNaval) * vehicleArmyPersonnelWorth.naval);
    return enemyTerritoryPotentialArmyTotalValue;
}

