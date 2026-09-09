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
    showQueuedDiplomacy,
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
    calculateAvailableUpgrades,
    rankedWorldStandings
} from './resourceCalculations.js';
import { playerStanding } from "./src/ui/goals/standingsTable.js";
import { briefingFacts, weakBordersFor } from "./src/state/briefing.js";
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
import { peaceDiscipline } from "./src/config/balance.js";
import { pendingDiplomacy } from "./src/state/diplomacyInbox.js";
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
    isAdjacencyLoaded,
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
    siegeOn,
    allRelations,
    relationStateBetween
} from './src/state/selectors.js';
import { DiplomaticState } from './src/state/diplomacy.js';
import { refreshDiplomaticContacts } from './src/state/diplomacyContacts.js';
import {
    advanceTurn,
    setTerritoryOwner,
    pruneSiegesForMissingTerritories,
    updateTerritory,
    addSiege,
    setNextWarId,
    setNextAiWarId,
    setRelationState
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
import { installOpinionRecorder } from "./src/ai/opinionRecorder.js";
import {
    installActivityRecorder,
    recordBriefing,
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
    //THE DIPLOMACY REGISTER. Sparse, derived from a walk of the map, and carried by no DOM
    //anywhere -- so a spec has no other way to see it. `declareWar()` is a WRITE and goes
    //through `mutations.js` like every other one; it exists so that the attacking half of
    //the e2e suite still has a war to fight now that neutral refuses one.
    relations: () => allRelations(),
    relationBetween: (a, b) => ({ a, b, state: relationStateBetween(a, b) }),
    declareWar: (a, b) => {
        //The contact walk first: two countries with no record are at no contact, and war
        //cannot be declared out of that. In the running game contact is made by their
        //borders touching, which is exactly what a spec's two adjacent territories have
        //already done -- it simply may not have been walked yet this turn.
        refreshDiplomaticContacts();
        setRelationState(a, b, DiplomaticState.WAR, {
            since: currentTurn(), by: a, via: "declared"
        });
        return { a, b, state: relationStateBetween(a, b) };
    },
    //THE OTHER FIVE STATES, and this exists for the same reason `declareWar()` does: nothing
    //in the game agrees a peace, a ceasefire or an alliance except by asking an AI country
    //that may say no, so a spec that needs one of those states to exist has no reliable way
    //to reach it by clicking. It goes through `mutations.js` like every other write and it
    //sets the ceasefire's two extra fields properly -- a spec that wrote a ceasefire with no
    //`until` would be testing an agreement the game cannot produce.
    setRelation: (a, b, state, options) => {
        refreshDiplomaticContacts();
        const turn = currentTurn();
        const ceasefire = state === DiplomaticState.CEASEFIRE;
        setRelationState(a, b, state, {
            since: options?.since ?? turn,
            until: options?.until ?? (ceasefire ? turn + peaceDiscipline.ceasefireTurns : null),
            revertsTo: options?.revertsTo ?? (ceasefire ? relationStateBetween(a, b) : null),
            //WHO ACTED AND BY WHAT ROUTE, overridable. They default to "`a` agreed it", which
            //is what every caller before the declaration notice wanted and is why they were
            //written as literals. They have to be reachable now because a pair arriving at WAR
            //looks identical whichever route wrote it, and the things that READ the transition
            //-- the news, the opinion recorder, the notice put to the player -- all switch on
            //exactly these two fields. A hook that could only ever say "agreed" could set up
            //any STATE and not one of the events that produce it.
            by: options?.by === undefined ? a : options.by,
            via: options?.via ?? "agreed"
        });
        return { a, b, state: relationStateBetween(a, b) };
    },
    //Every question the AI has put to the player and is waiting on. It is filled during the
    //AI phase and emptied at the end of it, so a spec can only see one by looking mid-turn.
    pendingDiplomacy: () => pendingDiplomacy(),
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
        setRelationState,
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
    //THE DIPLOMACY REGISTER, BROUGHT UP TO DATE BEFORE ANYBODY PLANS AGAINST IT.
    //
    //`diplomacyContacts.js` also refreshes on `TURN_CHANGED` and lazily when the tooltip
    //reads it, and neither is early enough on its own: the counter is advanced by
    //`endTurn`, so on TURN 1 no `TURN_CHANGED` has ever fired, and the tooltip is only
    //asked if somebody happens to hover. Without this, the AI would plan its first turn
    //against an EMPTY register — every pair reading as no contact rather than as neutral,
    //which is a different fact about the world that happens to produce the same refusal.
    //
    //It is a no-op unless a territory has changed hands since the last walk, so calling it
    //at every turn boundary costs nothing on a quiet turn.
    refreshDiplomaticContacts();

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
    recordTurnBriefing();
    randomEventHappening = false;
    randomEvent = "";
    console.log("Turn " + currentTurn() + " has started!");
}

/**
 * The state of the nation, once per turn (register item E7).
 *
 * THREE THINGS HERE LOOK WRONG AND ARE NOT.
 *
 * **The income is read from `turnGainsArrayLastTurn`, not `turnGainsArrayPlayer`.** The income
 * pass fills the latter and `newTurnResources()` then rolls it into the former and zeroes it,
 * so by the time this runs -- which is after `newTurnResources()`, deliberately, because the
 * figures do not exist before it -- "last turn's" array holds the money that has just arrived.
 * The info panel's own (+/-) columns read the same field for the same reason.
 *
 * **The entry is filed under the PREVIOUS turn.** `endTurn: advanceTurn`, so the panel hides
 * the turn that has just begun and opens the one behind it, where the news is. A briefing filed
 * under the turn it was computed in would sit in the hidden section and reach the player a
 * whole turn late. The card names no turn number, so nothing reads as off by one.
 *
 * **Nothing is written on turn 1.** There is no income on turn 1, the panel does not raise
 * itself, and `currentTurn() - 1` would be turn zero.
 */
function recordTurnBriefing() {
    if (currentTurn() <= 1 || isAiGameActive()) {
        return;
    }
    try {
        const player = playerCountryName();
        const owned = allTerritories().filter(territory => territory.dataName === player);
        const standing = playerStanding(rankedWorldStandings().standings);

        const weakBorders = weakBordersFor(owned, (territory) => {
            if (!isAdjacencyLoaded()) {
                return [];
            }
            const names = new Set(
                getInteractableFrom(territory.uniqueId, territory.territoryName));
            return allTerritories().filter(other =>
                other.dataName !== player && names.has(other.territoryName));
        });

        recordBriefing({
            turn: currentTurn() - 1,
            briefing: briefingFacts({
                goldIncome: turnGainsArrayLastTurn?.changeGold ?? 0,
                territories: owned.length,
                rank: standing?.rank ?? 0,
                surviving: rankedWorldStandings().standings.surviving,
                goalKind: activeVictoryCondition().kind,
                progressFraction: standing?.fraction ?? 0,
                weakBorders,
                //A siege the player laid is in the player list; one they are enduring is an
                //AI siege whose defending territory is theirs. The lists are keyed by SIDE
                //rather than by who is defending, which is the distinction `siegeIsAi`
                //exists for and the one known-issue AZ was about.
                besieging: Object.keys(playerSieges()).length,
                besieged: Object.values(aiSieges())
                    .filter(siege => siege?.defendingTerritory?.owner === "Player").length
            })
        });
    } catch (error) {
        //A briefing is a nicety. It must never be the reason a turn fails to start, and a
        //`console.error` would fail every e2e spec in the suite.
        console.warn("The turn briefing could not be built this turn.", error);
    }
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

//The news cards name the leader who took a province, and the name has to be read
//AT THE EVENT and stored -- `src/ai/succession.js` replaces a leader every 15-20
//turns, so one resolved when the card is drawn would credit a turn-12 conquest to
//whoever is in charge on turn 40. The lookup is injected rather than imported by
//`activityRecorder.js` because that module imports only from `state/` and so still
//loads in Node; this file already holds the leader table.
installActivityRecorder({
    leaderNameFor: (countryName) => {
        if (!countryName) {
            return "";
        }
        const row = getArrayOfLeadersAndCountries()
            .find((entry) => entry[0] === countryName);
        return row?.[1]?.name ?? "";
    }
});

//WHAT THE WORLD DOES TO WHAT COUNTRIES THINK OF EACH OTHER. It is installed beside the
//activity recorder because it reads the same events for the same reason, and its one
//injected dependency is the same one and for the same reason: `reconquista` decides how
//much a country minds losing a province, and the leader table lives in this file.
installOpinionRecorder({
    traitsFor: (countryName) => {
        if (!countryName) {
            return {};
        }
        const row = getArrayOfLeadersAndCountries()
            .find((entry) => entry[0] === countryName);
        return row?.[1]?.traits ?? {};
    }
});

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
    //THE DIPLOMATIC INBOX, after the battles the player has to watch and before their turn
    //begins. Order matters: a call to arms answered over a battle-results screen would be
    //answered through it, and `confirmDialog.open()` resolves a previous dialog as a CANCEL
    //when a second is raised over it -- which here would refuse a call to arms on the
    //player's behalf and end an alliance they never heard about.
    await showQueuedDiplomacy();

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