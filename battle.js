import {
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable,
    formatNumbersToKMB,
    oilRequirements,
    playerOwnedTerritories,
    setPlayerUseableNotUseableWeaponsDueToOilDemand, turnGainsArrayAi,
    turnGainsArrayPlayer,
    vehicleArmyPersonnelWorth
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
    recordHistoricWar,
    recordHistoricAiWar,
    setTerritoryOwner,
    setTerritoryDeactivated,
    setCurrentWarId as storeCurrentWarId,
    setCurrentAiWarId as storeCurrentAiWarId,
    setNextWarId as storeNextWarId,
    setNextAiWarId as storeNextAiWarId
} from './src/state/mutations.js';

const maxAreaThreshold = 350000;
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

const unitTypes = ["infantry", "assault", "air", "naval"];
const rounds = 5;

const armyTypeSiegeValues = {
    infantry: 0.0001,
    assault: 3,
    air: 5,
    naval: 10
};

//audit 5.2 K. Skirmishes used to pair matching unit types only, with
//`skirmishesPerType = min(attacker[t], defender[t])`. Two armies sharing no unit type
//produced totalSkirmishes === 0, so the battle could neither progress nor resolve -- an
//all-infantry attack on an all-naval defender simply hung.
//
//Refactor plan 3.15 offered two ways out and recommended this one: let any type engage any
//type, scaled by how effective it is against that opponent. Army composition now matters,
//and because every attacker can find someone to fight, a battle always resolves.
//
//Rows are the ATTACKING unit type, columns the DEFENDING one, in unitTypes order:
//infantry, assault, air, naval. Same-type values are 1 so the common case is unchanged.
//These are balance numbers and move to config/balance.js at Phase 5.1.
const UNIT_MATCHUP_EFFECTIVENESS = [
    //           vs inf  vs assault  vs air  vs naval
    /* infantry */[1, 0.6, 0.4, 0.5],
    /* assault  */[1.4, 1, 0.5, 0.7],
    /* air      */[1.5, 1.6, 1, 1.4],
    /* naval    */[0.8, 0.7, 0.5, 1]
];

/**
 * Which of the defender remaining unit types this attacking type engages.
 *
 * Its own type first, so a conventional battle fights exactly as it always did. Failing
 * that, whichever surviving defender type this attacker is most effective against.
 * Returns -1 when the defender has nothing left at all.
 */
function chooseDefendingUnitTypeIndex(attackingUnitTypeIndex, defendingArmyRemaining) {
    if (defendingArmyRemaining[attackingUnitTypeIndex] > 0) {
        return attackingUnitTypeIndex;
    }

    let bestIndex = -1;
    let bestEffectiveness = -1;
    for (let i = 0; i < defendingArmyRemaining.length; i++) {
        if (defendingArmyRemaining[i] <= 0) {
            continue;
        }
        const effectiveness = UNIT_MATCHUP_EFFECTIVENESS[attackingUnitTypeIndex][i];
        if (effectiveness > bestEffectiveness) {
            bestEffectiveness = effectiveness;
            bestIndex = i;
        }
    }
    return bestIndex;
}

/**
 * How many pairings the two armies can make between them: every attacking unit can now
 * engage some defending unit, so this is simply the smaller of the two head counts. It is
 * zero only when one side is empty, which is a resolved battle rather than a stalled one.
 */
function countPossibleSkirmishes(attackArmy, defendArmy) {
    const attackers = attackArmy.reduce((sum, count) => sum + count, 0);
    const defenders = defendArmy.reduce((sum, count) => sum + count, 0);
    return Math.min(attackers, defenders);
}

const hitIterations = 10; //number of loops to determine hit for siege

export function calculateProbabilityPreBattle(attackArray, mainArrayOfTerritoriesAndResources, reCalculationWithinBattle, remainingDefendingArmy, defendingTerritoryId) {
    if (reCalculationWithinBattle) {
        const attackedTerritoryId = defendingTerritoryId;

        const {
            defenseBonus,
            mountainDefenseBonus
        } = mainArrayOfTerritoriesAndResources.find(({
                                                         uniqueId
                                                     }) => uniqueId === attackedTerritoryId);

        const [
            infantryCounts,
            assaultCounts,
            airCounts,
            navalCounts
        ] = attackArray;

        const [
            infantryForCurrentTerritory,
            useableAssault,
            useableAir,
            useableNaval
        ] = remainingDefendingArmy;

        const totalAttackingStrength =
            infantryCounts * 1 +
            assaultCounts * vehicleArmyPersonnelWorth.assault +
            airCounts * vehicleArmyPersonnelWorth.air +
            navalCounts * vehicleArmyPersonnelWorth.naval;

        let totalDefendingStrength =
            infantryForCurrentTerritory +
            useableAssault * vehicleArmyPersonnelWorth.assault +
            useableAir * vehicleArmyPersonnelWorth.air +
            useableNaval * vehicleArmyPersonnelWorth.naval;

        totalDefendingStrength = totalDefendingStrength * (Math.ceil((defenseBonus + mountainDefenseBonus) / 15));

        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({
                                                                                uniqueId
                                                                            }) => uniqueId === attackedTerritoryId);

        let modifiedAttackingStrength = totalAttackingStrength * reusableAttackingAverageDevelopmentIndex; //more advanced attackers will have it easier to attack
        modifiedAttackingStrength = modifiedAttackingStrength * reusableCombatContinentModifier;

        const modifiedDefendingStrengthWithArea = totalDefendingStrength * calculateAreaBonus(defendingTerritory, maxAreaThreshold);

        return (modifiedAttackingStrength / (modifiedAttackingStrength + modifiedDefendingStrengthWithArea)) * 100;
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

        const {
            defenseBonus,
            mountainDefenseBonus,
            infantryForCurrentTerritory,
            useableAssault,
            useableAir,
            useableNaval
        } = mainArrayOfTerritoriesAndResources.find(({
                                                         uniqueId
                                                     }) => uniqueId === attackedTerritoryId);

        // Calculate total attacking strength
        const totalAttackingStrength =
            infantryCounts.reduce((sum, count) => sum + count * 1, 0) +
            assaultCounts.reduce((sum, count) => sum + count * vehicleArmyPersonnelWorth.assault, 0) +
            airCounts.reduce((sum, count) => sum + count * vehicleArmyPersonnelWorth.air, 0) +
            navalCounts.reduce((sum, count) => sum + count * vehicleArmyPersonnelWorth.naval, 0);

        // Calculate total defending strength
        const totalDefendingStrength = (infantryForCurrentTerritory + (useableAssault * vehicleArmyPersonnelWorth.assault) + (useableAir * vehicleArmyPersonnelWorth.air) + (useableNaval * vehicleArmyPersonnelWorth.naval)) * (Math.ceil((defenseBonus + mountainDefenseBonus) / 15));

        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({
                                                                                uniqueId
                                                                            }) => uniqueId === attackedTerritoryId);

        const attackingDevelopmentIndex = attackingTerritories.reduce((sum, territoryUniqueId) => {
            const territory = mainArrayOfTerritoriesAndResources.find(({
                                                                           uniqueId
                                                                       }) => uniqueId === territoryUniqueId.toString());
            return sum + parseFloat(territory.devIndex);
        }, 0) / attackingTerritories.length;

        reusableAttackingAverageDevelopmentIndex = attackingDevelopmentIndex;

        let modifiedAttackingStrength = totalAttackingStrength * attackingDevelopmentIndex; //more advanced attackers will have it easier to attack

        modifiedAttackingStrength = modifiedAttackingStrength * combatContinentModifier; //attacking on certain continents can be harder due to many islands or infrastructure issues

        // Adjust the defending strength based on the area weight
        const modifiedDefendingStrengthWithArea = totalDefendingStrength * calculateAreaBonus(defendingTerritory, maxAreaThreshold);

        // Calculate probability with area weight adjustment
        return (modifiedAttackingStrength / (modifiedAttackingStrength + modifiedDefendingStrengthWithArea)) * 100;
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
    const areaWeightDefender = calculateAreaBonus(defendingTerritory, maxAreaThreshold);
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
    skirmishesPerType = [
        Math.min(totalAttackingArmy[0], totalDefendingArmy[0]),
        Math.min(totalAttackingArmy[1], totalDefendingArmy[1]),
        Math.min(totalAttackingArmy[2], totalDefendingArmy[2]),
        Math.min(totalAttackingArmy[3], totalDefendingArmy[3])
    ]; //kept for display: how much of this battle is a like-for-like fight
    //audit 5.2 K: the total is now the number of pairings the two armies can make, which is
    //zero only when one side is empty. Summing the per-type minimums made it zero whenever
    //the two armies shared no unit type, and the battle hung.
    totalSkirmishes = countPossibleSkirmishes(totalAttackingArmy, totalDefendingArmy);

    let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());

    // Divide skirmishes into 5 rounds
    skirmishesPerRound = Math.ceil(totalSkirmishes / rounds);

    attackingArmyRemaining = [...totalAttackingArmy];
    if (hasSiegedBefore) {
        let war = historicWars.find((siege) => siege.warId === getCurrentWarId());
        defendingArmyRemaining = war.defendingArmyRemaining;
    } else {
        defendingArmyRemaining = [...totalDefendingArmy];
    }
    updatedProbability = calculateProbabilityPreBattle(totalAttackingArmy, mainArrayOfTerritoriesAndResources, true, totalDefendingArmy, arrayOfUniqueIdsAndAttackingUnits[0]);
}

function calculateAreaBonus(defendingTerritory, maxAreaThreshold) {
    const defendingTerritoryArea = defendingTerritory.area;

    let areaWeightDefender = Math.min(1, maxAreaThreshold / defendingTerritoryArea);
    areaWeightDefender = 1 + (areaWeightDefender - 1) * 0.5;

    // console.log("Defending Territory Area: " + defendingTerritoryArea);
    // console.log("Area Weight (Defender): " + areaWeightDefender);

    return areaWeightDefender;
}

function calculateContinentModifier(attackedTerritoryId, mainArrayOfTerritoriesAndResources) {
    const territoryToMatchContinent = mainArrayOfTerritoriesAndResources.find(({
                                                                                   uniqueId
                                                                               }) => uniqueId === attackedTerritoryId);
    let combatContinentModifier = 1;

    if (territoryToMatchContinent) {
        const {
            continent
        } = territoryToMatchContinent;

        if (continent === "Europe") {
            combatContinentModifier = 0.98;
        } else if (continent === "North America") {
            combatContinentModifier = 0.99;
        } else if (continent === "Asia") {
            combatContinentModifier = 0.87;
        } else if (continent === "Oceania") {
            combatContinentModifier = 0.75;
        } else if (continent === "South America") {
            combatContinentModifier = 0.82;
        } else if (continent === "Africa") {
            combatContinentModifier = 0.81;
        }
    }

    return combatContinentModifier;
}

export function handleWarEndingsAndOptions(situation, contestedTerritory, attackingArmyRemaining, defendingArmyRemaining, routFromSiege, ai, siegeObject) {
    let retreatButton;
    let advanceButton;
    let siegeButton;

    if (!ai) {
        let attackArrayText = [...attackingArmyRemaining, ...defendingArmyRemaining];
        setArmyTextValues(attackArrayText, 1, contestedTerritory.uniqueId);
        retreatButton = document.getElementById("retreatButton");
        advanceButton = document.getElementById("advanceButton");
        siegeButton = document.getElementById("siegeButton");
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
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault) + (Math.floor(defendingArmyRemaining[1] / 2) * oilRequirements.assault);
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air) + (Math.floor(defendingArmyRemaining[2] / 2) * oilRequirements.air);
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval) + (Math.floor(defendingArmyRemaining[3] / 2) * oilRequirements.naval);
                playerOwnedTerritories.push(contestedPath);
                setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
                turnGainsArrayPlayer.changeInfantry += Math.floor(defendingArmyRemaining[0] / 2);
                turnGainsArrayPlayer.changeAssault += Math.floor(defendingArmyRemaining[1] / 2);
                turnGainsArrayPlayer.changeAir += Math.floor(defendingArmyRemaining[2] / 2);
                turnGainsArrayPlayer.changeNaval += Math.floor(defendingArmyRemaining[3] / 2);
                contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0] + (Math.floor(defendingArmyRemaining[0] / 2));
                contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1] + (Math.floor(defendingArmyRemaining[1] / 2));
                contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2] + (Math.floor(defendingArmyRemaining[2] / 2));
                contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3] + (Math.floor(defendingArmyRemaining[3] / 2));
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
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[1] * oilRequirements.assault) + (Math.floor(defendingArmyRemaining[1] / 2) * oilRequirements.assault);
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[2] * oilRequirements.air) + (Math.floor(defendingArmyRemaining[2] / 2) * oilRequirements.air);
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[3] * oilRequirements.naval) + (Math.floor(defendingArmyRemaining[3] / 2) * oilRequirements.naval);
                        country.changeInfantry += Math.floor(siegeObject.defendingArmyRemaining[0] / 2);
                        country.changeAssault += Math.floor(siegeObject.defendingArmyRemaining[1] / 2);
                        country.changeAir += Math.floor(siegeObject.defendingArmyRemaining[2] / 2);
                        country.changeNaval += Math.floor(siegeObject.defendingArmyRemaining[3] / 2);
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
            turnGainsArrayPlayer.changeOilDemand += (Math.floor(attackingArmyRemaining[1] * 0.8) * oilRequirements.assault);
            turnGainsArrayPlayer.changeOilDemand += (Math.floor(attackingArmyRemaining[2] * 0.8) * oilRequirements.air);
            turnGainsArrayPlayer.changeOilDemand += (Math.floor(attackingArmyRemaining[3] * 0.8) * oilRequirements.naval);
            playerOwnedTerritories.push(contestedPath);
            setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
            contestedTerritory.infantryForCurrentTerritory = (Math.floor(attackingArmyRemaining[0] * 0.8));
            contestedTerritory.assaultForCurrentTerritory = (Math.floor(attackingArmyRemaining[1] * 0.8));
            contestedTerritory.airForCurrentTerritory = (Math.floor(attackingArmyRemaining[2] * 0.8));
            contestedTerritory.navalForCurrentTerritory = (Math.floor(attackingArmyRemaining[3] * 0.8));
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
    contestedTerritory.oilDemand = ((oilRequirements.assault * contestedTerritory.assaultForCurrentTerritory) + (oilRequirements.air * contestedTerritory.airForCurrentTerritory) + (oilRequirements.naval * contestedTerritory.navalForCurrentTerritory));
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
    const turnsToDeactivate = Math.floor(Math.random() * 3) + 1;
    playerTurnsDeactivatedArray.push([contestedPath.getAttribute("uniqueid"), turnsToDeactivate, 0]);

    let tempArray = currentMapColorAndStrokeArray;
    for (let i = 0; i < currentMapColorAndStrokeArray.length; i++) {
        if (currentMapColorAndStrokeArray[i][0] === contestedPath.getAttribute("uniqueid")) {
            tempArray[i] = [contestedPath.getAttribute("uniqueid"), playerColour(), 3];
        }
    }

    document.getElementById("attack-destination-container").style.display = "none";
    document.getElementById("move-phase-button").innerHTML = "DEACTIVATED";
    document.getElementById("move-phase-button").disabled = true;
    document.getElementById("move-phase-button").classList.remove("move-phase-button-red-background");
    document.getElementById("move-phase-button").classList.remove("move-phase-button-blue-background");
    document.getElementById("move-phase-button").classList.remove("move-phase-button-green-background");
    document.getElementById("move-phase-button").classList.add("move-phase-button-grey-background");

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
    let skirmishesCompleted = 0;

    const allZeroDefend = defendingArmyRemaining.every(count => count === 0);
    const allZeroAttack = attackArmyRemaining.every(count => count === 0);

    // Run the loop for one skirmish per click
    if (skirmishesCompleted < skirmishesPerRound) {
        const skirmishOrder = unitTypes.slice().sort(() => Math.random() - 0.5);

        for (const unitType of skirmishOrder) {
            const unitTypeIndex = unitTypes.indexOf(unitType);

            //audit 5.2 K: this no longer requires the defender to have units of the SAME
            //type. Each attacking unit engages its own type where it can and its best
            //available matchup where it cannot, so no pair of armies can stall the battle.
            if (
                attackArmyRemaining[unitTypeIndex] > 0 &&
                defendingArmyRemaining.some(count => count > 0) &&
                skirmishesCompleted < skirmishesPerRound
            ) {
                let skirmishes = 0;

                while (
                    attackArmyRemaining[unitTypeIndex] > 0 &&
                    skirmishesCompleted < skirmishesPerRound
                    ) {
                    const defendingUnitTypeIndex = chooseDefendingUnitTypeIndex(unitTypeIndex, defendingArmyRemaining);
                    if (defendingUnitTypeIndex === -1) {
                        break; //nothing left to fight
                    }

                    const effectiveness = UNIT_MATCHUP_EFFECTIVENESS[unitTypeIndex][defendingUnitTypeIndex];
                    const odds = Math.min((updatedProbability / 100) * effectiveness, 0.65);
                    const attackerWins = Math.random() <= odds;

                    if (attackerWins) {
                        defendingArmyRemaining[defendingUnitTypeIndex]--;
                    } else {
                        attackArmyRemaining[unitTypeIndex]--;
                    }

                    skirmishes++;
                    skirmishesCompleted++;
                }

                console.log(`Attacking ${unitType} Left: ${attackArmyRemaining[unitTypeIndex]} out of ${totalAttackingArmy[unitTypeIndex]}`);
                console.log(`Defending ${unitType} Left: ${defendingArmyRemaining[unitTypeIndex]} out of ${totalDefendingArmy[unitTypeIndex]}`);
            } else if (allZeroDefend) {
                handleWarEndingsAndOptions(0, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
            } else if (allZeroAttack) {
                handleWarEndingsAndOptions(1, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
            } else {
                //update UI text
                let attackArrayText = [...attackArmyRemaining, ...defendingArmyRemaining];
                setArmyTextValues(attackArrayText, 1, arrayOfUniqueIdsAndAttackingUnits[0]);
                //audit 5.2 M: a `let` here shadowed the module binding, so the freshly
                //computed probability was shown once and then thrown away -- every later
                //reader saw the stale module value.
                updatedProbability = getUpdatedProbability();
                setAttackProbabilityOnUI(updatedProbability, 1);
                break;
            }
        }
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

    if (currentRound < rounds && !defendingArmyRemaining.every(count => count === 0) && currentRound !== 0) {
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

        if (defendingArmyRemaining.every(count => count === 0)) { //killed all defenders
            handleWarEndingsAndOptions(0, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
        } else if (attackArmyRemaining.every(count => count === 0)) { //all attacking force destroyed
            handleWarEndingsAndOptions(1, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
        } else {
            if (combinedForceDefend < (0.05 * unchangeableWarStartCombinedForceDefend)) { //rout enemy
                handleWarEndingsAndOptions(2, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
            } else if (combinedForceDefend < (0.15 * unchangeableWarStartCombinedForceDefend)) { //last push
                handleWarEndingsAndOptions(3, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
            } else if (combinedForceAttack < (0.10 * unchangeableWarStartCombinedForceAttack)) { // you were routed
                handleWarEndingsAndOptions(4, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false, false, null);
            } else {
                let attackArrayText = [...attackArmyRemaining, ...defendingArmyRemaining];
                setArmyTextValues(attackArrayText, 1, arrayOfUniqueIdsAndAttackingUnits[0]); // fight again
                console.log("you will have to fight again with a bit of desertion for war weariness - redo 5 rounds with new values - 5% attacker amounts");
                attackArmyRemaining = attackArmyRemaining.map(value => Math.max(0, Math.floor(value * 0.95)));
                initialCombinedForceAttack = calculateCombinedForce(attackArmyRemaining);
                initialCombinedForceDefend = calculateCombinedForce(defendingArmyRemaining);

                updatedProbability = calculateProbabilityPreBattle(attackArmyRemaining, allTerritories(), true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);

                skirmishesPerType = [
                    Math.min(attackArmyRemaining[0], defendingArmyRemaining[0]),
                    Math.min(attackArmyRemaining[1], defendingArmyRemaining[1]),
                    Math.min(attackArmyRemaining[2], defendingArmyRemaining[2]),
                    Math.min(attackArmyRemaining[3], defendingArmyRemaining[3])
                ];
                totalSkirmishes = countPossibleSkirmishes(attackArmyRemaining, defendingArmyRemaining); //audit 5.2 K

                const retreatButton = document.getElementById("retreatButton");
                const advanceButton = document.getElementById("advanceButton");

                retreatButton.disabled = true;
                retreatButton.style.backgroundColor = "rgb(128,128,128)";
                setCurrentRound(0);
                setFirstSetOfRounds(false);
                setAdvanceButtonText(5, advanceButton);
                attackingArmyRemaining = attackArmyRemaining;
            }
        }
    }
}

export function calculateCombinedForce(army) {
    const [infantry, assault, air, naval] = army;
    return infantry + (assault * vehicleArmyPersonnelWorth.assault) + (air * vehicleArmyPersonnelWorth.air) + (naval * vehicleArmyPersonnelWorth.naval);
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

export function calculatePlayerInitiatedSiegePerTurn() {
    let continueSiegeArray = [];
    if (playerSiegeWarsList && Object.keys(playerSiegeWarsList).length > 0) {

        //calculate chance of a siege "hit"
        for (const key in playerSiegeWarsList) {
            let hitThisTurn;
            let hitCount = 0;
            let totalSiegeScore = 0;
            let numberOfForts;
            let defenseBonusAttackedTerritory = 0;
            let mountainDefenseBonusAttackedTerritory = playerSiegeWarsList[key].defendingTerritory.mountainDefenseBonus;

            for (let i = 0; i < hitIterations; i++) {
                totalSiegeScore = calculateSiegeScore(playerSiegeWarsList[key]);
                defenseBonusAttackedTerritory = playerSiegeWarsList[key].defendingTerritory.defenseBonus;
                numberOfForts = playerSiegeWarsList[key].defendingTerritory.fortsBuilt;
                const hitChance = calculateChanceOfASiegeHit(totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory);

                let hit = Math.random() < hitChance;
                hit ? hitCount++ : null;
            }
            hitCount > hitIterations / 2 ? (hitThisTurn = true, console.log("Hit this turn for the " + key + " war, " + hitCount + " hits from " + hitIterations)) : (hitThisTurn = false, console.log("No hit this turn for the " + key + " war, " + hitCount + " hits from " + hitIterations));
            // console.log(key + " war: " + hitThisTurn);
            hitCount = 0;

            let damage = [];

            hitThisTurn ? damage = calculateDamageDone(false, playerSiegeWarsList[key], totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory) : damage = false;

            if (!damage) { //if no hit
                //audit 5.1 D: this used to `return`, which abandoned the whole loop and
                //handed gameTurnsLoop `undefined` -- so one siege missing its hit roll
                //silently cancelled every other siege's turn processing. A miss is just a
                //quiet turn for that one siege; it continues.
                continueSiegeArray.push(true);
                continue;
            } else if (damage[2]) { //if arrested
                playerSiegeWarsList[key].defendingArmyRemaining.push(1); //add routing defeat to array
                continueSiegeArray.push(playerSiegeWarsList[key]);
            } else {
                //do the damage
                changeDefendingTerritoryStatsBasedOnSiege(playerSiegeWarsList[key], damage);
                continueSiegeArray.push(true); //siege can continue
            }
        }
    }
    return continueSiegeArray;
}

export function calculateAiInitiatedSiegePerTurn() {
    let continueSiegeArray = [];
    if (aiSiegeWarsList && Object.keys(aiSiegeWarsList).length > 0) {

        //calculate chance of a siege "hit"
        for (const key in aiSiegeWarsList) {
            let hitThisTurn;
            let hitCount = 0;
            let totalSiegeScore = 0;
            let numberOfForts;
            let defenseBonusAttackedTerritory = 0;
            let mountainDefenseBonusAttackedTerritory = aiSiegeWarsList[key].defendingTerritory.mountainDefenseBonus;

            for (let i = 0; i < hitIterations; i++) {
                totalSiegeScore = calculateSiegeScore(aiSiegeWarsList[key]);
                defenseBonusAttackedTerritory = aiSiegeWarsList[key].defendingTerritory.defenseBonus;
                numberOfForts = aiSiegeWarsList[key].defendingTerritory.fortsBuilt;
                const hitChance = calculateChanceOfASiegeHit(totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory);

                let hit = Math.random() < hitChance;
                hit ? hitCount++ : null;
            }
            hitCount > hitIterations / 2 ? (hitThisTurn = true, console.log("Hit this turn for the " + key + " AI war, " + hitCount + " hits from " + hitIterations)) : (hitThisTurn = false, console.log("No hit this turn for the " + key + " AI war, " + hitCount + " hits from " + hitIterations));
            console.log(key + " war: " + hitThisTurn);
            hitCount = 0;

            let damage = [];

            hitThisTurn ? damage = calculateDamageDone(true, aiSiegeWarsList[key], totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory) : damage = false;

            if (!damage) { //if no hit
                //audit 5.1 D -- see calculatePlayerInitiatedSiegePerTurn above. Same bug,
                //same fix: a miss must not abandon the other AI sieges.
                continueSiegeArray.push(true);
                continue;
            } else if (damage[2]) { //if arrested
                aiSiegeWarsList[key].defendingArmyRemaining.push(1); //add routing defeat to array
                continueSiegeArray.push(aiSiegeWarsList[key]);
            } else {
                //do the damage
                changeDefendingTerritoryStatsBasedOnSiege(aiSiegeWarsList[key], damage);
                continueSiegeArray.push(true); //siege can continue
            }
        }
    }
    return continueSiegeArray;
}

function calculateChanceOfASiegeHit(totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory) {
    const scoreDifference = totalSiegeScore - (defenseBonusAttackedTerritory + mountainDefenseBonusAttackedTerritory);
    const baseProbability = 0.5;

    let hitProbability = baseProbability + (scoreDifference / 1000);
    hitProbability = Math.max(0, Math.min(1, hitProbability));

    return hitProbability;
}

function calculateDamageDone(ai, siegeObject, totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory) {
    const difference = totalSiegeScore - (defenseBonusAttackedTerritory + mountainDefenseBonusAttackedTerritory);
    let arrested;

    // Resource destruction counters
    const resources = [
        {
            name: "forts",
            destroyedCounter: 0,
            messages: {
                multiple: "forts destroyed!",
                single: "a fort destroyed!"
            }
        },
        {
            name: "farms",
            destroyedCounter: 0,
            messages: {
                multiple: "farms destroyed!",
                single: "a farm destroyed!"
            }
        },
        {
            name: "forests",
            destroyedCounter: 0,
            messages: {
                multiple: "forests destroyed!",
                single: "a forest destroyed!"
            }
        },
        {
            name: "oil wells",
            destroyedCounter: 0,
            messages: {
                multiple: "oil wells destroyed!",
                single: "an oil well destroyed!"
            }
        }
    ];

    // Define the sliding scale probabilities
    const slidingScale = [{
        scoreDifference: 0,
        destroyProbability: 0
    },
        {
            scoreDifference: 20,
            destroyProbability: 0.3
        },
        {
            scoreDifference: 70,
            destroyProbability: 0.5
        },
        {
            scoreDifference: 130,
            destroyProbability: 0.7
        },
        {
            scoreDifference: 200,
            destroyProbability: 0.9
        },
        {
            scoreDifference: 280,
            destroyProbability: 1
        },
    ];

    //BUG FIX, unmasked by Phase 4.7. Collateral damage was declared here and assigned in
    //three of the four paths below: it was left UNDEFINED when the destroy roll succeeded
    //but the score difference was under 50 (reachable whenever difference >= 20, where the
    //destroy probability is 0.3). `foodCapacityDestroyed` then came out NaN, and the
    //`arrested` flag came out false because `undefined === 0` is false.
    //
    //That NaN used to land on the siege's own COPY of the territory and stop there, because
    //the copy-back at the end of a siege carried only the four building counts. Now that a
    //siege references the real territory, it reached the world -- which is how the ten-turn
    //`long-run` spec found it. Every path wants the same value, so it is computed once.
    const collateralDamage = calculateCollateralDamage(difference);

    // Find the appropriate destroy probability based on the difference
    const destroyProbability = slidingScale.reduce((acc, scale) => (difference >= scale.scoreDifference ? scale.destroyProbability : acc), 0);

    // Generate a random number and compare it with the destroy probability

    // console.log("difference: " + difference);
    if (Math.random() < destroyProbability) {
        // Determine the number of forts to destroy based on the sliding scale
        if (difference >= 200) {
            // First 70:30 chance
            if (Math.random() > 0.3) {
                const resourceIndex = Math.floor(Math.random() * resources.length);
                const resource = resources[resourceIndex];
                resource.destroyedCounter += 1;
                // console.log(`1 ${resource.name} destroyed!`);
            }

            // Second 50:50 chance
            if (Math.random() > 0.5) {
                const resourceIndex = Math.floor(Math.random() * resources.length);
                const resource = resources[resourceIndex];
                resource.destroyedCounter += 1;
                // console.log(`1 ${resource.name} destroyed!`);
            }
        } else if (difference >= 50) {
            // Single 50:50 chance
            if (Math.random() > 0.5) {
                const resourceIndex = Math.floor(Math.random() * resources.length);
                const resource = resources[resourceIndex];
                resource.destroyedCounter += 1;
                // console.log(`1 ${resource.name} destroyed!`);
            }
        }
    }
    // console.log("collateral damage only!");
    const foodCapacityDestroyed = Math.floor(siegeObject.defendingTerritory.foodCapacity * collateralDamage / 100);
    collateralDamage === 0 ? arrested = true : arrested = false;
    const damage = [resources, foodCapacityDestroyed, arrested];
    // console.log(foodCapacityDestroyed + " reduced from food capacity, representing a " + collateralDamage + "% fall");

    return damage;
}

function calculateCollateralDamage(difference) {
    if (difference >= 0 && difference < 20) {
        return Math.floor(Math.random() * 6) + 1;
    } else if (difference >= 20 && difference < 50) {
        return Math.floor(Math.random() * 12) + 1;
    } else if (difference >= 50 && difference < 100) {
        return Math.floor(Math.random() * 18) + 1;
    } else if (difference >= 100) {
        return Math.floor(Math.random() * 25) + 1;
    } else {
        let arrested = Math.random();
        if (arrested > 0.6) {
            // console.log("arrested for being too pathetic to siege!");
            return 0; //end siege due to arrest
        } else {
            return 1;
        }
    }
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

        defendingTerritory.infantryForCurrentTerritory = siege.defendingArmyRemaining[0] + (Math.floor(siege.attackingArmyRemaining[0] * 0.5));
        //BUG FIX: a misplaced bracket. Every sibling line reads
        //`defendingArmyRemaining[n] + Math.floor(attackingArmyRemaining[n] * 0.5)`; this one
        //read `defendingArmyRemaining[1 + Math.floor(...)]`, indexing a four-element array by
        //half the attacker's assault count. Any arrest against an attacker with two or more
        //assault units therefore assigned `undefined`, and the army total below came out NaN
        //-- and stayed NaN, because every later turn recomputes from it.
        defendingTerritory.assaultForCurrentTerritory = siege.defendingArmyRemaining[1] + (Math.floor(siege.attackingArmyRemaining[1] * 0.5));
        defendingTerritory.airForCurrentTerritory = siege.defendingArmyRemaining[2] + (Math.floor(siege.attackingArmyRemaining[2] * 0.5));
        defendingTerritory.navalForCurrentTerritory = siege.defendingArmyRemaining[3] + (Math.floor(siege.attackingArmyRemaining[3] * 0.5));
        defendingTerritory.armyForCurrentTerritory = defendingTerritory.infantryForCurrentTerritory + (defendingTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (defendingTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (defendingTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
        document.getElementById("bottom-table").rows[0].cells[17].innerHTML = formatNumbersToKMB(defendingTerritory.armyForCurrentTerritory, 0);

        siege.attackingArmyRemaining = [0, 0, 0, 0];
        siege.resolution = "Arrested";

        setUpResultsOfWarExternal(true);
        setCurrentWarFlagString(defendingTerritory.dataName);

        if (!ai) {
            populateWarResultPopup(1, playerCountryName(), defendingTerritory, "arrest", siege);
            addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
            recordHistoricWar(siege);
            removeSiege("player", defendingTerritory.territoryName);
        } else {
            recordHistoricAiWar(siege);
            removeSiege("ai", defendingTerritory.territoryName);
        }

        //`underSiege` is no longer written here. Phase 4.4/4.5: it is derived from the
        //siege lists and rendered by src/ui/mapAttributeSync.js, so removing the siege
        //above is what clears it -- there is no second fact to keep in step.
        removeSiegeImageFromPath(ai, defendingPath);
    }
}

function changeDefendingTerritoryStatsBasedOnSiege(siege, damage) {
    if (siege.defendingTerritory.fortsBuilt >= damage[0][0].destroyedCounter) { //remove forts
        siege.defendingTerritory.fortsBuilt -= damage[0][0].destroyedCounter;
    } else {
        siege.defendingTerritory.fortsBuilt = 0;
    }
    if (siege.defendingTerritory.farmsBuilt >= damage[0][1].destroyedCounter) { //remove farms
        siege.defendingTerritory.farmsBuilt -= damage[0][1].destroyedCounter;
    } else {
        siege.defendingTerritory.farmsBuilt = 0;
    }
    if (siege.defendingTerritory.forestsBuilt >= damage[0][2].destroyedCounter) { //remove forests
        siege.defendingTerritory.forestsBuilt -= damage[0][2].destroyedCounter;
    } else {
        siege.defendingTerritory.forestsBuilt = 0;
    }
    if (siege.defendingTerritory.oilWellsBuilt >= damage[0][3].destroyedCounter) { //remove forts
        siege.defendingTerritory.oilWellsBuilt -= damage[0][3].destroyedCounter;
    } else {
        siege.defendingTerritory.oilWellsBuilt = 0;
    }
    console.log("remaining farm: " + siege.defendingTerritory.farmsBuilt + " forest: " + siege.defendingTerritory.forestsBuilt + " oilwell: " + siege.defendingTerritory.oilWellsBuilt + " fort: " + siege.defendingTerritory.fortsBuilt);
    //recalculate defense bonus
    siege.defendingTerritory.defenseBonus = Math.ceil((siege.defendingTerritory.fortsBuilt * (siege.defendingTerritory.fortsBuilt + 1) * 10) * siege.defendingTerritory.devIndex + siege.defendingTerritory.isLandLockedBonus);

    if (siege.defendingTerritory.foodCapacity > 0 && Number.isFinite(damage[1])) { //lower food capacity
        //Clamped: a long siege could otherwise drive capacity negative, and the finite check
        //means a bad damage figure costs one siege tick rather than poisoning the territory
        //for the rest of the game. Neither should be reachable; both were.
        siege.defendingTerritory.foodCapacity = Math.max(0, siege.defendingTerritory.foodCapacity - damage[1]);
    }
}

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
    return Math.floor((siegeObjectElement.attackingArmyRemaining[0] * armyTypeSiegeValues.infantry) + (siegeObjectElement.attackingArmyRemaining[1] * armyTypeSiegeValues.assault) + (siegeObjectElement.attackingArmyRemaining[2] * armyTypeSiegeValues.air) + (siegeObjectElement.attackingArmyRemaining[3] * armyTypeSiegeValues.naval));
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
    const turnsToDeactivate = Math.floor(Math.random() * 3) + 1;
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