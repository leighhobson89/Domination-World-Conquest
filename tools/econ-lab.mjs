// The economy, measured. What a territory earns, what an upgrade costs, how long it takes to
// pay for itself, and what a gold buys in combat.
//
// docs/05-economy-audit.md section 3 is this script's output. Every number quoted in that
// document comes from here, which is the point: the economy's failure mode is that nothing
// throws, every turn completes, and the map quietly stops being interesting -- so the claims
// have to be reproducible rather than remembered.
//
// It runs in Node with no browser, which is only possible because `src/rules/economy/` imports
// nothing but `src/config/`. Do not add an import that breaks that.
//
//   node tools/econ-lab.mjs                 all four tables
//   node tools/econ-lab.mjs income          gold income spread, the floor, and by continent
//   node tools/econ-lab.mjs upgrades        the price ladder and what a farm pays back
//   node tools/econ-lab.mjs units           what a gold buys in combat force
//   node tools/econ-lab.mjs consmats        the construction-materials bottleneck
//
// The sample is one territory per COUNTRY -- `percentOfWholeArea` is 1 for a single-path
// country, so the reconstruction below is exact for those and representative for the rest.

import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const load = (relative) => import(new URL(`file://${path.resolve(root, relative).replace(/\\/g, "/")}`).href);

const { dataTableCountriesInitialState: COUNTRIES } = await load("initialData.js");
const balance = await load("src/config/balance.js");
const income = await load("src/rules/economy/income.js");
const population = await load("src/rules/economy/population.js");
const maintenance = await load("src/rules/economy/maintenance.js");

const QUIET = income.QUIET_TURN;

// --- reconstruct a territory the way assignArmyAndResourcesToPaths() does -----------------
//
// The three continent tables below are inline in `resourceCalculations.js` and are NOT in
// balance.js -- that is known-issue BN's neighbour, audit section 4 E7, and checklist item
// 1.13 moves them. They are copied here rather than imported for exactly that reason; when
// 1.13 lands, import them instead and delete these.

const SEED_GOLD_CONTINENT = {
    "Europe": 15, "North America": 14, "Asia": 1,
    "Oceania": 1, "South America": 1.8, "Africa": 2
};
const SEED_OIL_CONTINENT = {
    "Europe": 1.4, "North America": 1.5, "Africa": 1.8,
    "South America": 1.6, "Oceania": 1.2, "Asia": 1.5
};
const SEED_CONSMATS_CONTINENT = {
    "Europe": 1.2, "North America": 1.6, "Africa": 1.3,
    "South America": 1.8, "Oceania": 0.8, "Asia": 1.8
};

/** The shared three-term shape both `initialOilCalculation()` and its cons-mats twin use. */
function seedStock(area, devIndex, continentModifier) {
    return Math.abs(Math.pow(area / 1000, 1.5) * devIndex * (continentModifier - 1) * 0.1) +
        (Math.pow(area / 1000, 0.5) * devIndex * 50) +
        (Math.pow(area / 1000, 0.5) * continentModifier * 10);
}

function territoryFor(country) {
    const devIndex = parseFloat(country.dev_index);
    const area = country.area;
    const territoryPopulation = country.startingPop;
    // `calculateStartingArmy()`: a fraction of the population, times development, capped by the
    // real figure. Close enough for the upkeep column and irrelevant to everything else.
    const army = Math.min(
        country.startingArmy,
        territoryPopulation * balance.startingArmy.populationRate * devIndex);

    return {
        territoryName: country.country,
        dataName: country.country,
        continent: country.continent,
        area,
        devIndex,
        territoryPopulation,
        productiveTerritoryPop:
            population.productivePopulationFor(territoryPopulation, devIndex) - army,
        armyForCurrentTerritory: army,
        infantryForCurrentTerritory: army,
        assaultForCurrentTerritory: 0, airForCurrentTerritory: 0, navalForCurrentTerritory: 0,
        useableAssault: 0, useableAir: 0, useableNaval: 0,
        goldForCurrentTerritory: Math.max(
            (country.res_gold * ((area / 8000000) * devIndex)) +
            ((territoryPopulation / 50000) * SEED_GOLD_CONTINENT[country.continent]), 300),
        oilCapacity: seedStock(area, devIndex, SEED_OIL_CONTINENT[country.continent]),
        consMatsCapacity: Math.max(
            seedStock(area, devIndex, SEED_CONSMATS_CONTINENT[country.continent]), 500),
        foodCapacity: territoryPopulation + army,
        farmsBuilt: 0, forestsBuilt: 0, oilWellsBuilt: 0, fortsBuilt: 0,
        isLandLockedBonus: 0, oilDemand: 0
    };
}

/**
 * The price the game actually charges, from `incrementDecrementUpgrades()`.
 *
 * QUADRATIC in `nth`, not linear -- `balance.js` says "the Nth costs N times this" and is
 * wrong by a whole power (audit section 4 E6). `nth` is the number STANDING AFTER the purchase.
 */
function upgradePrice(kind, nth, devIndex) {
    const consMatsMultiplier = kind === "farm" ? 1.1 : 1.05;
    return {
        gold: Math.ceil(
            balance.territoryUpgradeBaseCostsGold[kind] * nth * (nth * 1.05) * (devIndex / 4)),
        consMats: Math.ceil(
            balance.territoryUpgradeBaseCostsConsMats[kind] * nth * (nth * consMatsMultiplier) *
            (devIndex / 4))
    };
}

const territories = COUNTRIES.map(territoryFor);
const pad = (value, width, places = 1) =>
    (typeof value === "number" ? value.toFixed(places) : String(value)).padStart(width);

// --- income ------------------------------------------------------------------------------

function reportIncome() {
    console.log("=== GOLD INCOME PER TURN (turn one, no continent bonus) ===\n");

    const rows = territories.map((territory) => ({
        name: territory.dataName,
        continent: territory.continent,
        devIndex: territory.devIndex,
        gold: income.goldChangeFor(territory, QUIET),
        upkeep: maintenance.armyMaintenanceFor(territory)
    })).sort((a, b) => b.gold - a.gold);

    const show = (label, list) => {
        console.log(label);
        for (const row of list) {
            console.log(`  ${row.name.padEnd(24)}${row.continent.padEnd(16)}` +
                `dev ${row.devIndex.toFixed(3)}  gold/turn ${pad(row.gold, 9)}` +
                `  upkeep ${pad(row.upkeep, 8)}  net ${pad(row.gold - row.upkeep, 9)}`);
        }
    };
    show("richest twelve:", rows.slice(0, 12));
    console.log();
    show("poorest twelve:", rows.slice(-12));

    const sorted = rows.map((row) => row.gold).sort((a, b) => a - b);
    const at = (fraction) => sorted[Math.floor(fraction * (sorted.length - 1))];
    console.log(`\nspread:  min ${pad(sorted[0], 8)}   p25 ${pad(at(0.25), 8)}` +
        `   median ${pad(at(0.5), 8)}   p75 ${pad(at(0.75), 8)}` +
        `   max ${pad(sorted[sorted.length - 1], 9)}`);
    console.log(`         max/median ${(sorted[sorted.length - 1] / at(0.5)).toFixed(1)}x` +
        `   max/min ${(sorted[sorted.length - 1] / sorted[0]).toFixed(1)}x`);

    // The floor. A territory with nothing at all still earns this, every turn, forever --
    // it is `normaliseMin` showing through, and audit section 4 D1 is what follows from it.
    const floor = income.goldChangeFor(
        { continent: "Africa", area: 0, devIndex: 0.3, productiveTerritoryPop: 0 }, QUIET);
    console.log(`\nTHE FLOOR: a territory with no population, no area and the worst continent`);
    console.log(`multiplier on the map earns ${floor.toFixed(2)} gold a turn.`);
    console.log(`  = (0 - normaliseMin) / (normaliseMax - normaliseMin) x 100` +
        `   [${balance.goldIncome.normaliseMin} .. ${balance.goldIncome.normaliseMax}]`);
    console.log(`  which is ${((floor / at(0.5)) * 100).toFixed(0)}% of what a MEDIAN ` +
        `territory earns in total.\n`);

    console.log("how much productive population it takes to climb off the floor");
    console.log("(Africa, dev 0.5, area 500,000):");
    for (const prodPop of [1e4, 1e5, 1e6, 1e7, 1e8, 5e8]) {
        const gold = income.goldChangeFor({
            continent: "Africa", area: 500000, devIndex: 0.5, productiveTerritoryPop: prodPop
        }, QUIET);
        console.log(`  prodPop ${pad(prodPop.toExponential(0), 9)}` +
            `  ->  ${pad(gold, 9, 2)} gold/turn   (${pad(gold - floor, 9, 2)} above the floor)`);
    }

    console.log("\nby continent, mean gold/turn:");
    const byContinent = new Map();
    for (const row of rows) {
        if (!byContinent.has(row.continent)) {
            byContinent.set(row.continent, []);
        }
        byContinent.get(row.continent).push(row.gold);
    }
    const mean = (list) => list.reduce((total, value) => total + value, 0) / list.length;
    for (const [continent, list] of [...byContinent].sort((a, b) => mean(b[1]) - mean(a[1]))) {
        console.log(`  ${continent.padEnd(16)}n=${String(list.length).padStart(3)}` +
            `  mean ${pad(mean(list), 9)}` +
            `   goldContinentModifier ${balance.goldContinentModifiers[continent]}`);
    }
}

// --- upgrades ----------------------------------------------------------------------------

function reportUpgrades() {
    console.log("=== UPGRADE PRICE LADDER ===");
    console.log("ceil(base * n * (n * 1.05) * devIndex / 4)  --  QUADRATIC in n\n");
    for (const devIndex of [0.3, 0.5, 0.7, 0.92]) {
        console.log(`devIndex ${devIndex.toFixed(2)}:`);
        for (const kind of ["farm", "forest", "oilWell", "fort"]) {
            const ladder = [1, 2, 3, 4, 5].map((nth) => {
                const price = upgradePrice(kind, nth, devIndex);
                return `${price.gold}g/${price.consMats}c`.padStart(13);
            });
            console.log(`  ${kind.padEnd(9)}${ladder.join("")}`);
        }
        console.log();
    }

    console.log("=== WHAT A FARM PAYS BACK ===");
    console.log("A farm is +10% food capacity; population equilibrates to the food ceiling, so");
    console.log("N farms is 1.1^N population, and population is the input to gold income.\n");

    const goldAtPopulation = (territory, multiplier) => income.goldChangeFor({
        continent: territory.continent,
        area: territory.area,
        devIndex: territory.devIndex,
        productiveTerritoryPop: population.productivePopulationFor(
            territory.territoryPopulation * multiplier, territory.devIndex) -
            territory.armyForCurrentTerritory
    }, QUIET);

    const samples = ["China", "Brazil", "Germany", "Nigeria", "Chad", "Fiji", "Vatican City"];
    for (const name of samples) {
        const territory = territories.find((candidate) => candidate.dataName === name);
        if (!territory) {
            continue;
        }
        const base = goldAtPopulation(territory, 1);
        console.log(`${name.padEnd(16)}base ${base.toFixed(1)} gold/turn, dev ` +
            `${territory.devIndex.toFixed(3)}`);
        let cumulativeGold = 0;
        for (let nth = 1; nth <= 5; nth++) {
            cumulativeGold += upgradePrice("farm", nth, territory.devIndex).gold;
            const gain = goldAtPopulation(territory, Math.pow(1.1, nth)) - base;
            const payback = gain > 0 ? `${Math.round(cumulativeGold / gain)} turns` : "never";
            console.log(`   farm ${nth}:  +${pad(gain, 9, 2)} gold/turn` +
                `   cumulative cost ${String(cumulativeGold).padStart(6)}g` +
                `   payback ${payback}`);
        }
        console.log();
    }
    console.log("The same upgrade, at nearly the same price, pays back in under one turn and");
    console.log("in thirteen thousand. Audit section 4 D2 is what follows from that.");
}

// --- units -------------------------------------------------------------------------------

function reportUnits() {
    console.log("=== WHAT A GOLD BUYS IN COMBAT FORCE ===\n");
    const worth = balance.vehicleArmyPersonnelWorth;
    const rows = [
        ["Infantry (x1000)", balance.armyGoldPrices.infantry, balance.armyProdPopPrices.infantry,
            1000 * worth.infantry, 0,
            balance.armyCostPerTurn.infantry * 1000, balance.armyTypeSiegeValues.infantry * 1000],
        ["Assault", balance.armyGoldPrices.assault, balance.armyProdPopPrices.assault,
            worth.assault, balance.oilRequirements.assault,
            balance.armyCostPerTurn.assault, balance.armyTypeSiegeValues.assault],
        ["Air", balance.armyGoldPrices.air, balance.armyProdPopPrices.air,
            worth.air, balance.oilRequirements.air,
            balance.armyCostPerTurn.air, balance.armyTypeSiegeValues.air],
        ["Naval", balance.armyGoldPrices.naval, balance.armyProdPopPrices.naval,
            worth.naval, balance.oilRequirements.naval,
            balance.armyCostPerTurn.naval, balance.armyTypeSiegeValues.naval]
    ];

    console.log("purchase           gold  prodPop    force  oil/turn  upkeep/t" +
        "  force/gold  force/pop  upkeep/1k force  siege/gold");
    for (const [name, gold, prodPop, force, oil, upkeep, siege] of rows) {
        console.log(`${name.padEnd(18)}${pad(gold, 5, 0)}${pad(prodPop, 9, 0)}` +
            `${pad(force, 9, 0)}${pad(oil, 10, 0)}${pad(upkeep, 10, 3)}` +
            `${pad(force / gold, 12)}${pad(force / prodPop, 11, 2)}` +
            `${pad((upkeep / force) * 1000, 16, 3)}${pad(siege / gold, 12, 4)}`);
    }

    console.log("\nThree things fall out of that table:");
    console.log("  - productive population costs exactly 1 per unit of force for EVERY type,");
    console.log("    so prod-pop is an army-size cap and never decides WHICH unit to buy;");
    console.log("  - upkeep per 1,000 force is identical for every type, so upkeep does not");
    console.log("    discriminate either;");
    console.log("  - infantry and naval are identical on gold, prod-pop and upkeep per unit of");
    console.log("    force, and naval additionally burns 1,000 oil a turn. In OPEN BATTLE,");
    console.log("    infantry strictly dominates naval.");
    console.log("\nThe one real economic decision the military layer offers is siege versus");
    console.log("battle: vehicles are 5-6x better per gold in a siege and worse in the open.");
    console.log("Anything that changes unit costs has to preserve that.");
}

// --- construction materials ---------------------------------------------------------------

function reportConsMats() {
    console.log("=== CONSTRUCTION MATERIALS: the currency upgrades are priced in ===\n");
    console.log("Cons. mats. buy upgrades and nothing else. The capacity is set at world");
    console.log("creation from AREA, almost entirely -- so a small developed country is locked");
    console.log("out of its own upgrade tree at any price (audit section 4 D7).\n");

    console.log("territory          consMats cap   regen/turn   full ladder   turns of regen");
    for (const name of ["China", "Brazil", "Chad", "Nigeria", "Germany", "Fiji", "Vatican City"]) {
        const territory = territories.find((candidate) => candidate.dataName === name);
        if (!territory) {
            continue;
        }
        const capacity = territory.consMatsCapacity;
        const regeneration = capacity * balance.resourceRegeneration.consMats.growth;
        let ladder = 0;
        for (const kind of ["farm", "forest", "oilWell", "fort"]) {
            for (let nth = 1; nth <= 5; nth++) {
                ladder += upgradePrice(kind, nth, territory.devIndex).consMats;
            }
        }
        console.log(`  ${name.padEnd(17)}${pad(capacity, 12, 0)}${pad(regeneration, 13, 0)}` +
            `${pad(ladder, 14, 0)}${pad(ladder / regeneration, 17, 0)}`);
    }
    console.log("\nGermany is the one to look at: rich, developed, high income, and eighty");
    console.log("turns of saving to fill one territory's upgrade slots. China needs one.");
}

// --- main ---------------------------------------------------------------------------------

const sections = {
    income: reportIncome,
    upgrades: reportUpgrades,
    units: reportUnits,
    consmats: reportConsMats
};

const requested = process.argv.slice(2).filter((argument) => !argument.startsWith("-"));
const chosen = requested.length > 0 ? requested : Object.keys(sections);

for (const name of chosen) {
    const report = sections[name.toLowerCase()];
    if (!report) {
        console.error(`unknown section "${name}". one of: ${Object.keys(sections).join(", ")}`);
        process.exitCode = 1;
        continue;
    }
    report();
    console.log("\n" + "-".repeat(78) + "\n");
}
