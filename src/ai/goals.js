// Goals: turning a list of threats into a ranked list of things to do this turn.
//
// Refactor plan Phase 5.5. The AI's second stage. `threat.js` says how dangerous everything
// is; this decides what to do about it, and `aiCalculations.js` carries it out.
//
// The pipeline is four passes over the same array, and the shape changes at each one, which
// is why the intermediate helpers are worth naming:
//
//   organizeThreats()      one row per (enemy territory, friendly territory) pair
//   removeNonThreats()     drops the pairs that cannot physically reach each other
//   addProbabilitiesOfBattle()  attaches the odds of each pairing
//   getPossibleTurnGoals() one or two GOAL rows per pair: Siege / Attack / Bolster / Economy
//   refineTurnGoals()      collapses duplicate goals, summing their threat, and counts them
//   prioritiseTurnGoals... sorts by the leader's personality and drops contradictory pairs
//
// A goal row is `[count, type, ...type-specific fields]` after refinement, and
// `[type, ...fields]` before it -- `countAndUnshiftSimilarRows()` is what puts the count on
// the front, which is why every later function reads the type at `[1]` and the earlier ones
// read it at `[0]`.
//
// Two dependencies are INJECTED rather than imported, which is what keeps this module free
// of `ui.js` and runnable in Node:
//
//   `rng`             the seeded per-country stream from `ai/rng.js`
//   `probabilityFor`  the pre-battle odds. In the game this is
//                     `calculateProbabilityPreBattle()` in battle.js, which also caches the
//                     modifiers a mid-battle recalculation needs -- a side effect this
//                     module has no business knowing about, and does not.
//
// A third, the CAMPAIGN, is passed in from `strategy.js`. It is what turned this file from
// a turn-local scorer into the executive arm of a plan. Two things follow from it:
//
//   * whether a target is worth fighting for at all is now `targeting.js`'s decision, made
//     once per pairing, instead of two coin flips that produced a siege on roughly
//     `1 - style_of_war` of everything in sight and could emit a Siege and an Attack
//     against the same territory for `removeDoubleAttackSiege()` to pick between;
//   * the ranked list is CUT to the campaign's budgets at the end, which is what stops a
//     country opening its fortieth siege.
//
// The campaign carries a `ratings` map that this module fills in as it plans and reads
// back when it prioritises. It lives there rather than on the goal rows because the rows
// are positional arrays that get rebuilt and spread twice during refinement, so anything
// attached to a row does not survive the trip.

import {
    PROBABILITY_THRESHOLD_FOR_SIEGE,
    THREAT_DISREGARD_CONSTANT
} from "../config/balance.js";
import { allTerritories } from "../state/selectors.js";
import { Posture } from "./strategy.js";
import { rateTarget, Verdict } from "./targeting.js";

/**
 * Every goal this country could pursue this turn, before refinement.
 *
 * @param {Array} arrayOfTerritoriesInRangeThreats  from `threat.js`
 * @param {{rng: () => number,
 *          probabilityFor: (attackArray: Array, territories: Array) => number,
 *          campaign?: object, country?: string,
 *          isBesieged?: (territoryName: string) => boolean}} deps
 */
export function calculateTurnGoals(arrayOfTerritoriesInRangeThreats, deps) {
    let sortedThreatArrayInfo = organizeThreats(arrayOfTerritoriesInRangeThreats);
    sortedThreatArrayInfo.sort((a, b) => b[3] - a[3]);

    //audit 5.1 AG. Every goal an AI country makes is derived from a threat, so a country
    //with no attackable enemy territory in range has nothing to plan. That is a perfectly
    //ordinary state once the AI can actually conquer -- a country whose neighbours are now
    //all its own -- but `sortedThreatArrayInfo[0][2]` threw on the empty array, and the
    //uncaught rejection took the whole game loop with it.
    if (sortedThreatArrayInfo.length === 0) {
        console.log("No enemy territory in range this turn -- no goals to plan");
        return [];
    }

    const leaderTraits = sortedThreatArrayInfo[0][2].leader.traits;
    // console.log("The biggest threat is to their territory of " + sortedThreatArrayInfo[0][2].territoryName + " and comes from " + sortedThreatArrayInfo[0][0].territoryName + ", " + sortedThreatArrayInfo[0][0].dataName + " owned by " + sortedThreatArrayInfo[0][0].leader.name + " with a threat of " + sortedThreatArrayInfo[0][3]);
    // console.log("Leader of " + sortedThreatArrayInfo[0][2].territoryName + " has the following traits:");
    // console.log("Type: " + sortedThreatArrayInfo[0][2].leader.leaderType + " traits:");
    // console.log(leaderTraits);
    sortedThreatArrayInfo = removeNonThreats(sortedThreatArrayInfo);
    sortedThreatArrayInfo = addProbabilitiesOfBattle(sortedThreatArrayInfo, deps.probabilityFor);
    return getPossibleTurnGoals(sortedThreatArrayInfo, leaderTraits, deps.rng, {
        campaign: deps.campaign ?? null,
        country: deps.country ?? sortedThreatArrayInfo[0]?.[2]?.dataName ?? null,
        isBesieged: deps.isBesieged
    });
}

function organizeThreats(arrayOfTerritoriesInRangeThreats) {
    const arr = [];
    let enemyTerritory;
    let friendlyTerritory;
    for (let i = 0; i < arrayOfTerritoriesInRangeThreats.length; i++) {
        for (let j = 0; j < arrayOfTerritoriesInRangeThreats[i][4].length; j++) {
            let count = 0;
            for (let k = 0; k < allTerritories().length; k++) { //get territory objects
                if (arrayOfTerritoriesInRangeThreats[i][0] === allTerritories()[k].territoryName) {
                    enemyTerritory = allTerritories()[k];
                    count++;
                }
                if (arrayOfTerritoriesInRangeThreats[i][4][j][0] === allTerritories()[k].territoryName) {
                    friendlyTerritory = allTerritories()[k];
                    count++;
                }
                if (count > 1) {
                    break;
                }
            }
            arr.push([enemyTerritory, enemyTerritory.leader, friendlyTerritory, arrayOfTerritoriesInRangeThreats[i][4][j][1]]);
        }
    }
    return arr;
}

function removeNonThreats(sortedThreatArrayInfo) {
    for (let i = sortedThreatArrayInfo.length - 1; i >= 0; i--) {
        if (sortedThreatArrayInfo[i][3] === THREAT_DISREGARD_CONSTANT) {
            sortedThreatArrayInfo.splice(i, 1);
        }
    }
    return sortedThreatArrayInfo;
}

/**
 * One or two goal rows per (enemy, friendly) pairing.
 *
 * Economy is emitted for every pairing, as it always was -- the COUNT of those duplicates
 * is what tells the refiner how much of this country's attention a territory deserves.
 * What has changed is the military half: `rateTarget()` returns exactly one verdict, so a
 * pairing now produces a Siege or an Attack or neither, never both and never a siege the
 * country has no budget to open.
 */
function getPossibleTurnGoals(sortedThreatArrayInfo, leaderTraits, rng, planning) {
    const possibleGoalsArray = [];
    const campaign = planning?.campaign ?? null;
    const country = planning?.country ?? null;
    const isBesieged = typeof planning?.isBesieged === "function" ? planning.isBesieged : () => false;

    for (const threat of sortedThreatArrayInfo) {
        const enemyTerritory = threat[0];
        const friendlyTerritory = threat[2];
        const threatScore = threat[3];
        const probability = threat.probabilityOfWin;

        const rating = rateTarget({
            target: enemyTerritory,
            source: friendlyTerritory,
            probability,
            threatScore,
            campaign,
            traits: leaderTraits,
            country,
            targetAlreadyBesieged: isBesieged(enemyTerritory.territoryName)
        });

        //PROBABILITY_THRESHOLD_FOR_SIEGE stays as a hard floor beneath the campaign's own,
        //because it is the same number the player's attack window enforces: below it an
        //interaction is not offered to anybody.
        const meetsHardFloor = probability >= PROBABILITY_THRESHOLD_FOR_SIEGE;

        if (meetsHardFloor && rating.verdict === Verdict.SIEGE) {
            possibleGoalsArray.push(["Siege", enemyTerritory.territoryName, friendlyTerritory.territoryName, threatScore, probability]);
            rememberRating(campaign, "Siege", enemyTerritory.territoryName, friendlyTerritory.territoryName, rating);
        } else if (meetsHardFloor && rating.verdict === Verdict.ATTACK) {
            possibleGoalsArray.push(["Attack", enemyTerritory.territoryName, friendlyTerritory.territoryName, threatScore, probability]);
            rememberRating(campaign, "Attack", enemyTerritory.territoryName, friendlyTerritory.territoryName, rating);
        }

        recordDecision(campaign, {
            verdict: meetsHardFloor ? rating.verdict : Verdict.SKIP,
            target: enemyTerritory.territoryName,
            targetOwner: enemyTerritory.dataName,
            continent: enemyTerritory.continent ?? null,
            source: friendlyTerritory.territoryName,
            odds: Math.round(probability),
            score: Number(rating.score.toFixed(3)),
            reason: meetsHardFloor
                ? rating.reason
                : "below the " + PROBABILITY_THRESHOLD_FOR_SIEGE + "% floor the game applies to everybody"
        });

        //Bolster when the neighbour outguns us, as before -- and unconditionally while the
        //campaign is DEFENDing, because a country with a fifth of itself besieged should be
        //reinforcing the quiet borders too, not only the loud ones.
        if (threatScore >= 0 || campaign?.posture === Posture.DEFEND) {
            possibleGoalsArray.push(["Bolster", enemyTerritory.territoryName, friendlyTerritory.territoryName, friendlyTerritory.fortsBuilt, friendlyTerritory.armyForCurrentTerritory, friendlyTerritory.isCoastal, threatScore, probability]);
        }

        possibleGoalsArray.push(["Economy", friendlyTerritory.territoryName, friendlyTerritory.farmsBuilt, friendlyTerritory.forestsBuilt, friendlyTerritory.oilWellsBuilt]);
    }
    return possibleGoalsArray;
}

/** The key a rating is filed under, and the only place its shape is written. */
function ratingKey(type, target, source) {
    return type + "|" + target + "|" + source;
}

function rememberRating(campaign, type, target, source, rating) {
    campaign?.ratings?.set(ratingKey(type, target, source), rating);
}

/**
 * How many weighed pairings one country keeps for the debug panel.
 *
 * A country with a long border can weigh several hundred in a turn. They are small, they
 * live for one turn, and the panel shows two dozen -- but an unbounded array on a hot loop
 * is the kind of thing that is fine until somebody conquers half the map.
 */
const DECISIONS_KEPT_PER_COUNTRY = 200;

/**
 * Record why a target was taken or left alone.
 *
 * The SKIPPED ones matter most. "Why did that country do nothing?" is the commonest
 * question of an AI turn, and until the campaign layer there was no answer to it anywhere
 * -- the goal list only ever said what a country DID decide to do.
 */
function recordDecision(campaign, decision) {
    if (!campaign) {
        return;
    }
    if (!campaign.decisions) {
        campaign.decisions = [];
    }
    if (campaign.decisions.length < DECISIONS_KEPT_PER_COUNTRY) {
        campaign.decisions.push(decision);
    }
}

/** The strategic worth of a refined goal row, or null if it is not a military one. */
function ratingForGoal(campaign, row) {
    if (!campaign?.ratings) {
        return null;
    }
    return campaign.ratings.get(ratingKey(row[1], row[2], row[3])) ?? null;
}

function addProbabilitiesOfBattle(sortedThreatArrayInfo, probabilityFor) {
    let probability;
    for (const threat of sortedThreatArrayInfo) {
        const preAttackArray = [threat[0].uniqueId, parseInt(threat[2].uniqueId), threat[2].infantryForCurrentTerritory, threat[2].useableAssault, threat[2].useableAir, threat[2].useableNaval];
        for (let i = 0; i < allTerritories().length; i++) {
            if (preAttackArray[0] === allTerritories()[i].uniqueId) {
                if (!allTerritories()[i].isCoastal) {
                    preAttackArray[5] = 0;
                    break;
                }
            }
        }
        probability = probabilityFor(preAttackArray, allTerritories(), false);
        threat.probabilityOfWin = probability;
        // console.log("Probability of " + threat[2].territoryName + " vs " + threat[0].territoryName + " is:" + threat.probabilityOfWin);
    }
    return sortedThreatArrayInfo;
}

export function refineTurnGoals(unrefinedGoals, currentAiCountry, leaderTraits) {
    let refinedGoals = countAndUnshiftSimilarRows(unrefinedGoals);
    refinedGoals = sumTogetherSimilarThreatValues(refinedGoals);
    refinedGoals = finalRefinementOfArrayReduceDown(refinedGoals);
    refinedGoals = upPriorityForReconquistaTerritories(refinedGoals, currentAiCountry, leaderTraits);
    return refinedGoals;
}

function countAndUnshiftSimilarRows(arr) {
    const countMapEconomy = new Map();
    const countMapBolster = new Map();
    const countMapSiege = new Map();
    const countMapAttack = new Map();

    for (const row of arr[0]) {
        if (row[0] === "Economy") {
            const key = JSON.stringify([row[0], row[1]]);
            countMapEconomy.set(key, (countMapEconomy.get(key) || 0) + 1);
        } else if (row[0] === "Bolster") {
            const key = JSON.stringify([row[0], row[2]]);
            countMapBolster.set(key, (countMapBolster.get(key) || 0) + 1);
        } else if (row[0] === "Siege") {
            const key = JSON.stringify([row[0], row[1]]);
            countMapSiege.set(key, (countMapSiege.get(key) || 0) + 1);
        } else if (row[0] === "Attack") {
            const key = JSON.stringify([row[0], row[1]]);
            countMapAttack.set(key, (countMapAttack.get(key) || 0) + 1);
        }
    }

    for (const row of arr[0]) {
        if (row[0] === "Economy") {
            const key = JSON.stringify([row[0], row[1]]);
            const count = countMapEconomy.get(key);
            row.unshift(count);
        } else if (row[0] === "Bolster") {
            const key = JSON.stringify([row[0], row[2]]);
            const count = countMapBolster.get(key);
            row.unshift(count);
        } else if (row[0] === "Siege") {
            const key = JSON.stringify([row[0], row[1]]);
            const count = countMapSiege.get(key);
            row.unshift(count);
        } else if (row[0] === "Attack") {
            const key = JSON.stringify([row[0], row[1]]);
            const count = countMapAttack.get(key);
            row.unshift(count);
        }
    }
    return arr;
}

function sumTogetherSimilarThreatValues(refinedGoalsArray) {
    const economyGroups = {};
    const bolsterGroups = {};
    const siegeGroups = {};
    const attackGroups = {};

    for (const row of refinedGoalsArray[0]) {
        const key = row[1] === "Economy" || row[1] === "Siege" || row[1] === "Attack" ? `${row[1]}_${row[2]}` : `${row[1]}_${row[3]}`;

        if (row[1] === "Economy") {
            if (!economyGroups[key]) economyGroups[key] = [];
            economyGroups[key].push(row);
        } else if (row[1] === "Bolster") {
            if (!bolsterGroups[key]) bolsterGroups[key] = [];
            bolsterGroups[key].push(row);
        } else if (row[1] === "Siege") {
            if (!siegeGroups[key]) siegeGroups[key] = [];
            siegeGroups[key].push(row);
        } else if (row[1] === "Attack") {
            if (!attackGroups[key]) attackGroups[key] = [];
            attackGroups[key].push(row);
        }
    }

    const processedEconomyGroups = [];
    for (const groupKey in economyGroups) {
        const group = economyGroups[groupKey];
        const sum = group.reduce((acc, row) => acc + row[3], 0);
        const modifiedGroup = group.map((row) => {
            const newRow = [...row];
            newRow[3] = sum;
            return newRow;
        });
        processedEconomyGroups.push(...modifiedGroup);
    }

    const processedBolsterGroups = [];
    for (const groupKey in bolsterGroups) {
        const group = bolsterGroups[groupKey];
        const sum = group.reduce((acc, row) => acc + row[7], 0);
        const modifiedGroup = group.map((row) => {
            const newRow = [...row];
            newRow[7] = sum;
            return newRow;
        });
        processedBolsterGroups.push(...modifiedGroup);
    }

    const processedSiegeGroups = [];
    for (const groupKey in siegeGroups) {
        const group = siegeGroups[groupKey];
        const sum = group.reduce((acc, row) => acc + row[4], 0);
        const modifiedGroup = group.map((row) => {
            const newRow = [...row];
            newRow[4] = sum;
            return newRow;
        });
        processedSiegeGroups.push(...modifiedGroup);
    }

    const processedAttackGroups = [];
    for (const groupKey in attackGroups) {
        const group = attackGroups[groupKey];
        const sum = group.reduce((acc, row) => acc + row[4], 0);
        const modifiedGroup = group.map((row) => {
            const newRow = [...row];
            newRow[4] = sum;
            return newRow;
        });
        processedAttackGroups.push(...modifiedGroup);
    }

    return [...processedEconomyGroups, ...processedBolsterGroups, ...processedSiegeGroups.reverse(), ...processedAttackGroups.reverse()];
}

function finalRefinementOfArrayReduceDown(refinedGoalsArray) {
    const filteredRefinedGoalsArray = [];

    const seenEconomy = new Set();
    const seenBolster = new Set();
    const seenSiege = new Set();
    const seenAttack = new Set();

    for (const row of refinedGoalsArray) {
        const type = row[1];
        const key = row[0];

        if (type === "Economy") {
            if (!seenEconomy.has(key)) {
                filteredRefinedGoalsArray.push(row);
                seenEconomy.add(key);
            }
        } else if (type === "Bolster") {
            const subKey = row[3];
            const compoundKey = `${key}_${subKey}`;
            if (!seenBolster.has(compoundKey)) {
                // Remove the [2] element for "Bolster" rows before pushing
                filteredRefinedGoalsArray.push([row[0], row[1], row[3], row[4], row[5], row[6], row[7], row[8]]);
                seenBolster.add(compoundKey);
            }
        } else if (type === "Siege") {
            const subKey = row[2];
            const compoundKey = `${key}_${subKey}`;
            if (!seenSiege.has(compoundKey)) {
                filteredRefinedGoalsArray.push(row);
                seenSiege.add(compoundKey);
            }
        } else if (type === "Attack") {
            const subKey = row[2];
            const compoundKey = `${key}_${subKey}`;
            if (!seenAttack.has(compoundKey)) {
                filteredRefinedGoalsArray.push(row);
                seenAttack.add(compoundKey);
            }
        } else {
            filteredRefinedGoalsArray.push(row);
        }
    }
    return filteredRefinedGoalsArray;
}

/**
 * Rank the refined goals the way this leader, pursuing this campaign, would.
 *
 * Personality still decides HOW the four kinds of goal trade off against each other; the
 * campaign decides what kind of turn it is and how much war is affordable. The last step
 * is the one that was missing altogether: the list is cut to the campaign's budgets, so
 * what survives is the best of what was possible rather than everything that was possible.
 *
 * @param {Array} refinedTurnGoals
 * @param {string} currentAiCountry
 * @param {object} leaderTraits
 * @param {() => number} rng  the seeded per-country stream
 * @param {object} [campaign]  from `strategy.js`; omitted, the budgets are not applied
 */
export function prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits, rng, campaign = null) {
    refinedTurnGoals = prioritizeActions(refinedTurnGoals, leaderTraits, rng, campaign);
    refinedTurnGoals = removeDoubleAttackSiege(refinedTurnGoals);
    refinedTurnGoals = enforceCampaignBudgets(refinedTurnGoals, campaign);
    return refinedTurnGoals;
}

function prioritizeActions(array, leaderTraits, rng, campaign) {
    return array.sort((a, b) => {
        const priorityA = calculatePriorityScore(a, leaderTraits, rng, campaign);
        const priorityB = calculatePriorityScore(b, leaderTraits, rng, campaign);
        return priorityB - priorityA; // Sort in descending order
    });
}

/**
 * What one goal is worth to this leader this turn.
 *
 * The `rowQuantitiesReduced * trait` shape is unchanged -- how many threats agreed on a
 * goal is still the base of it. What the campaign adds is a multiplier per kind (a
 * DEFENDing country weighs bolstering above attacking whatever its leader thinks) and,
 * for the two military kinds, the strategic worth of the actual target. Without that last
 * term an AI ranks a siege of a worthless island exactly as it ranks the last territory it
 * needs to own a continent, which is the behaviour the campaign exists to end.
 *
 * Economy is no longer a bare `rng() * fortification`. That made developing a territory a
 * coin flip weighted by a trait that has nothing to do with economics, so a country with
 * no economy at all would routinely rank five sieges above its first farm.
 */
function calculatePriorityScore(row, leaderTraits, rng, campaign) {
    const rowQuantitiesReduced = row[0];
    const action = row[1];

    const fortification = leaderTraits.fortification;
    const territoryExpansion = leaderTraits.territory_expansion;

    const defenceBias = campaign?.defenceBias ?? 1;
    const offenceBias = campaign?.offenceBias ?? 1;
    const economyBias = campaign?.economyBias ?? 1;

    if (action === "Bolster") {
        return rowQuantitiesReduced * fortification * defenceBias;
    }
    if (action === "Siege" || action === "Attack") {
        const rating = ratingForGoal(campaign, row);
        //A rating of 1 leaves the old ranking exactly as it was, which is what a goal
        //planned without a campaign gets.
        const strategicWorth = rating ? Math.max(0.05, rating.score) : 1;
        return rowQuantitiesReduced * territoryExpansion * offenceBias * strategicWorth;
    }
    if (action === "Economy") {
        //The count is how many fronts this territory sits behind, so a well-connected
        //territory is worth developing first. The rng term keeps two equal territories
        //from always being developed in map order.
        return rowQuantitiesReduced * economyBias * (0.75 + rng() * 0.5);
    }
    return 0;
}

/**
 * Cut the ranked list to what the campaign can actually pay for.
 *
 * This is the direct fix for the AI opening far more sieges than it can finish -- measured
 * at 17 rising to 67 concurrent over fourteen turns, most of them on a negative margin and
 * therefore armies standing still waiting to be arrested (docs/05-known-issues.md section
 * 6). The budget counts the sieges ALREADY running, so a country that is over-committed
 * gets a budget of zero and spends the turn reinforcing and building instead.
 *
 * Economy and Bolster goals are never cut. They cost gold, which the resource-sharing in
 * `aiCalculations.js` already rations; it is the military goals that cost armies the
 * country cannot get back for several turns.
 */
function enforceCampaignBudgets(refinedTurnGoals, campaign) {
    if (!campaign) {
        return refinedTurnGoals;
    }

    let siegesLeft = campaign.siegeBudget ?? Infinity;
    let attacksLeft = campaign.attackBudget ?? Infinity;

    return refinedTurnGoals.filter(row => {
        if (row[1] === "Siege") {
            return siegesLeft-- > 0;
        }
        if (row[1] === "Attack") {
            return attacksLeft-- > 0;
        }
        return true;
    });
}

function upPriorityForReconquistaTerritories(refinedTurnsGoals, currentAiCountry, leaderTraits) {
    for (let i = 0; i < refinedTurnsGoals.length; i++) {
        if (refinedTurnsGoals[i][1] === "Siege" || refinedTurnsGoals[i][1] === "Attack") {
            for (let j = 0; j < allTerritories().length; j++) {
                if (allTerritories()[j].territoryName === refinedTurnsGoals[i][2]) {
                    if (allTerritories()[j].originalOwner === currentAiCountry) {
                        refinedTurnsGoals[i][0] = (refinedTurnsGoals[i][0] * leaderTraits.reconquista) + refinedTurnsGoals[i][0];
                        break;
                    }
                }
            }
        }
    }
    return refinedTurnsGoals;
}

function removeDoubleAttackSiege(arr) {
    const seenLocations = new Set();
    const seenCountries = new Set();
    const filteredArr = [];

    for (let i = 0; i < arr.length; i++) {
        const [, type, location, country] = arr[i];

        if (type === 'Attack' || type === 'Siege') {
            const locationCountryKey = `${location}_${country}`;

            if (seenLocations.has(locationCountryKey)) {
                continue;
            } else {
                seenLocations.add(locationCountryKey);
                seenCountries.add(country);
            }
        }
        filteredArr.push(arr[i]);
    }
    return filteredArr;
}
