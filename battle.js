import {
    vehicleArmyWorth
} from './resourceCalculations.js';

const maxAreaThreshold = 350000;
const maxBattleModifier = 0.65;
export let finalAttackArray = [];

// Determine the batch size for processing infantry units
const batchSize = 1000; // Adjust the batch size based on performance testing

export function calculateProbabiltyPreBattle(preAttackArray, mainArrayOfTerritoriesAndResources, reCalculationWithinBattle) {
    if (reCalculationWithinBattle) {

    } else {
        // Initialize the modifiedAttackArray with the first element
        finalAttackArray = [preAttackArray[0]];

        let nonZeroCount = 0;
        // Iterate through the attackArray, checking for territories with non-zero units
        for (let i = 1; i < preAttackArray.length; i += 5) {
            const hasNonZeroUnits = preAttackArray.slice(i + 1, i + 5).some(unitCount => unitCount > 0);
            if (!hasNonZeroUnits) {
                nonZeroCount++;
            }
            // If the territory has non-zero units or is the last territory, include it in the modifiedAttackArray
            if (hasNonZeroUnits) {
                finalAttackArray.push(...preAttackArray.slice(i, i + 5));
            }
        }

        if (nonZeroCount === (preAttackArray.length - 1) / 5) {
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
  
    const defendingTerritoryId = arrayOfUniqueIdsAndAttackingUnits[0];
    const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === defendingTerritoryId);
  
    const developmentIndex = defendingTerritory.devIndex;
    const areaWeightDefender = calculateAreaBonus(defendingTerritory, maxAreaThreshold);
    const continentModifier = calculateContinentModifier(defendingTerritoryId, mainArrayOfTerritoriesAndResources);
    const defenseBonus = defendingTerritory.defenseBonus;
  
    console.log("Development Index: " + developmentIndex);
    console.log("Area Bonus: " + areaWeightDefender);
    console.log("Continent Modifier: " + continentModifier);
    console.log("Defense Bonus: " + defenseBonus);
  
    // Calculate total attacking army
    const totalAttackingArmy = [0, 0, 0, 0]; // [infantry, assault, air, naval]
    const totalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.assaultForCurrentTerritory, defendingTerritory.airForCurrentTerritory, defendingTerritory.navalForCurrentTerritory];
  
    for (let i = 1; i < arrayOfUniqueIdsAndAttackingUnits.length; i += 5) {
      const infantryCount = arrayOfUniqueIdsAndAttackingUnits[i + 1];
      const assaultCount = arrayOfUniqueIdsAndAttackingUnits[i + 2];
      const airCount = arrayOfUniqueIdsAndAttackingUnits[i + 3];
      const navalCount = arrayOfUniqueIdsAndAttackingUnits[i + 4];
  
      totalAttackingArmy[0] += infantryCount;
      totalAttackingArmy[1] += assaultCount;
      totalAttackingArmy[2] += airCount;
      totalAttackingArmy[3] += navalCount;
    }
  
    console.log("Total Attacking Army: " + totalAttackingArmy);
  
    // Determine the number of battles for each unit type
    const unitCounts = [totalAttackingArmy[0], totalAttackingArmy[1], totalAttackingArmy[2], totalAttackingArmy[3]];
    const totalUnitCount = unitCounts.reduce((sum, count) => sum + count, 0);
    const totalBattles = Math.max(...unitCounts);
    const battleIntervals = unitCounts.map(count => Math.ceil(totalBattles / count));
    const unitTypes = ["infantry", "assault", "air", "naval"];
  
    // Battle logic
    let remainingUnits = [...totalAttackingArmy];
    let batchSize = 100000;
    let currentBattle = 0;
  
    while (currentBattle < totalBattles) {
      for (let unitTypeIndex = 0; unitTypeIndex < unitTypes.length; unitTypeIndex++) {
        const unitType = unitTypes[unitTypeIndex];
        const unitCount = unitCounts[unitTypeIndex];
        const interval = battleIntervals[unitTypeIndex];
  
        if (currentBattle % interval === 0 && remainingUnits[unitTypeIndex] > 0 && totalDefendingArmy[unitTypeIndex] > 0) {
          let attackingRemaining = remainingUnits[unitTypeIndex];
          let defendingRemaining = totalDefendingArmy[unitTypeIndex];
  
          const totalBatchCount = Math.min(attackingRemaining, defendingRemaining, batchSize);
  
          for (let i = 0; i < totalBatchCount; i++) {
            const odds = Math.min(probability / 100, 0.65);
            const win = Math.random() <= odds;
  
            if (win) {
              defendingRemaining--;
              console.log(`Attacker Won the ${unitType} skirmish, ${attackingRemaining} ${unitType} remaining from ${totalAttackingArmy[unitTypeIndex]}`);
              console.log(`Defenders have ${defendingRemaining} ${unitType} left, from ${defendingTerritory[`${unitType}ForCurrentTerritory`]}`);
            } else {
              attackingRemaining--;
              console.log(`Attacker Lost the ${unitType} skirmish, ${attackingRemaining} ${unitType} remaining from ${totalAttackingArmy[unitTypeIndex]}`);
              console.log(`Defenders have ${defendingRemaining} ${unitType} left, from ${defendingTerritory[`${unitType}ForCurrentTerritory`]}`);
            }
  
            if (attackingRemaining === 0 || defendingRemaining === 0) {
              break; // Stop the battle if one side runs out of units
            }
          }
  
          remainingUnits[unitTypeIndex] = attackingRemaining;
          totalDefendingArmy[unitTypeIndex] = defendingRemaining;
        }
      }
  
      currentBattle++;
  
      if (batchSize > 100) {
        batchSize /= 10; // Reduce batch size to the next lower level
      }
    }
  
    console.log("Battle resolved!");
    console.log("Attacking Units Remaining: " + remainingUnits);
    console.log("Defending Infantry Remaining: " + defendingTerritory.infantryForCurrentTerritory);
    console.log("Defending Assault Remaining: " + defendingTerritory.assaultForCurrentTerritory);
    console.log("Defending Air Remaining: " + defendingTerritory.airForCurrentTerritory);
    console.log("Defending Naval Remaining: " + defendingTerritory.navalForCurrentTerritory);
  
    // Continue with further battle logic or actions based on the results...
  }
  
  
  function calculateBatchSize(attackingCount) {
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