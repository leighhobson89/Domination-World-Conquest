import {paths} from "./ui.js";
import {findMatchingCountries} from "./manualExceptionsForInteractions.js";
import {mainGameArray, vehicleArmyPersonnelWorth} from "./resourceCalculations.js";

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
    console.log("Didn't find a match in determineIfStillHasTurnInThisTurn() function call, probably missing because player is the country that has the enemyTerritory.uniqueId so returning false is fine");
    return false;
}

export function retrieveArmyPowerOfTerritory(territory, defense) {
    let armyScore, assault, air, naval, useableAssault, useableAir, useableNaval;
    assault = territory.assaultForCurrentTerritory;
    air = territory.airForCurrentTerritory;
    naval = territory.navalForCurrentTerritory;
    useableAssault = territory.useableAssault;
    useableAir = territory.useableAir;
    useableNaval = territory.useableNaval;
    if (!defense) {
        armyScore = territory.armyForCurrentTerritory - ((assault - useableAssault) * vehicleArmyPersonnelWorth.assault) - ((air - useableAir) * vehicleArmyPersonnelWorth.air) - ((naval - useableNaval) * vehicleArmyPersonnelWorth.naval);
    } else {
        armyScore = (territory.armyForCurrentTerritory - ((assault - useableAssault) * vehicleArmyPersonnelWorth.assault) - ((air - useableAir) * vehicleArmyPersonnelWorth.air) - ((naval - useableNaval) * vehicleArmyPersonnelWorth.naval) * (Math.ceil((territory.defenseBonus + territory.mountainDefenseBonus) / 15)));
    }
     return armyScore;
}
export function getFriendlyTerritoriesDefenseScores(arrayOfLeadersAndCountries, currentAiCountry, i) {
    let arr = [];
    for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) { //add defense array with army power modified for defense bonus and indicate if coastal
        if (arrayOfLeadersAndCountries[i][2][j].dataName === currentAiCountry){
            arr.push([arrayOfLeadersAndCountries[i][2][j].territoryName, retrieveArmyPowerOfTerritory(arrayOfLeadersAndCountries[i][2][j], true), arrayOfLeadersAndCountries[i][2][j].isCoastal]);
        }
    }
    return arr;
}

export function calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory(attackableTerritoriesInRange, arrayOfLeadersAndCountries, fullTerritoriesInRange, arrayOfAiPlayerDefenseScoresForTerritories, i) {
    let arr = [];
    for (const territory of attackableTerritoriesInRange) {
        let friendlyTerritoryObject;
        let turnStillToCome = false;
        let armyPowerOfEnemyTerritory;
        let arrayOfTerritoryThreats = [];
        turnStillToCome = determineIfStillHasTurnInThisTurn(territory, arrayOfLeadersAndCountries, i);
        armyPowerOfEnemyTerritory = retrieveArmyPowerOfTerritory(territory, false);
        let arrayOfEnemyToFriendlyInteractibility = [];
        let friendlyTerritory;
        for (let j = 0; j < fullTerritoriesInRange.length; j++) {
            friendlyTerritory = fullTerritoriesInRange[j][0][1];
            if (fullTerritoriesInRange[j][1].some(enemyTerritory => enemyTerritory[0] === territory.territoryName)) {
                arrayOfEnemyToFriendlyInteractibility.push([friendlyTerritory, true, arrayOfAiPlayerDefenseScoresForTerritories[j][1], arrayOfAiPlayerDefenseScoresForTerritories[j][2]]);
            } else {
                arrayOfEnemyToFriendlyInteractibility.push([friendlyTerritory, false, arrayOfAiPlayerDefenseScoresForTerritories[j][1], arrayOfAiPlayerDefenseScoresForTerritories[j][2]]);
            }
            for (let k = 0; k < mainGameArray.length; k++) {
                if (friendlyTerritory[0] === mainGameArray[k].territoryName) {
                    friendlyTerritoryObject = mainGameArray[k];
                    break;
                }
            }
        }
        let threatScores = [];
        for (const friendlyTerritory of arrayOfAiPlayerDefenseScoresForTerritories) {
            let threatScore = 0;

            const enemyCanAttack = arrayOfEnemyToFriendlyInteractibility.some(
                ([friendly, canAttack]) => friendly === friendlyTerritory[0] && canAttack
            );

            if (enemyCanAttack) {
                if (!friendlyTerritory[2]) { //if not coastal
                    armyPowerOfEnemyTerritory -= territory.useableNaval * vehicleArmyPersonnelWorth.naval;
                }

                threatScore += armyPowerOfEnemyTerritory - friendlyTerritory[1]; // baseline threat score based on difference in army

                //traits
                //reconquista - DONE
                if (friendlyTerritoryObject && friendlyTerritoryObject.originalOwner === territory.dataName) {
                    let reconquistaValue = Math.abs(threatScore) * territory.leader.traits.reconquista;
                    threatScore += reconquistaValue;
                }
                //territory_expansion - DONE
                let territoryExpansionValue = Math.abs(threatScore) * territory.leader.traits.territory_expansion;
                threatScore += territoryExpansionValue;

                //dominance
                //needs taking into account when we have goals implemented if enemy territory leader has a goal to destroy ai player

                //add a minor amount if player precedes enemy territory - can be used to influence ai if any reason why this is significant is realised
                threatScore += turnStillToCome ? 1 : 0;
            } else {
                threatScore = -9999999999; //can't attack, no threat
            }
            threatScores.push([friendlyTerritory[0], threatScore]);
        }
        arrayOfTerritoryThreats.push(territory.territoryName, turnStillToCome, armyPowerOfEnemyTerritory, territory.isCoastal, threatScores);
        arr.push(arrayOfTerritoryThreats);
    }
    return arr;
}

export function calculateTurnGoal(arrayOfTerritoriesInRangeThreats) {
    let sortedThreatArrayInfo = organizeThreats(arrayOfTerritoriesInRangeThreats);
    sortedThreatArrayInfo.sort((a, b) => b[3] - a[3]);
    console.log(sortedThreatArrayInfo);
    console.log("The biggest threat is to their territory of " + sortedThreatArrayInfo[0][2].territoryName + " and comes from " + sortedThreatArrayInfo[0][0].territoryName + ", " + sortedThreatArrayInfo[0][0].dataName + " owned by " + sortedThreatArrayInfo[0][0].leader.name + " with a threat of " + sortedThreatArrayInfo[0][3]);
}

function organizeThreats(arrayOfTerritoriesInRangeThreats) {
    let arr = [];
    let enemyTerritory;
    let friendlyTerritory;
    //loop through arrayOfTerritoriesInRangeThreats - [i][4][j][1] is location of threat value from enemy enemyTerritory to friendly enemyTerritory being checked
    //make new array of threats sorted from smallest to largest - [enemyTerritoryObject, leaderOfEnemyTerritory, friendlyTerritoryAffected, threatValue]
    for (let i = 0; i < arrayOfTerritoriesInRangeThreats.length; i++) {
        for (let j = 0; j < arrayOfTerritoriesInRangeThreats[i][4].length; j++) {
            let count = 0;
            for (let k = 0; k < mainGameArray.length; k++) { //get territory objects
                if (arrayOfTerritoriesInRangeThreats[i][0] === mainGameArray[k].territoryName) {
                    enemyTerritory = mainGameArray[k];
                    count++;
                }
                if (arrayOfTerritoriesInRangeThreats[i][4][j][0] === mainGameArray[k].territoryName) {
                    friendlyTerritory = mainGameArray[k];
                    count++;
                }
                if (count > 1) {
                    break;
                }
            }
            arr.push([enemyTerritory, enemyTerritory.leader, friendlyTerritory, arrayOfTerritoriesInRangeThreats[i][4][j][1]]);
        }
    }
    return arr;
}

