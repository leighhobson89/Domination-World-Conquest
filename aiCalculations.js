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
    vehicleArmyPersonnelWorth
} from "./resourceCalculations.js";
import {
    addRemoveWarSiegeObject,
    aiSiegeWarsList,
    calculateCombinedForce,
    calculateTakeProbabilityPreBattle,
    deactivateTerritoryAi,
    playerSiegeWarsList,
    getCurrentAiWarId,
    getNextAiWarId,
    setCurrentAiWarId,
    setNextAiWarId,
    addRemoveWarSiegeObjectAi,
    getSiegeObjectFromPlayerSiegeList,
    setBattleResolutionOnHistoricWarArrayAfterSiege
} from "./battle.js";
import {
    resolveBattle
} from "./src/rules/military/battleModel.js";
import {
    garrisonOf,
    garrisonPatch,
    writeGarrison
} from './src/rules/military/garrison.js';
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
import { continentCapacityBonusFor } from './src/state/continentBonus.js';
import { effectiveCapacityFor, oilDemandFor, useableUnitsFor } from './src/rules/economy/capacity.js';
import { applyUpgrade, nextInOrderPriceFor } from './src/rules/economy/upgrades.js';
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
    currentCampaign,
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
    allOpinions,
    opinionOf,
    restoreOpinions
} from './src/ai/opinion.js';
import {
    debugPlanPush,
    debugPlanReach
} from './src/ai/debugPlans.js';
import {
    captureMusters,
    clearReinforcementDemand,
    forceOf,
    planMusters,
    recordReinforcementDemand,
    restoreMusters
} from './src/ai/muster.js';
import {
    currentTheatre,
    theatreFailuresAgainst
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
    queueCallIn,
    queueProposal
} from './src/state/diplomacyInbox.js';
import {
    alliesOf,
    besiegedTerritoryNames,
    isUnderSiege,
    playerCountryName,
    relationsFor,
    relationStateBetween,
    siegeOn,
    territoriesOwnedByCountry
} from './src/state/selectors.js';
import {
    setRelationState
} from './src/state/mutations.js';
import {
    DiplomaticState,
    PROPOSAL_RESULT,
    ProposalKind
} from './src/state/diplomacy.js';
import {
    allCallIns,
    bindJoiner,
    recordBreach,
    callInOutcomeFor,
    captureDiplomacyMemory,
    isBoundJoiner,
    planDeclarations,
    planAgreementOffer,
    proposalOutcomeFor,
    releaseAllFor,
    releaseJoiners,
    restoreDiplomacyMemory
} from './src/ai/diplomacy.js';
import {
    peaceDiscipline,
    PLAYER_GRACE_TURNS
} from './src/config/balance.js';
import {
    ids
} from './src/ui/core/registry.js';
import {
    recordFailedAttack,
    recordSiegeAbandoned,
    recordSiegeResolved
} from './src/state/activityRecorder.js';

let aiDialogueResponse = false;
let aiDialogueSelection = 0;

const aiRng = aiRandom;

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
    closestToVictory,
    leadingCountry,
    resetVictoryCondition,
    setVictoryCondition,
    victoryProgress,
    worldStandings
} from "./src/ai/victory.js";

registerSaveSlice("aiStrategy", {
    capture: () => ({
        campaigns: captureCampaigns(),
        victory: captureVictoryCondition(),
        musters: captureMusters(),
        //The refusal cooldown RIDES IN THIS SLICE rather than registering one of its own,
        //which is the rule the campaign table and the theatres already follow: `platform/`
        //must not import `src/ai/`, and a module that registered its own slice would need
        //to be imported from somewhere to do it.
        diplomacy: captureDiplomacyMemory(),
        //The opinion store rides here for the same reason, and the fact that the snapshot
        //version does not move is a feature rather than an oversight: a save taken before
        //opinion existed restores an EMPTY map, and an empty map is a correct world -- every
        //pair sitting at the resting point its standing relationship implies.
        opinions: allOpinions()
    }),
    restore: (data) => {
        restoreCampaigns(data?.campaigns);
        restoreVictoryCondition(data?.victory);
        restoreMusters(data?.musters);
        restoreDiplomacyMemory(data?.diplomacy);
        restoreOpinions(data?.opinions);
    }
});

/**
 * This country's plan for the turn, and the wars it opens to carry it out.
 *
 * The declarations are applied HERE and not inside `planCampaign()`, for the reason every
 * rule in `src/ai/` is split this way: `strategy.js` derives and `src/ai/diplomacy.js`
 * decides, both without touching the store, and this file is the one that writes. It is also
 * the correct MOMENT. `handleAITurn()` runs the succession first, so a leader who has just
 * died is never the one declaring the war; the goals are planned afterwards, so a war
 * declared now is fought now -- Leigh's rule that a declaration takes effect at once, with
 * no waiting period anywhere in this system.
 */
let callInsPrunedForTurn = -1;

/**
 * Drop call-in bindings that describe a war nobody is fighting any more.
 *
 * SELF-HEALING RATHER THAN HOOKED TO ELIMINATION, deliberately. A binding says "this country
 * joined that one's war and may not settle out of it alone", and it is released when the
 * principal settles -- but a principal that is CONQUERED never settles anything, and the
 * joiner would be barred from ever making peace with the adversary for the rest of the game.
 * Hooking the moment a country loses its last territory means finding every route by which
 * that can happen, which is the shape of mistake the eight territory-losing paths already
 * taught this codebase. Asking "does this war still exist" once a turn cannot miss one.
 */
function pruneCallIns(turn) {
    if (callInsPrunedForTurn === turn) {
        return;
    }
    callInsPrunedForTurn = turn;
    for (const row of allCallIns()) {
        const principalGone = territoriesOwnedByCountry(row.principal).length === 0;
        const adversaryGone = territoriesOwnedByCountry(row.adversary).length === 0;
        const warOver = relationStateBetween(row.principal, row.adversary) !== DiplomaticState.WAR;
        if (principalGone || adversaryGone) {
            releaseAllFor(principalGone ? row.principal : row.adversary);
        } else if (warOver) {
            releaseJoiners(row.principal, row.adversary);
        }
    }
}

export function planAiCampaign(country, leader, turn) {
    pruneCallIns(turn);
    const campaign = planCampaign(country, { turn, leader, rng: aiRng });
    applyAiDeclarations(country, campaign, leader, turn);
    return campaign;
}

/**
 * Open whatever wars `src/ai/diplomacy.js` says this country should open.
 *
 * The result is left on the campaign as `declarations` / `declarationsSkipped` so the plan
 * log, the spectator console and the AI debug panel can print WHY a country went to war --
 * the same contract `rateTarget()`'s `reason` has, and for the same reason: a country that
 * quietly declines to declare for fifty turns looks exactly like one that was never asked.
 *
 * It is memoised on the campaign, because `planCampaign()` is itself memoised per turn and a
 * second call must not declare a second time.
 */
function applyAiDeclarations(country, campaign, leader, turn) {
    if (!campaign || campaign.declarations) {
        return campaign;
    }
    const player = playerCountryName();
    const atWar = relationsFor(country)
        .filter(row => row.state === DiplomaticState.WAR).length;

    const { declarations, skipped } = planDeclarations({
        country,
        turn,
        campaign,
        //The register is keyed by COUNTRY, and a country is `dataName` -- the CURRENT owner.
        //`relationStateBetween()` never returns null, so a pair with no record answers with
        //the sparse default rather than with an absence to be handled here.
        relationStateOf: (other) => relationStateBetween(country, other),
        warCount: atWar,
        traits: leader?.traits ?? {},
        playerCountry: player,
        graceTurns: PLAYER_GRACE_TURNS
    });

    for (const row of declarations) {
        //THE BREACH IS CHARGED BEFORE THE DECLARATION IS WRITTEN, because the state it charges
        //for is the one about to be replaced. `src/ai/diplomacy.js` refuses to declare out of
        //an agreement at all today, so this fires only if that ever changes -- and the rule
        //must not depend on the caller's restraint to be correct.
        row.breach = applyBreach(country, row.target, turn);
        setRelationState(country, row.target, DiplomaticState.WAR, {
            since: turn, by: country, via: "declared"
        });
        console.log("%c" + country + " declares war on " + row.target + " -- " + row.reason,
            "color: rgb(208,70,59);");
        //THE CALL TO ARMS, on both sides. See `resolveCallIns()`: an ally is asked, never
        //enrolled, and a joiner's own allies are not asked at all -- which is what keeps a war
        //spreading one country per yes instead of closing over the whole map.
        row.callIns = resolveCallIns(country, row.target, turn);
    }

    campaign.declarations = declarations;
    campaign.declarationsSkipped = skipped;
    applyAiPeaceOffer(country, campaign, leader, turn);
    return campaign;
}

/**
 * The one agreement this country offers somebody this turn, asked and answered on the spot.
 *
 * Stage 5.1, and the half of the diplomacy rules that can END a war. Stage 3 measured a world
 * in which a declaration was permanent -- pairs at war climbed 536 to 749 across a 150-turn
 * run under every goal -- and a declaration rule with no matching peace rule is a ratchet.
 *
 * THE ANSWER IS COMPUTED WITHOUT DERIVING THE RECIPIENT'S CAMPAIGN, deliberately. The country
 * being asked may not have taken its turn yet, and `planCampaign()` for it would be a whole
 * extra derivation per offer -- up to 207 a turn. `proposalOutcomeFor()` takes plain values
 * for exactly this reason and every term it is not given contributes nothing, so the answer
 * is less informed rather than wrong. What it IS given is everything cheap: the leader, the
 * theatre commitment, the war count off the register, the setback ledger and both sizes.
 *
 * A siege between the two blocks it -- Q1, and see `proposalOutcomeFor()` for why refusing is
 * the least bad of the three available answers.
 */
function applyAiPeaceOffer(country, campaign, leader, turn) {
    if (!campaign || campaign.peaceOffer !== undefined) {
        return;
    }
    campaign.peaceOffer = null;

    const offer = planAgreementOffer({
        country,
        turn,
        relations: relationsFor(country),
        theatreRival: currentTheatre(country)?.rival ?? null,
        traits: leader?.traits ?? {},
        posture: campaign.posture ?? null,
        urgency: campaign.doctrine?.urgency ?? 0,
        failuresAgainst: (rival) => theatreFailuresAgainst(country, rival),
        opinionOf: (other) => opinionOf(country, other, relationStateBetween(country, other))
    });
    if (!offer) {
        return;
    }

    //AN OFFER TO THE PLAYER IS A QUESTION, NOT A CALCULATION -- the direction stage 5.1 left
    //unbuilt. It joins the same queue the call-in uses and is put to them at the end of the
    //turn; nothing is decided on their behalf, which is the rule the whole prompt exists for.
    if (offer.target === playerCountryName()) {
        queueProposal({ from: country, proposal: offer.kind, reason: offer.reason });
        campaign.peaceOffer = { ...offer, accepted: null, reason: "put to the player" };
        return;
    }

    const answer = answerProposal({
        country: offer.target,
        proposer: country,
        kind: offer.kind,
        turn
    });
    campaign.peaceOffer = { ...offer, ...answer };

    if (answer.accepted) {
        acceptProposal(country, offer.target, offer.kind, turn);
    }
    console.log("%c" + country + " offers " + offer.target + " " + offer.kind + " -- " +
        offer.reason + " -- " + (answer.accepted ? "ACCEPTED" : "refused") +
        " (" + answer.reason + ")",
        "color: rgb(127,196,232);");
}

/**
 * Everything `proposalOutcomeFor()` needs about a country, gathered from the live world.
 *
 * The ONE door both directions go through -- an AI asking another AI, and the player asking
 * anybody -- so the two cannot come to different conclusions about the same offer. That is
 * the rule `countriesMayFight()` established for the attack gates.
 */
export function answerProposal({ country, proposer, kind, turn }) {
    const state = relationStateBetween(country, proposer);
    const relations = relationsFor(country);
    const otherWars = relations.filter(
        row => row.state === DiplomaticState.WAR && row.country !== proposer).length;

    return proposalOutcomeFor({
        country,
        proposer,
        kind,
        state,
        turn,
        traits: leaderTraitsFor(country),
        //Only if this country's campaign has already been derived this turn. Asking for one
        //would derive it, which is the cost the comment above `applyAiPeaceOffer()` records.
        posture: currentCampaign(country)?.posture ?? null,
        urgency: currentCampaign(country)?.doctrine?.urgency ?? 0,
        theatreRival: currentTheatre(country)?.rival ?? null,
        //WHAT IT THINKS OF THE PROPOSER SPECIFICALLY. Gathered HERE, in the one door both
        //directions go through, so a player's offer and an AI's offer are answered from the
        //same number -- the rule `countriesMayFight()` established for the attack gates. The
        //state goes with it because an unrecorded pair reads as the resting point its
        //standing relationship implies rather than as zero.
        opinion: opinionOf(country, proposer, state),
        otherWars,
        failuresAgainstProposer: theatreFailuresAgainst(country, proposer),
        territories: territoriesOwnedByCountry(country).length,
        proposerTerritories: territoriesOwnedByCountry(proposer).length,
        siegeStanding: siegeStandsBetween(country, proposer),
        //Leigh's rule: a country called into somebody else's war may not settle out of it
        //alone. The proposer is the one that would be settling, so it is the proposer's
        //binding that matters here.
        boundToPrincipal: isBoundJoiner(proposer, country),
        //Both free to gather -- the register already holds every war list.
        sharedEnemies: sharedEnemiesBetween(country, proposer),
        existingAllies: alliesOf(country).length
    });
}

/** How many countries these two are BOTH at war with. The reason two countries ally. */
function sharedEnemiesBetween(a, b) {
    const theirs = new Set(relationsFor(b)
        .filter(row => row.state === DiplomaticState.WAR)
        .map(row => row.country));
    return relationsFor(a)
        .filter(row => row.state === DiplomaticState.WAR && theirs.has(row.country))
        .length;
}

/**
 * Write an accepted agreement into the register.
 *
 * The ceasefire's two extra fields are set HERE and only here. `until` is the turn it runs
 * out on, and `revertsTo` is what it falls back to then -- recorded at signing rather than
 * guessed at expiry, which is the answer to Q2: with NEUTRAL as the first-contact state,
 * "back to war" and "back to neutral" are genuinely different outcomes and the register keeps
 * no history a rule could reconstruct the right one from.
 */
export function acceptProposal(proposer, country, kind, turn) {
    const previous = relationStateBetween(proposer, country);
    const state = PROPOSAL_RESULT[kind];
    if (!state) {
        return null;
    }
    const ceasefire = kind === ProposalKind.CEASEFIRE;
    const written = setRelationState(proposer, country, state, {
        since: turn,
        until: ceasefire ? turn + peaceDiscipline.ceasefireTurns : null,
        revertsTo: ceasefire ? previous : null,
        by: proposer,
        via: "agreed"
    });

    //THE SECOND HALF OF LEIGH'S CALL-IN RULE: *"the peace must be asked either by the ally
    //under attack or by the adversary, and agreed, where it then applies peace to the ally
    //aiding the attacked ally as well."* So whoever settles this war settles it for everybody
    //they called into it, on the same terms, in the same breath. Both directions are released
    //because either party to the war may have called somebody in.
    for (const [principal, adversary] of [[proposer, country], [country, proposer]]) {
        for (const joiner of releaseJoiners(principal, adversary)) {
            if (joiner === adversary) {
                continue;
            }
            setRelationState(joiner, adversary, state, {
                since: turn,
                until: ceasefire ? turn + peaceDiscipline.ceasefireTurns : null,
                revertsTo: ceasefire ? relationStateBetween(joiner, adversary) : null,
                by: joiner,
                via: "released",
                onBehalfOf: principal
            });
            console.log("%c" + joiner + " comes out of the war with " + adversary +
                " alongside " + principal + " -- " + state,
                "color: rgb(127,196,232);");
        }
    }
    return written;
}

/**
 * Every ally that has to be ASKED because these two have gone to war, and what each said.
 *
 * **Q3 IS ANSWERED AND AN ALLY IS CALLED IN ON DEFENCE AS WELL AS ON AGGRESSION** (Leigh:
 * *"yes they are"*), so BOTH sides' allies are asked -- the declarer's, and the declared-upon's.
 * The two are weighed differently: `defensive: true` carries real weight because coming to the
 * aid of somebody who has been attacked is what an alliance is understood to be for, and being
 * dragged into a war your partner started is not.
 *
 * NOTHING CASCADES, and that is what makes calling in on defence safe. A joiner's OWN allies
 * are never asked -- this walks the two belligerents' ally lists once and stops. Without that
 * one signature would put the whole map at war in three hops, which is precisely the transitive
 * closure the first draft of this design had to forbid by rule and this one cannot produce.
 *
 * The PLAYER is never answered here: `answerCallIn` is only asked of AI countries, and a call
 * on the player is returned in `asked` for the caller to put to them. That is the one place a
 * refusal has a consequence somebody has to choose rather than compute.
 *
 * @returns {Array<{ally: string, principal: string, adversary: string, defensive: boolean,
 *                  joins: boolean|null, reason: string}>} `joins: null` means "ask the player"
 */
export function resolveCallIns(declarer, target, turn) {
    const player = playerCountryName();
    const answers = [];

    for (const [principal, adversary, defensive] of
        [[declarer, target, false], [target, declarer, true]]) {
        for (const ally of alliesOf(principal)) {
            //An ally that IS the other belligerent is not called in against itself, and an
            //ally already bound to this same war has nothing to answer.
            if (!ally || ally === adversary || isBoundJoiner(ally, adversary)) {
                continue;
            }
            if (ally === player) {
                //THE PLAYER IS ASKED RATHER THAN CALCULATED. It is queued because the AI
                //phase is not a moment the player is present for -- see `diplomacyInbox.js`
                //-- and answered at the end of the turn, which settles the open half of Q3:
                //by the start of your next turn.
                queueCallIn({ principal, adversary, defensive });
                answers.push({
                    ally, principal, adversary, defensive, joins: null,
                    reason: "the player has to answer this one"
                });
                continue;
            }
            const outcome = answerCallIn({ ally, principal, adversary, defensive, turn });
            answers.push({ ally, principal, adversary, defensive, ...outcome });
            applyCallInAnswer({ ally, principal, adversary, joins: outcome.joins, turn });
        }
    }
    return answers;
}

/** One AI ally's answer, gathered from the live world. */
export function answerCallIn({ ally, principal, adversary, defensive, turn }) {
    return callInOutcomeFor({
        ally,
        principal,
        adversary,
        traits: leaderTraitsFor(ally),
        urgency: currentCampaign(ally)?.doctrine?.urgency ?? 0,
        //THE ALLY'S OPINION OF THE PARTNER DOING THE ASKING, not of the adversary: the
        //question a call to arms puts is "will you fight for me", not "do you dislike them".
        opinion: opinionOf(ally, principal, relationStateBetween(ally, principal)),
        defensive: Boolean(defensive),
        alreadyAtWar: relationStateBetween(ally, adversary) === DiplomaticState.WAR,
        existingWars: relationsFor(ally)
            .filter(row => row.state === DiplomaticState.WAR).length,
        allyTerritories: territoriesOwnedByCountry(ally).length,
        adversaryTerritories: territoriesOwnedByCountry(adversary).length
    });
}

/**
 * Write what an ally decided.
 *
 * THREE ENDINGS AND ONLY ONE OF THEM COSTS -- Leigh's §3.4, and the whole penalty rule is one
 * sentence: *the penalty is for ending an alliance when both sides do not agree, and for
 * nothing else.* Answering a call joins the war and keeps the alliance. DECLINING one ends the
 * alliance and costs NEITHER side a thing: the aggressor chose a war their ally would not
 * fight, the ally chose not to fight it, and both have decided. The aggressor's cost is
 * exactly the thing that happened -- they have gone to war without an ally they were relying
 * on, which is a consequence rather than a fine.
 *
 * @returns {boolean} whether the ally joined
 */
export function applyCallInAnswer({ ally, principal, adversary, joins, turn }) {
    if (joins) {
        //A declaration is not needed and would be wrong: the ally is entering a war that
        //already exists rather than starting one of its own.
        setRelationState(ally, adversary, DiplomaticState.WAR, {
            since: turn, by: ally, via: "calledIn", onBehalfOf: principal
        });
        bindJoiner(principal, ally, adversary);
        console.log("%c" + ally + " answers " + principal + "'s call and enters the war with " +
            adversary, "color: rgb(208,70,59);");
        return true;
    }
    //THE ALLIANCE ENDS, FREE FOR BOTH. Back to NEUTRAL rather than to peace: the two have not
    //agreed anything, they have stopped having an agreement.
    setRelationState(ally, principal, DiplomaticState.NEUTRAL, {
        since: turn, by: ally, via: "declinedCall"
    });
    console.log("%c" + ally + " refuses " + principal + "'s call to arms -- the alliance ends, " +
        "with no penalty to either", "color: rgb(208,70,59);");
    return false;
}

/**
 * Tear up an agreement, and pay for it.
 *
 * THE ONE DOOR, called from both declaration paths — the AI's and the player's — for the
 * reason `countriesMayFight()` established: a breach charged on one route and not the other is
 * a rule the game applies to one side of itself.
 *
 * IT MUST BE CALLED BEFORE THE DECLARATION IS WRITTEN, because the state it charges for is the
 * one being torn up and `setRelationState()` will have replaced it a line later. That ordering
 * is the whole of what this function is fragile about.
 *
 * @returns {{breach: boolean, severity: string|null, drops: string[]}} what it cost
 */
export function applyBreach(betrayer, victim, turn) {
    const broken = relationStateBetween(betrayer, victim);
    const outcome = recordBreach({
        betrayer,
        victim,
        broken,
        turn,
        relations: relationsFor(betrayer)
    });
    if (!outcome.breach) {
        return outcome;
    }

    //NOBODY KEEPS A TREATY WITH SOMEBODY WHO HAS JUST TORN ONE UP. The drops are the heart of
    //the penalty and the reason it needs no gold figure: an alliance pays a standing share of
    //income, so losing the others is a material cost exactly proportional to what being
    //trustworthy was worth to this country.
    for (const other of outcome.drops) {
        //THE ACTOR IS THE OTHER COUNTRY, not the betrayer: this agreement is being torn up
        //BY the country that kept faith, because nobody keeps a treaty with somebody who has
        //just broken one. Naming the betrayer here would have the feed report the victim of
        //the drop as its author.
        setRelationState(betrayer, other, DiplomaticState.NEUTRAL, {
            since: turn, by: other, via: "dropped"
        });
        console.log("%c" + other + " tears up its agreement with " + betrayer +
            " -- nobody keeps a treaty with somebody who has just broken one",
            "color: rgb(208,70,59);");
    }
    console.log("%c" + betrayer + " " + outcome.reason + " -- marked treacherous until turn " +
        outcome.until, "color: rgb(208,70,59);");
    return outcome;
}

/**
 * Both sides agree to end an alliance. Free for both, and the second of the two penalty-free
 * ways out.
 *
 * It is what makes an alliance something a country can PLAN its way out of rather than only
 * betray its way out of -- and that asymmetry is what makes the breach penalty in stage 5.6
 * safe to make large, because choosing the breach instead is then a choice to be treacherous
 * rather than a choice to be free.
 */
export function dissolveAlliance(a, b, turn) {
    if (relationStateBetween(a, b) !== DiplomaticState.ALLIANCE) {
        return null;
    }
    return setRelationState(a, b, DiplomaticState.NEUTRAL, {
        since: turn, by: a, via: "dissolved"
    });
}

/**
 * Is either side besieging a territory the other holds?
 *
 * Q1's predicate, and it is about the PAIR -- so it cannot be dodged by asking from the other
 * side, which is what makes it a rule rather than a penalty on whoever laid the siege.
 * `besiegedTerritoryNames()` is every besieged territory in the world and there are never
 * many: nought to five standing across the whole map at every sample ever taken.
 */
function siegeStandsBetween(a, b) {
    for (const territoryName of besiegedTerritoryNames()) {
        const siege = siegeOn(territoryName);
        const territory = getTerritoryByName(territoryName);
        const besieger = siege?.attackingCountry ?? null;
        const besieged = territory?.dataName ?? null;
        if (!besieger || !besieged) {
            continue;
        }
        if ((besieger === a && besieged === b) || (besieger === b && besieged === a)) {
            return true;
        }
    }
    return false;
}

/** This country's leader traits, or an empty set. The table is rebuilt every turn. */
function leaderTraitsFor(country) {
    const row = getArrayOfLeadersAndCountries().find(entry => entry[0] === country);
    return row?.[1]?.traits ?? {};
}

export function calculateTurnGoals(arrayOfTerritoriesInRangeThreats, campaign = null) {
    return planTurnGoals(arrayOfTerritoriesInRangeThreats, {
        rng: aiRng,
        probabilityFor: calculateTakeProbabilityPreBattle,
        campaign,
        country: campaign?.country ?? null,
        isBesieged: isUnderSiege
    });
}

export function prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits, campaign = null) {
    return prioritiseTurnGoals(refinedTurnGoals, currentAiCountry, leaderTraits, aiRng, campaign);
}

export function musterAiArmies(country, campaign, arrayOfTerritoriesInRangeThreats) {
    if (!isAdjacencyLoaded()) {
        return [];
    }

    const territories = territoriesOwnedByCountry(country);
    const theatre = currentTheatre(country);

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

    //AN INJECTED PLAN OUTRANKS THE THEATRE FOR WHERE THE ARMY GOES, and this is the half of
    //the feature that makes a distant objective reachable at all. The corridor decides what
    //to ATTACK; without a matching answer to where to MASS, the country arrives at the front
    //of a fifteen-hop route with one province's garrison and stalls there -- which is the
    //behaviour `muster.js` was written to end in the first place.
    //
    //`staging` is the country's own territory nearest the objective, so the interior walks
    //its infantry towards it one hop a turn. It replaces the theatre's spearhead rather than
    //competing with it: `planMusters()` takes ONE, and an instruction beats a preference.
    if (campaign?.debugRoute?.staging) {
        spearhead = campaign.debugRoute.staging;
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
        if (isUnderSiege(move.from) || isUnderSiege(move.to)) {
            continue;
        }

        //Re-read against the store rather than trusting the plan. `planMusters()` is pure and
        //was handed the garrisons as they stood at the top of the muster; anything between
        //then and here -- a siege lifted, a conquest, a famine -- has to lose.
        const marching = {
            infantry: Math.min(move.infantry ?? 0, Number(from.infantryForCurrentTerritory) || 0),
            assault: Math.min(move.assault ?? 0, Number(from.useableAssault) || 0),
            air: Math.min(move.air ?? 0, Number(from.useableAir) || 0),
            naval: Math.min(move.naval ?? 0, Number(from.useableNaval) || 0)
        };
        if (forceOf(marching) <= 0) {
            continue;
        }

        //Known-issue BJ. These two used to adjust `armyForCurrentTerritory` by the same
        //delta as the infantry, which is correct arithmetic on a total that was already
        //right and simply carried an existing inconsistency forward -- a territory whose
        //stored total was below its infantry went further negative every turn it sent
        //reinforcements. Recomputing from the counts makes the muster incapable of
        //carrying an error rather than merely incapable of introducing one.
        //
        //THE VEHICLES CARRY THEIR OWN OIL BILL WITH THEM, and both halves are recomputed from
        //the counts for the same reason. `oilDemand` is a STORED field maintained
        //incrementally as units are bought, so a column of tanks that left its demand behind
        //would ground the vehicles still standing at the source and arrive somewhere that
        //believed it had oil to spare. `useableUnitsFor()` is then the game's own oil gate
        //applied to what each side now holds -- the AI has no per-turn rebuild of `useable*`
        //the way the player does, so this is the only place it gets one.
        patchTerritory(from.uniqueId, garrisonMoveFor(from, {
            infantry: (Number(from.infantryForCurrentTerritory) || 0) - marching.infantry,
            assault: (Number(from.assaultForCurrentTerritory) || 0) - marching.assault,
            air: (Number(from.airForCurrentTerritory) || 0) - marching.air,
            naval: (Number(from.navalForCurrentTerritory) || 0) - marching.naval
        }));
        patchTerritory(to.uniqueId, garrisonMoveFor(to, {
            infantry: (Number(to.infantryForCurrentTerritory) || 0) + marching.infantry,
            assault: (Number(to.assaultForCurrentTerritory) || 0) + marching.assault,
            air: (Number(to.airForCurrentTerritory) || 0) + marching.air,
            naval: (Number(to.navalForCurrentTerritory) || 0) + marching.naval
        }));
        console.log(move.reason);
    }

    if (campaign) {
        campaign.musters = moves.map(move => ({ ...move }));
    }
    return moves;
}

/**
 * A garrison patch for a territory whose unit COUNTS are changing, with the oil bill redone.
 *
 * `garrisonPatch()` alone carries the existing `useable*` figures forward, which is right when
 * only infantry moves and wrong the moment a vehicle does: the counts and the oil demand would
 * then disagree, and `useable*` is the oil gate. So the demand is recomputed from the new
 * counts and the gate re-applied, which is exactly what the income pass does for a territory
 * whose army changed for any other reason.
 */
function garrisonMoveFor(territory, counts) {
    const after = {
        ...territory,
        infantryForCurrentTerritory: Math.max(0, counts.infantry),
        assaultForCurrentTerritory: Math.max(0, counts.assault),
        airForCurrentTerritory: Math.max(0, counts.air),
        navalForCurrentTerritory: Math.max(0, counts.naval)
    };
    after.oilDemand = oilDemandFor(after);
    const gated = useableUnitsFor(after);

    return {
        ...garrisonPatch(territory, {
            infantry: after.infantryForCurrentTerritory,
            assault: after.assaultForCurrentTerritory,
            air: after.airForCurrentTerritory,
            naval: after.navalForCurrentTerritory,
            useable: {
                assault: gated.useableAssault,
                air: gated.useableAir,
                naval: gated.useableNaval
            }
        }),
        oilDemand: after.oilDemand
    };
}

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

    if (campaign) {
        campaign.siegeReviews = reviews;
    }
    return reviews;
}

function assaultOddsFromSiege(siege, target, source) {
    const army = siege?.attackingArmyRemaining ?? [];
    const infantry = Number(army[0]) || 0;
    const assault = Number(army[1]) || 0;
    const air = Number(army[2]) || 0;
    const naval = Number(army[3]) || 0;

    if (!source || infantry + assault + air + naval <= 0) {
        return 0;
    }

    return calculateTakeProbabilityPreBattle(
        [target.uniqueId, parseInt(source.uniqueId), infantry, assault, air, naval],
        allTerritories(),
        false);
}

function stormBesiegedTerritory(siege, target, source, review, campaign) {
    const armyArray = [...(siege.attackingArmyRemaining ?? [0, 0, 0, 0])];
    const sourceCopy = { ...source };
    const targetCopy = { ...target };
    const defendingCountry = target.dataName;
    const playerDefending = target.owner === "Player";

    const battleResult = doAttack(armyArray, sourceCopy, targetCopy, review.assaultOdds, false);
    const remainingArmyArray = recombineRemainingArmyAfterBattle(armyArray, battleResult, targetCopy);
    const won = remainingArmyArray[4] === 0;

    console.log("ASSAULT out of the siege of " + target.territoryName + ": " +
        (won ? "the walls are taken" : "thrown back, the besieging army is spent"));

    endAiSiege(siege, target, won ? "Victory" : "Defeat");
    releaseSiegeSlot(campaign);
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
    recordSiegeAbandoned({
        territory: target.territoryName,
        defender: target.dataName,
        attacker: siege.attackingCountry,
        playerAttacking: false,
        playerDefending: target.owner === "Player"
    });
}

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
        const goalHasATarget = goal[1] === "Siege" || goal[1] === "Attack";

        for (let i = 0; i < allTerritories().length; i++) {
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
                if (mainArrayFriendlyTerritoryCopy && mainArrayEnemyTerritoryCopy) {
                    break;
                }
            }
        }

        if (!mainArrayFriendlyTerritoryCopy || (goalHasATarget && !mainArrayEnemyTerritoryCopy)) {
            console.log("Skipping goal " + goal[1] + " -- its territory is not in the game array");
            continue;
        }

        //A besieged territory does nothing this turn -- which is what the line below has said
        //since it was written, and it only half meant it: `getSiegeObjectFromAiSiegeList()`
        //looks in the AI's siege list ALONE, so a territory besieged by the PLAYER went on
        //upgrading, building forts and launching attacks out of the siege as though nothing had
        //happened. `isUnderSiege()` answers for both lists.
        //
        //This is also the AI half of `SIEGE_SUSPENDS_CONSTRUCTION` (known-issue BQ): the
        //Economy and Bolster goals are the only routes the AI has to an upgrade or a fort, and
        //both are below this guard.
        if (isUnderSiege(mainArrayFriendlyTerritoryCopy.territoryName)) {
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
                let switched = false;
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
                //ATTACKS PER TERRITORY, not one. This read `if (!attackLaunchedFromArray
                //.includes(goal[3]))` with the comment "only one attack from any territory
                //per turn" -- a rule the PLAYER has never been subject to. A province
                //bordering three weak enemies took one of them a turn however much army it
                //had left standing, so a breakthrough could not be exploited in the turn it
                //was made.
                //
                //Nothing is rationed in advance. The second attack is sized against what the
                //territory has left AFTER the first, because `mainArrayFriendlyTerritoryCopy`
                //is the goal's working set and `doAttack()` debits it -- so
                //`decideCommitment()` re-reads a smaller army and the ODDS FLOOR is what
                //actually stops the second and third. Splitting the garrison up front would
                //be strictly worse: the battle is a step function, so two attacks at 0.175:1
                //are 0% and 0% where one at 1.5:1 is 77%.
                //AND NEVER THE SAME TARGET TWICE. `attackLaunchedToArray` was written and
                //never read -- dead, because the one-attack-per-source rule above happened to
                //make a repeat impossible. Lifting that rule makes this load-bearing: a won
                //attack hands the territory to the attacker, so a second attack on it would be
                //an attack on the country's own province.
                const attacksAllowedFromHere = campaign?.attacksPerTerritory ?? 1;
                const attacksAlreadyFromHere = attackLaunchedFromArray
                    .filter(name => name === goal[3]).length;
                if (attacksAlreadyFromHere < attacksAllowedFromHere
                    && !attackLaunchedToArray.includes(goal[2])) {
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
                            recordAttackOutcome(
                                mainArrayFriendlyTerritoryCopy.dataName,
                                mainArrayEnemyTerritoryCopy.territoryName,
                                remainingArmyArray[4] === 0,
                                currentTurn(),
                                mainArrayEnemyTerritoryCopy.dataName);
                            if (remainingArmyArray[4] === 0) {
                                mainArrayEnemyTerritoryCopy = updateTerritory(mainArrayEnemyTerritoryCopy, remainingArmyArray, mainArrayFriendlyTerritoryCopy);
                            } else {
                                summaryWarsLostArray.push(mainArrayEnemyTerritoryCopy.territoryName + " resisted attack from " + mainArrayFriendlyTerritoryCopy.dataName);
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
        if (i > goalIndex) {
            switch (resource) {
                case "gold":
                    if (refinedTurnGoals[i][1] === "Economy" || refinedTurnGoals[i][1] === "Bolster") {
                        count++;
                    }
                    break;
                case "consMats":
                    if (refinedTurnGoals[i][1] === "Economy") {
                        count++;
                    }
                    break;
            }
        }
    }
    return count;
}

function meanInfantryDeficitForBolsterGoal(goal) {
    return Math.floor(goal[6] / goal[0]) - goal[4];
}

function dropBolsterGoalsNeedingNoInfantry(refinedTurnGoals, goalIndex) {
    return refinedTurnGoals.filter((goal, i) => {
        if (i <= goalIndex || goal[1] !== "Bolster") {
            return true;
        }
        return !(meanInfantryDeficitForBolsterGoal(goal) < 0);
    });
}

function determineResourcesAvailableForThisGoal(resource, amountOfResourceCurrentlyInTerritory, mainArrayFriendlyTerritoryCopy, numberOfGoalsNeedingResourceAfterThisOne, refinedTurnGoals, goalIndex) {
    let resourcesAvailable;
    let count = 0;

    if (numberOfGoalsNeedingResourceAfterThisOne !== 0) {
        let goals = refinedTurnGoals;
        let proportionsPercentageArray = [];
        let everyBolsterIsANegativeThreat = false;

        const hasLaterBolsterGoal = resource === "gold" &&
            goals.some((goal, i) => i > goalIndex && goal[1] === "Bolster");

        if (hasLaterBolsterGoal) {
            goals = dropBolsterGoalsNeedingNoInfantry(goals, goalIndex);

            const deficits = goals
                .filter(goal => goal[1] === "Bolster")
                .map(goal => [goal, meanInfantryDeficitForBolsterGoal(goal)])
                .filter(entry => Number.isFinite(entry[1]));

            const sumOfValues = deficits.reduce((sum, entry) => sum + entry[1], 0);

            if (sumOfValues !== 0) {
                proportionsPercentageArray = deficits.map(entry => [entry[0], (entry[1] / sumOfValues) * 100]);
            } else {
                everyBolsterIsANegativeThreat = true;
                console.log("any bolsters for this territory will receive just what is left over after economy as they are a negative mean threat level");
            }
        }

        for (let i = 0; i < goals.length; i++) {
            if (i <= goalIndex) {
                continue;
            }
            if (resource === "gold") {
                if (goals[i][1] === "Bolster") {
                    if (everyBolsterIsANegativeThreat) {
                        count++;
                    } else {
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
        resourcesAvailable = Math.floor(amountOfResourceCurrentlyInTerritory / Math.max(1, count));
    } else {
        resourcesAvailable = Math.floor(amountOfResourceCurrentlyInTerritory);
    }
    return [refinedTurnGoals, resourcesAvailable];
}

function upgradeAllowanceFor(campaign) {
    return Math.max(1, Math.ceil(MAX_AI_UPGRADES_PER_TURN * (campaign?.upgradeScale ?? 1)));
}

function analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild(territory, goldToSpend, consMatsToSpend, maxUpgrades = MAX_AI_UPGRADES_PER_TURN) {
    let couldNotAffordEconomy = false;

    let buildList = [];
    //ONE TRANSACTION, PRICED THE WAY THE PLAYER'S IS -- known-issue E8.
    //
    //A player's order of five farms costs `price(5)`, the price of the LAST one, and not the
    //sum of the ladder. This loop buys one at a time so that it can re-score the territory
    //after each purchase, and it used to be charged `price(built + 1)` on every pass -- the
    //full ladder, about 2.2x what the player pays for the same five buildings. The decision
    //taken on E8 was that the bulk discount is a real decision worth keeping (save up and buy
    //several at once) and that the fault was that only one side could take it.
    //
    //So the loop is unchanged and the CHARGE is what moved: `nextInOrderPriceFor()` returns
    //what adding one more to the order costs, and those marginals telescope to the order
    //price exactly. `builtBeforeOrder` is the count this transaction started at, which is
    //what the order is priced against -- reading `territory.farmsBuilt` inside the loop would
    //restart the ladder after every purchase, which is the behaviour being replaced.
    const builtBeforeOrder = {
        farm: Number(territory.farmsBuilt) || 0,
        forest: Number(territory.forestsBuilt) || 0,
        oilWell: Number(territory.oilWellsBuilt) || 0
    };
    const orderedSoFar = { farm: 0, forest: 0, oilWell: 0 };
    const nextPriceFor = (kind) => nextInOrderPriceFor(
        kind, builtBeforeOrder[kind], orderedSoFar[kind], territory.devIndex);

    let availableUpgrades = calculateAvailableUpgrades(territory);
    let farm = availableUpgrades[0];
    let forest = availableUpgrades[1];
    let oilWell = availableUpgrades[2];
    let buildAgain = aiRng() > 0.5;

    let points = {
        farm: {},
        forest: {},
        oilWell: {}
    };

    if (farm.goldCost > goldToSpend && forest.goldCost > goldToSpend && oilWell.goldCost > goldToSpend) {
        couldNotAffordEconomy = true;
    }
    console.log("GOLD cost: Farm: " + farm.goldCost + " Forest: " + forest.goldCost + " OilWell: " + oilWell.goldCost);
    console.log("CONSMATS cost: Farm: " + farm.consMatsCost + " Forest: " + forest.consMatsCost + " OilWell: " + oilWell.consMatsCost);
    while (buildAgain && (farm.goldCost <= goldToSpend && farm.consMatsCost < consMatsToSpend) || (forest.goldCost <= goldToSpend && forest.consMatsCost < consMatsToSpend) || (oilWell.goldCost <= goldToSpend && oilWell.consMatsCost < consMatsToSpend)) {
        let farm = availableUpgrades[0];
        let forest = availableUpgrades[1];
        let oilWell = availableUpgrades[2];
        const capacityBonus = continentCapacityBonusFor(territory);
        const effectiveFoodCap = effectiveCapacityFor(territory, "food", capacityBonus);
        const effectiveConsMatsCap = effectiveCapacityFor(territory, "consMats", capacityBonus);
        const effectiveOilCap = effectiveCapacityFor(territory, "oil", capacityBonus);

        const farmPrice = nextPriceFor("farm");
        const forestPrice = nextPriceFor("forest");
        const oilWellPrice = nextPriceFor("oilWell");

        if (territory.farmsBuilt < maxFarms && farmPrice.gold <= goldToSpend && farmPrice.consMats <= consMatsToSpend) {
            points.farm.value = aiRng() * 10 + 1;
            if (territory.foodConsumption > effectiveFoodCap) {
                points.farm.value += 10;
            } else if (territory.foodConsumption <= effectiveFoodCap) {
                points.farm.value += 5;
            }
        }
        if (territory.forestsBuilt < maxForests && forestPrice.gold <= goldToSpend && forestPrice.consMats <= consMatsToSpend) {
            points.forest.value = aiRng() * 10 + 1;
            if (effectiveConsMatsCap < territory.consMatsForCurrentTerritory) {
                points.forest.value += 10
            } else if (effectiveConsMatsCap >= territory.consMatsForCurrentTerritory) {
                points.forest.value += 5
            }
        }
        if (territory.oilWellsBuilt < maxOilWells && oilWellPrice.gold <= goldToSpend && oilWellPrice.consMats <= consMatsToSpend) {
            points.oilWell.value = aiRng() * 10 + 1;
            if (territory.oilDemand > effectiveOilCap) {
                points.oilWell.value += 10;
            } else if (territory.oilDemand <= effectiveOilCap) {
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
            } else if (largestDesire[0] === "oilWell") {
                selectedUpgrade = oilWell;
            }

            //Charged at what one more costs THIS ORDER, not at the next rung of the ladder.
            const price = nextPriceFor(largestDesire[0]);
            buildList.push([largestDesire[0], selectedUpgrade]);
            orderedSoFar[largestDesire[0]] += 1;
            goldToSpend -= price.gold;
            consMatsToSpend -= price.consMats;
            territory.goldForCurrentTerritory -= price.gold;
            territory.consMatsForCurrentTerritory -= price.consMats;
            Object.assign(territory, applyUpgrade(territory, largestDesire[0], 1));
            availableUpgrades = calculateAvailableUpgrades(territory);

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
    let fortDesire = aiRng() > 0.5;
    let fortBuildCount = 0;

    //Priced as ONE ORDER, the same as the player's -- known-issue E8. See the long note in
    //`analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild()`: forts are on the same
    //quadratic ladder and the same transaction rule, so a fort loop charging
    //`price(built + 1)` every pass paid about 2.2x for four forts what a player pays for four
    //in one order.
    const fortsBeforeOrder = Number(territory.fortsBuilt) || 0;

    while (territory.fortsBuilt < maxForts && fortDesire) {
        const price = nextInOrderPriceFor(
            "fort", fortsBeforeOrder, fortBuildCount, territory.devIndex);
        if (price.gold >= goldToSpend || price.consMats >= consMatsToSpend) {
            break;
        }
        fortBuildCount++;
        goldToSpend -= price.gold;
        consMatsToSpend -= price.consMats;
        territory.goldForCurrentTerritory -= price.gold;
        territory.consMatsForCurrentTerritory -= price.consMats;
        Object.assign(territory, applyUpgrade(territory, "fort", 1));
        fortDesire = aiRng() > 0.5;
    }

    if (fortBuildCount > 0) {
        console.log("Built " + fortBuildCount + " forts on this territory this turn!");
    } else if (fortDesire && territory.fortsBuilt < maxForts) {
        console.log("Wanted to build fort but couldn't due to resources!");
        goldToSpend /= 2;
    } else if (fortDesire) {
        console.log("Didn't want to build a fort!");
    }
    console.log("Territory has " + territory.fortsBuilt + " forts now");

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

    if (goldToSpend >= armyGoldPrices.infantry * 10) {
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

        const territoryOilCap = effectiveCapacityFor(
            territory, "oil", continentCapacityBonusFor(territory));
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

        territory.oilDemand = territoryOilCap - territorySpareOil;

        finalInfantryProdPop = (goldToSpend / armyGoldPrices.infantry) * INFANTRY_IN_A_TROOP;
        if (prodPopToSpend >= finalInfantryProdPop) {
            territory.goldForCurrentTerritory -= goldToSpend;
            territory.productiveTerritoryPop -= finalInfantryProdPop;
            territory.infantryForCurrentTerritory += finalInfantryProdPop;
        } else {
            finalInfantryProdPop = 0;
        }
    } else {
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
}

function calculateArmyQuantityBeingSentOrIfCancellingInteraction(leader, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, arrayOfTerritoriesInRangeThreats, siege, campaign = null) {
    if (aiSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName) ||
        playerSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName)) {
        console.log("Can't siege or attack because territory already under siege!");
        return "Cancel";
    }

    //The target is excluded: a reserve held against the territory being assaulted is that
    //fight paid for twice, and because this is a MAXIMUM it let one strong neighbour freeze a
    //country against every other neighbour it had. See `strongestEnemyPowerAgainst()`.
    const localEnemyPower = strongestEnemyPowerAgainst(
        mainArrayFriendlyTerritoryCopy.territoryName, arrayOfTerritoriesInRangeThreats,
        mainArrayEnemyTerritoryCopy.territoryName);

    const oddsFor = (amount) => {
        const makeup = calculateArmyMakeupOfAttack(
            mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, amount);
        return calculateTakeProbabilityPreBattle(
            [mainArrayEnemyTerritoryCopy.uniqueId, parseInt(mainArrayFriendlyTerritoryCopy.uniqueId),
                makeup[0], makeup[1], makeup[2], makeup[3]],
            allTerritories(), false);
    };

    const floor = siege
        ? siegeFloorFor(leader.leaderType)
        : (campaign?.attackOddsFloor ?? 34);
    const aim = siege
        ? (campaign?.siegeOddsFloor ?? PROBABILITY_THRESHOLD_FOR_SIEGE)
        : undefined;

    //AN INJECTED DEBUG PLAN, if this is its objective or a step on the route to it. It is
    //read off the campaign -- `strategy.js` is the one place a plan enters the AI -- and
    //turned into the dials `commitment.js` understands, which is what lets that module stay
    //pure and know nothing about the debug window. Null on every ordinary decision.
    //
    //It goes through `debugPlanReach()` like the other three call sites, and that agreement
    //is load-bearing: a commitment that tested for the final target alone would size an
    //ordinary attack for the corridor step the planner had just ranked first, and the country
    //would rank the plan and then decline to fight for it.
    const push = debugPlanReach(campaign, mainArrayEnemyTerritoryCopy)
        ? debugPlanPush(campaign.debugPlan)
        : null;

    const decision = decideCommitment({
        army: mainArrayFriendlyTerritoryCopy.armyForCurrentTerritory,
        localEnemyPower,
        leaderType: leader.leaderType,
        traits: leader.traits,
        floor,
        aimAt: aim,
        pressOnBelowAim: siege ||
            campaign?.theatre?.rival === mainArrayEnemyTerritoryCopy.dataName,
        push,
        oddsFor,
        targetName: mainArrayEnemyTerritoryCopy.territoryName
    });

    console.log(decision.reason);
    if (!decision.commit) {
        //KNOWN-ISSUE C4. A `below-floor` cancellation used to call `recordAttackOutcome(...,
        //false, ...)` here, which charges `SETBACK_ODDS_PENALTY` -- twelve points on both odds
        //floors, compounding per occurrence -- against a target for a battle THAT WAS NEVER
        //FOUGHT. Three of those and the border is off the table for the rest of the game.
        //
        //It was defensible in intent: `commitment.js` deliberately distinguishes `no-force` (a
        //fact about this turn, never remembered) from `below-floor` (a fact about the two
        //armies, worth remembering), and that distinction is right. What made it a defect is
        //that the floors were denominated in `winProbability()`, so `below-floor` fired on most
        //borders in the world for arithmetic reasons: at turn 25 168 pairings were already being
        //refused for "lost here N time(s) already" against 187 verdicts that got through.
        //
        //A setback is now recorded only where one was actually suffered -- `doAttack()`'s losing
        //branch. The reinforcement demand below is kept, because "this border needs troops" is
        //the useful half of the signal and it costs the target nothing.
        if (decision.reasonCode === "needs-more-force" || decision.reasonCode === "below-floor") {
            recordReinforcementDemand(
                mainArrayFriendlyTerritoryCopy.dataName,
                mainArrayFriendlyTerritoryCopy.territoryName,
                decision.shortfall ?? 0,
                currentTurn());
        }
        return "Cancel";
    }

    //THE DEMAND DIES WHEN THE ATTACK HAPPENS, NOT WHEN THE FIRST REINFORCEMENT ARRIVES.
    //`musterAiArmies()` used to clear it on delivery, which was defensible while the pull
    //reached one hop -- there was nothing behind the neighbour that answered, so the request
    //had got everything it was ever going to get. With a relay behind it that cuts the
    //corridor off after a single turn: a border sixty points short receives one neighbour's
    //surplus, stops asking, and the three provinces marching up behind it are told the war
    //is over. It is the launch that settles the request, because that is the moment the
    //force was actually enough.
    clearReinforcementDemand(
        mainArrayFriendlyTerritoryCopy.dataName,
        mainArrayFriendlyTerritoryCopy.territoryName);

    return [decision.amount, decision.odds];
}

function siegeFloorFor(leaderType) {
    return PROBABILITY_THRESHOLD_FOR_SIEGE +
        (siegeDiscipline.leaderOddsModifier[leaderType] ?? siegeDiscipline.leaderOddsModifier.balanced);
}

/**
 * The army power of the strongest enemy territory that can reach `territoryName`.
 *
 * `exceptTerritory` is the target of the attack being weighed, and excluding it is a fix
 * rather than a refinement. The reserve this figure sizes is what the territory keeps back
 * to defend itself -- but holding a reserve against the very territory you are about to
 * assault is paying for that fight twice, and the effect compounded badly because the figure
 * is a MAXIMUM over every reachable enemy: a country bordering one powerful neighbour kept a
 * garrison sized against that neighbour on every one of its borders, and so could not attack
 * anybody at all, including neighbours a fraction of its own strength. That is the
 * "when that area stalls too it is blocked from advancing altogether" the AI log shows.
 *
 * The reserve against every OTHER neighbour is still kept in full: attacking one front does
 * not make the others safe, and that is exactly why this excludes one territory rather than
 * lowering the figure for everybody.
 */
function strongestEnemyPowerAgainst(territoryName, arrayOfTerritoriesInRangeThreats, exceptTerritory = null) {
    let strongest = 0;
    for (const row of arrayOfTerritoriesInRangeThreats ?? []) {
        if (exceptTerritory !== null && row[0] === exceptTerritory) {
            continue;
        }
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

function doAttack(armyArray, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, probability, debitSource = true) {
    //Known-issue BJ. THE ARMY IS DEBITED FROM THE COPY, NOT FROM THE STORE, and that is the
    //whole of what made an AI attack free.
    //
    //This loop used to walk `allTerritories()` and subtract the seven unit counts from the real
    //territory -- and then `doAiActions()` ended the goal with
    //`patchTerritory(friendlyTerritory.uniqueId, mainArrayFriendlyTerritoryCopy)`, writing the
    //copy taken BEFORE the attack back over every field it had just debited. Measured on seed
    //"goals": the United States sent 131,388 infantry and 36 vehicles, the store fell from
    //5,817,692 to 5,374,304, and it was 5,817,692 again by the end of the turn. Win or lose, the
    //force never left. A won attack then garrisoned the conquered territory with the survivors
    //on top of that, so attacking CREATED army.
    //
    //It had no textual signature: nothing threw, the battle was resolved correctly against the
    //force that was sent, the odds were right, and the only witness was the source territory's
    //garrison not going down. `setSiege()` had it right all along -- the copy is the working
    //set for a goal and the patch-back is what commits it -- so this now does the same thing,
    //and it is one debit rather than two that have to agree.
    if (debitSource) {
        const before = garrisonOf(mainArrayFriendlyTerritoryCopy);
        writeGarrison(mainArrayFriendlyTerritoryCopy, {
            infantry: before.infantry - armyArray[0],
            assault: before.assault - armyArray[1],
            air: before.air - armyArray[2],
            naval: before.naval - armyArray[3],
            useable: {
                assault: before.useable.assault - armyArray[1],
                air: before.useable.air - armyArray[2],
                naval: before.useable.naval - armyArray[3]
            }
        });
    }

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
            attackingDevelopmentIndex: parseFloat(mainArrayFriendlyTerritoryCopy.devIndex),
            combatContinentModifier: combatContinentModifierFor(mainArrayEnemyTerritoryCopy)
        }
    }, aiRng);
    if (mainArrayEnemyTerritoryCopy.owner === "Player") {
        recordDefence({
            attackerCountry: mainArrayFriendlyTerritoryCopy.dataName,
            attackerColour: mainArrayFriendlyTerritoryCopy.countryColor,
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

    let attackOrDefend;

    let assaultAddCount = 0;
    let airAddCount = 0;
    let navalAddCount = 0;

    let remainderArray = [];
    let defenderArmyArray = [mainArrayEnemyTerritoryCopy.infantryForCurrentTerritory, mainArrayEnemyTerritoryCopy.useableAssault, mainArrayEnemyTerritoryCopy.useableAir, mainArrayEnemyTerritoryCopy.useableNaval];

    if (battleResult[0] > 0) {
        percentageLeftOver = (battleResult[0] / totalStartingAttackArmy) * 100;
        attackOrDefend = 0;
    } else if (battleResult[1] > 0) {
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
                    armyArray[1]--;
                }
                break;
            case 2:
                if (airAddCount < armyArrayStart[2]) {
                    airAddCount++
                    armyArray[2]--;
                }
                break;
            case 3:
                if (navalAddCount < armyArrayStart[3]) {
                    navalAddCount++
                    armyArray[3]--;
                }
                break;
        }
    }

    //Known-issue BJ. This read `(armyArray[0] + armyArray[1] + armyArray[2] + armyArray[3]) -
    //totalAllocated`, and by the time it ran the while loop above had already emptied slots 1-3
    //into the three add-counts -- so it was `survivingInfantry - (the personnel worth of the
    //surviving VEHICLES)`. Every element of `armyArray` was scaled by the same survival
    //fraction a few lines up, which is what keeps the total honest; subtracting the vehicles
    //from the infantry as well charged for them twice, and any survivor mix with more vehicle
    //force than infantry came out NEGATIVE. That negative was written straight onto the
    //conquered territory and then compounded by every later muster.
    let infantryCount = Math.max(0, armyArray[0]);
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
    //Known-issue BJ. This wrote the four counts and nothing else, so a conquered territory kept
    //the LOSER's `useableAssault` / `useableAir` / `useableNaval` and the loser's
    //`armyForCurrentTerritory`. The occupying force is a handful of survivors; the useable
    //figures it inherited could be an order of magnitude larger, and `calculateArmyMakeupOfAttack()`
    //allocates from `useable*`. So the next attack out of a freshly taken territory could send
    //vehicles that were never there, and `doAttack()` then debited them from counts that could
    //not cover it. The army that marches in is the army that is here: every vehicle in it is
    //present, so `useable*` is the count.
    writeGarrison(territory, {
        infantry: remainingArmyArray[0],
        assault: remainingArmyArray[1],
        air: remainingArmyArray[2],
        naval: remainingArmyArray[3]
    });
    //The oil bill goes with the fleet. Left at the previous owner's demand, a territory taken
    //from a naval power would ground the occupier's vehicles for reasons that left with the
    //defeated garrison.
    territory.oilDemand = (territory.assaultForCurrentTerritory * oilRequirements.assault) +
        (territory.airForCurrentTerritory * oilRequirements.air) +
        (territory.navalForCurrentTerritory * oilRequirements.naval);
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
        returnArmyData = removeSiegeAndReturnPlayerArmy(defender);
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
        let playerDecision = await openUIAndOfferGoldToPlayer(goldToOffer, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy)
        if (playerDecision === 1) {
            removeGoldFromAi(goldToOffer, mainArrayFriendlyTerritoryCopy);
            addGoldToPlayer(goldToOffer);
            removeSiegeAndReturnPlayerArmy(mainArrayEnemyTerritoryCopy);
            addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
        } else {
            return false;
        }
    }
    return !territoryAlreadyUnderAiSiege;
}

function setSiege(armyArray, mainArrayFriendlyTerritoryCopy, mainArrayEnemyTerritoryCopy, probability, leader) {
    if (probability >= siegeFloorFor(leader.leaderType)) {
        if (playerSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName) || aiSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName)) {
            return;
        }
        setCurrentAiWarId(getNextAiWarId());
        let currentAiWarId = getCurrentAiWarId();
        setNextAiWarId(currentAiWarId + 1);

        const attackingTerritory = getTerritory(mainArrayFriendlyTerritoryCopy.uniqueId);
        {
            if (attackingTerritory) {
                //Known-issue BJ. The two debits below were written out by hand and the store
                //half was missing `airForCurrentTerritory -= armyArray[2]` -- the copy had it,
                //the real territory did not. So a besieging force's aircraft left `useableAir`
                //and stayed in `airForCurrentTerritory`, and the two disagreed by a little more
                //with every siege the country laid. Both halves go through the same function
                //now, which is the only way "the copy and the store were debited identically"
                //stops being a thing to check by eye.
                const debit = (target) => {
                    const before = garrisonOf(target);
                    writeGarrison(target, {
                        infantry: before.infantry - armyArray[0],
                        assault: before.assault - armyArray[1],
                        air: before.air - armyArray[2],
                        naval: before.naval - armyArray[3],
                        useable: {
                            assault: before.useable.assault - armyArray[1],
                            air: before.useable.air - armyArray[2],
                            naval: before.useable.naval - armyArray[3]
                        }
                    });
                };
                debit(attackingTerritory);
                debit(mainArrayFriendlyTerritoryCopy);

                console.log(mainArrayFriendlyTerritoryCopy.territoryName + " had its army adjusted ready for siege");
            }
        }
        let currentWarAlreadyInSiegeMode = false;

        if (playerSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName) || aiSiegeWarsList.hasOwnProperty(mainArrayEnemyTerritoryCopy.territoryName)) {
            currentWarAlreadyInSiegeMode = true;
        }
        const siegeTargetPath = getPathByUniqueId(mainArrayEnemyTerritoryCopy.uniqueId);
        if (siegeTargetPath && !currentWarAlreadyInSiegeMode) {
            addRemoveWarSiegeObjectAi(0, currentAiWarId, mainArrayEnemyTerritoryCopy, mainArrayFriendlyTerritoryCopy);
            console.log("Should now be an image over the territory of " + siegeTargetPath.getAttribute("territory-name"));
        }
    }
}