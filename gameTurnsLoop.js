import {
    uiAppearsAtStartOfTurn,
    toggleUIMenu,
    endPlayerTurn,
    initialiseNewPlayerTurn,
    toggleTransferAttackButton,
    setCurrentMapColorAndStrokeArray,
    saveMapColorState,
    paths,
    svg,
    setZoomLevel,
    zoomMap, setColorOnMap
} from './ui.js';
import {
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
    phaseName
} from './src/state/phases.js';
import {
    pathCountry
} from './src/state/pathState.js';

// Read-only accessors for the ?e2e=1 harness. Lazy closures, so this runs safely
// at module-evaluation time even though the model is not built yet.
installTestHooks({
    turn: () => currentTurn(),
    phase: () => currentPhase(),
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

export async function initialiseGame() {
    setZoomLevel(1);
    zoomMap("init");
    svg.style.pointerEvents = 'none';
    gameInitialisation = true;
    console.log("Welcome to new game! Your country is " + playerCountryName() + "!");
    const svgMap = document.getElementById('svg-map').contentDocument;
    const paths = Array.from(svgMap.querySelectorAll('path'));

    //Two loops for one fact: the path attribute and then the model field, each over its
    //own collection. One write now, and src/ui/mapAttributeSync.js renders the attribute
    //(Phase 4.4).
    for (const territory of allTerritories()) {
        if (territory.dataName === playerCountryName()) {
            setTerritoryOwner(territory.uniqueId, "Player", territory.dataName);
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
    setCurrentMapColorAndStrokeArray(saveMapColorState(false));
    document.getElementById("top-table-container").style.display = "block";
    toggleTransferAttackButton(true, true);
    changeAllPathsToWhite();
    document.getElementById("move-phase-button").innerHTML = "LOADING...";

    // Attack options for every territory. This used to be an awaited loop that
    // re-fetched and re-parsed the 19 MB closestPathsData.json once per territory
    // -- 359 fetches and roughly 6.8 GB of JSON.parse before turn 1 could start.
    // It is now one 77 KB load and a synchronous pass. See docs/01-codebase-audit.md
    // section 4.1 and docs/03-refactor-plan.md Phase 1.1-1.2.
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

    // Colouring used to be a side effect of the loop above, one territory at a
    // time, which is what produced the visible "loading" sweep across the map.
    for (const territory of allTerritories()) {
        setColorOnMap(territory);
    }

    for (const path of paths) {
        if (pathCountry(path) === playerCountryName()) {
            path.setAttribute("fill", playerColour()); //set player as the owner of the territory they select
        }
    }
    toggleTransferAttackButton(false, true);
    setCurrentMapColorAndStrokeArray(saveMapColorState("true"));
    document.getElementById("popup-color").disabled = true;
    gameInitialisation = false;
    svg.style.pointerEvents = 'auto';

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
    signalReady();

    installPhaseButton();
    turnEngine.start();
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
    if (uiAppearsAtStartOfTurn && currentTurn() !== 1) {
        toggleUIMenu(true);
        drawUITable(document.getElementById("uiTable"), 0);
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
        {
            name: "buyUpgrade",
            waitsForPlayer: true,
            onEnter: () => announcePhase("Handling Spend Upgrade Phase")
        },
        {
            name: "military",
            waitsForPlayer: true,
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

/** The engine, for the test hooks and for whatever offers "New Game" in Phase 7. */
export function getTurnEngine() {
    return turnEngine;
}

/**
 * Let the waiting phase proceed.
 *
 * One listener on `#popup-confirm`, installed once, replaces the three transient ones the
 * phase functions used to add and remove. A click when no phase is waiting -- during the AI
 * turn, or between turns -- is ignored, exactly as it was when the listener did not exist.
 */
function installPhaseButton() {
    const popupConfirmButton = document.getElementById("popup-confirm");
    if (popupConfirmButton) {
        popupConfirmButton.addEventListener("click", () => turnEngine.advancePhase());
    }
}

async function handleAITurn() {
    console.log("Handling AI Turn...");
    document.getElementById("popup-confirm").disabled = true; // Stop the user from clicking the button during the AI turn
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

        setAiRngContext(currentTurn(), currentAiCountry);

        // TODO: Unblock territories that are no longer deactivated from previous wars
        // Implement once AI can conquer territories

        countryResourceTotals = getCountryResourceTotals()[arrayOfLeadersAndCountries[i][0]];
        turnGainsArrayAi = currentTurn() !== 1 ? getTurnGainsArrayAi()[arrayOfLeadersAndCountries[i][0]] : turnGainsArrayLastTurn;
        fullTerritoriesInRange = buildFullTerritoriesInRangeArray(arrayOfLeadersAndCountries, attackOptionsArray, i);
        attackableTerritoriesInRange = buildAttackableTerritoriesInRangeArray(arrayOfLeadersAndCountries, fullTerritoriesInRange, i);
        attackableTerritoriesInRange = convertAttackableArrayStringsToMainArrayObjects(attackableTerritoriesInRange);
        arrayOfAiPlayerDefenseScoresForTerritories = getFriendlyTerritoriesDefenseScores(arrayOfLeadersAndCountries, currentAiCountry, i);
        arrayOfTerritoriesInRangeThreats = calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory(attackableTerritoriesInRange, arrayOfLeadersAndCountries, fullTerritoriesInRange, arrayOfAiPlayerDefenseScoresForTerritories, i);
        // TODO: Check long term goal i.e. destroy x country, or have x territories or have an average defense level of x%, or gain continent x etc
        // implement when long term goal is decided
        unrefinedTurnGoals.push(calculateTurnGoals(arrayOfTerritoriesInRangeThreats));
        refinedTurnGoals = refineTurnGoals(unrefinedTurnGoals, currentAiCountry, leaderTraits);
        refinedTurnGoals= prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits);
        refinedTurnGoals = await doAiActions(refinedTurnGoals, leader, turnGainsArrayAi, arrayOfTerritoriesInRangeThreats, arrayOfAiPlayerDefenseScoresForTerritories); //refinedTurnGoals gets returned because can be updated in this function if a bolster job gets deleted after recalculations

        resetAiRngContext();
        // TODO: If successful, deactivate army stationed in territory for x turns and block the upgrade of territory for the same
        // TODO: Based on threat, move available army around between available owned territories
        // TODO: Assess if turn goal was realised and update long-term goal if necessary
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