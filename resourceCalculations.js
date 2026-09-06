import {
    renderInfoTable
} from "./src/ui/infoTable/renderInfoTable.js";
import {
    classNames,
    compound,
    ids
} from './src/ui/core/registry.js';
import {
    isStepperEnabled,
    setStepperEnabled,
    stepperButton
} from './src/ui/controls/steppers.js';
import {
    territoryActionButton
} from './src/ui/controls/actionButtons.js';
import {
    whenPageLoaded,
    removeSiegeImageFromPath,
    setCurrentWarFlagString,
    paths,
    svgTag,
    currentSelectedPath,
    enableNewGameButton,
    setFlag,
    toggleUpgradeMenu,
    toggleBuyMenu,
    setUpgradeOrBuyWindowOnScreenToTrue,
    reduceKeywords,
    routeSiegeUIProcesses
} from './ui.js';
import {
    randomEvent,
    randomEventHappening
} from './gameTurnsLoop.js';
import {
    dataTableCountriesInitialState
} from './initialData.js';
import {
    playSoundClip
} from './sfx.js';
import {
    allTerritories,
    getTerritory,
    currentTurn,
    currentPhase,
    isUnderSiege,
    playerCountryName
} from './src/state/selectors.js';
import {
    seedTerritories
} from './src/state/GameState.js';
import {
    getPathByUniqueId
} from './src/state/indexes.js';
import {
    startMapAttributeSync
} from './src/ui/mapAttributeSync.js';
import {
} from './src/state/mutations.js';
import {
    Phase
} from './src/state/phases.js';
import {
    loadPrecomputedPathAreas,
    precomputedAreasFor
} from './src/data/pathAreas.js';
import {
    historicWars,
    playerSiegeWarsList,
    aiSiegeWarsList,
    handleWarEndingsAndOptions,
    addRemoveWarSiegeObject,
    setValuesForBattleFromSiegeObject,
    setBattleResolutionOnHistoricWarArrayAfterSiege,
    historicAiWars,
    addRemoveWarSiegeObjectAi
} from './battle.js';
import {
    armyGoldPrices,
    armyProdPopPrices,
    oilRequirements,
    armyCostPerTurn,
    vehicleArmyPersonnelWorth,
    territoryUpgradeBaseCostsGold,
    territoryUpgradeBaseCostsConsMats,
    maxFarms,
    maxForests,
    maxOilWells,
    maxForts,
    continentModifiers,
    startingGoldContinentModifiers,
    population as populationBalance,
    territoryStrengthScales,
    startingArmy,
    initialArmyDistribution,
    INITIAL_GOLD_MIN_PER_TURN_AFTER_ARMY_ADJ,
    SIEGE_INCOME_SHARE,
    SIEGE_ROUT_THRESHOLD,
    SIEGE_SUSPENDS_CONSTRUCTION,
    FOOD_UNIT_SCALE,
    MOUNTAIN_DEFENSE_SCALE
} from './src/config/balance.js';
import {
    consMatsChangeFor,
    oilChangeFor,
    foodChangeFor,
    goldChangeFor
} from './src/rules/economy/income.js';
import {
    productivePopulationFor,
    productivePopulationOf,
    foodConsumptionOf,
    populationChangeFor,
    isStarving,
    armyStarvesInstead,
    siegeArmyStarvationChange,
    planArmyStarvation
} from './src/rules/economy/population.js';
import {
    armyTotalFor,
    useableUnitsFor,
    defenseBonusFor,
    effectiveCapacityFor,
    oilDemandFor,
    totalCapacities,
    totalDemands
} from './src/rules/economy/capacity.js';
import { garrisonFields } from './src/rules/military/garrison.js';
import {
    applyUpgrade,
    upgradeOrderPriceFor,
    upgradePriceFor
} from './src/rules/economy/upgrades.js';
import {
    initialConsMatsCapacityFor,
    initialOilCapacityFor
} from './src/rules/economy/seeding.js';
import {
    continentCapacityBonusFor,
    continentGoldBonusFor,
    continentHoldingFor,
    continentsHeldBy
} from './src/state/continentBonus.js';
import {
    describeContinentHolding,
    describeContinentsHeld
} from './src/ui/continents/continentBonusText.js';
import {
    armyMaintenanceFor,
    initialArmyAdjustmentCost,
    planArmyDesertion,
    upkeepShortfall
} from './src/rules/economy/maintenance.js';
import {
    randomEventDamageFor
} from './src/rules/events/randomEvents.js';
import {
    pathIsDeactivated,
    pathIsPlayerOwned,
    pathOwner,
    pathCountry
} from './src/state/pathState.js';
import {
    tooltip
} from './src/ui/components/Tooltip.js';
import {
    topTable
} from './src/ui/components/TopTable.js';
import {
    bottomTable
} from './src/ui/components/BottomTable.js';
import {
    registerSaveSlice
} from './src/platform/saveSlices.js';
import {
    captureNewGameBaseline
} from './src/platform/storage.js';

export let allowSelectionOfCountry = false;
export const playerOwnedTerritories = [];
export let currentlySelectedTerritoryForUpgrades;
export let currentlySelectedTerritoryForPurchases;
export let totalGoldPrice = 0;
export let totalConsMats = 0;
export let totalPurchaseGoldPrice = 0;
export let totalPopulationCost = 0;
export let capacityArray;
export let demandArray;
export let countryStrengthsArray;
export let turnGainsArrayLastTurn = {
    changeConsMats: 0,
    changeFood: 0,
    changeGold: 0,
    changeOil: 0,
    changePop: 0,
    changeProdPop: 0,
    changeFoodCapacity: 0,
    changeOilCapacity: 0,
    changeConsMatsCapacity: 0,
    changeFoodConsumption: 0,
    changeOilDemand: 0,
    changeArmy: 0,
    changeInfantry: 0,
    changeAssault: 0,
    changeAir: 0,
    changeNaval: 0
};

export let turnGainsArrayPlayer = {
    changeConsMats: 0,
    changeFood: 0,
    changeGold: 0,
    changeOil: 0,
    changePop: 0,
    changeProdPop: 0,
    changeFoodCapacity: 0,
    changeOilCapacity: 0,
    changeConsMatsCapacity: 0,
    changeFoodConsumption: 0,
    changeOilDemand: 0,
    changeArmy: 0,
    changeInfantry: 0,
    changeAssault: 0,
    changeAir: 0,
    changeNaval: 0
};

export let turnGainsArrayAi = {};

function createEmptyTurnGains() {
    return {
        changeConsMats: 0,
        changeFood: 0,
        changeGold: 0,
        changeOil: 0,
        changePop: 0,
        changeProdPop: 0,
        changeFoodCapacity: 0,
        changeOilCapacity: 0,
        changeConsMatsCapacity: 0,
        changeFoodConsumption: 0,
        changeOilDemand: 0,
        changeArmy: 0,
        changeInfantry: 0,
        changeAssault: 0,
        changeAir: 0,
        changeNaval: 0
    };
}

export {
    INFANTRY_IN_A_TROOP,
    armyGoldPrices,
    armyProdPopPrices,
    oilRequirements,
    armyCostPerTurn,
    vehicleArmyPersonnelWorth,
    territoryUpgradeBaseCostsGold,
    territoryUpgradeBaseCostsConsMats,
    maxFarms,
    maxForests,
    maxOilWells,
    maxForts
} from './src/config/balance.js';

const dummyAttackerObject = {
    infantryForCurrentTerritory: 0,
    useableAssault: 0,
    useableAir: 0,
    useableNaval: 0,
    territoryName: "dummy",
    dataName: "dummy"
}


export const totalPlayerResources = [];
export const countryResourceTotals = {};
let continentModifier;
let simulatedCostsAllMilitary = [armyGoldPrices.infantry, armyProdPopPrices.infantry, armyGoldPrices.assault, armyProdPopPrices.assault, armyGoldPrices.air, armyProdPopPrices.air, armyGoldPrices.naval, armyProdPopPrices.naval];
let pathAreasPromise = null;
let pathAreaComputations = 0;

{
    Promise.all([calculatePathAreasWhenPageLoaded(), createArrayOfInitialData()])
        .then(([pathAreas, armyArray]) => {
            randomiseInitialGold(allTerritories());
            countryStrengthsArray = calculateTerritoryStrengths(allTerritories());
            startMapAttributeSync();
            enableNewGameButton();
            captureNewGameBaseline();
        })
        .catch(error => {
            console.log(error);
            console.log("Reload page, promises not resolved on page load!");
        });
}

export function getPlayerTerritories() {
    playerOwnedTerritories.length = 0;

    for (const path of paths) {
        if (pathIsPlayerOwned(path)) {
            playerOwnedTerritories.push(path);
        }
    }
}

export function populateBottomTableWhenSelectingACountry(countryPath) {
    bottomTable.create();
    setFlag(pathCountry(countryPath), 2);

    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === countryPath.getAttribute("uniqueid")) {
            writeBottomTableInformation(allTerritories()[i], false, countryPath);
            break;
        }
    }
}

function calculatePathAreasWhenPageLoaded() {
    if (!pathAreasPromise) {
        pathAreasPromise = whenPageLoaded()
            .then(() => loadPrecomputedPathAreas())
            .then(() => {
                const cached = precomputedAreasFor(paths, svgByteLength());
                const pathAreas = cached ?? calculatePathAreas();
                if (!cached) {
                    pathAreaComputations++;
                }
                allowSelectionOfCountry = true;
                return pathAreas;
            });
    }
    return pathAreasPromise;
}

export function getPathAreaComputations() {
    return pathAreaComputations;
}

function territoryByUniqueId(uniqueId) {
    return getTerritory(uniqueId);
}

function svgByteLength() {
    try {
        const entry = performance
            .getEntriesByType("resource")
            .find(resource => resource.name.includes("svgMaster") && resource.name.endsWith(".svg"));
        return entry && entry.decodedBodySize ? entry.decodedBodySize : -1;
    } catch {
        return -1;
    }
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
            points.push({
                x: point.x,
                y: point.y
            });
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
        pathAreas.push({
            uniqueId: uniqueId,
            dataName: dataName,
            territoryId: territoryId,
            area: area
        });
    }

    let scalingFactor = 136067649 / totalAreaPath;

    for (let i = 0; i < pathAreas.length; i++) {
        pathAreas[i].area *= scalingFactor;
    }

    return pathAreas;
}

function assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState) {
    const territories = [];

    for (let i = 0; i < pathAreas.length; i++) {
        let uniqueId = pathAreas[i].uniqueId;
        let dataName = pathAreas[i].dataName;
        let territoryId = pathAreas[i].territoryId;
        let territoryName;
        let area = pathAreas[i].area;

        let matchingCountry = dataTableCountriesInitialState.find(function(country) {
            return country.country === dataName;
        });

        if (matchingCountry) {
            let totalArmyForCountry = calculateStartingArmy(matchingCountry);
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

            continentModifier = startingGoldContinentModifiers[continent];

            let initialCalculationTerritory;
            let isCoastal;
            let isLandLockedBonus;
            let mountainDefense;
            let owner;
            let originalOwner;

            for (const path of paths) {
                if (path.getAttribute("uniqueid") === uniqueId) {
                    territoryName = path.getAttribute("territory-name");
                    initialCalculationTerritory = path;
                    isCoastal = path.getAttribute("isCoastal");
                    isCoastal = (isCoastal === "true");
                    isLandLockedBonus = isCoastal ? 0 : 10
                    mountainDefense = parseInt(path.getAttribute("mountainDefenseFactor"));
                    owner = path.getAttribute("owner");
                    originalOwner = path.getAttribute("originalOwner");
                }
            }

            territoryPopulation = startingPop * percentOfWholeArea;
            let armyForCurrentTerritory = totalArmyForCountry * percentOfWholeArea;
            let goldForCurrentTerritory = Math.max((totalGoldForCountry * ((area / 8000000) * dev_index) + (percentOfWholeArea * (territoryPopulation / 50000)) * continentModifier), 300);

            let adjustmentArray = {
                continent: continent,
                area: area,
                devIndex: dev_index,
                productiveTerritoryPop: (((territoryPopulation / 100) * 45) * dev_index) - armyForCurrentTerritory
            }
            let armyAdjustment = calculateGoldChange(adjustmentArray, true, true);
            let bigEnoughToGetMin = armyAdjustment >= INITIAL_GOLD_MIN_PER_TURN_AFTER_ARMY_ADJ;
            armyAdjustment -= initialArmyAdjustmentCost(armyForCurrentTerritory);
            if (armyAdjustment < INITIAL_GOLD_MIN_PER_TURN_AFTER_ARMY_ADJ && bigEnoughToGetMin) {
                armyForCurrentTerritory = reduceArmyByAdjustment(armyForCurrentTerritory, armyAdjustment);
            }
            let armyAdjustmentTest = calculateGoldChange(adjustmentArray, true, true);
            armyAdjustmentTest -= initialArmyAdjustmentCost(armyForCurrentTerritory);
            const territorySeed = {
                area: area, devIndex: dev_index, continent: continent,
                population: territoryPopulation
            };
            let oilForCurrentTerritory = initialOilCapacityFor(territorySeed);
            let oilCapacity = oilForCurrentTerritory;
            let consMatsForCurrentTerritory = initialConsMatsCapacityFor(territorySeed);
            let consMatsCapacity = consMatsForCurrentTerritory;
            let farmsBuilt = 0;
            let oilWellsBuilt = 0;
            let forestsBuilt = 0;
            let fortsBuilt = 0;
            let defenseBonus = defenseBonusFor({
                fortsBuilt: fortsBuilt,
                devIndex: dev_index,
                isLandLockedBonus: isLandLockedBonus
            });
            let mountainDefenseBonus = mountainDefense * MOUNTAIN_DEFENSE_SCALE;
            let initialArmyDistributionArray = calculateInitialAssaultAirNavalForTerritory(armyForCurrentTerritory, oilForCurrentTerritory, initialCalculationTerritory);
            let assaultForCurrentTerritory = initialArmyDistributionArray.assault;
            let useableAssault = assaultForCurrentTerritory;
            let airForCurrentTerritory = initialArmyDistributionArray.air;
            let useableAir = airForCurrentTerritory;
            let navalForCurrentTerritory = initialArmyDistributionArray.naval;
            let useableNaval = navalForCurrentTerritory;
            let infantryForCurrentTerritory = initialArmyDistributionArray.infantry;

            armyForCurrentTerritory = (navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval) + (airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + infantryForCurrentTerritory;
            productiveTerritoryPop =
                productivePopulationFor(territoryPopulation, dev_index) - armyForCurrentTerritory;
            let foodForCurrentTerritory =
                (territoryPopulation / FOOD_UNIT_SCALE) + (armyForCurrentTerritory / FOOD_UNIT_SCALE);
            let foodCapacity = territoryPopulation + armyForCurrentTerritory;
            let foodConsumption = territoryPopulation + armyForCurrentTerritory;
            let isDeactivated = false;
            territories.push({
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
                defenseBonus: defenseBonus,
                isDeactivated: isDeactivated,
                isCoastal: isCoastal,
                isLandLockedBonus: isLandLockedBonus,
                mountainDefense: mountainDefense,
                mountainDefenseBonus: mountainDefenseBonus,
                owner: owner,
                originalOwner: originalOwner
            });
        }
    }

    territories.sort(function(a, b) {
        return b.defenseBonus - a.defenseBonus;
    });

    return territories;
}

function createArrayOfInitialData() {
    return calculatePathAreasWhenPageLoaded().then(pathAreas => {
        return new Promise((resolve, reject) => {
            seedTerritories(assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState));
            resolve(allTerritories());
        });
    });
}

function randomiseInitialGold(mainArrayOfTerritoriesAndResources) {
    mainArrayOfTerritoriesAndResources.forEach((country) => {
        let randomGoldFactor = Math.floor(Math.random() * 20) + 2;
        let randomAddSubtract = Math.random() < 0.5; //add or subtract

        if (randomAddSubtract) {
            country.goldForCurrentTerritory = (country.goldForCurrentTerritory + (country.goldForCurrentTerritory * (randomGoldFactor / 100))) / country.devIndex;
        } else {
            country.goldForCurrentTerritory = country.goldForCurrentTerritory - (country.goldForCurrentTerritory * (randomGoldFactor / 100));
        }
    });
    return mainArrayOfTerritoriesAndResources;
}

export function newTurnResources() {
    if (currentTurn() !== 1) {
        calculateTerritoryResourceIncomesEachTurn();
    }

    addUpAllTerritoryResourcesForCountryAndWriteToTopTable(true);
    capacityArray = calculateAllTerritoryCapacitiesForPlayerCountry();
    demandArray = calculateAllTerritoryDemandsForPlayerCountry();
    if (currentTurn() !== 1) {
        totalPlayerResources[0].totalUseableAssault = 0;
        totalPlayerResources[0].totalUseableAir = 0;
        totalPlayerResources[0].totalUseableNaval = 0;
        for (let i = 0; i < allTerritories().length; i++) {
            if (allTerritories()[i].dataName === playerCountryName()) {
                setPlayerUseableNotUseableWeaponsDueToOilDemand(allTerritories(), allTerritories()[i]);
            }
        }
        turnGainsArrayLastTurn = turnGainsArrayPlayer;
        turnGainsArrayPlayer = {
            changeConsMats: 0,
            changeFood: 0,
            changeGold: 0,
            changeOil: 0,
            changePop: 0,
            changeProdPop: 0,
            changeFoodCapacity: 0,
            changeOilCapacity: 0,
            changeConsMatsCapacity: 0,
            changeFoodConsumption: 0,
            changeOilDemand: 0,
            changeArmy: 0,
            changeInfantry: 0,
            changeAssault: 0,
            changeAir: 0,
            changeNaval: 0
        };
    }
}

function repairFoodCapacityAfterSiege(territory, war) {
    if (typeof war.foodCapacityDestroyed === "number") {
        territory.foodCapacity += war.foodCapacityDestroyed;
        return;
    }
    territory.foodCapacity = war.startingFoodCapacity;
}

function calculateTerritoryResourceIncomesEachTurn() {
    let changeGold;
    let changeOil;
    let changeFood;
    let changeConsMats;
    let changePop;
    let changeProdPop;
    let changeProdPopTemp;

    for (let i = 0; i < allTerritories().length; i++) {
        const modifier = continentModifiers[allTerritories()[i].continent];
        if (modifier !== undefined) {
            allTerritories()[i].continentModifier = modifier;
        }
    }

    for (const countryName of Object.keys(turnGainsArrayAi)) {
        delete turnGainsArrayAi[countryName];
    }

    for (const path of paths) {
        for (let i = 0; i < allTerritories().length; i++) {
            const defendingTerritoryId = allTerritories()[i].uniqueId;

            if (
                !Object.values(playerSiegeWarsList).some(obj => obj.defendingTerritory?.uniqueId === defendingTerritoryId) &&
                !Object.values(aiSiegeWarsList).some(obj => obj.defendingTerritory?.uniqueId === defendingTerritoryId)
            ) {
                for (let w = 0; w < historicWars.length; w++) {
                    if (historicWars[w].defendingTerritory.uniqueId === defendingTerritoryId && !historicWars[w].resetStatsAfterWar) {
                        if (historicWars[w].turnsInSiege !== null) {
                            repairFoodCapacityAfterSiege(allTerritories()[i], historicWars[w]);
                            historicWars[w].resetStatsAfterWar = true;
                        }
                    }
                }
                for (let k = 0; k < historicAiWars.length; k++) {
                    if (historicAiWars[k].defendingTerritory.uniqueId === defendingTerritoryId && !historicAiWars[k].resetStatsAfterWar) {
                        if (historicAiWars[k].turnsInSiege !== null) {
                            repairFoodCapacityAfterSiege(allTerritories()[i], historicAiWars[k]);
                            historicAiWars[k].resetStatsAfterWar = true;
                        }
                    }
                }

                if (path.getAttribute("uniqueid") === defendingTerritoryId) {
                    changeGold = calculateGoldChange(allTerritories()[i], false, false);
                    changeGold -= armyMaintenanceFor(allTerritories()[i]);
                    //Unpaid upkeep now costs an army. The treasury is clamped at zero two lines
                    //below, and that clamp is what used to make a broke territory's army free --
                    //the shortfall was simply discarded, so gold was a drag on income and never a
                    //ceiling on army size. `upkeepShortfall()` recovers the number before the
                    //clamp throws it away, and the share of the army that deserts is the share of
                    //the bill that went unpaid.
                    applyDesertion(allTerritories()[i], changeGold);
                    changeOil = calculateOilChange(allTerritories()[i], false);
                    changeFood = calculateFoodChange(allTerritories()[i], false, false);
                    changeConsMats = calculateConsMatsChange(allTerritories()[i], false);
                    changePop = calculatePopulationChange(allTerritories()[i], false, null);
                    changeProdPopTemp = productivePopulationOf(allTerritories()[i]);
                    allTerritories()[i].goldForCurrentTerritory = Math.max(0, allTerritories()[i].goldForCurrentTerritory + changeGold);
                    allTerritories()[i].oilForCurrentTerritory += changeOil;
                    allTerritories()[i].foodForCurrentTerritory += changeFood;
                    allTerritories()[i].foodConsumption = foodConsumptionOf(allTerritories()[i]);
                    allTerritories()[i].consMatsForCurrentTerritory += changeConsMats;
                    allTerritories()[i].territoryPopulation = Math.max(0, allTerritories()[i].territoryPopulation + changePop);
                    allTerritories()[i].productiveTerritoryPop = productivePopulationOf(allTerritories()[i]);

                    changeProdPop = productivePopulationOf(allTerritories()[i]);
                    changeProdPop = changeProdPop - changeProdPopTemp;

                    const countryName = pathOwner(path);

                    if (countryName === "Player") {
                        turnGainsArrayPlayer.changeGold += changeGold;
                        turnGainsArrayPlayer.changeOil += changeOil;
                        turnGainsArrayPlayer.changeFood += changeFood;
                        turnGainsArrayPlayer.changeConsMats += changeConsMats;
                        turnGainsArrayPlayer.changePop += changePop;
                        turnGainsArrayPlayer.changeProdPop += changeProdPop;
                        break;
                    } else if (countryName !== null) {
                        if (!turnGainsArrayAi[countryName]) {
                            turnGainsArrayAi[countryName] = createEmptyTurnGains();
                        }
                        turnGainsArrayAi[countryName].changeGold += changeGold;
                        turnGainsArrayAi[countryName].changeOil += changeOil;
                        turnGainsArrayAi[countryName].changeFood += changeFood;
                        turnGainsArrayAi[countryName].changeConsMats += changeConsMats;
                        turnGainsArrayAi[countryName].changePop += changePop;
                        turnGainsArrayAi[countryName].changeProdPop += changeProdPop;
                    }
                }
            } else if (path.getAttribute("uniqueid") === defendingTerritoryId) {
                const besiegedTerritory = allTerritories()[i];
                const playerSiege = playerSiegeWarsList[besiegedTerritory.territoryName];
                const siegeTerritory = playerSiege ?? aiSiegeWarsList[besiegedTerritory.territoryName];
                if (!siegeTerritory) {
                    continue;
                }
                const siegeIsAi = !playerSiege;
                changeFood = calculateFoodChange(siegeTerritory, false, true, siegeIsAi);
                changePop = calculatePopulationChange(siegeTerritory, true, siegeIsAi);
                changeProdPopTemp = productivePopulationOf(besiegedTerritory);

                //A besieged territory earns a REDUCED yield, not nothing. Until
                //`SIEGE_INCOME_SHARE` existed these three lines were simply absent from this
                //branch -- food and population were handled and gold, oil and construction
                //materials were not -- so a besieged territory earned zero for as long as the
                //siege stood, and nothing in the game ends a siege except an arrest or a
                //conquest. A player besieged on turn 3 of a measured run was still frozen on
                //turn 14, with no decision available to them at all.
                //
                //Upkeep is charged in full. Being cut off is not a reason the army stops
                //eating, and it is what makes a siege bite on a garrison that is too big for
                //the quarter income it is now living on.
                changeGold = (calculateGoldChange(besiegedTerritory, false, false) * SIEGE_INCOME_SHARE)
                    - armyMaintenanceFor(besiegedTerritory);
                applyDesertion(besiegedTerritory, changeGold);
                changeOil = calculateOilChange(besiegedTerritory, false) * SIEGE_INCOME_SHARE;
                changeConsMats = calculateConsMatsChange(besiegedTerritory, false) * SIEGE_INCOME_SHARE;
                besiegedTerritory.goldForCurrentTerritory =
                    Math.max(0, besiegedTerritory.goldForCurrentTerritory + changeGold);
                besiegedTerritory.oilForCurrentTerritory += changeOil;
                besiegedTerritory.consMatsForCurrentTerritory += changeConsMats;

                besiegedTerritory.foodForCurrentTerritory += changeFood;
                besiegedTerritory.foodConsumption = foodConsumptionOf(besiegedTerritory);
                besiegedTerritory.territoryPopulation = Math.max(0, besiegedTerritory.territoryPopulation + changePop);
                besiegedTerritory.productiveTerritoryPop = productivePopulationOf(besiegedTerritory);

                changeProdPop = besiegedTerritory.productiveTerritoryPop - changeProdPopTemp;
                if (!siegeIsAi) {
                    writeBottomTableInformation(besiegedTerritory, true, null);
                }
            }
        }
    }
}

function economyContext(isSimulation, territory) {
    return {
        randomEventHappening: randomEventHappening,
        randomEvent: randomEvent,
        isSimulation: Boolean(isSimulation),
        continentBonus: continentGoldBonusFor(territory),
        continentCapacityBonus: continentCapacityBonusFor(territory)
    };
}

function applyRandomEventDamage(territory, context, ownEvent) {
    const damage = context.randomEvent === ownEvent
        ? randomEventDamageFor(territory, context)
        : null;
    if (context.randomEvent !== ownEvent) {
        return;
    }
    if (!damage) {
        if (context.randomEventHappening && !context.isSimulation) {
            console.log(territory.dataName + "'s " + territory.territoryName + " escaped harm!");
        }
        return;
    }
    territory[damage.field] = damage.to;
    console.log(territory.dataName + "'s " + territory.territoryName +
        " was hit by the " + context.randomEvent + ": " + damage.from + " became " + damage.to);
}

function calculateConsMatsChange(territory, isSimulation) {
    const context = economyContext(isSimulation, territory);
    applyRandomEventDamage(territory, context, "Warehouse Fire");
    return consMatsChangeFor(territory, context);
}

function calculateGoldChange(territory, isSimulation, gameStartAdjustment) {
    const context = economyContext(isSimulation, territory);
    applyRandomEventDamage(territory, context, "Mutiny");
    return goldChangeFor(territory, context);
}

function calculateOilChange(territory, isSimulation) {
    const context = economyContext(isSimulation, territory);
    applyRandomEventDamage(territory, context, "Oil Well Fire");
    return oilChangeFor(territory, context);
}

function calculateFoodChange(territory, isSimulation, cameFromSiege, ai) {
    if (cameFromSiege) {
        territory = territory.defendingTerritory;
    }
    const context = economyContext(isSimulation, territory);
    applyRandomEventDamage(territory, context, "Food Disaster");
    return foodChangeFor(territory, context);
}

export function derivedEconomyFor(territory) {
    if (!territory) {
        return null;
    }
    const context = economyContext(true, territory);
    return {
        territory: territory.territoryName,
        owner: territory.dataName,
        continent: territory.continent ?? "Unknown",
        bonus: {
            gold: context.continentBonus,
            capacity: context.continentCapacityBonus
        },
        income: {
            gold: goldChangeFor(territory, context),
            oil: oilChangeFor(territory, context),
            food: foodChangeFor(territory, context),
            consMats: consMatsChangeFor(territory, context)
        },
        capacities: {
            oil: effectiveCapacityFor(territory, "oil", context.continentCapacityBonus),
            food: effectiveCapacityFor(territory, "food", context.continentCapacityBonus),
            consMats: effectiveCapacityFor(territory, "consMats", context.continentCapacityBonus)
        },
        storedCapacities: {
            oil: territory.oilCapacity,
            food: territory.foodCapacity,
            consMats: territory.consMatsCapacity
        }
    };
}

function calculatePopulationChange(territory, cameFromSiege, ai) {
    let siegeObject;
    if (cameFromSiege) {
        siegeObject = territory;
        territory = territory.defendingTerritory;
    }

    if (randomEventHappening) {
        return 0;
    }

    let populationChange = populationChangeFor(territory);

    const siegeHitsArmy = cameFromSiege && isStarving(territory) &&
        Math.random() > populationBalance.siegeArmyStarvationChance;

    if (!armyStarvesInstead(territory, populationChange) && !siegeHitsArmy) {
        return populationChange;
    }

    if (!cameFromSiege) {
        applyArmyStarvation(territory, populationChange);
        return 0;
    }

    populationChange = siegeArmyStarvationChange(territory, populationChange);

    if (!checkIfWouldBeARoutAndPossiblyLeaveSiege(siegeObject)) {
        applyArmyStarvation(territory, populationChange);
        return 0;
    }

    const warId = siegeObject.warId;
    if (!ai) {
        setCurrentWarFlagString(siegeObject.defendingTerritory.dataName);
        addRemoveWarSiegeObject(1, siegeObject.warId, false);
    } else {
        addRemoveWarSiegeObjectAi(1, siegeObject.warId, siegeObject, dummyAttackerObject);
    }

    const siegedPath = getPathByUniqueId(territory.uniqueId);
    if (siegedPath) {
        removeSiegeImageFromPath(ai, siegedPath);
    }
    setBattleResolutionOnHistoricWarArrayAfterSiege("Victory", warId, ai);
    if (!ai) {
        routeSiegeUIProcesses();
    }
    handleWarEndingsAndOptions(2, territory, siegeObject.attackingArmyRemaining, siegeObject.defendingArmyRemaining, true, ai, siegeObject);
    return 0;
}

/**
 * Charge unpaid upkeep to the army.
 *
 * `changeGold` already has this turn's upkeep subtracted from it, and the treasury is clamped
 * at zero by the caller -- that clamp is what made a broke territory's army free, because the
 * shortfall was discarded rather than charged to anything. The share of the army that deserts
 * is the share of the bill that went unpaid, which is self-limiting: next turn the bill is
 * smaller by exactly what left, so a territory converges on the army it can afford.
 *
 * Writes the OWNED vehicle counts as well as the `useable*` ones, through the garrison rule, so
 * that deserters cannot be resurrected by the next oil recompute. `applyArmyStarvation()` above
 * deliberately still writes only `useable*`; the two differing is noted in the register rather
 * than changed here, because famine is not what this decision was about.
 */
function applyDesertion(territory, changeGold) {
    const shortfall = upkeepShortfall(territory.goldForCurrentTerritory, changeGold);
    const survivors = planArmyDesertion(territory, shortfall);
    if (!survivors) {
        return;
    }
    Object.assign(territory, garrisonFields({
        infantry: survivors.infantryForCurrentTerritory,
        assault: survivors.useableAssault,
        air: survivors.useableAir,
        naval: survivors.useableNaval
    }));
    territory.oilDemand = oilDemandFor(territory);
}

function applyArmyStarvation(territory, populationChange) {
    const survivors = planArmyStarvation(territory, populationChange);
    territory.infantryForCurrentTerritory = survivors.infantryForCurrentTerritory;
    territory.useableAssault = survivors.useableAssault;
    territory.useableAir = survivors.useableAir;
    territory.useableNaval = survivors.useableNaval;
    territory.armyForCurrentTerritory = survivors.armyForCurrentTerritory;
}


export function formatNumbersToKMB(number, place) {
    if (number === 0 || (number > -1 && number < 1)) {
        return 0;
    }

    if (number === "-") {
        return 0;
    }

    if (number === "All") {
        return "All";
    }

    let absNumber = Math.abs(number);

    if (absNumber >= 1000000000) {
        return (number / 1000000000).toFixed(place === 1 ? 0 : 1) + 'B';
    } else if (absNumber >= 1000000) {
        return (number / 1000000).toFixed(place === 1 ? 0 : 1) + 'M';
    } else if (absNumber >= 1000) {
        return (number / 1000).toFixed(place === 1 ? 0 : 1) + 'k';
    } else {
        return number.toFixed(0);
    }
}

function playerTerritoryModels() {
    const owned = new Set(playerOwnedTerritories.map(path => path.getAttribute("uniqueid")));
    return allTerritories().filter(territory => owned.has(territory.uniqueId));
}

export function calculateAllTerritoryDemandsForPlayerCountry() {
    return totalDemands(playerTerritoryModels());
}

function calculateAllTerritoryCapacitiesForPlayerCountry() {
    return totalCapacities(playerTerritoryModels(), continentCapacityBonusFor);
}



export function addUpAllTerritoryResourcesForCountryAndWriteToTopTable(endOfTurn) {
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

    for (const path of paths) {
        const territoryOwner = pathOwner(path);
        if (!territoryOwner) {
            continue;
        }

        if (territoryOwner === "Player") {
            const territoryData = territoryByUniqueId(path.getAttribute("uniqueid"));
            if (territoryData) {
                totalGold += territoryData.goldForCurrentTerritory;
                totalOil += territoryData.oilForCurrentTerritory;
                totalFood += territoryData.foodForCurrentTerritory;
                totalConsMats += territoryData.consMatsForCurrentTerritory;
                totalPop += territoryData.territoryPopulation;
                totalProdPop += territoryData.productiveTerritoryPop;
                totalArea += territoryData.area;
                totalArmy += territoryData.armyForCurrentTerritory;
                totalInfantry += territoryData.infantryForCurrentTerritory;
                totalAssault += territoryData.assaultForCurrentTerritory;
                totalAir += territoryData.airForCurrentTerritory;
                totalNaval += territoryData.navalForCurrentTerritory;
                totalUseableAssault += territoryData.useableAssault;
                totalUseableAir += territoryData.useableAir;
                totalUseableNaval += territoryData.useableNaval;
            }
        } else if (endOfTurn) {
            countryResourceTotals[territoryOwner] = {
                totalGold: 0,
                totalOil: 0,
                totalFood: 0,
                totalConsMats: 0,
                totalPop: 0,
                totalProdPop: 0,
                totalArea: 0,
                totalArmy: 0,
                totalInfantry: 0,
                totalAssault: 0,
                totalAir: 0,
                totalNaval: 0,
                totalUseableAssault: 0,
                totalUseableAir: 0,
                totalUseableNaval: 0,
            };

            const territoryData = territoryByUniqueId(path.getAttribute("uniqueid"));
            if (!territoryData) {
                continue;
            }
            const dataName = territoryData.dataName;
            {
                if (countryResourceTotals[dataName]) {
                    countryResourceTotals[dataName].totalGold += territoryData.goldForCurrentTerritory;
                    countryResourceTotals[dataName].totalOil += territoryData.oilForCurrentTerritory;
                    countryResourceTotals[dataName].totalFood += territoryData.foodForCurrentTerritory;
                    countryResourceTotals[dataName].totalConsMats += territoryData.consMatsForCurrentTerritory;
                    countryResourceTotals[dataName].totalPop += territoryData.territoryPopulation;
                    countryResourceTotals[dataName].totalProdPop += territoryData.productiveTerritoryPop;
                    countryResourceTotals[dataName].totalArea += territoryData.area;
                    countryResourceTotals[dataName].totalArmy += territoryData.armyForCurrentTerritory;
                    countryResourceTotals[dataName].totalInfantry += territoryData.infantryForCurrentTerritory;
                    countryResourceTotals[dataName].totalAssault += territoryData.assaultForCurrentTerritory;
                    countryResourceTotals[dataName].totalAir += territoryData.airForCurrentTerritory;
                    countryResourceTotals[dataName].totalNaval += territoryData.navalForCurrentTerritory;
                    countryResourceTotals[dataName].totalUseableAssault += territoryData.useableAssault;
                    countryResourceTotals[dataName].totalUseableAir += territoryData.useableAir;
                    countryResourceTotals[dataName].totalUseableNaval += territoryData.useableNaval;
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

    topTable.update({
        gold: Math.ceil(totalPlayerResources[0].totalGold).toString(),
        oil: Math.ceil(totalPlayerResources[0].totalOil).toString(),
        food: Math.ceil(totalPlayerResources[0].totalFood).toString(),
        consMats: Math.ceil(totalPlayerResources[0].totalConsMats).toString(),
        population: formatNumbersToKMB(totalPlayerResources[0].totalProdPop, 0) + " (" + formatNumbersToKMB(totalPlayerResources[0].totalPop, 0) + ")",
        area: formatNumbersToKMB(totalPlayerResources[0].totalArea, 0) + " (km²)",
        army: formatNumbersToKMB(totalPlayerResources[0].totalArmy, 0),
    });
}

export function writeBottomTableInformation(territory, userClickingANewTerritory, countryPath) {
    if (userClickingANewTerritory) {
        colourTableText(bottomTable.element(), territory);
        bottomTable.create();
        bottomTable.update({
            mountainDefence: territory.mountainDefenseBonus.toString(),
            gold: Math.ceil(territory.goldForCurrentTerritory).toString(),
            oil: Math.ceil(territory.oilForCurrentTerritory).toString(),
            food: Math.ceil(territory.foodForCurrentTerritory).toString(),
            consMats: Math.ceil(territory.consMatsForCurrentTerritory).toString(),
            population: formatNumbersToKMB(territory.productiveTerritoryPop, 0) + " (" + formatNumbersToKMB(territory.territoryPopulation, 0) + ")",
            area: formatNumbersToKMB(territory.area, 0) + " (km²)",
            army: formatNumbersToKMB(territory.armyForCurrentTerritory, 0),
        });
    } else {
        colourTableText(bottomTable.element(), territory);
        bottomTable.update({
            name: reduceKeywords(countryPath.getAttribute("territory-name")) + " (" + reduceKeywords(territory.continent) + ")",
            mountainDefence: territory.mountainDefenseBonus.toString(),
            gold: Math.ceil(territory.goldForCurrentTerritory).toString(),
            oil: Math.ceil(territory.oilForCurrentTerritory).toString(),
            food: Math.ceil(territory.foodForCurrentTerritory).toString(),
            consMats: Math.ceil(territory.consMatsForCurrentTerritory).toString(),
            population: formatNumbersToKMB(territory.productiveTerritoryPop, 0) + " (" + formatNumbersToKMB(territory.territoryPopulation, 0) + ")",
            area: formatNumbersToKMB(territory.area, 0) + " (km²)",
            army: formatNumbersToKMB(territory.armyForCurrentTerritory, 0),
        });
    }
}

export function drawUITable(uiTableContainer, summaryTerritoryArmySiegesTable) {
    playerOwnedTerritories.sort((a, b) => {
        const idA = parseInt(a.getAttribute("territory-id"));
        const idB = parseInt(b.getAttribute("territory-id"));
        return idA - idB;
    });

    renderInfoTable(uiTableContainer, summaryTerritoryArmySiegesTable, {
        formatNumber: formatNumbersToKMB,
        formatNumberDefault: (value) => formatNumbersToKMB(value),
        playerCountryName,
        reduceKeywords,

        gains: turnGainsArrayLastTurn,
        totals: totalPlayerResources[0],
        capacities: capacityArray,
        capacityOf: (territory, resource) =>
            effectiveCapacityFor(territory, resource, continentCapacityBonusFor(territory)),
        continentsHeldLine: describeContinentsHeld(continentsHeldBy(playerCountryName())),
        demands: demandArray,

        territoryPaths: playerOwnedTerritories,
        territoryByUniqueId,

        upgradeButton: buildUpgradeButton,
        buyButton: buildBuyButton,

        territoryRowTooltip: tooltipUITerritoryRow,
        armyRowTooltip: tooltipUIArmyRow,
        hideTooltip: () => tooltip.hide(),

        sieges: Object.values(playerSiegeWarsList),
        historicWars,

        afterSiegeTable: allWorkaroundOnSiegeTable
    });
}

function setConfirmArmed(buttonId, armed) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.classList.toggle(classNames.isArmed, armed);
    }
}

function territoryActionsEnabled(path) {
    return currentPhase() === Phase.BUY_UPGRADE && !pathIsDeactivated(path);
}

function buildUpgradeButton(path, territoryData) {
    return territoryActionButton({
        kind: "upgrade",
        isEnabled: () => territoryActionsEnabled(path),
        onPress: () => playSoundClip("button"),
        onActivate: () => {
            populateUpgradeTable(territoryData);
            toggleUpgradeMenu(true, territoryData);
            currentlySelectedTerritoryForUpgrades = territoryData;
            setUpgradeOrBuyWindowOnScreenToTrue(1);
        }
    });
}

function buildBuyButton(path, territoryData) {
    return territoryActionButton({
        kind: "buy",
        isEnabled: () => territoryActionsEnabled(path),
        onPress: () => playSoundClip("button"),
        onActivate: () => {
            populateBuyTable(territoryData);
            toggleBuyMenu(true, territoryData);
            currentlySelectedTerritoryForPurchases = territoryData;
            setUpgradeOrBuyWindowOnScreenToTrue(2);
        }
    });
}

function tooltipPurchaseMilitaryRow(territoryData, availablePurchases, event) {
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
        return;
    }

    const buyTypeColumn = buyRow.querySelector('.buy-column:nth-child(2)');
    const buyValueColumn = buyRow.querySelector('.buyColumn5B input');
    const purchaseType = buyTypeColumn.innerHTML.trim();

    if (!purchaseType) {
        return;
    }

    switch (purchaseType) {
        case "Infantry":
            type = "Infantry";
            nextPurchaseCostGold = armyGoldPrices.infantry;
            nextProdPopCost = armyProdPopPrices.infantry;
            purchase = availablePurchases[0];
            simulatedTotal = parseInt(buyValueColumn.value);
            amountAlreadyBuilt = territoryData.infantryForCurrentTerritory;
            effectOnOilDemand = 0;
            break;
        case "Assault":
            type = "Assault";
            nextPurchaseCostGold = armyGoldPrices.assault;
            nextProdPopCost = armyProdPopPrices.assault;
            purchase = availablePurchases[1];
            simulatedTotal = parseInt(buyValueColumn.value);
            amountAlreadyBuilt = territoryData.assaultForCurrentTerritory;
            effectOnOilDemand = oilRequirements.assault;
            break;
        case "Air":
            type = "Air";
            nextPurchaseCostGold = armyGoldPrices.air;
            nextProdPopCost = armyProdPopPrices.air;
            purchase = availablePurchases[2];
            simulatedTotal = parseInt(buyValueColumn.value);
            amountAlreadyBuilt = territoryData.airForCurrentTerritory;
            effectOnOilDemand = oilRequirements.air;
            break;
        case "Naval":
            type = "Naval";
            nextPurchaseCostGold = armyGoldPrices.naval;
            nextProdPopCost = armyProdPopPrices.naval;
            purchase = availablePurchases[3];
            simulatedTotal = parseInt(buyValueColumn.value);
            amountAlreadyBuilt = territoryData.navalForCurrentTerritory;
            effectOnOilDemand = oilRequirements.naval;
            break;
        default:
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

    tooltip.setContent(tooltipContent);
    tooltip.show();

    const tooltipHeight = tooltip.height();
    const verticalThreshold = tooltipHeight + 25;
    const windowHeight = window.innerHeight;

    tooltip.hide();

    if (windowHeight - y < verticalThreshold && y - verticalThreshold >= 0) {
        tooltip.moveTo(x - 40, y - verticalThreshold);
    } else {
        tooltip.moveTo(x - 40, y + 25);
    }

    tooltip.show();
}

function tooltipUpgradeTerritoryRow(territoryData, availableUpgrades, event) {
    const x = event.clientX;
    const y = event.clientY;

    const territoryName = territoryData.territoryName;
    let type;
    let upgrade;
    let amountAlreadyBuilt;
    let nextUpgradeCostGold;
    let nextUpgradeCostConsMats;
    let simulatedTotal;
    let currentDefenseBonus = territoryData.defenseBonus;

    const upgradeRow = event.currentTarget.closest('.upgrade-row');
    if (!upgradeRow) {
        return;
    }

    const upgradeTypeColumn = upgradeRow.querySelector('.upgrade-column:nth-child(2)');
    const upgradeValueColumn = upgradeRow.querySelector('.column5B input');
    const upgradeType = upgradeTypeColumn.innerHTML.trim();

    if (!upgradeType) {
        return;
    }

    const rowSpec = {
        "Farm": { kind: "farm", built: "farmsBuilt", index: 0 },
        "Forest": { kind: "forest", built: "forestsBuilt", index: 1 },
        "Oil Well": { kind: "oilWell", built: "oilWellsBuilt", index: 2 },
        "Fort": { kind: "fort", built: "fortsBuilt", index: 3 }
    }[upgradeType];
    if (!rowSpec) {
        return;
    }
    type = upgradeType;
    amountAlreadyBuilt = Number(territoryData[rowSpec.built]) || 0;
    upgrade = availableUpgrades[rowSpec.index];
    simulatedTotal = amountAlreadyBuilt + (parseInt(upgradeValueColumn.value) || 0);
    const nextUpgradePrice = upgradePriceFor(rowSpec.kind, simulatedTotal + 1, territoryData.devIndex);
    nextUpgradeCostGold = nextUpgradePrice.gold;
    nextUpgradeCostConsMats = nextUpgradePrice.consMats;

    let currentEffect;
    if (amountAlreadyBuilt > 0) {
        currentEffect = amountAlreadyBuilt + "0% -> ";
    } else if (amountAlreadyBuilt === 0) {
        currentEffect = "0% -> ";
    }

    let simulatedEffect;

    if (type === "Fort") {
        simulatedEffect = defenseBonusFor({ ...territoryData, fortsBuilt: simulatedTotal });
        currentEffect = currentDefenseBonus + " -> ";
    } else {
        simulatedEffect = simulatedTotal;
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
      <div>Current Effect -> Next Effect: <span style="${whiteStyle}">${currentEffect}<span style="${greenStyle}">${simulatedEffect}</span></div>
      <br />
      <div>Cost Of Next Upgrade (Gold): <span style="${whiteStyle}">${nextUpgradeCostGold}</span></div>
      <div>Cost Of Next Upgrade (Cons. Mats.): <span style="${whiteStyle}">${nextUpgradeCostConsMats}</span></div>
      <br />
      <div><span style="${buildAvailabilityStyle}">${upgrade.condition}</span></div>
    `;

    tooltip.setContent(tooltipContent);

    tooltip.show();

    const tooltipHeight = tooltip.height();
    const verticalThreshold = tooltipHeight + 25;
    const windowHeight = window.innerHeight;

    tooltip.hide();

    if (windowHeight - y < verticalThreshold && y - verticalThreshold >= 0) {
        tooltip.moveTo(x - 40, y - verticalThreshold);
    } else {
        tooltip.moveTo(x - 40, y + 25);
    }

    tooltip.show();
}

function tooltipUIArmyRow(row, territoryData, event) {
    const x = event.clientX;
    const y = event.clientY;
    const territoryName = row.querySelector(".ui-table-column").textContent;
    const prodPopulation = territoryData.productiveTerritoryPop;
    const gold = row.querySelector(".ui-table-column:nth-child(7)").textContent;
    const oilCap = effectiveCapacityFor(territoryData, "oil",
        continentCapacityBonusFor(territoryData));
    let oilDemand;

    let oilDemandStyle;
    if (territoryData.oilDemand > oilCap) {
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

    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === territoryData.uniqueId) {
            oilDemand = allTerritories()[i].oilDemand;
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

    const lastDiv = row.querySelector(".ui-table-column:last-child img");

    if (event.target === lastDiv) {
        if (currentPhase() === Phase.BUY_UPGRADE) {
            for (let i = 0; i < paths.length; i++) {
                if (paths[i].getAttribute("uniqueid") === territoryData.uniqueId) {
                    if (pathIsDeactivated(paths[i])) {
                        tooltip.setContent("Territory deactivated for rebuilding!");
                    } else {
                        tooltip.setContent("Click To Buy Military!");
                    }
                }
            }
        } else {
            for (let i = 0; i < paths.length; i++) {
                if (paths[i].getAttribute("uniqueid") === territoryData.uniqueId) {
                    if (pathIsDeactivated(paths[i])) {
                        tooltip.setContent("Territory deactivated for rebuilding!");
                    } else {
                        tooltip.setContent("Wrong Turn Phase To Buy");
                    }
                }
            }
        }
    } else {
        tooltip.setContent(tooltipContent);
    }

    const tooltipHeight = tooltip.height();
    const verticalThreshold = tooltipHeight + 25;

    if (window.innerHeight - y < verticalThreshold) {

        tooltip.moveTo(x - 40, y - tooltipHeight);
    } else {
        tooltip.moveTo(x - 40, 25 + y);
    }

    tooltip.show();

    row.style.cursor = "pointer";
}

function continentBonusTooltipLine(territoryData) {
    const holding = continentHoldingFor(territoryData);
    const sentence = describeContinentHolding(holding);
    if (!sentence) {
        return "";
    }
    const style = holding.total > 0 && holding.held === holding.total
        ? "font-weight: bold; color: rgb(0,235,0);"
        : "font-weight: bold; color: white;";
    return `<br /><div>Continent: <span style="${style}">${sentence}</span></div>`;
}

function tooltipUITerritoryRow(row, territoryData, event) {
    const x = event.clientX;
    const y = event.clientY;
    const territoryName = row.querySelector(".ui-table-column").textContent;
    const army = row.querySelector(".ui-table-column:nth-child(2)").textContent;
    const prodPopulation = territoryData.productiveTerritoryPop;
    const popNextTurnValue = calculatePopulationChange(territoryData, false, null);
    const area = row.querySelector(".ui-table-column:nth-child(4)").textContent;
    const gold = row.querySelector(".ui-table-column:nth-child(5)").textContent;
    const oilNextTurnValue = Math.ceil(calculateOilChange(territoryData, true));
    const capacityBonus = continentCapacityBonusFor(territoryData);
    const oilCap = effectiveCapacityFor(territoryData, "oil", capacityBonus);
    const foodNextTurnValue = Math.ceil(calculateFoodChange(territoryData, true));
    const foodCap = effectiveCapacityFor(territoryData, "food", capacityBonus);
    const consMatsNextTurnValue = Math.ceil(calculateConsMatsChange(territoryData, true));
    const consMatsCap = effectiveCapacityFor(territoryData, "consMats", capacityBonus);
    const foodConsumption = territoryData.foodConsumption;

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
        ${continentBonusTooltipLine(territoryData)}
    `;

    const lastDiv = row.querySelector(".ui-table-column:last-child img[alt='Upgrade Territory']");

    if (event.target === lastDiv) {
        if (currentPhase() === Phase.BUY_UPGRADE) {
            for (let i = 0; i < paths.length; i++) {
                if (paths[i].getAttribute("uniqueid") === territoryData.uniqueId) {
                    if (pathIsDeactivated(paths[i])) {
                        tooltip.setContent("Territory deactivated for rebuilding!");
                    } else {
                        tooltip.setContent("Click To Upgrade!");
                    }
                }
            }
        } else {
            for (let i = 0; i < paths.length; i++) {
                if (paths[i].getAttribute("uniqueid") === territoryData.uniqueId) {
                    if (pathIsDeactivated(paths[i])) {
                        tooltip.setContent("Territory deactivated for rebuilding!");
                    } else {
                        tooltip.setContent("Wrong Turn Phase To Upgrade");
                    }
                }
            }
        }
    } else {
        tooltip.setContent(tooltipContent);
    }

    const tooltipHeight = tooltip.height();
    const verticalThreshold = tooltipHeight + 25;

    if (window.innerHeight - y < verticalThreshold) {

        tooltip.moveTo(x - 40, y - tooltipHeight);
    } else {
        tooltip.moveTo(x - 40, 25 + y);
    }

    tooltip.show();

    row.style.cursor = "pointer";
}

export function colourTableText(table, territory) {
    let changeOil = calculateOilChange(territory, true);
    let changeFood = calculateFoodChange(territory, true);
    let changeConsMats = calculateConsMatsChange(territory, true);
    let changePop = calculatePopulationChange(territory, false, null);

    const oilCell = table.rows[0].cells[5];
    const foodCell = table.rows[0].cells[7];
    const consMatsCell = table.rows[0].cells[9];
    const popCell = table.rows[0].cells[11];

    popCell.style.color = "white";
    oilCell.style.color = "white";
    foodCell.style.color = "white";
    consMatsCell.style.color = "white";

    if (bottomTable.is(table)) {
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

function calculateAvailablePurchases(territory) {
    const availablePurchases = [];

    const isCoastal = territory.isCoastal;

    const hasEnoughGoldForInfantry = totalPlayerResources[0].totalGold >= armyGoldPrices.infantry;
    const hasEnoughGoldForAssault = totalPlayerResources[0].totalGold >= armyGoldPrices.assault;
    const hasEnoughGoldForAir = totalPlayerResources[0].totalGold >= armyGoldPrices.air;
    const hasEnoughGoldForNaval = totalPlayerResources[0].totalGold >= armyGoldPrices.naval;

    const hasEnoughProdPopForInfantry = totalPlayerResources[0].totalProdPop >= armyProdPopPrices.infantry;
    const hasEnoughProdPopForAssault = totalPlayerResources[0].totalProdPop >= armyProdPopPrices.assault;
    const hasEnoughProdPopForAir = totalPlayerResources[0].totalProdPop >= armyProdPopPrices.air;
    const hasEnoughProdPopForNaval = totalPlayerResources[0].totalProdPop >= armyProdPopPrices.naval;

    if (hasEnoughGoldForInfantry && hasEnoughProdPopForInfantry) {
        availablePurchases.push({
            type: 'Infantry',
            purchaseGoldCost: armyGoldPrices.infantry,
            purchasePopCost: armyProdPopPrices.infantry,
            effect: "+1000 Infantry",
            condition: 'Can Build'
        });
    } else if (!hasEnoughGoldForInfantry) {
        availablePurchases.push({
            type: 'Infantry',
            purchaseGoldCost: armyGoldPrices.infantry,
            purchasePopCost: armyProdPopPrices.infantry,
            effect: "+1000 Infantry",
            condition: 'Not enough gold'
        });
    } else if (!hasEnoughProdPopForInfantry) {
        availablePurchases.push({
            type: 'Infantry',
            purchaseGoldCost: armyGoldPrices.infantry,
            purchasePopCost: armyProdPopPrices.infantry,
            effect: "+1000 Infantry",
            condition: 'Not enough Productive Population'
        });
    }

    if (hasEnoughGoldForAssault && hasEnoughProdPopForAssault) {
        availablePurchases.push({
            type: 'Assault',
            purchaseGoldCost: armyGoldPrices.assault,
            purchasePopCost: armyProdPopPrices.assault,
            effect: "+1 Assault",
            condition: 'Can Build'
        });
    } else if (!hasEnoughGoldForAssault) {
        availablePurchases.push({
            type: 'Assault',
            purchaseGoldCost: armyGoldPrices.assault,
            purchasePopCost: armyProdPopPrices.assault,
            effect: "+1 Assault",
            condition: 'Not enough gold'
        });
    } else if (!hasEnoughProdPopForAssault) {
        availablePurchases.push({
            type: 'Assault',
            purchaseGoldCost: armyGoldPrices.assault,
            purchasePopCost: armyProdPopPrices.assault,
            effect: "+1 Assault",
            condition: 'Not enough Productive Population'
        });
    }

    if (hasEnoughGoldForAir && hasEnoughProdPopForAir) {
        availablePurchases.push({
            type: 'Air',
            purchaseGoldCost: armyGoldPrices.air,
            purchasePopCost: armyProdPopPrices.air,
            effect: "+1 Air",
            condition: 'Can Build'
        });
    } else if (!hasEnoughGoldForAir) {
        availablePurchases.push({
            type: 'Air',
            purchaseGoldCost: armyGoldPrices.air,
            purchasePopCost: armyProdPopPrices.air,
            effect: "+1 Air",
            condition: 'Not enough gold'
        });
    } else if (!hasEnoughProdPopForAir) {
        availablePurchases.push({
            type: 'Air',
            purchaseGoldCost: armyGoldPrices.air,
            purchasePopCost: armyProdPopPrices.air,
            effect: "+1 Air",
            condition: 'Not enough Productive Population'
        });
    }

    if (!isCoastal) {
        availablePurchases.push({
            type: 'Naval',
            purchaseGoldCost: armyGoldPrices.naval,
            purchasePopCost: armyProdPopPrices.naval,
            effect: "+1 Naval",
            condition: 'Not a Coastal Territory'
        });
    } else if (hasEnoughGoldForNaval && hasEnoughProdPopForNaval) {
        availablePurchases.push({
            type: 'Naval',
            purchaseGoldCost: armyGoldPrices.naval,
            purchasePopCost: armyProdPopPrices.naval,
            effect: "+1 Naval",
            condition: 'Can Build'
        });
    } else if (!hasEnoughGoldForNaval) {
        availablePurchases.push({
            type: 'Naval',
            purchaseGoldCost: armyGoldPrices.naval,
            purchasePopCost: armyProdPopPrices.naval,
            effect: "+1 Naval",
            condition: 'Not enough gold'
        });
    } else if (!hasEnoughProdPopForNaval) {
        availablePurchases.push({
            type: 'Naval',
            purchaseGoldCost: armyGoldPrices.naval,
            purchasePopCost: armyProdPopPrices.naval,
            effect: "+1 Naval",
            condition: 'Not enough Productive Population'
        });
    }

    return availablePurchases;
}

const UPGRADE_ROWS = Object.freeze([
    Object.freeze({ kind: "farm", type: "Farm", built: "farmsBuilt", max: maxFarms,
        effect: "Food cap. +10%", capped: "Max Farms Reached" }),
    Object.freeze({ kind: "forest", type: "Forest", built: "forestsBuilt", max: maxForests,
        effect: "Cons Mats cap. +10%", capped: "Max Forests Reached" }),
    Object.freeze({ kind: "oilWell", type: "Oil Well", built: "oilWellsBuilt", max: maxOilWells,
        effect: "Oil cap. +10%", capped: "Max Oil Wells Reached" }),
    Object.freeze({ kind: "fort", type: "Fort", built: "fortsBuilt", max: maxForts,
        effect: "Increase Defense Bonus", capped: "Max Forts Reached" })
]);

export function calculateAvailableUpgrades(territory) {
    //A besieged territory builds nothing (known-issue BQ). `condition` is not just a label:
    //every plus button in the upgrade window is enabled on `condition === "Can Build"` and
    //nothing else, so refusing here is what actually closes the window rather than merely
    //describing it. Saying WHY in the cell matters -- "Not enough gold" on a territory with
    //a full treasury would read as a rendering fault.
    const besieged = SIEGE_SUSPENDS_CONSTRUCTION && isUnderSiege(territory.territoryName);

    return UPGRADE_ROWS.map((row) => {
        const built = Number(territory[row.built]) || 0;
        const price = upgradePriceFor(row.kind, built + 1, territory.devIndex);
        const underCap = built < row.max;
        const hasGold = territory.goldForCurrentTerritory >= price.gold;
        const hasConsMats = territory.consMatsForCurrentTerritory >= price.consMats;

        let condition;
        if (besieged) {
            condition = "Under Siege";
        } else if (hasGold && hasConsMats && underCap) {
            condition = "Can Build";
        } else if (!hasGold && underCap) {
            condition = "Not enough gold";
        } else if (!hasConsMats && underCap) {
            condition = "Not enough Cons. Mats.";
        } else {
            condition = row.capped;
        }

        return {
            type: row.type,
            goldCost: price.gold,
            consMatsCost: price.consMats,
            effect: row.effect,
            condition: condition
        };
    });
}

function populateBuyTable(territory) {
    const multiplierValues = ["x1", "x10", "x100", "x1k"];

    document.getElementById(ids.subtitleBuyWindow).innerHTML = territory.territoryName;
    document.getElementById(ids.pricesBuyInfoColumn2).innerHTML = "0";
    document.getElementById(ids.pricesBuyInfoColumn4).innerHTML = "0";
    document.getElementById(ids.bottomBarBuyConfirmButton).innerHTML = "Cancel";
    setConfirmArmed(ids.bottomBarBuyConfirmButton, false);

    let simulatedPurchaseCosts;
    const buyTable = document.getElementById(ids.buyTable);
    let totalSimulatedPurchaseGoldPrice = 0;
    let totalSimulatedProdPopPrice = 0;

    let availablePurchases = calculateAvailablePurchases(territory);
    buyTable.innerHTML = "";

    availablePurchases.forEach((purchaseRow) => {
        const buyRow = document.createElement("div");
        buyRow.classList.add("buy-row");

        const imageBuyColumn = document.createElement("div");
        imageBuyColumn.classList.add("buy-column");
        let buyImage = document.createElement("img");
        buyImage.src = getImagePath(purchaseRow.type, purchaseRow.condition, territory, 1);
        imageBuyColumn.appendChild(buyImage);

        const buyColumn1 = document.createElement("div");
        buyColumn1.classList.add("buy-column");
        buyColumn1.textContent = purchaseRow.type;

        const buyColumn2 = document.createElement("div");
        buyColumn2.classList.add("buy-column");
        buyColumn2.textContent = purchaseRow.effect;

        const buyColumn3 = document.createElement("div");
        buyColumn3.classList.add("buy-column");
        buyColumn3.textContent = "0";

        const buyColumn4 = document.createElement("div");
        buyColumn4.classList.add("buy-column");
        buyColumn4.textContent = "0";

        const buyColumn5 = document.createElement("div");
        buyColumn5.classList.add("buy-column");
        buyColumn5.textContent = "";

        const buyColumn5Multiplier = document.createElement("div");
        buyColumn5Multiplier.classList.add("upgrade-column");
        buyColumn5Multiplier.classList.add("buyColumn5Multiplier");
        const imageMultiplier = stepperButton({
            kind: "cycle",
            enabled: purchaseRow.condition === "Can Build"
        });
        const multiplierQuantityTextBox = document.createElement("div");
        multiplierQuantityTextBox.classList.add("buy-column");
        multiplierQuantityTextBox.innerHTML = "x1";

        buyColumn5Multiplier.appendChild(imageMultiplier);
        buyColumn5Multiplier.appendChild(multiplierQuantityTextBox);

        const buyColumn5A = document.createElement("div");
        buyColumn5A.classList.add("buy-column");
        buyColumn5A.classList.add("column5A");
        const buyImageMinus = stepperButton({
            kind: "minus",
            enabled: purchaseRow.condition === "Can Build"
        });
        buyColumn5A.appendChild(buyImageMinus);

        const buyColumn5Wrapper = document.createElement("div");
        buyColumn5Wrapper.classList.add("buyColumn5-wrapper");

        const buyColumn5B = document.createElement("div");
        buyColumn5B.classList.add("buy-column");
        buyColumn5B.classList.add("buyColumn5B");
        const buyTextField = document.createElement("input");
        buyTextField.type = "text";
        buyTextField.value = "0";
        buyColumn5B.appendChild(buyTextField);

        const buyColumn5C = document.createElement("div");
        buyColumn5C.classList.add("buy-column");
        buyColumn5C.classList.add("buyColumn5C");
        const buyImagePlus = stepperButton({
            kind: "plus",
            enabled: purchaseRow.condition === "Can Build"
        });
        buyColumn5C.appendChild(buyImagePlus);

        buyRow.appendChild(imageBuyColumn);
        buyRow.appendChild(buyColumn1);
        buyRow.appendChild(buyColumn2);
        buyRow.appendChild(buyColumn3);
        buyRow.appendChild(buyColumn4);
        buyRow.appendChild(buyColumn5);
        buyColumn5Wrapper.appendChild(buyColumn5B);
        buyColumn5Wrapper.appendChild(buyColumn5C);
        buyColumn5.appendChild(buyColumn5Multiplier);
        buyColumn5.appendChild(buyColumn5A);
        buyColumn5.appendChild(buyColumn5Wrapper);

        buyTable.appendChild(buyRow);

        buyRow.addEventListener("mouseover", (e) => {
            tooltipPurchaseMilitaryRow(territory, availablePurchases, e);
        });
        buyRow.addEventListener("mouseout", () => {
            tooltip.hide();
        });

        const goldCost = purchaseRow.goldCost || 0;
        const prodPopulationCost = purchaseRow.prodPopulationCost || 0;

        totalPurchaseGoldPrice += goldCost;
        totalPopulationCost += prodPopulationCost;

        simulatedPurchaseCosts = incrementDecrementPurchases(buyTextField, -1, purchaseRow.type, true);

        imageMultiplier.addEventListener("click", (e) => {
            let currentMultiplierValue = multiplierQuantityTextBox.innerHTML;
            let currentIndex = multiplierValues.indexOf(currentMultiplierValue);

            if (currentIndex !== -1) {
                let nextIndex = (currentIndex + 1) % multiplierValues.length;
                let nextMultiplierValue = multiplierValues[nextIndex];
                multiplierQuantityTextBox.innerHTML = nextMultiplierValue;
            }
        });

        buyImageMinus.addEventListener("click", (e) => {
            if (isStepperEnabled(buyImageMinus)) {
                const multiplierText = multiplierQuantityTextBox.innerHTML;
                let multiplier = 1;

                if (multiplierText === "x10") {
                    multiplier = 10;
                } else if (multiplierText === "x100") {
                    multiplier = 100;
                } else if (multiplierText === "x1k") {
                    multiplier = 1000;
                }

                tooltipPurchaseMilitaryRow(territory, availablePurchases, e);
                if (parseInt(buyTextField.value) > 0) {
                    simulatedPurchaseCosts = incrementDecrementPurchases(buyTextField, -multiplier, purchaseRow.type, false);
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

                    document.getElementById(ids.pricesBuyInfoColumn2).innerHTML = totalPurchaseGoldPrice;
                    document.getElementById(ids.pricesBuyInfoColumn4).innerHTML = totalPopulationCost;

                    checkPurchaseRowsForGreyingOut(totalPurchaseGoldPrice, totalPopulationCost, simulatedCostsAllMilitary, buyTable, "minus");

                    if (atLeastOneRowWithValueGreaterThanOneForPurchases(buyTable)) {
                        setConfirmArmed(ids.bottomBarBuyConfirmButton, true);
                    } else if (allRowsWithValueZeroForPurchases(buyTable)) {
                        document.getElementById(ids.bottomBarBuyConfirmButton).innerHTML = "Cancel";
                        setConfirmArmed(ids.bottomBarBuyConfirmButton, false);
                    }
                }
            }
        });

        buyImagePlus.addEventListener("click", (e) => {
            if (isStepperEnabled(buyImagePlus)) {
                const multiplierText = multiplierQuantityTextBox.innerHTML;
                let multiplier = 1;

                if (multiplierText === "x10") {
                    multiplier = 10;
                } else if (multiplierText === "x100") {
                    multiplier = 100;
                } else if (multiplierText === "x1k") {
                    multiplier = 1000;
                }

                tooltipPurchaseMilitaryRow(territory, availablePurchases, e);
                simulatedPurchaseCosts = incrementDecrementPurchases(buyTextField, multiplier, purchaseRow.type, false);
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

                document.getElementById(ids.pricesBuyInfoColumn2).innerHTML = totalPurchaseGoldPrice;
                document.getElementById(ids.pricesBuyInfoColumn4).innerHTML = totalPopulationCost;

                totalSimulatedPurchaseGoldPrice = simulatedCostsAllMilitary[0] + simulatedCostsAllMilitary[2] + simulatedCostsAllMilitary[4] + simulatedCostsAllMilitary[6];
                totalSimulatedProdPopPrice = simulatedCostsAllMilitary[1] + simulatedCostsAllMilitary[3] + simulatedCostsAllMilitary[5] + simulatedCostsAllMilitary[7];

                checkPurchaseRowsForGreyingOut(totalPurchaseGoldPrice, totalPopulationCost, simulatedCostsAllMilitary, buyTable, "plus");

                if (atLeastOneRowWithValueGreaterThanOneForPurchases(buyTable)) {
                    document.getElementById(ids.bottomBarBuyConfirmButton).innerHTML = "Confirm";
                    setConfirmArmed(ids.bottomBarBuyConfirmButton, true);
                } else if (allRowsWithValueZeroForPurchases(buyTable)) {
                    setConfirmArmed(ids.bottomBarBuyConfirmButton, false);
                }
            }
        });
    });
}

function populateUpgradeTable(territory) {
    document.getElementById(ids.subtitleUpgradeWindow).innerHTML = territory.territoryName;
    document.getElementById(ids.pricesInfoColumn2).innerHTML = "0";
    document.getElementById(ids.pricesInfoColumn4).innerHTML = "0";
    document.getElementById(ids.bottomBarConfirmButton).innerHTML = "Cancel";
    setConfirmArmed(ids.bottomBarConfirmButton, false);

    const upgradeTable = document.getElementById(ids.upgradeTable);
    let simulatedCostsAll = [0, 0, 0, 0, 0, 0, 0, 0];
    let totalSimulatedGoldPrice = 0;
    let totalSimulatedConsMatsPrice = 0;
    const availableUpgrades = calculateAvailableUpgrades(territory);
    upgradeTable.innerHTML = "";

    availableUpgrades.forEach((upgradeRow) => {
        const row = document.createElement("div");
        row.classList.add("upgrade-row");

        const imageColumn = document.createElement("div");
        imageColumn.classList.add("upgrade-column");
        let image = document.createElement("img");
        image.src = getImagePath(upgradeRow.type, upgradeRow.condition, territory, 0);
        imageColumn.appendChild(image);

        const column1 = document.createElement("div");
        column1.classList.add("upgrade-column");
        column1.textContent = upgradeRow.type;

        const column2 = document.createElement("div");
        column2.classList.add("upgrade-column");
        column2.textContent = upgradeRow.effect;

        const column3 = document.createElement("div");
        column3.classList.add("upgrade-column");
        column3.textContent = "0";
        const column4 = document.createElement("div");
        column4.classList.add("upgrade-column");
        column4.textContent = "0";

        const column5 = document.createElement("div");
        column5.classList.add("upgrade-column");
        column5.textContent = "";

        const column5A = document.createElement("div");
        column5A.classList.add("upgrade-column");
        column5A.classList.add("column5A");
        const imageMinus = stepperButton({
            kind: "minus",
            enabled: upgradeRow.condition === "Can Build"
        });
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
        const imagePlus = stepperButton({
            kind: "plus",
            enabled: upgradeRow.condition === "Can Build"
        });
        column5C.appendChild(imagePlus);

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
            tooltip.hide();
        });

        const goldCost = upgradeRow.goldCost || 0;
        const consMatsCost = upgradeRow.consMatsCost || 0;

        totalGoldPrice += goldCost;
        totalConsMats += consMatsCost;

        simulatedCostsAll = nextUpgradeCostsFor(territory, upgradeTable);

        imageMinus.addEventListener("click", (e) => {
            if (isStepperEnabled(imageMinus)) {
                tooltipUpgradeTerritoryRow(territory, availableUpgrades, e);
                if (parseInt(textField.value) > 0) {
                    incrementDecrementUpgrades(textField, -1, upgradeRow.type, territory);
                    simulatedCostsAll = nextUpgradeCostsFor(territory, upgradeTable);

                    totalGoldPrice = calculateTotalGoldPrice(upgradeTable);
                    totalConsMats = calculateTotalConsMats(upgradeTable);

                    document.getElementById(ids.pricesInfoColumn2).innerHTML = totalGoldPrice;
                    document.getElementById(ids.pricesInfoColumn4).innerHTML = totalConsMats;

                    checkUpgradeRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, "minus", upgradeRow.type);

                    if (atLeastOneRowWithValueGreaterThanOneForUpgrades(upgradeTable)) {
                        setConfirmArmed(ids.bottomBarConfirmButton, true);
                    } else if (allRowsWithValueZeroForUpgrades(upgradeTable)) {
                        document.getElementById(ids.bottomBarConfirmButton).innerHTML = "Cancel";
                        setConfirmArmed(ids.bottomBarConfirmButton, false);
                    }
                }
            }
        });

        imagePlus.addEventListener("click", (e) => {
            if (isStepperEnabled(imagePlus)) {
                tooltipUpgradeTerritoryRow(territory, availableUpgrades, e);
                incrementDecrementUpgrades(textField, 1, upgradeRow.type, territory);
                simulatedCostsAll = nextUpgradeCostsFor(territory, upgradeTable);

                totalGoldPrice = calculateTotalGoldPrice(upgradeTable);
                totalConsMats = calculateTotalConsMats(upgradeTable);

                document.getElementById(ids.pricesInfoColumn2).innerHTML = totalGoldPrice;
                document.getElementById(ids.pricesInfoColumn4).innerHTML = totalConsMats;

                totalSimulatedGoldPrice = simulatedCostsAll[0] + simulatedCostsAll[2] + simulatedCostsAll[4] + simulatedCostsAll[6];
                totalSimulatedConsMatsPrice = simulatedCostsAll[1] + simulatedCostsAll[3] + simulatedCostsAll[5] + simulatedCostsAll[7];

                checkUpgradeRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, "plus", upgradeRow.type);

                if (atLeastOneRowWithValueGreaterThanOneForUpgrades(upgradeTable)) {
                    document.getElementById(ids.bottomBarConfirmButton).innerHTML = "Confirm";
                    setConfirmArmed(ids.bottomBarConfirmButton, true);
                } else if (allRowsWithValueZeroForUpgrades(upgradeTable)) {
                    setConfirmArmed(ids.bottomBarConfirmButton, false);
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
        let topTableGold = document.querySelector(compound.topTableGold).innerHTML;
        let topTableProdPop = document.querySelector(compound.topTablePopulation).innerHTML;
        topTableProdPop = stripProdPopFromTopTable(topTableProdPop);
        let rowChildIndex = findBuyRowPosition(buyTextField);
        const unitType = rowChildIndex === 1
            ? 'infantry'
            : rowChildIndex === 2
                ? 'assault'
                : rowChildIndex === 3
                    ? 'air'
                    : 'naval';
        let totalGoldSpentSoFar =
            ((document.querySelector(compound.buyRowQuantityInput(1)).value * armyGoldPrices.infantry) +
            (document.querySelector(compound.buyRowQuantityInput(2)).value * armyGoldPrices.assault) +
            (document.querySelector(compound.buyRowQuantityInput(3)).value * armyGoldPrices.air) +
            (document.querySelector(compound.buyRowQuantityInput(4)).value * armyGoldPrices.naval)) -
            (document.querySelector(compound.buyRowQuantityInput(rowChildIndex)).value * armyGoldPrices[unitType]);
        let totalProdPopSpentSoFar = (document.querySelector(compound.buyRowQuantityInput(1)).value * armyProdPopPrices.infantry) + (document.querySelector(compound.buyRowQuantityInput(2)).value * armyProdPopPrices.assault) + (document.querySelector(compound.buyRowQuantityInput(3)).value * armyProdPopPrices.air) + (document.querySelector(compound.buyRowQuantityInput(4)).value * armyProdPopPrices.naval);

        currentValueQuantity = adjustValueIfOverMax(topTableGold, topTableProdPop, rowChildIndex, currentValueQuantity, totalGoldSpentSoFar, totalProdPopSpentSoFar);

        buyTextField.value = currentValueQuantity;
    }

    let currentValueQuantityTemp = currentValueQuantity;

    const buyRow = buyTextField.parentNode.parentNode.parentNode.parentNode;
    const goldCostElement = buyRow.querySelector(".buy-column:nth-child(4)");
    const prodPopCostElement = buyRow.querySelector(".buy-column:nth-child(5)");

    let purchaseGoldCost;
    let purchaseGoldBaseCost;
    let prodPopCost;
    let prodPopBaseCost;

    let simulationPurchaseCosts = [];

    switch (purchaseType) {
        case "Infantry":
            purchaseGoldCost = armyGoldPrices.infantry * currentValueQuantityTemp;
            purchaseGoldBaseCost = armyGoldPrices.infantry;
            prodPopCost = armyProdPopPrices.infantry * currentValueQuantityTemp;
            prodPopBaseCost = armyProdPopPrices.infantry;
            break;
        case "Assault":
            purchaseGoldCost = armyGoldPrices.assault * currentValueQuantityTemp;
            purchaseGoldBaseCost = armyGoldPrices.assault;
            prodPopCost = armyProdPopPrices.assault * currentValueQuantityTemp;
            prodPopBaseCost = armyProdPopPrices.assault;
            break;
        case "Air":
            purchaseGoldCost = armyGoldPrices.air * currentValueQuantityTemp;
            purchaseGoldBaseCost = armyGoldPrices.air;
            prodPopCost = armyProdPopPrices.air * currentValueQuantityTemp;
            prodPopBaseCost = armyProdPopPrices.air;
            break;
        case "Naval":
            purchaseGoldCost = armyGoldPrices.naval * currentValueQuantityTemp;
            purchaseGoldBaseCost = armyGoldPrices.naval;
            prodPopCost = armyProdPopPrices.naval * currentValueQuantityTemp;
            prodPopBaseCost = armyProdPopPrices.naval;
            break;
    }

    if (currentValueQuantity === 0) {
        purchaseGoldCost = 0;
        prodPopCost = 0;
    }

    if (!simOnly) {
        goldCostElement.textContent = purchaseGoldCost;
        prodPopCostElement.textContent = formatNumbersToKMB(prodPopCost, 1);
    }

    currentValueQuantityTemp += Math.abs(increment);
    const simulatedPurchaseGoldCost = purchaseGoldCost + purchaseGoldBaseCost;
    const simulatedProdPopCost = prodPopCost + prodPopBaseCost;
    const simulatedPurchaseType = purchaseType;
    simulationPurchaseCosts.push(simulatedPurchaseGoldCost);
    simulationPurchaseCosts.push(simulatedProdPopCost);
    simulationPurchaseCosts.push(simulatedPurchaseType);

    return simulationPurchaseCosts;
}

function incrementDecrementUpgrades(textField, increment, upgradeType, territory) {
    let currentValueQuantity = parseInt(textField.value) + increment;
    if (currentValueQuantity < 0) {
        currentValueQuantity = 0;
    }
    textField.value = currentValueQuantity.toString();

    const kind = UPGRADE_KIND_BY_TYPE[upgradeType];
    const upgradeRow = textField.parentNode.parentNode.parentNode.parentNode;
    const goldCostElement = upgradeRow.querySelector(".upgrade-column:nth-child(4)");
    const consMatsCostElement = upgradeRow.querySelector(".upgrade-column:nth-child(5)");

    const built = Number(territory[UPGRADE_BUILT_FIELD_BY_TYPE[upgradeType]]) || 0;
    const price = currentValueQuantity === 0
        ? { gold: 0, consMats: 0 }
        : upgradeOrderPriceFor(kind, built, currentValueQuantity, territory.devIndex);

    goldCostElement.textContent = price.gold;
    consMatsCostElement.textContent = price.consMats;
}

const UPGRADE_KIND_BY_TYPE = Object.freeze({
    "Farm": "farm", "Forest": "forest", "Oil Well": "oilWell", "Fort": "fort"
});
const UPGRADE_BUILT_FIELD_BY_TYPE = Object.freeze({
    "Farm": "farmsBuilt", "Forest": "forestsBuilt", "Oil Well": "oilWellsBuilt", "Fort": "fortsBuilt"
});

function nextUpgradeCostsFor(territory, upgradeTable) {
    const costs = [0, 0, 0, 0, 0, 0, 0, 0];
    const rows = upgradeTable.getElementsByClassName("upgrade-row");
    UPGRADE_ROWS.forEach((row, index) => {
        const field = rows[index]?.querySelector(".column5B input");
        const inOrder = parseInt(field?.value ?? "0") || 0;
        const built = Number(territory[row.built]) || 0;
        const price = upgradePriceFor(row.kind, built + inOrder + 1, territory.devIndex);
        costs[index * 2] = price.gold;
        costs[(index * 2) + 1] = price.consMats;
    });
    return costs;
}

function getImagePath(type, condition, territory, mode) {
    if (mode === 0) {
        const maxFarms = 5;
        const maxForests = 5;
        const maxOilWells = 5;
        const maxForts = 5;

        if (type === "Farm") {
            if (condition === "Can Build" && territory.farmsBuilt < maxFarms) {
                return 'resources/farmIcon.png';
            } else {
                return 'resources/farmIconGrey.png';
            }
        } else if (type === "Oil Well") {
            if (condition === "Can Build" && territory.oilWellsBuilt < maxOilWells) {
                return 'resources/oilWellIcon.png';
            } else {
                return 'resources/oilWellIconGrey.png';
            }
        } else if (type === "Forest") {
            if (condition === "Can Build" && territory.forestsBuilt < maxForests) {
                return 'resources/forestIcon.png';
            } else {
                return 'resources/forestIconGrey.png';
            }
        } else if (type === "Fort") {
            if (condition === "Can Build" && territory.fortsBuilt < maxForts) {
                return 'resources/fortIcon.png';
            } else {
                return 'resources/fortIconGrey.png';
            }
        }
    } else if (mode === 1) {
        if (type === "Infantry") {
            if (condition === "Can Build") {
                return 'resources/infantryIcon.png';
            } else {
                return 'resources/infantryIconGrey.png';
            }
        }
        if (type === "Assault") {
            if (condition === "Can Build") {
                return 'resources/assaultIcon.png';
            } else {
                return 'resources/assaultIconGrey.png';
            }
        } else if (type === "Air") {
            if (condition === "Can Build") {
                return 'resources/airIcon.png';
            } else {
                return 'resources/airIconGrey.png';
            }
        } else if (type === "Naval") {
            if (condition === "Can Build") {
                return 'resources/navalIcon.png';
            } else {
                return 'resources/navalIconGrey.png';
            }
        }
    }
}

function calculateTotalGoldPrice(upgradeTable) {
    let totalGold = 0;
    const goldElements = upgradeTable.querySelectorAll(".upgrade-column:nth-child(4)");
    goldElements.forEach((goldElement) => {
        const goldCost = parseInt(goldElement.textContent) || 0;
        totalGold += goldCost;
    });
    return totalGold;
}

const BUY_ROW_TYPES = ["infantry", "assault", "air", "naval"];

function buyRowQuantities(buyTable) {
    const rows = buyTable.getElementsByClassName(classNames.buyRow);
    return BUY_ROW_TYPES.map((type, index) => {
        const field = rows[index]
            ? rows[index].querySelector(`.${classNames.buyQuantity} input`)
            : null;
        return { type: type, quantity: parseInt(field && field.value) || 0 };
    });
}

function calculateTotalPurchaseGoldPrice(buyTable) {
    return buyRowQuantities(buyTable).reduce(
        (total, row) => total + (row.quantity * armyGoldPrices[row.type]), 0);
}

function calculateTotalPopulationCost(buyTable) {
    return buyRowQuantities(buyTable).reduce(
        (total, row) => total + (row.quantity * armyProdPopPrices[row.type]), 0);
}

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

    const simulatedGoldElements = [simulatedCostsAllMilitary[0], simulatedCostsAllMilitary[2], simulatedCostsAllMilitary[4], simulatedCostsAllMilitary[6]];
    const simulatedProdPopElements = [simulatedCostsAllMilitary[1], simulatedCostsAllMilitary[3], simulatedCostsAllMilitary[5], simulatedCostsAllMilitary[7]];

    let amountToAdd;
    let popAmountToAdd;

    if (button === "plus") {
        simulatedGoldElements.forEach((simulatedGoldElement, index) => {

            switch (index) {
                case 0:
                    amountToAdd = armyGoldPrices.infantry;
                    break;
                case 1:
                    amountToAdd = armyGoldPrices.assault;
                    break;
                case 2:
                    amountToAdd = armyGoldPrices.air;
                    break;
                case 3:
                    amountToAdd = armyGoldPrices.naval;
                    break;
            }

            if (Math.ceil(totalPlayerResources[0].totalGold) < totalGoldPrice + amountToAdd) {
                const buyRowIndex = index + 1;
                const buyRow = buyTable.querySelector(`.buy-row:nth-child(${buyRowIndex})`);

                const imageElement = buyRow.querySelector('.buy-column:first-child img');
                if (imageElement) {
                    if (!imageElement.src.includes('Grey.png')) {
                        imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                    }
                }

                const plusButton = buyRow.querySelector('.buyColumn5C .stepper-button');
                if (plusButton) {
                    setStepperEnabled(plusButton, false);
                }
            }
        });
        simulatedProdPopElements.forEach((simulatedProdPopElement, index) => {

            switch (index) {
                case 0:
                    popAmountToAdd = armyProdPopPrices.infantry;
                    break;
                case 1:
                    popAmountToAdd = armyProdPopPrices.assault;
                    break;
                case 2:
                    popAmountToAdd = armyProdPopPrices.air;
                    break;
                case 3:
                    popAmountToAdd = armyProdPopPrices.naval;
                    break;
            }

            if (Math.ceil(totalPlayerResources[0].totalProdPop) < totalProdPopCost + amountToAdd) {
                const buyRowIndex = index + 1;
                const buyRow = buyTable.querySelector(`.buy-row:nth-child(${buyRowIndex})`);

                const imageElement = buyRow.querySelector('.buy-column:first-child img');
                if (imageElement) {
                    if (!imageElement.src.includes('Grey.png')) {
                        imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                    }
                }
                const plusButton = buyRow.querySelector('.buyColumn5C .stepper-button');
                if (plusButton) {
                    setStepperEnabled(plusButton, false);
                }
            }
        });
    } else if (button === "minus") {
        simulatedGoldElements.forEach((simulatedGoldElement, index) => {

            switch (index) {
                case 0:
                    amountToAdd = armyGoldPrices.infantry;
                    popAmountToAdd = armyProdPopPrices.infantry;
                    break;
                case 1:
                    amountToAdd = armyGoldPrices.assault;
                    popAmountToAdd = armyProdPopPrices.assault;
                    break;
                case 2:
                    amountToAdd = armyGoldPrices.air;
                    popAmountToAdd = armyProdPopPrices.air;
                    break;
                case 3:
                    amountToAdd = armyGoldPrices.naval;
                    popAmountToAdd = armyProdPopPrices.naval;
                    break;
            }

            const buyRowIndex = index + 1;
            const buyRow = buyTable.querySelector(`.buy-row:nth-child(${buyRowIndex})`);

            const imageElement = buyRow.querySelector('.buy-column:first-child img');

            const plusButton = buyRow.querySelector('.buyColumn5C .stepper-button');

            if (
                Math.ceil(totalPlayerResources[0].totalGold) >= totalGoldPrice + amountToAdd &&
                Math.ceil(totalPlayerResources[0].totalProdPop) >= totalProdPopCost + amountToAdd
            ) {

                if (imageElement && imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('Grey.png', '.png');
                }
                setStepperEnabled(plusButton, true);
            }
        });
    }
}

function checkUpgradeRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, button, type) {
    let column5CPlus;
    let firstRowImage;
    const simulatedGoldElements = [simulatedCostsAll[0], simulatedCostsAll[2], simulatedCostsAll[4], simulatedCostsAll[6]];
    const simulatedConsMatsElements = [simulatedCostsAll[1], simulatedCostsAll[3], simulatedCostsAll[5], simulatedCostsAll[7]];

    if (button === "plus") {
        simulatedGoldElements.forEach((simulatedGoldElement, index) => {
            if (territory.goldForCurrentTerritory - totalGoldPrice < simulatedGoldElement) {
                const rowIndex = index + 1;
                const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);

                const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
                if (imageElement) {
                    if (!imageElement.src.includes('Grey.png')) {
                        imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                    }
                }

                const plusButton = upgradeRow.querySelector('.column5C .stepper-button');
                if (plusButton) {
                    setStepperEnabled(plusButton, false);
                }
            }
        });
        simulatedConsMatsElements.forEach((simulatedConsMatsElement, index) => {
            if (territory.consMatsForCurrentTerritory - totalConsMats < simulatedConsMatsElement) {
                const rowIndex = index + 1;
                const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);

                const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
                if (imageElement) {
                    if (!imageElement.src.includes('Grey.png')) {
                        imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                    }
                }
                const plusButton = upgradeRow.querySelector('.column5C .stepper-button');
                if (plusButton) {
                    setStepperEnabled(plusButton, false);
                }
            }
        });
        if (type === "Farm") {
            if (parseInt(upgradeTable.querySelector(`.upgrade-row:nth-child(1) .column5B input`).value) + territory.farmsBuilt >= 5) {
                firstRowImage = upgradeTable.querySelector(`.upgrade-row:nth-child(1) img`);
                if (!firstRowImage.src.includes('Grey.png')) {
                    firstRowImage.src = firstRowImage.src.replace('.png', 'Grey.png');
                }

                column5CPlus = upgradeTable.querySelector(`.upgrade-row:nth-child(1) .column5C .stepper-button`);
                setStepperEnabled(column5CPlus, false);
            }
        } else if (type === "Forest") {
            if (parseInt(upgradeTable.querySelector(`.upgrade-row:nth-child(2) .column5B input`).value) + territory.forestsBuilt >= 5) {
                firstRowImage = upgradeTable.querySelector(`.upgrade-row:nth-child(2) img`);
                if (!firstRowImage.src.includes('Grey.png')) {
                    firstRowImage.src = firstRowImage.src.replace('.png', 'Grey.png');
                }
                column5CPlus = upgradeTable.querySelector(`.upgrade-row:nth-child(2) .column5C .stepper-button`);
                setStepperEnabled(column5CPlus, false);
            }
        } else if (type === "Oil Well") {
            if (parseInt(upgradeTable.querySelector(`.upgrade-row:nth-child(3) .column5B input`).value) + territory.oilWellsBuilt >= 5) {
                firstRowImage = upgradeTable.querySelector(`.upgrade-row:nth-child(3) img`);
                if (!firstRowImage.src.includes('Grey.png')) {
                    firstRowImage.src = firstRowImage.src.replace('.png', 'Grey.png');
                }
                column5CPlus = upgradeTable.querySelector(`.upgrade-row:nth-child(3) .column5C .stepper-button`);
                setStepperEnabled(column5CPlus, false);
            }
        } else if (type === "Fort") {
            if (parseInt(upgradeTable.querySelector(`.upgrade-row:nth-child(4) .column5B input`).value) + territory.fortsBuilt >= 5) {
                firstRowImage = upgradeTable.querySelector(`.upgrade-row:nth-child(4) img`);
                if (!firstRowImage.src.includes('Grey.png')) {
                    firstRowImage.src = firstRowImage.src.replace('.png', 'Grey.png');
                }
                column5CPlus = upgradeTable.querySelector(`.upgrade-row:nth-child(4) .column5C .stepper-button`);
                setStepperEnabled(column5CPlus, false);
            }
        }
    } else if (button === "minus") {
        simulatedGoldElements.forEach((simulatedGoldElement, index) => {
            const rowIndex = index + 1;
            const upgradeRow = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex})`);
            const upgradeRowTextField = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex}) .column5B input`);
            const upgradeRowType = upgradeTable.querySelector(`.upgrade-row:nth-child(${rowIndex}) .upgrade-column:nth-child(2)`);

            const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');

            const plusButton = upgradeRow.querySelector('.column5C .stepper-button');

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

                if (imageElement && imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('Grey.png', '.png');
                }
                setStepperEnabled(plusButton, true);
            }
        });
    }
}

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
    let purchaseArray = [];
    const buyRows = buyTable.getElementsByClassName("buy-row");
    for (let i = 0; i < buyRows.length; i++) {
        const buyTextField = buyRows[i].querySelector(".buyColumn5B input");
        purchaseArray.push(buyTextField.value);
        buyTextField.value = "0";
    }

    purchaseArray[0] *= (vehicleArmyPersonnelWorth.infantry * 1000);

    turnGainsArrayPlayer.changeGold += -totalGoldCost;
    turnGainsArrayPlayer.changeProdPop += -totalProdPopCost;

    totalPlayerResources[0].totalGold -= totalGoldCost;
    totalPlayerResources[0].totalProdPop -= totalProdPopCost;
    totalPlayerResources[0].totalArmy += parseInt(purchaseArray[0]);
    totalPlayerResources[0].totalInfantry += parseInt(purchaseArray[0]);
    totalPlayerResources[0].totalAssault += parseInt(purchaseArray[1]);
    totalPlayerResources[0].totalAir += parseInt(purchaseArray[2]);
    totalPlayerResources[0].totalNaval += parseInt(purchaseArray[3]);

    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === territory.uniqueId) {
            allTerritories()[i].infantryForCurrentTerritory += parseInt(purchaseArray[0]);
            allTerritories()[i].assaultForCurrentTerritory += parseInt(purchaseArray[1]);
            allTerritories()[i].airForCurrentTerritory += parseInt(purchaseArray[2]);
            allTerritories()[i].navalForCurrentTerritory += parseInt(purchaseArray[3]);
            allTerritories()[i].oilDemand += (oilRequirements.assault * parseInt(purchaseArray[1]));
            allTerritories()[i].oilDemand += (oilRequirements.air * parseInt(purchaseArray[2]));
            allTerritories()[i].oilDemand += (oilRequirements.naval * parseInt(purchaseArray[3]));
            allTerritories()[i].armyForCurrentTerritory += parseInt(purchaseArray[0]);
        }
    }

    turnGainsArrayPlayer.changeOilDemand += (oilRequirements.assault * parseInt(purchaseArray[1])) + (oilRequirements.air * parseInt(purchaseArray[2])) + (oilRequirements.naval * parseInt(purchaseArray[3]));
    turnGainsArrayPlayer.changeFoodConsumption += parseInt(purchaseArray[0]) + (vehicleArmyPersonnelWorth.assault * parseInt(purchaseArray[1])) + (vehicleArmyPersonnelWorth.air * parseInt(purchaseArray[2])) + (vehicleArmyPersonnelWorth.naval * parseInt(purchaseArray[3]));
    turnGainsArrayPlayer.changeArmy += parseInt(purchaseArray[0]) + (vehicleArmyPersonnelWorth.assault * parseInt(purchaseArray[1])) + (vehicleArmyPersonnelWorth.air * parseInt(purchaseArray[2])) + (vehicleArmyPersonnelWorth.naval * parseInt(purchaseArray[3]));
    turnGainsArrayPlayer.changeInfantry += parseInt(purchaseArray[0]);
    turnGainsArrayPlayer.changeAssault += parseInt(purchaseArray[1]);
    turnGainsArrayPlayer.changeAir += parseInt(purchaseArray[2]);
    turnGainsArrayPlayer.changeNaval += parseInt(purchaseArray[3]);

    checkForMinusAndTransferMoneyFromRichEnoughTerritories(territory, totalGoldCost);
    checkForMinusAndTransferProdPopFromPopulatedEnoughTerritories(territory, totalProdPopCost);

    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === territory.uniqueId) {
            if (allTerritories()[i].uniqueId === currentSelectedPath.getAttribute("uniqueid")) {
                bottomTable.update({
                    gold: Math.ceil(territory.goldForCurrentTerritory).toString(),
                    population: formatNumbersToKMB(territory.productiveTerritoryPop) + " (" + formatNumbersToKMB(territory.territoryPopulation) + ")",
                    army: formatNumbersToKMB(territory.armyForCurrentTerritory),
                });
                break;
            }
        }
    }

    topTable.update({
        gold: Math.ceil(totalPlayerResources[0].totalGold).toString(),
        population: formatNumbersToKMB(totalPlayerResources[0].totalProdPop) + " (" + formatNumbersToKMB(totalPlayerResources[0].totalPop) + ")",
        army: formatNumbersToKMB(totalPlayerResources[0].totalArmy),
    });

    totalGoldPrice = 0;
    totalConsMats = 0;

    totalPlayerResources[0].totalUseableAssault = 0;
    totalPlayerResources[0].totalUseableAir = 0;
    totalPlayerResources[0].totalUseableNaval = 0;
    setPlayerUseableNotUseableWeaponsDueToOilDemand(allTerritories(), currentlySelectedTerritoryForPurchases);

    drawUITable(document.getElementById(ids.uiTable), 2);
}

export function addPlayerUpgrades(upgradeTable, territory, totalGoldCost, totalConsMatsCost) {
    let upgradeArray = [];

    let totalOilCapacityTemp = territory.oilCapacity;
    let totalFoodCapacityTemp = territory.foodCapacity;
    let totalConsMatsTemp = territory.consMatsCapacity;

    const rows = upgradeTable.getElementsByClassName("upgrade-row");
    for (let i = 0; i < rows.length; i++) {
        const textField = rows[i].querySelector(".column5B input");
        upgradeArray.push(textField.value);
        textField.value = "0";
    }

    totalPlayerResources[0].totalGold -= totalGoldCost;
    totalPlayerResources[0].totalConsMats -= totalConsMatsCost;

    turnGainsArrayPlayer.changeGold += -totalGoldCost;
    turnGainsArrayPlayer.changeConsMats += -totalConsMatsCost;

    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === territory.uniqueId) {
            allTerritories()[i].goldForCurrentTerritory -= totalGoldCost;
            allTerritories()[i].consMatsForCurrentTerritory -= totalConsMatsCost;
            const target = allTerritories()[i];
            const boughtByKind = {
                farm: parseInt(upgradeArray[0]) || 0,
                forest: parseInt(upgradeArray[1]) || 0,
                oilWell: parseInt(upgradeArray[2]) || 0,
                fort: parseInt(upgradeArray[3]) || 0
            };

            for (const [kind, bought] of Object.entries(boughtByKind)) {
                const patch = applyUpgrade(target, kind, bought);
                Object.assign(target, patch);
            }

            turnGainsArrayPlayer.changeFoodCapacity += target.foodCapacity - totalFoodCapacityTemp;
            turnGainsArrayPlayer.changeConsMatsCapacity += target.consMatsCapacity - totalConsMatsTemp;
            turnGainsArrayPlayer.changeOilCapacity += target.oilCapacity - totalOilCapacityTemp;
        }
    }

    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === territory.uniqueId) {
            if (allTerritories()[i].uniqueId === currentSelectedPath.getAttribute("uniqueid")) {
                bottomTable.update({
                    gold: Math.ceil(territory.goldForCurrentTerritory).toString(),
                    consMats: Math.ceil(territory.consMatsForCurrentTerritory).toString(),
                });
                break;
            }
        }
    }

    topTable.update({
        gold: Math.ceil(totalPlayerResources[0].totalGold).toString(),
        consMats: Math.ceil(totalPlayerResources[0].totalConsMats).toString(),
    });

    totalGoldPrice = 0;
    totalConsMats = 0;

    drawUITable(document.getElementById(ids.uiTable), 1);
}

function calculateInitialAssaultAirNavalForTerritory(armyTerritory, oilTerritory, territory) {
    let initialValue = Math.ceil(armyTerritory);
    oilTerritory = Math.ceil(oilTerritory);

    const initialDistribution = {
        naval: 0,
        air: 0,
        assault: 0,
        infantry: 0,
    };

    const infantryAllocation = Math.floor(initialValue * initialArmyDistribution.infantryShare);
    initialDistribution.infantry = infantryAllocation;
    let remainingArmyValue = initialValue - infantryAllocation;

    const maxNavalOil = Math.floor(oilTerritory * initialArmyDistribution.naval.oilShare);
    const maxNavalArmy = Math.floor(remainingArmyValue * initialArmyDistribution.naval.armyShare);
    if (territory.getAttribute("isCoastal") === "true") {
        initialDistribution.naval = Math.min(
            Math.min(
                Math.floor(maxNavalOil / oilRequirements.naval),
                Math.floor(maxNavalArmy / vehicleArmyPersonnelWorth.naval)
            ),
            Math.floor(remainingArmyValue / vehicleArmyPersonnelWorth.naval)
        );
        remainingArmyValue -= initialDistribution.naval * vehicleArmyPersonnelWorth.naval;
    }

    const maxAirOil = Math.floor(oilTerritory * initialArmyDistribution.air.oilShare);
    const maxAirArmy = Math.floor(remainingArmyValue * initialArmyDistribution.air.armyShare);
    initialDistribution.air = Math.min(
        Math.min(
            Math.floor(maxAirOil / oilRequirements.air),
            Math.floor(maxAirArmy / vehicleArmyPersonnelWorth.air)
        ),
        Math.floor(remainingArmyValue / vehicleArmyPersonnelWorth.air)
    );
    remainingArmyValue -= initialDistribution.air * vehicleArmyPersonnelWorth.air;
    const maxAssaultOil = Math.floor(oilTerritory * initialArmyDistribution.assault.oilShare);
    const maxAssaultArmy = Math.floor(remainingArmyValue * initialArmyDistribution.assault.armyShare);
    initialDistribution.assault = Math.min(
        Math.min(
            Math.floor(maxAssaultOil / oilRequirements.assault),
            Math.floor(maxAssaultArmy / vehicleArmyPersonnelWorth.assault)
        ),
        Math.floor(remainingArmyValue / vehicleArmyPersonnelWorth.assault)
    );
    remainingArmyValue -= initialDistribution.assault * vehicleArmyPersonnelWorth.assault;

    initialDistribution.infantry += Math.floor(remainingArmyValue);

    return initialDistribution;
}

export function setPlayerUseableNotUseableWeaponsDueToOilDemand(mainArray, territory) {
    const target = mainArray.find(candidate => candidate.uniqueId === territory.uniqueId);
    if (!target) {
        return;
    }

    const useable = useableUnitsFor(target);
    target.useableAssault = useable.useableAssault;
    target.useableAir = useable.useableAir;
    target.useableNaval = useable.useableNaval;
    target.armyForCurrentTerritory = useable.armyForCurrentTerritory;

    if (currentSelectedPath && target.uniqueId === currentSelectedPath.getAttribute("uniqueid")) {
        bottomTable.update({ army: formatNumbersToKMB(territory.armyForCurrentTerritory) });
    }

    let totalArmy = 0;
    let totalUseableAssault = 0;
    let totalUseableAir = 0;
    let totalUseableNaval = 0;
    for (const candidate of mainArray) {
        if (candidate.dataName === playerCountryName()) {
            totalUseableAssault += candidate.useableAssault;
            totalUseableAir += candidate.useableAir;
            totalUseableNaval += candidate.useableNaval;
            totalArmy += armyTotalFor(candidate);
        }
    }

    totalPlayerResources[0].totalArmy = totalArmy;
    totalPlayerResources[0].totalUseableAssault = totalUseableAssault;
    totalPlayerResources[0].totalUseableAir = totalUseableAir;
    totalPlayerResources[0].totalUseableNaval = totalUseableNaval;

    topTable.update({ army: formatNumbersToKMB(totalPlayerResources[0].totalArmy) });
}

function checkForMinusAndTransferMoneyFromRichEnoughTerritories(territory, goldCost) {
    let descendingGoldArray = [];

    if (territory.goldForCurrentTerritory < goldCost) {
        for (let i = 0; i < allTerritories().length; i++) {
            for (let j = 0; j < playerOwnedTerritories.length; j++) {
                if (allTerritories()[i].uniqueId !== territory.uniqueId && allTerritories()[i].uniqueId === playerOwnedTerritories[j].getAttribute("uniqueid")) {
                    descendingGoldArray.push([allTerritories()[i].goldForCurrentTerritory, allTerritories()[i].uniqueId]);
                }
            }
        }

        descendingGoldArray.sort((a, b) => b[0] - a[0]);
        let remainingGold = goldCost - territory.goldForCurrentTerritory;
        for (const [goldAmount, uniqueId] of descendingGoldArray) {
            const transferAmount = Math.min(
                remainingGold,
                goldAmount,
                Math.abs(goldAmount)
            );

            for (let i = 0; i < allTerritories().length; i++) {
                if (allTerritories()[i].uniqueId === uniqueId) {
                    allTerritories()[i].goldForCurrentTerritory -= transferAmount;
                    territory.goldForCurrentTerritory += transferAmount;
                }
            }

            remainingGold = goldCost - territory.goldForCurrentTerritory;

            if (remainingGold <= 0) {
                break;
            }
        }
    }

    territory.goldForCurrentTerritory = Math.max(0, territory.goldForCurrentTerritory - goldCost);
}

function checkForMinusAndTransferProdPopFromPopulatedEnoughTerritories(territory, prodPopCost) {
    let descendingPopArray = [];

    if (territory.productiveTerritoryPop < prodPopCost) {

        for (let i = 0; i < allTerritories().length; i++) {
            for (let j = 0; j < playerOwnedTerritories.length; j++) {
                if (allTerritories()[i].uniqueId !== territory.uniqueId && allTerritories()[i].uniqueId === playerOwnedTerritories[j].getAttribute("uniqueid")) {
                    descendingPopArray.push([allTerritories()[i].productiveTerritoryPop, allTerritories()[i].uniqueId]);
                }
            }
        }

        descendingPopArray.sort((a, b) => b[0] - a[0]);

        let remainingPop = prodPopCost - territory.productiveTerritoryPop;

        for (const [popAmount, uniqueId] of descendingPopArray) {
            const transferAmount = Math.min(
                remainingPop,
                popAmount,
                Math.abs(popAmount)
            );

            for (let i = 0; i < allTerritories().length; i++) {
                if (allTerritories()[i].uniqueId === uniqueId) {
                    allTerritories()[i].productiveTerritoryPop -= transferAmount;
                    territory.productiveTerritoryPop += transferAmount;
                }
            }

            remainingPop = prodPopCost - territory.productiveTerritoryPop;

            if (remainingPop <= 0) {
                break;
            }
        }
    }
    territory.productiveTerritoryPop = Math.max(0, territory.productiveTerritoryPop - prodPopCost);
}

export function calculateTerritoryStrengths(territories) {
    const countryStrengths = {};

    for (const territory of territories) {
        const {
            uniqueId,
            territoryName,
            area,
            goldForCurrentTerritory,
            oilForCurrentTerritory,
            consMatsForCurrentTerritory,
            foodForCurrentTerritory,
            devIndex,
            territoryPopulation,
            continentModifier,
            armyForCurrentTerritory,
            dataName
        } = territory;

        const strengthValue = calculateTerritoryStrength(area, goldForCurrentTerritory, oilForCurrentTerritory, consMatsForCurrentTerritory, foodForCurrentTerritory, devIndex, territoryPopulation, continentModifier, armyForCurrentTerritory);

        if (countryStrengths[dataName]) {
            countryStrengths[dataName] += strengthValue;
        } else {
            countryStrengths[dataName] = strengthValue;
        }
    }

    const strengths = Object.values(countryStrengths);
    const minStrength = Math.min(...strengths);
    const maxStrength = Math.max(...strengths);

    const normalizedCountries = Object.entries(countryStrengths)
        .map(([countryName, strengthValue]) => {
            const normalizedValue = (strengthValue - minStrength) / (maxStrength - minStrength) * 10000;
            return [countryName, Math.round(normalizedValue)];
        })
        .sort((a, b) => b[1] - a[1]);

    return normalizedCountries;
}

function calculateTerritoryStrength(area, goldForCurrentTerritory, oilForCurrentTerritory, consMatsForCurrentTerritory, foodForCurrentTerritory, devIndex, territoryPopulation, continentModifier, armyForCurrentTerritory) {
    const areaScale = territoryStrengthScales.area;
    const resourceScale = territoryStrengthScales.resources;
    const devIndexScale = territoryStrengthScales.devIndex;
    const populationScale = territoryStrengthScales.population;
    const continentModifierScale = territoryStrengthScales.continentModifier;
    const armyScale = territoryStrengthScales.army;

    const scaledArea = area * areaScale;
    const scaledResources = (goldForCurrentTerritory + oilForCurrentTerritory + consMatsForCurrentTerritory + foodForCurrentTerritory) * resourceScale;
    const scaledDevIndex = devIndex * devIndexScale;
    const scaledPopulation = territoryPopulation * populationScale;
    const scaledContinentModifier = continentModifier * continentModifierScale;
    const scaledArmy = armyForCurrentTerritory * armyScale;

    const strengthValue = scaledArea + scaledResources + scaledDevIndex + scaledPopulation + scaledContinentModifier + scaledArmy;
    const roundedStrength = Math.round(strengthValue);

    return roundedStrength;
}

export function setDemandArray(value) {
    return demandArray = value;
}

function calculateStartingArmy(territory) {
    let army = (territory.startingPop * startingArmy.populationRate) * parseFloat(territory.dev_index);

    if (startingArmy.moderatedCountries.includes(territory.country)) {
        army = Math.floor(army / startingArmy.moderationDivisor);
    }
    return army;
}

export function addRandomFortsToAllNonPlayerTerritories() {
    allTerritories().forEach(element => {
        if (!playerOwnedTerritories.some(playerTerritory => playerTerritory.getAttribute("uniqueid") === element.uniqueId)) {
            element.fortsBuilt = Math.floor(Math.random() * 4);
            element.defenseBonus = defenseBonusFor(element);
        }

        const isPlayerTerritory = playerOwnedTerritories.some(playerTerritory => playerTerritory.getAttribute("uniqueid") === element.uniqueId);
        const wasPlayerTerritory = isPlayerTerritory ? "was" : "was not";

    });
}

function allWorkaroundOnSiegeTable() {
    const warTable = document.getElementById(ids.uiTable);

    const warRows = warTable.getElementsByClassName("ui-table-row-war");
    for (let i = 0; i < warRows.length; i++) {
        const warRow = warRows[i];
        const warRowChildren = warRow.children;

        for (let j = 0; j < warRowChildren.length; j++) {
            const child = warRowChildren[j];

            if (j >= 5 && j <= 8 && child.innerHTML.includes("All")) {
                if (child.innerHTML.includes("0")) {
                    child.innerHTML = "All / All";
                }
            }
        }
    }
}

function checkIfWouldBeARoutAndPossiblyLeaveSiege(siegeObject) {
    setValuesForBattleFromSiegeObject(siegeObject, true);
    const startingDefenseTotal = siegeObject.startingDef.reduce(
        (accumulator, currentValue, index) => {
            const multipliers = [1, vehicleArmyPersonnelWorth.assault, vehicleArmyPersonnelWorth.air, vehicleArmyPersonnelWorth.naval];
            return accumulator + currentValue * multipliers[index];
        }, 0);

    const remainingDefenseTotal = siegeObject.defendingArmyRemaining.reduce(
        (accumulator, currentValue, index) => {
            const multipliers = [1, vehicleArmyPersonnelWorth.assault, vehicleArmyPersonnelWorth.air, vehicleArmyPersonnelWorth.naval];
            return accumulator + currentValue * multipliers[index];
        }, 0);

    const fortsRemaining = siegeObject.defendingTerritory.fortsBuilt;

    const result = fortsRemaining === 0 ? (remainingDefenseTotal <= startingDefenseTotal * SIEGE_ROUT_THRESHOLD) : false;
    console.log("Would be a rout: " + result);
    return result;
}

function reduceArmyByAdjustment(armyForCurrentTerritory, armyAdjustment) {
    let multiple = armyCostPerTurn.infantry * 1000000;
    let newArmyForCurrentTerritory = armyForCurrentTerritory - (Math.abs(armyAdjustment * 1000) + (INITIAL_GOLD_MIN_PER_TURN_AFTER_ARMY_ADJ * 1000));
    return newArmyForCurrentTerritory;
}

export function setTurnGainsArrayAi(value) {
    return turnGainsArrayAi = value;
}

export function getTurnGainsArrayAi() {
    return turnGainsArrayAi;
}

export function getCountryResourceTotals() {
    return countryResourceTotals;
}

export function findSvgPath(coordinates) {
    for (const path of paths) {
        for (const {
            x,
            y
        }
            of coordinates) {
            const point = svgTag.createSVGPoint();
            point.x = x;
            point.y = y;
            if (path.isPointInFill(point) || path.isPointInStroke(point)) {
                return path;
            }
        }
    }
    return null;
}

function stripProdPopFromTopTable(topTablePop) {
    const matches = topTablePop.match(/^([\d.]+)([Mk]?) \(/);

    if (!matches) {
        throw new Error("Invalid input format");
    }

    const number = parseFloat(matches[1]);
    const unit = matches[2];

    let result;
    if (unit === "M") {
        result = number * 1000000;
    } else if (unit === "k") {
        result = number * 1000;
    } else {
        result = number;
    }

    return result;
}

function findBuyRowPosition(inputElement) {
    let generationsUp = 0;
    let currentElement = inputElement;

    while (currentElement && !currentElement.classList.contains('buy-row')) {
        currentElement = currentElement.parentElement;
        generationsUp++;
    }

    if (currentElement) {
        const nthChildPosition = Array.from(currentElement.parentElement.children).indexOf(currentElement) + 1;
        return nthChildPosition;
    }

    return null;
}

function adjustValueIfOverMax(topTableGold, topTableProdPop, rowIndex, currentValueQuantity, totalGoldSpentSoFar, totalProdPopSpentSoFar) {
    switch (rowIndex) {
        case 1:
            if (currentValueQuantity * armyGoldPrices.infantry > (parseInt(topTableGold) - totalGoldSpentSoFar)) {
                currentValueQuantity = Math.floor((parseInt(topTableGold) - totalGoldSpentSoFar) / armyGoldPrices.infantry);
            }
            if (currentValueQuantity * armyProdPopPrices.infantry > (topTableProdPop - totalProdPopSpentSoFar)) {
                currentValueQuantity = Math.floor((topTableProdPop - totalProdPopSpentSoFar) / armyProdPopPrices.infantry);
            }
            break;
        case 2:
            if (currentValueQuantity * armyGoldPrices.assault > (parseInt(topTableGold) - totalGoldSpentSoFar)) {
                currentValueQuantity = Math.floor((parseInt(topTableGold) - totalGoldSpentSoFar) / armyGoldPrices.assault);
            }
            if (currentValueQuantity * armyProdPopPrices.assault > (topTableProdPop - totalProdPopSpentSoFar)) {
                currentValueQuantity = Math.floor((topTableProdPop - totalProdPopSpentSoFar) / armyProdPopPrices.assault);
            }
            break;
        case 3:
            if (currentValueQuantity * armyGoldPrices.air > (parseInt(topTableGold) - totalGoldSpentSoFar)) {
                currentValueQuantity = Math.floor((parseInt(topTableGold) - totalGoldSpentSoFar) / armyGoldPrices.air);
            }
            if (currentValueQuantity * armyProdPopPrices.air > (topTableProdPop - totalProdPopSpentSoFar)) {
                currentValueQuantity = Math.floor((topTableProdPop - totalProdPopSpentSoFar) / armyProdPopPrices.air);
            }
            break;
        case 4:
            if (currentValueQuantity * armyGoldPrices.naval > (parseInt(topTableGold) - totalGoldSpentSoFar)) {
                currentValueQuantity = Math.floor((parseInt(topTableGold) - totalGoldSpentSoFar) / armyGoldPrices.naval);
            }
            if (currentValueQuantity * armyProdPopPrices.naval > (topTableProdPop - totalProdPopSpentSoFar)) {
                currentValueQuantity = Math.floor((topTableProdPop - totalProdPopSpentSoFar) / armyProdPopPrices.naval);
            }
            break;
    }
    return currentValueQuantity;
}

registerSaveSlice("economy", {
    capture: () => ({
        capacities: capacityArray ?? null,
        demands: demandArray ?? null,
        countryStrengths: countryStrengthsArray ?? null,
        turnGainsLastTurn: turnGainsArrayLastTurn,
        turnGainsPlayer: turnGainsArrayPlayer,
        turnGainsAi: turnGainsArrayAi,
        totals: totalPlayerResources[0] ?? null,
        countryTotals: countryResourceTotals,
        allowSelectionOfCountry: allowSelectionOfCountry
    }),
    restore: (data) => {
        capacityArray = data?.capacities ?? undefined;
        demandArray = data?.demands ?? undefined;
        countryStrengthsArray = data?.countryStrengths ?? undefined;
        turnGainsArrayLastTurn = data?.turnGainsLastTurn ?? createEmptyTurnGains();
        turnGainsArrayPlayer = data?.turnGainsPlayer ?? createEmptyTurnGains();
        turnGainsArrayAi = data?.turnGainsAi ?? {};
        allowSelectionOfCountry = data?.allowSelectionOfCountry ?? false;

        totalPlayerResources.length = 0;
        if (data?.totals) {
            totalPlayerResources.push(data.totals);
        }

        for (const key of Object.keys(countryResourceTotals)) {
            delete countryResourceTotals[key];
        }
        Object.assign(countryResourceTotals, data?.countryTotals ?? {});

        getPlayerTerritories();
    }
});
