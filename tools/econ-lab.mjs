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
//   node tools/econ-lab.mjs bonus           what a continent held whole is worth, per continent
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
const upgrades = await load("src/rules/economy/upgrades.js");
const seeding = await load("src/rules/economy/seeding.js");

const QUIET = income.QUIET_TURN;

// --- reconstruct a territory the way assignArmyAndResourcesToPaths() does -----------------
//
// The three starting-continent tables used to be copied here, because they were written inline
// in `resourceCalculations.js` and there was nothing to import. Stage 1.13 moved them into
// `balance.js` and stage 3.2 moved the arithmetic that uses two of them into
// `src/rules/economy/seeding.js` -- so nothing in this file re-implements the game any more.
// That is the point: a measuring instrument carrying its own copy of the thing it measures will
// eventually measure the copy, and this file's whole job is that its numbers are the game's.

const SEED_GOLD_CONTINENT = balance.startingGoldContinentModifiers;

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
        oilCapacity: seeding.initialOilCapacityFor({ area, devIndex, continent: country.continent }),
        consMatsCapacity: seeding.initialConsMatsCapacityFor({
            area, devIndex, continent: country.continent, population: territoryPopulation
        }),
        foodCapacity: territoryPopulation + army,
        farmsBuilt: 0, forestsBuilt: 0, oilWellsBuilt: 0, fortsBuilt: 0,
        isLandLockedBonus: 0, oilDemand: 0
    };
}

/**
 * The price the game actually charges -- `upgradePriceFor()`, imported and not copied.
 *
 * QUADRATIC in `nth`, not linear (audit section 4 E6). `nth` is the number STANDING AFTER the
 * purchase. This was a local copy of the formula until stage 3, which is the same trap the
 * continent tables were: a copy that agrees today and is measuring the wrong game a year later.
 */
const upgradePrice = upgrades.upgradePriceFor;

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

    // The floor. A territory with nothing at all still earns this, every turn, forever. Since
    // economy stage 2.1 it is a named constant rather than a side effect of a normalisation
    // window; audit section 4 D1 is what follows from its size.
    const floor = income.goldChangeFor(
        { continent: "Africa", area: 0, devIndex: 0.3, productiveTerritoryPop: 0 }, QUIET);
    console.log(`\nTHE FLOOR: a territory with no population, no area and the worst continent`);
    console.log(`multiplier on the map earns ${floor.toFixed(2)} gold a turn.`);
    console.log(`  TERRITORY_BASE_INCOME = ${balance.TERRITORY_BASE_INCOME}` +
        `, plus scaled / ${balance.goldIncome.earnedDivisor} earned`);
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
    console.log("A farm is +10% of the food ceiling PLUS a flat " +
        `${balance.upgradeFlatCapacityGain.food.toLocaleString("en-GB")} (economy stage 3.1);`);
    console.log("population equilibrates to the ceiling, and population is the input to gold");
    console.log("income. The flat term is the whole of the gain at the bottom of the map and a");
    console.log("rounding error at the top, which is how the small are nudged without the large");
    console.log("being taxed to pay for it.\n");

    const goldAtPopulation = (territory, multiplier) => income.goldChangeFor({
        continent: territory.continent,
        area: territory.area,
        devIndex: territory.devIndex,
        productiveTerritoryPop: population.productivePopulationFor(
            territory.territoryPopulation * multiplier, territory.devIndex) -
            territory.armyForCurrentTerritory
    }, QUIET);

    //What N farms multiply a territory's population by. The ceiling is the population plus the
    //army, and `applyUpgrade()` adds `(0.1 * ceiling + flat)` per farm without compounding --
    //so this is the same arithmetic the game does, expressed as a multiplier.
    const populationMultiplierAfterFarms = (territory, nth) => {
        const ceiling = territory.foodCapacity;
        const gain = ((ceiling * upgrades.CAPACITY_GAIN_PER_UPGRADE) +
            balance.upgradeFlatCapacityGain.food) * nth;
        return (ceiling + gain) / ceiling;
    };

    const paybackOfFirstFarm = (territory) => {
        const base = goldAtPopulation(territory, 1);
        const gain =
            goldAtPopulation(territory, populationMultiplierAfterFarms(territory, 1)) - base;
        return gain > 0 ? upgradePrice("farm", 1, territory.devIndex).gold / gain : Infinity;
    };

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
            const gain =
                goldAtPopulation(territory, populationMultiplierAfterFarms(territory, nth)) - base;
            const payback = gain > 0 ? `${Math.round(cumulativeGold / gain)} turns` : "never";
            console.log(`   farm ${nth}:  +${pad(gain, 9, 2)} gold/turn` +
                `   cumulative cost ${String(cumulativeGold).padStart(6)}g` +
                `   payback ${payback}`);
        }
        console.log();
    }
    //Checklist 3.4 wants this across the WHOLE map and not over seven hand-picked names,
    //because the claim being tested is about a SPREAD: it must collapse to roughly one order of
    //magnitude and NOT to zero. A flat payback curve would mean size had stopped paying, which
    //is the thing stage 3 exists to avoid.
    console.log("=== THE FIRST FARM, ACROSS THE WHOLE MAP ===");
    console.log("turns for one farm to pay for itself, every territory in the sample:\n");
    const paybacks = territories.map(paybackOfFirstFarm)
        .filter(Number.isFinite).sort((a, b) => a - b);
    const percentile = (fraction) => paybacks[Math.floor(fraction * (paybacks.length - 1))];
    console.log(`  min ${pad(percentile(0), 8, 1)}   p25 ${pad(percentile(0.25), 8, 1)}` +
        `   median ${pad(percentile(0.5), 8, 1)}   p95 ${pad(percentile(0.95), 8, 1)}` +
        `   max ${pad(percentile(1), 8, 1)}`);
    console.log(`  spread: ${(Math.log10(percentile(1) / percentile(0))).toFixed(2)} orders of ` +
        "magnitude, min to max");
    console.log("\nBefore stage 3 that read min 0.8, median 14.1, p95 472.5, max 3,780.0 --");
    console.log("4.49 orders of magnitude, and audit section 4 D2 is what followed from it.");
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

    console.log("\nEconomy stage 4.1 (audit D4). Before it, the last four columns read");
    console.log("1.00 force per person and 0.050 upkeep per thousand force for EVERY type --");
    console.log("so prod-pop was a pure army-size cap, upkeep did not discriminate, and");
    console.log("infantry strictly DOMINATED naval in open battle: same force per gold, same");
    console.log("force per person, same upkeep, and no oil bill. Nothing but the die modifiers");
    console.log("and the siege score told a rifleman from a battleship.");
    console.log("\nNow the two middle columns pull against each other. A vehicle is CREWED");
    console.log("rather than manned -- 1.67 to 2.50 units of force per person against");
    console.log("infantry\u2019s 1.00 -- and pays for it in gold, in upkeep, and in oil. So a poor");
    console.log("populous country and a rich thinly-peopled one field different armies, which");
    console.log("is the decision the economy was not offering.");
    console.log("\nThe GOLD prices are deliberately untouched, and that is what preserves the");
    console.log("one economic decision the military layer already had: vehicles are 5-6x better");
    console.log("per gold in a siege and no better than infantry in the open. Oil is what prices");
    console.log("that split. Anything that changes unit costs again has to preserve it.");
}

// --- construction materials ---------------------------------------------------------------

function reportConsMats() {
    console.log("=== CONSTRUCTION MATERIALS: the currency upgrades are priced in ===\n");
    console.log("Cons. mats. buy upgrades and nothing else, so this ceiling decides who is");
    console.log("allowed into the upgrade tree at all. It was set at world creation from AREA");
    console.log("almost entirely, which locked a small developed country out of its own economy");
    console.log("at any price -- audit section 4 D7. Economy stage 3.2 added a POPULATION term");
    console.log("and raised the floor, so the ceiling answers to people as well as to land.\n");

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
    const allTurns = territories.map((territory) => {
        let ladder = 0;
        for (const kind of ["farm", "forest", "oilWell", "fort"]) {
            for (let nth = 1; nth <= 5; nth++) {
                ladder += upgradePrice(kind, nth, territory.devIndex).consMats;
            }
        }
        return ladder /
            (territory.consMatsCapacity * balance.resourceRegeneration.consMats.growth);
    }).sort((a, b) => a - b);
    const at = (fraction) => allTurns[Math.floor(fraction * (allTurns.length - 1))];
    console.log(`\nwhole map:  min ${at(0).toFixed(0)}   p25 ${at(0.25).toFixed(0)}` +
        `   median ${at(0.5).toFixed(0)}   p95 ${at(0.95).toFixed(0)}   max ${at(1).toFixed(0)}`);
    console.log("Before stage 3.2 that read min 1, median 108, p95 193, max 203 -- and Germany,");
    console.log("rich and developed and the highest income in Europe, sat at eighty turns while");
    console.log("China sat at one. The spread does not close to nothing and must not: China");
    console.log("still fills its slots in a turn and an island still needs thirty.");
}

// --- the continent bonus, against the base income --------------------------------------------

function reportBonus() {
    console.log("=== THE CONTINENT BONUS, NOW THAT INCOME HAS TWO HALVES ===\n");
    console.log("Economy stage 2.4. Income is TERRITORY_BASE_INCOME + earned. So a 1.5x gold");
    console.log("bonus for holding a continent whole can multiply the WHOLE income or the");
    console.log("EARNED part alone, and until stage 2.1 there was no line between them to");
    console.log("choose. This is the measurement the choice was made on.\n");

    const base = balance.TERRITORY_BASE_INCOME;
    const multiplier = balance.CONTINENT_BONUS_GOLD;

    const byContinent = new Map();
    for (const territory of territories) {
        const gold = income.goldChangeFor(territory, QUIET);
        const earned = Math.max(0, gold - base);
        if (!byContinent.has(territory.continent)) {
            byContinent.set(territory.continent, []);
        }
        byContinent.get(territory.continent).push({ gold, earned });
    }

    console.log("continent        n   mean gold/turn   mean EARNED   whole-income bonus   earned-only bonus");
    const rows = [...byContinent].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [continent, list] of rows) {
        const meanGold = list.reduce((t, r) => t + r.gold, 0) / list.length;
        const meanEarned = list.reduce((t, r) => t + r.earned, 0) / list.length;
        //What the bonus ADDS per territory per turn under each rule.
        const whole = meanGold * (multiplier - 1);
        const earnedOnly = meanEarned * (multiplier - 1);
        console.log(`  ${continent.padEnd(15)}${pad(list.length, 3, 0)}` +
            `${pad(meanGold, 17)}${pad(meanEarned, 14)}` +
            `${pad(whole, 21)}${pad(earnedOnly, 20)}`);
    }

    console.log("\nThe column that decides it is the last one. Under an EARNED-ONLY rule the");
    console.log("bonus is worth almost nothing on a continent of small territories -- and");
    console.log("OCEANIA is exactly that: 65 islands, the second largest continent by count,");
    console.log("almost every one of them needing a naval crossing, and by a wide margin the");
    console.log("hardest continent on the map to complete. An earned-only rule would pay the");
    console.log("least for the hardest objective in the game.");
    console.log("\nSo the bonus multiplies the WHOLE income, base included. That is also the");
    console.log("status quo, which means stage 2 moves no money at all -- but it is now a");
    console.log("decision with a reason rather than an accident of where the line happened");
    console.log("to sit. See known-issue BO before touching it: no continent is currently");
    console.log("completed in a 150-turn game, so weakening this dial would be the wrong way.");
}

// --- main ---------------------------------------------------------------------------------

const sections = {
    income: reportIncome,
    upgrades: reportUpgrades,
    units: reportUnits,
    consmats: reportConsMats,
    bonus: reportBonus
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
