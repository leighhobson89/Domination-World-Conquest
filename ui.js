import {
    battleOutcomeEffects,
    DIE_MODIFIERS,
    PROBABILITY_THRESHOLD_FOR_SIEGE
} from './src/config/balance.js';
import {
    defenderDiceCountFor,
    diceCountFor
} from './src/rules/military/dice.js';
import {
    scoreDifferenceFor,
    siegeHitProbability
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
    openUpgradeWindowFor,
    playerOwnedTerritories,
    populateBottomTableWhenSelectingACountry,
    totalConsMats,
    totalGoldPrice,
    totalPopulationCost,
    totalPurchaseGoldPrice,
    upgradeIsAvailableForPath,
    writeBottomTableInformation
} from './resourceCalculations.js';
import {
    playSoundClip
} from './sfx.js';
import {
    drawAndHandleTransferAttackTable,
    probability,
    takeOdds,
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
    getAttackingArmyRemaining,
    getCurrentRound,
    getCurrentWarId,
    getNextWarId,
    getFinalAttackArray,
    getMassiveAssaultStatus,
    getResolution,
    getRoutStatus,
    getSiegeObjectFromPlayerSiegeList,
    historicWars,
    historicAiWars,
    playerSiegeWarsList,
    playerTurnsDeactivatedArray,
    processRound,
    takeLastPush,
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
} from './battle.js';
import {
    diceStage
} from './src/ui/battle/DiceStage.js';
import {
    clashPanel
} from './src/ui/battle/ClashPanel.js';
import {
    forceLedger
} from './src/ui/battle/ForceLedger.js';
import {
    defenderPlayback
} from './src/ui/battle/DefenderPlayback.js';
import {
    AdvanceMode,
    ReservesState,
    RetreatMode,
    ThirdButton,
    battleWindow
} from './src/ui/battle/BattleWindow.js';
import {
    roundLog
} from './src/ui/battle/RoundLog.js';
import {
    attackPreview
} from './src/ui/battle/AttackPreview.js';
import {
    pendingDefences
} from './src/state/battlePlayback.js';
import {
    closeBattle,
    currentBattle,
    defeatType as defeatTypeFromBattle,
    pendingReserves,
    queueReserves
} from './src/state/battleState.js';
import {
    createCpuPlayerObjectAndAddToMainArray,
    getArrayOfLeadersAndCountries,
    updateArrayOfLeadersAndCountries
} from "./cpuPlayerGenerationAndLoading.js";
import {
    activeVictoryCondition,
    closestToVictory,
    setAiResponseFlag,
    setVictoryCondition,
    acceptProposal,
    answerProposal,
    applyBreach,
    applyCallInAnswer,
    dissolveAlliance,
    resolveCallIns,
    victoryProgress,
    worldStandings
} from "./aiCalculations.js";
import {
    allTerritories,
    getTerritory,
    currentTurn,
    currentPhase,
    greyedOutCountryNames,
    playerCountryName,
    playerColour,
    playerTerritories,
    relationBetween,
    relationsFor,
    relationStateBetween,
} from './src/state/selectors.js';
import {
    setPhase,
    setPlayerCountry,
    setPlayerColour,
    setPlayerFlag,
    setGreyedOutCountries,
    clearGreyedOutCountries,
    setAttackableTerritories,
    clearAttackableTerritories,
    setRelationState,
    setTerritoryArmy
} from './src/state/mutations.js';
import {
    Phase
} from './src/state/phases.js';
import {
    Events,
    on as onStateEvent
} from './src/state/events.js';
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
    attachArrowLayer,
    showAttackArrows,
    clearAttackArrows
} from './src/ui/map/attackArrows.js';
import {
    setPathStrokePx
} from './src/ui/map/strokes.js';
import {
    attachMilitaryLayer,
    configureMilitaryView,
    isMilitaryViewActive,
    militaryFillFor,
    militaryTooltipLines
} from './src/ui/map/militaryView.js';
import { upgradeTooltipRows } from './src/ui/map/upgradeTooltip.js';
import { diplomacyTooltipRows } from './src/ui/map/diplomacyTooltip.js';
import { allowsAttack, allowsDeclaration, describeState, DiplomaticState } from './src/state/diplomacy.js';
import { ensureDiplomaticContacts } from './src/state/diplomacyContacts.js';
import {
    CLOUD_MODES,
    attachCloudOverlay,
    cloudMode,
    cycleCloudMode,
    setCloudMode
} from './src/ui/map/cloudOverlay.js';
import {
    attachFlagOverlay,
    isFlagOverlayActive,
    refreshFlagOverlay,
    setFlagOverlayActive
} from './src/ui/map/flagOverlay.js';
import {
    MAP_VIEWS,
    MAP_VIEW_TITLE,
    attachMapViews,
    cycleMapView,
    exitPhysicalMap,
    isPhysicalMapActive,
    onMapViewChanged,
    resetMapView
} from './src/ui/map/mapViews.js';
import {
    attachCamera,
    zoomMap,
    panMap,
    beginDrag,
    endDrag,
    endedInPan,
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
import { continentHoldingFor } from './src/state/continentBonus.js';
import { describeContinentHolding } from './src/ui/continents/continentBonusText.js';
import {
    classNames,
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
    joystickIcon,
    mapSheetIcon,
    mountainIcon,
    continentIcon,
    crossedSwordsIcon,
    flagIcon,
    cloudIcon
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
    goalSelect
} from './src/ui/components/GoalSelect.js';
import {
    gameOver
} from './src/ui/components/GameOver.js';
import {
    aiGameGoalBar
} from './src/ui/components/AiGameGoalBar.js';
import {
    mapLegend
} from './src/ui/components/MapLegend.js';
import {
    describeCondition,
    describeLeaderProgress,
    randomGoalCondition
} from './src/ui/goals/goalCatalogue.js';
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
    diplomacyPanel
} from './src/ui/components/DiplomacyPanel.js';
import {
    declarationPromptFor
} from './src/ui/diplomacy/declarationPrompt.js';
import {
    aiDebugPanel
} from './src/ui/components/AiDebugPanel.js';
import {
    aiGameConsole
} from './src/ui/components/AiGameConsole.js';
import {
    debugPlanPanel
} from './src/ui/components/DebugPlanPanel.js';
import {
    clearAllDebugPlans
} from './src/ai/debugPlans.js';
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
    isBoundJoiner,
    resetDiplomacyMemory
} from './src/ai/diplomacy.js';
import {
    opinionOf,
    resetOpinions
} from './src/ai/opinion.js';
import { opinionTooltipBars } from './src/ui/diplomacy/opinionBar.js';
import { isDefeated } from './src/state/defeated.js';
import {
    clearDiplomacyInbox,
    InboxKind,
    pendingDiplomacy,
    queueDeclaration,
    takePendingDiplomacy
} from './src/state/diplomacyInbox.js';
import {
    describeInboxEntry
} from './src/ui/diplomacy/describeInbox.js';
//SIDE-EFFECT IMPORT. `diplomacyExpiry.js` subscribes to `TURN_CHANGED` at module load and
//exports nothing anybody here calls -- it is what puts a lapsed ceasefire back to whatever it
//was signed out of, once, at the turn boundary, so that every reader of the register on turn
//N sees the same world. Nothing else imports it, so without this line it would never load and
//a ceasefire would simply never end.
import './src/state/diplomacyExpiry.js';
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

export function whenPageLoaded() {
    return bootstrapReadyPromise;
}

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

const COUNTRY_GREYOUT_RANK = 5;
export { PROBABILITY_THRESHOLD_FOR_SIEGE };
export let lastClickedPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
lastClickedPath.setAttribute("d", "M0 0 L50 50");
export let lastClickedPathExternal;
let currentPath;
export let currentSelectedPath;
let validDestinationsAndClosestPointArray;
let validDestinationsArray;
let lastPlayerOwnedValidDestinationsArray;
let closestDistancesArray;
let hoveredNonInteractableAndNonSelectedTerritory = false;
let territoriesAbleToAttackTarget;
let originalDefendingTerritory;

let bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
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
export let digInNextRound = false;
let battleUIDisplayed = false;
export let transferToTerritory;
export let battleUIState = 0;

let battleStart;

let defendingTerritoryCopyStart;
let defendingTerritoryCopyEnd;
let roundCounterForStats = 0;
let attackCountry;
let defendTerritory;
let currentWarFlagString;
let territoryStringDefender;

const multiplierForScatterLoss = 0.7;


let shiftedPath;

export function setUpgradeOrBuyWindowOnScreenToTrue(upgradeOrBuyParameter) {
    if (upgradeOrBuyParameter === 1) {
        upgradeWindowCurrentlyOnScreen = true;
    } else if (upgradeOrBuyParameter === 2) {
        buyWindowCurrentlyOnScreen = true;
    }
}

export function svgMapLoaded() {
    console.log("Starting Page Load Process");
    svg = document.getElementById(ids.svgMap);
    svgCoastLines = document.getElementById(ids.svgCoastLines);
    svgMap = svg.contentDocument;
    svgCoastLinesMap = svgCoastLines.contentDocument;
    svgTag = svgMap.querySelector('svg');
    svgCoastLinesTag = svgCoastLinesMap.querySelector('svg');
    paths = Array.from(svgMap.querySelectorAll('path'));
    pathsCoastLines = Array.from(svgCoastLinesMap.querySelectorAll('path'));
    buildPathIndex(paths);
    attachCamera(svgTag, svgCoastLinesTag);
    attachMapView(paths);
    attachMarkerLayer(svgMap);
    attachArrowLayer(svgMap);
    attachMilitaryLayer(svgMap);
    attachFlagOverlay(svgMap);
    attachCloudOverlay(svgMap);
    attachMapViews({
        paths,
        coastPaths: pathsCoastLines,
        coastDocument: svgCoastLinesMap
    });
    //The two things the military view may not import for itself: the repaint (its own caller,
    //`MapView.js`) and the abbreviation (`resourceCalculations.js`, which would drag the whole
    //economy in behind it).
    configureMilitaryView({
        repaint: repaintMap,
        //`1` is this function's argument for NO decimal place, which is a genuinely
        //unfortunate signature. A figure on the map wants to be short -- "500k" fits inside
        //Germany at world zoom and "499.9k" does not -- and a tenth of a thousand men is
        //below anything a player would act on anyway.
        format: (value) => formatNumbersToKMB(value, 1)
    });

    svgCoastLines.setAttribute("tabindex", "0");
    svg.setAttribute("tabindex", "1");
    svg.focus();

    //THE TOOLTIP IS DRIVEN FROM ONE DELEGATED LISTENER, AND IT USED TO BE ONE PER HOVER.
    //`mouseover` added a fresh `mousemove` and a fresh `mouseout` to the territory every time
    //the pointer entered it, and removed neither -- so hovering a province twenty-four times
    //left twenty-four of each on it, for the life of the page. Every one of them rebuilt the
    //whole tooltip (the continent walk, the leader lookup, the military plan, the upgrades) on
    //every pixel of pointer movement, so a long session degraded until the tooltip stopped
    //keeping up altogether and only a reload cleared it. Measured before the fix: twenty-four
    //hovers, twenty-four listeners of each kind. This is the same defect the move button had,
    //and the same rule closes it -- install the listener ONCE, from bootstrap, and let the
    //event tell you what it is over.
    //A CONQUEST UNDER A HELD POINTER. The label is cached per territory, so without this a
    //tooltip left open through an AI turn would keep describing the world as it was when the
    //pointer arrived -- which is precisely the turn a player is watching it for.
    onStateEvent(Events.TERRITORY_CHANGED, () => { tooltipStale = true; });
    onStateEvent(Events.TURN_CHANGED, () => { tooltipStale = true; });
    //A declaration, a truce or an alliance changes what the tooltip says about a territory
    //without changing anything on it, so neither of the two above would catch it.
    onStateEvent(Events.DIPLOMACY_CHANGED, () => { tooltipStale = true; });
    //A WAR OPENED AGAINST THE PLAYER IS PUT TO THEM, and this is where it is noticed.
    onStateEvent(Events.DIPLOMACY_CHANGED, noticeWarOnPlayer);

    svgMap.addEventListener("mouseover", function(e) {
        const element = e.target;

        currentPath = element;

        if (!pathIsGreyedOut(element)) {
            hoverOverTerritory(element, "mouseOver");
        }

        element.style.cursor = "pointer";
    });

    svgMap.addEventListener("mouseout", function() {
        tooltip.setContent("");
        tooltip.hide();
        if (currentPath) {
            if (!pathIsGreyedOut(currentPath)) {
                hoverOverTerritory(currentPath, "mouseOut");
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
        //A CLICK THAT ENDED A PAN IS NOT A CLICK ON A TERRITORY. Dragging the relief map used
        //to drop it back to the political map the moment the button was released, because the
        //click that ends a pan reached the branch below that leaves the relief -- and the
        //`if (!isDragging())` further down could not stop it: `mouseup` fires before `click`
        //and is where the drag flag is cleared, so inside a click handler that test is always
        //true. `endedInPan()` is the question that can actually be asked here, and the whole
        //handler is behind it rather than just the relief branch, because none of what follows
        //-- selecting a territory, clearing an attack, opening the colour picker -- is
        //something a player asked for by moving the map.
        if (endedInPan()) {
            return;
        }

        const offsetX = 1;
        const offsetY = 1;
        const newX = e.clientX + offsetX;
        const newY = e.clientY + offsetY;

        const newEvent = new MouseEvent('click', {
            clientX: newX,
            clientY: newY,
        });

        e.target.dispatchEvent(newEvent);

        //CLICKING A TERRITORY NO LONGER LEAVES THE RELIEF MAP. It used to, on the reasoning
        //that a territory has to be readable to be clicked -- and Leigh overruled it: *"if
        //there is a rule to leave the physical map on click then get rid of it, that is not
        //desired behaviour"*. A view is a mode the player chose, and nothing but the view
        //button should take it away from them. (What stood here also looped over all 359
        //territories to recolour the first non-player one it found and then broke out
        //unconditionally, so it recoloured exactly one arbitrary province: it went with the
        //rule rather than being preserved.)
        if (!isDragging()) {
            if (e.target.tagName === "rect" && currentPhase() === Phase.MOVE_ATTACK) {
                repaintMap();
                toggleTransferAttackButton(false, false);
                clearAttackTarget();
                transferAttackButtonDisplayed = false;
                attackTextCurrentlyDisplayed = false;
            }
            if (e.target.tagName === "path") {
                currentPath = e.target;
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
                    if (currentPhase() === Phase.MOVE_ATTACK) {
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
                } else {
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
        updateTerritoryTooltip(e);
        panMap(e);
    });

    svgMap.addEventListener('mouseup', function(e) {
        endDrag(e);
        if (!isDragging()) {
            shiftPath(shiftedPath, -2, -2);
            modifyFill(shiftedPath, false);
        }
    });

    //THE SKY IS ON BY DEFAULT, and it is APPLIED here rather than merely declared -- the same
    //rule the opening map view follows. Declaring it would leave the button saying "full" over
    //a map with no weather on it.
    setCloudMode(CLOUD_MODES.FULL);
    updateCloudOverlayButton();

    assignStartingColours(paths, pathCountry);
    //APPLIED rather than merely declared: the SVG ships with plain sea-coloured strokes, so a
    //game that only set the variable would show the button in one state and the map in another.
    resetMapView();

    markBootstrapStage("map");

    console.log("loaded!");
}


function selectCountry(country, escKeyEntry) {
    if (!pathIsGreyedOut(country)) {
        if (!pathIsUnderSiege(country)) {
            const deactivatedPaths = paths.filter(path => pathIsDeactivated(path));

            if (deactivatedPaths.length > 0) {
                const lowestIndex = paths.indexOf(deactivatedPaths[0]);
                svgMap.documentElement.insertBefore(country, paths[lowestIndex]);
            } else {
                svgMap.documentElement.appendChild(country);
            }
        } else {
            const siegedPaths = paths.filter(path => pathIsUnderSiege(path));

            if (siegedPaths.length > 0) {
                const lowestIndex = paths.indexOf(siegedPaths[0]);
                svgMap.documentElement.insertBefore(country, paths[lowestIndex]);
            } else {
                svgMap.documentElement.appendChild(country);
            }
        }

        if (selectCountryPlayerState && !escKeyEntry) {
            for (let i = 0; i < paths.length; i++) {
                if (pathCountry(paths[i]) === pathCountry(country)) {
                    if (pathCountry(country) !== pathCountry(lastClickedPath)) {
                        paths[i].setAttribute('fill', playerColour());
                    }
                }
            }
        } else if (!selectCountryPlayerState && !escKeyEntry) {
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

        if (lastClickedPath.hasAttribute("fill") && !escKeyEntry) {
            for (let i = 0; i < paths.length; i++) {
                if ((paths[i].getAttribute("uniqueid") === lastClickedPath.getAttribute("uniqueid")) && pathIsPlayerOwned(paths[i]) && !pathIsDeactivated(country)) { //set the iterating path to the player color when clicking on any path and the iterating path is a player territory
                    paths[i].setAttribute('fill', playerColour());
                } else if (!selectCountryPlayerState && (paths[i].getAttribute("uniqueid") === lastClickedPath.getAttribute("uniqueid")) && !pathIsPlayerOwned(paths[i]) && currentPath !== lastClickedPath) { //set the iterating path to the continent color when it is the last clicked path and the user is not hovering over the last clicked path
                    //ONE BRANCH, NOT TWO. These were two identical loops that differed only
                    //in the relief map's leaving first; with that rule gone they are the same
                    //code. The colour written here is invisible on the relief anyway -- a
                    //territory's fill sits at 1% opacity there -- so there is nothing to
                    //special-case.
                    for (let j = 0; j < allTerritories().length; j++) {
                        if (allTerritories()[j].uniqueId === paths[i].getAttribute("uniqueid")) {
                            setColorOnMap(allTerritories()[j]);
                            break;
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
        lastClickedPath = country;
        refreshBottomBarActionable();

        if (selectCountryPlayerState && !escKeyEntry) {
            countrySelect.nameCountry(pathCountry(country), { locked: pathIsGreyedOut(country) });
        }

        clickActionsDone = true;
    }
    window.focus();
}

document.addEventListener("DOMContentLoaded", function() {
    initTheme();
    initAudio();
    installAudioTestHooks({
        audio: () => audioSettings(),
        setAudio: (settings) => applyAudioSettings(settings),
        audioTracks: () => trackList(),
        currentTrack: () => currentTrackName(),
        musicPlaying: () => isMusicPlaying(),
    });

    installBottomBarActivation();

    tooltip.create();
    confirmDialog.create();
    saveIndicator.create();
    dominapedia.create({ onSound: () => playSoundClip("button") });
    //THE ENDING. A second subscriber to GAME_OVER and no change to the rule -- which is the
    //whole reason the ending is an event. Before this, `checkForVictory()` decided the game
    //correctly, `endTurn()` emitted it exactly once, and the only listener was a
    //`console.log`: a player who had just won a fifty-turn game was left sitting on a map.
    gameOver.create({
        onSound: () => playSoundClip("button"),
        onNewGame: () => void startNewGame(),
        onMainMenu: () => returnToMainMenuFromGoalSelect()
    });
    //The standings are read HERE, at the ending, and handed over as a snapshot. The panel can
    //outlive the store it describes -- New Game restores a pristine world underneath it -- so
    //a table that called `worldStandings()` when it drew would put the new world's figures
    //under the old game's headline.
    onStateEvent(Events.GAME_OVER, (result) => {
        //Nothing is dismissed first, deliberately. A game is decided in `endTurn()`, which can
        //be the same tick the AI's last battle put a results screen up in -- and
        //`.options-scrim` sits at z-index 10000, above every floating window and above the
        //battle UI, so the ending covers whatever is there rather than racing it. Reaching
        //into the battle's own state to tear it down would be the alternative, and
        //`battle.js` holds its resolution in module-level variables that the results screen is
        //the only consumer of.
        gameOver.show(result, {
            standings: worldStandings(),
            playerCountry: isAiGameActive() ? null : playerCountryName()
        });
    });

    goalSelect.create({
        onSound: () => playSoundClip("button"),
        onConfirm(condition) {
            setVictoryCondition(condition);
            beginCountrySelection();
        },
        onBack() {
            returnToMainMenuFromGoalSelect();
        }
    });
    saveLoadPanel.create({
        captureSave() {
            const save = captureGame();
            return save ? encodeSave(save) : null;
        },
        applySave: loadGameFromCode,
        isGameInProgress: () => outsideOfMenuAndMapVisible,
    });
    audioPanel.create({ onSound: () => playSoundClip("button") });
    activityPanel.create({ onSound: () => playSoundClip("switch") });
    diplomacyPanel.create({
        onSound: () => playSoundClip("switch"),
        onDeclareWar: declareWarOnCountry,
        onPropose: proposeToCountry
    });
    aiDebugPanel.create();
    aiGameConsole.create({ onSound: () => playSoundClip("button") });
    debugPlanPanel.create({ onSound: () => playSoundClip("button") });

    // THE TWO SPECTATOR-ONLY BUTTONS. They live in their own container rather than
    // alongside the info-panel globe, because the left-hand column belongs to a PLAYED
    // game -- `toggleUIButton(false)` hides both of its buttons in this mode, and a debug
    // control that shared a container with them would be shown and hidden by the wrong
    // switch. `applySpectatorChrome()` is the only thing that reveals this one.
    //
    // The labels are letters rather than icons on purpose: an icon has to be learned and
    // these two are read once, by one person, while something else is being watched.
    mount(
        ids.aiGameButtonsContainer,
        el(
            "button",
            {
                id: ids.aiGameOpenBtn,
                class: "chrome-button debug-chrome-button",
                attrs: {
                    type: "button",
                    "aria-label": "AI game console",
                    title: "Show or hide the AI game console",
                },
                on: {
                    click() {
                        playSoundClip("switch");
                        aiGameConsole.isOpen() ? aiGameConsole.close() : aiGameConsole.open();
                    },
                },
            },
            //A JOYSTICK, because this one is the game CONTROLS -- pace, pause, and the log
            //of what each country did -- and it is reached for repeatedly. The plan injector
            //beside it keeps a letter on purpose: that window is opened once, deliberately,
            //and a letter cannot be mistaken for a thing the game does on its own.
            joystickIcon()
        ),
        el(
            "button",
            {
                id: ids.debugPlanOpenBtn,
                class: "chrome-button debug-chrome-button",
                text: "D",
                attrs: {
                    type: "button",
                    "aria-label": "Injected plans",
                    title: "Inject a plan into a country",
                },
                on: {
                    click() {
                        playSoundClip("switch");
                        debugPlanPanel.toggle();
                    },
                },
            }
        )
    );

    aiGameGoalBar.create({
        onSound: () => playSoundClip("button"),
        //FINISH lives on the goal bar rather than in the console, because the console can be
        //closed and the goal bar is up for as long as the mode is -- see `AiGameGoalBar.js`.
        onFinish: () => void endAiGame(),
        readWorld() {
            const condition = activeVictoryCondition();
            const standings = worldStandings();
            const turn = currentTurn();
            const front = closestToVictory(condition, standings, turn);
            return {
                condition,
                leader: front?.country ?? null,
                leaderProgress: front
                    ? describeLeaderProgress(condition, {
                        label: front.progress.label,
                        territories: standings.byCountry.get(front.country)?.territories ?? 0,
                        turn
                    })
                    : ""
            };
        }
    });

    document.addEventListener("pointerdown", () => void resumePendingMusic(), { capture: true });

    menuButton.create({
        onOpen() {
            playSoundClip("switch");
            openInGameMenu();
        },
    });

    mainMenu.create({
        async onNewGame() {
            playSoundClip("button");
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
    const popupWithConfirmContainer = phaseBar.create({
        onSound: () => playSoundClip("switch"),
        onColourLabelClick() {
            playSoundClip("switch");
            countrySelect.togglePicker();
        },
    });
    const popupConfirm = phaseBar.buttonElement();

    mount(
        ids.mapModeContainer,
        el(
            "button",
            {
                id: ids.continentViewButton,
                class: "chrome-button continent-view-button",
                attrs: { type: "button", "aria-label": "Map view" },
                on: {
                    click() {
                        playSoundClip("switch");
                        cycleMapView();
                    },
                },
            },
            //Four views, four icons, one shown at a time by `data-view` in the stylesheet. The
            //swords are the same drawing the Wars tab and the activity feed use for a battle,
            //deliberately: one picture, one meaning, wherever it appears.
            [mapSheetIcon(), mountainIcon(), continentIcon(), crossedSwordsIcon()]
        )
    );

    //THE FLAG OVERLAY IS A TOGGLE AND NOT A FIFTH VIEW, which is why it is a second button in
    //this column rather than another stop on the one above. It is a label -- whose territory
    //is this -- and it composes with whichever view is up rather than replacing one, so a
    //player can read the continent bands or the force ramp AND see who holds what. Being a
    //toggle it has to say whether it is on, which `aria-pressed` does for the stylesheet and
    //for anything driving it.
    mount(
        ids.mapModeContainer,
        el(
            "button",
            {
                id: ids.flagOverlayButton,
                class: "chrome-button flag-overlay-button",
                attrs: {
                    type: "button",
                    "aria-label": "Owner flags",
                    "aria-pressed": "false",
                    title: "Show the flag of each territory's current owner"
                },
                on: {
                    click() {
                        playSoundClip("switch");
                        toggleFlagOverlay();
                    },
                },
            },
            [flagIcon()]
        )
    );

    //THE WEATHER, and it is a THREE-state control rather than a switch: full, half strength,
    //off. Leigh's call, and half strength is the interesting one -- clouds look best over an
    //ocean and read as clutter over a continent you are trying to plan a war across, so the
    //middle setting is what lets somebody keep the sky without giving up the map. It defaults
    //to full, so a new player sees the game at its best rather than at its plainest.
    mount(
        ids.mapModeContainer,
        el(
            "button",
            {
                id: ids.cloudOverlayButton,
                class: "chrome-button cloud-overlay-button",
                attrs: { type: "button", "aria-label": "Clouds" },
                on: {
                    click() {
                        playSoundClip("switch");
                        cycleCloudMode();
                        updateCloudOverlayButton();
                    },
                },
            },
            [cloudIcon()]
        )
    );
    updateCloudOverlayButton();
    //The button and the key both follow the view rather than being written at every call site
    //that changes it. One subscription, installed once, from bootstrap.
    mapLegend.create();
    onMapViewChanged(view => {
        updateMapViewButton(view);
        mapLegend.setViewActive(view === MAP_VIEWS.MILITARY);
        //Entering or leaving the military view changes WHICH territories may carry a flag --
        //that view draws a garrison on the frontier and the flags defer to it -- so the
        //overlay is redrawn on the transition rather than waiting for the next world event.
        refreshFlagOverlay(paths);
    });
    updateMapViewButton(MAP_VIEWS.CONTINENT);

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
            if (isPhysicalMapActive()) {
                exitPhysicalMap();
            }
            setPlayerColour(convertHexValueToRGBOrViceVersa(countrySelect.colour(), 0));

            if (selectCountryPlayerState) {
                repaintCountrySelection(
                    pathIsGreyedOut(lastClickedPath) ? null : pathCountry(lastClickedPath)
                );
            } else if (countrySelectedAndGameStarted) {
                repaintMap();
            }
        },
    });

    popupConfirm.addEventListener("click", async function() {
        playSoundClip("switch");
        if (selectCountryPlayerState) {
            document.getElementById(ids.popupColor).style.display = "none";
            countrySelect.closePicker();
            setAllGreyedOutAttributesToFalseOnGameStart();
            selectCountryPlayerState = false;
            countrySelectedAndGameStarted = true;
            phaseBar.dimBody();
            setPlayerCountry(phaseBar.bodyText());
            setPlayerFlag(playerCountryName());
            setFlag(playerCountryName(), 1);
            setFlag(playerCountryName(), 3);
            repaintCountrySelection(playerCountryName());
            phaseBar.setMode(phaseBar.Mode.INITIALISING);
            pushColorsToMainArray();
            updateArrayOfLeadersAndCountries();
            //The CPU leaders and the starting forts are created INSIDE `initialiseGame()`
            //now, before the turn engine starts -- see the note at the call site. They are
            //handed over as a callback rather than moved, because both read the player's
            //ownership and that is assigned inside `initialiseGame()`.
            await initialiseGame({
                worldSetup() {
                    createCpuPlayerObjectAndAddToMainArray();
                    addRandomFortsToAllNonPlayerTerritories();
                }
            });
            topTable.setHeading("Total Player Resources:");
            document.getElementById(ids.popupColor).style.display = "block";
            document.getElementById(ids.popupWithConfirmContainer).style.display = "block";
            uiButtonCurrentlyOnScreen = true;
            toggleUIButton(true);
            mapModeButtonCurrentlyOnScreen = true;
            toggleMapModeButton(true);
            phaseBar.setMode(phaseBar.Mode.PLAYING);
            setPhase(Phase.BUY_UPGRADE);
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
    topTable.create({
        playerCountryName,
        capacities: () => capacityArray,
        demands: () => demandArray,
        formatNumber: formatNumbersToKMB,
        //The top bar is the player's whole empire, so its flag opens the empire's
        //panel -- the same view, on the same tab, as the globe button in the map
        //chrome. It is deliberately a second door onto one window rather than a
        //second window: `toggleUIMenu()` owns what else has to move out of the way
        //when the panel opens, and a shortcut that skipped it would leave the map
        //and the move-phase buttons still taking clicks underneath it.
        onFlagActivate() {
            if (uiCurrentlyOnScreen) {
                return;
            }
            playSoundClip("switch");
            toggleUIMenu(true);
            infoTable.setActiveTab("summary");
        },
    });

    aiDialogue.create({ onResponse: setAiResponseFlag });

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

    const transferAttackButton = moveButton.create();
    installMoveButtonHandlers();

    attackPreview.create();
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

    battleUI.create();
    //THE X SETTLES THE DICE TOO. Closing the commentary while the dice are still tumbling
    //would otherwise leave the table rolling with nothing left on screen explaining it, and
    //the roll is capped at over two seconds. `ClashPanel.js` cannot reach the dice stage
    //itself -- it draws and owns no state beyond its own timers -- so the one thing it needs
    //from outside is injected, the arrangement every other pure module here has.
    clashPanel.create({ onClose: () => diceStage.skip() });

    document.getElementById(ids.battleContainer)?.addEventListener("click", function() {
        diceStage.skip();
        clashPanel.finish();
    }, true);

    //THE SAME CLICK, ONE LAYER HIGHER. The clash panel is modal now, so the capture listener
    //above never sees a click while it is up -- and that listener is how a player skips a
    //roll they do not want to watch. The scrim runs the same pair, and then takes the panel
    //down on a second press: read it at your own pace, or click twice and move on. Without
    //the second half, making the panel modal would have replaced a panel you could click
    //through with a seven-second wait you could not shorten.
    document.getElementById(ids.battleClashScrim)?.addEventListener("click", function() {
        diceStage.skip();
        if (clashPanel.isPlaying()) {
            clashPanel.finish();
        } else {
            clashPanel.hide();
        }
    });

    battleResults.create();
    battleWindow.create({
        siege: function() {

        let currentWarAlreadyInSiegeMode = false;
        let currentWarId = getCurrentWarId();

        for (let territoryName in playerSiegeWarsList) {
            if (aiSiegeWarsList.hasOwnProperty(territoryName)) {
                currentWarAlreadyInSiegeMode = true;
                break;
            }
        }

        toggleBattleUI(false, true);
        battleUIDisplayed = false;
        toggleUIButton(true);
        uiButtonCurrentlyOnScreen = true;
        toggleMapModeButton(true);
        mapModeButtonCurrentlyOnScreen = true;
        toggleBottomLeftPaneWithTurnAdvance(true);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;

        if (!currentWarAlreadyInSiegeMode) {
            let territoryToAddToSiege = addRemoveWarSiegeObject(0, currentWarId, battleStart);
            let mainArrayElementForSiege = applySiegeSurvivorsToTerritory(getSiegeObjectFromPlayerSiegeList(territoryToAddToSiege));
            writeBottomTableInformation(mainArrayElementForSiege, true, null);
            clearAttackTarget();

        }
        closeBattle();
        },

        retreat: function(mode) {

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
        switch (mode) {
            case RetreatMode.FREE:
                defeatType = "retreat";
                setNewWarOnRetrievalArray(currentWarId, warArrayToRetrieveLater, currentTurn(), 1);
                if (!battleStart) {
                    proportionsOfAttackArray.length = 0;
                    setTerritoryArmy(defendingTerritoryRetreatClick.uniqueId, defendingArmyRemaining);

                } else {
                    addWarToHistoricWarArray("Retreat", 0, true);
                }

                if (battleUIState === 1) { 
                    let war = getSiegeObjectFromPath(attackTargetPath());
                    if (war) { 
                        addRemoveWarSiegeObject(1, war.warId); 
                        removeSiegeImageFromPath(attackTargetPath());
                    }
                }
                bottomTable.update({ army: formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory, 0) });
                break;
            case RetreatMode.SCATTER:
                defeatType = "scatter";
                for (let i = 0; i < attackingArmyRemaining.length; i++) {
                    attackingArmyRemaining[i] = Math.floor(attackingArmyRemaining[i] * multiplierForScatterLoss);
                }
                setNewWarOnRetrievalArray(currentWarId, warArrayToRetrieveLater, currentTurn(), 2);
                proportionsOfAttackArray.length = 0;
                setTerritoryArmy(defendingTerritoryRetreatClick.uniqueId, defendingArmyRemaining);

                bottomTable.update({ army: formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory, 0) });
                break;
            case RetreatMode.DEFEAT:
                defeatType = "defeat";
                if (defeatTypeFromBattle() === "routed") {
                    setTerritoryArmy(defendingTerritoryRetreatClick.uniqueId, [
                        defendingArmyRemaining[0] + Math.floor(attackingArmyRemaining[0] * battleOutcomeEffects.routCaptureShare),
                        defendingArmyRemaining[1] + Math.floor(attackingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare),
                        defendingArmyRemaining[2] + Math.floor(attackingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare),
                        defendingArmyRemaining[3] + Math.floor(attackingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare)
                    ]);
                } else {
                    setTerritoryArmy(defendingTerritoryRetreatClick.uniqueId, defendingArmyRemaining);
                }
                bottomTable.update({ army: formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory, 0) });
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
        populateWarResultPopup(1, attackCountry, defendTerritory, defeatType, false);
        addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
        closeBattle();
        },

        digIn: function(armed) {
            playSoundClip("button");
            digInNextRound = armed;
        },

        reserves: function() {
            return commitReserves();
        },

        advance: function(mode) {

        let currentRound = getCurrentRound();
        switch (mode) {
            case AdvanceMode.BEGIN:
                toggleDiceCanvas(true);
                playSoundClip("button");
                battleStart = false;
                let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());
                setCurrentRound(currentRound + 1);
                if (hasSiegedBefore) {
                    let war = historicWars.find((siege) => siege.warId === getCurrentWarId());
                    let siegeAttackArray = [];
                    siegeAttackArray.push(attackTargetPath().getAttribute("uniqueid"));
                    siegeAttackArray.push(war.proportionsAttackers[0][0]);
                    for (let i = 0; i < war.attackingArmyRemaining.length; i++) {
                        siegeAttackArray.push(war.attackingArmyRemaining[i]);
                    }
                    setFinalAttackArray(siegeAttackArray);
                    setupBattle(probability, getFinalAttackArray(), allTerritories());
                }
                battleWindow.setBattleButtons({
                    advance: AdvanceMode.ROUND,
                    retreat: RetreatMode.SCATTER,
                    siegeEnabled: false
                });
                roundCounterForStats++;
                break;
            case AdvanceMode.ROUND:
                playSoundClip("button");
                battleWindow.setBattleButtons({
                    advance: AdvanceMode.ROUND,
                    retreat: RetreatMode.SCATTER
                });
                processRound({ attackerDigsIn: digInNextRound });
                digInNextRound = false;
                battleWindow.setBattleButtons({
                    digInArmed: false,
                    midBattleControls: true,
                    reserves: pendingReserves().length === 0
                        ? ReservesState.READY : battleWindow.battleButtons().reserves
                });

                roundLog.update(currentBattle()?.records ?? []);
                break;
            case AdvanceMode.ACCEPT:
                toggleDiceCanvas(false);
                playSoundClip("button");
                addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
                toggleBattleUI(false, false);
                battleUIDisplayed = false;
                toggleBattleResults(true);
                battleResultsDisplayed = true;
                populateWarResultPopup(0, attackCountry, defendTerritory, "victory", false);
                closeBattle();
                break;
            case AdvanceMode.SIEGE:
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
        },

        lastPush: function() {
            playSoundClip("button");
            takeLastPush();
        },

        assault: function() {

        let war = getSiegeObjectFromPath(attackTargetPath());
        setColorsOfDefendingTerritoriesSiegeStats(lastClickedPath, 1);
        setArmyTextValues(war, 3, attackTargetPath().getAttribute("uniqueid"));
        setCurrentWarId(war.warId);
        addRemoveWarSiegeObject(1, war.warId);
        removeSiegeImageFromPath(attackTargetPath());
        battleWindow.setBattleButtons({ siegeEnabled: false });
        let siegeAttackArray = [];
        siegeAttackArray.push(attackTargetPath().getAttribute("uniqueid"));
        siegeAttackArray.push(war.proportionsAttackers[war.warId][0]);
        for (let i = 0; i < war.attackingArmyRemaining.length; i++) {
            siegeAttackArray.push(war.attackingArmyRemaining[i]);
        }

        setupBattleUI(siegeAttackArray);
        },

        skip: function() {
            defenderPlayback.skip(defencePlaybackDeps());
        }
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

    const matchingPaths = Array.from(paths).filter(
        (path) =>
            pathCountry(path) === pathCountry(targetPath) &&
            path.getAttribute("territory-id") !== targetPath.getAttribute("territory-id")
    );
    resultsPaths.push(...matchingPaths.map((path) => [path, getPoints(path), getMinimumDistance(path)]));

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

    centerBboxCoords.x = pathBBoxCoords.width / 2 + pathBBoxCoords.x;
    centerBboxCoords.y = pathBBoxCoords.height / 2 + pathBBoxCoords.y;

    bBoxArray.push([path.getAttribute("uniqueid"), centerBboxCoords.x, centerBboxCoords.y]);
    return bBoxArray;
}

function manualExceptionPaths(targetPath, direction) {
    const territoryName = targetPath.getAttribute("territory-name");
    const names = direction === "add"
        ? getManualAdditions(territoryName)
        : getManualDenials(territoryName);
    return names.map(name => getPathByName(name)).filter(path => path !== null);
}

function highlightInteractableCountriesAfterSelectingOne(targetPath, destCoordsArray, destinationPathObjectArray, distances, attacking) {
    //Before the guard, and before either branch. The arrows belong to ONE selected
    //source, so whatever was drawn for the last selection is wrong the moment this
    //runs -- including when the new selection is an enemy territory, which takes the
    //`attacking` branch and draws no arrows of its own, and when it is a deactivated
    //one, which returns below and draws nothing at all.
    clearAttackArrows();

    if (pathIsDeactivated(targetPath)) {
        return;
    }
    let manualExceptionsArray = [];
    let manualDenialArray = [];
    let tempValidDestinationsArray = [];

    defs = svgMap.querySelector('defs');
    patterns = defs.querySelectorAll('pattern');

    for (let i = 0; i < patterns.length; i++) { 
        defs.removeChild(patterns[i]);
    }

    if (destCoordsArray.length < 1) {
        throw new Error("Array must contain at least 1 element");
    }

    let count = 0;

    manualExceptionsArray = manualExceptionPaths(targetPath, "add");
    manualDenialArray = manualExceptionPaths(targetPath, "deny");

    destinationPathObjectArray = removeDeniedDestinations(destinationPathObjectArray, manualDenialArray);

    if (manualExceptionsArray.length > 0) {
        for (let i = 0; i < manualExceptionsArray.length; i++) {
            tempValidDestinationsArray.push(changeCountryColor(manualExceptionsArray[i], false, "pattern", count, attacking)[0]);
            count++;
        }
    }

    for (let i = 0; i < destinationPathObjectArray.length; i++) {
        const targetName = pathCountry(targetPath);
        const destName = pathCountry(destinationPathObjectArray[i]);

        if (distances[i] < 1 && targetPath !== destinationPathObjectArray[i]) {
            tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]);
            count++;
        } else if (targetName === destName && targetPath !== destinationPathObjectArray[i]) {
            tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]);
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
                    tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]);
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

        //The hatching covers every valid destination, which includes the player's own
        //neighbours -- those are a TRANSFER, not an attack. The arrows are about the
        //attack, so they are drawn only to the enemy territories in the set, and not
        //to one still inside its post-conquest lockout, which cannot be attacked at
        //all.
        //
        //AND NOT TO A COUNTRY THE PLAYER IS NOT AT WAR WITH. The hatching stays on those,
        //deliberately: the hatch means REACHABLE and they are, which is the fact the player
        //needs in order to understand why a border is worth a declaration. An arrow means
        //*you can attack here*, so drawing one at a neutral neighbour would be a promise
        //the move button then refuses.
        showAttackArrows(
            targetPath,
            validDestinationsArray.filter(
                destination => !pathIsPlayerOwned(destination) &&
                    !pathIsDeactivated(destination) &&
                    playerAttackPermission(destination).mayAttack
            )
        );
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
    let tempAttackingDestinationArray = [];

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

    if (newRgbValue.startsWith("pattern")) {
        const fillColor = pathObj.getAttribute('fill');

        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute("id", dynamicIds.diagonalLines(count));
        pattern.setAttribute('width', '20');
        pattern.setAttribute('height', '20');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('patternTransform', 'rotate(135)');

        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', '0');
        line1.setAttribute('y1', '5');
        line1.setAttribute('x2', '20');
        line1.setAttribute('y2', '5');
        line1.setAttribute('stroke-width', '10');
        line1.setAttribute('stroke', fillColor);
        pattern.appendChild(line1);

        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', '0');
        line2.setAttribute('y1', '15');
        line2.setAttribute('x2', '20');
        line2.setAttribute('y2', '15');
        line2.setAttribute('stroke-width', '10');
        line2.setAttribute('stroke', playerColour());
        pattern.appendChild(line2);

        defs.appendChild(pattern);

        if (!attacking) {
            pathObj.setAttribute('fill', 'url(#' + pattern.getAttribute("id") + ')');
        } else {
            tempAttackingDestinationArray.push(pathObj);
        }
    } else {
        pathObj.setAttribute("fill", newRgbValue);
    }

    currentlySelectedColorsArray.push([pathObj, originalColor, isManualException]);

    let lastElem = currentlySelectedColorsArray[currentlySelectedColorsArray.length - 1][1];
    if (!newRgbValue.startsWith("url")) {
        newRgbValue = "rgb(" + newRgbValue + ")";
        if (lastElem === newRgbValue) {
            currentlySelectedColorsArray.pop();
        }
    }

    return tempAttackingDestinationArray;
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
        if (!isPhysicalMapActive()) { //normal map
            rgbValues = fillValue.match(/\d+/g).map(Number);
            [r, g, b] = rgbValues;
        }
        if (mouseAction === "mouseOver" && ((r <= 254 && g <= 254 && b <= 254 && !isPhysicalMapActive()) || isPhysicalMapActive())) { //this handles color change when hovering (doesn't run on selected or interactable territories)
            if (!isPhysicalMapActive()) {
                hoveredNonInteractableAndNonSelectedTerritory = true;
                r += 20;
                g += 20;
                b += 20;
                territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
            } else if (isPhysicalMapActive() && !pathIsPlayerOwned(territory)) {
                [r, g, b] = [255, 255, 255];
                territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
                territory.setAttribute("fill-opacity", "0.3");
            }
        } else if (mouseAction === "mouseOut" && ((r <= 254 && g <= 254 && b <= 254 && !isPhysicalMapActive()) || isPhysicalMapActive())) { //this handles color change when leaving a hover (doesn't run on selected or interactable territories)
            if (!isPhysicalMapActive()) {
                hoveredNonInteractableAndNonSelectedTerritory = false;
                r -= 20;
                g -= 20;
                b -= 20;
                if (selectCountryPlayerState && territory === currentSelectedPath) {
                    territory.setAttribute("fill", playerColour());
                } else {
                    territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
                }
            } else if (isPhysicalMapActive() && !pathIsPlayerOwned(territory)) {
                territory.setAttribute("fill-opacity", "0.01");
            }
        } else if (mouseAction === "clickCountry") { //this returns colors back to their original state after deselecting by selecting another, either white if interactable by both the previous and new selected areas, or back to owner color if not accessible by new selected area
            //The relief map is NOT left here either -- see the note in the map's click handler.
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

function setStrokeWidth(path, stroke) {
    //The argument is SCREEN PIXELS now, not user units, and every existing call site already
    //meant it that way -- "1" was a hairline and "3" a highlight, and both were only right at
    //zoom 1. `setPathStrokePx()` remembers the figure so that a zoom re-applies it.
    setPathStrokePx(path, stroke);
}

export function enableNewGameButton() {
    mainMenu.setNewGameEnabled(true);
    offerStoredAutosave();
}

export function strongestCountries(count = COUNTRY_GREYOUT_RANK) {
    return [...countryStrengthsArray]
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(entry => entry[0]);
}

function greyOutTerritoriesForUnselectableCountries() {
    const unselectableCountries = new Set(strongestCountries());
    setGreyedOutCountries(unselectableCountries);
    paintLockedCountries();
}

function setAllGreyedOutAttributesToFalseOnGameStart() {
    clearGreyedOutCountries();
}


/**
 * Whether the player may attack this territory, and how to say so if not.
 *
 * The register is keyed by COUNTRY, and a country is `dataName` -- the current owner, which
 * changes on conquest. `pathOwner()` is not it: that answers "Player" on the player's own
 * land, and the tooltip's first version was wrong in exactly this way.
 *
 * Spectator mode has no player, so there is nobody to be at war; the permission is granted
 * rather than refused, because a debug mode that froze the world it exists to watch would be
 * useless.
 */
function playerAttackPermission(path) {
    const player = playerCountryName();
    const owner = pathCountry(path);
    if (!player || !owner || owner === player) {
        return { mayAttack: true, relationLabel: null };
    }
    const state = relationStateBetween(player, owner);
    return {
        mayAttack: allowsAttack(state),
        //WHETHER THE PLAYER MAY DECLARE, which is a different question from whether they may
        //attack and is asked here so that `deriveMoveButtonState()` stays a pure function of
        //the selection. No contact is the one state war cannot be declared out of, and the
        //contact walk is coalesced -- so a border that opened during the AI's turn can
        //genuinely read that way for a moment, and the button greys rather than offering a
        //control that would be refused.
        mayDeclare: allowsDeclaration(state),
        relationLabel: describeState(state),
        relationCountry: owner
    };
}

/**
 * Offer a country a ceasefire or a peace, and get its answer.
 *
 * Diplomacy stage 5.1, and the player's half of the only rules in this phase that can END a
 * war. It goes through `answerProposal()` in `aiCalculations.js`, which is the SAME door an
 * AI's offer to another AI goes through -- the rule `countriesMayFight()` established for the
 * attack gates, and for the same reason: two paths answering the same question separately
 * will eventually answer it differently, and here that would be a player told no by a
 * calculation the world never made.
 *
 * THE ANSWER COMES BACK AT ONCE, and is returned rather than shown. There is no waiting
 * period anywhere in this system, and the panel is where the player is looking -- so it puts
 * the sentence under the button that was pressed rather than raising a dialog over the one
 * screen built for this.
 *
 * @returns {{accepted: boolean, reason: string}} always, so the panel can report a refusal
 *          it was given as readily as one it worked out for itself
 */
function proposeToCountry(country, kind) {
    const player = playerCountryName();
    if (!player || !country || country === player) {
        return { accepted: false, reason: "there is nobody to make an agreement with" };
    }

    const turn = currentTurn();

    //MUTUAL DISSOLUTION is an offer like any other -- the other side may simply prefer the
    //alliance -- but it is not a `ProposalKind`, because it does not put the pair into a new
    //agreement; it takes one away. So it takes its own door rather than a fourth entry in a
    //table whose every other row names a state to move to.
    if (kind === "dissolve") {
        const willing = answerDissolution(country, turn);
        if (willing.accepted) {
            dissolveAlliance(player, country, turn);
        }
        return willing;
    }

    const answer = answerProposal({ country, proposer: player, kind, turn });
    if (answer.accepted) {
        //The WRITE is `acceptProposal()` and not a bare `setRelationState()`: a ceasefire
        //carries the turn it runs out on AND what it falls back to then, and a caller that
        //set the state by hand would sign an agreement that never expires or one that
        //expires into the wrong world. One door, both fields.
        acceptProposal(player, country, kind, turn);
    }
    return answer;
}

/**
 * The player asks an ally to end the alliance by agreement.
 *
 * IT IS ALMOST ALWAYS ACCEPTED, and that is the design rather than a shortcut. §3.4's whole
 * force is that there are exactly two penalty-free ways out of an alliance and this is one of
 * them: *"either side may propose ending the alliance; if the other accepts it ends free for
 * both."* An AI that haggled over being let go would turn the honest route into a gamble, and
 * the moment it is a gamble the breach becomes the reliable option -- which is precisely the
 * incentive stage 5.6's penalty exists to remove.
 *
 * What it is NOT is automatic: a country that has just answered this ally's call to arms is
 * in a war on their account, and walking away from that in the same breath is the thing the
 * call-in rule already refuses.
 */
function answerDissolution(country, turn) {
    const player = playerCountryName();
    if (relationStateBetween(player, country) !== DiplomaticState.ALLIANCE) {
        return { accepted: false, reason: "there is no alliance to end" };
    }
    if (isBoundJoiner(country, player) || isBoundJoiner(player, country)) {
        return {
            accepted: false,
            reason: "one of you answered the other's call to arms and is fighting on their " +
                "account -- that war has to end first"
        };
    }
    return {
        accepted: true,
        reason: "the alliance ends by agreement, with nothing owed either way"
    };
}

/**
 * Declare war on a country, asking first when doing so breaks an agreement.
 *
 * Diplomacy stage 3.2 and stage 4. THE TWO SURFACES GO THROUGH HERE -- the DECLARE WAR
 * button on the map and the diplomacy panel's action both call this, which is the same
 * rule `openUpgradeWindowFor()` records: an entry point that did half of it would be a
 * declaration the register recorded and the map never repainted, or a confirmation one
 * route asked for and the other did not.
 *
 * The confirmation is `declarationPromptFor()`, which returns NULL out of neutral -- nothing
 * was promised, so nothing is asked, and a dialog in front of every declaration would be a
 * click-through inside three turns.
 *
 * @returns {Promise<boolean>} whether war was actually declared
 */
async function declareWarOnCountry(country) {
    const player = playerCountryName();
    if (!player || !country || country === player) {
        return false;
    }
    const record = relationBetween(player, country);
    const state = record?.state ?? DiplomaticState.NO_CONTACT;
    if (!allowsDeclaration(state)) {
        return false;
    }

    const prompt = declarationPromptFor({
        country,
        state,
        since: record?.since ?? null,
        turn: currentTurn()
    });
    if (prompt && !(await confirmDialog.open(prompt))) {
        return false;
    }

    const turn = currentTurn();
    //CHARGED BEFORE THE WRITE: the state being paid for is the one about to be replaced. The
    //player goes through the same door the AI does, because a penalty the game applies to one
    //side of itself is not a rule.
    applyBreach(player, country, turn);
    setRelationState(player, country, DiplomaticState.WAR, {
        since: turn, by: player, via: "declared"
    });

    //THE CALL TO ARMS. Both sides' allies are asked -- Q3, answered by Leigh: an ally is
    //called in on defence as well as on aggression. The player's own allies are AI, so they
    //answer here and now; an ally that says no ends the alliance, free for both, which is the
    //cost the player carries for a war their partner would not fight.
    const answers = resolveCallIns(player, country, turn);
    for (const answer of answers) {
        if (answer.joins === null) {
            continue;
        }
        recordCallInNews(answer);
    }
    return true;
}

/**
 * Say out loud what an ally decided, because the map will not.
 *
 * A call-in changes the register and nothing on the board: an ally joining a war is a fact
 * about two other countries, and an alliance quietly ending is a control disappearing from a
 * panel the player may not have open.
 *
 * STAGE 6 GAVE IT A HOME AND THIS IS NOW THE ECHO RATHER THAN THE RECORD. Both outcomes go
 * through `setRelationState()` inside `applyCallInAnswer()`, so `activityRecorder.js` has
 * already written the news by the time this runs -- an ally joining is a DECLARATION entry
 * with `via: "calledIn"`, and one refusing is an ALLIANCE entry with `via: "declinedCall"`.
 * What is left here is the console line, which is worth keeping for the same reason the AI's
 * plan log is: the feed is the player's news and the console is the diagnostic.
 */
function recordCallInNews(answer) {
    console.log(answer.joins
        ? answer.ally + " answers your call and enters the war with " + answer.adversary
        : answer.ally + " refuses your call to arms -- the alliance has ended");
}

function handleMovePhaseTransferAttackButton(path, lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, territoryComingFrom, xButtonClicked, xButtonFromWhere) {
    moveButton.hide();
    transferAttackButtonDisplayed = false;

    if (xButtonClicked) {
        if (xButtonFromWhere === MoveMode.TRANSFER) {
            applyMoveButtonState(stateAfterWindowClosed(MoveMode.TRANSFER));
        } else if (xButtonFromWhere === MoveMode.ATTACK) {
            cancelAttackSelection();
        }
        return;
    }

    const inRange = Boolean(
        lastPlayerOwnedValidDestinationsArray?.some(
            destination => destination.getAttribute("uniqueid") === path.getAttribute("uniqueid")
        )
    );
    if (lastPlayerOwnedValidDestinationsArray && !pathIsPlayerOwned(path) && !inRange) {
        return;
    }

    if (pathIsPlayerOwned(path)) {
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
        //THE DIPLOMATIC GATE ON THE PLAYER'S ATTACK. `countriesMayFight()` is the same
        //selector the AI's `rateTarget()` is refused by, and that is deliberate: two gates
        //answering the same question separately will eventually answer it differently,
        //which is the rule the dice model established when the AI stopped having its own
        //combat resolver.
        ...playerAttackPermission(path),
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

function lockoutTurnsRemaining(path) {
    const uniqueId = path.getAttribute("uniqueid");
    for (const entry of playerTurnsDeactivatedArray) {
        if (entry[0] === uniqueId) {
            return (entry[1] - entry[2]) + 1;
        }
    }
    return undefined;
}

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
    //THE HOVER TEXT IS DERIVED, NOT MATCHED ON THE LABEL. The `mouseover` below decides its
    //tooltip from `button.innerHTML` against a chain of fixed strings, which cannot work now
    //that a label may be any of five relation names. Anything that carries a `hint` is
    //answered from it and the chain is not consulted at all.
    moveButtonHint = state.hint ?? null;
    if (state.mode !== null) {
        transferAttackButtonState = state.mode;
    }
}

let moveButtonOwnedTerritories = [];
let moveButtonSource = null;
/** The sentence `deriveMoveButtonState()` chose for this selection, or null. */
let moveButtonHint = null;

function recordMoveButtonContext(ownedTerritories, source) {
    moveButtonOwnedTerritories = ownedTerritories;
    moveButtonSource = source;
}

function installMoveButtonHandlers() {
    const button = moveButton.element();

    button.addEventListener("click", async function transferAttackClickHandler() {
        tooltip.setContent("");
        tooltip.hide();
        playSoundClip("switch");

        //DECLARING WAR, from the control the player was already reaching for. Diplomacy
        //stage 3.2, and Leigh's second route into a war: *"declaring without chatting too"*.
        //
        //It is handled here, first and on its own, because it is the one mode that does not
        //open a window: it changes the world and then asks for the button to be worked out
        //again. Everything below this point is about the transfer/attack window.
        //
        //IT TAKES EFFECT AT ONCE, so the same selection immediately reads ATTACK -- there is
        //no waiting period anywhere in this system, and the redraw below is what makes that
        //visible rather than merely true. The arrows are redrawn from the SOURCE territory
        //(`lastClickedPathExternal`, the click before this one), because an arrow means *you
        //can attack here* and the newly-declared neighbour has just become one.
        if (transferAttackButtonState === MoveMode.DECLARE && !button.disabled) {
            const target = lastClickedPath;
            const declared = await declareWarOnCountry(pathCountry(target));
            if (!declared) {
                return;
            }
            if (lastClickedPathExternal && pathIsPlayerOwned(lastClickedPathExternal)) {
                showAttackArrows(
                    lastClickedPathExternal,
                    (lastPlayerOwnedValidDestinationsArray ?? []).filter(
                        destination => !pathIsPlayerOwned(destination) &&
                            !pathIsDeactivated(destination) &&
                            playerAttackPermission(destination).mayAttack
                    )
                );
            }
            handleMovePhaseTransferAttackButton(
                target,
                lastPlayerOwnedValidDestinationsArray,
                playerOwnedTerritories,
                lastClickedPathExternal,
                false,
                MoveMode.VIEW_SIEGE
            );
            return;
        }

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

                    } else if (transferAttackButtonState === 2) {
                        setValuesForBattleFromSiegeObject(lastClickedPath, false);
                        battleWindow.setBattleButtons({ third: ThirdButton.ASSAULT });
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
                            toggleTransferAttackButton(false, false);
                            transferAttackButtonDisplayed = false;
                            attackTextCurrentlyDisplayed = false;
                            setupBattle(probability, getFinalAttackArray(), allTerritories());
                            setupBattleUI(getFinalAttackArray());
                            battleWindow.setBattleButtons({
                                //`takeOdds`, not `probability`: the constant is a floor on the
                                //chance of TAKING the place, and the AI's copy of that gate now
                                //reads the same quantity. Comparing the player's against the
                                //strength ratio would make one constant mean two things.
                                siegeEnabled: takeOdds >= PROBABILITY_THRESHOLD_FOR_SIEGE
                            });
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

        if (moveButtonHint) {
            //Derived, so it survives a label that changes with the diplomatic state.
            tooltip.setContent(moveButtonHint);
        } else if (button.disabled) {
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

        //After the content, because the box has to be measured to be placed.
        tooltip.placeNear(x, y);
        tooltip.show();

    });

    button.addEventListener("mouseout", () => {
        tooltip.setContent("");
        tooltip.hide();
    });
}

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

export function removeSiegeImageFromPath(ai, path) {
    const territoryName = path.getAttribute("territory-name");
    if (!territoryName) {
        console.log("removeSiegeImageFromPath: path carries no territory-name; nothing to remove");
        return;
    }

    removeSiegeMarker(territoryName);

    if (!isPhysicalMapActive()) {
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
        attackPreview.clear();
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
        attackPreview.clear();
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

            tooltip.placeNear(x, y);
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
export function getLastClickedPath() {
    return lastClickedPath;
}

/**
 * The territory the bottom bar is currently describing, or null.
 *
 * `lastClickedPath` starts life as a detached stand-in carrying the placeholder
 * `d` below, which is what "nothing has been selected yet" looks like -- it is
 * not null, so it has to be recognised rather than tested for.
 */
function selectedTerritoryForBottomBar() {
    const path = getLastClickedPath();
    if (!path || path.getAttribute("d") === "M0 0 L50 50") {
        return null;
    }
    if (!pathIsPlayerOwned(path) || !upgradeIsAvailableForPath(path)) {
        return null;
    }
    return getTerritory(path.getAttribute("uniqueid")) ?? null;
}

/** Keep the flag's cursor honest about whether clicking it leads anywhere. */
export function refreshBottomBarActionable() {
    bottomTable.setActionable(Boolean(selectedTerritoryForBottomBar()));
}

/**
 * Clicking the bottom bar's FLAG opens Upgrade Territory for the territory the
 * bar is describing -- the same window, through the same call, as the upgrade
 * button on that territory's row in the info panel.
 *
 * Installed ONCE, from bootstrap. The bar is rewritten on every selection, so
 * installing it anywhere near `bottomTable.create()` would add a listener per
 * click and `removeEventListener` could not take the old ones off, each call
 * having built a new function object. That is the move button's old defect
 * exactly, and it presented as a handler firing once per selection made.
 */
function installBottomBarActivation() {
    bottomTable.installActivation(() => {
        const territory = selectedTerritoryForBottomBar();
        if (!territory) {
            return;
        }
        playSoundClip("button");
        openUpgradeWindowFor(territory);
        upgradeWindowCurrentlyOnScreen = true;
    });
    //The affordance follows the phase as well as the selection: the bar keeps
    //describing a territory when the Military phase begins, and the window it
    //would open is refused there.
    onStateEvent(Events.PHASE_CHANGED, refreshBottomBarActionable);
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

function toggleUIButton(makeVisible) {
    if (makeVisible) {
        document.getElementById(ids.uiButtonContainer).style.display = "block";
    } else {
        document.getElementById(ids.uiButtonContainer).style.display = "none";
    }
    activityPanel.setButtonVisible(makeVisible);
    diplomacyPanel.setButtonVisible(makeVisible);
    if (!makeVisible) {
        activityPanel.close();
        diplomacyPanel.close();
    }
}

function toggleMapModeButton(makeVisible) {
    if (makeVisible) {
        document.getElementById(ids.mapModeContainer).style.display = "block";
    } else {
        document.getElementById(ids.mapModeContainer).style.display = "none";
    }
    //The key is a caption for the view this button selects, so it goes wherever the button
    //goes: a legend left standing over a battle screen describes a map nobody can see.
    mapLegend.setChromeVisible(makeVisible);
    toggleAudioButton(makeVisible);
}

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
        attackPreview.clear();
        svg.style.pointerEvents = 'auto';
    }
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
    const next = !uiAppearsAtStartOfTurn;
    infoTable.setAppearAtStartOfTurn(next);
    return next;
}

function setupSiegeUI(territory) {
    battleUIState = 1;
    const siegeObjectElement = getSiegeObjectFromPath(territory);

    const attackerCountry = playerCountryName();
    const defenderTerritory = siegeObjectElement.defendingTerritory.dataName;

    let probBarAdded = false;

    setFlag(attackerCountry, 4);
    setFlag(defenderTerritory, 5);

    setTitleTextBattleUI(attackerCountry, defenderTerritory, 1);

    document.getElementById(ids.battleUITitleTitleCenter).innerHTML = "Sieges";

    prepareProbabilityBar(1, probBarAdded);

    setArmyTextValues(siegeObjectElement, 2, siegeObjectElement.defendingTerritory.uniqueId);

    document.getElementById(ids.mountainDefenseText).innerHTML = siegeObjectElement.defendingTerritory.mountainDefenseBonus;
    document.getElementById(ids.defenseBonusText).innerHTML = siegeObjectElement.defendingTerritory.defenseBonus;
    document.getElementById(ids.prodPopText).innerHTML = formatNumbersToKMB(siegeObjectElement.defendingTerritory.productiveTerritoryPop, 0);
    document.getElementById(ids.foodText).innerHTML = formatNumbersToKMB(siegeObjectElement.defendingTerritory.foodCapacity, 0);

    setSiegeTurnsText(siegeObjectElement);
    showSiegeLedger(siegeObjectElement);
    let siegeScore = calculateSiegeScore(siegeObjectElement);
    setSiegeScoreText(siegeScore, 0);
    document.getElementById(ids.battleUIRow4Col1TextProbabilityTurnsSiege).style.color = "rgb(255,255,255)";
    let difference = scoreDifferenceFor(siegeScore, siegeObjectElement.defendingTerritory);
    if (difference <= 0) {
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).style.color = "rgb(245,128,128)";
    } else if (difference > 0 && difference < 50) {
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).style.color = "rgb(255, 255, 0)";
    } else {
        document.getElementById(ids.battleUIRow4Col1TextSiegeScore).style.color = "rgb(0, 255, 0)";
    }

    setRow4(1);

    roundLog.reset();
    battleWindow.resetForSiege();
}

function setupBattleUI(attackArray) {
    let war = historicWars.find((siege) => siege.warId === getCurrentWarId());
    if (war) {
        battleUIState = 1;
    } else {
        battleUIState = 0;
    }
    setCurrentRound(0);
    digInNextRound = false;
    roundLog.reset();
    battleWindow.resetForAttack();

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

    attackCountry = getTerritory(attackArray[1])?.dataName;
    defendTerritory = getTerritory(attackArray[0]);
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

    const words = str.split(' ');

    const reducedWords = words.map((word) => {
        const lowercaseWord = word.toLowerCase();
        const reducedWord = keywords[lowercaseWord] || word;
        return reducedWord;
    });

    return reducedWords.join(' ');
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
        attackArray.unshift(0, 0);
    }

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
    let attackingLosses;
    if (!attackingArmyRemaining.includes("All")) {
        attackingLosses = totalAttackingArmy.map((count, index) => count - attackingArmyRemaining[index]);
    } else {
        attackingLosses = ["-", "-", "-", "-"];
    }

    if ((battleWindow.battleButtons().retreat !== RetreatMode.DEFEAT && situation === 1)
        || (situation === 0)) {
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
    };
}

export function setDefendingTerritoryCopyEnd(array) {
    return defendingTerritoryCopyEnd = [...array];
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

export function getHistoricWarObject(ai, territory) {
    const territoryName = territory.getAttribute("territory-name");
    const wars = ai ? historicAiWars : historicWars;
    return wars.find((war) => war.defendingTerritory &&
        war.defendingTerritory.territoryName === territoryName) ?? null;
}

function prepareProbabilityBar(siegeOrAttack, probBarAdded) {
    const battleUIRow2 = document.getElementById(ids.battleUIRow2);
    const probabilityColumnBox = document.getElementById(ids.probabilityColumnBox);

    forceLedger.show(siegeOrAttack === 0);

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

function resetGameState() {
    countrySelect.setColour(convertHexValueToRGBOrViceVersa(playerColour(), 1));
    toggleBottomTableContainer(true);
    mainMenu.hide();
    outsideOfMenuAndMapVisible = true;
    menuState = false;
    countrySelectedAndGameStarted = false;
    selectCountryPlayerState = true;

    toggleAudioButton(true);
    phaseBar.setVisible(true);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
    menuButton.show();
}

export function refreshGoalLine() {
    const country = playerCountryName();
    if (isAiGameActive() || !country) {
        phaseBar.setGoalLine("");
        return;
    }
    phaseBar.setGoalLine(victoryProgress(country).label);
}

onStateEvent(Events.TURN_CHANGED, () => refreshGoalLine());

export function inGameMenuAvailable() {
    return outsideOfMenuAndMapVisible;
}

export function openInGameMenu() {
    if (!outsideOfMenuAndMapVisible || menuState) {
        return;
    }
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
    countrySelect.closePicker();
    toggleUpgradeMenu(false);
    toggleBuyMenu(false);
    toggleTransferAttackButton(false, false);
    toggleTransferAttackWindow(false);
    toggleBattleUI(false, false);
    toggleBattleResults(false);
    toggleAiDialogue(false);
}

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

    if (isAiGameActive()) {
        applySpectatorChrome();
    }

    if (lastClickedPath.getAttribute("d") !== "M0 0 L50 50") {
        selectCountry(lastClickedPath, true);
        raiseAttackMarker();
    }

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

async function startNewGame() {
    leaveSpectatorMode();
    if (outsideOfMenuAndMapVisible) {
        stopAutosave();
        await getTurnEngine().reset();

        const baseline = newGameBaseline();
        if (baseline) {
            applyGame(baseline);
            renderAllTerritories();
        } else {
            console.warn("New Game: no pristine baseline was captured; the previous " +
                "game's world is still loaded.");
        }
        resetTransientUiState();
        resetChromeForCountrySelection();
    }

    resetGameState();
    greyOutTerritoriesForUnselectableCountries();
    repaintCountrySelection(null);
    goalSelect.open({ greatPowers: greyedOutCountryNames() });
}

function beginCountrySelection() {
    phaseBar.setGoalLine("");
}

function returnToMainMenuFromGoalSelect() {
    toggleBottomTableContainer(false);
    phaseBar.setVisible(false);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
    menuButton.hide();
    toggleAudioButton(false);
    outsideOfMenuAndMapVisible = false;
    menuState = true;
    selectCountryPlayerState = false;
    mainMenu.show();
}

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

    setAllGreyedOutAttributesToFalseOnGameStart();
    repaintCountrySelection(null);

    pushColorsToMainArray();

    mainMenu.hide();
    outsideOfMenuAndMapVisible = true;
    menuState = false;
    selectCountryPlayerState = false;
    countrySelectedAndGameStarted = false;

    updateArrayOfLeadersAndCountries();
    createCpuPlayerObjectAndAddToMainArray();
    addRandomFortsToAllNonPlayerTerritories();

    setVictoryCondition(randomGoalCondition(Math.random, {
        greatPowers: strongestCountries()
    }));

    clearAiGameLog();
    startAiGameMode();
    applySpectatorChrome();

    await initialiseGame({ spectator: true });
    repaintMap();
}

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
    offerStoredAutosave();
    mainMenu.show();

    greyOutTerritoriesForUnselectableCountries();
    repaintCountrySelection(null);
}

function leaveSpectatorMode() {
    if (!isAiGameActive()) {
        return;
    }
    stopAiGameMode();
    //THE ONE PLACE INJECTED PLANS ARE DROPPED WITHOUT BEING ASKED. They deliberately
    //survive a succession, a change of posture and a turn boundary -- see
    //`src/ai/debugPlans.js` -- but not the world being thrown away and rebuilt underneath
    //them, because the countries a plan names may not exist in the next one.
    clearAllDebugPlans();
    debugPlanPanel.reset();
    toggleSpectatorDebugButtons(false);
    aiGameConsole.close();
    aiGameGoalBar.hide();
}

function applySpectatorChrome() {
    phaseBar.setVisible(false);
    toggleBottomLeftPaneWithTurnAdvance(false);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
    toggleTopTableContainer(false);
    toggleUIMenu(false);
    toggleTransferAttackButton(false, true);
    toggleUpgradeMenu(false);
    toggleBuyMenu(false);

    toggleMapModeButton(true);
    mapModeButtonCurrentlyOnScreen = true;
    toggleUIButton(false);
    uiButtonCurrentlyOnScreen = false;

    toggleBottomTableContainer(true);
    menuButton.show();
    toggleSpectatorDebugButtons(true);
    aiGameConsole.open();
    aiGameGoalBar.show();
}

/**
 * The "AI" and "D" buttons over the map, which exist only while a game plays itself.
 *
 * They are the reason the console's X is an ordinary close rather than an end-the-game:
 * without a way back, a shut console left the page looking idle while two hundred countries
 * fought behind it. See the note on the close button in `AiGameConsole.js`.
 */
function toggleSpectatorDebugButtons(makeVisible) {
    const container = document.getElementById(ids.aiGameButtonsContainer);
    if (container) {
        container.style.display = makeVisible ? "flex" : "none";
    }
}

function resetChromeForCountrySelection() {
    phaseBar.setMode(phaseBar.Mode.SELECTING);
    bottomTable.reset();
    resetAllWindowPositions();
    activityPanel.reset();
    diplomacyPanel.reset();
    clearPlans();
    resetCampaigns();
    resetMusters();
    resetDiplomacyMemory();
    resetOpinions();
    //A question nobody is going to answer. The inbox is filled during an AI turn and emptied
    //at the end of it, so one outstanding here means the player left mid-turn.
    clearDiplomacyInbox();
    aiDebugPanel.close();
    toggleUIButton(false);
    toggleMapModeButton(false);
    toggleAudioButton(true);
    toggleTopTableContainer(false);
    topTable.setHeading("Select a Country");
    lastClickedPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    lastClickedPath.setAttribute("d", "M0 0 L50 50");
    currentSelectedPath = undefined;
}

function resetTransientUiState() {
    resetMapView();
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

async function resumeFromMenu() {
    if (outsideOfMenuAndMapVisible) {
        closeInGameMenu();
        return;
    }

    const save = readAutosave();
    if (!save) {
        mainMenu.setResumeEnabled(false);
        return;
    }
    try {
        await applyLoadedGame(save);
    } catch (error) {
        console.error("Resume: the stored autosave could not be loaded.", error);
        saveLoadPanel.open();
        saveLoadPanel.setStatus(
            error?.message ?? "The stored game could not be loaded.", "bad");
    }
}

function offerStoredAutosave() {
    const summary = autosaveSummary();
    if (!summary) {
        return;
    }
    mainMenu.setResumeLabel("Continue Turn " + summary.turn);
    mainMenu.setResumeEnabled(true);
}

async function loadGameFromCode(code) {
    await applyLoadedGame(decodeSave(code));
}

async function applyLoadedGame(save) {
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
    document.getElementById(ids.popupColor).style.display = "block";
    uiButtonCurrentlyOnScreen = true;
    toggleUIButton(true);
    mapModeButtonCurrentlyOnScreen = true;
    toggleMapModeButton(true);
    menuButton.show();

    phaseBar.setMode(phaseBar.Mode.PLAYING);
    populateBottomTableWhenSelectingACountry(getLastClickedPath());

    beginAutosaving();
    return loaded;
}

function beginAutosaving() {
    installSaveTestHooks({
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

    if (situation === 0) {
        const defendingArmyRemaining = siegeObject.defendingArmyRemaining;
        const startingDef = siegeObject.startingDef;

        const startingDefenseBonus = siegeObject.startingDefenseBonus;
        const startingProdPop = siegeObject.startingTerritoryPop;
        const startingFoodCapacity = siegeObject.startingFoodCapacity;

        const defenseBonus = defendingTerritory.defenseBonus;
        const foodCapacity = defendingTerritory.foodCapacity;
        const productiveTerritoryPop = defendingTerritory.territoryPopulation;

        const defenseBonusPercentage = (defenseBonus / startingDefenseBonus) * 100;
        const foodCapacityPercentage = (foodCapacity / startingFoodCapacity) * 100;
        const productiveTerritoryPopPercentage = (productiveTerritoryPop / startingProdPop) * 100;

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
        } else {
            defendingTerritory.foodCapacityColor = colorGreen;
        }

        if (productiveTerritoryPopPercentage <= 25) {
            defendingTerritory.productiveTerritoryPopColor = colorRed;
        } else if (productiveTerritoryPopPercentage > 25 && productiveTerritoryPopPercentage <= 50) {
            defendingTerritory.productiveTerritoryPopColor = colorOrange;
        } else if (productiveTerritoryPopPercentage > 50 && productiveTerritoryPopPercentage <= 75) {
            defendingTerritory.productiveTerritoryPopColor = colorYellow;
        } else {
            defendingTerritory.productiveTerritoryPopColor = colorGreen;
        }

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

export function commitReserves() {
    const battle = currentBattle();
    if (!battle || pendingReserves().length > 0) {
        return null;
    }

    const reserveArray = [attackTargetPath()?.getAttribute("uniqueid")];
    const total = [0, 0, 0, 0];

    for (const entry of proportionsOfAttackArray) {
        const territory = allTerritories().find((candidate) => candidate.uniqueId === String(entry[0]));
        if (!territory) {
            continue;
        }

        const army = [
            territory.infantryForCurrentTerritory,
            territory.useableAssault,
            territory.useableAir,
            territory.useableNaval
        ];
        if (army.every((count) => count <= 0)) {
            continue;
        }
        reserveArray.push(entry[0], ...army);
        for (let slot = 0; slot < total.length; slot++) {
            total[slot] += army[slot];
        }
    }

    if (total.every((count) => count <= 0)) {
        return null;
    }

    transferArmyOutOfTerritoryOnStartingInvasion(reserveArray, allTerritories());
    queueReserves(total, battle.round + 1);
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
    return total;
}

function showSiegeLedger(siege) {
    const territory = siege.defendingTerritory;
    const score = calculateSiegeScore(siege);
    const difference = scoreDifferenceFor(score, territory);
    const hitChance = siegeHitProbability(difference);

    const fortification = (territory.defenseBonus ?? 0) + (territory.mountainDefenseBonus ?? 0);
    const fortBand = DIE_MODIFIERS.fortification.find((band) => fortification >= band.minimumBonus);

    const besiegerRows = [];
    if (fortBand) {
        besiegerRows.push({ key: "fortification", label: "their fortifications", value: 0, dice: -fortBand.dice });
    }
    const grindingSteps = Math.min(
        Math.floor((siege.turnsInSiege ?? 0) / DIE_MODIFIERS.siegeGrindingTurnsPerStep),
        DIE_MODIFIERS.siegeGrindingCap);
    if (grindingSteps > 0) {
        besiegerRows.push({
            key: "siegeGrinding",
            label: `${siege.turnsInSiege} turns of grinding`,
            value: grindingSteps,
            dice: 0
        });
    }

    forceLedger.show(true);
    forceLedger.update({
        attackerDice: diceCountFor(hitChance),
        defenderDice: defenderDiceCountFor(1 - hitChance),
        modifiers: {
            attacker: { rows: besiegerRows, total: grindingSteps, diceChange: -(fortBand?.dice ?? 0) },
            defender: { rows: [], total: 0, diceChange: 0 }
        }
    });
}

function defencePlaybackDeps() {
    return {
        setArmyTextValues,
        attackerColour: undefined,
        openWindow: () => {
            toggleBattleUI(true, false);
            battleUIDisplayed = true;
            toggleBottomLeftPaneWithTurnAdvance(false);
            toggleUIButton(false);
            toggleMapModeButton(false);
            prepareProbabilityBar(0, true);
            roundLog.reset();
            battleWindow.setBattleButtons({ advance: AdvanceMode.SKIP });
        },
        setTitle: (battle) => {
            setFlag(battle.attackerCountry, 4);
            setFlag(battle.defenderCountry, 5);
            document.getElementById(ids.battleUITitleTitleLeft).innerHTML =
                reduceKeywords(battle.attackerCountry);
            document.getElementById(ids.battleUITitleTitleCenter).innerHTML = "attacks";
            document.getElementById(ids.battleUITitleTitleRight).innerHTML =
                reduceKeywords(battle.territoryName);
        },
        closeWindow: () => {
            toggleBattleUI(false, true);
            battleUIDisplayed = false;
            toggleBottomLeftPaneWithTurnAdvance(true);
            toggleUIButton(true);
            toggleMapModeButton(true);
            battleWindow.resetForAttack();
            diceStage.hide();
            clashPanel.hide();
        }
    };
}

/**
 * Put every question the AI has asked the player, one at a time, and act on each answer.
 *
 * Diplomacy stage 5.5. Called at the end of the AI turn beside `showQueuedDefences()`, and
 * for the same reason that exists: an AI country decides during a phase the player is not
 * present for, and the two possible alternatives are both wrong. A modal raised inside a
 * two-hundred-country loop stops the turn dead; a decision taken silently on the player's
 * behalf is what the design forbids outright, because *"declining has a real consequence and
 * a click-through would apply it silently"*.
 *
 * IT IS AWAITED AND IT IS SEQUENTIAL. `confirmDialog.open()` resolves the previous dialog as
 * a cancel if a second is raised over it, so asking two questions at once would answer the
 * first one NO on the player's behalf -- which is precisely the silent default this whole
 * arrangement exists to prevent.
 *
 * ESCAPE AND THE SCRIM BOTH RESOLVE FALSE, which is a real answer here rather than a
 * dismissal: refusing a call to arms ends the alliance and the dialog says so before it is
 * answered. That is the design's "must not be dismissible into a default" met by making the
 * default an answer the player has been warned about, rather than by trapping them in a modal
 * they cannot leave.
 */
/**
 * Somebody has gone to war with the player: queue a notice for the end of the AI turn.
 *
 * DERIVED FROM THE ONE EVENT, not reported from the call sites. `setRelationState()` is the
 * only way the register is written, so a war opened by a route nobody has written yet still
 * reaches the player -- which is the argument `activityRecorder.js` makes for deriving the
 * news, and the reason the two now read the same event.
 *
 * IT IS QUEUED AND NOT RAISED. This fires inside the AI turn, in the middle of a loop over
 * two hundred countries; a modal here would stop the turn dead. `showQueuedDiplomacy()`
 * empties the queue at the end of it, after the defences, which is the same arrangement the
 * call to arms and the unsolicited offer already have and for the same reason.
 *
 * THREE TRANSITIONS ARE NOT NEWS and each is excluded for its own reason. A war the PLAYER
 * declared is not something to be told about. A ceasefire LAPSING (`via: "expired"`) is a
 * clock running out rather than an act -- the player agreed to the clock, and the ceasefire
 * row already carries the turn it runs out on. And a `replaced` payload is a restore putting
 * the whole register back, which would otherwise raise a modal per standing war on load.
 */
function noticeWarOnPlayer(payload) {
    if (!payload || payload.replaced || payload.state !== DiplomaticState.WAR) {
        return;
    }
    const player = playerCountryName();
    if (!player || (payload.a !== player && payload.b !== player)) {
        return;
    }
    const by = payload.by;
    if (!by || by === player) {
        return;
    }
    if (payload.via !== "declared" && payload.via !== "calledIn") {
        return;
    }
    queueDeclaration({ by, via: payload.via, onBehalfOf: payload.onBehalfOf ?? null });
}

export async function showQueuedDiplomacy() {
    if (pendingDiplomacy() === 0) {
        return;
    }
    const turn = currentTurn();
    const player = playerCountryName();
    for (const entry of takePendingDiplomacy()) {
        const prompt = describeInboxEntry(entry);
        if (!prompt || !player) {
            continue;
        }
        //`kind` marks this as a question the AI asked, which is what lets the e2e driver
        //answer it without also answering a confirmation the player opened themselves. It
        //blocks the turn until it is answered -- deliberately, because that is what "not
        //dismissible into a default" means -- and a harness with no way to see it would hang
        //every headless run. It did exactly that, for four e2e areas at once.
        const answer = await confirmDialog.open({ ...prompt, kind: "diplomacy" });

        if (entry.kind === InboxKind.DECLARATION) {
            //Nothing to apply: the register was written the moment war was declared, which
            //is what this is a notice OF. It is awaited like the other two so that two
            //countries declaring on the same turn are read one at a time -- `open()` resolves
            //a previous dialog as a cancel when a second is raised over it.
            continue;
        }
        if (entry.kind === InboxKind.CALL_IN) {
            applyCallInAnswer({
                ally: player,
                principal: entry.principal,
                adversary: entry.adversary,
                joins: answer,
                turn
            });
            continue;
        }
        if (answer) {
            //The AI already decided it wants this, so there is nobody left to ask: accepting
            //writes it. `acceptProposal()` is the one door, because a ceasefire carries the
            //turn it runs out on AND what it falls back to, and a caller setting the state by
            //hand would sign an agreement that never expires.
            acceptProposal(entry.from, player, entry.proposal, turn);
        }
    }
}

export async function showQueuedDefences() {
    if (pendingDefences() === 0) {
        return;
    }
    await defenderPlayback.playQueuedDefences(defencePlaybackDeps());
}

export function toggleDiceCanvas(value) {
    if (value) {
        document.getElementById(ids.threeCanvasForDice).style.display = "block";
    } else {
        document.getElementById(ids.threeCanvasForDice).style.display = "none";
        clashPanel.hide();
    }
}

export function routeSiegeUIProcesses() {
    battleUIState = 0;
    battleWindow.setBattleButtons({ third: ThirdButton.NONE });
    toggleBattleUI(true, false);
    battleUIDisplayed = true;
    toggleBottomLeftPaneWithTurnAdvance(false);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
    toggleUIButton(false);
    uiButtonCurrentlyOnScreen = false;
    toggleMapModeButton(false);
    mapModeButtonCurrentlyOnScreen = false;
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

/**
 * Turn the owner flags on or off.
 *
 * The button's pressed state is written from the overlay's own answer rather than from a
 * variable kept beside it -- the move button's old defect, in miniature: two records of one
 * fact drift the moment anything else can change it (a new game takes the overlay down).
 */
function toggleFlagOverlay() {
    setFlagOverlayActive(!isFlagOverlayActive(), paths);
    updateFlagOverlayButton();
}

function updateFlagOverlayButton() {
    const button = document.getElementById(ids.flagOverlayButton);
    button?.setAttribute("aria-pressed", isFlagOverlayActive() ? "true" : "false");
}

/** What the cloud button says about itself at each of its three settings. */
const CLOUD_MODE_TITLE = Object.freeze({
    [CLOUD_MODES.FULL]: "Clouds (full) — click for half",
    [CLOUD_MODES.HALF]: "Clouds (half) — click to turn off",
    [CLOUD_MODES.OFF]: "Clouds (off) — click to turn on"
});

/**
 * The cloud button's own state.
 *
 * `data-clouds` rather than `aria-pressed`, because the control has THREE settings and
 * `aria-pressed` can only say two -- a half-strength sky reported as "pressed" would be a
 * button that lies about what it did.
 */
function updateCloudOverlayButton() {
    const button = document.getElementById(ids.cloudOverlayButton);
    if (!button) {
        return;
    }
    button.setAttribute("data-clouds", cloudMode());
    button.setAttribute("title", CLOUD_MODE_TITLE[cloudMode()]);
}

/**
 * The map-view button's own state: the icon it shows and the tooltip it carries.
 *
 * The four VIEWS live in `src/ui/map/mapViews.js` and each of the three decorations is its own
 * module beside it. What is left here is the button, which is where it belongs -- this file
 * owns the map chrome, and the views own the map. `onMapViewChanged()` is subscribed once,
 * from bootstrap, so nothing has to remember to update the button after applying a view.
 */
function updateMapViewButton(view) {
    const button = document.getElementById(ids.continentViewButton);
    if (!button) {
        return;
    }
    button.setAttribute("data-view", view);
    button.setAttribute("title", MAP_VIEW_TITLE[view]);
}

export function endPlayerTurn() {
    if (isPhysicalMapActive()) {
        exitPhysicalMap();
    }

    repaintMap();

    clearAttackTarget();
    toggleTransferAttackButton(false, false);
    transferAttackButtonDisplayed = false;
    setPhase(Phase.AI);
}

export function initialiseNewPlayerTurn() {
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

/**
 * How many places a sparkle will try before giving this tick up.
 *
 * Rejection sampling rather than an ocean mask: the visible water is whatever the camera and
 * the open windows leave, which changes on every pan, zoom and panel. Sea covers most of the
 * screen at most zooms, so a handful of tries almost always finds some -- and when it does
 * not, because the player has zoomed into the middle of Asia, the right answer is no sparkle
 * rather than one drawn on a country.
 */
const SPARKLE_PLACEMENT_TRIES = 8;

/**
 * A point over OPEN WATER, in viewport pixels, or null.
 *
 * Two hit tests, and both are needed. The HOST test asks what is on top at that point: if it
 * is anything but the map object -- the phase bar, a window, the status strips -- a sparkle
 * there would be drawn on top of the panel, because `.sparkles-container` is above all of it.
 * The MAP test then asks the map's own document what is under the point, and rejects anything
 * that is a territory. `#svg-coast-lines` carries `pointer-events: none` so it is invisible to
 * the first test, and the sea is the map document's background rather than an element, so open
 * water answers with the backdrop rect or the root and never with a path.
 */
function openWaterPoint() {
    const map = document.getElementById(ids.svgMap);
    const mapDocument = map?.contentDocument;
    if (!mapDocument) {
        return null;
    }
    for (let attempt = 0; attempt < SPARKLE_PLACEMENT_TRIES; attempt++) {
        const x = cosmeticRandom() * window.innerWidth;
        const y = cosmeticRandom() * window.innerHeight;
        if (document.elementFromPoint(x, y) !== map) {
            continue;
        }
        const under = mapDocument.elementFromPoint(x, y);
        if (under?.tagName === "path" && under.hasAttribute("uniqueid")) {
            continue;
        }
        return { x, y };
    }
    return null;
}

function createSparkle() {
    const container = document.querySelector(".sparkles-container");
    const point = openWaterPoint();
    if (!container || !point) {
        return;
    }
    const sparkle = document.createElement("div");
    sparkle.classList.add("sparkle");
    sparkle.style.top = `${point.y}px`;
    sparkle.style.left = `${point.x}px`;
    container.appendChild(sparkle);

    setTimeout(() => {
        sparkle.remove();
    }, 3000);
}

function addSparklesRegularly() {
    setTimeout(() => {
        createSparkle();
        addSparklesRegularly();
    }, cosmeticRandom() * 100);
}

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
        const startingColour = startingColourForCountry(territory.dataName);
        if (startingColour) {
            paths.forEach(path => {
                if (pathCountry(path) === territory.dataName) {
                    path.setAttribute("fill", startingColour);
                }
            });
        }
    } else {
        if (typeof territory.countryColor !== "string" || territory.countryColor === "") {
            console.warn("setColorOnMap: no countryColor for " + territory.territoryName +
                " -- refusing to paint. Use setColorOnMap(territory, true) before the game starts.");
            return territory.countryColor;
        }
        for (let i = 0; i < paths.length; i++) {
            if (paths[i].getAttribute("uniqueid") === territory.uniqueId) {
                //In the military view the owner colour is not what this territory is wearing,
                //so restoring it here would leave one province in political colours on a map
                //that is shading force. The view is asked for its own answer first.
                const military = isMilitaryViewActive() ? militaryFillFor(paths[i]) : null;
                paths[i].setAttribute("fill", military ?? territory.countryColor);
                break;
            }
        }
    }
    return territory.countryColor;
}


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
 * How a leader's personality reads to somebody who is not their general staff.
 *
 * The three ids in `leaderPersonalities.js` are the whole of what is shown, and the
 * six TRAIT VALUES behind them deliberately are not. A trait is the number the AI
 * plans with -- `risk_taking` decides how thin a border this country will hold in
 * order to attack -- and putting it on a tooltip would let a player read the enemy's
 * plan off the map. The personality is public in the way a reputation is public;
 * the numbers are not. That is the same line the activity feed draws when it reports
 * what HAPPENED and sends the AI's intentions to the console instead.
 */
const LEADER_REPUTATION = Object.freeze({
    aggressive: "said to be warlike",
    balanced: "said to be even-handed",
    pacifist: "said to have little appetite for war"
});

/**
 * The leader of the country holding this territory, or null. Never throws.
 *
 * TWO SOURCES, and the order matters. A leader is stamped onto every territory at
 * `createCpuPlayerObjectAndAddToMainArray()` and is NOT re-stamped on conquest, so a
 * territory that has changed hands still carries the leader of the country that lost
 * it -- which is the same species of staleness as known-issue AS, and would name the
 * wrong ruler on exactly the territories a player is most likely to hover over.
 * `getArrayOfLeadersAndCountries()` is rebuilt from the world every turn and is
 * keyed by country, so it is asked first; the territory's own copy is the fallback,
 * and it is only trusted when the territory is still held by the country it was
 * stamped for.
 */
function leaderOfCountry(countryName, territory) {
    if (!countryName) {
        return null;
    }
    try {
        const row = getArrayOfLeadersAndCountries().find((entry) => entry[0] === countryName);
        if (row?.[1]) {
            return row[1];
        }
    } catch {
        //Fall through to the territory's own copy.
    }
    return territory?.dataName === countryName ? (territory.leader ?? null) : null;
}

/**
 * The line naming who rules a territory, or "" when nobody is known to.
 *
 * Register item E4. Two hundred and six leaders are generated, given six traits
 * each, replaced every 15-20 turns and used to plan every move in the game, and
 * until this the player could not learn a single one of their names -- the only
 * surfaces were the AI debug panel and the spectator console, both developer tools.
 *
 * The player's own country is skipped: the player IS the leader, and "Player" is
 * the literal name `createCpuPlayerObjectAndAddToMainArray()` gives them.
 */
function leaderTooltipLine(countryName, territory) {
    const leader = leaderOfCountry(countryName, territory);
    if (!leader || leader.leaderType === "human" || !leader.name) {
        return "";
    }
    const reputation = LEADER_REPUTATION[leader.leaderType];
    return reputation ? leader.name + ", " + reputation : leader.name;
}

/**
 * The territory the tooltip is currently describing, and whether that description is stale.
 *
 * Rebuilding the label is not free -- it walks the territory's continent, looks up the leader,
 * asks the military plan for a forecast and lists what has been built -- and `mousemove` fires
 * dozens of times a second. So it is rebuilt when the pointer reaches a DIFFERENT territory,
 * and otherwise only when the world has changed underneath it. The old code rebuilt on every
 * event, which was affordable only because it was wrong in the other direction as well.
 */
let tooltipPath = null;
let tooltipStale = false;

/**
 * Put the tooltip on whatever the pointer is over.
 *
 * The one place the territory tooltip is written, called from a single `mousemove` listener
 * installed at bootstrap -- see the note where that listener is added for what this replaced.
 */
function updateTerritoryTooltip(event) {
    const element = event.target;
    if (!element || element.tagName !== "path" || !element.hasAttribute("uniqueid")) {
        //The sea, the overlay, anything that is not a territory. Clearing the CONTENT and not
        //merely hiding is what makes re-entering the same territory rebuild the label.
        tooltipPath = null;
        tooltip.setContent("");
        tooltip.hide();
        return;
    }

    if (element !== tooltipPath || tooltipStale || tooltip.content() === "") {
        tooltipPath = element;
        tooltipStale = false;
        tooltip.setContent(territoryTooltipLabel(element, pathOwner(element)));
    }

    const x = event.clientX;
    const y = event.clientY;
    //One rule for every tooltip in the game, and it needs the content already set:
    //below the pointer when the whole box fits, lifted above it by its OWN height
    //when it does not, clamped into the window on both axes. See `placeNear()`.
    tooltip.placeNear(x, y);
    tooltip.show();
}

function territoryTooltipLabel(path, countryName) {
    let label = countryName;
    if (countryName && pathIsUnderSiege(path)) {
        const besieger = pathBesieger(path);
        if (besieger) {
            label = countryName + " (under siege by " + besieger + ")";
        }
    }

    const territory = getTerritory(path?.getAttribute("uniqueid"));
    const continentLine = describeContinentHolding(continentHoldingFor(territory));
    const leaderLine = leaderTooltipLine(countryName, territory);
    //THE MILITARY VIEW SHADES A RATIO, and a colour cannot explain a ratio -- this is where the
    //map says what it measured against what. Empty in every other view.
    const militaryLines = militaryTooltipLines(path);
    //WHAT THE TERRITORY HAS BUILT. Register item M1: the map carries force and carries nothing
    //the economy does, so "is this worth taking, or merely takeable" could only be answered by
    //selecting a province and opening a window. Nothing is drawn for a kind with none of it --
    //four zero rows on nine tenths of the map is a tooltip people stop reading.
    const upgradeRows = upgradeTooltipRows(territory, { owned: pathIsPlayerOwned(path) });
    //WHO THIS COUNTRY IS AT WAR, AT PEACE OR ALLIED WITH. The register is brought up to date
    //first: a border that closed during the AI's turn should be in contact the moment somebody
    //looks at it, rather than only after the next turn boundary. It is a no-op unless the world
    //has changed since the last ask.
    ensureDiplomaticContacts();
    const relationCountry = territory?.dataName ?? countryName;
    const relations = diplomacyTooltipRows({
        //`dataName` and NOT `countryName`. The label above is `pathOwner()`, which reads
        //"Player" on the player's own land -- so passing it here made the player's own
        //territory take the "somebody else's country" branch and list the player's country
        //as a foreign power at no contact with itself. The register is keyed by COUNTRY,
        //and the country is `dataName`: the current owner, which is what changes on
        //conquest. Confirmed in the browser rather than by reading, which is where it
        //surfaced.
        country: relationCountry,
        //Spectator mode has no player, so there is nobody to put first.
        playerCountry: isAiGameActive() ? null : playerCountryName(),
        relations: relationsFor(relationCountry),
        //A COUNTRY WITH NO TERRITORY IS OUT OF THE GAME and its relations are not news. The
        //register is keyed by country name and knows nothing about the map, so without this
        //a conquered neighbour goes on being listed as an enemy for the rest of the run.
        isDefeated
    });
    //HOW THEY SEE YOU, AND HOW YOU SEE THEM (docs/archived/08-opinion.md §4). Directional, so it is
    //two numbers and not one, and the state goes with each because an unrecorded pair reads
    //as the RESTING point its standing relationship implies rather than as zero. Empty on the
    //player's own land and in spectator mode, where there is nobody to hold an opinion.
    const opinionCountry = isAiGameActive() ? null : playerCountryName();
    const opinionState = opinionCountry
        ? relationStateBetween(relationCountry, opinionCountry)
        : null;
    const opinionBars = opinionTooltipBars({
        country: relationCountry,
        playerCountry: opinionCountry,
        theirs: opinionOf(relationCountry, opinionCountry, opinionState),
        ours: opinionOf(opinionCountry, relationCountry, opinionState)
    });
    if (
        !continentLine && !leaderLine && militaryLines.length === 0 &&
        upgradeRows.length === 0 && relations.rows.length === 0 && opinionBars.length === 0
    ) {
        return label;
    }

    let html = "<div>" + (label ?? "") + "</div>";
    if (leaderLine) {
        html += '<div class="' + classNames.tooltipLeader + '">' + leaderLine + "</div>";
    }
    if (continentLine) {
        html += "<div>" + continentLine + "</div>";
    }
    for (const line of militaryLines) {
        html += "<div>" + line + "</div>";
    }
    for (const row of upgradeRows) {
        html += '<div class="' + classNames.tooltipUpgrade + '">' +
            '<img src="./resources/' + row.icon + '" alt="">' +
            "<span>" + row.label + ": " + row.count + "</span></div>";
    }
    for (const bar of opinionBars) {
        html += '<div class="' + classNames.tooltipOpinion + ' is-' + bar.tone + '">' +
            '<div class="' + classNames.tooltipOpinionLabel + '">' + bar.label + ": " +
            bar.word + " (" + (bar.value > 0 ? "+" : "") + bar.value + ")</div>" +
            '<div class="' + classNames.tooltipOpinionTrack + '">' +
            '<div class="' + classNames.tooltipOpinionFill + '" style="left: ' +
            bar.offsetPercent + "%; width: " + bar.fillPercent + '%"></div>' +
            "</div></div>";
    }
    if (relations.rows.length > 0) {
        html += '<div class="' + classNames.tooltipRelationsHeading + '">Relations</div>';
        for (const row of relations.rows) {
            html += '<div class="' + classNames.tooltipRelation + ' is-' + row.tone + '">' +
                row.label + "</div>";
        }
        if (relations.more > 0) {
            html += '<div class="tooltip-relation is-muted">…and ' + relations.more +
                " more</div>";
        }
    }
    return html;
}
