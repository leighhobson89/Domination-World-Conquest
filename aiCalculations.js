// noinspection DuplicatedCode

import {
    paths,
    setColorOnMap,
    populateAiDialogueBox,
    setAiDialogueContainerCurrentlyOnScreen,
    toggleAiDialogue,
    convertAiDialogueButtonRow,
    removeSiegeImageFromPath,
    findClosestPaths,
    setAiDialogueBodyBottomContentState,
    populateArmyDataFields,
} from "./ui.js";
import {
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable,
    armyGoldPrices,
    armyProdPopPrices,
    calculateAvailableUpgrades,
    INFANTRY_IN_A_TROOP,
    maxFarms,
    maxForests,
    maxForts,
    maxOilWells,
    oilRequirements,
    playerOwnedTerritories,
    territoryUpgradeBaseCostsConsMats,
    territoryUpgradeBaseCostsGold,
    vehicleArmyPersonnelWorth
} from "./resourceCalculations.js";
import {
    addRemoveWarSiegeObject,
    aiSiegeWarsList,
    calculateCombinedForce,
    calculateProbabilityPreBattle,
    deactivateTerritoryAi,
    playerSiegeWarsList,
    getCurrentAiWarId,
    getNextAiWarId,
    setCurrentAiWarId,
    setNextAiWarId,
    addRemoveWarSiegeObjectAi,
    getSiegeObjectFromPlayerSiegeList,
    getSiegeObjectFromAiSiegeList,
    setBattleResolutionOnHistoricWarArrayAfterSiege
} from "./battle.js";
import {
    resolveBattle
} from "./src/rules/military/battleModel.js";
import {
    combatContinentModifierFor
} from "./src/rules/military/probability.js";
import {
    recordDefence
} from "./src/state/battlePlayback.js";
import {
    getArrayOfLeadersAndCountries,
    updateArrayOfLeadersAndCountries
} from "./cpuPlayerGenerationAndLoading.js";
import {
    summaryWarsArray,
    summaryWarsLostArray
} from "./gameTurnsLoop.js";
import {
    allTerritories,
    currentTurn,
    getTerritory,
    getTerritoryByName
} from './src/state/selectors.js';
import {
    setTerritoryOwner,
    updateTerritory as patchTerritory
} from './src/state/mutations.js';
import {
    getPathByUniqueId
} from './src/state/indexes.js';
import {
    pathIsPlayerOwned
} from './src/state/pathState.js';
import {
    MAX_AI_UPGRADES_PER_TURN,
    PROBABILITY_THRESHOLD_FOR_SIEGE,
    siegeDiscipline,
    THREAT_DISREGARD_CONSTANT
} from './src/config/balance.js';
import {
    aiRandom
} from './src/ai/rng.js';
import {
    calculateTurnGoals as planTurnGoals,
    prioritiseTurnGoalsBasedOnPersonality as prioritiseTurnGoals
} from './src/ai/goals.js';
import {
    captureCampaigns,
    planCampaign,
    recordAttackOutcome,
    releaseSiegeSlot,
    restoreCampaigns
} from './src/ai/strategy.js';
import {
    reviewSiege,
    SiegeVerdict
} from './src/ai/siegeReview.js';
import {
    decideCommitment
} from './src/ai/commitment.js';
import {
    captureMusters,
    clearReinforcementDemand,
    planMusters,
    recordReinforcementDemand,
    restoreMusters
} from './src/ai/muster.js';
import {
    currentTheatre
} from './src/ai/theatre.js';
import {
    getInteractableFrom,
    isAdjacencyLoaded
} from './src/data/adjacency.js';
import {
    captureVictoryCondition,
    restoreVictoryCondition
} from './src/ai/victory.js';
import {
    registerSaveSlice
} from './src/platform/saveSlices.js';
import {
    isUnderSiege,
    territoriesOwnedByCountry
} from './src/state/selectors.js';
import {
    ids
} from './src/ui/core/registry.js';
import {
    recordFailedAttack,
    recordSiegeAbandoned,
    recordSiegeResolved
} from './src/state/activityRecorder.js';

//Balance numbers live in src/config/balance.js (Phase 5.1); imported above.

let aiDialogueResponse = false;
let aiDialogueSelection = 0;

//The seeded per-country RNG lives in src/ai/rng.js (Phase 5.5). `aiRandom` is a stable
//function reference that draws from whichever stream is current, so the ~13 call sites below
//are unchanged and nothing here has to know how the stream is chosen.
const aiRng = aiRandom;

//Phase 5.8. `arrayOfGoldToSpendOnEconomy` and `arrayOfGoldToSpendOnBolster` stood here,
//marked `//DEBUG`: two module-level arrays that every AI country pushed its per-goal spend
//onto so that a 40-line `logGoldStats()` in gameTurnsLoop.js could sort, average and take
//the mode of them once a turn and print two lines. Shipped, running in production, and read
//by nobody. The whole chain -- arrays, pushes, both getters and `setDebugArraysToZero()` --
//is gone. If the numbers are wanted again they belong in a unit test over `src/ai/`, which
//can measure them without the game paying for it every turn.

// readClosestPointsJSON(), fetchJSONFile(), parseJSON() and
// addManualExceptionsAndRemoveDenials() lived here. They re-fetched and re-parsed
// the 19 MB closestPathsData.json once per territory during initialisation -- 359
// fetches, ~6.8 GB of JSON.parse, before the first turn could start. Replaced by
// src/data/adjacency.js, which loads a 77 KB file once and answers synchronously.
// See docs/01-codebase-audit.md section 4.1.

//Phase 5.5. Three stages of the AI turn moved out of this file:
//
//  src/ai/rng.js     the seeded per-country stream
//  src/ai/threat.js  how dangerous each enemy territory in range is
//  src/ai/goals.js   what to do about it, ranked by the leader's personality
//
//All three run in Node: they import from state/ and config/ and from nothing else. What is
//left in this file is the third stage, ACTING on a goal -- which opens dialogues, repaints
//the map and adds siege images, and so is inseparable from the UI until Phase 6 decomposes
//it. `goals.js` takes its two impure dependencies as arguments rather than importing them,
//which is what let it leave: the seeded rng, and `calculateProbabilityPreBattle` (which
//lives in battle.js and caches modifiers for a mid-battle recalculation -- a side effect the
//planner has no business knowing about).
//
//The re-exports below keep gameTurnsLoop.js importing the whole AI turn from one place.
export {
    buildAttackableTerritoriesInRangeArray,
    buildFullTerritoriesInRangeArray,
    calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory,
    convertAttackableArrayStringsToMainArrayObjects,
    getFriendlyTerritoriesDefenseScores,
    retrieveArmyPowerOfTerritory
} from "./src/ai/threat.js";
export { refineTurnGoals } from "./src/ai/goals.js";
export { resetAiRngContext, setAiRngContext } from "./src/ai/rng.js";
export { planCampaign, resetCampaigns } from "./src/ai/strategy.js";
export {
    activeVictoryCondition,
    resetVictoryCondition,
    setVictoryCondition,
    victoryProgress
} from "./src/ai/victory.js";

//The AI's campaign commitments and the active victory condition are durable state that
//lives OUTSIDE the store -- a country's three continents are a plan, not a fact about the
//world -- so they need a save slice or a loaded game would find every AI starting its
//long-term plan again from scratch. The registration is here rather than in `src/ai/`
//because those modules import `config/` and `state/` and nothing else, which is the
//property that lets the whole planner run in Node.
registerSaveSlice("aiStrategy", {
    capture: () => ({
        campaigns: captureCampaigns(),
        victory: captureVictoryCondition(),
        musters: captureMusters()
    }),
    restore: (data) => {
        restoreCampaigns(data?.campaigns);
        restoreVictoryCondition(data?.victory);
        //Absent from a save written before mustering existed, which restores as "nobody has
        //asked for reinforcement", the same state a new game starts in.
        restoreMusters(data?.musters);
    }
});

/**
 * This country's campaign for this turn -- its long-term objective, its posture and its
 * budgets. Called once per country at the top of its turn, before its goals are planned.
 *
 * The seeded per-country stream is bound in for the same reason it is everywhere else in
 * the AI: the small random term that separates two neighbours with identical standings
 * must not come off `Math.random`.
 */
export function planAiCampaign(country, leader, turn) {
    return planCampaign(country, { turn, leader, rng: aiRng });
}

/** The AI's goal planner, with this file's impure dependencies bound in. */
export function calculateTurnGoals(arrayOfTerritoriesInRangeThreats, campaign = null) {
    return planTurnGoals(arrayOfTerritoriesInRangeThreats, {
        rng: aiRng,
        probabilityFor: calculateProbabilityPreBattle,
        campaign,
        country: campaign?.country ?? null,
        isBesieged: isUnderSiege
    });
}

/** As `prioritiseTurnGoals()`, with the seeded stream and the campaign bound in. */
export function prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits, campaign = null) {
    return prioritiseTurnGoals(refinedTurnGoals, currentAiCountry, leaderTraits, aiRng, campaign);
}

/**
 * March this country's spare infantry towards the fronts that asked for it.
 *
 * Once per country per turn, BEFORE the threat map is built, so that an army which arrived
 * this turn is counted in this turn's odds -- otherwise the reinforcement would only take
 * effect a turn after it arrived, and a country would spend two turns doing what it decided
 * to do in one.
 *
 * The decision is `src/ai/muster.js` and is pure; this supplies the adjacency and moves the
 * men. Infantry only, and always between two territories the same country holds, so nothing
 * here can create or destroy army: what leaves one territory arrives in the other.
 *
 * @returns {Array} the moves made, for the plan log
 */
export function musterAiArmies(country, campaign, arrayOfTerritoriesInRangeThreats) {
    if (!isAdjacencyLoaded()) {
        return [];
    }

    const territories = territoriesOwnedByCountry(country);
    const theatre = currentTheatre(country);

    //The spearhead: our territory on the border of the country we have committed to
    //absorbing, and the one worth massing at. The closest thing this AI has to a front line.
    let spearhead = null;
    if (theatre?.rival) {
        for (const territory of territories) {
            const touchesRival = getInteractableFrom(territory.uniqueId, territory.territoryName)
                .some(name => getTerritoryByName(name)?.dataName === theatre.rival);
            if (touchesRival) {
                spearhead = territory.territoryName;
                break;
            }
        }
    }

    const moves = planMusters({
        country,
        turn: currentTurn(),
        territories,
        spearhead,
        localEnemyPowerFor: (territoryName) =>
            strongestEnemyPowerAgainst(territoryName, arrayOfTerritoriesInRangeThreats),
        neighboursOf: (territory) => getInteractableFrom(territory.uniqueId, territory.territoryName)
    });

    for (const move of moves) {
        const from = getTerritoryByName(move.from);
        const to = getTerritoryByName(move.to);
        if (!from || !to || from.dataName !== country || to.dataName !== country) {
            continue;
        }
        //A besieged territory's garrison is pinned -- it cannot march out, and marching INTO
        //one is walking into the encirclement.
        if (isUnderSiege(move.from) || isUnderSiege(move.to)) {
            continue;
        }
        const infantry = Math.min(move.infantry, from.infantryForCurrentTerritory ?? 0);
        if (infantry <= 0) {
            continue;
        }

        patchTerritory(from.uniqueId, {
            infantryForCurrentTerritory: from.infantryForCurrentTerritory - infantry,
            armyForCurrentTerritory: from.armyForCurrentTerritory - infantry
        });
        patchTerritory(to.uniqueId, {
            infantryForCurrentTerritory: to.infantryForCurrentTerritory + infantry,
            armyForCurrentTerritory: to.armyForCurrentTerritory + infantry
        });
        //The request has been answered; whether the attack now succeeds is next turn's
        //business, and leaving the demand standing would keep draining the interior into a
        //province that already has what it asked for.
        clearReinforcementDemand(country, move.to);
        console.log(move.reason + ": " + infantry + " infantry");
    }

    if (campaign) {
        campaign.musters = moves.map(move => ({ ...move }));
    }
    return moves;
}

/**
 * What this country does about the sieges it is ALREADY running. Once per turn, before
 * anything else is planned.
 *
 * The gap this closes is the one visible from the AI log: a siege appeared the turn it was
 * laid and was never mentioned again until it starved out or its army was arrested, because
 * the besieging country genuinely never looked at it. `siegesRunBy()` counted it into the
 * budget and nothing else in the AI knew it existed.
 *
 * The decision itself is `src/ai/siegeReview.js` and is pure. This is the half that cannot
 * be: it reads the live siege lists, asks `battle.js` what an assault would run at, and
 * carries the verdict out.
 *
 * It runs BEFORE the threat map is built, deliberately. A siege that ends here changes who
 * owns the target and where an army is standing, and planning a turn against a world one
 * decision out of date is how the AI came to plan attacks that were cancelled the moment
 * they were attempted.
 */
export function reviewAiSieges(country, leader, campaign) {
    const reviews = [];

    for (const territoryName of Object.keys(aiSiegeWarsList)) {
        const siege = aiSiegeWarsList[territoryName];
        if (!siege || siege.attackingCountry !== country) {
            continue;
        }
        const target = siege.defendingTerritory;
        if (!target) {
            continue;
        }
        const source = getTerritoryByName(siege.attackingTerritory);

        let review = reviewSiege({
            siege: siege,
            target: target,
            campaign: campaign,
            traits: leader?.traits ?? {},
            assaultOdds: assaultOddsFromSiege(siege, target, source)
        });

        //The territory the siege was launched FROM can have changed hands since -- it was
        //left thin when its army marched out, which is exactly what makes it a target. If
        //it has, there is nowhere to recall the army to and nobody to hand a conquest to,
        //so neither ending can be carried out and the siege stands until it resolves
        //itself. Said out loud rather than silently skipped, because "why is that siege
        //still there?" is the question this whole review exists to answer.
        if (review.verdict !== SiegeVerdict.PRESS && (!source || source.dataName !== country)) {
            review = {
                ...review,
                verdict: SiegeVerdict.PRESS,
                reason: "wanted to " + review.verdict.toLowerCase() + " (" + review.reason +
                    ") but " + siege.attackingTerritory + " is no longer ours to act from"
            };
        }

        console.log("SIEGE REVIEW -- " + territoryName + ": " + review.verdict.toUpperCase() +
            " (" + review.reason + ")");

        if (review.verdict === SiegeVerdict.ASSAULT) {
            stormBesiegedTerritory(siege, target, source, review, campaign);
        } else if (review.verdict === SiegeVerdict.LIFT) {
            liftAiSiege(siege, target, source, campaign);
        }

        reviews.push(review);
    }

    //Read by planLog.js and the debug panel. Kept on the campaign for the same reason the
    //ratings and decisions are: it is per-turn scratch, and the goal rows cannot carry it.
    if (campaign) {
        campaign.siegeReviews = reviews;
    }
    return reviews;
}

/**
 * The odds the besieging army would win if it stormed the territory as it now stands.
 *
 * The army is the one in the siege, not one in the source territory -- it marched out when
 * the siege was laid (audit 5.1 AD debits at INVADE!). The defender is read live, which is
 * the whole point: a garrison that has been starving for six turns is not the one that
 * turned the first assault back.
 */
function assaultOddsFromSiege(siege, target, source) {
    const army = siege?.attackingArmyRemaining ?? [];
    const infantry = Number(army[0]) || 0;
    const assault = Number(army[1]) || 0;
    const air = Number(army[2]) || 0;
    const naval = Number(army[3]) || 0;

    if (!source || infantry + assault + air + naval <= 0) {
        return 0;
    }

    return calculateProbabilityPreBattle(
        [target.uniqueId, parseInt(source.uniqueId), infantry, assault, air, naval],
        allTerritories(),
        false);
}

/**
 * Storm a territory this country is besieging.
 *
 * Reuses the ordinary AI battle -- `doAttack()` then `recombineRemainingArmyAfterBattle()`
 * -- with one difference that matters: the source territory is NOT debited, because the
 * army doing the storming is the one already standing outside the walls. Debiting it again
 * would create army out of nothing on a win and destroy it twice on a loss.
 *
 * The siege is closed either way. There is no third outcome where the besiegers fail and
 * settle back down: an assault that is turned back has lost the army that was maintaining
 * the siege.
 */
function stormBesiegedTerritory(siege, target, source, review, campaign) {
    const armyArray = [...(siege.attackingArmyRemaining ?? [0, 0, 0, 0])];
    const sourceCopy = { ...source };
    const targetCopy = { ...target };
    //Who it happened TO, read before the conquest can change it -- the trap that made the
    //Wars and Sieges tab draw the winner flag on both sides (known-issues AS).
    const defendingCountry = target.dataName;
    const playerDefending = target.owner === "Player";

    const battleResult = doAttack(armyArray, sourceCopy, targetCopy, review.assaultOdds, false);
    const remainingArmyArray = recombineRemainingArmyAfterBattle(armyArray, battleResult, targetCopy);
    const won = remainingArmyArray[4] === 0;

    console.log("ASSAULT out of the siege of " + target.territoryName + ": " +
        (won ? "the walls are taken" : "thrown back, the besieging army is spent"));

    endAiSiege(siege, target, won ? "Victory" : "Defeat");
    releaseSiegeSlot(campaign);

    //`defendingCountry` was read before the storm resolved, so it is who the siege was
    //AGAINST rather than who holds the place now -- which is the country the mid-term
    //ledger has to credit the gain to.
    recordAttackOutcome(siege.attackingCountry, target.territoryName, won, currentTurn(), defendingCountry);
    recordSiegeResolved({
        besiegerWon: won,
        territory: target.territoryName,
        defender: defendingCountry,
        attacker: siege.attackingCountry,
        playerAttacking: false,
        playerDefending: playerDefending
    });

    if (won) {
        updateTerritory(targetCopy, remainingArmyArray, sourceCopy);
        patchTerritory(target.uniqueId, targetCopy);
    } else {
        summaryWarsLostArray.push(target.territoryName + " threw back the assault of " +
            siege.attackingCountry);
        recordFailedAttack({
            territory: target.territoryName,
            defender: defendingCountry,
            attacker: siege.attackingCountry,
            playerDefending: playerDefending
        });
    }
}

/**
 * Give up a siege and march the army home.
 *
 * The counterpart of the player's `removeSiegeAndReturnPlayerArmy()`, and it returns the
 * army the same way -- immediately, into the territory it came from, rather than through
 * `retrievalArray`. The `useable*` counts are credited alongside the raw counts because
 * `doAttack()` debits both, and an army that came back only half recorded would be able to
 * defend with vehicles the country no longer believed it could crew.
 */
function liftAiSiege(siege, target, source, campaign) {
    const army = siege.attackingArmyRemaining ?? [0, 0, 0, 0];
    const returning = { ...source };

    returning.infantryForCurrentTerritory += Number(army[0]) || 0;
    returning.assaultForCurrentTerritory += Number(army[1]) || 0;
    returning.useableAssault += Number(army[1]) || 0;
    returning.airForCurrentTerritory += Number(army[2]) || 0;
    returning.useableAir += Number(army[2]) || 0;
    returning.navalForCurrentTerritory += Number(army[3]) || 0;
    returning.useableNaval += Number(army[3]) || 0;
    returning.armyForCurrentTerritory = returning.infantryForCurrentTerritory +
        (returning.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) +
        (returning.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) +
        (returning.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);

    patchTerritory(source.uniqueId, returning);

    console.log("LIFTING the siege of " + target.territoryName + " -- the army marches back to " +
        source.territoryName);

    endAiSiege(siege, target, "Retreat");
    releaseSiegeSlot(campaign);

    //The fourth way a siege can end, and the newest: not a victory, not a defeat, not an
    //arrest, but the besieger walking away. A removal alone cannot say which, so the feed
    //is told outright.
    recordSiegeAbandoned({
        territory: target.territoryName,
        defender: target.dataName,
        attacker: siege.attackingCountry,
        playerAttacking: false,
        playerDefending: target.owner === "Player"
    });
}

/**
 * Close one AI siege. The same four steps the starve-out takes, in the same order.
 *
 * `underSiege` is derived from the siege lists, so removing the siege is what clears it --
 * only the drawn overlay is left to take down.
 */
function endAiSiege(siege, target, resolution) {
    const warId = siege.warId;
    addRemoveWarSiegeObjectAi(1, warId, target, target);
    const siegedPath = getPathByUniqueId(target.uniqueId);
    if (siegedPath) {
        removeSiegeImageFromPath(true, siegedPath);
    }
    setBattleResolutionOnHistoricWarArrayAfterSiege(resolution, warId, true);
}

export async function doAiActions(refinedTurnGoals, leader, turnGainsArrayAi, arrayOfTerritoriesInRangeThreats, arrayOfAiPlayerDefenseScoresForTerritories, campaign = null) {
    let economyBenefitArray = [];
    let bolsterBenefitArray = [];
    let siegeLaunchedFromArray = [];
    let siegeLaunchedToArray = [];
    let attackLaunchedFromArray = [];
    let attackLaunchedToArray = [];

    //The campaign's budgets are enforced TWICE, and deliberately. `goals.js` cuts the
    //ranked list to them, which is what stops the country planning a war it cannot fund;
    //these two counters stop it STARTING one, because a goal can still fall through to a
    //siege after a target it preferred turned out to be unreachable, and because the AI
    //also opens interactions from `handleCaseOfTerritoryAlreadyBeingUnderSiege...`. One
    //budget, checked at the two places an army actually leaves a territory.
    const siegeBudget = campaign?.siegeBudget ?? Infinity;
    const attackBudget = campaign?.attackBudget ?? Infinity;
    let siegesOpened = 0;
    let attacksPressed = 0;

    console.log("As a generally " + leader.leaderType.toUpperCase() + " type of leader, I am");
    if (campaign) {
        console.log("Campaigning for " + (campaign.objective.continents.join(", ") || "nothing in particular") +
            " -- focus " + (campaign.focusContinent ?? "none") +
            ", posture " + campaign.posture +
            ", budget " + siegeBudget + " new siege(s) on top of " + campaign.activeSieges +
            " already running and " + attackBudget + " attack(s)");
    }

    for (let goalIndex = 0; goalIndex < refinedTurnGoals.length; goalIndex++) {
        const goal = refinedTurnGoals[goalIndex];
        let couldNotAffordEconomy = false;
        let mainArrayFriendlyTerritoryCopy = null;
        let mainArrayEnemyTerritoryCopy = null;

        //Siege and Attack goals name two territories: the launching one at [3] and the
        //target at [2]. Everything else names only its own territory, at [2].
        const goalHasATarget = goal[1] === "Siege" || goal[1] === "Attack";

        for (let i = 0; i < allTerritories().length; i++) { //find territory depending on action
            const territoryName = allTerritories()[i].territoryName;
            if (!goalHasATarget) {
                if (goal[2] === territoryName) {
                    mainArrayFriendlyTerritoryCopy = {
                        ...allTerritories()[i]
                    };
                    break;
                }
            } else {
                if (goal[3] === territoryName) {
                    mainArrayFriendlyTerritoryCopy = {
                        ...allTerritories()[i]
                    };
                } else if (goal[2] === territoryName) {
                    mainArrayEnemyTerritoryCopy = {
                        ...allTerritories()[i]
                    };
                }
                //audit 5.1 C: `count` used to be declared inside this loop, so it reset on
                //every iteration and `count === 2` was unreachable. Stop when both are found.
                if (mainArrayFriendlyTerritoryCopy && mainArrayEnemyTerritoryCopy) {
                    break;
                }
            }
        }

        //audit 5.1 B: a goal whose territory is not on the map used to leave the sentinel
        //string "no match" in place, which the write-back below then wrote into
        //allTerritories() -- every later arithmetic on that slot came out NaN.
        if (!mainArrayFriendlyTerritoryCopy || (goalHasATarget && !mainArrayEnemyTerritoryCopy)) {
            console.log("Skipping goal " + goal[1] + " -- its territory is not in the game array");
            continue;
        }

        let siege = getSiegeObjectFromAiSiegeList(mainArrayFriendlyTerritoryCopy);
        if (siege) {
            console.log(mainArrayFriendlyTerritoryCopy.territoryName + " is under siege, cannot perform any goals this turn for this territory!");
            continue;
        }

        switch (goal[1]) {
            case "Economy":
                if (!economyBenefitArray.includes(goal[2])) {
                    economyBenefitArray.push(goal[2]);
                    console.log("working on Economy of " + mainArrayFriendlyTerritoryCopy.territoryName + "...");
                    let goldInTerritory = mainArrayFriendlyTerritoryCopy.goldForCurrentTerritory;
                    console.log("ECONOMY gold in territory:" + goldInTerritory);
                    let consMatsInTerritory = mainArrayFriendlyTerritoryCopy.consMatsForCurrentTerritory;
                    let goldNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("gold", refinedTurnGoals, goalIndex);
                    const consMatsNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("consMats", refinedTurnGoals, goalIndex);
                    let goldToSpend = determineResourcesAvailableForThisGoal("gold", goldInTerritory, mainArrayFriendlyTerritoryCopy, goldNeedsSpendingAfterThisGoal, refinedTurnGoals, goalIndex);
                    refinedTurnGoals = goldToSpend[0];
                    goldNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("gold", refinedTurnGoals, goalIndex);
                    goldToSpend = goldToSpend[1];
                    let consMatsToSpend = determineResourcesAvailableForThisGoal("consMats", consMatsInTerritory, mainArrayFriendlyTerritoryCopy, consMatsNeedsSpendingAfterThisGoal, refinedTurnGoals, goalIndex);
                    consMatsToSpend = consMatsToSpend[1];
                    console.log("Gold to spend on this ECONOMY = " + goldToSpend);
                    console.log("ConsMats to spend on this ECONOMY = " + consMatsToSpend);
                    couldNotAffordEconomy = analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild(mainArrayFriendlyTerritoryCopy, goldToSpend, consMatsToSpend, upgradeAllowanceFor(campaign));
                }
                break;
            case "Bolster":
                let switched = false; //this allows pacifist and balanced leaders a chance to reorder economy and bolster goals
                switched = calculateIfNeedsToSwitchOrderWithEconomy(mainArrayFriendlyTerritoryCopy, refinedTurnGoals, goalIndex, goal);
                if (switched) {
                    goalIndex--;
                    continue;
                } else {
                    if (!bolsterBenefitArray.includes(goal[2])) {
                        bolsterBenefitArray.push(goal[2]);
                        console.log("bolstering Defences of " + mainArrayFriendlyTerritoryCopy.territoryName + "...");
                        let goldInTerritory = mainArrayFriendlyTerritoryCopy.goldForCurrentTerritory;
                        console.log("BOLSTER gold in territory:" + goldInTerritory);
                        let goldNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("gold", refinedTurnGoals, goalIndex);
                        let goldToSpend = determineResourcesAvailableForThisGoal("gold", goldInTerritory, mainArrayFriendlyTerritoryCopy, goldNeedsSpendingAfterThisGoal, refinedTurnGoals, goalIndex);
                        let prodPopToSpend = mainArrayFriendlyTerritoryCopy.productiveTerritoryPop;
                        refinedTurnGoals = goldToSpend[0];
                        goldNeedsSpendingAfterThisGoal = determineIfOtherGoalNeedsResourceThisTurn("gold", refinedTurnGoals, goalIndex);
                        goldToSpend = goldToSpend[1];
                        let consMatsToSpend = mainArrayFriendlyTerritoryCopy.consMatsForCurrentTerritory;
                        console.log("Gold to spend on this BOLSTER = " + goldToSpend);
                        console.log("ProdPop to spend on this bolster = " + prodPopToSpend);
                        couldNotAffordEconomy ? (console.log("Couldn't afford to upgrade, so saving half and can now spend " + (goldToSpend / 2)), goldToSpend /= 2) : console.log("Upgraded ECONOMY normally or economy not done yet, so has all stated gold for BOLSTER");
                        //A bolstering territory used to offer ALL its gold to forts and
                        //give the army whatever the fort loop happened not to want. That
                        //made every country build the same way whatever it was trying to
                        //do. The posture decides the split now: a DEFENDing country puts
                        //four fifths of it into walls, an EXPANDing one keeps most of it
                        //for units it can march out with.
                        const fortShare = campaign?.fortShare ?? 1;
                        const goldOfferedToForts = Math.floor(goldToSpend * fortShare);
                        const goldHeldBackForArmy = goldToSpend - goldOfferedToForts;
                        goldToSpend = analyzeAndBuildFortDefenses(mainArrayFriendlyTerritoryCopy, goldOfferedToForts, consMatsToSpend) + goldHeldBackForArmy;
                        console.log("gold left over for army / economy (if still to build): " + goldToSpend);
                        bolsterArmy(mainArrayFriendlyTerritoryCopy, goldToSpend, prodPopToSpend);
                    }
                }
                break;
            case "Siege":
                if (siegesOpened >= siegeBudget) {
                    console.log("Siege budget spent for this turn -- not opening another against " + goal[2]);
                    break;
                }
                if (!siegeLaunchedFromArray.includes(goal[3])) {
                    siegeLaunchedFromArray.push(goal[3]);
                    siegeLaunchedToArray.push(goal[2]);
                    console.log("going to start a siege attack on " + mainArrayEnemyTerritoryCopy.territoryName + " from " + mainArrayFriendlyTerritoryCopy.territoryName + "...");
                    const amountBeingSentToSiegeAndProbability = calculateArmyQuantityBeingSentOrIfCancellingInteraction(leader, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, arrayOfTerritoriesInRangeThreats, true, campaign);
                    if (amountBeingSentToSiegeAndProbability !== "Cancel") {
                        const armyArray = calculateArmyMakeupOfAttack(mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, amountBeingSentToSiegeAndProbability[0]);
                        let proceed = await handleCaseOfTerritoryAlreadyBeingUnderSiegeByPlayerOrOtherAi(mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy);
                        if (proceed) {
                            setSiege(armyArray, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, amountBeingSentToSiegeAndProbability[1], leader);
                            siegesOpened++;
                        }
                    }
                }
                break;
            case "Attack":
                if (attacksPressed >= attackBudget) {
                    console.log("Attack budget spent for this turn -- not pressing another against " + goal[2]);
                    break;
                }
                if (!attackLaunchedFromArray.includes(goal[3])) { //only one attack from any territory per turn
                    attackLaunchedFromArray.push(goal[3]);
                    attackLaunchedToArray.push(goal[2]);
                    console.log("going to ATTACK " + mainArrayEnemyTerritoryCopy.territoryName + " from " + mainArrayFriendlyTerritoryCopy.territoryName + "...");
                    const amountBeingSentToBattleAndProbability = calculateArmyQuantityBeingSentOrIfCancellingInteraction(leader, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, arrayOfTerritoriesInRangeThreats, false, campaign);
                    if (amountBeingSentToBattleAndProbability !== "Cancel") {
                        const armyArray = calculateArmyMakeupOfAttack(mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, amountBeingSentToBattleAndProbability[0]);
                        let proceed = await handleCaseOfTerritoryAlreadyBeingUnderSiegeByPlayerOrOtherAi(mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy);
                        if (proceed) {
                            attacksPressed++;
                            const battleResult = doAttack(armyArray, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, amountBeingSentToBattleAndProbability[1]);
                            const remainingArmyArray = recombineRemainingArmyAfterBattle(armyArray, battleResult, mainArrayEnemyTerritoryCopy);
                            //Remember how it went, win or lose. This is the whole of the
                            //AI's memory between turns about a particular target, and
                            //without it a country re-attacks whatever just beat it every
                            //turn forever -- visible in the activity feed as the same
                            //line repeating turn after turn.
                            recordAttackOutcome(
                                mainArrayFriendlyTerritoryCopy.dataName,
                                mainArrayEnemyTerritoryCopy.territoryName,
                                remainingArmyArray[4] === 0,
                                currentTurn(),
                                //Read BEFORE the conquest is applied below: `dataName` is the
                                //current owner and a win is about to change it, so taking it
                                //afterwards would credit the gain against ourselves.
                                mainArrayEnemyTerritoryCopy.dataName);
                            if (remainingArmyArray[4] === 0) { //attacker won
                                mainArrayEnemyTerritoryCopy = updateTerritory(mainArrayEnemyTerritoryCopy, remainingArmyArray, mainArrayFriendlyTerritoryCopy);
                            } else {
                                summaryWarsLostArray.push(mainArrayEnemyTerritoryCopy.territoryName + " resisted attack from " + mainArrayFriendlyTerritoryCopy.dataName);
                                //Phase 7.4. The activity feed's explicit half. A CONQUEST
                                //is derived from the ownership change and needs no call
                                //here; a failed attack changes nothing in the store, so
                                //this line is the only record of it there will ever be.
                                recordFailedAttack({
                                    territory: mainArrayEnemyTerritoryCopy.territoryName,
                                    defender: mainArrayEnemyTerritoryCopy.dataName,
                                    attacker: mainArrayFriendlyTerritoryCopy.dataName,
                                    playerDefending: mainArrayEnemyTerritoryCopy.owner === "Player"
                                });
                            }
                        } else {
                            break;
                        }
                    }
                }
                break;
        }

        //Write the copies back. audit 5.1 AB: this used to SUBSTITUTE the element
        //(`mainGameArray[i] = copy`), which orphaned the territory index -- it holds
        //object references, so every index reader was left looking at the object that
        //used to be in that slot. Patching the fields keeps the identity.
        //
        //Phase 4: this walked all 359 territories comparing names, once per goal. The
        //store indexes by name, and patchTerritory() reports which fields actually moved
        //so the map only redraws the territories that changed.
        const friendlyName = goalHasATarget ? goal[3] : goal[2];
        const friendlyTerritory = getTerritoryByName(friendlyName);
        if (friendlyTerritory) {
            patchTerritory(friendlyTerritory.uniqueId, mainArrayFriendlyTerritoryCopy);
        }
        if (goalHasATarget) {
            const enemyTerritory = getTerritoryByName(goal[2]);
            if (enemyTerritory) {
                patchTerritory(enemyTerritory.uniqueId, mainArrayEnemyTerritoryCopy);
            }
        }
    }
    return refinedTurnGoals;
}

function determineIfOtherGoalNeedsResourceThisTurn(resource, refinedTurnGoals, goalIndex) {
    let count = 0

    for (let i = 0; i < refinedTurnGoals.length; i++) {
        if (i > goalIndex) { //only interested in goals not done yet for this turn
            switch (resource) {
                case "gold": //increment countGold for each goal after this requiring gold
                    if (refinedTurnGoals[i][1] === "Economy" || refinedTurnGoals[i][1] === "Bolster") {
                        count++;
                    }
                    break;
                case "consMats": //increment countConsMats for each goal after this requiring consMats
                    if (refinedTurnGoals[i][1] === "Economy") {
                        count++;
                    }
                    break;
            }
        }
    }
    return count;
}

/**
 * The mean infantry a Bolster goal is short of: what one territory's share of the
 * threat implies, minus what it already has.
 */
function meanInfantryDeficitForBolsterGoal(goal) {
    return Math.floor(goal[6] / goal[0]) - goal[4];
}

/**
 * Drop the Bolster goals that turn out not to need bolstering.
 *
 * Only goals AFTER the cursor are eligible. Removing one at or before it would shift
 * every later index down by one, which is exactly the mistake this function exists to
 * undo -- see audit 5.1 AA -- and it would silently skip a goal in the caller's own
 * index-driven loop as well.
 */
function dropBolsterGoalsNeedingNoInfantry(refinedTurnGoals, goalIndex) {
    return refinedTurnGoals.filter((goal, i) => {
        if (i <= goalIndex || goal[1] !== "Bolster") {
            return true;
        }
        return !(meanInfantryDeficitForBolsterGoal(goal) < 0); //non-finite deficits are kept, as they were before
    });
}

/**
 * How much of `resource` this goal may spend, given the goals still to come this turn.
 *
 * Returns `[goals, amount]`. The goal list comes back because Bolster goals that do not
 * need bolstering are dropped for the rest of the turn, and the caller adopts the
 * shortened list.
 *
 * That drop happens ONCE, before the loop, over a list that then does not change --
 * audit 5.1 AA. The original rebuilt `refinedTurnGoals` from inside a loop indexed
 * against its old length, so the moment it removed an element at or before the cursor
 * the last index no longer existed and `refinedTurnGoals[i][1]` threw
 * `Cannot read properties of undefined (reading '1')`. That rejection escaped the
 * `gameLoop()` promise chain uncaught, `currentTurn++` never ran, and the game froze on
 * "AI MOVING..." until the page was reloaded.
 */
function determineResourcesAvailableForThisGoal(resource, amountOfResourceCurrentlyInTerritory, mainArrayFriendlyTerritoryCopy, numberOfGoalsNeedingResourceAfterThisOne, refinedTurnGoals, goalIndex) {
    let resourcesAvailable;
    let count = 0;

    if (numberOfGoalsNeedingResourceAfterThisOne !== 0) {
        let goals = refinedTurnGoals;
        let proportionsPercentageArray = [];
        let everyBolsterIsANegativeThreat = false;

        //only gold is shared out proportionally; consMats goals each count for one
        const hasLaterBolsterGoal = resource === "gold" &&
            goals.some((goal, i) => i > goalIndex && goal[1] === "Bolster");

        if (hasLaterBolsterGoal) {
            goals = dropBolsterGoalsNeedingNoInfantry(goals, goalIndex);

            const deficits = goals
                .filter(goal => goal[1] === "Bolster")
                .map(goal => [goal, meanInfantryDeficitForBolsterGoal(goal)])
                .filter(entry => Number.isFinite(entry[1])); //a zero-quantity goal must not poison the sum with NaN

            const sumOfValues = deficits.reduce((sum, entry) => sum + entry[1], 0);

            if (sumOfValues !== 0) {
                proportionsPercentageArray = deficits.map(entry => [entry[0], (entry[1] / sumOfValues) * 100]);
            } else {
                everyBolsterIsANegativeThreat = true;
                console.log("any bolsters for this territory will receive just what is left over after economy as they are a negative mean threat level");
            }
        }

        for (let i = 0; i < goals.length; i++) {
            if (i <= goalIndex) { //only interested in goals not done yet for this turn
                continue;
            }
            if (resource === "gold") {
                if (goals[i][1] === "Bolster") {
                    if (everyBolsterIsANegativeThreat) {
                        count++; //no Bolster left to fund, so just divide the money into the rest of the counts
                    } else {
                        //match one of the proportions up with this goal and take that share
                        for (let j = 0; j < proportionsPercentageArray.length; j++) {
                            if (proportionsPercentageArray[j][0][1] === goals[i][1] && proportionsPercentageArray[j][0][2] === goals[i][2]) {
                                count = Math.floor((goals[i][0] / 100) * proportionsPercentageArray[j][1]);
                                count === 0 ? count = 1 : null;
                            }
                        }
                    }
                } else if (goals[i][1] === "Economy") {
                    count++;
                }
            } else if (resource === "consMats") {
                count++;
            }
        }

        refinedTurnGoals = goals;
        //count of 0 divided into the territory's stock is Infinity, which propagates as NaN
        //through every later purchase. One goal with everything is what a count of 0 means.
        resourcesAvailable = Math.floor(amountOfResourceCurrentlyInTerritory / Math.max(1, count));
    } else {
        resourcesAvailable = Math.floor(amountOfResourceCurrentlyInTerritory);
    }
    return [refinedTurnGoals, resourcesAvailable];
}

/**
 * How many upgrades one territory may buy this turn.
 *
 * `MAX_AI_UPGRADES_PER_TURN` is the flat cap; a country whose campaign says it has no
 * economy worth speaking of is allowed to build past it, and one that is defending is held
 * below it. Rounded up so the scale can never take the allowance to zero.
 */
function upgradeAllowanceFor(campaign) {
    return Math.max(1, Math.ceil(MAX_AI_UPGRADES_PER_TURN * (campaign?.upgradeScale ?? 1)));
}

function analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild(territory, goldToSpend, consMatsToSpend, maxUpgrades = MAX_AI_UPGRADES_PER_TURN) {
    let couldNotAffordEconomy = false;

    let buildList = [];
    let availableUpgrades = calculateAvailableUpgrades(territory);
    let farm = availableUpgrades[0];
    let forest = availableUpgrades[1];
    let oilWell = availableUpgrades[2];

    let farmGoldBaseCost = territoryUpgradeBaseCostsGold.farm;
    let farmConsMatsBaseCost = territoryUpgradeBaseCostsConsMats.farm;
    let forestGoldBaseCost = territoryUpgradeBaseCostsGold.forest;
    let forestConsMatsBaseCost = territoryUpgradeBaseCostsConsMats.forest;
    let oilWellGoldBaseCost = territoryUpgradeBaseCostsGold.oilWell;
    let oilWellConsMatsBaseCost = territoryUpgradeBaseCostsConsMats.oilWell;

    availableUpgrades[0].goldCost = Math.ceil((farmGoldBaseCost * (territory.farmsBuilt + 1) * ((territory.farmsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
    availableUpgrades[0].consMatsCost = Math.ceil((farmConsMatsBaseCost * (territory.farmsBuilt + 1)  * ((territory.farmsBuilt + 1)  * 1.1)) * (territory.devIndex / 4));
    availableUpgrades[1].goldCost = Math.ceil((forestGoldBaseCost * (territory.forestsBuilt + 1) * ((territory.forestsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
    availableUpgrades[1].consMatsCost = Math.ceil((forestConsMatsBaseCost * (territory.forestsBuilt + 1)  * ((territory.forestsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));
    availableUpgrades[2].goldCost = Math.ceil((oilWellGoldBaseCost * (territory.oilWellsBuilt + 1) * ((territory.oilWellsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
    availableUpgrades[2].consMatsCost = Math.ceil((oilWellConsMatsBaseCost * (territory.oilWellsBuilt + 1)  * ((territory.oilWellsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));

    let buildAgain = aiRng() > 0.5;

    let points = {
        farm: {},
        forest: {},
        oilWell: {}
    };

    let forestWorkAround = false; // sometimes the cost of a forest upgrade in consMats is too much for the country when it has max consmats, so this helps it out to allow it to reach max forests and reach its potential

    if (farm.goldCost > goldToSpend && forest.goldCost > goldToSpend && oilWell.goldCost > goldToSpend) {
        couldNotAffordEconomy = true;
    }
    console.log("GOLD cost: Farm: " + farm.goldCost + " Forest: " + forest.goldCost + " OilWell: " + oilWell.goldCost);
    console.log("CONSMATS cost: Farm: " + farm.consMatsCost + " Forest: " + forest.consMatsCost + " OilWell: " + oilWell.consMatsCost);
    while (!forestWorkAround && buildAgain && (farm.goldCost <= goldToSpend && farm.consMatsCost < consMatsToSpend) || (forest.goldCost <= goldToSpend && forest.consMatsCost < consMatsToSpend) || (oilWell.goldCost <= goldToSpend && oilWell.consMatsCost < consMatsToSpend)) {
        let farm = availableUpgrades[0];
        let forest = availableUpgrades[1];
        let oilWell = availableUpgrades[2];

        if (territory.farmsBuilt < maxFarms && farm.goldCost <= goldToSpend && farm.consMatsCost <= consMatsToSpend) {
            points.farm.value = aiRng() * 10 + 1;
            if (territory.foodConsumption > territory.foodCapacity) {
                points.farm.value += 10;
            } else if (territory.foodConsumption <= territory.foodCapacity) {
                points.farm.value += 5;
            }
        }
        if (territory.forestsBuilt < maxForests && forest.goldCost <= goldToSpend && forest.consMatsCost <= consMatsToSpend) {
            points.forest.value = aiRng() * 10 + 1;
            if (territory.consMatsCapacity < territory.consMatsForCurrentTerritory) {
                points.forest.value += 10
            } else if (territory.consMatsCapacity >= territory.consMatsForCurrentTerritory) {
                points.forest.value += 5
            }
        }
        if (territory.oilWellsBuilt < maxOilWells && oilWell.goldCost <= goldToSpend && oilWell.consMatsCost <= consMatsToSpend) {
            points.oilWell.value = aiRng() * 10 + 1;
            if (territory.oilDemand > territory.oilCapacity) {
                points.oilWell.value += 10;
            } else if (territory.oilDemand <= territory.oilCapacity) {
                points.oilWell.value += 5;
            }
        }

        const largestDesire = Object.entries(points).reduce((prev, [name, value]) => {
            return value.value > prev[1] ? [name, value.value] : prev;
        }, ["", -Infinity]);

        points.farm.value = 0;
        points.forest.value = 0;
        points.oilWell.value = 0;

        let objectProperty = largestDesire[0] + "sBuilt";
        console.log("Farm Points: " + points.farm.value + " Forest Points: " + points.forest.value + " OilWell Points: " + points.oilWell.value);

        let maxType;
        if (largestDesire[0] === "farm") {
            maxType = maxFarms;
        } else if (largestDesire[0] === "forest") {
            maxType = maxForests;
        } else if (largestDesire[0] === "oilWell") {
            maxType = maxOilWells;
        }

        if (largestDesire[1] !== -Infinity && territory[objectProperty] < maxType) {
            console.log("Opting to build: " + largestDesire[0])
            let selectedUpgrade;
            if (largestDesire[0] === "farm") {
                selectedUpgrade = farm;
            } else if (largestDesire[0] === "forest") {
                selectedUpgrade = forest;
                if (territory.consMatsCapacity <= territory.consMatsForCurrentTerritory && consMatsToSpend < availableUpgrades[0].consMatsCost) {
                    consMatsToSpend = territory.consMatsForCurrentTerritory; //work around to help blockage of consmats for AIs
                    forestWorkAround = true;
                    console.log("boosted consMats spending to get a forest!  This one will be the " + (territory.forestsBuilt + 1) + "th!");
                }
            } else if (largestDesire[0] === "oilWell") {
                selectedUpgrade = oilWell;
            }

            buildList.push([largestDesire[0], selectedUpgrade]);
            goldToSpend -= selectedUpgrade.goldCost;
            consMatsToSpend -= selectedUpgrade.consMatsCost;
            territory.goldForCurrentTerritory -= selectedUpgrade.goldCost;
            territory.consMatsForCurrentTerritory -= selectedUpgrade.consMatsCost;
            territory[objectProperty]++;
            let newGoldCost;
            let newConsMatsCost;

            if (largestDesire[0] === "farm") {
                newGoldCost = Math.ceil((farmGoldBaseCost * (territory.farmsBuilt + 1) * ((territory.farmsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
                newConsMatsCost = Math.ceil((farmConsMatsBaseCost * (territory.farmsBuilt + 1) * ((territory.farmsBuilt + 1)  * 1.1)) * (territory.devIndex / 4));
            } else if (largestDesire[0] === "forest") {
                newGoldCost = Math.ceil((forestGoldBaseCost * (territory.forestsBuilt + 1) * ((territory.forestsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
                newConsMatsCost = Math.ceil((forestConsMatsBaseCost * (territory.forestsBuilt + 1) * ((territory.forestsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));
            } else if (largestDesire[0] === "oilWell") {
                newGoldCost = Math.ceil((oilWellGoldBaseCost * (territory.oilWellsBuilt + 1) * ((territory.oilWellsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
                newConsMatsCost = Math.ceil((oilWellConsMatsBaseCost * (territory.oilWellsBuilt + 1)  * ((territory.oilWellsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));
            }

            availableUpgrades = calculateAvailableUpgrades(territory);

            if (largestDesire[0] === "farm") {
                availableUpgrades[0].goldCost = newGoldCost;
                availableUpgrades[0].consMatsCost = newConsMatsCost;
            } else if (largestDesire[0] === "forest") {
                availableUpgrades[1].goldCost = newGoldCost;
                availableUpgrades[1].consMatsCost = newConsMatsCost;
            } else if (largestDesire[0] === "oilWell") {
                availableUpgrades[2].goldCost = newGoldCost;
                availableUpgrades[2].consMatsCost = newConsMatsCost;
            }

            buildAgain = (aiRng() * 10 + 1) >= 5;
            if (buildList && buildList.length >= maxUpgrades) {
                break;
            } else {
                buildAgain = (aiRng() * 10 + 1) >= 5;
            }
        } else {
            break;
        }
    }
    buildList.length > 0 ? console.log("Upgrading Complete for " + territory.territoryName) : console.log("Couldn't complete any upgrades, lacked one or other resource");
    console.log("Built: ");
    for (const buildListKey in buildList) {
        let name = buildList[buildListKey][0];
        console.log(name);
    }
    console.log("Now have Farms: " + territory.farmsBuilt + " Forests: " + territory.forestsBuilt + " OilWells " + territory.oilWellsBuilt);
    return couldNotAffordEconomy;
}


function calculateIfNeedsToSwitchOrderWithEconomy(mainArrayFriendlyTerritoryCopy, refinedTurnGoals, goalIndex, goal) {
    let updated = false;
    let switchFactor = false;
    if (mainArrayFriendlyTerritoryCopy.leader.leaderType === "aggressive") {
        switchFactor = false;
    } else if (mainArrayFriendlyTerritoryCopy.leader.leaderType === "balanced") {
        switchFactor = aiRng() > 0.5;
    } else if (mainArrayFriendlyTerritoryCopy.leader.leaderType === "pacifist") {
        switchFactor = aiRng() > 0.25;
    }

    if (switchFactor) {
        const economyGoalIndex = refinedTurnGoals.findIndex((g, index) => index > goalIndex && g[1] === "Economy");
        if (economyGoalIndex !== -1) {
            const economyGoal = refinedTurnGoals[economyGoalIndex];
            refinedTurnGoals[economyGoalIndex] = goal;
            refinedTurnGoals[goalIndex] = economyGoal;
            updated = true;
        }
    }
    return updated;
}

function analyzeAndBuildFortDefenses(territory, goldToSpend, consMatsToSpend) {
    let availableUpgrades = calculateAvailableUpgrades(territory);
    let fort = availableUpgrades[3];

    let fortBaseCostGold = territoryUpgradeBaseCostsGold.fort;
    let fortBaseCostConsMats = territoryUpgradeBaseCostsConsMats.fort;

    fort.goldCost = Math.ceil((fortBaseCostGold * (territory.fortsBuilt + 1) * ((territory.fortsBuilt + 1) * 1.05)) * (territory.devIndex / 4));
    fort.consMatsCost = Math.ceil((fortBaseCostConsMats * (territory.fortsBuilt + 1)  * ((territory.fortsBuilt + 1)  * 1.05)) * (territory.devIndex / 4));

    let fortDesire = aiRng() > 0.5;

    let fortBuildCount = 0;
    while ((territory.fortsBuilt < maxForts) && (fort.goldCost < goldToSpend) && (fort.consMatsCost < consMatsToSpend) && fortDesire) {
        fortBuildCount++;
        goldToSpend -= fort.goldCost;
        territory.goldForCurrentTerritory -= fort.goldCost;
        territory.consMatsForCurrentTerritory -= fort.consMatsCost;
        fortDesire = aiRng() > 0.5;
    }
    if (fortBuildCount > 0) {
        console.log("Built " + fortBuildCount + " forts on this territory this turn!");
    } else if (fortDesire && territory.fortsBuilt < maxForts) {
        console.log("Wanted to build fort but couldn't due to resources!");
        goldToSpend /= 2; //save half of money for next time or economy
    } else if (fortDesire) {
        console.log("Didn't want to build a fort!");
    }
    console.log("Territory has " + territory.fortsBuilt + " forts now");

    territory.fortsBuilt += fortBuildCount;
    return goldToSpend;
}

function bolsterArmy(territory, goldToSpend, prodPopToSpend) {
    const roundedGoldToSpend = Math.floor(goldToSpend / 10) * 10;
    goldToSpend = roundedGoldToSpend;
    let initialInfantryGold;
    let initialInfantryProdPop = 0;
    let finalInfantryProdPop;

    let navalBoughtCounter = 0;
    let airBoughtCounter = 0;
    let assaultBoughtCounter = 0;

    if (goldToSpend >= armyGoldPrices.infantry * 10) { // if AI can afford at least 10 infantry
        initialInfantryGold = (goldToSpend / 100) * 10;
        initialInfantryProdPop = (initialInfantryGold / armyGoldPrices.infantry) * INFANTRY_IN_A_TROOP;
        initialInfantryProdPop = Math.min(initialInfantryProdPop, Math.floor(prodPopToSpend));
        initialInfantryProdPop === Math.floor(prodPopToSpend) ? initialInfantryGold = Math.floor(prodPopToSpend) / 100 : null;

        territory.infantryForCurrentTerritory += initialInfantryProdPop;
        territory.goldForCurrentTerritory -= initialInfantryGold;
        territory.productiveTerritoryPop -= initialInfantryProdPop;
        goldToSpend -= initialInfantryGold;
        prodPopToSpend -= initialInfantryProdPop;

        const originalGoldToSpendAfterInitialInfantry = goldToSpend;

        const territoryOilCap = territory.oilCapacity;
        let territoryOilDemand = territory.oilDemand;
        let territorySpareOil = territoryOilCap - territoryOilDemand;

        let iteratorCount = Math.floor(aiRng() * 3) + 1;

        while ((territorySpareOil > 0) && (goldToSpend > (originalGoldToSpendAfterInitialInfantry / 100) * 10) && (prodPopToSpend > 0)) {
            if (iteratorCount === 1) {
                if (territory.isCoastal && territorySpareOil >= oilRequirements.naval && goldToSpend >= armyGoldPrices.naval && prodPopToSpend >= armyProdPopPrices.naval) {
                    navalBoughtCounter++;
                    goldToSpend -= armyGoldPrices.naval;
                    prodPopToSpend -= armyProdPopPrices.naval;
                    territory.goldForCurrentTerritory -= armyGoldPrices.naval;
                    territory.productiveTerritoryPop -= armyProdPopPrices.naval;
                    territorySpareOil -= oilRequirements.naval;
                    territory.navalForCurrentTerritory++;
                    territory.useableNaval++;
                } else {
                    iteratorCount++;
                    continue;
                }
            } else if (iteratorCount === 2) {
                if (territorySpareOil >= oilRequirements.air && goldToSpend >= armyGoldPrices.air && prodPopToSpend >= armyProdPopPrices.air) {
                    airBoughtCounter++;
                    goldToSpend -= armyGoldPrices.air;
                    prodPopToSpend -= armyProdPopPrices.air;
                    territory.goldForCurrentTerritory -= armyGoldPrices.air;
                    territory.productiveTerritoryPop -= armyProdPopPrices.air;
                    territorySpareOil -= oilRequirements.air;
                    territory.airForCurrentTerritory++;
                    territory.useableAir++;
                } else {
                    iteratorCount++;
                    continue;
                }
            } else if (iteratorCount === 3) {
                if (territorySpareOil >= oilRequirements.assault && goldToSpend >= armyGoldPrices.assault && prodPopToSpend >= armyProdPopPrices.assault) {
                    assaultBoughtCounter++;
                    goldToSpend -= armyGoldPrices.assault;
                    prodPopToSpend -= armyProdPopPrices.assault;
                    territory.goldForCurrentTerritory -= armyGoldPrices.assault;
                    territory.productiveTerritoryPop -= armyProdPopPrices.assault;
                    territorySpareOil -= oilRequirements.assault;
                    territory.assaultForCurrentTerritory++;
                    territory.useableAssault++;
                } else {
                    break;
                }
            }
            iteratorCount = (iteratorCount % 3) + 1;
        }

        territory.oilDemand = territory.oilCapacity - territorySpareOil;

        let finalInfantryQuantity = goldToSpend / armyGoldPrices.infantry
        finalInfantryProdPop = (goldToSpend / armyGoldPrices.infantry) * INFANTRY_IN_A_TROOP;
        if (prodPopToSpend >= finalInfantryProdPop) {
            territory.goldForCurrentTerritory -= finalInfantryQuantity;
            territory.productiveTerritoryPop -= finalInfantryProdPop;
            territory.infantryForCurrentTerritory += finalInfantryProdPop;
        } else {
            finalInfantryProdPop = 0;
        }
    } else { //only buy infantry
        finalInfantryProdPop = 0;
        goldToSpend = roundedGoldToSpend;
        while (goldToSpend > 0 && prodPopToSpend > 0) {
            if (goldToSpend > armyGoldPrices.infantry && prodPopToSpend > armyProdPopPrices.infantry) {
                territory.infantryForCurrentTerritory += armyProdPopPrices.infantry;
                territory.goldForCurrentTerritory -= armyGoldPrices.infantry;
                territory.productiveTerritoryPop -= armyProdPopPrices.infantry;
                goldToSpend -= armyGoldPrices.infantry;
                prodPopToSpend -= armyProdPopPrices.infantry;
                initialInfantryProdPop += armyProdPopPrices.infantry;
            } else {
                break;
            }
        }
    }

    territory.armyForCurrentTerritory += (initialInfantryProdPop + finalInfantryProdPop + (navalBoughtCounter * vehicleArmyPersonnelWorth.naval) + (airBoughtCounter * vehicleArmyPersonnelWorth.air) + (assaultBoughtCounter * vehicleArmyPersonnelWorth.assault));
    console.log("Bolstered " + territory.territoryName + " with:");
    console.log((initialInfantryProdPop + finalInfantryProdPop) + " Infantry,");
    console.log(assaultBoughtCounter + " Assault,");
    console.log(airBoughtCounter + " Air, and,");
    console.log(navalBoughtCounter + " Naval,");
    //LEAVE COMMENT - Be aware of goldCostPerTurn of army if AI stops generating gold or goes negative
}

/**
 * How much of this territory's army goes at this target, or "Cancel" and why.
 *
 * The decision itself is `src/ai/commitment.js`, which is pure and unit-tested; this is the
 * wiring that gives it the two things it cannot compute in Node -- the real pre-battle odds,
 * and the local threat read out of the turn's own threat map.
 *
 * What it replaces was the single largest cause of the AI losing wars it had correctly
 * decided to fight. The old sizing averaged every threat facing the WHOLE COUNTRY, subtracted
 * one territory's defence score from it, and used the result as a number of soldiers; it then
 * pressed the attack on any probability at all above 1%. So the odds the planner approved and
 * the odds the battle was actually fought at were two unrelated numbers, and the country
 * learned nothing from the difference. See the module comment for the measurement.
 *
 * @param {boolean} siege  a siege rather than an assault: it clears the campaign's SIEGE
 *        floor instead of its attack floor, because sitting outside a wall is what a siege
 *        is for and it does not have to win a battle today.
 */
function calculateArmyQuantityBeingSentOrIfCancellingInteraction(leader, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, arrayOfTerritoriesInRangeThreats, siege, campaign = null) {
    //A target already besieged is not interactable by anybody, so there is nothing to size.
    //Checked first because it is the one answer that does not depend on the army at all.
    if (aiSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName) ||
        playerSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName)) {
        console.log("Can't siege or attack because territory already under siege!");
        return "Cancel";
    }

    const localEnemyPower = strongestEnemyPowerAgainst(
        mainArrayFriendlyTerritoryCopy.territoryName, arrayOfTerritoriesInRangeThreats);

    //The odds of sending exactly this much, composed the way it will actually be composed.
    //Asking about the force that will be SENT rather than about the whole garrison is the
    //fix: those were different armies, and only one of them ever turned up to the battle.
    const oddsFor = (amount) => {
        const makeup = calculateArmyMakeupOfAttack(
            mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, amount);
        return calculateProbabilityPreBattle(
            [mainArrayEnemyTerritoryCopy.uniqueId, parseInt(mainArrayFriendlyTerritoryCopy.uniqueId),
                makeup[0], makeup[1], makeup[2], makeup[3]],
            allTerritories(), false);
    };

    //The two numbers are a PREFERENCE and a LIMIT, and a siege is where the difference
    //shows. Its preference is the campaign's siege floor; its limit is the floor the game
    //applies to everybody, because a siege does not have to win a battle today -- it is the
    //answer to a target that cannot be stormed, and refusing to lay one until it could have
    //been stormed makes the whole mechanic unreachable. Measured: eighty-seven sieges
    //decided upon across the world in a turn and not one of them laid, all hundred turns.
    const floor = siege
        ? siegeFloorFor(leader.leaderType)
        : (campaign?.attackOddsFloor ?? 34);
    const aim = siege
        ? (campaign?.siegeOddsFloor ?? PROBABILITY_THRESHOLD_FOR_SIEGE)
        : undefined;

    const decision = decideCommitment({
        army: mainArrayFriendlyTerritoryCopy.armyForCurrentTerritory,
        localEnemyPower,
        leaderType: leader.leaderType,
        traits: leader.traits,
        floor,
        aimAt: aim,
        //A siege presses on below its preference, and so does a war this country has
        //COMMITTED to: in both, the alternative to a hard attempt is not a better one, it
        //is no war at all. Everything else waits for the troops to do it properly.
        pressOnBelowAim: siege ||
            campaign?.theatre?.rival === mainArrayEnemyTerritoryCopy.dataName,
        oddsFor,
        targetName: mainArrayEnemyTerritoryCopy.territoryName
    });

    console.log(decision.reason);
    if (!decision.commit) {
        //A cancellation for want of STRENGTH is remembered; one for want of troops this
        //turn is not, and the difference matters more than it looks. A country that plans
        //an attack every turn and cancels it every turn is the most invisible of the
        //repeating-failure loops -- the goal list says it acted, the world says nothing
        //happened, and nothing connected the two -- so "everything this border can spare
        //still cannot take that place" has to raise the bar for next time.
        //
        //Remembering the other kind was measured and was much worse than not: a border
        //briefly too stretched to attack wrote its neighbour off, the setback penalty then
        //kept it written off, and conquests across the whole world fell to zero within ten
        //turns. A transient shortage is not a lesson about the enemy.
        if (decision.reasonCode === "below-floor") {
            recordAttackOutcome(
                mainArrayFriendlyTerritoryCopy.dataName,
                mainArrayEnemyTerritoryCopy.territoryName,
                false,
                currentTurn(),
                mainArrayEnemyTerritoryCopy.dataName);
        }
        //"I could take it with more men" is not a failure, it is a REQUISITION -- and it is
        //the one piece of feedback that makes the AI adapt across turns rather than within
        //one. The interior provinces answer it at the top of next turn (src/ai/muster.js),
        //and the attack that was impossible becomes possible without anything having been
        //thrown away in the meantime.
        if (decision.reasonCode === "needs-more-force" || decision.reasonCode === "below-floor") {
            recordReinforcementDemand(
                mainArrayFriendlyTerritoryCopy.dataName,
                mainArrayFriendlyTerritoryCopy.territoryName,
                decision.shortfall ?? 0,
                currentTurn());
        }
        return "Cancel";
    }

    return [decision.amount, decision.odds];
}

/**
 * The odds a siege has to show before this leader will lay one.
 *
 * The single definition of a rule that used to exist in two places that could not see each
 * other -- here, where the army is sized, and inside `setSiege()`, where the siege is
 * actually laid. When they disagreed the second silently discarded what the first had decided.
 */
function siegeFloorFor(leaderType) {
    return PROBABILITY_THRESHOLD_FOR_SIEGE +
        (siegeDiscipline.leaderOddsModifier[leaderType] ?? siegeDiscipline.leaderOddsModifier.balanced);
}

/**
 * The army power of the strongest enemy territory that can reach one of ours.
 *
 * `arrayOfTerritoriesInRangeThreats` is one row per reachable ENEMY territory,
 * `[name, turnStillToCome, armyPower, isCoastal, [[ourTerritory, threatScore], ...]]`. The
 * threat SCORE is a difference between two armies, inflated by the attacking leader's
 * personality; `armyPower` at [2] is a quantity in the same units as an army, which is what
 * a decision about how many soldiers to leave behind has to be made in. Rows that cannot
 * reach this territory carry `THREAT_DISREGARD_CONSTANT` and are not enemies of it.
 *
 * Zero means nothing can reach the territory at all -- it is interior.
 */
function strongestEnemyPowerAgainst(territoryName, arrayOfTerritoriesInRangeThreats) {
    let strongest = 0;
    for (const row of arrayOfTerritoriesInRangeThreats ?? []) {
        const canReach = (row[4] ?? []).some(([ourTerritory, threatScore]) =>
            ourTerritory === territoryName && threatScore !== THREAT_DISREGARD_CONSTANT);
        if (canReach) {
            strongest = Math.max(strongest, Number(row[2]) || 0);
        }
    }
    return strongest;
}

function calculateArmyMakeupOfAttack(mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, amountBeingSentToBattle) {
    const originalAmountBeingSentToBattle = amountBeingSentToBattle;
    const infantry = mainArrayFriendlyTerritoryCopy.infantryForCurrentTerritory;
    let assault = mainArrayFriendlyTerritoryCopy.useableAssault * vehicleArmyPersonnelWorth.assault;
    let air = mainArrayFriendlyTerritoryCopy.useableAir * vehicleArmyPersonnelWorth.air;
    let naval = mainArrayFriendlyTerritoryCopy.useableNaval * vehicleArmyPersonnelWorth.naval;

    let navalAddCount = 0;
    let airAddCount = 0;
    let assaultAddCount = 0;
    let infantryCount;

    while ((amountBeingSentToBattle > ((originalAmountBeingSentToBattle / 100) * 30)) && (naval > 0 || air > 0 || assault > 0)) {
        //A pass that allocates nothing is a pass that will allocate nothing next time
        //either -- nothing it reads has changed -- so the loop would spin forever and take
        //the whole browser tab with it. It is reachable whenever the budget falls between
        //two unit costs while the territory holds only the dearer ones: 3,000 personnel to
        //spend, no assault units (1,000 each), and air (5,000) and naval (20,000) in stock.
        //Every branch then declines to buy and every early exit declines to fire.
        //
        //Long-standing, and it took a deliberate force-sizing decision to expose it: the old
        //caller passed one arbitrary figure derived from a national threat average, and this
        //one asks the same question four times with smaller budgets, which is how the gap
        //between two unit costs finally got landed on. A hundred-turn run froze on turn 61
        //with no error of any kind -- the tab simply stopped responding.
        const allocatedBefore = navalAddCount + airAddCount + assaultAddCount;

        if (mainArrayEnemyTerritoryCopy.isCoastal) {
            if (naval >= vehicleArmyPersonnelWorth.naval && amountBeingSentToBattle >= vehicleArmyPersonnelWorth.naval) {
                amountBeingSentToBattle -= vehicleArmyPersonnelWorth.naval;
                naval -= vehicleArmyPersonnelWorth.naval;
                navalAddCount++;
            } else {
                if (air < vehicleArmyPersonnelWorth.air && assault < vehicleArmyPersonnelWorth.assault) {
                    break;
                }
            }
        } else {
            naval = 0;
        }
        if (air >= vehicleArmyPersonnelWorth.air && amountBeingSentToBattle >= vehicleArmyPersonnelWorth.air) {
            amountBeingSentToBattle -= vehicleArmyPersonnelWorth.air;
            air -= vehicleArmyPersonnelWorth.air;
            airAddCount++;
        } else {
            if (assault < vehicleArmyPersonnelWorth.assault && naval < vehicleArmyPersonnelWorth.naval) {
                break;
            }
        }
        if (assault >= vehicleArmyPersonnelWorth.assault && amountBeingSentToBattle >= vehicleArmyPersonnelWorth.assault) {
            amountBeingSentToBattle -= vehicleArmyPersonnelWorth.assault;
            assault -= vehicleArmyPersonnelWorth.assault;
            assaultAddCount++;
        } else {
            if (air < vehicleArmyPersonnelWorth.air && naval < vehicleArmyPersonnelWorth.naval) {
                break;
            }
        }
        if ((amountBeingSentToBattle < vehicleArmyPersonnelWorth.assault) || (naval === 0 && air === 0 && assault === 0 && amountBeingSentToBattle > ((originalAmountBeingSentToBattle / 100) * 30))) {
            break;
        }
        //Nothing was bought this pass. The remaining budget cannot afford any unit the
        //territory still has, and nothing above will change that, so the rest of the force
        //goes as infantry. See the note at the top of the loop.
        if (navalAddCount + airAddCount + assaultAddCount === allocatedBefore) {
            break;
        }
    }
    if (infantry >= amountBeingSentToBattle) {
        infantryCount = amountBeingSentToBattle;
    } else {
        infantryCount = infantry;
    }

    console.log("Enemy is Coastal: " + mainArrayEnemyTerritoryCopy.isCoastal);
    console.log("Infantry: " + infantryCount + " Assault: " + assaultAddCount + " Air: " + airAddCount + " Naval: " + navalAddCount);
    return [infantryCount, assaultAddCount, airAddCount, navalAddCount];
}

/**
 * @param {boolean} debitSource  whether the army being sent still has to leave the source
 *        territory. False for an assault out of a SIEGE: that army marched out when the
 *        siege was laid, so debiting the source again would destroy it twice on a loss and
 *        conjure it out of nothing on a win.
 */
function doAttack(armyArray, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, probability, debitSource = true) {
    for (let i = 0; debitSource && i < allTerritories().length; i++) { //remove army from attacking territory
        if (allTerritories()[i].uniqueId === mainArrayFriendlyTerritoryCopy.uniqueId) {
            allTerritories()[i].infantryForCurrentTerritory -= armyArray[0];
            allTerritories()[i].assaultForCurrentTerritory -= armyArray[1];
            allTerritories()[i].useableAssault -= armyArray[1];
            allTerritories()[i].airForCurrentTerritory -= armyArray[2];
            allTerritories()[i].useableAir -= armyArray[2];
            allTerritories()[i].navalForCurrentTerritory -= armyArray[3];
            allTerritories()[i].useableNaval -= armyArray[3];
            break;
        }
    }

    //Battle overhaul B.5. THE AI AND THE PLAYER NOW FIGHT THE SAME BATTLE.
    //
    //What was here was a second, unrelated combat model: a `while` loop that ground the two
    //COMBINED FORCES against each other at one flat probability, in chunks of 1000/100/10/1
    //"to speed up processing", until one of them hit zero. No rounds, no unit types, no matchup
    //matrix, no rout, no last push, no per-exchange cap -- none of the things the player's
    //battle had. So the odds the player was shown were produced by a model the AI did not use,
    //and every measurement of the game measured one of the two systems at a time.
    //
    //It is `resolveBattle()` from src/rules/military/battleModel.js now, played headlessly with
    //the AI's seeded rng: the identical function the player's battle steps through one round per
    //click. See docs/battle_overhaul.md section 1.1 and phase B.5.
    const defenders = [
        mainArrayEnemyTerritoryCopy.infantryForCurrentTerritory,
        mainArrayEnemyTerritoryCopy.useableAssault,
        mainArrayEnemyTerritoryCopy.useableAir,
        mainArrayEnemyTerritoryCopy.useableNaval
    ];
    const result = resolveBattle({
        attackers: [...armyArray],
        defenders,
        territory: mainArrayEnemyTerritoryCopy,
        context: {
            //The AI attacks out of ONE territory, so the mean development index of the attacking
            //territories is just that territory's.
            attackingDevelopmentIndex: parseFloat(mainArrayFriendlyTerritoryCopy.devIndex),
            combatContinentModifier: combatContinentModifierFor(mainArrayEnemyTerritoryCopy)
        }
    }, aiRng);

    //The caller's contract is a pair in which exactly ONE side is above zero:
    //`recombineRemainingArmyAfterBattle()` reads `battleResult[0] > 0` as "the attacker won".
    //The new model can end with both armies alive -- a rout or a break leaves survivors on both
    //sides -- so the result is collapsed to that contract here rather than changing every caller.
    //The attacker's survivors after a FAILED attack are discarded, which is what the old loop did
    //too: it ran until the attacking force reached zero.
    //Battle overhaul B.8. A battle the PLAYER defended is worth watching, so the record of it is
    //queued for playback after the AI phase. It is only a record -- the battle has already been
    //fought and its consequences applied by the time anything is drawn, which is what makes the
    //playback skippable and what stops it stalling the turn loop.
    if (mainArrayEnemyTerritoryCopy.owner === "Player") {
        recordDefence({
            attackerCountry: mainArrayFriendlyTerritoryCopy.dataName,
            //Read NOW. A win is about to change `dataName`, and a record of something that
            //happened names who it happened to rather than reading it back afterwards
            //(known-issues AS).
            defenderCountry: mainArrayEnemyTerritoryCopy.dataName,
            territoryId: mainArrayEnemyTerritoryCopy.uniqueId,
            territoryName: mainArrayEnemyTerritoryCopy.territoryName,
            startingAttackers: armyArray,
            startingDefenders: defenders,
            records: result.records,
            state: result.state,
            tookTerritory: result.tookTerritory
        });
    }

    if (result.tookTerritory) {
        return [calculateCombinedForce(result.occupying ?? result.battle.attackers), 0];
    }
    return [0, calculateCombinedForce(result.battle.defenders)];
}

function recombineRemainingArmyAfterBattle(armyArray, battleResult, mainArrayEnemyTerritoryCopy) {
    const totalStartingAttackArmy = calculateCombinedForce(armyArray);
    let percentageLeftOver;
    let totalAllocated = 0;

    let attackOrDefend;

    let assaultAddCount = 0;
    let airAddCount = 0;
    let navalAddCount = 0;

    let remainderArray = [];
    let defenderArmyArray = [mainArrayEnemyTerritoryCopy.infantryForCurrentTerritory, mainArrayEnemyTerritoryCopy.useableAssault, mainArrayEnemyTerritoryCopy.useableAir, mainArrayEnemyTerritoryCopy.useableNaval];

    if (battleResult[0] > 0) { //if attacker won
        percentageLeftOver = (battleResult[0] / totalStartingAttackArmy) * 100;
        attackOrDefend = 0;
    } else if (battleResult[1] > 0) { //if defender won
        percentageLeftOver = (battleResult[1] / totalStartingAttackArmy) * 100;
        armyArray = defenderArmyArray;
        attackOrDefend = 1;
    }

    for (let element in armyArray) {
        armyArray[element] *= (percentageLeftOver / 100);
        armyArray[element] = Math.round(armyArray[element]);
    }
    const armyArrayStart = [...armyArray];
    while (armyArray[1] > 0 || armyArray[2] > 0 || armyArray[3] > 0) {
        let option = Math.floor(aiRng() * 3) + 1;
        switch(option) {
            case 1:
                if (assaultAddCount < armyArrayStart[1]) {
                    assaultAddCount++
                    totalAllocated += vehicleArmyPersonnelWorth.assault;
                    armyArray[1]--;
                }
                break;
            case 2:
                if (airAddCount < armyArrayStart[2]) {
                    airAddCount++
                    totalAllocated += vehicleArmyPersonnelWorth.air;
                    armyArray[2]--;
                }
                break;
            case 3:
                if (navalAddCount < armyArrayStart[3]) {
                    navalAddCount++
                    totalAllocated += vehicleArmyPersonnelWorth.naval;
                    armyArray[3]--;
                }
                break;
        }
    }

    let infantryCount = (armyArray[0] + armyArray[1] + armyArray[2] + armyArray[3]) - totalAllocated;
    remainderArray.push(infantryCount, assaultAddCount, airAddCount, navalAddCount, attackOrDefend);

    if (attackOrDefend === 1) {
        for (let i = 0; i < allTerritories().length; i++) {
            if (allTerritories()[i].uniqueId === mainArrayEnemyTerritoryCopy.uniqueId) {
                allTerritories()[i].infantryForCurrentTerritory = remainderArray[0];
                allTerritories()[i].assaultForCurrentTerritory = remainderArray[1];
                allTerritories()[i].airForCurrentTerritory = remainderArray[2];
                allTerritories()[i].navalForCurrentTerritory = remainderArray[3];
                break;
            }
        }
    }
    return remainderArray;
}

function updateTerritory(territory, remainingArmyArray, mainArrayFriendlyTerritoryCopy) {
    territory.infantryForCurrentTerritory = remainingArmyArray[0];
    territory.assaultForCurrentTerritory = remainingArmyArray[1];
    territory.airForCurrentTerritory = remainingArmyArray[2];
    territory.navalForCurrentTerritory = remainingArmyArray[3];
    if (territory.owner === "Player") {
        for (let i = 0; i < playerOwnedTerritories.length; i++) {
            if (playerOwnedTerritories[i].getAttribute("uniqueid") === territory.uniqueId) {
                playerOwnedTerritories.splice(i, 1);
                break;
            }
        }
        console.log(playerOwnedTerritories)
    }
    territory.owner = mainArrayFriendlyTerritoryCopy.owner;
    territory.countryColor = mainArrayFriendlyTerritoryCopy.countryColor;
    territory.dataName = mainArrayFriendlyTerritoryCopy.dataName;
    territory.leader = mainArrayFriendlyTerritoryCopy.leader;
    setColorOnMap(territory);
    //`territory` here is still one of doAiActions() working copies, so the conquest is
    //recorded against the real territory rather than left for the write-back loop to
    //carry. The path attributes follow from this (Phase 4.4); setOwnerOnPath() and
    //setCountryNameOnPath() are gone, and with them the bug that the latter wrote
    //`territory.owner` into `data-name` rather than `territory.dataName`.
    setTerritoryOwner(
        territory.uniqueId,
        mainArrayFriendlyTerritoryCopy.owner,
        mainArrayFriendlyTerritoryCopy.dataName
    );
    deactivateTerritoryAi(territory);
    updateArrayOfLeadersAndCountries();
    summaryWarsArray.push(territory.territoryName + " conquered by " + mainArrayFriendlyTerritoryCopy.dataName);
    return territory;
}

function calculateGoldToOfferPlayerToBreakSiege(mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy) {
    let totalGold = 0;
    let totalArea = 0;
    let leaderTerritoryExpansionTrait;
    let arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    for (let i = 0; i < arrayOfLeadersAndCountries.length; i++) {
        if (arrayOfLeadersAndCountries[i][0] === mainArrayFriendlyTerritoryCopy.dataName) {
            for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) {
                totalArea += arrayOfLeadersAndCountries[i][2][j].area;
                totalGold += arrayOfLeadersAndCountries[i][2][j].goldForCurrentTerritory;
                leaderTerritoryExpansionTrait = arrayOfLeadersAndCountries[i][1].traits.territory_expansion;
            }
            break;
        }
    }
    let territoryAreaPercentage = (mainArrayEnemyTerritoryCopy.area / totalArea) * 100;
    let totalBaseGold = (totalGold / territoryAreaPercentage) * leaderTerritoryExpansionTrait;

    if (mainArrayEnemyTerritoryCopy.originalOwner === mainArrayFriendlyTerritoryCopy.owner) totalBaseGold *= 2;

    let goldToOffer = totalBaseGold;
    if (totalBaseGold > totalGold) goldToOffer = totalGold;

    return Math.floor(goldToOffer);
}

export async function openUIAndOfferGoldToPlayer(goldToOffer, attacker, defender) {
    await populateAiDialogueBox("goldForSiege", attacker, defender, goldToOffer);
    let returnArmyData = [];
    let selection = await playerResponseToAiDialog();
    if (selection === 1) {
        returnArmyData = removeSiegeAndReturnPlayerArmy(defender); //remove siege and return player army
    } else {
        returnArmyData = null;
    }
    let response = await populateAiResponse("goldForSiege", selection, defender, returnArmyData);

    if (response === 9) {
        toggleAiDialogue(false);
        setAiDialogueContainerCurrentlyOnScreen(false);
    } else {
        console.log("Error in response " + response);
    }
    return selection;
}

export function setAiResponseFlag(selection) {
    aiDialogueSelection = selection;
    aiDialogueResponse = true;
}

async function playerResponseToAiDialog() {
    let response;
    await new Promise((resolve) => {
        const poller = setInterval(() => {
            if (aiDialogueResponse) {
                response = aiDialogueSelection;
                clearInterval(poller);
                resolve();
            }
        }, 75);
    });
    aiDialogueSelection = 0;
    aiDialogueResponse = false;

    return response;
}
async function populateAiResponse(situation, response, parameter, returnArmyData) {
    switch(situation) {
        case "goldForSiege":
            if (response === 0) {
                document.getElementById(ids.aiDialogueBodySubHeading).innerHTML = "We will not be so lenient next time! Ok proceed with your siege, but it might be you being sieged soon!";
            } else if (response === 1 && returnArmyData !== null) {
                document.getElementById(ids.aiDialogueBodySubHeading).innerHTML = "We thank you graciously; we shall enjoy conquering the worthless territory of " + parameter.territoryName + "!<br/>Shipping out to " + returnArmyData[4] + "!";
                setAiDialogueBodyBottomContentState(1);
                populateArmyDataFields(returnArmyData);
            }
            convertAiDialogueButtonRow(0);
            document.getElementById(ids.aiButtonAllRow).innerHTML = "Proceed";
            break;
    }

    await new Promise((resolve) => {
        const poller = setInterval(() => {
            if (aiDialogueResponse) {
                response = aiDialogueSelection;
                clearInterval(poller);
                resolve();
            }
        }, 75);
    });
    aiDialogueSelection = 0;
    aiDialogueResponse = false;

    return response;
}

function removeGoldFromAi(goldToOffer, mainArrayFriendlyTerritoryCopy) {
    let goldInAiTerritories = [];
    let arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();

    for (let i = 0; i < arrayOfLeadersAndCountries.length; i++) {
        if (arrayOfLeadersAndCountries[i][0] === mainArrayFriendlyTerritoryCopy.dataName) {
            for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) {
                goldInAiTerritories.push([
                    arrayOfLeadersAndCountries[i][2][j].uniqueId,
                    arrayOfLeadersAndCountries[i][2][j].goldForCurrentTerritory
                ]);
            }
            break;
        }
    }

    const totalGoldInTerritories = goldInAiTerritories.reduce((total, territory) => total + territory[1], 0);
    const goldDistribution = goldInAiTerritories.map(territory => (territory[1] / totalGoldInTerritories) * goldToOffer);

    // console.log("Gold Distribution:", goldDistribution);

    for (let i = 0; i < goldInAiTerritories.length; i++) {
        const uniqueId = goldInAiTerritories[i][0];
        const distribution = goldDistribution[i];

        for (let j = 0; j < arrayOfLeadersAndCountries.length; j++) {
            const territories = arrayOfLeadersAndCountries[j][2];

            for (let k = 0; k < territories.length; k++) {
                if (territories[k].uniqueId === uniqueId) {
                    territories[k].goldForCurrentTerritory -= distribution;
                    break;
                }
            }
        }
    }
}

function addGoldToPlayer(goldToOffer) {
    let arrayOfPlayerTerritoriesFromMainArray = [];
    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].owner === "Player") {
            arrayOfPlayerTerritoriesFromMainArray.push(allTerritories()[i]);
        }
    }
    const numberOfTerritories = arrayOfPlayerTerritoriesFromMainArray.length;
    const goldPerTerritory = goldToOffer / numberOfTerritories;

    for (const territory of arrayOfPlayerTerritoriesFromMainArray)   {
        territory.goldForCurrentTerritory += goldPerTerritory;
    }

    for (let i = 0; i < allTerritories().length; i++) {
        if (allTerritories()[i].owner === "Player") {
            console.log(allTerritories()[i].territoryName + allTerritories()[i].goldForCurrentTerritory);
        }
    }
}

function removeSiegeAndReturnPlayerArmy(siegedTerritory) {
    let siegeObject = getSiegeObjectFromPlayerSiegeList(siegedTerritory);

    let returnArmyArray = [siegeObject.attackingArmyRemaining[0],siegeObject.attackingArmyRemaining[1],siegeObject.attackingArmyRemaining[2],siegeObject.attackingArmyRemaining[3]];
    let possibleReturnTerritories = [];
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("uniqueid") === siegedTerritory.uniqueId) {
            possibleReturnTerritories = findClosestPaths(paths[i]);
        }
    }
    for (let i = 0; i < possibleReturnTerritories.length; i++) {
        if (pathIsPlayerOwned(possibleReturnTerritories[i][0])) {
            for (let j = 0; j < allTerritories().length; j++) {
                if (allTerritories()[j].uniqueId === possibleReturnTerritories[i][0].getAttribute("uniqueid")) {
                    returnArmyArray.push(allTerritories()[j].territoryName);
                    let returnTerritory = allTerritories()[j];
                    returnTerritory.infantryForCurrentTerritory += returnArmyArray[0];
                    returnTerritory.assaultForCurrentTerritory += returnArmyArray[1];
                    returnTerritory.airForCurrentTerritory += returnArmyArray[2];
                    returnTerritory.navalForCurrentTerritory += returnArmyArray[3];
                    returnTerritory.armyForCurrentTerritory = returnTerritory.infantryForCurrentTerritory + (returnTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (returnTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (returnTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
                    break;
                }
            }
            break;
        }
    }

    addRemoveWarSiegeObject(1, siegeObject.warId, false);
    //Removing the siege above is what clears `underSiege`; it is derived from the siege
    //lists and rendered by src/ui/mapAttributeSync.js (Phase 4.4/4.5). Only the overlay
    //image is left to take down.
    const siegedPath = getPathByUniqueId(siegedTerritory.uniqueId);
    if (siegedPath) {
        removeSiegeImageFromPath(false, siegedPath);
    }
    return returnArmyArray;
}

async function handleCaseOfTerritoryAlreadyBeingUnderSiegeByPlayerOrOtherAi(mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy) {
    let territoryAlreadyUnderPlayerSiege = playerSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName);
    let territoryAlreadyUnderAiSiege = aiSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName);
    if (territoryAlreadyUnderPlayerSiege) {
        let goldToOffer = calculateGoldToOfferPlayerToBreakSiege(mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy);
        toggleAiDialogue(true);
        setAiDialogueContainerCurrentlyOnScreen(true);
        let playerDecision = await openUIAndOfferGoldToPlayer(goldToOffer, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy)//open ui to offer player option to relinquish their siege for x gold
        if (playerDecision === 1) { //add player gold and remove player siege and continue attack
            removeGoldFromAi(goldToOffer, mainArrayFriendlyTerritoryCopy);
            addGoldToPlayer(goldToOffer);
            removeSiegeAndReturnPlayerArmy(mainArrayEnemyTerritoryCopy);
            addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
        } else { //cancel attack
            return false;
        }
    }
    return !territoryAlreadyUnderAiSiege; //skip if under siege by another AI
}

function setSiege(armyArray, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, probability, leader) {
    //The same floor the commitment sized this army against, read from one place. It used to
    //be a private switch here, so this function could -- and routinely did -- throw away a
    //siege the rest of the AI had decided on, sized an army for and logged.
    if (probability >= siegeFloorFor(leader.leaderType)) { //if siege is allowed at all depending on leader type
        if (playerSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName) || aiSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName)) {
            return;
        }
        setCurrentAiWarId(getNextAiWarId());
        let currentAiWarId = getCurrentAiWarId();
        setNextAiWarId(currentAiWarId + 1);

        const attackingTerritory = getTerritory(mainArrayFriendlyTerritoryCopy.uniqueId);
        { //remove army from attacking territory
            if (attackingTerritory) {
                attackingTerritory.infantryForCurrentTerritory -= armyArray[0];
                attackingTerritory.assaultForCurrentTerritory -= armyArray[1];
                attackingTerritory.navalForCurrentTerritory -= armyArray[3];
                attackingTerritory.useableAssault -= armyArray[1];
                attackingTerritory.useableAir -= armyArray[2];
                attackingTerritory.useableNaval -= armyArray[3];
                attackingTerritory.armyForCurrentTerritory = attackingTerritory.infantryForCurrentTerritory + (attackingTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (attackingTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (attackingTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);

                mainArrayFriendlyTerritoryCopy.infantryForCurrentTerritory -= armyArray[0];
                mainArrayFriendlyTerritoryCopy.assaultForCurrentTerritory -= armyArray[1];
                mainArrayFriendlyTerritoryCopy.airForCurrentTerritory -= armyArray[2];
                mainArrayFriendlyTerritoryCopy.navalForCurrentTerritory -= armyArray[3];
                mainArrayFriendlyTerritoryCopy.useableAssault -= armyArray[1];
                mainArrayFriendlyTerritoryCopy.useableAir -= armyArray[2];
                mainArrayFriendlyTerritoryCopy.useableNaval -= armyArray[3];
                mainArrayFriendlyTerritoryCopy.armyForCurrentTerritory = mainArrayFriendlyTerritoryCopy.infantryForCurrentTerritory + (mainArrayFriendlyTerritoryCopy.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (mainArrayFriendlyTerritoryCopy.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (mainArrayFriendlyTerritoryCopy.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);

                console.log(mainArrayFriendlyTerritoryCopy.territoryName + " had its army adjusted ready for siege");
            }
        }
        //add war to siege array for ai
        let currentWarAlreadyInSiegeMode = false;

        // Search the playerSiegeWarsList for the warId
        if (playerSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName) || aiSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName)) {
            currentWarAlreadyInSiegeMode = true;
        }
        //set sieged territory to siege mode
        const siegeTargetPath = getPathByUniqueId(mainArrayEnemyTerritoryCopy.uniqueId);
        if (siegeTargetPath && !currentWarAlreadyInSiegeMode) {
            //Recording the siege is what puts the territory under siege now: the
            //`underSiege` attribute is derived from the siege lists (Phase 4.4/4.5).
            addRemoveWarSiegeObjectAi(0, currentAiWarId, mainArrayEnemyTerritoryCopy, mainArrayFriendlyTerritoryCopy);
            //Phase 5.8. Removed for the same reason as the player's marker in ui.js: the
            //siege was added to the store just above, `siegeChanged` fired, and
            //src/ui/siegeOverlay.js has already drawn the AI variant. Drawing it again
            //produced a second <image> with a duplicated id.
            console.log("Should now be an image over the territory of " + siegeTargetPath.getAttribute("territory-name"));
        }
    }
}