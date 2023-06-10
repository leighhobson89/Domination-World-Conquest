import { pageLoaded } from './ui.js';
import { currentTurn, currentTurnPhase, randomEvent, randomEventHappening } from './gameTurnsLoop.js';
import { dataTableCountriesInitialState } from './ui.js';
import { setFlag } from './ui.js';
import { currentSelectedPath } from './ui.js';
import { paths } from './ui.js';
import { playSoundClip } from './sfx.js';
import { toggleUpgradeMenu, toggleBuyMenu} from './ui.js';
import { playerCountry } from './ui.js';
import { setUpgradeOrBuyWindowOnScreenToTrue } from './ui.js';

export let allowSelectionOfCountry = false;
export let playerOwnedTerritories = [];
export let mainArrayOfTerritoriesAndResources = [];
export let currentlySelectedTerritoryForUpgrades;
export let currentlySelectedTerritoryForPurchases;
export let totalGoldPrice = 0;
export let totalConsMats = 0;
export let totalPurchaseGoldPrice = 0;
export let totalPopulationCost = 0;
export let totalOilCapacity = 0;
export let capacityArray;
export let demandArray;

const oilRequirements = {
    naval: 1000,
    air: 300,
    assault: 100
  };

  const vehicleArmyWorth = {
    infantry: 1000,
    naval: 20000,
    air: 5000,
    assault: 1000
  }

let totalPlayerResources = [];
let continentModifier;
let tooltip = document.getElementById("tooltip");
let simulatedCostsAll = [0,0,0,0,0,0,0,0];
let simulatedCostsAllMilitary = [0,10,50,100,100,300,200,1000];

/* const turnLabel = document.getElementById('turn-label'); */
if (!pageLoaded) {
    Promise.all([calculatePathAreasWhenPageLoaded(), createArrayOfInitialData()])
        .then(([pathAreas, armyArray]) => {
            mainArrayOfTerritoriesAndResources = randomiseInitialGold(mainArrayOfTerritoriesAndResources);
        })
        .catch(error => {
            console.log(error);
        });
}

export function getPlayerTerritories() {
    playerOwnedTerritories.length = 0;

    for (const path of paths) {
        if (path.getAttribute("owner") === "Player") {
            playerOwnedTerritories.push(path);
        }
    }
}

export function populateBottomTableWhenSelectingACountry(countryPath) {
    // Update the table with the response data
    document.getElementById("bottom-table").rows[0].cells[0].style.whiteSpace = "pre";
    setFlag(countryPath.getAttribute("data-name"),2); //set flag for territory clicked on (bottom table)     
            
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === countryPath.getAttribute("uniqueid")) {
            writeBottomTableInformation(mainArrayOfTerritoriesAndResources[i], false, countryPath);
            break;
        }
    }
}

function calculatePathAreasWhenPageLoaded() {
    return new Promise((resolve, reject) => {
        let intervalId = setInterval(function() {
            if (pageLoaded === true) {

                let pathAreas = calculatePathAreas();
                allowSelectionOfCountry = true;

                clearInterval(intervalId);

                resolve(pathAreas);
            }
        }, 800);
    });
}

function calculatePathAreas() {
    let pathAreas = [];

    let totalAreaPath = 0;
    for (let i = 0; i < paths.length; i++) {
        let path = paths[i];
        let pathLength = path.getTotalLength();
        let numPoints = 80;
        let points = [];
        for (let j = 0; j < numPoints; j++) {
            let point = path.getPointAtLength(j / numPoints * pathLength);
            points.push({ x: point.x, y: point.y });
        }
        let area = 0;
        for (let j = 0; j < points.length; j++) {
            let k = (j + 1) % points.length;
            area += points[j].x * points[k].y - points[j].y * points[k].x;
        }
        area = Math.abs(area / 2);
        totalAreaPath += area;
        let uniqueId = path.getAttribute('uniqueid');
        let dataName = path.getAttribute('data-name');
        let territoryId = path.getAttribute('territory-id');
        pathAreas.push({ uniqueId: uniqueId, dataName: dataName, territoryId: territoryId, area: area });
    }
    
    let scalingFactor = 136067649 / totalAreaPath;
    
    for (let i = 0; i < pathAreas.length; i++) {
        pathAreas[i].area *= scalingFactor;
    }
    
    return pathAreas;
}

function assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState) {
    // Loop through each element in pathAreas array
    for (let i = 0; i < pathAreas.length; i++) {
        let uniqueId = pathAreas[i].uniqueId;
        let dataName = pathAreas[i].dataName;
        let territoryId = pathAreas[i].territoryId;
        let territoryName;
        let area = pathAreas[i].area;

        // Find matching country in armyArray
        let matchingCountry = dataTableCountriesInitialState.find(function(country) {
            return country.country === dataName;
        });

        if (matchingCountry) {
            let totalArmyForCountry = matchingCountry.startingArmy;
            let totalGoldForCountry = matchingCountry.res_gold;
            let totalOilForCountry = matchingCountry.res_oil;
            let totalFoodForCountry = matchingCountry.res_food;
            let totalConsMatsForCountry = matchingCountry.res_cons_mats;
            let startingPop = parseInt(matchingCountry.startingPop);
            let territoryPopulation;
            let productiveTerritoryPop;
            let continent = matchingCountry.continent;
            let dev_index = matchingCountry.dev_index;
            let percentOfWholeArea = 0;

            // Calculate percentOfWholeArea based on number of paths per dataName
            let numPaths = pathAreas.filter(function(path) {
                return path.dataName === dataName;
            }).length;

            if (numPaths === 1) {
                percentOfWholeArea = 1;
            } else {
                let pathsForDataName = pathAreas.filter(function(path) {
                    return path.dataName === dataName;
                });
                let areaSum = pathsForDataName.reduce(function(acc, path) {
                    return acc + path.area;
                }, 0);
                let areaForTerritoryId = pathsForDataName.find(function(path) {
                    return path.territoryId === territoryId;
                }).area;
                percentOfWholeArea = areaForTerritoryId / areaSum;
            }

            //for initial setup, modify later for per turn calculations
            if (continent === "Europe") {
                continentModifier = 15;
            } else if (continent === "North America") {
                continentModifier = 15;
            } else if (continent === "Asia") {
                continentModifier = 1;
            } else if (continent === "Oceania") {
                continentModifier = 1;
            } else if (continent === "South America") {
                continentModifier = 1.8;
            } else if (continent === "Africa") {
                continentModifier = 2;
            }

            for (const path of paths) {
                if (path.getAttribute("uniqueid") === uniqueId) {
                    territoryName = path.getAttribute("territory-name");
                }
            }

            // Calculate population of each territory based on the startingPop for the whole country it belongs to
            territoryPopulation = startingPop * percentOfWholeArea;

            // Calculate new army value for current element
            let armyForCurrentTerritory = totalArmyForCountry * percentOfWholeArea;
            let goldForCurrentTerritory = (totalGoldForCountry * ((area/8000000) * dev_index) + (percentOfWholeArea * (territoryPopulation/50000)) * continentModifier);
            let oilForCurrentTerritory = initialOilCalculation(matchingCountry, area);
            let oilCapacity = oilForCurrentTerritory;
            let consMatsForCurrentTerritory = initialConsMatsCalculation(matchingCountry, area);
            let consMatsCapacity = consMatsForCurrentTerritory;
            let defenseBonus = 1;
            let farmsBuilt = 0;
            let oilWellsBuilt = 0;
            let forestsBuilt = 0;
            let fortsBuilt = 0;

            let initialArmyDistributionArray = calculateInitialAssaultAirNavalForTerritory(armyForCurrentTerritory, oilForCurrentTerritory);

            let assaultForCurrentTerritory = initialArmyDistributionArray.assault;
            let useableAssault = assaultForCurrentTerritory;
            let airForCurrentTerritory = initialArmyDistributionArray.air;
            let useableAir = airForCurrentTerritory;
            let navalForCurrentTerritory = initialArmyDistributionArray.naval;
            let useableNaval = navalForCurrentTerritory;
            let infantryForCurrentTerritory = initialArmyDistributionArray.infantry;

            armyForCurrentTerritory = (navalForCurrentTerritory * vehicleArmyWorth.naval) + (airForCurrentTerritory * vehicleArmyWorth.air) + (assaultForCurrentTerritory * vehicleArmyWorth.assault) + infantryForCurrentTerritory; //get correct value after any rounding by calculations

            productiveTerritoryPop = (((territoryPopulation / 100) * 45) * dev_index) - armyForCurrentTerritory;
            let foodForCurrentTerritory = (territoryPopulation / 10000) + (armyForCurrentTerritory / 10000);
            let foodCapacity = territoryPopulation + armyForCurrentTerritory;
            let foodConsumption = (territoryPopulation) + armyForCurrentTerritory;
            // Add updated path data to the new array
            mainArrayOfTerritoriesAndResources.push({
                uniqueId: uniqueId,
                dataName: dataName,
                territoryId: territoryId,
                territoryName: territoryName,
                territoryPopulation: territoryPopulation,
                productiveTerritoryPop: productiveTerritoryPop,
                area: area,
                continent: continent,
                armyForCurrentTerritory: armyForCurrentTerritory,
                assaultForCurrentTerritory: assaultForCurrentTerritory,
                useableAssault: useableAssault,
                airForCurrentTerritory: airForCurrentTerritory,
                useableAir: useableAir,
                navalForCurrentTerritory: navalForCurrentTerritory,
                useableNaval: useableNaval,
                infantryForCurrentTerritory: infantryForCurrentTerritory,
                goldForCurrentTerritory: goldForCurrentTerritory,
                oilForCurrentTerritory: oilForCurrentTerritory,
                oilCapacity: oilCapacity,
                oilDemand: (initialArmyDistributionArray.air * oilRequirements.air) + (initialArmyDistributionArray.assault * oilRequirements.assault) + (initialArmyDistributionArray.naval * oilRequirements.naval),
                foodForCurrentTerritory: foodForCurrentTerritory,
                foodCapacity: foodCapacity,
                foodConsumption: foodConsumption,
                consMatsForCurrentTerritory: consMatsForCurrentTerritory,
                consMatsCapacity: consMatsCapacity,
                devIndex: dev_index,
                continentModifier: continentModifier,
                farmsBuilt: farmsBuilt,
                oilWellsBuilt: oilWellsBuilt,
                forestsBuilt: forestsBuilt,
                fortsBuilt: fortsBuilt,
                defenseBonus: defenseBonus
            });
        }
    }

    return mainArrayOfTerritoriesAndResources;
}

function createArrayOfInitialData() {
    return calculatePathAreasWhenPageLoaded().then(pathAreas => {
        return new Promise((resolve, reject) => {
            mainArrayOfTerritoriesAndResources = assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState);
            resolve(mainArrayOfTerritoriesAndResources);
        });
    });
}

function randomiseInitialGold(mainArrayOfTerritoriesAndResources) {
    mainArrayOfTerritoriesAndResources.forEach((country) => {
        let randomGoldFactor = Math.floor(Math.random() * 20) + 2;
        let randomAddSubtract = Math.random() < 0.5; //add or subtract

        if (randomAddSubtract) {
            country.goldForCurrentTerritory = (country.goldForCurrentTerritory + (country.goldForCurrentTerritory * (randomGoldFactor/100))) / country.devIndex;
        } else {
            country.goldForCurrentTerritory = country.goldForCurrentTerritory - (country.goldForCurrentTerritory * (randomGoldFactor/100));
        }
    });
    return mainArrayOfTerritoriesAndResources;
}

export function newTurnResources() {
    //calculate new array data and set it
    if (currentTurn !== 1) {
        calculateTerritoryResourceIncomesEachTurn();
    }

    AddUpAllTerritoryResourcesForCountryAndWriteToTopTable();
    capacityArray = calculateAllTerritoryCapacitiesForCountry();
    demandArray = calculateAllTerritoryDemandsForCountry();
    if (currentTurn !== 1) {
        for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
            if (mainArrayOfTerritoriesAndResources[i].dataName === playerCountry) {
                setUseableNotUseableWeaponsDueToOilDemand(mainArrayOfTerritoriesAndResources, mainArrayOfTerritoriesAndResources[i]);
            }
        }
    }

}
    
    //todo : return a popup to the user with a confirm button to remove it, stating what the player gained that turn

function calculateTerritoryResourceIncomesEachTurn() {
    let changeGold;
    let changeOil;
    let changeFood;
    let changeConsMats;
    let changePop;

    //continent modifier or possibly handle upgrades in future
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        //set each turn so that we can make exceptions ater due to upgrades when introduced that code but HC for now
        if (mainArrayOfTerritoriesAndResources[i].continent === "Europe") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 1;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "North America") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 1;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "Asia") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 0.7;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "Oceania") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 0.6;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "South America") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 0.6;
        } else if (mainArrayOfTerritoriesAndResources[i].continent === "Africa") {
            mainArrayOfTerritoriesAndResources[i].continentModifier = 0.5;
        } 
    }

    //loop to update all new values for new turn
    for (const path of paths) {
        for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
            if (path.getAttribute("owner") === "Player" && path.getAttribute("uniqueid") === mainArrayOfTerritoriesAndResources[i].uniqueId) {
            /*    changeGold = calculateGoldChange();
                changeOil = calculateOilChange();
                changeFood = calculateFoodChange();
                changeConsMats = calculateConsMatsChange();
                changePop = calculatePopulationChange(); */

                changeGold = 10;
                changeOil = calculateOilChange(mainArrayOfTerritoriesAndResources[i], false);
                changeFood = calculateFoodChange(mainArrayOfTerritoriesAndResources[i], false);
                changeConsMats = calculateConsMatsChange(mainArrayOfTerritoriesAndResources[i], false);
                changePop = calculatePopulationChange(mainArrayOfTerritoriesAndResources[i]);

                mainArrayOfTerritoriesAndResources[i].goldForCurrentTerritory += changeGold;
                mainArrayOfTerritoriesAndResources[i].oilForCurrentTerritory += changeOil;
                mainArrayOfTerritoriesAndResources[i].foodForCurrentTerritory += changeFood;
                mainArrayOfTerritoriesAndResources[i].foodConsumption = mainArrayOfTerritoriesAndResources[i].territoryPopulation + mainArrayOfTerritoriesAndResources[i].armyForCurrentTerritory;
                mainArrayOfTerritoriesAndResources[i].consMatsForCurrentTerritory += changeConsMats;
                mainArrayOfTerritoriesAndResources[i].territoryPopulation += changePop;
                mainArrayOfTerritoriesAndResources[i].productiveTerritoryPop = (((mainArrayOfTerritoriesAndResources[i].territoryPopulation / 100) * 45) * mainArrayOfTerritoriesAndResources[i].devIndex);
            }
        }
    }
}

function calculateConsMatsChange(territory, isSimulation) {
    let consMatsChange = 0;

    if (randomEventHappening && randomEvent === "Forest Fire" && !isSimulation) { //ConsMats disaster
        const isRandomlyTrue = Math.random() >= 0.5;
        if (isRandomlyTrue) {
            let tempConsMats = territory.consMatsForCurrentTerritory;
            territory.consMatsForCurrentTerritory /= 1.5;
            console.log(territory.dataName + "'s " + territory.territoryName + "was hit and  lost half its construction materials!");
            console.log("It had " + tempConsMats + " but now it has " + territory.consMatsForCurrentTerritory);
        } else {
            console.log(territory.dataName + "'s " + territory.territoryName + "escaped harm!");
        }
    }

    //if consMats is below consMats capacity then grow at 25% per turn
    if (!randomEventHappening && territory.consMatsCapacity > (territory.consMatsForCurrentTerritory)) {
        const consMatsDifference = territory.consMatsCapacity - (territory.consMatsForCurrentTerritory);
        consMatsChange = (Math.ceil(consMatsDifference * 0.25));
        }

        //if consMats is above consMats capacity then lose it at 10% per turn until it balances
        if (!randomEventHappening && territory.consMatsCapacity < (territory.consMatsForCurrentTerritory)) {
        const consMatsDifference = (territory.consMatsForCurrentTerritory) - territory.consMatsCapacity;
        consMatsChange = -(Math.ceil(consMatsDifference * 0.1));
    }

    return consMatsChange;
}

function calculateOilChange(territory, isSimulation) {
    let oilChange = 0;

    if (randomEventHappening && randomEvent === "Oil Well Fire" && !isSimulation) { //oil disaster
        const isRandomlyTrue = Math.random() >= 0.5;
        if (isRandomlyTrue) {
            let tempOil = territory.oilForCurrentTerritory;
            territory.oilForCurrentTerritory /= 1.5;
            console.log(territory.dataName + "'s " + territory.territoryName + "was hit and  lost half its oil!");
            console.log("It had " + tempOil + " but now it has " + territory.oilForCurrentTerritory);
        } else {
            console.log(territory.dataName + "'s " + territory.territoryName + "escaped harm!");
        }
    }

    //if oil is below oil capacity then grow at 30% per turn
    if (!randomEventHappening && territory.oilCapacity > (territory.oilForCurrentTerritory)) {
        const oilDifference = territory.oilCapacity - (territory.oilForCurrentTerritory);
        oilChange = (Math.ceil(oilDifference * 0.3));
        }

        //if oil is above oil capacity then lose it at 10% per turn until it balances
        if (!randomEventHappening && territory.oilCapacity < (territory.oilForCurrentTerritory)) {
        const oilDifference = (territory.oilForCurrentTerritory) - territory.oilCapacity;
        oilChange = -(Math.ceil(oilDifference * 0.1));
    }

    return oilChange;
}

function calculateFoodChange(territory, isSimulation) { 
    let foodChange = 0;

    if (randomEventHappening && randomEvent === "Food Disaster" && !isSimulation) { //food disaster
        const isRandomlyTrue = Math.random() >= 0.5;
        if (isRandomlyTrue) {
            let tempFood = territory.foodForCurrentTerritory;
            territory.foodForCurrentTerritory /= 2;
            console.log(territory.dataName + "'s " + territory.territoryName + "was hit and  lost half its food!");
            console.log("It had " + tempFood + " but now it has " + territory.foodForCurrentTerritory);
        } else {
            console.log(territory.dataName + "'s " + territory.territoryName + "escaped harm!");
        }
    }

    //if food is below food capacity then grow at 20% per turn
    if (!randomEventHappening && territory.foodCapacity > (territory.foodForCurrentTerritory * 10000)) {
        const foodDifference = territory.foodCapacity - (territory.foodForCurrentTerritory * 10000);
        foodChange = (Math.ceil(foodDifference * 0.2) / 10000);
        }

        //if food is above food capacity then lose it at 10% per turn until it balances
        if (!randomEventHappening && territory.foodCapacity < (territory.foodForCurrentTerritory * 10000)) {
        const foodDifference = (territory.foodForCurrentTerritory * 10000) - territory.foodCapacity;
        foodChange = -(Math.ceil(foodDifference * 0.1) / 10000);
    }
    
    return foodChange;
}     

function calculatePopulationChange(territory) {
    if (!randomEventHappening) {
        const currentPopulation = territory.territoryPopulation + territory.infantryForCurrentTerritory + (territory.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (territory.airForCurrentTerritory * vehicleArmyWorth.air) + (territory.navalForCurrentTerritory * vehicleArmyWorth.naval);
        const devIndex = territory.devIndex;
        const foodForCurrentTerritory = territory.foodForCurrentTerritory;

        let populationChange = 0;

        if (foodForCurrentTerritory * 10000 < currentPopulation) {
        // Starvation situation
        const foodShortage = Math.ceil((currentPopulation - foodForCurrentTerritory * 10000) / 1000);
        const deathRate = Math.round(100 * (1 - devIndex) * 3); // Number of people who die based on devIndex

        populationChange = -Math.min(foodShortage * deathRate, currentPopulation);
        } else {
        // Growth situation
        const maxGrowth = foodForCurrentTerritory * 10000 - currentPopulation;
        const growthPotential = Math.floor(devIndex * currentPopulation * 0.1);

        populationChange = Math.min(maxGrowth, growthPotential);
        }

        return populationChange;
    } else {
        return 0; //if random event just happened for food, dont lose any people immediately til the next turn so user can process it
    }
}

export function formatNumbersToKMB(string) {
    if (string >= 1000000000) {
        return (string / 1000000000).toFixed(1) + 'B';
    } else if (string >= 1000000) {
        return (string / 1000000).toFixed(1) + 'M';
    } else if (string >= 1000) {
        return (string / 1000).toFixed(1) + 'k';
    } else {
        return string.toFixed(0);
    }
}

function calculateAllTerritoryDemandsForCountry() {
    const demandArray = [];

    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        for (let j = 0; j < playerOwnedTerritories.length; j++) {
          if (mainArrayOfTerritoriesAndResources[i].uniqueId === playerOwnedTerritories[j].getAttribute("uniqueid")) {
            const totalOilDemand = mainArrayOfTerritoriesAndResources[i].oilDemand;
            const totalFoodConsumption = mainArrayOfTerritoriesAndResources[i].foodConsumption;
    
            demandArray.push([totalOilDemand, totalFoodConsumption]);
          }
        }
      }
    
      const reducedDemandArray = demandArray.reduce((acc, curr) => {
        return curr.map((value, index) => acc[index] + value);
      }, [0, 0]);

      const result = {
        totalOilDemand: reducedDemandArray[0],
        totalFoodConsumption: reducedDemandArray[1]
      };

      return result;
}

function calculateAllTerritoryCapacitiesForCountry() {
    const capacityArray = [];
  
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
      for (let j = 0; j < playerOwnedTerritories.length; j++) {
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === playerOwnedTerritories[j].getAttribute("uniqueid")) {
          const totalOilCapacity = mainArrayOfTerritoriesAndResources[i].oilCapacity;
          const totalFoodCapacity = mainArrayOfTerritoriesAndResources[i].foodCapacity;
          const totalConsMatsCapacity = mainArrayOfTerritoriesAndResources[i].consMatsCapacity;
  
          capacityArray.push([totalOilCapacity, totalFoodCapacity, totalConsMatsCapacity]);
        }
      }
    }
  
    const reducedCapacityArray = capacityArray.reduce((acc, curr) => {
      return curr.map((value, index) => acc[index] + value);
    }, [0, 0, 0]);
  
    const result = {
      totalOilCapacity: reducedCapacityArray[0],
      totalFoodCapacity: reducedCapacityArray[1],
      totalConsMatsCapacity: reducedCapacityArray[2]
    };
  
    return result;
  }
  
  

function AddUpAllTerritoryResourcesForCountryAndWriteToTopTable() {
    let totalGold = 0;
    let totalOil = 0;
    let totalFood = 0;
    let totalConsMats = 0;
    let totalPop = 0;
    let totalProdPop = 0;
    let totalArea = 0;
    let totalArmy = 0;
    let totalInfantry = 0;
    let totalAssault = 0;
    let totalAir = 0;
    let totalNaval = 0;
    let totalUseableAssault = 0;
    let totalUseableAir = 0;
    let totalUseableNaval = 0;

    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        for (const path of paths) {
            if (path.getAttribute("owner") === "Player" && path.getAttribute("uniqueid") === mainArrayOfTerritoriesAndResources[i].uniqueId) {
                totalGold += mainArrayOfTerritoriesAndResources[i].goldForCurrentTerritory;
                totalOil += mainArrayOfTerritoriesAndResources[i].oilForCurrentTerritory;
                totalFood += mainArrayOfTerritoriesAndResources[i].foodForCurrentTerritory;
                totalConsMats += mainArrayOfTerritoriesAndResources[i].consMatsForCurrentTerritory;
                totalPop += mainArrayOfTerritoriesAndResources[i].territoryPopulation;
                totalProdPop += mainArrayOfTerritoriesAndResources[i].productiveTerritoryPop;
                totalArea += mainArrayOfTerritoriesAndResources[i].area;
                totalArmy += mainArrayOfTerritoriesAndResources[i].armyForCurrentTerritory;
                totalInfantry += mainArrayOfTerritoriesAndResources[i].infantryForCurrentTerritory;
                totalAssault += mainArrayOfTerritoriesAndResources[i].assaultForCurrentTerritory;
                totalAir += mainArrayOfTerritoriesAndResources[i].airForCurrentTerritory;
                totalNaval += mainArrayOfTerritoriesAndResources[i].navalForCurrentTerritory;
                totalUseableAssault += mainArrayOfTerritoriesAndResources[i].useableAssault;
                totalUseableAir += mainArrayOfTerritoriesAndResources[i].useableAir;
                totalUseableNaval += mainArrayOfTerritoriesAndResources[i].useableNaval;

                if (path === currentSelectedPath && currentTurn !== 1) {
                    writeBottomTableInformation(mainArrayOfTerritoriesAndResources[i], true);
                }
            }
        }
    }

    totalPlayerResources.length = 0;

    totalPlayerResources.push({
        totalGold: totalGold,
        totalOil: totalOil,
        totalFood: totalFood,
        totalConsMats: totalConsMats,
        totalPop: totalPop,
        totalProdPop: totalProdPop,
        totalArea: totalArea,
        totalArmy: totalArmy,
        totalInfantry: totalInfantry,
        totalAssault: totalAssault,
        totalAir: totalAir,
        totalNaval: totalNaval,
        totalUseableAssault: totalUseableAssault,
        totalUseableAir: totalUseableAir,
        totalUseableNaval: totalUseableNaval
    });

    //write new data to top table
    document.getElementById("top-table").rows[0].cells[0].style.whiteSpace = "pre";
    document.getElementById("top-table").rows[0].cells[3].innerHTML = Math.ceil(totalPlayerResources[0].totalGold);
    document.getElementById("top-table").rows[0].cells[5].innerHTML = Math.ceil(totalPlayerResources[0].totalOil);
    document.getElementById("top-table").rows[0].cells[7].innerHTML = Math.ceil(totalPlayerResources[0].totalFood);
    document.getElementById("top-table").rows[0].cells[9].innerHTML = Math.ceil(totalPlayerResources[0].totalConsMats);
    document.getElementById("top-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalProdPop) + " (" + formatNumbersToKMB(totalPlayerResources[0].totalPop) + ")";
    document.getElementById("top-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalArea) + " (km²)";
    document.getElementById("top-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalArmy);
}

function writeBottomTableInformation(territory, userClickingANewTerritory, countryPath) {
    if (userClickingANewTerritory) {
            colourTableText(document.getElementById("bottom-table"), territory);
            document.getElementById("bottom-table").rows[0].cells[0].style.whiteSpace = "pre";
            document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(territory.goldForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[5].innerHTML = Math.ceil(territory.oilForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[7].innerHTML = Math.ceil(territory.foodForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(territory.consMatsForCurrentTerritory);
            document.getElementById("bottom-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(territory.productiveTerritoryPop) + " (" + formatNumbersToKMB(territory.territoryPopulation) + ")";
            document.getElementById("bottom-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(territory.area) + " (km²)";
            document.getElementById("bottom-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(territory.armyForCurrentTerritory);
        } else { //turn update resources for selected territory
        colourTableText(document.getElementById("bottom-table"), territory);
        document.getElementById("bottom-table").rows[0].cells[1].innerHTML = countryPath.getAttribute("territory-name") + " (" + territory.continent + ")";
        document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(territory.goldForCurrentTerritory);
        document.getElementById("bottom-table").rows[0].cells[5].innerHTML = Math.ceil(territory.oilForCurrentTerritory);
        document.getElementById("bottom-table").rows[0].cells[7].innerHTML = Math.ceil(territory.foodForCurrentTerritory);
        document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(territory.consMatsForCurrentTerritory);
        document.getElementById("bottom-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(territory.productiveTerritoryPop) + " (" + formatNumbersToKMB(territory.territoryPopulation) + ")";
        document.getElementById("bottom-table").rows[0].cells[13].innerHTML = formatNumbersToKMB(territory.area) + " (km²)";
        document.getElementById("bottom-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(territory.armyForCurrentTerritory);
    }
}

function initialOilCalculation(path, area) {
    let developmentIndex = parseFloat(path.dev_index);
    let continentModifier;

    if (path.continent === "Europe") {
        continentModifier = 0.9;
    } else if (path.continent === "North America") {
        continentModifier = 1.3;
    } else if (path.continent === "Africa") {
        continentModifier = 1.8;
    } else if (path.continent === "South America") {
        continentModifier = 1.6;
    } else if (path.continent === "Oceania") {
        continentModifier = 0.8;
    } else if (path.continent === "Asia") {
        continentModifier = 1.1;
    }

    const term1 = (Math.abs(Math.pow(area / 1000, 1.5) * developmentIndex * (continentModifier - 1) * 0.1));
    const term2 = (Math.pow(area / 1000, 0.5) * developmentIndex * 50);
    const term3 = (Math.pow(area / 1000, 0.5) * continentModifier * 10);
    return term1 + term2 + term3;
}

function initialConsMatsCalculation(path, area) {
    let developmentIndex = parseFloat(path.dev_index);
    let continentModifier;

    if (path.continent === "Europe") {
        continentModifier = 1.2;
    } else if (path.continent === "North America") {
        continentModifier = 1.6;
    } else if (path.continent === "Africa") {
        continentModifier = 1.3;
    } else if (path.continent === "South America") {
        continentModifier = 1.8;
    } else if (path.continent === "Oceania") {
        continentModifier = 0.8;
    } else if (path.continent === "Asia") {
        continentModifier = 1.8;
    }

    const term1 = (Math.abs(Math.pow(area / 1000, 1.5) * developmentIndex * (continentModifier - 1) * 0.1));
    const term2 = (Math.pow(area / 1000, 0.5) * developmentIndex * 50);
    const term3 = (Math.pow(area / 1000, 0.5) * continentModifier * 10);
    return term1 + term2 + term3;
}

export function drawUITable(uiTableContainer, summaryTerritoryArmyTable) {
    let imageSources;
    let headerColumns;
    uiTableContainer.innerHTML = "";
    uiTableContainer.style.display = "flex";
    
    playerOwnedTerritories.sort((a, b) => {
        const idA = parseInt(a.getAttribute("territory-id"));
        const idB = parseInt(b.getAttribute("territory-id"));
        return idA - idB;
    });
    
    // Create table element
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.tableLayout = "fixed";

    const headerRow = document.createElement("div");
    headerRow.classList.add("ui-table-row");
    headerRow.style.fontWeight = "bold";

    if (summaryTerritoryArmyTable === 0) {
        headerColumns = ["Territory", "Population(+/-)", "Gold(+/-)", "Oil(+/-)", "Oil Capacity", "Oil Demand", "Food(+/-)", "Food Capacity", "Food Consumption", "Construction Materials(+/-)", "Construction Materials Capacity", "Army Power", "Infantry", "Assault(useable)", "Air(useable)", "Naval(useable)"];
        imageSources = ["flagUIIcon.png", "population.png", "gold.png", "oil.png", "oilCap.png", "oilDemand.png", "food.png", "foodCap.png", "foodConsumption.png", "consMats.png", "consMatsCap.png", "army.png", "infantry.png", "assault.png", "air.png", "naval.png"];
    } else if (summaryTerritoryArmyTable === 1) { // Create first row territory button
        headerColumns = ["Territory", "Productive Population", "Population", "Area", "Gold", "Oil", "Food", "Construction Materials", "Upgrade"];
        imageSources = ["flagUIIcon.png", "prodPopulation.png", "Population.png", "landArea.png", "gold.png", "oil.png", "food.png", "consMats.png", "upgrade.png"];
    } else if (summaryTerritoryArmyTable === 2) {
        headerColumns = ["Territory", "Army", "Infantry", "Assault", "Air", "Naval", "Gold", "Oil", "Buy"];
        imageSources = ["flagUIIcon.png", "army.png", "infantry.png", "assault.png", "air.png", "naval.png", "gold.png", "oil.png", "buy.png"];
    }

    for (let j = 0; j < headerColumns.length; j++) {
        const headerColumn = document.createElement("div");

        if (j === 0) {
            if (summaryTerritoryArmyTable === 0 ) {
                headerColumn.style.width = "55%";
            } else {
                headerColumn.style.width = "30%";
            }
        } else {
            headerColumn.classList.add("centerIcons");
        }

        headerColumn.classList.add("ui-table-column");

        headerColumn.addEventListener("mouseover", (e) => {
            const x = e.clientX;
            const y = e.clientY;
        
            tooltip.style.left = x - 60 + "px";
            tooltip.style.top = 25 + y + "px";
        
            tooltip.innerHTML = headerColumns[j];
            tooltip.style.display = "block";
        
            // Add the tooltip to the document body
            document.body.appendChild(tooltip);
        });

        headerColumn.addEventListener("mouseout", (e) => {
            tooltip.innerHTML = "";
            tooltip.style.display = "none";
        });

        // Create an <img> tag with the image source
        const imageSource = "/resources/" + imageSources[j];
        const imageElement = document.createElement("img");
        imageElement.src = imageSource;
        imageElement.alt = headerColumns[j];
        imageElement.classList.add("sizingIcons");

        headerColumn.appendChild(imageElement);
        if (summaryTerritoryArmyTable === 0 && j === 0) {
            headerColumn.innerHTML = "Country Summary:";
        }
        headerRow.appendChild(headerColumn);
    }

    table.appendChild(headerRow);

    if (summaryTerritoryArmyTable === 0) {
        // Create a single row under the first header row
        const singleRow = document.createElement("div");
        singleRow.classList.add("ui-table-row");

        // Create columns
        for (let j = 0; j < headerColumns.length; j++) {
            const column = document.createElement("div");
            column.classList.add("ui-table-column");

            if (j === 0) {
                column.style.width = "55%";
                // Set the value of the first column to a custom value
                column.textContent = playerCountry;
            } else {
                column.classList.add("centerIcons");

                switch (j) {
                    case 1:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalPop);
                        break;
                    case 2:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalGold);
                        break;
                    case 3:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalOil);
                        break;
                    case 4:
                        column.textContent = formatNumbersToKMB(capacityArray.totalOilCapacity);
                        break;
                    case 5:
                        column.textContent = formatNumbersToKMB(demandArray.totalOilDemand);
                        break;
                    case 6:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalFood);
                        break;
                    case 7:
                        column.textContent = formatNumbersToKMB(capacityArray.totalFoodCapacity);
                        break;
                    case 8:
                        column.textContent = formatNumbersToKMB(demandArray.totalFoodConsumption);
                        break;
                    case 9:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalConsMats);
                        break;
                    case 10:
                        column.textContent = formatNumbersToKMB(capacityArray.totalConsMatsCapacity);
                        break;
                    case 11:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalArmy);
                        break;
                    case 12:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalInfantry);
                        break;
                    case 13:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalUseableAssault) + "/" + formatNumbersToKMB(totalPlayerResources[0].totalAssault);
                        break;
                    case 14:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalUseableAir) + "/" + formatNumbersToKMB(totalPlayerResources[0].totalAir);
                        break;
                    case 15:
                        column.textContent = formatNumbersToKMB(totalPlayerResources[0].totalUseableNaval) + "/" + formatNumbersToKMB(totalPlayerResources[0].totalNaval);
                        break;
                }
            }

            singleRow.appendChild(column);
        }

        table.appendChild(singleRow);
        // Create an empty row
        const emptyRow = document.createElement("div");
        emptyRow.classList.add("ui-table-row");
        emptyRow.style.height = "20px"; // Adjust the height as needed
        table.appendChild(emptyRow);
    
        // Add the second header row
        const secondHeaderRow = document.createElement("div");
        secondHeaderRow.classList.add("ui-table-row");
        secondHeaderRow.style.fontWeight = "bold";
    
        const secondHeaderColumns = ["Territory", "Population(+/-)", "Gold(+/-)", "Oil(+/-)", "Oil Capacity", "Oil Demand", "Food(+/-)", "Food Capacity", "Food Consumption", "Construction Materials(+/-)", "Construction Materials Capacity", "Army Power", "Infantry", "Assault(useable)", "Air(useable)", "Naval(useable)"];
        const secondImageSources = ["flagUIIcon.png", "population.png", "gold.png", "oil.png", "oilCap.png", "oilDemand.png", "food.png", "foodCap.png", "foodConsumption.png", "consMats.png", "consMatsCap.png", "army.png", "infantry.png", "assault.png", "air.png", "naval.png"];
    
        for (let j = 0; j < secondHeaderColumns.length; j++) {
            const secondHeaderColumn = document.createElement("div");
            secondHeaderColumn.classList.add("ui-table-column");

            secondHeaderColumn.addEventListener("mouseover", (e) => {
                const x = e.clientX;
                const y = e.clientY;
            
                tooltip.style.left = x - 60 + "px";
                tooltip.style.top = 25 + y + "px";
            
                tooltip.innerHTML = secondHeaderColumns[j];
                tooltip.style.display = "block";
            
                // Add the tooltip to the document body
                document.body.appendChild(tooltip);
              });
        
              secondHeaderColumn.addEventListener("mouseout", (e) => {
                tooltip.innerHTML = "";
                tooltip.style.display = "none";
              });
    
            if (j === 0) {
                secondHeaderColumn.style.width = "55%";
            } else {
                secondHeaderColumn.classList.add("centerIcons");
    
                // Create an <img> tag with the custom image source
                const imageSource = "/resources/" + secondImageSources[j];
                const imageElement = document.createElement("img");
                imageElement.src = imageSource;
                imageElement.alt = secondHeaderColumns[j];
                imageElement.classList.add("sizingIcons");
                secondHeaderColumn.appendChild(imageElement);
            }

            if (summaryTerritoryArmyTable === 0 && j === 0) {
                secondHeaderColumn.innerHTML = "Territories Summary:";
            }
    
            secondHeaderRow.appendChild(secondHeaderColumn);
        }
    
        table.appendChild(secondHeaderRow);
    }
    

    // Create rows
    for (let i = 0; i < playerOwnedTerritories.length; i++) {
        const row = document.createElement("div");
        row.classList.add("ui-table-row-hoverable");
        if (summaryTerritoryArmyTable === 0) {
            // Create columns
            for (let j = 0; j < 16; j++) {
                const column = document.createElement("div");
                column.classList.add("ui-table-column");
                if (j === 0) {
                    column.style.width = "55%";
                    // Set the value of the first column to the "territory-name" attribute
                    const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                    column.textContent = territoryName;
                } else {            
                    column.classList.add("centerIcons");
                    const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                    const territoryData = mainArrayOfTerritoriesAndResources.find(t => t.uniqueId === uniqueId);
                    switch (j) {
                        case 1:
                            column.textContent = formatNumbersToKMB(territoryData.territoryPopulation);
                            break;
                        case 2:
                            column.textContent = formatNumbersToKMB(territoryData.goldForCurrentTerritory);
                            break;
                        case 3:
                            column.textContent = formatNumbersToKMB(territoryData.oilForCurrentTerritory);
                            break;
                        case 4:
                            column.textContent = formatNumbersToKMB(territoryData.oilCapacity);
                            break;
                        case 5:
                            column.textContent = formatNumbersToKMB(territoryData.oilDemand);
                            break;
                        case 6:
                            column.textContent = formatNumbersToKMB(territoryData.foodForCurrentTerritory);
                            break;
                        case 7:
                            column.textContent = formatNumbersToKMB(territoryData.foodCapacity);
                            break;
                        case 8:
                            column.textContent = formatNumbersToKMB(territoryData.foodConsumption);
                            break;
                        case 9:
                            column.textContent = formatNumbersToKMB(territoryData.consMatsForCurrentTerritory);
                            break;
                        case 10:
                            column.textContent = formatNumbersToKMB(territoryData.consMatsCapacity);
                            break;
                        case 11:
                            column.textContent = formatNumbersToKMB(territoryData.armyForCurrentTerritory);
                            break;
                        case 12:
                            column.textContent = formatNumbersToKMB(territoryData.infantryForCurrentTerritory);
                            break;
                        case 13:
                            column.textContent = formatNumbersToKMB(territoryData.useableAssault) + "/" + formatNumbersToKMB(territoryData.assaultForCurrentTerritory);
                            break;
                        case 14:
                            column.textContent = formatNumbersToKMB(territoryData.useableAir) + "/" + formatNumbersToKMB(territoryData.airForCurrentTerritory);
                            break;
                        case 15:
                            column.textContent = formatNumbersToKMB(territoryData.useableNaval) + "/" + formatNumbersToKMB(territoryData.navalForCurrentTerritory);
                            break;
                    }
                }
            row.appendChild(column);
            }
        } else if (summaryTerritoryArmyTable === 1) { //setup territory table
            // Create columns
            for (let j = 0; j < 9; j++) {
                const column = document.createElement("div");
                column.classList.add("ui-table-column");
                if (j === 0) {
                    column.style.width = "30%";
                    // Set the value of the first column to the "territory-name" attribute
                    const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                    column.textContent = territoryName;
                } else {
                    column.classList.add("centerIcons");
                    const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                    const territoryData = mainArrayOfTerritoriesAndResources.find(t => t.uniqueId === uniqueId);
                    switch (j) {
                    case 1:
                        column.textContent = formatNumbersToKMB(territoryData.productiveTerritoryPop);
                        break;
                    case 2:
                        column.textContent = formatNumbersToKMB(territoryData.territoryPopulation);
                        break;
                    case 3:
                        column.textContent = formatNumbersToKMB(territoryData.area);
                        break;
                    case 4:
                        column.textContent = Math.ceil(territoryData.goldForCurrentTerritory);
                        break;
                    case 5:
                        column.textContent = Math.ceil(territoryData.oilForCurrentTerritory);
                        break;
                    case 6:
                        column.textContent = Math.ceil(territoryData.foodForCurrentTerritory);
                        break;
                    case 7:
                        column.textContent = Math.ceil(territoryData.consMatsForCurrentTerritory);
                        break;
                    case 8:
                        const upgradeButtonImageElement = document.createElement("img");
                        // Create upgrade button div
                        const upgradeButtonDiv = document.createElement("div");
                        if (currentTurnPhase === 0) {
                            upgradeButtonDiv.classList.add("upgrade-button");
                            upgradeButtonImageElement.src = "/resources/upgradeButtonIcon.png";
                        } else {
                            upgradeButtonImageElement.src = "/resources/upgradeButtonGreyedOut.png";
                        }
                
                        // Create upgrade button image element
                        upgradeButtonImageElement.alt = "Upgrade Territory";
                        upgradeButtonImageElement.classList.add("sizeUpgradeButton");
            
                        // Add event listeners for click and mouseup events
                        upgradeButtonDiv.addEventListener("mousedown", () => {
                        if (currentTurnPhase === 0) {
                            playSoundClip();
                            upgradeButtonImageElement.src = "/resources/upgradeButtonIconPressed.png";
                        }
                        });
            
                        upgradeButtonDiv.addEventListener("mouseup", () => {
                        if (currentTurnPhase === 0) {
                            populateUpgradeTable(territoryData);
                            toggleUpgradeMenu(true, territoryData);
                            currentlySelectedTerritoryForUpgrades = territoryData;
                            upgradeButtonImageElement.src = "/resources/upgradeButtonIcon.png";
                            setUpgradeOrBuyWindowOnScreenToTrue(1);
                        }
                        });
            
                        upgradeButtonDiv.appendChild(upgradeButtonImageElement);
                        column.appendChild(upgradeButtonDiv);
                        break;
                }
            }
            row.addEventListener("mouseover", (e) => {
                const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                const territoryData = mainArrayOfTerritoriesAndResources.find((t) => t.uniqueId === uniqueId);
        
                tooltipUITerritoryRow(row, territoryData, e);
            });
            row.addEventListener("mouseout", () => {
                tooltip.style.display = "none";
                row.style.cursor = "default";
                });
            row.appendChild(column);
            }
        } else if (summaryTerritoryArmyTable === 2) { //setup army table
            // Create columns
            for (let j = 0; j < 9; j++) {
                const column = document.createElement("div");
                column.classList.add("ui-table-column");
                if (j === 0) {
                    column.style.width = "30%";
                    // Set the value of the first column to the "territory-name" attribute
                    const territoryName = playerOwnedTerritories[i].getAttribute("territory-name");
                    column.textContent = territoryName;
                } else {
                    column.classList.add("centerIcons");
                    const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                    const territoryData = mainArrayOfTerritoriesAndResources.find(t => t.uniqueId === uniqueId);
                    switch (j) {
                    case 1:
                        column.textContent = formatNumbersToKMB(territoryData.armyForCurrentTerritory);
                        break;
                    case 2:
                        column.textContent = formatNumbersToKMB(territoryData.infantryForCurrentTerritory);
                        break;
                    case 3:
                        column.textContent = formatNumbersToKMB(territoryData.assaultForCurrentTerritory);
                        break;
                    case 4:
                        column.textContent = Math.ceil(territoryData.airForCurrentTerritory);
                        break;
                    case 5:
                        column.textContent = Math.ceil(territoryData.navalForCurrentTerritory);
                        break;
                    case 6:
                        column.textContent = Math.ceil(territoryData.goldForCurrentTerritory);
                        break;
                    case 7:
                        column.textContent = Math.ceil(territoryData.oilForCurrentTerritory);
                        break;
                    case 8:
                    const buyButtonImageElement = document.createElement("img");
                    // Create buy button div
                    const buyButtonDiv = document.createElement("div");
                    if (currentTurnPhase === 0) {
                        buyButtonDiv.classList.add("buy-button");
                        buyButtonImageElement.src = "/resources/buyButtonIcon.png";
                    } else {
                        buyButtonImageElement.src = "/resources/buyButtonGreyedOut.png";
                    }
            
                    // Create upgrade button image element
                    buyButtonImageElement.alt = "Buy Military";
                    buyButtonImageElement.classList.add("sizeBuyButton");
        
                    // Add event listeners for click and mouseup events
                    buyButtonDiv.addEventListener("mousedown", () => {
                    if (currentTurnPhase === 0) {
                        playSoundClip();
                        buyButtonImageElement.src = "/resources/buyButtonIconPressed.png";
                    }
                    });
        
                    buyButtonDiv.addEventListener("mouseup", () => {
                    if (currentTurnPhase === 0) {
                        populateBuyTable(territoryData);
                        toggleBuyMenu(true, territoryData);
                        currentlySelectedTerritoryForPurchases = territoryData;
                        buyButtonImageElement.src = "/resources/buyButtonIcon.png";
                        setUpgradeOrBuyWindowOnScreenToTrue(2);
                    }
                    });
        
                    buyButtonDiv.appendChild(buyButtonImageElement);
                    column.appendChild(buyButtonDiv);
                    break;
                }
            }
            row.addEventListener("mouseover", (e) => {
                const uniqueId = playerOwnedTerritories[i].getAttribute("uniqueid");
                const territoryData = mainArrayOfTerritoriesAndResources.find((t) => t.uniqueId === uniqueId);
        
                tooltipUIArmyRow(row, territoryData, e);
            });
            row.addEventListener("mouseout", () => {
                tooltip.style.display = "none";
                row.style.cursor = "default";
                });
            row.appendChild(column);
            }
        }     
    table.appendChild(row);
    }

    uiTableContainer.appendChild(table);
}

function tooltipPurchaseMilitaryRow(territoryData, availablePurchases, event) {
    // Get the coordinates of the mouse cursor
    const x = event.clientX;
    const y = event.clientY;
  
    const territoryName = territoryData.territoryName;
    let type;
    let purchase;
    let amountAlreadyBuilt;
    let nextPurchaseCostGold;
    let nextProdPopCost;
    let simulatedTotal;
    let effectOnOilDemand;
  
    const buyRow = event.currentTarget.closest('.buy-row');
    if (!buyRow) {
      // No parent row found, exit the function
      return;
    }
  
    const buyTypeColumn = buyRow.querySelector('.buy-column:nth-child(2)');
    const buyValueColumn = buyRow.querySelector('.buyColumn5B input');
    const purchaseType = buyTypeColumn.innerHTML.trim();
  
    if (!purchaseType) {
      // No upgrade type found, exit the function
      return;
    }
  
    switch (purchaseType) {
      case "Infantry":
        type = "Infantry";
        nextPurchaseCostGold = 0;
        nextProdPopCost = 1000;
        purchase = availablePurchases[0];
        simulatedTotal = parseInt(buyValueColumn.value);
        amountAlreadyBuilt = territoryData.infantryForCurrentTerritory;
        effectOnOilDemand = 0;
        break;
      case "Assault":
        type = "Assault";
        nextPurchaseCostGold = 50;
        nextProdPopCost = 100;
        purchase = availablePurchases[1];
        simulatedTotal = parseInt(buyValueColumn.value);
        amountAlreadyBuilt = territoryData.assaultForCurrentTerritory;
        effectOnOilDemand = oilRequirements.assault;
        break;
      case "Air":
        type = "Air";
        nextPurchaseCostGold = 100;
        nextProdPopCost = 300;
        purchase = availablePurchases[2];
        simulatedTotal = parseInt(buyValueColumn.value);
        amountAlreadyBuilt = territoryData.airForCurrentTerritory;
        effectOnOilDemand = oilRequirements.air;
        break;
      case "Naval":
        type = "Naval";
        nextPurchaseCostGold = 200;
        nextProdPopCost = 1000;
        purchase = availablePurchases[3];
        simulatedTotal = parseInt(buyValueColumn.value);
        amountAlreadyBuilt = territoryData.navalForCurrentTerritory;
        effectOnOilDemand = oilRequirements.naval;
        break;
      default:
        // Invalid purchase type, exit the function
        return;
    }
  
    let whiteStyle = "font-weight: bold; color: white;";
    let greenStyle = "font-weight: bold; color: rgb(0,235,0);";
    let redStyle = "font-weight: bold; color: rgb(235,0,0);";

    let buildAvailabilityStyle;
    let effectOnOilDemandStyle;

    if (type === "Infantry") {
        effectOnOilDemandStyle = whiteStyle;
    } else {
        effectOnOilDemandStyle = redStyle;
    }

    if (purchase.condition === "Can Build") {
        buildAvailabilityStyle = greenStyle;
    } else {
        buildAvailabilityStyle = redStyle;
    }
  
    let tooltipContent = `
      <div><span style="color: rgb(235,235,0)">Territory: ${territoryName}</span></div>
      <div>Military Type: ${type}</div>
      <br />
      <div>Currently In Territory: <span style="${whiteStyle}">${amountAlreadyBuilt}</span></div>
      <br />
      <div>Cost to purchase unit (Gold): <span style="${whiteStyle}">${nextPurchaseCostGold}</span></div>
      <div>Cost to purchase unit (Prod. Pop.): <span style="${whiteStyle}">${nextProdPopCost}</span></div>
      <div>Effect on Oil Demand: <span style="${effectOnOilDemandStyle}">+${effectOnOilDemand}</span></div>
      <br />
      <div><span style="${buildAvailabilityStyle}">${purchase.condition}</span></div>
    `;
  
    tooltip.innerHTML = tooltipContent;
  
    // Temporarily show the tooltip to calculate its height
    tooltip.style.display = 'block';
  
    const tooltipHeight = tooltip.offsetHeight;
    const verticalThreshold = tooltipHeight + 25;
    const windowHeight = window.innerHeight;
  
    // Hide the tooltip again
    tooltip.style.display = 'none';
  
    if (windowHeight - y < verticalThreshold && y - verticalThreshold >= 0) {
      tooltip.style.left = x - 40 + "px";
      tooltip.style.top = y - verticalThreshold + "px";
    } else {
      tooltip.style.left = x - 40 + "px";
      tooltip.style.top = y + 25 + "px";
    }
  
    // Show the tooltip
    tooltip.style.display = "block";
  }

function tooltipUpgradeTerritoryRow(territoryData, availableUpgrades, event) {
    // Get the coordinates of the mouse cursor
    const x = event.clientX;
    const y = event.clientY;
  
    const territoryName = territoryData.territoryName;
    let type;
    let upgrade;
    let amountAlreadyBuilt;
    let nextUpgradeCostGold;
    let nextUpgradeCostConsMats;
    let simulatedTotal;
  
    const upgradeRow = event.currentTarget.closest('.upgrade-row');
    if (!upgradeRow) {
      // No parent row found, exit the function
      return;
    }
  
    const upgradeTypeColumn = upgradeRow.querySelector('.upgrade-column:nth-child(2)');
    const upgradeValueColumn = upgradeRow.querySelector('.column5B input');
    const upgradeType = upgradeTypeColumn.innerHTML.trim();
  
    if (!upgradeType) {
      // No upgrade type found, exit the function
      return;
    }
  
    switch (upgradeType) {
      case "Farm":
        type = "Farm";
        amountAlreadyBuilt = territoryData.farmsBuilt;
        nextUpgradeCostGold = simulatedCostsAll[0];
        nextUpgradeCostConsMats = simulatedCostsAll[1];
        upgrade = availableUpgrades[0];
        simulatedTotal = amountAlreadyBuilt + parseInt(upgradeValueColumn.value);
        break;
      case "Forest":
        type = "Forest";
        amountAlreadyBuilt = territoryData.forestsBuilt;
        nextUpgradeCostGold = simulatedCostsAll[2];
        nextUpgradeCostConsMats = simulatedCostsAll[3];
        upgrade = availableUpgrades[1];
        simulatedTotal = amountAlreadyBuilt + parseInt(upgradeValueColumn.value);
        break;
      case "Oil Well":
        type = "Oil Well";
        amountAlreadyBuilt = territoryData.oilWellsBuilt;
        nextUpgradeCostGold = simulatedCostsAll[4];
        nextUpgradeCostConsMats = simulatedCostsAll[5];
        upgrade = availableUpgrades[2];
        simulatedTotal = amountAlreadyBuilt + parseInt(upgradeValueColumn.value);
        break;
      case "Fort":
        type = "Fort";
        amountAlreadyBuilt = territoryData.fortsBuilt;
        nextUpgradeCostGold = simulatedCostsAll[6];
        nextUpgradeCostConsMats = simulatedCostsAll[7];
        upgrade = availableUpgrades[3];
        simulatedTotal = amountAlreadyBuilt + parseInt(upgradeValueColumn.value);
        break;
      default:
        // Invalid upgrade type, exit the function
        return;
    }
  
    let currentEffect;
    if (amountAlreadyBuilt > 0) {
      currentEffect = amountAlreadyBuilt + "0% -> ";
    } else if (amountAlreadyBuilt === 0) {
      currentEffect = "0% -> ";
    }
  
    let whiteStyle = "font-weight: bold; color: white;";
    let greenStyle = "font-weight: bold; color: rgb(0,235,0);";
    let redStyle = "font-weight: bold; color: rgb(235,0,0);";

    let buildAvailabilityStyle;

    if (upgrade.condition === "Can Build" && simulatedTotal >= 5) {
        upgrade.condition = "Max " + type + "s Reached";
    }

    if (upgrade.condition === "Can Build") {
        buildAvailabilityStyle = greenStyle;
    } else {
        buildAvailabilityStyle = redStyle;
    }
  
    let tooltipContent = `
      <div><span style="color: rgb(235,235,0)">Territory: ${territoryName}</span></div>
      <div>Upgrade Type: ${type}</div>
      <br />
      <div>Currently Built In Territory: <span style="${whiteStyle}">${amountAlreadyBuilt}</span></div>
      <div>Current Effect -> Next Effect: <span style="${whiteStyle}">${currentEffect}<span style="${greenStyle}">${simulatedTotal}0%</span></div>
      <br />
      <div>Cost Of Next Upgrade (Gold): <span style="${whiteStyle}">${nextUpgradeCostGold}</span></div>
      <div>Cost Of Next Upgrade (Cons. Mats.): <span style="${whiteStyle}">${nextUpgradeCostConsMats}</span></div>
      <br />
      <div><span style="${buildAvailabilityStyle}">${upgrade.condition}</span></div>
    `;
  
    tooltip.innerHTML = tooltipContent;
  
    // Temporarily show the tooltip to calculate its height
    tooltip.style.display = 'block';
  
    const tooltipHeight = tooltip.offsetHeight;
    const verticalThreshold = tooltipHeight + 25;
    const windowHeight = window.innerHeight;
  
    // Hide the tooltip again
    tooltip.style.display = 'none';
  
    if (windowHeight - y < verticalThreshold && y - verticalThreshold >= 0) {
      tooltip.style.left = x - 40 + "px";
      tooltip.style.top = y - verticalThreshold + "px";
    } else {
      tooltip.style.left = x - 40 + "px";
      tooltip.style.top = y + 25 + "px";
    }
  
    // Show the tooltip
    tooltip.style.display = "block";
  }

  function tooltipUIArmyRow(row, territoryData, event) {
    // Get the coordinates of the mouse cursor
    const x = event.clientX;
    const y = event.clientY;

    // Set the content of the tooltip based on the territory data
    const territoryName = row.querySelector(".ui-table-column").textContent;
    const prodPopulation = territoryData.productiveTerritoryPop;
    const gold = row.querySelector(".ui-table-column:nth-child(7)").textContent;
    const oilCap = territoryData.oilCapacity;
    let oilDemand;

    let oilDemandStyle;
    if (territoryData.oilDemand > territoryData.oilCapacity) {
        oilDemandStyle = "font-weight: bold; color: rgb(235,0,0);";
    } else {
        oilDemandStyle = "font-weight: bold; color: white;";
    }

    let numberUseableStyleAssault;
    if (territoryData.useableAssault >= territoryData.assaultForCurrentTerritory) {
        numberUseableStyleAssault = "font-weight: bold; color: white;";
    } else {
        numberUseableStyleAssault = "font-weight: bold; color: rgb(235,0,0);";
    }
    let numberUseableStyleAir;
    if (territoryData.useableAir >= territoryData.airForCurrentTerritory) {
        numberUseableStyleAir = "font-weight: bold; color: white;";
    } else {
        numberUseableStyleAir = "font-weight: bold; color: rgb(235,0,0);";
    }
    let numberUseableStyleNaval;
    if (territoryData.useableNaval >= territoryData.navalForCurrentTerritory) {
        numberUseableStyleNaval = "font-weight: bold; color: white;";
    } else {
        numberUseableStyleNaval = "font-weight: bold; color: rgb(235,0,0);";
    }

    let whiteStyle = "font-weight: bold; color: white;";
    let greenStyle = "font-weight: bold; color: rgb(0,235,0);";
    let redStyle = "font-weight: bold; color: rgb(235,0,0);";

    /* let goldNextTurnValue = "font-weight: bold; color: black;"; */

    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === territoryData.uniqueId) {
            oilDemand = mainArrayOfTerritoriesAndResources[i].oilDemand;
        }
    }

    const tooltipContent = `
        <div><span style="color: rgb(235,235,0)">Territory: ${territoryName}</span></div>
        <div>Defense Bonus Multiplier: <span style="${whiteStyle}">x${territoryData.defenseBonus}</span></div>
        <br />
        <div>Productive Population: ${formatNumbersToKMB(prodPopulation)}</div>
        <div>Gold: ${gold}</div>
        <br />
        <div>Oil Capacity: ${Math.ceil(oilCap)}</div>
        <div>Oil Stored: ${Math.ceil(territoryData.oilForCurrentTerritory)}</div>
        <div>Oil Demand:  <span style="${oilDemandStyle}">${Math.ceil(oilDemand)}</span></div>
        <br />
        <div>Infantry: <span style="${whiteStyle}">${territoryData.infantryForCurrentTerritory}</span> </div>
        <div>Assault: <span style="${whiteStyle}">${territoryData.assaultForCurrentTerritory}</span> (<span style="${numberUseableStyleAssault}">${territoryData.useableAssault} useable</span>)</div>
        <div>Air: <span style="${whiteStyle}">${territoryData.airForCurrentTerritory}</span> (<span style="${numberUseableStyleAir}">${territoryData.useableAir} useable</span>)</div>
        <div>Naval: <span style="${whiteStyle}">${territoryData.navalForCurrentTerritory}</span> (<span style="${numberUseableStyleNaval}">${territoryData.useableNaval} useable</span>)</div>
    `;

    // Get the last div in the row
    const lastDiv = row.querySelector(".ui-table-column:last-child img");

    // Check if the mouse is hovering over the last div
    if (event.target === lastDiv) {
        if (currentTurnPhase == 0) {
            tooltip.innerHTML = "Click To Buy Military!";
        } else {
            tooltip.innerHTML = "Wrong Turn Phase To Buy";
        }
    } else {
        // Set the content of the tooltip based on the territory data
        tooltip.innerHTML = tooltipContent;
    }

    //<div>Gold Next Turn: <span style="${goldNextTurnStyle}">${goldNextTurnValue}</span></div>

    const tooltipHeight = tooltip.offsetHeight;
    const verticalThreshold = tooltipHeight + 25;

    if (window.innerHeight - y < verticalThreshold) {

    tooltip.style.left = x - 40 + "px";
    tooltip.style.top = y - tooltipHeight + "px";
    } else {
    tooltip.style.left = x - 40 + "px";
    tooltip.style.top = 25 + y + "px";
    }

    // Show the tooltip
    tooltip.style.display = "block";

    row.style.cursor = "pointer";
}
  
function tooltipUITerritoryRow(row, territoryData, event) {
    // Get the coordinates of the mouse cursor
    const x = event.clientX;
    const y = event.clientY;

    // Set the content of the tooltip based on the territory data
    const territoryName = row.querySelector(".ui-table-column").textContent;
    const army = row.querySelector(".ui-table-column:nth-child(2)").textContent;
    const prodPopulation = territoryData.productiveTerritoryPop;
    const popNextTurnValue = calculatePopulationChange(territoryData);
    const area = row.querySelector(".ui-table-column:nth-child(4)").textContent;
    const gold = row.querySelector(".ui-table-column:nth-child(5)").textContent;
    /* const goldNextTurnValue = Math.ceil(calculateGoldChange(territoryData)); */
    const oilNextTurnValue = Math.ceil(calculateOilChange(territoryData, true));
    const oilCap = territoryData.oilCapacity;
    const foodNextTurnValue = Math.ceil(calculateFoodChange(territoryData, true));
    const foodCap = territoryData.foodCapacity;
    const consMatsNextTurnValue = Math.ceil(calculateConsMatsChange(territoryData, true));
    const consMatsCap = territoryData.consMatsCapacity;
    const foodConsumption = territoryData.foodConsumption;

    /* let goldNextTurnValue = "font-weight: bold; color: black;"; */
    let whiteStyle = "font-weight: bold; color: white;";
    let popNextTurnStyle = "font-weight: bold; color: white;";
    let oilNextTurnStyle = "font-weight: bold; color: white;";
    let foodNextTurnStyle = "font-weight: bold; color: white;";
    let consMatsNextTurnStyle = "font-weight: bold; color: white;";
    let foodCapacityStyle;

    if (popNextTurnValue > 0) {
        popNextTurnStyle = "font-weight: bold; color: rgb(0,235,0);";
    } else if (popNextTurnValue < 0) {
        popNextTurnStyle = "font-weight: bold; color: rgb(235,0,0);";
    }

    /* if (goldNextTurnValue > 0) {
        goldNextTurnStyle = "color: rgb(0,235,0);";
    } else if (goldNextTurnValue < 0) {
        goldNextTurnStyle = "color: rgb(235,160,160);";
    } */

    if (oilNextTurnValue > 0) {
        oilNextTurnStyle = "font-weight: bold; color: rgb(0,235,0);";
    } else if (oilNextTurnValue < 0) {
        oilNextTurnStyle = "font-weight: bold; color: rgb(235,0,0);";
    }

    if (foodNextTurnValue > 0) {
        foodNextTurnStyle = "font-weight: bold; color: rgb(0,235,0);";
    } else if (foodNextTurnValue < 0) {
        foodNextTurnStyle = "font-weight: bold; color: rgb(235,0,0);";
    }

    if (consMatsNextTurnValue > 0) {
        consMatsNextTurnStyle = "font-weight: bold; color: rgb(0,235,0);";
    } else if (consMatsNextTurnValue < 0) {
        consMatsNextTurnStyle = "font-weight: bold; color: rgb(235,0,0);";
    }

    if (foodConsumption > foodCap) {
        foodCapacityStyle = "font-weight: bold; color: rgb(235,0,0);";
    } else if (consMatsNextTurnValue < 0) {
        foodCapacityStyle = "font-weight: bold; color: white;";
    }

    const bonusPercentageFarms = territoryData.farmsBuilt > 0 ? territoryData.farmsBuilt * 10 : 0;
    const bonusPercentageForests = territoryData.forestsBuilt > 0 ? territoryData.forestsBuilt * 10 : 0;
    const bonusPercentageOilWells = territoryData.oilWellsBuilt > 0 ? territoryData.oilWellsBuilt * 10 : 0;
    const bonusPercentageForts = territoryData.fortsBuilt > 0 ? territoryData.fortsBuilt * 10 : 0;

    const tooltipContent = `
        <div><span style="color: rgb(235,235,0)">Territory: ${territoryName}</span></div>
        <div>Army: ${army}</div>
        <div>Defense Bonus Multiplier: <span style="${whiteStyle}">x${territoryData.defenseBonus}</span></div>
        <br />
        <div>Productive Population: ${formatNumbersToKMB(prodPopulation)}</div>
        <div>Population Next Turn: <span style="${popNextTurnStyle}"> ${formatNumbersToKMB(popNextTurnValue)}</div>
        <div>Area: ${area}</div>
        <div>Oil Next Turn: <span style="${oilNextTurnStyle}">${oilNextTurnValue}</span></div>
        <div>Oil Cap: ${Math.ceil(oilCap)}</div>
        <div>Food Next Turn: <span style="${foodNextTurnStyle}">${foodNextTurnValue}</div>
        <div>Food Production Cap: <span style="${foodCapacityStyle}">${formatNumbersToKMB(foodCap)}</span></div>
        <div>Food Consumption: ${formatNumbersToKMB(foodConsumption)}</div>
        <div>Cons. Mats. Next Turn: <span style="${consMatsNextTurnStyle}">${consMatsNextTurnValue}</span></div>
        <div>Cons. Mats. Cap: ${Math.ceil(consMatsCap)}</div>
        <br />
        <div>Farms: <span style="${whiteStyle}">${territoryData.farmsBuilt}</span> (<span style="color: rgb(0,235,0)">+${bonusPercentageFarms}%</span> Food Cap.)</div>
        <div>Forests: <span style="${whiteStyle}">${territoryData.forestsBuilt}</span> (<span style="color: rgb(0,235,0)">+${bonusPercentageForests}%</span> Cons. Mats. Cap.)</div>
        <div>Oil Wells: <span style="${whiteStyle}">${territoryData.oilWellsBuilt}</span> (<span style="color: rgb(0,235,0)">+${bonusPercentageOilWells}%</span> Oil Cap.)</div>
        <div>Forts: <span style="${whiteStyle}">${territoryData.fortsBuilt}</span> (<span style="color: rgb(0,235,0)">+${bonusPercentageForts}%</span> Def. Bonus)</div>
    `;

    // Get the last div in the row
    const lastDiv = row.querySelector(".ui-table-column:last-child img[alt='Upgrade Territory']");

    // Check if the mouse is hovering over the last div
    if (event.target === lastDiv) {
        if (currentTurnPhase == 0) {
            tooltip.innerHTML = "Click To Upgrade!";
        } else {
            tooltip.innerHTML = "Wrong Turn Phase To Upgrade";
        }
    } else {
        // Set the content of the tooltip based on the territory data
        tooltip.innerHTML = tooltipContent;
    }

    //<div>Gold Next Turn: <span style="${goldNextTurnStyle}">${goldNextTurnValue}</span></div>

    const tooltipHeight = tooltip.offsetHeight;
    const verticalThreshold = tooltipHeight + 25;

    if (window.innerHeight - y < verticalThreshold) {

    tooltip.style.left = x - 40 + "px";
    tooltip.style.top = y - tooltipHeight + "px";
    } else {
    tooltip.style.left = x - 40 + "px";
    tooltip.style.top = 25 + y + "px";
    }


    // Show the tooltip
    tooltip.style.display = "block";

    row.style.cursor = "pointer";
}

function colourTableText(table, territory) {
    /* let changeGold = calculateGoldChange(territory); */
    let changeOil = calculateOilChange(territory, true);
    let changeFood = calculateFoodChange(territory, true);
    let changeConsMats = calculateConsMatsChange(territory, true);
    let changePop = calculatePopulationChange(territory);

    /* const goldCell = table.rows[0].cells[3]; */
    const oilCell = table.rows[0].cells[5];
    const foodCell = table.rows[0].cells[7];
    const consMatsCell = table.rows[0].cells[9];
    const popCell = table.rows[0].cells[11];

    /* goldCell.style.color = "white"; */
    popCell.style.color = "white";
    oilCell.style.color = "white";
    foodCell.style.color = "white";
    consMatsCell.style.color = "white";        

    if (table === document.getElementById("bottom-table")) {
        if (changePop < -1) {
            popCell.style.color = "rgb(235,160,160)";
        } else if (changePop > 1) {
            popCell.style.color = "rgb(0,235,0)";
        }
        if (changeOil < -1) {
            oilCell.style.color = "rgb(235,160,160)";
        } else if (changeOil > 1) {
            oilCell.style.color = "rgb(0,235,0)";
        }
        if (changeFood < -1) {
            foodCell.style.color = "rgb(235,160,160)";
        } else if (changeFood > 1) {
            foodCell.style.color = "rgb(0,235,0)";
        }
        if (changeConsMats < -1) {
            consMatsCell.style.color = "rgb(235,160,160)";
        } else if (changeConsMats > 1) {
            consMatsCell.style.color = "rgb(0,235,0)";
        }
    }
}

function calculateAvailablePurchases() {
    const availablePurchases = [];

    const infantryGoldCost = 0;
    const assaultGoldCost = 50;
    const airGoldCost = 100;
    const navalGoldCost = 200;

    const infantryPopCost = 1000;
    const assaultPopCost = 100;
    const airPopCost = 300;
    const navalPopCost = 1000;

    const hasEnoughGoldForInfantry = totalPlayerResources[0].totalGold >= infantryGoldCost;
    const hasEnoughGoldForAssault = totalPlayerResources[0].totalGold >= assaultGoldCost;
    const hasEnoughGoldForAir = totalPlayerResources[0].totalGold >= airGoldCost;
    const hasEnoughGoldForNaval = totalPlayerResources[0].totalGold >= navalGoldCost;

    const hasEnoughProdPopForInfantry = totalPlayerResources[0].totalProdPop >= infantryPopCost;
    const hasEnoughProdPopForAssault = totalPlayerResources[0].totalProdPop >= assaultPopCost;
    const hasEnoughProdPopForAir = totalPlayerResources[0].totalProdPop >= airPopCost;
    const hasEnoughProdPopForNaval = totalPlayerResources[0].totalProdPop >= navalPopCost;

    // Create the upgrade row objects based on the availability and gold/consMats conditions
    if (hasEnoughGoldForInfantry && hasEnoughProdPopForInfantry) {
        availablePurchases.push({
          type: 'Infantry',
          purchaseGoldCost: infantryGoldCost,
          purchasePopCost: infantryPopCost,
          effect: "+1000 Infantry",
          condition: 'Can Build'
        });
      } else if (!hasEnoughGoldForInfantry) {
        availablePurchases.push({
          type: 'Infantry',
          purchaseGoldCost: infantryGoldCost,
          purchasePopCost: infantryPopCost,
          effect: "+1000 Infantry",
          condition: 'Not enough gold'
        });
      } else if (!hasEnoughProdPopForInfantry) {
        availablePurchases.push({
          type: 'Infantry',
          purchaseGoldCost: infantryGoldCost,
          purchasePopCost: infantryPopCost,
          effect: "+1000 Infantry",
          condition: 'Not enough Productive Population'
        });
      }   

      if (hasEnoughGoldForAssault && hasEnoughProdPopForAssault) {
        availablePurchases.push({
          type: 'Assault',
          purchaseGoldCost: assaultGoldCost,
          purchasePopCost: assaultPopCost,
          effect: "+1 Assault",
          condition: 'Can Build'
        });
      } else if (!hasEnoughGoldForAssault) {
        availablePurchases.push({
          type: 'Assault',
          purchaseGoldCost: assaultGoldCost,
          purchasePopCost: assaultPopCost,
          effect: "+1 Assault",
          condition: 'Not enough gold'
        });
      } else if (!hasEnoughProdPopForAssault) {
        availablePurchases.push({
          type: 'Assault',
          purchaseGoldCost: assaultGoldCost,
          purchasePopCost: assaultPopCost,
          effect: "+1 Assault",
          condition: 'Not enough Productive Population'
        });
      }   
    
      if (hasEnoughGoldForAir && hasEnoughProdPopForAir) {
        availablePurchases.push({
          type: 'Air',
          purchaseGoldCost: airGoldCost,
          purchasePopCost: airPopCost,
          effect: "+1 Air",
          condition: 'Can Build'
        });
      } else if (!hasEnoughGoldForAir) {
        availablePurchases.push({
          type: 'Air',
          purchaseGoldCost: airGoldCost,
          purchasePopCost: airPopCost,
          effect: "+1 Air",
          condition: 'Not enough gold'
        });
      } else if (!hasEnoughProdPopForAir) {
        availablePurchases.push({
          type: 'Air',
          purchaseGoldCost: airGoldCost,
          purchasePopCost: airPopCost,
          effect: "+1 Air",
          condition: 'Not enough Productive Population'
        });
      }
    
      if (hasEnoughGoldForNaval && hasEnoughProdPopForNaval) {
        availablePurchases.push({
          type: 'Naval',
          purchaseGoldCost: navalGoldCost,
          purchasePopCost: navalPopCost,
          effect: "+1 Naval",
          condition: 'Can Build'
        });
      } else if (!hasEnoughGoldForNaval) {
        availablePurchases.push({
          type: 'Naval',
          purchaseGoldCost: navalGoldCost,
          purchasePopCost: navalPopCost,
          effect: "+1 Naval",
          condition: 'Not enough gold'
        });
      } else if (!hasEnoughProdPopForNaval) {
        availablePurchases.push({
          type: 'Naval',
          purchaseGoldCost: navalGoldCost,
          purchasePopCost: navalPopCost,
          effect: "+1 Naval",
          condition: 'Not enough Productive Population'
        });
      }
    
      return availablePurchases;
}

function calculateAvailableUpgrades(territory) {
    const availableUpgrades = [];
  
    // Calculate the cost of upgrades
    const farmGoldCost = Math.max(simulatedCostsAll[0], 200 * 1);
    const farmConsMatsCost = Math.max(simulatedCostsAll[1], 500 * 1);
    const forestGoldCost = Math.max(simulatedCostsAll[2], 200 * 1);
    const forestConsMatsCost = Math.max(simulatedCostsAll[3], 500 * 1);
    const oilWellGoldCost = Math.max(simulatedCostsAll[4], 1000 * 1);
    const oilWellConsMatsCost = Math.max(simulatedCostsAll[5], 200 * 1);
    const fortGoldCost = Math.max(simulatedCostsAll[6], 500 * 1);
    const fortConsMatsCost = Math.max(simulatedCostsAll[7], 2000 * 1);

    // Check if the territory has enough gold and consMats for each upgrade
    const hasEnoughGoldForFarm = territory.goldForCurrentTerritory >= farmGoldCost;
    const hasEnoughGoldForForest = territory.goldForCurrentTerritory >= forestGoldCost;
    const hasEnoughGoldForOilWell = territory.goldForCurrentTerritory >= oilWellGoldCost;
    const hasEnoughGoldForFort = territory.goldForCurrentTerritory >= fortGoldCost;
  
    const hasEnoughConsMatsForFarm = territory.consMatsForCurrentTerritory >= farmConsMatsCost;
    const hasEnoughConsMatsForForest = territory.consMatsForCurrentTerritory >= forestConsMatsCost;
    const hasEnoughConsMatsForOilWell = territory.consMatsForCurrentTerritory >= oilWellConsMatsCost;
    const hasEnoughConsMatsForFort = territory.consMatsForCurrentTerritory >= fortConsMatsCost;

    const maxFarms = 5;
    const maxForests = 5;
    const maxOilWells = 5;
    const maxForts = 5;
  
    // Create the upgrade row objects based on the availability and gold/consMats conditions
    if (hasEnoughGoldForFarm && hasEnoughConsMatsForFarm && (territory.farmsBuilt < maxFarms)) {
      availableUpgrades.push({
        type: 'Farm',
        goldCost: farmGoldCost,
        consMatsCost: farmConsMatsCost,
        effect: "Food cap. +10%",
        condition: 'Can Build'
      });
    } else if (!hasEnoughGoldForFarm && (territory.farmsBuilt < maxFarms)) {
      availableUpgrades.push({
        type: 'Farm',
        goldCost: farmGoldCost,
        consMatsCost: farmConsMatsCost,
        effect: "Food cap. +10%",
        condition: 'Not enough gold'
      });
    } else if (!hasEnoughConsMatsForFarm && (territory.farmsBuilt < maxFarms)) {
      availableUpgrades.push({
        type: 'Farm',
        goldCost: farmGoldCost,
        consMatsCost: farmConsMatsCost,
        effect: "Food cap. +10%",
        condition: 'Not enough Cons. Mats.'
      });
    } else {
        availableUpgrades.push({
            type: 'Farm',
            goldCost: farmGoldCost,
            consMatsCost: farmConsMatsCost,
            effect: "Food cap. +10%",
            condition: 'Max Farms Reached'
          });
    }
  
    if (hasEnoughGoldForForest && hasEnoughConsMatsForForest && (territory.forestsBuilt < maxForests)) {
      availableUpgrades.push({
        type: 'Forest',
        goldCost: forestGoldCost,
        consMatsCost: forestConsMatsCost,
        effect: "Cons Mats cap. +10%",
        condition: 'Can Build'
      });
    } else if (!hasEnoughGoldForForest && (territory.forestsBuilt < maxForests)) {
      availableUpgrades.push({
        type: 'Forest',
        goldCost: forestGoldCost,
        consMatsCost: forestConsMatsCost,
        effect: "Cons Mats cap. +10%",
        condition: 'Not enough gold'
      });
    } else if (!hasEnoughConsMatsForForest && (territory.forestsBuilt < maxForests)) {
        availableUpgrades.push({
          type: 'Forest',
          goldCost: forestGoldCost,
          consMatsCost: forestConsMatsCost,
          effect: "Cons Mats cap. +10%",
          condition: 'Not enough Cons. Mats.'
        });
      } else {
          availableUpgrades.push({
              type: 'Forest',
              goldCost: forestGoldCost,
              consMatsCost: forestConsMatsCost,
              effect: "Cons Mats cap. +10%",
              condition: 'Max Forests Reached'
            });
      }
  
    if (hasEnoughGoldForOilWell && hasEnoughConsMatsForOilWell && (territory.oilWellsBuilt < maxOilWells)) {
      availableUpgrades.push({
        type: 'Oil Well',
        goldCost: oilWellGoldCost,
        consMatsCost: oilWellConsMatsCost,
        effect: "Oil cap. +10%",
        condition: 'Can Build'
      });
    } else if (!hasEnoughGoldForOilWell && (territory.oilWellsBuilt < maxOilWells)) {
      availableUpgrades.push({
        type: 'Oil Well',
        goldCost: oilWellGoldCost,
        consMatsCost: oilWellConsMatsCost,
        effect: "Oil cap. +10%",
        condition: 'Not enough gold'
      });
    } else if (!hasEnoughConsMatsForOilWell && (territory.oilWellsBuilt < maxOilWells)) {
      availableUpgrades.push({
        type: 'Oil Well',
        goldCost: oilWellGoldCost,
        consMatsCost: oilWellConsMatsCost,
        effect: "Oil cap. +10%",
        condition: 'Not enough Cons. Mats.'
      });
    } else {
        availableUpgrades.push({
            type: 'Oil Well',
            goldCost: oilWellGoldCost,
            consMatsCost: oilWellConsMatsCost,
            effect: "Oil cap. +10%",
            condition: 'Max Oil Wells Reached'
          });
      }
  
    if (hasEnoughGoldForFort && hasEnoughConsMatsForFort && (territory.fortsBuilt < maxForts)) {
      availableUpgrades.push({
        type: 'Fort',
        goldCost: fortGoldCost,
        consMatsCost: fortConsMatsCost,
        effect: "Defence +10%",
        condition: 'Can Build'
      });
    } else if (!hasEnoughGoldForFort && (territory.fortsBuilt < maxForts)) {
      availableUpgrades.push({
        type: 'Fort',
        goldCost: fortGoldCost,
        consMatsCost: fortConsMatsCost,
        effect: "Defence +10%",
        condition: 'Not enough gold'
      });
    } else if (!hasEnoughConsMatsForFort && (territory.fortsBuilt < maxForts)) {
      availableUpgrades.push({
        type: 'Fort',
        goldCost: fortGoldCost,
        consMatsCost: fortConsMatsCost,
        effect: "Defence +10%",
        condition: 'Not enough Cons. Mats.'
      });
    } else {
        availableUpgrades.push({
        type: 'Fort',
        goldCost: fortGoldCost,
        consMatsCost: fortConsMatsCost,
        effect: "Defence +10%",
        condition: 'Max Forts Reached'
      });
    }
  
    return availableUpgrades;
  }

  function populateBuyTable(territory) {
    //reset confirm button status and totals when opening upgrade window
    document.getElementById("subtitle-buy-window").innerHTML = territory.territoryName;
    document.getElementById("prices-buy-info-column2").innerHTML = "0";
    document.getElementById("prices-buy-info-column4").innerHTML = "0";
    document.getElementById("bottom-bar-buy-confirm-button").innerHTML="Cancel";
    document.getElementById("bottom-bar-buy-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
    document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseover", function() {
        this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
    });
    document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseout", function() {
        this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
    });

    let simulatedPurchaseCosts;
    const buyTable = document.getElementById("buy-table");
    let totalSimulatedPurchaseGoldPrice = 0;
    let totalSimulatedProdPopPrice = 0;
  
    // Calculate available upgrades
    let availablePurchases = calculateAvailablePurchases(territory);
    buyTable.innerHTML = "";
  
    // Populate the table with available upgrade rows
    availablePurchases.forEach((purchaseRow) => {
    const buyRow = document.createElement("div");
    buyRow.classList.add("buy-row");
  
    // Create and populate the image column
    const imageBuyColumn = document.createElement("div");
    imageBuyColumn.classList.add("buy-column");
    let buyImage = document.createElement("img");
    buyImage.src = getImagePath(purchaseRow.type, purchaseRow.condition, territory, 1); // Call a function to get the image path based on the upgrade type
    imageBuyColumn.appendChild(buyImage);
  
    // Create and populate other columns
    const buyColumn1 = document.createElement("div");
    buyColumn1.classList.add("buy-column");
    buyColumn1.textContent = purchaseRow.type;
  
    const buyColumn2 = document.createElement("div");
    buyColumn2.classList.add("buy-column");
    buyColumn2.textContent = purchaseRow.effect;
  
    const buyColumn3 = document.createElement("div");
    buyColumn3.classList.add("buy-column");
    buyColumn3.textContent = 0;

    const buyColumn4 = document.createElement("div");
    buyColumn4.classList.add("buy-column");
    buyColumn4.textContent = 0;

    const buyColumn5 = document.createElement("div");
    buyColumn5.classList.add("buy-column");
    buyColumn5.textContent = "";

    const buyColumn5A = document.createElement("div");
    buyColumn5A.classList.add("buy-column");
    buyColumn5A.classList.add("column5A");
    const buyImageMinus = document.createElement("img");
    if (purchaseRow.condition === "Can Build") {
        buyImageMinus.src = "/resources/minusButton.png";
    } else {
        buyImageMinus.src = "/resources/minusButtonGrey.png";
    }
    buyImageMinus.style.height = "21px";
    buyImageMinus.style.width = "21px";
    buyColumn5A.appendChild(buyImageMinus);

    const buyColumn5Wrapper = document.createElement("div");
    buyColumn5Wrapper.classList.add("buyColumn5-wrapper");

    const buyColumn5B = document.createElement("div");
    buyColumn5B.classList.add("buy-column");
    buyColumn5B.classList.add("buyColumn5B");
    const buyTextfield = document.createElement("input");
    buyTextfield.type = "text";
    buyTextfield.value = "0";
    buyColumn5B.appendChild(buyTextfield);

    const buyColumn5C = document.createElement("div");
    buyColumn5C.classList.add("buy-column");
    buyColumn5C.classList.add("buyColumn5C");
    const buyImagePlus = document.createElement("img");
    if (purchaseRow.condition === "Can Build") {
        buyImagePlus.src = "/resources/plusButton.png";
    } else {
        buyImagePlus.src = "/resources/plusButtonGrey.png";
    }
    buyImagePlus.style.height = "21px";
    buyImagePlus.style.width = "21px";
    buyColumn5C.appendChild(buyImagePlus);

  
    // Add columns to the row
    buyRow.appendChild(imageBuyColumn);
    buyRow.appendChild(buyColumn1);
    buyRow.appendChild(buyColumn2);
    buyRow.appendChild(buyColumn3);
    buyRow.appendChild(buyColumn4);
    buyRow.appendChild(buyColumn5);
    buyColumn5Wrapper.appendChild(buyColumn5B);
    buyColumn5Wrapper.appendChild(buyColumn5C);
    buyColumn5.appendChild(buyColumn5A);
    buyColumn5.appendChild(buyColumn5Wrapper);
  
    buyTable.appendChild(buyRow);

    buyRow.addEventListener("mouseover", (e) => {
        tooltipPurchaseMilitaryRow(territory, availablePurchases, e);
    });
    buyRow.addEventListener("mouseout", () => {
        tooltip.style.display = "none";
        });

    const goldCost = purchaseRow.goldCost || 0;
    const prodPopulationCost = purchaseRow.prodPopulationCost || 0;

    totalPurchaseGoldPrice += goldCost; 
    totalPopulationCost += prodPopulationCost; 

    simulatedPurchaseCosts = incrementDecrementPurchases(buyTextfield, -1, purchaseRow.type, true);

    buyImageMinus.addEventListener("click", (e) => {
        if (buyImageMinus.src.includes("/resources/minusButton.png")) {
            tooltipPurchaseMilitaryRow(territory, availablePurchases, e);
            if (parseInt(buyTextfield.value) > 0) {
                simulatedPurchaseCosts = incrementDecrementPurchases(buyTextfield, -1, purchaseRow.type, false);
                switch (simulatedPurchaseCosts[2]) {
                    case "Infantry":
                      simulatedCostsAllMilitary[0] = simulatedPurchaseCosts[0];
                      simulatedCostsAllMilitary[1] = simulatedPurchaseCosts[1];
                      break;
                    case "Assault":
                      simulatedCostsAllMilitary[2] = simulatedPurchaseCosts[0];
                      simulatedCostsAllMilitary[3] = simulatedPurchaseCosts[1];
                      break;
                    case "Air":
                      simulatedCostsAllMilitary[4] = simulatedPurchaseCosts[0];
                      simulatedCostsAllMilitary[5] = simulatedPurchaseCosts[1];
                      break;
                    case "Naval":
                      simulatedCostsAllMilitary[6] = simulatedPurchaseCosts[0];
                      simulatedCostsAllMilitary[7] = simulatedPurchaseCosts[1];
                      break;
                  }

                totalPurchaseGoldPrice = calculateTotalPurchaseGoldPrice(buyTable);
                totalPopulationCost = calculateTotalPopulationCost(buyTable);

                document.getElementById("prices-buy-info-column2").innerHTML = totalPurchaseGoldPrice;
                document.getElementById("prices-buy-info-column4").innerHTML = totalPopulationCost;

                //code to check greying out here
                checkPurchaseRowsForGreyingOut(totalPurchaseGoldPrice, totalPopulationCost, simulatedCostsAllMilitary, buyTable, "minus");

                if (atLeastOneRowWithValueGreaterThanOneForPurchases(buyTable)) {
                    document.getElementById("bottom-bar-buy-confirm-button").style.backgroundColor = "rgba(0, 128, 0, 0.8)";
                    document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseover", function() {
                        this.style.backgroundColor = "rgba(0, 158, 0, 0.8)";
                    });
                    document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseout", function() {
                        this.style.backgroundColor = "rgba(0, 128, 0, 0.8)";
                    });
                } else if (allRowsWithValueZeroForPurchases(buyTable)) {
                    document.getElementById("bottom-bar-buy-confirm-button").innerHTML="Cancel";
                    document.getElementById("bottom-bar-buy-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
                    document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseover", function() {
                        this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
                    });
                    document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseout", function() {
                        this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
                    });
                } 
            }
        }
    });
  
    buyImagePlus.addEventListener("click", (e) => {
        if (buyImagePlus.src.includes("/resources/plusButton.png")) {
            tooltipPurchaseMilitaryRow(territory, availablePurchases, e);
          simulatedPurchaseCosts = incrementDecrementPurchases(buyTextfield, 1, purchaseRow.type, false);
          switch (simulatedPurchaseCosts[2]) {
            case "Infantry":
              simulatedCostsAllMilitary[0] = simulatedPurchaseCosts[0];
              simulatedCostsAllMilitary[1] = simulatedPurchaseCosts[1];
              break;
            case "Assault":
              simulatedCostsAllMilitary[2] = simulatedPurchaseCosts[0];
              simulatedCostsAllMilitary[3] = simulatedPurchaseCosts[1];
              break;
            case "Air":
              simulatedCostsAllMilitary[4] = simulatedPurchaseCosts[0];
              simulatedCostsAllMilitary[5] = simulatedPurchaseCosts[1];
              break;
            case "Naval":
              simulatedCostsAllMilitary[6] = simulatedPurchaseCosts[0];
              simulatedCostsAllMilitary[7] = simulatedPurchaseCosts[1];
              break;
          }

        totalPurchaseGoldPrice = calculateTotalPurchaseGoldPrice(buyTable);
        totalPopulationCost = calculateTotalPopulationCost(buyTable);

        document.getElementById("prices-buy-info-column2").innerHTML = totalPurchaseGoldPrice;
        document.getElementById("prices-buy-info-column4").innerHTML = totalPopulationCost;

        totalSimulatedPurchaseGoldPrice = simulatedCostsAllMilitary[0] + simulatedCostsAllMilitary[2] + simulatedCostsAllMilitary[4] + simulatedCostsAllMilitary[6];
        totalSimulatedProdPopPrice = simulatedCostsAllMilitary[1] + simulatedCostsAllMilitary[3] + simulatedCostsAllMilitary[5] + simulatedCostsAllMilitary[7];

        console.log(simulatedCostsAllMilitary);
        console.log("Total Gold Price:", totalPurchaseGoldPrice);
        console.log("Total Population Cost:", totalPopulationCost);
        console.log("Total SimGold Price:", totalSimulatedPurchaseGoldPrice);
        console.log("Total SimProdPop:", totalSimulatedProdPopPrice);

        //code to check greying out here
        checkPurchaseRowsForGreyingOut(totalPurchaseGoldPrice, totalPopulationCost, simulatedCostsAllMilitary, buyTable, "plus");

        if (atLeastOneRowWithValueGreaterThanOneForPurchases(buyTable)) {
            document.getElementById("bottom-bar-buy-confirm-button").innerHTML="Confirm";
            document.getElementById("bottom-bar-buy-confirm-button").style.backgroundColor = "rgba(0, 128, 0, 0.8)";
            document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseover", function() {
                this.style.backgroundColor = "rgba(0, 158, 0, 0.8)";
            });
            document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseout", function() {
                this.style.backgroundColor = "rgba(0, 128, 0, 0.8)";
            });
        } else if (allRowsWithValueZeroForPurchases(buyTable)) {
            document.getElementById("bottom-bar-buy-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
            document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseover", function() {
                this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
            });
            document.getElementById("bottom-bar-buy-confirm-button").addEventListener("mouseout", function() {
                this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
            });
        }                       
        }
      });
  });
  }
  
  function populateUpgradeTable(territory) {
    //reset confirm button status and totals when opening upgrade window
    document.getElementById("subtitle-upgrade-window").innerHTML = territory.territoryName;
    document.getElementById("prices-info-column2").innerHTML = "0";
    document.getElementById("prices-info-column4").innerHTML = "0";
    document.getElementById("bottom-bar-confirm-button").innerHTML="Cancel";
    document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
        this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
    });
    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
        this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
    });

    let simulatedCosts;
    const upgradeTable = document.getElementById("upgrade-table");
    let totalSimulatedGoldPrice = 0;
    let totalSimulatedConsMatsPrice = 0;
  
    // Calculate available upgrades
    const availableUpgrades = calculateAvailableUpgrades(territory);
    upgradeTable.innerHTML = "";
  
    // Populate the table with available upgrade rows
    availableUpgrades.forEach((upgradeRow) => {
    const row = document.createElement("div");
    row.classList.add("upgrade-row");
  
    // Create and populate the image column
    const imageColumn = document.createElement("div");
    imageColumn.classList.add("upgrade-column");
    let image = document.createElement("img");
    image.src = getImagePath(upgradeRow.type, upgradeRow.condition, territory, 0); // Call a function to get the image path based on the upgrade type
    imageColumn.appendChild(image);
  
    // Create and populate other columns
    const column1 = document.createElement("div");
    column1.classList.add("upgrade-column");
    column1.textContent = upgradeRow.type;
  
    const column2 = document.createElement("div");
    column2.classList.add("upgrade-column");
    column2.textContent = upgradeRow.effect;
  
    const column3 = document.createElement("div");
    column3.classList.add("upgrade-column");
    column3.textContent = 0;
    const column4 = document.createElement("div");
    column4.classList.add("upgrade-column");
    column4.textContent = 0;

    const column5 = document.createElement("div");
    column5.classList.add("upgrade-column");
    column5.textContent = "";

    const column5A = document.createElement("div");
    column5A.classList.add("upgrade-column");
    column5A.classList.add("column5A");
    const imageMinus = document.createElement("img");
    if (upgradeRow.condition === "Can Build") {
        imageMinus.src = "/resources/minusButton.png";
    } else {
        imageMinus.src = "/resources/minusButtonGrey.png";
    }
    imageMinus.style.height = "21px";
    imageMinus.style.width = "21px";
    column5A.appendChild(imageMinus);

    const column5Wrapper = document.createElement("div");
    column5Wrapper.classList.add("column5-wrapper");

    const column5B = document.createElement("div");
    column5B.classList.add("upgrade-column");
    column5B.classList.add("column5B");
    const textField = document.createElement("input");
    textField.type = "text";
    textField.value = "0";
    column5B.appendChild(textField);

    const column5C = document.createElement("div");
    column5C.classList.add("upgrade-column");
    column5C.classList.add("column5C");
    const imagePlus = document.createElement("img");
    if (upgradeRow.condition === "Can Build") {
        imagePlus.src = "/resources/plusButton.png";
    } else {
        imagePlus.src = "/resources/plusButtonGrey.png";
    }
    imagePlus.style.height = "21px";
    imagePlus.style.width = "21px";
    column5C.appendChild(imagePlus);

  
    // Add columns to the row
    row.appendChild(imageColumn);
    row.appendChild(column1);
    row.appendChild(column2);
    row.appendChild(column3);
    row.appendChild(column4);
    row.appendChild(column5);
    column5Wrapper.appendChild(column5B);
    column5Wrapper.appendChild(column5C);
    column5.appendChild(column5A);
    column5.appendChild(column5Wrapper);
  
    upgradeTable.appendChild(row);

    row.addEventListener("mouseover", (e) => {
        tooltipUpgradeTerritoryRow(territory, availableUpgrades, e);
    });
    row.addEventListener("mouseout", () => {
        tooltip.style.display = "none";
        });

    const goldCost = upgradeRow.goldCost || 0;
    const consMatsCost = upgradeRow.consMatsCost || 0;

    totalGoldPrice += goldCost; 
    totalConsMats += consMatsCost; 

    simulatedCosts = incrementDecrementUpgrades(textField, -1, upgradeRow.type, territory, true);

    switch (simulatedCosts[2]) {
        case "Farm":
          simulatedCostsAll[0] = simulatedCosts[0];
          simulatedCostsAll[1] = simulatedCosts[1];
          break;
        case "Forest":
          simulatedCostsAll[2] = simulatedCosts[0];
          simulatedCostsAll[3] = simulatedCosts[1];
          break;
        case "Oil Well":
          simulatedCostsAll[4] = simulatedCosts[0];
          simulatedCostsAll[5] = simulatedCosts[1];
          break;
        case "Fort":
          simulatedCostsAll[6] = simulatedCosts[0];
          simulatedCostsAll[7] = simulatedCosts[1];
          break;
      }

    imageMinus.addEventListener("click", (e) => {
        if (imageMinus.src.includes("/resources/minusButton.png")) {
            tooltipUpgradeTerritoryRow(territory, availableUpgrades, e);
            if (parseInt(textField.value) > 0) {
                simulatedCosts = incrementDecrementUpgrades(textField, -1, upgradeRow.type, territory, false);
                switch (simulatedCosts[2]) {
                    case "Farm":
                      simulatedCostsAll[0] = simulatedCosts[0];
                      simulatedCostsAll[1] = simulatedCosts[1];
                      break;
                    case "Forest":
                      simulatedCostsAll[2] = simulatedCosts[0];
                      simulatedCostsAll[3] = simulatedCosts[1];
                      break;
                    case "Oil Well":
                      simulatedCostsAll[4] = simulatedCosts[0];
                      simulatedCostsAll[5] = simulatedCosts[1];
                      break;
                    case "Fort":
                      simulatedCostsAll[6] = simulatedCosts[0];
                      simulatedCostsAll[7] = simulatedCosts[1];
                      break;
                  }

                totalGoldPrice = calculateTotalGoldPrice(upgradeTable);
                totalConsMats = calculateTotalConsMats(upgradeTable);

                document.getElementById("prices-info-column2").innerHTML = totalGoldPrice;
                document.getElementById("prices-info-column4").innerHTML = totalConsMats;

                //code to check greying out here
                checkUpgradeRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, "minus", upgradeRow.type);

                if (atLeastOneRowWithValueGreaterThanOneForUpgrades(upgradeTable)) {
                    document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(0, 128, 0, 0.8)";
                    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
                        this.style.backgroundColor = "rgba(0, 158, 0, 0.8)";
                    });
                    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
                        this.style.backgroundColor = "rgba(0, 128, 0, 0.8)";
                    });
                } else if (allRowsWithValueZeroForUpgrades(upgradeTable)) {
                    document.getElementById("bottom-bar-confirm-button").innerHTML="Cancel";
                    document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
                    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
                        this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
                    });
                    document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
                        this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
                    });
                } 
            }
        }
    });
  
    imagePlus.addEventListener("click", (e) => {
        if (imagePlus.src.includes("/resources/plusButton.png")) {
          tooltipUpgradeTerritoryRow(territory, availableUpgrades, e);
          simulatedCosts = incrementDecrementUpgrades(textField, 1, upgradeRow.type, territory, false);
          switch (simulatedCosts[2]) {
            case "Farm":
              simulatedCostsAll[0] = simulatedCosts[0];
              simulatedCostsAll[1] = simulatedCosts[1];
              break;
            case "Forest":
              simulatedCostsAll[2] = simulatedCosts[0];
              simulatedCostsAll[3] = simulatedCosts[1];
              break;
            case "Oil Well":
              simulatedCostsAll[4] = simulatedCosts[0];
              simulatedCostsAll[5] = simulatedCosts[1];
              break;
            case "Fort":
              simulatedCostsAll[6] = simulatedCosts[0];
              simulatedCostsAll[7] = simulatedCosts[1];
              break;
          }

        totalGoldPrice = calculateTotalGoldPrice(upgradeTable);
        totalConsMats = calculateTotalConsMats(upgradeTable);

        document.getElementById("prices-info-column2").innerHTML = totalGoldPrice;
        document.getElementById("prices-info-column4").innerHTML = totalConsMats;

        totalSimulatedGoldPrice = simulatedCostsAll[0] + simulatedCostsAll[2] + simulatedCostsAll[4] + simulatedCostsAll[6];
        totalSimulatedConsMatsPrice = simulatedCostsAll[1] + simulatedCostsAll[3] + simulatedCostsAll[5] + simulatedCostsAll[7];

        /* console.log(simulatedCostsAll);
        console.log("Total Gold Price:", totalGoldPrice);
        console.log("Total ConsMats:", totalConsMats);
        console.log("Total SimGold Price:", totalSimulatedGoldPrice);
        console.log("Total SimConsMats:", totalSimulatedConsMatsPrice); */

        //code to check greying out here
        checkUpgradeRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, "plus", upgradeRow.type);

        if (atLeastOneRowWithValueGreaterThanOneForUpgrades(upgradeTable)) {
            document.getElementById("bottom-bar-confirm-button").innerHTML="Confirm";
            document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(0, 128, 0, 0.8)";
            document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
                this.style.backgroundColor = "rgba(0, 158, 0, 0.8)";
            });
            document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
                this.style.backgroundColor = "rgba(0, 128, 0, 0.8)";
            });
        } else if (allRowsWithValueZeroForUpgrades(upgradeTable)) {
            document.getElementById("bottom-bar-confirm-button").style.backgroundColor = "rgba(54, 93, 125, 0.8)";
            document.getElementById("bottom-bar-confirm-button").addEventListener("mouseover", function() {
                this.style.backgroundColor = "rgba(84, 123, 155, 0.8)";
            });
            document.getElementById("bottom-bar-confirm-button").addEventListener("mouseout", function() {
                this.style.backgroundColor = "rgba(54, 93, 125, 0.8)";
            });
        }                       
        }
      });
  });
  }

  function incrementDecrementPurchases(buyTextField, increment, purchaseType, simOnly) {
    let currentValueQuantity = parseInt(buyTextField.value);
    currentValueQuantity += increment;
  
    if (currentValueQuantity < 0) {
      currentValueQuantity = 0;
    }

    if (!simOnly) {
        buyTextField.value = currentValueQuantity.toString();
    }
  
    let currentValueQuantityTemp = currentValueQuantity;
  
    const buyRow = buyTextField.parentNode.parentNode.parentNode.parentNode;
    const goldCostElement = buyRow.querySelector(".buy-column:nth-child(4)");
    const prodPopCostElement = buyRow.querySelector(".buy-column:nth-child(5)");
  
    let purchaseGoldCost;
    let purchaseGoldBaseCost;
    let prodPopCost;
    let prodPopBaseCost;
  
    let simulationPurchaseCosts = []; // Array to store simulated costs
  
    switch (purchaseType) {
      case "Infantry":
        purchaseGoldCost = 0;
        purchaseGoldBaseCost = 0;
        prodPopCost = 1000 * currentValueQuantityTemp;
        prodPopBaseCost = 1000;
        break;
      case "Assault":
        purchaseGoldCost = 50 * currentValueQuantityTemp;
        purchaseGoldBaseCost = 50;
        prodPopCost = 100 * currentValueQuantityTemp;
        prodPopBaseCost = 100;
        break;
      case "Air":
        purchaseGoldCost = 100 * currentValueQuantityTemp;
        purchaseGoldBaseCost = 100;
        prodPopCost = 300 * currentValueQuantityTemp;
        prodPopBaseCost = 300;
        break;
      case "Naval":
        purchaseGoldCost = 200 * currentValueQuantityTemp;
        purchaseGoldBaseCost = 200;
        prodPopCost = 1000 * currentValueQuantityTemp;
        prodPopBaseCost = 1000;
        break;
    }
  
    if (currentValueQuantity === 0) {
        purchaseGoldCost = 0;
        prodPopCost = 0;
    }
  
    if (!simOnly) {
        goldCostElement.textContent = purchaseGoldCost;
        prodPopCostElement.textContent = prodPopCost;
    }
    
      // Simulate next increment and store costs in array
      currentValueQuantityTemp += Math.abs(increment);
      const simulatedPurchaseGoldCost = purchaseGoldCost + purchaseGoldBaseCost;
      const simulatedProdPopCost = prodPopCost + prodPopBaseCost;
      const simulatedPurchaseType = purchaseType;
      simulationPurchaseCosts.push(simulatedPurchaseGoldCost);
      simulationPurchaseCosts.push(simulatedProdPopCost);
      simulationPurchaseCosts.push(simulatedPurchaseType); // Include the purchase type in the array

      return simulationPurchaseCosts;
  }

  function incrementDecrementUpgrades(textField, increment, upgradeType, territory, simOnly) {
    let currentValueQuantity = parseInt(textField.value);
    currentValueQuantity += increment;
  
    if (currentValueQuantity < 0) {
      currentValueQuantity = 0;
    }

    if (!simOnly) {
        textField.value = currentValueQuantity.toString();
    }
  
    let currentValueQuantityTemp = currentValueQuantity;
  
    // Update gold and consMats costs based on upgrade type and number of upgrades already built
    const upgradeRow = textField.parentNode.parentNode.parentNode.parentNode;
    const goldCostElement = upgradeRow.querySelector(".upgrade-column:nth-child(4)");
    const consMatsCostElement = upgradeRow.querySelector(".upgrade-column:nth-child(5)");
  
    let goldBaseCost;
    let consMatsBaseCost;
  
    let farmsBuilt = territory.farmsBuilt;
    let forestsBuilt = territory.forestsBuilt;
    let oilWellsBuilt = territory.oilWellsBuilt;
    let fortsBuilt = territory.fortsBuilt;
  
    let goldCost;
    let consMatsCost;
    let simulationCosts = []; // Array to store simulated costs
  
    switch (upgradeType) {
      case "Farm":
        currentValueQuantityTemp += farmsBuilt;
        goldBaseCost = 200;
        consMatsBaseCost = 500;
        farmsBuilt += increment;
        goldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
        consMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.1)) * (territory.devIndex / 4));
        break;
      case "Forest":
        currentValueQuantityTemp += forestsBuilt;
        goldBaseCost = 200;
        consMatsBaseCost = 500;
        forestsBuilt += increment;
        goldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
        consMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
        break;
      case "Oil Well":
        currentValueQuantityTemp += oilWellsBuilt;
        goldBaseCost = 1000;
        consMatsBaseCost = 200;
        oilWellsBuilt += increment;
        goldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
        consMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
        break;
      case "Fort":
        currentValueQuantityTemp += fortsBuilt;
        goldBaseCost = 500;
        consMatsBaseCost = 2000;
        fortsBuilt += increment;
        goldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
        consMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
        break;
    }
  
    if (currentValueQuantity === 0) {
      goldCost = 0;
      consMatsCost = 0;
    }
  
    if (!simOnly) {
        goldCostElement.textContent = goldCost;
        consMatsCostElement.textContent = consMatsCost;
    }
    
      // Simulate next increment and store costs in array
      currentValueQuantityTemp += Math.abs(increment); //always simulate clicking plus i.e. upward direction
      const simulatedGoldCost = Math.ceil((goldBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
      const simulatedConsMatsCost = Math.ceil((consMatsBaseCost * currentValueQuantityTemp * (currentValueQuantityTemp * 1.05)) * (territory.devIndex / 4));
      const simulatedUpgradeType = upgradeType;
      simulationCosts.push(simulatedGoldCost);
      simulationCosts.push(simulatedConsMatsCost);
      simulationCosts.push(simulatedUpgradeType); // Include the upgrade type in the array

      return simulationCosts;
  }

  function getImagePath(type, condition, territory, mode) {
    if (mode === 0) { //upgrade images
        const maxFarms = 5;
        const maxForests = 5;
        const maxOilWells = 5;
        const maxForts = 5;

        if (type === "Farm") {
            if (condition === "Can Build" && territory.farmsBuilt < maxFarms) {
                return '/resources/farmIcon.png';
            } else {
                return '/resources/farmIconGrey.png';
            }
        } else if (type === "Oil Well") {
            if (condition === "Can Build" && territory.oilWellsBuilt < maxOilWells) {
                return '/resources/oilWellIcon.png';
            } else {
                return '/resources/oilWellIconGrey.png';
            }
        } else if (type === "Forest") {
            if (condition === "Can Build" && territory.forestsBuilt < maxForests) {
                return '/resources/forestIcon.png';
            } else {
                return '/resources/forestIconGrey.png';
            }
        } else if (type === "Fort") {
            if (condition === "Can Build" && territory.fortsBuilt < maxForts) {
                return '/resources/fortIcon.png';
            } else {
                return '/resources/fortIconGrey.png';
            }
        }
    } else if (mode === 1) { //buy military images
        if (type === "Infantry") {
            if (condition === "Can Build") {
                return '/resources/infantryIcon.png';
            } else {
                return '/resources/infantryIconGrey.png';
            }
        } 
        if (type === "Assault") {
            if (condition === "Can Build") {
                return '/resources/assaultIcon.png';
            } else {
                return '/resources/assaultIconGrey.png';
            }
        } else if (type === "Air") {
            if (condition === "Can Build") {
                return '/resources/airIcon.png';
            } else {
                return '/resources/airIconGrey.png';
            }
        } else if (type === "Naval") {
            if (condition === "Can Build") {
                return '/resources/navalIcon.png';
            } else {
                return '/resources/navalIconGrey.png';
            }
        }
    }
  }

  
  // Function to calculate the total gold price for all rows
  function calculateTotalGoldPrice(upgradeTable) {
    let totalGold = 0;
    const goldElements = upgradeTable.querySelectorAll(".upgrade-column:nth-child(4)");
    goldElements.forEach((goldElement) => {
      const goldCost = parseInt(goldElement.textContent) || 0;
      totalGold += goldCost;
    });
    return totalGold;
  }

  function calculateTotalPurchaseGoldPrice(buyTable) {
    let totalGold = 0;
    const goldElements = buyTable.querySelectorAll(".buy-column:nth-child(4)");
    goldElements.forEach((goldElement) => {
      const goldCost = parseInt(goldElement.textContent) || 0;
      totalGold += goldCost;
    });
    return totalGold;
  }

  function calculateTotalPopulationCost(buyTable) {
    let totalProdPop = 0;
    const prodPopElements = buyTable.querySelectorAll(".buy-column:nth-child(5)");
    prodPopElements.forEach((prodPopElement) => {
      const prodPopCost = parseInt(prodPopElement.textContent) || 0;
      totalProdPop += prodPopCost;
    });
    return totalProdPop;
  }

  // Function to calculate the total consMats for all rows
  function calculateTotalConsMats(upgradeTable) {
    let totalConsMats = 0;
    const consMatsElements = upgradeTable.querySelectorAll(".upgrade-column:nth-child(5)");
    consMatsElements.forEach((consMatsElement) => {
      const consMatsCost = parseInt(consMatsElement.textContent) || 0;
      totalConsMats += consMatsCost;
    });
    return totalConsMats;
  }

  function checkPurchaseRowsForGreyingOut(totalGoldPrice, totalProdPopCost, simulatedCostsAllMilitary, buyTable, button) {

    const simulatedgoldElements = [simulatedCostsAllMilitary[0], simulatedCostsAllMilitary[2], simulatedCostsAllMilitary[4], simulatedCostsAllMilitary[6]];
    const simulatedProdPopElements = [simulatedCostsAllMilitary[1], simulatedCostsAllMilitary[3], simulatedCostsAllMilitary[5], simulatedCostsAllMilitary[7]];

    let amountToAdd;
    let popAmountToAdd;
  
    if (button === "plus") {
      simulatedgoldElements.forEach((simulatedGoldElement, index) => {

        switch(index) {
            case 0:
                amountToAdd = 0;
                break;
            case 1:
                amountToAdd = 50;
                break;
            case 2:
                amountToAdd = 100;
                break;
            case 3:
                amountToAdd = 200;
                break;
        }

        if (Math.ceil(totalPlayerResources[0].totalGold) < totalGoldPrice + amountToAdd) {
            const buyRowIndex = index + 1;
            const buyRow = buyTable.querySelector(`.buy-row:nth-child(${buyRowIndex})`);
          
            // Get the image element in the first column
            const imageElement = buyRow.querySelector('.buy-column:first-child img');
            if (imageElement) {
                if (!imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                }
            }
          
            // Get the plus button image in the fifth column
            const plusButton = buyRow.querySelector('.buyColumn5C img');
            if (plusButton) {
              if (!plusButton.src.includes('Grey.png')) {
                plusButton.src = plusButton.src.replace('.png', 'Grey.png');
              }
            }
          }
      });
      simulatedProdPopElements.forEach((simulatedProdPopElement, index) => {

        switch(index) {
            case 0:
                popAmountToAdd = 1000;
                break;
            case 1:
                popAmountToAdd = 100;
                break;
            case 2:
                popAmountToAdd = 300;
                break;
            case 3:
                popAmountToAdd = 1000;
                break;
        }

        if (Math.ceil(totalPlayerResources[0].totalProdPop) < totalProdPopCost + amountToAdd) {
            const buyRowIndex = index + 1;
            const buyRow = buyTable.querySelector(`.buy-row:nth-child(${buyRowIndex})`);
          
            // Get the image element in the first column
            const imageElement = buyRow.querySelector('.buy-column:first-child img');
            if (imageElement) {
                if (!imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                }
            }
            // Get the plus button image in the fifth column
            const plusButton = buyRow.querySelector('.buyColumn5C img');
            if (plusButton) {
              // Update the plus button source
              if (!plusButton.src.includes('Grey.png')) {
                plusButton.src = plusButton.src.replace('.png', 'Grey.png');
              }
            }
          }     
      });
    } else if (button === "minus") {
        simulatedgoldElements.forEach((simulatedGoldElement, index) => {

            switch(index) {
                case 0:
                    amountToAdd = 0;
                    popAmountToAdd = 1000;
                    break;
                case 1:
                    amountToAdd = 50;
                    popAmountToAdd = 100;
                    break;
                case 2:
                    amountToAdd = 100;
                    popAmountToAdd = 300;
                    break;
                case 3:
                    amountToAdd = 200;
                    popAmountToAdd = 1000;
                    break;
            }

            const buyRowIndex = index + 1;
            const buyRow = buyTable.querySelector(`.buy-row:nth-child(${buyRowIndex})`);
           
            // Get the image element in the first column
            const imageElement = buyRow.querySelector('.buy-column:first-child img');
    
            // Get the plus button image in the fifth column
            const plusButton = buyRow.querySelector('.buyColumn5C img');
    
            if (
                Math.ceil(totalPlayerResources[0].totalGold) >= totalGoldPrice + amountToAdd &&
                Math.ceil(totalPlayerResources[0].totalProdPop) >= totalProdPopCost + amountToAdd
            ) {
                
                // All conditions are true, ungrey the row
                if (imageElement && imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('Grey.png', '.png');
                }
                if (plusButton && plusButton.src.includes('Grey.png')) {
                    plusButton.src = plusButton.src.replace('Grey.png', '.png');
                }
            }
        });
    }   
  }

  function checkUpgradeRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, button, type) {
    const simulatedgoldElements = [simulatedCostsAll[0], simulatedCostsAll[2], simulatedCostsAll[4], simulatedCostsAll[6]];
    const simulatedConsMatsElements = [simulatedCostsAll[1], simulatedCostsAll[3], simulatedCostsAll[5], simulatedCostsAll[7]];
  
    if (button === "plus") {
      simulatedgoldElements.forEach((simulatedGoldElement, index) => {
        if (territory.goldForCurrentTerritory - totalGoldPrice < simulatedGoldElement) {
            const rowIndex = index + 1;
            const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);
          
            // Get the image element in the first column
            const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
            if (imageElement) {
                if (!imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                }
            }
          
            // Get the plus button image in the fifth column
            const plusButton = upgradeRow.querySelector('.column5C img');
            if (plusButton) {
              if (!plusButton.src.includes('Grey.png')) {
                plusButton.src = plusButton.src.replace('.png', 'Grey.png');
              }
            }
          }     
      });
      simulatedConsMatsElements.forEach((simulatedConsMatsElement, index) => {
        if (territory.consMatsForCurrentTerritory - totalConsMats < simulatedConsMatsElement) {
            const rowIndex = index + 1;
            const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);
          
            // Get the image element in the first column
            const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
            if (imageElement) {
                if (!imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                }
            }
            // Get the plus button image in the fifth column
            const plusButton = upgradeRow.querySelector('.column5C img');
            if (plusButton) {
              // Update the plus button source
              if (!plusButton.src.includes('Grey.png')) {
                plusButton.src = plusButton.src.replace('.png', 'Grey.png');
              }
            }
          }     
      });
      if (type === "Farm") {
        if (parseInt(upgradeTable.querySelector(`.upgrade-row:nth-child(1) .column5B input`).value) + territory.farmsBuilt >= 5) {
          var firstRowImage = upgradeTable.querySelector(`.upgrade-row:nth-child(1) img`);
          if (!firstRowImage.src.includes('Grey.png')) {
            firstRowImage.src = firstRowImage.src.replace('.png', 'Grey.png');
          }
      
          var column5CImage = upgradeTable.querySelector(`.upgrade-row:nth-child(1) .column5C img`);
          if (!column5CImage.src.includes('Grey.png')) {
            column5CImage.src = column5CImage.src.replace('.png', 'Grey.png');
          }
        }
      } else if (type === "Forest") {
        if (parseInt(upgradeTable.querySelector(`.upgrade-row:nth-child(2) .column5B input`).value) + territory.forestsBuilt >= 5) {
            var firstRowImage = upgradeTable.querySelector(`.upgrade-row:nth-child(2) img`);
            if (!firstRowImage.src.includes('Grey.png')) {
                firstRowImage.src = firstRowImage.src.replace('.png', 'Grey.png');
            }
            var column5CImage = upgradeTable.querySelector(`.upgrade-row:nth-child(2) .column5C img`);
            if (!column5CImage.src.includes('Grey.png')) {
                column5CImage.src = column5CImage.src.replace('.png', 'Grey.png');
            } 
        }
      } else if (type === "Oil Well") {
        if (parseInt(upgradeTable.querySelector(`.upgrade-row:nth-child(3) .column5B input`).value) + territory.oilWellsBuilt >= 5) {
            var firstRowImage = upgradeTable.querySelector(`.upgrade-row:nth-child(3) img`);
            if (!firstRowImage.src.includes('Grey.png')) {
                firstRowImage.src = firstRowImage.src.replace('.png', 'Grey.png');
            }
            var column5CImage = upgradeTable.querySelector(`.upgrade-row:nth-child(3) .column5C img`);
            if (!column5CImage.src.includes('Grey.png')) {
                column5CImage.src = column5CImage.src.replace('.png', 'Grey.png');
            } 
        }
      } else if (type === "Fort") {
        if (parseInt(upgradeTable.querySelector(`.upgrade-row:nth-child(4) .column5B input`).value) + territory.fortsBuilt >= 5) {
            var firstRowImage = upgradeTable.querySelector(`.upgrade-row:nth-child(4) img`);
            if (!firstRowImage.src.includes('Grey.png')) {
                firstRowImage.src = firstRowImage.src.replace('.png', 'Grey.png');
            }
            var column5CImage = upgradeTable.querySelector(`.upgrade-row:nth-child(4) .column5C img`);  
            if (!column5CImage.src.includes('Grey.png')) {
                column5CImage.src = column5CImage.src.replace('.png', 'Grey.png');
            } 
        }
      }
    } else if (button === "minus") {
        simulatedgoldElements.forEach((simulatedGoldElement, index) => {
            const rowIndex = index + 1;
            const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);
            const upgradeRowTextField = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex}) .column5B input`);
            const upgradeRowType = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex}) .upgrade-column:nth-child(2)`);
    
            // Get the image element in the first column
            const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
    
            // Get the plus button image in the fifth column
            const plusButton = upgradeRow.querySelector('.column5C img');
    
            const simulatedConsMatsElement = simulatedConsMatsElements[index];

            let amountBuilt;

            if (upgradeRowType.innerHTML === "Farm") {
                amountBuilt = territory.farmsBuilt;
              } else if (upgradeRowType.innerHTML === "Forest") {
                amountBuilt = territory.forestsBuilt;
              } else if (upgradeRowType.innerHTML === "Oil Well") {
                amountBuilt = territory.oilWellsBuilt;
              } else if (upgradeRowType.innerHTML === "Fort") {
                amountBuilt = territory.fortsBuilt;
              }
    
            if (
                parseInt(upgradeRowTextField.value) < 5 &&
                amountBuilt < 5 &&
                territory.goldForCurrentTerritory - totalGoldPrice >= simulatedGoldElement &&
                territory.consMatsForCurrentTerritory - totalConsMats >= simulatedConsMatsElement
            ) {
                
                // All conditions are true, ungrey the row
                if (imageElement && imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('Grey.png', '.png');
                }
                if (plusButton && plusButton.src.includes('Grey.png')) {
                    plusButton.src = plusButton.src.replace('Grey.png', '.png');
                }
            }
        });
    }   
  }

  // Function to check if at least one row has a textField value greater than 1
  function atLeastOneRowWithValueGreaterThanOneForUpgrades(upgradeTable) {
    const rows = upgradeTable.getElementsByClassName("upgrade-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".column5B input");
        if (parseInt(textField.value) >= 1) {
            return true;
        }
    }
    return false;
}

function atLeastOneRowWithValueGreaterThanOneForPurchases(buyTable) {
    const rows = buyTable.getElementsByClassName("buy-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".buyColumn5B input");
        if (parseInt(textField.value) >= 1) {
            return true;
        }
    }
    return false;
}

function allRowsWithValueZeroForUpgrades(upgradeTable) {
    const rows = upgradeTable.getElementsByClassName("upgrade-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".column5B input");
        if (parseInt(textField.value) !== 0) {
            return false;
        }
    }
    return true;
}

function allRowsWithValueZeroForPurchases(buyTable) {
    const rows = buyTable.getElementsByClassName("buy-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".buyColumn5B input");
        if (parseInt(textField.value) !== 0) {
            return false;
        }
    }
    return true;
}

export function addPlayerPurchases(buyTable, territory, totalGoldCost, totalProdPopCost) {
    //push purchases in table to an array
    let purchaseArray = [];
    const buyRows = buyTable.getElementsByClassName("buy-row");
    for (let i = 0; i < buyRows.length; i++) {
        const buyTextField = buyRows[i].querySelector(".buyColumn5B input");
        purchaseArray.push(buyTextField.value);
        buyTextField.value = "0";
    }

    purchaseArray[0] *= vehicleArmyWorth.infantry;

    //update total player resources
    totalPlayerResources[0].totalGold -= totalGoldCost;
    totalPlayerResources[0].totalProdPop -= totalProdPopCost;
    totalPlayerResources[0].totalArmy += parseInt(purchaseArray[0]);
    totalPlayerResources[0].totalInfantry += parseInt(purchaseArray[0]);
    totalPlayerResources[0].totalAssault += parseInt(purchaseArray[1]);
    totalPlayerResources[0].totalAir += parseInt(purchaseArray[2]);
    totalPlayerResources[0].totalNaval += parseInt(purchaseArray[3]);
    
    //update main array
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === territory.uniqueId) {
            mainArrayOfTerritoriesAndResources[i].goldForCurrentTerritory -= totalGoldCost; //subtract gold from territory
            mainArrayOfTerritoriesAndResources[i].productiveTerritoryPop -= totalProdPopCost; // subtract consMats from territory
            mainArrayOfTerritoriesAndResources[i].infantryForCurrentTerritory += parseInt(purchaseArray[0]);
            mainArrayOfTerritoriesAndResources[i].assaultForCurrentTerritory += parseInt(purchaseArray[1]);
            mainArrayOfTerritoriesAndResources[i].airForCurrentTerritory += parseInt(purchaseArray[2]);
            mainArrayOfTerritoriesAndResources[i].navalForCurrentTerritory += parseInt(purchaseArray[3]);
            mainArrayOfTerritoriesAndResources[i].oilDemand += (oilRequirements.assault * purchaseArray[1]);
            mainArrayOfTerritoriesAndResources[i].oilDemand += (oilRequirements.air * purchaseArray[2]);
            mainArrayOfTerritoriesAndResources[i].oilDemand += (oilRequirements.naval * purchaseArray[3]);
            mainArrayOfTerritoriesAndResources[i].armyForCurrentTerritory += parseInt(purchaseArray[0]);
        }
    }

    //update bottom table for selected territory
    document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(territory.goldForCurrentTerritory);
    document.getElementById("bottom-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(territory.productiveTerritoryPop) + " (" + formatNumbersToKMB(territory.territoryPopulation) + ")";
    document.getElementById("bottom-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(territory.armyForCurrentTerritory);

    //update top table for selected territory
    document.getElementById("top-table").rows[0].cells[3].innerHTML = Math.ceil(totalPlayerResources[0].totalGold);
    document.getElementById("top-table").rows[0].cells[11].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalProdPop) + " (" + formatNumbersToKMB(totalPlayerResources[0].totalPop) + ")";
    document.getElementById("top-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalArmy);

    totalGoldPrice = 0;
    totalConsMats = 0;

    setUseableNotUseableWeaponsDueToOilDemand(mainArrayOfTerritoriesAndResources, currentlySelectedTerritoryForPurchases);

    drawUITable(document.getElementById("uiTable"), 2);
}

export function addPlayerUpgrades(upgradeTable, territory, totalGoldCost, totalConsMatsCost) {
    //push upgrades in table to an array
    let upgradeArray = [];
    const rows = upgradeTable.getElementsByClassName("upgrade-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".column5B input");
        upgradeArray.push(textField.value);
        textField.value = "0";
    }

    //update total player resources
    totalPlayerResources[0].totalGold -= totalGoldCost;
    totalPlayerResources[0].totalConsMats -= totalConsMatsCost;
    
    //update main array
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === territory.uniqueId) {
            mainArrayOfTerritoriesAndResources[i].goldForCurrentTerritory -= totalGoldCost; //subtract gold from territory
            mainArrayOfTerritoriesAndResources[i].consMatsForCurrentTerritory -= totalConsMatsCost; // subtract consMats from territory
            mainArrayOfTerritoriesAndResources[i].farmsBuilt += parseInt(upgradeArray[0]);
            mainArrayOfTerritoriesAndResources[i].forestsBuilt += parseInt(upgradeArray[1]);
            mainArrayOfTerritoriesAndResources[i].oilWellsBuilt += parseInt(upgradeArray[2]);
            mainArrayOfTerritoriesAndResources[i].fortsBuilt += parseInt(upgradeArray[3]);
            if (mainArrayOfTerritoriesAndResources[i].farmsBuilt > 0) {
                mainArrayOfTerritoriesAndResources[i].foodCapacity = mainArrayOfTerritoriesAndResources[i].foodCapacity + (mainArrayOfTerritoriesAndResources[i].foodCapacity * ((territory.farmsBuilt * 10) / 100)); //calculate new foodCapacity
            }
            if (mainArrayOfTerritoriesAndResources[i].forestsBuilt > 0) {
                mainArrayOfTerritoriesAndResources[i].consMatsCapacity = mainArrayOfTerritoriesAndResources[i].consMatsCapacity + (mainArrayOfTerritoriesAndResources[i].consMatsCapacity * ((territory.forestsBuilt * 10) / 100)); //calculate new consMatsCapacity
            }
            if (mainArrayOfTerritoriesAndResources[i].oilWellsBuilt > 0) {
                mainArrayOfTerritoriesAndResources[i].oilCapacity = mainArrayOfTerritoriesAndResources[i].oilCapacity + (mainArrayOfTerritoriesAndResources[i].oilCapacity * ((territory.oilWellsBuilt * 10) / 100)); //calculate new oilCapacity
            }
            if (mainArrayOfTerritoriesAndResources[i].fortsBuilt > 0) {
                mainArrayOfTerritoriesAndResources[i].defenseBonus = mainArrayOfTerritoriesAndResources[i].defenseBonus + (mainArrayOfTerritoriesAndResources[i].defenseBonus * ((territory.fortsBuilt * 10) / 100)); //calculate new defenseBonus
            }
        }
    }

    //update bottom table for selected territory
    document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(territory.goldForCurrentTerritory);
    document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(territory.consMatsForCurrentTerritory);

    //update top table for selected territory
    document.getElementById("top-table").rows[0].cells[3].innerHTML = Math.ceil(totalPlayerResources[0].totalGold);
    document.getElementById("top-table").rows[0].cells[9].innerHTML = Math.ceil(totalPlayerResources[0].totalConsMats);

    //close upgrade window for selected territory
    totalGoldPrice = 0;
    totalConsMats = 0;

    drawUITable(document.getElementById("uiTable"), 1);
}

function calculateInitialAssaultAirNavalForTerritory(armyTerritory, oilTerritory) {
    let initialValue = Math.ceil(armyTerritory);
    oilTerritory = Math.ceil(oilTerritory);
  
    const initialDistribution = {
      naval: 0,
      air: 0,
      assault: 0,
      infantry: 0,
    };
  
    let remainingArmyValue = initialValue;
  
    // Allocate naval units based on available oil (limited to 25% of oilTerritory)
    const maxNavalOil = Math.floor(oilTerritory * 0.35);
    initialDistribution.naval = Math.min(
      Math.floor(maxNavalOil / oilRequirements.naval),
      Math.floor(remainingArmyValue / vehicleArmyWorth.naval)
    );
    remainingArmyValue -= initialDistribution.naval * vehicleArmyWorth.naval;
  
    // Allocate air units based on available oil (limited to 12.5% of oilTerritory)
    const maxAirOil = Math.floor(oilTerritory * 0.2);
    initialDistribution.air = Math.min(
      Math.floor(maxAirOil / oilRequirements.air),
      Math.floor(remainingArmyValue / vehicleArmyWorth.air)
    );
    remainingArmyValue -= initialDistribution.air * vehicleArmyWorth.air;
  
    // Allocate assault units based on available oil (limited to 12.5% of oilTerritory)
    const maxAssaultOil = Math.floor(oilTerritory * 0.2);
    initialDistribution.assault = Math.min(
      Math.floor(maxAssaultOil / oilRequirements.assault),
      Math.floor(remainingArmyValue / vehicleArmyWorth.assault)
    );
    remainingArmyValue -= initialDistribution.assault * vehicleArmyWorth.assault;
  
    // Allocate the remaining army value to infantry
    initialDistribution.infantry = remainingArmyValue;
  
    return initialDistribution;
  }
  
  
  function setUseableNotUseableWeaponsDueToOilDemand(mainArray, territory) {  
    let territoryOilDemand;
    let territoryOil;

    let numberAssault;
    let numberAir;
    let numberNaval;
  
    let useableAssault;
    let useableAir;
    let useableNaval;

    let totalArmy = 0;
  
    for (let i = 0; i < mainArray.length; i++) {
      if (mainArray[i].uniqueId === territory.uniqueId) {
        territoryOilDemand = mainArray[i].oilDemand;
        territoryOil = mainArray[i].oilForCurrentTerritory;
        numberAssault = mainArray[i].assaultForCurrentTerritory;
        numberAir = mainArray[i].airForCurrentTerritory;
        numberNaval = mainArray[i].navalForCurrentTerritory;
        useableAssault = numberAssault;
        useableAir = numberAir;
        useableNaval = numberNaval;

        break;
      }
    }
  
    if (territoryOilDemand > territoryOil) {
        let difference = territoryOilDemand - territoryOil;

        // Calculate the number of vehicles to mark as unuseable for each type, distributing evenly
        let types = ["naval", "air", "assault"];
        let index = 0;

        while (difference > 0) {
            let currentType = types[index];

            if (currentType === "naval" && useableNaval > 0) {
                useableNaval--;
                difference -= 1000;
            } else if (currentType === "air" && useableAir > 0) {
                useableAir--;
                difference -= 300;
            } else if (currentType === "assault" && useableAssault > 0) {
                useableAssault--;
                difference -= 100;
            }

            index = (index + 1) % 3;

            if (difference <= 0) break;
        }
    }
    for (let i = 0; i < mainArray.length; i++) {
        if (mainArray[i].uniqueId === territory.uniqueId) {
            mainArray[i].useableAssault = useableAssault;
            mainArray[i].useableAir = useableAir;
            mainArray[i].useableNaval = useableNaval;

            mainArray[i].armyForCurrentTerritory = (mainArray[i].useableAssault * vehicleArmyWorth.assault) + (mainArray[i].useableAir * vehicleArmyWorth.air) + (mainArray[i].useableNaval * vehicleArmyWorth.naval) + mainArray[i].infantryForCurrentTerritory;

            if (mainArray[i].uniqueId === currentSelectedPath.getAttribute("uniqueid")) {
                document.getElementById("bottom-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(territory.armyForCurrentTerritory);
            }

            break;
        }
    }
    for (let i = 0; i < mainArray.length; i++) {
        if (mainArray[i].dataName === playerCountry) {
            totalArmy += (mainArray[i].useableAssault * vehicleArmyWorth.assault) + (mainArray[i].useableAir * vehicleArmyWorth.air) + (mainArray[i].useableNaval * vehicleArmyWorth.naval) + mainArray[i].infantryForCurrentTerritory;
        }
        
        totalPlayerResources[0].totalArmy = totalArmy;
    }

    document.getElementById("top-table").rows[0].cells[15].innerHTML = formatNumbersToKMB(totalPlayerResources[0].totalArmy);
  }