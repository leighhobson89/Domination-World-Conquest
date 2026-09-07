// The fight, measured against the REAL MAP -- and against what the AI is told about it.
//
// `tools/battle-lab.mjs` answers "does a matchup of shape X behave as the overhaul designed",
// on a featureless lab territory. That is the right instrument for the dice model in isolation
// and the wrong one for the question this phase exists to answer, which is why a world of 207
// countries stops conquering: the real map is not featureless, the real attacker is scaled
// down by two multipliers before it rolls a die, and the AI does not decide with the function
// that fights.
//
// So this reconstructs the world's DEFENSIVE geography from the same three files the game
// builds it from -- `resources/svgMaster.svg`, `resources/pathAreas.json` and `initialData.js`
// -- and runs the real rules over it. Like `tools/econ-lab.mjs` it IMPORTS every formula it
// measures and re-copies none of them: a measuring instrument holding its own copy of the
// thing it measures will eventually measure the copy.
//
//   node tools/combat-lab.mjs                 every section
//   node tools/combat-lab.mjs terrain         what the map defends with before anyone builds
//   node tools/combat-lab.mjs cliff           real take probability against raw force ratio
//   node tools/combat-lab.mjs calibration     what the AI is told vs what happens
//   node tools/combat-lab.mjs forts           the fort ladder, in both models
//   node tools/combat-lab.mjs siege           what a besieging army has to be
//   node tools/combat-lab.mjs floors          what each AI odds constant means in real terms
//   node tools/combat-lab.mjs cost            whether the AI can afford to ask the real model
//
// It cannot answer "is the game better" or "does the world consolidate". That is
// `tools/ai-sim.mjs`, and no constant should ship on the strength of this file alone.

import { readFileSync } from "node:fs";
import { dataTableCountriesInitialState as COUNTRIES } from "../initialData.js";
import {
    armyTypeSiegeValues,
    siegeDiscipline,
    ATTACK_ADVANTAGE,
    attackDiscipline,
    commitmentDiscipline,
    DICE_ATTACK_ADVANTAGE,
    DICE_SHARE_BANDS,
    DIE_MODIFIERS,
    MOUNTAIN_DEFENSE_SCALE,
    PROBABILITY_THRESHOLD_FOR_SIEGE,
    SIEGE_ARREST_CHANCE
} from "../src/config/balance.js";
import { defenseBonusFor } from "../src/rules/economy/capacity.js";
import { modifiersFor, shareFor } from "../src/rules/military/battleModel.js";
import { defenderDiceCountFor, diceCountFor } from "../src/rules/military/dice.js";
import { battleForecast } from "../src/rules/military/forecast.js";
import {
    areaBonusFor,
    combatContinentModifierFor,
    defenseMultiplierFor,
    winProbability
} from "../src/rules/military/probability.js";
import { scoreDifferenceFor, siegeScore } from "../src/rules/military/siege.js";
import {
    clearTakeProbabilityCache,
    takeProbability,
    takeProbabilityCacheStats
} from "../src/rules/military/takeProbability.js";

/** A bare newline, so this file never has to escape one inside a template. */
const BLANK = String.fromCharCode(10);

const section = process.argv[2] ?? "all";
const wants = (name) => section === "all" || section === name;

// --- the world, as the game seeds it ---------------------------------------

/**
 * Every territory's DEFENSIVE identity, rebuilt from the three files the game uses.
 *
 * Only the fields the combat rules read: area, continent, coastal, the mountain bonus and the
 * fort bonus at whatever fort count is asked for. Army is deliberately absent -- this file
 * measures RATIOS, so an attacking army is always a multiple of the defending one.
 */
function buildWorld(fortsBuilt = 0) {
    const svg = readFileSync(new URL("../resources/svgMaster.svg", import.meta.url), "utf8");
    const areas = JSON.parse(
        readFileSync(new URL("../resources/pathAreas.json", import.meta.url), "utf8")).areas;
    const devIndexOf = new Map(COUNTRIES.map((row) => [row.country, row.dev_index]));

    const territories = [];
    for (const tag of svg.match(/<path[^>]*>/g) ?? []) {
        const attribute = (name) => {
            const found = new RegExp(name + "=\"([^\"]*)\"", "i").exec(tag);
            return found ? found[1] : null;
        };
        const uniqueId = attribute("uniqueid");
        if (uniqueId === null) {
            continue;
        }
        //The ORIGINAL owner, because that is whose development index the territory is seeded
        //with -- and, per CLAUDE.md, whose continent it belongs to.
        const owner = attribute("originalOwner");
        const isCoastal = attribute("isCoastal") === "true";
        const devIndex = devIndexOf.get(owner) ?? 0.7;
        const isLandLockedBonus = isCoastal ? 0 : 10;
        territories.push({
            uniqueId,
            territoryName: attribute("territory-name"),
            dataName: owner,
            continent: attribute("continent"),
            isCoastal,
            devIndex,
            fortsBuilt,
            isLandLockedBonus,
            area: Number(areas[uniqueId]?.area ?? 0),
            defenseBonus: defenseBonusFor({ fortsBuilt, devIndex, isLandLockedBonus }),
            mountainDefenseBonus:
                (parseInt(attribute("mountainDefenseFactor"), 10) || 0) * MOUNTAIN_DEFENSE_SCALE
        });
    }
    return territories;
}

/** Every adjacent pairing whose two sides start under different flags. */
function enemyPairs(territories) {
    const adjacency = JSON.parse(
        readFileSync(new URL("../resources/adjacency.json", import.meta.url), "utf8"));
    const byId = new Map(territories.map((row) => [row.uniqueId, row]));
    const byName = new Map(territories.map((row) => [row.territoryName, row]));
    const pairs = [];
    for (const [uniqueId, neighbours] of Object.entries(adjacency)) {
        const attacker = byId.get(uniqueId);
        if (!attacker) {
            continue;
        }
        for (const name of neighbours) {
            const defender = byName.get(name);
            if (defender && defender.dataName !== attacker.dataName) {
                pairs.push([attacker, defender]);
            }
        }
    }
    return pairs;
}

/** A thinned, deterministic slice of the pairings -- every forecast costs hundreds of battles. */
function slice(pairs, wanted) {
    const step = Math.max(1, Math.floor(pairs.length / wanted));
    const out = [];
    for (let index = 0; index < pairs.length; index += step) {
        out.push(pairs[index]);
    }
    return out;
}

const contextFor = (attacker, defender) => ({
    attackingDevelopmentIndex: Number(attacker.devIndex),
    combatContinentModifier: combatContinentModifierFor(defender)
});

const infantry = (count) => [Math.round(count), 0, 0, 0];
const DEFENDING_FORCE = 100000;

/** The dice each side actually rolls, terrain included. */
function diceFor(attackers, defenders, territory, context) {
    const share = shareFor(attackers, defenders, territory, context);
    const modifiers = modifiersFor(attackers, defenders, territory);
    return {
        share,
        attacker: Math.max(1, diceCountFor(share) + modifiers.attacker.diceChange),
        defender: Math.max(1, defenderDiceCountFor(1 - share) + modifiers.defender.diceChange)
    };
}

const pad = (value, width) => String(value).padStart(width);
const padEnd = (value, width) => String(value).padEnd(width);
const percent = (value, width) => pad(value.toFixed(1) + "%", width);

// --- terrain ---------------------------------------------------------------

if (wants("terrain")) {
    const world = buildWorld(0);
    console.log("\n=== TERRAIN: what the map defends with before anyone builds anything ===\n");

    //The DICE model reads the raw sum against `DIE_MODIFIERS.fortification`; the ODDS function
    //reads the same sum through a ceiling division. They are printed together because the
    //whole finding is that they disagree about the same territory.
    const diceBands = { 0: 0, 1: 0, 2: 0 };
    const oddsMultipliers = {};
    for (const territory of world) {
        const raw = territory.defenseBonus + territory.mountainDefenseBonus;
        const band = DIE_MODIFIERS.fortification.find((row) => raw >= row.minimumBonus);
        diceBands[band ? band.dice : 0] += 1;
        const multiplier = defenseMultiplierFor(territory);
        oddsMultipliers[multiplier] = (oddsMultipliers[multiplier] ?? 0) + 1;
    }
    const penalised = diceBands[1] + diceBands[2];
    console.log("  territories                            " + world.length);
    console.log("  dice taken off the attacker  0 / 1 / 2  "
        + diceBands[0] + " / " + diceBands[1] + " / " + diceBands[2]);
    console.log("  share of the map that costs a die       "
        + (penalised / world.length * 100).toFixed(1) + "%  -- with ZERO forts built");
    console.log("  winProbability defence multiplier       " + JSON.stringify(oddsMultipliers));

    const areaBonuses = world.map(areaBonusFor).sort((a, b) => a - b);
    const at = (share) => areaBonuses[Math.floor(share * (areaBonuses.length - 1))];
    console.log("  areaBonusFor  min / median / max        "
        + at(0).toFixed(3) + " / " + at(0.5).toFixed(3) + " / " + at(1).toFixed(3)
        + "   (never above 1: it only ever penalises a LARGE defender)");

    const devIndexes = COUNTRIES.map((row) => row.dev_index).sort((a, b) => a - b);
    const devAt = (share) => devIndexes[Math.floor(share * (devIndexes.length - 1))];
    console.log("\n  attacker's development index  min / median / max   "
        + devAt(0) + " / " + devAt(0.5) + " / " + devAt(1));
    console.log("  the two multipliers on the ATTACKER, and there is no matching one on the defender:");
    console.log("     DICE_ATTACK_ADVANTAGE            x" + DICE_ATTACK_ADVANTAGE);
    console.log("     devIndex, median                 x" + devAt(0.5));
    console.log("     combat continent modifier        x0.75 (Oceania) .. x0.99 (North America)");
    const combined = devAt(0.5) * 0.85;
    console.log("     combined, median                 x" + combined.toFixed(2)
        + "  -- so the attacker must field " + (1 / combined).toFixed(2) + "x to draw LEVEL");
}

// --- the cliff -------------------------------------------------------------

if (wants("cliff")) {
    console.log("\n=== THE CLIFF: real take probability against raw force ratio ===\n");
    const pairs = slice(enemyPairs(buildWorld(0)), 100);

    console.log("  averaged over " + pairs.length
        + " real adjacent enemy pairings, infantry against infantry\n");
    console.log("  " + padEnd("raw ratio", 12) + pad("commonest dice", 16) + pad("AI is told", 12)
        + pad("real take", 12));
    for (const ratio of [0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 5, 8]) {
        let told = 0;
        let real = 0;
        const shapes = new Map();
        for (const [attacker, defender] of pairs) {
            const attackers = infantry(DEFENDING_FORCE * ratio);
            const defenders = infantry(DEFENDING_FORCE);
            const context = contextFor(attacker, defender);
            told += winProbability(attackers, defenders, defender, context);
            const dice = diceFor(attackers, defenders, defender, context);
            const shape = dice.attacker + "v" + dice.defender;
            shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
            real += battleForecast(
                { attackers, defenders, territory: defender, context }, { trials: 150 }
            ).takeProbability * 100;
        }
        const commonest = [...shapes].sort((a, b) => b[1] - a[1])[0][0];
        console.log("  " + padEnd(ratio.toFixed(2) + ":1", 12) + pad(commonest, 16)
            + percent(told / pairs.length, 12) + percent(real / pairs.length, 12));
    }
    console.log("\n  The outcome is a STEP, not a curve. Below the step the attacker's chance is not");
    console.log("  small, it is zero -- an unanswered die is an automatic hit every single round.");
    console.log("  dice bands: " + DICE_SHARE_BANDS.map((row) => row.minimumShare + "->" + row.dice).join("  "));
}

// --- calibration -----------------------------------------------------------

if (wants("calibration")) {
    console.log("\n=== CALIBRATION: the AI decides with a different function from the one that fights ===\n");
    const cases = [
        ["flat ground, no forts", 0, 0, 1.5],
        ["mountain 3, no forts", 0, 30, 1.5],
        ["mountain 3, no forts", 0, 30, 2.5],
        ["mountain 5, no forts", 0, 50, 2.5],
        ["mountain 3, 2 forts", 2, 30, 4],
        ["mountain 3, 5 forts", 5, 30, 4],
        ["mountain 3, 5 forts", 5, 30, 6]
    ];
    const context = { attackingDevelopmentIndex: 0.745, combatContinentModifier: 0.81 };
    console.log("  a median attacker (devIndex 0.745) into Africa (x0.81), defender area 120,000 km2\n");
    console.log("  " + padEnd("defender", 24) + pad("ratio", 8) + pad("AI is told", 12)
        + pad("real take", 12) + "   the AI's error");
    for (const [label, forts, mountain, ratio] of cases) {
        const territory = {
            area: 120000, isCoastal: true, continent: "Africa", fortsBuilt: forts,
            mountainDefenseBonus: mountain,
            defenseBonus: defenseBonusFor({ fortsBuilt: forts, devIndex: 0.745, isLandLockedBonus: 0 })
        };
        const attackers = infantry(DEFENDING_FORCE * ratio);
        const defenders = infantry(DEFENDING_FORCE);
        const told = winProbability(attackers, defenders, territory, context);
        const real = battleForecast(
            { attackers, defenders, territory, context }, { trials: 600 }).takeProbability * 100;
        const error = told - real;
        const verdict = error > 15 ? "TOO OPTIMISTIC" : error < -15 ? "TOO PESSIMISTIC" : "";
        console.log("  " + padEnd(label, 24) + pad(ratio + ":1", 8) + percent(told, 12)
            + percent(real, 12) + "   " + pad((error > 0 ? "+" : "") + error.toFixed(0), 5)
            + " pts " + verdict);
    }
    console.log("\n  It errs in BOTH directions, and the sign flips on the thing that matters most:");
    console.log("  it over-rates an attack on unfortified mountain and under-rates one on a fortress.");

    //And the same grid against what the AI reads NOW. This is the stage 1 gate: every row
    //inside +/-10 points of the model's own answer.
    console.log(BLANK + "  WHAT THE AI READS AFTER STAGE 1 -- takeProbability() against the model" + BLANK);
    console.log("  " + padEnd("defender", 24) + pad("ratio", 8) + pad("AI is told", 12)
        + pad("real take", 12) + "   error");
    let worst = 0;
    for (const [label, forts, mountain, ratio] of cases) {
        const territory = {
            area: 120000, isCoastal: true, continent: "Africa", fortsBuilt: forts,
            mountainDefenseBonus: mountain,
            defenseBonus: defenseBonusFor({ fortsBuilt: forts, devIndex: 0.745, isLandLockedBonus: 0 })
        };
        const attackers = infantry(DEFENDING_FORCE * ratio);
        const defenders = infantry(DEFENDING_FORCE);
        const told = takeProbability(attackers, defenders, territory, context);
        const real = battleForecast(
            { attackers, defenders, territory, context }, { trials: 600 }).takeProbability * 100;
        const error = told - real;
        worst = Math.max(worst, Math.abs(error));
        console.log("  " + padEnd(label, 24) + pad(ratio + ":1", 8) + percent(told, 12)
            + percent(real, 12) + "   " + pad((error > 0 ? "+" : "") + error.toFixed(1), 6) + " pts");
    }
    console.log(BLANK + "  worst error " + worst.toFixed(1) + " points -- the stage 1 gate is 10.0");
}

// --- forts -----------------------------------------------------------------

if (wants("forts")) {
    console.log("\n=== THE FORT LADDER, in both models ===\n");
    const context = { attackingDevelopmentIndex: 0.745, combatContinentModifier: 0.81 };
    console.log("  devIndex 0.745, mountain factor 3 (bonus 30), coastal, area 120,000 km2\n");
    console.log("  " + padEnd("forts", 7) + pad("defBonus", 10) + pad("+mountain", 11)
        + pad("dice off", 10) + pad("odds x", 8) + "   ratio for a 70% real take");
    for (let forts = 0; forts <= 5; forts++) {
        const defenseBonus = defenseBonusFor({
            fortsBuilt: forts, devIndex: 0.745, isLandLockedBonus: 0
        });
        const territory = {
            area: 120000, isCoastal: true, continent: "Africa", fortsBuilt: forts,
            defenseBonus, mountainDefenseBonus: 30
        };
        const raw = defenseBonus + 30;
        const band = DIE_MODIFIERS.fortification.find((row) => raw >= row.minimumBonus);
        let needed = "never";
        for (const ratio of [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 12, 20, 50]) {
            const forecast = battleForecast({
                attackers: infantry(DEFENDING_FORCE * ratio), defenders: infantry(DEFENDING_FORCE),
                territory, context
            }, { trials: 300 });
            if (forecast.takeProbability >= 0.70) {
                needed = ratio + ":1";
                break;
            }
        }
        console.log("  " + padEnd(forts, 7) + pad(defenseBonus, 10) + pad(raw, 11)
            + pad("-" + (band ? band.dice : 0), 10) + pad("x" + defenseMultiplierFor(territory), 8)
            + "   " + needed);
    }
    console.log("\n  Five forts cost the attacker half a rung of force in the model that FIGHTS and");
    console.log("  eight and a half times the defence in the one the AI DECIDES on.");
}

// --- siege -----------------------------------------------------------------

if (wants("siege")) {
    console.log("\n=== SIEGE: what a besieging army has to BE ===\n");
    console.log("  siege value per unit  " + JSON.stringify(armyTypeSiegeValues));
    console.log("  so one point of siege score costs " + (1 / armyTypeSiegeValues.infantry)
        + " infantry, or a tenth of one naval unit\n");
    console.log("  " + padEnd("besieging force", 26) + pad("score", 8)
        + pad("x" + ATTACK_ADVANTAGE, 8) + "   difference against a defence of 20 / 30 / 40 / 50");
    const forces = [
        ["100,000 infantry", [100000, 0, 0, 0]],
        ["250,000 infantry", [250000, 0, 0, 0]],
        ["1,000,000 infantry", [1000000, 0, 0, 0]],
        ["10 naval", [0, 0, 0, 10]],
        ["20 assault + 10 air", [0, 20, 10, 0]]
    ];
    for (const [label, army] of forces) {
        const score = siegeScore(army);
        const differences = [20, 30, 40, 50]
            .map((defence) => pad(Math.round(scoreDifferenceFor(score, {
                defenseBonus: defence, mountainDefenseBonus: 0
            })), 7)).join("");
        console.log("  " + padEnd(label, 26) + pad(score, 8)
            + pad(Math.round(score * ATTACK_ADVANTAGE), 8) + "  " + differences);
    }
    console.log("\n  A NEGATIVE difference is the arrest band: " + (SIEGE_ARREST_CHANCE * 100)
        + "% chance a turn that the besieging");
    console.log("  army is destroyed outright and half of it joins the defender. Every real territory");
    console.log("  on the map carries a mountain bonus of at least 10, so an infantry-only siege is in");
    console.log("  the arrest band until it is a QUARTER OF A MILLION MEN -- and the AI's reinforcement");
    console.log("  route (src/ai/muster.js) moves infantry and nothing else.");
}

// --- floors ----------------------------------------------------------------

if (wants("floors")) {
    console.log(BLANK + "=== FLOORS: what each AI constant means in real terms ===" + BLANK);
    const pairs = slice(enemyPairs(buildWorld(0)), 80);

    /**
     * The raw force ratio at which `scoreFor` averages `target`, and the REAL take probability
     * there.
     *
     * `scoreFor` is a parameter and not a hard-coded `winProbability()` on purpose. Since
     * combat stage 1 the AI decides on `takeProbability()`, and an instrument still calibrating
     * the old function would be measuring a number nobody reads -- the same species of mistake
     * as a lab holding its own copy of the formula it measures.
     */
    function meaning(target, scoreFor) {
        let low = 0.05;
        let high = 80;
        for (let step = 0; step < 26; step++) {
            const middle = (low + high) / 2;
            let scored = 0;
            for (const [attacker, defender] of pairs) {
                scored += scoreFor(infantry(DEFENDING_FORCE * middle), infantry(DEFENDING_FORCE),
                    defender, contextFor(attacker, defender));
            }
            if (scored / pairs.length < target) {
                low = middle;
            } else {
                high = middle;
            }
        }
        const ratio = (low + high) / 2;
        let real = 0;
        for (const [attacker, defender] of pairs) {
            real += battleForecast({
                attackers: infantry(DEFENDING_FORCE * ratio), defenders: infantry(DEFENDING_FORCE),
                territory: defender, context: contextFor(attacker, defender)
            }, { trials: 150 }).takeProbability * 100;
        }
        return { ratio, real: real / pairs.length };
    }

    const rows = [
        [PROBABILITY_THRESHOLD_FOR_SIEGE, "PROBABILITY_THRESHOLD_FOR_SIEGE -- the floor beneath everything"],
        [siegeDiscipline.minimumOdds, "siegeDiscipline.minimumOdds -- worth opening a siege"],
        [attackDiscipline.minimumOdds.aggressive, "attackDiscipline.minimumOdds.aggressive"],
        [attackDiscipline.minimumOdds.balanced, "attackDiscipline.minimumOdds.balanced"],
        [attackDiscipline.minimumOdds.pacifist, "attackDiscipline.minimumOdds.pacifist"],
        [commitmentDiscipline.decisiveOdds, "commitmentDiscipline.decisiveOdds -- what an attack AIMS at"]
    ];

    console.log("  WHAT THE AI READS TODAY -- takeProbability(), so the figure IS the chance" + BLANK);
    console.log("  " + padEnd("constant", 10) + pad("needs a raw ratio of", 22)
        + pad("real take there", 18) + "   which constant");
    for (const [value, label] of rows) {
        const found = meaning(value, takeProbability);
        console.log("  " + padEnd(value + "%", 10) + pad(found.ratio.toFixed(2) + ":1", 22)
            + percent(found.real, 18) + "   " + label);
    }

    console.log(BLANK + "  WHAT THE SAME FIGURES MEANT BEFORE STAGE 1 -- winProbability()" + BLANK);
    console.log("  " + padEnd("constant", 10) + pad("needed a raw ratio of", 22)
        + pad("real take there", 18) + "   which constant");
    for (const [value, label] of rows) {
        const found = meaning(value, winProbability);
        console.log("  " + padEnd(value + "%", 10) + pad(found.ratio.toFixed(2) + ":1", 22)
            + percent(found.real, 18) + "   " + label);
    }
    console.log(BLANK + "  The second table is the defect (known-issue C1): every figure is a sentence about");
    console.log("  the world denominated in a currency that is not the world. The first is stage 1.");
}

// --- cost --------------------------------------------------------------------

if (wants("cost")) {
    console.log(BLANK + "=== COST: can the AI afford to ask the real model? ===" + BLANK);
    clearTakeProbabilityCache();
    const pairs = slice(enemyPairs(buildWorld(0)), 400);
    //Four rungs per pairing, which is what `sizeCommitment()` walks.
    const rungs = [0.35, 0.55, 0.75, 1];
    const started = Date.now();
    let asked = 0;
    for (const [attacker, defender] of pairs) {
        for (const rung of rungs) {
            takeProbability(infantry(DEFENDING_FORCE * 2 * rung), infantry(DEFENDING_FORCE),
                defender, contextFor(attacker, defender));
            asked++;
        }
    }
    const elapsed = Date.now() - started;
    const stats = takeProbabilityCacheStats();
    console.log("  questions asked           " + asked);
    console.log("  cache cells created       " + stats.cells);
    console.log("  hits / misses             " + stats.hits + " / " + stats.misses);
    console.log("  hit rate                  " + (stats.hits / asked * 100).toFixed(1) + "%");
    console.log("  wall clock, cold cache    " + elapsed + " ms");
    const second = Date.now();
    for (const [attacker, defender] of pairs) {
        for (const rung of rungs) {
            takeProbability(infantry(DEFENDING_FORCE * 2 * rung), infantry(DEFENDING_FORCE),
                defender, contextFor(attacker, defender));
        }
    }
    console.log("  the same questions again  " + (Date.now() - second) + " ms  (warm)");
}

console.log("");
