import {
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable,
    formatNumbersToKMB,
    playerOwnedTerritories,
    setPlayerUseableNotUseableWeaponsDueToOilDemand, turnGainsArrayAi,
    turnGainsArrayPlayer
} from './resourceCalculations.js';
import {
    currentMapColorAndStrokeArray,
    getOriginalDefendingTerritory,
    getSiegeObjectFromPath,
    mapMode,
    paths,
    populateWarResultPopup,
    removeSiegeImageFromPath,
    retreatButtonState,
    saveMapColorState,
    setAdvanceButtonState,
    setAdvanceButtonText,
    setArmyTextValues,
    setAttackProbabilityOnUI,
    setCurrentMapColorAndStrokeArrayFromExternal,
    setCurrentWarFlagString,
    setDefendingTerritoryCopyStart,
    setFirstSetOfRounds,
    setFlag,
    setRetreatButtonState,
    setRetreatButtonText,
    setTerritoryAboutToBeAttackedFromExternal,
    setUpResultsOfWarExternal
} from './ui.js';

// NOTE: `./ui.js` above is an import cycle -- ui.js imports this file too. The previous
// code worked around it with `setTimeout(..., 1000)` before a dynamic import(), which is
// a race: on a slow load the binding was still undefined when first used. A plain static
// import is correct because the imported symbols are hoisted function declarations, so
// they are initialised before any module body runs. See docs/03-refactor-plan.md Phase 1.7.
//
// The `src/state/*` imports below are NOT in the cycle and must not be allowed to join it:
// the state layer imports nothing from the game.
import {
    oilRequirements,
    vehicleArmyPersonnelWorth,
    BATTLE_ROUNDS,
    battleOutcomeEffects,
    conquestLockout,
    SIEGE_HIT_ITERATIONS
} from './src/config/balance.js';
import {
    oilDemandFor
} from './src/rules/economy/capacity.js';
import {
    combinedForce,
    UNIT_TYPES as unitTypes
} from './src/rules/military/units.js';
import {
    resolveRound,
    classifyOutcome,
    countPossibleSkirmishes,
    likeForLikeSkirmishes,
    applyWarWeariness,
    WarOutcome
} from './src/rules/military/battle.js';
import {
    winProbability,
    areaBonusFor,
    combatContinentModifierFor,
    attackingDevelopmentIndex
} from './src/rules/military/probability.js';
import {
    tickSiege,
    siegeScore,
    siegeDamageDeltas,
    arrestGarrisonFor
} from './src/rules/military/siege.js';
import {
    allTerritories,
    getTerritory,
    playerCountryName,
    playerColour,
    playerSieges,
    aiSieges,
    historicWarsList,
    historicAiWarsList,
    warIds
} from './src/state/selectors.js';
import {
    referenceDefendingTerritory
} from './src/state/sieges.js';
import {
    getPathByUniqueId
} from './src/state/indexes.js';
import {
    addSiege,
    removeSiege,
    updateTerritory as patchTerritory,
    recordHistoricWar,
    recordHistoricAiWar,
    setTerritoryOwner,
    setTerritoryDeactivated,
    setCurrentWarId as storeCurrentWarId,
    setCurrentAiWarId as storeCurrentAiWarId,
    setNextWarId as storeNextWarId,
    setNextAiWarId as storeNextAiWarId
} from './src/state/mutations.js';
import {
    ids
} from './src/ui/core/registry.js';
import {
    bottomTable
} from './src/ui/components/BottomTable.js';
import {
    moveButton
} from './src/ui/components/MoveButton.js';

export let finalAttackArray = [];
export const proportionsOfAttackArray = [];
let reusableAttackingAverageDevelopmentIndex;
let reusableCombatContinentModifier;
export const playerTurnsDeactivatedArray = [];
export const aiTurnsDeactivatedArray = [];

export let currentRound = 1;
export let attackingArmyRemaining;
export let defendingArmyRemaining;
export let updatedProbability;
export let unchangeableWarStartCombinedForceAttack;
export let unchangeableWarStartCombinedForceDefend;
export let initialCombinedForceAttack;
export let initialCombinedForceDefend;
export let combinedForceAttack;
export let combinedForceDefend;
export let skirmishesPerRound;
export let totalSkirmishes;
export let skirmishesPerType;
export let totalAttackingArmy;
export let totalDefendingArmy;
export let tempTotalAttackingArmy;
export let tempTotalDefendingArmy;
export let defendingTerritory;
export let defendingTerritoryId;
export let defenseBonus;
export const retrievalArray = [];

//Phase 4.8. These four were `export let`s, which meant every importer held a live
//binding to a module-level variable that only this file could reassign, and the AI,
//the UI and the economy all read them. They are now the store's, re-exported under
//their historical names: the objects and arrays themselves are the store's, with a
//stable identity, so the ~60 read sites are unchanged and only the writes moved to
//state/mutations.js.
export const playerSiegeWarsList = playerSieges();
export const aiSiegeWarsList = aiSieges();
export const historicWars = historicWarsList();
export const historicAiWars = historicAiWarsList();
let resolution;

let rout = false;
let massiveAssault = false;



//The unit matchup table and every other balance number in this file live in
//src/config/balance.js (Phase 5.1). UNIT_MATCHUP_EFFECTIVENESS carries the reasoning.

//chooseDefendingUnitTypeIndex() and countPossibleSkirmishes() are in
//src/rules/military/battle.js (Phase 5.3); imported above.


export function calculateProbabilityPreBattle(attackArray, mainArrayOfTerritoriesAndResources, reCalculationWithinBattle, remainingDefendingArmy, defendingTerritoryId) {
    if (reCalculationWithinBattle) {
        const attackedTerritoryId = defendingTerritoryId;

        //Phase 5.3: the strengths this branch used to build by hand are built inside
        //winProbability() in src/rules/military/probability.js, from the same territory and
        //the same two army arrays. Building them here as well is what let the mid-battle
        //recalculation and the pre-battle calculation below drift apart.
        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(
            ({ uniqueId }) => uniqueId === attackedTerritoryId);

        return winProbability(attackArray, remainingDefendingArmy, defendingTerritory, {
            attackingDevelopmentIndex: reusableAttackingAverageDevelopmentIndex,
            combatContinentModifier: reusableCombatContinentModifier
        });
    } else {
        // Initialize the modifiedAttackArray with the first element
        finalAttackArray = [attackArray[0]];

        let nonZeroCount = 0;
        // Iterate through the attackArray, checking for territories with non-zero units
        for (let i = 1; i < attackArray.length; i += 5) {
            const hasNonZeroUnits = attackArray.slice(i + 1, i + 5).some(unitCount => unitCount > 0);
            if (!hasNonZeroUnits) {
                nonZeroCount++;
            }
            // If the territory has non-zero units or is the last territory, include it in the modifiedAttackArray
            if (hasNonZeroUnits) {
                finalAttackArray.push(...attackArray.slice(i, i + 5));
            }
        }

        if (nonZeroCount === (attackArray.length - 1) / 5) {
            return 0;
        }

        const [
            attackedTerritoryId,
            ...attacks // Rest operator (...) to capture the remaining elements as an array
        ] = finalAttackArray;

        const attackingTerritories = [];
        const infantryCounts = [];
        const assaultCounts = [];
        const airCounts = [];
        const navalCounts = [];

        const combatContinentModifier = calculateContinentModifier(attackedTerritoryId, mainArrayOfTerritoriesAndResources);
        reusableCombatContinentModifier = combatContinentModifier;

        // Loop through the attacks array and extract the values for each attacking territory
        for (let i = 0; i < attacks.length; i += 5) {
            const [
                attackingTerritory,
                infantry,
                assault,
                air,
                naval
            ] = attacks.slice(i, i + 5);

            // Push the extracted values to their respective arrays
            attackingTerritories.push(attackingTerritory);
            infantryCounts.push(infantry);
            assaultCounts.push(assault);
            airCounts.push(air);
            navalCounts.push(naval);
        }

        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(
            ({ uniqueId }) => uniqueId === attackedTerritoryId);

        //The attack arrives as one array per unit type, one entry per attacking territory;
        //winProbability() wants one army array. Summing here is what turns a many-territory
        //attack into the single force that fights.
        const attackers = [
            infantryCounts.reduce((sum, count) => sum + count, 0),
            assaultCounts.reduce((sum, count) => sum + count, 0),
            airCounts.reduce((sum, count) => sum + count, 0),
            navalCounts.reduce((sum, count) => sum + count, 0)
        ];
        const defenders = [
            defendingTerritory.infantryForCurrentTerritory,
            defendingTerritory.useableAssault,
            defendingTerritory.useableAir,
            defendingTerritory.useableNaval
        ];

        //Cached for the mid-battle recalculation above, which has no attacking territories
        //left to average.
        reusableAttackingAverageDevelopmentIndex = attackingDevelopmentIndex(
            attackingTerritories.map(territoryUniqueId =>
                mainArrayOfTerritoriesAndResources.find(
                    ({ uniqueId }) => uniqueId === territoryUniqueId.toString())));

        return winProbability(attackers, defenders, defendingTerritory, {
            attackingDevelopmentIndex: reusableAttackingAverageDevelopmentIndex,
            combatContinentModifier: combatContinentModifier
        });
    }
}

export function setupBattle(probability, arrayOfUniqueIdsAndAttackingUnits, mainArrayOfTerritoriesAndResources) {
    console.log("warId = " + getCurrentWarId());
    console.log("Battle Underway!");
    console.log("Probability of a win is: " + probability);

    console.log("Attack Array: " + arrayOfUniqueIdsAndAttackingUnits);

    // Extract defending territory data
    defendingTerritoryId = arrayOfUniqueIdsAndAttackingUnits[0];
    defendingTerritory = mainArrayOfTerritoriesAndResources.find(({
                                                                      uniqueId
                                                                  }) => uniqueId === defendingTerritoryId);

    // Extract defender's territory attributes
    const developmentIndex = defendingTerritory.devIndex;
    const areaWeightDefender = areaBonusFor(defendingTerritory);
    const continentModifier = calculateContinentModifier(defendingTerritoryId, mainArrayOfTerritoriesAndResources);
    defenseBonus = defendingTerritory.defenseBonus;

    // Display defender's attributes
    console.log("Development Index: " + developmentIndex);
    console.log("Area Bonus: " + areaWeightDefender);
    console.log("Continent Modifier: " + continentModifier);
    console.log("Defense Bonus: " + defenseBonus);

    //audit 5.2 L: proportionsOfAttackArray is module level and is only ever pushed to,
    //so without this every battle inherited the retrieval proportions of every battle
    //before it.
    proportionsOfAttackArray.length = 0;

    // Calculate total attacking army
    totalAttackingArmy = [0, 0, 0, 0];
    tempTotalAttackingArmy = [0, 0, 0, 0]; // copy for console output
    totalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];
    tempTotalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];

    // Initialize counts for each unit type
    let totalInfantryCount = 0;
    let totalAssaultCount = 0;
    let totalAirCount = 0;
    let totalNavalCount = 0;

    // Iterate through the attacking units and calculate the total army counts
    for (let i = 1; i < arrayOfUniqueIdsAndAttackingUnits.length; i += 5) {
        const territoryId = arrayOfUniqueIdsAndAttackingUnits[i];
        const infantryCount = arrayOfUniqueIdsAndAttackingUnits[i + 1];
        const assaultCount = arrayOfUniqueIdsAndAttackingUnits[i + 2];
        const airCount = arrayOfUniqueIdsAndAttackingUnits[i + 3];
        const navalCount = arrayOfUniqueIdsAndAttackingUnits[i + 4];

        totalAttackingArmy[0] += infantryCount;
        totalAttackingArmy[1] += assaultCount;
        totalAttackingArmy[2] += airCount;
        totalAttackingArmy[3] += navalCount;

        tempTotalAttackingArmy[0] += infantryCount;
        tempTotalAttackingArmy[1] += assaultCount;
        tempTotalAttackingArmy[2] += airCount;
        tempTotalAttackingArmy[3] += navalCount;

        totalInfantryCount += infantryCount;
        totalAssaultCount += assaultCount;
        totalAirCount += airCount;
        totalNavalCount += navalCount;

        proportionsOfAttackArray.push([territoryId, infantryCount, assaultCount, airCount, navalCount]);
    }

    // Calculate the proportions of attacking units per territory
    for (let i = 0; i < proportionsOfAttackArray.length; i++) {
        const territoryData = proportionsOfAttackArray[i];
        const infantryPercentage = totalInfantryCount !== 0 ? (territoryData[1] / totalInfantryCount) * 100 : 0;
        const assaultPercentage = totalAssaultCount !== 0 ? (territoryData[2] / totalAssaultCount) * 100 : 0;
        const airPercentage = totalAirCount !== 0 ? (territoryData[3] / totalAirCount) * 100 : 0;
        const navalPercentage = totalNavalCount !== 0 ? (territoryData[4] / totalNavalCount) * 100 : 0;

        proportionsOfAttackArray[i] = [territoryData[0], infantryPercentage, assaultPercentage, airPercentage, navalPercentage];
    }

    console.log(proportionsOfAttackArray);
    console.log("Total Attacking Army: " + totalAttackingArmy);

    unchangeableWarStartCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
    //audit 5.1 E: this was calculated from totalAttackingArmy, so all three rout and
    //last-push thresholds in processRound compared the DEFENDER's remaining force against
    //the ATTACKER's starting force. Battles resolved at the wrong moment whenever the two
    //armies differed in size, which is almost always.
    unchangeableWarStartCombinedForceDefend = calculateCombinedForce(totalDefendingArmy);

    initialCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
    initialCombinedForceDefend = calculateCombinedForce(totalDefendingArmy);

    // Calculate the total number of skirmishes
    skirmishesPerType = likeForLikeSkirmishes(totalAttackingArmy, totalDefendingArmy);
    //audit 5.2 K: the total is now the number of pairings the two armies can make, which is
    //zero only when one side is empty. Summing the per-type minimums made it zero whenever
    //the two armies shared no unit type, and the battle hung.
    totalSkirmishes = countPossibleSkirmishes(totalAttackingArmy, totalDefendingArmy);

    let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());

    // Divide skirmishes into 5 rounds
    skirmishesPerRound = Math.ceil(totalSkirmishes / BATTLE_ROUNDS);

    attackingArmyRemaining = [...totalAttackingArmy];
    if (hasSiegedBefore) {
        let war = historicWars.find((siege) => siege.warId === getCurrentWarId());
        defendingArmyRemaining = war.defendingArmyRemaining;
    } else {
        defendingArmyRemaining = [...totalDefendingArmy];
    }
    updatedProbability = calculateProbabilityPreBattle(totalAttackingArmy, mainArrayOfTerritoriesAndResources, true, totalDefendingArmy, arrayOfUniqueIdsAndAttackingUnits[0]);
}

//areaBonusFor() and combatContinentModifierFor() are in src/rules/military/probability.js
//(Phase 5.3); imported above.

function calculateContinentModifier(attackedTerritoryId, mainArrayOfTerritoriesAndResources) {
    return combatContinentModifierFor(
        mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId));
}

export function handleWarEndingsAndOptions(situation, contestedTerritory, attackingArmyRemaining, defendingArmyRemaining, routFromSiege, ai, siegeObject) {
    let retreatButton;
    let advanceButton;
    let siegeButton;

    if (!ai) {
        let attackArrayText = [...attackingArmyRemaining, ...defendingArmyRemaining];
        setArmyTextValues(attackArrayText, 1, contestedTerritory.uniqueId);
        retreatButton = document.getElementById(ids.retreatButton);
        advanceButton = document.getElementById(ids.advanceButton);
        siegeButton = document.getElementById(ids.siegeButton);
    }

    let contestedPath;
    let won = false;
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("uniqueid") === contestedTerritory.uniqueId) {
            contestedPath = paths[i];
            break;
        }
    }
    if (routFromSiege) { //assure correct data updated
        contestedTerritory = getTerritory(contestedTerritory.uniqueId) ?? contestedTerritory;
    }
    switch (situation) {
        case 0:
            won = true;
            console.log("Attacker won the war!");
            setDefendingTerritoryCopyStart(contestedTerritory);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval);
            //Set territory to owner player, replace army values with remaining attackers in main array, change colors, deactivate territory until next turn
            playerOwnedTerritories.push(contestedPath);
            setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
            contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0];
            contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1];
            contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2];
            contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3];
            contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
            setAdvanceButtonState(2);
            setAdvanceButtonText(2, advanceButton);
            retreatButton.disabled = true;
            retreatButton.style.backgroundColor = "rgb(128, 128, 128)";
            retreatButton.disabled = false;
            siegeButton.disabled = true;
            siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
            break;
        case 1:
            console.log("Defender won the war!");
            setDefendingTerritoryCopyStart(contestedTerritory);
            //set main array to remaining defenders values
            defendingArmyRemaining.push(0); //add defeat type to array
            setRetreatButtonState(2);
            setRetreatButtonText(retreatButtonState, retreatButton);
            retreatButton.disabled = false;
            advanceButton.disabled = true;
            advanceButton.style.backgroundColor = "rgb(128, 128, 128)";
            siegeButton.disabled = true;
            siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
            break;
        case 2:
            won = true;
            rout = true;
            console.log("Enemy routed, they are out of there, territory conquered! - capture half of defense remainder and territory");
            if (!ai) {
                setDefendingTerritoryCopyStart(contestedTerritory);
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault) + (Math.floor(defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare) * oilRequirements.assault);
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air) + (Math.floor(defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare) * oilRequirements.air);
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval) + (Math.floor(defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare) * oilRequirements.naval);
                playerOwnedTerritories.push(contestedPath);
                setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
                turnGainsArrayPlayer.changeInfantry += Math.floor(defendingArmyRemaining[0] * battleOutcomeEffects.routCaptureShare);
                turnGainsArrayPlayer.changeAssault += Math.floor(defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare);
                turnGainsArrayPlayer.changeAir += Math.floor(defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare);
                turnGainsArrayPlayer.changeNaval += Math.floor(defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare);
                contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0] + (Math.floor(defendingArmyRemaining[0] * battleOutcomeEffects.routCaptureShare));
                contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1] + (Math.floor(defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare));
                contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2] + (Math.floor(defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare));
                contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3] + (Math.floor(defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare));
                contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
                setAdvanceButtonState(2);
                setAdvanceButtonText(4, advanceButton);
                retreatButton.disabled = true;
                retreatButton.style.backgroundColor = "rgb(128, 128, 128)";
                advanceButton.disabled = false;
                siegeButton.disabled = true;
                siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
            } else if (ai) {
                //audit 5.1 H: this was `for (country of turnGainsArrayAi)` -- an implicit
                //global (a ReferenceError under a module's strict mode) over a plain object
                //that is not iterable. It threw every time an AI rout resolved here. The
                //country NAME is the key; the entry is the value.
                for (const [countryName, country] of Object.entries(turnGainsArrayAi)) {
                    if (countryName === siegeObject.dataName) {
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[1] * oilRequirements.assault) + (Math.floor(defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare) * oilRequirements.assault);
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[2] * oilRequirements.air) + (Math.floor(defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare) * oilRequirements.air);
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[3] * oilRequirements.naval) + (Math.floor(defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare) * oilRequirements.naval);
                        country.changeInfantry += Math.floor(siegeObject.defendingArmyRemaining[0] * battleOutcomeEffects.routCaptureShare);
                        country.changeAssault += Math.floor(siegeObject.defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare);
                        country.changeAir += Math.floor(siegeObject.defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare);
                        country.changeNaval += Math.floor(siegeObject.defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare);
                        break;
                    }
                }
                contestedTerritory.infantryForCurrentTerritory = siegeObject.attackingArmyRemaining[0];
                contestedTerritory.assaultForCurrentTerritory = siegeObject.attackingArmyRemaining[1];
                contestedTerritory.airForCurrentTerritory = siegeObject.attackingArmyRemaining[2];
                contestedTerritory.navalForCurrentTerritory = siegeObject.attackingArmyRemaining[3];
                contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
                setTerritoryOwner(contestedTerritory.uniqueId, siegeObject.dataName);
            }
            break;
        case 3:
            won = true;
            massiveAssault = true;
            console.log("a quick push should finish off the enemy - lose 20% of remainder to conquer territory");
            //Set territory to owner player, replace army values with remaining attackers - 20% in main array, change colors, deactivate territory until next turn
            setDefendingTerritoryCopyStart(contestedTerritory);
            turnGainsArrayPlayer.changeOilDemand += (Math.floor(attackingArmyRemaining[1] * battleOutcomeEffects.lastPushSurvivorShare) * oilRequirements.assault);
            turnGainsArrayPlayer.changeOilDemand += (Math.floor(attackingArmyRemaining[2] * battleOutcomeEffects.lastPushSurvivorShare) * oilRequirements.air);
            turnGainsArrayPlayer.changeOilDemand += (Math.floor(attackingArmyRemaining[3] * battleOutcomeEffects.lastPushSurvivorShare) * oilRequirements.naval);
            playerOwnedTerritories.push(contestedPath);
            setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
            contestedTerritory.infantryForCurrentTerritory = (Math.floor(attackingArmyRemaining[0] * battleOutcomeEffects.lastPushSurvivorShare));
            contestedTerritory.assaultForCurrentTerritory = (Math.floor(attackingArmyRemaining[1] * battleOutcomeEffects.lastPushSurvivorShare));
            contestedTerritory.airForCurrentTerritory = (Math.floor(attackingArmyRemaining[2] * battleOutcomeEffects.lastPushSurvivorShare));
            contestedTerritory.navalForCurrentTerritory = (Math.floor(attackingArmyRemaining[3] * battleOutcomeEffects.lastPushSurvivorShare));
            contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
            setAdvanceButtonState(2);
            setAdvanceButtonText(3, advanceButton);
            retreatButton.disabled = true;
            retreatButton.style.backgroundColor = "rgb(128, 128, 128)";
            advanceButton.disabled = false;
            siegeButton.disabled = true;
            siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
            break;
        case 4:
            console.log("you were routed, half of your remaining soldiers were captured and half were slaughtered as an example");
            //remove attacking numbers from initial territories in main array, add half of attack remaining to defender in main array
            setDefendingTerritoryCopyStart(contestedTerritory);
            defendingArmyRemaining.push(1); //add defeat type to array
            setRetreatButtonState(2);
            setRetreatButtonText(retreatButtonState, retreatButton);
            retreatButton.disabled = false;
            advanceButton.disabled = true;
            advanceButton.style.backgroundColor = "rgb(128, 128, 128)";
            siegeButton.disabled = true;
            siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
            break;
    }
    contestedTerritory.oilDemand = oilDemandFor(contestedTerritory);
    setPlayerUseableNotUseableWeaponsDueToOilDemand(allTerritories(), contestedTerritory);

    if (won && !ai) {
        setFlag(playerCountryName(), 2);
        setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
        deactivateTerritory(contestedPath);
        if (mapMode === 2) {
            contestedPath.style.stroke = "white";
        }
    } else if (won && ai) {
        setTerritoryOwner(contestedTerritory.uniqueId, siegeObject.dataName);
        deactivateTerritoryAi(contestedPath);
    } else {
        //Nothing to do: the path renders the owner from the store (Phase 4.4), and
        //nothing above this point changed it in the branch that lands here.
    }
}

function deactivateTerritory(contestedPath) { //cant use a territory if just conquered it til this function decides
    const turnsToDeactivate = Math.floor(Math.random() * (conquestLockout.maxTurns - conquestLockout.minTurns + 1)) + conquestLockout.minTurns;
    playerTurnsDeactivatedArray.push([contestedPath.getAttribute("uniqueid"), turnsToDeactivate, 0]);

    let tempArray = currentMapColorAndStrokeArray;
    for (let i = 0; i < currentMapColorAndStrokeArray.length; i++) {
        if (currentMapColorAndStrokeArray[i][0] === contestedPath.getAttribute("uniqueid")) {
            tempArray[i] = [contestedPath.getAttribute("uniqueid"), playerColour(), 3];
        }
    }

    moveButton.hideDestination();
    moveButton.setLabel("DEACTIVATED");
    moveButton.setEnabled(false);
    moveButton.setVariant("disabled");

    contestedPath.style.stroke = "red";
    contestedPath.style.strokeDasharray = "10, 5";
    contestedPath.setAttribute("stroke-width", "3");

    setTerritoryAboutToBeAttackedFromExternal(null); //for filling color to work properly
    setCurrentMapColorAndStrokeArrayFromExternal(tempArray);

    //One write, one render. The `deactivated` attribute and this flag used to be set
    //separately -- the attribute here, the flag in a scan of the whole territory list a
    //few lines below -- and either could be reached without the other. The attribute is
    //rendered from the flag now (Phase 4.4).
    setTerritoryDeactivated(contestedPath.getAttribute("uniqueid"), true);
}

export function activateAiTerritoriesForNewTurn() {
    //Each entry is [uniqueId, turnsToDeactivate, turnsServed]. Walk backwards so the
    //splice below cannot shift an entry past the cursor.
    //
    //audit 5.2 N: the lookup compared a territory's uniqueId against the ARRAY
    //`aiTurnsDeactivatedArray[0]` rather than against `aiTurnsDeactivatedArray[i][0]`, so
    //it was never true and AI territories were never reactivated after a conquest.
    //audit 5.2 O: the entry was then left in the array forever, so once the counter did
    //match it re-fired on every subsequent turn for the rest of the game.
    for (let i = aiTurnsDeactivatedArray.length - 1; i >= 0; i--) {
        if (aiTurnsDeactivatedArray[i][1] !== aiTurnsDeactivatedArray[i][2]) {
            aiTurnsDeactivatedArray[i][2]++;
        } else {
            setTerritoryDeactivated(aiTurnsDeactivatedArray[i][0], false);
            aiTurnsDeactivatedArray.splice(i, 1); //served its sentence, stop tracking it
        }
    }
}
export function activateAllPlayerTerritoriesForNewTurn() { //reactivate all territories at start of turn
    //audit 5.2 O -- see activateAiTerritoriesForNewTurn. Walk backwards, and splice a
    //reactivated entry out so it cannot re-fire every turn thereafter.
    for (let i = playerTurnsDeactivatedArray.length - 1; i >= 0; i--) {
        if (playerTurnsDeactivatedArray[i][1] !== playerTurnsDeactivatedArray[i][2]) {
            playerTurnsDeactivatedArray[i][2]++;
        } else {
            for (let j = 0; j < paths.length; j++) {
                if (paths[j].getAttribute("uniqueid") === playerTurnsDeactivatedArray[i][0]) {
                    if (mapMode === 1) {
                        paths[j].style.stroke = "black";
                    } else if (mapMode === 2) {
                        paths[j].style.stroke = "white";
                    }
                    paths[j].style.strokeDasharray = "none";
                    paths[j].setAttribute("stroke-width", "1");
                    setTerritoryDeactivated(paths[j].getAttribute("uniqueid"), false);
                    if (mapMode === 1) {
                        setCurrentMapColorAndStrokeArrayFromExternal(saveMapColorState(false));
                    }
                    break;
                }
            }
            playerTurnsDeactivatedArray.splice(i, 1); //served its sentence, stop tracking it
        }
    }
}
export async function processRound(currentRound, arrayOfUniqueIdsAndAttackingUnits, attackArmyRemaining, defendingArmyRemaining, skirmishesPerRound) {
    // let diceScoreArray; //DICE CODE EXECUTION
    // for (let i = 0; i < allTerritories().length; i++) {
    //     if (allTerritories()[i].uniqueId === lastClickedPath.getAttribute("uniqueid")) {
    //         diceScoreArray = await callDice(setColorOnMap(allTerritories()[i]));
    //         break;
    //     }
    // }
    // console.log("Attacker: " + diceScoreArray[0] + " Defender: " + diceScoreArray[1]);
    // //show feedback
    combinedForceAttack = calculateCombinedForce(attackArmyRemaining);
    combinedForceDefend = calculateCombinedForce(defendingArmyRemaining);

    //Phase 5.3: the skirmishes are resolveRound() in src/rules/military/battle.js -- pure,
    //deterministic given the RNG, and returning new arrays rather than editing these two in
    //place. The two arrays here are the live ones the UI and the siege objects read, so the
    //result is copied back into them rather than replacing them.
    const round = resolveRound(attackArmyRemaining, defendingArmyRemaining, {
        skirmishesPerRound: skirmishesPerRound,
        probabilityPercent: updatedProbability
    });
    for (let i = 0; i < attackArmyRemaining.length; i++) {
        attackArmyRemaining[i] = round.attackers[i];
    }
    for (let i = 0; i < defendingArmyRemaining.length; i++) {
        defendingArmyRemaining[i] = round.defenders[i];
    }

    for (const [index, unitType] of unitTypes.entries()) {
        console.log(`Attacking ${unitType} Left: ${attackArmyRemaining[index]} out of ${totalAttackingArmy[index]}`);
        console.log(`Defending ${unitType} Left: ${defendingArmyRemaining[index]} out of ${totalDefendingArmy[index]}`);
    }

    //What the round could not do, and what the legacy loop did about it. The first two are
    //effectively dead -- a battle whose defender or attacker was already wiped out resolved
    //at the end of the previous round -- but they are kept so the behaviour is unchanged.
    if (round.halted === "noDefenders") {
        handleWarEndingsAndOptions(WarOutcome.ATTACKER_WON, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
    } else if (round.halted === "noAttackers") {
        handleWarEndingsAndOptions(WarOutcome.DEFENDER_WON, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
    } else if (round.halted === "nothingToFight") {
        setArmyTextValues([...attackArmyRemaining, ...defendingArmyRemaining], 1, arrayOfUniqueIdsAndAttackingUnits[0]);
        //audit 5.2 M: a `let` here shadowed the module binding, so the freshly computed
        //probability was shown once and then thrown away -- every later reader saw the
        //stale module value.
        updatedProbability = getUpdatedProbability();
        setAttackProbabilityOnUI(updatedProbability, 1);
    }

    console.log(`-----------------ROUND ${currentRound} COMPLETED--------------------------`);
    console.log("Attacking Infantry Left:", attackArmyRemaining[0], "out of", totalAttackingArmy[0]);
    console.log("Attacking Assault Left:", attackArmyRemaining[1], "out of", totalAttackingArmy[1]);
    console.log("Attacking Air Left:", attackArmyRemaining[2], "out of", totalAttackingArmy[2]);
    console.log("Attacking Naval Left:", attackArmyRemaining[3], "out of", totalAttackingArmy[3]);
    console.log("Defending Infantry Left:", defendingArmyRemaining[0], "out of", totalDefendingArmy[0]);
    console.log("Defending Assault Left:", defendingArmyRemaining[1], "out of", totalDefendingArmy[1]);
    console.log("Defending Air Left:", defendingArmyRemaining[2], "out of", totalDefendingArmy[2]);
    console.log("Defending Naval Left:", defendingArmyRemaining[3], "out of", totalDefendingArmy[3]);
    console.log("Combined Attack Force: " + combinedForceAttack + " Defense Force: " + combinedForceDefend);

    updatedProbability = calculateProbabilityPreBattle(attackArmyRemaining, allTerritories(), true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);
    console.log("New probability for next round is:", updatedProbability);

    if (currentRound < BATTLE_ROUNDS && !defendingArmyRemaining.every(count => count === 0) && currentRound !== 0) {
        // Continue to the next round
        setCurrentRound(currentRound + 1);
        console.log("Next round: " + getCurrentRound());
    } else {
        console.log("All rounds completed!");
        console.log("Attacking Units Remaining:", attackArmyRemaining);
        console.log("Defending Infantry Remaining:", defendingArmyRemaining[0]);
        console.log("Defending Assault Remaining:", defendingArmyRemaining[1]);
        console.log("Defending Air Remaining:", defendingArmyRemaining[2]);
        console.log("Defending Naval Remaining:", defendingArmyRemaining[3]);

        //Phase 5.3: which of the six endings this is, is classifyOutcome() in
        //src/rules/military/battle.js. The two combined forces are the ones measured at the
        //TOP of this round, which is what the legacy code compared -- see the note on
        //classifyOutcome().
        const outcome = classifyOutcome(attackArmyRemaining, defendingArmyRemaining, {
            startingAttackForce: unchangeableWarStartCombinedForceAttack,
            startingDefendForce: unchangeableWarStartCombinedForceDefend,
            attackForce: combinedForceAttack,
            defendForce: combinedForceDefend
        });

        if (outcome !== WarOutcome.FIGHT_AGAIN) {
            handleWarEndingsAndOptions(outcome, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
        } else {
            setArmyTextValues([...attackArmyRemaining, ...defendingArmyRemaining], 1, arrayOfUniqueIdsAndAttackingUnits[0]);
            console.log("Neither side broke: another five rounds, with war weariness taken off the attacker.");
            attackArmyRemaining = applyWarWeariness(attackArmyRemaining);
            initialCombinedForceAttack = calculateCombinedForce(attackArmyRemaining);
            initialCombinedForceDefend = calculateCombinedForce(defendingArmyRemaining);

            updatedProbability = calculateProbabilityPreBattle(attackArmyRemaining, allTerritories(), true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);

            skirmishesPerType = likeForLikeSkirmishes(attackArmyRemaining, defendingArmyRemaining);
            totalSkirmishes = countPossibleSkirmishes(attackArmyRemaining, defendingArmyRemaining); //audit 5.2 K

            const retreatButton = document.getElementById(ids.retreatButton);
            const advanceButton = document.getElementById(ids.advanceButton);

            retreatButton.disabled = true;
            retreatButton.style.backgroundColor = "rgb(128,128,128)";
            setCurrentRound(0);
            setFirstSetOfRounds(false);
            setAdvanceButtonText(5, advanceButton);
            attackingArmyRemaining = attackArmyRemaining;
        }
    }
}

//Phase 5.3: combinedForce() is in src/rules/military/units.js. This wrapper stays because
//ui.js, transferAndAttack.js and aiCalculations.js all import it from here; the call sites
//move to the rules path as those files move into src/.
export function calculateCombinedForce(army) {
    return combinedForce(army);
}


export function getCurrentRound() {
    return currentRound;
}

export function setCurrentRound(value) {
    return currentRound = value;
}

export function getUpdatedProbability() {
    return updatedProbability;
}

export function getRoutStatus() {
    return rout;
}

export function setRoutStatus(value) {
    return rout = value;
}

export function getMassiveAssaultStatus() {
    return massiveAssault;
}

export function setMassiveAssaultStatus(value) {
    return massiveAssault = value;
}

//The four war-id counters. They were `export let`s here; the accessors already
//existed for most of them, so Phase 4.8 only had to move where the number is kept.
export function getCurrentWarId() {
    return warIds().currentWarId;
}

export function getCurrentAiWarId() {
    return warIds().currentAiWarId;
}

export function getNextAiWarId() {
    return warIds().nextAiWarId;
}

export function getNextWarId() {
    return warIds().nextWarId;
}

export function setNextAiWarId(value) {
    return storeNextAiWarId(value);
}

export function setCurrentAiWarId(value) {
    return storeCurrentAiWarId(value);
}

export function setCurrentWarId(value) {
    return storeCurrentWarId(value);
}

export function setNextWarId(value) {
    return storeNextWarId(value);
}

export function addRemoveWarSiegeObject(addOrRemove, warId, battleStart) {
    let defendingTerritoryCopy = getOriginalDefendingTerritory();
    if (!defendingTerritoryCopy) {
        console.log("No player-initiated battle to turn into a siege object"); //audit 5.2 AH
        return;
    }
    let proportionsAttackers = proportionsOfAttackArray;
    const strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritoryCopy);
    let startingDefenseBonus = defendingTerritoryCopy.defenseBonus;
    let startingFoodCapacity = defendingTerritoryCopy.foodCapacity;
    let startingProdPop = defendingTerritoryCopy.productiveTerritoryPop;
    let startingTerritoryPop = defendingTerritoryCopy.territoryPopulation;
    let defenseBonusColor = "rgb(0,255,0)";
    let foodCapacityColor = "rgb(0,255,0)";
    let productiveTerritoryPopColor = "rgb(0,255,0)";

    if (addOrRemove === 0) { // add war to siege object
        //Phase 4.7: the siege references the territory by id and resolves it live. It
        //used to hold `defendingTerritoryCopy` -- a shallow copy taken here -- which is
        //why the forts and food a siege destroyed had to be copied back into the model
        //when the siege ended, and why a siege could damage a territory the map never
        //heard about. The `startingX` fields below are still snapshots, deliberately:
        //they are what the siege panel compares the live values against.
        const siege = referenceDefendingTerritory({
            warId: warId,
            proportionsAttackers: proportionsAttackers,
            defendingArmyRemaining: defendingArmyRemaining,
            attackingArmyRemaining: attackingArmyRemaining,
            turnsInSiege: 0,
            strokeColor: strokeColor,
            startingAtt: totalAttackingArmy,
            startingDef: totalDefendingArmy,
            startingDefenseBonus: startingDefenseBonus,
            startingFoodCapacity: startingFoodCapacity,
            startingProdPop: startingProdPop,
            startingTerritoryPop: startingTerritoryPop,
            defenseBonusColor: defenseBonusColor,
            foodCapacityColor: foodCapacityColor,
            productiveTerritoryPopColor: productiveTerritoryPopColor
        }, defendingTerritoryCopy.uniqueId);

        addSiege("player", defendingTerritoryCopy.territoryName, siege);

        //The source territories were debited when INVADE! was pressed (audit 5.1 AD),
        //so converting that battle into a siege must not debit them again.

        return siege.defendingTerritory;

    } else if (addOrRemove === 1) {
        //The buildings copy-back that used to sit here has gone with Phase 4.7: the siege
        //damaged a COPY of the territory, so its farms, forests, oil wells and forts had
        //to be written back into the model by hand when the siege ended. It references
        //the real territory now, so there is nothing to copy.
        for (const key of Object.keys(playerSiegeWarsList)) {
            if (playerSiegeWarsList[key].warId === warId) {
                recordHistoricWar(playerSiegeWarsList[key]);
                removeSiege("player", key);
                break;
            }
        }
    }
    console.log(historicWars);
}

export function addRemoveWarSiegeObjectAi(addOrRemove, warId, defender, attacker) {
    let startingDefenseBonus = defender.defenseBonus;
    let startingFoodCapacity = defender.foodCapacity;
    let startingProdPop = defender.productiveTerritoryPop;
    let startingTerritoryPop = defender.territoryPopulation;
    let startingAtt = [attacker.infantryForCurrentTerritory, attacker.useableAssault, attacker.useableAir, attacker.useableNaval];
    let startingDef = [defender.infantryForCurrentTerritory, defender.useableAssault, defender.useableAir, defender.useableNaval];
    let attackingCountry = attacker.dataName;
    let attackingTerritory = attacker.territoryName;

    if (addOrRemove === 0) { // add war to siege object
        const siege = referenceDefendingTerritory({
            warId: warId,
            attackingCountry: attackingCountry,
            attackingTerritory: attackingTerritory,
            defendingArmyRemaining: startingDef,
            attackingArmyRemaining: startingAtt,
            turnsInSiege: 0,
            startingAtt: startingAtt,
            startingDef: startingDef,
            startingDefenseBonus: startingDefenseBonus,
            startingFoodCapacity: startingFoodCapacity,
            startingProdPop: startingProdPop,
            startingTerritoryPop: startingTerritoryPop
        }, defender.uniqueId);

        addSiege("ai", defender.territoryName, siege);
        console.log("Siege now added to aiSiegeWarsList, array is as follows:");
        console.log(aiSiegeWarsList);
    } else if (addOrRemove === 1) {
        //As above: no copy, so no copy-back.
        for (const key of Object.keys(aiSiegeWarsList)) {
            if (aiSiegeWarsList[key].warId === warId) {
                recordHistoricAiWar(aiSiegeWarsList[key]);
                removeSiege("ai", key);
                break;
            }
        }
    }
}

export function addWarToHistoricWarArray(warResolution, warId, retreatBeforeStart) {
    let proportionsAttackers;
    let defendingTerritoryCopy = getOriginalDefendingTerritory();

    //audit 5.2 AH. `originalDefendingTerritory` is set only when the PLAYER opens a battle
    //against a territory. The battle-results screen is shared: a siege arrest and an AI
    //attack on the player both raise it, and its Accept button runs this same handler -- so
    //on the first such result of a session there is no open battle to describe and every
    //read below threw on undefined. The war those results describe has already been recorded
    //by whoever raised the screen, so there is nothing to add here.
    if (!defendingTerritoryCopy) {
        console.log("No player-initiated battle to record -- the results screen is showing someone else war");
        return;
    }

    let strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritoryCopy);
    let startingDefenseBonus = defendingTerritoryCopy.defenseBonus;
    let startingFoodCapacity = defendingTerritoryCopy.foodCapacity;
    let startingProdPop = defendingTerritoryCopy.productiveTerritoryPop;
    let startingTerritoryPop = defendingTerritoryCopy.territoryPopulation;
    let defenseBonusColor = "rgb(0,255,0)";
    let foodCapacityColor = "rgb(0,255,0)";
    let productiveTerritoryPopColor = "rgb(0,255,0)";

    if (retreatBeforeStart) {
        console.log(getNextWarId() + " " + getCurrentWarId());
        warId = getCurrentWarId();
        proportionsAttackers = [0, 0, 0, 0];
        defendingArmyRemaining = [defendingTerritoryCopy.infantryForCurrentTerritory, defendingTerritoryCopy.assaultForCurrentTerritory, defendingTerritoryCopy.airForCurrentTerritory, defendingTerritoryCopy.navalForCurrentTerritory];
        attackingArmyRemaining = ["All", "All", "All", "All"];
        totalAttackingArmy = ["All", "All", "All", "All"];
        totalDefendingArmy = [defendingTerritoryCopy.infantryForCurrentTerritory, defendingTerritoryCopy.assaultForCurrentTerritory, defendingTerritoryCopy.airForCurrentTerritory, defendingTerritoryCopy.navalForCurrentTerritory];
        defenseBonus = defendingTerritoryCopy.defenseBonus;
    } else {
        proportionsAttackers = proportionsOfAttackArray;
        strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritoryCopy);
    }
    //Phase 4.7: the last territory copy in the file. A historic war references the
    //territory like a siege does; the values it needs frozen are the `startingX` fields
    //and the two army arrays, which are already snapshots.
    recordHistoricWar(referenceDefendingTerritory({
        warId: warId,
        proportionsAttackers: proportionsAttackers,
        defendingArmyRemaining: defendingArmyRemaining,
        attackingArmyRemaining: attackingArmyRemaining,
        turnsInSiege: null,
        strokeColor: strokeColor,
        resolution: warResolution,
        startingAtt: totalAttackingArmy,
        startingDef: totalDefendingArmy,
        startingDefenseBonus: startingDefenseBonus,
        startingFoodCapacity: startingFoodCapacity,
        startingProdPop: startingProdPop,
        startingTerritoryPop: startingTerritoryPop,
        defenseBonusColor: defenseBonusColor,
        foodCapacityColor: foodCapacityColor,
        productiveTerritoryPopColor: productiveTerritoryPopColor
    }, defendingTerritoryCopy.uniqueId));

    console.log(historicWars);
}

function getStrokeColorOfDefendingTerritory(defendingTerritory) {
    const path = getPathByUniqueId(defendingTerritory.uniqueId);
    return path ? path.style.stroke : ""; //no path for that territory: an absent stroke, not undefined
}

export function incrementSiegeTurns(ai) {
    if (ai) {
        for (const territory in aiSiegeWarsList) {
            if (aiSiegeWarsList.hasOwnProperty(territory)) {
                aiSiegeWarsList[territory].turnsInSiege += 1;
            }
        }
    } else {
        for (const territory in playerSiegeWarsList) {
            if (playerSiegeWarsList.hasOwnProperty(territory)) {
                playerSiegeWarsList[territory].turnsInSiege += 1;
            }
        }
    }
}

export function setBattleResolutionOnHistoricWarArrayAfterSiege(warResolution, id, ai) {
    if (ai) {
        for (const siege of historicWars) {
            const {
                warId
            } = siege;
            if (warId === id) {
                siege.resolution = warResolution;
            }
        }
    } else if (!ai) {
        for (const siege of historicAiWars) {
            const {
                warId
            } = siege;
            if (warId === id) {
                siege.resolution = warResolution;
            }
        }
    } else {
        return "Error - Siege not found in either array in setBattleResolutionOnHistoricWarArrayAfterSiege()";
    }
}

export function getResolution() {
    return resolution;
}

export function setResolution(value) {
    return resolution = value;
}

export function getFinalAttackArray() {
    return finalAttackArray;
}

export function setFinalAttackArray(array) {
    return finalAttackArray = array;
}

export function getAttackingArmyRemaining() {
    return attackingArmyRemaining;
}

/** The defending army of the battle currently on screen, for the ?e2e=1 harness. */
export function getDefendingArmyRemaining() {
    return defendingArmyRemaining;
}

/**
 * One turn of every siege on one side.
 *
 * Phase 5.4: the roll, the damage and the arrest decision are `rules/military/siege.js`,
 * which is pure; this is the part that knows about the store, the console and the two
 * parallel siege lists. The two copies of this function -- one for the player, one for the
 * AI, differing only in which list they walked and what they logged -- are one function
 * taking a side.
 *
 * Returns the array `gameTurnsLoop` expects: `true` for a siege that continues, and the
 * siege object itself for one that ended in an arrest.
 *
 * @param {"player"|"ai"} side
 */
function runSiegeTurnFor(side) {
    const sieges = side === "ai" ? aiSiegeWarsList : playerSiegeWarsList;
    const label = side === "ai" ? " AI war" : " war";
    const continueSiegeArray = [];

    if (!sieges || Object.keys(sieges).length === 0) {
        return continueSiegeArray;
    }

    for (const key in sieges) {
        const siege = sieges[key];
        const result = tickSiege(siege);

        console.log(
            (result.hit ? "Hit this turn for the " : "No hit this turn for the ") +
            key + label + ", " + result.hitCount + " hits from " + SIEGE_HIT_ITERATIONS);

        if (!result.hit) {
            //audit 5.1 D: this used to `return`, which abandoned the whole loop and handed
            //gameTurnsLoop `undefined` -- so one siege missing its hit roll silently
            //cancelled every other siege's turn processing. A miss is just a quiet turn for
            //that one siege; it continues.
            continueSiegeArray.push(true);
            continue;
        }

        if (result.arrested) {
            siege.defendingArmyRemaining.push(1); //mark the siege as arrested for handleEndSiegeDueArrest()
            continueSiegeArray.push(siege);
            continue;
        }

        const territory = siege.defendingTerritory;
        patchTerritory(territory.uniqueId, siegeDamageDeltas(territory, result.damage));
        console.log("remaining farm: " + territory.farmsBuilt + " forest: " + territory.forestsBuilt +
            " oilwell: " + territory.oilWellsBuilt + " fort: " + territory.fortsBuilt);
        continueSiegeArray.push(true);
    }

    return continueSiegeArray;
}

export function calculatePlayerInitiatedSiegePerTurn() {
    return runSiegeTurnFor("player");
}

export function calculateAiInitiatedSiegePerTurn() {
    return runSiegeTurnFor("ai");
}

export function handleEndSiegeDueArrest(ai, siege) {
    let defendingTerritory;
    let defendingPath;

    if (siege.defendingArmyRemaining[4]) { //if siege marked as arrested
        //The siege already references the live territory (Phase 4.7), so the 359x359
        //scan that used to find it here -- and then find its path -- is two lookups.
        defendingTerritory = siege.defendingTerritory;
        defendingPath = defendingTerritory ? getPathByUniqueId(defendingTerritory.uniqueId) : null;
        if (!defendingTerritory || !defendingPath) {
            console.log("Siege arrest for a territory that is no longer on the map; ignoring");
            return;
        }

        //Phase 5.4: the four lines that used to build this garrison by hand are
        //arrestGarrisonFor() in src/rules/military/siege.js, applied in one write. One of
        //them read `defendingArmyRemaining[1 + Math.floor(...)]` -- indexing a four-element
        //array by half the attacker's assault count instead of adding the two -- which set
        //the territory's army to NaN, permanently, on any arrest against an attacker with
        //two or more assault units (defect AL). The rule computes the total from its own
        //four counts, so the total can no longer disagree with its parts.
        patchTerritory(defendingTerritory.uniqueId,
            arrestGarrisonFor(siege.defendingArmyRemaining, siege.attackingArmyRemaining));
        bottomTable.update({ army: formatNumbersToKMB(defendingTerritory.armyForCurrentTerritory, 0) });

        siege.attackingArmyRemaining = [0, 0, 0, 0];
        siege.resolution = "Arrested";

        //Phase 5.8. `setUpResultsOfWarExternal(true)` used to run for EVERY arrest, and only
        //the `!ai` branch below ever filled the screen in. The AI runs dozens of concurrent
        //sieges against each OTHER (see docs/05-known-issues.md section 6), so at least one
        //was arrested on nearly every turn -- and the player was shown an EMPTY battle
        //results screen, on top of the phase button, at the start of almost every turn. An
        //arrest is only the player's business if they were besieging, or being besieged.
        const playerWasBesieging = !ai;
        const playerWasBesieged = ai && defendingTerritory.owner === "Player";

        if (playerWasBesieging || playerWasBesieged) {
            setUpResultsOfWarExternal(true);
            setCurrentWarFlagString(defendingTerritory.dataName);
        }

        if (!ai) {
            populateWarResultPopup(1, playerCountryName(), defendingTerritory, "arrest", siege);
            addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
            recordHistoricWar(siege);
            removeSiege("player", defendingTerritory.territoryName);
        } else {
            if (playerWasBesieged) {
                //The player's garrison broke a siege AGAINST them, which is worth being told.
                //The attacker on this screen is the besieging country, not the player.
                populateWarResultPopup(1, siege.attackingCountry, defendingTerritory, "arrest", siege);
                addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
            }
            recordHistoricAiWar(siege);
            removeSiege("ai", defendingTerritory.territoryName);
        }

        //`underSiege` is no longer written here. Phase 4.4/4.5: it is derived from the
        //siege lists and rendered by src/ui/mapAttributeSync.js, so removing the siege
        //above is what clears it -- there is no second fact to keep in step.
        removeSiegeImageFromPath(ai, defendingPath);
    }
}

//changeDefendingTerritoryStatsBasedOnSiege() is siegeDamageDeltas() in
//src/rules/military/siege.js (Phase 5.4), applied through mutations.js by runSiegeTurnFor().

export function setValuesForBattleFromSiegeObject(path, routCheck) { //when clicking view siege
            let siegeObject;
            if (!routCheck) {
                siegeObject = getSiegeObjectFromPath(path);
    } else {
        siegeObject = path; //confusing but if checking for rout from siege, we pass the object directly
    }

    for (let i = 0; i < allTerritories().length; i++) {
        const mainElement = allTerritories()[i];
        if (mainElement.uniqueId === siegeObject.defendingTerritory.uniqueId) {
            siegeObject.defendingArmyRemaining = [mainElement.infantryForCurrentTerritory, mainElement.useableAssault, mainElement.useableAir, mainElement.useableNaval];
            break;
        }
    }
}

//Phase 4.7: this was `setMainArrayToArmyRemaining()`, one of the manual sync-backs the
//copy-holding siege objects needed. It scanned all 359 territories to write the siege
//survivors into the model, and then wrote the very same numbers a second time into the
//siege object's own copy of that territory -- and it read that copy from
//`getSiegeObjectFromPath(lastClickedPath)`, a DIFFERENT siege from the one passed in, so
//a click on the wrong path wrote one siege's survivors onto another.
//
//The siege references the live territory now, so this is one write and no copy.
export function applySiegeSurvivorsToTerritory(siege) { //when clicking siege button
    const territory = siege?.defendingTerritory;
    if (!territory) {
        return null;
    }
    territory.infantryForCurrentTerritory = siege.defendingArmyRemaining[0];
    territory.assaultForCurrentTerritory = siege.defendingArmyRemaining[1];
    territory.airForCurrentTerritory = siege.defendingArmyRemaining[2];
    territory.navalForCurrentTerritory = siege.defendingArmyRemaining[3];
    territory.armyForCurrentTerritory = territory.infantryForCurrentTerritory + (territory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (territory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (territory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
    return territory;
}

export function calculateSiegeScore(siegeObjectElement) {
    return siegeScore(siegeObjectElement.attackingArmyRemaining);
}
export function addAttackingArmyToRetrievalArray(attackingArmyRemaining, proportionsArray) {
    let returnArray = [];

    for (let i = 0; i < proportionsArray.length; i += 5) {
        const uniqueId = proportionsArray[i];
        const values = proportionsArray.slice(i + 1, i + 5);
        const newArray = [uniqueId, ...values];
        returnArray.push(newArray);
    }

    for (let i = 0; i < returnArray.length; i++) {
        for (let j = 0; j < returnArray[i].length; j++) {
            returnArray[i][j].push(...attackingArmyRemaining);
        }
    }

    // console.log(returnArray);

    return returnArray;
}

export function getRetrievalArray() {
    return retrievalArray;
}

export function setNewWarOnRetrievalArray(warId, array, turn, type) {
    //The empty case used to REPLACE the array rather than push into it, which meant the
    //binding had to stay a `let` and any module holding the old array kept the old one.
    //A push does the same thing to an empty array.
    retrievalArray.push([warId, array, turn, type]);
    return retrievalArray;
}

//BUG FIX, found while doing Phase 4.4. Two callers, two different argument types:
//aiCalculations.updateTerritory() passes a TERRITORY, and handleWarEndingsAndOptions()
//passes an SVG PATH. A path has no `uniqueId` property (its id is the `uniqueid`
//attribute), so for every AI conquest of a player territory this pushed
//[undefined, n, 0] onto the deactivation list and matched no territory at all -- the
//territory was never deactivated, and the entry sat in the list forever. Accepting
//either and resolving one id is what makes the two call sites agree.
export function deactivateTerritoryAi(territoryOrPath) {
    const uniqueId = territoryOrPath?.uniqueId ?? territoryOrPath?.getAttribute?.("uniqueid") ?? null;
    if (uniqueId === null) {
        console.log("deactivateTerritoryAi: no territory to deactivate");
        return;
    }
    const turnsToDeactivate = Math.floor(Math.random() * (conquestLockout.maxTurns - conquestLockout.minTurns + 1)) + conquestLockout.minTurns;
    aiTurnsDeactivatedArray.push([String(uniqueId), turnsToDeactivate, 0]);
    setTerritoryDeactivated(uniqueId, true);
}

export function getSiegeObjectFromPlayerSiegeList(territory) {
    if (territory.territoryName in playerSiegeWarsList) {
        return playerSiegeWarsList[territory.territoryName];
    } else {
        return false;
    }
}

export function getSiegeObjectFromAiSiegeList(territory) {
    if (territory.territoryName in aiSiegeWarsList) {
        return aiSiegeWarsList[territory.territoryName];
    } else {
        return false;
    }
}