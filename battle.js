import { vehicleArmyWorth } from './resourceCalculations.js';

const maxAreaThreshold = 350000;
export let finalAttackArray = [];

export function calculateBattleProbabiltyPreBattle(preAttackArray, mainArrayOfTerritoriesAndResources) {
    let combatContinentModifier;

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

      // Find the attacking territory in mainArrayOfTerritoriesAndResources
        const territoryToMatchContinent = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId);

        // Set continent modifier for attacking units that enter attacked territory to suggest good/bad infrastructure or many islands
        if (territoryToMatchContinent) {
            const { continent } = territoryToMatchContinent;
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
    
    const { defenseBonus, infantryForCurrentTerritory, useableAssault, useableAir, useableNaval } = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId);
  
    // Calculate total attacking strength
    const totalAttackingStrength =
    infantryCounts.reduce((sum, count) => sum + count * 1, 0) +
    assaultCounts.reduce((sum, count) => sum + count * vehicleArmyWorth.assault, 0) +
    airCounts.reduce((sum, count) => sum + count * vehicleArmyWorth.air, 0) +
    navalCounts.reduce((sum, count) => sum + count * vehicleArmyWorth.naval, 0);

    // Calculate total defending strength
    const totalDefendingStrength = (infantryForCurrentTerritory + (useableAssault * vehicleArmyWorth.assault) + (useableAir * vehicleArmyWorth.air) + (useableNaval * vehicleArmyWorth.naval)) * (1 + defenseBonus);
    
    const defendingTerritory = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId);
    const defendingDevelopmentIndex = parseFloat(defendingTerritory.devIndex);
     
    const attackingDevelopmentIndex = attackingTerritories.reduce((sum, territoryUniqueId) => {
        const territory = mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === territoryUniqueId.toString());
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
    const modifiedDefendingStrengthWithArea = modifiedDefendingStrength * areaWeightDefender;

    // Calculate probability with area weight adjustment
    const probability = (modifiedAttackingStrength / (modifiedAttackingStrength + modifiedDefendingStrengthWithArea)) * 100;

    return probability;
}

export function doBattle(probability, arrayOfUniqueIdsAndAttackingUnits) {
    console.log("Battle Underway!");
    console.log("Probabilty of a win is:" + probability);
    console.log("Attack Array:" + arrayOfUniqueIdsAndAttackingUnits);
}
  