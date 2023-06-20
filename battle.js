import {
    vehicleArmyWorth
} from './resourceCalculations.js';

const maxAreaThreshold = 350000;
const maxBattleModifier = 0.65;
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
  const defenseBonus = defendingTerritory.defenseBonus;

  // Display defender's attributes
  console.log("Development Index: " + developmentIndex);
  console.log("Area Bonus: " + areaWeightDefender);
  console.log("Continent Modifier: " + continentModifier);
  console.log("Defense Bonus: " + defenseBonus);

  // Calculate total attacking army
  const totalAttackingArmy = [0, 0, 0, 0]; // [infantry, assault, air, naval]
  const tempTotalAttackingArmy = [0, 0, 0, 0]; // copy for console output
  const totalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];

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

  // Determine the number of battles for each unit type
  const unitCounts = [totalAttackingArmy[0], totalAttackingArmy[1], totalAttackingArmy[2], totalAttackingArmy[3]];
  const totalUnitCount = unitCounts.reduce((sum, count) => sum + count, 0);
  const totalBattles = totalUnitCount;

  const battleIntervals = unitCounts.map(count => {
    const interval = Math.ceil(totalBattles / count);
    return isFinite(interval) ? interval : 0;
  });

  const unitTypes = ["infantry", "assault", "air", "naval"];

  // Battle logic
  let remainingUnits = [...totalAttackingArmy];
  let currentBattle = 0;
  let updatedProbability = probability;

  const rounds = 5;
  let currentRound = 1;
  let victory = false; // Flag to indicate victory

  const skirmishOrder = ["infantry", "assault", "air", "naval"]; // Order of skirmishes within a round
  const skirmishesPerRound = Math.ceil(totalBattles / rounds); // Number of skirmishes in each round

  const processRound = () => {
    let skirmishesCompleted = 0; // Counter for completed skirmishes within the current round

    // Loop until all skirmishes are completed or the battle is over
    while (skirmishesCompleted < skirmishesPerRound && currentBattle < totalBattles) {
      for (let unitTypeIndex = 0; unitTypeIndex < unitTypes.length; unitTypeIndex++) {
        const unitType = unitTypes[unitTypeIndex];
        const unitCount = unitCounts[unitTypeIndex];
        const interval = battleIntervals[unitTypeIndex];

        if (
          currentBattle % interval === 0 &&
          remainingUnits[unitTypeIndex] > 0 &&
          totalDefendingArmy[unitTypeIndex] > 0 &&
          skirmishesCompleted < skirmishesPerRound
        ) {
          const skirmishOrderIndex = skirmishesCompleted % skirmishOrder.length;
          const currentSkirmish = skirmishOrder[skirmishOrderIndex];

          let attackingRemaining = remainingUnits[unitTypeIndex];
          let defendingRemaining = totalDefendingArmy[unitTypeIndex];
          let skirmishes = 0; // Counter for skirmishes

          // Simulate skirmishes until one side wins or there are no more units
          while (
            attackingRemaining > 0 &&
            defendingRemaining > 0 &&
            skirmishesCompleted < skirmishesPerRound
          ) {
            const odds = Math.min(updatedProbability / 100, 0.65);
            const win = Math.random() <= odds;

            if (win) {
              defendingRemaining--;
              totalDefendingArmy[unitTypeIndex]--;
              console.log(`Attacker Won the ${currentSkirmish} skirmish, ${attackingRemaining} ${unitType} remaining from ${tempTotalAttackingArmy[unitTypeIndex]}`);
            } else {
              attackingRemaining--;
              totalAttackingArmy[unitTypeIndex]--;
              console.log(`Attacker Lost the ${currentSkirmish} skirmish, ${attackingRemaining} ${unitType} remaining from ${tempTotalAttackingArmy[unitTypeIndex]}`);
            }

            skirmishes++;
            skirmishesCompleted++;
          }

          remainingUnits[unitTypeIndex] = attackingRemaining;
          totalDefendingArmy[unitTypeIndex] = defendingRemaining;
        }
      }

      currentBattle++;

      let roundCompleted = false;

      // Check if the round is completed or the battle is over
      if (currentBattle >= totalBattles || skirmishesCompleted >= skirmishesPerRound) {
        console.log("-----------------ROUND COMPLETED--------------------------");
        console.log("Attacking Infantry Left:", totalAttackingArmy[0], "out of", unitCounts[0]);
        console.log("Attacking Assault Left:", totalAttackingArmy[1], "out of", unitCounts[1]);
        console.log("Attacking Air Left:", totalAttackingArmy[2], "out of", unitCounts[2]);
        console.log("Attacking Naval Left:", totalAttackingArmy[3], "out of", unitCounts[3]);
        console.log("Defending Infantry Left:", totalDefendingArmy[0], "out of", defendingTerritory.infantryForCurrentTerritory);
        console.log("Defending Assault Left:", totalDefendingArmy[1], "out of", defendingTerritory.useableAssault);
        console.log("Defending Air Left:", totalDefendingArmy[2], "out of", defendingTerritory.useableAir);
        console.log("Defending Naval Left:", totalDefendingArmy[3], "out of", defendingTerritory.useableNaval);

        updatedProbability = calculateProbabiltyPreBattle(totalAttackingArmy, mainArrayOfTerritoriesAndResources, true, totalDefendingArmy, arrayOfUniqueIdsAndAttackingUnits[0]);

        console.log("New probability for next round is: " + updatedProbability);

        currentRound++;
        skirmishesCompleted = 0; // Reset skirmishes completed counter
        roundCompleted = true;
      }

      // Check conditions for ending the battle
      if (remainingUnits.some((count, index) => (count / unitCounts[index]) <= 0.2)) {
        roundCompleted = true;
      }

      if (totalDefendingArmy.every(count => count === 0)) {
        roundCompleted = true;
        victory = true; // Set victory flag
      }

      // Move to the next round or finish the battle
      if (roundCompleted) {
        break;
      }
    }

    if (!victory && currentRound <= rounds) {
      setTimeout(processRound, 5000); // Wait for 5 seconds before processing the next round
    } else {
      console.log("All rounds completed!");
      console.log("Attacking Units Remaining: " + remainingUnits);
      console.log("Defending Infantry Remaining: " + totalDefendingArmy[0]);
      console.log("Defending Assault Remaining: " + totalDefendingArmy[1]);
      console.log("Defending Air Remaining: " + totalDefendingArmy[2]);
      console.log("Defending Naval Remaining: " + totalDefendingArmy[3]);

      reuseableAttackingAverageDevelopmentIndex = "";
      reuseableCombatContinentModifier = "";
      proportionsOfAttackArray.length = 0;

      if (victory) {
        console.log("Victory achieved!");
        // Perform victory-related actions
      } else {
        console.log("Defeat!");
        // Perform defeat-related actions
      }
    }
  };

  processRound();
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

  /*   function calculateBatchSize(attackingCount) {
    if (attackingCount <= 100) {
      return 1; // 1 vs 1 skirmish
    } else if (attackingCount <= 1000) {
      return 10; // 10 vs 10 skirmish
    } else if (attackingCount <= 10000) {
      return 100; // 100 vs 100 skirmish
    } else if (attackingCount <= 100000) {
      return 1000; // 1000 vs 1000 skirmish
    } else if (attackingCount <= 1000000) {
      return 10000; // 10000 vs 10000 skirmish
    } else {
      return 100000; // 100000 vs 100000 skirmish
    }
  } */