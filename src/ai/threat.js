// Threat scoring: how dangerous each enemy territory in range is to each of ours.
//
// Refactor plan Phase 5.5. This is the first of the AI's three stages -- threat, then goals,
// then actions -- and it is the only one that is purely a measurement. Nothing here decides
// anything or writes anything; it reduces "the world as this country sees it" to a list of
// `[enemyTerritoryName, turnStillToCome, armyPower, isCoastal, [[friendlyName, score], ...]]`
// and hands that to `goals.js`.
//
// It imports from `state/` and `config/` and from nothing else. In particular it does not
// import `ui.js`, which is what the phase is for: the whole stage now runs in Node.
//
// The score is a difference of army powers, adjusted by the attacking leader's personality:
// a territory that was once theirs is worth more to them (`reconquista`), and every leader
// has some standing appetite for expansion. A threat that cannot physically be delivered --
// no adjacency between the two territories -- is not scored low, it is scored
// `THREAT_DISREGARD_CONSTANT`, which sorts below every real threat and is filtered out by
// name later rather than by a magnitude comparison.

import { THREAT_DISREGARD_CONSTANT, vehicleArmyPersonnelWorth } from "../config/balance.js";
import { defenseMultiplierFor } from "../rules/military/probability.js";
import { allTerritories, getTerritoryByName } from "../state/selectors.js";

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
    const fullTerritoriesInRange = [];
    for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) { //array of all AI players[whichAi][mainArrayObjectArrayForTerritoriesOwned]
        const territory = arrayOfLeadersAndCountries[i][2][j].uniqueId;
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

// Names in, territory objects out. This used to walk all 359 paths, and for each of
// them all 359 territories, and for each match the whole attackable list -- once per
// AI territory per turn. The store indexes territories by name, so it is now a map().
//
// A name with no territory behind it is left as the string, exactly as before, so a
// caller that was relying on that (rather than crashing) still gets it.
export function convertAttackableArrayStringsToMainArrayObjects(attackableTerritoriesInRange) {
    for (let i = 0; i < attackableTerritoriesInRange.length; i++) {
        const territory = getTerritoryByName(attackableTerritoriesInRange[i]);
        if (territory) {
            attackableTerritoriesInRange[i] = territory;
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

/**
 * A territory's army as one number, counting only the units it can actually fuel.
 *
 * With `defense` set, the vehicle contribution is additionally multiplied by the territory's
 * fortifications -- so the same army is worth more sitting behind forts than it is marching
 * out. Note that the multiplier applies to the NAVAL term only, because of where the
 * parentheses fall; that is the long-standing behaviour and changing it is a balance change,
 * not an extraction.
 */
export function retrieveArmyPowerOfTerritory(territory, defense) {
    //`armyForCurrentTerritory` is already the USEABLE total, but the three grounded
    //differences are subtracted from it anyway -- so a territory short of oil is penalised
    //twice. Long-standing, and left alone here for the same reason as the parenthesis above:
    //it is a balance change, not part of an extraction.
    const groundedAssault =
        (territory.assaultForCurrentTerritory - territory.useableAssault) *
        vehicleArmyPersonnelWorth.assault;
    const groundedAir =
        (territory.airForCurrentTerritory - territory.useableAir) *
        vehicleArmyPersonnelWorth.air;
    const groundedNaval =
        (territory.navalForCurrentTerritory - territory.useableNaval) *
        vehicleArmyPersonnelWorth.naval;

    if (!defense) {
        return territory.armyForCurrentTerritory - groundedAssault - groundedAir - groundedNaval;
    }
    return territory.armyForCurrentTerritory - groundedAssault - groundedAir -
        (groundedNaval * defenseMultiplierFor(territory));
}

export function getFriendlyTerritoriesDefenseScores(arrayOfLeadersAndCountries, currentAiCountry, i) {
    const arr = [];
    for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) { //add defense array with army power modified for defense bonus and indicate if coastal
        if (arrayOfLeadersAndCountries[i][2][j].dataName === currentAiCountry) {
            arr.push([arrayOfLeadersAndCountries[i][2][j].territoryName, retrieveArmyPowerOfTerritory(arrayOfLeadersAndCountries[i][2][j], true), arrayOfLeadersAndCountries[i][2][j].isCoastal]);
        }
    }
    return arr;
}

export function calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory(attackableTerritoriesInRange, arrayOfLeadersAndCountries, fullTerritoriesInRange, arrayOfAiPlayerDefenseScoresForTerritories, i) {
    const arr = [];
    for (const territory of attackableTerritoriesInRange) {
        let friendlyTerritoryObject;
        const arrayOfTerritoryThreats = [];
        const turnStillToCome = determineIfStillHasTurnInThisTurn(territory, arrayOfLeadersAndCountries, i);
        let armyPowerOfEnemyTerritory = retrieveArmyPowerOfTerritory(territory, false);
        const arrayOfEnemyToFriendlyInteractibility = [];
        for (let j = 0; j < fullTerritoriesInRange.length; j++) {
            const friendlyTerritory = fullTerritoriesInRange[j][0][1];

            //audit 5.1 AF. These two arrays used to be indexed by the same `j`, but they are
            //not the same length: fullTerritoriesInRange has an entry for every territory in
            //arrayOfLeadersAndCountries[i][2], while getFriendlyTerritoriesDefenseScores only
            //returns the ones whose dataName is still this country. The moment a country
            //loses a territory the two desync, `arrayOfAiPlayerDefenseScoresForTerritories[j]`
            //runs off the end, and reading `[1]` off undefined threw -- killing the AI turn
            //and, through the uncaught rejection, the whole game loop. Match on the territory
            //name instead, which is what the two entries actually share.
            const defenseScore = arrayOfAiPlayerDefenseScoresForTerritories.find(entry => entry[0] === friendlyTerritory);
            if (!defenseScore) {
                continue; //no longer one of this country territories
            }

            if (fullTerritoriesInRange[j][1].some(enemyTerritory => enemyTerritory[0] === territory.territoryName)) {
                arrayOfEnemyToFriendlyInteractibility.push([friendlyTerritory, true, defenseScore[1], defenseScore[2]]);
            } else {
                arrayOfEnemyToFriendlyInteractibility.push([friendlyTerritory, false, defenseScore[1], defenseScore[2]]);
            }
            for (let k = 0; k < allTerritories().length; k++) {
                if (friendlyTerritory[0] === allTerritories()[k].territoryName) {
                    friendlyTerritoryObject = allTerritories()[k];
                    break;
                }
            }
        }
        const threatScores = [];
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
                    const reconquistaValue = Math.abs(threatScore) * territory.leader.traits.reconquista;
                    threatScore += reconquistaValue;
                }
                //territory_expansion - DONE
                const territoryExpansionValue = Math.abs(threatScore) * territory.leader.traits.territory_expansion;
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

