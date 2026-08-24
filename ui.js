import {
    PROBABILITY_THRESHOLD_FOR_SIEGE
} from './src/config/balance.js';
import {
    cosmeticRandom
} from './src/platform/cosmeticRng.js';
import {
    getManualAdditions,
    getManualDenials
} from './src/data/manualAdjacencyExceptions.js';
import {
    buildPathIndex,
    getPathByName
} from './src/state/indexes.js';
import {
    getGameInitialisation,
    initialiseGame
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
    getCurrentAiWarId,
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
    anyCountryGreyedOut
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
    pathIsGreyedOut,
    pathIsUnderSiege,
    pathIsDeactivated,
    pathIsAttackable,
    pathIsPlayerOwned,
    pathOwner,
    pathCountry
} from './src/state/pathState.js';
import {
    classNames,
    dynamicIds,
    indexedIds,
    ids,
    sel
} from './src/ui/core/registry.js';
import {
    el,
    mount
} from './src/ui/core/dom.js';
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
let eventHandlerExecuted = false;

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

export let currentMapColorAndStrokeArray = []; //current state of map at start of new turn
let listOfStartingCountryColorsArray = [];

const CONTINENT_COLOR_ARRAY = [
    ["Africa", [233, 234, 20]],
    ["Asia", [203, 58, 22]],
    ["Europe", [186, 218, 85]],
    ["North America", [83, 107, 205]],
    ["South America", [193, 83, 205]],
    ["Oceania", [74, 202, 233]]
];
const GREY_OUT_COLOR = 'rgb(170,170,170)';
//How far a locked country's own colour is pulled toward GREY_OUT_COLOR. Phase 5.8: they
//used to be painted FLAT grey, which read as "this country failed to render" rather than
//"you may not play this one" -- and, because the confirm button was gated on that exact
//fill string, repainting one through the colour picker made it selectable. Keeping the
//country's hue and muting it says the same thing without the fill being load-bearing.
const LOCKED_COUNTRY_MUTING = 0.65;
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
let colorArray;
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
export let territoryAboutToBeAttackedOrSieged = null;
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
let zoomLevel = 1;
const maxZoomLevel = 6;
let originalViewBoxXMain = 312;
let originalViewBoxYMain = -207;
let originalViewBoxXCoastLine = 1072;
let originalViewBoxYCoastLine = 158;
let originalViewBoxWidthMain = 1947;
let originalViewBoxHeightMain = 1040;
let originalViewBoxWidthCoastLine = 1947;
let originalViewBoxHeightCoastLine = 1040;
let viewBoxWidthMain = originalViewBoxWidthMain;
let viewBoxHeightMain = originalViewBoxHeightMain;
let viewBoxWidthCoastLine = originalViewBoxWidthCoastLine;
let viewBoxHeightCoastLine = originalViewBoxHeightCoastLine;
let lastMouseX = 0;
let lastMouseY = 0;
let isDragging = false;
let shiftedPath;
let isAnimating = false;
let animationStartTime;
let animationStartViewBoxMain;
let animationStartViewBoxCoastLine;

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

            if (element.tagName === "image") {
                //hover over image
                const imageId = element.getAttribute("id");
                if (dynamicIds.isSiegeOverlay(imageId)) { //siegeImage
                    const territoryName = extractTerritoryName(imageId);
                    let attackerData = findAttackerForSiege(territoryName);
                    tooltip.setContent(territoryName + " is currently under siege by " + attackerData[1] + attackerData[0]);
                }
            } else {
                // Set the content of the tooltip
                tooltip.setContent(countryName);
            }

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
            flipMapMode();
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
        if (!isDragging) {
            if (e.target.tagName === "rect" && currentPhase() === Phase.MOVE_ATTACK) {
                restoreMapColorState(currentMapColorAndStrokeArray, false);
                toggleTransferAttackButton(false, false);
                if (svgMap.querySelector(sel.attackImage)) {
                    svgMap.getElementById(ids.attackImage).remove();
                }
                transferAttackButtonDisplayed = false;
                attackTextCurrentlyDisplayed = false;
                //remove army image
            }
            if (e.target.tagName === "path") {
                currentPath = e.target;
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
        if (!isDragging) {
            if (e.target.tagName === "path") {
                shiftedPath = e.target;
                shiftPath(shiftedPath, 2, 2);
                modifyFill(shiftedPath, true);
            } else {
                shiftedPath = null;
            }
        }

        if (e.button === 0 && zoomLevel > 1) {
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            e.preventDefault();
        }
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
        if (e.button === 0 && isDragging) {
            isDragging = false;
        }
        if (!isDragging) {
            shiftPath(shiftedPath, -2, -2);
            modifyFill(shiftedPath, false);
        }
    });

    colorByStandardColoring();

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
                    if (territoryAboutToBeAttackedOrSieged) {
                        moveButton.hideDestination();
                        attackTextCurrentlyDisplayed = false;
                        if (svgMap.querySelector(sel.attackImage)) {
                            svgMap.getElementById(ids.attackImage).remove();
                        }
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
                        flipMapMode();
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
    //Phase 6.3. The tooltip owns its own element now -- it is no longer a <div> in
    //index.html reached through named window access. Created first because every
    //other component's hover handlers push content into it.
    tooltip.create();

    //MENU CONTAINER
    mainMenu.create({
        onNewGame() {
            playSoundClip("click");
            resetGameState();
            greyOutTerritoriesForUnselectableCountries();
        },
    });

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
        popupWithConfirmContainer.style.display = "flex";
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
    }

    //MAP POPUP WITH CONFIRM BUTTON
    //Phase 6.3. The bar builds itself and derives its own title and button label
    //from the phase, so setPhase() is now the only call a phase transition makes.
    const popupWithConfirmContainer = phaseBar.create({
        onColourLabelClick() {
            playSoundClip("click");
            countrySelect.showPicker();
        },
    });
    const popupConfirm = phaseBar.buttonElement();

    mount(
        ids.mapModeContainer,
        el("img", {
            id: ids.mapModeButton,
            class: "mapMode",
            src: "resources/mapMode1.png",
            on: { click: () => flipMapMode() },
        }),
        el("img", {
            id: ids.strokeHighlightButton,
            class: "mapMode",
            src: "resources/strokeToggle2.png",
            on: { click: () => toggleContinentColorsStroke() },
        })
    );

    mount(
        ids.uiButtonContainer,
        el("img", {
            id: ids.uiToggleButton,
            class: "UI-option",
            src: "resources/globeNoStandButtonUI.png",
            on: {
                click() {
                    playSoundClip("click");
                    if (uiCurrentlyOnScreen) {
                        toggleUIMenu(false);
                    } else {
                        toggleUIMenu(true);
                        infoTable.setActiveTab("summary");
                    }
                },
            },
        })
    );

    countrySelect.create({
        onColourChange() {
            if (mapMode === 2) {
                flipMapMode();
            }
            setPlayerColour(convertHexValueToRGBOrViceVersa(countrySelect.colour(), 0));
            restoreMapColorState(currentMapColorAndStrokeArray, false);
            phaseBar.colourLabelElement().style.color = playerColour();
            if (selectCountryPlayerState) {
                for (let i = 0; i < paths.length; i++) {
                    //A locked country never takes the player colour. `lastClickedPath` is set
                    //for a locked country as well as a playable one, so without this test the
                    //picker painted the player's colour straight over the lock. Phase 5.8.
                    if (pathCountry(paths[i]) === pathCountry(lastClickedPath) && !pathIsGreyedOut(paths[i])) {
                        paths[i].setAttribute("fill", playerColour());
                    }
                }
                //restoreMapColorState() above replays the colours saved at bootstrap, which are
                //the true country colours -- so it lifts the lock off every locked country on
                //the map, not just the one that was clicked. Put it back.
                paintLockedCountries();
            } else if (countrySelectedAndGameStarted) {
                paths.forEach(path => {
                    if (pathIsPlayerOwned(path)) {
                        path.setAttribute("fill", playerColour());
                    }
                });
                currentMapColorAndStrokeArray = saveMapColorState(false);
            }
        },
    });

    // add event listener to popup confirm button
    popupConfirm.addEventListener("click", async function() {
        playSoundClip("click");
        if (selectCountryPlayerState) {
            document.getElementById(ids.popupColor).style.display = "none";
            setAllGreyedOutAttributesToFalseOnGameStart();
            selectCountryPlayerState = false;
            countrySelectedAndGameStarted = true;
            document.getElementById(ids.popupColor).style.color = playerColour();
            phaseBar.dimBody();
            setPlayerCountry(phaseBar.bodyText());
            setPlayerFlag(playerCountryName());
            setFlag(playerCountryName(), 1); //set player flag in top table
            setFlag(playerCountryName(), 3); //set player flag in ui info panel
            restoreMapColorState(currentMapColorAndStrokeArray, true);
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
            if (mapMode === 1) {
                currentMapColorAndStrokeArray = saveMapColorState(false);
            }
        } else if (countrySelectedAndGameStarted && currentPhase() === Phase.BUY_UPGRADE) {
            if (mapMode === 1) {
                currentMapColorAndStrokeArray = saveMapColorState(false);
            }
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
            currentMapColorAndStrokeArray = saveMapColorState(false);
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
        onTabClick: () => playSoundClip("click"),
        onClose() {
            playSoundClip("click");
            toggleUIMenu(false);
            uiCurrentlyOnScreen = false;
        },
        onToggleStartOfTurn() {
            playSoundClip("click");
            uiAppearsAtStartOfTurn = toggleUIToAppearAtStartOfTurn(
                infoTable.checkBoxElement(),
                uiAppearsAtStartOfTurn
            );
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
            playSoundClip("click");
            toggleUpgradeMenu(false);
            upgradeWindowCurrentlyOnScreen = false;
        },
        onConfirm() {
            playSoundClip("click");
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
            playSoundClip("click");
            toggleBuyMenu(false);
            buyWindowCurrentlyOnScreen = false;
        },
        onConfirm() {
            playSoundClip("click");
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
    //button SAYS is still decided by handleMovePhaseTransferAttackButton() below;
    //Phase 6.6 replaces that with deriveMoveButtonState().
    const transferAttackButton = moveButton.create();

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
            playSoundClip("click");
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
            svgMap.getElementById(ids.attackImage).remove();

            if (mapMode === 1) {
                currentMapColorAndStrokeArray = saveMapColorState(false);
            }
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
            if (allTerritories()[i].uniqueId === territoryAboutToBeAttackedOrSieged.getAttribute("uniqueid")) {
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
                    let war = getSiegeObjectFromPath(territoryAboutToBeAttackedOrSieged);
                    if (war) { //handle case where retreat after coming back from a siege
                        addRemoveWarSiegeObject(1, war.warId); // remove war from siegeArray and add to historic array
                        removeSiegeImageFromPath(territoryAboutToBeAttackedOrSieged);
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
        playSoundClip("click");
        toggleBattleUI(false, false);
        battleUIDisplayed = false;
        toggleBattleResults(true);
        battleResultsDisplayed = true;
        if (!defeatType) {
            defeatType = "retreat";
        }
        if (territoryAboutToBeAttackedOrSieged) {
            currentWarFlagString = pathCountry(territoryAboutToBeAttackedOrSieged);
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
                playSoundClip("click");
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
                    siegeAttackArray.push(territoryAboutToBeAttackedOrSieged.getAttribute("uniqueid"));
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
                    if (advanceButton.innerHTML === "Start Attack!" || advanceButton.innerHTML === "Begin War!") {
                        advanceButton.innerHTML === "Start Attack!" ? playSoundClip("dice1") : playSoundClip("click");
                        roundCounterForStats++;
                        enableDisableSiegeButton(1);
                    } else {
                        let diceSound = cosmeticRandom() < 0.5; //audit 5.3 Y - which sound plays is not game state
                        diceSound ? playSoundClip("dice1") : playSoundClip("dice2");
                    }
                    advanceButtonState = 1;
                    setAdvanceButtonText(advanceButtonState, advanceButton);
                    retreatButtonState = 1;
                    setRetreatButtonText(retreatButtonState, retreatButton);
                    let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());
                    if (hasSiegedBefore) {
                        let war = historicWars.find((siege) => siege.warId === getCurrentWarId());
                        let siegeAttackArray = [];
                        siegeAttackArray.push(territoryAboutToBeAttackedOrSieged.getAttribute("uniqueid"));
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
                playSoundClip("click");
                addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
                toggleBattleUI(false, false);
                battleUIDisplayed = false;
                toggleBattleResults(true);
                battleResultsDisplayed = true;
                populateWarResultPopup(0, attackCountry, defendTerritory, "victory", false); //won
                break;
            case 3: //continue siege
                playSoundClip("click");
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
        if (territoryAboutToBeAttackedOrSieged) {
            currentWarFlagString = pathCountry(territoryAboutToBeAttackedOrSieged);
        }
    });

    siegeBottomBarButton.addEventListener('click', function() {

        //"assault" i.e. return to battle state
        //remove siege status
        let war = getSiegeObjectFromPath(territoryAboutToBeAttackedOrSieged);
        setColorsOfDefendingTerritoriesSiegeStats(lastClickedPath, 1);
        setArmyTextValues(war, 3, territoryAboutToBeAttackedOrSieged.getAttribute("uniqueid"));
        setCurrentWarId(war.warId);
        addRemoveWarSiegeObject(1, war.warId); // remove war from siegeArray and add to historic array
        removeSiegeImageFromPath(territoryAboutToBeAttackedOrSieged);
        //siege removed from the store above; `underSiege` follows (Phase 4.4)
        //setup  battle to conquer territory
        enableDisableSiegeButton(1); //disable siege button at start
        let siegeAttackArray = [];
        siegeAttackArray.push(territoryAboutToBeAttackedOrSieged.getAttribute("uniqueid"));
        siegeAttackArray.push(war.proportionsAttackers[war.warId][0]); //add any territory to make the setupBattleUI function work, we have the individual proportions and territories in the proportionsAttackers part of playerSiegeWarsList
        for (let i = 0; i < war.attackingArmyRemaining.length; i++) {
            siegeAttackArray.push(war.attackingArmyRemaining[i]);
        }

        setupBattleUI(siegeAttackArray);
        setTimeout(function() {
            eventHandlerExecuted = false;
        }, 200);
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
        playSoundClip("click");
        toggleBattleResults(false);
        battleResultsDisplayed = false;
        toggleUIButton(true);
        uiButtonCurrentlyOnScreen = true;
        toggleBottomLeftPaneWithTurnAdvance(true);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
        toggleMapModeButton(true);
        mapModeButtonCurrentlyOnScreen = true;

        if (svgMap.getElementById(ids.attackImage)) {
            svgMap.getElementById(ids.attackImage).remove();
        }
        if (mapMode === 1) {
            currentMapColorAndStrokeArray = saveMapColorState(false);
        }
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
                flipMapMode();
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

export function saveMapColorState(gameInit) {
    const stateArray = [];

    for (let i = 0; i < paths.length; i++) {
        const uniqueId = paths[i].getAttribute('uniqueid');
        const fillValue = paths[i].getAttribute('fill');
        const strokeWidthValue = paths[i].getAttribute('stroke-width');

        if (uniqueId && fillValue && strokeWidthValue) {
            stateArray.push([uniqueId, fillValue, strokeWidthValue]);
        }
    }

    if (gameInit) {
        currentMapColorAndStrokeArray = stateArray;
    } else {
        return stateArray;
    }
}

export function restoreMapColorState(array, countrySelectionState) {
    if (validDestinationsArray !== undefined) {
        validDestinationsArray.length = 0;
    }

    currentlySelectedColorsArray.length = 0;

    paths.forEach(path => {
        for (let i = 0; i < array.length; i++) {
            if (array[i][0] === path.getAttribute("uniqueid")) {
                if (countrySelectionState) {
                    if (pathCountry(path) !== pathCountry(currentSelectedPath)) {
                        path.setAttribute("fill", array[i][1]);
                        path.setAttribute("stroke-width", array[i][2]);
                    }
                } else {
                    path.setAttribute("fill", array[i][1]);
                    path.setAttribute("stroke-width", array[i][2]);
                }
                break;
            }
        }
    });
}

function colorByStandardColoring() {
    paths.forEach(path => {
        const uniqueId = path.getAttribute("uniqueid");
        const dataName = pathCountry(path);
        const matchingElement = listOfStartingCountryColorsArray.find(i => i[1] === dataName);
        let pathInfo;
        let randomRgbValue;

        if (matchingElement) {
            randomRgbValue = matchingElement[2];
        } else {
            randomRgbValue = generateRandomRGB();
        }
        pathInfo = [uniqueId, dataName, randomRgbValue];
        listOfStartingCountryColorsArray.push(pathInfo);
        path.setAttribute("fill", `rgb(${randomRgbValue[0]}, ${randomRgbValue[1]}, ${randomRgbValue[2]})`);
    });
}


function generateRandomRGB() {
    const r = Math.floor(Math.random() * 150) + 50;
    const g = Math.floor(Math.random() * 150) + 50;
    const b = Math.floor(Math.random() * 150) + 50;
    return [r, g, b];
}

export function convertHexValueToRGBOrViceVersa(value, direction) {
    if (direction === 0) {
        // Convert from hex to RGB
        const hex = value.replace(/^#/, "");
        const intValue = parseInt(hex, 16);
        const red = (intValue >> 16) & 0xff;
        const green = (intValue >> 8) & 0xff;
        const blue = intValue & 0xff;
        return `rgb(${red},${green},${blue})`;
    } else if (direction === 1) {
        // Convert from RGB to hex
        const rgb = value.slice(4, -1).split(",");
        const red = parseInt(rgb[0]);
        const green = parseInt(rgb[1]);
        const blue = parseInt(rgb[2]);
        const hexValue = ((red << 16) | (green << 8) | blue).toString(16);
        return `#${hexValue.padStart(6, "0")}`;
    }
}

colorArray = generateDistinctRGBs();

function generateDistinctRGBs() {
    const result = [];
    for (let i = 0; i < 16; i++) {
        let val1, val2, val3;
        do {
            val1 = Math.floor(Math.random() * 235) + 1;
            val2 = Math.floor(Math.random() * 235) + 1;
            val3 = Math.floor(Math.random() * 235) + 1;
        } while (result.some(color => (
            Math.abs(val1 - color[0]) < 60 &&
            Math.abs(val2 - color[1]) < 60 &&
            Math.abs(val3 - color[2]) < 60
        )));
        result.push([val1, val2, val3]);
    }
    return result.map(color => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
}

export function zoomMap(event) {
    if (isAnimating) return;

    isAnimating = true;
    animationStartTime = performance.now();
    animationStartViewBoxMain = svgTag.getAttribute("viewBox");
    animationStartViewBoxCoastLine = svgCoastLinesTag.getAttribute("viewBox");

    if (event !== "init") {
        const delta = Math.sign(event.deltaY);

        if (delta < 0 && zoomLevel < maxZoomLevel) {
            zoomLevel++;
        } else if (delta > 0 && zoomLevel > 1) {
            zoomLevel--;
        } else {
            isAnimating = false;
            return;
        }
    } else {
        isAnimating = false;
    }

    let mouseX;
    let mouseY;

    if (event !== "init") {
        mouseX = event.clientX - svgTag.getBoundingClientRect().left + 280;
        mouseY = event.clientY - svgTag.getBoundingClientRect().top + 150;
    } else {
        mouseX = svgTag.getBoundingClientRect().right / 2;
        mouseY = svgTag.getBoundingClientRect().bottom / 2;
    }

    let newWidthMain, newHeightMain, newWidthCoastLine, newHeightCoastLine;
    if (event === "init") {
        newWidthMain = originalViewBoxWidthMain;
        newHeightMain = originalViewBoxHeightMain;
        newWidthCoastLine = originalViewBoxWidthCoastLine;
        newHeightCoastLine = originalViewBoxHeightCoastLine;
    } else if (zoomLevel === 1) {
        newWidthMain = originalViewBoxWidthMain;
        newHeightMain = originalViewBoxHeightMain;
        newWidthCoastLine = originalViewBoxWidthCoastLine;
        newHeightCoastLine = originalViewBoxHeightCoastLine;
    } else if (zoomLevel === 2) {
        newWidthMain = originalViewBoxWidthMain * 0.80;
        newHeightMain = originalViewBoxHeightMain * 0.80;
        newWidthCoastLine = originalViewBoxWidthCoastLine * 0.80;
        newHeightCoastLine = originalViewBoxHeightCoastLine * 0.80;
    } else if (zoomLevel === 3) {
        newWidthMain = originalViewBoxWidthMain * 0.60;
        newHeightMain = originalViewBoxHeightMain * 0.60;
        newWidthCoastLine = originalViewBoxWidthCoastLine * 0.60;
        newHeightCoastLine = originalViewBoxHeightCoastLine * 0.60;
    } else if (zoomLevel === 4) {
        newWidthMain = originalViewBoxWidthMain * 0.40;
        newHeightMain = originalViewBoxHeightMain * 0.40;
        newWidthCoastLine = originalViewBoxWidthCoastLine * 0.40;
        newHeightCoastLine = originalViewBoxHeightCoastLine * 0.40;
    }else if (zoomLevel === 5) {
        newWidthMain = originalViewBoxWidthMain * 0.30;
        newHeightMain = originalViewBoxHeightMain * 0.30;
        newWidthCoastLine = originalViewBoxWidthCoastLine * 0.30;
        newHeightCoastLine = originalViewBoxHeightCoastLine * 0.30;
    }else if (zoomLevel === 6) {
        newWidthMain = originalViewBoxWidthMain * 0.20;
        newHeightMain = originalViewBoxHeightMain * 0.20;
        newWidthCoastLine = originalViewBoxWidthCoastLine * 0.20;
        newHeightCoastLine = originalViewBoxHeightCoastLine * 0.20;
    }
    // console.log(zoomLevel);

    const maxLeftMain = originalViewBoxXMain + originalViewBoxWidthMain - newWidthMain;
    const minLeftMain = originalViewBoxXMain;
    let newLeftMain = originalViewBoxXMain + ((mouseX / viewBoxWidthMain) * originalViewBoxWidthMain) - (newWidthMain / 2);
    newLeftMain = Math.max(minLeftMain, Math.min(maxLeftMain, newLeftMain));

    const maxLeftCoastLine = originalViewBoxXCoastLine + originalViewBoxWidthCoastLine - newWidthCoastLine;
    const minLeftCoastLine = originalViewBoxXCoastLine;
    let newLeftCoastLine = originalViewBoxXCoastLine + ((mouseX / viewBoxWidthCoastLine) * originalViewBoxWidthCoastLine) - (newWidthCoastLine / 2);
    newLeftCoastLine = Math.max(minLeftCoastLine, Math.min(maxLeftCoastLine, newLeftCoastLine));

    const maxTopMain = originalViewBoxYMain + originalViewBoxHeightMain - newHeightMain;
    const minTopMain = originalViewBoxYMain;
    const maxTopCoastLine = originalViewBoxYCoastLine + originalViewBoxHeightCoastLine - newHeightCoastLine;
    const minTopCoastLine = originalViewBoxYCoastLine;

    let newTopMain = originalViewBoxYMain + ((mouseY / viewBoxHeightMain) * originalViewBoxHeightMain) - (newHeightMain / 2);
    newTopMain = Math.max(minTopMain, Math.min(maxTopMain, newTopMain));

    let newTopCoastLine = originalViewBoxYCoastLine + ((mouseY / viewBoxHeightCoastLine) * originalViewBoxHeightCoastLine) - (newHeightCoastLine / 2);
    newTopCoastLine = Math.max(minTopCoastLine, Math.min(maxTopCoastLine, newTopCoastLine));

    const newViewBoxMain = `${newLeftMain} ${newTopMain} ${newWidthMain} ${newHeightMain}`;
    const newViewBoxCoastLine = `${newLeftCoastLine} ${newTopCoastLine} ${newWidthCoastLine} ${newHeightCoastLine}`;

    function updateViewBox(timestamp) {
        const timeElapsed = timestamp - animationStartTime;
        const progress = Math.min(1, timeElapsed / animationDuration);

        const [startLeftMain, startTopMain, startWidthMain, startHeightMain] = animationStartViewBoxMain.split(" ").map(parseFloat);
        const [startLeftCoastLine, startTopCoastLine, startWidthCoastLine, startHeightCoastLine] = animationStartViewBoxCoastLine.split(" ").map(parseFloat);

        const updatedLeftMain = startLeftMain + (newLeftMain - startLeftMain) * progress;
        const updatedTopMain = startTopMain + (newTopMain - startTopMain) * progress;
        const updatedWidthMain = startWidthMain + (newWidthMain - startWidthMain) * progress;
        const updatedHeightMain = startHeightMain + (newHeightMain - startHeightMain) * progress;

        const updatedLeftCoastLine = startLeftCoastLine + (newLeftCoastLine - startLeftCoastLine) * progress;
        const updatedTopCoastLine = startTopCoastLine + (newTopCoastLine - startTopCoastLine) * progress;
        const updatedWidthCoastLine = startWidthCoastLine + (newWidthCoastLine - startWidthCoastLine) * progress;
        const updatedHeightCoastLine = startHeightCoastLine + (newHeightCoastLine - startHeightCoastLine) * progress;

        svgTag.setAttribute("viewBox", `${updatedLeftMain} ${updatedTopMain} ${updatedWidthMain} ${updatedHeightMain}`);
        svgCoastLinesTag.setAttribute("viewBox", `${updatedLeftCoastLine} ${updatedTopCoastLine} ${updatedWidthCoastLine} ${updatedHeightCoastLine}`);

        if (timeElapsed < animationDuration) {
            requestAnimationFrame(updateViewBox);
        } else {
            isAnimating = false;
            svgTag.setAttribute("viewBox", newViewBoxMain);
            svgCoastLinesTag.setAttribute("viewBox", newViewBoxCoastLine);
        }
    }

    const animationDuration = 500; // You can adjust this value as needed
    requestAnimationFrame(updateViewBox);
}


function panMap(event) {
    if (zoomLevel > 1 && event.buttons === 1) {
        event.preventDefault();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const dx = (mouseX - lastMouseX) * 2;
        const dy = (mouseY - lastMouseY) * 2;

        const viewBoxValuesMain = svgTag.getAttribute("viewBox").split(" ");
        const viewBoxValuesCoastLine = svgCoastLinesTag.getAttribute("viewBox").split(" ");

        const currentViewBoxXMain = parseFloat(viewBoxValuesMain[0]);
        const currentViewBoxYMain = parseFloat(viewBoxValuesMain[1]);
        const currentViewBoxWidthMain = parseFloat(viewBoxValuesMain[2]);
        const currentViewBoxHeightMain = parseFloat(viewBoxValuesMain[3]);
        const originalViewBoxXMain = parseFloat(svgTag.getAttribute("data-original-x"));
        const originalViewBoxYMain = parseFloat(svgTag.getAttribute("data-original-y"));
        const originalViewBoxWidthMain = parseFloat(svgTag.getAttribute("data-original-width"));

        const currentViewBoxXCoastLine = parseFloat(viewBoxValuesCoastLine[0]);
        const currentViewBoxYCoastLine = parseFloat(viewBoxValuesCoastLine[1]);
        const currentViewBoxWidthCoastLine = parseFloat(viewBoxValuesCoastLine[2]);
        const currentViewBoxHeightCoastLine = parseFloat(viewBoxValuesCoastLine[3]);
        const originalViewBoxXCoastLine = parseFloat(svgCoastLinesTag.getAttribute("data-original-x"));
        const originalViewBoxYCoastLine = parseFloat(svgCoastLinesTag.getAttribute("data-original-y"));
        const originalViewBoxWidthCoastLine = parseFloat(svgCoastLinesTag.getAttribute("data-original-width"));

        const newWidthMain = currentViewBoxWidthMain / zoomLevel;
        const newHeightMain = currentViewBoxHeightMain / zoomLevel;
        let newLeftMain = currentViewBoxXMain - dx / zoomLevel;
        let newTopMain = currentViewBoxYMain - dy / zoomLevel;

        const newWidthCoastLine = currentViewBoxWidthCoastLine / zoomLevel;
        const newHeightCoastLine = currentViewBoxHeightCoastLine / zoomLevel;
        let newLeftCoastLine = currentViewBoxXCoastLine - dx / zoomLevel;
        let newTopCoastLine = currentViewBoxYCoastLine - dy / zoomLevel;

        const maxLeftMain = originalViewBoxXMain + originalViewBoxWidthMain - newWidthMain;
        const minLeftMain = originalViewBoxXMain;

        const maxLeftCoastLine = originalViewBoxXCoastLine + originalViewBoxWidthCoastLine - newWidthCoastLine;
        const minLeftCoastLine = originalViewBoxXCoastLine;

        if (newLeftMain < minLeftMain) {
            newLeftMain = minLeftMain;
        } else if (newLeftMain > maxLeftMain) {
            newLeftMain = maxLeftMain;
        }

        if (newLeftCoastLine < minLeftCoastLine) {
            newLeftCoastLine = minLeftCoastLine;
        } else if (newLeftCoastLine > maxLeftCoastLine) {
            newLeftCoastLine = maxLeftCoastLine;
        }

        const maxTopMain = originalViewBoxYMain + originalViewBoxHeightMain - newHeightMain;
        const minTopMain = originalViewBoxYMain;
        if (newTopMain < minTopMain) {
            newTopMain = minTopMain;
        } else if (newTopMain > maxTopMain) {
            newTopMain = maxTopMain;
        }

        const maxTopCoastLine = originalViewBoxYCoastLine + originalViewBoxHeightCoastLine - newHeightCoastLine;
        const minTopCoastLine = originalViewBoxYCoastLine;
        if (newTopCoastLine < minTopCoastLine) {
            newTopCoastLine = minTopCoastLine;
        } else if (newTopCoastLine > maxTopCoastLine) {
            newTopCoastLine = maxTopCoastLine;
        }

        if (newLeftMain !== currentViewBoxXMain || newTopMain !== currentViewBoxYMain) {
            const newViewBoxMain = `${newLeftMain} ${newTopMain} ${currentViewBoxWidthMain} ${currentViewBoxHeightMain}`;
            svgTag.setAttribute("viewBox", newViewBoxMain);
        }

        if (newLeftCoastLine !== currentViewBoxXCoastLine || newTopCoastLine !== currentViewBoxYCoastLine) {
            const newViewBoxCoastLine = `${newLeftCoastLine} ${newTopCoastLine} ${currentViewBoxWidthCoastLine} ${currentViewBoxHeightCoastLine}`;
            svgCoastLinesTag.setAttribute("viewBox", newViewBoxCoastLine);
        }

        // Disable scrollbar functionality
        document.body.style.overflow = "hidden";

        // Update last mouse position
        lastMouseX = mouseX;
        lastMouseY = mouseY;
    }
}

function setStrokeWidth(path, stroke) {
    path.setAttribute("stroke-width", stroke)
}

export function enableNewGameButton() {
    mainMenu.setNewGameEnabled(true);
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

/**
 * The muted form of a country colour, for a country the player may not choose.
 *
 * Falls back to flat grey only if the fill is not an `rgb(...)` triple, which no path
 * on this map has once `colorCountriesRandomly()` has run.
 */
function lockedCountryFill(baseFill) {
    const base = typeof baseFill === "string" ? baseFill.match(/\d+/g) : null;
    if (!base || base.length < 3) {
        return GREY_OUT_COLOR;
    }
    const grey = GREY_OUT_COLOR.match(/\d+/g).map(Number);
    const muted = base.slice(0, 3).map((channel, index) => {
        const value = Number(channel);
        return Math.round(value + (grey[index] - value) * LOCKED_COUNTRY_MUTING);
    });
    return "rgb(" + muted[0] + "," + muted[1] + "," + muted[2] + ")";
}

/**
 * Re-apply the locked treatment to every country the player may not choose.
 *
 * Idempotent, and it has to be called after ANY repaint that happens while the
 * selection screen is up: `restoreMapColorState()` replays the colours saved at
 * bootstrap by `saveMapColorState(true)`, which are the countries' TRUE colours, so
 * a restore silently takes the lock off all five otherwise. That is half of how the
 * lock used to be bypassable -- see the colour-picker handler.
 */
function paintLockedCountries() {
    if (!anyCountryGreyedOut()) {
        return;
    }
    paths.forEach(path => {
        if (!pathIsGreyedOut(path)) {
            return;
        }
        const saved = currentMapColorAndStrokeArray.find(
            entry => entry[0] === path.getAttribute("uniqueid")
        );
        path.setAttribute("fill", lockedCountryFill(saved ? saved[1] : path.getAttribute("fill")));
    });
}

function setAllGreyedOutAttributesToFalseOnGameStart() {
    clearGreyedOutCountries();
}

function handleMovePhaseTransferAttackButton(path, lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, territoryComingFrom, xButtonClicked, xButtonFromWhere) {
    let button = moveButton.element();
    button.style.display = "none";
    transferAttackButtonDisplayed = false;

    if (!xButtonClicked) {
        //if clicked territory is not owned by the player and is not a valid destination then return
        //if not a player owned territory and the lastPlayerOwned array does not contain the path
        if (lastPlayerOwnedValidDestinationsArray && !pathIsPlayerOwned(path) && !lastPlayerOwnedValidDestinationsArray.some(destination => destination.getAttribute("uniqueid") === path.getAttribute("uniqueid"))) {
            return;
        } else if (pathIsPlayerOwned(path)) {
            territoryAboutToBeAttackedOrSieged = null;

            //if territory is deactivated, then get how many turns are left
            let deactivatedTurnsLeft;
            for (let i = 0; i < playerTurnsDeactivatedArray.length; i++) {
                if (path.getAttribute("uniqueid") === playerTurnsDeactivatedArray[i][0]) {
                    deactivatedTurnsLeft = (playerTurnsDeactivatedArray[i][1] - playerTurnsDeactivatedArray[i][2]) + 1;
                }
            }
            // if clicks on a player-owned territory then show button in transfer state
            if (pathIsDeactivated(path)) {
                button.innerHTML = "DEACTIVATED (" + deactivatedTurnsLeft + ")";
                button.classList.remove("move-phase-button-red-background");
                button.classList.remove("move-phase-button-green-background");
                button.classList.remove("move-phase-button-brown-background");
                button.classList.remove("move-phase-button-blue-background");
                button.classList.add("move-phase-button-grey-background");
                button.disabled = true;
                button.style.display = "flex";
                transferAttackButtonDisplayed = true;
            } else {
                button.innerHTML = "TRANSFER";
                if (playerOwnedTerritories.length <= 1) {
                    button.classList.remove("move-phase-button-red-background");
                    button.classList.remove("move-phase-button-green-background");
                    button.classList.remove("move-phase-button-brown-background");
                    button.classList.remove("move-phase-button-blue-background");
                    button.classList.add("move-phase-button-grey-background");
                    button.disabled = true;
                } else {
                    button.classList.remove("move-phase-button-red-background");
                    button.classList.remove("move-phase-button-grey-background");
                    button.classList.remove("move-phase-button-brown-background");
                    button.classList.remove("move-phase-button-blue-background");
                    button.classList.add("move-phase-button-green-background");
                    button.disabled = false;
                    transferAttackButtonState = 0; //transfer
                }
                button.style.display = "flex";
                transferAttackButtonDisplayed = true;
            }
        } else if (pathIsPlayerOwned(lastClickedPathExternal) && pathIsAttackable(path) && !pathIsPlayerOwned(path) && lastPlayerOwnedValidDestinationsArray.some(destination => destination.getAttribute("uniqueid") === path.getAttribute("uniqueid")) && !pathIsUnderSiege(path)) {
            // if clicks on an enemy territory that is within reach then show attack state
            button.innerHTML = "ATTACK";
            button.classList.remove("move-phase-button-green-background");
            button.classList.remove("move-phase-button-grey-background");
            button.classList.remove("move-phase-button-brown-background");
            button.classList.remove("move-phase-button-blue-background");
            button.classList.add("move-phase-button-red-background");
            button.style.display = "flex";
            transferAttackButtonDisplayed = true;
            button.disabled = false;
            transferAttackButtonState = 1; //attack
            setTerritoryForAttack(path);
        } else if (pathIsUnderSiege(path)) {
            // if clicks on an enemy territory that is within reach but under siege then set it up for that
            const territoryName = path.getAttribute("territory-name");
            const siege = playerSiegeWarsList[territoryName] || aiSiegeWarsList[territoryName];
            button.innerHTML = "VIEW SIEGE (" + (siege ? siege.turnsInSiege : "?") + ")";
            button.classList.remove("move-phase-button-green-background");
            button.classList.remove("move-phase-button-grey-background");
            button.classList.remove("move-phase-button-red-background");
            button.classList.remove("move-phase-button-blue-background");
            button.classList.add("move-phase-button-brown-background");
            button.style.display = "flex";
            transferAttackButtonDisplayed = true;
            button.disabled = false;
            transferAttackButtonState = 2; //lift siege
            setTerritoryForSiege(path);
        }
    } else {
        if (xButtonFromWhere === 0) { //transfer
            button.style.display = "flex";
            button.innerHTML = "TRANSFER";
            button.classList.remove("move-phase-button-blue-background");
            button.classList.remove("move-phase-button-red-background");
            button.classList.remove("move-phase-button-grey-background");
            button.classList.remove("move-phase-button-brown-background");
            button.classList.add("move-phase-button-green-background");
            transferAttackButtonState = 0;
            return;
        } else if (xButtonFromWhere === 1) { //attack
            button.style.display = "flex";
            button.innerHTML = "ATTACK";
            button.classList.remove("move-phase-button-blue-background");
            button.classList.remove("move-phase-button-green-background");
            button.classList.remove("move-phase-button-grey-background");
            button.classList.remove("move-phase-button-brown-background");
            button.classList.add("move-phase-button-red-background");
            transferAttackButtonState = 1;
            return;
        }
    }

    button.removeEventListener("click", transferAttackClickHandler); // Remove the existing event listener if any

    button.addEventListener("click", transferAttackClickHandler);

    function transferAttackClickHandler() {
        tooltip.setContent("");
        tooltip.hide();
        playSoundClip("click");
        if (transferAttackButtonState === 0) {
            territoryComingFrom = lastClickedPath;
        }
        if (!eventHandlerExecuted) {
            eventHandlerExecuted = true;
            if (!button.disabled) {
                if (!transferAttackWindowOnScreen) {
                    toggleUIButton(false);
                    toggleBottomLeftPaneWithTurnAdvance(false);
                    toggleMapModeButton(false);
                    mapModeButtonCurrentlyOnScreen = false;

                    if (transferAttackButtonState === 0 || transferAttackButtonState === 1) {
                        toggleTransferAttackWindow(true);
                        setTransferAttackWindowTitleText(
                            territoryAboutToBeAttackedOrSieged && territoryAboutToBeAttackedOrSieged.getAttribute("territory-name") !== null ?
                                territoryAboutToBeAttackedOrSieged.getAttribute("territory-name") :
                                "transferring",
                            territoryAboutToBeAttackedOrSieged ? pathCountry(territoryAboutToBeAttackedOrSieged) : null,
                            territoryComingFrom,
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
                        setTimeout(function() {
                            eventHandlerExecuted = false;
                        }, 200);
                        return;

                    } else if (transferAttackButtonState === 2) { //click view siege button //button says VIEW SIEGE
                        setValuesForBattleFromSiegeObject(lastClickedPath, false);
                        enableDisableAssaultButton(0);
                        toggleBattleUI(true, false);
                        battleUIDisplayed = true;
                        toggleTransferAttackButton(false, false);
                        transferAttackButtonDisplayed = false;

                        setupSiegeUI(territoryAboutToBeAttackedOrSieged);

                        setColorsOfDefendingTerritoriesSiegeStats(lastClickedPath, 0);

                        setTimeout(function() {
                            eventHandlerExecuted = false;
                        }, 200);
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
                        setTimeout(function() {
                            eventHandlerExecuted = false;
                        }, 200);
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
                            setTimeout(function() {
                                eventHandlerExecuted = false;
                            }, 200);
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
                        setTimeout(function() {
                            eventHandlerExecuted = false;
                        }, 200);
                        return;
                    }
                }
            }
            setTimeout(function() {
                eventHandlerExecuted = false;
            }, 200);
        }
    }

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
        } else if (!button.disabled && playerOwnedTerritories.length > 1 && button.innerHTML === "TRANSFER") {
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

function setTerritoryForAttack(territoryToAttack) {
    territoryAboutToBeAttackedOrSieged = territoryToAttack;
    moveButton.showDestination(
        territoryAboutToBeAttackedOrSieged.getAttribute("territory-name"),
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
        addImageToPath(territoryToAttack, "battle.png", 0);
    }
}

function setTerritoryForSiege(territoryToSiege) {
    territoryAboutToBeAttackedOrSieged = territoryToSiege;
    moveButton.showDestination(
        territoryAboutToBeAttackedOrSieged.getAttribute("territory-name"),
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

export function addImageToPath(pathElement, imagePath, siege) {
    const pathBounds = pathElement.getBBox();

    const centerX = pathBounds.x + pathBounds.width / 2;
    const centerY = pathBounds.y + pathBounds.height / 2;

    const maxImageWidth = pathBounds.width * 0.7;
    const maxImageHeight = pathBounds.height * 0.7;

    const imageElement = document.createElementNS("http://www.w3.org/2000/svg", "image");
    imageElement.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);

    let imageWidth = Math.min(maxImageWidth, maxImageHeight);
    let imageHeight = Math.min(maxImageWidth, maxImageHeight);
    const imageX = centerX - imageWidth / 2;
    const imageY = centerY - imageHeight / 2;
    imageElement.setAttribute("x", imageX.toString());
    imageElement.setAttribute("y", imageY.toString());
    imageElement.setAttribute("z-index", "9999");
    //Decoration never intercepts a click. Without this the marker covers the middle of the
    //territory it marks and the player cannot select it. Phase 5.8.
    imageElement.style.pointerEvents = "none";

    if (siege === 1) {
        imageElement.setAttribute("width", imageWidth.toString());
        imageElement.setAttribute("height", imageHeight.toString());
        for (const key in playerSiegeWarsList) {
            if (playerSiegeWarsList.hasOwnProperty(key) && playerSiegeWarsList[key].warId === getCurrentWarId()) {
                for (let i = 0; i < paths.length; i++) {
                    if (paths[i].getAttribute("territory-name") === playerSiegeWarsList[key].defendingTerritory.territoryName) {
                        const territoryName = playerSiegeWarsList[key].defendingTerritory.territoryName;
                        pathElement.parentNode.appendChild(imageElement);
                        imageElement.setAttribute("id", dynamicIds.siegeOverlay(territoryName));
                        break;
                    }
                }
                break;
            }
        }
    } else if (siege === 2) {
        imageElement.setAttribute("width", (imageWidth * 0.6).toString());
        imageElement.setAttribute("height", (imageHeight * 0.6).toString());
        for (const key in aiSiegeWarsList) {
            let currentAiWarId = getCurrentAiWarId();
            if (aiSiegeWarsList.hasOwnProperty(key) && aiSiegeWarsList[key].warId === currentAiWarId) {
                for (let i = 0; i < paths.length; i++) {
                    if (paths[i].getAttribute("territory-name") === aiSiegeWarsList[key].defendingTerritory.territoryName) {
                        const territoryName = aiSiegeWarsList[key].defendingTerritory.territoryName;
                        imageElement.setAttribute("style", "opacity: 0.4");
                        pathElement.parentNode.appendChild(imageElement);
                        imageElement.setAttribute("id", dynamicIds.siegeOverlay(territoryName));
                        break;
                    }
                }
                break;
            }
        }
    } else {
        imageElement.setAttribute("width", imageWidth.toString());
        imageElement.setAttribute("height", imageHeight.toString());
        imageElement.setAttribute("id", ids.attackImage);
        pathElement.parentNode.appendChild(imageElement);
    }
}

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

    //audit 5.2 AI: getElementById, not querySelector. Six territory names carry real
    //parentheses -- "Andros Island (Bahamas)", "Grand Bahama (Bahamas)" and friends -- and
    //`#siegeImage_Andros_Island_(Bahamas)` is not a valid CSS selector, so querySelector
    //threw rather than returning null. getElementById takes the id literally.
    const imageElement = svgMap.getElementById(dynamicIds.siegeOverlay(territoryName));

    if (imageElement) {
        imageElement.remove();
    }

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

export function removeSiegeImageByTerritoryName(territoryName) {
    const imageElement = svgMap.getElementById(dynamicIds.siegeOverlay(territoryName)); //audit 5.2 AI
    if (imageElement) {
        imageElement.remove();
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

export function setCurrentMapColorAndStrokeArrayFromExternal(changesArray) {
    currentMapColorAndStrokeArray = changesArray;
}

export function setTerritoryAboutToBeAttackedFromExternal(value) {
    territoryAboutToBeAttackedOrSieged = value;
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
}

function toggleMapModeButton(makeVisible) {
    if (makeVisible) {
        document.getElementById(ids.mapModeContainer).style.display = "block";
    } else {
        document.getElementById(ids.mapModeContainer).style.display = "none";
    }
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
        toggleUIButton(false);
        uiButtonCurrentlyOnScreen = false;
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

function toggleUIToAppearAtStartOfTurn(checkBox, uiAppearsAtStartOfTurn) {
    if (uiAppearsAtStartOfTurn) {
        uiAppearsAtStartOfTurn = false;
        checkBox.innerHTML = "";
    } else {
        uiAppearsAtStartOfTurn = true;
        checkBox.innerHTML = "✔";
    }
    return uiAppearsAtStartOfTurn;
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
    let difference = siegeScore - (siegeObjectElement.defendingTerritory.defenseBonus + siegeObjectElement.defendingTerritory.mountainDefenseBonus);
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
        if (mapMode === 1) {
            currentMapColorAndStrokeArray = saveMapColorState(false);
        }
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
    const row4RightColumnA = document.getElementById(ids.battleUIRow4Col2A);
    const row4RightColumnB = document.getElementById(ids.battleUIRow4Col2B);
    const row4RightColumnC = document.getElementById(ids.battleUIRow4Col2C);
    const row4RightColumnD = document.getElementById(ids.battleUIRow4Col2D);
    const row4RightColumnE = document.getElementById(ids.battleUIRow4Col2E);

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

function setUnsetMenuOnEscape(e) {
    if (e.code === "Escape" && outsideOfMenuAndMapVisible && !menuState) { //in game
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
        toggleUpgradeMenu(false);
        toggleBuyMenu(false);
        toggleTransferAttackButton(false, false);
        toggleTransferAttackWindow(false);
        toggleBattleUI(false, false);
        toggleBattleResults(false);
        toggleAiDialogue(false);

    } else if (e.code === "Escape" && outsideOfMenuAndMapVisible && menuState) { // in menu
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

        if (lastClickedPath.getAttribute("d") !== "M0 0 L50 50") {
            selectCountry(lastClickedPath, true);
            if (territoryAboutToBeAttackedOrSieged) {
                if (svgMap.getElementById(ids.attackImage)) { //if battle image on screen then removes and reads it, so it is on top of the svg path
                    svgMap.getElementById(ids.attackImage).remove();
                    addImageToPath(territoryAboutToBeAttackedOrSieged, "battle.png", 0);
                }
            }
        }

        //add siege image back in here after escaping out of menu - for loop and check svg for underSiege

        menuState = false;
    }

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
        document.getElementById(ids.battleUIRow4Col1IconSiegeScore).innerHTML = "<img class='sizingPositionRow4Column1IconBattleUI' src='./resources/sword.png'>";
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

function flipMapMode() {
    let continentColor;
    switch (mapMode) {
        case 1:
            document.getElementById(ids.mapModeButton).src = "resources/mapMode2.png";
            currentMapColorAndStrokeArray = saveMapColorState(false);
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
            break;
        case 2:
            document.getElementById(ids.mapModeButton).src = "resources/mapMode1.png";
            mapMode = 1;
            for (let i = 0; i < paths.length; i++) {
                paths[i].style.stroke = "black";
                paths[i].setAttribute("stroke-width", "1px");
                paths[i].setAttribute("fill-opacity", "1");
            }
            restoreMapColorState(currentMapColorAndStrokeArray, false);
            svgCoastLinesMap.querySelector('image').setAttribute("style", "opacity: 0");
            for (let i = 0; i < pathsCoastLines.length; i++) {
                pathsCoastLines[i].setAttribute("fill", "rgb(134, 133, 104)");
                pathsCoastLines[i].setAttribute("fill", "none");
            }
            break;
    }
}

function toggleContinentColorsStroke() {
    let continentColor;
    for (let i = 0; i < pathsCoastLines.length; i++) {
        if (pathsCoastLines[i].style.stroke === "rgb(103, 124, 160)") {
            //toggle on
            document.getElementById(ids.strokeHighlightButton).src = "resources/strokeToggle1.png";
            continentColor = pathsCoastLines[i].getAttribute("shadow");
            pathsCoastLines[i].style.stroke = `rgb(${CONTINENT_COLOR_ARRAY.find(([continentIndex]) => continentIndex === continentColor)[1].join(", ")})`;
            if (mapMode === 1) {
                pathsCoastLines[i].style.strokeWidth = "6px";
            } else if (mapMode === 2) {
                pathsCoastLines[i].style.strokeWidth = "5px";
            }
        } else { // toggle off
            document.getElementById(ids.strokeHighlightButton).src = "resources/strokeToggle2.png";
            pathsCoastLines[i].style.stroke = "rgb(103, 124, 160)";
            if (pathsCoastLines[i].getAttribute("isisland") === "true") {
                pathsCoastLines[i].style.strokeWidth = "2px";
            } else {
                pathsCoastLines[i].style.strokeWidth = "5px";
            }
        }
    }
}

export function endPlayerTurn() {
    if (mapMode === 2) {
        flipMapMode();
    }
    for (let i = 0; i < paths.length; i++) {
        if (!pathIsUnderSiege(paths[i]) && !pathIsDeactivated(paths[i])) {
            paths[i].style.stroke = "rgb(0,0,0)";
            paths[i].setAttribute("stroke-width", "1");
            paths[i].style.strokeDasharray = "none";
        } else {
            //A besieged or freshly-conquered territory keeps its stroke decoration, so its
            //FILL has to be re-asserted here instead. This used to paint playerColour() on
            //every path that reached this branch, whoever owned it -- so every AI territory
            //besieged by another AI took the player's colour, with the player nowhere near
            //the war. With the picker left on its default white that produced a growing
            //patch of blank territories (45 after four turns, 55 after eight); with any
            //other colour picked it produced something worse, AI land painted as if the
            //player held it. Worse still, saveMapColorState() three lines below captures
            //the result, so the wrong colour was replayed by every later
            //restoreMapColorState() and never washed out.
            //Ask the owner. This also repairs a path that a previous turn mis-painted.
            if (pathIsPlayerOwned(paths[i])) {
                paths[i].setAttribute("fill", playerColour());
            } else {
                const territory = getTerritory(paths[i].getAttribute("uniqueid"));
                if (typeof territory?.countryColor === "string" && territory.countryColor !== "") {
                    paths[i].setAttribute("fill", territory.countryColor);
                }
            }
        }
    }
    if (svgMap.querySelector(sel.attackImage)) {
        svgMap.getElementById(ids.attackImage).remove();
    }
    currentMapColorAndStrokeArray = saveMapColorState(false);
    toggleTransferAttackButton(false, false);
    transferAttackButtonDisplayed = false;
    restoreMapColorState(currentMapColorAndStrokeArray, false);
    setPhase(Phase.AI);
}

export function initialiseNewPlayerTurn() {
    populateBottomTableWhenSelectingACountry(getLastClickedPath());
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
    if (mapMode === 1) {
        currentMapColorAndStrokeArray = saveMapColorState(false);
    }
    setPhase(Phase.BUY_UPGRADE);
}

export function setCurrentMapColorAndStrokeArray(value) {
    return currentMapColorAndStrokeArray = value;
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

export function setZoomLevel(value) {
    return zoomLevel = value;
}

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
        for (let i = 0; i < paths.length; i++) {
            if (pathCountry(paths[i]) === territory.dataName) {
                for (let j = 0; j < listOfStartingCountryColorsArray.length; j++) {
                    if (listOfStartingCountryColorsArray[j][0] === paths[i].getAttribute("uniqueid")) {
                        console.log("rgb(" + listOfStartingCountryColorsArray[j][2][0].toString() + "," + listOfStartingCountryColorsArray[j][2][1].toString() + "," + listOfStartingCountryColorsArray[j][2][2].toString() + ");");
                        paths[i].setAttribute("fill", "rgb(" + listOfStartingCountryColorsArray[j][2][0].toString() + "," + listOfStartingCountryColorsArray[j][2][1].toString() + "," + listOfStartingCountryColorsArray[j][2][2].toString() + ")");
                        break;
                    }
                }
            }
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

function extractTerritoryName(imageId) {
    const underscoreIndex = imageId.indexOf('_'); // the one SIEGE_OVERLAY_PREFIX ends with
    if (underscoreIndex !== -1) {
        const territoryPart = imageId.substring(underscoreIndex + 1); // Extract the part after underscore
        const territoryWords = territoryPart.split('_'); // Split by underscores
        const capitalizedWords = territoryWords.map(word => word.charAt(0).toUpperCase() + word.slice(1)); // Capitalize each word
        const territoryName = capitalizedWords.join(' '); // Join the words with spaces
        return territoryName;
    } else {
        return ""; // Return empty string if underscore is not found
    }
}

function findAttackerForSiege(territoryName) {
    let attackerCountry;
    let attackerTerritory;
    if (aiSiegeWarsList.hasOwnProperty(territoryName)) {
        attackerCountry = aiSiegeWarsList[territoryName].attackingCountry;
        attackerTerritory = aiSiegeWarsList[territoryName].attackingTerritory + ", ";
    } else if (playerSiegeWarsList.hasOwnProperty(territoryName)) {
        attackerCountry = "";
        attackerTerritory = "Player"
    }
    return [attackerCountry, attackerTerritory];
}