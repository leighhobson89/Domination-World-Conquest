import {findMatchingCountries} from './manualExceptionsForInteractions.js';
import {
    currentTurn,
    currentTurnPhase,
    initialiseGame as initialiseGame,
    modifyCurrentTurnPhase
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
    mainArrayOfTerritoriesAndResources,
    playerOwnedTerritories,
    populateBottomTableWhenSelectingACountry,
    totalConsMats,
    totalGoldPrice,
    totalPopulationCost,
    totalPurchaseGoldPrice,
    vehicleArmyWorth,
    writeBottomTableInformation
} from './resourceCalculations.js';
import {playSoundClip} from './sfx.js';
import {
    drawAndHandleTransferAttackTable,
    probability,
    territoryUniqueIds,
    transferArmyOutOfTerritoryOnStartingInvasion,
    transferArmyToNewTerritory,
    transferQuantitiesArray
} from './transferAndAttack.js';
import {
    addRemoveWarSiegeObject,
    addWarToHistoricWarArray,
    currentWarId,
    defendingArmyRemaining,
    defendingTerritory,
    getAttackingArmyRemaining,
    getCurrentRound,
    getCurrentWarId,
    getFinalAttackArray,
    getMassiveAssaultStatus,
    getResolution,
    getRoutStatus,
    getUpdatedProbability,
    historicWars,
    nextWarId,
    processRound,
    proportionsOfAttackArray,
    setBattleResolutionOnHistoricWarArrayAfterSiege,
    setCurrentRound,
    setCurrentWarId,
    setFinalAttackArray,
    setMainArrayToArmyRemaining,
    setMassiveAssaultStatus,
    setNextWarId,
    setResolution,
    setRoutStatus,
    setupBattle,
    setValuesForBattleFromSiegeObject,
    siegeObject,
    skirmishesPerRound,
    turnsDeactivatedArray,
    calculateSiegeScore,
    setNewWarOnRetrievalArray,
    addAttackingArmyToRetrievalArray
} from './battle.js';
import { resetThreeCannonDiceScene } from "./dices.js";

let currentlySelectedColorsArray = [];
let turnPhase = currentTurnPhase;

export let pageLoaded = false;
let eventHandlerExecuted = false;

export let svg = [];
export let svgMap = [];
export let svgTag = [];
export let paths = [];
export let defs = [];
export let patterns = [];

//variables that receive information for resources of country's after database reading and calculations, before game starts
export let playerCountry;
export let playerColour = "rgb(255,255,255)"; //default to white player
export let flag;

export let currentMapColorAndStrokeArray = []; //current state of map at start of new turn
const continentColorArray = [
  ["Africa", [233, 234, 20]],
  ["Asia", [203, 58, 22]],
  ["Europe", [186, 218, 85]],
  ["North America", [83, 107, 205]],
  ["South America", [193, 83, 205]],
  ["Oceania", [74, 202, 233]]
];

let teamColorArray = [];
const greyOutColor = 'rgb(170, 170, 170)';
const countryGreyOutThreshold = 40000; //countries under this strength greyed out //40

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
let mapMode = 0; //0 - standard continent coloring 1 - random coloring and team assignments 2 - totally random color

//Zoom variables
let zoomLevel = 1;
const maxZoomLevel = 4;
let originalViewBoxX = 312;
let originalViewBoxY = -207;
let originalViewBoxWidth = 1947;
let originalViewBoxHeight = 1040;
let viewBoxWidth = originalViewBoxWidth;
let viewBoxHeight = originalViewBoxHeight;
let lastMouseX = 0;
let lastMouseY = 0;
let isDragging = false;

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
  svg = document.getElementById('svg-map');
  svgMap = svg.contentDocument;
  svgTag = svgMap.querySelector('svg');
  paths = Array.from(svgMap.querySelectorAll('path'));
  //-----------------------------------------------------------------//
  svg.setAttribute("tabindex", "0");
  const tooltip = document.getElementById("tooltip");
  svg.focus();

  svgMap.addEventListener("mouseover", function(e) {
      // Get the element that was hovered over
      const path = e.target;

      if (path.tagName === "image") {
          setTimeout(function() {
              path.style.cursor = "default";
          }, 50);
      }

      currentPath = path; // Set the current path element

      // Call the hoverColorChange function
      if (path.getAttribute("greyedOut") === "false") {
          hoverOverTerritory(path, "mouseOver");
      }

      // Get the name of the country from the "data-name" attribute
      const countryName = path.getAttribute("owner");

      // Add an event listener for mousemove on the path element
      path.addEventListener("mousemove", function(e) {
          const x = e.clientX;
          const y = e.clientY;

          // Set the content of the tooltip
          tooltip.innerHTML = countryName;

          // Check if the mouse pointer is less than 300px from the bottom of the screen
          if (window.innerHeight - y < 100) {
              // Move the tooltip up by 300px
              tooltip.style.left = x - 40 + "px";
              tooltip.style.top = y - 30 + "px";
          } else {
              // Position the tooltip next to the mouse cursor without moving it vertically
              tooltip.style.left = x - 40 + "px";
              tooltip.style.top = 25 + y + "px";
          }

          // Show the tooltip
          tooltip.style.display = "block";
      });

      // Add an event listener for mouseout on the path element
      path.addEventListener("mouseout", function() {
          // Hide the tooltip when the mouse leaves the path
          tooltip.style.display = "none";
      });

      path.style.cursor = "pointer";
  });

  // Add a mouseout event listener to the SVG element
  svgMap.addEventListener("mouseout", function() {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
      if (currentPath) {
          if (currentPath.getAttribute("greyedOut") === "false") {
              hoverOverTerritory(currentPath, "mouseOut"); // Pass the current path element and set mouseAction to 1
          }
      }
      clickActionsDone = false;
  });

  svgMap.addEventListener("keydown", function() {
    setUnsetMenuOnEscape();
  });

  svgMap.addEventListener("click", function(e) {
      if (e.target.tagName === "rect" && currentTurnPhase === 1) {
          restoreMapColorState(currentMapColorAndStrokeArray, false);
          toggleTransferAttackButton(false);
          if (svgMap.querySelector("#attackImage")) {
            svgMap.getElementById("attackImage").remove(); 
          }
          transferAttackButtonDisplayed = false;
          attackTextCurrentlyDisplayed = false;
          //remove army image
      }
      if (e.target.tagName === "path") {
          currentPath = e.target;
          document.getElementById("popup-confirm").style.opacity = "1";
          if (allowSelectionOfCountry) {
              selectCountry(currentPath, false);
          }
          currentSelectedPath = currentPath;
          if (countrySelectedAndGameStarted) {
              if (currentTurnPhase === 1) { //move/deploy phase show interactable countries when clicking a country
                  validDestinationsAndClosestPointArray = findClosestPaths(e.target);
                  if (currentPath.hasAttribute("fill")) {
                      hoverOverTerritory(currentPath, "clickCountry", currentlySelectedColorsArray);
                      currentlySelectedColorsArray.length = 0;
                      validDestinationsArray = validDestinationsAndClosestPointArray.map(dest => dest[0]);
                      closestDistancesArray = validDestinationsAndClosestPointArray.map(dest => dest[2]);
                      let centerOfTargetPath = findCentroidsFromArrayOfPaths(validDestinationsArray[0]);
                      let closestPointOfDestPathArray = getClosestPointsDestinationPaths(centerOfTargetPath, validDestinationsAndClosestPointArray.map(dest => dest[1]));
                      if (e.target.getAttribute("owner") === "Player") {
                          validDestinationsArray = HighlightInteractableCountriesAfterSelectingOne(currentSelectedPath, closestPointOfDestPathArray, validDestinationsArray, closestDistancesArray, false);
                          lastPlayerOwnedValidDestinationsArray = validDestinationsArray;
                      } else {
                        territoriesAbleToAttackTarget = HighlightInteractableCountriesAfterSelectingOne(currentSelectedPath, closestPointOfDestPathArray, validDestinationsArray, closestDistancesArray, true); //extract rows to put in attacking table
                        territoriesAbleToAttackTarget = territoriesAbleToAttackTarget.filter(territoryCandidate => {
                            const owner = territoryCandidate.getAttribute("owner");
                            return owner === "Player";
                          });
                      }
                      handleMovePhaseTransferAttackButton(e.target, lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, lastClickedPath, false, 2);
                  }
              } else if (currentTurnPhase === 2) {

              }
          } else { //if on country selection screen
              document.getElementById("popup-color").style.display = "block";
          }
      }
  });

  svgMap.addEventListener("wheel", zoomMap);

  svgMap.addEventListener('mousedown', function(event) {
      if (event.button === 0 && zoomLevel > 1) {
          isDragging = true;
          lastMouseX = event.clientX;
          lastMouseY = event.clientY;
          event.preventDefault();
      }
  });

  svgMap.addEventListener('mousemove', function(e) {
      if (tooltip.innerHTML !== "") {
          tooltip.style.display = "block";
      } else {
          tooltip.style.display = "none";
      }
      panMap(e);
  });

  svgMap.addEventListener('mouseup', function(e) {
      if (e.button === 0 && isDragging) {
          isDragging = false;
      }
  });

  if (mapMode === 0) { // standard continent coloring
      colorMapAtBeginningOfGame();
  } else if (mapMode === 1) { //random with team assignment
      colorArray = generateDistinctRGBs();
      assignTeamAndFillColorToSVGPaths(colorArray);
  } else if (mapMode === 2) {
      randomiseColorsOfPathsOnLoad(); // totally random
  }

  console.log("loaded!");
}
 

function selectCountry(country, escKeyEntry) {
  if (country.getAttribute("greyedOut") === "false") {
    if (country.getAttribute("underSiege") === "false") {
        const deactivatedPaths = paths.filter(path => path.getAttribute("deactivated") === "true");

        if (deactivatedPaths.length > 0) { //make sure order correct for deactivated paths
        const lowestIndex = paths.indexOf(deactivatedPaths[0]);
        svgMap.documentElement.insertBefore(country, paths[lowestIndex]);
        } else {
        svgMap.documentElement.appendChild(country);
        }
    } else {
        const siegedPaths = paths.filter(path => path.getAttribute("underSiege") === "true");

        if (siegedPaths.length > 0) { //make sure order correct for sieged paths
        const lowestIndex = paths.indexOf(siegedPaths[0]);
        svgMap.documentElement.insertBefore(country, paths[lowestIndex]);
        } else {
        svgMap.documentElement.appendChild(country);
        }
    }

        if (selectCountryPlayerState && !escKeyEntry) { //in select country state, colour territory and other connected clicked on
            for (let i = 0; i < paths.length; i++) {
                if (paths[i].getAttribute("data-name") === country.getAttribute("data-name")) {
                    if (country.getAttribute("data-name") !== lastClickedPath.getAttribute("data-name")) {
                        paths[i].setAttribute('fill', playerColour);
                    }
                }
            }
        } else if (!selectCountryPlayerState && !escKeyEntry) { // in game state, colour player territories when clicked on
            for (let i = 0; i < paths.length; i++) {
                if (paths[i].getAttribute("owner") === "Player") {
                    paths[i].setAttribute('fill', playerColour);
                    if (territoryAboutToBeAttackedOrSieged) {
                        document.getElementById("attack-destination-container").style.display = "none";
                        attackTextCurrentlyDisplayed = false;
                        if (svgMap.querySelector("#attackImage")) {
                            svgMap.getElementById("attackImage").remove(); 
                        }
                    }
                }
            }
        }

        if (lastClickedPath.hasAttribute("fill") && !escKeyEntry) { //if a territory has previously been clicked, handle deselecting previous
            for (let i = 0; i < paths.length; i++) {
                if ((paths[i].getAttribute("uniqueid") === lastClickedPath.getAttribute("uniqueid")) && paths[i].getAttribute("owner") === "Player" && country.getAttribute("deactivated") === "false") { //set the iterating path to the player color when clicking on any path and the iterating path is a player territory
                    paths[i].setAttribute('fill', playerColour);
                } else if (paths[i].getAttribute("underSiege") === "true") {
                    paths[i].setAttribute('fill', playerColour);
                } else if (!selectCountryPlayerState && (paths[i].getAttribute("uniqueid") === lastClickedPath.getAttribute("uniqueid")) && paths[i].getAttribute("owner") !== "Player" && currentPath !== lastClickedPath) { //set the iterating path to the continent color when it is the last clicked path and the user is not hovering over the last clicked path
                    if (mapMode === 0) {
                        paths[i].setAttribute("fill", fillPathBasedOnContinent(paths[i]));
                    }
                    if (mapMode === 1) {
                        fillPathBasedOnTeam(paths[i]);
                    }
                    setStrokeWidth(paths[i], "1");
                } else if (selectCountryPlayerState && country.getAttribute("data-name") !== lastClickedPath.getAttribute("data-name")) {
                    for (let j = 0; j < paths.length; j++) {
                        if (lastClickedPath.getAttribute("data-name") === paths[j].getAttribute("data-name") && lastClickedPath.getAttribute("greyedOut") === "false") {
                            paths[j].setAttribute("fill", fillPathBasedOnContinent(paths[j]));
                            setStrokeWidth(paths[j], "1");
                        }
                    }
                }
            }
        }
  } else {
        if (lastClickedPath.hasAttribute("fill") && !escKeyEntry && lastClickedPath.getAttribute("greyedOut") === "false" && country.getAttribute("greyedOut") === "true") {
            lastClickedPath.setAttribute("fill", fillPathBasedOnContinent(lastClickedPath));
        }
  }

  if (!clickActionsDone) {
      populateBottomTableWhenSelectingACountry(country);

      if (!escKeyEntry) {
          if (lastClickedPath.getAttribute('d') !== 'M0 0 L50 50') {
            if (lastClickedPath.getAttribute("deactivated") === "false" && lastClickedPath.getAttribute("underSiege") === "false") {
                lastClickedPath.parentNode.insertBefore(lastClickedPath, lastClickedPath.parentNode.children[9]);
            }
            if (lastClickedPath.getAttribute("uniqueid") !== currentPath.getAttribute("uniqueid") && lastClickedPath.getAttribute("owner") !== "Player" && lastClickedPath.getAttribute("underSiege") === "false") {
                  setStrokeWidth(lastClickedPath, "1");
            }
          }
      }
      lastClickedPathExternal = lastClickedPath;
      lastClickedPath = country; // Update the previously clicked path

      if (selectCountryPlayerState && !escKeyEntry) {
          adjustTextToFit(document.getElementById('popup-body'), country.getAttribute("data-name"));
          document.getElementById('popup-confirm').classList.add("greenBackground");
          document.getElementById('popup-confirm').style.display = "block";
      }

      if (country.getAttribute("fill") === greyOutColor) {
          document.getElementById('popup-confirm').style.display = "none";
      }

      clickActionsDone = true;
  }
  window.focus();
}

document.addEventListener("DOMContentLoaded", function() {
  //MENU CONTAINER
  // create the menu container
  const menuContainer = document.createElement("div");
  menuContainer.classList.add("menu-container");

  // create the menu options
  const title = document.createElement("td");
  title.innerText = "Domination:";
  title.classList.add("menu-option");
  title.classList.add("title");

  const subTitle = document.createElement("td");
  subTitle.innerText = "World Conquest";
  subTitle.classList.add("menu-option");
  subTitle.classList.add("subTitle");

  const newGameButton = document.createElement("button");
  newGameButton.innerText = "New Game";
  newGameButton.classList.add("menu-option");
  newGameButton.classList.add("option-3");
  newGameButton.setAttribute("id", "new-game-btn");
  newGameButton.disabled = true;

  const toggleMusicButton = document.createElement("button");
  toggleMusicButton.innerText = "Toggle Music";
  toggleMusicButton.classList.add("menu-option");
  toggleMusicButton.classList.add("option-4");
  toggleMusicButton.setAttribute("id", "toggle-music-btn");

  const helpButton = document.createElement("button");
  helpButton.innerText = "Help";
  helpButton.classList.add("menu-option");
  helpButton.classList.add("option-5");

  // add event listener to New Game button
  newGameButton.addEventListener("click", function() {
      playSoundClip("click");
      resetGameState();
      greyOutTerritoriesForUnselectableCountries();
  });

  function resetGameState() {
      toggleBottomTableContainer(true);
      document.getElementById("menu-container").style.display = "none";
      outsideOfMenuAndMapVisible = true;
      menuState = false;
      countrySelectedAndGameStarted = false;
      selectCountryPlayerState = true;
      popupWithConfirmContainer.style.display = "flex";
      bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
  }

  // add the menu options to the menu container
  menuContainer.appendChild(title);
  menuContainer.appendChild(subTitle);
  menuContainer.appendChild(newGameButton);
  menuContainer.appendChild(toggleMusicButton);
  menuContainer.appendChild(helpButton);

  // add the menu container to the HTML body
  document.getElementById("menu-container").appendChild(menuContainer);

  //MAP POPUP WITH CONFIRM BUTTON
  // create the menu container
  const popupWithConfirmContainer = document.createElement("div");
  popupWithConfirmContainer.classList.add("popup-with-confirm-container");

  // create the menu options
  const popupTitle = document.createElement("td");
  popupTitle.innerText = "Select a Country..."; //set in required function
  popupTitle.classList.add("popup-option");
  popupTitle.classList.add("popup-option-title");
  popupTitle.setAttribute("id", "popup-title");

  const colorPicker = document.createElement("label");
  colorPicker.innerText = "Select Player Color";
  colorPicker.classList.add("popup-option");
  colorPicker.classList.add("popup-option-color");
  colorPicker.setAttribute("id", "popup-color");
  colorPicker.setAttribute("for", "player-color-picker");

  const popupSubTitle = document.createElement("td");
  popupSubTitle.innerText = "- - - -";
  popupSubTitle.classList.add("popup-option");
  popupSubTitle.classList.add("popup-option-subtitle");
  popupSubTitle.setAttribute("id", "popup-body");

  const popupConfirm = document.createElement("button");
  popupConfirm.innerText = "CONFIRM";
  popupConfirm.classList.add("popup-option");
  popupConfirm.classList.add("popup-option-confirm");
  popupConfirm.setAttribute("id", "popup-confirm");


  const UIToggleButton = document.createElement("img");
  UIToggleButton.src = "resources/globeNoStandButtonUI.png"; // Set the image source URL
  UIToggleButton.classList.add("UI-option");
  UIToggleButton.setAttribute("id", "UIToggleButton");

  UIToggleButton.addEventListener("click", function() {
      playSoundClip("click");
      if (uiCurrentlyOnScreen) {
          toggleUIMenu(false);
      } else {
          toggleUIMenu(true);
          summaryButton.style.backgroundColor = "rgb(111, 151, 183)";
          summaryButton.classList.add("active");
      }

  });

  document.getElementById("UIButtonContainer").appendChild(UIToggleButton);

  colorPicker.addEventListener("click", function() {
      playSoundClip("click");
      document.getElementById("player-color-picker").style.display = "block";
  });

  document.getElementById("player-color-picker").addEventListener('change', function() {
      playerColour = convertHexValueToRGBOrViceVersa(document.getElementById("player-color-picker").value, 0);
      restoreMapColorState(currentMapColorAndStrokeArray, false);
      document.getElementById("popup-color").style.color = playerColour;
      if (selectCountryPlayerState) {
          for (let i = 0; i < paths.length; i++) {
              if (paths[i].getAttribute("data-name") === lastClickedPath.getAttribute("data-name")) {
                  paths[i].setAttribute("fill", playerColour);
              }
          }
      } else if (countrySelectedAndGameStarted) {
          paths.forEach(path => {
              if (path.getAttribute("owner") === "Player") {
                  path.setAttribute("fill", playerColour);
              }
          });
          currentMapColorAndStrokeArray = saveMapColorState(false);
      }
  });

  // add event listener to popup confirm button
  popupConfirm.addEventListener("click", function() {
      playSoundClip("click");
      if (selectCountryPlayerState) {
          setAllGreyedOutAttributesToFalseOnGameStart();
          selectCountryPlayerState = false;
          countrySelectedAndGameStarted = true;
          document.getElementById("popup-color").style.color = playerColour;
          popupSubTitle.style.opacity = "0.5";
          playerCountry = document.getElementById("popup-body").innerHTML;
          flag = playerCountry;
          setFlag(flag, 1); //set player flag in top table
          setFlag(flag, 3); //set player flag in ui info panel
          uiButtonCurrentlyOnScreen = true;
          toggleUIButton(true);
          restoreMapColorState(currentMapColorAndStrokeArray, true);
          initialiseGame();
          addRandomFortsToAllNonPlayerTerritories();
          document.getElementById("top-table-container").style.display = "block";
          popupTitle.innerText = "Buy / Upgrade Phase";
          popupSubTitle.innerText = "";
          popupConfirm.innerText = "MILITARY";
          turnPhase++;
          currentMapColorAndStrokeArray = saveMapColorState(false);
      } else if (countrySelectedAndGameStarted && turnPhase === 0) {
          if (siegeObject) {
            for (const key in siegeObject) {
                for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
                    if (siegeObject[key].defendingTerritory.uniqueId === mainArrayOfTerritoriesAndResources[i].uniqueId) {
                        console.log("Beginning of turn Useable for " + mainArrayOfTerritoriesAndResources[i].territoryName + ": Assault: " + mainArrayOfTerritoriesAndResources[i].useableAssault + " Air: " + mainArrayOfTerritoriesAndResources[i].useableAir + " Naval: " + mainArrayOfTerritoriesAndResources[i].useableNaval);
                    }
                }
            }
          }
          currentMapColorAndStrokeArray = saveMapColorState(false); //grab state of map colors at start of turn.
          popupTitle.innerText = "Buy / Upgrade Phase";
          popupConfirm.innerText = "MILITARY";
          modifyCurrentTurnPhase(turnPhase);
          turnPhase++;
      } else if (countrySelectedAndGameStarted && turnPhase === 1) {
          currentMapColorAndStrokeArray = saveMapColorState(false); //grab state of map colors at start of turn.
          popupTitle.innerText = "Military Phase";
          popupConfirm.innerText = "END TURN";
          modifyCurrentTurnPhase(turnPhase);
          turnPhase++;
      } else if (countrySelectedAndGameStarted && turnPhase === 2) {
        if (svgMap.querySelector("#attackImage")) {
            svgMap.getElementById("attackImage").remove();
            lastClickedPath.style.stroke = "rgb(0,0,0)";
            lastClickedPath.setAttribute("stroke-width", "1");
            lastClickedPath.style.strokeDasharray = "none";
        }
        toggleTransferAttackButton(false);
        transferAttackButtonDisplayed = false;
        restoreMapColorState(currentMapColorAndStrokeArray, false); //Add to this feature once attack implemented and territories can change color
        popupTitle.innerText = "AI turn";
        popupConfirm.innerText = "AI Moving...";
        modifyCurrentTurnPhase(turnPhase);
        turnPhase = 0;
      }
  });

  // add the menu options to the menu container
  popupWithConfirmContainer.appendChild(popupTitle);
  popupWithConfirmContainer.appendChild(colorPicker);
  popupWithConfirmContainer.appendChild(popupSubTitle);
  popupWithConfirmContainer.appendChild(popupConfirm);

  document.getElementById("popup-with-confirm-container").appendChild(popupWithConfirmContainer);

  //TOP TABLE
  const topTableTable = document.createElement("table");
  topTableTable.setAttribute("id", "top-table");

  const topTableRow = document.createElement("tr");
  topTableRow.classList.add("top-row");

  const topTableFlag = document.createElement("td");
  topTableFlag.classList.add("iconCell");
  topTableFlag.setAttribute("id", "flag-top");
  topTableFlag.addEventListener("mouseover", () => {
      tooltip.innerHTML = playerCountry;
      tooltip.style.display = "block";
  });
  topTableFlag.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const topTableTotalResourcesString = document.createElement("td");
  topTableTotalResourcesString.innerHTML = "Total Player Resources:";

  const topTableGold = document.createElement("td");
  topTableGold.classList.add("iconCell");

  const goldImg = document.createElement("img");
  goldImg.classList.add("sizingIcons");
  goldImg.alt = "Gold";
  goldImg.src = "resources/gold.png";

  const topTableGoldValue = document.createElement("td");
  topTableGoldValue.classList.add("resourceFields");

  const topTableOil = document.createElement("td");
  topTableOil.classList.add("iconCell");
  topTableOil.addEventListener("mouseover", () => {
      let totalOilDemandCountry = demandArray.totalOilDemand;

      tooltip.innerHTML = `
    <div><span style="color: rgb(235,235,0)">Oil:</span></div>
    <div>Total Oil Capacity: ${Math.ceil(capacityArray.totalOilCapacity)}</div>
    <div>Total Oil Demand: ${totalOilDemandCountry}</div>
  `;
      tooltip.style.display = "block";
  });
  topTableOil.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const oilImg = document.createElement("img");
  oilImg.classList.add("sizingIcons");
  oilImg.alt = "Oil";
  oilImg.src = "resources/oil.png";

  const topTableOilValue = document.createElement("td");
  topTableOilValue.classList.add("resourceFields");
  topTableOilValue.addEventListener("mouseover", () => {
      let totalOilDemandCountry = demandArray.totalOilDemand;
      tooltip.innerHTML = `
    <div><span style="color: rgb(235,235,0)">Oil:</span></div>
    <div>Total Oil Capacity: ${Math.ceil(capacityArray.totalOilCapacity)}</div>
    <div>Total Oil Demand: ${totalOilDemandCountry}</div>
  `;
      tooltip.style.display = "block";
  });
  topTableOilValue.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const topTableFood = document.createElement("td");
  topTableFood.classList.add("iconCell");
  topTableFood.addEventListener("mouseover", () => {
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Food:</span></div>
    <div>Total Food Capacity: ${formatNumbersToKMB(capacityArray.totalFoodCapacity)}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableFood.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const foodImg = document.createElement("img");
  foodImg.classList.add("sizingIcons");
  foodImg.alt = "Food";
  foodImg.src = "resources/food.png";

  const topTableFoodValue = document.createElement("td");
  topTableFoodValue.classList.add("resourceFields");
  topTableFoodValue.addEventListener("mouseover", () => {
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Food:</span></div>
    <div>Total Food Capacity: ${formatNumbersToKMB(capacityArray.totalFoodCapacity)}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableFoodValue.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const topTableConsMats = document.createElement("td");
  topTableConsMats.classList.add("iconCell");
  topTableConsMats.addEventListener("mouseover", () => {
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Cons Mats.:</span></div>
    <div>Total Cons. Mats. Capacity: ${Math.ceil(capacityArray.totalConsMatsCapacity)}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableConsMats.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const consMatsImg = document.createElement("img");
  consMatsImg.classList.add("sizingIcons");
  consMatsImg.alt = "Construction Materials";
  consMatsImg.src = "resources/consMats.png";

  const topTableConsMatsValue = document.createElement("td");
  topTableConsMatsValue.classList.add("resourceFields");
  topTableConsMatsValue.addEventListener("mouseover", () => {
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Cons Mats.:</span></div>
    <div>Total Cons. Mats. Capacity: ${Math.ceil(capacityArray.totalConsMatsCapacity)}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableConsMatsValue.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const topTableProdPopulation = document.createElement("td");
  topTableProdPopulation.classList.add("iconCell");

  const prodPopulationImg = document.createElement("img");
  prodPopulationImg.classList.add("sizingIcons");
  prodPopulationImg.alt = "Population";
  prodPopulationImg.src = "resources/prodPopulation.png";

  const topTableProdPopulationValue = document.createElement("td");
  topTableProdPopulationValue.classList.add("population");

  const topTablelandArea = document.createElement("td");
  topTablelandArea.classList.add("iconCell");

  const landAreaImg = document.createElement("img");
  landAreaImg.classList.add("sizingIcons");
  landAreaImg.alt = "Land Area";
  landAreaImg.src = "resources/landArea.png";

  const topTablelandAreaValue = document.createElement("td");
  topTablelandAreaValue.classList.add("resourceFields");

  const topTableArmy = document.createElement("td");
  topTableArmy.classList.add("iconCell");

  const armyImg = document.createElement("img");
  armyImg.classList.add("sizingIcons");
  armyImg.alt = "Military";
  armyImg.src = "resources/army.png";

  const topTableArmyValue = document.createElement("td");
  topTableArmyValue.classList.add("resourceFields");

  topTableTable.appendChild(topTableRow);
  topTableRow.appendChild(topTableFlag);
  topTableRow.appendChild(topTableTotalResourcesString);
  topTableRow.appendChild(topTableGold);
  topTableGold.appendChild(goldImg);
  topTableRow.appendChild(topTableGoldValue);
  topTableRow.appendChild(topTableOil);
  topTableOil.appendChild(oilImg);
  topTableRow.appendChild(topTableOilValue);
  topTableRow.appendChild(topTableFood);
  topTableFood.appendChild(foodImg);
  topTableRow.appendChild(topTableFoodValue);
  topTableRow.appendChild(topTableConsMats);
  topTableConsMats.appendChild(consMatsImg);
  topTableRow.appendChild(topTableConsMatsValue);
  topTableRow.appendChild(topTableProdPopulation);
  topTableProdPopulation.appendChild(prodPopulationImg);
  topTableRow.appendChild(topTableProdPopulationValue);
  topTableRow.appendChild(topTablelandArea);
  topTablelandArea.appendChild(landAreaImg);
  topTableRow.appendChild(topTablelandAreaValue);
  topTableRow.appendChild(topTableArmy);
  topTableArmy.appendChild(armyImg);
  topTableRow.appendChild(topTableArmyValue);

  document.getElementById("top-table-container").appendChild(topTableTable);

  //MAIN UI
  const mainUIContainer = document.createElement("div");
  mainUIContainer.classList.add("blur-background");

  const tabButtons = document.createElement("div");
  tabButtons.classList.add("tab-buttons");
  tabButtons.setAttribute("id", "tab-buttons");

  const summaryButton = document.createElement("button");
  summaryButton.classList.add("tab-button");
  summaryButton.setAttribute("id", "summaryButton");
  summaryButton.innerHTML = "Summary";

  summaryButton.addEventListener("click", function() {
      summaryButton.style.backgroundColor = "rgb(111, 151, 183)";
      playSoundClip("click");
      summaryButton.classList.add("tab-button");
      uiButtons(summaryButton);
      drawUITable(uiTable, 0);
  });

  summaryButton.addEventListener("mouseover", function() {
    summaryButton.style.backgroundColor = "rgb(111, 151, 183)";
});

summaryButton.addEventListener("mouseout", function() {
    if (!summaryButton.classList.contains("active")) {
        summaryButton.style.backgroundColor = "rgb(81, 121, 153)";
    }
});

  const territoryButton = document.createElement("button");
  territoryButton.classList.add("tab-button");
  territoryButton.setAttribute("id", "territoryButton");
  territoryButton.innerHTML = "Territories";

  territoryButton.addEventListener("click", function() {
      summaryButton.style.backgroundColor = "rgb(81, 121, 153)";
      playSoundClip("click");
      territoryButton.classList.add("tab-button");
      uiButtons(territoryButton);
      drawUITable(uiTable, 1);
  });

  const armyButton = document.createElement("button");
  armyButton.classList.add("tab-button");
  armyButton.setAttribute("id", "armyButton");
  armyButton.innerHTML = "Military";

  armyButton.addEventListener("click", function() {
      summaryButton.style.backgroundColor = "rgb(81, 121, 153)";
      playSoundClip("click");
      uiButtons(armyButton);
      drawUITable(uiTable, 2);
  });

  const warsSiegesButton = document.createElement("button");
  warsSiegesButton.classList.add("tab-button");
  warsSiegesButton.setAttribute("id", "warsSiegesButton");
  warsSiegesButton.innerHTML = "Wars / Sieges";

  warsSiegesButton.addEventListener("click", function() {
      summaryButton.style.backgroundColor = "rgb(81, 121, 153)";
      playSoundClip("click");
      warsSiegesButton.classList.add("tab-button");
      uiButtons(warsSiegesButton);
      drawUITable(uiTable, 3);
  });

  const checkBox = document.createElement("button");
  checkBox.classList.add("checkBox-appear-start-of-turn");
  checkBox.setAttribute("id", "checkBox-appear-start-of-turn");
  checkBox.innerHTML = "✔";

  checkBox.addEventListener("mouseover", (e) => {
      const x = e.clientX;
      const y = e.clientY;

      tooltip.style.left = x - 40 + "px";
      tooltip.style.top = 25 + y + "px";
      tooltip.innerHTML = "Check to display UI at start of turn!";
      tooltip.style.display = "block";
  });

  checkBox.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  checkBox.addEventListener("click", function() {
      playSoundClip("click");
      uiAppearsAtStartOfTurn = toggleUIToAppearAtStartOfTurn(checkBox, uiAppearsAtStartOfTurn);
  });

  const xButton = document.createElement("button");
  xButton.classList.add("x-button");
  xButton.setAttribute("id", "xButton");
  xButton.innerHTML = "X";

  xButton.addEventListener("click", function() {
      playSoundClip("click");
      toggleUIMenu(false);
      uiCurrentlyOnScreen = false;
      territoryButton.classList.remove("active");
      armyButton.classList.remove("active");
      warsSiegesButton.classList.remove("active");
      uiTable.style.display = "none";
  });

  const contentWindow = document.createElement("div");
  contentWindow.classList.add("content-window");
  contentWindow.setAttribute("id", "content-window");

  const beforeInfoPanel = document.createElement("div");
  beforeInfoPanel.classList.add("info-panel::before");
  beforeInfoPanel.setAttribute("id", "beforeInfoPanel");

  const infoPanel = document.createElement("div");
  infoPanel.classList.add("info-panel");
  infoPanel.setAttribute("id", "info-panel");

  const uiTable = document.createElement("div");
  uiTable.classList.add("ui-table");
  uiTable.setAttribute("id", "uiTable");

  const selectionPanel = document.createElement("div");
  selectionPanel.classList.add("selection-panel");
  selectionPanel.setAttribute("id", "selection-panel");

  mainUIContainer.appendChild(tabButtons);
  tabButtons.appendChild(summaryButton);
  tabButtons.appendChild(territoryButton);
  tabButtons.appendChild(armyButton);
  tabButtons.appendChild(warsSiegesButton);
  tabButtons.appendChild(checkBox);
  tabButtons.appendChild(xButton);
  mainUIContainer.appendChild(contentWindow);
  contentWindow.appendChild(infoPanel);
  contentWindow.appendChild(selectionPanel);
  infoPanel.appendChild(uiTable);
  infoPanel.insertBefore(beforeInfoPanel, infoPanel.firstChild);

  document.getElementById("main-ui-container").appendChild(mainUIContainer);

  //UPGRADE WINDOW
  const upgradeContainer = document.createElement("div");
  upgradeContainer.classList.add("blur-background");

  const navBarUpgradeWindow = document.createElement("div");
  navBarUpgradeWindow.classList.add("navbar-upgrade-window");
  navBarUpgradeWindow.setAttribute("id", "navbar-upgrade-window");

  const navBarLeftColumn = document.createElement("div");
  navBarLeftColumn.classList.add("left-column");
  navBarLeftColumn.innerHTML = "";

  const navBarCenterColumn = document.createElement("div");
  navBarCenterColumn.classList.add("center-column");
  navBarCenterColumn.innerHTML = "Upgrade Territory";

  const navBarRightColumn = document.createElement("div");
  navBarRightColumn.classList.add("right-column");
  navBarRightColumn.innerHTML = "";

  const subtitleUpgradeWindow = document.createElement("div");
  subtitleUpgradeWindow.classList.add("subtitle-upgrade-window");
  subtitleUpgradeWindow.setAttribute("id", "subtitle-upgrade-window");

  const keyBarUpgradeWindow = document.createElement("div");
  keyBarUpgradeWindow.classList.add("key-bar-upgrade-window");
  keyBarUpgradeWindow.setAttribute("id", "key-bar-upgrade-window");

  const keyBarColumn0 = document.createElement("div");
  keyBarColumn0.classList.add("key-bar-column0");
  keyBarColumn0.innerHTML = "";

  const keyBarColumn1 = document.createElement("div");
  keyBarColumn1.classList.add("key-bar-column1");
  keyBarColumn1.innerHTML = "Type";

  const keyBarColumn2 = document.createElement("div");
  keyBarColumn2.classList.add("key-bar-column2");
  keyBarColumn2.innerHTML = "Effect";

  const keyBarColumn3 = document.createElement("div");
  keyBarColumn3.classList.add("key-bar-column3");
  let imageSource = "resources/gold.png";
  let imageElement = document.createElement("img");
  imageElement.src = imageSource;
  imageElement.alt = "Gold";
  imageElement.classList.add("sizingIcons");
  keyBarColumn3.appendChild(imageElement);

  const keyBarColumn4 = document.createElement("div");
  keyBarColumn4.classList.add("key-bar-column4");
  imageSource = "resources/consMats.png";
  imageElement = document.createElement("img");
  imageElement.src = imageSource;
  imageElement.alt = "Construction Materials";
  imageElement.classList.add("sizingIcons");
  keyBarColumn4.appendChild(imageElement);

  const keyBarColumn5 = document.createElement("div");
  keyBarColumn5.classList.add("key-bar-column5");
  imageSource = "resources/upgrade.png";
  imageElement = document.createElement("img");
  imageElement.src = imageSource;
  imageElement.alt = "Upgrade";
  imageElement.classList.add("sizingIcons");
  keyBarColumn5.appendChild(imageElement);

  const xButtonUpgrade = document.createElement("button");
  xButtonUpgrade.classList.add("x-button");
  xButtonUpgrade.setAttribute("id", "xButton");
  xButtonUpgrade.innerHTML = "X";

  xButtonUpgrade.addEventListener("click", function() {
      playSoundClip("click");
      toggleUpgradeMenu(false);
      upgradeWindowCurrentlyOnScreen = false;
  });

  const contentWindowUpgrade = document.createElement("div");
  contentWindowUpgrade.classList.add("content-window-upgrade");
  contentWindowUpgrade.setAttribute("id", "content-window-upgrade");

  const beforeInfoPanelUpgradeWindow = document.createElement("div");
  beforeInfoPanelUpgradeWindow.classList.add("info-panel-upgrade::before");
  beforeInfoPanelUpgradeWindow.setAttribute("id", "beforeInfoPanelUpgradeWindow");

  const infoPanelUpgradeWindow = document.createElement("div");
  infoPanelUpgradeWindow.classList.add("info-panel-upgrade");
  infoPanelUpgradeWindow.setAttribute("id", "info-panel-upgrade");

  const upgradeTable = document.createElement("div");
  upgradeTable.classList.add("upgrade-table");
  upgradeTable.setAttribute("id", "upgrade-table");

  const bottomBarUpgradeWindow = document.createElement("div");
  bottomBarUpgradeWindow.classList.add("bottom-bar-upgrade-window");
  bottomBarUpgradeWindow.setAttribute("id", "bottom-bar-upgrade-window");

  const pricesInfoWindow = document.createElement("div");
  pricesInfoWindow.classList.add("prices-info-window");
  pricesInfoWindow.setAttribute("id", "prices-info-window");

  const pricesInfoCol0 = document.createElement("div");
  pricesInfoCol0.classList.add("prices-info-column");
  pricesInfoCol0.classList.add("prices-info-col0-padding");
  pricesInfoCol0.setAttribute("id", "prices-info-column0");
  pricesInfoCol0.innerHTML = "Total:";

  const pricesInfoCol1 = document.createElement("div");
  pricesInfoCol1.classList.add("prices-info-column");
  pricesInfoCol1.classList.add("prices-info-icon-justification");
  pricesInfoCol1.setAttribute("id", "prices-info-column1");
  imageSource = "resources/gold.png";
  imageElement = document.createElement("img");
  imageElement.src = imageSource;
  imageElement.alt = "Gold";
  imageElement.classList.add("sizingIcons");
  pricesInfoCol1.appendChild(imageElement);

  const pricesInfoCol2 = document.createElement("div");
  pricesInfoCol2.classList.add("prices-info-column");
  pricesInfoCol2.classList.add("prices-info-total-justification");
  pricesInfoCol2.setAttribute("id", "prices-info-column2");
  pricesInfoCol2.innerHTML = "0";

  const pricesInfoCol3 = document.createElement("div");
  pricesInfoCol3.classList.add("prices-info-column");
  pricesInfoCol3.classList.add("prices-info-icon-justification");
  pricesInfoCol3.setAttribute("id", "prices-info-column3");
  imageSource = "resources/consMats.png";
  imageElement = document.createElement("img");
  imageElement.src = imageSource;
  imageElement.alt = "Construction Materials";
  imageElement.classList.add("sizingIcons");
  pricesInfoCol3.appendChild(imageElement);

  const pricesInfoCol4 = document.createElement("div");
  pricesInfoCol4.classList.add("prices-info-column");
  pricesInfoCol4.classList.add("prices-info-total-justification");
  pricesInfoCol4.setAttribute("id", "prices-info-column4");
  pricesInfoCol4.innerHTML = "0";

  const bottomBarConfirmButton = document.createElement("button");
  bottomBarConfirmButton.classList.add("bottom-bar-confirm-button");
  bottomBarConfirmButton.setAttribute("id", "bottom-bar-confirm-button");
  bottomBarConfirmButton.innerHTML = "Cancel";

  bottomBarConfirmButton.addEventListener("click", function() {
      playSoundClip("click");
      if (bottomBarConfirmButton.innerHTML === "Cancel") {
          toggleUpgradeMenu(false);
          upgradeWindowCurrentlyOnScreen = false;
      } else if (bottomBarConfirmButton.innerHTML === "Confirm") {
          addPlayerUpgrades(document.getElementById("upgrade-table"), currentlySelectedTerritoryForUpgrades, totalGoldPrice, totalConsMats);
          toggleUpgradeMenu(false);
          upgradeWindowCurrentlyOnScreen = false;
      }
  });


  upgradeContainer.appendChild(navBarUpgradeWindow);
  navBarUpgradeWindow.appendChild(navBarLeftColumn);
  navBarUpgradeWindow.appendChild(navBarCenterColumn);
  navBarUpgradeWindow.appendChild(navBarRightColumn);
  navBarRightColumn.appendChild(xButtonUpgrade);
  upgradeContainer.appendChild(subtitleUpgradeWindow);
  upgradeContainer.appendChild(keyBarUpgradeWindow);
  keyBarUpgradeWindow.appendChild(keyBarColumn0);
  keyBarUpgradeWindow.appendChild(keyBarColumn1);
  keyBarUpgradeWindow.appendChild(keyBarColumn2);
  keyBarUpgradeWindow.appendChild(keyBarColumn3);
  keyBarUpgradeWindow.appendChild(keyBarColumn4);
  keyBarUpgradeWindow.appendChild(keyBarColumn5);
  upgradeContainer.appendChild(contentWindowUpgrade);
  contentWindowUpgrade.appendChild(infoPanelUpgradeWindow);
  infoPanelUpgradeWindow.appendChild(upgradeTable);
  infoPanelUpgradeWindow.insertBefore(beforeInfoPanelUpgradeWindow, infoPanelUpgradeWindow.firstChild);
  infoPanelUpgradeWindow.appendChild(bottomBarUpgradeWindow);
  bottomBarUpgradeWindow.appendChild(pricesInfoWindow);
  pricesInfoWindow.appendChild(pricesInfoCol0);
  pricesInfoWindow.appendChild(pricesInfoCol1);
  pricesInfoWindow.appendChild(pricesInfoCol2);
  pricesInfoWindow.appendChild(pricesInfoCol3);
  pricesInfoWindow.appendChild(pricesInfoCol4);
  bottomBarUpgradeWindow.appendChild(bottomBarConfirmButton);

  document.getElementById("upgrade-container").appendChild(upgradeContainer);

  //BUY MENU
  const buyContainer = document.createElement("div");
  buyContainer.classList.add("blur-background");

  const navBarBuyWindow = document.createElement("div");
  navBarBuyWindow.classList.add("navbar-buy-window");
  navBarBuyWindow.setAttribute("id", "navbar-buy-window");

  const navBarBuyLeftColumn = document.createElement("div");
  navBarBuyLeftColumn.classList.add("left-column-buy");
  navBarBuyLeftColumn.innerHTML = "";

  const navBarBuyCenterColumn = document.createElement("div");
  navBarBuyCenterColumn.classList.add("center-column-buy");
  navBarBuyCenterColumn.innerHTML = "Buy Military";

  const navBarBuyRightColumn = document.createElement("div");
  navBarBuyRightColumn.classList.add("right-column-buy");
  navBarBuyRightColumn.innerHTML = "";

  const subtitleBuyWindow = document.createElement("div");
  subtitleBuyWindow.classList.add("subtitle-buy-window");
  subtitleBuyWindow.setAttribute("id", "subtitle-buy-window");

  const keyBarBuyWindow = document.createElement("div");
  keyBarBuyWindow.classList.add("key-bar-buy-window");
  keyBarBuyWindow.setAttribute("id", "key-bar-buy-window");

  const keyBarBuyColumn0 = document.createElement("div");
  keyBarBuyColumn0.classList.add("key-bar-buy-column0");
  keyBarBuyColumn0.innerHTML = "";

  const keyBarBuyColumn1 = document.createElement("div");
  keyBarBuyColumn1.classList.add("key-bar-buy-column1");
  keyBarBuyColumn1.innerHTML = "Type";

  const keyBarBuyColumn2 = document.createElement("div");
  keyBarBuyColumn2.classList.add("key-bar-buy-column2");
  keyBarBuyColumn2.innerHTML = "Effect";

  const keyBarBuyColumn3 = document.createElement("div");
  keyBarBuyColumn3.classList.add("key-bar-buy-column3");
  let imageSourceBuy = "resources/gold.png";
  let imageElementBuy = document.createElement("img");
  imageElementBuy.src = imageSourceBuy;
  imageElementBuy.alt = "Gold";
  imageElementBuy.classList.add("sizingIcons");
  keyBarBuyColumn3.appendChild(imageElementBuy);

  const keyBarBuyColumn4 = document.createElement("div");
  keyBarBuyColumn4.classList.add("key-bar-buy-column4");
  imageSourceBuy = "resources/prodPopulation.png";
  imageElementBuy = document.createElement("img");
  imageElementBuy.src = imageSourceBuy;
  imageElementBuy.alt = "Productive Population";
  imageElementBuy.classList.add("sizingIcons");
  keyBarBuyColumn4.appendChild(imageElementBuy);

  const keyBarBuyColumn5 = document.createElement("div");
  keyBarBuyColumn5.classList.add("key-bar-buy-column5");
  imageSourceBuy = "resources/buy.png";
  imageElementBuy = document.createElement("img");
  imageElementBuy.src = imageSourceBuy;
  imageElementBuy.alt = "Buy";
  imageElementBuy.classList.add("sizingIcons");
  keyBarBuyColumn5.appendChild(imageElementBuy);

  const xButtonBuy = document.createElement("button");
  xButtonBuy.classList.add("x-button-buy");
  xButtonBuy.setAttribute("id", "xButtonBuy");
  xButtonBuy.innerHTML = "X";

  xButtonBuy.addEventListener("click", function() {
      playSoundClip("click");
      toggleBuyMenu(false);
      buyWindowCurrentlyOnScreen = false;
  });

  const contentWindowBuy = document.createElement("div");
  contentWindowBuy.classList.add("content-window-buy");
  contentWindowBuy.setAttribute("id", "content-window-buy");

  const beforeInfoPanelBuyWindow = document.createElement("div");
  beforeInfoPanelBuyWindow.classList.add("info-panel-buy::before");
  beforeInfoPanelBuyWindow.setAttribute("id", "beforeInfoPanelBuyWindow");

  const infoPanelBuyWindow = document.createElement("div");
  infoPanelBuyWindow.classList.add("info-panel-buy");
  infoPanelBuyWindow.setAttribute("id", "info-panel-buy");

  const buyTable = document.createElement("div");
  buyTable.classList.add("buy-table");
  buyTable.setAttribute("id", "buy-table");

  const bottomBarBuyWindow = document.createElement("div");
  bottomBarBuyWindow.classList.add("bottom-bar-buy-window");
  bottomBarBuyWindow.setAttribute("id", "bottom-bar-buy-window");

  const pricesBuyInfoWindow = document.createElement("div");
  pricesBuyInfoWindow.classList.add("prices-buy-info-window");
  pricesBuyInfoWindow.setAttribute("id", "prices-buy-info-window");

  const pricesBuyInfoCol0 = document.createElement("div");
  pricesBuyInfoCol0.classList.add("prices-buy-info-column");
  pricesBuyInfoCol0.classList.add("prices-buy-info-col0-padding");
  pricesBuyInfoCol0.setAttribute("id", "prices-buy-info-column0");
  pricesBuyInfoCol0.innerHTML = "Total:";

  const pricesBuyInfoCol1 = document.createElement("div");
  pricesBuyInfoCol1.classList.add("prices-buy-info-column");
  pricesBuyInfoCol1.classList.add("prices-buy-info-icon-justification");
  pricesBuyInfoCol1.setAttribute("id", "prices-buy-info-column1");
  imageSourceBuy = "resources/gold.png";
  imageElementBuy = document.createElement("img");
  imageElementBuy.src = imageSourceBuy;
  imageElementBuy.alt = "Gold";
  imageElementBuy.classList.add("sizingIcons");
  pricesBuyInfoCol1.appendChild(imageElementBuy);

  const pricesBuyInfoCol2 = document.createElement("div");
  pricesBuyInfoCol2.classList.add("prices-buy-info-column");
  pricesBuyInfoCol2.classList.add("prices-buy-info-total-justification");
  pricesBuyInfoCol2.setAttribute("id", "prices-buy-info-column2");
  pricesBuyInfoCol2.innerHTML = "0";

  const pricesBuyInfoCol3 = document.createElement("div");
  pricesBuyInfoCol3.classList.add("prices-buy-info-column");
  pricesBuyInfoCol3.classList.add("prices-buy-info-icon-justification");
  pricesBuyInfoCol3.setAttribute("id", "prices-buy-info-column3");
  imageSourceBuy = "resources/prodPopulation.png";
  imageElementBuy = document.createElement("img");
  imageElementBuy.src = imageSourceBuy;
  imageElementBuy.alt = "Productive Population";
  imageElementBuy.classList.add("sizingIcons");
  pricesBuyInfoCol3.appendChild(imageElementBuy);

  const pricesBuyInfoCol4 = document.createElement("div");
  pricesBuyInfoCol4.classList.add("prices-buy-info-column");
  pricesBuyInfoCol4.classList.add("prices-buy-info-total-justification");
  pricesBuyInfoCol4.setAttribute("id", "prices-buy-info-column4");
  pricesBuyInfoCol4.innerHTML = "0";

  const bottomBarBuyConfirmButton = document.createElement("button");
  bottomBarBuyConfirmButton.classList.add("bottom-bar-buy-confirm-button");
  bottomBarBuyConfirmButton.setAttribute("id", "bottom-bar-buy-confirm-button");
  bottomBarBuyConfirmButton.innerHTML = "Cancel";

  bottomBarBuyConfirmButton.addEventListener("click", function() {
      playSoundClip("click");
      if (bottomBarBuyConfirmButton.innerHTML === "Cancel") {
          toggleBuyMenu(false);
          buyWindowCurrentlyOnScreen = false;
      } else if (bottomBarBuyConfirmButton.innerHTML === "Confirm") {
          addPlayerPurchases(document.getElementById("buy-table"), currentlySelectedTerritoryForPurchases, totalPurchaseGoldPrice, totalPopulationCost);
          toggleBuyMenu(false);
          buyWindowCurrentlyOnScreen = false;
      }
  });


  buyContainer.appendChild(navBarBuyWindow);
  navBarBuyWindow.appendChild(navBarBuyLeftColumn);
  navBarBuyWindow.appendChild(navBarBuyCenterColumn);
  navBarBuyWindow.appendChild(navBarBuyRightColumn);
  navBarBuyRightColumn.appendChild(xButtonBuy);
  buyContainer.appendChild(subtitleBuyWindow);
  buyContainer.appendChild(keyBarBuyWindow);
  keyBarBuyWindow.appendChild(keyBarBuyColumn0);
  keyBarBuyWindow.appendChild(keyBarBuyColumn1);
  keyBarBuyWindow.appendChild(keyBarBuyColumn2);
  keyBarBuyWindow.appendChild(keyBarBuyColumn3);
  keyBarBuyWindow.appendChild(keyBarBuyColumn4);
  keyBarBuyWindow.appendChild(keyBarBuyColumn5);
  buyContainer.appendChild(contentWindowBuy);
  contentWindowBuy.appendChild(infoPanelBuyWindow);
  infoPanelBuyWindow.appendChild(buyTable);
  infoPanelBuyWindow.insertBefore(beforeInfoPanelBuyWindow, infoPanelBuyWindow.firstChild);
  infoPanelBuyWindow.appendChild(bottomBarBuyWindow);
  bottomBarBuyWindow.appendChild(pricesBuyInfoWindow);
  pricesBuyInfoWindow.appendChild(pricesBuyInfoCol0);
  pricesBuyInfoWindow.appendChild(pricesBuyInfoCol1);
  pricesBuyInfoWindow.appendChild(pricesBuyInfoCol2);
  pricesBuyInfoWindow.appendChild(pricesBuyInfoCol3);
  pricesBuyInfoWindow.appendChild(pricesBuyInfoCol4);
  bottomBarBuyWindow.appendChild(bottomBarBuyConfirmButton);

  document.getElementById("buy-container").appendChild(buyContainer);

  // MOVE PHASE BUTTON
  const attackDestinationTextContainer = document.createElement("div");
  attackDestinationTextContainer.classList.add("attack-destination-container");
  attackDestinationTextContainer.setAttribute("id", "attack-destination-container");

  const leftImage = document.createElement("img");
  leftImage.classList.add("left-attack-image");
  leftImage.classList.add("sizingIcons");
  leftImage.setAttribute("id", "leftBattleImage");

  const centeredText = document.createElement("div");
  centeredText.setAttribute("id", "attack-destination-text");
  centeredText.classList.add("attack-destination-text");

  const rightImage = document.createElement("img");
  rightImage.classList.add("right-attack-image");
  rightImage.classList.add("sizingIcons");
  rightImage.setAttribute("id", "rightBattleImage");

  const transferAttackButtonContainer = document.createElement("div");
  transferAttackButtonContainer.classList.add("move-phase-buttons-container");

  const transferAttackButton = document.createElement("button");
  transferAttackButton.classList.add("move-phase-button");
  transferAttackButton.setAttribute("id", "move-phase-button");
  transferAttackButton.innerHTML = "TRANSFER";

  attackDestinationTextContainer.appendChild(leftImage);
  attackDestinationTextContainer.appendChild(centeredText);
  attackDestinationTextContainer.appendChild(rightImage);
  transferAttackButtonContainer.appendChild(transferAttackButton);

  document.getElementById("attack-destination-containers").appendChild(attackDestinationTextContainer);
  document.getElementById("move-phase-buttons-container").appendChild(transferAttackButtonContainer);

  // TRANSFER / ATTACK WINDOW
  const transferAttackWindowContainer = document.createElement("div");
  transferAttackWindowContainer.classList.add("blur-background");

  const titleTransferAttackWindow = document.createElement("div");
  titleTransferAttackWindow.classList.add("title-transfer-attack-window");
  titleTransferAttackWindow.setAttribute("id", "title-transfer-attack-window");

  const colorBarAttackUnderlayRed = document.createElement("div");
  colorBarAttackUnderlayRed.classList.add("color-bar-attack-underlay-red");
  colorBarAttackUnderlayRed.setAttribute("id", "colorBarAttackUnderlayRed");

  const colorBarAttackOverlayGreen = document.createElement("div");
  colorBarAttackOverlayGreen.classList.add("color-bar-attack-overlay-green");
  colorBarAttackOverlayGreen.setAttribute("id", "colorBarAttackOverlayGreen");

  const titleTransferAttackRow1 = document.createElement("div");
  titleTransferAttackRow1.classList.add("title-transfer-window-title-row");
  titleTransferAttackRow1.setAttribute("id", "title-transfer-window-title-row");

  const titleTransferAttackRow2 = document.createElement("div");
  titleTransferAttackRow2.classList.add("title-transfer-window-title-row");
  titleTransferAttackRow2.setAttribute("id", "title-transfer-window-title-row");

  const attackOrTransferString = document.createElement("div");
  attackOrTransferString.classList.add("attackOrTransferHeading");
  attackOrTransferString.setAttribute("id", "attackOrTransferString");

  const fromHeadingString = document.createElement("div");
  fromHeadingString.classList.add("fromHeading");
  fromHeadingString.setAttribute("id", "fromHeadingString");

  const territoryTextString = document.createElement("div");
  territoryTextString.classList.add("territoryText");
  territoryTextString.setAttribute("id", "territoryTextString");

  const attackingFromTerritoryTextString = document.createElement("div");
  attackingFromTerritoryTextString.classList.add("attackingFromTerritoryTextString");
  attackingFromTerritoryTextString.setAttribute("id", "attackingFromTerritoryTextString");

  const xButtonTransferAttack = document.createElement("div");
  xButtonTransferAttack.classList.add("x-button-transfer-attack");
  xButtonTransferAttack.setAttribute("id", "xButtonTransferAttack");
  xButtonTransferAttack.innerHTML = "X";

  const percentChanceAttack = document.createElement("div");
  percentChanceAttack.classList.add("percentage-attack");
  percentChanceAttack.setAttribute("id", "percentageAttack");
  percentChanceAttack.innerHTML = "0 %";

  const contentTransferAttackWindow = document.createElement("div");
  contentTransferAttackWindow.classList.add("content-transfer-attack-window");
  contentTransferAttackWindow.setAttribute("id", "contentTransferAttackWindow");

  const contentTransferHeaderRow = document.createElement("div");
  contentTransferHeaderRow.classList.add("content-transfer-header-row");
  contentTransferHeaderRow.setAttribute("id", "contentTransferHeaderRow");

  const TransferTableContainer = document.createElement("div");
  TransferTableContainer.classList.add("transfer-table-container");
  TransferTableContainer.setAttribute("id", "transferTableContainer");

  const contentTransferHeaderColumn1 = document.createElement("div");
  contentTransferHeaderColumn1.classList.add("content-transfer-header-column");
  contentTransferHeaderColumn1.setAttribute("id", "contentTransferHeaderColumn1");

  const contentTransferHeaderColumn2 = document.createElement("div");
  contentTransferHeaderColumn2.classList.add("content-transfer-header-column");
  contentTransferHeaderColumn2.setAttribute("id", "contentTransferHeaderColumn2");

  const contentTransferHeaderImageColumn1 = document.createElement("div");
  contentTransferHeaderImageColumn1.classList.add("content-transfer-header-image-column");
  contentTransferHeaderImageColumn1.setAttribute("id", "contentTransferHeaderImageColumn1");

  const contentTransferHeaderImageColumn2 = document.createElement("div");
  contentTransferHeaderImageColumn2.classList.add("content-transfer-header-image-column");
  contentTransferHeaderImageColumn2.setAttribute("id", "contentTransferHeaderImageColumn2");

  const contentTransferHeaderImageColumn3 = document.createElement("div");
  contentTransferHeaderImageColumn3.classList.add("content-transfer-header-image-column");
  contentTransferHeaderImageColumn3.setAttribute("id", "contentTransferHeaderImageColumn3");

  const contentTransferHeaderImageColumn4 = document.createElement("div");
  contentTransferHeaderImageColumn4.classList.add("content-transfer-header-image-column");
  contentTransferHeaderImageColumn4.setAttribute("id", "contentTransferHeaderImageColumn4");

  const transferTable = document.createElement("div");
  transferTable.classList.add("transfer-table");
  transferTable.setAttribute("id", "transferTable");

  transferAttackWindowContainer.appendChild(colorBarAttackUnderlayRed);
  transferAttackWindowContainer.appendChild(colorBarAttackOverlayGreen);
  transferAttackWindowContainer.appendChild(titleTransferAttackWindow);

  titleTransferAttackWindow.appendChild(titleTransferAttackRow1);
  titleTransferAttackRow1.appendChild(attackOrTransferString);
  titleTransferAttackRow1.appendChild(territoryTextString);
  titleTransferAttackRow1.appendChild(xButtonTransferAttack);

  titleTransferAttackWindow.appendChild(titleTransferAttackRow2);
  titleTransferAttackRow2.appendChild(fromHeadingString);
  titleTransferAttackRow2.appendChild(attackingFromTerritoryTextString);
  titleTransferAttackRow2.appendChild(percentChanceAttack);

  transferAttackWindowContainer.appendChild(contentTransferHeaderRow);
  transferAttackWindowContainer.appendChild(contentTransferAttackWindow);

  contentTransferHeaderRow.appendChild(contentTransferHeaderColumn1);
  contentTransferHeaderRow.appendChild(contentTransferHeaderColumn2);
  contentTransferHeaderColumn2.appendChild(contentTransferHeaderImageColumn1);
  contentTransferHeaderColumn2.appendChild(contentTransferHeaderImageColumn2);
  contentTransferHeaderColumn2.appendChild(contentTransferHeaderImageColumn3);
  contentTransferHeaderColumn2.appendChild(contentTransferHeaderImageColumn4);

  contentTransferAttackWindow.appendChild(TransferTableContainer);
  TransferTableContainer.appendChild(transferTable);

  document.getElementById("transfer-attack-window-container").appendChild(transferAttackWindowContainer);

  xButtonTransferAttack.addEventListener("click", function() {
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
      toggleBottomLeftPaneWithTurnAdvance(true);
      handleMovePhaseTransferAttackButton("xButtonClicked", lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, lastClickedPath, true, transferAttackButtonState);
  });

  //BATTLE UI
  const battleUIContainer = document.createElement("div");
  battleUIContainer.classList.add("battleContainer");
  battleUIContainer.classList.add("blur-background");

  const battleUIRow1 = document.createElement("div");
  battleUIRow1.classList.add("battleUIRow");
  battleUIRow1.classList.add("battleUIRow1");
  battleUIRow1.setAttribute("id","battleUIRow1");

  const battleUIRow1FlagCol1 = document.createElement("div");
  battleUIRow1FlagCol1.classList.add("battleUITitleFlagCol1");
  battleUIRow1FlagCol1.setAttribute("id","battleUITitleFlagCol1");
  battleUIRow1FlagCol1.innerHTML = "Flag Attacker";

  const battleUITitleTitleCol = document.createElement("div");
  battleUITitleTitleCol.classList.add("battleUITitleTitleCol");
  battleUITitleTitleCol.setAttribute("id","battleUITitleTitleCol");

  const battleUITitleTitleLeft = document.createElement("div");
  battleUITitleTitleLeft.classList.add("leftHalfTitleBattle");
  battleUITitleTitleLeft.setAttribute("id","battleUITitleTitleLeft");

  const battleUITitleTitleCenter = document.createElement("div");
  battleUITitleTitleCenter.classList.add("centerTitleBattle");
  battleUITitleTitleCenter.setAttribute("id","battleUITitleTitleCenter");

  const battleUITitleTitleRight = document.createElement("div");
  battleUITitleTitleRight.classList.add("rightHalfTitleBattle");
  battleUITitleTitleRight.setAttribute("id","battleUITitleTitleRight");

  const battleUIRow1FlagCol2 = document.createElement("div");
  battleUIRow1FlagCol2.classList.add("battleUITitleFlagCol2");
  battleUIRow1FlagCol2.setAttribute("id","battleUITitleFlagCol2");

  const battleUIRow2 = document.createElement("div");
  battleUIRow2.classList.add("battleUIRow");
  battleUIRow2.classList.add("battleUIRow2");
  battleUIRow2.classList.add("battleUIRow2AttackBg");
  battleUIRow2.setAttribute("id","battleUIRow2");

  const probabilityColumnBox = document.createElement("div");
  probabilityColumnBox.classList.add("probabilityColumnBox");
  probabilityColumnBox.classList.add("probabilityColumnBox");
  probabilityColumnBox.setAttribute("id","probabilityColumnBox");

  const battleUIRow3 = document.createElement("div");
  battleUIRow3.classList.add("battleUIRow");
  battleUIRow3.classList.add("battleUIRow3");
  battleUIRow3.setAttribute("id","battleUIRow3");

  const armyRowRow1 = document.createElement("div");
  armyRowRow1.classList.add("armyRowRow1");
  armyRowRow1.setAttribute("id","armyRowRow1");

  const armyRowRow1Icon1 = document.createElement("div");
  armyRowRow1Icon1.classList.add("armyIconColumnBattleUI");
  armyRowRow1Icon1.setAttribute("id","armyRowRow1Icon1");
  armyRowRow1Icon1.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/infantry.png'>";

  const armyRowRow1Icon2 = document.createElement("div");
  armyRowRow1Icon2.classList.add("armyIconColumnBattleUI");
  armyRowRow1Icon2.setAttribute("id","armyRowRow1Icon2");
  armyRowRow1Icon2.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/assault.png'>";

  const armyRowRow1Icon3 = document.createElement("div");
  armyRowRow1Icon3.classList.add("armyIconColumnBattleUI");
  armyRowRow1Icon3.setAttribute("id","armyRowRow1Icon3");
  armyRowRow1Icon3.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/air.png'>";

  const armyRowRow1Icon4 = document.createElement("div");
  armyRowRow1Icon4.classList.add("armyIconColumnBattleUI");
  armyRowRow1Icon4.setAttribute("id","armyRowRow1Icon4");
  armyRowRow1Icon4.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/naval.png'>";

  const armyRowRow1Icon5 = document.createElement("div");
  armyRowRow1Icon5.classList.add("armyIconColumnBattleUI");
  armyRowRow1Icon5.classList.add("armyIconColumnBattleUIDivider");
  armyRowRow1Icon5.setAttribute("id","armyRowRow1Icon5");
  armyRowRow1Icon5.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/infantry.png'>";

  const armyRowRow1Icon6 = document.createElement("div");
  armyRowRow1Icon6.classList.add("armyIconColumnBattleUI");
  armyRowRow1Icon6.setAttribute("id","armyRowRow1Icon6");
  armyRowRow1Icon6.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/assault.png'>";

  const armyRowRow1Icon7 = document.createElement("div");
  armyRowRow1Icon7.classList.add("armyIconColumnBattleUI");
  armyRowRow1Icon7.setAttribute("id","armyRowRow1Icon7");
  armyRowRow1Icon7.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/air.png'>";

  const armyRowRow1Icon8 = document.createElement("div");
  armyRowRow1Icon8.classList.add("armyIconColumnBattleUI");
  armyRowRow1Icon8.setAttribute("id","armyRowRow1Icon8");
  armyRowRow1Icon8.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/naval.png'>";

  const armyRowRow2 = document.createElement("div");
  armyRowRow2.classList.add("armyRowRow2");
  armyRowRow2.setAttribute("id","armyRowRow2");

  const armyRowRow2Quantity1 = document.createElement("div");
  armyRowRow2Quantity1.classList.add("armyRowRow2Quantity");
  armyRowRow2Quantity1.setAttribute("id","armyRowRow2Quantity1");

  const armyRowRow2Quantity2 = document.createElement("div");
  armyRowRow2Quantity2.classList.add("armyRowRow2Quantity");
  armyRowRow2Quantity2.setAttribute("id","armyRowRow2Quantity2");

  const armyRowRow2Quantity3 = document.createElement("div");
  armyRowRow2Quantity3.classList.add("armyRowRow2Quantity");
  armyRowRow2Quantity3.setAttribute("id","armyRowRow2Quantity3");

  const armyRowRow2Quantity4 = document.createElement("div");
  armyRowRow2Quantity4.classList.add("armyRowRow2Quantity");
  armyRowRow2Quantity4.setAttribute("id","armyRowRow2Quantity4");

  const armyRowRow2Quantity5 = document.createElement("div");
  armyRowRow2Quantity5.classList.add("armyRowRow2Quantity");
  armyRowRow2Quantity5.classList.add("armyIconColumnBattleUIDivider");
  armyRowRow2Quantity5.setAttribute("id","armyRowRow2Quantity5");

  const armyRowRow2Quantity6 = document.createElement("div");
  armyRowRow2Quantity6.classList.add("armyRowRow2Quantity");
  armyRowRow2Quantity6.setAttribute("id","armyRowRow2Quantity6");

  const armyRowRow2Quantity7 = document.createElement("div");
  armyRowRow2Quantity7.classList.add("armyRowRow2Quantity");
  armyRowRow2Quantity7.setAttribute("id","armyRowRow2Quantity7");

  const armyRowRow2Quantity8 = document.createElement("div");
  armyRowRow2Quantity8.classList.add("armyRowRow2Quantity");
  armyRowRow2Quantity8.setAttribute("id","armyRowRow2Quantity8");

  const battleUIRow4 = document.createElement("div");
  battleUIRow4.classList.add("battleUIRow");
  battleUIRow4.classList.add("battleUIRow4");
  battleUIRow4.setAttribute("id","battleUIRow4");

  const battleUIRow4Col1 = document.createElement("div");
  battleUIRow4Col1.classList.add("battleUIRow4Col1");
  battleUIRow4Col1.setAttribute("id","battleUIRow4Col1");

  const battleUIRow4Col1IconProbabilityTurnsSiege = document.createElement("div");
  battleUIRow4Col1IconProbabilityTurnsSiege.classList.add("battleUIRow4Col1IconProbabilityTurnsSiege");
  battleUIRow4Col1IconProbabilityTurnsSiege.setAttribute("id","battleUIRow4Col1IconProbabilityTurnsSiege");

  const battleUIRow4Col1TextProbabilityTurnsSiege = document.createElement("div");
  battleUIRow4Col1TextProbabilityTurnsSiege.classList.add("battleUIRow4Col1");
  battleUIRow4Col1TextProbabilityTurnsSiege.setAttribute("id","battleUIRow4Col1TextProbabilityTurnsSiege");

  const battleUIRow4Col1IconSiegeScore = document.createElement("div");
  battleUIRow4Col1IconSiegeScore.classList.add("battleUIRow4Col1IconProbabilityTurnsSiege");
  battleUIRow4Col1IconSiegeScore.setAttribute("id","battleUIRow4Col1IconSiegeScore");

  const battleUIRow4Col1TextSiegeScore = document.createElement("div");
  battleUIRow4Col1TextSiegeScore.classList.add("battleUIRow4Col1");
  battleUIRow4Col1TextSiegeScore.classList.add("battleUIRow4Col1TextWidth");
  battleUIRow4Col1TextSiegeScore.setAttribute("id","battleUIRow4Col1TextSiegeScore");

  const battleUIRow4Col2 = document.createElement("div");
  battleUIRow4Col2.classList.add("battleUIRow4Col2");
  battleUIRow4Col2.setAttribute("id","battleUIRow4Col2");

  const battleUIRow4Col2A = document.createElement("div");
  battleUIRow4Col2A.classList.add("battleUIRow4Col2A");
  battleUIRow4Col2A.setAttribute("id","battleUIRow4Col2A");

  const battleUIRow4Col2B = document.createElement("div");
  battleUIRow4Col2B.classList.add("battleUIRow4Col2B");
  battleUIRow4Col2B.setAttribute("id","battleUIRow4Col2B");

  const battleUIRow4Col2C = document.createElement("div");
  battleUIRow4Col2C.classList.add("battleUIRow4Col2C");
  battleUIRow4Col2C.setAttribute("id","battleUIRow4Col2C");

  const battleUIRow4Col2D = document.createElement("div");
  battleUIRow4Col2D.classList.add("battleUIRow4Col2D");
  battleUIRow4Col2D.setAttribute("id","battleUIRow4Col2D");

  const battleUIRow4Col2E = document.createElement("div");
  battleUIRow4Col2E.classList.add("battleUIRow4Col2E");
  battleUIRow4Col2E.setAttribute("id","battleUIRow4Col2E");

  const battleUIRow4Col2F = document.createElement("div");
  battleUIRow4Col2F.classList.add("battleUIRow4Col2F");
  battleUIRow4Col2F.setAttribute("id","battleUIRow4Col2F");

  const battleUIRow4Col2G = document.createElement("div");
  battleUIRow4Col2G.classList.add("battleUIRow4Col2G");
  battleUIRow4Col2G.setAttribute("id","battleUIRow4Col2G");

  const battleUIRow4Col2H = document.createElement("div");
  battleUIRow4Col2H.classList.add("battleUIRow4Col2H");
  battleUIRow4Col2H.setAttribute("id","battleUIRow4Col2H");

  const siegeButton = document.createElement("button");
  siegeButton.classList.add("siegeButton");
  siegeButton.setAttribute("id","siegeButton");
  siegeButton.innerHTML = "Siege Territory";

  const prodPopIcon = document.createElement("div");
  prodPopIcon.classList.add("battleRow4Icon");
  prodPopIcon.setAttribute("id","prodPopIcon");
  prodPopIcon.innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/prodPopulation.png'>";

  const foodIcon = document.createElement("div");
  foodIcon.classList.add("battleRow4Icon");
  foodIcon.setAttribute("id","foodIcon");
  foodIcon.innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/foodCap.png'>";

  const defenceIcon = document.createElement("div");
  defenceIcon.classList.add("battleRow4Icon");
  defenceIcon.style.display = "flex";
  defenceIcon.setAttribute("id","defenceIcon");
  defenceIcon.innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon.png'>";

  const mountainDefenceIcon = document.createElement("div");
  mountainDefenceIcon.classList.add("battleRow4Icon");
  mountainDefenceIcon.style.display = "flex";
  mountainDefenceIcon.setAttribute("id","mountainDefenceIcon");
  mountainDefenceIcon.innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/mountainDefenceIcon.png'>";

  const prodPopText = document.createElement("div");
  prodPopText.classList.add("battleRow4IconText");
  prodPopText.setAttribute("id","prodPopText");

  const foodText = document.createElement("div");
  foodText.classList.add("battleRow4IconText");
  foodText.setAttribute("id","foodText");

  const defenceBonusText = document.createElement("div");
  defenceBonusText.classList.add("battleRow4IconText");
  defenceBonusText.setAttribute("id","defenceBonusText");

  const mountainDefenceText = document.createElement("div");
  mountainDefenceText.classList.add("battleRow4IconText");
  mountainDefenceText.classList.add("mountainDefenceText");
  mountainDefenceText.setAttribute("id","mountainDefenceText");

  const battleUIRow5 = document.createElement("div");
  battleUIRow5.classList.add("battleUIRow");
  battleUIRow5.classList.add("battleUIRow5");
  battleUIRow5.setAttribute("id","battleUIRow5");

  const retreatButton = document.createElement("button");
  retreatButton.classList.add("retreatButton");
  retreatButton.setAttribute("id","retreatButton");

  const advanceButton = document.createElement("button");
  advanceButton.classList.add("advanceButton");
  advanceButton.setAttribute("id","advanceButton");

  const siegeBottomBarButton  = document.createElement("button");
  siegeBottomBarButton.classList.add("siegeBottomBarButton");
  siegeBottomBarButton.setAttribute("id","siegeBottomBarButton");
  siegeBottomBarButton.innerHTML = "Assault!";

  battleUITitleTitleCol.appendChild(battleUITitleTitleLeft);
  battleUITitleTitleCol.appendChild(battleUITitleTitleCenter);
  battleUITitleTitleCol.appendChild(battleUITitleTitleRight);

  battleUIRow1.appendChild(battleUIRow1FlagCol1);
  battleUIRow1.appendChild(battleUITitleTitleCol);
  battleUIRow1.appendChild(battleUIRow1FlagCol2);

  battleUIRow2.appendChild(probabilityColumnBox);

  armyRowRow1.appendChild(armyRowRow1Icon1);
  armyRowRow1.appendChild(armyRowRow1Icon2);
  armyRowRow1.appendChild(armyRowRow1Icon3);
  armyRowRow1.appendChild(armyRowRow1Icon4);
  armyRowRow1.appendChild(armyRowRow1Icon5);
  armyRowRow1.appendChild(armyRowRow1Icon6);
  armyRowRow1.appendChild(armyRowRow1Icon7);
  armyRowRow1.appendChild(armyRowRow1Icon8);

  armyRowRow2.appendChild(armyRowRow2Quantity1);
  armyRowRow2.appendChild(armyRowRow2Quantity2);
  armyRowRow2.appendChild(armyRowRow2Quantity3);
  armyRowRow2.appendChild(armyRowRow2Quantity4);
  armyRowRow2.appendChild(armyRowRow2Quantity5);
  armyRowRow2.appendChild(armyRowRow2Quantity6);
  armyRowRow2.appendChild(armyRowRow2Quantity7);
  armyRowRow2.appendChild(armyRowRow2Quantity8);

  battleUIRow3.appendChild(armyRowRow1);
  battleUIRow3.appendChild(armyRowRow2);

  battleUIRow4Col2A.appendChild(siegeButton);
  battleUIRow4Col2A.appendChild(prodPopIcon);
  battleUIRow4Col2B.appendChild(prodPopText);
  battleUIRow4Col2C.appendChild(foodIcon);
  battleUIRow4Col2D.appendChild(foodText);
  battleUIRow4Col2E.appendChild(defenceIcon);
  battleUIRow4Col2F.appendChild(defenceBonusText);
  battleUIRow4Col2G.appendChild(mountainDefenceIcon);
  battleUIRow4Col2H.appendChild(mountainDefenceText);

  battleUIRow4Col1.appendChild(battleUIRow4Col1IconProbabilityTurnsSiege);
  battleUIRow4Col1.appendChild(battleUIRow4Col1TextProbabilityTurnsSiege);
  battleUIRow4Col1.appendChild(battleUIRow4Col1IconSiegeScore);
  battleUIRow4Col1.appendChild(battleUIRow4Col1TextSiegeScore);

  battleUIRow4Col2.appendChild(battleUIRow4Col2A);
  battleUIRow4Col2.appendChild(battleUIRow4Col2B);
  battleUIRow4Col2.appendChild(battleUIRow4Col2C);
  battleUIRow4Col2.appendChild(battleUIRow4Col2D);
  battleUIRow4Col2.appendChild(battleUIRow4Col2E);
  battleUIRow4Col2.appendChild(battleUIRow4Col2F);
  battleUIRow4Col2.appendChild(battleUIRow4Col2G);
  battleUIRow4Col2.appendChild(battleUIRow4Col2H);

  battleUIRow4.appendChild(battleUIRow4Col1);
  battleUIRow4.appendChild(battleUIRow4Col2);

  battleUIRow5.appendChild(retreatButton);
  battleUIRow5.appendChild(advanceButton);
  battleUIRow5.appendChild(siegeBottomBarButton);

  battleUIContainer.appendChild(battleUIRow1);
  battleUIContainer.appendChild(battleUIRow2);
  battleUIContainer.appendChild(battleUIRow3);
  battleUIContainer.appendChild(battleUIRow4);
  battleUIContainer.appendChild(battleUIRow5);

  document.getElementById("battleContainer").appendChild(battleUIContainer);

  //BATTLE RESULTS WINDOW
  const battleResultsContainer = document.createElement("div");
  battleResultsContainer.classList.add("blur-background");

  const battleResultsRow1 = document.createElement("div");
  battleResultsRow1.classList.add("battleResultsRow");
  battleResultsRow1.classList.add("battleResultsRow1");
  battleResultsRow1.setAttribute("id","battleResultsRow1");

  const battleResultsRow1FlagCol1 = document.createElement("div");
  battleResultsRow1FlagCol1.classList.add("battleResultsRow1FlagCol1");
  battleResultsRow1FlagCol1.setAttribute("id","battleResultsRow1FlagCol1");

  const battleResultsTitleTitleCol = document.createElement("div");
  battleResultsTitleTitleCol.classList.add("battleResultsTitleTitleCol");
  battleResultsTitleTitleCol.setAttribute("id","battleResultsTitleTitleCol");

  const battleResultsTitleTitleLeft = document.createElement("div");
  battleResultsTitleTitleLeft.classList.add("battleResultsTitleTitleLeft");
  battleResultsTitleTitleLeft.setAttribute("id","battleResultsTitleTitleLeft");

  const battleResultsTitleTitleCenter = document.createElement("div");
  battleResultsTitleTitleCenter.classList.add("battleResultsTitleTitleCenter");
  battleResultsTitleTitleCenter.setAttribute("id","battleResultsTitleTitleCenter");

  const battleResultsTitleTitleRight = document.createElement("div");
  battleResultsTitleTitleRight.classList.add("battleResultsTitleTitleRight");
  battleResultsTitleTitleRight.setAttribute("id","battleResultsTitleTitleRight");

  const battleResultsRow1FlagCol2 = document.createElement("div");
  battleResultsRow1FlagCol2.classList.add("battleResultsRow1FlagCol2");
  battleResultsRow1FlagCol2.setAttribute("id","battleResultsRow1FlagCol2");

  const battleResultsRow2 = document.createElement("div");
  battleResultsRow2.classList.add("battleResultsRow");
  battleResultsRow2.classList.add("battleResultsRow2");
  battleResultsRow2.setAttribute("id","battleResultsRow2");

  const battleResultsRow2Row1 = document.createElement("div");
  battleResultsRow2Row1.classList.add("battleResultsRow2Row1");
  battleResultsRow2Row1.setAttribute("id","battleResultsRow2Row1");

  const battleResultsRow2Row1Icon1 = document.createElement("div");
  battleResultsRow2Row1Icon1.classList.add("battleResultsRow2Row1Icon");
  battleResultsRow2Row1Icon1.setAttribute("id","battleResultsRow2Row1Icon1");
  battleResultsRow2Row1Icon1.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/infantry.png'>";

  const battleResultsRow2Row1Icon2 = document.createElement("div");
  battleResultsRow2Row1Icon2.classList.add("battleResultsRow2Row1Icon");
  battleResultsRow2Row1Icon2.setAttribute("id","battleResultsRow2Row1Icon2");
  battleResultsRow2Row1Icon2.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/assault.png'>";

  const battleResultsRow2Row1Icon3 = document.createElement("div");
  battleResultsRow2Row1Icon3.classList.add("battleResultsRow2Row1Icon");
  battleResultsRow2Row1Icon3.setAttribute("id","battleResultsRow2Row1Icon3");
  battleResultsRow2Row1Icon3.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/air.png'>";

  const battleResultsRow2Row1Icon4 = document.createElement("div");
  battleResultsRow2Row1Icon4.classList.add("battleResultsRow2Row1Icon");
  battleResultsRow2Row1Icon4.setAttribute("id","battleResultsRow2Row1Icon4");
  battleResultsRow2Row1Icon4.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/naval.png'>";

  const battleResultsRow2Row1Icon5 = document.createElement("div");
  battleResultsRow2Row1Icon5.classList.add("battleResultsRow2Row1Icon");
  battleResultsRow2Row1Icon5.setAttribute("id","battleResultsRow2Row1Icon5");
  battleResultsRow2Row1Icon5.classList.add("battleResultsRowDivider");
  battleResultsRow2Row1Icon5.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/infantry.png'>";

  const battleResultsRow2Row1Icon6 = document.createElement("div");
  battleResultsRow2Row1Icon6.classList.add("battleResultsRow2Row1Icon");
  battleResultsRow2Row1Icon6.setAttribute("id","battleResultsRow2Row1Icon6");
  battleResultsRow2Row1Icon6.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/assault.png'>";

  const battleResultsRow2Row1Icon7 = document.createElement("div");
  battleResultsRow2Row1Icon7.classList.add("battleResultsRow2Row1Icon");
  battleResultsRow2Row1Icon7.setAttribute("id","battleResultsRow2Row1Icon7");
  battleResultsRow2Row1Icon7.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/air.png'>";

  const battleResultsRow2Row1Icon8 = document.createElement("div");
  battleResultsRow2Row1Icon8.classList.add("battleResultsRow2Row1Icon");
  battleResultsRow2Row1Icon8.setAttribute("id","battleResultsRow2Row1Icon8");
  battleResultsRow2Row1Icon8.innerHTML = "<img class='sizingPositionArmyIconsBattleUI' src='./resources/naval.png'>";

  const battleResultsRow2Row2 = document.createElement("div");
  battleResultsRow2Row2.classList.add("battleResultsRow2Row2");
  battleResultsRow2Row2.setAttribute("id","battleResultsRow2Row2");

  const battleResultsRow2Row2Quantity1 = document.createElement("div");
  battleResultsRow2Row2Quantity1.classList.add("battleResultsRow2Row2Quantity");
  battleResultsRow2Row2Quantity1.setAttribute("id","battleResultsRow2Row2Quantity1");

  const battleResultsRow2Row2Quantity2 = document.createElement("div");
  battleResultsRow2Row2Quantity2.classList.add("battleResultsRow2Row2Quantity");
  battleResultsRow2Row2Quantity2.setAttribute("id","battleResultsRow2Row2Quantity2");

  const battleResultsRow2Row2Quantity3 = document.createElement("div");
  battleResultsRow2Row2Quantity3.classList.add("battleResultsRow2Row2Quantity");
  battleResultsRow2Row2Quantity3.setAttribute("id","battleResultsRow2Row2Quantity3");

  const battleResultsRow2Row2Quantity4 = document.createElement("div");
  battleResultsRow2Row2Quantity4.classList.add("battleResultsRow2Row2Quantity");
  battleResultsRow2Row2Quantity4.setAttribute("id","battleResultsRow2Row2Quantity4");

  const battleResultsRow2Row2Quantity5 = document.createElement("div");
  battleResultsRow2Row2Quantity5.classList.add("battleResultsRow2Row2Quantity");
  battleResultsRow2Row2Quantity5.classList.add("battleResultsRowDivider");
  battleResultsRow2Row2Quantity5.setAttribute("id","battleResultsRow2Row2Quantity5");

  const battleResultsRow2Row2Quantity6 = document.createElement("div");
  battleResultsRow2Row2Quantity6.classList.add("battleResultsRow2Row2Quantity");
  battleResultsRow2Row2Quantity6.setAttribute("id","battleResultsRow2Row2Quantity6");

  const battleResultsRow2Row2Quantity7 = document.createElement("div");
  battleResultsRow2Row2Quantity7.classList.add("battleResultsRow2Row2Quantity");
  battleResultsRow2Row2Quantity7.setAttribute("id","battleResultsRow2Row2Quantity7");

  const battleResultsRow2Row2Quantity8 = document.createElement("div");
  battleResultsRow2Row2Quantity8.classList.add("battleResultsRow2Row2Quantity");
  battleResultsRow2Row2Quantity8.setAttribute("id","battleResultsRow2Row2Quantity8");

  const battleResultsRow2Row3 = document.createElement("div");
  battleResultsRow2Row3.classList.add("battleResultsRow2Row3");
  battleResultsRow2Row3.setAttribute("id","battleResultsRow2Row3");

  const battleResultsRow2Row3Losses = document.createElement("div");
  battleResultsRow2Row3Losses.classList.add("battleResultsRow2Row3Column");
  battleResultsRow2Row3Losses.setAttribute("id","battleResultsRow2Row3Losses");
  battleResultsRow2Row3Losses.innerHTML = "Losses";

  const battleResultsRow2Row3Kills = document.createElement("div");
  battleResultsRow2Row3Kills.classList.add("battleResultsRow2Row3Column");
  battleResultsRow2Row3Kills.classList.add("battleResultsRowDivider");
  battleResultsRow2Row3Kills.setAttribute("id","battleResultsRow2Row3Kills");
  battleResultsRow2Row3Kills.innerHTML = "Kills";

  const battleResultsRow3 = document.createElement("div");
  battleResultsRow3.classList.add("battleResultsRow");
  battleResultsRow3.classList.add("battleResultsRow3");
  battleResultsRow3.setAttribute("id","battleResultsRow3");

  const battleResultsRow3Row1 = document.createElement("div");
  battleResultsRow3Row1.classList.add("battleResultsRow3Row1");
  battleResultsRow3Row1.setAttribute("id","battleResultsRow3Row1");

  const battleResultsRow3Row1Quantity1 = document.createElement("div");
  battleResultsRow3Row1Quantity1.classList.add("battleResultsRow3Row1Quantity");
  battleResultsRow3Row1Quantity1.setAttribute("id","battleResultsRow3Row1Quantity1");

  const battleResultsRow3Row1Quantity2 = document.createElement("div");
  battleResultsRow3Row1Quantity2.classList.add("battleResultsRow3Row1Quantity");
  battleResultsRow3Row1Quantity2.setAttribute("id","battleResultsRow3Row1Quantity2");

  const battleResultsRow3Row1Quantity3 = document.createElement("div");
  battleResultsRow3Row1Quantity3.classList.add("battleResultsRow3Row1Quantity");
  battleResultsRow3Row1Quantity3.setAttribute("id","battleResultsRow3Row1Quantity3");

  const battleResultsRow3Row1Quantity4 = document.createElement("div");
  battleResultsRow3Row1Quantity4.classList.add("battleResultsRow3Row1Quantity");
  battleResultsRow3Row1Quantity4.setAttribute("id","battleResultsRow3Row1Quantity4");

  const battleResultsRow3Row1Quantity5 = document.createElement("div");
  battleResultsRow3Row1Quantity5.classList.add("battleResultsRow3Row1Quantity");
  battleResultsRow3Row1Quantity5.classList.add("battleResultsRowDivider");
  battleResultsRow3Row1Quantity5.setAttribute("id","battleResultsRow3Row1Quantity5");

  const battleResultsRow3Row1Quantity6 = document.createElement("div");
  battleResultsRow3Row1Quantity6.classList.add("battleResultsRow3Row1Quantity");
  battleResultsRow3Row1Quantity6.setAttribute("id","battleResultsRow3Row1Quantity6");

  const battleResultsRow3Row1Quantity7 = document.createElement("div");
  battleResultsRow3Row1Quantity7.classList.add("battleResultsRow3Row1Quantity");
  battleResultsRow3Row1Quantity7.setAttribute("id","battleResultsRow3Row1Quantity7");

  const battleResultsRow3Row1Quantity8 = document.createElement("div");
  battleResultsRow3Row1Quantity8.classList.add("battleResultsRow3Row1Quantity");
  battleResultsRow3Row1Quantity8.setAttribute("id","battleResultsRow3Row1Quantity8");

  const battleResultsRow3Row2 = document.createElement("div");
  battleResultsRow3Row2.classList.add("battleResultsRow3Row2");
  battleResultsRow3Row2.setAttribute("id","battleResultsRow3Row2");

  const battleResultsRow3Row2Survived = document.createElement("div");
  battleResultsRow3Row2Survived.classList.add("battleResultsRow3Row2Column");
  battleResultsRow3Row2Survived.setAttribute("id","battleResultsRow3Row2Survived");
  battleResultsRow3Row2Survived.innerHTML = "Survived";

  const battleResultsRow3Row2Captured = document.createElement("div");
  battleResultsRow3Row2Captured.classList.add("battleResultsRow3Row2Column");
  battleResultsRow3Row2Captured.classList.add("battleResultsRowDivider");
  battleResultsRow3Row2Captured.setAttribute("id","battleResultsRow3Row2Captured");
  battleResultsRow3Row2Captured.innerHTML = "Captured";

  const battleResultsRow3Row3 = document.createElement("div");
  battleResultsRow3Row3.classList.add("battleResultsRow3Row3");
  battleResultsRow3Row3.setAttribute("id","battleResultsRow3Row3");

  const battleResultsRow3Row3RoundsCount= document.createElement("div");
  battleResultsRow3Row3RoundsCount.classList.add("battleResultsRow3Row3Column");
  battleResultsRow3Row3RoundsCount.setAttribute("id","battleResultsRow3Row3RoundsCount");

  const battleResultsRow3Row3SiegeStats = document.createElement("div");
  battleResultsRow3Row3SiegeStats.classList.add("battleResultsRow3Row3ColumnSiege");
  battleResultsRow3Row3SiegeStats.classList.add("battleResultsRowDivider");
  battleResultsRow3Row3SiegeStats.setAttribute("id","battleResultsRow3Row3SiegeStats");
  battleResultsRow3Row3SiegeStats.innerHTML = "Sieged: "; ///remove when doing siege stuff

  const battleResultsRow4 = document.createElement("button");
  battleResultsRow4.classList.add("battleResultsRow");
  battleResultsRow4.classList.add("battleResultsRow4");
  battleResultsRow4.setAttribute("id","battleResultsRow4");

  battleResultsTitleTitleCol.appendChild(battleResultsTitleTitleLeft);
  battleResultsTitleTitleCol.appendChild(battleResultsTitleTitleCenter);
  battleResultsTitleTitleCol.appendChild(battleResultsTitleTitleRight);

  battleResultsRow1.appendChild(battleResultsRow1FlagCol1);
  battleResultsRow1.appendChild(battleResultsTitleTitleCol);
  battleResultsRow1.appendChild(battleResultsRow1FlagCol2);

  battleResultsRow2Row1.appendChild(battleResultsRow2Row1Icon1);
  battleResultsRow2Row1.appendChild(battleResultsRow2Row1Icon2);
  battleResultsRow2Row1.appendChild(battleResultsRow2Row1Icon3);
  battleResultsRow2Row1.appendChild(battleResultsRow2Row1Icon4);
  battleResultsRow2Row1.appendChild(battleResultsRow2Row1Icon5);
  battleResultsRow2Row1.appendChild(battleResultsRow2Row1Icon6);
  battleResultsRow2Row1.appendChild(battleResultsRow2Row1Icon7);
  battleResultsRow2Row1.appendChild(battleResultsRow2Row1Icon8);

  battleResultsRow2Row2.appendChild(battleResultsRow2Row2Quantity1);
  battleResultsRow2Row2.appendChild(battleResultsRow2Row2Quantity2);
  battleResultsRow2Row2.appendChild(battleResultsRow2Row2Quantity3);
  battleResultsRow2Row2.appendChild(battleResultsRow2Row2Quantity4);
  battleResultsRow2Row2.appendChild(battleResultsRow2Row2Quantity5);
  battleResultsRow2Row2.appendChild(battleResultsRow2Row2Quantity6);
  battleResultsRow2Row2.appendChild(battleResultsRow2Row2Quantity7);
  battleResultsRow2Row2.appendChild(battleResultsRow2Row2Quantity8);

  battleResultsRow2Row3.appendChild(battleResultsRow2Row3Losses);
  battleResultsRow2Row3.appendChild(battleResultsRow2Row3Kills);

  battleResultsRow2.appendChild(battleResultsRow2Row1);
  battleResultsRow2.appendChild(battleResultsRow2Row2);
  battleResultsRow2.appendChild(battleResultsRow2Row3);
  
  battleResultsRow3Row3.appendChild(battleResultsRow3Row3RoundsCount);
  battleResultsRow3Row3.appendChild(battleResultsRow3Row3SiegeStats);

  battleResultsRow3Row2.appendChild(battleResultsRow3Row2Survived);
  battleResultsRow3Row2.appendChild(battleResultsRow3Row2Captured);

  battleResultsRow3Row1.appendChild(battleResultsRow3Row1Quantity1);
  battleResultsRow3Row1.appendChild(battleResultsRow3Row1Quantity2);
  battleResultsRow3Row1.appendChild(battleResultsRow3Row1Quantity3);
  battleResultsRow3Row1.appendChild(battleResultsRow3Row1Quantity4);
  battleResultsRow3Row1.appendChild(battleResultsRow3Row1Quantity5);
  battleResultsRow3Row1.appendChild(battleResultsRow3Row1Quantity6);
  battleResultsRow3Row1.appendChild(battleResultsRow3Row1Quantity7);
  battleResultsRow3Row1.appendChild(battleResultsRow3Row1Quantity8);

  battleResultsRow3.appendChild(battleResultsRow3Row1);
  battleResultsRow3.appendChild(battleResultsRow3Row2);
  battleResultsRow3.appendChild(battleResultsRow3Row3);

  battleResultsContainer.appendChild(battleResultsRow1);
  battleResultsContainer.appendChild(battleResultsRow2);
  battleResultsContainer.appendChild(battleResultsRow3);
  battleResultsContainer.appendChild(battleResultsRow4);

  document.getElementById("battleResultsContainer").appendChild(battleResultsContainer);

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
    
    // Search the siegeObject for the warId
    for (let territoryName in siegeObject) {
      if (siegeObject.hasOwnProperty(territoryName) && siegeObject[territoryName].warId === currentWarId) {
        currentWarAlreadyInSiegeMode = true;
        break;
      }
    }
    
    //turn off battle ui and activate map again
    toggleBattleUI(false, true);
    battleUIDisplayed = false;
    toggleUIButton(true);
    uiButtonCurrentlyOnScreen = true;
    toggleBottomLeftPaneWithTurnAdvance(true);
    bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;

    if (!currentWarAlreadyInSiegeMode) {
      let territoryToAddToSiege = addRemoveWarSiegeObject(0, currentWarId, battleStart); // add to siege
      let mainArrayElementForSiege = setMainArrayToArmyRemaining(getSiegeObjectFromObject(territoryToAddToSiege));
      writeBottomTableInformation(mainArrayElementForSiege, true, null);

      for (let i = 0; i < paths.length; i++) {
        //set in siege mode on svg
        if (paths[i].getAttribute("territory-name") === territoryToAddToSiege.territoryName) {
            paths[i].setAttribute("underSiege", "true");
        }
      }

      //set graphics for territory under siege (include defense bonus)
      addImageToPath(territoryAboutToBeAttackedOrSieged, "siege.png", true);
      svgMap.getElementById("attackImage").remove();

      currentMapColorAndStrokeArray = saveMapColorState(false);
    }
});

//click handler for retreat button
retreatButton.addEventListener('click', function() {
    lastClickedPath.setAttribute("fill", fillPathBasedOnContinent(lastClickedPath));
    lastClickedPath.style.stroke = "rgb(0,0,0)";
    lastClickedPath.setAttribute("stroke-width", "1");
    lastClickedPath.style.strokeDasharray = "none";
    let defendingTerritoryRetreatClick; 
    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === territoryAboutToBeAttackedOrSieged.getAttribute("uniqueid")) {
            defendingTerritoryRetreatClick = mainArrayOfTerritoriesAndResources[i];
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
            if (!battleStart) {
                setNewWarOnRetrievalArray(currentWarId, warArrayToRetrieveLater, currentTurn, 1);
                proportionsOfAttackArray.length = 0;

                defendingTerritoryRetreatClick.infantryForCurrentTerritory = defendingArmyRemaining[0];
                defendingTerritoryRetreatClick.assaultForCurrentTerritory = defendingArmyRemaining[1];
                defendingTerritoryRetreatClick.airForCurrentTerritory = defendingArmyRemaining[2];
                defendingTerritoryRetreatClick.navalForCurrentTerritory = defendingArmyRemaining[3];
                defendingTerritoryRetreatClick.armyForCurrentTerritory = defendingTerritoryRetreatClick.infantryForCurrentTerritory + (defendingTerritoryRetreatClick.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (defendingTerritoryRetreatClick.airForCurrentTerritory * vehicleArmyWorth.air) + (defendingTerritoryRetreatClick.navalForCurrentTerritory * vehicleArmyWorth.naval);
                //update top table army value when leaving battle

            } else {
                addWarToHistoricWarArray("Retreat", 0, true);
            }

            if (battleUIState === 1) { //removing a siege
                let war = getSiegeObjectFromPath(territoryAboutToBeAttackedOrSieged);
                if (war) { //handle case where retreat after coming back from a siege
                    addRemoveWarSiegeObject(1, war.warId); // remove war from siegeArray and add to historic array
                    removeSiegeImageFromPath(territoryAboutToBeAttackedOrSieged);
                    territoryAboutToBeAttackedOrSieged.setAttribute("underSiege", "false"); //remove siege mode in svg 
                    //army is restored already by assignProportionsToTerritories in case "0" 
                } 
            }
            //update bottom table for defender
            document.getElementById("bottom-table").rows[0].cells[17].innerHTML = formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory);
            break;
        case 1: //scatter during round of 5, 30% penalty
            defeatType = "defeat";
            for (let i = 0; i < attackingArmyRemaining.length; i++) {
                attackingArmyRemaining[i] = Math.floor(attackingArmyRemaining[i] * multiplierForScatterLoss); //apply penalty
            }
            setNewWarOnRetrievalArray(currentWarId, warArrayToRetrieveLater, currentTurn, 2);
            proportionsOfAttackArray.length = 0;

            defendingTerritoryRetreatClick.infantryForCurrentTerritory = defendingArmyRemaining[0];
            defendingTerritoryRetreatClick.assaultForCurrentTerritory = defendingArmyRemaining[1];
            defendingTerritoryRetreatClick.airForCurrentTerritory = defendingArmyRemaining[2];
            defendingTerritoryRetreatClick.navalForCurrentTerritory = defendingArmyRemaining[3];
            defendingTerritoryRetreatClick.armyForCurrentTerritory = defendingTerritoryRetreatClick.infantryForCurrentTerritory + (defendingTerritoryRetreatClick.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (defendingTerritoryRetreatClick.airForCurrentTerritory * vehicleArmyWorth.air) + (defendingTerritoryRetreatClick.navalForCurrentTerritory * vehicleArmyWorth.naval);

            document.getElementById("bottom-table").rows[0].cells[17].innerHTML = formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory);
            break;
        case 2: //defeat
        if (defendingArmyRemaining[4] === 0) { //all out defeat
            defeatType = "defeat";
            defendingTerritoryRetreatClick.infantryForCurrentTerritory = defendingArmyRemaining[0];
            defendingTerritoryRetreatClick.assaultForCurrentTerritory = defendingArmyRemaining[1];
            defendingTerritoryRetreatClick.airForCurrentTerritory = defendingArmyRemaining[2];
            defendingTerritoryRetreatClick.navalForCurrentTerritory = defendingArmyRemaining[3];
            defendingTerritoryRetreatClick.armyForCurrentTerritory = defendingTerritoryRetreatClick.infantryForCurrentTerritory + (defendingTerritoryRetreatClick.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (defendingTerritoryRetreatClick.airForCurrentTerritory * vehicleArmyWorth.air) + (defendingTerritoryRetreatClick.navalForCurrentTerritory * vehicleArmyWorth.naval);
            //update bottom table for defender
            document.getElementById("bottom-table").rows[0].cells[17].innerHTML = formatNumbersToKMB(defendingTerritory.armyForCurrentTerritory);
        } else if (defendingArmyRemaining[4] === 1) { //routing defeat
            defeatType = "defeat";
            defendingTerritoryRetreatClick.infantryForCurrentTerritory = defendingArmyRemaining[0] + (Math.floor(attackingArmyRemaining[0] * 0.5));
            defendingTerritoryRetreatClick.assaultForCurrentTerritory = defendingArmyRemaining[1] + (Math.floor(attackingArmyRemaining[1] * 0.5));
            defendingTerritoryRetreatClick.airForCurrentTerritory = defendingArmyRemaining[2] + (Math.floor(attackingArmyRemaining[2] * 0.5));
            defendingTerritoryRetreatClick.navalForCurrentTerritory = defendingArmyRemaining[3] + (Math.floor(attackingArmyRemaining[3] * 0.5));
            defendingTerritoryRetreatClick.armyForCurrentTerritory = defendingTerritoryRetreatClick.infantryForCurrentTerritory + (defendingTerritoryRetreatClick.assaultForCurrentTerritory * vehicleArmyWorth.assault) + (defendingTerritoryRetreatClick.airForCurrentTerritory * vehicleArmyWorth.air) + (defendingTerritoryRetreatClick.navalForCurrentTerritory * vehicleArmyWorth.naval);
            //update bottom table for defender
            document.getElementById("bottom-table").rows[0].cells[17].innerHTML = formatNumbersToKMB(defendingTerritoryRetreatClick.armyForCurrentTerritory);
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
        currentWarFlagString = territoryAboutToBeAttackedOrSieged.getAttribute("data-name");
    }
    populateWarResultPopup(1, attackCountry, defendTerritory, defeatType, false); //lost
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable(1);
});

//click handler for advance button
advanceButton.addEventListener('click', function() {
    let currentRound = getCurrentRound();
    let attackingArmyRemaining = getAttackingArmyRemaining();
    console.log("firstSetOfRounds was: " + firstSetOfRounds);
    switch (advanceButtonState) {
        case 0: //before battle to start it
            toggleDiceCanvas(true);
            playSoundClip("click");
            battleStart = false;
            let hasSiegedBefore = historicWars.some((siege) => siege.warId === currentWarId);
            if (!hasSiegedBefore) {
                transferArmyOutOfTerritoryOnStartingInvasion(getFinalAttackArray(), mainArrayOfTerritoriesAndResources);
            }
            setCurrentRound(currentRound + 1);
            if (hasSiegedBefore) {
            let war = historicWars.find((siege) => siege.warId === currentWarId);
                let siegeAttackArray = [];
                siegeAttackArray.push(territoryAboutToBeAttackedOrSieged.getAttribute("uniqueid"));
                siegeAttackArray.push(war.proportionsAttackers[0][0]); //add any territory to make it work
                for (let i = 0; i < war.attackingArmyRemaining.length; i++) {
                    siegeAttackArray.push(war.attackingArmyRemaining[i]);
                }
                setFinalAttackArray(siegeAttackArray);
                setupBattle(probability, getFinalAttackArray(), mainArrayOfTerritoriesAndResources);
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
                resetThreeCannonDiceScene();
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
                let hasSiegedBefore = historicWars.some((siege) => siege.warId === currentWarId);
                if (hasSiegedBefore) {
                    enableDisableSiegeButton(1);
                } else {
                    enableDisableSiegeButton(0);
                }                
            } else { //start new round
                if (advanceButton.innerHTML === "Start Attack!" || advanceButton.innerHTML === "Begin War!") {
                    advanceButton.innerHTML === "Start Attack!" ? playSoundClip("dice1") : playSoundClip("click");
                    roundCounterForStats++;
                    enableDisableSiegeButton(1);
                } else {
                    let diceSound = Math.random() < 0.5;
                    diceSound ? playSoundClip("dice1") : playSoundClip("dice2");
                }
                advanceButtonState = 1;
                setAdvanceButtonText(advanceButtonState, advanceButton);
                retreatButtonState = 1;
                setRetreatButtonText(retreatButtonState, retreatButton);
                let hasSiegedBefore = historicWars.some((siege) => siege.warId === currentWarId);
                if (hasSiegedBefore) {
                    let war = historicWars.find((siege) => siege.warId === currentWarId);
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
            addUpAllTerritoryResourcesForCountryAndWriteToTopTable(1);
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
            toggleBottomLeftPaneWithTurnAdvance(true);
            bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
            break;

    }
    if (territoryAboutToBeAttackedOrSieged) {
        currentWarFlagString = territoryAboutToBeAttackedOrSieged.getAttribute("data-name");
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
    territoryAboutToBeAttackedOrSieged.setAttribute("underSiege", "false"); //remove siege mode in svg   
    //setup  battle to conquer territory
    enableDisableSiegeButton(1); //disable siege button at start
    let siegeAttackArray = [];
    siegeAttackArray.push(territoryAboutToBeAttackedOrSieged.getAttribute("uniqueid"));
    siegeAttackArray.push(war.proportionsAttackers[war.warId][0]); //add any territory to make the setupBattleUI function work, we have the individual proportions and territories in the proportionsAttackers part of siegeObject
    for (let i = 0; i < war.attackingArmyRemaining.length; i++) {
        siegeAttackArray.push(war.attackingArmyRemaining[i]);
    }
    
    setupBattleUI(siegeAttackArray);
    setTimeout(function() {
        eventHandlerExecuted = false;
    }, 200);
});

let confirmButtonBattleResults = document.getElementById("battleResultsRow4");

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
        if (!historicWars.some(war => war.warId === currentWarId)) {
            addWarToHistoricWarArray(getResolution(), warId, false);
        }
    }
    playSoundClip("click");
    toggleBattleResults(false);
    battleResultsDisplayed = false;
    toggleUIButton(true);
    toggleBottomLeftPaneWithTurnAdvance(true);

    if (svgMap.getElementById("attackImage")) {
        svgMap.getElementById("attackImage").remove();
    }
    currentMapColorAndStrokeArray = saveMapColorState(false);     
});

  pageLoaded = true;
});

document.addEventListener("keydown", function() {
  setUnsetMenuOnEscape();
});

function adjustTextToFit(elementId, text) {
  const element = elementId;
  const maxWidth = element.offsetWidth;
  const maxHeight = element.offsetHeight;
  let fontSize = 35; // starting font size
  let words = text.split(' ');

  while (fontSize > 12) {
      const lines = [];
      let currentLine = '';
      let lineCount = 0;

      // loop through words and distribute them over lines
      for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = currentLine + ' ' + word;
          const testWidth = getTextWidth(testLine, fontSize);

          if (testWidth > maxWidth && i > 0) {
              lines.push(currentLine.trim());
              currentLine = word;
              lineCount++;
          } else {
              currentLine = testLine;
          }

          // if we've reached the maximum number of lines, break out of loop
          if (lineCount === 3) {
              break;
          }
      }

      lines.push(currentLine.trim());

      // if the text fits within the maximum height and the number of lines is within the range we want, break out of loop
      if (getTextHeight(lines, fontSize) <= maxHeight && (lines.length === 1 || lines.length === 2 || lines.length === 3)) {
          break;
      } else {
          fontSize--;
      }
  }

  // set the font size and text content
  element.style.fontSize = fontSize + 'px';
  element.textContent = words.join(' ');
}

// helper function to calculate the width of a given text at a given font size
function getTextWidth(text, fontSize) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = fontSize + 'px Arial';
  return context.measureText(text).width;
}

// helper function to calculate the height of a given text at a given font size
function getTextHeight(lines, fontSize) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = fontSize + 'px Arial';
  const lineHeight = fontSize * 1.2;
  return lines.length * lineHeight;
}

function findClosestPaths(targetPath) {
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
              path.getAttribute("data-name") === targetPath.getAttribute("data-name")
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
      path.getAttribute("data-name") === targetPath.getAttribute("data-name") &&
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

function HighlightInteractableCountriesAfterSelectingOne(targetPath, destCoordsArray, destinationPathObjectArray, distances, attacking) {
    if (targetPath.getAttribute("deactivated") === "true"){
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
  
    manualExceptionsArray = findMatchingCountries(targetPath, 1); //set up manual exceptions for this targetPath
    manualDenialArray = findMatchingCountries(targetPath, 0); //set up denial countries

    destinationPathObjectArray = removeDeniedDestinations(destinationPathObjectArray, manualDenialArray); //remove denied countries (manual exception)
  
    if (manualExceptionsArray.length > 0) { //works correctly
        for (let i = 0; i < manualExceptionsArray.length; i++) {
            tempValidDestinationsArray.push(changeCountryColor(manualExceptionsArray[i], false, "pattern", count, attacking)[0]); //change color of touching country's
            count++;
        }
    }
  
    for (let i = 0; i < destinationPathObjectArray.length; i++) {
        const targetName = targetPath.getAttribute("data-name");
        const destName = destinationPathObjectArray[i].getAttribute("data-name");
  
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
  
                if (targetPath.getAttribute("data-name") === destObjJ.getAttribute("data-name")) {
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
                paths[i].setAttribute("attackableTerritory", "true");
            }

        }

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
      pattern.setAttribute('id', 'diagonal-lines' + count);
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
      line2.setAttribute('stroke', playerColour);
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

  if (place !== 4 && place !== 5 && place !== 6 && place !== 7) {
    img.classList.add("flag");
  }

  img.src = `./resources/flags/${flag}.png`;

  let popupBodyElement = document.getElementById("popup-body");
  if (place === 1) { //top table
      flagElement = document.getElementById("flag-top");
  } else if (place === 2) { //bottom table
      flagElement = document.getElementById("flag-bottom");
  } else if (place === 3) { //UI info panel
      flagElement = document.getElementById("info-panel");
      document.querySelector(".info-panel").style.setProperty('--bg-image', `url(${img.src})`);
      document.querySelector(".info-panel-upgrade").style.setProperty('--bg-image', `url(${img.src})`);
  } else if (place === 4) { //Battle UI attacker
    flagElement = document.getElementById("battleUITitleFlagCol1");
    img.style.width = "100%";
  } else if (place === 5) { //Battle UI defender
    flagElement = document.getElementById("battleUITitleFlagCol2");
    img.style.width = "100%";
  } else if (place === 6) { //Battle Results UI attacker
    flagElement = document.getElementById("battleResultsRow1FlagCol1");
    img.style.width = "100%";
  } else if (place === 7) { //Battle Results UI defender
    flagElement = document.getElementById("battleResultsRow1FlagCol2");
    img.style.width = "100%";
    img.src = `./resources/flags/${currentWarFlagString}.png`; //workaround for battle results screen defender flag issue
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

function uiButtons(button) {
    if (button === summaryButton) {
        summaryButton.classList.add("active");
        territoryButton.classList.remove("active");
        armyButton.classList.remove("active");
        warsSiegesButton.classList.remove("active");
    } else if (button === territoryButton) {
        summaryButton.classList.remove("active");
        territoryButton.classList.add("active");
        armyButton.classList.remove("active");
        warsSiegesButton.classList.remove("active");
    } else if (button === armyButton) {
        summaryButton.classList.remove("active");
        territoryButton.classList.remove("active");
        armyButton.classList.add("active");
        warsSiegesButton.classList.remove("active");
    } else if (button === warsSiegesButton) {
        summaryButton.classList.remove("active");
        territoryButton.classList.remove("active");
        armyButton.classList.remove("active");
        warsSiegesButton.classList.add("active");
    }
}

function colorMapAtBeginningOfGame() {
  paths.forEach(path => {
      const continent = path.getAttribute("continent");
      const color = continentColorArray.find(item => item[0] === continent)[1];
      path.setAttribute("fill", `rgb(${color[0]},${color[1]},${color[2]})`);
  });
}

function hoverOverTerritory(territory, mouseAction, arrayOfSelectedCountries = []) {
  if (territory.hasAttribute("fill")) {
      let fillValue = territory.getAttribute("fill");
      let rgbValues = fillValue.match(/\d+/g).map(Number);
      let [r, g, b] = rgbValues;
      if (mouseAction === "mouseOver" && r <= 254 && g <= 254 && b <= 254) { //this handles color change when hovering (doesn't run on selected or interactable territories)
          hoveredNonInteractableAndNonSelectedTerritory = true;
          r += 20;
          g += 20;
          b += 20;
          territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
      } else if (mouseAction === "mouseOut" && r <= 254 && g <= 254 && b <= 254) { //this handles color change when leaving a hover (doesn't run on selected or interactable territories)
          hoveredNonInteractableAndNonSelectedTerritory = false;
          r -= 20;
          g -= 20;
          b -= 20;
          if (selectCountryPlayerState && territory === currentSelectedPath) {
            territory.setAttribute("fill", playerColour);
          } else {
            territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
          }
      } else if (mouseAction === "clickCountry") { //this returns colors back to their original state after deselecting by selecting another, either white if interactable by both the previous and new selected areas, or back to owner color if not accessible by new selected area
          if (arrayOfSelectedCountries.length > 0) {
              for (let i = 0; i < arrayOfSelectedCountries.length; i++) {
                  let rGBValuesToReplace = arrayOfSelectedCountries[i][1];
                  arrayOfSelectedCountries[i][0].setAttribute("fill", rGBValuesToReplace);
                  if (arrayOfSelectedCountries[i][0].getAttribute("deactivated") ==="false" && arrayOfSelectedCountries[i][0].getAttribute("underSiege") ==="false") {
                    setStrokeWidth(arrayOfSelectedCountries[i][0], "1");
                  }
              }
          }
      }
  }
}

export function saveMapColorState(onResourcePage) {
  const stateArray = [];

  for (let i = 0; i < paths.length; i++) {
      const uniqueId = paths[i].getAttribute('uniqueid');
      const fillValue = paths[i].getAttribute('fill');
      const strokeWidthValue = paths[i].getAttribute('stroke-width');

      if (uniqueId && fillValue && strokeWidthValue) {
          stateArray.push([uniqueId, fillValue, strokeWidthValue]);
      }
  }

  if (onResourcePage) {
      currentMapColorAndStrokeArray = stateArray;
  } else {
      return stateArray;
  }
}

function restoreMapColorState(array, countrySelectionState) {
  if (validDestinationsArray !== undefined) {
      validDestinationsArray.length = 0;
  }

  currentlySelectedColorsArray.length = 0;

  paths.forEach(path => {
      for (let i = 0; i < array.length; i++) {
          if (array[i][0] === path.getAttribute("uniqueid")) {
              if (countrySelectionState) {
                  if (path.getAttribute("data-name") !== currentSelectedPath.getAttribute("data-name")) {
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

export function fillPathBasedOnContinent(path) {
  const continentAttribute = path.getAttribute("continent");
  const entry = continentColorArray.find(
      entry => entry[0].toLowerCase() === continentAttribute.toLowerCase()
  );
  if (entry) {
      const color = entry[1];
      return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }
}

function randomiseColorsOfPathsOnLoad() {
  let randomRgbValue;

  paths.forEach(path => {
      randomRgbValue = generateRandomRGB();
      path.setAttribute("fill", randomRgbValue);
  });
}

function generateRandomRGB() {
  const val1 = Math.floor(Math.random() * 235) + 1;
  const val2 = Math.floor(Math.random() * 235) + 1;
  const val3 = Math.floor(Math.random() * 235) + 1;
  return `rgb(${val1}, ${val2}, ${val3})`;
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

function assignTeamAndFillColorToSVGPaths(colorArray) {
  // Calculate the number of paths per group
  const numPaths = paths.length;
  const numGroups = colorArray.length;
  const pathsPerGroup = Math.floor(numPaths / numGroups);
  const remainder = numPaths % numGroups;

  // Assign a random number to each path element
  const assignedNumbers = Array.from({
      length: numPaths
  }, (_, i) => i);
  for (let i = assignedNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [assignedNumbers[i], assignedNumbers[j]] = [assignedNumbers[j], assignedNumbers[i]];
  }

  // Assign "fill" and "Team" attributes to each path element based on assigned number
  let groupIndex = 0;
  let groupCount = 0;
  for (let i = 0; i < numPaths; i++) {
      const assignedNumber = assignedNumbers[i];
      if (assignedNumber >= groupCount) {
          groupIndex++;
          groupCount += groupIndex <= remainder ? pathsPerGroup + 1 : pathsPerGroup;
      }
      const colorIndex = assignedNumber % numGroups;
      const colorString = colorArray[colorIndex];
      paths[i].setAttribute("fill", colorString);
      paths[i].setAttribute("team", colorIndex);

      // add color index and color string to teamColorArray if color index is not already present
      let isPresent = false;
      for (let j = 0; j < teamColorArray.length; j++) {
          if (teamColorArray[j][0] === colorIndex) {
              isPresent = true;
              break;
          }
      }
      if (!isPresent) {
          teamColorArray.push([colorIndex, colorString]);
      }
      teamColorArray.sort((a, b) => a[0] - b[0]);
  }
}

function zoomMap(event) {
  let doingTheZoom = true;
  const delta = Math.sign(event.deltaY);

  if (delta < 0 && zoomLevel < maxZoomLevel) {
      zoomLevel++;
  } else if (delta > 0 && zoomLevel > 1) {
      zoomLevel--;
  } else {
      doingTheZoom = false;
  }

  if (doingTheZoom) {
      const mouseX = event.clientX - svgTag.getBoundingClientRect().left;
      const mouseY = event.clientY - svgTag.getBoundingClientRect().top;

      let newWidth, newHeight;
      if (zoomLevel === 1) {
          newWidth = originalViewBoxWidth;
          newHeight = originalViewBoxHeight;
      } else if (zoomLevel === 2) {
          newWidth = originalViewBoxWidth * 0.75;
          newHeight = originalViewBoxHeight * 0.75;
      } else if (zoomLevel === 3) {
          newWidth = originalViewBoxWidth * 0.5;
          newHeight = originalViewBoxHeight * 0.5;
      } else if (zoomLevel === 4) {
          newWidth = originalViewBoxWidth * 0.3;
          newHeight = originalViewBoxHeight * 0.3;
      }

      const maxLeft = originalViewBoxX + originalViewBoxWidth - newWidth;
      const minLeft = originalViewBoxX;
      let newLeft = originalViewBoxX + ((mouseX / viewBoxWidth) * originalViewBoxWidth) - (newWidth / 2);
      newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));

      const maxTop = originalViewBoxY + originalViewBoxHeight - newHeight;
      const minTop = originalViewBoxY;
      let newTop = originalViewBoxY + ((mouseY / viewBoxHeight) * originalViewBoxHeight) - (newHeight / 2);
      newTop = Math.max(minTop, Math.min(maxTop, newTop));

      const newViewBox = `${newLeft} ${newTop} ${newWidth} ${newHeight}`;

      // Set the new viewBox attribute on your SVG element
      svgTag.setAttribute("viewBox", newViewBox);

      // Set the initial viewBox when fully zoomed out
      if (zoomLevel === 1) {
          svgTag.setAttribute("viewBox", `${originalViewBoxX} ${originalViewBoxY} ${originalViewBoxWidth} ${originalViewBoxHeight}`);
      }
      lastMouseX = mouseX;
      lastMouseY = mouseY;
  }
}

function panMap(event) {
  if (zoomLevel > 1 && event.buttons === 1) {
      event.preventDefault();
      const mouseX = event.clientX;
      const mouseY = event.clientY;
      const dx = (mouseX - lastMouseX) * 2;
      const dy = (mouseY - lastMouseY) * 2;

      const viewBoxValues = svgTag.getAttribute("viewBox").split(" ");
      const currentViewBoxX = parseFloat(viewBoxValues[0]);
      const currentViewBoxY = parseFloat(viewBoxValues[1]);
      const currentViewBoxWidth = parseFloat(viewBoxValues[2]);
      const currentViewBoxHeight = parseFloat(viewBoxValues[3]);
      const originalViewBoxX = parseFloat(svgTag.getAttribute("data-original-x"));
      const originalViewBoxY = parseFloat(svgTag.getAttribute("data-original-y"));
      const originalViewBoxWidth = parseFloat(svgTag.getAttribute("data-original-width"));

      const newWidth = currentViewBoxWidth / zoomLevel;
      const newHeight = currentViewBoxHeight / zoomLevel;
      let newLeft = currentViewBoxX - dx / zoomLevel;
      let newTop = currentViewBoxY - dy / zoomLevel;

      const maxLeft = originalViewBoxX + originalViewBoxWidth - newWidth;
      const minLeft = originalViewBoxX;
      if (newLeft < minLeft) {
          newLeft = minLeft;
      } else if (newLeft > maxLeft) {
          newLeft = maxLeft;
      }

      const maxTop = originalViewBoxY + originalViewBoxHeight - newHeight;
      const minTop = originalViewBoxY;
      if (newTop < minTop) {
          newTop = minTop;
      } else if (newTop > maxTop) {
          newTop = maxTop;
      }

      if (newLeft !== currentViewBoxX || newTop !== currentViewBoxY) {
          const newViewBox = `${newLeft} ${newTop} ${currentViewBoxWidth} ${currentViewBoxHeight}`;
          svgTag.setAttribute("viewBox", newViewBox);
      }

      // Disable scrollbar functionality
      document.body.style.overflow = "hidden";

      // Update last mouse position
      lastMouseX = mouseX;
      lastMouseY = mouseY;
  }
}

function fillPathBasedOnTeam(path) {
  const team = parseInt(path.getAttribute("team"));
  const color = teamColorArray.find((c) => c[0] === team)[1];
  path.setAttribute("fill", color);
}

function setStrokeWidth(path, stroke) {
  path.setAttribute("stroke-width", stroke)
}

export function enableNewGameButton() {
  document.getElementById("new-game-btn").disabled = false;
}

function greyOutTerritoriesForUnselectableCountries() {
  paths.forEach(path => {
      const countryName = path.getAttribute("data-name");
      let countryStrength;

      // Find the country strength data using a loop
      for (let i = 0; i < countryStrengthsArray.length; i++) {
          if (countryStrengthsArray[i][0] === countryName) {
              countryStrength = countryStrengthsArray[i][1];
              break;
          }
      }

      if (countryStrength > countryGreyOutThreshold) {
          path.setAttribute("fill", greyOutColor);
          path.setAttribute("greyedOut", "true");
      }
  });
}

function setAllGreyedOutAttributesToFalseOnGameStart() {
  for (let i = 0; i < paths.length; i++) {
      paths[i].setAttribute("greyedOut", "false");
  }
}

function handleMovePhaseTransferAttackButton(path, lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, territoryComingFrom, xButtonClicked, xButtonFromWhere) {
  let button = document.getElementById("move-phase-button");
  button.style.display = "none";
  transferAttackButtonDisplayed = false;

  if (!xButtonClicked) {
      //if clicked territory is not owned by the player and is not a valid destination then return
      //if not a player owned territory and the lastPlayerOwned array does not contain the path
      if (lastPlayerOwnedValidDestinationsArray && path.getAttribute("owner") !== "Player" && !lastPlayerOwnedValidDestinationsArray.some(destination => destination.getAttribute("uniqueid") === path.getAttribute("uniqueid"))) {
          return;
      } else if (path.getAttribute("owner") === "Player") {
        territoryAboutToBeAttackedOrSieged = null;

        //if territory is deactivated, then get how many turns are left
        let deactivatedTurnsLeft;
        for (let i = 0; i < turnsDeactivatedArray.length; i++) {
            if (path.getAttribute("uniqueid") === turnsDeactivatedArray[i][0]) {
                deactivatedTurnsLeft = (turnsDeactivatedArray[i][1] - turnsDeactivatedArray[i][2]) + 1;
            }
        }
          // if clicks on a player-owned territory then show button in transfer state
          if (path.getAttribute("deactivated") === "true") {
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
      } else if (lastClickedPathExternal.getAttribute("owner") === "Player" && path.getAttribute("attackableTerritory") === "true" && path.getAttribute("owner") !== "Player" && lastPlayerOwnedValidDestinationsArray.some(destination => destination.getAttribute("uniqueid") === path.getAttribute("uniqueid")) && path.getAttribute("underSiege") === "false") {
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
      } else if (path.getAttribute("underSiege") === "true") {
        // if clicks on an enemy territory that is within reach but under siege then set it up for that
        button.innerHTML = "VIEW SIEGE (" + siegeObject[path.getAttribute("territory-name")].turnsInSiege + ")";
        button.classList.remove("move-phase-button-green-background");
        button.classList.remove("move-phase-button-grey-background");
        button.classList.remove("move-phase-button-red-background");
        button.classList.remove("move-phase-button-blue-background");
        button.classList.add("move-phase-button-brown-background");
        button.style.display = "flex";
        transferAttackButtonDisplayed = true;
        button.disabled = false;
        transferAttackButtonState = 2; //lift siege
        setTerritoryForAttack(path);
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
    tooltip.innerHTML = "";
    tooltip.style.display = "none";
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

                  if (transferAttackButtonState === 0 || transferAttackButtonState === 1) {
                    toggleTransferAttackWindow(true);
                  setTransferAttackWindowTitleText(
                      territoryAboutToBeAttackedOrSieged && territoryAboutToBeAttackedOrSieged.getAttribute("territory-name") !== null ?
                      territoryAboutToBeAttackedOrSieged.getAttribute("territory-name") :
                      "transferring",
                      territoryAboutToBeAttackedOrSieged ? territoryAboutToBeAttackedOrSieged.getAttribute("data-name") : null,
                      territoryComingFrom,
                      transferAttackButtonState,
                      mainArrayOfTerritoriesAndResources
                  );

                  button.classList.remove("move-phase-button-green-background");
                  button.classList.remove("move-phase-button-red-background");
                  button.classList.add("move-phase-button-blue-background");
                  button.innerHTML = "CANCEL";
                  drawAndHandleTransferAttackTable(
                      document.getElementById("transferTable"),
                      mainArrayOfTerritoriesAndResources,
                      playerOwnedTerritories,
                      territoriesAbleToAttackTarget,
                      transferAttackButtonState
                  );

                  const selection = document.querySelectorAll('.transfer-table-row-hoverable > .transfer-table-outer-column:first-of-type');
                  setTransferToTerritory(selection);

                  if (transferAttackButtonState === 1) {
                      for (let i = 0; i < paths.length; i++) {
                          paths[i].setAttribute("attackableTerritory", "false");
                      }
                  }
                  setTimeout(function() {
                      eventHandlerExecuted = false;
                  }, 200);
                  return;

                  } else if (transferAttackButtonState === 2) { //click view siege button //button says VIEW SIEGE
                        setValuesForBattleFromSiegeObject(lastClickedPath);
                        toggleBattleUI(true, false);
                        battleUIDisplayed = true;
                        toggleTransferAttackButton(false);
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
                    setTimeout(function() {
                        eventHandlerExecuted = false;
                    }, 200);
                    return;
                  } else if (transferAttackButtonState === 1) {
                    if (button.innerHTML === "INVADE!") {
                        battleStart = true;
                        setCurrentWarId(nextWarId);
                        setNextWarId(nextWarId + 1);
                        toggleTransferAttackWindow(false);
                        transferAttackWindowOnScreen = false;
                        toggleBattleUI(true, false);
                        enableDisableSiegeButton(0);
                        toggleTransferAttackButton(false);
                        transferAttackButtonDisplayed = false;
                        attackTextCurrentlyDisplayed = false;
                        setupBattle(probability, getFinalAttackArray(), mainArrayOfTerritoriesAndResources);
                        setupBattleUI(getFinalAttackArray());
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

                    }
                      territoryUniqueIds.length = 0;

                      if (button.innerHTML !== "DEACTIVATED") {
                        button.classList.remove("move-phase-button-blue-background");
                        button.classList.add("move-phase-button-red-background");
                        button.innerHTML = "ATTACK";
                      }
                      if (transferAttackButtonState === 0) {
                        toggleUIButton(true);
                        toggleBottomLeftPaneWithTurnAdvance(true);
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
          tooltip.style.left = x - 40 + "px";
          tooltip.style.top = y - 50 + "px";
      } else {
          tooltip.style.left = x - 40 + "px";
          tooltip.style.top = 25 + y + "px";
      }

      if (button.disabled) {
        if (button.innerHTML === "DEACTIVATED") {
            tooltip.innerHTML = "You cannot transfer or attack from this territory until next turn!";
        } else if (button.innerHTML === "TRANSFER") {
            tooltip.innerHTML = "You have no other territories to transfer military to!";
        }
      } else if (!button.disabled && playerOwnedTerritories.length > 1 && button.innerHTML === "TRANSFER") {
          tooltip.innerHTML = "Click to transfer military to one of your other territories...";
      } else if (!button.disabled && validDestinationsArray.length > 0 && button.innerHTML === "ATTACK") {
          tooltip.innerHTML = "Click to send military to attack selected territory from the last selected territory...";
      } else if (!button.disabled && button.innerHTML === "CANCEL") {
          tooltip.innerHTML = "Click to cancel with no changes and close transfer/attack window...";
      } else if (!button.disabled && button.innerHTML === "CONFIRM") {
        tooltip.innerHTML = "Click to confirm the transfer and move the selected units to the destination territory!";
      } else if (!button.disabled && button.innerHTML === "INVADE!") {
        tooltip.innerHTML = "Click to launch your attack!";
      } else if (!button.disabled && button.innerHTML.includes("VIEW SIEGE")) {
        tooltip.innerHTML = "Click to view the war and options to lift the siege!";
      }

      tooltip.style.display = "block";

  });
  
  button.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });
}

function setTerritoryForAttack(territoryToAttack) {
  territoryAboutToBeAttackedOrSieged = territoryToAttack;
  document.getElementById("attack-destination-text").innerHTML = territoryAboutToBeAttackedOrSieged.getAttribute("territory-name");
  document.getElementById("leftBattleImage").src = setFlag(territoryToAttack.getAttribute("data-name"), 0);
  document.getElementById("rightBattleImage").src = setFlag(territoryToAttack.getAttribute("data-name"), 0);
  document.getElementById("attack-destination-container").style.display = "flex";
  attackTextCurrentlyDisplayed = true;
  if (territoryToAttack.getAttribute("underSiege") === "true") {
    territoryToAttack.style.stroke = siegeObject[territoryToAttack.getAttribute("territory-name")].strokeColor;
    territoryToAttack.setAttribute("stroke-width", "5px");
    territoryToAttack.style.strokeDasharray = "10, 5";
  } else {
    territoryToAttack.style.stroke = territoryToAttack.getAttribute("fill");
    territoryToAttack.setAttribute("fill", playerColour);
    territoryToAttack.setAttribute("stroke-width", "5px");
    territoryToAttack.style.strokeDasharray = "10, 5";
    addImageToPath(territoryToAttack, "battle.png", false);
  }
}

function addImageToPath(pathElement, imagePath, siege) {
  const pathBounds = pathElement.getBBox();

  const centerX = pathBounds.x + pathBounds.width / 2;
  const centerY = pathBounds.y + pathBounds.height / 2;

  const maxImageWidth = pathBounds.width * 0.7;
  const maxImageHeight = pathBounds.height * 0.7;

  const imageElement = document.createElementNS("http://www.w3.org/2000/svg", "image");
  imageElement.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);

  const imageWidth = Math.min(maxImageWidth, maxImageHeight);
  const imageHeight = Math.min(maxImageWidth, maxImageHeight);
  const imageX = centerX - imageWidth / 2;
  const imageY = centerY - imageHeight / 2;
  imageElement.setAttribute("x", imageX.toString());
  imageElement.setAttribute("y", imageY.toString());
  imageElement.setAttribute("width", imageWidth.toString());
  imageElement.setAttribute("height", imageHeight.toString());
  imageElement.setAttribute("z-index", "9999");

  if (siege) {
    for (const key in siegeObject) {
      if (siegeObject.hasOwnProperty(key) && siegeObject[key].warId === currentWarId) {
        for (let i = 0; i < paths.length; i++) {
          if (paths[i].getAttribute("territory-name") === siegeObject[key].defendingTerritory.territoryName) {
            const territoryName = siegeObject[key].defendingTerritory.territoryName.replace(/\s+/g, "_");
            pathElement.parentNode.appendChild(imageElement);
            imageElement.setAttribute("id", `siegeImage_${territoryName}`);
            break;
          }
        }
        break;
      }
    }
  } else {
    imageElement.setAttribute("id", "attackImage");
    pathElement.parentNode.appendChild(imageElement);
  }
}

export function removeSiegeImageFromPath(path) {
    const siegeObjectElement = getHistoricWarObject(path);
    let imageElement;
  
    const formattedTerritoryName = siegeObjectElement.defendingTerritory.territoryName.replace(/\s+/g, "_");
    imageElement = svgMap.querySelector("#siegeImage_" + formattedTerritoryName);

  
    if (imageElement) { //always remove siege image after entering battle ui again and clicking assault
        imageElement.remove();
    } 

    path.setAttribute("fill", fillPathBasedOnContinent(path));
    path.style.stroke = "rgb(0,0,0)";
    path.style.strokeDasharray = "none";
    path.setAttribute("stroke-width", "1");
  }  

function setTransferAttackWindowTitleText(territory, country, territoryComingFrom, buttonState, mainArray) {
    let elementInMainArray;
    let totalAttackAmountArray = [0,0,0,0];
    let coastalOrNot;

    if (buttonState === 1) {
        for (let i = 0; i < territoriesAbleToAttackTarget.length; i++) { //get total attack numbers for icon row attack window
            for (let j = 0; j < mainArrayOfTerritoriesAndResources.length; j++) {
                if (territoriesAbleToAttackTarget[i].getAttribute("uniqueid") === mainArrayOfTerritoriesAndResources[j].uniqueId && !territoriesAbleToAttackTarget[i].isDeactivated) {
                    totalAttackAmountArray[0] += mainArrayOfTerritoriesAndResources[j].infantryForCurrentTerritory;
                    totalAttackAmountArray[1] += mainArrayOfTerritoriesAndResources[j].useableAssault;
                    totalAttackAmountArray[2] += mainArrayOfTerritoriesAndResources[j].useableAir;
                    totalAttackAmountArray[3] += mainArrayOfTerritoriesAndResources[j].useableNaval;
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

    document.getElementById("contentTransferHeaderRow").style.display = "flex";
    let imageElement;
    let imageSrc;

    if (buttonState === 0) {
        document.getElementById("contentTransferHeaderColumn1").innerHTML = "";
        document.getElementById("percentageAttack").style.display = "none";
        document.getElementById("colorBarAttackUnderlayRed").style.display = "none";
        document.getElementById("colorBarAttackOverlayGreen").style.display = "none";
        document.getElementById("xButtonTransferAttack").style.marginLeft = "0px";
  
        attackingOrTransferring = "Transferring to:";

        imageElement = document.getElementById("contentTransferHeaderImageColumn1");
        imageSrc = "resources/infantry.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Infantry" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(elementInMainArray.infantryForCurrentTerritory)}</span>`;
      
        imageElement = document.getElementById("contentTransferHeaderImageColumn2");
        imageSrc = "resources/assault.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Assault" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(elementInMainArray.assaultForCurrentTerritory)}</span>`;
      
        imageElement = document.getElementById("contentTransferHeaderImageColumn3");
        imageSrc = "resources/air.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Air" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(elementInMainArray.airForCurrentTerritory)}</span>`;
      
        imageElement = document.getElementById("contentTransferHeaderImageColumn4");
        imageSrc = "resources/naval.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Naval" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(elementInMainArray.navalForCurrentTerritory)}</span>`;
  
    } else if (buttonState === 1) {
        document.getElementById("percentageAttack").style.display = "flex";
        document.getElementById("colorBarAttackUnderlayRed").style.display = "flex";
        document.getElementById("xButtonTransferAttack").style.marginLeft = "47px";
        attackingOrTransferring = "Attacking:";

        document.getElementById("contentTransferHeaderColumn1").innerHTML = "Total Military Force In Range:";

        imageElement = document.getElementById("contentTransferHeaderImageColumn1");
        imageSrc = "resources/infantry.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Infantry" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(totalAttackAmountArray[0])}</span>`;
      
        imageElement = document.getElementById("contentTransferHeaderImageColumn2");
        imageSrc = "resources/assault.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Assault" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(totalAttackAmountArray[1])}</span>`;
      
        imageElement = document.getElementById("contentTransferHeaderImageColumn3");
        imageSrc = "resources/air.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Air" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(totalAttackAmountArray[2])}</span>`;
      
        imageElement = document.getElementById("contentTransferHeaderImageColumn4");
        imageSrc = "resources/naval.png";
        imageElement.innerHTML = `<img src="${imageSrc}" alt="Naval" class="sizingIcons" /><span class="whiteSpace">   ${formatNumbersToKMB(totalAttackAmountArray[3])}</span>`;
     
        const headerRow = document.getElementById("contentTransferHeaderRow");

        headerRow.addEventListener("mouseover", (e) => {
            const x = e.clientX;
            const y = e.clientY;
      
            if (window.innerHeight - y < 100) {
                tooltip.style.left = x - 40 + "px";
                tooltip.style.top = y - 50 + "px";
            } else {
                tooltip.style.left = x - 40 + "px";
                tooltip.style.top = 25 + y + "px";
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

            tooltip.innerHTML = tooltipContent;
      
            tooltip.style.display = "block";
        });
        headerRow.addEventListener("mouseout", () => {
            tooltip.innerHTML = "";
            tooltip.style.display = "none";
        });
    }
   
    const transferToAttackHeading = document.getElementById("attackOrTransferString");
    const fromHeading = document.getElementById("fromHeadingString");
    const territoryTextString = document.getElementById("territoryTextString");
  
    // Check if territory is "transferring" and set the text color accordingly
    if (territory === "transferring") {
      territoryTextString.innerHTML = "please select an option...";
      territoryTextString.style.color = "rgb(221, 107, 107)";
      territoryTextString.style.fontWeight = "bold";
    } else {

        territoryTextString.innerHTML = territory + " (" + country + ") - " + coastalOrNot;
        territoryTextString.style.color = "white";
    }
  
    const attackingFromTerritory = document.getElementById("attackingFromTerritoryTextString");
    const titleTransferAttackWindow = document.getElementById("title-transfer-attack-window");
  
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
              document.getElementById("territoryTextString").innerHTML = clickedTerritoryName;
          } else {
              document.getElementById("territoryTextString").innerHTML = "please select an option...";
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
        document.getElementById("percentageAttack").innerHTML = displayProbability + "%";
        if (displayProbability >= 1) {
            document.getElementById("colorBarAttackOverlayGreen").style.display = "flex";
        } else {
            document.getElementById("colorBarAttackOverlayGreen").style.display = "none";
        }
        document.getElementById("colorBarAttackOverlayGreen").style.width = displayProbability >= 99 ? "100%" : displayProbability + "%";
    } else if (situation === 1) { //battleUI
        let probabilityColumnBox = document.getElementById("probabilityColumnBox");

        let battleUIRow4Col1IconProbabilityTurnsSiege = document.getElementById("battleUIRow4Col1IconProbabilityTurnsSiege");
        let battleUIRow4Col1TextProbabilityTurnsSiege = document.getElementById("battleUIRow4Col1TextProbabilityTurnsSiege");
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
        document.getElementById("UIButtonContainer").style.display = "block";
    } else {
        document.getElementById("UIButtonContainer").style.display = "none";
    }
  }
  
  function toggleBottomLeftPaneWithTurnAdvance(makeVisible) {
    if (makeVisible) {
        document.getElementById("popup-with-confirm-container").style.display = "block";
    } else {
        document.getElementById("popup-with-confirm-container").style.display = "none";
    }
  }
  
  export function toggleUIMenu(makeVisible) {
    if (makeVisible) {
        document.getElementById("move-phase-buttons-container").style.pointerEvents = "none";
        document.getElementById("main-ui-container").style.display = "block";
        drawUITable(uiTable, 0);
        svg.style.pointerEvents = 'none';
        uiCurrentlyOnScreen = true;
        toggleUIButton(false);
        document.getElementById("popup-with-confirm-container").style.display = "none";
        toggleTransferAttackButton(false);
    } else {
        document.getElementById("move-phase-buttons-container").style.pointerEvents = "auto";
        document.getElementById("main-ui-container").style.display = "none";
        svg.style.pointerEvents = 'auto';
        uiCurrentlyOnScreen = false;
        toggleUIButton(true);
        document.getElementById("popup-with-confirm-container").style.display = "block";
        if (transferAttackButtonDisplayed) {
            toggleTransferAttackButton(true);
        }
    }
  }
  
  export function toggleUpgradeMenu(makeVisible) {
    if (makeVisible) {
        document.getElementById("upgrade-container").style.display = "block";
        document.getElementById("main-ui-container").style.pointerEvents = 'none';
    } else {
        document.getElementById("upgrade-container").style.display = "none";
        document.getElementById("main-ui-container").style.pointerEvents = 'auto';
    }
  }
  
  export function toggleBuyMenu(makeVisible) {
    if (makeVisible) {
        document.getElementById("buy-container").style.display = "block";
        document.getElementById("main-ui-container").style.pointerEvents = 'none';
    } else {
        document.getElementById("buy-container").style.display = "none";
        document.getElementById("main-ui-container").style.pointerEvents = 'auto';
    }
  }
  
  function toggleBattleUI(turnOnBattleUI, enterSiege) {
    let battleUI = document.getElementById("battleContainer");
    if (enterSiege) {
        battleUI.style.display = 'none';
        svg.style.pointerEvents = 'auto';
        document.getElementById("move-phase-buttons-container").style.display = "flex";
    } else {
        if (turnOnBattleUI) {
          battleUI.style.display = "block";
          svg.style.pointerEvents = 'none';
          document.getElementById("move-phase-buttons-container").style.display = "none";
        } else if (!turnOnBattleUI) {
          battleUI.style.display = 'none';
          document.getElementById("move-phase-buttons-container").style.display = "flex";
        }
    }
  }

  function toggleBattleResults(turnOnBattleResults) {
    let battleResults = document.getElementById("battleResultsContainer");
  if (turnOnBattleResults) {
    battleResults.style.display = "block";
    document.getElementById("move-phase-buttons-container").style.display = "none";
  } else if (!turnOnBattleResults) {
    document.getElementById("move-phase-buttons-container").style.display = "flex";
    battleResults.style.display = 'none';
    svg.style.pointerEvents = 'auto';
  }
}
  
  function toggleTransferAttackWindow(turnOnTransferAttackWindow) {
    let transferAttackWindow = document.getElementById("transfer-attack-window-container");
    if (turnOnTransferAttackWindow) {
        transferAttackWindow.style.display = "block";
        transferAttackWindowOnScreen = true;
        svg.style.pointerEvents = 'none';
    } else if (!turnOnTransferAttackWindow) {
        transferAttackWindow.style.display = "none";
        svg.style.pointerEvents = 'auto';
    }
    //set height of colorBars for attack
    const sourceElement = document.getElementById('title-transfer-attack-window');
    const redBar = document.getElementById('colorBarAttackUnderlayRed');
    const greenBar = document.getElementById('colorBarAttackOverlayGreen');
  
    const computedStyle = window.getComputedStyle(sourceElement);
    const sourceHeight = computedStyle.getPropertyValue('height');
    redBar.style.height = sourceHeight;
    greenBar.style.height = sourceHeight;
  }
  
  function toggleBottomTableContainer(turnOnTable) {
    let tableContainer = document.getElementById("bottom-table-container");
    if (turnOnTable) {
        tableContainer.style.display = "block";
    } else if (!turnOnTable) {
        tableContainer.style.display = "none";
    }
  }
  
  function toggleTopTableContainer(turnOnTable) {
    let tableContainer = document.getElementById("top-table-container");
    if (turnOnTable) {
        tableContainer.style.display = "block";
    } else if (!turnOnTable) {
        tableContainer.style.display = "none";
    }
  }
  
  export function toggleTransferAttackButton(turnOnButton) {
    let transferAttackButton = document.getElementById("move-phase-button");
    let attackText = document.getElementById("attack-destination-container");
    if (turnOnButton) {
        transferAttackButton.style.display = "flex";
        if (attackTextCurrentlyDisplayed) {
            attackText.style.display = "flex";
        }
    } else if (!turnOnButton) {
        transferAttackButton.style.display = "none";
        attackText.style.display = "none";
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

    const retreatButton = document.getElementById("retreatButton");
    const advanceButton = document.getElementById("advanceButton");
    const siegeBottomBarButton = document.getElementById("siegeBottomBarButton");

    const attackerCountry = playerCountry;
    const defenderTerritory = siegeObjectElement.defendingTerritory.dataName;

    let probBarAdded = false;

    //SET FLAGS
    setFlag(attackerCountry, 4);
    setFlag(defenderTerritory, 5);

    //SET TITLE TEXT
    setTitleTextBattleUI(attackerCountry, defenderTerritory, 1);

    document.getElementById("battleUITitleTitleCenter").innerHTML = "Sieges";

    prepareProbabilityBar(1, probBarAdded);

    //SET ARMY TEXT VALUES
    setArmyTextValues(siegeObjectElement, 2, siegeObjectElement.defendingTerritory.uniqueId);

    //SET DEFENSE BONUS VALUE
    document.getElementById("mountainDefenceText").innerHTML = siegeObjectElement.defendingTerritory.mountainDefenseBonus;
    document.getElementById("defenceBonusText").innerHTML = siegeObjectElement.defendingTerritory.defenseBonus;
    //SET PROD POP AND FOOD VALUES IN SIEGE SCREEN
    document.getElementById("prodPopText").innerHTML = formatNumbersToKMB(siegeObjectElement.defendingTerritory.productiveTerritoryPop);
    document.getElementById("foodText").innerHTML = formatNumbersToKMB(siegeObjectElement.defendingTerritory.foodCapacity);


    //SET SIEGE TURNS TEXT
    setSiegeTurnsText(siegeObjectElement);

    //SET SIEGE ROW 4
    let siegeScore = calculateSiegeScore(siegeObjectElement);
    setSiegeScoreText(siegeScore, 0);
    document.getElementById("battleUIRow4Col1TextProbabilityTurnsSiege").style.color = "rgb(255,255,255)";
    let difference = siegeScore - (siegeObjectElement.defendingTerritory.defenseBonus + siegeObjectElement.defendingTerritory.mountainDefenseBonus);
    if (difference <= 0) {
        document.getElementById("battleUIRow4Col1TextSiegeScore").style.color = "rgb(245,128,128)";
    } else if (difference > 0 && difference < 50) {
        document.getElementById("battleUIRow4Col1TextSiegeScore").style.color = "rgb(255, 255, 0)";
    } else {
        document.getElementById("battleUIRow4Col1TextSiegeScore").style.color = "rgb(0, 255, 0)";
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
    let war = historicWars.find((siege) => siege.warId === currentWarId);
    if (war) {
        battleUIState = 1;
    } else {
        battleUIState = 0;
    }
    setCurrentRound(0);

    const retreatButton = document.getElementById("retreatButton");
    const advanceButton = document.getElementById("advanceButton");

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
                flagStringDefender = paths[j].getAttribute("data-name");
                defenderTerritory = paths[j];
            }
            if (paths[j].getAttribute("uniqueid") === attackArray[1].toString()) { //any player territory to get country name
                flagStringAttacker = paths[j].getAttribute("data-name");
                attackerCountry = paths[j];
            }
        }
    }

    //SET FLAGS
    setFlag(flagStringAttacker, 4);
    setFlag(flagStringDefender, 5);

    //SET TITLE TEXT
    setTitleTextBattleUI(attackerCountry, defenderTerritory, 0);

    document.getElementById("battleUITitleTitleCenter").innerHTML = "vs";

    let probBarAdded = false;

    if (document.getElementById("probabilityColumnBox")) {
        document.getElementById("probabilityColumnBox").style.display = "flex";
    } else {
        probBarAdded = true;
        const battleUIRow2 = document.getElementById("battleUIRow2");
        battleUIRow2.innerHTML = "";
        const probabilityColumnBox = document.createElement("div");
        probabilityColumnBox.classList.add("probabilityColumnBox");
        probabilityColumnBox.classList.add("probabilityColumnBox");
        probabilityColumnBox.setAttribute("id","probabilityColumnBox");
        battleUIRow2.appendChild(probabilityColumnBox);
    }
    prepareProbabilityBar(0, probBarAdded);

    //SET PROBABILITY ON UI
    setAttackProbabilityOnUI(probability, 1);

    //SET ARMY TEXT VALUES
    let hasSiegedBefore = historicWars.some((siege) => siege.warId === currentWarId);
    if (!hasSiegedBefore) {
        setArmyTextValues(attackArray, 0, defenderTerritory.getAttribute("uniqueid"));
    }

    //SET DEFENSE BONUS VALUE
    if (!hasSiegedBefore) {
        for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
            if (defenderTerritory.getAttribute("uniqueid") === mainArrayOfTerritoriesAndResources[i].uniqueId) {
                document.getElementById("defenceBonusText").innerHTML = mainArrayOfTerritoriesAndResources[i].defenseBonus;
                document.getElementById("mountainDefenceText").innerHTML = mainArrayOfTerritoriesAndResources[i].mountainDefenseBonus;
            }
        }
    } else {
        for (const key in siegeObject) {
            if (siegeObject[key] === defenderTerritory.getAttribute("territory-name")) {
                document.getElementById("defenceBonusText").innerHTML = siegeObject[key].defenderTerritory.defenseBonus;
                document.getElementById("mountainDefenceText").innerHTML = siegeObject[key].defenderTerritory.mountainDefenseBonus;
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
    siegeBottomBarButton.style.display = "none";

    retreatButton.style.width = "50%";
    advanceButton.style.width = "50%";

    retreatButtonState = setRetreatButtonText(0, retreatButton);
    advanceButtonState = 0;
    setAdvanceButtonText(6, advanceButton);

    for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
        if (attackArray[1].toString() === mainArrayOfTerritoriesAndResources[i].uniqueId) {
            attackCountry = mainArrayOfTerritoriesAndResources[i].dataName;
        }
        if (attackArray[0] === mainArrayOfTerritoriesAndResources[i].uniqueId) {
            defendTerritory = mainArrayOfTerritoriesAndResources[i];
        }
    }
    originalDefendingTerritory = { ...defendTerritory };
}

function setTitleTextBattleUI(attacker, defender, attackSiege) {
    let attackerContainer = document.getElementById("battleUITitleTitleLeft");
    let defenderContainer = document.getElementById("battleUITitleTitleRight");

    if (attackSiege === 0) { //attack
        let attackerCountry = attacker.getAttribute("data-name");
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
    let totalAttackingArmy = [0,0,0,0];
    let totalDefendingArmy = [0,0,0,0];
    let startingAssault;
    let startingAir;
    let startingNaval;

    if (situation === 0) { //pre battle
         //get attacking army
        for (let i = 1; i < attackArray.length; i+= 5) {
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
        for (let i = 0; i < mainArrayOfTerritoriesAndResources.length; i++) {
            if (mainArrayOfTerritoriesAndResources[i].uniqueId === defendingUniqueId) { //any player territory to get country name
                const infantryCount = mainArrayOfTerritoriesAndResources[i].infantryForCurrentTerritory;
                const assaultCount = mainArrayOfTerritoriesAndResources[i].useableAssault;
                const airCount = mainArrayOfTerritoriesAndResources[i].useableAir;
                const navalCount = mainArrayOfTerritoriesAndResources[i].useableNaval;
        
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

    document.getElementById("armyRowRow2Quantity1").innerHTML = formatNumbersToKMB(totalAttackingArmy[0]);
    document.getElementById("armyRowRow2Quantity2").innerHTML = formatNumbersToKMB(totalAttackingArmy[1]);
    document.getElementById("armyRowRow2Quantity3").innerHTML = formatNumbersToKMB(totalAttackingArmy[2]);
    document.getElementById("armyRowRow2Quantity4").innerHTML = formatNumbersToKMB(totalAttackingArmy[3]);
    document.getElementById("armyRowRow2Quantity5").innerHTML = formatNumbersToKMB(totalDefendingArmy[0]);
    if (situation === 2) {
        document.getElementById("armyRowRow2Quantity6").innerHTML = formatNumbersToKMB(totalDefendingArmy[1]) + " / " + startingAssault;
        document.getElementById("armyRowRow2Quantity7").innerHTML = formatNumbersToKMB(totalDefendingArmy[2]) + " / " + startingAir;
        document.getElementById("armyRowRow2Quantity8").innerHTML = formatNumbersToKMB(totalDefendingArmy[3]) + " / " + startingNaval;
    } else {
        document.getElementById("armyRowRow2Quantity6").innerHTML = formatNumbersToKMB(totalDefendingArmy[1]);
        document.getElementById("armyRowRow2Quantity7").innerHTML = formatNumbersToKMB(totalDefendingArmy[2]);
        document.getElementById("armyRowRow2Quantity8").innerHTML = formatNumbersToKMB(totalDefendingArmy[3]);
    }

    setDefendingTerritoryCopyEnd(totalDefendingArmy);
}

export function reduceKeywords(str) {
    const keywords = {
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
    const reducedString = reducedWords.join(' ');
  
    return reducedString;
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
    document.getElementById("battleResultsTitleTitleLeft").innerHTML = flagStringAttacker;
    document.getElementById("battleResultsTitleTitleRight").innerHTML = territoryStringDefender;

    let confirmButtonBattleResults = document.getElementById("battleResultsRow4");

    if (situation === 0) { //won   
        confirmButtonBattleResults.classList.remove("battleResultsRow4Lost");
        confirmButtonBattleResults.classList.add("battleResultsRow4Won");
        confirmButtonBattleResults.style.backgroundColor = "rgb(0, 128, 0)";
        document.getElementById("battleResultsTitleTitleCenter").innerHTML = "Conquers";
        confirmButtonBattleResults.innerHTML = "Accept Victory!";
        territoryPath.setAttribute("fill", playerColour);
        currentMapColorAndStrokeArray = saveMapColorState(false);
    } else if (situation === 1) { //lost
        confirmButtonBattleResults.classList.remove("battleResultsRow4Won");
        confirmButtonBattleResults.classList.add("battleResultsRow4Lost");
        confirmButtonBattleResults.style.backgroundColor = "rgb(131, 38, 38)";
        if (defeatType === "retreat") {
            document.getElementById("battleResultsTitleTitleCenter").innerHTML = "Pulls  Out  Of";
            confirmButtonBattleResults.innerHTML = "Accept Retreat!";
        } else if (defeatType === "arrest") {
            document.getElementById("battleResultsTitleTitleCenter").innerHTML = "Arrested By";
            confirmButtonBattleResults.innerHTML = "Accept Defeat!";
        } else {
            document.getElementById("battleResultsTitleTitleCenter").innerHTML = "Defeated  By";
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
        document.getElementById("battleResultsRow3Row3RoundsCount").innerHTML = "Rounds To Victory:  " + roundCounterForStats;
    } else if (situation === 1) {
        if (defeatType === "retreat") {
            setResolution("Retreat");
            document.getElementById("battleResultsRow3Row3RoundsCount").innerHTML = "Respectful Retreat";
        } else if (defeatType === "arrest") {
            document.getElementById("battleResultsRow3Row3RoundsCount").innerHTML = "Siege Troops Arrested";
        } else {
            setResolution("Defeat");
            document.getElementById("battleResultsRow3Row3RoundsCount").innerHTML = "Rounds To Defeat:  " + roundCounterForStats;
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
        attackArray.unshift(0,0); //format array to work in loop below
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

    if (situation === 1) {
        if (retreatButtonState === 1) { //scatter
            for (let i = 0; i < attackingArmyRemaining.length; i++) {
                attackingArmyRemaining[i] = Math.floor(attackingArmyRemaining[i] * multiplierForScatterLoss);
            }
        }
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
        const element = document.getElementById(`battleResultsRow2Row2Quantity${i+1}`);
        let formattedValue;
        if (attackingLosses[i] !== "-") {
            formattedValue = formatNumbersToKMB(attackingLosses[i]);
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
        const element = document.getElementById(`battleResultsRow2Row2Quantity${i+5}`);
        let formattedValue;
        if (defendingLosses[i] !== "-" && defendingLosses[i] !== "None") {
            formattedValue = formatNumbersToKMB(defendingLosses[i]);
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
        const element = document.getElementById(`battleResultsRow3Row1Quantity${i+1}`);
        if (massiveAssault && attackingSurvived[i] !== "-") {
            attackingSurvived[i] = Math.floor(attackingSurvived[i] * 0.8);
        }
        let formattedValue;
        if (attackingSurvived[i] !== "-" && attackingSurvived[i] !== "All") {
            formattedValue = formatNumbersToKMB(attackingSurvived[i]);
        } else if (attackingSurvived[i] === "All"){
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
        const element = document.getElementById(`battleResultsRow3Row1Quantity${i+5}`);
        let formattedValue;

        if (rout && totalDefendingArmy[i] > 0) {
            formattedValue = formatNumbersToKMB(capturedArray[i]);
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
    return defendingTerritoryCopyStart = {...object}; //copies object not just reference it
}

export function setDefendingTerritoryCopyEnd(array) {
    return defendingTerritoryCopyEnd = [...array]; //copies object not just reference it
}

export function enableDisableSiegeButton(enableOrDisable) {
    let siegeButton = document.getElementById("siegeButton");
    if (enableOrDisable === 0) { //enable
        siegeButton.style.backgroundColor = "rgb(114, 88, 48)";
        siegeButton.disabled = false;
    } else if (enableOrDisable === 1) { //disable
        siegeButton.style.backgroundColor = "rgb(128, 128, 128)";
        siegeButton.disabled = true;
    }
}

export function getSiegeObjectFromPath(territory) {
    if (territory.getAttribute("territory-name") in siegeObject) {
    return siegeObject[territory.getAttribute("territory-name")];
    }
}

export function getSiegeObjectFromObject(territory) {
    if (territory.territoryName in siegeObject) {
    return siegeObject[territory.territoryName];
    }
}

export function getHistoricWarObject(territory) {
    const territoryName = territory.getAttribute("territory-name");
    const siege = historicWars.find((siege) => siege.defendingTerritory.territoryName === territoryName);

    if (siege) {
        return siege;
    }
}

function prepareProbabilityBar(siegeOrAttack, probBarAdded) {
    const battleUIRow2 = document.getElementById("battleUIRow2");
    const probabilityColumnBox = document.getElementById("probabilityColumnBox");

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
    const { turnsInSiege } = siegeObject;
    document.getElementById("battleUIRow4Col1IconProbabilityTurnsSiege").innerHTML = "<img class='sizingPositionRow4Column1IconBattleUI' src='./resources/turnsIcon.png'>";
    document.getElementById("battleUIRow4Col1TextProbabilityTurnsSiege").innerHTML = turnsInSiege;
}



function setRow4(siegeOrAttack) { //move to bottom when done
    //get appropriate columns
    const row4RightColumnA = document.getElementById("battleUIRow4Col2A");
    const row4RightColumnB = document.getElementById("battleUIRow4Col2B");
    const row4RightColumnC = document.getElementById("battleUIRow4Col2C");
    const row4RightColumnD = document.getElementById("battleUIRow4Col2D");
    const row4RightColumnE = document.getElementById("battleUIRow4Col2E");
    const row4RightColumnF = document.getElementById("battleUIRow4Col2F");
    const row4RightColumnG = document.getElementById("battleUIRow4Col2G");
    const row4RightColumnH = document.getElementById("battleUIRow4Col2H");

    const prodPopIcon = document.getElementById("prodPopIcon");
    const foodIcon = document.getElementById("foodIcon");

    const siegeButton = document.getElementById("siegeButton");

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

function setUnsetMenuOnEscape() {
  if (event.code === "Escape" && outsideOfMenuAndMapVisible && !menuState) { //in game
      document.getElementById("menu-container").style.display = "block";
      document.getElementById("main-ui-container").style.display = "none";
      document.getElementById("upgrade-container").style.display = "none";
      toggleBottomTableContainer(false);
      toggleTopTableContainer(false);
      menuState = true;
      toggleBottomLeftPaneWithTurnAdvance(false);
      toggleUIButton(false);
      toggleUpgradeMenu(false);
      toggleBuyMenu(false);
      toggleTransferAttackButton(false);
      toggleTransferAttackWindow(false);
      toggleBattleUI(false, false);
      toggleBattleResults(false);
  } else if (event.code === "Escape" && outsideOfMenuAndMapVisible && menuState) { // in menu
      if (uiCurrentlyOnScreen) {
          document.getElementById("main-ui-container").style.display = "flex";
          uiButtonCurrentlyOnScreen = false;
          bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false;
      } else {
          if (countrySelectedAndGameStarted) {
              uiButtonCurrentlyOnScreen = true;
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
      } else {
          if (countrySelectedAndGameStarted && !uiCurrentlyOnScreen) {
              uiButtonCurrentlyOnScreen = true;
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
      if (buyWindowCurrentlyOnScreen) {
          toggleBuyMenu(true);
      }
      if (countrySelectedAndGameStarted) {
          toggleTopTableContainer(true);
      }
      if (transferAttackButtonDisplayed) {
          toggleTransferAttackButton(true);
      }
      toggleBottomTableContainer(true);
      document.getElementById("menu-container").style.display = "none";

      if (lastClickedPath.getAttribute("d") !== "M0 0 L50 50") {
          selectCountry(lastClickedPath, true);
          if (territoryAboutToBeAttackedOrSieged) {
            if (svgMap.getElementById("attackImage")) { //if battle image on screen then removes and reads it, so it is on top of the svg path
                svgMap.getElementById("attackImage").remove();
                addImageToPath(territoryAboutToBeAttackedOrSieged, "battle.png", false);
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
    } else {
        toggleBattleResults(false);
        battleResultsDisplayed = false;
        toggleUIButton(true);
        uiButtonCurrentlyOnScreen = true;
        toggleBottomLeftPaneWithTurnAdvance(true);
        bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = true;
    }
}

function setColorsOfDefendingTerritoriesSiegeStats(lastClickedPath, situation) {
    let siegeObject = getSiegeObjectFromPath(lastClickedPath);
    let defendingTerritory;
    if (situation === 0) {
        defendingTerritory = siegeObject.defendingTerritory;
    } else {
        for (let i = 0; i < mainArrayOfTerritoriesAndResources; i++) {
            if (mainArrayOfTerritoriesAndResources[i].uniqueId === lastClickedPath.getAttribute("uniqueid")) {
                defendingTerritory = mainArrayOfTerritoriesAndResources[i];
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
            document.getElementById("defenceIcon").innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon25.png'>";
            defendingTerritory.defenseBonusColor = colorRed;
        } else if (defenseBonusPercentage > 25 && defenseBonusPercentage <= 50) {
            document.getElementById("defenceIcon").innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon50.png'>";
            defendingTerritory.defenseBonusColor = colorOrange;
        } else if (defenseBonusPercentage > 50 && defenseBonusPercentage <= 75) {
            document.getElementById("defenceIcon").innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon75.png'>";
            defendingTerritory.defenseBonusColor = colorYellow;
        } else {
            document.getElementById("defenceIcon").innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon.png'>";
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

        document.getElementById("defenceBonusText").style.color = defendingTerritory.defenseBonusColor;
        document.getElementById("foodText").style.color = defendingTerritory.foodCapacityColor;
        document.getElementById("prodPopText").style.color = defendingTerritory.productiveTerritoryPopColor;
    } else if (situation === 1) { //click assault
        remainingPercentages = "";
        applyColorsToArmyQuantityText(1, remainingPercentages, colorGreen, colorYellow, colorOrange, colorRed, colorWhite);
    }  else if (situation === 2) {  //click invade
        remainingPercentages = "";
        applyColorsToArmyQuantityText(1, remainingPercentages, colorGreen, colorYellow, colorOrange, colorRed, colorWhite);
        document.getElementById("defenceBonusText").style.color = colorGreen;
        document.getElementById("defenceIcon").innerHTML = "<img class='sizingPositionRow4IconBattleUI' src='./resources/fortIcon.png'>";
    }

    let mountainDefenceText = document.getElementById("mountainDefenceText");
    if (parseInt(mountainDefenceText.innerHTML) >= 50) {
        mountainDefenceText.style.color = colorRed;
    } else if (parseInt(mountainDefenceText.innerHTML) >= 30) {
        mountainDefenceText.style.color = colorOrange;
    } else if (parseInt(mountainDefenceText.innerHTML) >= 20) {
        mountainDefenceText.style.color = colorYellow;
    } else {
        mountainDefenceText.style.color = colorGreen;
    }
}

function applyColorsToArmyQuantityText(situation, remainingPercentages, colorGreen, colorYellow, colorOrange, colorRed, colorWhite) {
    const elements = [
        document.getElementById("armyRowRow2Quantity5"),
        document.getElementById("armyRowRow2Quantity6"),
        document.getElementById("armyRowRow2Quantity7"),
        document.getElementById("armyRowRow2Quantity8"),
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
        document.getElementById("battleUIRow4Col1TextSiegeScore").innerHTML = siegeScore;
        document.getElementById("battleUIRow4Col1IconSiegeScore").innerHTML = "<img class='sizingPositionRow4Column1IconBattleUI' src='./resources/sword.png'>";
        document.getElementById("battleUIRow4Col1TextSiegeScore").style.display = "flex";
        document.getElementById("battleUIRow4Col1IconSiegeScore").style.display = "flex";
    }
    else if (situation === 1) {
        document.getElementById("battleUIRow4Col1TextSiegeScore").style.display = "none";
        document.getElementById("battleUIRow4Col1IconSiegeScore").style.display = "none";
    }
}

export function toggleDiceCanvas(value) {
    if (value) {
        document.getElementById("threeCanvasForDice").style.display = "block";
    } else {
        document.getElementById("threeCanvasForDice").style.display = "none";
    }
}