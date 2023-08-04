import {getSiegeObjectFromObject, paths, PROBABILITY_THRESHOLD_FOR_SIEGE} from "./ui.js";
import {findMatchingCountries} from "./manualExceptionsForInteractions.js";
import {
    calculateAvailableUpgrades,
    mainGameArray,
    maxFarms,
    maxForests,
    maxOilWells,
    territoryUpgradeBaseCostsConsMats,
    territoryUpgradeBaseCostsGold,
    vehicleArmyPersonnelWorth
} from "./resourceCalculations.js";
import {calculateProbabilityPreBattle} from "./battle.js";

const THREAT_DISREGARD_CONSTANT = -9999999999;
const MAX_AI_UPGRADES_PER_TURN = 5;

//DEBUG
let arrayOfGoldToSpendOnEconomy = [];
let arrayOfGoldToSpendOnBolster = [];
//

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
        fullTerritoriesInRange.push([
            [territory, arrayOfLeadersAndCountries[i][2][j].territoryName], attackOptionsArray[parseInt(territory)][1]
        ]); //should return every territory in json for that unique id
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
        if (arrayOfLeadersAndCountries[i][2][j].dataName === currentAiCountry) {
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

                //fortification
                //needs taking into account when we have goals implemented if enemy territory leader has a goal to destroy AI player

                //add a minor amount if player precedes enemy territory - can be used to influence AI if any reason why this is significant is realised
                threatScore += turnStillToCome ? 1 : 0;
            } else {
                threatScore = THREAT_DISREGARD_CONSTANT; //can't attack, no threat
            }
            threatScores.push([friendlyTerritory[0], threatScore]);
        }
        arrayOfTerritoryThreats.push(territory.territoryName, turnStillToCome, armyPowerOfEnemyTerritory, territory.isCoastal, threatScores);
        arr.push(arrayOfTerritoryThreats);
    }
    return arr;
}

export function calculateTurnGoals(arrayOfTerritoriesInRangeThreats) {
    let sortedThreatArrayInfo = organizeThreats(arrayOfTerritoriesInRangeThreats);
    sortedThreatArrayInfo.sort((a, b) => b[3] - a[3]);
    const leaderTraits = sortedThreatArrayInfo[0][2].leader.traits;
    // console.log("The biggest threat is to their territory of " + sortedThreatArrayInfo[0][2].territoryName + " and comes from " + sortedThreatArrayInfo[0][0].territoryName + ", " + sortedThreatArrayInfo[0][0].dataName + " owned by " + sortedThreatArrayInfo[0][0].leader.name + " with a threat of " + sortedThreatArrayInfo[0][3]);
    // console.log("Leader of " + sortedThreatArrayInfo[0][2].territoryName + " has the following traits:");
    // console.log("Type: " + sortedThreatArrayInfo[0][2].leader.leaderType + " traits:");
    // console.log(leaderTraits);
    sortedThreatArrayInfo = removeNonThreats(sortedThreatArrayInfo);
    sortedThreatArrayInfo = addProbabilitiesOfBattle(sortedThreatArrayInfo);
    return getPossibleTurnGoals(sortedThreatArrayInfo, leaderTraits);
}

function organizeThreats(arrayOfTerritoriesInRangeThreats) {
    let arr = [];
    let enemyTerritory;
    let friendlyTerritory;
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

function removeNonThreats(sortedThreatArrayInfo) {
    for (let i = sortedThreatArrayInfo.length - 1; i >= 0; i--) {
        if (sortedThreatArrayInfo[i][3] === THREAT_DISREGARD_CONSTANT) {
            sortedThreatArrayInfo.splice(i, 1);
        }
    }
    return sortedThreatArrayInfo;
}

function getPossibleTurnGoals(sortedThreatArrayInfo, leaderTraits) {
    let possibleGoalsArray = [];
    for (const threat of sortedThreatArrayInfo) {
        const threatScore = threat[3];
        const styleOfWar = leaderTraits.style_of_war;
        const territoryExpansion = leaderTraits.territory_expansion;
        const considerSiege = Math.random() >= styleOfWar;
        let considerWar = Math.random() <= territoryExpansion;
        if (considerWar) {
            considerWar = territoryExpansion <= (threat.probabilityOfWin / 100);
        }
        if (threatScore >= 0) {
            threat.probabilityOfWin >= PROBABILITY_THRESHOLD_FOR_SIEGE && considerSiege ? possibleGoalsArray.push(["Siege", threat[0].territoryName, threat[2].territoryName, threatScore, threat.probabilityOfWin]) : null;
            possibleGoalsArray.push(["Bolster", threat[0].territoryName, threat[2].territoryName, threat[2].fortsBuilt, threat[2].armyForCurrentTerritory, threat[2].isCoastal, threatScore, threat.probabilityOfWin]);
        } else {
            threat.probabilityOfWin >= PROBABILITY_THRESHOLD_FOR_SIEGE && considerSiege ? possibleGoalsArray.push(["Siege", threat[0].territoryName, threat[2].territoryName, threatScore, threat.probabilityOfWin]) : null;
            territoryExpansion <= (threat.probabilityOfWin / 100) && considerWar ? possibleGoalsArray.push(["Attack", threat[0].territoryName, threat[2].territoryName, threatScore, threat.probabilityOfWin]) : null;
        }
        possibleGoalsArray.push(["Economy", threat[2].territoryName, threat[2].farmsBuilt, threat[2].forestsBuilt, threat[2].oilWellsBuilt]);
    }
    return possibleGoalsArray;
}

function addProbabilitiesOfBattle(sortedThreatArrayInfo) {
    let probability;
    for (const threat of sortedThreatArrayInfo) {
        let preAttackArray = [threat[0].uniqueId, parseInt(threat[2].uniqueId), threat[2].infantryForCurrentTerritory, threat[2].useableAssault, threat[2].useableAir, threat[2].useableNaval];
        for (let i = 0; i < mainGameArray.length; i++) {
            if (preAttackArray[0] === mainGameArray[i].uniqueId) {
                if (!mainGameArray[i].isCoastal) {
                    preAttackArray[5] = 0;
                    break;
                }
            }
        }
        probability = calculateProbabilityPreBattle(preAttackArray, mainGameArray, false);
        threat.probabilityOfWin = probability;
        // console.log("Probability of " + threat[2].territoryName + " vs " + threat[0].territoryName + " is:" + threat.probabilityOfWin);
    }
    return sortedThreatArrayInfo;
}

export function refineTurnGoals(unrefinedGoals, currentAiCountry, leaderTraits) {
    let refinedGoals = countAndUnshiftSimilarRows(unrefinedGoals);
    refinedGoals = sumTogetherSimilarThreatValues(refinedGoals);
    refinedGoals = finalRefinementOfArrayReduceDown(refinedGoals);
    refinedGoals = upPriorityForReconquistaTerritories(refinedGoals, currentAiCountry, leaderTraits);
    return refinedGoals;
}

function countAndUnshiftSimilarRows(arr) {
    const countMapEconomy = new Map();
    const countMapBolster = new Map();
    const countMapSiege = new Map();
    const countMapAttack = new Map();

    for (const row of arr[0]) {
        if (row[0] === "Economy") {
            const key = JSON.stringify([row[0], row[1]]);
            countMapEconomy.set(key, (countMapEconomy.get(key) || 0) + 1);
        } else if (row[0] === "Bolster") {
            const key = JSON.stringify([row[0], row[2]]);
            countMapBolster.set(key, (countMapBolster.get(key) || 0) + 1);
        } else if (row[0] === "Siege") {
            const key = JSON.stringify([row[0], row[1]]);
            countMapSiege.set(key, (countMapSiege.get(key) || 0) + 1);
        } else if (row[0] === "Attack") {
            const key = JSON.stringify([row[0], row[1]]);
            countMapAttack.set(key, (countMapAttack.get(key) || 0) + 1);
        }
    }

    for (const row of arr[0]) {
        if (row[0] === "Economy") {
            const key = JSON.stringify([row[0], row[1]]);
            const count = countMapEconomy.get(key);
            row.unshift(count);
        } else if (row[0] === "Bolster") {
            const key = JSON.stringify([row[0], row[2]]);
            const count = countMapBolster.get(key);
            row.unshift(count);
        } else if (row[0] === "Siege") {
            const key = JSON.stringify([row[0], row[1]]);
            const count = countMapSiege.get(key);
            row.unshift(count);
        } else if (row[0] === "Attack") {
            const key = JSON.stringify([row[0], row[1]]);
            const count = countMapAttack.get(key);
            row.unshift(count);
        }
    }
    return arr;
}

function sumTogetherSimilarThreatValues(refinedGoalsArray) {
    const economyGroups = {};
    const bolsterGroups = {};
    const siegeGroups = {};
    const attackGroups = {};

    for (const row of refinedGoalsArray[0]) {
        const key = row[1] === "Economy" || row[1] === "Siege" || row[1] === "Attack" ? `${row[1]}_${row[2]}` : `${row[1]}_${row[3]}`;

        if (row[1] === "Economy") {
            if (!economyGroups[key]) economyGroups[key] = [];
            economyGroups[key].push(row);
        } else if (row[1] === "Bolster") {
            if (!bolsterGroups[key]) bolsterGroups[key] = [];
            bolsterGroups[key].push(row);
        } else if (row[1] === "Siege") {
            if (!siegeGroups[key]) siegeGroups[key] = [];
            siegeGroups[key].push(row);
        } else if (row[1] === "Attack") {
            if (!attackGroups[key]) attackGroups[key] = [];
            attackGroups[key].push(row);
        }
    }

    const processedEconomyGroups = [];
    for (const groupKey in economyGroups) {
        const group = economyGroups[groupKey];
        const sum = group.reduce((acc, row) => acc + row[3], 0);
        const modifiedGroup = group.map((row) => {
            const newRow = [...row];
            newRow[3] = sum;
            return newRow;
        });
        processedEconomyGroups.push(...modifiedGroup);
    }

    const processedBolsterGroups = [];
    for (const groupKey in bolsterGroups) {
        const group = bolsterGroups[groupKey];
        const sum = group.reduce((acc, row) => acc + row[7], 0);
        const modifiedGroup = group.map((row) => {
            const newRow = [...row];
            newRow[7] = sum;
            return newRow;
        });
        processedBolsterGroups.push(...modifiedGroup);
    }

    const processedSiegeGroups = [];
    for (const groupKey in siegeGroups) {
        const group = siegeGroups[groupKey];
        const sum = group.reduce((acc, row) => acc + row[4], 0);
        const modifiedGroup = group.map((row) => {
            const newRow = [...row];
            newRow[4] = sum;
            return newRow;
        });
        processedSiegeGroups.push(...modifiedGroup);
    }

    const processedAttackGroups = [];
    for (const groupKey in attackGroups) {
        const group = attackGroups[groupKey];
        const sum = group.reduce((acc, row) => acc + row[4], 0);
        const modifiedGroup = group.map((row) => {
            const newRow = [...row];
            newRow[4] = sum;
            return newRow;
        });
        processedAttackGroups.push(...modifiedGroup);
    }

    return [...processedEconomyGroups, ...processedBolsterGroups, ...processedSiegeGroups, ...processedAttackGroups];
}

function finalRefinementOfArrayReduceDown(refinedGoalsArray) {
    const filteredRefinedGoalsArray = [];

    const seenEconomy = new Set();
    const seenBolster = new Set();
    const seenSiege = new Set();
    const seenAttack = new Set();

    for (const row of refinedGoalsArray) {
        const type = row[1];
        const key = row[0];

        if (type === "Economy") {
            if (!seenEconomy.has(key)) {
                filteredRefinedGoalsArray.push(row);
                seenEconomy.add(key);
            }
        } else if (type === "Bolster") {
            const subKey = row[3];
            const compoundKey = `${key}_${subKey}`;
            if (!seenBolster.has(compoundKey)) {
                // Remove the [2] element for "Bolster" rows before pushing
                filteredRefinedGoalsArray.push([row[0], row[1], row[3], row[4], row[5], row[6], row[7], row[8]]);
                seenBolster.add(compoundKey);
            }
        } else if (type === "Siege") {
            const subKey = row[2];
            const compoundKey = `${key}_${subKey}`;
            if (!seenSiege.has(compoundKey)) {
                filteredRefinedGoalsArray.push(row);
                seenSiege.add(compoundKey);
            }
        } else if (type === "Attack") {
            const subKey = row[2];
            const compoundKey = `${key}_${subKey}`;
            if (!seenAttack.has(compoundKey)) {
                filteredRefinedGoalsArray.push(row);
                seenAttack.add(compoundKey);
            }
        } else {
            filteredRefinedGoalsArray.push(row);
        }
    }
    return filteredRefinedGoalsArray;
}

export function prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits) {
    // console.log (leaderTraits);
    // console.log("Before:");
    // console.log(refinedTurnGoals);
    refinedTurnGoals = prioritizeActions(refinedTurnGoals, leaderTraits);
    refinedTurnGoals = removeDoubleAttackSiege(refinedTurnGoals);
    // console.log("After:");
    // console.log(refinedTurnGoals);
    return refinedTurnGoals;
}

function prioritizeActions(array, leaderTraits) {
    return array.sort((a, b) => {
        const priorityA = calculatePriorityScore(a, leaderTraits);
        const priorityB = calculatePriorityScore(b, leaderTraits);
        return priorityB - priorityA; // Sort in descending order
    });
}

function calculatePriorityScore(row, leaderTraits) {
    let priorityScore = 0;

    const rowQuantitiesReduced = row[0];
    const action = row[1];

    let fortification = leaderTraits.fortification;
    let territoryExpansion = leaderTraits.territory_expansion;
    let economy = Math.random() * fortification;

    if (action === "Bolster") {
        priorityScore = rowQuantitiesReduced * fortification;
    } else if (action === "Siege") {
        priorityScore = rowQuantitiesReduced * territoryExpansion;
    } else if (action === "Attack") {
        priorityScore = rowQuantitiesReduced * territoryExpansion;
    } else if (action === "Economy") {
        priorityScore = economy;
    }

    return priorityScore;
}

function upPriorityForReconquistaTerritories(refinedTurnsGoals, currentAiCountry, leaderTraits) {
    for (let i = 0; i < refinedTurnsGoals.length; i++) {
        if (refinedTurnsGoals[i][1] === "Siege" || refinedTurnsGoals[i][1] === "Attack") {
            for (let j = 0; j < mainGameArray; j++) {
                if (mainGameArray[j].territoryName === refinedTurnsGoals[i][2]) {
                    if (mainGameArray[j].originalOwner === currentAiCountry) {
                        refinedTurnsGoals[i][0] = (refinedTurnsGoals[i][0] * leaderTraits.reconquista) + refinedTurnsGoals[i][0];
                        break;
                    }
                }
            }
        }
    }
    return refinedTurnsGoals;
}

function removeDoubleAttackSiege(arr) {
    const seenLocations = new Set();
    const seenCountries = new Set();
    const filteredArr = [];

    for (let i = 0; i < arr.length; i++) {
        const [_, type, location, country] = arr[i];

        if (type === 'Attack' || type === 'Siege') {
            const locationCountryKey = `${location}_${country}`;

            if (seenLocations.has(locationCountryKey)) {
                continue;
            } else {
                seenLocations.add(locationCountryKey);
                seenCountries.add(country);
            }
        }
        filteredArr.push(arr[i]);
    }
    return filteredArr;
}

export function doAiActions(refinedTurnGoals, leader, turnGainsArrayAi) {
    let economyBenefitArray = [];
    let bolsterBenefitArray = [];
    let siegeLaunchedFromArray = [];
    let siegeLaunchedToArray = [];
    let attackLaunchedFromArray = [];
    let attackLaunchedToArray = [];

    console.log("As a generally " + leader.leaderType.toUpperCase() + " type of leader, I am");

    for (let goalIndex = 0; goalIndex < refinedTurnGoals.length; goalIndex++) {
        const goal = refinedTurnGoals[goalIndex];
        let couldNotAffordEconomy = false;
        let mainArrayFriendlyTerritoryCopy = "no match";
        let mainArrayEnemyTerritoryCopy = "no match";

        for (let i = 0; i < mainGameArray.length; i++) {  //find territory depending on action
            let count = 0;
            if ((goal[1] !== "Siege" && goal[1] !== "Attack") && goal[2] === mainGameArray[i].territoryName) {
                mainArrayFriendlyTerritoryCopy = {
                    ...mainGameArray[i]
                };
                break;
            } else if ((goal[1] === "Siege" || goal[1] === "Attack") && goal[3] === mainGameArray[i].territoryName) {
                mainArrayFriendlyTerritoryCopy = {
                    ...mainGameArray[i]
                };
                count++;
                if (count === 2) {
                    break;
                }
            } else if ((goal[1] === "Siege" || goal[1] === "Attack") && goal[2] === mainGameArray[i].territoryName) {
                mainArrayEnemyTerritoryCopy = {
                    ...mainGameArray[i]
                };
                count++;
                if (count === 2) {
                    break;
                }
            }
        }

        switch (goal[1]) {
            case "Economy":
                if (!economyBenefitArray.includes(goal[2])) {
                    economyBenefitArray.push(goal[2]);
                    console.log("working on Economy of " + mainArrayFriendlyTerritoryCopy.territoryName + "...");
                    let goldInTerritory = mainArrayFriendlyTerritoryCopy.goldForCurrentTerritory;
                    console.log("ECONOMY gold in territory:" + goldInTerritory);
                    let consMatsInTerritory = mainArrayFriendlyTerritoryCopy.consMatsForCurrentTerritory;
                    let goldNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("gold", refinedTurnGoals, goalIndex);
                    const consMatsNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("consMats", refinedTurnGoals, goalIndex);
                    let goldToSpend = determineResourcesAvailableForThisGoal("gold", goldInTerritory, mainArrayFriendlyTerritoryCopy, goldNeedsSpendingAfterThisGoal, refinedTurnGoals, goalIndex);
                    refinedTurnGoals = goldToSpend[0];
                    goldNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("gold", refinedTurnGoals, goalIndex);
                    goldToSpend = goldToSpend[1];
                    //DEBUG
                    arrayOfGoldToSpendOnEconomy.push(goldToSpend);
                    //
                    let consMatsToSpend = determineResourcesAvailableForThisGoal("consMats", consMatsInTerritory, mainArrayFriendlyTerritoryCopy, consMatsNeedsSpendingAfterThisGoal, refinedTurnGoals, goalIndex);
                    consMatsToSpend = consMatsToSpend[1];
                    console.log("Gold to spend on this ECONOMY = " + goldToSpend);
                    console.log("ConsMats to spend on this ECONOMY = " + consMatsToSpend);
                    couldNotAffordEconomy = analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild(mainArrayFriendlyTerritoryCopy, goldToSpend, consMatsToSpend);
                }
                break;
            case "Bolster":
                let switchFactor = false; //this allows pacifist and balanced leaders a chance to reorder economy and bolster goals
                if (mainArrayFriendlyTerritoryCopy.leader.leaderType === "aggressive") {
                    switchFactor = false;
                } else if (mainArrayFriendlyTerritoryCopy.leader.leaderType === "balanced") {
                    switchFactor = Math.random() > 0.5;
                } else if (mainArrayFriendlyTerritoryCopy.leader.leaderType === "pacifist") {
                    switchFactor = Math.random() > 0.25;
                }
                if (switchFactor) {
                    const economyGoalIndex = refinedTurnGoals.findIndex((g, index) => index > goalIndex && g[1] === "Economy");
                    if (economyGoalIndex !== -1) {
                        const economyGoal = refinedTurnGoals[economyGoalIndex];
                        refinedTurnGoals[economyGoalIndex] = goal;
                        refinedTurnGoals[goalIndex] = economyGoal;
                        goalIndex--; // Decrement the index to re-visit the newly swapped "Bolster" goal
                        continue;
                    }
                }

                if (!bolsterBenefitArray.includes(goal[2])) {
                    bolsterBenefitArray.push(goal[2]);
                    console.log("bolstering Defences of " + mainArrayFriendlyTerritoryCopy.territoryName + "...");
                    let goldInTerritory = mainArrayFriendlyTerritoryCopy.goldForCurrentTerritory;
                    console.log("BOLSTER gold in territory:" + goldInTerritory);
                    let goldNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("gold", refinedTurnGoals, goalIndex);
                    let goldToSpend = determineResourcesAvailableForThisGoal("gold", goldInTerritory, mainArrayFriendlyTerritoryCopy, goldNeedsSpendingAfterThisGoal, refinedTurnGoals, goalIndex);
                    let prodPopToSpend = mainArrayFriendlyTerritoryCopy.productiveTerritoryPop;
                    refinedTurnGoals = goldToSpend[0];
                    goldNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("gold", refinedTurnGoals, goalIndex);
                    goldToSpend = goldToSpend[1];
                    console.log("Gold to spend on this BOLSTER = " + goldToSpend);
                    //DEBUG
                    arrayOfGoldToSpendOnBolster.push(goldToSpend);
                    //
                    console.log("ProdPop to spend on this bolster = " + prodPopToSpend);
                    couldNotAffordEconomy ? (console.log("Couldn't afford to upgrade, so saving half and can now spend " + (goldToSpend / 2)), goldToSpend /= 2) : console.log("Upgraded ECONOMY normally or economy not done yet, so has all stated gold for BOLSTER");
                }
                break;
            case "Siege":
                if (!siegeLaunchedFromArray.includes(goal[2])) {
                    siegeLaunchedFromArray.push(goal[3]);
                    siegeLaunchedToArray.push(goal[2]);
                    console.log("going to start a siege attack on " + mainArrayEnemyTerritoryCopy.territoryName + " from " + mainArrayFriendlyTerritoryCopy.territoryName + "...");
                }
                break;
            case "Attack":
                if (!attackLaunchedFromArray.includes(goal[2])) {
                    attackLaunchedFromArray.push(goal[3]);
                    attackLaunchedToArray.push(goal[2]);
                    console.log("going to ATTACK " + mainArrayEnemyTerritoryCopy.territoryName + " from " + mainArrayFriendlyTerritoryCopy.territoryName + "...");
                }
                break;
        }

        for (let i = 0; i < mainGameArray.length; i++) {
            let count = 0;
            if ((goal[1] !== "Siege" && goal[1] !== "Attack") && goal[2] === mainGameArray[i].territoryName) {
                mainGameArray[i] = mainArrayFriendlyTerritoryCopy;
                break;
            } else if ((goal[1] === "Siege" || goal[1] === "Attack") && goal[3] === mainGameArray[i].territoryName) {
                mainGameArray[i] = mainArrayFriendlyTerritoryCopy;
                count++;
                if (count === 2) {
                    break;
                }
            } else if ((goal[1] === "Siege" || goal[1] === "Attack") && goal[2] === mainGameArray[i].territoryName) {
                mainGameArray[i] = mainArrayEnemyTerritoryCopy;
                count++;
                if (count === 2) {
                    break;
                }
            }
        }
    }
    return refinedTurnGoals;
}

function determineIfOtherGoalNeedsResourceThisTurn(resource, refinedTurnGoals, goalIndex) {
    let count = 0

    for (let i = 0; i < refinedTurnGoals.length; i++) {
        if (i > goalIndex) { //only interested in goals not done yet for this turn
            switch (resource) {
                case "gold": //increment countGold for each goal after this requiring gold
                    if (refinedTurnGoals[i][1] === "Economy" || refinedTurnGoals[i][1] === "Bolster") {
                        count++;
                    }
                    break;
                case "consMats": //increment countConsMats for each goal after this requiring consMats
                    if (refinedTurnGoals[i][1] === "Economy") {
                        count++;
                    }
                    break;
            }
        }
    }
    return count;
}

function determineResourcesAvailableForThisGoal(resource, amountOfResourceCurrentlyInTerritory, mainArrayFriendlyTerritoryCopy, numberOfGoalsNeedingResourceAfterThisOne, refinedTurnGoals, goalIndex) {
    let resourcesAvailable;
    let count = 0;
    if (numberOfGoalsNeedingResourceAfterThisOne !== 0) {
        for (let i = 0; i < refinedTurnGoals.length; i++) {
            if (i > goalIndex) {
                if (resource === "gold") {
                    if (refinedTurnGoals[i][1] === "Bolster") {
                        let refinedTurnGoalsCopy = [...refinedTurnGoals];
                        let meanInfantryValueLacking = [];
                        for (let j = 0; j < refinedTurnGoalsCopy.length; j++) {
                            if (refinedTurnGoalsCopy[j][1] === "Bolster") {
                                meanInfantryValueLacking.push(refinedTurnGoalsCopy[j], Math.floor(refinedTurnGoalsCopy[j][6] / refinedTurnGoalsCopy[j][0]) - refinedTurnGoalsCopy[j][4]);
                            }
                        }

                        // Loop through the meanInfantryValueLacking array to find elements with negative [i][1] values as don't need bolstering so remove those jobs from bolster goals for turn
                        for (let j = 1; j < meanInfantryValueLacking.length; j += 2) {
                            if (meanInfantryValueLacking[j] < 0) {
                                const matchingElement = refinedTurnGoals.find(item => item[1] === meanInfantryValueLacking[j - 1][1] && item[2] === meanInfantryValueLacking[j - 1][2]);
                                refinedTurnGoals = refinedTurnGoals.filter(item => item !== matchingElement);
                                meanInfantryValueLacking.splice(j - 1, 2);
                                j -= 2; //watch for out of bounds exceptions  and make some condition to make this 1 if it was previously 1
                            }
                        }

                        let sumOfValues = 0;
                        for (let j = 1; j < meanInfantryValueLacking.length; j += 2) {
                            sumOfValues += meanInfantryValueLacking[j];
                        }

                        // Calculate the proportion percentage and console out each value
                        let proportionPercentage;
                        let proportionsPercentageArray = [];
                        if (sumOfValues !== 0) {
                            for (let j = 1; j < meanInfantryValueLacking.length; j += 2) {
                                const value = meanInfantryValueLacking[j];
                                proportionPercentage = value / sumOfValues * 100;
                                proportionsPercentageArray.push([meanInfantryValueLacking[j - 1], proportionPercentage]);
                            }
                        } else {
                            proportionsPercentageArray.length = 0;
                            console.log("any bolsters for this territory will receive just what is left over after economy as they are a negative mean threat level");
                            count++; //only do this if the only bolster to do in future was a negative value, and we removed it so can assume no Bolster and can just divide the money into the rest of the counts
                        }

                        //match one of the proportions up with the current refinedTurnGoals element and send the value back
                        for (let j = 0; j < proportionsPercentageArray.length; j++) {
                            if (proportionsPercentageArray[j][0][1] === refinedTurnGoals[i][1] && proportionsPercentageArray[j][0][2] === refinedTurnGoals[i][2]) {
                                count = Math.floor((refinedTurnGoals[i][0] / 100) * proportionsPercentageArray[j][1]);
                                count === 0 ? count = 1 : null;
                            }
                        }

                    } else if (refinedTurnGoals[i][1] === "Economy") {
                        count++;
                    }
                } else if (resource === "consMats") {
                    count++;
                }
            }
        }
        resourcesAvailable = Math.floor(amountOfResourceCurrentlyInTerritory / count);
    } else {
        resourcesAvailable = Math.floor(amountOfResourceCurrentlyInTerritory);
    }
    return [refinedTurnGoals, resourcesAvailable];
}

function analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild(territory, goldToSpend, consMatsToSpend) {
    let siege = getSiegeObjectFromObject(territory);
    if (siege) {
        console.log("Cannot upgrade at all if under siege!");
        console.log("But currently has:  Farm: " + territory.farmsBuilt + " Forest: " + territory.forestsBuilt + " Oil Wells: " + territory.oilWellsBuilt + " Forts:" + territory.fortsBuilt);
        console.log("Siege version says: Farm: " + siege.defendingTerritory.farmsBuilt + " Forest: " + siege.defendingTerritory.forestsBuilt + " Oil Wells: " + siege.defendingTerritory.oilWellsBuilt + " Forts:" + siege.defendingTerritory.fortsBuilt)
        return "Sieged";
    }

    let couldNotAffordEconomy = false;

    let buildList = [];
    let availableUpgrades = calculateAvailableUpgrades(territory);
    let farm = availableUpgrades[0];
    let forest = availableUpgrades[1];
    let oilWell = availableUpgrades[2];

    let farmGoldBaseCost = territoryUpgradeBaseCostsGold.farm;
    let farmConsMatsBaseCost = territoryUpgradeBaseCostsConsMats.farm;
    let forestGoldBaseCost = territoryUpgradeBaseCostsGold.forest;
    let forestConsMatsBaseCost = territoryUpgradeBaseCostsConsMats.forest;
    let oilWellGoldBaseCost = territoryUpgradeBaseCostsGold.oilWell;
    let oilWellConsMatsBaseCost = territoryUpgradeBaseCostsConsMats.oilWell;

    availableUpgrades[0].goldCost = Math.ceil((farmGoldBaseCost * (territory.farmsBuilt + 1) * ((territory.farmsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
    availableUpgrades[0].consMatsCost = Math.ceil((farmConsMatsBaseCost * (territory.farmsBuilt + 1)  * ((territory.farmsBuilt + 1)  * 1.1)) * (territory.devIndex / 4));
    availableUpgrades[1].goldCost = Math.ceil((forestGoldBaseCost * (territory.forestsBuilt + 1) * ((territory.forestsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
    availableUpgrades[1].consMatsCost = Math.ceil((forestConsMatsBaseCost * (territory.forestsBuilt + 1)  * ((territory.forestsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));
    availableUpgrades[2].goldCost = Math.ceil((oilWellGoldBaseCost * (territory.oilWellsBuilt + 1) * ((territory.oilWellsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
    availableUpgrades[2].consMatsCost = Math.ceil((oilWellConsMatsBaseCost * (territory.oilWellsBuilt + 1)  * ((territory.oilWellsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));

    let buildAgain = (Math.random() * 10 + 1) >= 5;

    let points = {
        farm: {},
        forest: {},
        oilWell: {}
    };

    let forestWorkAround = false; // sometimes the cost of a forest upgrade in consMats is too much for the country when it has max consmats, so this helps it out to allow it to reach max forests and reach its potential

    if (farm.goldCost > goldToSpend && forest.goldCost > goldToSpend && oilWell.goldCost > goldToSpend) {
        couldNotAffordEconomy = true;
    }
    console.log("GOLD cost: Farm: " + farm.goldCost + " Forest: " + forest.goldCost + " OilWell: " + oilWell.goldCost);
    console.log("CONSMATS cost: Farm: " + farm.consMatsCost + " Forest: " + forest.consMatsCost + " OilWell: " + oilWell.consMatsCost);
    while (!forestWorkAround && buildAgain && (farm.goldCost <= goldToSpend && farm.consMatsCost < consMatsToSpend) || (forest.goldCost <= goldToSpend && forest.consMatsCost < consMatsToSpend) || (oilWell.goldCost <= goldToSpend && oilWell.consMatsCost < consMatsToSpend)) {
        let farm = availableUpgrades[0];
        let forest = availableUpgrades[1];
        let oilWell = availableUpgrades[2];

        if (territory.farmsBuilt < maxFarms && farm.goldCost <= goldToSpend && farm.consMatsCost <= consMatsToSpend) {
            points.farm.value = Math.random() * 10 + 1;
            if (territory.foodConsumption > territory.foodCapacity) {
                points.farm.value += 10;
            } else if (territory.foodConsumption <= territory.foodCapacity) {
                points.farm.value += 5;
            }
        }
        if (territory.forestsBuilt < maxForests && forest.goldCost <= goldToSpend && forest.consMatsCost <= consMatsToSpend) {
            points.forest.value = Math.random() * 10 + 1;
            if (territory.consMatsCapacity < territory.consMatsForCurrentTerritory) {
                points.forest.value += 10
            } else if (territory.consMatsCapacity >= territory.consMatsForCurrentTerritory) {
                points.forest.value += 5
            }
        }
        if (territory.oilWellsBuilt < maxOilWells && oilWell.goldCost <= goldToSpend && oilWell.consMatsCost <= consMatsToSpend) {
            points.oilWell.value = Math.random() * 10 + 1;
            if (territory.oilDemand > territory.oilCapacity) {
                points.oilWell.value += 10;
            } else if (territory.oilDemand <= territory.oilCapacity) {
                points.oilWell.value += 5;
            }
        }

        const largestDesire = Object.entries(points).reduce((prev, [name, value]) => {
            return value.value > prev[1] ? [name, value.value] : prev;
        }, ["", -Infinity]);

        points.farm.value = 0;
        points.forest.value = 0;
        points.oilWell.value = 0;

        let objectProperty = largestDesire[0] + "sBuilt";
        console.log("Farm Points: " + points.farm.value + " Forest Points: " + points.forest.value + " OilWell Points: " + points.oilWell.value);

        let maxType;
        if (largestDesire[0] === "farm") {
            maxType = maxFarms;
        } else if (largestDesire[0] === "forest") {
            maxType = maxForests;
        } else if (largestDesire[0] === "oilWell") {
            maxType = maxOilWells;
        }

        if (largestDesire[1] !== -Infinity && territory[objectProperty] < maxType) {
            console.log("Opting to build: " + largestDesire[0])
            let selectedUpgrade;
            if (largestDesire[0] === "farm") {
                selectedUpgrade = farm;
            } else if (largestDesire[0] === "forest") {
                selectedUpgrade = forest;
                if (territory.consMatsCapacity <= territory.consMatsForCurrentTerritory && consMatsToSpend < availableUpgrades[0].consMatsCost) {
                    consMatsToSpend = territory.consMatsForCurrentTerritory; //work around to help blockage of consmats for AIs
                    forestWorkAround = true;
                    console.log("boosted consMats spending to get a forest!  This one will be the " + (territory.forestsBuilt + 1) + "th!");
                }
            } else if (largestDesire[0] === "oilWell") {
                selectedUpgrade = oilWell;
            }

            buildList.push([largestDesire[0], selectedUpgrade]);
            goldToSpend -= selectedUpgrade.goldCost;
            consMatsToSpend -= selectedUpgrade.consMatsCost;
            territory.goldForCurrentTerritory -= selectedUpgrade.goldCost;
            territory.consMatsForCurrentTerritory -= selectedUpgrade.consMatsCost;
            territory[objectProperty]++;
            let newGoldCost;
            let newConsMatsCost;

            if (largestDesire[0] === "farm") {
                newGoldCost = Math.ceil((farmGoldBaseCost * (territory.farmsBuilt + 1) * ((territory.farmsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
                newConsMatsCost = Math.ceil((farmConsMatsBaseCost * (territory.farmsBuilt + 1) * ((territory.farmsBuilt + 1)  * 1.1)) * (territory.devIndex / 4));
            } else if (largestDesire[0] === "forest") {
                newGoldCost = Math.ceil((forestGoldBaseCost * (territory.forestsBuilt + 1) * ((territory.forestsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
                newConsMatsCost = Math.ceil((forestConsMatsBaseCost * (territory.forestsBuilt + 1) * ((territory.forestsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));
            } else if (largestDesire[0] === "oilWell") {
                newGoldCost = Math.ceil((oilWellGoldBaseCost * (territory.oilWellsBuilt + 1) * ((territory.oilWellsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
                newConsMatsCost = Math.ceil((oilWellConsMatsBaseCost * (territory.oilWellsBuilt + 1)  * ((territory.oilWellsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));
            }

            availableUpgrades = calculateAvailableUpgrades(territory);

            if (largestDesire[0] === "farm") {
                availableUpgrades[0].goldCost = newGoldCost;
                availableUpgrades[0].consMatsCost = newConsMatsCost;
            } else if (largestDesire[0] === "forest") {
                availableUpgrades[1].goldCost = newGoldCost;
                availableUpgrades[1].consMatsCost = newConsMatsCost;
            } else if (largestDesire[0] === "oilWell") {
                availableUpgrades[2].goldCost = newGoldCost;
                availableUpgrades[2].consMatsCost = newConsMatsCost;
            }

            buildAgain = (Math.random() * 10 + 1) >= 5;
            if (buildList && buildList.length >= MAX_AI_UPGRADES_PER_TURN) {
                break;
            } else {
                buildAgain = (Math.random() * 10 + 1) >= 5;
            }
        } else {
            break;
        }
    }
    buildList.length > 0 ? console.log("Upgrading Complete for " + territory.territoryName) : console.log("Couldn't complete any upgrades, lacked one or other resource");
    console.log("Built: ");
    for (const buildListKey in buildList) {
        let name = buildList[buildListKey][0];
        console.log(name);
    }
    console.log("Now have Farms: " + territory.farmsBuilt + " Forests: " + territory.forestsBuilt + " OilWells " + territory.oilWellsBuilt);
    return couldNotAffordEconomy;
}

//DEBUG
export function getArrayOfGoldToSpendOnEconomy() {
    return arrayOfGoldToSpendOnEconomy;
}

export function getArrayOfGoldToSpendOnBolster() {
    return arrayOfGoldToSpendOnBolster;
}

export function setDebugArraysToZero() {
    arrayOfGoldToSpendOnEconomy.length = 0;
    arrayOfGoldToSpendOnBolster.length = 0;
}
//