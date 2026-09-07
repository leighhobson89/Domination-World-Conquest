import {
    uiAppearsAtStartOfTurn,
    toggleUIMenu,
    endPlayerTurn,
    initialiseNewPlayerTurn,
    toggleTransferAttackButton,
    paths,
    svg,
    setColorOnMap,
    showQueuedDefences,
    refreshGoalLine,
    strongestCountries
} from './ui.js';
import {
    pendingDefences,
    recordDefence
} from './src/state/battlePlayback.js';
import {
    defenderPlayback
} from './src/ui/battle/DefenderPlayback.js';
import {
    setZoomLevel,
    zoomMap
} from './src/ui/map/camera.js';
import {
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable,
    getPlayerTerritories,
    getPathAreaComputations,
    newTurnResources,
    totalPlayerResources,
    drawUITable,
    calculateTerritoryStrengths,
    countryStrengthsArray,
    getCountryResourceTotals,
    turnGainsArrayLastTurn,
    getTurnGainsArrayAi,
    derivedEconomyFor,
    calculateAvailableUpgrades
} from './resourceCalculations.js';
import { currentContinentControl } from './src/state/continentBonus.js';
import {
    activateAllPlayerTerritoriesForNewTurn,
    incrementSiegeTurns,
    calculatePlayerInitiatedSiegePerTurn,
    handleEndSiegeDueArrest,
    getRetrievalArray, activateAiTerritoriesForNewTurn, calculateAiInitiatedSiegePerTurn,
    getAttackingArmyRemaining, getDefendingArmyRemaining, getCurrentRound, getCurrentWarId,
    getUpdatedProbability
} from './battle.js';
import {
    getArrayOfLeadersAndCountries,
    replaceLeaderForCountry,
    updateArrayOfLeadersAndCountries
} from "./cpuPlayerGenerationAndLoading.js";
import { isSuccessionTurn } from "./src/ai/succession.js";
import { clearPlansFor } from "./src/ai/strategy.js";
import {
    createTurnEngine
} from "./src/engine/TurnEngine.js";
import {
    rollRandomEventLikelihood,
    selectRandomEvent
} from "./src/rules/events/randomEvents.js";
import {
    RANDOM_EVENTS
} from "./src/config/balance.js";
import {
    activeVictoryCondition,
    buildAttackableTerritoriesInRangeArray,
    buildFullTerritoriesInRangeArray,
    calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory,
    calculateTurnGoals,
    musterAiArmies,
    planAiCampaign,
    reviewAiSieges,
    convertAttackableArrayStringsToMainArrayObjects,
    doAiActions,
    getFriendlyTerritoriesDefenseScores,
    prioritiseTurnGoalsBasedOnPersonality,
    refineTurnGoals,
    resetAiRngContext,
    setAiRngContext,
    setVictoryCondition,
    victoryProgress
} from "./aiCalculations.js";
import {
    loadAdjacency,
    getInteractableFrom,
    adjacencyIds
} from "./src/data/adjacency.js";
import {
    manualAdjacencyExceptions
} from "./src/data/manualAdjacencyExceptions.js";
import {
    getGuardViolations
} from "./src/state/GameState.js";
import {
    applyScenario
} from "./src/platform/scenarios.js";
import {
    referenceDefendingTerritory
} from "./src/state/sieges.js";
import {
    emit,
    Events,
    on
} from "./src/state/events.js";
import {
    conditionFor
} from "./src/ui/goals/goalCatalogue.js";
import {
    checkForVictory
} from "./src/rules/victoryCheck.js";
import {
    facesShowing
} from './dices.js';
import {
    installTestHooks,
    installAdjacencyTestHooks,
    signalReady
} from "./src/platform/testHooks.js";
import {
    allTerritories,
    getTerritory,
    playerCountryName,
    playerColour,
    getTerritoryByName,
    territoriesWithOwner,
    currentPhase,
    currentTurn,
    playerSieges,
    aiSieges,
    historicWarsList,
    warIds,
    greyedOutCountryNames,
    siegeOn
} from './src/state/selectors.js';
import {
    advanceTurn,
    setTerritoryOwner,
    pruneSiegesForMissingTerritories,
    updateTerritory,
    addSiege,
    setNextWarId,
    setNextAiWarId
} from './src/state/mutations.js';
import {
    Phase,
    phaseName
} from './src/state/phases.js';
import {
    renderAllTerritories
} from './src/ui/mapAttributeSync.js';
import {
    registerSaveSlice
} from './src/platform/saveSlices.js';
import {
    activityTurns,
    captureActivityLog,
    clearActivityLog,
    recordActivity,
    restoreActivityLog
} from './src/state/activityLog.js';
import {
    installActivityRecorder,
    recordOngoingSieges
} from './src/state/activityRecorder.js';
import {
    activityPanel
} from './src/ui/components/ActivityPanel.js';
import {
    logAiPlan
} from './src/ai/planLog.js';
import {
    recentPlans
} from './src/ai/planRecord.js';
import {
    pathCountry
} from './src/state/pathState.js';
import {
    ids
} from './src/ui/core/registry.js';
import {
    moveButton
} from './src/ui/components/MoveButton.js';
import {
    isAiGameActive
} from './src/debug/aiGameMode.js';
import {
    beginAiGameCountry,
    endAiGameCountry
} from './src/debug/aiGameWatch.js';
import {
    aiGameConsole
} from './src/ui/components/AiGameConsole.js';
import {
    currentTakeOdds
} from './transferAndAttack.js';

installTestHooks({
    turn: () => currentTurn(),
    phase: () => currentPhase(),
    activity: () => activityTurns(),
    recordActivity: (entry) => recordActivity(entry),
    territory: (nameOrId) => getTerritoryByName(String(nameOrId)) ?? getTerritory(nameOrId),
    territoriesOwnedBy: (owner) => territoriesWithOwner(owner),
    totals: () => {
        const totals = totalPlayerResources[0];
        return totals ? {
            gold: totals.totalGold,
            oil: totals.totalOil,
            food: totals.totalFood,
            consMats: totals.totalConsMats,
            pop: totals.totalPop,
            prodPop: totals.totalProdPop,
            area: totals.totalArea,
            army: totals.totalArmy
        } : null;
    },
    sieges: () => ({
        player: Object.keys(playerSieges()),
        ai: Object.keys(aiSieges())
    }),
    siegeAt: (territoryName) => {
        const side = playerSieges()[territoryName] ? "player"
            : aiSieges()[territoryName] ? "ai" : null;
        const siege = siegeOn(territoryName);
        return siege ? { siege, side } : null;
    },
    stateGuardViolations: () => getGuardViolations().map(violation => ({
        territory: violation.territory,
        field: violation.field
    })),
    victoryCondition: () => activeVictoryCondition(),
    setGoal: (kind, scale) => setVictoryCondition(
        conditionFor(kind, scale, { greatPowers: strongestCountries() })),
    victoryProgressFor: (country) => victoryProgress(country ?? playerCountryName()),
    continents: () => [...currentContinentControl().values()].map(row => {
        const holders = [...row.held.entries()]
            .map(([owner, holding]) => ({ owner, count: holding.count }))
            .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner));
        return {
            continent: row.continent,
            total: row.total,
            heldOutrightBy: holders[0]?.count === row.total ? holders[0].owner : null,
            holders: holders.slice(0, 4)
        };
    }),
    economyFor: (nameOrId) => derivedEconomyFor(
        getTerritoryByName(String(nameOrId)) ?? getTerritory(nameOrId)),
    //What the upgrade window would offer for a territory, WITHOUT opening it. `condition` is
    //not a label -- every plus button in that window is enabled on `condition === "Can Build"`
    //and nothing else -- and the rule a spec most needs to check is one the window cannot be
    //opened to see: a besieged territory builds nothing (known-issue BQ), and the territory
    //under siege in a test is usually the enemy's, whose upgrade window the player has no
    //route to at all.
    availableUpgrades: (nameOrId) => calculateAvailableUpgrades(
        getTerritoryByName(String(nameOrId)) ?? getTerritory(nameOrId)),
    applyScenario: (scenario) => applyScenario(scenario, {
        getTerritoryByName,
        updateTerritory,
        addSiege,
        referenceDefendingTerritory,
        nextWarId: (side) => {
            if (side === "player") {
                const id = warIds().nextWarId;
                setNextWarId(id + 1);
                return id;
            }
            const id = warIds().nextAiWarId;
            setNextAiWarId(id + 1);
            return id;
        }
    }),
    retrievals: () => getRetrievalArray().map(entry => ({
        warId: entry[0],
        sourceTerritoryIds: (entry[1]?.[0] ?? []).map(set => String(set[0])),
        turnQueued: entry[2],
        turnsUntilReturn: entry[3]
    })),
    aiPlans: (limit) => recentPlans(limit ?? 256),
    pathAreaComputations: () => getPathAreaComputations(),
    countryStrengths: () => countryStrengthsArray ?? [],
    randomEventProbability: () => probability,
    forceRandomEvent: (name) => {
        if (name !== null && !RANDOM_EVENTS.includes(name)) {
            throw new Error("unknown random event: " + name);
        }
        forcedRandomEvent = name;
        return name;
    },
    queueDefence: (record) => {
        recordDefence(record);
        return pendingDefences();
    },
    pendingDefences: () => pendingDefences(),
    playQueuedDefences: () => showQueuedDefences(),
    setAlwaysSkipPlayback: (value) => {
        defenderPlayback.setAlwaysSkip(Boolean(value));
        return defenderPlayback.alwaysSkip();
    },
    battle: () => {
        const attackers = getAttackingArmyRemaining();
        const defenders = getDefendingArmyRemaining();
        if (!attackers || !defenders) {
            return null;
        }
        return {
            attackers: attackers.slice(0, 4),
            defenders: defenders.slice(0, 4),
            round: getCurrentRound(),
            warId: getCurrentWarId(),
            probability: getUpdatedProbability() ?? null
        };
    },
    //What the SIEGE BUTTON is actually gated on, which since combat stage 1 is not the number
    //the attack window's bar shows. The bar is `winProbability()` -- a ratio of two strengths --
    //and the gate is `takeProbability()`, the chance of really taking the place. They are allowed
    //to differ (CLAUDE.md), but a spec comparing the BAR against
    //`PROBABILITY_THRESHOLD_FOR_SIEGE` is comparing two different quantities and will be wrong in
    //both directions. Exposed so a spec can assert the rule the game enforces rather than a
    //number that happens to sit near it. Since combat checklist item 1.9 the attack window's BAR
    //shows this same quantity, so a spec can also assert that the two have not drifted apart --
    //which is what `attack/attack-window.spec.js` does.
    siegeGateOdds: () => currentTakeOdds(),
    diceFaces: () => facesShowing(),
    greyedOutCountries: () => [...greyedOutCountryNames()],
    gameOverEvents: () => gameOverLog.map(entry => ({ ...entry })),
    wars: () => historicWarsList().map(war => ({
        warId: war.warId,
        defendingTerritory: war.defendingTerritory?.territoryName ?? null,
        resolution: war.battleResolution ?? null,
        turnsInSiege: war.turnsInSiege ?? null
    }))
});

export let randomEventHappening = false;
export let randomEvent = "";

export const summaryWarsArray = [];
export const summaryWarsLostArray = [];

let probability = 0;
let attackOptionsArray = [];
let arrayOfLeadersAndCountries = [];
let gameInitialisation;

/**
 * @param {{spectator?: boolean, worldSetup?: () => void}} [options]
 *        `worldSetup` creates the CPU leaders and the AI's starting forts. It is a CALLBACK
 *        rather than an import because both live in `ui.js` and this module deliberately does
 *        not import it; see the note at the call below for why the ORDER matters.
 */
export async function initialiseGame({ spectator = false, worldSetup = null } = {}) {
    resetVictoryLatch();
    setZoomLevel(1);
    zoomMap("init");
    svg.style.pointerEvents = 'none';
    gameInitialisation = true;
    clearActivityLog();
    activityPanel.reset();
    console.log("Welcome to new game! Your country is " + playerCountryName() + "!");

    if (!spectator) {
        for (const territory of allTerritories()) {
            if (territory.dataName === playerCountryName()) {
                setTerritoryOwner(territory.uniqueId, "Player", territory.dataName);
            }
        }
    }
    arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    pruneSiegesForMissingTerritories(name => getTerritoryByName(name) !== null);
    if (!spectator) {
        document.getElementById(ids.topTableContainer).style.display = "block";
    }
    toggleTransferAttackButton(true, true);
    changeAllPathsToWhite();
    moveButton.setLabel("LOADING...");

    await buildAttackOptions();
    paintWholeMapFromModel();

    toggleTransferAttackButton(false, true);
    refreshGoalLine();
    document.getElementById(ids.popupColor).disabled = true;
    gameInitialisation = false;
    svg.style.pointerEvents = 'auto';

    installAdjacencyHooks();
    signalReady();

    //THE WORLD IS FINISHED BEFORE THE ENGINE STARTS.
    //
    //This used to happen in `ui.js`, AFTER `await initialiseGame()` resolved -- which is after
    //`turnEngine.start()` had already run turn 1. So turn 1 was planned and earned over a world
    //with no CPU leaders and no forts on it, and `newTurnResources()` skips the income pass on
    //turn 1 precisely to hide that. It could not simply be moved: both of these read the
    //player's ownership, so they have to run after the loop above that sets it, and moving them
    //here was implemented, MEASURED and reverted once already -- the ten-turn `long-run` went
    //from 6/6 green to 0/6 with the player eliminated every time, which is a balance change and
    //not a tidy-up.
    //
    //What changed since that measurement is `PLAYER_GRACE_TURNS`: the AI cannot open an attack
    //or a siege against the player for the first five turns, which is exactly the failure the
    //revert was protecting against. So it is tried again, and measured again.
    //
    //Spectator mode has always done this BEFORE the engine starts, because nothing blocks there
    //and a country without a leader would throw -- so this brings a played game into line with
    //the one that was already right.
    worldSetup?.();

    installPhaseButton();
    turnEngine.start();
}

async function buildAttackOptions() {
    await loadAdjacency();
    for (const territory of allTerritories()) {
        attackOptionsArray[Number(territory.uniqueId)] = [
            territory.uniqueId,
            getInteractableFrom(territory.uniqueId, territory.territoryName).map(name => [name])
        ];
    }
}

function paintWholeMapFromModel() {
    for (const territory of allTerritories()) {
        setColorOnMap(territory);
    }
    for (const path of paths) {
        if (pathCountry(path) === playerCountryName()) {
            path.setAttribute("fill", playerColour());
        }
    }
}

function installAdjacencyHooks() {
    installAdjacencyTestHooks({
        interactableFrom: (territoryName) => {
            const territory = getTerritoryByName(territoryName);
            return territory
                ? getInteractableFrom(territory.uniqueId, territory.territoryName)
                : null;
        },
        adjacencyExceptions: () => manualAdjacencyExceptions,
        strandedTerritories: () =>
            adjacencyIds()
                .map(id => getTerritory(id))
                .filter(territory =>
                    territory &&
                    getInteractableFrom(territory.uniqueId, territory.territoryName).length === 0)
                .map(territory => territory.territoryName)
    });
}

export async function resumeSavedGame(phase) {
    resetVictoryLatch();
    setZoomLevel(1);
    zoomMap("init");
    svg.style.pointerEvents = 'none';
    gameInitialisation = true;

    updateArrayOfLeadersAndCountries();
    arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    pruneSiegesForMissingTerritories(name => getTerritoryByName(name) !== null);

    document.getElementById(ids.topTableContainer).style.display = "block";
    toggleTransferAttackButton(true, true);
    moveButton.setLabel("LOADING...");

    await buildAttackOptions();

    renderAllTerritories();
    paintWholeMapFromModel();

    addUpAllTerritoryResourcesForCountryAndWriteToTopTable(true);

    toggleTransferAttackButton(false, true);
    refreshGoalLine();
    document.getElementById(ids.popupColor).disabled = true;
    gameInitialisation = false;
    svg.style.pointerEvents = 'auto';

    installAdjacencyHooks();
    signalReady();

    installPhaseButton();
    const step = STEP_FOR_PHASE[phase] === "ai"
        ? "military"
        : STEP_FOR_PHASE[phase] ?? "buyUpgrade";
    turnEngine.start({ resumeAt: { skipBeginTurn: true, step: step } });
}

function endTurn() {
    if (!gameDecided) {
        const result = checkForVictory({
            turn: currentTurn(),
            playerCountry: isAiGameActive() ? null : playerCountryName()
        });
        if (result) {
            gameDecided = true;
            emit(Events.GAME_OVER, result);
        }
    }
    advanceTurn();
}

let gameDecided = false;

export function resetVictoryLatch() {
    gameDecided = false;
    gameOverLog.length = 0;
}

const gameOverLog = [];

on(Events.GAME_OVER, (result) => {
    gameOverLog.push({
        outcome: result.outcome,
        winner: result.winner ?? null,
        reason: result.reason,
        turn: result.turn,
        kind: result.condition?.kind ?? null
    });
    const outcome = result.outcome === "VICTORY"
        ? "YOU HAVE WON!"
        : result.outcome === "DEFEAT"
            ? "You have lost."
            : "The game has been decided.";
    console.log("=== GAME OVER === " + outcome
        + " Winner: " + (result.winner ?? "nobody")
        + ". Condition: " + result.condition.kind
        + ". Reason: " + result.reason
        + ". Turn: " + result.turn + ".");
});

function beginTurn() {
    activateAllPlayerTerritoriesForNewTurn();
    activateAiTerritoriesForNewTurn();

    let continueSiege = true;
    const continueSiegeArrayPlayer = calculatePlayerInitiatedSiegePerTurn();
    if (continueSiegeArrayPlayer) {
        continueSiegeArrayPlayer.forEach(element => {
            if (element !== true) {
                continueSiege = false;
                handleEndSiegeDueArrest(false, element);
            }
        });
    }
    const continueSiegeArrayAi = calculateAiInitiatedSiegePerTurn();
    if (continueSiegeArrayAi) {
        continueSiegeArrayAi.forEach(element => {
            if (element !== true) {
                continueSiege = false;
                handleEndSiegeDueArrest(true, element);
                console.log("Ai Siege Of " + element.defendingTerritory.territoryName + " finished due to arrest of " + element.attackingCountry + "'s attacking troops!");
            }
        });
    }
    incrementSiegeTurns(true);
    incrementSiegeTurns(false);
    recordOngoingSieges([
        ...Object.entries(playerSieges()).map(([territoryName, siege]) =>
            ({ side: "player", territoryName: territoryName, siege: siege })),
        ...Object.entries(aiSieges()).map(([territoryName, siege]) =>
            ({ side: "ai", territoryName: territoryName, siege: siege }))
    ]);
    if (currentTurn() > 1) {
        handleArmyRetrievals(getRetrievalArray());
    }

    getPlayerTerritories();
    console.log("Probability of Random Event: " + probability + "%");
    randomEventHappening = handleRandomEventLikelihood();
    if (randomEventHappening) {
        randomEvent = forcedRandomEvent ?? selectRandomEvent();
        forcedRandomEvent = null;
        console.log("There's been a " + randomEvent + "!")
    }
    newTurnResources();
    calculateTerritoryStrengths(allTerritories());
    if (uiAppearsAtStartOfTurn && currentTurn() !== 1 && !isAiGameActive()) {
        toggleUIMenu(true);
        drawUITable(document.getElementById(ids.uiTable), 0);
    }
    if (isAiGameActive()) {
        aiGameConsole.setTurn(currentTurn());
    } else {
        activityPanel.onTurnStarted(currentTurn());
    }
    randomEventHappening = false;
    randomEvent = "";
    console.log("Turn " + currentTurn() + " has started!");
}

function announcePhase(description) {
    console.log(description);
    console.log("Current turn-phase is: " + phaseName(currentPhase()));
}

const turnEngine = createTurnEngine({
    beginTurn: beginTurn,
    steps: [
        {
            name: "buyUpgrade",
            get waitsForPlayer() {
                return !isAiGameActive();
            },
            onEnter: () => announcePhase("Handling Spend Upgrade Phase")
        },
        {
            name: "military",
            get waitsForPlayer() {
                return !isAiGameActive();
            },
            onEnter: () => announcePhase("Handling Move Attack Phase")
        },
        {
            name: "ai",
            run: handleAITurn
        }
    ],
    endTurn: endTurn,
    onError: (error, context) => {
        console.error("Turn engine: the " + (context.step ?? context.stage) + " stage threw; " +
            "the turn continues without it.", error);
    }
});

export function getTurnEngine() {
    return turnEngine;
}

const STEP_FOR_PHASE = Object.freeze({
    [Phase.BUY_UPGRADE]: "buyUpgrade",
    [Phase.MOVE_ATTACK]: "military",
    [Phase.AI]: "ai"
});

registerSaveSlice("turnLoop", {
    capture: () => ({ randomEventProbability: probability }),
    restore: (data) => {
        probability = Number(data?.randomEventProbability) || 0;
    }
});

installActivityRecorder();

registerSaveSlice("activity", {
    capture: () => captureActivityLog(),
    restore: (data) => {
        restoreActivityLog(data);
        activityPanel.reset();
    }
});

let phaseButtonInstalled = false;

function installPhaseButton() {
    if (phaseButtonInstalled) {
        return;
    }
    const popupConfirmButton = document.getElementById(ids.popupConfirm);
    if (popupConfirmButton) {
        popupConfirmButton.addEventListener("click", () => turnEngine.advancePhase());
        phaseButtonInstalled = true;
    }
}

async function handleAITurn() {
    console.log("Handling AI Turn...");
    document.getElementById(ids.popupConfirm).disabled = true;
    endPlayerTurn();
    updateArrayOfLeadersAndCountries();
    arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    let countryResourceTotals;
    let turnGainsArrayAi;
    let currentAiCountry;

    const turnOrder = arrayOfLeadersAndCountries.map(entry => entry[0]);

    for (let turnIndex = 0; turnIndex < turnOrder.length; turnIndex++) {
        const i = arrayOfLeadersAndCountries.findIndex(entry => entry[0] === turnOrder[turnIndex]);
        if (i === -1 || arrayOfLeadersAndCountries[i][2].length === 0) {
            console.log(turnOrder[turnIndex] + " has no territories left and takes no turn");
            continue;
        }

        let fullTerritoriesInRange = [];
        let attackableTerritoriesInRange = [];
        let arrayOfTerritoriesInRangeThreats = [];
        let arrayOfAiPlayerDefenseScoresForTerritories = [];
        let unrefinedTurnGoals = [];
        let refinedTurnGoals = [];

        currentAiCountry = arrayOfLeadersAndCountries[i][0];

        //A LEADER DIES AND THE COUNTRY THINKS AGAIN. This must run BEFORE the leader is read
        //below, so the successor plans this turn rather than inheriting a turn planned by the
        //dead one -- and before `planAiCampaign()`, which is why `clearPlansFor()` also drops
        //any campaign already derived for this turn.
        //
        //See `src/ai/succession.js`. A country's character used to be drawn once and fixed for
        //the whole game, so a stalemate between two comparable neighbours could never break:
        //measured, the largest empire reached 71 territories at turn 50 and was still on 71 at
        //turn 150 while the world's army tripled. Everyone gets richer together, so the ratio
        //never moves. A leader with a different appetite for risk is one of the few things
        //that can shift it.
        if (isSuccessionTurn(currentAiCountry, currentTurn())) {
            const successor = replaceLeaderForCountry(currentAiCountry);
            if (successor) {
                clearPlansFor(currentAiCountry);
                //The array holds references to the territory objects, so the leader it reports
                //is the new one already -- but say so, because a country changing its mind
                //completely is otherwise the least explicable thing in the log.
                console.log(currentAiCountry + " has a new leader: " + successor.name
                    + " (" + successor.leaderType + ", risk "
                    + successor.traits.risk_taking.toFixed(2) + ") -- plans wiped");
            }
        }

        const leader = arrayOfLeadersAndCountries[i][2][0].leader;
        const leaderTraits = arrayOfLeadersAndCountries[i][2][0].leader.traits;

        console.log("Now it is " + currentAiCountry + "'s turn!");

        beginAiGameCountry(currentAiCountry);

        setAiRngContext(currentTurn(), currentAiCountry);

        const campaign = planAiCampaign(currentAiCountry, leader, currentTurn());
        reviewAiSieges(currentAiCountry, leader, campaign);

        countryResourceTotals = getCountryResourceTotals()[arrayOfLeadersAndCountries[i][0]];
        turnGainsArrayAi = currentTurn() !== 1 ? getTurnGainsArrayAi()[arrayOfLeadersAndCountries[i][0]] : turnGainsArrayLastTurn;
        fullTerritoriesInRange = buildFullTerritoriesInRangeArray(arrayOfLeadersAndCountries, attackOptionsArray, i);
        attackableTerritoriesInRange = buildAttackableTerritoriesInRangeArray(arrayOfLeadersAndCountries, fullTerritoriesInRange, i);
        attackableTerritoriesInRange = convertAttackableArrayStringsToMainArrayObjects(attackableTerritoriesInRange);
        arrayOfAiPlayerDefenseScoresForTerritories = getFriendlyTerritoriesDefenseScores(arrayOfLeadersAndCountries, currentAiCountry, i);
        arrayOfTerritoriesInRangeThreats = calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory(attackableTerritoriesInRange, arrayOfLeadersAndCountries, fullTerritoriesInRange, arrayOfAiPlayerDefenseScoresForTerritories, i);
        musterAiArmies(currentAiCountry, campaign, arrayOfTerritoriesInRangeThreats);
        unrefinedTurnGoals.push(calculateTurnGoals(arrayOfTerritoriesInRangeThreats, campaign));
        refinedTurnGoals = refineTurnGoals(unrefinedTurnGoals, currentAiCountry, leaderTraits);
        refinedTurnGoals = prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits, campaign);
        const plan = logAiPlan({
            country: currentAiCountry,
            leader: leader,
            refinedGoals: refinedTurnGoals,
            turn: currentTurn(),
            campaign: campaign
        });
        refinedTurnGoals = await doAiActions(refinedTurnGoals, leader, turnGainsArrayAi, arrayOfTerritoriesInRangeThreats, arrayOfAiPlayerDefenseScoresForTerritories, campaign); //refinedTurnGoals gets returned because can be updated in this function if a bolster job gets deleted after recalculations

        resetAiRngContext();

        await endAiGameCountry({
            country: currentAiCountry,
            leader: leader,
            campaign: campaign,
            plan: plan,
            turnGains: currentTurn() === 1 ? null : (turnGainsArrayAi ?? null)
        });

    }
    for (let i = 0; i < summaryWarsArray.length; i++) {
        console.log(`%c${summaryWarsArray[i]}`, "color: rgb(0,255,0);");
        if (i < summaryWarsArray.length - 1) {
            console.log("%c------------------", "color: rgb(0,255,0);");
        }
    }
    for (let i = 0; i < summaryWarsLostArray.length; i++) {
        console.log(`%c${summaryWarsLostArray[i]}`, "color: red;");
        if (i < summaryWarsLostArray.length - 1) {
            console.log("%c------------------", "color: red;");
        }
    }
    summaryWarsArray.length = 0;
    summaryWarsLostArray.length = 0;
    console.log("AI DONE!");
    await showQueuedDefences();

    initialiseNewPlayerTurn();

}

function handleRandomEventLikelihood() {
    if (forcedRandomEvent) {
        probability = 0;
        return true;
    }
    const result = rollRandomEventLikelihood(probability);
    probability = result.nextProbabilityPercent;
    return result.happening;
}

let forcedRandomEvent = null;
export function randomEventProbability() {
    return probability;
}

function handleArmyRetrievals(retrievalArray) {
    for (let i = 0; i < retrievalArray.length; i++) {
        if (currentTurn() === retrievalArray[i][2] + retrievalArray[i][3]) {
            const armySets = retrievalArray[i][1];
            for (let j = 0; j < armySets[0].length; j++) {
                const uniqueId = armySets[0][j][0].toString();
                for (let k = 0; k < allTerritories().length; k++) {
                    if (allTerritories()[k].uniqueId === uniqueId) {
                        const totalInfantry = armySets[0][j][armySets[0][j].length - 4];
                        const totalAssault = armySets[0][j][armySets[0][j].length - 3];
                        const totalAir = armySets[0][j][armySets[0][j].length - 2];
                        const totalNaval = armySets[0][j][armySets[0][j].length - 1];

                        const infantryPercentage = armySets[0][j][1];
                        const assaultPercentage = armySets[0][j][2];
                        const airPercentage = armySets[0][j][3];
                        const navalPercentage = armySets[0][j][4];

                        const infantryQuantity = Math.floor((infantryPercentage * totalInfantry) / 100);
                        const assaultQuantity = Math.floor((assaultPercentage * totalAssault) / 100);
                        const airQuantity = Math.floor((airPercentage * totalAir) / 100);
                        const navalQuantity = Math.floor((navalPercentage * totalNaval) / 100);

                        allTerritories()[k].infantryForCurrentTerritory += infantryQuantity;
                        allTerritories()[k].assaultForCurrentTerritory += assaultQuantity;
                        allTerritories()[k].airForCurrentTerritory += airQuantity;
                        allTerritories()[k].navalForCurrentTerritory += navalQuantity;
                    }
                }
            }
            retrievalArray.splice(i, 1);
            i--;
        }
    }
}


function changeAllPathsToWhite() {
    for (let i = 0; i < paths.length; i++) {
        paths[i].setAttribute("fill", "rgb(255, 255, 255)");
    }
}


export function getGameInitialisation() {
    return gameInitialisation;
}

//