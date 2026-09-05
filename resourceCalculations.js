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
    startingOilContinentModifiers,
    startingConsMatsContinentModifiers,
    population as populationBalance,
    territoryStrengthScales,
    startingArmy,
    initialArmyDistribution,
    INITIAL_GOLD_MIN_PER_TURN_AFTER_ARMY_ADJ,
    SIEGE_ROUT_THRESHOLD,
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
    totalCapacities,
    totalDemands
} from './src/rules/economy/capacity.js';
//Economy stage 1. One definition of what an upgrade costs and what it does, shared with
//aiCalculations.js -- see docs/05-economy-audit.md section 4 E1/E2/E4/E5, which are all the
//same defect: an upgrade was a thing each caller re-implemented.
import {
    applyUpgrade,
    upgradeOrderPriceFor,
    upgradePriceFor
} from './src/rules/economy/upgrades.js';
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
    initialArmyAdjustmentCost
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

/** A zeroed turn-gains record. The same sixteen fields as turnGainsArrayPlayer. */
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

//Phase 5.1: these are balance numbers and now live in src/config/balance.js, which imports
//nothing and loads in Node. They are re-exported here because ui.js, battle.js,
//transferAndAttack.js, aiCalculations.js and three e2e specs import them from this module;
//call sites move to the config path as their owning file moves into src/.
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

const dummyAttackerObject = { //for a use case where need to split types of siege on line 886
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
//audit E4: `simulatedCostsAll` used to live here, at module scope. It held the cost of one
//more of each upgrade, written by whichever upgrade table was rendered LAST and read by
//`calculateAvailableUpgrades()` -- which runs BEFORE the loop that fills it. So the "Can
//Build" label and the plus button's enabled state were decided from a price belonging to a
//different territory. It is a local of `populateUpgradeTable()` now, recomputed from
//`upgradePriceFor()` rather than by simulating a click, and nothing outside one render of
//one table can see it.
let simulatedCostsAllMilitary = [armyGoldPrices.infantry, armyProdPopPrices.infantry, armyGoldPrices.assault, armyProdPopPrices.assault, armyGoldPrices.air, armyProdPopPrices.air, armyGoldPrices.naval, armyProdPopPrices.naval];

/* const turnLabel = document.getElementById('turn-label'); */
// Memoised path-area computation. Declared here, above the bootstrap block below,
// because that block calls calculatePathAreasWhenPageLoaded() at module-evaluation
// time -- a `let` declared further down the file is in the temporal dead zone at
// that point and throws.
//
// This is called from two places (the bootstrap Promise.all and
// createArrayOfInitialData), and each call used to start its own 800ms poller AND
// re-run the 80-samples-per-path sweep over all 359 paths -- so the ~230ms area
// computation happened twice and up to 1.6s was spent idling.
let pathAreasPromise = null;
let pathAreaComputations = 0;

{
    Promise.all([calculatePathAreasWhenPageLoaded(), createArrayOfInitialData()])
        .then(([pathAreas, armyArray]) => {
            randomiseInitialGold(allTerritories());
            countryStrengthsArray = calculateTerritoryStrengths(allTerritories());
            //From here the SVG path attributes are OUTPUT: the store is the truth and this
            //renders it. Started once both halves exist -- the path index is built by
            //svgMapLoaded(), which whenPageLoaded() above has already waited for, and the
            //territory model was seeded by createArrayOfInitialData(). See Phase 4.4.
            startMapAttributeSync();
            enableNewGameButton();
            //Phase 7.2. The pristine world, captured the moment it exists and before
            //anybody has played it. "New Game" from inside a running game restores it
            //-- Restart is a load. See src/platform/storage.js.
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
    // Update the table with the response data
    bottomTable.create();
    setFlag(pathCountry(countryPath), 2); //set flag for territory clicked on (bottom table)

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
                // Prefer the precomputed geometry, but only if it still describes
                // the SVG the page actually loaded. precomputedAreasFor() returns
                // null on any mismatch and we fall back to sampling, so an edited
                // map is slow rather than wrong. See src/data/pathAreas.js.
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

/** Test seam for the ?e2e=1 harness: how many times the area sweep actually ran. */
export function getPathAreaComputations() {
    return pathAreaComputations;
}

// Byte length of the SVG document the browser actually fetched, used to detect a
// map that has been edited since the areas were precomputed. Read from resource
// timing so it costs nothing; returns -1 if unavailable, which fails the guard
// closed and falls back to recomputing.
// O(1) territory lookup.
//
// The find()-inside-a-loop pattern this replaces ran ~129,000 comparisons per call
// in addUpAllTerritoryResourcesForCountryAndWriteToTopTable alone, once per turn.
// See docs/01-codebase-audit.md section 4.2. Since Phase 4 the index is the store's
// own Map, built by seedTerritories(), so there is no window in which it is missing
// and no scan to fall back to.
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
    // Built locally and handed to seedTerritories(). Phase 4.1 deliberately leaves the
    // calculation alone -- only its destination changes, from a module-level `let` that
    // anything could reassign to the store.
    const territories = [];

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

            //Starting gold only. Overwritten every turn from turn 2 by `continentModifiers`
            //(a different table, in balance.js), which is what the strength score reads.
            //audit E7: this was an inline if-chain and one of three that were invisible.
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
                    isLandLockedBonus = isCoastal ? 0 : 10; //defense bonus for landlocked
                    mountainDefense = parseInt(path.getAttribute("mountainDefenseFactor"));
                    //Read from the SVG, not from the store: this IS the seeding pass, and
                    //the store has no territories yet. `owner` and `originalOwner` are the
                    //map's initial political state, and after this they are the store's.
                    owner = path.getAttribute("owner");
                    originalOwner = path.getAttribute("originalOwner");
                }
            }

            // Calculate population of each territory based on the startingPop for the whole country it belongs to
            territoryPopulation = startingPop * percentOfWholeArea;

            // Calculate new army value for current element
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
            // console.log("Pre reduce for " + territoryName) + ":"
            // console.log (armyForCurrentTerritory, armyAdjustment);
            if (armyAdjustment < INITIAL_GOLD_MIN_PER_TURN_AFTER_ARMY_ADJ && bigEnoughToGetMin) {
                armyForCurrentTerritory = reduceArmyByAdjustment(armyForCurrentTerritory, armyAdjustment);
            }
            let armyAdjustmentTest = calculateGoldChange(adjustmentArray, true, true);
            armyAdjustmentTest -= initialArmyAdjustmentCost(armyForCurrentTerritory);
            // console.log(armyForCurrentTerritory + ", " + armyAdjustmentTest);
            let oilForCurrentTerritory = initialOilCalculation(matchingCountry, area);
            let oilCapacity = oilForCurrentTerritory;
            let consMatsForCurrentTerritory = Math.max(initialConsMatsCalculation(matchingCountry, area), 500);
            let consMatsCapacity = consMatsForCurrentTerritory;
            let farmsBuilt = 0;
            let oilWellsBuilt = 0;
            let forestsBuilt = 0;
            let fortsBuilt = 0;
            //known-issues AQ. This read
            //`Math.ceil(f * (f + 1) * 10) * dev + landlocked`, with the ceiling around the
            //fort term instead of around the whole expression -- different brackets from the
            //three other sites, and so a different answer. It never actually diverged,
            //because `fortsBuilt` is 0 here and both forms then reduce to the land-locked
            //bonus, but a fourth copy of the formula is how the divergence would arrive.
            //There is one copy now, and it is unit-tested.
            let defenseBonus = defenseBonusFor({
                fortsBuilt: fortsBuilt,
                devIndex: dev_index,
                isLandLockedBonus: isLandLockedBonus
            });
            let mountainDefenseBonus = mountainDefense * MOUNTAIN_DEFENSE_SCALE;
            let initialArmyDistributionArray = calculateInitialAssaultAirNavalForTerritory(armyForCurrentTerritory, oilForCurrentTerritory, initialCalculationTerritory);
            // console.log(territoryName + ": " + initialArmyDistributionArray.infantry + ", " + initialArmyDistributionArray.assault + ", " + initialArmyDistributionArray.air + ", " + initialArmyDistributionArray.naval);
            let assaultForCurrentTerritory = initialArmyDistributionArray.assault;
            let useableAssault = assaultForCurrentTerritory;
            let airForCurrentTerritory = initialArmyDistributionArray.air;
            let useableAir = airForCurrentTerritory;
            let navalForCurrentTerritory = initialArmyDistributionArray.naval;
            let useableNaval = navalForCurrentTerritory;
            let infantryForCurrentTerritory = initialArmyDistributionArray.infantry;

            armyForCurrentTerritory = (navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval) + (airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + infantryForCurrentTerritory; //get correct value after any rounding by calculations

            //Phase 5.5: the productive-population formula was written out inline in five
            //places, twice with a different sign on the population (audit 5.1 F). This is the
            //last of them.
            productiveTerritoryPop =
                productivePopulationFor(territoryPopulation, dev_index) - armyForCurrentTerritory;
            let foodForCurrentTerritory =
                (territoryPopulation / FOOD_UNIT_SCALE) + (armyForCurrentTerritory / FOOD_UNIT_SCALE);
            let foodCapacity = territoryPopulation + armyForCurrentTerritory;
            let foodConsumption = territoryPopulation + armyForCurrentTerritory;
            let isDeactivated = false;
            // Add updated path data to the new array
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

    territories.sort(function(a, b) { //console out defense bonus
        return b.defenseBonus - a.defenseBonus;
    });

    // for (let i = 0; i < allTerritories().length; i++) {
    //     const territory = allTerritories()[i];
    //     console.log(territory.defenseBonus + ", " + territory.territoryName);
    // }


    return territories;
}

function createArrayOfInitialData() {
    return calculatePathAreasWhenPageLoaded().then(pathAreas => {
        return new Promise((resolve, reject) => {
            //The one place the store is seeded. Everything downstream reads it through
            //state/selectors.js; nothing else may replace the territory list.
            seedTerritories(assignArmyAndResourcesToPaths(pathAreas, dataTableCountriesInitialState));
            /* for (let i = 0; i < allTerritories().length; i++) {
                console.log('"' + allTerritories()[i].territoryName + '": ' + '"' + allTerritories()[i].uniqueId + '",');
            } */
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
    //calculate new array data and set it
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

//todo : return a popup to the user with a confirm button to remove it, stating what the player gained that turn

/**
 * Give a territory back the food capacity a finished siege destroyed.
 *
 * Known-issue BP. This used to be `foodCapacity = war.startingFoodCapacity` -- the ceiling as it
 * stood when the war began, ASSIGNED over whatever the ceiling is now. That is a wholesale
 * overwrite rather than a repair, so **a farm bought during the siege was silently undone the
 * moment the siege lifted**, with the gold and construction materials already spent. Nothing
 * reported it: the upgrade window had taken the money, `farmsBuilt` still said the farm was
 * there, and only the ceiling quietly went back to what it had been.
 *
 * The siege records what it actually destroyed, tick by tick (`battle.js`), so the repair adds
 * exactly that much back and leaves anything built meanwhile alone. The result is the same
 * number as before whenever nothing was built, which is the common case -- so this is a defect
 * fix and not a balance change.
 *
 * A war from a save taken before the phase has no `foodCapacityDestroyed`, and falls back to the
 * old assignment: wrong in the same way it has always been wrong, rather than restoring nothing
 * at all.
 */
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

    //Continent modifier, reset every turn so a future upgrade can override it for one turn
    //without the override sticking. The table is in src/config/balance.js (Phase 5.1).
    for (let i = 0; i < allTerritories().length; i++) {
        const modifier = continentModifiers[allTerritories()[i].continent];
        if (modifier !== undefined) {
            allTerritories()[i].continentModifier = modifier;
        }
    }

    //audit 5.1 G: zero every AI country gains entry once, here, at the start of the turn
    //income pass. Mutated in place rather than reassigned so that battle.js, which holds a
    //reference to the same object, keeps writing into the live one.
    for (const countryName of Object.keys(turnGainsArrayAi)) {
        delete turnGainsArrayAi[countryName];
    }

    for (const path of paths) {
        for (let i = 0; i < allTerritories().length; i++) {
            const defendingTerritoryId = allTerritories()[i].uniqueId;

            // Update values only if territory is not defending against a siege war
            if (
                !Object.values(playerSiegeWarsList).some(obj => obj.defendingTerritory?.uniqueId === defendingTerritoryId) &&
                !Object.values(aiSiegeWarsList).some(obj => obj.defendingTerritory?.uniqueId === defendingTerritoryId)
            ) {
                //audit 5.2 I: these two loops used `i`, shadowing the territory index of the
                //enclosing loop, so the post-siege food-capacity reset landed on whichever
                //territory happened to sit at the WAR index in allTerritories(). `w` and `k`
                //keep the two indexes apart; ESLint no-shadow stops it coming back.
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
                    //audit 5.2 R: re-enabled. calculateArmyMaintenanceCostPerTurn was fully
                    //implemented and used during initial army sizing, but commented out
                    //here -- so standing armies were free, which removed the principal
                    //economic brake on militarisation and made permanent sieges costless.
                    changeGold -= armyMaintenanceFor(allTerritories()[i]);
                    changeOil = calculateOilChange(allTerritories()[i], false);
                    changeFood = calculateFoodChange(allTerritories()[i], false, false);
                    changeConsMats = calculateConsMatsChange(allTerritories()[i], false);
                    changePop = calculatePopulationChange(allTerritories()[i], false, null);
                    changeProdPopTemp = productivePopulationOf(allTerritories()[i]);

                    //Upkeep can exceed a turn income, so the change can be negative. Nothing
                    //in the game models debt -- a negative balance would flow straight into
                    //the AI spending calculations -- so a territory can be broke but never
                    //overdrawn. What an unpayable army SHOULD cost you (desertion) is a
                    //design question for Phase 7, not a defect fix.
                    allTerritories()[i].goldForCurrentTerritory = Math.max(0, allTerritories()[i].goldForCurrentTerritory + changeGold);
                    allTerritories()[i].oilForCurrentTerritory += changeOil;
                    allTerritories()[i].foodForCurrentTerritory += changeFood;
                    allTerritories()[i].foodConsumption = foodConsumptionOf(allTerritories()[i]);
                    allTerritories()[i].consMatsForCurrentTerritory += changeConsMats;
                    allTerritories()[i].territoryPopulation = Math.max(0, allTerritories()[i].territoryPopulation + changePop); //audit 5.2 AJ
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
                        //audit 5.1 G: this assignment used to be unconditional, so a fresh
                        //zeroed object replaced the running total on EVERY territory and each
                        //AI country ended the turn showing only its last-processed territory.
                        //The whole map is zeroed once per turn at the top of this function.
                        if (!turnGainsArrayAi[countryName]) {
                            turnGainsArrayAi[countryName] = createEmptyTurnGains();
                        }
                        // Update turn gains for the AI country
                        turnGainsArrayAi[countryName].changeGold += changeGold;
                        turnGainsArrayAi[countryName].changeOil += changeOil;
                        turnGainsArrayAi[countryName].changeFood += changeFood;
                        turnGainsArrayAi[countryName].changeConsMats += changeConsMats;
                        turnGainsArrayAi[countryName].changePop += changePop;
                        turnGainsArrayAi[countryName].changeProdPop += changeProdPop;
                    }
                }
            } else if (path.getAttribute("uniqueid") === defendingTerritoryId) { //uncomment other features if decided to involve them in sieges and add true flag at end to say it's from a siege
                //audit 5.2 J: this branch used to be gated on a `changeDuringAnySiege` latch
                //declared outside the loop and set false on first use, so only ONE besieged
                //territory per turn got its siege-time food and population processing.
                //
                //Dropping the latch alone is not enough: this whole block is nested inside
                //`for (const path of paths)`, and unlike the income branch beside it this
                //branch never checked which path it was looking at -- so it would have run
                //359 times per besieged territory per turn. The path check is what makes
                //"once per besieged territory, every turn" true.
                //Phase 4.7: the siege references this very territory, so the four-line
                //write-back that used to sit at the bottom of this block -- copying food,
                //consumption, population and productive population from the model into the
                //siege's own copy -- has nothing left to copy. It also means the productive
                //population below is derived from the population as just updated, which is
                //what the income branch beside this one already did; the copy made it lag a
                //turn here.
                const besiegedTerritory = allTerritories()[i];
                const playerSiege = playerSiegeWarsList[besiegedTerritory.territoryName];
                const siegeTerritory = playerSiege ?? aiSiegeWarsList[besiegedTerritory.territoryName];
                if (!siegeTerritory) {
                    continue;
                }

                //Which side is besieging is a property of THIS siege, and the only place it
                //can be read from is the list the siege is in. It used to be a bare `ai`
                //declared above both loops and assigned only in the branch beside this one,
                //from the post-siege food-capacity reset -- so by the time a siege was
                //processed it held whatever an unrelated historic war had left there, and on
                //most turns it was still `undefined`. `undefined` is falsy, which means every
                //AI-versus-AI siege that starved its garrison out below resolved down the
                //PLAYER's branch: `handleWarEndingsAndOptions` raised the rout screen and
                //handed the conquered territory to the player, who was no party to the war,
                //and the siege was then removed from the player's list -- where it was not --
                //so it stood in the AI's list for the rest of the game. Same family as
                //known-issue AT: an AI-versus-AI siege reaching a player-only code path.
                const siegeIsAi = !playerSiege;

                //changeGold = calculateGoldChange(siegeTerritory, false);
                //changeOil = calculateOilChange(siegeTerritory, false);
                changeFood = calculateFoodChange(siegeTerritory, false, true, siegeIsAi);
                //changeConsMats = calculateConsMatsChange(siegeTerritory, false);
                changePop = calculatePopulationChange(siegeTerritory, true, siegeIsAi);

                changeProdPopTemp = productivePopulationOf(besiegedTerritory);

                //besiegedTerritory.goldForCurrentTerritory += changeGold;
                //besiegedTerritory.oilForCurrentTerritory += changeOil;
                besiegedTerritory.foodForCurrentTerritory += changeFood;
                besiegedTerritory.foodConsumption = foodConsumptionOf(besiegedTerritory);
                //besiegedTerritory.consMatsForCurrentTerritory += changeConsMats;
                besiegedTerritory.territoryPopulation = Math.max(0, besiegedTerritory.territoryPopulation + changePop); //audit 5.2 AJ
                besiegedTerritory.productiveTerritoryPop = productivePopulationOf(besiegedTerritory);

                changeProdPop = besiegedTerritory.productiveTerritoryPop - changeProdPopTemp;
                if (!siegeIsAi) {
                    writeBottomTableInformation(besiegedTerritory, true, null);
                }
            }
        }
    }
}

//Phase 5.2: the arithmetic below lives in src/rules/economy/*, which is pure and runs in
//Node. What is left here is the bridge: build the turn context, apply the disaster damage to
//the live territory, and hand the delta back to the caller that writes it.
//
//The disaster damage is still a direct write to the territory rather than a delta, because
//it is a REPLACEMENT of the stock and the four callers below all add their return value to
//that same stock. Making it a delta too is the last step of the write-guard work and is
//tracked in docs/04-known-issues.md.

/**
 * The turn's disaster state and this territory's continent bonus, in the shape
 * rules/economy expects.
 *
 * The bonus arrives HERE rather than being looked up inside `income.js`, exactly as the
 * random event does, which is what keeps every game rule a pure function of its inputs and
 * runnable in Node. Both multipliers are read from `src/state/continentBonus.js`, which
 * memoises one walk of the map and drops it whenever a territory changes hands -- so this
 * costs a Map lookup per call rather than a pass over 359 territories.
 *
 * A missing territory answers "no bonus" rather than throwing: `calculateGoldChange()` and
 * friends are also called to cost hypothetical purchases.
 */
function economyContext(isSimulation, territory) {
    return {
        randomEventHappening: randomEventHappening,
        randomEvent: randomEvent,
        isSimulation: Boolean(isSimulation),
        continentBonus: continentGoldBonusFor(territory),
        continentCapacityBonus: continentCapacityBonusFor(territory)
    };
}

/**
 * Apply this turn's disaster to one territory, and log what it cost.
 *
 * `ownEvent` is the one disaster this caller is responsible for. Each of the four resource
 * functions damages its own stock and no other, so exactly one of them acts on any given
 * turn -- without that the four would each roll against the same active event and a mutiny
 * would be charged four times.
 */
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
        territory = territory.defendingTerritory; //a siege is passed in place of its territory
    }
    const context = economyContext(isSimulation, territory);
    applyRandomEventDamage(territory, context, "Food Disaster");
    return foodChangeFor(territory, context);
}


/**
 * One territory's DERIVED economy: what it would earn this turn, and the ceilings it is
 * earning towards, with the continent bonus already in both.
 *
 * It exists because the continent bonus cannot otherwise be measured. Nothing about it is
 * stored -- that is the whole design -- so there is no field a spec can read to find out
 * whether a continent held whole is paying, and the numbers a player sees are formatted
 * ("1.2M") and spread across three panels. Leigh's instruction is the reason it is a hook
 * rather than a browser check: a mechanic that only appears once a whole continent has been
 * conquered is too far into a playthrough for anyone to verify by hand, so it has to be
 * something a spec can assert.
 *
 * The four `calculate*Change()` functions above are deliberately NOT used. Each applies this
 * turn's disaster damage to the territory as a side effect, so calling them to take a
 * reading would change the world being read. These are the pure rules with a simulated
 * context, which is exactly what the tooltips ask for.
 *
 * @param {object} territory
 */
export function derivedEconomyFor(territory) {
    if (!territory) {
        return null;
    }
    const context = economyContext(true, territory);
    return {
        territory: territory.territoryName,
        owner: territory.dataName,
        continent: territory.continent ?? "Unknown",
        //The two multipliers in force for this territory, as the rules see them.
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
        //Effective, not stored. The stored ones are still on the territory for a spec that
        //wants to prove nothing was written back.
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


/**
 * How much a territory's civilian population changes this turn, and what happens when the
 * answer is "the army starves first".
 *
 * Phase 5.2: the arithmetic is in src/rules/economy/population.js, which is pure. What is
 * left here is the part that is not arithmetic -- rolling the siege's army-starvation
 * chance, ending a hopeless siege, and telling the UI. A besieged territory is passed as its
 * SIEGE, not as its territory, which is why the first thing this does is drill into it.
 *
 * Returns 0 when the army starved instead: the civilians are untouched in that case, and
 * the caller adds the return value to territoryPopulation.
 */
function calculatePopulationChange(territory, cameFromSiege, ai) {
    let siegeObject;
    if (cameFromSiege) {
        siegeObject = territory;
        territory = territory.defendingTerritory;
    }

    if (randomEventHappening) {
        //A disaster turn costs nobody their life immediately, so the player has a turn to
        //react to the loss before the famine it causes arrives.
        return 0;
    }

    let populationChange = populationChangeFor(territory);

    //A besieged garrison can be the one that goes hungry even when the civilians could have
    //absorbed the shortfall. Rolled only while starving and only under siege, which is what
    //the legacy code did and what keeps the draw count per turn unchanged.
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

    //The garrison is spent and holds no forts: the siege is over and the besieger has won.
    const warId = siegeObject.warId;
    if (!ai) {
        setCurrentWarFlagString(siegeObject.defendingTerritory.dataName);
        addRemoveWarSiegeObject(1, siegeObject.warId, false);
    } else {
        //doesn't need the attacker, but the function sets variables from it before it can
        //branch, so a dummy stands in.
        addRemoveWarSiegeObjectAi(1, siegeObject.warId, siegeObject, dummyAttackerObject);
    }

    //Ending the siege above clears `underSiege` on its own -- it is derived from the siege
    //lists (Phase 4.4/4.5) -- so only the overlay is left.
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
 * Take the units a famine costs.
 *
 * Phase 5.2: which units are lost is decided by `planArmyStarvation()`, which is pure and
 * returns absolute counts. This writes them, and -- because a besieged territory used to be
 * a separate copy -- no longer scans all 359 territories to write the same numbers twice.
 */
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

//Phase 5.2: both of these used to be a 359 x N nested scan producing an array of pairs and
//then reducing it. The summation is in src/rules/economy/capacity.js and is pure; what is
//left is turning the player path list into the territories it names.

function playerTerritoryModels() {
    const owned = new Set(playerOwnedTerritories.map(path => path.getAttribute("uniqueid")));
    return allTerritories().filter(territory => owned.has(territory.uniqueId));
}

export function calculateAllTerritoryDemandsForPlayerCountry() {
    return totalDemands(playerTerritoryModels());
}

function calculateAllTerritoryCapacitiesForPlayerCountry() {
    //The country totals are the sum of the EFFECTIVE capacities, so the top table and the
    //info panel's Country Summary show the same ceilings the income pass is regenerating
    //towards. Summing the stored ones instead would make the two disagree by exactly the
    //bonus, which is the sort of gap a player reads as a bug in the economy.
    return totalCapacities(playerTerritoryModels(), continentCapacityBonusFor);
}



export function addUpAllTerritoryResourcesForCountryAndWriteToTopTable(endOfTurn) { //situation means if selected territory is a player owned territory 0 if yes 1 if no
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
        // Skip territories with no owner
        if (!territoryOwner) {
            continue;
        }

        // If it's the player territory, calculate the player resource totals
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

            // Calculate the resource totals for the current territory and add to the country's total
            const territoryData = territoryByUniqueId(path.getAttribute("uniqueid"));
            //the `if (territoryData)` guard below was written one line too late: this
            //dereference happened first, so a path with no territory threw instead of
            //being skipped. Kept as a guard clause so the intent is unambiguous.
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

    //write new data to top table
    topTable.update({
        gold: Math.ceil(totalPlayerResources[0].totalGold).toString(),
        oil: Math.ceil(totalPlayerResources[0].totalOil).toString(),
        food: Math.ceil(totalPlayerResources[0].totalFood).toString(),
        consMats: Math.ceil(totalPlayerResources[0].totalConsMats).toString(),
        population: formatNumbersToKMB(totalPlayerResources[0].totalProdPop, 0) + " (" + formatNumbersToKMB(totalPlayerResources[0].totalPop, 0) + ")",
        area: formatNumbersToKMB(totalPlayerResources[0].totalArea, 0) + " (km²)",
        army: formatNumbersToKMB(totalPlayerResources[0].totalArmy, 0),
    });

    // console.log ("player:");
    // console.log(totalPlayerResources);
    // console.log ("ai:");
    // console.log(countryResourceTotals);
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
    } else { //turn update resources for selected territory
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

/**
 * The starting stock and capacity of one of the two area-driven commodities.
 *
 * audit E7. `initialOilCalculation()` and `initialConsMatsCalculation()` were two copies of
 * this arithmetic differing only in their continent table, and both tables were written inline
 * as an if-chain. They are in `balance.js` now and there is one function.
 *
 * The shape is worth reading, because audit D7 turns on it: `term2` and `term3` are both
 * `sqrt(area)`, and `term1` is `area^1.5` scaled by how far the continent modifier is from 1.
 * AREA dominates all three. That is why a small developed country's construction-materials
 * ceiling is low however developed it is, and why no change to an upgrade's PRICE can reach it.
 */
function initialStockForArea(country, area, continentModifiers) {
    const developmentIndex = parseFloat(country.dev_index);
    const continentModifier = continentModifiers[country.continent];

    const term1 = (Math.abs(Math.pow(area / 1000, 1.5) * developmentIndex * (continentModifier - 1) * 0.1));
    const term2 = (Math.pow(area / 1000, 0.5) * developmentIndex * 50);
    const term3 = (Math.pow(area / 1000, 0.5) * continentModifier * 10);
    return term1 + term2 + term3;
}

function initialOilCalculation(path, area) {
    return initialStockForArea(path, area, startingOilContinentModifiers);
}

function initialConsMatsCalculation(path, area) {
    return initialStockForArea(path, area, startingConsMatsContinentModifiers);
}

/**
 * Fill the info panel with one of its four tabs.
 *
 * Phase 6.4. This was 920 lines: four tables built by one function, with the
 * differences between them expressed as sixteen `switch (j)` statements and some
 * thirty `if (summaryTerritoryArmySiegesTable === n)` tests threaded through the
 * construction. What each tab CONTAINS is now data -- `src/ui/infoTable/columns.js` --
 * and how a row is BUILT is one pair of functions in `src/ui/infoTable/tableDom.js`.
 *
 * What is left here is the wiring: this module has the economy in scope and the
 * renderer has none of it, so everything the tables read is passed in. That is
 * deliberate and it is the same shape the Phase 6.3 components use -- it means
 * `src/ui/infoTable/` adds no edge to a module graph in which `ui.js` and this file
 * already import each other.
 */
export function drawUITable(uiTableContainer, summaryTerritoryArmySiegesTable) {
    playerOwnedTerritories.sort((a, b) => {
        const idA = parseInt(a.getAttribute("territory-id"));
        const idB = parseInt(b.getAttribute("territory-id"));
        return idA - idB;
    });

    renderInfoTable(uiTableContainer, summaryTerritoryArmySiegesTable, {
        formatNumber: formatNumbersToKMB,
        //The naval columns and the whole territories/army tabs call the formatter
        //with one argument, where the rest pass an explicit 0. The two differ for a
        //sub-1000 figure, so they are kept apart rather than unified.
        formatNumberDefault: (value) => formatNumbersToKMB(value),
        playerCountryName,
        reduceKeywords,

        gains: turnGainsArrayLastTurn,
        totals: totalPlayerResources[0],
        capacities: capacityArray,
        //The per-territory capacities are derived at the point of use rather than read off
        //the territory, so a continent lost is simply the next render's answer -- there is
        //no stored bonus and therefore no inverse write to forget.
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

/**
 * Arm or disarm one of the two windows' bottom-bar buttons.
 *
 * Phase 7.11. Ten copies of a five-line block stood where the calls to this now
 * are, and each wrote `style.backgroundColor` and then added a FRESH pair of
 * mouseover / mouseout listeners -- so a player who clicked plus forty times
 * left eighty listeners on one button, every one of them writing a literal
 * `rgba(...)` no theme could reach. The class says what the button MEANS and
 * `style.css` decides what green is.
 */
function setConfirmArmed(buttonId, armed) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.classList.toggle(classNames.isArmed, armed);
    }
}

/** Is this territory's own action button live right now? */
function territoryActionsEnabled(path) {
    return currentPhase() === Phase.BUY_UPGRADE && !pathIsDeactivated(path);
}

/**
 * The upgrade button in the territories tab.
 *
 * Greyed out and inert outside the Buy/Upgrade phase, and for a territory still
 * locked out after a conquest. Both halves test the same condition, which is why it
 * is named once above rather than repeated four times as it was.
 */
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

/** The buy button in the army tab. Same shape as the upgrade button above. */
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

//setGainsRowTextColor() moved to src/ui/infoTable/tableDom.js as applyGainColour(),
//where the two columns that want the colour of the NEGATED value say so.

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

    tooltip.setContent(tooltipContent);

    // Temporarily show the tooltip to calculate its height
    tooltip.show();

    const tooltipHeight = tooltip.height();
    const verticalThreshold = tooltipHeight + 25;
    const windowHeight = window.innerHeight;

    // Hide the tooltip again
    tooltip.hide();

    if (windowHeight - y < verticalThreshold && y - verticalThreshold >= 0) {
        tooltip.moveTo(x - 40, y - verticalThreshold);
    } else {
        tooltip.moveTo(x - 40, y + 25);
    }

    // Show the tooltip
    tooltip.show();
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
    let currentDefenseBonus = territoryData.defenseBonus;

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

    //Economy stage 1. The row's kind, what is already built, and what one MORE would cost.
    //The cost used to be read out of the module-level `simulatedCostsAll` (audit E4); it is
    //asked for directly now, so the tooltip cannot be showing another territory's price.
    const rowSpec = {
        "Farm": { kind: "farm", built: "farmsBuilt", index: 0 },
        "Forest": { kind: "forest", built: "forestsBuilt", index: 1 },
        "Oil Well": { kind: "oilWell", built: "oilWellsBuilt", index: 2 },
        "Fort": { kind: "fort", built: "fortsBuilt", index: 3 }
    }[upgradeType];
    if (!rowSpec) {
        // Invalid upgrade type, exit the function
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
        //audit E9. This was a SEVENTH copy of the defence formula and it disagreed with the
        //one the game uses: an extra `1 +`, and the mountain bonus folded in -- which
        //`defenseBonusFor()` deliberately keeps separate, because a battle adds
        //`mountainDefenseBonus` itself. So the left-hand side of the arrow was the territory's
        //real defence bonus and the right-hand side was defence-plus-mountain, and the tooltip
        //promised a fort was worth several times what it is. One formula now, both sides.
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

    // Temporarily show the tooltip to calculate its height
    tooltip.show();

    const tooltipHeight = tooltip.height();
    const verticalThreshold = tooltipHeight + 25;
    const windowHeight = window.innerHeight;

    // Hide the tooltip again
    tooltip.hide();

    if (windowHeight - y < verticalThreshold && y - verticalThreshold >= 0) {
        tooltip.moveTo(x - 40, y - verticalThreshold);
    } else {
        tooltip.moveTo(x - 40, y + 25);
    }

    // Show the tooltip
    tooltip.show();
}

function tooltipUIArmyRow(row, territoryData, event) {
    // Get the coordinates of the mouse cursor
    const x = event.clientX;
    const y = event.clientY;

    // Set the content of the tooltip based on the territory data
    const territoryName = row.querySelector(".ui-table-column").textContent;
    const prodPopulation = territoryData.productiveTerritoryPop;
    const gold = row.querySelector(".ui-table-column:nth-child(7)").textContent;
    //The EFFECTIVE capacity, continent bonus included -- this is the figure the income pass
    //regenerates towards, so showing the stored one here would tell the player a ceiling the
    //game is not using. `effectiveCapacityFor()` derives it; nothing writes it back.
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

    /* let goldNextTurnValue = "font-weight: bold; color: black;"; */

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

    // Get the last div in the row
    const lastDiv = row.querySelector(".ui-table-column:last-child img");

    // Check if the mouse is hovering over the last div
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
        // Set the content of the tooltip based on the territory data
        tooltip.setContent(tooltipContent);
    }

    //<div>Gold Next Turn: <span style="${goldNextTurnStyle}">${goldNextTurnValue}</span></div>

    const tooltipHeight = tooltip.height();
    const verticalThreshold = tooltipHeight + 25;

    if (window.innerHeight - y < verticalThreshold) {

        tooltip.moveTo(x - 40, y - tooltipHeight);
    } else {
        tooltip.moveTo(x - 40, 25 + y);
    }

    // Show the tooltip
    tooltip.show();

    row.style.cursor = "pointer";
}

/**
 * The continent line on a territory tooltip, or nothing when there is nothing to say.
 *
 * Drawn in the bonus colour when the continent is held whole and in plain text when it is
 * not, because the difference between "you have this" and "you could have this" is the one
 * thing the line exists to make obvious.
 */
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
    // Get the coordinates of the mouse cursor
    const x = event.clientX;
    const y = event.clientY;

    // Set the content of the tooltip based on the territory data
    const territoryName = row.querySelector(".ui-table-column").textContent;
    const army = row.querySelector(".ui-table-column:nth-child(2)").textContent;
    const prodPopulation = territoryData.productiveTerritoryPop;
    const popNextTurnValue = calculatePopulationChange(territoryData, false, null);
    const area = row.querySelector(".ui-table-column:nth-child(4)").textContent;
    const gold = row.querySelector(".ui-table-column:nth-child(5)").textContent;
    /* const goldNextTurnValue = Math.ceil(calculateGoldChange(territoryData)); */
    const oilNextTurnValue = Math.ceil(calculateOilChange(territoryData, true));
    const capacityBonus = continentCapacityBonusFor(territoryData);
    const oilCap = effectiveCapacityFor(territoryData, "oil", capacityBonus);
    const foodNextTurnValue = Math.ceil(calculateFoodChange(territoryData, true));
    const foodCap = effectiveCapacityFor(territoryData, "food", capacityBonus);
    const consMatsNextTurnValue = Math.ceil(calculateConsMatsChange(territoryData, true));
    const consMatsCap = effectiveCapacityFor(territoryData, "consMats", capacityBonus);
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
        ${continentBonusTooltipLine(territoryData)}
    `;

    // Get the last div in the row
    const lastDiv = row.querySelector(".ui-table-column:last-child img[alt='Upgrade Territory']");

    // Check if the mouse is hovering over the last div
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
        // Set the content of the tooltip based on the territory data
        tooltip.setContent(tooltipContent);
    }

    //<div>Gold Next Turn: <span style="${goldNextTurnStyle}">${goldNextTurnValue}</span></div>

    const tooltipHeight = tooltip.height();
    const verticalThreshold = tooltipHeight + 25;

    if (window.innerHeight - y < verticalThreshold) {

        tooltip.moveTo(x - 40, y - tooltipHeight);
    } else {
        tooltip.moveTo(x - 40, 25 + y);
    }


    // Show the tooltip
    tooltip.show();

    row.style.cursor = "pointer";
}

export function colourTableText(table, territory) {
    /* let changeGold = calculateGoldChange(territory); */
    let changeOil = calculateOilChange(territory, true);
    let changeFood = calculateFoodChange(territory, true);
    let changeConsMats = calculateConsMatsChange(territory, true);
    let changePop = calculatePopulationChange(territory, false, null);

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

    // Create the upgrade row objects based on the availability and gold/consMats conditions
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

/**
 * The four upgrade rows for one territory: what each costs NEXT, and whether it can be built.
 *
 * Economy stage 1.7. The price is `upgradePriceFor(kind, built + 1, devIndex)` -- the real
 * ladder price of the next one. It used to be the n=1 price with no quadratic term, floored by
 * a module-level cache belonging to whichever table was rendered last (audit E4), so a
 * territory with four farms standing was told a farm cost what a first farm costs and the plus
 * button was enabled on the strength of it.
 *
 * The four rows were 165 lines of near-identical `if`/`else if` chains before this. What
 * differs between them is data and is in `UPGRADE_ROWS`; the availability logic is stated once,
 * in the order it was always evaluated in: affordable and under the cap, then short of gold,
 * then short of materials, then capped.
 */
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
    return UPGRADE_ROWS.map((row) => {
        const built = Number(territory[row.built]) || 0;
        const price = upgradePriceFor(row.kind, built + 1, territory.devIndex);
        const underCap = built < row.max;
        const hasGold = territory.goldForCurrentTerritory >= price.gold;
        const hasConsMats = territory.consMatsForCurrentTerritory >= price.consMats;

        let condition;
        if (hasGold && hasConsMats && underCap) {
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

    //reset confirm button status and totals when opening upgrade window
    document.getElementById(ids.subtitleBuyWindow).innerHTML = territory.territoryName;
    document.getElementById(ids.pricesBuyInfoColumn2).innerHTML = "0";
    document.getElementById(ids.pricesBuyInfoColumn4).innerHTML = "0";
    document.getElementById(ids.bottomBarBuyConfirmButton).innerHTML = "Cancel";
    setConfirmArmed(ids.bottomBarBuyConfirmButton, false);

    let simulatedPurchaseCosts;
    const buyTable = document.getElementById(ids.buyTable);
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

        // Add columns to the row
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

                    //code to check greying out here
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

                /*         console.log(simulatedCostsAllMilitary);
                        console.log("Total Gold Price:", totalPurchaseGoldPrice);
                        console.log("Total Population Cost:", totalPopulationCost);
                        console.log("Total SimGold Price:", totalSimulatedPurchaseGoldPrice);
                        console.log("Total SimProdPop:", totalSimulatedProdPopPrice); */

                //code to check greying out here
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
    //reset confirm button status and totals when opening upgrade window
    document.getElementById(ids.subtitleUpgradeWindow).innerHTML = territory.territoryName;
    document.getElementById(ids.pricesInfoColumn2).innerHTML = "0";
    document.getElementById(ids.pricesInfoColumn4).innerHTML = "0";
    document.getElementById(ids.bottomBarConfirmButton).innerHTML = "Cancel";
    setConfirmArmed(ids.bottomBarConfirmButton, false);

    const upgradeTable = document.getElementById(ids.upgradeTable);
    //Local to this render, not module state. See `nextUpgradeCostsFor()` and audit E4.
    let simulatedCostsAll = [0, 0, 0, 0, 0, 0, 0, 0];
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

                    //code to check greying out here
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

                /* console.log(simulatedCostsAll);
                console.log("Total Gold Price:", totalGoldPrice);
                console.log("Total ConsMats:", totalConsMats);
                console.log("Total SimGold Price:", totalSimulatedGoldPrice);
                console.log("Total SimConsMats:", totalSimulatedConsMatsPrice); */

                //code to check greying out here
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

/**
 * Step one upgrade row up or down, and rewrite its two cost cells.
 *
 * Economy stage 1.6. The price is `upgradeOrderPriceFor()` -- one definition, shared with the
 * AI, the availability check and the tooltip. There were six copies of this formula and one of
 * them disagreed (audit E5).
 *
 * Note that the ORDER is priced at the last one in it and not as the sum of the ladder. That is
 * what this function has always charged and it is preserved deliberately; it is a balance
 * number, it is audit E8, and stage 1 changes none.
 *
 * It no longer returns anything. It used to return the cost of a further simulated click so the
 * caller could file it in `simulatedCostsAll`; the caller asks `upgradePriceFor()` instead.
 */
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

/** The upgrade table renders a display name; the rules speak in kinds. One map, two readers. */
const UPGRADE_KIND_BY_TYPE = Object.freeze({
    "Farm": "farm", "Forest": "forest", "Oil Well": "oilWell", "Fort": "fort"
});
const UPGRADE_BUILT_FIELD_BY_TYPE = Object.freeze({
    "Farm": "farmsBuilt", "Forest": "forestsBuilt", "Oil Well": "oilWellsBuilt", "Fort": "fortsBuilt"
});

/**
 * What one MORE of each upgrade would cost this territory, in the eight-slot shape
 * `checkUpgradeRowsForGreyingOut()` reads: [farmGold, farmMats, forestGold, forestMats, ...].
 *
 * Recomputed from the rules rather than accumulated by simulating clicks, and passed in rather
 * than held at module scope -- which is the whole of audit E4.
 */
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
    if (mode === 0) { //upgrade images
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
    } else if (mode === 1) { //buy military images
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
        const prodPopText = prodPopElement.textContent.trim();
        let prodPopCost = parseInt(prodPopText) || 0;

        if (prodPopText.endsWith("k")) {
            prodPopCost *= 1000;
        } else if (prodPopText.endsWith("M")) {
            prodPopCost *= 1000000;
        }

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

                // Get the image element in the first column
                const imageElement = buyRow.querySelector('.buy-column:first-child img');
                if (imageElement) {
                    if (!imageElement.src.includes('Grey.png')) {
                        imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                    }
                }

                // Get the plus button image in the fifth column
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

                // Get the image element in the first column
                const imageElement = buyRow.querySelector('.buy-column:first-child img');
                if (imageElement) {
                    if (!imageElement.src.includes('Grey.png')) {
                        imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                    }
                }
                // Get the plus button image in the fifth column
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

            // Get the image element in the first column
            const imageElement = buyRow.querySelector('.buy-column:first-child img');

            // Get the plus button image in the fifth column
            const plusButton = buyRow.querySelector('.buyColumn5C .stepper-button');

            if (
                Math.ceil(totalPlayerResources[0].totalGold) >= totalGoldPrice + amountToAdd &&
                Math.ceil(totalPlayerResources[0].totalProdPop) >= totalProdPopCost + amountToAdd
            ) {

                // All conditions are true, ungrey the row
                if (imageElement && imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('Grey.png', '.png');
                }
                setStepperEnabled(plusButton, true);
            }
        });
    }
}

function checkUpgradeRowsForGreyingOut(territory, totalGoldPrice, totalConsMats, simulatedCostsAll, upgradeTable, button, type) {
    //Phase 7.11. `column5CPlus` is a `<button>` now, not an `<img>`: the row's
    //ARTWORK (`firstRowImage`) is still a PNG and still swaps to its `Grey.png`
    //twin, because that art is the farm/forest/oil-well/fort illustration and is
    //deliberately kept. The plus button is drawn, so its disabled state is a class.
    let column5CPlus;
    let firstRowImage;
    const simulatedGoldElements = [simulatedCostsAll[0], simulatedCostsAll[2], simulatedCostsAll[4], simulatedCostsAll[6]];
    const simulatedConsMatsElements = [simulatedCostsAll[1], simulatedCostsAll[3], simulatedCostsAll[5], simulatedCostsAll[7]];

    if (button === "plus") {
        simulatedGoldElements.forEach((simulatedGoldElement, index) => {
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

                // Get the image element in the first column
                const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');
                if (imageElement) {
                    if (!imageElement.src.includes('Grey.png')) {
                        imageElement.src = imageElement.src.replace('.png', 'Grey.png');
                    }
                }
                // Get the plus button image in the fifth column
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

            // Get the image element in the first column
            const imageElement = upgradeRow.querySelector('.upgrade-column:first-child img');

            // Get the plus button image in the fifth column
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

                // All conditions are true, ungrey the row
                if (imageElement && imageElement.src.includes('Grey.png')) {
                    imageElement.src = imageElement.src.replace('Grey.png', '.png');
                }
                setStepperEnabled(plusButton, true);
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

    purchaseArray[0] *= (vehicleArmyPersonnelWorth.infantry * 1000);

    turnGainsArrayPlayer.changeGold += -totalGoldCost;
    turnGainsArrayPlayer.changeProdPop += -totalProdPopCost;

    //update total player resources
    totalPlayerResources[0].totalGold -= totalGoldCost;
    totalPlayerResources[0].totalProdPop -= totalProdPopCost;
    totalPlayerResources[0].totalArmy += parseInt(purchaseArray[0]);
    totalPlayerResources[0].totalInfantry += parseInt(purchaseArray[0]);
    totalPlayerResources[0].totalAssault += parseInt(purchaseArray[1]);
    totalPlayerResources[0].totalAir += parseInt(purchaseArray[2]);
    totalPlayerResources[0].totalNaval += parseInt(purchaseArray[3]);

    //update main array
    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === territory.uniqueId) {
            //audit 5.1 AC: the cost is NOT deducted here. `territory` is the same object as
            //allTerritories()[i], and the two checkForMinusAndTransfer... helpers below each end
            //by deducting their own cost -- that is where a purchase is paid for. Deducting
            //here as well charged the player exactly twice for every military purchase while
            //the buy window quoted the correct, single price.
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


    //Borrow from the player's other territories if this one is short, then charge the
    //cost -- once. See audit 5.1 AC and the comment in the loop above.
    checkForMinusAndTransferMoneyFromRichEnoughTerritories(territory, totalGoldCost);
    checkForMinusAndTransferProdPopFromPopulatedEnoughTerritories(territory, totalProdPopCost);

    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === territory.uniqueId) {
            if (allTerritories()[i].uniqueId === currentSelectedPath.getAttribute("uniqueid")) {
                //update bottom table for selected territory
                bottomTable.update({
                    gold: Math.ceil(territory.goldForCurrentTerritory).toString(),
                    population: formatNumbersToKMB(territory.productiveTerritoryPop) + " (" + formatNumbersToKMB(territory.territoryPopulation) + ")",
                    army: formatNumbersToKMB(territory.armyForCurrentTerritory),
                });
                break;
            }
        }
    }

    //update top table for selected territory
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
    //push upgrades in table to an array
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

    //update total player resources
    totalPlayerResources[0].totalGold -= totalGoldCost;
    totalPlayerResources[0].totalConsMats -= totalConsMatsCost;

    turnGainsArrayPlayer.changeGold += -totalGoldCost;
    turnGainsArrayPlayer.changeConsMats += -totalConsMatsCost;

    //update main array
    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].uniqueId === territory.uniqueId) {
            allTerritories()[i].goldForCurrentTerritory -= totalGoldCost; //subtract gold from territory
            allTerritories()[i].consMatsForCurrentTerritory -= totalConsMatsCost; // subtract consMats from territory
            //Economy stage 1.3. `applyUpgrade()` is the one definition of what an upgrade
            //does, and the AI goes through the same one -- which is what closes audit E1 and
            //E2 by construction rather than by two parallel fixes.
            //
            //audit 5.1 A, preserved by that function and pinned by a unit test: each building
            //bought in THIS transaction is worth +10% of the capacity the territory had BEFORE
            //the transaction. It used to read `territory.farmsBuilt` -- the same object,
            //already incremented -- and apply the running total as a multiplier against the
            //already-boosted capacity, so a 5th farm applied +50% on top of an inflated figure.
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

    //update top table for selected territory
    topTable.update({
        gold: Math.ceil(totalPlayerResources[0].totalGold).toString(),
        consMats: Math.ceil(totalPlayerResources[0].totalConsMats).toString(),
    });

    //close upgrade window for selected territory
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

    // Allocate 10% of the initialValue to infantry
    const infantryAllocation = Math.floor(initialValue * initialArmyDistribution.infantryShare);
    initialDistribution.infantry = infantryAllocation;
    let remainingArmyValue = initialValue - infantryAllocation;

    // Allocate naval units based on available oil (limited to 20% of oilTerritory and 30% of remainingArmyValue)
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

    // Allocate air units based on available oil (limited to 20% of oilTerritory and 20% of remainingArmyValue)
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

    // Allocate assault units based on available oil (limited to 20% of oilTerritory and 20% of remainingArmyValue)
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

    // Add the remainingArmyValue to the infantry
    initialDistribution.infantry += Math.floor(remainingArmyValue);

    return initialDistribution;
}

/**
 * Recompute which of a territory's vehicles it can fuel, and roll the answer up into the
 * player's totals.
 *
 * Phase 5.2: the gating itself is useableUnitsFor() in src/rules/economy/capacity.js and is
 * pure. This is the part that is not: writing the answer onto the territory and refreshing
 * the two table cells that show it. The three scans of all 359 territories the legacy
 * version did -- one to read the territory, one to write it back, one to total the player up
 * -- are a lookup and a single pass.
 */
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
        /*         console.log("Territory needs to borrow money");
                console.log("Here's the descending list of gold in the player owned territories:"); */

        for (let i = 0; i < allTerritories().length; i++) {
            for (let j = 0; j < playerOwnedTerritories.length; j++) {
                if (allTerritories()[i].uniqueId !== territory.uniqueId && allTerritories()[i].uniqueId === playerOwnedTerritories[j].getAttribute("uniqueid")) {
                    descendingGoldArray.push([allTerritories()[i].goldForCurrentTerritory, allTerritories()[i].uniqueId]);
                }
            }
        }

        descendingGoldArray.sort((a, b) => b[0] - a[0]);
        /*         console.log(descendingGoldArray);

                console.log("Here is the shortfall:") */
        let remainingGold = goldCost - territory.goldForCurrentTerritory;
        /*         console.log(remainingGold); */

        for (const [goldAmount, uniqueId] of descendingGoldArray) {
            const transferAmount = Math.min(
                remainingGold,
                goldAmount,
                Math.abs(goldAmount)
            );

            for (let i = 0; i < allTerritories().length; i++) {
                if (allTerritories()[i].uniqueId === uniqueId) {
                    /* console.log(transferAmount + "was taken from " + allTerritories()[i].territoryName); */
                    allTerritories()[i].goldForCurrentTerritory -= transferAmount;
                    /* console.log("and added to " + territory.territoryName); */
                    territory.goldForCurrentTerritory += transferAmount;
                }
            }

            remainingGold = goldCost - territory.goldForCurrentTerritory;
            /* console.log("now there is a shortfall of " + remainingGold + " gold."); */

            if (remainingGold <= 0) {
                /* console.log("balancing complete, exiting function."); */
                break;
            }
        }
    } else {
        /* console.log("Territory does not need to borrow money"); */
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
    // Define scaling factors for each factor
    const areaScale = territoryStrengthScales.area;
    const resourceScale = territoryStrengthScales.resources;
    const devIndexScale = territoryStrengthScales.devIndex;
    const populationScale = territoryStrengthScales.population;
    const continentModifierScale = territoryStrengthScales.continentModifier;
    const armyScale = territoryStrengthScales.army;

    // Calculate the scaled values for each factor
    const scaledArea = area * areaScale;
    const scaledResources = (goldForCurrentTerritory + oilForCurrentTerritory + consMatsForCurrentTerritory + foodForCurrentTerritory) * resourceScale;
    const scaledDevIndex = devIndex * devIndexScale;
    const scaledPopulation = territoryPopulation * populationScale;
    const scaledContinentModifier = continentModifier * continentModifierScale;
    const scaledArmy = armyForCurrentTerritory * armyScale;

    // Calculate the strength value based on the scaled factors
    const strengthValue = scaledArea + scaledResources + scaledDevIndex + scaledPopulation + scaledContinentModifier + scaledArmy;

    // Round the strength value to the nearest integer
    const roundedStrength = Math.round(strengthValue);

    return roundedStrength;
}

export function setDemandArray(value) {
    return demandArray = value;
}

function calculateStartingArmy(territory) {
    let army = (territory.startingPop * startingArmy.populationRate) * parseFloat(territory.dev_index);

    if (startingArmy.moderatedCountries.includes(territory.country)) {
        army = Math.floor(army / startingArmy.moderationDivisor); //their starting populations dwarf everyone else's
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

        // console.log(`${element.territoryName} now has ${element.fortsBuilt} and it ${wasPlayerTerritory} a player territory.  Incidentally, their defense bonus is now ${element.defenseBonus}`);
    });
}

function allWorkaroundOnSiegeTable() {
    const warTable = document.getElementById(ids.uiTable); // Assuming you have a reference to the warTable element

    // Iterate through each warRow element
    const warRows = warTable.getElementsByClassName("ui-table-row-war");
    for (let i = 0; i < warRows.length; i++) {
        const warRow = warRows[i];
        const warRowChildren = warRow.children;

        // Iterate through each child element of warRow
        for (let j = 0; j < warRowChildren.length; j++) {
            const child = warRowChildren[j];

            // Check if the child's index is between 5 and 8 (inclusive)
            if (j >= 5 && j <= 8 && child.innerHTML.includes("All")) {
                // Change any "0" values to "All / All"
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
    return result; //true leaves siege
}

//Phase 5.2: army upkeep is src/rules/economy/maintenance.js. armyMaintenanceFor() is
//imported directly at the two call sites.



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
        // Calculate the nth-child position
        const nthChildPosition = Array.from(currentElement.parentElement.children).indexOf(currentElement) + 1;
        return nthChildPosition;
    }

    return null; // Input element is not within a .buy-row
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
//--- save/load ------------------------------------------------------------
//
//Phase 7.3. Everything below is derived -- it is what newTurnResources() and
//calculateTerritoryStrengths() compute at the top of a turn -- but a load does not
//re-run the top of a turn. Re-running it would grant the turn's income a second
//time, which is the whole reason a restored game resumes INSIDE the saved turn
//rather than by replaying it. So the derived tables are saved rather than
//recalculated.
//
//`totalPlayerResources` and `countryResourceTotals` are `export const`, imported by
//reference in five files, so they are refilled in place. The rest are `export let`,
//so an assignment here reaches every importer through its live binding.
//
//`playerOwnedTerritories` is deliberately NOT saved: it holds SVG path elements,
//which do not serialise, and getPlayerTerritories() rebuilds it from the map in a
//single pass.
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
