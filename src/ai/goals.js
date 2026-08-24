// Goals: turning a list of threats into a ranked list of things to do this turn.
//
// Refactor plan Phase 5.5. The AI's second stage. `threat.js` says how dangerous everything
// is; this decides what to do about it, and `aiCalculations.js` carries it out.
//
// The pipeline is four passes over the same array, and the shape changes at each one, which
// is why the intermediate helpers are worth naming:
//
//   organizeThreats()      one row per (enemy territory, friendly territory) pair
//   removeNonThreats()     drops the pairs that cannot physically reach each other
//   addProbabilitiesOfBattle()  attaches the odds of each pairing
//   getPossibleTurnGoals() one or two GOAL rows per pair: Siege / Attack / Bolster / Economy
//   refineTurnGoals()      collapses duplicate goals, summing their threat, and counts them
//   prioritiseTurnGoals... sorts by the leader's personality and drops contradictory pairs
//
// A goal row is `[count, type, ...type-specific fields]` after refinement, and
// `[type, ...fields]` before it -- `countAndUnshiftSimilarRows()` is what puts the count on
// the front, which is why every later function reads the type at `[1]` and the earlier ones
// read it at `[0]`.
//
// Two dependencies are INJECTED rather than imported, which is what keeps this module free
// of `ui.js` and runnable in Node:
//
//   `rng`             the seeded per-country stream from `ai/rng.js`
//   `probabilityFor`  the pre-battle odds. In the game this is
//                     `calculateProbabilityPreBattle()` in battle.js, which also caches the
//                     modifiers a mid-battle recalculation needs -- a side effect this
//                     module has no business knowing about, and does not.

import {
    PROBABILITY_THRESHOLD_FOR_SIEGE,
    THREAT_DISREGARD_CONSTANT
} from "../config/balance.js";
import { allTerritories } from "../state/selectors.js";

/**
 * Every goal this country could pursue this turn, before refinement.
 *
 * @param {Array} arrayOfTerritoriesInRangeThreats  from `threat.js`
 * @param {{rng: () => number, probabilityFor: (attackArray: Array, territories: Array) => number}} deps
 */
export function calculateTurnGoals(arrayOfTerritoriesInRangeThreats, deps) {
    let sortedThreatArrayInfo = organizeThreats(arrayOfTerritoriesInRangeThreats);
    sortedThreatArrayInfo.sort((a, b) => b[3] - a[3]);

    //audit 5.1 AG. Every goal an AI country makes is derived from a threat, so a country
    //with no attackable enemy territory in range has nothing to plan. That is a perfectly
    //ordinary state once the AI can actually conquer -- a country whose neighbours are now
    //all its own -- but `sortedThreatArrayInfo[0][2]` threw on the empty array, and the
    //uncaught rejection took the whole game loop with it.
    if (sortedThreatArrayInfo.length === 0) {
        console.log("No enemy territory in range this turn -- no goals to plan");
        return [];
    }

    const leaderTraits = sortedThreatArrayInfo[0][2].leader.traits;
    // console.log("The biggest threat is to their territory of " + sortedThreatArrayInfo[0][2].territoryName + " and comes from " + sortedThreatArrayInfo[0][0].territoryName + ", " + sortedThreatArrayInfo[0][0].dataName + " owned by " + sortedThreatArrayInfo[0][0].leader.name + " with a threat of " + sortedThreatArrayInfo[0][3]);
    // console.log("Leader of " + sortedThreatArrayInfo[0][2].territoryName + " has the following traits:");
    // console.log("Type: " + sortedThreatArrayInfo[0][2].leader.leaderType + " traits:");
    // console.log(leaderTraits);
    sortedThreatArrayInfo = removeNonThreats(sortedThreatArrayInfo);
    sortedThreatArrayInfo = addProbabilitiesOfBattle(sortedThreatArrayInfo, deps.probabilityFor);
    return getPossibleTurnGoals(sortedThreatArrayInfo, leaderTraits, deps.rng);
}

function organizeThreats(arrayOfTerritoriesInRangeThreats) {
    const arr = [];
    let enemyTerritory;
    let friendlyTerritory;
    for (let i = 0; i < arrayOfTerritoriesInRangeThreats.length; i++) {
        for (let j = 0; j < arrayOfTerritoriesInRangeThreats[i][4].length; j++) {
            let count = 0;
            for (let k = 0; k < allTerritories().length; k++) { //get territory objects
                if (arrayOfTerritoriesInRangeThreats[i][0] === allTerritories()[k].territoryName) {
                    enemyTerritory = allTerritories()[k];
                    count++;
                }
                if (arrayOfTerritoriesInRangeThreats[i][4][j][0] === allTerritories()[k].territoryName) {
                    friendlyTerritory = allTerritories()[k];
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

function getPossibleTurnGoals(sortedThreatArrayInfo, leaderTraits, rng) {
    const possibleGoalsArray = [];
    for (const threat of sortedThreatArrayInfo) {
        const threatScore = threat[3];
        const styleOfWar = leaderTraits.style_of_war;
        const territoryExpansion = leaderTraits.territory_expansion;
        const considerSiege = rng() >= styleOfWar;
        let considerWar = rng() <= territoryExpansion;
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

function addProbabilitiesOfBattle(sortedThreatArrayInfo, probabilityFor) {
    let probability;
    for (const threat of sortedThreatArrayInfo) {
        const preAttackArray = [threat[0].uniqueId, parseInt(threat[2].uniqueId), threat[2].infantryForCurrentTerritory, threat[2].useableAssault, threat[2].useableAir, threat[2].useableNaval];
        for (let i = 0; i < allTerritories().length; i++) {
            if (preAttackArray[0] === allTerritories()[i].uniqueId) {
                if (!allTerritories()[i].isCoastal) {
                    preAttackArray[5] = 0;
                    break;
                }
            }
        }
        probability = probabilityFor(preAttackArray, allTerritories(), false);
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

    return [...processedEconomyGroups, ...processedBolsterGroups, ...processedSiegeGroups.reverse(), ...processedAttackGroups.reverse()];
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

/**
 * Rank the refined goals the way this leader would.
 *
 * @param {Array} refinedTurnGoals
 * @param {string} currentAiCountry
 * @param {object} leaderTraits
 * @param {() => number} rng  the seeded per-country stream
 */
export function prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits, rng) {
    // console.log (leaderTraits);
    // console.log("Before:");
    // console.log(refinedTurnGoals);
    refinedTurnGoals = prioritizeActions(refinedTurnGoals, leaderTraits, rng);
    refinedTurnGoals = removeDoubleAttackSiege(refinedTurnGoals);
    // console.log("After:");
    // console.log(refinedTurnGoals);
    return refinedTurnGoals;
}

function prioritizeActions(array, leaderTraits, rng) {
    return array.sort((a, b) => {
        const priorityA = calculatePriorityScore(a, leaderTraits, rng);
        const priorityB = calculatePriorityScore(b, leaderTraits, rng);
        return priorityB - priorityA; // Sort in descending order
    });
}

function calculatePriorityScore(row, leaderTraits, rng) {
    let priorityScore = 0;

    const rowQuantitiesReduced = row[0];
    const action = row[1];

    const fortification = leaderTraits.fortification;
    const territoryExpansion = leaderTraits.territory_expansion;
    const economy = rng() * fortification;

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
            for (let j = 0; j < allTerritories().length; j++) {
                if (allTerritories()[j].territoryName === refinedTurnsGoals[i][2]) {
                    if (allTerritories()[j].originalOwner === currentAiCountry) {
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
        const [, type, location, country] = arr[i];

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
