import {
    vehicleArmyWorth,
    playerOwnedTerritories
} from './resourceCalculations.js';
import {
  paths
} from './ui.js';


const maxAreaThreshold = 350000;
export let finalAttackArray = [];
let proportionsOfAttackArray = [];
let reuseableAttackingAverageDevelopmentIndex;
let reuseableCombatContinentModifier;

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

    const totalDefendingStrength =
      infantryForCurrentTerritory * 1 +
      useableAssault * vehicleArmyWorth.assault +
      useableAir * vehicleArmyWorth.air +
      useableNaval * vehicleArmyWorth.naval;

    let modifiedDefendingStrength = totalDefendingStrength * (1 + defenseBonus);

    const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId);
    const defendingDevelopmentIndex = parseFloat(defendingTerritory.devIndex);

    let modifiedAttackingStrength = totalAttackingStrength * reuseableAttackingAverageDevelopmentIndex; //more advanced attackers will have it easier to attack
    modifiedAttackingStrength = modifiedAttackingStrength * reuseableCombatContinentModifier;

    modifiedDefendingStrength = totalDefendingStrength * defendingDevelopmentIndex; //more advanced defenders will have it easier to defend

    const modifiedDefendingStrengthWithArea = modifiedDefendingStrength * calculateAreaBonus(defendingTerritory, maxAreaThreshold);

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
        const totalDefendingStrength = (infantryForCurrentTerritory + (useableAssault * vehicleArmyWorth.assault) + (useableAir * vehicleArmyWorth.air) + (useableNaval * vehicleArmyWorth.naval)) * (1 + defenseBonus);

        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({
            uniqueId
        }) => uniqueId === attackedTerritoryId);
        const defendingDevelopmentIndex = parseFloat(defendingTerritory.devIndex);

        const attackingDevelopmentIndex = attackingTerritories.reduce((sum, territoryUniqueId) => {
            const territory = mainArrayOfTerritoriesAndResources.find(({
                uniqueId
            }) => uniqueId === territoryUniqueId.toString());
            return sum + parseFloat(territory.devIndex);
        }, 0) / attackingTerritories.length;

        reuseableAttackingAverageDevelopmentIndex = attackingDevelopmentIndex;

        let modifiedAttackingStrength = totalAttackingStrength * attackingDevelopmentIndex; //more advanced attackers will have it easier to attack
        const modifiedDefendingStrength = totalDefendingStrength * defendingDevelopmentIndex; //more advanced defenders will have it easier to defend

        modifiedAttackingStrength = modifiedAttackingStrength * combatContinentModifier; //attacking on certain continents can be harder due to many islands or infrastructure issues

        // Consider territory area weight
        const defendingTerritoryArea = defendingTerritory.area;

        // Calculate the normalized area weight for the defending territory with bonus
        let areaWeightDefender = Math.min(1, maxAreaThreshold / defendingTerritoryArea);

        // Adjust the area weight to gradually increase for smaller territories
        areaWeightDefender = 1 + (areaWeightDefender - 1) * 0.5;

        // Adjust the defending strength based on the area weight
        const modifiedDefendingStrengthWithArea = modifiedDefendingStrength * calculateAreaBonus(defendingTerritory, maxAreaThreshold);

        // Calculate probability with area weight adjustment
        const probability = (modifiedAttackingStrength / (modifiedAttackingStrength + modifiedDefendingStrengthWithArea)) * 100;

        return probability;
    }
}

export function doBattle(probability, arrayOfUniqueIdsAndAttackingUnits, mainArrayOfTerritoriesAndResources) {
  console.log("Battle Underway!");
  console.log("Probability of a win is: " + probability);
  console.log("Attack Array: " + arrayOfUniqueIdsAndAttackingUnits);

  // Extract defending territory data
  const defendingTerritoryId = arrayOfUniqueIdsAndAttackingUnits[0];
  const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === defendingTerritoryId);

  // Extract defender's territory attributes
  const developmentIndex = defendingTerritory.devIndex;
  const areaWeightDefender = calculateAreaBonus(defendingTerritory, maxAreaThreshold);
  const continentModifier = calculateContinentModifier(defendingTerritoryId, mainArrayOfTerritoriesAndResources);
  let defenseBonus = defendingTerritory.defenseBonus;

  // Display defender's attributes
  console.log("Development Index: " + developmentIndex);
  console.log("Area Bonus: " + areaWeightDefender);
  console.log("Continent Modifier: " + continentModifier);
  console.log("Defense Bonus: " + defenseBonus);

  // Calculate total attacking army
  const totalAttackingArmy = [0, 0, 0, 0]; // [infantry, assault, air, naval]
  const tempTotalAttackingArmy = [0, 0, 0, 0]; // copy for console output
  const totalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];
  const tempTotalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];

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

  // Calculate combined forces of attacking and defending armies
const calculateCombinedForce = (army) => {
  const [infantry, assault, air, naval] = army;
  return infantry + (assault * vehicleArmyWorth.assault) + (air * vehicleArmyWorth.air) + (naval * vehicleArmyWorth.naval);
};

const unchangeableWarStartCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
const unchangeableWarStartCombinedForceDefend= calculateCombinedForce(totalAttackingArmy);

let initialCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
let initialCombinedForceDefend = calculateCombinedForce(totalDefendingArmy);

let combinedForceAttack;
let combinedForceDefend;

// Calculate the total number of skirmishes
let skirmishesPerType = [
  Math.min(totalAttackingArmy[0], totalDefendingArmy[0]),
  Math.min(totalAttackingArmy[1], totalDefendingArmy[1]),
  Math.min(totalAttackingArmy[2], totalDefendingArmy[2]),
  Math.min(totalAttackingArmy[3], totalDefendingArmy[3])
];
let totalSkirmishes = skirmishesPerType.reduce((sum, skirmishes) => sum + skirmishes, 0);

// Divide skirmishes into 5 rounds
const rounds = 5;
let skirmishesPerRound = Math.ceil(totalSkirmishes / rounds);

const unitTypes = ["infantry", "assault", "air", "naval"];

let attackingArmyRemaining = [...totalAttackingArmy];
let defendingArmyRemaining = [...totalDefendingArmy];
let updatedProbability = calculateProbabiltyPreBattle(totalAttackingArmy, mainArrayOfTerritoriesAndResources, true, totalDefendingArmy, arrayOfUniqueIdsAndAttackingUnits[0]);

const processRound = (currentRound) => {
  combinedForceAttack = calculateCombinedForce(attackingArmyRemaining);
  combinedForceDefend = calculateCombinedForce(defendingArmyRemaining);
  let skirmishesCompleted = 0;

  let exitWhile = false;

  const allZeroDefend = defendingArmyRemaining.every(count => count === 0);
  const allZeroAttack = attackingArmyRemaining.every(count => count === 0);

  while (skirmishesCompleted < skirmishesPerRound) {
    const skirmishOrder = unitTypes.slice().sort(() => Math.random() - 0.5);

    for (const unitType of skirmishOrder) {
      const unitTypeIndex = unitTypes.indexOf(unitType);

      if (
        attackingArmyRemaining[unitTypeIndex] > 0 &&
        defendingArmyRemaining[unitTypeIndex] > 0 &&
        skirmishesCompleted < skirmishesPerRound
      ) {
        let attackerCount = attackingArmyRemaining[unitTypeIndex];
        let defenderCount = defendingArmyRemaining[unitTypeIndex];
        let skirmishes = 0;

        while (
          attackerCount > 0 &&
          defenderCount > 0 &&
          skirmishesCompleted < skirmishesPerRound &&
          (
            (currentRound === 1 && combinedForceAttack > initialCombinedForceAttack * 0.8) ||
            (currentRound === 2 && combinedForceAttack > initialCombinedForceAttack * 0.6) ||
            (currentRound === 3 && combinedForceAttack > initialCombinedForceAttack * 0.4) ||
            (currentRound === 4 && combinedForceAttack > initialCombinedForceAttack * 0.2) ||
            (currentRound === 5 && combinedForceAttack > initialCombinedForceAttack * 0)
          )
        ) {
          const odds = Math.min(updatedProbability / 100, 0.65);
          const attackerWins = Math.random() <= odds;

          if (attackerWins) {
            defenderCount--;
            defendingArmyRemaining[unitTypeIndex]--;
          } else {
            attackerCount--;
            attackingArmyRemaining[unitTypeIndex]--;
          }

          skirmishes++;
          skirmishesCompleted++;
        }

        console.log(`Attacking ${unitType} Left: ${attackingArmyRemaining[unitTypeIndex]} out of ${totalAttackingArmy[unitTypeIndex]}`);
        console.log(`Defending ${unitType} Left: ${defendingArmyRemaining[unitTypeIndex]} out of ${totalDefendingArmy[unitTypeIndex]}`);
      } else if (allZeroDefend) {
        handleWarEnd(0, defendingTerritory, attackingArmyRemaining, defendingArmyRemaining);
      } else if (allZeroDefend) {
        handleWarEnd(1, defendingTerritory, attackingArmyRemaining, defendingArmyRemaining);
      } else {
        exitWhile = true;
        skirmishesCompleted = skirmishesPerRound; //escape loop
        break;
      }
    }
  }

  console.log(`-----------------ROUND ${currentRound} COMPLETED--------------------------`);
  console.log("Attacking Infantry Left:", attackingArmyRemaining[0], "out of", totalAttackingArmy[0]);
  console.log("Attacking Assault Left:", attackingArmyRemaining[1], "out of", totalAttackingArmy[1]);
  console.log("Attacking Air Left:", attackingArmyRemaining[2], "out of", totalAttackingArmy[2]);
  console.log("Attacking Naval Left:", attackingArmyRemaining[3], "out of", totalAttackingArmy[3]);
  console.log("Defending Infantry Left:", defendingArmyRemaining[0], "out of", totalDefendingArmy[0]);
  console.log("Defending Assault Left:", defendingArmyRemaining[1], "out of", totalDefendingArmy[1]);
  console.log("Defending Air Left:", defendingArmyRemaining[2], "out of", totalDefendingArmy[2]);
  console.log("Defending Naval Left:", defendingArmyRemaining[3], "out of", totalDefendingArmy[3]);
  console.log("Combined Attack Force: " + combinedForceAttack + " Defence Force: " + combinedForceDefend);

  updatedProbability = calculateProbabiltyPreBattle(attackingArmyRemaining, mainArrayOfTerritoriesAndResources, true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);
  console.log("New probability for next round is:", updatedProbability);

  if (currentRound < rounds && !defendingArmyRemaining.every(count => count === 0) && !exitWhile) {
    processRound(currentRound + 1);
  } else {
    console.log("All rounds completed!");
    console.log("Attacking Units Remaining:", attackingArmyRemaining);
    console.log("Defending Infantry Remaining:", defendingArmyRemaining[0]);
    console.log("Defending Assault Remaining:", defendingArmyRemaining[1]);
    console.log("Defending Air Remaining:", defendingArmyRemaining[2]);
    console.log("Defending Naval Remaining:", defendingArmyRemaining[3]);

    if (defendingArmyRemaining.every(count => count === 0)) { //killed all defenders
      handleWarEnd(0, defendingTerritory, attackingArmyRemaining, defendingArmyRemaining);
    } else if (attackingArmyRemaining.every(count => count === 0)) { //all attacking force destroyed
      handleWarEnd(1, defendingTerritory, attackingArmyRemaining, defendingArmyRemaining);
    } else {
      if (combinedForceDefend < (0.05 * unchangeableWarStartCombinedForceDefend)) { //rout enemy
        handleWarEnd(2, defendingTerritory, attackingArmyRemaining, defendingArmyRemaining);
      } else if (combinedForceDefend < (0.15 * unchangeableWarStartCombinedForceDefend)) { //last push
        handleWarEnd(3, defendingTerritory, attackingArmyRemaining, defendingArmyRemaining);
      } else if (combinedForceAttack < (0.10 * unchangeableWarStartCombinedForceAttack)) { // you were routed
        handleWarEnd(4, defendingTerritory, attackingArmyRemaining, defendingArmyRemaining);
      } else {                                                                             // fight again
        console.log("you will have to fight again with a bit of desertion for war weariness - redo 5 rounds with new values - 5% attacker amounts and defense bonus halved for defender");
        currentRound = 1;
        defenseBonus /= 2;
        attackingArmyRemaining = attackingArmyRemaining.map(value => Math.max(0, Math.floor(value * 0.95)));
        initialCombinedForceAttack = calculateCombinedForce(attackingArmyRemaining);
        initialCombinedForceDefend = calculateCombinedForce(defendingArmyRemaining);

        updatedProbability = calculateProbabiltyPreBattle(attackingArmyRemaining, mainArrayOfTerritoriesAndResources, true, defendingArmyRemaining, arrayOfUniqueIdsAndAttackingUnits[0]);
        
        skirmishesPerType = [
          Math.min(attackingArmyRemaining[0], defendingArmyRemaining[0]),
          Math.min(attackingArmyRemaining[1], defendingArmyRemaining[1]),
          Math.min(attackingArmyRemaining[2], defendingArmyRemaining[2]),
          Math.min(attackingArmyRemaining[3], defendingArmyRemaining[3])
        ];
        totalSkirmishes = skirmishesPerType.reduce((sum, skirmishes) => sum + skirmishes, 0);
        skirmishesPerRound = Math.ceil(totalSkirmishes / rounds);
        exitWhile = false;
        processRound(1);
      }
    }
  }
};

processRound(1);
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

    console.log("Combat Continent Modifier: " + combatContinentModifier);
    return combatContinentModifier;
}

function handleWarEnd(situation, contestedTerritory, attackingArmyRemaining, defendingArmyRemaining) {
  let contestedPath;
  for (let i = 0; i < paths.length; i++) {
    if (paths[i].getAttribute("uniqueid") === contestedTerritory.uniqueId) {
      contestedPath = paths[i];
    }
  }
  switch (situation) {
    case 0:
      console.log("Attacker won the war!");
      //Set territory to owner player, replace army values with remaining attackers in main array, change colors, deactivate territory until next turn
      playerOwnedTerritories.push(contestedPath);
      contestedPath.setAttribute("owner", "Player");
      contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0];
      contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1];
      contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2];
      contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3];
      contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
      break;
    case 1:
      console.log("Defender won the war!");
      //set main array to remaining defenders values
      contestedTerritory.infantryForCurrentTerritory = defendingArmyRemaining[0];
      contestedTerritory.assaultForCurrentTerritory = defendingArmyRemaining[1];
      contestedTerritory.airForCurrentTerritory = defendingArmyRemaining[2];
      contestedTerritory.navalForCurrentTerritory = defendingArmyRemaining[3];
      contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
      break;
    case 2:
      console.log("you routed the enemy, they are out of there, victory is yours! - capture half of defence remainder and territory");
      //Set territory to owner player, replace army values with remaining attackers + half of defenders remaining in main array, change colors, deactivate territory until next turn
      playerOwnedTerritories.push(contestedPath);
      contestedPath.setAttribute("owner", "Player");
      contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0] + (Math.floor(defendingArmyRemaining[0] / 2));
      contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1] + (Math.floor(defendingArmyRemaining[1] / 2));
      contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2] + (Math.floor(defendingArmyRemaining[2] / 2));
      contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3] + (Math.floor(defendingArmyRemaining[3] / 2));
      contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
      break;
    case 3:
      console.log("a quick push should finish off the enemy - lose 20% of remainder to conquer territory");
      //Set territory to owner player, replace army values with remaining attackers - 10% in main array, change colors, deactivate territory until next turn
      playerOwnedTerritories.push(contestedPath);
      contestedPath.setAttribute("owner", "Player");
      contestedTerritory.infantryForCurrentTerritory = Math.floor(attackingArmyRemaining[0] * 0.8);
      contestedTerritory.assaultForCurrentTerritory = Math.floor(attackingArmyRemaining[1] * 0.8);
      contestedTerritory.airForCurrentTerritory = Math.floor(attackingArmyRemaining[2] * 0.8);
      contestedTerritory.navalForCurrentTerritory = Math.floor(attackingArmyRemaining[3] * 0.8);
      contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
      break;
    case 4:
      console.log("you were routed, half of your remaining soldiers were captured and half were slaughtered as an example");
      //remove attacking numbers from initial territories in main array, add half of attack remaining to defender in main array
      contestedTerritory.infantryForCurrentTerritory = defendingArmyRemaining[0] + Math.floor(attackingArmyRemaining[0] * 0.5);
      contestedTerritory.assaultForCurrentTerritory = defendingArmyRemaining[1] + Math.floor(attackingArmyRemaining[1] * 0.5);
      contestedTerritory.airForCurrentTerritory = defendingArmyRemaining[2] + Math.floor(attackingArmyRemaining[2] * 0.5);
      contestedTerritory.navalForCurrentTerritory = defendingArmyRemaining[3] + Math.floor(attackingArmyRemaining[3] * 0.5);
      contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyWorth.naval);
      break;
    case 5:
      //situation where user legs it mid round of 5
      break;
    case 6:
      //situation where user legs it after round of 5
      break;
  }
}