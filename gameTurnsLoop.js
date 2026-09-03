import {
    uiAppearsAtStartOfTurn,
    toggleUIMenu,
    endPlayerTurn,
    initialiseNewPlayerTurn,
    toggleTransferAttackButton,
    paths,
    svg,
    setColorOnMap
} from './ui.js';
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
    getTurnGainsArrayAi
} from './resourceCalculations.js';
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
    updateArrayOfLeadersAndCountries
} from "./cpuPlayerGenerationAndLoading.js";
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
    setAiRngContext
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

// Read-only accessors for the ?e2e=1 harness. Lazy closures, so this runs safely
// at module-evaluation time even though the model is not built yet.
installTestHooks({
    turn: () => currentTurn(),
    phase: () => currentPhase(),
    activity: () => activityTurns(),
    recordActivity: (entry) => recordActivity(entry),
    // Straight through the store's own indexes. This used to be a deliberate linear
    // scan, because doAiActions() replaced whole elements of mainGameArray and orphaned
    // the separate territory index (audit 5.1 AB) -- so the index could report a
    // territory frozen at the moment the AI last touched it. There is one index now and
    // nothing replaces an element, so the scan has nothing left to protect against.
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
        //`side` is not stored on a siege -- which list it is in IS the side -- so it is
        //resolved here rather than invented on the object.
        const side = playerSieges()[territoryName] ? "player"
            : aiSieges()[territoryName] ? "ai" : null;
        const siege = siegeOn(territoryName);
        return siege ? { siege, side } : null;
    },
    // Everything the ?stateGuard=1 write guard caught. Empty unless the page was loaded
    // with that flag; see src/state/GameState.js.
    stateGuardViolations: () => getGuardViolations().map(violation => ({
        territory: violation.territory,
        field: violation.field
    })),
    applyScenario: (scenario) => applyScenario(scenario, {
        getTerritoryByName,
        updateTerritory,
        addSiege,
        referenceDefendingTerritory,
        nextWarId: (side) => {
            //Scenario sieges take ids from the same counters the game does, so a scenario
            //siege and a real one can never collide on warId.
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
    //The AI's own reasoning, as the debug panel sees it: posture, objective, budgets and
    //the reason each target was taken or left alone. It is what `tools/ai-sim.mjs` reads
    //to answer "why has the world stopped changing?" over a hundred turns -- a question
    //no assertion about one turn can answer, because the interesting failure is a world
    //that freezes rather than one that throws.
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
    battle: () => {
        const attackers = getAttackingArmyRemaining();
        const defenders = getDefendingArmyRemaining();
        if (!attackers || !defenders) {
            return null;
        }
        return {
            //The legacy code pushes a defeat-type marker onto the END of these arrays when a
            //war resolves, so take the four unit slots and nothing else.
            attackers: attackers.slice(0, 4),
            defenders: defenders.slice(0, 4),
            round: getCurrentRound(),
            warId: getCurrentWarId(),
            probability: getUpdatedProbability() ?? null
        };
    },
    greyedOutCountries: () => [...greyedOutCountryNames()],
    wars: () => historicWarsList().map(war => ({
        warId: war.warId,
        defendingTerritory: war.defendingTerritory?.territoryName ?? null,
        resolution: war.battleResolution ?? null,
        turnsInSiege: war.turnsInSiege ?? null
    }))
});

//Phase 4.6/4.8: the turn number and the phase used to be two module-level `let`s
//here, exported by value and shadowed by a THIRD counter (`turnPhase` in ui.js) that
//the phase button incremented. They now live in GameState; read them through
//currentTurn()/currentPhase() and write them through setTurn()/setPhase().
export let randomEventHappening = false;
export let randomEvent = "";

export const summaryWarsArray = [];
export const summaryWarsLostArray = [];

let probability = 0;
let attackOptionsArray = [];
let arrayOfLeadersAndCountries = [];
let gameInitialisation;

//Phase 4.5. `normalizeSiegeState()` stood here: an 88-line once-per-turn sweep that
//re-derived the `underSiege` attribute on all 359 paths from the siege lists, dropped
//sieges naming territories that were not on the map, and added or removed the siege
//overlay images to match. It existed because the flag and the lists were two separate
//facts that drifted apart.
//
//They are one fact now. `isUnderSiege()` reads the siege lists, the attribute is
//rendered from that by src/ui/mapAttributeSync.js, and the overlay images by
//src/ui/siegeOverlay.js -- both on `siegeChanged`, so a siege that is added or removed
//updates one territory rather than sweeping the map. The only part with anything left
//to do is the orphan check, and that only matters if the map itself changes, so it runs
//once at game start rather than every turn.

/**
 * Start a new game.
 *
 * @param {object} [options]
 * @param {boolean} [options.spectator]
 *        Start a game with NO player in it -- the "AI Game" debug mode. The only
 *        difference here is that no territory is assigned to `Player`, which is
 *        all it takes: `updateArrayOfLeadersAndCountries()` collects every country
 *        whose territories are not the player's, so leaving the assignment out
 *        hands the whole map to the AI. The two phases that normally wait for a
 *        click stop waiting because the steps below ask the mode, and the caller
 *        (`startAiGame()` in ui.js) creates the CPU leaders and the starting forts
 *        BEFORE this runs rather than after -- see the note on that ordering below.
 */
export async function initialiseGame({ spectator = false } = {}) {
    setZoomLevel(1);
    zoomMap("init");
    svg.style.pointerEvents = 'none';
    gameInitialisation = true;
    //A new game is a new war. Restart restores the pristine world, and a feed still
    //listing the conquests of the game that was thrown away would be the same species
    //of bug as the top table showing the abandoned game's totals (Phase 7.2).
    clearActivityLog();
    activityPanel.reset();
    console.log("Welcome to new game! Your country is " + playerCountryName() + "!");
    //A local `const paths = Array.from(svgMap.querySelectorAll("path"))` stood here,
    //shadowing the module-level import of the same list. It went with the extraction of
    //paintWholeMapFromModel() in Phase 7.3 -- there is one `paths` in this file now.

    //Two loops for one fact: the path attribute and then the model field, each over its
    //own collection. One write now, and src/ui/mapAttributeSync.js renders the attribute
    //(Phase 4.4).
    //Skipped entirely in spectator mode: nobody is the player, so nothing is owned
    //by `Player` and every country on the map is taken by the AI.
    if (!spectator) {
        for (const territory of allTerritories()) {
            if (territory.dataName === playerCountryName()) {
                setTerritoryOwner(territory.uniqueId, "Player", territory.dataName);
            }
        }
    }
    //Bootstrap ordering, and it is NOT an accident -- see docs/05-known-issues.md section 2.
    //The CPU leaders and the AI's starting forts are created by the confirm handler in
    //ui.js AFTER this function resolves, which is after `turnEngine.start()` has run turn 1.
    //Turn 1 therefore plans and earns over a world with no leaders and no forts, which is
    //why `newTurnResources()` skips the income pass on turn 1.
    //
    //Moving that setup in here, before the engine starts, was tried in Phase 5.8 and
    //MEASURED: the ten-turn `long-run` went from 6/6 green to 0/6, with the player's
    //country eliminated every single time. Giving the AI a fully-formed first turn is a
    //balance change, not a tidy-up, so it belongs to the Phase 7 balance pass together with
    //the AI's unbounded sieges. Do not move these calls without re-running that spec.
    arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    //The orphan half of the old normalizeSiegeState(): a siege naming a territory the
    //map does not have can only happen if the map changed under us, so it is checked
    //once here rather than every turn.
    pruneSiegesForMissingTerritories(name => getTerritoryByName(name) !== null);
    //A spectated game has no player, so the total-player-resources table has nothing
    //to total. `applySpectatorChrome()` in ui.js keeps it down for the rest of the run.
    if (!spectator) {
        document.getElementById(ids.topTableContainer).style.display = "block";
    }
    toggleTransferAttackButton(true, true);
    changeAllPathsToWhite();
    moveButton.setLabel("LOADING...");

    await buildAttackOptions();
    paintWholeMapFromModel();

    toggleTransferAttackButton(false, true);
    document.getElementById(ids.popupColor).disabled = true;
    gameInitialisation = false;
    svg.style.pointerEvents = 'auto';

    installAdjacencyHooks();
    signalReady();

    installPhaseButton();
    turnEngine.start();
}

/**
 * Attack options for every territory.
 *
 * This used to be an awaited loop that re-fetched and re-parsed the 19 MB
 * closestPathsData.json once per territory -- 359 fetches and roughly 6.8 GB of
 * JSON.parse before turn 1 could start. It is now one 77 KB load and a synchronous
 * pass. See docs/01-codebase-audit.md section 4.1 and docs/03-refactor-plan.md
 * Phase 1.1-1.2.
 *
 * Purely a function of the map, so a loaded game rebuilds it rather than carrying
 * 359 adjacency lists around inside every save.
 */
async function buildAttackOptions() {
    await loadAdjacency();
    for (const territory of allTerritories()) {
        // Indexed BY uniqueId, not by push order. The old code pushed in
        // allTerritories() order and then read attackOptionsArray[uniqueId], which
        // only worked because the two happened to coincide.
        attackOptionsArray[Number(territory.uniqueId)] = [
            territory.uniqueId,
            getInteractableFrom(territory.uniqueId, territory.territoryName).map(name => [name])
        ];
    }
}

/**
 * Paint every territory from the model, then the player's own countries on top.
 *
 * Colouring used to be a side effect of the adjacency loop, one territory at a time,
 * which is what produced the visible "loading" sweep across the map.
 */
function paintWholeMapFromModel() {
    for (const territory of allTerritories()) {
        setColorOnMap(territory);
    }
    for (const path of paths) {
        if (pathCountry(path) === playerCountryName()) {
            path.setAttribute("fill", playerColour()); //the player's own colour wins
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

/**
 * Bring a loaded save up to a playable turn. The load-side counterpart of
 * `initialiseGame()`.
 *
 * The store and the legacy modules have already been restored by the time this runs
 * (`src/platform/storage.js`); what is left is everything `initialiseGame()` does
 * that is a function of the map rather than of a die roll. Three things it
 * deliberately does NOT do, and each of them would corrupt the loaded game:
 *
 *   * it does not assign ownership from `playerCountryName()`. The save already says
 *     who owns what, and re-running that loop would hand the player back every
 *     territory of their starting country that they have since lost;
 *   * it does not create CPU leaders or starting forts. Both draw from `Math.random`
 *     and both are already in the save -- generating them again would replace every
 *     AI personality mid-game and re-fortify the world;
 *   * it does not run `beginTurn`. The saved turn has already had its income, its
 *     siege tick and its disaster roll; the engine resumes INSIDE that turn.
 *
 * @param {number} phase  the `Phase` the save was taken in
 */
export async function resumeSavedGame(phase) {
    setZoomLevel(1);
    zoomMap("init");
    svg.style.pointerEvents = 'none';
    gameInitialisation = true;

    //Rebuilt, not saved: it is an index over the territory model, and the model has
    //just been restored.
    updateArrayOfLeadersAndCountries();
    arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    pruneSiegesForMissingTerritories(name => getTerritoryByName(name) !== null);

    document.getElementById(ids.topTableContainer).style.display = "block";
    toggleTransferAttackButton(true, true);
    moveButton.setLabel("LOADING...");

    await buildAttackOptions();

    //The six rendered path attributes and the siege overlays, from the restored store.
    //`restoreState()` deliberately does not emit 359 territory events to get here.
    renderAllTerritories();
    paintWholeMapFromModel();

    //The top table is written, not derived -- nothing repaints it on a state change,
    //so without this it goes on showing the totals of the game that was abandoned.
    //This is a pure sum over the restored territories: it grants no income, which is
    //why the load calls it rather than newTurnResources().
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable(true);

    toggleTransferAttackButton(false, true);
    document.getElementById(ids.popupColor).disabled = true;
    gameInitialisation = false;
    svg.style.pointerEvents = 'auto';

    installAdjacencyHooks();
    signalReady();

    installPhaseButton();
    //The AI turn is not a resumable position -- it runs to completion without ever
    //waiting for the player, so a save taken during one has no click to come back to.
    //Resuming into the player's move phase is the nearest playable point.
    const step = STEP_FOR_PHASE[phase] === "ai"
        ? "military"
        : STEP_FOR_PHASE[phase] ?? "buyUpgrade";
    turnEngine.start({ resumeAt: { skipBeginTurn: true, step: step } });
}

/**
 * Everything that happens before the player may act: sieges tick, armies come home, the
 * economy runs, and a disaster may fire.
 *
 * This is the block that used to open `gameLoop()`. It is a named function now because the
 * engine calls it -- which also means the start of a turn is one thing that can be reasoned
 * about, rather than the first forty lines of a recursive function.
 */
function beginTurn() {
    activateAllPlayerTerritoriesForNewTurn();
    activateAiTerritoriesForNewTurn();

    let continueSiege = true;
    const continueSiegeArrayPlayer = calculatePlayerInitiatedSiegePerTurn(); //large function to work out siege effects per turn
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
                //BUG FIX: `attackingTerritory` is the attacking territory NAME, a string, so
                //`.dataName` on it was always undefined and this line always logged
                //"undefined's attacking troops". `attackingCountry` is the country.
                console.log("Ai Siege Of " + element.defendingTerritory.territoryName + " finished due to arrest of " + element.attackingCountry + "'s attacking troops!");
            }
        });
    }
    incrementSiegeTurns(true);
    incrementSiegeTurns(false);
    //Phase 7.4. One line per siege still running, written AFTER the turn counters have
    //been bumped so the entry can say which turn of the siege this is. Called once with
    //both sides rather than from inside incrementSiegeTurns(), which runs twice and is a
    //rule rather than a narrator.
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
    calculateTerritoryStrengths(allTerritories()); //might not be necessary every turn // related with greying out
    //Phase 5.8. This was gated on `continueSiege === true` as well -- meaning the panel was
    //suppressed on any turn where a siege ended in an arrest, because the arrest raised the
    //battle results screen and the two would collide. Once sieges actually ticked (audit
    //5.1 D, 5.2 J) an arrest happened on nearly every turn, so the preference silently never
    //took effect at all. The collision is gone: an arrest only raises the results screen
    //when the player was a party to it, so the gate can say what it means.
    if (uiAppearsAtStartOfTurn && currentTurn() !== 1 && !isAiGameActive()) {
        toggleUIMenu(true);
        drawUITable(document.getElementById(ids.uiTable), 0);
    }
    //Phase 7.4. After the info panel above, deliberately: the feed opens ON TOP of it,
    //which is what the brief asks for and is why it is a window rather than a fifth tab.
    //`onTurnStarted` always re-points the panel at the new turn -- closing the section
    //the player had expanded and opening this one -- and only RAISES it if the
    //start-of-turn preference is on, so a player who has switched that off still finds
    //the right section waiting when they open it by hand.
    //Both panels are the player's view of the turn, and a spectated game has no
    //player: the feed's collapsible sections are replaced by the console's flat
    //log, which only needs to be told which turn it is now printing.
    if (isAiGameActive()) {
        aiGameConsole.setTurn(currentTurn());
    } else {
        activityPanel.onTurnStarted(currentTurn());
    }
    randomEventHappening = false;
    randomEvent = "";
    console.log("Turn " + currentTurn() + " has started!");
}

/** Announce a phase as it opens. The phase enum itself is walked by the button in ui.js. */
function announcePhase(description) {
    console.log(description);
    console.log("Current turn-phase is: " + phaseName(currentPhase()));
}

//Phase 5.7. `gameLoop()` stood here: a function that ran the start-of-turn block and then
//chained three promises, the last of which called itself. There was no way to stop it, no
//`catch` anywhere in the chain -- so any throw inside the AI turn ended the game silently,
//with the phase button stuck on AI MOVING... -- and "wait for the player" was three
//near-identical private functions each wrapping a `#popup-confirm` listener in a Promise.
//
//It is an explicit state machine now: src/engine/TurnEngine.js. The engine knows nothing
//about this game; everything game-specific is in the hooks below.
const turnEngine = createTurnEngine({
    beginTurn: beginTurn,
    steps: [
        //`waitsForPlayer` is a GETTER on both, and that is the whole of what makes a
        //spectated game run by itself. The engine reads the property each time it
        //reaches the step, so asking the mode here means the two player phases simply
        //do not open a gate when there is no player -- rather than opening one and
        //having something else reach in to click it, which is a race between a timer
        //and a phase and eventually loses.
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
    endTurn: advanceTurn,
    onError: (error, context) => {
        //The old loop had no catch at all, so this was a dead game. It is now a lost step.
        console.error("Turn engine: the " + (context.step ?? context.stage) + " stage threw; " +
            "the turn continues without it.", error);
    }
});

/** The engine, for the test hooks and for the menu's New Game / Resume. */
export function getTurnEngine() {
    return turnEngine;
}

/** The engine's step names, in order, indexed by the `Phase` the player is in. */
const STEP_FOR_PHASE = Object.freeze({
    [Phase.BUY_UPGRADE]: "buyUpgrade",
    [Phase.MOVE_ATTACK]: "military",
    [Phase.AI]: "ai"
});

//Phase 7.3. The running chance of a disaster climbs on every turn one does not fire,
//so it is a fact about the game rather than about this turn -- a save that dropped it
//would quietly reset the player's luck. `attackOptionsArray` and
//`arrayOfLeadersAndCountries` are deliberately NOT saved: both are derived from the
//adjacency data and the territory model, and resumeSavedGame() rebuilds them.
registerSaveSlice("turnLoop", {
    capture: () => ({ randomEventProbability: probability }),
    restore: (data) => {
        probability = Number(data?.randomEventProbability) || 0;
    }
});

//Phase 7.4. The activity feed derives most of itself from `state/events.js`, so the
//recorder has to be listening before anything can happen. Installed here rather than
//at the top of `activityRecorder.js` because a module that installs a side effect on
//import only works if something imports it -- and this file is the one that owns the
//turn, which is what the feed is grouped by.
installActivityRecorder();

//The feed is saved with the game. It is not part of the world -- no rule reads it --
//so it is a slice rather than a field in `GameState`, and a save from before this
//existed simply restores an empty log rather than failing.
registerSaveSlice("activity", {
    capture: () => captureActivityLog(),
    restore: (data) => {
        restoreActivityLog(data);
        //A load lands inside a saved turn, so the section the panel should be showing
        //is that turn's -- not whichever one the player had expanded when they saved.
        activityPanel.reset();
    }
});

/**
 * Let the waiting phase proceed.
 *
 * One listener on `#popup-confirm`, installed once, replaces the three transient ones the
 * phase functions used to add and remove. A click when no phase is waiting -- during the AI
 * turn, or between turns -- is ignored, exactly as it was when the listener did not exist.
 */
let phaseButtonInstalled = false;

function installPhaseButton() {
    //Idempotent since Phase 7.3: initialiseGame() and resumeSavedGame() are two ways
    //into the same game, and a second listener on this button would advance two phases
    //per click.
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
    document.getElementById(ids.popupConfirm).disabled = true; // Stop the user from clicking the button during the AI turn
    endPlayerTurn();
    updateArrayOfLeadersAndCountries();
    arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    let countryResourceTotals;
    let turnGainsArrayAi;
    let currentAiCountry;

    //audit 5.1 AG. Conquering a territory calls updateArrayOfLeadersAndCountries(), which
    //rebuilds THIS array in place -- clearing it and pushing a fresh set, with an eliminated
    //country simply absent. Iterating it by a bare index meant a conquest during one country
    //turn shifted every later entry, so countries were skipped or moved twice, and once the
    //list shrank past the cursor `arrayOfLeadersAndCountries[i][2][0]` threw.
    //
    //The turn ORDER is fixed at the start of the phase; the index into the live array is
    //resolved fresh each iteration, because the helpers below all take (array, ..., i).
    const turnOrder = arrayOfLeadersAndCountries.map(entry => entry[0]);

    for (let turnIndex = 0; turnIndex < turnOrder.length; turnIndex++) {
        const i = arrayOfLeadersAndCountries.findIndex(entry => entry[0] === turnOrder[turnIndex]);
        if (i === -1 || arrayOfLeadersAndCountries[i][2].length === 0) {
            console.log(turnOrder[turnIndex] + " has no territories left and takes no turn");
            continue;
        }

        let fullTerritoriesInRange = [];
        let attackableTerritoriesInRange = [];
        let arrayOfTerritoriesInRangeThreats = []; //[territoryName, [friendlyTerritory1, threatScore]]
        let arrayOfAiPlayerDefenseScoresForTerritories = [];
        let unrefinedTurnGoals = [];
        let refinedTurnGoals = [];

        const leader = arrayOfLeadersAndCountries[i][2][0].leader;
        const leaderTraits = arrayOfLeadersAndCountries[i][2][0].leader.traits;

        currentAiCountry = arrayOfLeadersAndCountries[i][0];
        console.log("Now it is " + currentAiCountry + "'s turn!");

        //Spectator mode. A no-op with one boolean test in an ordinary game; here it
        //snapshots what this country holds and how far the activity log has got, so
        //that the block written at the bottom of this loop can report the economy as
        //a difference and the fighting as the entries in between. It has to be taken
        //BEFORE the campaign is planned, because planning is where the sieges are
        //reviewed and a review can storm a territory.
        beginAiGameCountry(currentAiCountry);

        setAiRngContext(currentTurn(), currentAiCountry);

        //The CAMPAIGN, and it is planned before anything is measured because everything
        //after it is measured against it: which continents this country has committed to
        //taking under the active victory condition, which one it is pushing this turn,
        //what kind of turn this is, and how much war it can afford. See src/ai/strategy.js.
        //
        //It has to come after setAiRngContext(), because the small random term that
        //separates two neighbours with identical standings draws from the seeded
        //per-country stream.
        const campaign = planAiCampaign(currentAiCountry, leader, currentTurn());

        //The sieges this country ALREADY has, reviewed one by one: press on, storm the
        //place, or march the army home. See src/ai/siegeReview.js.
        //
        //It runs here -- after the campaign, before anything is measured -- for two
        //reasons. The verdict needs the campaign posture and odds floors the line above
        //derives. And an assault or a lift changes who owns the target and where an army
        //is standing, so it has to happen before the threat map is built rather than
        //after, or the whole turn is planned against a world one decision out of date.
        reviewAiSieges(currentAiCountry, leader, campaign);

        // TODO: Unblock territories that are no longer deactivated from previous wars
        // Implement once AI can conquer territories

        countryResourceTotals = getCountryResourceTotals()[arrayOfLeadersAndCountries[i][0]];
        turnGainsArrayAi = currentTurn() !== 1 ? getTurnGainsArrayAi()[arrayOfLeadersAndCountries[i][0]] : turnGainsArrayLastTurn;
        fullTerritoriesInRange = buildFullTerritoriesInRangeArray(arrayOfLeadersAndCountries, attackOptionsArray, i);
        attackableTerritoriesInRange = buildAttackableTerritoriesInRangeArray(arrayOfLeadersAndCountries, fullTerritoriesInRange, i);
        attackableTerritoriesInRange = convertAttackableArrayStringsToMainArrayObjects(attackableTerritoriesInRange);
        arrayOfAiPlayerDefenseScoresForTerritories = getFriendlyTerritoriesDefenseScores(arrayOfLeadersAndCountries, currentAiCountry, i);
        arrayOfTerritoriesInRangeThreats = calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory(attackableTerritoriesInRange, arrayOfLeadersAndCountries, fullTerritoriesInRange, arrayOfAiPlayerDefenseScoresForTerritories, i);

        //March the spare army towards the fronts that asked for it last turn, and towards the
        //border of the country this one has committed to absorbing. This is the answer to the
        //TODO that sat below this loop from before the refactor -- "move available army around
        //between available owned territories" -- and it is what lets a country attack with
        //more than whatever one border province could raise by itself.
        //
        //It runs AFTER the threat map, because a move is decided from the threats facing each
        //territory, and BEFORE the goals, so that an army which arrived this turn is counted
        //in this turn's odds rather than sitting idle until the next one.
        musterAiArmies(currentAiCountry, campaign, arrayOfTerritoriesInRangeThreats);
        //The long-term goal is no longer a TODO: it is `campaign.objective`, derived above
        //from the active victory condition. Under the default -- hold three continents
        //outright -- it names the three this country has committed to, and every goal
        //below is weighed against them.
        unrefinedTurnGoals.push(calculateTurnGoals(arrayOfTerritoriesInRangeThreats, campaign));
        refinedTurnGoals = refineTurnGoals(unrefinedTurnGoals, currentAiCountry, leaderTraits);
        refinedTurnGoals = prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits, campaign);
        //Phase 7.4. One collapsed console group per country, printed BEFORE the goals
        //are carried out so a developer can compare the intent against what followed.
        //The forty-odd lines this file and aiCalculations.js already emit per country
        //are a running commentary on gold; none of them said what the country was
        //trying to DO, which is the only question worth asking of an AI turn.
        //
        //This is developer-facing only. The player's view of the same turn is the
        //activity feed, and it deliberately reports outcomes rather than plans -- a
        //panel that showed the AI's intentions would be a cheat.
        //The return value is the same three-horizon view the console prints, so the
        //spectator log and the console groups can never disagree about what a country
        //was trying to do.
        const plan = logAiPlan({
            country: currentAiCountry,
            leader: leader,
            refinedGoals: refinedTurnGoals,
            turn: currentTurn(),
            campaign: campaign
        });
        refinedTurnGoals = await doAiActions(refinedTurnGoals, leader, turnGainsArrayAi, arrayOfTerritoriesInRangeThreats, arrayOfAiPlayerDefenseScoresForTerritories, campaign); //refinedTurnGoals gets returned because can be updated in this function if a bolster job gets deleted after recalculations

        resetAiRngContext();

        //...and the other half of the spectator bracket: write this country's block
        //and then hold the screen on it for as long as the speed slider says. In an
        //ordinary game this returns on the first line without allocating.
        await endAiGameCountry({
            country: currentAiCountry,
            leader: leader,
            campaign: campaign,
            plan: plan,
            //Turn 1 has no AI income pass -- `turnGainsArrayAi` is still the PLAYER's
            //last-turn row at that point, which is the wrong country's numbers rather
            //than merely missing ones. Better to print no income line than a false one.
            turnGains: currentTurn() === 1 ? null : (turnGainsArrayAi ?? null)
        });

        // TODO: If successful, deactivate army stationed in territory for x turns and block the upgrade of territory for the same
        // TODO: Based on threat, move available army around between available owned territories
        //A country does not re-assess its long-term goal here. The campaign is re-derived
        //at the top of its NEXT turn from the world as it then stands, and the commitment
        //behind it is deliberately sticky -- reviewed every CAMPAIGN_REVIEW_INTERVAL turns
        //rather than after every turn, because a plan re-chosen every turn is not a plan.
    }
    //Phase 5.8. A `//DEBUG` block stood here: two calls to a 40-line `logGoldStats()` that
    //sorted, averaged and took the mode of every AI country's spending, twice, on every AI
    //turn, purely to print two lines -- then cleared the arrays it had just measured. It was
    //shipped and it ran in production. The whole chain is gone, arrays included.
    for (let i = 0; i < summaryWarsArray.length; i++) {
        console.log(`%c${summaryWarsArray[i]}`, "color: rgb(0,255,0);");
        if (i < summaryWarsArray.length - 1) {
            console.log("%c------------------", "color: rgb(0,255,0);"); // Line separator
        }
    }
    for (let i = 0; i < summaryWarsLostArray.length; i++) {
        console.log(`%c${summaryWarsLostArray[i]}`, "color: red;");
        if (i < summaryWarsLostArray.length - 1) {
            console.log("%c------------------", "color: red;"); // Line separator
        }
    }
    summaryWarsArray.length = 0;
    summaryWarsLostArray.length = 0;
    console.log("AI DONE!"); // Placeholder message for AI turn completed
    initialiseNewPlayerTurn();

}

/**
 * Roll for this turn's disaster and carry the running probability forward.
 *
 * Phase 5.2 wrote `rollRandomEventLikelihood()` in src/rules/events/randomEvents.js and
 * `randomEventDamageFor()` alongside it, but only the damage half was ever wired up -- so
 * the sample size and the four event NAMES existed in two places, and the names are exactly
 * what audit 5.2 Q was: the construction-materials branch tested for "Forest Fire", which
 * nothing produced, and one of the four disasters did nothing at all. One list now.
 */
function handleRandomEventLikelihood() {
    //Test-only, and only with ?e2e=1: force the NEXT turn to fire a named disaster. A random
    //event is a band on the mean of five draws, so no seed reaches a chosen one on a chosen
    //turn, and the scenario loader sets up the world rather than the turn. Without this the
    //four disasters can only be unit-tested, and what the game DOES with one -- suppressing
    //that turn's regeneration, halving food, taking a quarter of the gold -- goes untested.
    if (forcedRandomEvent) {
        probability = 0;
        return true;
    }
    const result = rollRandomEventLikelihood(probability);
    probability = result.nextProbabilityPercent;
    return result.happening;
}

/** The event a spec has queued for the next turn, or null. See installTestHooks below. */
let forcedRandomEvent = null;

/** The running per-turn chance of a disaster, for the ?e2e=1 harness. */
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
            retrievalArray.splice(i, 1); // Remove the element at index i from retrievalArray
            i--; // Decrement i to account for the removed element
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