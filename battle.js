import {
    vehicleArmyWorth,
    playerOwnedTerritories,
    setUseableNotUseableWeaponsDueToOilDemand,
    mainArrayOfTerritoriesAndResources,
    oilRequirements,
    turnGainsArray,
    setDemandArray,
    calculateAllTerritoryDemandsForCountry,
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable,
    formatNumbersToKMB
} from './resourceCalculations.js';
import {
  paths, playerCountry,
  setcurrentMapColorAndStrokeArrayFromExternal,
  setterritoryAboutToBeAttackedFromExternal,
  playerColour,
  currentMapColorAndStrokeArray,
  setFlag,
  fillPathBasedOnContinent,
  setArmyTextValues,
  setAdvanceButtonText,
  setRetreatButtonText,
  setAdvanceButtonState,
  setRetreatButtonState,
  getAdvanceButtonState,
  getRetreatButtonState,
  setFirstSetOfRounds,
  getFirstSetOfRounds,
  setDefendingTerritoryCopyStart,
  retreatButtonState,
  setAttackProbabilityOnUI,
  getOriginalDefendingTerritory,
  setCurrentWarFlagString,
  populateWarResultPopup,
  setUpResultsOfWarExternal,
  removeSiegeImageFromPath,
  saveMapColorState
} from './ui.js';

const maxAreaThreshold = 350000;
export let finalAttackArray = [];
export let proportionsOfAttackArray = [];
let reuseableAttackingAverageDevelopmentIndex;
let reuseableCombatContinentModifier;
export let turnsDeactivatedArray = [];

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

export function calculateProbabiltyPreBattle(attackArray, mainArrayOfTerritoriesAndResources, reCalculationWithinBattle, remainingDefendingArmy, defendingTerritoryId) {
  if (reCalculationWithinBattle) {
    const attackedTerritoryId = defendingTerritoryId;

    const {
      defenseBonus
    } = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId);

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
      assaultCounts * vehicleArmyWorth.assault +
      airCounts * vehicleArmyWorth.air +
      navalCounts * vehicleArmyWorth.naval;

    let totalDefendingStrength =
      infantryForCurrentTerritory * 1 +
      useableAssault * vehicleArmyWorth.assault +
      useableAir * vehicleArmyWorth.air +
      useableNaval * vehicleArmyWorth.naval;

    totalDefendingStrength = totalDefendingStrength * (Math.ceil(defenseBonus / 15));

    const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId);

    let modifiedAttackingStrength = totalAttackingStrength * reuseableAttackingAverageDevelopmentIndex; //more advanced attackers will have it easier to attack
    modifiedAttackingStrength = modifiedAttackingStrength * reuseableCombatContinentModifier;

    const modifiedDefendingStrengthWithArea = totalDefendingStrength * calculateAreaBonus(defendingTerritory, maxAreaThreshold);

    const probability = (modifiedAttackingStrength / (modifiedAttackingStrength + modifiedDefendingStrengthWithArea)) * 100;

    return probability;
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
        reuseableCombatContinentModifier = combatContinentModifier;

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
            assaultCounts.reduce((sum, count) => sum + count * vehicleArmyWorth.assault, 0) +
            airCounts.reduce((sum, count) => sum + count * vehicleArmyWorth.air, 0) +
            navalCounts.reduce((sum, count) => sum + count * vehicleArmyWorth.naval, 0);

        // Calculate total defending strength
        const totalDefendingStrength = (infantryForCurrentTerritory + (useableAssault * vehicleArmyWorth.assault) + (useableAir * vehicleArmyWorth.air) + (useableNaval * vehicleArmyWorth.naval)) * (Math.ceil(defenseBonus / 15));

        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({
            uniqueId
        }) => uniqueId === attackedTerritoryId);

        const attackingDevelopmentIndex = attackingTerritories.reduce((sum, territoryUniqueId) => {
            const territory = mainArrayOfTerritoriesAndResources.find(({
                uniqueId
            }) => uniqueId === territoryUniqueId.toString());
            return sum + parseFloat(territory.devIndex);
        }, 0) / attackingTerritories.length;

        reuseableAttackingAverageDevelopmentIndex = attackingDevelopmentIndex;

        let modifiedAttackingStrength = totalAttackingStrength * attackingDevelopmentIndex; //more advanced attackers will have it easier to attack

        modifiedAttackingStrength = modifiedAttackingStrength * combatContinentModifier; //attacking on certain continents can be harder due to many islands or infrastructure issues

        // Consider territory area weight
        const defendingTerritoryArea = defendingTerritory.area;

        // Calculate the normalized area weight for the defending territory with bonus
        let areaWeightDefender = Math.min(1, maxAreaThreshold / defendingTerritoryArea);

        // Adjust the area weight to gradually increase for smaller territories
        areaWeightDefender = 1 + (areaWeightDefender - 1) * 0.5;

        // Adjust the defending strength based on the area weight
        const modifiedDefendingStrengthWithArea = totalDefendingStrength * calculateAreaBonus(defendingTerritory, maxAreaThreshold);

        // Calculate probability with area weight adjustment
        const probability = (modifiedAttackingStrength / (modifiedAttackingStrength + modifiedDefendingStrengthWithArea)) * 100;

        return probability;
    }
}

export function setupBattle(probability, arrayOfUniqueIdsAndAttackingUnits, mainArrayOfTerritoriesAndResources) {
  console.log("warId = " + currentWarId);
  console.log("Battle Underway!");
  console.log("Probability of a win is: " + probability);

  console.log("Attack Array: " + arrayOfUniqueIdsAndAttackingUnits);

  // Extract defending territory data
  defendingTerritoryId = arrayOfUniqueIdsAndAttackingUnits[0];
  defendingTerritory = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === defendingTerritoryId);

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
    const infantryPercentage = totalInfantryCount !== 0 ? parseFloat((territoryData[1] / totalInfantryCount) * 100) : 0;
    const assaultPercentage = totalAssaultCount !== 0 ? parseFloat((territoryData[2] / totalAssaultCount) * 100) : 0;
    const airPercentage = totalAirCount !== 0 ? parseFloat((territoryData[3] / totalAirCount) * 100) : 0;
    const navalPercentage = totalNavalCount !== 0 ? parseFloat((territoryData[4] / totalNavalCount) * 100) : 0;

    proportionsOfAttackArray[i] = [territoryData[0], infantryPercentage, assaultPercentage, airPercentage, navalPercentage];
  }

  console.log(proportionsOfAttackArray);
  console.log("Total Attacking Army: " + totalAttackingArmy);

unchangeableWarStartCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
unchangeableWarStartCombinedForceDefend= calculateCombinedForce(totalAttackingArmy);

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
updatedProbability = calculateProbabiltyPreBattle(totalAttackingArmy, mainArrayOfTerritoriesAndResources, true, totalDefendingArmy, arrayOfUniqueIdsAndAttackingUnits[0]);
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

function handleWarEndingsAndOptions(situation, contestedTerritory, attackingArmyRemaining, defendingArmyRemaining) {
  let attackArrayText = [...attackingArmyRemaining, ...defendingArmyRemaining];
  setArmyTextValues(attackArrayText, 1);
  const retreatButton = document.getElementById("retreatButton");
  const advanceButton = document.getElementById("advanceButton");
  const siegeButton = document.getElementById("siegeButton");
  
  let contestedPath;
  let won = false;
  for (let i = 0; i < paths.length; i++) {
    if (paths[i].getAttribute("uniqueid") === contestedTerritory.uniqueId) {
      contestedPath = paths[i];
    }
  }
  switch (situation) {
    case 0:
      won = true;
      console.log("Attacker won the war!");
      setDefendingTerritoryCopyStart(contestedTerritory);
      turnGainsArray.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault);
      turnGainsArray.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air);
      turnGainsArray.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval);
      //Set territory to owner player, replace army values with remaining attackers in main array, change colors, deactivate territory until next turn
      playerOwnedTerritories.push(contestedPath);
      contestedPath.setAttribute("owner", "Player");
      contestedPath.setAttribute("data-name", playerCountry);
      contestedTerritory.dataName = playerCountry;
      contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0];
      contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1];
      contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2];
      contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3];
      contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
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
      console.log("you routed the enemy, they are out of there, victory is yours! - capture half of defence remainder and territory");
      //Set territory to owner player, replace army values with remaining attackers + half of defenders remaining in main array, change colors, deactivate territory until next turn
      setDefendingTerritoryCopyStart(contestedTerritory);
      turnGainsArray.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault) + (Math.floor(defendingArmyRemaining[1] / 2) * oilRequirements.assault);
      turnGainsArray.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air) + (Math.floor(defendingArmyRemaining[2] / 2) * oilRequirements.air);
      turnGainsArray.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval) + (Math.floor(defendingArmyRemaining[3] / 2) * oilRequirements.naval);
      playerOwnedTerritories.push(contestedPath);
      contestedPath.setAttribute("owner", "Player");
      contestedPath.setAttribute("data-name", playerCountry);
      contestedTerritory.dataName = playerCountry;
      contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0] + (Math.floor(defendingArmyRemaining[0] / 2));
      contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1] + (Math.floor(defendingArmyRemaining[1] / 2));
      contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2] + (Math.floor(defendingArmyRemaining[2] / 2));
      contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3] + (Math.floor(defendingArmyRemaining[3] / 2));
      contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
      turnGainsArray.changeInfantry += Math.floor(defendingArmyRemaining[0] / 2);
      turnGainsArray.changeAssault += Math.floor(defendingArmyRemaining[1] / 2);
      turnGainsArray.changeAir += Math.floor(defendingArmyRemaining[2] / 2);
      turnGainsArray.changeNaval += Math.floor(defendingArmyRemaining[3] / 2);
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
      turnGainsArray.changeOilDemand += (Math.floor(attackingArmyRemaining[1] * 0.8) * oilRequirements.assault);
      turnGainsArray.changeOilDemand += (Math.floor(attackingArmyRemaining[2] * 0.8) * oilRequirements.air);
      turnGainsArray.changeOilDemand += (Math.floor(attackingArmyRemaining[3] * 0.8) * oilRequirements.naval);
      playerOwnedTerritories.push(contestedPath);
      contestedPath.setAttribute("owner", "Player");
      contestedPath.setAttribute("data-name", playerCountry);
      contestedTerritory.dataName = playerCountry;
      contestedTerritory.infantryForCurrentTerritory = (Math.floor(attackingArmyRemaining[0] * 0.8));
      contestedTerritory.assaultForCurrentTerritory = (Math.floor(attackingArmyRemaining[1] * 0.8));
      contestedTerritory.airForCurrentTerritory = (Math.floor(attackingArmyRemaining[2] * 0.8));
      contestedTerritory.navalForCurrentTerritory = (Math.floor(attackingArmyRemaining[3] * 0.8));
      contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
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
  setUseableNotUseableWeaponsDueToOilDemand(mainArrayOfTerritoriesAndResources, contestedTerritory);

  if (won) {
    setFlag(playerCountry, 2);
    contestedPath.setAttribute("data-name", playerCountry);
    deactivateTerritory(contestedPath, contestedTerritory);
  } else {
    contestedPath.setAttribute("fill", fillPathBasedOnContinent(contestedPath));
  }
}

function deactivateTerritory(contestedPath) { //cant use a territory if just conquered it til this function decides
  const turnsToDeactivate = Math.floor(Math.random() * 3) + 1;
  turnsDeactivatedArray.push([contestedPath.getAttribute("uniqueid"), turnsToDeactivate, 0]);


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

  setterritoryAboutToBeAttackedFromExternal(null); //for filling color to work properly
  setcurrentMapColorAndStrokeArrayFromExternal(tempArray);

  //set deactivated in main array
  for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
    if (mainArrayOfTerritoriesAndResources[i].uniqueId === contestedPath.getAttribute("uniqueid")) {
      mainArrayOfTerritoriesAndResources[i].isDeactivated = true;
    }
  }
}

export function activateAllTerritoriesForNewTurn() { //reactivate all territories at start of turn
  for (let i = 0; i < turnsDeactivatedArray.length; i++) {
    if (turnsDeactivatedArray[i][1] !== turnsDeactivatedArray[i][2]) {
      turnsDeactivatedArray[i][2]++;
    } else {
      for (let j = 0; j < paths.length; j++) {
        if (paths[j].getAttribute("uniqueid") === turnsDeactivatedArray[i][0]) {
          paths[j].style.stroke = "black";
          paths[j].style.strokeDasharray = "none";
          paths[j].setAttribute("stroke-width", "1");
          paths[j].setAttribute("deactivated", "false");
          for (let k = 0; k < mainArrayOfTerritoriesAndResources.length; k++) {
            if (mainArrayOfTerritoriesAndResources[k].uniqueId === paths[j].getAttribute("uniqueid")) {
              mainArrayOfTerritoriesAndResources[k].isDeactivated = false;
            }
          }
        }
      }      
    }
  }
}

export function assignProportionsToTerritories(proportions, remainingAttackingArmy, mainArrayOfTerritoriesAndResources) {
  const [infantryRemaining, assaultRemaining, airRemaining, navalRemaining] = remainingAttackingArmy;

  for (const [territoryId, infantryProportion, assaultProportion, airProportion, navalProportion] of proportions) {
    const territory = mainArrayOfTerritoriesAndResources.find(territory => territory.uniqueId === territoryId.toString());

    if (territory) {
      territory.infantryForCurrentTerritory += Math.floor(infantryProportion / 100 * infantryRemaining);
      territory.assaultForCurrentTerritory += Math.floor(assaultProportion / 100 * assaultRemaining);
      territory.airForCurrentTerritory += Math.floor(airProportion / 100 * airRemaining);
      territory.navalForCurrentTerritory += Math.floor(navalProportion / 100 * navalRemaining);
      territory.armyForCurrentTerritory = territory.infantryForCurrentTerritory + (territory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (territory.airForCurrentTerritory * vehicleArmyWorth.air) + (territory.navalForCurrentTerritory * vehicleArmyWorth.naval);

      turnGainsArray.changeOilDemand += (assaultRemaining * oilRequirements.assault);
      turnGainsArray.changeOilDemand += (airRemaining * oilRequirements.air);
      turnGainsArray.changeOilDemand += (navalRemaining * oilRequirements.naval);

      territory.oilDemand = ((oilRequirements.assault * territory.assaultForCurrentTerritory) + (oilRequirements.air * territory.airForCurrentTerritory) + (oilRequirements.naval * territory.navalForCurrentTerritory));
      setUseableNotUseableWeaponsDueToOilDemand(mainArrayOfTerritoriesAndResources, territory);
      setDemandArray(calculateAllTerritoryDemandsForCountry());
    }
  }
}

export function processRound(currentRound, arrayOfUniqueIdsAndAttackingUnits, attackArmyRemaining, defendingArmyRemaining, skirmishesPerRound) {
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
        handleWarEndingsAndOptions(0, defendingTerritory, attackArmyRemaining, defendingArmyRemaining);
      } else if (allZeroAttack) {
        handleWarEndingsAndOptions(1, defendingTerritory, attackArmyRemaining, defendingArmyRemaining);
      } else {
        //update UI text
        let attackArrayText = [...attackArmyRemaining, ...defendingArmyRemaining];
        let battleUIRow4Col1 = document.getElementById("battleUIRow4Col1");
        battleUIRow4Col1.innerHTML = "Starting";
        setArmyTextValues(attackArrayText, 1);
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
  console.log("Combined Attack Force: " + combinedForceAttack + " Defence Force: " + combinedForceDefend);

  updatedProbability = calculateProbabiltyPreBattle(attackArmyRemaining, mainArrayOfTerritoriesAndResources, true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);
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
      handleWarEndingsAndOptions(0, defendingTerritory, attackArmyRemaining, defendingArmyRemaining);
    } else if (attackArmyRemaining.every(count => count === 0)) { //all attacking force destroyed
      handleWarEndingsAndOptions(1, defendingTerritory, attackArmyRemaining, defendingArmyRemaining);
    } else {
      if (combinedForceDefend < (0.05 * unchangeableWarStartCombinedForceDefend)) { //rout enemy
        handleWarEndingsAndOptions(2, defendingTerritory, attackArmyRemaining, defendingArmyRemaining);
      } else if (combinedForceDefend < (0.15 * unchangeableWarStartCombinedForceDefend)) { //last push
        handleWarEndingsAndOptions(3, defendingTerritory, attackArmyRemaining, defendingArmyRemaining);
      } else if (combinedForceAttack < (0.10 * unchangeableWarStartCombinedForceAttack)) { // you were routed
        handleWarEndingsAndOptions(4, defendingTerritory, attackArmyRemaining, defendingArmyRemaining);
      } else {   
        let attackArrayText = [...attackArmyRemaining, ...defendingArmyRemaining];  
        setArmyTextValues(attackArrayText, 1);                                                                        // fight again
        console.log("you will have to fight again with a bit of desertion for war weariness - redo 5 rounds with new values - 5% attacker amounts");
        attackArmyRemaining = attackArmyRemaining.map(value => Math.max(0, Math.floor(value * 0.95)));
        initialCombinedForceAttack = calculateCombinedForce(attackArmyRemaining);
        initialCombinedForceDefend = calculateCombinedForce(defendingArmyRemaining);

        updatedProbability = calculateProbabiltyPreBattle(attackArmyRemaining, mainArrayOfTerritoriesAndResources, true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);

        skirmishesPerType = [
          Math.min(attackArmyRemaining[0], defendingArmyRemaining[0]),
          Math.min(attackArmyRemaining[1], defendingArmyRemaining[1]),
          Math.min(attackArmyRemaining[2], defendingArmyRemaining[2]),
          Math.min(attackArmyRemaining[3], defendingArmyRemaining[3])
        ];
        totalSkirmishes = skirmishesPerType.reduce((sum, skirmishes) => sum + skirmishes, 0);
        skirmishesPerRound = Math.ceil(totalSkirmishes / rounds);

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
  return infantry + (assault * vehicleArmyWorth.assault) + (air * vehicleArmyWorth.air) + (naval * vehicleArmyWorth.naval);
};


  export function getCurrentRound() {
    return currentRound;
  }

  export function setCurrentRound(value) {
    return currentRound = value;
  }

  export function getUpdatedProbability() {
    return updatedProbability;
  }

  export function setUpdatedProbability(value) {
    return updatedProbability = value;
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

  export function getNextWarId() {
    return nextWarId;
  }

  export function setCurrentWarId(value) {
    return currentWarId = value;
  }

  export function setNextWarId(value) {
    return nextWarId = value;
  }

  export function addRemoveWarSiegeObject(addOrRemove, warId) {
    let defendingTerritoryCopy = getOriginalDefendingTerritory();
    let proportionsAttackers = proportionsOfAttackArray;
    const strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritory);

    if (addOrRemove === 0) { // add war to siege object
      siegeObject[defendingTerritory.territoryName] = {
        warId: warId,
        proportionsAttackers: proportionsAttackers,
        defendingTerritory: defendingTerritoryCopy,
        defendingArmyRemaining: defendingArmyRemaining,
        attackingArmyRemaining: attackingArmyRemaining,
        turnsInSiege: 0,
        strokeColor: strokeColor,
        startingAtt: totalAttackingArmy,
        startingDef: totalDefendingArmy,
      };

      return siegeObject[defendingTerritory.territoryName].defendingTerritory;

    } else if (addOrRemove === 1) {
      for (const key in siegeObject) {
        if (siegeObject.hasOwnProperty(key) && siegeObject[key].warId === warId) {
          historicWars.push(siegeObject[key]);
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

    if (retreatBeforeStart) {
      console.log(nextWarId + " " + currentWarId);
      warId = currentWarId;
      proportionsAttackers = [0,0,0,0];
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
    });

    console.log(historicWars);
  }

  export function getDefendingTerritory() {
    return defendingTerritory;
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
    const { warId } = siege;
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

      for (let i = 0; i < hitIterations; i++) {
        totalSiegeScore = Math.floor((siegeObject[key].attackingArmyRemaining[0] * armyTypeSiegeValues.infantry) + (siegeObject[key].attackingArmyRemaining[1] * armyTypeSiegeValues.assault) + (siegeObject[key].attackingArmyRemaining[2] * armyTypeSiegeValues.air) + (siegeObject[key].attackingArmyRemaining[3] * armyTypeSiegeValues.naval));
        defenseBonusAttackedTerritory = siegeObject[key].defendingTerritory.defenseBonus;
        numberOfForts = siegeObject[key].defendingTerritory.fortsBuilt;
        const hitChance = calculateChanceOfASiegeHit(totalSiegeScore, defenseBonusAttackedTerritory);
        
        let hit = Math.random() < hitChance;
        hit ? hitCount++ : null;
      }
      hitCount > hitIterations / 2 ? (hitThisTurn = true, console.log("Hit this turn for the " + key + " war, " + hitCount + " hits from " + hitIterations)) : (hitThisTurn = false, console.log("No hit this turn for the " + key + " war, " + hitCount + " hits from " + hitIterations));
      console.log(key + " war: " + hitThisTurn);
      hitCount = 0;
    
      let damage = [];
      //from this point the hit is decided
      /* for (let i = 0; i < 50; i++) { //debu loop */
        hitThisTurn ? damage = calculateDamageDone(siegeObject[key], totalSiegeScore, defenseBonusAttackedTerritory, numberOfForts) : damage = [false,false,false]; 
      /* } */
      if (damage[2]) {
        siegeObject[key].defendingArmyRemaining.push(1); //add routing defeat to array
        continueSiegeArray.push(siegeObject[key]);
      } else {
        continueSiegeArray.push(true);
      }
    }
  }
  return continueSiegeArray;
}

function calculateChanceOfASiegeHit(totalSiegeScore, defenseBonusAttackedTerritory) {
  const scoreDifference = totalSiegeScore - defenseBonusAttackedTerritory;
  const baseProbability = 0.5;

  let hitProbability = baseProbability + (scoreDifference / 1000);
  hitProbability = Math.max(0, Math.min(1, hitProbability));

  return hitProbability;
}

function calculateDamageDone(siegeObject, totalSiegeScore, defenseBonusAttackedTerritory) {
  console.log("forts built before debug: " + siegeObject.defendingTerritory.fortsBuilt); // DEBUG
  // DEBUG
  defenseBonusAttackedTerritory = Math.ceil(1 + (siegeObject.defendingTerritory.fortsBuilt * (siegeObject.defendingTerritory.fortsBuilt + 1) * 10) * siegeObject.defendingTerritory.devIndex + siegeObject.defendingTerritory.isLandLockedBonus + (siegeObject.defendingTerritory.mountainDefense) * 10); // DEBUG
  
  const difference = totalSiegeScore - defenseBonusAttackedTerritory;
  let arrested = false;
  siegeObject.defendingTerritory.fortsBuilt = 2; // DEBUG

  // Define the sliding scale probabilities
  const slidingScale = [
    { scoreDifference: 0, destroyProbability: 0 },
    { scoreDifference: 20, destroyProbability: 0.3 },
    { scoreDifference: 70, destroyProbability: 0.5 },
    { scoreDifference: 130, destroyProbability: 0.7 },
    { scoreDifference: 200, destroyProbability: 0.9 },
    { scoreDifference: 280, destroyProbability: 1 },
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
  let collateralDamage;
  if (difference >= 0 && difference < 20) {
    return collateralDamage = Math.floor(Math.random() * 3) + 1;
  } else if (difference >= 20 && difference < 50) {
    return collateralDamage = Math.floor(Math.random() * 5) + 1;
  } else if (difference >= 50 && difference < 100) {
    return collateralDamage = Math.floor(Math.random() * 7) + 1;
  } else if (difference >= 100) {
    return collateralDamage = Math.floor(Math.random() * 10) + 1;
  } else {
    let arrested = Math.random();
    if (arrested > 0.7) {
      console.log("arrested for being too pathetic to siege!");
      return collateralDamage = 0; //end siege due to arrest
    } else {
      return collateralDamage = 1;
    }
  }
}

export function handleEndSiegeDueArrest(siege) {
  let defendingTerritory;
  let defendingPath;

  if (siege.defendingArmyRemaining[4]) { //if siege marked as arrested
    //set siege data to player and defender territory
    for (let i = 0; i < paths.length; i++) {
      for (let j = 0; j < mainArrayOfTerritoriesAndResources.length; j++) {
        if (siege.defendingTerritory.uniqueId === mainArrayOfTerritoriesAndResources[j].uniqueId) {
          defendingTerritory = mainArrayOfTerritoriesAndResources[j];
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
    defendingTerritory.armyForCurrentTerritory = defendingTerritory.infantryForCurrentTerritory + (defendingTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (defendingTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (defendingTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
    document.getElementById("bottom-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(defendingTerritory.armyForCurrentTerritory);

    siege.attackingArmyRemaining = [0,0,0,0];
    siege.resolution = "Arrested";

    setUpResultsOfWarExternal(true);
    setCurrentWarFlagString(defendingTerritory.dataName);

    populateWarResultPopup(1, playerCountry, defendingTerritory, "arrest", siege);
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable(1);

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


