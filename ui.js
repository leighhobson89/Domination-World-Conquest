import {
    PROBABILITY_THRESHOLD_FOR_SIEGE
} from './src/config/balance.js';
import {
    scoreDifferenceFor
} from './src/rules/military/siege.js';
import {
    cosmeticRandom
} from './src/platform/cosmeticRng.js';
import {
    getManualAdditions,
    getManualDenials
} from './src/data/manualAdjacencyExceptions.js';
import {
    buildPathIndex,
    getPathByName,
    getPathByUniqueId
} from './src/state/indexes.js';
import {
    renderAllTerritories
} from './src/ui/mapAttributeSync.js';
import {
    installAudioTestHooks,
    installSaveTestHooks
} from './src/platform/testHooks.js';
import {
    getGameInitialisation,
    getTurnEngine,
    initialiseGame,
    resumeSavedGame
} from './gameTurnsLoop.js';
import {
    addPlayerPurchases,
    addPlayerUpgrades,
    addRandomFortsToAllNonPlayerTerritories,
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable,
    allowSelectionOfCountry,
    capacityArray,
    countryStrengthsArray,
    currentlySelectedTerritoryForPurchases,
    currentlySelectedTerritoryForUpgrades,
    demandArray,
    drawUITable,
    formatNumbersToKMB,
    playerOwnedTerritories,
    populateBottomTableWhenSelectingACountry,
    totalConsMats,
    totalGoldPrice,
    totalPopulationCost,
    totalPurchaseGoldPrice,
    vehicleArmyPersonnelWorth,
    writeBottomTableInformation
} from './resourceCalculations.js';
import {
    playSoundClip
} from './sfx.js';
import {
    drawAndHandleTransferAttackTable,
    probability,
    territoryUniqueIds,
    transferArmyOutOfTerritoryOnStartingInvasion,
    transferArmyToNewTerritory,
    transferQuantitiesArray
} from './transferAndAttack.js';
import {
    addAttackingArmyToRetrievalArray,
    addRemoveWarSiegeObject,
    addWarToHistoricWarArray,
    aiSiegeWarsList,
    calculateSiegeScore,
    defendingArmyRemaining,
    defendingTerritory,
    getAttackingArmyRemaining,
    getCurrentRound,
    getCurrentWarId,
    getNextWarId,
    getFinalAttackArray,
    getMassiveAssaultStatus,
    getResolution,
    getRoutStatus,
    getSiegeObjectFromPlayerSiegeList,
    getUpdatedProbability,
    historicWars,
    historicAiWars,
    playerSiegeWarsList,
    playerTurnsDeactivatedArray,
    processRound,
    proportionsOfAttackArray,
    setBattleResolutionOnHistoricWarArrayAfterSiege,
    setCurrentRound,
    setCurrentWarId,
    setFinalAttackArray,
    applySiegeSurvivorsToTerritory,
    setMassiveAssaultStatus,
    setNewWarOnRetrievalArray,
    setNextWarId,
    setResolution,
    setRoutStatus,
    setupBattle,
    setValuesForBattleFromSiegeObject,
    skirmishesPerRound
} from './battle.js';
import {
    removeCanvasIfExist
} from "./dices.js";
import {
    createCpuPlayerObjectAndAddToMainArray,
    updateArrayOfLeadersAndCountries
} from "./cpuPlayerGenerationAndLoading.js";
import {
    setAiResponseFlag
} from "./aiCalculations.js";
import {
    allTerritories,
    getTerritory,
    currentTurn,
    currentPhase,
    playerCountryName,
    playerColour,
    playerTerritories,
} from './src/state/selectors.js';
import {
    setPhase,
    setPlayerCountry,
    setPlayerColour,
    setPlayerFlag,
    setGreyedOutCountries,
    clearGreyedOutCountries,
    setAttackableTerritories,
    clearAttackableTerritories
} from './src/state/mutations.js';
import {
    Phase
} from './src/state/phases.js';
import {
    deriveMoveButtonState,
    stateAfterWindowClosed,
    MoveMode
} from './src/ui/moveButton/deriveMoveButtonState.js';
import {
    attachMapView,
    repaintMap,
    repaintCountrySelection,
    paintLockedCountries
} from './src/ui/map/MapView.js';
import {
    CONTINENT_COLOR_ARRAY,
    assignStartingColours,
    convertHexValueToRGBOrViceVersa,
    startingColourForCountry
} from './src/ui/map/colouring.js';
import {
    attachMarkerLayer,
    attackTargetPath,
    setAttackTarget,
    clearAttackTarget,
    raiseAttackMarker,
    removeSiegeMarker
} from './src/ui/map/markers.js';
import {
    attachCamera,
    zoomMap,
    panMap,
    beginDrag,
    endDrag,
    isDragging,
} from './src/ui/map/camera.js';
import {
    pathIsGreyedOut,
    pathIsUnderSiege,
    pathIsDeactivated,
    pathIsAttackable,
    pathIsPlayerOwned,
    pathOwner,
    pathCountry,
    pathBesieger
} from './src/state/pathState.js';
import {
    dynamicIds,
    indexedIds,
    ids
} from './src/ui/core/registry.js';
import {
    el,
    mount
} from './src/ui/core/dom.js';
import {
    globeIcon,
    mapSheetIcon,
    mountainIcon,
    continentIcon,
    crossedSwordsIcon
} from './src/ui/icons.js';
import {
    tooltip
} from './src/ui/components/Tooltip.js';
import {
    topTable
} from './src/ui/components/TopTable.js';
import {
    phaseBar
} from './src/ui/components/PhaseBar.js';
import {
    mainMenu
} from './src/ui/components/MainMenu.js';
import {
    optionsPanel
} from './src/ui/components/OptionsPanel.js';
import {
    dominapedia
} from './src/ui/components/Dominapedia.js';
import {
    initTheme
} from './src/ui/theme/theme.js';
import {
    countrySelect
} from './src/ui/components/CountrySelect.js';
import {
    moveButton
} from './src/ui/components/MoveButton.js';
import {
    aiDialogue
} from './src/ui/components/AiDialogue.js';
import {
    battleResults
} from './src/ui/components/BattleResults.js';
import {
    battleUI
} from './src/ui/components/BattleUI.js';
import {
    infoTable
} from './src/ui/components/InfoTable.js';
import {
    upgradeWindow
} from './src/ui/components/UpgradeWindow.js';
import {
    buyWindow
} from './src/ui/components/BuyWindow.js';
import {
    transferAttackWindow
} from './src/ui/components/TransferAttackWindow.js';
import {
    bottomTable
} from './src/ui/components/BottomTable.js';
import {
    menuButton
} from './src/ui/components/MenuButton.js';
import {
    confirmDialog
} from './src/ui/components/ConfirmDialog.js';
import {
    saveLoadPanel
} from './src/ui/components/SaveLoadPanel.js';
import {
    saveIndicator
} from './src/ui/components/SaveIndicator.js';
import {
    audioPanel
} from './src/ui/components/AudioPanel.js';
import {
    activityPanel
} from './src/ui/components/ActivityPanel.js';
import {
    aiDebugPanel
} from './src/ui/components/AiDebugPanel.js';
import {
    aiGameConsole
} from './src/ui/components/AiGameConsole.js';
import {
    isAiGameActive,
    startAiGameMode,
    stopAiGameMode
} from './src/debug/aiGameMode.js';
import {
    clearAiGameLog
} from './src/debug/aiGameLog.js';
import {
    clearPlans
} from './src/ai/planRecord.js';
import {
    resetCampaigns
} from './src/ai/strategy.js';
import {
    resetMusters
} from './src/ai/muster.js';
import {
    resetAllWindowPositions
} from './src/ui/core/draggable.js';
import {
    applyAudioSettings,
    audioSettings,
    currentTrackName,
    initAudio,
    isMusicPlaying,
    resumePendingMusic,
    trackList
} from './src/platform/audio.js';
import {
    applyGame,
    autosaveSummary,
    captureGame,
    clearAutosave,
    decodeSave,
    encodeSave,
    hasAutosave,
    newGameBaseline,
    readAutosave,
    startAutosave,
    stopAutosave,
    writeAutosave
} from './src/platform/storage.js';

let currentlySelectedColorsArray = [];

export let pageLoaded = false;

// Resolves once BOTH bootstrap halves have finished:
//
//   1. the DOMContentLoaded handler below, which builds the entire UI and sets
//      `pageLoaded = true`, and
//   2. svgMapLoaded(), which runs on window "load" and is what actually populates
//      `paths` from the SVG document.
//
// Both matter, and they do not finish in a fixed order: DOMContentLoaded fires
// before window load, so `pageLoaded` alone is true while `paths` is still empty.
//
// resourceCalculations.js used to discover readiness by polling `pageLoaded` on an
// 800ms setInterval, from two places. That wasted up to 1.6s of pure idling, and
// the delay was also masking the ordering problem above: by the time a tick fired,
// svgMapLoaded() had usually run. Removing the poll without waiting for the map too
// meant calculatePathAreas() ran against an empty `paths`, leaving allTerritories()
// short and every later territory lookup returning undefined.
// See docs/03-refactor-plan.md Phase 1.4.
let resolveBootstrapReady;
const bootstrapReadyPromise = new Promise(resolve => {
    resolveBootstrapReady = resolve;
});
let uiBuilt = false;
let mapReady = false;

function markBootstrapStage(stage) {
    if (stage === "ui") {
        uiBuilt = true;
    } else {
        mapReady = true;
    }
    if (uiBuilt && mapReady) {
        resolveBootstrapReady();
    }
}

/** Resolves when the UI is built and the SVG map paths are available. */
export function whenPageLoaded() {
    return bootstrapReadyPromise;
}
//`eventHandlerExecuted` and its four `setTimeout(..., 200)` companions are gone
//(Phase 6.6). They were a de-bounce over a listener that was re-installed on every
//territory selection and never removed, so a click fired once per selection made
//since the window opened. There is one listener now, so there is nothing to de-bounce.

export let svg = [];
export let svgCoastLines = [];
export let svgMap = [];
export let svgCoastLinesMap = [];
export let svgTag = [];
export let svgCoastLinesTag = [];
export let paths = [];
export let pathsCoastLines = [];
export let defs = [];
export let patterns = [];

//variables that receive information for resources of country's after database reading and calculations, before game starts
//Phase 4.8. `playerCountryName()`, `playerColour()` and `flag` were `export let`s here: three
//module-level variables that four other files imported as live bindings and only this
//one could assign. They are in GameState now, read through playerCountryName() and
//playerColour(). `flag` is gone entirely -- it was only ever a second name for
//playerCountryName(), assigned on the line after it and never anything else.

//Phase 6.7. `currentMapColorAndStrokeArray` and the save/restore pair that maintained
//it are gone. Colour is a pure function of the store now -- see src/ui/map/MapView.js
//for what that replaced and why. The country palette and the locked-country muting
//moved to src/ui/map/colouring.js with it.
//audit 5.2 Z. This was `COUNTRY_GREYOUT_THRESHOLD = 40000`, compared against the output of
//calculateTerritoryStrengths() -- which min-max normalises every country into 0..10000, so
//the strongest country in the world scores exactly 10000 and nothing could ever exceed
//40000. No country was ever greyed out and the player could start as the United States. The
//trailing `//40` in the old comment suggests the constant predates the normalisation.
//
//Re-scaling the number would only move the guess. The intent -- "the top few countries are
//too strong to play" -- is a RANK, so that is what this expresses. It is stable whatever the
//normaliser does, and it says in one number exactly how many world powers are off limits.
//Measured on a fresh world, the normalised strengths run China 10000, United States 9545,
//India 7965, Indonesia 5697, Russia 4438, then Italy 3504 and a long tail. Five is where
//the superpowers stop: it takes the countries that would make the game trivial and leaves
//every genuine mid-sized power -- Italy, Germany, Japan, the UK -- playable.
const COUNTRY_GREYOUT_RANK = 5; //the N strongest countries cannot be chosen
//PROBABILITY_THRESHOLD_FOR_SIEGE moved to src/config/balance.js (Phase 5.5) and is
//re-exported here, because the AI planner needed it and could not import ui.js.
export { PROBABILITY_THRESHOLD_FOR_SIEGE };

//path selection variables
export let lastClickedPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
lastClickedPath.setAttribute("d", "M0 0 L50 50"); // used for player selection, and for stroke alteration
export let lastClickedPathExternal;
let currentPath; // used for hover, and tooltip before user clicks on a country
export let currentSelectedPath;
let validDestinationsAndClosestPointArray; //populated with valid interaction territories when a particular territory is selected
let validDestinationsArray;
let lastPlayerOwnedValidDestinationsArray;
let closestDistancesArray;
let hoveredNonInteractableAndNonSelectedTerritory = false;
//`colorArray = generateDistinctRGBs()` stood here. It was assigned at module load and
//never read -- dead since before the refactor began. Removed with the rest of the
//colour machinery in Phase 6.7.
let territoriesAbleToAttackTarget;
let originalDefendingTerritory;

// Game States
let bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false; // used for handling popups on screen when game state changes
let uiCurrentlyOnScreen = false;
let outsideOfMenuAndMapVisible = false;
let clickActionsDone = false;
let countrySelectedAndGameStarted = false;
let menuState = true;
let selectCountryPlayerState = false;
let uiButtonCurrentlyOnScreen = false;
let mapModeButtonCurrentlyOnScreen = false;
let aiDialogueContainerCurrentlyOnScreen = false;

export let transferAttackButtonState;
export let upgradeWindowCurrentlyOnScreen = false;
export let buyWindowCurrentlyOnScreen = false;
export let uiAppearsAtStartOfTurn = true;
export let transferAttackButtonDisplayed = false;
export let transferAttackWindowOnScreen = false;
export let attackTextCurrentlyDisplayed = false;
export let battleResultsDisplayed = false;
export let battleUIDisplayed = false;
//Phase 6.7. `territoryAboutToBeAttackedOrSieged` was a module-level `let`, and the
//attack marker was a separate <image> that six call sites removed by hand -- which is
//audit 5.2 AE, the marker surviving a cancel. They are one fact now, owned by
//src/ui/map/markers.js: setting the target draws the marker, clearing it removes it,
//and there is no way to do one without the other. Read it with `attackTargetPath()`.
export let transferToTerritory;
export let battleUIState = 0;

//BATTLE UI STATES
export let retreatButtonState;
export let advanceButtonState;
let battleStart;
let firstSetOfRounds = true;

let defendingTerritoryCopyStart;
let defendingTerritoryCopyEnd;
let roundCounterForStats = 0;
let attackCountry;
let defendTerritory;
let currentWarFlagString;
let territoryStringDefender;

const multiplierForScatterLoss = 0.7;

//This determines how the map will be colored for different game modes
export let mapMode = 1; // 1 - normal 2 - physical

//Zoom variables
//Zoom, pan and the viewBox animation moved to src/ui/map/camera.js in Phase 6.7.
//`shiftedPath` stays here: it is the click-feedback nudge, not a camera concern.
let shiftedPath;

export function setUpgradeOrBuyWindowOnScreenToTrue(upgradeOrBuyParameter) {
    if (upgradeOrBuyParameter === 1) { //upgrade window
        upgradeWindowCurrentlyOnScreen = true;
    } else if (upgradeOrBuyParameter === 2) { //buy window
        buyWindowCurrentlyOnScreen = true;
    }
}

export function svgMapLoaded() {
    console.log("Starting Page Load Process");
    //-------------GLOBAL SVG CONSTANTS AFTER SVG LOADED---------------//
    svg = document.getElementById(ids.svgMap);
    svgCoastLines = document.getElementById(ids.svgCoastLines);
    svgMap = svg.contentDocument;
    svgCoastLinesMap = svgCoastLines.contentDocument;
    svgTag = svgMap.querySelector('svg');
    svgCoastLinesTag = svgCoastLinesMap.querySelector('svg');
    paths = Array.from(svgMap.querySelectorAll('path'));
    pathsCoastLines = Array.from(svgCoastLinesMap.querySelectorAll('path'));
    buildPathIndex(paths); //O(1) uniqueId/name -> path lookups, replaces linear scans
    //Phase 6.7: the map's three concerns each have a module now.
    attachCamera(svgTag, svgCoastLinesTag);
    attachMapView(paths);
    attachMarkerLayer(svgMap);
    //-----------------------------------------------------------------//
    svgCoastLines.setAttribute("tabindex", "0");
    svg.setAttribute("tabindex", "1");
    svg.focus();

    svgMap.addEventListener("mouseover", function(e) {
        // Get the element that was hovered over
        const element = e.target;

        currentPath = element; // Set the current element

        // Call the hoverColorChange function
        if (!pathIsGreyedOut(element)) {
            hoverOverTerritory(element, "mouseOver");
        }

        // Get the name of the country from the "data-name" attribute
        const countryName = pathOwner(element);

        // Add an event listener for mousemove on the element
        element.addEventListener("mousemove", function(e) {
            const x = e.clientX;
            const y = e.clientY;

            //Markers carry `pointer-events: none` (audit 5.3 AW), so the hit test at the
            //centre of a besieged territory returns the PATH, never the siege overlay
            //drawn on top of it. There is deliberately no separate tooltip for the
            //marker: the siege is stated in the territory's own tooltip instead, so the
            //player gets the same fact wherever in the territory they hover.
            tooltip.setContent(territoryTooltipLabel(element, countryName));

            // Check if the mouse pointer is less than 300px from the bottom of the screen
            if (window.innerHeight - y < 100) {
                // Move the tooltip up by 300px
                tooltip.moveTo(x - 40, y - 30);
            } else {
                // Position the tooltip next to the mouse cursor without moving it vertically
                tooltip.moveTo(x - 40, 25 + y);
            }

            // Show the tooltip
            tooltip.show();
        });

        // Add an event listener for mouseout on the element
        element.addEventListener("mouseout", function() {
            // Hide the tooltip when the mouse leaves the element
            tooltip.hide();
        });

        element.style.cursor = "pointer";
    });

    // Add a mouseout event listener to the SVG element
    svgMap.addEventListener("mouseout", function() {
        tooltip.setContent("");
        tooltip.hide();
        if (currentPath) {
            if (!pathIsGreyedOut(currentPath)) {
                hoverOverTerritory(currentPath, "mouseOut"); // Pass the current path element and set mouseAction to 1
            }
        }
        clickActionsDone = false;
    });

    svgMap.addEventListener("keydown", function(e) {
        let isInitialising = getGameInitialisation();
        if (!isInitialising) {
            setUnsetMenuOnEscape(e);
        }
    });

    svgMap.addEventListener("click", function(e) {
        const offsetX = 1;
        const offsetY = 1;
        const newX = e.clientX + offsetX;
        const newY = e.clientY + offsetY;

        const newEvent = new MouseEvent('click', {
            clientX: newX,
            clientY: newY,
        });

        e.target.dispatchEvent(newEvent);

        if (mapMode === 2) {
            exitPhysicalMap();
            for (let i = 0; i < allTerritories().length; i++) {
                if (!selectCountryPlayerState && allTerritories()[i].owner !== "Player") { //set the iterating path to the continent color when it is the last clicked path and the user is not hovering over the last clicked path
                    setColorOnMap(allTerritories()[i]);
                    for (let j = 0; j < paths.length; j++) {
                        if (paths[j].getAttribute("uniqueid") === allTerritories()[i].uniqueId) {
                            setStrokeWidth(paths[j], "1");
                            break;
                        }
                    }
                    break;
                }
            }
        }
        if (!isDragging()) {
            if (e.target.tagName === "rect" && currentPhase() === Phase.MOVE_ATTACK) {
                repaintMap();
                toggleTransferAttackButton(false, false);
                clearAttackTarget();
                transferAttackButtonDisplayed = false;
                attackTextCurrentlyDisplayed = false;
                //remove army image
            }
            if (e.target.tagName === "path") {
                currentPath = e.target;
                //Spectator mode: the map is the index into the log. A country's block
                //appears once a turn among two hundred others, so scrolling to find the
                //one you are watching is the whole cost of watching -- and the country
                //you want is the one whose territory you just pointed at. Read through
                //`pathCountry()` rather than off `data-name`: this is the CURRENT owner
                //and a conquest is exactly the moment the two could disagree.
                //
                //`exact` because this NAMES a country rather than searching for one.
                //The filter is otherwise a substring, which is right for typing and
                //wrong here: clicking anything American showed the United States and
                //the United States Virgin Islands, two countries that merely share a
                //prefix.
                if (isAiGameActive()) {
                    const owner = pathCountry(e.target);
                    if (owner) {
                        aiGameConsole.setFilter(owner, { exact: true });
                    }
                }
                document.getElementById(ids.popupConfirm).style.opacity = "1";
                if (allowSelectionOfCountry) {
                    selectCountry(currentPath, false);
                }
                currentSelectedPath = currentPath;
                if (countrySelectedAndGameStarted) {
                    if (currentPhase() === Phase.MOVE_ATTACK) { //move/deploy phase show interactable countries when clicking a country
                        validDestinationsAndClosestPointArray = findClosestPaths(e.target);
                        if (currentPath.hasAttribute("fill")) {
                            hoverOverTerritory(currentPath, "clickCountry", currentlySelectedColorsArray);
                            currentlySelectedColorsArray.length = 0;
                            validDestinationsArray = validDestinationsAndClosestPointArray.map(dest => dest[0]);
                            closestDistancesArray = validDestinationsAndClosestPointArray.map(dest => dest[2]);
                            let centerOfTargetPath = findCentroidsFromArrayOfPaths(validDestinationsArray[0]);
                            let closestPointOfDestPathArray = getClosestPointsDestinationPaths(centerOfTargetPath, validDestinationsAndClosestPointArray.map(dest => dest[1]));
                            if (pathIsPlayerOwned(e.target)) {
                                validDestinationsArray = highlightInteractableCountriesAfterSelectingOne(currentSelectedPath, closestPointOfDestPathArray, validDestinationsArray, closestDistancesArray, false);
                                lastPlayerOwnedValidDestinationsArray = validDestinationsArray;
                            } else {
                                territoriesAbleToAttackTarget = highlightInteractableCountriesAfterSelectingOne(currentSelectedPath, closestPointOfDestPathArray, validDestinationsArray, closestDistancesArray, true); //extract rows to put in attacking table
                                territoriesAbleToAttackTarget = territoriesAbleToAttackTarget.filter(territoryCandidate => {
                                    const owner = pathOwner(territoryCandidate);
                                    return owner === "Player";
                                });
                            }
                            handleMovePhaseTransferAttackButton(e.target, lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, lastClickedPath, false, 2);
                        }
                    } else if (currentPhase() === Phase.AI) {

                    }
                } else { //if on country selection screen
                    document.getElementById(ids.popupColor).style.display = "block";
                }
            }
        }
    });

    svgMap.addEventListener("wheel", zoomMap);

    svgMap.addEventListener('mousedown', function(e) {
        if (!isDragging()) {
            if (e.target.tagName === "path") {
                shiftedPath = e.target;
                shiftPath(shiftedPath, 2, 2);
                modifyFill(shiftedPath, true);
            } else {
                shiftedPath = null;
            }
        }

        beginDrag(e);
    });

    svgMap.addEventListener('mousemove', function(e) {
        if (tooltip.content() !== "") {
            tooltip.show();
        } else {
            tooltip.hide();
        }
        panMap(e);
    });

    svgMap.addEventListener('mouseup', function(e) {
        endDrag(e);
        if (!isDragging()) {
            shiftPath(shiftedPath, -2, -2);
            modifyFill(shiftedPath, false);
        }
    });

    //Phase 6.7. Runs inside the bootstrap window, so it groups by `pathCountry()`,
    //which reads the attribute while the store is still empty. See CLAUDE.md.
    assignStartingColours(paths, pathCountry);

    markBootstrapStage("map"); //`paths` is now populated; see whenPageLoaded()

    console.log("loaded!");
}


function selectCountry(country, escKeyEntry) {
    if (!pathIsGreyedOut(country)) {
        if (!pathIsUnderSiege(country)) {
            const deactivatedPaths = paths.filter(path => pathIsDeactivated(path));

            if (deactivatedPaths.length > 0) { //make sure order correct for deactivated paths
                const lowestIndex = paths.indexOf(deactivatedPaths[0]);
                svgMap.documentElement.insertBefore(country, paths[lowestIndex]);
            } else {
                svgMap.documentElement.appendChild(country);
            }
        } else {
            const siegedPaths = paths.filter(path => pathIsUnderSiege(path));

            if (siegedPaths.length > 0) { //make sure order correct for sieged paths
                const lowestIndex = paths.indexOf(siegedPaths[0]);
                svgMap.documentElement.insertBefore(country, paths[lowestIndex]);
            } else {
                svgMap.documentElement.appendChild(country);
            }
        }

        if (selectCountryPlayerState && !escKeyEntry) { //in select country state, colour territory and other connected clicked on
            for (let i = 0; i < paths.length; i++) {
                if (pathCountry(paths[i]) === pathCountry(country)) {
                    if (pathCountry(country) !== pathCountry(lastClickedPath)) {
                        paths[i].setAttribute('fill', playerColour());
                    }
                }
            }
        } else if (!selectCountryPlayerState && !escKeyEntry) { // in game state, colour player territories when clicked on
            for (let i = 0; i < paths.length; i++) {
                if (pathIsPlayerOwned(paths[i])) {
                    paths[i].setAttribute('fill', playerColour());
                    if (attackTargetPath()) {
                        moveButton.hideDestination();
                        attackTextCurrentlyDisplayed = false;
                        clearAttackTarget();
                    }
                }
            }
        }

        if (lastClickedPath.hasAttribute("fill") && !escKeyEntry) { //if a territory has previously been clicked, handle deselecting previous
            for (let i = 0; i < paths.length; i++) {
                if ((paths[i].getAttribute("uniqueid") === lastClickedPath.getAttribute("uniqueid")) && pathIsPlayerOwned(paths[i]) && !pathIsDeactivated(country)) { //set the iterating path to the player color when clicking on any path and the iterating path is a player territory
                    paths[i].setAttribute('fill', playerColour());
                } else if (!selectCountryPlayerState && (paths[i].getAttribute("uniqueid") === lastClickedPath.getAttribute("uniqueid")) && !pathIsPlayerOwned(paths[i]) && currentPath !== lastClickedPath) { //set the iterating path to the continent color when it is the last clicked path and the user is not hovering over the last clicked path
                    if (mapMode === 1) {
                        for (let j = 0; j < allTerritories().length; j++) {
                            if (allTerritories()[j].uniqueId === paths[i].getAttribute("uniqueid")) {
                                setColorOnMap(allTerritories()[j]);
                                break;
                            }
                        }
                    } else if (mapMode === 2) {
                        exitPhysicalMap();
                        for (let j = 0; j < allTerritories().length; j++) {
                            if (allTerritories()[j].uniqueId === paths[i].getAttribute("uniqueid")) {
                                setColorOnMap(allTerritories()[j]);
                                break;
                            }
                        }
                    }
                    setStrokeWidth(paths[i], "1");
                } else if (selectCountryPlayerState && pathCountry(country) !== pathCountry(lastClickedPath)) {
                    for (let j = 0; j < paths.length; j++) {
                        if (pathCountry(lastClickedPath) === pathCountry(paths[j]) && !pathIsGreyedOut(lastClickedPath)) {
                            for (let k = 0; k < allTerritories().length; k++) {
                                if (allTerritories()[k].uniqueId === lastClickedPath.getAttribute("uniqueid")) {
                                    setColorOnMap(allTerritories()[k], true);
                                    break;
                                }
                            }
                            setStrokeWidth(paths[j], "1");
                        }
                    }
                }
            }
        }
    } else {
        if (lastClickedPath.hasAttribute("fill") && !escKeyEntry && !pathIsGreyedOut(lastClickedPath) && pathIsGreyedOut(country)) {
            for (let i = 0; i < allTerritories().length; i++) {
                if (allTerritories()[i].uniqueId === lastClickedPath.getAttribute("uniqueid")) {
                    //Phase 5.8. `true` -- the country-selection form. This called
                    //setColorOnMap() with no second argument, which takes the IN-GAME branch
                    //and paints `territory.countryColor`. That field is not filled in until
                    //pushColorsToMainArray() runs on confirm, so during selection it is
                    //undefined: clicking a playable country and then a locked one wrote
                    //fill="undefined" onto the country you had just picked, and an invalid
                    //fill renders BLACK. The sibling branch above always passed `true`.
                    setColorOnMap(allTerritories()[i], true);
                    break;
                }
            }
        }
    }

    if (!clickActionsDone) {
        populateBottomTableWhenSelectingACountry(country);

        if (!escKeyEntry) {
            if (lastClickedPath.getAttribute('d') !== 'M0 0 L50 50') {
                if (!pathIsDeactivated(lastClickedPath) && !pathIsUnderSiege(lastClickedPath)) {
                    lastClickedPath.parentNode.insertBefore(lastClickedPath, lastClickedPath.parentNode.children[9]);
                }
                if (lastClickedPath.getAttribute("uniqueid") !== currentPath.getAttribute("uniqueid") && !pathIsPlayerOwned(lastClickedPath) && !pathIsUnderSiege(lastClickedPath)) {
                    setStrokeWidth(lastClickedPath, "1");
                }
            }
        }
        lastClickedPathExternal = lastClickedPath;
        lastClickedPath = country; // Update the previously clicked path

        if (selectCountryPlayerState && !escKeyEntry) {
            //Phase 5.8. This block sits OUTSIDE the `!pathIsGreyedOut(country)` guard that
            //opens this function -- that guard closes above, at the end of the z-ordering
            //and colouring section -- so it used to name any country the player clicked and
            //offer the confirm button, with a separate `fill === GREY_OUT_COLOR` test after
            //it as the only thing that took the button away again. Gating the lock on a
            //fill string made it bypassable in three clicks: click a locked country, change
            //the colour picker (which repaints `pathCountry(lastClickedPath)` and, via
            //restoreMapColorState(), every other locked country too), click it again -- the
            //fill no longer matched, so the button appeared and the player started as the
            //United States. The lock is state; ask the state. See audit 5.2 Z.
            countrySelect.nameCountry(pathCountry(country), { locked: pathIsGreyedOut(country) });
        }

        clickActionsDone = true;
    }
    window.focus();
}

document.addEventListener("DOMContentLoaded", function() {
    //The player's remembered theme, applied BEFORE any component is built. The
    //tokens all have defaults in style.css so there is no unstyled flash either
    //way, but applying first means the menu is painted once rather than twice.
    //A theme is a map of CSS custom properties written onto the root element;
    //nothing below knows which theme is in force.
    initTheme();

    //The remembered volumes and mutes, read before anything can make a noise.
    //This does NOT start the music even when the player left it playing: a browser
    //refuses `play()` until the page has been interacted with, so the attempt is
    //hung off the first gesture instead -- see `resumePendingMusic()` below.
    initAudio();
    //Installed here rather than in `beginAutosaving()` -- the audio panel exists from
    //the main menu onwards, so a spec must be able to read the settings before any
    //game has been started. `installTestHooks()` (gameTurnsLoop.js) has already put
    //`window.__game` there by this point; without ?e2e=1 this is a no-op.
    installAudioTestHooks({
        audio: () => audioSettings(),
        setAudio: (settings) => applyAudioSettings(settings),
        audioTracks: () => trackList(),
        currentTrack: () => currentTrackName(),
        musicPlaying: () => isMusicPlaying(),
    });

    //Phase 6.3. The tooltip owns its own element now -- it is no longer a <div> in
    //index.html reached through named window access. Created first because every
    //other component's hover handlers push content into it.
    tooltip.create();

    //Phase 7.2/7.3. Four components that all belong to the menu rather than to the
    //turn loop. They create their own containers, so there is nothing in index.html
    //for them and destroying one leaves no orphan <div>.
    confirmDialog.create();
    saveIndicator.create();
    //THE DOMINAPEDIA (Phase 7.6)
    //The manual, and the last main-menu button to be wired -- it was an inert
    //"Help" until now. Created here rather than on first open for the same reason
    //the Options panel is: the panel it builds is themed, and building it under
    //the player's stored theme costs nothing at bootstrap and avoids a first open
    //that paints in the default palette and then corrects itself.
    dominapedia.create({ onSound: () => playSoundClip("button") });
    saveLoadPanel.create({
        captureSave() {
            const save = captureGame();
            return save ? encodeSave(save) : null;
        },
        applySave: loadGameFromCode,
        //"In progress" means the player is past the main menu, which includes the
        //country-selection screen -- backing out of that is a decision too.
        isGameInProgress: () => outsideOfMenuAndMapVisible,
    });
    //The music-note button and its floating panel. It is chrome over the map, so
    //it takes the "switch" clip like the rest of the chrome; the buttons INSIDE
    //the panel are ordinary window buttons and take the other one, which is why
    //the component is handed a sound callback rather than choosing for itself.
    audioPanel.create({ onSound: () => playSoundClip("button") });
    //THE MILITARY ACTIVITY FEED (Phase 7.4)
    //A window of its own rather than a fifth tab of the info panel: it answers a
    //different question -- the info panel is the state of the world, this is what
    //just happened to it -- and the brief asks for it to open ON TOP of that panel
    //at the start of a turn, which a tab cannot do. `playSoundClip("switch")` is
    //map chrome's sound; the panel's own buttons use it too, because the whole
    //thing is one control surface.
    activityPanel.create({ onSound: () => playSoundClip("switch") });

    //THE AI DEBUG WINDOW. Developer-facing, and deliberately keyboard-only: numpad /
    //toggles it. It has no button over the map because it is not part of the game, and
    //map chrome that opens a debug view is map chrome a player will click. Creating it
    //here only installs the key handler and the (hidden) window; nothing renders until
    //it is opened. See src/ui/components/AiDebugPanel.js.
    aiDebugPanel.create();

    //THE SPECTATOR CONSOLE. Opened only by "AI Game" on the menu, and closed by
    //leaving that mode -- it has no chrome button for the same reason the AI debug
    //window has none. Its X button STOPS the mode rather than merely hiding the
    //window: a self-playing game with its console shut is a page that looks idle
    //while two hundred countries fight behind it, and nothing would bring it back.
    aiGameConsole.create({
        onSound: () => playSoundClip("button"),
        onStop: () => void endAiGame()
    });

    //A browser will not start audio until the page has been interacted with, so
    //the very first click is the earliest moment the music the player left running
    //can be put back on. `resumePendingMusic()` is idempotent -- after the first
    //attempt it does nothing -- which is what makes it safe to hang off `capture`
    //on the document and never take off again.
    document.addEventListener("pointerdown", () => void resumePendingMusic(), { capture: true });

    //The hamburger is the same door Escape has always opened, with a handle on it.
    menuButton.create({
        onOpen() {
            //Map chrome, so it takes the switch clip rather than the button one.
            playSoundClip("switch");
            openInGameMenu();
        },
    });

    //MENU CONTAINER
    mainMenu.create({
        async onNewGame() {
            playSoundClip("button");
            //Restart is New Game, exactly as before -- what is new is that it now
            //asks first, because from inside a running game it destroys that game.
            if (outsideOfMenuAndMapVisible) {
                const proceed = await confirmDialog.open({
                    title: "Start a new game?",
                    message:
                        "Your current game will be lost. If you want to keep it, cancel " +
                        "and take a save code from Save / Load first.",
                    confirmLabel: "New Game",
                });
                if (!proceed) {
                    return;
                }
            }
            await startNewGame();
        },
        onOptions() {
            playSoundClip("button");
            optionsPanel.open();
        },
        //The Options panel's own controls. Menu items and the buttons inside a
        //window both take "button"; only the chrome over the map takes the other.
        onSound() {
            playSoundClip("button");
        },
        onResume() {
            playSoundClip("button");
            resumeFromMenu();
        },
        onSaveLoad() {
            playSoundClip("button");
            saveLoadPanel.open();
        },
        onDominapedia() {
            playSoundClip("button");
            dominapedia.open();
        },
        //The debug entry. It throws away whatever game is running for the same
        //reason New Game does, so it asks the same question first.
        async onAiGame() {
            playSoundClip("button");
            if (outsideOfMenuAndMapVisible) {
                const proceed = await confirmDialog.open({
                    title: "Watch an AI-only game?",
                    message:
                        "Your current game will be lost. If you want to keep it, cancel " +
                        "and take a save code from Save / Load first.",
                    confirmLabel: "AI Game",
                });
                if (!proceed) {
                    return;
                }
            }
            await startAiGame();
        },
    });

    //MAP POPUP WITH CONFIRM BUTTON
    //Phase 6.3. The bar builds itself and derives its own title and button label
    //from the phase, so setPhase() is now the only call a phase transition makes.
    const popupWithConfirmContainer = phaseBar.create({
        onSound: () => playSoundClip("switch"),
        onColourLabelClick() {
            playSoundClip("switch");
            //Toggle, not show. The grid is a panel that stays open while the player
            //picks -- that is what makes choosing against the live map possible --
            //so the control that opened it has to be the one that closes it.
            countrySelect.togglePicker();
        },
    });
    const popupConfirm = phaseBar.buttonElement();

    //MAP CHROME
    //Phase 7.4. Three PNG buttons became two drawn ones. Both take the hamburger's
    //box (`.chrome-button`) so the furniture over the map is one design rather than
    //three, and both are SVG inside, so a theme reaches them -- which no PNG did.
    //
    //The continent-view button carries all three icons and shows one, chosen by
    //`data-view`; swapping a `src` was what made the old pair impossible to assert
    //on without naming a file. `updateContinentViewButton()` is the only writer.
    mount(
        ids.mapModeContainer,
        el(
            "button",
            {
                id: ids.continentViewButton,
                class: "chrome-button continent-view-button",
                attrs: { type: "button", "aria-label": "Continent view" },
                on: {
                    click() {
                        playSoundClip("switch");
                        cycleContinentView();
                    },
                },
            },
            [mapSheetIcon(), mountainIcon(), continentIcon()]
        )
    );
    updateContinentViewButton();

    mount(
        ids.uiButtonContainer,
        el(
            "button",
            {
                id: ids.uiToggleButton,
                class: "chrome-button info-panel-button",
                attrs: { type: "button", "aria-label": "Territories and upgrades", title: "Territories, army and wars" },
                on: {
                    click() {
                        playSoundClip("switch");
                        if (uiCurrentlyOnScreen) {
                            toggleUIMenu(false);
                        } else {
                            toggleUIMenu(true);
                            infoTable.setActiveTab("summary");
                        }
                    },
                },
            },
            globeIcon()
        )
    );

    countrySelect.create({
        onColourChange() {
            if (mapMode === 2) {
                exitPhysicalMap();
            }
            setPlayerColour(convertHexValueToRGBOrViceVersa(countrySelect.colour(), 0));

            if (selectCountryPlayerState) {
                //Phase 6.7. This was a restore, then a loop painting the new colour onto
                //the clicked country, then paintLockedCountries() to put back the lock the
                //restore had just lifted off all five locked countries. One pass says the
                //same thing: each country takes its base colour, a locked one takes the
                //muted form of it, and the picked one takes the player's colour. A locked
                //country is never the picked one, which is what audit 5.3 AX turned on.
                repaintCountrySelection(
                    pathIsGreyedOut(lastClickedPath) ? null : pathCountry(lastClickedPath)
                );
            } else if (countrySelectedAndGameStarted) {
                repaintMap();
            }
        },
    });

    // add event listener to popup confirm button
    popupConfirm.addEventListener("click", async function() {
        playSoundClip("switch");
        if (selectCountryPlayerState) {
            document.getElementById(ids.popupColor).style.display = "none";
            //The swatch grid is a floating panel with nothing behind it, so it does not
            //close itself when the control that opened it is hidden. Leaving it up would
            //strand it over the map for the rest of the game.
            countrySelect.closePicker();
            setAllGreyedOutAttributesToFalseOnGameStart();
            selectCountryPlayerState = false;
            countrySelectedAndGameStarted = true;
            phaseBar.dimBody();
            setPlayerCountry(phaseBar.bodyText());
            setPlayerFlag(playerCountryName());
            setFlag(playerCountryName(), 1); //set player flag in top table
            setFlag(playerCountryName(), 3); //set player flag in ui info panel
            //Phase 6.7. Was `restoreMapColorState(currentMapColorAndStrokeArray, true)`:
            //replay the bootstrap snapshot over every country EXCEPT the selected one.
            //Stated as a fact about each country instead -- and the locks have just been
            //cleared by setAllGreyedOutAttributesToFalseOnGameStart(), so this is the
            //first repaint where nothing is muted.
            repaintCountrySelection(playerCountryName());
            phaseBar.setMode(phaseBar.Mode.INITIALISING);
            pushColorsToMainArray();
            updateArrayOfLeadersAndCountries();
            await initialiseGame();
            topTable.setHeading("Total Player Resources:");
            document.getElementById(ids.popupColor).style.display = "block";
            document.getElementById(ids.popupWithConfirmContainer).style.display = "block";
            uiButtonCurrentlyOnScreen = true;
            toggleUIButton(true);
            mapModeButtonCurrentlyOnScreen = true;
            toggleMapModeButton(true);
            createCpuPlayerObjectAndAddToMainArray();
            addRandomFortsToAllNonPlayerTerritories();
            //Phase 4.6. This button used to walk its own counter, `turnPhase`, one step
            //AHEAD of the `currentTurnPhase` the rest of the game read, and push the old
            //value across on each click. Two counters for one fact, only ever in step by
            //convention. The button now reads and writes the single phase in GameState,
            //and since Phase 6.3 the bar's own text follows from that one write.
            phaseBar.setMode(phaseBar.Mode.PLAYING);
            setPhase(Phase.BUY_UPGRADE);
            //Phase 7.3. From here the game autosaves on a timer. A loaded game starts
            //it from applyLoadedGame() for the same reason -- both are "a game is now
            //running", and nothing else in the file is.
            beginAutosaving();
        } else if (countrySelectedAndGameStarted && currentPhase() === Phase.BUY_UPGRADE) {
            setPhase(Phase.MOVE_ATTACK);
        }
        else if (countrySelectedAndGameStarted && currentPhase() === Phase.MOVE_ATTACK) {
            for (let i = 0; i < paths.length; i++) {
                if (!pathIsPlayerOwned(paths[i])) {
                    for (let j = 0; j < allTerritories().length; j++) {
                        if (allTerritories()[j].uniqueId === paths[i].getAttribute("uniqueid")) {
                            setColorOnMap(allTerritories()[j]);
                            break;
                        }
                    }
                }
            }
        }
    });

    mount(ids.popupWithConfirmContainer, popupWithConfirmContainer);

    //TOP TABLE
    //Phase 6.3. Two hundred lines of createElement moved to
    //src/ui/components/TopTable.js. The capacity and demand figures its hover text
    //needs are injected rather than imported, so the component does not pull the
    //economy into the UI layer.
    topTable.create({
        playerCountryName,
        capacities: () => capacityArray,
        demands: () => demandArray,
        formatNumber: formatNumbersToKMB,
    });

    //------------------------------------------AI DIALOGUE-----------------------------------------------//
    //Phase 6.3. Moved to src/ui/components/AiDialogue.js. The three response
    //buttons all call the same handler with a different number: 0 accept,
    //1 refuse, 9 accept every remaining row.
    aiDialogue.create({ onResponse: setAiResponseFlag });

    //------------------------------------------------------------------------------------------------//

    //MAIN UI
    //Phase 6.3. The panel chrome -- tab strip, checkbox, close button, the panel
    //around the table -- moved to src/ui/components/InfoTable.js. What goes IN
    //the table is still drawUITable(), which Phase 6.4 breaks up; the component
    //calls it with the tab index the player clicked.
    infoTable.create({
        drawTable: drawUITable,
        onTabClick: () => playSoundClip("switch"),
        onClose() {
            playSoundClip("button");
            toggleUIMenu(false);
            uiCurrentlyOnScreen = false;
        },
        onToggleStartOfTurn() {
            playSoundClip("button");
            uiAppearsAtStartOfTurn = toggleUIToAppearAtStartOfTurn(uiAppearsAtStartOfTurn);
        },
    });
    //UPGRADE WINDOW / BUY MENU
    //Phase 6.3. Both were 190 lines of createElement differing only in class
    //prefixes, ids, title and icons. They are one builder now --
    //src/ui/components/ResourceWindow.js -- configured by two specs. The bottom
    //button still asks its own label what it means; making that a derived state
    //is Phase 6.6's shape of problem, not this one's.
    upgradeWindow.create({
        onClose() {
            playSoundClip("button");
            toggleUpgradeMenu(false);
            upgradeWindowCurrentlyOnScreen = false;
        },
        onConfirm() {
            playSoundClip("button");
            if (upgradeWindow.confirmButton().innerHTML === "Confirm") {
                addPlayerUpgrades(
                    upgradeWindow.tableElement(),
                    currentlySelectedTerritoryForUpgrades,
                    totalGoldPrice,
                    totalConsMats
                );
            }
            toggleUpgradeMenu(false);
            upgradeWindowCurrentlyOnScreen = false;
        },
    });

    buyWindow.create({
        onClose() {
            playSoundClip("button");
            toggleBuyMenu(false);
            buyWindowCurrentlyOnScreen = false;
        },
        onConfirm() {
            playSoundClip("button");
            if (buyWindow.confirmButton().innerHTML === "Confirm") {
                addPlayerPurchases(
                    buyWindow.tableElement(),
                    currentlySelectedTerritoryForPurchases,
                    totalPurchaseGoldPrice,
                    totalPopulationCost
                );
            }
            toggleBuyMenu(false);
            buyWindowCurrentlyOnScreen = false;
        },
    });

    // MOVE PHASE BUTTON
    //Phase 6.3. The button and its destination strip are one component. What the
    //button SAYS is decided by deriveMoveButtonState() since Phase 6.6, which also
    //made its click, mouseover and mouseout listeners install ONCE, here, rather than
    //being re-attached on every territory selection.
    const transferAttackButton = moveButton.create();
    installMoveButtonHandlers();

    // TRANSFER / ATTACK WINDOW
    //Phase 6.3. The shell moved to src/ui/components/TransferAttackWindow.js.
    //What goes IN the table is still drawAndHandleTransferAttackTable(), which
    //Phase 6.5 splits into a transfer renderer and an attack renderer.
    transferAttackWindow.create({
        onClose() {
            if ((transferAttackButtonState === 0 && transferAttackButton.innerHTML === "CONFIRM") || (transferAttackButtonState === 1 && (transferAttackButton.innerHTML === "CONFIRM" || transferAttackButton.innerHTML === "INVADE!" || transferAttackButton.innerHTML === "CANCEL"))) {
                transferAttackButton.style.fontWeight = "normal";
                transferAttackButton.style.color = "white";
                if (transferAttackButtonState === 1) {
                    setAttackProbabilityOnUI(0, 0);
                    territoryUniqueIds.length = 0;
                }
            }
            playSoundClip("button");
            toggleTransferAttackWindow(false);
            transferAttackWindowOnScreen = false;
            toggleUIButton(true);
            uiButtonCurrentlyOnScreen = true;
            toggleMapModeButton(true);
            mapModeButtonCurrentlyOnScreen = true;
            toggleBottomLeftPaneWithTurnAdvance(true);
            bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
            handleMovePhaseTransferAttackButton("xButtonClicked", lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, lastClickedPath, true, transferAttackButtonState);
        },
    });

    //BATTLE UI
    //Phase 6.3. Moved to src/ui/components/BattleUI.js. The buttons' listeners
    //stay here -- Advance walks a state machine over rounds, sieges and routs,
    //and moving that would mean moving the battle itself.
    battleUI.create();
    const { retreat: retreatButton, advance: advanceButton, assault: siegeBottomBarButton, siege: siegeButton } =
        battleUI.buttons();

    //BATTLE RESULTS WINDOW
    //Phase 6.3. Moved to src/ui/components/BattleResults.js, where the three
    //rows of eight index-named cells are three loops rather than seventy-two
    //statements. The confirm button's handlers stay here -- what "accept" means
    //depends on whether the battle was won.
    battleResults.create();

    retreatButton.addEventListener('mouseover', function() {
        if (!retreatButton.disabled) {
            retreatButton.style.backgroundColor = "rgb(151, 68, 68)";
        }
    });

    retreatButton.addEventListener('mouseout', function() {
        if (!retreatButton.disabled) {
            retreatButton.style.backgroundColor = "rgb(131, 38, 38)";
        }
    });

    advanceButton.addEventListener('mouseover', function() {
        if (!advanceButton.disabled) {
            advanceButton.style.backgroundColor = "rgb(30,158,30)";
        }
    });

    advanceButton.addEventListener('mouseout', function() {
        if (!advanceButton.disabled) {
            advanceButton.style.backgroundColor = "rgb(0,128,0)";
        }
    });

    siegeButton.addEventListener('mouseover', function() {
        if (!siegeButton.disabled) {
            siegeButton.style.backgroundColor = "rgb(144,118,78)";
        }
    });

    siegeButton.addEventListener('mouseout', function() {
        if (!siegeButton.disabled) {
            siegeButton.style.backgroundColor = "rgb(114, 88, 48)";
        }
    });

    siegeButton.addEventListener('click', function() {
        let currentWarAlreadyInSiegeMode = false;
        let currentWarId = getCurrentWarId();

        // Search the playerSiegeWarsList for the warId
        for (let territoryName in playerSiegeWarsList) {
            if (aiSiegeWarsList.hasOwnProperty(territoryName)) {
                currentWarAlreadyInSiegeMode = true;
                break;
            }
        }

        //turn off battle ui and activate map again
        toggleBattleUI(false, true);
        battleUIDisplayed = false;
        toggleUIButton(true);
        uiButtonCurrentlyOnScreen = true;
        toggleMapModeButton(true);
        mapModeButtonCurrentlyOnScreen = true;
        toggleBottomLeftPaneWithTurnAdvance(true);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;

        if (!currentWarAlreadyInSiegeMode) {
            let territoryToAddToSiege = addRemoveWarSiegeObject(0, currentWarId, battleStart); // add to siege
            let mainArrayElementForSiege = applySiegeSurvivorsToTerritory(getSiegeObjectFromPlayerSiegeList(territoryToAddToSiege));
            writeBottomTableInformation(mainArrayElementForSiege, true, null);

            //`underSiege` is not set here any more. addRemoveWarSiegeObject() above put
            //the siege in the store, and the attribute is derived from the siege lists
            //and rendered by src/ui/mapAttributeSync.js (Phase 4.4/4.5).

            //Phase 5.8. `addImageToPath(..., "siege.png", 1)` stood here. Phase 4.5 moved
            //marker rendering to src/ui/siegeOverlay.js, driven by `siegeChanged` -- which
            //`addRemoveWarSiegeObject()` above has already emitted. This line therefore
            //appended a SECOND <image> carrying the same `siegeImage_<name>` id: a
            //duplicated id, two overlays stacked on one territory, and only one of them
            //removed when the siege ended. The marker is rendered from state now.
            clearAttackTarget();

        }
    });

    //click handler for retreat button
    retreatButton.addEventListener('click', function() {
        for (let i = 0; i < allTerritories().length; i++) {
            if (allTerritories()[i].uniqueId === lastClickedPath.getAttribute("uniqueid")) {
                setColorOnMap(allTerritories()[i]);
                break;
            }
        }
    lastClickedPath.style.stroke = "rgb(0,0,0)";
    lastClickedPath.setAttribute("stroke-width", "1");
    lastClickedPath.style.strokeDasharray = "none";
        let defendingTerritoryRetreatClick;
        for (let i = 0; i < allTerritories().length; i++) {
            if (allTerritories()[i].uniqueId === attackTargetPath().getAttribute("uniqueid")) {
                defendingTerritoryRetreatClick = allTerritories()[i];
            }
        }
        setDefendingTerritoryCopyStart(defendingTerritoryRetreatClick);
        let attackingArmyRemaining = getAttackingArmyRemaining();
        let defeatType;
        let currentWarId = getCurrentWarId();
        let warArrayToRetrieveLater = addAttackingArmyToRetrievalArray(attackingArmyRemaining, proportionsOfAttackArray);
        switch (retreatButtonState) {
            case 0: //before battle or between rounds of 5 - no penalty
                defeatType = "retreat"; //also pull out from siege before starting assault
                //A no-penalty retreat returns the committed army whether or not this
                //battle was opened from INVADE!. Before audit 5.1 AD was closed the
                //source was never debited, so failing to queue the retrieval here cost
                //the player nothing; now it would quietly destroy the army.
                setNewWarOnRetrievalArray(currentWarId, warArrayToRetrieveLater, currentTurn(), 1);
                if (!battleStart) {
                    proportionsOfAttackArray.length = 0;
                    defendingTerritoryRetreatClick.infantryForCurrentTerritory = defendingArmyRemaining[0];
                    defendingTerritoryRetreatClick.assaultForCurrentTerritory = defendingArmyRemaining[1];
                    defendingTerritoryRetreatClick.airForCurrentTerritory = defendingArmyRemaining[2];
                    defendingTerritoryRetreatClick.navalForCurrentTerritory = defendingArmyRemaining[3];
                    defendingTerritoryRetreatClick.armyForCurrentTerritory = defendingTerritoryRetreatClick.infantryForCurrentTerritory + (defendingTerritoryRetreatClick.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (defendingTerritoryRetreatClick.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (defendingTerritoryRetreatClick.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
                    //update top table army value when leaving battle

                } else {
                    addWarToHistoricWarArray("Retreat", 0, true);
                }

                if (battleUIState === 1) { //removing a siege
                    let war = getSiegeObjectFromPath(attackTargetPath());
                    if (war) { //handle case where retreat after coming back from a siege
                        addRemoveWarSiegeObject(1, war.warId); // remove war from siegeArray and add to historic array
                        removeSiegeImageFromPath(attackTargetPath());
                        //siege removed from the store above; `underSiege` follows (Phase 4.4)
                        //army is restored already by assignProportionsToTerritories in case "0"
                    }
                }
                //update bottom table for defender
                bottomTable.update({ army: formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory, 0) });
                break;
            case 1: //scatter during round of 5, 30% penalty
                defeatType = "scatter";
                for (let i = 0; i < attackingArmyRemaining.length; i++) {
                    attackingArmyRemaining[i] = Math.floor(attackingArmyRemaining[i] * multiplierForScatterLoss); //apply penalty
                }
                setNewWarOnRetrievalArray(currentWarId, warArrayToRetrieveLater, currentTurn(), 2);
                proportionsOfAttackArray.length = 0;

                defendingTerritoryRetreatClick.infantryForCurrentTerritory = defendingArmyRemaining[0];
                defendingTerritoryRetreatClick.assaultForCurrentTerritory = defendingArmyRemaining[1];
                defendingTerritoryRetreatClick.airForCurrentTerritory = defendingArmyRemaining[2];
                defendingTerritoryRetreatClick.navalForCurrentTerritory = defendingArmyRemaining[3];
                defendingTerritoryRetreatClick.armyForCurrentTerritory = defendingTerritoryRetreatClick.infantryForCurrentTerritory + (defendingTerritoryRetreatClick.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (defendingTerritoryRetreatClick.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (defendingTerritoryRetreatClick.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);

                bottomTable.update({ army: formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory, 0) });
                break;
            case 2: //defeat
                if (defendingArmyRemaining[4] === 0) { //all out defeat
                    defeatType = "defeat";
                    defendingTerritoryRetreatClick.infantryForCurrentTerritory = defendingArmyRemaining[0];
                    defendingTerritoryRetreatClick.assaultForCurrentTerritory = defendingArmyRemaining[1];
                    defendingTerritoryRetreatClick.airForCurrentTerritory = defendingArmyRemaining[2];
                    defendingTerritoryRetreatClick.navalForCurrentTerritory = defendingArmyRemaining[3];
                    defendingTerritoryRetreatClick.armyForCurrentTerritory = defendingTerritoryRetreatClick.infantryForCurrentTerritory + (defendingTerritoryRetreatClick.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (defendingTerritoryRetreatClick.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (defendingTerritoryRetreatClick.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
                    //update bottom table for defender
                    bottomTable.update({ army: formatNumbersToKMB(defendingTerritory.armyForCurrentTerritory, 0) });
                } else if (defendingArmyRemaining[4] === 1) { //routing defeat
                    defeatType = "defeat";
                    defendingTerritoryRetreatClick.infantryForCurrentTerritory = defendingArmyRemaining[0] + (Math.floor(attackingArmyRemaining[0] * 0.5));
                    defendingTerritoryRetreatClick.assaultForCurrentTerritory = defendingArmyRemaining[1] + (Math.floor(attackingArmyRemaining[1] * 0.5));
                    defendingTerritoryRetreatClick.airForCurrentTerritory = defendingArmyRemaining[2] + (Math.floor(attackingArmyRemaining[2] * 0.5));
                    defendingTerritoryRetreatClick.navalForCurrentTerritory = defendingArmyRemaining[3] + (Math.floor(attackingArmyRemaining[3] * 0.5));
                    defendingTerritoryRetreatClick.armyForCurrentTerritory = defendingTerritoryRetreatClick.infantryForCurrentTerritory + (defendingTerritoryRetreatClick.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (defendingTerritoryRetreatClick.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (defendingTerritoryRetreatClick.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
                    //update bottom table for defender
                    bottomTable.update({ army: formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory, 0) });
                }
                break;
        }
        toggleDiceCanvas(false);
        playSoundClip("button");
        toggleBattleUI(false, false);
        battleUIDisplayed = false;
        toggleBattleResults(true);
        battleResultsDisplayed = true;
        if (!defeatType) {
            defeatType = "retreat";
        }
        if (attackTargetPath()) {
            currentWarFlagString = pathCountry(attackTargetPath());
        }
        populateWarResultPopup(1, attackCountry, defendTerritory, defeatType, false); //lost
        addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
    });

    //click handler for advance button
    advanceButton.addEventListener('click', function() {
        let currentRound = getCurrentRound();
        let attackingArmyRemaining = getAttackingArmyRemaining();
        console.log("firstSetOfRounds was: " + firstSetOfRounds);
        switch (advanceButtonState) {
            case 0: //before battle to start it
                removeCanvasIfExist();
                toggleDiceCanvas(true);
                playSoundClip("button");
                battleStart = false;
                let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());
                //Phase 5.8. `transferArmyOutOfTerritoryOnStartingInvasion()` was called here,
                //under `if (!hasSiegedBefore)`. That is the ORIGINAL debit, from before Phase
                //4.7 moved it to INVADE! (audit 5.1 AD) -- and 4.7 added the new call without
                //removing this one, so every fresh battle debited its source territories
                //TWICE: once when the attack was launched and again on the first "Begin War!"
                //click. A player committing their whole garrison was left holding a NEGATIVE
                //army, which then flowed into population, food consumption and defence for
                //the rest of the game. A battle resumed from a siege was never affected,
                //because `hasSiegedBefore` skipped it -- which is why no siege spec saw it.
                setCurrentRound(currentRound + 1);
                if (hasSiegedBefore) {
                    let war = historicWars.find((siege) => siege.warId === getCurrentWarId());
                    let siegeAttackArray = [];
                    siegeAttackArray.push(attackTargetPath().getAttribute("uniqueid"));
                    siegeAttackArray.push(war.proportionsAttackers[0][0]); //add any territory to make it work
                    for (let i = 0; i < war.attackingArmyRemaining.length; i++) {
                        siegeAttackArray.push(war.attackingArmyRemaining[i]);
                    }
                    setFinalAttackArray(siegeAttackArray);
                    setupBattle(probability, getFinalAttackArray(), allTerritories());
                }
                advanceButtonState = 1;
                setAdvanceButtonText(advanceButtonState, advanceButton);
                retreatButtonState = 1;
                setRetreatButtonText(retreatButtonState, retreatButton);
                roundCounterForStats++;
                enableDisableSiegeButton(1);
                break;
            case 1: //progress through rounds
                if (!firstSetOfRounds && currentRound === 0) { //have clicked End Round
                    removeCanvasIfExist();
                    retreatButton.disabled = false;
                    retreatButton.style.backgroundColor = "rgb(131, 38, 38)";
                    retreatButtonState = 0;
                    setRetreatButtonText(retreatButtonState, retreatButton);
                    setAdvanceButtonText(0, advanceButton);
                    setCurrentRound(1);
                    let attackArrayText = [...attackingArmyRemaining, ...defendingArmyRemaining];
                    let defendingUniqueId = getFinalAttackArray();
                    defendingUniqueId = defendingUniqueId[0];
                    setArmyTextValues(attackArrayText, 1, defendingUniqueId);
                    let updatedProbability = getUpdatedProbability();
                    setAttackProbabilityOnUI(updatedProbability, 1);
                    let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());
                    if (hasSiegedBefore) {
                        enableDisableSiegeButton(1);
                    } else if (updatedProbability >= PROBABILITY_THRESHOLD_FOR_SIEGE) {
                        enableDisableSiegeButton(0);
                    } else {
                        enableDisableSiegeButton(1);
                    }
                } else { //start new round
                    //The two dice WAVs are gone, and with them the cosmetic coin-flip
                    //that chose between them (audit 5.3 Y kept that draw off the game's
                    //stream; nothing now draws here at all). Every round of a battle is
                    //a button press inside a window, so it sounds like one.
                    playSoundClip("button");
                    if (advanceButton.innerHTML === "Start Attack!" || advanceButton.innerHTML === "Begin War!") {
                        roundCounterForStats++;
                        enableDisableSiegeButton(1);
                    }
                    advanceButtonState = 1;
                    setAdvanceButtonText(advanceButtonState, advanceButton);
                    retreatButtonState = 1;
                    setRetreatButtonText(retreatButtonState, retreatButton);
                    let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());
                    if (hasSiegedBefore) {
                        let war = historicWars.find((siege) => siege.warId === getCurrentWarId());
                        let siegeAttackArray = [];
                        siegeAttackArray.push(attackTargetPath().getAttribute("uniqueid"));
                        siegeAttackArray.push(war.proportionsAttackers[0][0]); //add any territory to make it work
                        for (let i = 0; i < war.attackingArmyRemaining.length; i++) {
                            siegeAttackArray.push(war.attackingArmyRemaining[i]);
                        }
                        processRound(currentRound,
                            siegeAttackArray,
                            attackingArmyRemaining,
                            defendingArmyRemaining,
                            skirmishesPerRound);
                    } else {
                        processRound(currentRound,
                            getFinalAttackArray(),
                            attackingArmyRemaining,
                            defendingArmyRemaining,
                            skirmishesPerRound);
                    }

                }
                break;
            case 2: //accept victory
                toggleDiceCanvas(false);
                playSoundClip("button");
                addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
                toggleBattleUI(false, false);
                battleUIDisplayed = false;
                toggleBattleResults(true);
                battleResultsDisplayed = true;
                populateWarResultPopup(0, attackCountry, defendTerritory, "victory", false); //won
                break;
            case 3: //continue siege
                playSoundClip("button");
                toggleBattleUI(false, true);
                battleUIDisplayed = false;
                toggleUIButton(true);
                uiButtonCurrentlyOnScreen = true;
                toggleMapModeButton(true);
                mapModeButtonCurrentlyOnScreen = true;
                toggleBottomLeftPaneWithTurnAdvance(true);
                bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
                break;

        }
        if (attackTargetPath()) {
            currentWarFlagString = pathCountry(attackTargetPath());
        }
    });

    siegeBottomBarButton.addEventListener('click', function() {

        //"assault" i.e. return to battle state
        //remove siege status
        let war = getSiegeObjectFromPath(attackTargetPath());
        setColorsOfDefendingTerritoriesSiegeStats(lastClickedPath, 1);
        setArmyTextValues(war, 3, attackTargetPath().getAttribute("uniqueid"));
        setCurrentWarId(war.warId);
        addRemoveWarSiegeObject(1, war.warId); // remove war from siegeArray and add to historic array
        removeSiegeImageFromPath(attackTargetPath());
        //siege removed from the store above; `underSiege` follows (Phase 4.4)
        //setup  battle to conquer territory
        enableDisableSiegeButton(1); //disable siege button at start
        let siegeAttackArray = [];
        siegeAttackArray.push(attackTargetPath().getAttribute("uniqueid"));
        siegeAttackArray.push(war.proportionsAttackers[war.warId][0]); //add any territory to make the setupBattleUI function work, we have the individual proportions and territories in the proportionsAttackers part of playerSiegeWarsList
        for (let i = 0; i < war.attackingArmyRemaining.length; i++) {
            siegeAttackArray.push(war.attackingArmyRemaining[i]);
        }

        setupBattleUI(siegeAttackArray);
    });

    let confirmButtonBattleResults = battleResults.confirmButton();

    confirmButtonBattleResults.addEventListener('mouseover', function() {
        confirmButtonBattleResults.style.cursor = "pointer";
        if (confirmButtonBattleResults.innerHTML === "Accept Victory!") {
            confirmButtonBattleResults.style.backgroundColor = "rgb(30, 158, 30)";
        } else if (confirmButtonBattleResults.innerHTML === "Accept Defeat!") {
            confirmButtonBattleResults.style.backgroundColor = "rgb(151, 68, 68)";
        }
    });

    confirmButtonBattleResults.addEventListener('mouseout', function() {
        confirmButtonBattleResults.style.cursor = "default";
        if (confirmButtonBattleResults.innerHTML === "Accept Victory!") {
            confirmButtonBattleResults.style.backgroundColor = "rgb(0, 128, 0)";
        } else if (confirmButtonBattleResults.innerHTML === "Accept Defeat!") {
            confirmButtonBattleResults.style.backgroundColor = "rgb(131, 38, 38)";
        }
    });

    confirmButtonBattleResults.addEventListener('click', function() {
        let warId = getCurrentWarId();
        if (battleUIState === 1) {
            setBattleResolutionOnHistoricWarArrayAfterSiege(getResolution(), warId);
        } else {
            if (!historicWars.some(war => war.warId === getCurrentWarId())) {
                addWarToHistoricWarArray(getResolution(), warId, false);
            }
        }
        playSoundClip("button");
        toggleBattleResults(false);
        battleResultsDisplayed = false;
        toggleUIButton(true);
        uiButtonCurrentlyOnScreen = true;
        toggleBottomLeftPaneWithTurnAdvance(true);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
        toggleMapModeButton(true);
        mapModeButtonCurrentlyOnScreen = true;

        clearAttackTarget();
    });

    pageLoaded = true;
    markBootstrapStage("ui");
});

document.addEventListener("keydown", function(e) {
    let isInitialising = getGameInitialisation();
    if (!isInitialising) {
        setUnsetMenuOnEscape(e);
    }
});

export function findClosestPaths(targetPath) {
    if (!targetPath) {
        throw new Error(`Could not find path with ID ${targetPath} in SVG map.`);
    }

    const targetPoints = getPoints(targetPath);
    let resultsPaths = [];

    let closestPaths = Array.from(paths)
        .filter((path) => path !== targetPath)
        .map((path) => {
            const points = getPoints(path);
            const distance = getMinimumDistance(targetPoints, points);
            return {
                path,
                pointsDestPath: points,
                distance,
            };
        })
        .sort((a, b) => a.distance - b.distance);
    // add targetPath to the beginning of the resultPaths array
    resultsPaths.unshift([targetPath, getPoints(targetPath), closestPaths[0].distance]);

    if (targetPath.getAttribute("isIsland") === "false") {
        let closestPathsLessThan1 = closestPaths
            .filter(
                ({
                     distance,
                     path
                 }) =>
                    distance < 1 && path.getAttribute("isIsland") === "false"
            )
            .map(({
                      path,
                      pointsDestPath,
                      distance
                  }) => [path, pointsDestPath, distance]);
        let closestPathsUpTo30 = closestPaths
            .filter(
                ({
                     distance,
                     path
                 }) =>
                    distance <= 30 && distance >= 1 && path.getAttribute("isIsland") === "true"
            )
            .map(({
                      path,
                      pointsDestPath,
                      distance
                  }) => [path, pointsDestPath, distance]);
        let sameCountryDiffTerritory = closestPaths
            .filter(
                ({
                     distance,
                     path
                 }) =>
                    pathCountry(path) === pathCountry(targetPath)
            )
            .map(({
                      path,
                      pointsDestPath,
                      distance
                  }) => [path, pointsDestPath, distance]);

        resultsPaths = resultsPaths.concat(closestPathsLessThan1, closestPathsUpTo30, sameCountryDiffTerritory);
    } else {
        resultsPaths = resultsPaths.concat(
            closestPaths
                .filter(({
                             distance
                         }) => distance <= 30)
                .map(({
                          path,
                          pointsDestPath,
                          distance
                      }) => [path, pointsDestPath, distance])
        );
    }

    // add paths with matching "data-name" attribute
    const matchingPaths = Array.from(paths).filter(
        (path) =>
            pathCountry(path) === pathCountry(targetPath) &&
            path.getAttribute("territory-id") !== targetPath.getAttribute("territory-id")
    );
    resultsPaths.push(...matchingPaths.map((path) => [path, getPoints(path), getMinimumDistance(path)]));

    // Remove duplicates while keeping the first occurrence of an element that has the attribute value of "uniqueid" equal to the first element of the array
    const uniqueIds = new Set();
    const uniqueResultsPaths = [
        [resultsPaths[0][0], resultsPaths[0][1], resultsPaths[0][2]]
    ];
    uniqueIds.add(resultsPaths[0][0].getAttribute("uniqueid"));

    for (let i = 1; i < resultsPaths.length; i++) {
        const uniqueid = resultsPaths[i][0].getAttribute("uniqueid");
        if (!uniqueIds.has(uniqueid)) {
            uniqueResultsPaths.push([resultsPaths[i][0], resultsPaths[i][1], resultsPaths[i][2]]);
            uniqueIds.add(uniqueid);
        }
    }

    resultsPaths = uniqueResultsPaths;

    return resultsPaths;
}

function getPoints(path) {
    const pathLength = path.getTotalLength();
    const points = [];

    for (let i = 0; i < pathLength; i += pathLength / 100) {
        const point = path.getPointAtLength(i);
        points.push({
            x: point.x,
            y: point.y
        });
    }

    return points;
}

function getMinimumDistance(points1, points2) {
    let minDistance = Number.MAX_VALUE;

    for (let i = 0; i < points1.length; i++) {
        for (let j = 0; j < points2.length; j++) {
            const dx = points1[i].x - points2[j].x;
            const dy = points1[i].y - points2[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
    }

    return minDistance;
}

function findCentroidsFromArrayOfPaths(targetPath) {

    let centroidArray;
    if (Array.isArray(targetPath)) {
        targetPath.forEach((path) => {
            getBboxCoordsAndPushUniqueID(path);
        });
    } else {
        centroidArray = getBboxCoordsAndPushUniqueID(targetPath);
    }
    return centroidArray;
}

function getBboxCoordsAndPushUniqueID(path) {
    let bBoxArray = [];
    let pathBBoxCoords;
    let centerBboxCoords = {};
    pathBBoxCoords = path.getBBox();

    //calculate center of path's bounding box
    centerBboxCoords.x = pathBBoxCoords.width / 2 + pathBBoxCoords.x;
    centerBboxCoords.y = pathBBoxCoords.height / 2 + pathBBoxCoords.y;

    // push uniqueid, x and y values as an array to bBoxArray
    bBoxArray.push([path.getAttribute("uniqueid"), centerBboxCoords.x, centerBboxCoords.y]);
    return bBoxArray;
}

// Replaces findMatchingCountries() from the old manualExceptionsForInteractions.js.
// The exception table is now keyed by territory name and available synchronously
// at import time, so there is no longer a race between it and the territory model.
function manualExceptionPaths(targetPath, direction) {
    const territoryName = targetPath.getAttribute("territory-name");
    const names = direction === "add"
        ? getManualAdditions(territoryName)
        : getManualDenials(territoryName);
    return names.map(name => getPathByName(name)).filter(path => path !== null);
}

function highlightInteractableCountriesAfterSelectingOne(targetPath, destCoordsArray, destinationPathObjectArray, distances, attacking) {
    if (pathIsDeactivated(targetPath)) {
        return;
    }
    let manualExceptionsArray = [];
    let manualDenialArray = [];
    let tempValidDestinationsArray = [];

    defs = svgMap.querySelector('defs');
    patterns = defs.querySelectorAll('pattern');

    for (let i = 0; i < patterns.length; i++) { //remove all patterns before creating new ones
        defs.removeChild(patterns[i]);
    }

    if (destCoordsArray.length < 1) {
        throw new Error("Array must contain at least 1 element");
    }

    let count = 0;

    manualExceptionsArray = manualExceptionPaths(targetPath, "add"); //set up manual exceptions for this targetPath
    manualDenialArray = manualExceptionPaths(targetPath, "deny"); //set up denial countries

    destinationPathObjectArray = removeDeniedDestinations(destinationPathObjectArray, manualDenialArray); //remove denied countries (manual exception)

    if (manualExceptionsArray.length > 0) { //works correctly
        for (let i = 0; i < manualExceptionsArray.length; i++) {
            tempValidDestinationsArray.push(changeCountryColor(manualExceptionsArray[i], false, "pattern", count, attacking)[0]); //change color of touching country's
            count++;
        }
    }

    for (let i = 0; i < destinationPathObjectArray.length; i++) {
        const targetName = pathCountry(targetPath);
        const destName = pathCountry(destinationPathObjectArray[i]);

        if (distances[i] < 1 && targetPath !== destinationPathObjectArray[i]) { //if touches borders then always draws a line
            tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]); //change color of touching countries
            count++;
        } else if (targetName === destName && targetPath !== destinationPathObjectArray[i]) { //if another territory of same country, then change color
            tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]); //change color of touching countries
            count++;
        } else {
            for (let j = 0; j < destinationPathObjectArray.length; j++) {
                if (i === j) {
                    continue;
                }

                const destObjI = destinationPathObjectArray[i];
                const destObjJ = destinationPathObjectArray[j];

                if (destObjI.getAttribute("uniqueid") === destObjJ.getAttribute("uniqueid")) {
                    continue;
                }

                if ((destObjI.getAttribute("isisland") === "true" || targetPath.getAttribute("isisland") === "true") && destObjI !== targetPath) {
                    tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]); //change color of touching countries
                    count++;
                }

                if (pathCountry(targetPath) === pathCountry(destObjJ)) {
                    break;
                }
            }
        }
    }

    if (!attacking) {
        validDestinationsArray.length = 0;

        for (let i = 0; i < paths.length; i++) {
            if (paths[i].getAttribute("fill").startsWith("url")) {
                validDestinationsArray.push(paths[i]);
            }

        }
        setAttackableTerritories(validDestinationsArray.map(path => path.getAttribute("uniqueid")));

        for (let i = 0; i < validDestinationsArray.length; i++) {
            setStrokeWidth(validDestinationsArray[i], "3");
        }
    } else {
        return tempValidDestinationsArray;
    }

    return validDestinationsArray;
}

function getClosestPointsDestinationPaths(coordinate, paths) {
    const closestPoints = [];

    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        let closestPoint = null;
        let closestDistance = Infinity;

        for (let j = 0; j < path.length; j++) {
            const point = path[j];
            const distance = Math.sqrt((coordinate[0][1] - point.x) ** 2 + (coordinate[0][2] - point.y) ** 2);

            if (distance < closestDistance) {
                closestPoint = {
                    x: point.x,
                    y: point.y,
                };
                closestDistance = distance;
            }
        }

        closestPoints.push(closestPoint);
    }

    return closestPoints;
}

function changeCountryColor(pathObj, isManualException, newRgbValue, count, attacking) {
    let tempAttackingDestinationArray = []; //only to get attacking destinations

    let originalColor = pathObj.getAttribute("fill");
    let rgbValues = originalColor.match(/\d{1,3}/g);

    if (pathObj === currentSelectedPath && hoveredNonInteractableAndNonSelectedTerritory) {
        let [r, g, b] = rgbValues;

        r -= 20;
        g -= 20;
        b -= 20;

        originalColor = "rgb(" + r + "," + g + "," + b + ")";

        hoveredNonInteractableAndNonSelectedTerritory = false;
    }

    if (newRgbValue.startsWith("pattern")) { //if a pattern
        const fillColor = pathObj.getAttribute('fill');

        // create a new pattern element
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute("id", dynamicIds.diagonalLines(count));
        pattern.setAttribute('width', '20');
        pattern.setAttribute('height', '20');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('patternTransform', 'rotate(135)');

        // create the first line element with the stroke color matching the fill color
        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', '0');
        line1.setAttribute('y1', '5');
        line1.setAttribute('x2', '20');
        line1.setAttribute('y2', '5');
        line1.setAttribute('stroke-width', '10');
        line1.setAttribute('stroke', fillColor);
        pattern.appendChild(line1);

        // create the second line element with a constant white stroke color
        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', '0');
        line2.setAttribute('y1', '15');
        line2.setAttribute('x2', '20');
        line2.setAttribute('y2', '15');
        line2.setAttribute('stroke-width', '10');
        line2.setAttribute('stroke', playerColour());
        pattern.appendChild(line2);

        // add the pattern element to the defs section of the SVG
        defs.appendChild(pattern);

        // apply the pattern to the path element
        if (!attacking) {
            pathObj.setAttribute('fill', 'url(#' + pattern.getAttribute("id") + ')');
        } else {
            tempAttackingDestinationArray.push(pathObj);
        }
    } else {
        pathObj.setAttribute("fill", newRgbValue);
    }

    // Push the original color to the array

    currentlySelectedColorsArray.push([pathObj, originalColor, isManualException]);

    // Remove any elements containing new value that was passed in
    let lastElem = currentlySelectedColorsArray[currentlySelectedColorsArray.length - 1][1];
    if (!newRgbValue.startsWith("url")) {
        newRgbValue = "rgb(" + newRgbValue + ")";
        if (lastElem === newRgbValue) {
            currentlySelectedColorsArray.pop();
        }
    }

    return tempAttackingDestinationArray; //only to extract attacking destinations
}

export function setFlag(flag, place) {
    let flagElement;

    const img = document.createElement('img');

    if (place !== 4 && place !== 5 && place !== 6 && place !== 7 && place !== 8 && place !== 9) {
        img.classList.add("flag");
    }

    img.src = `./resources/flags/${flag}.png`;

    let popupBodyElement = document.getElementById(ids.popupBody);
    if (place === 1) { //top table
        flagElement = document.getElementById(ids.flagTop);
    } else if (place === 2) { //bottom table
        flagElement = document.getElementById(ids.flagBottom);
    } else if (place === 3) { //UI info panel
        flagElement = document.getElementById(ids.infoPanel);
        document.querySelector(".info-panel").style.setProperty('--bg-image', `url(${img.src})`);
        document.querySelector(".info-panel-upgrade").style.setProperty('--bg-image', `url(${img.src})`);
    } else if (place === 4) { //Battle UI attacker
        flagElement = document.getElementById(ids.battleUITitleFlagCol1);
        img.style.width = "100%";
    } else if (place === 5) { //Battle UI defender
        flagElement = document.getElementById(ids.battleUITitleFlagCol2);
        img.style.width = "100%";
    } else if (place === 6) { //Battle Results UI attacker
        flagElement = document.getElementById(ids.battleResultsRow1FlagCol1);
        img.style.width = "100%";
    } else if (place === 7) { //Battle Results UI defender
        flagElement = document.getElementById(ids.battleResultsRow1FlagCol2);
        img.style.width = "100%";
        img.src = `./resources/flags/${currentWarFlagString}.png`; //workaround for battle results screen defender flag issue
    } else if (place === 8) { //Battle Results UI defender
        flagElement = document.getElementById(ids.aiDialogueTitleFlagCol1);
        img.style.width = "100%";
    } else if (place === 9) { //Battle Results UI defender
        flagElement = document.getElementById(ids.aiDialogueTitleFlagCol2);
        img.style.width = "100%";
    } else if (place === 0) {
        return img.src;
    }

    if (place !== 3) {
        flagElement.innerHTML = '';
        flagElement.appendChild(img);
    }

    if (selectCountryPlayerState) {
        popupBodyElement.style.backgroundImage = `url(${img.src})`;
        popupBodyElement.style.backgroundSize = "100% 100%";
        popupBodyElement.style.backgroundPosition = "center";
    }

    return img.src;
}

function hoverOverTerritory(territory, mouseAction, arrayOfSelectedCountries = []) {
    if (territory.hasAttribute("fill")) {
        let fillValue = territory.getAttribute("fill");
        let rgbValues;
        let r, g, b;
        if (mapMode === 1) { //normal map
            rgbValues = fillValue.match(/\d+/g).map(Number);
            [r, g, b] = rgbValues;
        }
        if (mouseAction === "mouseOver" && ((r <= 254 && g <= 254 && b <= 254 && mapMode === 1) || mapMode === 2)) { //this handles color change when hovering (doesn't run on selected or interactable territories)
            if (mapMode === 1) {
                hoveredNonInteractableAndNonSelectedTerritory = true;
                r += 20;
                g += 20;
                b += 20;
                territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
            } else if (mapMode === 2 && !pathIsPlayerOwned(territory)) {
                [r, g, b] = [255, 255, 255];
                territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
                territory.setAttribute("fill-opacity", "0.3");
            }
        } else if (mouseAction === "mouseOut" && ((r <= 254 && g <= 254 && b <= 254 && mapMode === 1) || mapMode === 2)) { //this handles color change when leaving a hover (doesn't run on selected or interactable territories)
            if (mapMode === 1) {
                hoveredNonInteractableAndNonSelectedTerritory = false;
                r -= 20;
                g -= 20;
                b -= 20;
                if (selectCountryPlayerState && territory === currentSelectedPath) {
                    territory.setAttribute("fill", playerColour());
                } else {
                    territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
                }
            } else if (mapMode === 2 && !pathIsPlayerOwned(territory)) {
                territory.setAttribute("fill-opacity", "0.01");
            }
        } else if (mouseAction === "clickCountry") { //this returns colors back to their original state after deselecting by selecting another, either white if interactable by both the previous and new selected areas, or back to owner color if not accessible by new selected area
            if (mapMode === 2) {
                exitPhysicalMap();
                //reset colours

            }
            if (arrayOfSelectedCountries.length > 0) {
                for (let i = 0; i < arrayOfSelectedCountries.length; i++) {
                    let rGBValuesToReplace = arrayOfSelectedCountries[i][1];
                    arrayOfSelectedCountries[i][0].setAttribute("fill", rGBValuesToReplace);
                    if (!pathIsDeactivated(arrayOfSelectedCountries[i][0]) && !pathIsUnderSiege(arrayOfSelectedCountries[i][0])) {
                        setStrokeWidth(arrayOfSelectedCountries[i][0], "1");
                    }
                }
            }
        }
    }
}

//Phase 6.7. saveMapColorState(), restoreMapColorState(), colorByStandardColoring(),
//generateRandomRGB(), convertHexValueToRGBOrViceVersa() and generateDistinctRGBs() all
//stood here. The first two are replaced by repaintMap() -- see src/ui/map/MapView.js --
//and the rest moved to src/ui/map/colouring.js unchanged.

function setStrokeWidth(path, stroke) {
    path.setAttribute("stroke-width", stroke)
}

export function enableNewGameButton() {
    mainMenu.setNewGameEnabled(true);
    //Phase 7.3. The same prerequisite: a load patches the seeded territories, so an
    //autosave can only be offered once there are territories to patch.
    offerStoredAutosave();
}

function greyOutTerritoriesForUnselectableCountries() {
    //calculateTerritoryStrengths already returns this sorted strongest-first; sorting a copy
    //keeps that from being a silent assumption. See audit 5.2 Z.
    const strongestFirst = [...countryStrengthsArray].sort((a, b) => b[1] - a[1]);
    const unselectableCountries = new Set(
        strongestFirst.slice(0, COUNTRY_GREYOUT_RANK).map(entry => entry[0])
    );

    //Phase 4.4: which countries are unselectable is state, not a DOM attribute. The
    //fill stays here because it is presentation; `greyedOut` is rendered from the set.
    setGreyedOutCountries(unselectableCountries);
    paintLockedCountries();
}

//lockedCountryFill() and paintLockedCountries() moved to src/ui/map/ in Phase 6.7 --
//the muting to colouring.js, the pass over the map to MapView.js. paintLockedCountries()
//no longer needs a colour snapshot to find a country's true colour: colouring.js keeps
//the palette it painted at bootstrap.

function setAllGreyedOutAttributesToFalseOnGameStart() {
    clearGreyedOutCountries();
}

/**
 * Set the move-phase button from the territory the player just clicked.
 *
 * Phase 6.6. The first hundred lines of this function were five blocks that each
 * wrote a label, removed four of the five background classes, added a fifth, set
 * `disabled` and set `display` -- with the decision and the writing interleaved. The
 * decision is `deriveMoveButtonState()` now, which is pure and unit-tested; this
 * applies the result and performs the one side effect it cannot: arming the clicked
 * territory as an attack or a siege target.
 *
 * `xButtonClicked` means the transfer/attack window was dismissed rather than a
 * territory selected. It is still a parameter rather than a second function because
 * every call site passes it, and splitting them is a rename this phase does not need.
 */
function handleMovePhaseTransferAttackButton(path, lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, territoryComingFrom, xButtonClicked, xButtonFromWhere) {
    moveButton.hide();
    transferAttackButtonDisplayed = false;

    if (xButtonClicked) {
        if (xButtonFromWhere === MoveMode.TRANSFER) {
            applyMoveButtonState(stateAfterWindowClosed(MoveMode.TRANSFER));
        } else if (xButtonFromWhere === MoveMode.ATTACK) {
            //audit 5.2 AE. Cancelling un-arms the target, so there is no button.
            cancelAttackSelection();
        }
        return;
    }

    //An enemy territory that is not a valid destination is not a selection at all.
    const inRange = Boolean(
        lastPlayerOwnedValidDestinationsArray?.some(
            destination => destination.getAttribute("uniqueid") === path.getAttribute("uniqueid")
        )
    );
    if (lastPlayerOwnedValidDestinationsArray && !pathIsPlayerOwned(path) && !inRange) {
        return;
    }

    if (pathIsPlayerOwned(path)) {
        //Selecting one of your own territories abandons any attack being composed.
        clearAttackTarget();
    }

    const territoryName = path.getAttribute("territory-name");
    const siege = playerSiegeWarsList[territoryName] || aiSiegeWarsList[territoryName];

    const state = deriveMoveButtonState({
        isPlayerOwned: pathIsPlayerOwned(path),
        isDeactivated: pathIsDeactivated(path),
        deactivatedTurnsLeft: lockoutTurnsRemaining(path),
        isUnderSiege: pathIsUnderSiege(path),
        isAttackable: pathIsAttackable(path),
        isInRange: inRange,
        sourceIsPlayerOwned: pathIsPlayerOwned(lastClickedPathExternal),
        ownedTerritoryCount: playerOwnedTerritories.length,
        siegeTurns: siege ? siege.turnsInSiege : undefined
    });

    applyMoveButtonState(state);

    if (state.target === "attack") {
        setTerritoryForAttack(path);
    } else if (state.target === "siege") {
        setTerritoryForSiege(path);
    }

    recordMoveButtonContext(playerOwnedTerritories, territoryComingFrom);
}

/** How many turns of its post-conquest lockout this territory still has to serve. */
function lockoutTurnsRemaining(path) {
    const uniqueId = path.getAttribute("uniqueid");
    for (const entry of playerTurnsDeactivatedArray) {
        if (entry[0] === uniqueId) {
            return (entry[1] - entry[2]) + 1;
        }
    }
    return undefined;
}

/** Write a derived state onto the button. Nothing else touches its classes. */
function applyMoveButtonState(state) {
    if (!state || !state.visible) {
        moveButton.hide();
        transferAttackButtonDisplayed = false;
        return;
    }
    moveButton.setLabel(state.label);
    moveButton.setVariant(state.variant);
    moveButton.setEnabled(state.enabled);
    moveButton.show();
    transferAttackButtonDisplayed = true;
    if (state.mode !== null) {
        transferAttackButtonState = state.mode;
    }
}

//The context the button's click handler needs, recorded when the selection is made.
//Phase 6.6: these were closed over by a handler that was RE-CREATED on every
//selection, and `button.removeEventListener("click", transferAttackClickHandler)`
//could never remove the previous one -- each call built a new function object, so the
//listeners accumulated and one click fired all of them. That is what
//`eventHandlerExecuted` and the four `setTimeout(..., 200)` calls were suppressing.
//One listener, installed once, reading these. The latch and the timers are gone.
let moveButtonOwnedTerritories = [];
let moveButtonSource = null;

function recordMoveButtonContext(ownedTerritories, source) {
    moveButtonOwnedTerritories = ownedTerritories;
    moveButtonSource = source;
}

/**
 * Install the move-phase button's listeners. Called once, from bootstrap.
 */
function installMoveButtonHandlers() {
    const button = moveButton.element();

    button.addEventListener("click", function transferAttackClickHandler() {
        tooltip.setContent("");
        tooltip.hide();
        playSoundClip("switch");
        if (transferAttackButtonState === 0) {
            moveButtonSource = lastClickedPath;
        }
        {
            if (!button.disabled) {
                if (!transferAttackWindowOnScreen) {
                    toggleUIButton(false);
                    toggleBottomLeftPaneWithTurnAdvance(false);
                    toggleMapModeButton(false);
                    mapModeButtonCurrentlyOnScreen = false;

                    if (transferAttackButtonState === 0 || transferAttackButtonState === 1) {
                        toggleTransferAttackWindow(true);
                        setTransferAttackWindowTitleText(
                            attackTargetPath() && attackTargetPath().getAttribute("territory-name") !== null ?
                                attackTargetPath().getAttribute("territory-name") :
                                "transferring",
                            attackTargetPath() ? pathCountry(attackTargetPath()) : null,
                            moveButtonSource,
                            transferAttackButtonState,
                            allTerritories()
                        );

                        button.classList.remove("move-phase-button-green-background");
                        button.classList.remove("move-phase-button-red-background");
                        button.classList.add("move-phase-button-blue-background");
                        button.innerHTML = "CANCEL";
                        drawAndHandleTransferAttackTable(
                            document.getElementById(ids.transferTable),
                            allTerritories(),
                            playerOwnedTerritories,
                            territoriesAbleToAttackTarget,
                            transferAttackButtonState
                        );

                        const selection = document.querySelectorAll('.transfer-table-row-hoverable > .transfer-table-outer-column:first-of-type');
                        setTransferToTerritory(selection);

                        if (transferAttackButtonState === 1) {
                            clearAttackableTerritories();
                        }
                        return;

                    } else if (transferAttackButtonState === 2) { //click view siege button //button says VIEW SIEGE
                        setValuesForBattleFromSiegeObject(lastClickedPath, false);
                        enableDisableAssaultButton(0);
                        toggleBattleUI(true, false);
                        battleUIDisplayed = true;
                        toggleTransferAttackButton(false, false);
                        transferAttackButtonDisplayed = false;

                        setupSiegeUI(attackTargetPath());

                        setColorsOfDefendingTerritoriesSiegeStats(lastClickedPath, 0);

                    }
                } else if (transferAttackWindowOnScreen) {
                    if (button.innerHTML === "CONFIRM" || button.innerHTML === "INVADE!") {
                        button.style.fontWeight = "normal";
                        button.style.color = "white";
                        setAttackProbabilityOnUI(0, 0);
                    }
                    if (transferAttackButtonState === 0) {
                        if (button.innerHTML === "CONFIRM") {
                            transferArmyToNewTerritory(transferQuantitiesArray);
                        }
                        button.classList.remove("move-phase-button-blue-background");
                        button.classList.add("move-phase-button-green-background");
                        button.innerHTML = "TRANSFER";
                        toggleTransferAttackWindow(false);
                        transferAttackWindowOnScreen = false;
                        toggleUIButton(true);
                        toggleBottomLeftPaneWithTurnAdvance(true);
                        toggleMapModeButton(true);
                        mapModeButtonCurrentlyOnScreen = true;
                        return;
                    } else if (transferAttackButtonState === 1) {
                        if (button.innerHTML === "INVADE!") {
                            battleStart = true;
                            setCurrentWarId(getNextWarId());
                            setNextWarId(getNextWarId() + 1);
                            toggleTransferAttackWindow(false);
                            transferAttackWindowOnScreen = false;
                            toggleBattleUI(true, false);
                            if (probability < PROBABILITY_THRESHOLD_FOR_SIEGE) {
                                enableDisableSiegeButton(1);
                            } else {
                                enableDisableSiegeButton(0);
                            }

                            toggleTransferAttackButton(false, false);
                            transferAttackButtonDisplayed = false;
                            attackTextCurrentlyDisplayed = false;
                            setupBattle(probability, getFinalAttackArray(), allTerritories());
                            setupBattleUI(getFinalAttackArray());
                            //audit 5.1 AD: take the committed units out of the territories
                            //that supplied them, now, rather than reconciling when the war
                            //resolves. Before Phase 4.7 there was no single territory to
                            //debit -- the battle ran on copies.
                            transferArmyOutOfTerritoryOnStartingInvasion(getFinalAttackArray(), allTerritories());
                            setColorsOfDefendingTerritoriesSiegeStats(lastClickedPath, 2);
                            battleUIDisplayed = true;
                        } else if (button.innerHTML === "CANCEL") {
                            setAttackProbabilityOnUI(0, 0);
                            toggleTransferAttackWindow(false);
                            transferAttackWindowOnScreen = false;
                            toggleBottomLeftPaneWithTurnAdvance(true);
                            bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
                            toggleUIButton(true);
                            uiButtonCurrentlyOnScreen = true;
                            toggleMapModeButton(true);
                            mapModeButtonCurrentlyOnScreen = true;
                            territoryUniqueIds.length = 0;
                            cancelAttackSelection();
                            return;
                        }
                        territoryUniqueIds.length = 0;

                        if (button.innerHTML !== "DEACTIVATED") {
                            button.classList.remove("move-phase-button-blue-background");
                            button.classList.add("move-phase-button-red-background");
                            button.innerHTML = "ATTACK";
                        }
                        if (transferAttackButtonState === 0) {
                            toggleUIButton(true);
                            uiButtonCurrentlyOnScreen = true;
                            toggleBottomLeftPaneWithTurnAdvance(true);
                            bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
                            toggleMapModeButton(true);
                            mapModeButtonCurrentlyOnScreen = true;
                        }
                        return;
                    }
                }
            }
        }
    });

    button.addEventListener("mouseover", (e) => {
        const x = e.clientX;
        const y = e.clientY;

        if (window.innerHeight - y < 100) {
            tooltip.moveTo(x - 40, y - 50);
        } else {
            tooltip.moveTo(x - 40, 25 + y);
        }

        if (button.disabled) {
            if (button.innerHTML === "DEACTIVATED") {
                tooltip.setContent("You cannot transfer or attack from this territory until next turn!");
            } else if (button.innerHTML === "TRANSFER") {
                tooltip.setContent("You have no other territories to transfer military to!");
            }
        } else if (!button.disabled && moveButtonOwnedTerritories.length > 1 && button.innerHTML === "TRANSFER") {
            tooltip.setContent("Click to transfer military to one of your other territories...");
        } else if (!button.disabled && validDestinationsArray.length > 0 && button.innerHTML === "ATTACK") {
            tooltip.setContent("Click to send military to attack selected territory from the last selected territory...");
        } else if (!button.disabled && button.innerHTML === "CANCEL") {
            tooltip.setContent("Click to cancel with no changes and close transfer/attack window...");
        } else if (!button.disabled && button.innerHTML === "CONFIRM") {
            tooltip.setContent("Click to confirm the transfer and move the selected units to the destination territory!");
        } else if (!button.disabled && button.innerHTML === "INVADE!") {
            tooltip.setContent("Click to launch your attack!");
        } else if (!button.disabled && button.innerHTML.includes("VIEW SIEGE")) {
            tooltip.setContent("Click to view the war and options to lift the siege!");
        }

        tooltip.show();

    });

    button.addEventListener("mouseout", () => {
        tooltip.setContent("");
        tooltip.hide();
    });
}

/**
 * Un-arm the attack the player was composing.
 *
 * audit 5.2 AE, closed in Phase 6.7. Cancelling used to close the window, put the
 * move button back to ATTACK and leave the target exactly as it was: still filled in
 * the player's colour, still dashed, and still carrying the battle marker -- a map
 * saying an attack was under way when none was. The marker was the visible half; the
 * fill and the stroke were the other two.
 *
 * Cancel now means what it says. The target is cleared -- which removes the marker,
 * because markers.js owns both as one fact -- and `repaintMap()` puts the fill and the
 * stroke back from the store. The move button goes away with them: the player clicks
 * the territory again to arm a fresh attack, which is one click and an honest map
 * rather than no click and a lying one.
 */
function cancelAttackSelection() {
    clearAttackTarget();
    attackTextCurrentlyDisplayed = false;
    moveButton.hideDestination();
    repaintMap();

    moveButton.hide();
    transferAttackButtonDisplayed = false;
    transferAttackButtonState = 1;
}

function setTerritoryForAttack(territoryToAttack) {
    setAttackTarget(territoryToAttack, { marker: !pathIsUnderSiege(territoryToAttack) });
    moveButton.showDestination(
        attackTargetPath().getAttribute("territory-name"),
        setFlag(pathCountry(territoryToAttack), 0)
    );
    attackTextCurrentlyDisplayed = true;
    if (pathIsUnderSiege(territoryToAttack)) {
        const territoryName = territoryToAttack.getAttribute("territory-name");
        const siege = playerSiegeWarsList[territoryName] || aiSiegeWarsList[territoryName];
        if (siege && siege.strokeColor) {
            territoryToAttack.style.stroke = siege.strokeColor;
        }
        territoryToAttack.setAttribute("stroke-width", "5px");
        territoryToAttack.style.strokeDasharray = "10, 5";
    } else {
        territoryToAttack.style.stroke = territoryToAttack.getAttribute("fill");
        territoryToAttack.setAttribute("fill", playerColour());
        territoryToAttack.setAttribute("stroke-width", "5px");
        territoryToAttack.style.strokeDasharray = "10, 5";
    }
}

function setTerritoryForSiege(territoryToSiege) {
    //A siege target carries a siege overlay already; a second image on the same
    //territory is what audit 5.3 AV was.
    setAttackTarget(territoryToSiege, { marker: false });
    moveButton.showDestination(
        attackTargetPath().getAttribute("territory-name"),
        setFlag(pathCountry(territoryToSiege), 0)
    );
    attackTextCurrentlyDisplayed = true;

    const territoryName = territoryToSiege.getAttribute("territory-name");
    const siege = playerSiegeWarsList[territoryName] || aiSiegeWarsList[territoryName];

    if (siege && siege.strokeColor) {
        territoryToSiege.style.stroke = siege.strokeColor;
    }
    territoryToSiege.setAttribute("stroke-width", "5px");
    territoryToSiege.style.strokeDasharray = "10, 5";
}

//addImageToPath() stood here. Its `siege === 1` and `siege === 2` branches were dead
//from Phase 5.8, when marker rendering moved to src/ui/siegeOverlay.js; what was left
//was the attack marker, which src/ui/map/markers.js now draws from the one target it
//owns. Phase 6.7.

export function removeSiegeImageFromPath(ai, path) {
    //BUG FIX, known-issues AM. This used to ask getHistoricWarObject() for the siege and
    //then read `.defendingTerritory.territoryName` off whatever came back -- but that
    //function returns the STRING "Error - Siege not found in either array..." when the
    //siege is not in the historic array yet, and a string has no `defendingTerritory`. The
    //resulting `Cannot read properties of undefined` escaped the turn loop and froze the
    //game on AI MOVING..., intermittently, depending on whether a siege ended before it had
    //been recorded.
    //
    //The lookup was never needed. The only thing taken from the siege was the name of the
    //territory being besieged, and that is the path this function was handed --
    //`territory-name` is identity, not state, so reading it here is exactly right (see the
    //SVG-attributes note in CLAUDE.md). No lookup, no sentinel, no failure mode.
    const territoryName = path.getAttribute("territory-name");
    if (!territoryName) {
        console.log("removeSiegeImageFromPath: path carries no territory-name; nothing to remove");
        return;
    }

    removeSiegeMarker(territoryName);

    if (mapMode === 1) {
        for (let i = 0; i < allTerritories().length; i++) {
            if (allTerritories()[i].uniqueId === path.getAttribute("uniqueid")) {
                setColorOnMap(allTerritories()[i]);
                break;
            }
        }
    }

    if (!ai) {
        path.style.stroke = "rgb(0,0,0)";
        path.style.strokeDasharray = "none";
        path.setAttribute("stroke-width", "1");
    }
}

function setTransferAttackWindowTitleText(territory, country, territoryComingFrom, buttonState, mainArray) {
    let elementInMainArray;
    let totalAttackAmountArray = [0, 0, 0, 0];
    let coastalOrNot;

    if (buttonState === 1) {
        for (let i = 0; i < territoriesAbleToAttackTarget.length; i++) { //get total attack numbers for icon row attack window
            for (let j = 0; j < allTerritories().length; j++) {
                if (territoriesAbleToAttackTarget[i].getAttribute("uniqueid") === allTerritories()[j].uniqueId && !territoriesAbleToAttackTarget[i].isDeactivated) {
                    totalAttackAmountArray[0] += allTerritories()[j].infantryForCurrentTerritory;
                    totalAttackAmountArray[1] += allTerritories()[j].useableAssault;
                    totalAttackAmountArray[2] += allTerritories()[j].useableAir;
                    totalAttackAmountArray[3] += allTerritories()[j].useableNaval;
                }
            }
        }
    }

    for (let i = 0; i < mainArray.length; i++) {
        if (territoryComingFrom.getAttribute("uniqueid") === mainArray[i].uniqueId) {
            elementInMainArray = mainArray[i];
        }
        if (territory === mainArray[i].territoryName) {
            coastalOrNot = mainArray[i].isCoastal;
        }
    }

    let attackingOrTransferring = "";

    document.getElementById(ids.contentTransferHeaderRow).style.display = "flex";
    let imageElement;
    let imageSrc;

    if (buttonState === 0) {
        document.getElementById(ids.contentTransferHeaderColumn1).innerHTML = "";
        document.getElementById(ids.percentageAttack).style.display = "none";
        document.getElementById(ids.colorBarAttackUnderlayRed).style.display = "none";
        document.getElementById(ids.colorBarAttackOverlayGreen).style.display = "none";
        document.getElementById(ids.xButtonTransferAttack).style.marginLeft = "0px";

        attackingOrTransferring = "Transferring to:";

        imageElement = document.getElementById(ids.contentTransferHeaderImageColumn1);
        imageSrc = "resources/infantry.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Infantry" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(elementInMainArray.infantryForCurrentTerritory, 0)}</span>`;

        imageElement = document.getElementById(ids.contentTransferHeaderImageColumn2);
        imageSrc = "resources/assault.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Assault" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(elementInMainArray.assaultForCurrentTerritory, 0)}</span>`;

        imageElement = document.getElementById(ids.contentTransferHeaderImageColumn3);
        imageSrc = "resources/air.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Air" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(elementInMainArray.airForCurrentTerritory, 0)}</span>`;

        imageElement = document.getElementById(ids.contentTransferHeaderImageColumn4);
        imageSrc = "resources/naval.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Naval" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(elementInMainArray.navalForCurrentTerritory, 0)}</span>`;

    } else if (buttonState === 1) {
        document.getElementById(ids.percentageAttack).style.display = "flex";
        document.getElementById(ids.colorBarAttackUnderlayRed).style.display = "flex";
        document.getElementById(ids.xButtonTransferAttack).style.marginLeft = "47px";
        attackingOrTransferring = "Attacking:";

        document.getElementById(ids.contentTransferHeaderColumn1).innerHTML = "Total Military Force In Range:";

        imageElement = document.getElementById(ids.contentTransferHeaderImageColumn1);
        imageSrc = "resources/infantry.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Infantry" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(totalAttackAmountArray[0], 0)}</span>`;

        imageElement = document.getElementById(ids.contentTransferHeaderImageColumn2);
        imageSrc = "resources/assault.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Assault" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(totalAttackAmountArray[1], 0)}</span>`;

        imageElement = document.getElementById(ids.contentTransferHeaderImageColumn3);
        imageSrc = "resources/air.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Air" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(totalAttackAmountArray[2], 0)}</span>`;

        imageElement = document.getElementById(ids.contentTransferHeaderImageColumn4);
        imageSrc = "resources/naval.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Naval" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(totalAttackAmountArray[3], 0)}</span>`;

        const headerRow = document.getElementById(ids.contentTransferHeaderRow);

        headerRow.addEventListener("mouseover", (e) => {
            const x = e.clientX;
            const y = e.clientY;

            if (window.innerHeight - y < 100) {
                tooltip.moveTo(x - 40, y - 50);
            } else {
                tooltip.moveTo(x - 40, 25 + y);
            }

            let tooltipContent = `
            <div style="white-space: nowrap;">
                <div>Army Breakdown:</div>
                <br />
                <div style="display: flex; flex-wrap: wrap;">
                ${territoriesAbleToAttackTarget
                .map((territory, index) => {
                    const matchingElement = mainArray.find((element) => element.uniqueId === territory.getAttribute("uniqueid"));
                    if (matchingElement) {
                        const isNewRow = index !== 0 && (index % 4 === 0);
                        const isNewTerritory = index !== 0;
                        const entityStyle = `style="margin-right: 10px;${isNewTerritory && index >= 4 ? 'margin-top: 10px;' : ''}"`;
                        const nameStyle = 'style="color: rgb(235, 235, 0); white-space: nowrap;"';
                        const rowStart = isNewRow ? '<div style="display: flex; margin-top: 10px;">' : '';
                        const rowEnd = isNewRow || index === territoriesAbleToAttackTarget.length - 1 ? '</div>' : '';

                        return `
                                ${rowStart}
                                <div style="flex: 1;">
                                    <div ${entityStyle}><strong><span ${nameStyle}>${territory.getAttribute("territory-name")}</span></strong></div>
                                    <div ${entityStyle}>
                                        Infantry: ${matchingElement.infantryForCurrentTerritory}<br />
                                        Assault: ${
                            matchingElement.useableAssault < matchingElement.assaultForCurrentTerritory
                                ? `<span style="font-weight: bold; color: rgb(245,160,160);">${matchingElement.useableAssault}</span>`
                                : matchingElement.useableAssault
                        }/${matchingElement.assaultForCurrentTerritory}<br />
                                        Air: ${
                            matchingElement.useableAir < matchingElement.airForCurrentTerritory
                                ? `<span style="font-weight: bold; color: rgb(245,160,160);">${matchingElement.useableAir}</span>`
                                : matchingElement.useableAir
                        }/${matchingElement.airForCurrentTerritory}<br />
                                        Naval: ${
                            matchingElement.useableNaval < matchingElement.navalForCurrentTerritory
                                ? `<span style="font-weight: bold; color: rgb(245,160,160);">${matchingElement.useableNaval}</span>`
                                : matchingElement.useableNaval
                        }/${matchingElement.navalForCurrentTerritory}<br />
                                    </div>
                                </div>
                                ${rowEnd}
                            `;
                    }
                    return '';
                })
                .join('')}
                </div>
            </div>
        `;

            tooltip.setContent(tooltipContent);

            tooltip.show();
        });
        headerRow.addEventListener("mouseout", () => {
            tooltip.setContent("");
            tooltip.hide();
        });
    }

    const transferToAttackHeading = document.getElementById(ids.attackOrTransferString);
    const fromHeading = document.getElementById(ids.fromHeadingString);
    const territoryTextString = document.getElementById(ids.territoryTextString);

    // Check if territory is "transferring" and set the text color accordingly
    if (territory === "transferring") {
        territoryTextString.innerHTML = "please select an option...";
        territoryTextString.style.color = "rgb(221, 107, 107)";
        territoryTextString.style.fontWeight = "bold";
    } else {

        territoryTextString.innerHTML = territory + " (" + country + ") - " + coastalOrNot;
        territoryTextString.style.color = "white";
    }

    const attackingFromTerritory = document.getElementById(ids.attackingFromTerritoryTextString);
    const titleTransferAttackWindow = document.getElementById(ids.titleTransferAttackWindow);

    if (!transferToAttackHeading || !fromHeading || !territoryTextString || !attackingFromTerritory || !titleTransferAttackWindow) {
        console.error("One or more required elements are null.");
        return;
    }

    transferToAttackHeading.innerHTML = attackingOrTransferring;
    coastalOrNot = coastalOrNot ? "Coastal" : "Landlocked";

    territoryTextString.innerHTML = (territory === "transferring" ? " (please select an option...)" : territory + " (" + country + ") - " + coastalOrNot);
    if (buttonState === 0) {
        fromHeading.innerHTML = "From: ";
        attackingFromTerritory.innerHTML = territoryComingFrom.getAttribute("territory-name");
    } else if (buttonState === 1) {
        fromHeading.innerHTML = "";
        attackingFromTerritory.innerHTML = "";
    }
}

function setTransferToTerritory(listOfTerritories) {
    listOfTerritories.forEach(territory => {
        territory.addEventListener('click', function() {
            let clickedTerritoryName = territory.innerHTML;
            const regex = /^(.*?)\s?\(/;
            const match = clickedTerritoryName.match(regex);

            if (match && match[1]) {
                clickedTerritoryName = match[1].trim();
            }

            transferToTerritory = playerOwnedTerritories.find(territory => territory.getAttribute("territory-name") === clickedTerritoryName);

            if (transferToTerritory) {
                document.getElementById(ids.territoryTextString).innerHTML = clickedTerritoryName;
            } else {
                document.getElementById(ids.territoryTextString).innerHTML = "please select an option...";
            }
        });
    });
}
// noinspection JSUnusedGlobalSymbols
export function getLastClickedPath() {
    return lastClickedPath;
}

export function setAttackProbabilityOnUI(probability, situation) {
    const roundedProbability = Math.ceil(probability);
    const displayProbability = roundedProbability >= 100 ? 100 : roundedProbability;

    if (situation === 0) { //attackUI
        document.getElementById(ids.percentageAttack).innerHTML = displayProbability + "%";
        if (displayProbability >= 1) {
            document.getElementById(ids.colorBarAttackOverlayGreen).style.display = "flex";
        } else {
            document.getElementById(ids.colorBarAttackOverlayGreen).style.display = "none";
        }
        document.getElementById(ids.colorBarAttackOverlayGreen).style.width = displayProbability >= 99 ? "100%" : displayProbability + "%";
    } else if (situation === 1) { //battleUI
        let probabilityColumnBox = document.getElementById(ids.probabilityColumnBox);

        let battleUIRow4Col1IconProbabilityTurnsSiege = document.getElementById(ids.battleUIRow4Col1IconProbabilityTurnsSiege);
        let battleUIRow4Col1TextProbabilityTurnsSiege = document.getElementById(ids.battleUIRow4Col1TextProbabilityTurnsSiege);
        battleUIRow4Col1IconProbabilityTurnsSiege.innerHTML = "<img class='sizingPositionRow4Column1IconBattleUI' src='./resources/probability.png'>";
        battleUIRow4Col1TextProbabilityTurnsSiege.innerHTML = displayProbability + "%";

        if (displayProbability >= 75) {
            battleUIRow4Col1TextProbabilityTurnsSiege.style.color = "rgb(0,255,0)";
        } else if (displayProbability <= 25) {
            battleUIRow4Col1TextProbabilityTurnsSiege.style.color = "rgb(245,128,128)";
        } else {
            battleUIRow4Col1TextProbabilityTurnsSiege.style.color = "rgb(255,255,255)";
        }

        probabilityColumnBox.style.width = displayProbability >= 99 ? "100%" : displayProbability + "%";
    }
}

//setCurrentMapColorAndStrokeArrayFromExternal() is gone with the snapshot (Phase 6.7).

export function setTerritoryAboutToBeAttackedFromExternal(value) {
    setAttackTarget(value);
}

function removeDeniedDestinations(destinationPathObjectArray, manualDenialArray) {
    const deniedIds = manualDenialArray.map(path => path.getAttribute("uniqueid"));

    const filteredDestinations = destinationPathObjectArray.filter(destination => {
        const destinationId = destination.getAttribute("uniqueid");
        return !deniedIds.includes(destinationId);
    });

    return filteredDestinations;
}

//----------------------------------------TOGGLE UI ELEMENTS SECTION--------------------------------------------

function toggleUIButton(makeVisible) {
    if (makeVisible) {
        document.getElementById(ids.uiButtonContainer).style.display = "block";
    } else {
        document.getElementById(ids.uiButtonContainer).style.display = "none";
    }
    //Phase 7.4. The activity button is the third item in the same left-hand column
    //and appears at the same moment as the globe above it, so it is toggled from
    //here rather than from all of this function's call sites -- the same reasoning
    //that keeps the music button inside toggleMapModeButton(). Unlike the music
    //button it has no exception: there is nothing to report before a game starts.
    //
    //Taking the button down takes the PANEL down with it. Every caller that hides
    //this button is putting something in front of the map -- the menu, a battle, a
    //transfer window -- and a feed left floating over a battle screen is the same
    //class of bug as the autosave indicator flashing over the map chrome.
    activityPanel.setButtonVisible(makeVisible);
    if (!makeVisible) {
        activityPanel.close();
    }
}

function toggleMapModeButton(makeVisible) {
    if (makeVisible) {
        document.getElementById(ids.mapModeContainer).style.display = "block";
    } else {
        document.getElementById(ids.mapModeContainer).style.display = "none";
    }
    //The music button shares every one of this button's rules but one, so it is
    //still toggled from here rather than from all twelve of this function's call
    //sites -- that is how the two would drift apart. The exception is stated at
    //the three places that need it: see toggleAudioButton().
    toggleAudioButton(makeVisible);
}

/**
 * Show or hide the music button.
 *
 * It follows the rest of the map chrome -- down behind the menu, down behind a
 * battle or a transfer window -- with one exception, which is the whole reason it
 * has a name of its own. The continent-view and territory buttons do not exist
 * until a country has been chosen. The music button does: it is up from the first
 * screen the player sees, because someone who wants the music off wants it off
 * while they are choosing a country too, and the alternative was leaving the game
 * to find the setting in the menu.
 *
 * That exception costs three explicit calls -- one where the selection screen goes
 * up, one where a restart puts it back, and one where the in-game menu closes over
 * it -- because `toggleMapModeButton(false)` is what the selection screen runs.
 */
function toggleAudioButton(makeVisible) {
    audioPanel.setButtonVisible(makeVisible);
}

export function toggleAiDialogue(makeVisible) {
    makeVisible ? aiDialogue.show() : aiDialogue.hide();
}
function toggleBottomLeftPaneWithTurnAdvance(makeVisible) {
    if (makeVisible) {
        document.getElementById(ids.popupWithConfirmContainer).style.display = "block";
    } else {
        document.getElementById(ids.popupWithConfirmContainer).style.display = "none";
    }
}

export function toggleUIMenu(makeVisible) {
    if (makeVisible) {
        document.getElementById(ids.movePhaseButtonsContainer).style.pointerEvents = "none";
        document.getElementById(ids.mainUiContainer).style.display = "block";
        drawUITable(infoTable.tableElement(), 0);
        svg.style.pointerEvents = 'none';
        uiCurrentlyOnScreen = true;
        //The globe button STAYS UP while the panel is open, and its click handler
        //already reads `uiCurrentlyOnScreen` -- so the button that opens the
        //territory panel is now also the button that closes it. It used to be
        //hidden here, which left the X in the corner of the panel as the only way
        //out and made the globe a one-way door. `#UIButtonContainer` sits at
        //z-index 9000, above the panel, so it is reachable rather than merely
        //present.
        toggleUIButton(true);
        uiButtonCurrentlyOnScreen = true;
        toggleMapModeButton(false);
        mapModeButtonCurrentlyOnScreen = false;
        toggleBottomLeftPaneWithTurnAdvance(false);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
        toggleTransferAttackButton(false, false);
    } else {
        document.getElementById(ids.movePhaseButtonsContainer).style.pointerEvents = "auto";
        document.getElementById(ids.mainUiContainer).style.display = "none";
        svg.style.pointerEvents = 'auto';
        uiCurrentlyOnScreen = false;
        toggleUIButton(true);
        uiButtonCurrentlyOnScreen = true;
        toggleBottomLeftPaneWithTurnAdvance(true);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
        toggleMapModeButton(true);
        mapModeButtonCurrentlyOnScreen = true;
        if (transferAttackButtonDisplayed) {
            toggleTransferAttackButton(true, false);
        }
    }
}

export function toggleUpgradeMenu(makeVisible) {
    makeVisible ? upgradeWindow.show() : upgradeWindow.hide();
    document.getElementById(ids.mainUiContainer).style.pointerEvents = makeVisible ? 'none' : 'auto';
}

export function toggleBuyMenu(makeVisible) {
    makeVisible ? buyWindow.show() : buyWindow.hide();
    document.getElementById(ids.mainUiContainer).style.pointerEvents = makeVisible ? 'none' : 'auto';
}

function toggleBattleUI(turnOnBattleUI, enterSiege) {
    if (enterSiege) {
        battleUI.hide();
        svg.style.pointerEvents = 'auto';
        document.getElementById(ids.movePhaseButtonsContainer).style.display = "flex";
    } else {
        if (turnOnBattleUI) {
            battleUI.show();
            svg.style.pointerEvents = 'none';
            document.getElementById(ids.movePhaseButtonsContainer).style.display = "none";
        } else if (!turnOnBattleUI) {
            battleUI.hide();
            document.getElementById(ids.movePhaseButtonsContainer).style.display = "flex";
        }
    }
}

function toggleBattleResults(turnOnBattleResults) {
    if (turnOnBattleResults) {
        battleResults.show();
        document.getElementById(ids.movePhaseButtonsContainer).style.display = "none";
    } else if (!turnOnBattleResults) {
        document.getElementById(ids.movePhaseButtonsContainer).style.display = "flex";
        battleResults.hide();
        svg.style.pointerEvents = 'auto';
    }
}

function toggleTransferAttackWindow(turnOnTransferAttackWindow) {
    if (turnOnTransferAttackWindow) {
        transferAttackWindow.show();
        transferAttackWindowOnScreen = true;
        svg.style.pointerEvents = 'none';
    } else if (!turnOnTransferAttackWindow) {
        transferAttackWindow.hide();
        svg.style.pointerEvents = 'auto';
    }
    //set height of colorBars for attack
    const sourceElement = document.getElementById(ids.titleTransferAttackWindow);
    const redBar = document.getElementById(ids.colorBarAttackUnderlayRed);
    const greenBar = document.getElementById(ids.colorBarAttackOverlayGreen);

    const computedStyle = window.getComputedStyle(sourceElement);
    const sourceHeight = computedStyle.getPropertyValue('height');
    redBar.style.height = sourceHeight;
    greenBar.style.height = sourceHeight;
}

function toggleBottomTableContainer(turnOnTable) {
    let tableContainer = document.getElementById(ids.bottomTableContainer);
    if (turnOnTable) {
        tableContainer.style.display = "block";
    } else if (!turnOnTable) {
        tableContainer.style.display = "none";
    }
}

function toggleTopTableContainer(turnOnTable) {
    let tableContainer = document.getElementById(ids.topTableContainer);
    if (turnOnTable) {
        tableContainer.style.display = "block";
    } else if (!turnOnTable) {
        tableContainer.style.display = "none";
    }
}

export function toggleTransferAttackButton(turnOnButton, aiTurn) {
    let transferAttackButton = moveButton.element();
    let attackText = moveButton.destinationElement();
    let transferAttackContainer = document.getElementsByClassName("move-phase-buttons-container");
    let popupWithConfirmContainer = document.getElementsByClassName("popup-with-confirm-container");
    if (turnOnButton) {
        transferAttackButton.style.display = "flex";
        if (attackTextCurrentlyDisplayed) {
            attackText.style.display = "flex";
        }
    } else if (!turnOnButton) {
        transferAttackButton.style.display = "none";
        attackText.style.display = "none";
    }
    if (aiTurn) {
        if (turnOnButton) {
            attackText.style.display = "none";
            transferAttackButtonDisplayed = true;
            attackTextCurrentlyDisplayed = false;
            moveButton.setVariant("attack");
            transferAttackButton.style.color = "yellow";
            transferAttackButton.disabled = true;
            for (const popup of popupWithConfirmContainer) {
                popup.style.bottom = "6%";
            }
            for (const container of transferAttackContainer) {
                container.style.left = "39%";
                container.style.width = "35%";
            }
        } else {
            transferAttackButton.style.color = "white";
            transferAttackButtonDisplayed = false;
            transferAttackButton.disabled = false;
            for (const popup of popupWithConfirmContainer) {
                popup.style.bottom = "8%";
            }
            for (const container of transferAttackContainer) {
                container.style.left = "42%";
                container.style.width = "16%";
            }
        }
    }
}

function toggleUIToAppearAtStartOfTurn(uiAppearsAtStartOfTurn) {
    //The button used to be emptied to say "off", which is indistinguishable from a
    //button that failed to render. It always shows its icon now and the component
    //owns how the state reads -- see `InfoTable.setAppearAtStartOfTurn()`.
    const next = !uiAppearsAtStartOfTurn;
    infoTable.setAppearAtStartOfTurn(next);
    return next;
}

//----------------------------------------END OF TOGGLE UI ELEMENTS SECTION-----------------------------------

function setupSiegeUI(territory) {
    battleUIState = 1;
    const siegeObjectElement = getSiegeObjectFromPath(territory);

    const retreatButton = document.getElementById(ids.retreatButton);
    const advanceButton = document.getElementById(ids.advanceButton);
    const siegeBottomBarButton = document.getElementById(ids.siegeBottomBarButton);

    const attackerCountry = playerCountryName();
    const defenderTerritory = siegeObjectElement.defendingTerritory.dataName;

    let probBarAdded = false;

    //SET FLAGS
    setFlag(attackerCountry, 4);
    setFlag(defenderTerritory, 5);

    //SET TITLE TEXT
    setTitleTextBattleUI(attackerCountry, defenderTerritory, 1);

    document.getElementById(ids.battleUITitleTitleCenter).innerHTML = "Sieges";

    prepareProbabilityBar(1, probBarAdded);

    //SET ARMY TEXT VALUES
    setArmyTextValues(siegeObjectElement, 2, siegeObjectElement.defendingTerritory.uniqueId);

    //SET DEFENSE BONUS VALUE
    document.getElementById(ids.mountainDefenseText).innerHTML = siegeObjectElement.defendingTerritory.mountainDefenseBonus;
    document.getElementById(ids.defenseBonusText).innerHTML = siegeObjectElement.defendingTerritory.defenseBonus;
    //SET PROD POP AND FOOD VALUES IN SIEGE SCREEN
    document.getElementById(ids.prodPopText).innerHTML = formatNumbersToKMB(siegeObjectElement.defendingTerritory.productiveTerritoryPop, 0);
    document.getElementById(ids.foodText).innerHTML = formatNumbersToKMB(siegeObjectElement.defendingTerritory.foodCapacity, 0);


    //SET SIEGE TURNS TEXT
    setSiegeTurnsText(siegeObjectElement);

    //SET SIEGE ROW 4
    let siegeScore = calculateSiegeScore(siegeObjectElement);
    setSiegeScoreText(siegeScore, 0);
    document.getElementById(ids.battleUIRow4Col1TextProbabilityTurnsSiege).style.color = "rgb(255,255,255)";
    //The same expression used to be written out here as well as in the siege rules, and
    //the two parted company the moment the attacker's advantage was applied to one of
    //them: the screen would have told the player a siege was losing while the rule
    //scored it as winning. One function, one answer.
    let difference = scoreDifferenceFor(siegeScore, siegeObjectElement.defendingTerritory);
    if (difference <= 0) {
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).style.color = "rgb(245,128,128)";
    } else if (difference > 0 && difference < 50) {
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).style.color = "rgb(255, 255, 0)";
    } else {
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).style.color = "rgb(0, 255, 0)";
    }

    setRow4(1);

    //INITIALISE BUTTONS
    retreatButton.style.display = "flex";
    advanceButton.style.display = "flex";
    siegeBottomBarButton.style.display = "flex";

    retreatButton.style.width = "33%";
    advanceButton.style.width = "33%";
    siegeBottomBarButton.style.width = "34%";

    advanceButton.innerHTML = "Continue Siege";
    advanceButtonState = 3;

    retreatButtonState = setRetreatButtonText(0, retreatButton);
    retreatButton.innerHTML = "Pull Out";
    retreatButton.disabled = false;
    retreatButton.style.backgroundColor = "rgb(131, 38, 38)";
}

function setupBattleUI(attackArray) {
    let war = historicWars.find((siege) => siege.warId === getCurrentWarId());
    if (war) {
        battleUIState = 1;
    } else {
        battleUIState = 0;
    }
    setCurrentRound(0);

    const retreatButton = document.getElementById(ids.retreatButton);
    const advanceButton = document.getElementById(ids.advanceButton);

    retreatButton.classList.remove("battleUIRowButtonsGreyBg");
    advanceButton.classList.remove("battleUIRowButtonsGreyBg");

    retreatButton.classList.add("battleUIRowButtonsRedBg");
    advanceButton.classList.add("battleUIRowButtonsGreenBg");
    retreatButton.style.backgroundColor = "rgb(131, 38, 38)";
    advanceButton.style.backgroundColor = "rgb(0, 128, 0)";

    retreatButton.disabled = false;
    advanceButton.disabled = false;

    let flagStringAttacker;
    let flagStringDefender;
    let attackerCountry;
    let defenderTerritory;

    for (let i = 0; i < attackArray.length; i++) {
        for (let j = 0; j < paths.length; j++) {
            if (paths[j].getAttribute("uniqueid") === attackArray[0]) {
                flagStringDefender = pathCountry(paths[j]);
                defenderTerritory = paths[j];
            }
            if (paths[j].getAttribute("uniqueid") === attackArray[1].toString()) { //any player territory to get country name
                flagStringAttacker = pathCountry(paths[j]);
                attackerCountry = paths[j];
            }
        }
    }

    //SET FLAGS
    setFlag(flagStringAttacker, 4);
    setFlag(flagStringDefender, 5);

    //SET TITLE TEXT
    setTitleTextBattleUI(attackerCountry, defenderTerritory, 0);

    document.getElementById(ids.battleUITitleTitleCenter).innerHTML = "vs";

    let probBarAdded = false;

    if (document.getElementById(ids.probabilityColumnBox)) {
        document.getElementById(ids.probabilityColumnBox).style.display = "flex";
    } else {
        probBarAdded = true;
        const battleUIRow2 = document.getElementById(ids.battleUIRow2);
        battleUIRow2.innerHTML = "";
        const probabilityColumnBox = document.createElement("div");
        probabilityColumnBox.classList.add("probabilityColumnBox");
        probabilityColumnBox.classList.add("probabilityColumnBox");
        probabilityColumnBox.setAttribute("id", ids.probabilityColumnBox);
        battleUIRow2.appendChild(probabilityColumnBox);
    }
    prepareProbabilityBar(0, probBarAdded);

    //SET PROBABILITY ON UI
    setAttackProbabilityOnUI(probability, 1);

    //SET ARMY TEXT VALUES
    let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());
    if (!hasSiegedBefore) {
        setArmyTextValues(attackArray, 0, defenderTerritory.getAttribute("uniqueid"));
    }

    //SET DEFENSE BONUS VALUE
    if (!hasSiegedBefore) {
        for (let i = 0; i < allTerritories().length; i++) {
            if (defenderTerritory.getAttribute("uniqueid") === allTerritories()[i].uniqueId) {
                document.getElementById(ids.defenseBonusText).innerHTML = allTerritories()[i].defenseBonus;
                document.getElementById(ids.mountainDefenseText).innerHTML = allTerritories()[i].mountainDefenseBonus;
            }
        }
    } else {
        for (const key in playerSiegeWarsList) {
            if (playerSiegeWarsList[key].defendingTerritory.territoryName === defenderTerritory.getAttribute("territory-name")) {
                document.getElementById(ids.defenseBonusText).innerHTML = playerSiegeWarsList[key].defendingTerritory.defenseBonus;
                document.getElementById(ids.mountainDefenseText).innerHTML = playerSiegeWarsList[key].defendingTerritory.mountainDefenseBonus;
                break;
            }
        }
    }

    //SET ATTACK ROW 4
    setSiegeScoreText(0, 1);
    setRow4(0);

    //INITIALISE BUTTONS
    retreatButton.style.display = "flex";
    advanceButton.style.display = "flex";
    document.getElementById(ids.siegeBottomBarButton).style.display = "none";

    retreatButton.style.width = "50%";
    advanceButton.style.width = "50%";

    retreatButtonState = setRetreatButtonText(0, retreatButton);
    advanceButtonState = 0;
    setAdvanceButtonText(6, advanceButton);

    attackCountry = getTerritory(attackArray[1])?.dataName;
    defendTerritory = getTerritory(attackArray[0]);

    //A deliberate snapshot, and the one copy of a territory Phase 4.7 keeps. The siege and
    //historic-war objects built from it take only its `uniqueId` and then reference the live
    //territory; what they read off this copy are the `startingDefenseBonus` /
    //`startingFoodCapacity` / `startingProdPop` / `startingTerritoryPop` values, which have
    //to be the numbers as they were when the battle opened. Nothing writes through it.
    originalDefendingTerritory = defendTerritory ? { ...defendTerritory } : null;
}

function setTitleTextBattleUI(attacker, defender, attackSiege) {
    let attackerContainer = document.getElementById(ids.battleUITitleTitleLeft);
    let defenderContainer = document.getElementById(ids.battleUITitleTitleRight);

    if (attackSiege === 0) { //attack
        let attackerCountry = pathCountry(attacker);
        let defenderTerritory = defender.getAttribute("territory-name");

        attackerCountry = reduceKeywords(attackerCountry);
        defenderTerritory = reduceKeywords(defenderTerritory);

        attackerContainer.innerHTML = attackerCountry;
        defenderContainer.innerHTML = defenderTerritory;
    } else if (attackSiege === 1) { //siege
        attacker = reduceKeywords(attacker);
        defender = reduceKeywords(defender);

        attackerContainer.innerHTML = attacker;
        defenderContainer.innerHTML = defender;
    }
}

export function setArmyTextValues(attackArray, situation, defendingUniqueId) {
    let totalAttackingArmy = [0, 0, 0, 0];
    let totalDefendingArmy = [0, 0, 0, 0];
    let startingAssault;
    let startingAir;
    let startingNaval;

    if (situation === 0) { //pre battle
        //get attacking army
        for (let i = 1; i < attackArray.length; i += 5) {
            const infantryCount = attackArray[i + 1];
            const assaultCount = attackArray[i + 2];
            const airCount = attackArray[i + 3];
            const navalCount = attackArray[i + 4];

            totalAttackingArmy[0] += infantryCount;
            totalAttackingArmy[1] += assaultCount;
            totalAttackingArmy[2] += airCount;
            totalAttackingArmy[3] += navalCount;
        }

        //get defending army
        for (let i = 0; i < allTerritories().length; i++) {
            if (allTerritories()[i].uniqueId === defendingUniqueId) { //any player territory to get country name
                const infantryCount = allTerritories()[i].infantryForCurrentTerritory;
                const assaultCount = allTerritories()[i].useableAssault;
                const airCount = allTerritories()[i].useableAir;
                const navalCount = allTerritories()[i].useableNaval;

                totalDefendingArmy[0] += infantryCount;
                totalDefendingArmy[1] += assaultCount;
                totalDefendingArmy[2] += airCount;
                totalDefendingArmy[3] += navalCount;
            }
        }
    } else if (situation === 1) { //middle battle

        totalAttackingArmy[0] = attackArray[0];
        totalAttackingArmy[1] = attackArray[1];
        totalAttackingArmy[2] = attackArray[2];
        totalAttackingArmy[3] = attackArray[3];

        totalDefendingArmy[0] = attackArray[4];
        totalDefendingArmy[1] = attackArray[5];
        totalDefendingArmy[2] = attackArray[6];
        totalDefendingArmy[3] = attackArray[7];
    } else if (situation === 2) { //return from siege

        totalAttackingArmy[0] = attackArray.attackingArmyRemaining[0];
        totalAttackingArmy[1] = attackArray.attackingArmyRemaining[1];
        totalAttackingArmy[2] = attackArray.attackingArmyRemaining[2];
        totalAttackingArmy[3] = attackArray.attackingArmyRemaining[3];

        totalDefendingArmy[0] = attackArray.defendingArmyRemaining[0];
        totalDefendingArmy[1] = attackArray.defendingArmyRemaining[1];
        totalDefendingArmy[2] = attackArray.defendingArmyRemaining[2];
        totalDefendingArmy[3] = attackArray.defendingArmyRemaining[3];

        startingAssault = attackArray.startingDef[1];
        startingAir = attackArray.startingDef[2];
        startingNaval = attackArray.startingDef[3];
    } else if (situation === 3) { //return from siege, click assault
        totalAttackingArmy[0] = attackArray.attackingArmyRemaining[0];
        totalAttackingArmy[1] = attackArray.attackingArmyRemaining[1];
        totalAttackingArmy[2] = attackArray.attackingArmyRemaining[2];
        totalAttackingArmy[3] = attackArray.attackingArmyRemaining[3];

        totalDefendingArmy[0] = attackArray.defendingArmyRemaining[0];
        totalDefendingArmy[1] = attackArray.defendingArmyRemaining[1];
        totalDefendingArmy[2] = attackArray.defendingArmyRemaining[2];
        totalDefendingArmy[3] = attackArray.defendingArmyRemaining[3];

        startingAssault = attackArray.startingDef[1];
        startingAir = attackArray.startingDef[2];
        startingNaval = attackArray.startingDef[3];
    }

    document.getElementById(indexedIds.armyRowQuantity(1)).innerHTML = formatNumbersToKMB(totalAttackingArmy[0], 0);
    document.getElementById(indexedIds.armyRowQuantity(2)).innerHTML = formatNumbersToKMB(totalAttackingArmy[1], 0);
    document.getElementById(indexedIds.armyRowQuantity(3)).innerHTML = formatNumbersToKMB(totalAttackingArmy[2], 0);
    document.getElementById(indexedIds.armyRowQuantity(4)).innerHTML = formatNumbersToKMB(totalAttackingArmy[3], 0);
    document.getElementById(indexedIds.armyRowQuantity(5)).innerHTML = formatNumbersToKMB(totalDefendingArmy[0], 0);
    if (situation === 2) {
        document.getElementById(indexedIds.armyRowQuantity(6)).innerHTML = formatNumbersToKMB(totalDefendingArmy[1], 0) + " / " + startingAssault;
        document.getElementById(indexedIds.armyRowQuantity(7)).innerHTML = formatNumbersToKMB(totalDefendingArmy[2], 0) + " / " + startingAir;
        document.getElementById(indexedIds.armyRowQuantity(8)).innerHTML = formatNumbersToKMB(totalDefendingArmy[3], 0) + " / " + startingNaval;
    } else {
        document.getElementById(indexedIds.armyRowQuantity(6)).innerHTML = formatNumbersToKMB(totalDefendingArmy[1], 0);
        document.getElementById(indexedIds.armyRowQuantity(7)).innerHTML = formatNumbersToKMB(totalDefendingArmy[2], 0);
        document.getElementById(indexedIds.armyRowQuantity(8)).innerHTML = formatNumbersToKMB(totalDefendingArmy[3], 0);
    }

    setDefendingTerritoryCopyEnd(totalDefendingArmy);
}

export function reduceKeywords(str) {
    const keywords = {
        'south': 'S.',
        'north': 'N.',
        'saint': 'St.',
        'vincent': 'V.',
        'and': '&',
        'republic': 'Rp.',
        'democratic': 'Dem.',
        'central': 'C.'
    };

    // Split the string into an array of words
    const words = str.split(' ');

    // Iterate over each word and apply reduction if it's a keyword
    const reducedWords = words.map((word) => {
        const lowercaseWord = word.toLowerCase();
        const reducedWord = keywords[lowercaseWord] || word;
        return reducedWord;
    });

    // Join the reduced words back into a string
    return reducedWords.join(' ');
}

export function setRetreatButtonText(situation, button) {
    switch (situation) {
        case 0: //open battle / start of attack round of 5
            button.innerHTML = "Retreat!";
            break;
        case 1: // midway through round of 5
            button.innerHTML = "Scatter!";
            break;
        case 2: // midway through round of 5
            button.innerHTML = "Defeat!";
            break;
    }

    return situation;
}

export function setAdvanceButtonText(situation, button) {
    switch (situation) {
        case 0: //start of attack round of 5
            button.innerHTML = "Start Attack!";
            break;
        case 1: // midway through round of 5
            button.innerHTML = "Next Skirmish";
            break;
        case 2: // win war outright
            button.innerHTML = "Victory!";
            break;
        case 3: // massive assault win
            button.innerHTML = "Massive Assault";
            break;
        case 4: // routing win
            button.innerHTML = "Rout The Enemy";
            break;
        case 5: // end round
            button.innerHTML = "End Round";
            break;
        case 6: // start of war
            button.innerHTML = "Begin War!";
            break;
    }

    return situation;
}

export function setAdvanceButtonState(value) {
    return advanceButtonState = value;
}

export function setRetreatButtonState(value) {
    return retreatButtonState = value;
}

export function setFirstSetOfRounds(value) {
    return firstSetOfRounds = value;
}

export function populateWarResultPopup(situation, flagStringAttacker, territoryDefender, defeatType, arrayIfArrest) {

    let territoryPath;
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("uniqueid") === territoryDefender.uniqueId) {
            territoryPath = paths[i];
            break;
        }
    }

    let flagStringDefender = territoryDefender.dataName;
    territoryStringDefender = territoryDefender.territoryName;

    //SET FLAGS
    setFlag(flagStringAttacker, 6);
    setFlag(flagStringDefender, 7);

    //SET TITLE COUNTRY NAMES
    document.getElementById(ids.battleResultsTitleTitleLeft).innerHTML = flagStringAttacker;
    document.getElementById(ids.battleResultsTitleTitleRight).innerHTML = territoryStringDefender;

    let confirmButtonBattleResults = battleResults.confirmButton();

    if (situation === 0) { //won
        confirmButtonBattleResults.classList.remove("battleResultsRow4Lost");
        confirmButtonBattleResults.classList.add("battleResultsRow4Won");
        confirmButtonBattleResults.style.backgroundColor = "rgb(0, 128, 0)";
        document.getElementById(ids.battleResultsTitleTitleCenter).innerHTML = "Conquers";
        confirmButtonBattleResults.innerHTML = "Accept Victory!";
        territoryPath.setAttribute("fill", playerColour());
    } else if (situation === 1) { //lost
        confirmButtonBattleResults.classList.remove("battleResultsRow4Won");
        confirmButtonBattleResults.classList.add("battleResultsRow4Lost");
        confirmButtonBattleResults.style.backgroundColor = "rgb(131, 38, 38)";
        if (defeatType === "retreat") {
            document.getElementById(ids.battleResultsTitleTitleCenter).innerHTML = "Pulls  Out  Of";
            confirmButtonBattleResults.innerHTML = "Accept Retreat!";
        } else if (defeatType === "scatter") {
            document.getElementById(ids.battleResultsTitleTitleCenter).innerHTML = "Scatters From";
            confirmButtonBattleResults.innerHTML = "Accept Defeat!";
        } else if (defeatType === "arrest") {
            document.getElementById(ids.battleResultsTitleTitleCenter).innerHTML = "Arrested By";
            confirmButtonBattleResults.innerHTML = "Accept Defeat!";
        } else {
            document.getElementById(ids.battleResultsTitleTitleCenter).innerHTML = "Defeated  By";
            confirmButtonBattleResults.innerHTML = "Accept Defeat!";
        }
    }

    //MAIN STATS
    if (defeatType === "arrest") {
        setBattleResultsTextValues(arrayIfArrest.startingAtt, arrayIfArrest.attackingArmyRemaining, situation, true, arrayIfArrest);
    } else {
        setBattleResultsTextValues(getFinalAttackArray(), getAttackingArmyRemaining(), situation, false, 0);
    }

    //ROUND COLUMN
    if (situation === 0) {
        setResolution("Victory");
        document.getElementById(ids.battleResultsRow3Row3RoundsCount).innerHTML = "Rounds To Victory:  " + roundCounterForStats;
    } else if (situation === 1) {
        if (defeatType === "retreat") {
            setResolution("Retreat");
            document.getElementById(ids.battleResultsRow3Row3RoundsCount).innerHTML = "Respectful Retreat";
        } else if (defeatType === "scatter") {
            setResolution("Retreat");
            document.getElementById(ids.battleResultsRow3Row3RoundsCount).innerHTML = "Troops Scatter";
        } else if (defeatType === "arrest") {
            document.getElementById(ids.battleResultsRow3Row3RoundsCount).innerHTML = "Siege Troops Arrested";
        } else {
            setResolution("Defeat");
            document.getElementById(ids.battleResultsRow3Row3RoundsCount).innerHTML = "Rounds To Defeat:  " + roundCounterForStats;
        }
    }

    roundCounterForStats = 0;
}

function setBattleResultsTextValues(attackArray, attackingArmyRemaining, situation, leftSiegeByArrest, siegeObject) {
    let totalAttackingArmy = [0, 0, 0, 0];
    let totalDefendingArmy = [0, 0, 0, 0];

    let infantryCount;
    let assaultCount;
    let airCount;
    let navalCount;

    if (leftSiegeByArrest) {
        attackArray.unshift(0, 0); //format array to work in loop below
    }

    // Get attacking army
    for (let i = 1; i < attackArray.length; i += 5) {
        infantryCount = attackArray[i + 1];
        assaultCount = attackArray[i + 2];
        airCount = attackArray[i + 3];
        navalCount = attackArray[i + 4];

        totalAttackingArmy[0] += infantryCount;
        totalAttackingArmy[1] += assaultCount;
        totalAttackingArmy[2] += airCount;
        totalAttackingArmy[3] += navalCount;
    }

    // Get defending army
    if (leftSiegeByArrest) {
        totalDefendingArmy[0] = siegeObject.defendingTerritory.infantryForCurrentTerritory;
        totalDefendingArmy[1] = siegeObject.defendingTerritory.useableAssault;
        totalDefendingArmy[2] = siegeObject.defendingTerritory.useableAir;
        totalDefendingArmy[3] = siegeObject.defendingTerritory.useableNaval;
    } else {
        totalDefendingArmy[0] = defendingTerritoryCopyStart.infantryForCurrentTerritory;
        totalDefendingArmy[1] = defendingTerritoryCopyStart.useableAssault;
        totalDefendingArmy[2] = defendingTerritoryCopyStart.useableAir;
        totalDefendingArmy[3] = defendingTerritoryCopyStart.useableNaval;
    }

    let attackingSurvived = [0, 0, 0, 0];
    // Calculate losses and survivors
    let attackingLosses;
    if (!attackingArmyRemaining.includes("All")) {
        attackingLosses = totalAttackingArmy.map((count, index) => count - attackingArmyRemaining[index]);
    } else {
        attackingLosses = ["-", "-", "-", "-"];
    }


    if ((retreatButtonState !== 2 && situation === 1) || (situation === 0)) { //if not outright defeat
        attackingSurvived = attackingArmyRemaining;
    }

    if (totalAttackingArmy[0] === 0) {
        attackingSurvived[0] = "-";
        attackingLosses[0] = "-";
    }
    if (totalAttackingArmy[1] === 0) {
        attackingSurvived[1] = "-";
        attackingLosses[1] = "-";
    }
    if (totalAttackingArmy[2] === 0) {
        attackingSurvived[2] = "-";
        attackingLosses[2] = "-";
    }
    if (totalAttackingArmy[3] === 0) {
        attackingSurvived[3] = "-";
        attackingLosses[3] = "-";
    }

    if (attackingArmyRemaining.includes("All")) {
        attackingSurvived = attackingArmyRemaining;
    }

    let defendingLosses = [];
    if (leftSiegeByArrest) {
        defendingLosses[0] = siegeObject.defendingArmyRemaining[0] - totalDefendingArmy[0];
        defendingLosses[1] = siegeObject.defendingArmyRemaining[1] - totalDefendingArmy[1];
        defendingLosses[2] = siegeObject.defendingArmyRemaining[2] - totalDefendingArmy[2];
        defendingLosses[3] = siegeObject.defendingArmyRemaining[3] - totalDefendingArmy[3];
    } else {
        defendingLosses[0] = totalDefendingArmy[0] - defendingTerritoryCopyEnd[0];
        defendingLosses[1] = totalDefendingArmy[1] - defendingTerritoryCopyEnd[1];
        defendingLosses[2] = totalDefendingArmy[2] - defendingTerritoryCopyEnd[2];
        defendingLosses[3] = totalDefendingArmy[3] - defendingTerritoryCopyEnd[3];
    }

    let capturedArray = [0, 0, 0, 0];

    if (totalDefendingArmy[0] === 0) {
        defendingLosses[0] = "-";
        capturedArray[0] = "-";
    }
    if (totalDefendingArmy[1] === 0) {
        defendingLosses[1] = "-";
        capturedArray[1] = "-";
    }
    if (totalDefendingArmy[2] === 0) {
        defendingLosses[2] = "-";
        capturedArray[2] = "-";
    }
    if (totalDefendingArmy[3] === 0) {
        defendingLosses[3] = "-";
        capturedArray[3] = "-";
    }

    for (let i = 0; i < defendingLosses.length; i++) {
        if (attackingArmyRemaining.includes("All") && defendingLosses[i] !== "-") {
            defendingLosses[i] = "None";
        }
    }



    let rout = getRoutStatus();
    let massiveAssault = getMassiveAssaultStatus();


    if (rout) {
        capturedArray = [Math.floor(defendingTerritoryCopyEnd[0] / 2), Math.floor(defendingTerritoryCopyEnd[1] / 2), Math.floor(defendingTerritoryCopyEnd[2] / 2), Math.floor(defendingTerritoryCopyEnd[3] / 2), ]
    }

    //LOSSES
    for (let i = 0; i < attackingLosses.length; i++) {
        const element = document.getElementById(indexedIds.battleResultsLostQuantity(i+1));
        let formattedValue;
        if (attackingLosses[i] !== "-") {
            formattedValue = formatNumbersToKMB(attackingLosses[i], 0);
        } else {
            formattedValue = "-";
        }

        element.innerHTML = formattedValue;

        if (attackingLosses[i] !== "-") {
            if (attackingLosses[i] > 0) {
                element.style.color = 'rgb(220, 120, 120)';
            } else {
                element.style.color = 'rgb(0, 200, 0)';
            }
        } else {
            element.style.color = 'white';
        }
    }

    //KILLS
    for (let i = 0; i < defendingLosses.length; i++) {
        const element = document.getElementById(indexedIds.battleResultsLostQuantity(i+5));
        let formattedValue;
        if (defendingLosses[i] !== "-" && defendingLosses[i] !== "None") {
            formattedValue = formatNumbersToKMB(defendingLosses[i], 0);
        } else if (defendingLosses[i] === "None") {
            formattedValue = "None";
        } else {
            formattedValue = "-";
        }

        element.innerHTML = formattedValue;

        if (defendingLosses[i] !== "-" && defendingLosses[i] !== "None") {
            if (defendingLosses[i] > 0) {
                element.style.color = 'rgb(0, 200, 0)';
            } else {
                element.style.color = 'yellow';
            }
        } else {
            element.style.color = 'white';
        }
    }

    //SURVIVALS
    for (let i = 0; i < attackingSurvived.length; i++) {
        const element = document.getElementById(indexedIds.battleResultsRemainingQuantity(i+1));
        if (massiveAssault && attackingSurvived[i] !== "-") {
            attackingSurvived[i] = Math.floor(attackingSurvived[i] * 0.8);
        }
        let formattedValue;
        if (attackingSurvived[i] !== "-" && attackingSurvived[i] !== "All") {
            formattedValue = formatNumbersToKMB(attackingSurvived[i], 0);
        } else if (attackingSurvived[i] === "All") {
            formattedValue = "All";
        } else {
            formattedValue = "-";
        }

        element.innerHTML = formattedValue;

        if (attackingSurvived[i] !== "-" && attackingSurvived[i] !== "All") {
            if (attackingSurvived[i] > 0) {
                element.style.color = 'yellow';
            } else {
                element.style.color = 'rgb(220, 120, 120)';
            }
        } else {
            element.style.color = 'white';
        }

    }

    //CAPTURED
    for (let i = 0; i < capturedArray.length; i++) {
        const element = document.getElementById(indexedIds.battleResultsRemainingQuantity(i+5));
        let formattedValue;

        if (rout && totalDefendingArmy[i] > 0) {
            formattedValue = formatNumbersToKMB(capturedArray[i], 0);
        } else {
            capturedArray[i] = "-";
            formattedValue = "-";
        }

        element.innerHTML = formattedValue;

        if (capturedArray[i] !== "-" && capturedArray[i] !== "All") {
            if (capturedArray[i] > 0) {
                element.style.color = 'rgb(0, 200, 0)';
            } else {
                element.style.color = 'yellow';
            }
        } else {
            element.style.color = 'white';
        }
    }

    setRoutStatus(false);
    setMassiveAssaultStatus(false);
}

export function setDefendingTerritoryCopyStart(object) {
    return defendingTerritoryCopyStart = {
        ...object
    }; //copies object not just reference it
}

export function setDefendingTerritoryCopyEnd(array) {
    return defendingTerritoryCopyEnd = [...array]; //copies object not just reference it
}

export function enableDisableSiegeButton(enableOrDisable) {
    let siegeButton = document.getElementById(ids.siegeButton);
    if (enableOrDisable === 0) { //enable
        siegeButton.style.backgroundColor = "rgb(114, 88, 48)";
        siegeButton.disabled = false;
    } else if (enableOrDisable === 1) { //disable
        siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
        siegeButton.disabled = true;
    }
}

export function getSiegeObjectFromPath(territory) {
    if (territory.getAttribute("territory-name") in playerSiegeWarsList) {
        return playerSiegeWarsList[territory.getAttribute("territory-name")];
    } else if (territory.getAttribute("territory-name") in aiSiegeWarsList) {
        return aiSiegeWarsList[territory.getAttribute("territory-name")];
    } else {
        return "Error - Siege not found in either array in getSiegeObjectFromPath()";
    }
}

/**
 * The historic war recorded against this path's territory, or null.
 *
 * Returns NULL when there is none. It used to return the string
 * "Error - Siege not found in either array in getHistoricWarObject()", which is not a war
 * and does not read like one -- its only caller dereferenced it and froze the game
 * (known-issues AM). A missing siege is an ordinary answer here, not an error.
 */
export function getHistoricWarObject(ai, territory) {
    const territoryName = territory.getAttribute("territory-name");
    const wars = ai ? historicAiWars : historicWars;
    return wars.find((war) => war.defendingTerritory &&
        war.defendingTerritory.territoryName === territoryName) ?? null;
}

function prepareProbabilityBar(siegeOrAttack, probBarAdded) {
    const battleUIRow2 = document.getElementById(ids.battleUIRow2);
    const probabilityColumnBox = document.getElementById(ids.probabilityColumnBox);

    if (siegeOrAttack === 0) { // Attack
        probabilityColumnBox.style.display = "flex";
        battleUIRow2.classList.remove("battleUIRow2SiegeBg");
        battleUIRow2.classList.add("battleUIRow2AttackBg");
        battleUIRow2.style.backgroundColor = "rgb(131, 38, 38)";
        battleUIRow2.style.alignItems = "";
        battleUIRow2.style.justifyContent = "";
        if (!probBarAdded) {
            battleUIRow2.appendChild(probabilityColumnBox);
        }
    } else if (siegeOrAttack === 1) { // Siege
        if (probabilityColumnBox) {
            probabilityColumnBox.style.display = "none";
            battleUIRow2.removeChild(probabilityColumnBox);
        }
        battleUIRow2.classList.remove("battleUIRow2AttackBg");
        battleUIRow2.classList.add("battleUIRow2SiegeBg");
        battleUIRow2.style.backgroundColor = "rgb(114, 88, 48)";
        battleUIRow2.style.alignItems = "center";
        battleUIRow2.style.justifyContent = "center";
        battleUIRow2.innerHTML = "Under Siege!";
    }
}

function setSiegeTurnsText(siegeObject) {
    const {
        turnsInSiege
    } = siegeObject;
    document.getElementById(ids.battleUIRow4Col1IconProbabilityTurnsSiege).innerHTML = "<img class='sizingPositionRow4Column1IconBattleUI' src='./resources/turnsIcon.png'>";
    document.getElementById(ids.battleUIRow4Col1TextProbabilityTurnsSiege).innerHTML = turnsInSiege;
}



function setRow4(siegeOrAttack) {
    //get appropriate columns
    const row4RightColumnA = document.getElementById(ids.battleStatsProdPopIcon);
    const row4RightColumnB = document.getElementById(ids.battleStatsProdPopValue);
    const row4RightColumnC = document.getElementById(ids.battleStatsFoodIcon);
    const row4RightColumnD = document.getElementById(ids.battleStatsFoodValue);
    const row4RightColumnE = document.getElementById(ids.battleStatsDefenseIcon);

    const prodPopIcon = document.getElementById(ids.prodPopIcon);
    const foodIcon = document.getElementById(ids.foodIcon);

    const siegeButton = document.getElementById(ids.siegeButton);

    if (siegeOrAttack === 0) { //attack

        row4RightColumnB.style.display = "none";
        row4RightColumnC.style.display = "none";
        row4RightColumnD.style.display = "none";

        prodPopIcon.style.display = "none";
        foodIcon.style.display = "none";

        siegeButton.style.display = "flex";

        row4RightColumnA.style.width = "70%";
        row4RightColumnE.style.width = "";

        row4RightColumnA.style.marginLeft = "";
        row4RightColumnE.style.marginLeft = "";

    } else if (siegeOrAttack === 1) { //siege

        row4RightColumnB.style.display = "flex";
        row4RightColumnC.style.display = "flex";
        row4RightColumnD.style.display = "flex";

        prodPopIcon.style.display = "flex";
        foodIcon.style.display = "flex";

        siegeButton.style.display = "none";

        row4RightColumnA.style.width = "10%";
        row4RightColumnC.style.width = "10%";
        row4RightColumnE.style.width = "10%";

        row4RightColumnA.style.marginLeft = "10px";
        row4RightColumnC.style.marginLeft = "10px";
        row4RightColumnE.style.marginLeft = "10px";
    }
}

/**
 * Leave the menu for the country-selection screen.
 *
 * Phase 7.2 moved this out of the `DOMContentLoaded` closure: New Game is no longer
 * the only caller, because a restart from inside a running game has to come back
 * through here after the world has been reset. The one line that stopped it moving
 * was a write to the phase bar's element, which the closure happened to have a
 * reference to; the bar owns that now (`phaseBar.setVisible`).
 */
function resetGameState() {
    //Phase 5.8. The picker's markup value and the store's default player colour were
    //two separate facts and they disagreed: the input shipped `#000000` while
    //`playerColour()` was white. Any `change` on that input -- including the one the
    //browser fires when the player opens the native colour dialog and accepts what is
    //already selected -- therefore adopted BLACK, and the next country they clicked was
    //painted the same colour as the map strokes, so it read as a hole rather than a
    //selection. Seeding the input from the store is what keeps the two in step.
    countrySelect.setColour(convertHexValueToRGBOrViceVersa(playerColour(), 1));
    toggleBottomTableContainer(true);
    mainMenu.hide();
    outsideOfMenuAndMapVisible = true;
    menuState = false;
    countrySelectedAndGameStarted = false;
    selectCountryPlayerState = true;
    //The music button is up from here on, ahead of the two chrome buttons that wait
    //for a country to be picked.
    toggleAudioButton(true);
    phaseBar.setVisible(true);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
    menuButton.show();
}

/**
 * Is there a game (or a country selection) behind the menu to go back to?
 *
 * Phase 7.2. `outsideOfMenuAndMapVisible` has always meant this; it now has a name
 * that says so, because three things ask the question -- Escape, the hamburger and
 * the Resume button.
 */
export function inGameMenuAvailable() {
    return outsideOfMenuAndMapVisible;
}

/**
 * Put the main menu up over a running game.
 *
 * Phase 7.2 split this out of `setUnsetMenuOnEscape()`, which was one function
 * containing both halves of a toggle behind a keycode test. Escape, the hamburger
 * button and (in the other direction) Resume Game are three ways to make the same
 * two transitions, and a keycode is not one of the things they have in common.
 */
export function openInGameMenu() {
    if (!outsideOfMenuAndMapVisible || menuState) {
        return;
    }
    //Resume means "go back to what is behind this menu", so it is available exactly
    //when there is something behind it -- which there is, or we would have returned.
    mainMenu.setResumeLabel("Resume Game");
    mainMenu.setResumeEnabled(true);
    menuButton.hide();
    mainMenu.show();
    document.getElementById(ids.mainUiContainer).style.display = "none";
    document.getElementById(ids.upgradeContainer).style.display = "none";
    toggleBottomTableContainer(false);
    toggleTopTableContainer(false);
    menuState = true;
    toggleBottomLeftPaneWithTurnAdvance(false);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
    toggleUIButton(false);
    uiButtonCurrentlyOnScreen = false;
    toggleMapModeButton(false);
    mapModeButtonCurrentlyOnScreen = false;
    //Both floating panels. The audio one goes with the button that owns it, inside
    //toggleMapModeButton(); the swatch grid has no owner to follow, so it is said
    //here. Neither has a scrim, so neither closes itself.
    countrySelect.closePicker();
    toggleUpgradeMenu(false);
    toggleBuyMenu(false);
    toggleTransferAttackButton(false, false);
    toggleTransferAttackWindow(false);
    toggleBattleUI(false, false);
    toggleBattleResults(false);
    toggleAiDialogue(false);
}

/** Take the menu down and hand the map back. Resume Game and Escape both call it. */
export function closeInGameMenu() {
    if (!outsideOfMenuAndMapVisible || !menuState) {
        return;
    }
    menuButton.show();
    if (uiCurrentlyOnScreen) {
        document.getElementById(ids.mainUiContainer).style.display = "flex";
        uiButtonCurrentlyOnScreen = false;
        mapModeButtonCurrentlyOnScreen = false;
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
    } else {
        if (countrySelectedAndGameStarted) {
            uiButtonCurrentlyOnScreen = true;
            mapModeButtonCurrentlyOnScreen = true;
        }
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
    }
    if (transferAttackWindowOnScreen || battleUIDisplayed || battleResultsDisplayed) {
        if (transferAttackWindowOnScreen) {
            toggleTransferAttackWindow(true);
        } else if (battleUIDisplayed) {
            toggleBattleUI(true, false);
        } else if (battleResultsDisplayed) {
            toggleBattleResults(true);
        }
        uiButtonCurrentlyOnScreen = false;
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
        mapModeButtonCurrentlyOnScreen = false;
    } else {
        if (countrySelectedAndGameStarted && !uiCurrentlyOnScreen) {
            uiButtonCurrentlyOnScreen = true;
            mapModeButtonCurrentlyOnScreen = true;
        }
        if (!uiCurrentlyOnScreen) {
            bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
        }
    }
    if (upgradeWindowCurrentlyOnScreen) {
        toggleUpgradeMenu(true);
    }
    if (bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen) {
        toggleBottomLeftPaneWithTurnAdvance(true);
    }
    if (uiButtonCurrentlyOnScreen) {
        toggleUIButton(true);
    }
    if (mapModeButtonCurrentlyOnScreen) {
        toggleMapModeButton(true);
    } else if (selectCountryPlayerState) {
        //No map-mode button on the selection screen, so nothing above puts the music
        //button back -- but it was up before the menu opened and has to be up after.
        toggleAudioButton(true);
    }
    if (buyWindowCurrentlyOnScreen) {
        toggleBuyMenu(true);
    }
    if (countrySelectedAndGameStarted) {
        toggleTopTableContainer(true);
    }
    if (transferAttackButtonDisplayed) {
        toggleTransferAttackButton(true, false);
    }
    if (aiDialogueContainerCurrentlyOnScreen) {
        toggleAiDialogue(true);
    }
    toggleBottomTableContainer(true);
    mainMenu.hide();

    //Everything above has just tried to put the player's chrome back, and a
    //spectated game has no player: no phase bar, no END TURN, no territory panel.
    //Re-applying the spectator chrome here is one call at the end rather than an
    //`isAiGameActive()` test threaded through thirty lines of restore logic.
    if (isAiGameActive()) {
        applySpectatorChrome();
    }

    if (lastClickedPath.getAttribute("d") !== "M0 0 L50 50") {
        selectCountry(lastClickedPath, true);
        //Re-appending the path puts it over the marker, so the marker is drawn again.
        raiseAttackMarker();
    }

    //add siege image back in here after escaping out of menu - for loop and check svg for underSiege

    menuState = false;
}

function setUnsetMenuOnEscape(e) {
    if (e.code !== "Escape" || !outsideOfMenuAndMapVisible) {
        return;
    }
    if (menuState) {
        closeInGameMenu();
    } else {
        openInGameMenu();
    }
}

//--- New Game, Resume and Save / Load (Phase 7.2 / 7.3) ---------------------
//
//The four transitions the menu can make, in one place. Everything below is
//sequencing -- what the world does is src/platform/storage.js, what the map does is
//src/ui/map/, and what a turn does is the engine.
//
//The reason these are not four one-liners is `outsideOfMenuAndMapVisible`: the menu
//is the same menu before and during a game, so every one of them has to ask which
//it is. That flag is the answer, and `inGameMenuAvailable()` is its name.

/**
 * Start over.
 *
 * From the title screen this is what it always was -- show the country-selection
 * screen. From inside a running game it is a restart, and there is no separate
 * Restart button because there does not need to be: the two differ only in whether
 * there is a world to throw away first.
 *
 * Throwing it away is three things in a fixed order. The engine stops FIRST, so no
 * step is part-way through a turn while the store changes underneath it; then the
 * pristine baseline captured at bootstrap is loaded, which is what makes Restart a
 * load rather than a re-run of the 359-path bootstrap; then the map is repainted
 * from the restored store. Reversing any two of those leaves a half-reset world on
 * screen.
 */
async function startNewGame() {
    //Before the engine is reset, never after: `TurnEngine.stop()` waits for the
    //running step to return, and in spectator mode the AI step does not return
    //until the last country has been through the pacing gate. Stopping the mode
    //releases every waiter, which turns the rest of that turn into a fast run.
    leaveSpectatorMode();
    if (outsideOfMenuAndMapVisible) {
        stopAutosave();
        await getTurnEngine().reset();

        const baseline = newGameBaseline();
        if (baseline) {
            applyGame(baseline);
            //restoreState() deliberately emits no per-territory events; this is the
            //one repaint that replaces all 359 of them.
            renderAllTerritories();
        } else {
            //Only reachable if New Game is somehow pressed before the bootstrap
            //Promise resolved, which is also what keeps the button disabled.
            console.warn("New Game: no pristine baseline was captured; the previous " +
                "game's world is still loaded.");
        }
        resetTransientUiState();
        resetChromeForCountrySelection();
    }

    resetGameState();
    greyOutTerritoriesForUnselectableCountries();
    //Back to the bootstrap palette with the five locked countries muted. On a first
    //New Game the map is already in that state and this is a no-op; after a restart
    //it is what takes the player's colour and every conquest back off the map.
    repaintCountrySelection(null);
}

//--- AI Game: the debug spectator mode (see src/debug/aiGameMode.js) ---------
//
//A game with the player left out. Everything below is sequencing; what makes it
//work is two things somewhere else -- `initialiseGame({ spectator: true })` skips
//the one loop that assigns territories to `Player`, and the turn engine's two
//player phases ask the mode whether they should wait at all.

/**
 * Start watching a game that plays itself.
 *
 * The shape is `startNewGame()` with the country-selection screen taken out and one
 * ordering deliberately reversed: the CPU leaders and the AI starting forts are
 * created BEFORE the engine starts rather than after it.
 *
 * That reversal is load-bearing and it is the opposite of what an ordinary game
 * does. In a normal game `initialiseGame()` starts turn 1 and the engine
 * immediately blocks on the player first phase, which gives the confirm handler
 * time to create the leaders before the AI ever runs -- and turn 1 is therefore
 * deliberately fought over a world with no leaders and no forts, which the Phase
 * 5.8 measurement recorded in gameTurnsLoop.js says must not be "fixed". Here
 * nothing blocks: the AI phase is reached in the same tick, so a country without a
 * leader would be read as `arrayOfLeadersAndCountries[i][2][0].leader` and throw.
 * Spectator turn 1 is consequently a slightly stronger opening than a played turn
 * 1, and that is the right trade for a debug tool -- but it does mean this mode is
 * NOT a way to measure balance. `tools/ai-sim.mjs` is.
 */
async function startAiGame() {
    leaveSpectatorMode();

    if (outsideOfMenuAndMapVisible) {
        stopAutosave();
        await getTurnEngine().reset();
        const baseline = newGameBaseline();
        if (baseline) {
            applyGame(baseline);
            renderAllTerritories();
        }
        resetTransientUiState();
        resetChromeForCountrySelection();
    }

    //The selection locks are a fact about the country-selection SCREEN, and this mode
    //never shows one. Left in place they would mute the five strongest countries on
    //the map for the whole run, which is exactly the five worth watching. Clearing
    //the lock is a store write, so the muted FILLS are still on the paths until
    //something repaints -- and the repaint has to happen before the line below reads
    //those fills back, or the five strongest countries spend the run in the muted
    //form of their own colour.
    setAllGreyedOutAttributesToFalseOnGameStart();
    repaintCountrySelection(null);

    //The one thing a spectated game shares with a played one and used to skip.
    //`countryColor` is copied off the map's fills, and until Phase 7.12 the only
    //caller was the country-selection confirm handler -- which this mode never
    //reaches. The consequence was not a missing colour but a map that never changed
    //again: `setColorOnMap()` refuses to paint a territory whose `countryColor` is
    //not a colour string (Phase 5.8, and rightly -- it used to paint the word
    //"undefined" and render the territory black), so every conquest for the rest of
    //the run logged a warning and left the map exactly as it was. Watching an AI
    //game whose map cannot change is watching nothing.
    pushColorsToMainArray();

    mainMenu.hide();
    outsideOfMenuAndMapVisible = true;
    menuState = false;
    selectCountryPlayerState = false;
    //Not `true`: the rest of this file reads that flag as "the player has a country
    //and the player chrome belongs on screen". There is no player.
    countrySelectedAndGameStarted = false;

    //See the note above -- these two have to be in place before the engine starts.
    updateArrayOfLeadersAndCountries();
    createCpuPlayerObjectAndAddToMainArray();
    addRandomFortsToAllNonPlayerTerritories();

    clearAiGameLog();
    startAiGameMode();
    applySpectatorChrome();

    //Deliberately NOT beginAutosaving(). The autosave has one slot and it belongs to
    //the game the player is actually playing; a spectated run would quietly overwrite
    //it, and there is nothing here anybody would want back.
    await initialiseGame({ spectator: true });
    repaintMap();
}

/**
 * Stop watching and go back to the title screen.
 *
 * The console X button is the only caller, and closing the window IS stopping the
 * mode: a self-playing game with its console shut is a page that looks idle while
 * two hundred countries fight behind it, and nothing would open the window again.
 */
async function endAiGame() {
    leaveSpectatorMode();
    await getTurnEngine().reset();

    const baseline = newGameBaseline();
    if (baseline) {
        applyGame(baseline);
        renderAllTerritories();
    }
    resetTransientUiState();
    resetChromeForCountrySelection();
    clearAiGameLog();

    //Back to a cold start rather than to the country-selection screen: the spectated
    //world has just been thrown away, so there is nothing behind the menu to resume.
    outsideOfMenuAndMapVisible = false;
    countrySelectedAndGameStarted = false;
    selectCountryPlayerState = false;
    menuState = true;
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
    toggleBottomLeftPaneWithTurnAdvance(false);
    toggleBottomTableContainer(false);
    toggleTopTableContainer(false);
    toggleMapModeButton(false);
    toggleAudioButton(false);
    menuButton.hide();
    mainMenu.setResumeLabel("Resume Game");
    mainMenu.setResumeEnabled(false);
    //...unless the player left an autosave behind before they came here, which is
    //still in its slot and still worth offering.
    offerStoredAutosave();
    mainMenu.show();

    greyOutTerritoriesForUnselectableCountries();
    repaintCountrySelection(null);
}

/** Stop the mode and shut the console. Safe to call when neither is running. */
function leaveSpectatorMode() {
    if (!isAiGameActive()) {
        return;
    }
    stopAiGameMode();
    aiGameConsole.close();
}

/**
 * The chrome a spectated game has, and the chrome it does not.
 *
 * Called when the mode starts and again whenever the in-game menu closes, because
 * `closeInGameMenu()` restores what a PLAYER would have had on screen.
 *
 * The bottom table stays: clicking a territory to read its garrison and its economy
 * is the most useful thing a spectator can do with the map, and it is the one panel
 * that describes a territory rather than the player. The top table, the phase bar
 * and the territory panel all go, because all three are about a country nobody owns.
 */
function applySpectatorChrome() {
    phaseBar.setVisible(false);
    toggleBottomLeftPaneWithTurnAdvance(false);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
    toggleTopTableContainer(false);
    toggleUIMenu(false);
    toggleTransferAttackButton(false, true);
    toggleUpgradeMenu(false);
    toggleBuyMenu(false);

    //The continent view and the music are worth having while watching, and this call
    //puts the music button back as a side effect (see toggleAudioButton).
    toggleMapModeButton(true);
    mapModeButtonCurrentlyOnScreen = true;
    //...but not the territory panel or the activity feed. The feed in particular is
    //what this mode REPLACES: its collapsible per-turn sections are the wrong shape
    //for watching, which is why the console is a flat stream. Both go down after
    //toggleMapModeButton(), because that call is what would otherwise put the
    //activity button back up alongside them.
    toggleUIButton(false);
    uiButtonCurrentlyOnScreen = false;

    toggleBottomTableContainer(true);
    menuButton.show();
    aiGameConsole.open();
}

/**
 * Put the chrome back to how the country-selection screen looks on a cold start.
 *
 * Everything here is something a restart would otherwise inherit from the game it
 * replaced: a phase bar still reading "Military Phase" over an END TURN button, the
 * previous country in the bottom table, the globe and map-mode buttons that only
 * appear once a game is running, and a `lastClickedPath` pointing at a territory the
 * player no longer owns.
 */
function resetChromeForCountrySelection() {
    phaseBar.setMode(phaseBar.Mode.SELECTING);
    bottomTable.reset();
    //Phase 7.4. Windows can be dragged, and an inline `left`/`top` survives the
    //window being closed -- deliberately, so a panel a player moved aside stays
    //where they put it. It must not survive a NEW GAME: a window dragged to the far
    //corner of the game that was just thrown away is a window the next player
    //cannot find. Same species as bottomTable.reset() on the line above.
    resetAllWindowPositions();
    activityPanel.reset();
    //The AI's recorded reasoning belongs to the game that was just thrown away. It is
    //cleared for the same reason the activity feed is: a debug window that opens on the
    //previous world's plans is worse than one that opens empty.
    clearPlans();
    //And so does everything the AI countries had LEARNED. Their committed continents,
    //the neighbours they were absorbing, the borders they had written off as walls and
    //the reinforcements their fronts had asked for are all memories of a world that no
    //longer exists -- and every one of them would otherwise be applied to a country of
    //the same name in the new one, which is how a fresh game would open with France
    //already refusing to attack Spain over a war it never fought.
    resetCampaigns();
    resetMusters();
    aiDebugPanel.close();
    toggleUIButton(false);
    toggleMapModeButton(false);
    //...but not the music button, which the line above has just taken down with it.
    //A restart lands on the selection screen, and that screen has music.
    toggleAudioButton(true);
    toggleTopTableContainer(false);
    topTable.setHeading("Select a Country");
    //The colour label and the confirm button are put back by phaseBar.setMode()
    //above -- both are the bar's own elements and both are hidden until a country is
    //clicked, which is a fact about the bar rather than about the game.
    //The placeholder `d` is what `closeInGameMenu()` tests to decide whether there is
    //a selection to restore, so it has to be exactly this one.
    lastClickedPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    lastClickedPath.setAttribute("d", "M0 0 L50 50");
    currentSelectedPath = undefined;
}

/**
 * Put every "is this panel on screen" flag back to false.
 *
 * These are the module-level booleans that `closeInGameMenu()` reads to decide what
 * to put back. After a restart or a load they describe the game that is being
 * replaced, so leaving them alone is how a battle results screen from the previous
 * game reappears the first time the player presses Escape in the new one.
 */
function resetTransientUiState() {
    resetContinentView();
    uiCurrentlyOnScreen = false;
    uiButtonCurrentlyOnScreen = false;
    mapModeButtonCurrentlyOnScreen = false;
    upgradeWindowCurrentlyOnScreen = false;
    buyWindowCurrentlyOnScreen = false;
    transferAttackWindowOnScreen = false;
    transferAttackButtonDisplayed = false;
    battleUIDisplayed = false;
    battleResultsDisplayed = false;
    aiDialogueContainerCurrentlyOnScreen = false;
    attackTextCurrentlyDisplayed = false;
    clearAttackTarget();
    toggleUIMenu(false);
    toggleUpgradeMenu(false);
    toggleBuyMenu(false);
    toggleTransferAttackWindow(false);
    toggleBattleUI(false, false);
    toggleBattleResults(false);
    toggleAiDialogue(false);
    toggleTransferAttackButton(false, false);
}

/**
 * Resume Game.
 *
 * The button means two different things and this is where they part company. With a
 * game behind the menu it is the other half of Escape. On a cold start it is the
 * autosave found at page load -- which is the only reason the button is enabled at
 * all before anything has been clicked.
 */
async function resumeFromMenu() {
    if (outsideOfMenuAndMapVisible) {
        closeInGameMenu();
        return;
    }

    const save = readAutosave();
    if (!save) {
        //The slot was cleared or went bad between page load and the click.
        mainMenu.setResumeEnabled(false);
        return;
    }
    try {
        await applyLoadedGame(save);
    } catch (error) {
        console.error("Resume: the stored autosave could not be loaded.", error);
        //Say so where there is somewhere to say it, rather than failing silently
        //against a menu that still offers the button.
        saveLoadPanel.open();
        saveLoadPanel.setStatus(
            error?.message ?? "The stored game could not be loaded.", "bad");
    }
}

/**
 * Enable Resume for an autosave from a previous visit.
 *
 * Called from `enableNewGameButton()` rather than from the bootstrap block, and that
 * is not incidental: a load patches the seeded territories, so offering it before
 * the territory model exists offers a button that cannot work. The two become
 * available at the same moment because they have the same prerequisite.
 */
function offerStoredAutosave() {
    const summary = autosaveSummary();
    if (!summary) {
        return;
    }
    //A different promise from "resume the game you are playing", so a different
    //label. Naming the turn is what makes it a decision rather than a leap.
    mainMenu.setResumeLabel("Continue Turn " + summary.turn);
    mainMenu.setResumeEnabled(true);
}

/**
 * Load a pasted save code. The Save / Load panel's `applySave`.
 *
 * `decodeSave()` throws with a message written for the player, and the panel shows
 * whatever comes out of here, so nothing is caught in between.
 */
async function loadGameFromCode(code) {
    await applyLoadedGame(decodeSave(code));
}

/**
 * Restore a decoded save and hand the player a playable turn.
 *
 * This is the country-selection confirm handler with the country selection taken
 * out: the same UI transitions, but the world arrives from the save instead of from
 * `initialiseGame()`, and nothing here may draw from `Math.random` -- the AI
 * leaders, the starting forts and the initial gold are all IN the save, and
 * regenerating any of them would silently replace part of the loaded game.
 */
async function applyLoadedGame(save) {
    //Before the engine is reset, for the reason given in `startNewGame()`: a
    //spectator turn does not return until its last country has been through the
    //pacing gate, and `stop()` waits for the running step.
    leaveSpectatorMode();
    stopAutosave();
    await getTurnEngine().reset();

    const loaded = applyGame(save);

    saveLoadPanel.close();
    optionsPanel.close(false);
    dominapedia.close();
    mainMenu.hide();

    resetTransientUiState();
    outsideOfMenuAndMapVisible = true;
    menuState = false;
    selectCountryPlayerState = false;
    countrySelectedAndGameStarted = true;

    //`initialiseNewPlayerTurn()` populates the bottom table from the last clicked
    //path at the end of every AI turn, and a freshly loaded game has never had a
    //click. Pointing it at one of the player's own territories is what stops the
    //first AI turn ending on a lookup against the placeholder path.
    const firstPlayerTerritory = playerTerritories()[0];
    const firstPlayerPath = firstPlayerTerritory
        ? getPathByUniqueId(firstPlayerTerritory.uniqueId)
        : null;
    if (firstPlayerPath) {
        lastClickedPath = firstPlayerPath;
    }

    countrySelect.setColour(convertHexValueToRGBOrViceVersa(playerColour(), 1));
    phaseBar.dimBody();
    setFlag(playerCountryName(), 1); //top table
    setFlag(playerCountryName(), 3); //info panel
    //Place 0 returns the URL without writing it anywhere. The bar's own flag is
    //normally a side effect of the selection screen, which a loaded game never sees.
    phaseBar.setBrandFlag(setFlag(playerCountryName(), 0));
    topTable.setHeading("Total Player Resources:");
    phaseBar.setMode(phaseBar.Mode.INITIALISING);

    toggleBottomTableContainer(true);
    toggleTopTableContainer(true);
    phaseBar.setVisible(true);
    toggleBottomLeftPaneWithTurnAdvance(true);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;

    await resumeSavedGame(loaded.phase);

    document.getElementById(ids.popupWithConfirmContainer).style.display = "block";
    //The colour label stays on screen during play in a game started from the menu,
    //so a loaded game shows it too -- a difference here would be a difference the
    //player can see between the two ways of arriving at the same turn.
    document.getElementById(ids.popupColor).style.display = "block";
    uiButtonCurrentlyOnScreen = true;
    toggleUIButton(true);
    mapModeButtonCurrentlyOnScreen = true;
    toggleMapModeButton(true);
    menuButton.show();

    //The phase is already in the store, so the bar derives its own labels -- there
    //is deliberately no setPhase() here, which would announce a transition that did
    //not happen.
    phaseBar.setMode(phaseBar.Mode.PLAYING);
    populateBottomTableWhenSelectingACountry(getLastClickedPath());

    beginAutosaving();
    return loaded;
}

/**
 * Start the one-minute autosave.
 *
 * The `shouldSave` gate is the interesting part. A save is a picture of the store
 * plus the registered slices, and neither carries what a battle is holding in
 * battle.js's module-level variables mid-resolution -- so a tick that landed inside
 * a battle would store a world that cannot be resumed to the screen the player is
 * looking at. The AI turn is excluded for the same reason: the engine has no way to
 * re-enter a step half-way through, so `resumeSavedGame()` puts an AI-turn save back
 * into the player's move phase, which is a worse answer than not taking that save at
 * all.
 */
function beginAutosaving() {
    installSaveTestHooks({
        //The timer's tick, minus the timer. See installSaveTestHooks.
        saveNow() {
            const save = captureGame();
            if (!save) {
                return false;
            }
            const stored = writeAutosave(save);
            saveIndicator.flash(stored ? "Saving" : "Save failed");
            if (stored) {
                mainMenu.setResumeEnabled(true);
            }
            return stored;
        },
        saveCode() {
            const save = captureGame();
            return save ? encodeSave(save) : null;
        },
        loadCode: (code) => loadGameFromCode(code),
        hasStoredSave: () => hasAutosave(),
        clearStoredSave: () => clearAutosave(),
    });
    startAutosave({
        shouldSave: () =>
            countrySelectedAndGameStarted &&
            getTurnEngine().isAwaitingPlayer() &&
            !battleUIDisplayed &&
            !battleResultsDisplayed &&
            !transferAttackWindowOnScreen,
        onSaved(_save, stored) {
            if (stored) {
                saveIndicator.flash();
                mainMenu.setResumeEnabled(true);
            } else {
                //writeAutosave() has already logged why. The player keeps playing.
                saveIndicator.flash("Save failed");
            }
        },
    });
}

export function getOriginalDefendingTerritory() {
    return originalDefendingTerritory;
}

export function setCurrentWarFlagString(value) {
    return currentWarFlagString = value;
}

export function setUpResultsOfWarExternal(value) {
    if (value) {
        toggleBattleResults(true);
        battleResultsDisplayed = true;
        toggleUIButton(false);
        uiButtonCurrentlyOnScreen = false;
        toggleBottomLeftPaneWithTurnAdvance(false);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
        toggleMapModeButton(false);
        mapModeButtonCurrentlyOnScreen = false;
    } else {
        toggleBattleResults(false);
        battleResultsDisplayed = false;
        toggleUIButton(true);
        uiButtonCurrentlyOnScreen = true;
        toggleBottomLeftPaneWithTurnAdvance(true);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
        toggleMapModeButton(true);
        mapModeButtonCurrentlyOnScreen = true;
    }
}

function setColorsOfDefendingTerritoriesSiegeStats(lastClickedPath, situation) {
    let siegeObject = getSiegeObjectFromPath(lastClickedPath);
    let defendingTerritory;
    if (situation === 0) {
        defendingTerritory = siegeObject.defendingTerritory;
    } else {
        for (let i = 0; i < allTerritories(); i++) {
            if (allTerritories()[i].uniqueId === lastClickedPath.getAttribute("uniqueid")) {
                defendingTerritory = allTerritories()[i];
            }
        }
    }

    const colorGreen = "rgb(0, 255, 0)";
    const colorYellow = "rgb(255, 255, 0)";
    const colorOrange = "rgb(255, 165, 0)";
    const colorRed = "rgb(245,128,128)";
    const colorWhite = "rgb(255,255,255)";

    let remainingPercentages;

    if (situation === 0) { //click view siege
        const defendingArmyRemaining = siegeObject.defendingArmyRemaining;
        const startingDef = siegeObject.startingDef;

        // Calculate the percentages for defenseBonus, foodCapacity, and productiveTerritoryPop
        const startingDefenseBonus = siegeObject.startingDefenseBonus;
        const startingProdPop = siegeObject.startingTerritoryPop;
        const startingFoodCapacity = siegeObject.startingFoodCapacity;

        const defenseBonus = defendingTerritory.defenseBonus;
        const foodCapacity = defendingTerritory.foodCapacity;
        const productiveTerritoryPop = defendingTerritory.territoryPopulation;

        const defenseBonusPercentage = (defenseBonus / startingDefenseBonus) * 100;
        const foodCapacityPercentage = (foodCapacity / startingFoodCapacity) * 100;
        const productiveTerritoryPopPercentage = (productiveTerritoryPop / startingProdPop) * 100;

        // Apply colors based on the percentages for defenseBonus, foodCapacity, and productiveTerritoryPop
        if (defenseBonusPercentage <= 25) {
            document.getElementById(ids.defenseIcon).innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon25.png'>";
            defendingTerritory.defenseBonusColor = colorRed;
        } else if (defenseBonusPercentage > 25 && defenseBonusPercentage <= 50) {
            document.getElementById(ids.defenseIcon).innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon50.png'>";
            defendingTerritory.defenseBonusColor = colorOrange;
        } else if (defenseBonusPercentage > 50 && defenseBonusPercentage <= 75) {
            document.getElementById(ids.defenseIcon).innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon75.png'>";
            defendingTerritory.defenseBonusColor = colorYellow;
        } else {
            document.getElementById(ids.defenseIcon).innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon.png'>";
            defendingTerritory.defenseBonusColor = colorGreen;
        }

        if (foodCapacityPercentage <= 25) {
            defendingTerritory.foodCapacityColor = colorRed;
        } else if (foodCapacityPercentage > 25 && foodCapacityPercentage <= 50) {
            defendingTerritory.foodCapacityColor = colorOrange;
        } else if (foodCapacityPercentage > 50 && foodCapacityPercentage <= 75) {
            defendingTerritory.foodCapacityColor = colorYellow;
        }

        if (productiveTerritoryPopPercentage <= 25) {
            defendingTerritory.productiveTerritoryPopColor = colorRed;
        } else if (productiveTerritoryPopPercentage > 25 && productiveTerritoryPopPercentage <= 50) {
            defendingTerritory.productiveTerritoryPopColor = colorOrange;
        } else if (productiveTerritoryPopPercentage > 50 && productiveTerritoryPopPercentage <= 75) {
            defendingTerritory.productiveTerritoryPopColor = colorYellow;
        }

        // Calculate the percentages for defendingArmyRemaining
        remainingPercentages = defendingArmyRemaining.map((remaining, index) => {
            return (remaining / startingDef[index]) * 100;
        });

        applyColorsToArmyQuantityText(0, remainingPercentages, colorGreen, colorYellow, colorOrange, colorRed, colorWhite);

        document.getElementById(ids.defenseBonusText).style.color = defendingTerritory.defenseBonusColor;
        document.getElementById(ids.foodText).style.color = defendingTerritory.foodCapacityColor;
        document.getElementById(ids.prodPopText).style.color = defendingTerritory.productiveTerritoryPopColor;
    } else if (situation === 1) { //click assault
        remainingPercentages = "";
        applyColorsToArmyQuantityText(1, remainingPercentages, colorGreen, colorYellow, colorOrange, colorRed, colorWhite);
    } else if (situation === 2) { //click invade
        remainingPercentages = "";
        applyColorsToArmyQuantityText(1, remainingPercentages, colorGreen, colorYellow, colorOrange, colorRed, colorWhite);
        document.getElementById(ids.defenseBonusText).style.color = colorGreen;
        document.getElementById(ids.defenseIcon).innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon.png'>";
    }

    let mountainDefenseText = document.getElementById(ids.mountainDefenseText);
    if (parseInt(mountainDefenseText.innerHTML) >= 50) {
        mountainDefenseText.style.color = colorRed;
    } else if (parseInt(mountainDefenseText.innerHTML) >= 30) {
        mountainDefenseText.style.color = colorOrange;
    } else if (parseInt(mountainDefenseText.innerHTML) >= 20) {
        mountainDefenseText.style.color = colorYellow;
    } else {
        mountainDefenseText.style.color = colorGreen;
    }
}

function applyColorsToArmyQuantityText(situation, remainingPercentages, colorGreen, colorYellow, colorOrange, colorRed, colorWhite) {
    const elements = [
        document.getElementById(indexedIds.armyRowQuantity(5)),
        document.getElementById(indexedIds.armyRowQuantity(6)),
        document.getElementById(indexedIds.armyRowQuantity(7)),
        document.getElementById(indexedIds.armyRowQuantity(8)),
    ];

    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const percentage = remainingPercentages[i];

        if (situation === 0) {
            if (percentage <= 25) {
                element.style.color = colorRed;
            } else if (percentage > 25 && percentage <= 50) {
                element.style.color = colorOrange;
            } else if (percentage > 50 && percentage <= 75) {
                element.style.color = colorYellow;
            } else {
                element.style.color = colorGreen;
            }
        } else {
            element.style.color = colorWhite;
        }
    }
}

function setSiegeScoreText(siegeScore, situation) {
    if (situation === 0) {
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).innerHTML = siegeScore;
        //Phase 7.5. Was an <img> pointing at `sword.png`. The siege score is a war
        //figure, so it takes the same crossed-swords icon the Wars tab uses -- and,
        //being drawn rather than shipped, it follows the theme.
        const siegeScoreIcon = document.getElementById(ids.battleUIRow4Col1IconSiegeScore);
        siegeScoreIcon.innerHTML = "";
        const swords = crossedSwordsIcon();
        swords.classList.add("sizingPositionRow4Column1IconBattleUI");
        swords.setAttribute("role", "img");
        swords.setAttribute("aria-label", "Siege score");
        siegeScoreIcon.appendChild(swords);
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).style.display = "flex";
        document.getElementById(ids.battleUIRow4Col1IconSiegeScore).style.display = "flex";
    } else if (situation === 1) {
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).style.display = "none";
        document.getElementById(ids.battleUIRow4Col1IconSiegeScore).style.display = "none";
    }
}

export function toggleDiceCanvas(value) {
    if (value) {
        document.getElementById(ids.threeCanvasForDice).style.display = "block";
    } else {
        document.getElementById(ids.threeCanvasForDice).style.display = "none";
    }
}

export function routeSiegeUIProcesses() {
    battleUIState = 0;
    enableDisableAssaultButton(1);
    toggleBattleUI(true, false);
    battleUIDisplayed = true;
    toggleBottomLeftPaneWithTurnAdvance(false);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
    toggleUIButton(false);
    uiButtonCurrentlyOnScreen = false;
    toggleMapModeButton(false);
    mapModeButtonCurrentlyOnScreen = false;
}

function enableDisableAssaultButton(enableDisable) {
    const siegeButton = document.getElementById(ids.siegeBottomBarButton)
    switch (enableDisable) {
        case 0: //enable
            siegeButton.disabled = false;
            siegeButton.style.backgroundColor = "rgb(114, 88, 48)";
            break;
        case 1: //disable
            siegeButton.disabled = true;
            siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
    }
}

function shiftPath(pathElement, amountRight, amountDown) {
    if (shiftedPath === null) {
        return;
    }
    const currentPathData = pathElement.getAttribute('d');
    const pathParts = currentPathData.split(' ');

    let shiftedPathData = '';
    for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === 'L' || pathParts[i] === 'l') {
            // Shift the x and y coordinates
            const x = parseFloat(pathParts[i + 1]) + amountRight;
            const y = parseFloat(pathParts[i + 2]) + amountDown;
            shiftedPathData += ` ${pathParts[i]} ${x.toFixed(3)} ${y.toFixed(3)}`;
            i += 2;
        } else {
            shiftedPathData += ` ${pathParts[i]}`;
        }
    }

    // Update the d attribute of the path element
    pathElement.setAttribute('d', shiftedPathData);
}

function modifyFill(pathElement, mousedown) {
    if (shiftedPath === null) {
        return;
    }
    const fillValue = pathElement.getAttribute('fill');
    const rgbPattern = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/;
    const matches = fillValue.match(rgbPattern);

    if (matches) {
        let [_, r, g, b] = matches; // Destructure the matches
        r = parseInt(r);
        g = parseInt(g);
        b = parseInt(b);

        if (mousedown) {
            // Subtract 30 from each component
            r = Math.max(r - 30, 0);
            g = Math.max(g - 30, 0);
            b = Math.max(b - 30, 0);
        } else {
            // Add 30 to each component
            r = Math.min(r + 30, 255);
            g = Math.min(g + 30, 255);
            b = Math.min(b + 30, 255);
        }
        pathElement.setAttribute('fill', `rgb(${r},${g},${b})`);
    }
}

//----------------------------------------CONTINENT VIEW--------------------------------------------

// Phase 7.4. Two buttons became one.
//
// `mapModeButton` flipped the relief map on and off and `strokeHighlightButton`
// drew the continent boundaries, independently -- four combinations, of which one
// (relief with no boundaries over it) is close to unreadable, because the physical
// map drops every territory fill to 1% opacity and the boundaries are then the
// only thing saying where anything is. The button walks the three that are worth
// looking at, in this order:
//
//     normal     political map, no boundaries          folded-map icon
//     physical   relief map + continent boundaries     mountain icon
//     continent  political map + continent boundaries  Africa icon
//
// The icon shows the view you are IN, not the one the next click gives you.
//
// The two halves stay separate functions because leaving the relief map is
// something the map click, the colour picker and the end of the player's turn each
// do on their own. They call `exitPhysicalMap()`, which lands on `continent` -- the
// same place the second click of the cycle goes -- and re-syncs the icon. Nothing
// outside this section may write `mapMode`.

const CONTINENT_VIEW_CYCLE = ["normal", "physical", "continent"];

const CONTINENT_VIEW_TITLE = {
    normal: "Continent view (political map)",
    physical: "Continent view (relief and boundaries)",
    continent: "Continent view (boundaries)",
};

let continentView = "normal";

/** The relief layer, and the near-transparent territory fills that go with it. */
function setPhysicalMap(on) {
    if (on === (mapMode === 2)) {
        return;
    }
    let continentColor;
    if (on) {
        mapMode = 2;
        svgCoastLinesMap.querySelector('image').setAttribute("style", "opacity: 1");
        for (let i = 0; i < pathsCoastLines.length; i++) {
            pathsCoastLines[i].setAttribute("fill-opacity", "0.20");
            continentColor = pathsCoastLines[i].getAttribute("shadow");
            pathsCoastLines[i].setAttribute("fill", `rgb(${CONTINENT_COLOR_ARRAY.find(([continentIndex]) => continentIndex === continentColor)[1].join(", ")})`);
        }
        for (let i = 0; i < paths.length; i++) {
            paths[i].setAttribute("fill-opacity", "0.01");
            for (let j = 0; j < allTerritories().length; j++) {
                if (allTerritories()[j].unique === paths[i].getAttribute("uniqueid")) {
                    setStrokeOnMap(allTerritories()[j]);
                    break;
                }
            }
            paths[i].setAttribute("stroke-width", "1px");
            pathIsPlayerOwned(paths[i]) ? (paths[i].setAttribute("fill", playerColour()), paths[i].setAttribute("fill-opacity", "0.5")) : null; //color player territories
        }
    } else {
        mapMode = 1;
        for (let i = 0; i < paths.length; i++) {
            paths[i].style.stroke = "black";
            paths[i].setAttribute("stroke-width", "1px");
            paths[i].setAttribute("fill-opacity", "1");
        }
        repaintMap();
        svgCoastLinesMap.querySelector('image').setAttribute("style", "opacity: 0");
        for (let i = 0; i < pathsCoastLines.length; i++) {
            pathsCoastLines[i].setAttribute("fill", "none");
        }
    }
}

/**
 * The continent boundaries. Directed rather than toggled: this used to read the
 * stroke back off each coast-line path to decide which way to go, which meant the
 * button and the map could disagree the moment anything else touched a stroke. The
 * boundary width depends on the map mode, so this runs AFTER `setPhysicalMap()`,
 * never before -- 6px reads as a boundary over flat colour and as a smear over the
 * relief.
 */
function setContinentStrokes(on) {
    let continentColor;
    for (let i = 0; i < pathsCoastLines.length; i++) {
        if (on) {
            continentColor = pathsCoastLines[i].getAttribute("shadow");
            pathsCoastLines[i].style.stroke = `rgb(${CONTINENT_COLOR_ARRAY.find(([continentIndex]) => continentIndex === continentColor)[1].join(", ")})`;
            pathsCoastLines[i].style.strokeWidth = mapMode === 2 ? "5px" : "6px";
        } else {
            pathsCoastLines[i].style.stroke = "rgb(103, 124, 160)";
            pathsCoastLines[i].style.strokeWidth =
                pathsCoastLines[i].getAttribute("isisland") === "true" ? "2px" : "5px";
        }
    }
}

/** `data-view` is what the CSS picks an icon by, and what the e2e specs read. */
function updateContinentViewButton() {
    const button = document.getElementById(ids.continentViewButton);
    if (!button) {
        return;
    }
    button.setAttribute("data-view", continentView);
    button.setAttribute("title", CONTINENT_VIEW_TITLE[continentView]);
}

function applyContinentView(view) {
    setPhysicalMap(view === "physical");
    setContinentStrokes(view !== "normal");
    continentView = view;
    updateContinentViewButton();
}

function cycleContinentView() {
    const next =
        CONTINENT_VIEW_CYCLE[
            (CONTINENT_VIEW_CYCLE.indexOf(continentView) + 1) % CONTINENT_VIEW_CYCLE.length
        ];
    applyContinentView(next);
}

/**
 * Drop the relief layer and keep the boundaries, which is the second stop of the
 * cycle. Called wherever the map has to be legible again whether the player asked
 * for it or not: a territory click, a colour change, the end of the turn.
 */
function exitPhysicalMap() {
    if (mapMode !== 2) {
        return;
    }
    applyContinentView("continent");
}

/** Back to the plain political map. A restart or a load starts there. */
function resetContinentView() {
    if (continentView === "normal") {
        updateContinentViewButton();
        return;
    }
    applyContinentView("normal");
}

export function endPlayerTurn() {
    if (mapMode === 2) {
        exitPhysicalMap();
    }

    //Phase 6.7. Forty lines of hand-rolled repaint stood here -- reset the stroke on
    //everything that is not besieged or deactivated, re-assert the fill on everything
    //that is -- followed by a snapshot and a restore of that same snapshot. That is
    //exactly what repaintMap() does, from the store, for every path.
    //
    //The comment this replaced is worth keeping, because it records the defect the
    //shape caused: the else-branch used to write playerColour() unconditionally, so
    //an AI territory besieged by another AI took the PLAYER's colour with the player
    //nowhere near the war -- 45 mis-painted territories by turn 4, 55 by turn 8. The
    //snapshot taken three lines later captured the result, so every later restore
    //replayed it and it never washed out. Asking the owner is what fixed it, and
    //deriving the colour rather than replaying one is what makes it unrepeatable.
    repaintMap();

    clearAttackTarget();
    toggleTransferAttackButton(false, false);
    transferAttackButtonDisplayed = false;
    setPhase(Phase.AI);
}

export function initialiseNewPlayerTurn() {
    //Skipped while spectating: there is no player and no selected territory, so this
    //would ask the bottom table to describe the placeholder path -- which fetches
    //`resources/flags/null.png` and writes nothing. The table is still there and
    //still fills in when a territory is clicked.
    if (!isAiGameActive()) {
        populateBottomTableWhenSelectingACountry(getLastClickedPath());
    }
    phaseBar.setButtonEnabled(true);
    if (playerSiegeWarsList) {
        for (const key in playerSiegeWarsList) {
            for (let i = 0; i < allTerritories().length; i++) {
                if (playerSiegeWarsList[key].defendingTerritory.uniqueId === allTerritories()[i].uniqueId) {
                    console.log("Beginning of turn Useable for " + allTerritories()[i].territoryName + ": Assault: " + allTerritories()[i].useableAssault + " Air: " + allTerritories()[i].useableAir + " Naval: " + allTerritories()[i].useableNaval);
                }
            }
        }
    }
    setPhase(Phase.BUY_UPGRADE);
}

function createSparkle() {
    const container = document.querySelector(".sparkles-container");
    const sparkle = document.createElement("div");
    sparkle.classList.add("sparkle");
    sparkle.style.top = `${cosmeticRandom() * 100}%`;
    sparkle.style.left = `${cosmeticRandom() * 100}%`;
    container.appendChild(sparkle);

    // Remove the sparkle after 3 seconds
    setTimeout(() => {
        container.removeChild(sparkle);
    }, 3000);
}

function addSparklesRegularly() {
    // Adjust the frequency to control how often new sparkles appear (e.g., every 1.5 seconds)
    setTimeout(() => {
        createSparkle();
        // Call the function again to add another sparkle after a random interval
        addSparklesRegularly();
        // audit 5.3 Y: the cosmetic stream, never `Math.random`. Three draws per tick on
        // a timer re-armed every 0-100ms is what made a seeded run non-reproducible.
    }, cosmeticRandom() * 100); // Random interval up to 100ms
}

// Start the process of adding sparkles
addSparklesRegularly();



function pushColorsToMainArray() {
    for (let i = 0; i < paths.length; i++) {
        for (let j = 0; j < allTerritories().length; j++) {
            if (paths[i].getAttribute("uniqueid") === allTerritories()[j].uniqueId) {
                allTerritories()[j].countryColor = paths[i].getAttribute("fill");
            }
        }
    }
}

export function setColorOnMap(territory, selectCountryState) {
    if (selectCountryState) {
        //Phase 6.7. The bootstrap palette is keyed by country in colouring.js, so this
        //is one lookup rather than a scan of a 359-entry list per path.
        const startingColour = startingColourForCountry(territory.dataName);
        if (startingColour) {
            paths.forEach(path => {
                if (pathCountry(path) === territory.dataName) {
                    path.setAttribute("fill", startingColour);
                }
            });
        }
    } else {
        //Phase 5.8. `countryColor` is not populated until pushColorsToMainArray() runs on
        //confirm, so before that this wrote the string "undefined" into the fill -- which is
        //not a colour, so the territory rendered black. Refuse to paint a non-colour rather
        //than corrupting the map: the caller asking for the wrong form is the bug, and a
        //silently black country is how it stayed hidden.
        if (typeof territory.countryColor !== "string" || territory.countryColor === "") {
            console.warn("setColorOnMap: no countryColor for " + territory.territoryName +
                " -- refusing to paint. Use setColorOnMap(territory, true) before the game starts.");
            return territory.countryColor;
        }
        for (let i = 0; i < paths.length; i++) {
            if (paths[i].getAttribute("uniqueid") === territory.uniqueId) {
                paths[i].setAttribute("fill", territory.countryColor);
                break;
            }
        }
    }
    return territory.countryColor;
}

export function setStrokeOnMap(territory) {
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("uniqueid") === territory.uniqueId) {
            paths[i].style.stroke = territory.countryColor;
        }
    }
}

//setOwnerOnPath() and setCountryNameOnPath() lived here. Both scanned all 359 paths to
//push a field of the territory model onto one path attribute, and the second of them
//wrote `territory.owner` into `data-name` -- the current-owner attribute -- which is
//only ever right because an AI country name happens to be both. Ownership is set through
//state/mutations.js now and rendered by src/ui/mapAttributeSync.js (Phase 4.4).

export async function populateAiDialogueBox(situation, attacker, defender, parameter) {
    setFlag(attacker.dataName, 8);
    setFlag(playerCountryName(), 9);
    setAiDialogueBodyBottomContentState(0);
    convertAiDialogueButtonRow(1);
    switch (situation) {
        case "goldForSiege":
            document.getElementById(ids.aiDialogueTitleText).innerHTML = reduceKeywords(attacker.dataName) + " Requests Pullout";
            document.getElementById(ids.aiDialogueBodySubHeading).innerHTML = attacker.dataName + " requests you to kindly retreat from the siege on " + defender.territoryName + ", and in return they will grant you:"

            document.getElementById(ids.aiDialogueBodyBottomContentLeftLarge).innerHTML = ""; //clear old image
            const imageElement = document.createElement("img");
            imageElement.classList.add("largeAiDialogImage");
            imageElement.src = "./resources/gold.png";
            document.getElementById(ids.aiDialogueBodyBottomContentLeftLarge).appendChild(imageElement);
            document.getElementById(ids.aiDialogueBodyBottomContentRightLarge).innerHTML = formatNumbersToKMB(parameter);
            document.getElementById(ids.aiButtonLeft).innerHTML = "Refuse";
            document.getElementById(ids.aiButtonRight).innerHTML = "Accept";
            break;
    }
}

export function setAiDialogueContainerCurrentlyOnScreen(value) {
    aiDialogueContainerCurrentlyOnScreen = value;
}

export function convertAiDialogueButtonRow(direction) {
    switch(direction) {
        case 0:
            document.getElementById(ids.aiButtonLeft).style.display = "none";
            document.getElementById(ids.aiButtonRight).style.display = "none";
            document.getElementById(ids.aiButtonAllRow).style.display = "flex";
            break;
        case 1:
            document.getElementById(ids.aiButtonLeft).style.display = "flex";
            document.getElementById(ids.aiButtonRight).style.display = "flex";
            document.getElementById(ids.aiButtonAllRow).style.display = "none";
            break;
    }
}

export function setAiDialogueBodyBottomContentState(state) {
    switch(state) {
        case 0:
            document.getElementById(ids.aiDialogueBoxBottomSummaryRow).style.display = "none";
            document.getElementById(ids.aiDialogueBodyBottomContent).style.display = "flex";
            break;
        case 1:
            document.getElementById(ids.aiDialogueBoxBottomSummaryRow).style.display = "flex";
            document.getElementById(ids.aiDialogueBodyBottomContent).style.display = "none";
           break;
    }
}

export function populateArmyDataFields(returnArmyData) {

    document.getElementById(indexedIds.aiDialogueSummaryColumn(1)).innerHTML = "";
    document.getElementById(indexedIds.aiDialogueSummaryColumn(3)).innerHTML = "";
    document.getElementById(indexedIds.aiDialogueSummaryColumn(5)).innerHTML = "";
    document.getElementById(indexedIds.aiDialogueSummaryColumn(7)).innerHTML = "";

    //SET IMAGES
    const imageElementInf = document.createElement("img");
    const imageElementAss = document.createElement("img");
    const imageElementAir = document.createElement("img");
    const imageElementNav = document.createElement("img");

    const imageSources = [
        "resources/infantry.png",
        "resources/assault.png",
        "resources/air.png",
        "resources/naval.png"
    ];

    imageElementInf.src = imageSources[0];
    imageElementAss.src = imageSources[1];
    imageElementAir.src = imageSources[2];
    imageElementNav.src = imageSources[3];

    imageElementInf.classList.add("imgForAiDialogueBoxBottomSummaryRowColImg");
    imageElementAss.classList.add("imgForAiDialogueBoxBottomSummaryRowColImg");
    imageElementAir.classList.add("imgForAiDialogueBoxBottomSummaryRowColImg");
    imageElementNav.classList.add("imgForAiDialogueBoxBottomSummaryRowColImg");

    document.getElementById(indexedIds.aiDialogueSummaryColumn(1)).appendChild(imageElementInf);
    document.getElementById(indexedIds.aiDialogueSummaryColumn(3)).appendChild(imageElementAss);
    document.getElementById(indexedIds.aiDialogueSummaryColumn(5)).appendChild(imageElementAir);
    document.getElementById(indexedIds.aiDialogueSummaryColumn(7)).appendChild(imageElementNav);

    //SET ARMY DATA
    document.getElementById(indexedIds.aiDialogueSummaryColumn(2)).innerHTML = formatNumbersToKMB(returnArmyData[0]);
    document.getElementById(indexedIds.aiDialogueSummaryColumn(4)).innerHTML = returnArmyData[1];
    document.getElementById(indexedIds.aiDialogueSummaryColumn(6)).innerHTML = returnArmyData[2];
    document.getElementById(indexedIds.aiDialogueSummaryColumn(8)).innerHTML = returnArmyData[3];
}

/**
 * What the map tooltip says for one path.
 *
 * The owning country's name, plus who is besieging the territory when it is under
 * siege: `"France (under siege by Germany)"`. Phase 6 replaced the siege marker's own
 * tooltip with this -- see the mousemove handler in `svgMapLoaded()`.
 */
function territoryTooltipLabel(path, countryName) {
    if (!countryName || !pathIsUnderSiege(path)) {
        return countryName;
    }
    const besieger = pathBesieger(path);
    return besieger ? countryName + " (under siege by " + besieger + ")" : countryName;
}
