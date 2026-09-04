// Judge a change to the dice model without opening a browser.
//
// Battle overhaul B.2.
//
//   node tools/battle-lab.mjs
//   node tools/battle-lab.mjs --trials=2000
//
// `tools/ai-sim.mjs` is the instrument that decides whether a balance change is right -- a
// hundred turns of a real world, in a real page, with real adjacency and a real economy. It is
// also two minutes and a dev server. This is the cheap check that comes first: it imports
// `src/rules/military/` directly (every rule runs in Node -- refactor Phase 5) and prints the
// matchup table that docs/battle_overhaul.md section 4.6 predicts, in about a second.
//
// It answers three questions and no others:
//
//   1. Does a fight of a given shape take the number of rounds section 4.6 claims?
//   2. Does the attacker win it as often as section 4.6 claims?
//   3. Does anything ever reach MAX_BATTLE_ROUNDS? (It must not. The cap is a safety valve for
//      a round that kills nobody, and a non-zero stalemate rate here is a bug in the casualty
//      floor, not a tuning question.)
//
// It cannot answer "is the game better", "does the world consolidate", or "can the AI still
// expand". Those are ai-sim's, and section 6 of the plan is explicit that no constant ships on
// the strength of this file alone.

import {
    BREAK_THRESHOLD,
    DICE_SHARE_BANDS,
    MAX_BATTLE_ROUNDS,
    PAIRING_CASUALTY_SHARE
} from "../src/config/balance.js";
import { battleForecast } from "../src/rules/military/forecast.js";
import { modifiersFor, shareFor } from "../src/rules/military/battleModel.js";
import { defenderDiceCountFor, diceCountFor } from "../src/rules/military/dice.js";

const options = Object.fromEntries(
    process.argv.slice(2).map((argument) => {
        const [key, value = "true"] = argument.replace(/^--/, "").split("=");
        return [key, value];
    }));
const trials = Number.parseInt(options.trials ?? "1000", 10);

/** A featureless territory, so a matchup shows the FORCE effect and nothing else. */
function plainTerritory(overrides = {}) {
    return {
        uniqueId: "lab",
        territoryName: "Lab",
        area: 350000,
        defenseBonus: 0,
        mountainDefenseBonus: 0,
        isCoastal: false,
        continent: "Nowhere",
        ...overrides
    };
}

const NEUTRAL_CONTEXT = { attackingDevelopmentIndex: 1, combatContinentModifier: 1 };

const MATCHUPS = [
    { label: "hopeless        1:4", attackers: [100000, 0, 0, 0], defenders: [400000, 0, 0, 0] },
    { label: "outmatched      1:2", attackers: [200000, 0, 0, 0], defenders: [400000, 0, 0, 0] },
    { label: "even            1:1", attackers: [400000, 0, 0, 0], defenders: [400000, 0, 0, 0] },
    { label: "favoured        1.5:1", attackers: [600000, 0, 0, 0], defenders: [400000, 0, 0, 0] },
    { label: "strong          2:1", attackers: [800000, 0, 0, 0], defenders: [400000, 0, 0, 0] },
    { label: "overwhelming    5:1", attackers: [2000000, 0, 0, 0], defenders: [400000, 0, 0, 0] },
    { label: "even, forts     1:1", attackers: [400000, 0, 0, 0], defenders: [400000, 0, 0, 0],
        territory: plainTerritory({ defenseBonus: 20 }) },
    { label: "even, fortress  1:1", attackers: [400000, 0, 0, 0], defenders: [400000, 0, 0, 0],
        territory: plainTerritory({ defenseBonus: 20, mountainDefenseBonus: 20 }) },
    { label: "2:1 vs fortress", attackers: [800000, 0, 0, 0], defenders: [400000, 0, 0, 0],
        territory: plainTerritory({ defenseBonus: 20, mountainDefenseBonus: 20 }) },
    { label: "combined arms   1:1", attackers: [200000, 100, 20, 5], defenders: [400000, 0, 0, 0] },
    { label: "no armour       1:1", attackers: [400000, 0, 0, 0], defenders: [300000, 100, 0, 0] },
    { label: "naval landing   1:1", attackers: [200000, 0, 0, 10], defenders: [400000, 0, 0, 0],
        territory: plainTerritory({ isCoastal: true }) }
];

function pad(text, width) {
    return String(text).padEnd(width);
}
function padStart(text, width) {
    return String(text).padStart(width);
}

console.log("Battle lab -- the dice model, played out headlessly\n");
console.log(`  PAIRING_CASUALTY_SHARE ${PAIRING_CASUALTY_SHARE}   BREAK_THRESHOLD ${BREAK_THRESHOLD}`
    + `   MAX_BATTLE_ROUNDS ${MAX_BATTLE_ROUNDS}   trials ${trials}`);
console.log(`  dice bands  ${DICE_SHARE_BANDS.map((b) => `${b.minimumShare}->${b.dice}`).join("  ")}\n`);

console.log(pad("matchup", 20) + padStart("share", 7) + padStart("dice", 7)
    + padStart("mods", 8) + padStart("takes it", 10) + padStart("rounds", 10)
    + padStart("survivors", 12) + padStart("stale", 7));
console.log("-".repeat(81));

let anyStalemate = false;

for (const matchup of MATCHUPS) {
    const territory = matchup.territory ?? plainTerritory();
    const setup = {
        attackers: matchup.attackers,
        defenders: matchup.defenders,
        territory,
        context: NEUTRAL_CONTEXT
    };

    const share = shareFor(matchup.attackers, matchup.defenders, territory, NEUTRAL_CONTEXT);
    const modifiers = modifiersFor(matchup.attackers, matchup.defenders, territory);
    const forecast = battleForecast(setup, { trials });

    if (forecast.stalemateRate > 0) {
        anyStalemate = true;
    }

    //The EFFECTIVE counts, after any dice-changing modifier -- printing the band lookup alone
    //hid the whole effect of fortification, which is a dice penalty and not a face bonus.
    const attackerDice = Math.max(1, diceCountFor(share) + modifiers.attacker.diceChange);
    const defenderDice = Math.max(1, defenderDiceCountFor(1 - share) + modifiers.defender.diceChange);
    const dice = `${attackerDice}v${defenderDice}`;
    const mods = `${modifiers.attacker.total >= 0 ? "+" : ""}${modifiers.attacker.total}`
        + `/${modifiers.defender.total >= 0 ? "+" : ""}${modifiers.defender.total}`;
    const roundsText = `${forecast.roundsRange[0]}-${forecast.roundsRange[1]}`;

    console.log(
        pad(matchup.label, 20)
        + padStart(share.toFixed(3), 7)
        + padStart(dice, 7)
        + padStart(mods, 8)
        + padStart(`${(forecast.takeProbability * 100).toFixed(1)}%`, 10)
        + padStart(roundsText, 10)
        + padStart(forecast.expectedSurvivors.toLocaleString("en-GB"), 12)
        + padStart(forecast.stalemateRate > 0 ? `${(forecast.stalemateRate * 100).toFixed(1)}%` : "-", 7));
}

console.log("\nTargets from docs/battle_overhaul.md section 4.6:");
console.log("  even 1:1 should FAIL for the attacker and run 5-8 rounds");
console.log("  2:1 should succeed in about 3 rounds");
console.log("  overwhelming should succeed in about 2 rounds");
console.log(`  stalemate rate must be zero everywhere -- ${anyStalemate ? "IT IS NOT, see above" : "it is"}`);
