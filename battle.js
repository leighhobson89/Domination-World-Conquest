import {
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable,
    formatNumbersToKMB,
    mainGameArray,
    oilRequirements,
    playerOwnedTerritories,
    setUseableNotUseableWeaponsDueToOilDemand,
    turnGainsArrayPlayer,
    vehicleArmyPersonnelWorth
} from './resourceCalculations.js';
import {
    currentMapColorAndStrokeArray,
    fillPathBasedOnStartingCountryColor,
    getOriginalDefendingTerritory,
    getSiegeObjectFromPath,
    lastClickedPath,
    paths,
    playerColour,
    playerCountry,
    populateWarResultPopup,
    removeSiegeImageFromPath,
    retreatButtonState,
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
    setUpResultsOfWarExternal,
    mapMode,
    saveMapColorState
} from './ui.js';
import {
    callDice,
} from './dices.js';

let transferArmyOutOfTerritoryOnStartingInvasionFn;

function handleImportedModule(module) {
    const {
        transferArmyOutOfTerritoryOnStartingInvasion
    } = module;
    transferArmyOutOfTerritoryOnStartingInvasionFn = transferArmyOutOfTerritoryOnStartingInvasion;
}

function importModuleWithTimeout() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            import('./transferAndAttack.js')
                .then(module => {
                    resolve(module);
                })
                .catch(error => {
                    reject(error);
                });
        }, 1000);
    });
}

importModuleWithTimeout()
    .then(module => {
        handleImportedModule(module);
    })
    .catch(error => {
        console.log(error);
    });

const maxAreaThreshold = 350000;
export let finalAttackArray = [];
export let proportionsOfAttackArray = [];
let reusableAttackingAverageDevelopmentIndex;
let reusableCombatContinentModifier;
export let playerTurnsDeactivatedArray = [];

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
export let retrievalArray = [];

export let siegeObject = {};
export let historicWars = [];
export let currentWarId;
export let nextWarId = 0;
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
    console.log("warId = " + currentWarId);
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
    unchangeableWarStartCombinedForceDefend = calculateCombinedForce(totalAttackingArmy);

    initialCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
    initialCombinedForceDefend = calculateCombinedForce(totalDefendingArmy);

    // Calculate the total number of skirmishes
    skirmishesPerType = [
        Math.min(totalAttackingArmy[0], totalDefendingArmy[0]),
        Math.min(totalAttackingArmy[1], totalDefendingArmy[1]),
        Math.min(totalAttackingArmy[2], totalDefendingArmy[2]),
        Math.min(totalAttackingArmy[3], totalDefendingArmy[3])
    ];
    totalSkirmishes = skirmishesPerType.reduce((sum, skirmishes) => sum + skirmishes, 0);

    let hasSiegedBefore = historicWars.some((siege) => siege.warId === currentWarId);

    // Divide skirmishes into 5 rounds
    skirmishesPerRound = Math.ceil(totalSkirmishes / rounds);

    attackingArmyRemaining = [...totalAttackingArmy];
    if (hasSiegedBefore) {
        let war = historicWars.find((siege) => siege.warId === currentWarId);
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

    console.log("Defending Territory Area: " + defendingTerritoryArea);
    console.log("Area Weight (Defender): " + areaWeightDefender);

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

export function handleWarEndingsAndOptions(situation, contestedTerritory, attackingArmyRemaining, defendingArmyRemaining, routFromSiege) {
    let attackArrayText = [...attackingArmyRemaining, ...defendingArmyRemaining];
    setArmyTextValues(attackArrayText, 1, contestedTerritory.uniqueId);
    const retreatButton = document.getElementById("retreatButton");
    const advanceButton = document.getElementById("advanceButton");
    const siegeButton = document.getElementById("siegeButton");

    let contestedPath;
    let won = false;
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("uniqueid") === contestedTerritory.uniqueId) {
            contestedPath = paths[i];
            break;
        }
    }
    if (routFromSiege) { //assure correct data updated
        for (let j = 0; j < mainGameArray.length; j++) {
            if (mainGameArray[j].uniqueId === contestedTerritory.uniqueId) {
                contestedTerritory = mainGameArray[j];
                break;
            }
        }
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
            contestedPath.setAttribute("owner", "Player");
            contestedTerritory.owner = "Player";
            contestedPath.setAttribute("data-name", playerCountry);
            contestedTerritory.dataName = playerCountry;
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
            console.log("you routed the enemy, they are out of there, victory is yours! - capture half of defense remainder and territory");
            //Set territory to owner player, replace army values with remaining attackers + half of defenders remaining in main array, change colors, deactivate territory until next turn
            setDefendingTerritoryCopyStart(contestedTerritory);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault) + (Math.floor(defendingArmyRemaining[1] / 2) * oilRequirements.assault);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air) + (Math.floor(defendingArmyRemaining[2] / 2) * oilRequirements.air);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval) + (Math.floor(defendingArmyRemaining[3] / 2) * oilRequirements.naval);
            playerOwnedTerritories.push(contestedPath);
            contestedPath.setAttribute("owner", "Player");
            contestedTerritory.owner = "Player";
            contestedPath.setAttribute("data-name", playerCountry);
            contestedTerritory.dataName = playerCountry;
            contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0] + (Math.floor(defendingArmyRemaining[0] / 2));
            contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1] + (Math.floor(defendingArmyRemaining[1] / 2));
            contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2] + (Math.floor(defendingArmyRemaining[2] / 2));
            contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3] + (Math.floor(defendingArmyRemaining[3] / 2));
            contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
            turnGainsArrayPlayer.changeInfantry += Math.floor(defendingArmyRemaining[0] / 2);
            turnGainsArrayPlayer.changeAssault += Math.floor(defendingArmyRemaining[1] / 2);
            turnGainsArrayPlayer.changeAir += Math.floor(defendingArmyRemaining[2] / 2);
            turnGainsArrayPlayer.changeNaval += Math.floor(defendingArmyRemaining[3] / 2);
            setAdvanceButtonState(2);
            setAdvanceButtonText(4, advanceButton);
            retreatButton.disabled = true;
            retreatButton.style.backgroundColor = "rgb(128, 128, 128)";
            advanceButton.disabled = false;
            siegeButton.disabled = true;
            siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
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
            contestedPath.setAttribute("owner", "Player");
            contestedTerritory.owner = "Player";
            contestedPath.setAttribute("data-name", playerCountry);
            contestedTerritory.dataName = playerCountry;
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
        case 5:
            //situation where user sets a siege
            break;
        case 6:
            //situation where user transfers from vehicles to infantry
            break;
        case 7:
            //situation where user transfers from infantry to vehicles
            break;

    }
    contestedTerritory.oilDemand = ((oilRequirements.assault * contestedTerritory.assaultForCurrentTerritory) + (oilRequirements.air * contestedTerritory.airForCurrentTerritory) + (oilRequirements.naval * contestedTerritory.navalForCurrentTerritory));
    setUseableNotUseableWeaponsDueToOilDemand(mainGameArray, contestedTerritory);

    if (won) {
        setFlag(playerCountry, 2);
        contestedPath.setAttribute("data-name", playerCountry);
        deactivateTerritory(contestedPath, contestedTerritory);
        if (mapMode === 2) {
            contestedPath.style.stroke = "white";
        }
    } else {
        contestedPath.setAttribute("fill", fillPathBasedOnStartingCountryColor(contestedPath));
    }
}

function deactivateTerritory(contestedPath) { //cant use a territory if just conquered it til this function decides
    const turnsToDeactivate = Math.floor(Math.random() * 3) + 1;
    playerTurnsDeactivatedArray.push([contestedPath.getAttribute("uniqueid"), turnsToDeactivate, 0]);


    let tempArray = currentMapColorAndStrokeArray;
    for (let i = 0; i < currentMapColorAndStrokeArray.length; i++) {
        if (currentMapColorAndStrokeArray[i][0] === contestedPath.getAttribute("uniqueid")) {
            tempArray[i] = [contestedPath.getAttribute("uniqueid"), playerColour, 3];
        }
    }

    document.getElementById("attack-destination-container").style.display = "none";
    document.getElementById("move-phase-button").innerHTML = "DEACTIVATED";
    document.getElementById("move-phase-button").disabled = true;
    document.getElementById("move-phase-button").classList.remove("move-phase-button-red-background");
    document.getElementById("move-phase-button").classList.remove("move-phase-button-blue-background");
    document.getElementById("move-phase-button").classList.remove("move-phase-button-green-background");
    document.getElementById("move-phase-button").classList.add("move-phase-button-grey-background");

    contestedPath.setAttribute("deactivated", "true");
    contestedPath.style.stroke = "red";
    contestedPath.style.strokeDasharray = "10, 5";
    contestedPath.setAttribute("stroke-width", "3");

    setTerritoryAboutToBeAttackedFromExternal(null); //for filling color to work properly
    setCurrentMapColorAndStrokeArrayFromExternal(tempArray);

    //set deactivated in main array
    for (let i = 0; i < mainGameArray.length; i++) {
        if (mainGameArray[i].uniqueId === contestedPath.getAttribute("uniqueid")) {
            mainGameArray[i].isDeactivated = true;
        }
    }
}

export function activateAllPlayerTerritoriesForNewTurn() { //reactivate all territories at start of turn
    for (let i = 0; i < playerTurnsDeactivatedArray.length; i++) {
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
                    paths[j].setAttribute("deactivated", "false");
                    for (let k = 0; k < mainGameArray.length; k++) {
                        if (mainGameArray[k].uniqueId === paths[j].getAttribute("uniqueid")) {
                            mainGameArray[k].isDeactivated = false;
                        }
                    }
                    if (mapMode === 1) {
                        currentMapColorAndStrokeArray = saveMapColorState(false);
                    }
                }
            }
        }
    }
}
export async function processRound(currentRound, arrayOfUniqueIdsAndAttackingUnits, attackArmyRemaining, defendingArmyRemaining, skirmishesPerRound) {
    // let diceScoreArray; //DICE CODE EXECUTION
    // diceScoreArray = await callDice(fillPathBasedOnStartingCountryColor(lastClickedPath));
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

            if (
                attackArmyRemaining[unitTypeIndex] > 0 &&
                defendingArmyRemaining[unitTypeIndex] > 0 &&
                skirmishesCompleted < skirmishesPerRound
            ) {
                let attackerCount = attackArmyRemaining[unitTypeIndex];
                let defenderCount = defendingArmyRemaining[unitTypeIndex];
                let skirmishes = 0;

                while (
                    attackerCount > 0 &&
                    defenderCount > 0 &&
                    skirmishesCompleted < skirmishesPerRound
                    ) {
                    const odds = Math.min(updatedProbability / 100, 0.65);
                    const attackerWins = Math.random() <= odds;

                    if (attackerWins) {
                        defenderCount--;
                        defendingArmyRemaining[unitTypeIndex]--;
                    } else {
                        attackerCount--;
                        attackArmyRemaining[unitTypeIndex]--;
                    }

                    skirmishes++;
                    skirmishesCompleted++;
                }

                console.log(`Attacking ${unitType} Left: ${attackArmyRemaining[unitTypeIndex]} out of ${totalAttackingArmy[unitTypeIndex]}`);
                console.log(`Defending ${unitType} Left: ${defendingArmyRemaining[unitTypeIndex]} out of ${totalDefendingArmy[unitTypeIndex]}`);
            } else if (allZeroDefend) {
                handleWarEndingsAndOptions(0, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false);
            } else if (allZeroAttack) {
                handleWarEndingsAndOptions(1, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false);
            } else {
                //update UI text
                let attackArrayText = [...attackArmyRemaining, ...defendingArmyRemaining];
                setArmyTextValues(attackArrayText, 1, arrayOfUniqueIdsAndAttackingUnits[0]);
                let updatedProbability = getUpdatedProbability();
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

    updatedProbability = calculateProbabilityPreBattle(attackArmyRemaining, mainGameArray, true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);
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
            handleWarEndingsAndOptions(0, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false);
        } else if (attackArmyRemaining.every(count => count === 0)) { //all attacking force destroyed
            handleWarEndingsAndOptions(1, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false);
        } else {
            if (combinedForceDefend < (0.05 * unchangeableWarStartCombinedForceDefend)) { //rout enemy
                handleWarEndingsAndOptions(2, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false);
            } else if (combinedForceDefend < (0.15 * unchangeableWarStartCombinedForceDefend)) { //last push
                handleWarEndingsAndOptions(3, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false);
            } else if (combinedForceAttack < (0.10 * unchangeableWarStartCombinedForceAttack)) { // you were routed
                handleWarEndingsAndOptions(4, defendingTerritory, attackArmyRemaining, defendingArmyRemaining, false);
            } else {
                let attackArrayText = [...attackArmyRemaining, ...defendingArmyRemaining];
                setArmyTextValues(attackArrayText, 1, arrayOfUniqueIdsAndAttackingUnits[0]); // fight again
                console.log("you will have to fight again with a bit of desertion for war weariness - redo 5 rounds with new values - 5% attacker amounts");
                attackArmyRemaining = attackArmyRemaining.map(value => Math.max(0, Math.floor(value * 0.95)));
                initialCombinedForceAttack = calculateCombinedForce(attackArmyRemaining);
                initialCombinedForceDefend = calculateCombinedForce(defendingArmyRemaining);

                updatedProbability = calculateProbabilityPreBattle(attackArmyRemaining, mainGameArray, true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);

                skirmishesPerType = [
                    Math.min(attackArmyRemaining[0], defendingArmyRemaining[0]),
                    Math.min(attackArmyRemaining[1], defendingArmyRemaining[1]),
                    Math.min(attackArmyRemaining[2], defendingArmyRemaining[2]),
                    Math.min(attackArmyRemaining[3], defendingArmyRemaining[3])
                ];
                totalSkirmishes = skirmishesPerType.reduce((sum, skirmishes) => sum + skirmishes, 0);

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

function calculateCombinedForce(army) {
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

export function getCurrentWarId() {
    return currentWarId;
}

export function setCurrentWarId(value) {
    return currentWarId = value;
}

export function setNextWarId(value) {
    return nextWarId = value;
}

export function addRemoveWarSiegeObject(addOrRemove, warId, battleStart) {
    let defendingTerritoryCopy = getOriginalDefendingTerritory();
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
        siegeObject[defendingTerritoryCopy.territoryName] = {
            warId: warId,
            proportionsAttackers: proportionsAttackers,
            defendingTerritory: defendingTerritoryCopy,
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
        };

        battleStart ? transferArmyOutOfTerritoryOnStartingInvasionFn(getFinalAttackArray(), mainGameArray) : null;

        return siegeObject[defendingTerritory.territoryName].defendingTerritory;

    } else if (addOrRemove === 1) {
        let isDuplicate = false;
        for (const key in siegeObject) {
            if (siegeObject.hasOwnProperty(key) && siegeObject[key].warId === warId) {
                isDuplicate = historicWars.some(obj => obj.warId === warId);
                if (!isDuplicate) {
                    historicWars.push(siegeObject[key]);
                }
                delete siegeObject[key];
                break;
            }
        }
    }
    console.log(historicWars);
}

export function addWarToHistoricWarArray(warResolution, warId, retreatBeforeStart) {
    let proportionsAttackers;
    let defendingTerritoryCopy = getOriginalDefendingTerritory();
    let strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritoryCopy);
    let startingDefenseBonus = defendingTerritoryCopy.defenseBonus;
    let startingFoodCapacity = defendingTerritoryCopy.foodCapacity;
    let startingProdPop = defendingTerritoryCopy.productiveTerritoryPop;
    let startingTerritoryPop = defendingTerritoryCopy.territoryPopulation;
    let defenseBonusColor = "rgb(0,255,0)";
    let foodCapacityColor = "rgb(0,255,0)";
    let productiveTerritoryPopColor = "rgb(0,255,0)";

    if (retreatBeforeStart) {
        console.log(nextWarId + " " + currentWarId);
        warId = currentWarId;
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
    historicWars.push({
        warId: warId,
        proportionsAttackers: proportionsAttackers,
        defendingTerritory: defendingTerritoryCopy,
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
    });

    console.log(historicWars);
}

function getStrokeColorOfDefendingTerritory(defendingTerritory) {
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("uniqueid") === defendingTerritory.uniqueId) {
            return paths[i].style.stroke;
        }
    }
}

export function incrementSiegeTurns() {
    for (const territory in siegeObject) {
        if (siegeObject.hasOwnProperty(territory)) {
            siegeObject[territory].turnsInSiege += 1;
        }
    }
}

export function setBattleResolutionOnHistoricWarArrayAfterSiege(warResolution, id) {
    for (const siege of historicWars) {
        const {
            warId
        } = siege;
        if (warId === id) {
            siege.resolution = warResolution;
        }
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

export function calculateSiegePerTurn() {
    let continueSiegeArray = [];
    if (siegeObject && Object.keys(siegeObject).length > 0) {

        //calculate chance of a siege "hit"
        for (const key in siegeObject) {
            let hitThisTurn;
            let hitCount = 0;
            let totalSiegeScore;
            let numberOfForts;
            let defenseBonusAttackedTerritory;
            let mountainDefenseBonusAttackedTerritory = siegeObject[key].defendingTerritory.mountainDefenseBonus;

            for (let i = 0; i < hitIterations; i++) {
                totalSiegeScore = calculateSiegeScore(siegeObject[key]);
                defenseBonusAttackedTerritory = siegeObject[key].defendingTerritory.defenseBonus;
                numberOfForts = siegeObject[key].defendingTerritory.fortsBuilt;
                const hitChance = calculateChanceOfASiegeHit(totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory);

                let hit = Math.random() < hitChance;
                hit ? hitCount++ : null;
            }
            hitCount > hitIterations / 2 ? (hitThisTurn = true, console.log("Hit this turn for the " + key + " war, " + hitCount + " hits from " + hitIterations)) : (hitThisTurn = false, console.log("No hit this turn for the " + key + " war, " + hitCount + " hits from " + hitIterations));
            console.log(key + " war: " + hitThisTurn);
            hitCount = 0;

            let damage = [];

            hitThisTurn ? damage = calculateDamageDone(siegeObject[key], totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory) : damage = false;

            if (!damage) { //if no hit
                return;
            } else if (damage[2]) { //if arrested
                siegeObject[key].defendingArmyRemaining.push(1); //add routing defeat to array
                continueSiegeArray.push(siegeObject[key]);
            } else {
                //do the damage
                changeDefendingTerritoryStatsBasedOnSiege(siegeObject[key], damage);
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

function calculateDamageDone(siegeObject, totalSiegeScore, defenseBonusAttackedTerritory, mountainDefenseBonusAttackedTerritory) {
    const difference = totalSiegeScore - (defenseBonusAttackedTerritory + mountainDefenseBonusAttackedTerritory);
    let arrested;

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

    let fortsDestroyed = 0;
    let collateralDamage;

    // Find the appropriate destroy probability based on the difference
    const destroyProbability = slidingScale.reduce((acc, scale) => (difference >= scale.scoreDifference ? scale.destroyProbability : acc), 0);

    // Generate a random number and compare it with the destroy probability
    console.log("difference: " + difference);
    if (Math.random() < destroyProbability) {
        // Determine the number of forts to destroy based on the sliding scale
        if (difference >= 200) {
            console.log("2 forts destroyed!");
            fortsDestroyed = 2;
        } else if (difference >= 50) {
            console.log("a fort destroyed!");
            fortsDestroyed = 1;
        }
        collateralDamage = calculateCollateralDamage(difference);
    } else {
        console.log("collateral damage only!");
        collateralDamage = calculateCollateralDamage(difference);
    }
    const foodCapacityDestroyed = Math.floor(siegeObject.defendingTerritory.foodCapacity * collateralDamage / 100);
    collateralDamage === 0 ? arrested = true : arrested = false;
    const damage = [fortsDestroyed, foodCapacityDestroyed, arrested];
    console.log("Damage Done: " + fortsDestroyed + " forts destroyed and " + foodCapacityDestroyed + " reduced from food capacity, representing a " + collateralDamage + "% fall");

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
            console.log("arrested for being too pathetic to siege!");
            return 0; //end siege due to arrest
        } else {
            return 1;
        }
    }
}

export function handleEndSiegeDueArrest(siege) {
    let defendingTerritory;
    let defendingPath;

    if (siege.defendingArmyRemaining[4]) { //if siege marked as arrested
        //set siege data to player and defender territory
        for (let i = 0; i < paths.length; i++) {
            for (let j = 0; j < mainGameArray.length; j++) {
                if (siege.defendingTerritory.uniqueId === mainGameArray[j].uniqueId) {
                    defendingTerritory = mainGameArray[j];
                }
                if (defendingTerritory) {
                    if (defendingTerritory.uniqueId === paths[i].getAttribute("uniqueid")) {
                        defendingPath = paths[i];
                        break;
                    }
                }
            }
        }

        defendingTerritory.infantryForCurrentTerritory = siege.defendingArmyRemaining[0] + (Math.floor(siege.attackingArmyRemaining[0] * 0.5));
        defendingTerritory.assaultForCurrentTerritory = siege.defendingArmyRemaining[1 + (Math.floor(siege.attackingArmyRemaining[1] * 0.5))];
        defendingTerritory.airForCurrentTerritory = siege.defendingArmyRemaining[2] + (Math.floor(siege.attackingArmyRemaining[2] * 0.5));
        defendingTerritory.navalForCurrentTerritory = siege.defendingArmyRemaining[3] + (Math.floor(siege.attackingArmyRemaining[3] * 0.5));
        defendingTerritory.armyForCurrentTerritory = defendingTerritory.infantryForCurrentTerritory + (defendingTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (defendingTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (defendingTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
        document.getElementById("bottom-table").rows[0].cells[17].innerHTML = formatNumbersToKMB(defendingTerritory.armyForCurrentTerritory);

        siege.attackingArmyRemaining = [0, 0, 0, 0];
        siege.resolution = "Arrested";

        setUpResultsOfWarExternal(true);
        setCurrentWarFlagString(defendingTerritory.dataName);

        populateWarResultPopup(1, playerCountry, defendingTerritory, "arrest", siege);
        addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);

        historicWars.push(siege);
        removeSiegeImageFromPath(defendingPath);
        defendingPath.setAttribute("underSiege", "false");

        for (const key in siegeObject) {
            if (key === siege.defendingTerritory.territoryName) {
                delete siegeObject[key];
                break;
            }
        }
    }
}

function changeDefendingTerritoryStatsBasedOnSiege(siege, damage) {
    if (siege.defendingTerritory.fortsBuilt >= damage[0]) { //remove forts
        siege.defendingTerritory.fortsBuilt -= damage[0];
    } else {
        siege.defendingTerritory.fortsBuilt = 0;
    }
    //recalculate defense bonus
    siege.defendingTerritory.defenseBonus = Math.ceil((siege.defendingTerritory.fortsBuilt * (siege.defendingTerritory.fortsBuilt + 1) * 10) * siege.defendingTerritory.devIndex + siege.defendingTerritory.isLandLockedBonus);

    if (siege.defendingTerritory.foodCapacity > 0) { //lower food capacity
        siege.defendingTerritory.foodCapacity -= damage[1];
    }
}

export function setValuesForBattleFromSiegeObject(lastClickedPath, routCheck) { //when clicking view siege
    let siegeObject;
    if (!routCheck) {
        siegeObject = getSiegeObjectFromPath(lastClickedPath);
    } else {
        siegeObject = lastClickedPath; //confusing but if checking for rout from siege, we pass the object directly
    }

    for (let i = 0; i < mainGameArray.length; i++) {
        const mainElement = mainGameArray[i];
        if (mainElement.uniqueId === siegeObject.defendingTerritory.uniqueId) {
            siegeObject.defendingArmyRemaining = [mainElement.infantryForCurrentTerritory, mainElement.useableAssault, mainElement.useableAir, mainElement.useableNaval];
            break;
        }
    }
}

export function setMainArrayToArmyRemaining(territory) { //when clicking siege button
    let mainElement;
    for (let i = 0; i < mainGameArray.length; i++) {
        mainElement = mainGameArray[i];
        if (mainElement.uniqueId === territory.defendingTerritory.uniqueId) {
            mainElement.infantryForCurrentTerritory = territory.defendingArmyRemaining[0];
            mainElement.assaultForCurrentTerritory = territory.defendingArmyRemaining[1];
            mainElement.airForCurrentTerritory = territory.defendingArmyRemaining[2];
            mainElement.navalForCurrentTerritory = territory.defendingArmyRemaining[3];
            mainElement.armyForCurrentTerritory = mainElement.infantryForCurrentTerritory + (mainElement.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (mainElement.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (mainElement.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);

            let siegeObject = getSiegeObjectFromPath(lastClickedPath);
            siegeObject.defendingTerritory.infantryForCurrentTerritory = mainElement.infantryForCurrentTerritory;
            siegeObject.defendingTerritory.assaultForCurrentTerritory = mainElement.assaultForCurrentTerritory;
            siegeObject.defendingTerritory.airForCurrentTerritory = mainElement.airForCurrentTerritory;
            siegeObject.defendingTerritory.navalForCurrentTerritory = mainElement.navalForCurrentTerritory;
            siegeObject.defendingTerritory.armyForCurrentTerritory = siegeObject.defendingTerritory.infantryForCurrentTerritory + (siegeObject.defendingTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (siegeObject.defendingTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (siegeObject.defendingTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
            break;
        }
    }
    return mainElement;
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

    console.log(returnArray);

    return returnArray;
}

export function getRetrievalArray() {
    return retrievalArray;
}

export function setNewWarOnRetrievalArray(warId, array, turn, type) {
    if (retrievalArray.length === 0) {
        retrievalArray = [
            [warId, array, turn, type]
        ]; // Initialize the array with the first element
    } else {
        retrievalArray.push([warId, array, turn, type]); // Add subsequent elements
    }
    return retrievalArray;
}