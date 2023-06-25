import {
  findMatchingCountries
} from './manualExceptionsForInteractions.js';
import {
  initialiseGame as initialiseGame
} from './gameTurnsLoop.js';
import {
  currentTurnPhase,
  modifyCurrentTurnPhase
} from "./gameTurnsLoop.js"
import {
  allowSelectionOfCountry,
  playerOwnedTerritories
} from './resourceCalculations.js';
import {
  populateBottomTableWhenSelectingACountry
} from './resourceCalculations.js';
import {
  currentlySelectedTerritoryForUpgrades,
  currentlySelectedTerritoryForPurchases,
  totalGoldPrice,
  totalConsMats,
  totalPurchaseGoldPrice,
  totalPopulationCost
} from './resourceCalculations.js';
import {
  addPlayerUpgrades,
  addPlayerPurchases
} from './resourceCalculations.js';
import {
  drawUITable,
  formatNumbersToKMB
} from './resourceCalculations.js';
import {
  playSoundClip
} from './sfx.js';
import {
  capacityArray,
  demandArray,
  mainArrayOfTerritoriesAndResources,
  countryStrengthsArray
} from './resourceCalculations.js';
import {
  drawAndHandleTransferAttackTable
} from './transferAndAttack.js';
import {
    transferQuantitiesArray,
    transferArmyToNewTerritory,
    territoryUniqueIds,
    probability,
    transferArmyOutOfTerritoryOnStartingInvasion
} from './transferAndAttack.js';
import {
    doBattle,
    finalAttackArray,
} from './battle.js';

const svgns = "http://www.w3.org/2000/svg";
let currentlySelectedColorsArray = [];
let turnPhase = currentTurnPhase;

export let dataTableCountriesInitialState = [];
export let pageLoaded = false;
let eventHandlerExecuted = false;

export let svg = [];
export let svgMap = [];
export let svgTag = [];
export let paths = [];
export let defs = [];
export let patterns = [];

//variables that receive information for resources of countrys after database reading and calculations, before game starts
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
const countryGreyOutThreshold = 10000; //countries under this strength greyed out

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

// Game States
let bottomLeftPanelWithTurnAdvanceCurrentlyOnScreen = false; // used for handling popups on screen when game state changes
let uiCurrentlyOnScreen = false;
let outsideOfMenuAndMapVisible = false;
let clickActionsDone = false;
let countrySelectedAndGameStarted = false;
let menuState = true;
let selectCountryPlayerState = false;
let uiButtonCurrentlyOnScreen = false;
export let transferAttackbuttonState;
export let upgradeWindowCurrentlyOnScreen = false;
export let buyWindowCurrentlyOnScreen = false;
export let uiAppearsAtStartOfTurn = true;
export let transferAttackButtonDisplayed = false;
export let transferAttackWindowOnScreen = false;
export let attackTextCurrentlyDisplayed = false;
export let battleUIDisplayed = false;
export let territoryAboutToBeAttacked = null;
export let transferToTerritory;

//BATTLE UI BUTTON STATES  
let retreatButtonState;
let advanceButtonState;
let siegeButtonState;

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
  //-------------GLOBAL SVG CONSTANTS AFTER SVG LOADED---------------//
  svg = document.getElementById('svg-map');
  svgMap = document.getElementById('svg-map').contentDocument;
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
  svgMap.addEventListener("mouseout", function(e) {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
      if (currentPath) {
          if (currentPath.getAttribute("greyedOut") === "false") {
              hoverOverTerritory(currentPath, "mouseOut"); // Pass the current path element and set mouseAction to 1
          }
      }
      clickActionsDone = false;
  });

  svgMap.addEventListener("click", function(e) {
      if (e.target.tagName === "rect" && currentTurnPhase === 1) {
          restoreMapColorState(currentMapColorAndStrokeArray, false);
          toggleTransferAttackButton(false);
          if (lastClickedPath.getAttribute("deactivated" === "false")) {
            removeImageFromPathAndRestoreNormalStroke(lastClickedPath, false, false);
          }
          if (territoryAboutToBeAttacked) {
            removeImageFromPathAndRestoreNormalStroke(territoryAboutToBeAttacked, true, false);
            document.getElementById("attack-destination-container").style.display = "none";
          }
          transferAttackButtonDisplayed = false;
          attackTextCurrentlyDisplayed = false;
          //remove army image
      }
      if (e.target.tagName === "path") {
          currentPath = e.target;
          document.getElementById("popup-confirm").style.opacity = 1;
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
  readDatabaseAndCreateDataArray(); //import all country data from database
}

function readDatabaseAndCreateDataArray() {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "http://localhost:8000/getWholeCountryTable.php", false);
  xhr.onreadystatechange = function() {
      if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
          dataTableCountriesInitialState = JSON.parse(xhr.responseText); //whole response of country table in this constant
      }
  };
  xhr.send();
}

function selectCountry(country, escKeyEntry) {
  if (country.getAttribute("greyedOut") === "false") {
        const deactivatedPaths = paths.filter(path => path.getAttribute("deactivated") === "true");

        if (deactivatedPaths.length > 0) { //make sure order correct for deactivated paths
        const lowestIndex = paths.indexOf(deactivatedPaths[0]);
        svgMap.documentElement.insertBefore(country, paths[lowestIndex]);
        } else {
        svgMap.documentElement.appendChild(country);
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
                if (paths[i].getAttribute("owner") === "Player" && country.getAttribute("deactivated") === "false") {
                    paths[i].setAttribute('fill', playerColour);
                    if (territoryAboutToBeAttacked) {
                        removeImageFromPathAndRestoreNormalStroke(territoryAboutToBeAttacked, false, false);
                        document.getElementById("attack-destination-container").style.display = "none";
                        attackTextCurrentlyDisplayed = false;
                    }
                }
            }
        }

        if (lastClickedPath.hasAttribute("fill") && !escKeyEntry) { //if a territory has previusly been clicked, handle deselecting previous
            for (let i = 0; i < paths.length; i++) {
                if ((paths[i].getAttribute("uniqueid") === lastClickedPath.getAttribute("uniqueid")) && paths[i].getAttribute("owner") === "Player" && country.getAttribute("deactivated") === "false") { //set the iterating path to the player color when clicking on any path and the iteratingpath is a player territory
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

      if (lastClickedPath !== null && !escKeyEntry) {
          if (lastClickedPath.getAttribute('d') !== 'M0 0 L50 50') {
            if (lastClickedPath.getAttribute("deactivated") === "false") {
                lastClickedPath.parentNode.insertBefore(lastClickedPath, lastClickedPath.parentNode.children[9]);
            }
            if (lastClickedPath.getAttribute("uniqueid") !== currentPath.getAttribute("uniqueid") && lastClickedPath.getAttribute("owner") !== "Player") {
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
      playSoundClip();
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
  popupConfirm.innerText = "Confirm";
  popupConfirm.classList.add("popup-option");
  popupConfirm.classList.add("popup-option-confirm");
  popupConfirm.setAttribute("id", "popup-confirm");


  const UIToggleButton = document.createElement("img");
  UIToggleButton.src = "resources/globeNoStandButtonUI.png"; // Set the image source URL
  UIToggleButton.classList.add("UI-option");
  UIToggleButton.setAttribute("id", "UIToggleButton");

  UIToggleButton.addEventListener("click", function() {
      playSoundClip();
      if (uiCurrentlyOnScreen) {
          toggleUIMenu(false);
      } else {
          toggleUIMenu(true);
      }

  });

  document.getElementById("UIButtonContainer").appendChild(UIToggleButton);

  colorPicker.addEventListener("click", function() {
      playSoundClip();
      document.getElementById("player-color-picker").style.display = "block";
  });

  document.getElementById("player-color-picker").addEventListener('change', function() {
      playerColour = convertHexValuetoRGB(document.getElementById("player-color-picker").value);
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
      playSoundClip();
      if (selectCountryPlayerState) {
          setAllGreyedOutAttributesToFalseOnGameStart();
          selectCountryPlayerState = false;
          countrySelectedAndGameStarted = true;
          document.getElementById("popup-color").style.color = playerColour;
          popupSubTitle.style.opacity = "0.5";
          playerCountry = document.getElementById("popup-body").innerHTML;
          flag = playerCountry;
          setFlag(flag, 1); //set playerflag in top table
          setFlag(flag, 3); //set playerflag in ui info panel
          uiButtonCurrentlyOnScreen = true;
          toggleUIButton(true);
          restoreMapColorState(currentMapColorAndStrokeArray, true);
          initialiseGame();
          document.getElementById("top-table-container").style.display = "block";
          popupTitle.innerText = "Buy / Upgrade Phase";
          popupSubTitle.innerText = "";
          popupConfirm.innerText = "MILITARY";
          turnPhase++;
          currentMapColorAndStrokeArray = saveMapColorState(false);
      } else if (countrySelectedAndGameStarted && turnPhase == 0) {
          currentMapColorAndStrokeArray = saveMapColorState(false); //grab state of map colors at start of turn.
          popupTitle.innerText = "Buy / Upgrade Phase";
          popupConfirm.innerText = "MILITARY";
          modifyCurrentTurnPhase(turnPhase);
          turnPhase++;
      } else if (countrySelectedAndGameStarted && turnPhase == 1) {
          currentMapColorAndStrokeArray = saveMapColorState(false); //grab state of map colors at start of turn.
          popupTitle.innerText = "Military Phase";
          popupConfirm.innerText = "END TURN";
          modifyCurrentTurnPhase(turnPhase);
          turnPhase++;
      } else if (countrySelectedAndGameStarted && turnPhase == 2) {
          removeImageFromPathAndRestoreNormalStroke(lastClickedPath, false, false);
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
  topTableFlag.addEventListener("mouseover", (e) => {
      tooltip.innerHTML = playerCountry;
      tooltip.style.display = "block";
  });
  topTableFlag.addEventListener("mouseout", (e) => {
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
  topTableOil.addEventListener("mouseover", (e) => {
      let totalOilDemandCountry = demandArray.totalOilDemand;

      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Oil:</span></div>
    <div>Total Oil Capacity: ${Math.ceil(capacityArray.totalOilCapacity)}</div>
    <div>Total Oil Demand: ${totalOilDemandCountry}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableOil.addEventListener("mouseout", (e) => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const oilImg = document.createElement("img");
  oilImg.classList.add("sizingIcons");
  oilImg.alt = "Oil";
  oilImg.src = "resources/oil.png";

  const topTableOilValue = document.createElement("td");
  topTableOilValue.classList.add("resourceFields");
  topTableOilValue.addEventListener("mouseover", (e) => {
      let totalOilDemandCountry = demandArray.totalOilDemand;
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Oil:</span></div>
    <div>Total Oil Capacity: ${Math.ceil(capacityArray.totalOilCapacity)}</div>
    <div>Total Oil Demand: ${totalOilDemandCountry}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableOilValue.addEventListener("mouseout", (e) => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const topTableFood = document.createElement("td");
  topTableFood.classList.add("iconCell");
  topTableFood.addEventListener("mouseover", (e) => {
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Food:</span></div>
    <div>Total Food Capacity: ${formatNumbersToKMB(capacityArray.totalFoodCapacity)}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableFood.addEventListener("mouseout", (e) => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const foodImg = document.createElement("img");
  foodImg.classList.add("sizingIcons");
  foodImg.alt = "Food";
  foodImg.src = "resources/food.png";

  const topTableFoodValue = document.createElement("td");
  topTableFoodValue.classList.add("resourceFields");
  topTableFoodValue.addEventListener("mouseover", (e) => {
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Food:</span></div>
    <div>Total Food Capacity: ${formatNumbersToKMB(capacityArray.totalFoodCapacity)}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableFoodValue.addEventListener("mouseout", (e) => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const topTableConsMats = document.createElement("td");
  topTableConsMats.classList.add("iconCell");
  topTableConsMats.addEventListener("mouseover", (e) => {
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Cons Mats.:</span></div>
    <div>Total Cons. Mats. Capacity: ${Math.ceil(capacityArray.totalConsMatsCapacity)}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableConsMats.addEventListener("mouseout", (e) => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const consMatsImg = document.createElement("img");
  consMatsImg.classList.add("sizingIcons");
  consMatsImg.alt = "Construction Materials";
  consMatsImg.src = "resources/consMats.png";

  const topTableConsMatsValue = document.createElement("td");
  topTableConsMatsValue.classList.add("resourceFields");
  topTableConsMatsValue.addEventListener("mouseover", (e) => {
      let tooltipContent = `
    <div><span style="color: rgb(235,235,0)">Cons Mats.:</span></div>
    <div>Total Cons. Mats. Capacity: ${Math.ceil(capacityArray.totalConsMatsCapacity)}</div>
  `;
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
  });
  topTableConsMatsValue.addEventListener("mouseout", (e) => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });

  const topTableprodPopulation = document.createElement("td");
  topTableprodPopulation.classList.add("iconCell");

  const prodPopulationImg = document.createElement("img");
  prodPopulationImg.classList.add("sizingIcons");
  prodPopulationImg.alt = "Population";
  prodPopulationImg.src = "resources/prodPopulation.png";

  const topTableprodPopulationValue = document.createElement("td");
  topTableprodPopulationValue.classList.add("population");

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
  topTableRow.appendChild(topTableprodPopulation);
  topTableprodPopulation.appendChild(prodPopulationImg);
  topTableRow.appendChild(topTableprodPopulationValue);
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
      playSoundClip();
      summaryButton.classList.add("tab-button");
      uiButtons(summaryButton);
      drawUITable(uiTable, 0);
  });

  const territoryButton = document.createElement("button");
  territoryButton.classList.add("tab-button");
  territoryButton.setAttribute("id", "territoryButton");
  territoryButton.innerHTML = "Territories";

  territoryButton.addEventListener("click", function() {
      playSoundClip();
      territoryButton.classList.add("tab-button");
      uiButtons(territoryButton);
      drawUITable(uiTable, 1);
  });

  const armyButton = document.createElement("button");
  armyButton.classList.add("tab-button");
  armyButton.setAttribute("id", "armyButton");
  armyButton.innerHTML = "Military";

  armyButton.addEventListener("click", function() {
      playSoundClip();
      uiButtons(armyButton);
      drawUITable(uiTable, 2);
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
      playSoundClip();
      uiAppearsAtStartOfTurn = toggleUIToAppearAtStartOfTurn(checkBox, uiAppearsAtStartOfTurn);
  });

  const xButton = document.createElement("button");
  xButton.classList.add("x-button");
  xButton.setAttribute("id", "xButton");
  xButton.innerHTML = "X";

  xButton.addEventListener("click", function() {
      playSoundClip();
      toggleUIMenu(false);
      uiCurrentlyOnScreen = false;
      territoryButton.classList.remove("active");
      armyButton.classList.remove("active");
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
      playSoundClip();
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
  pricesInfoCol2.innerHTML = 0;

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
  pricesInfoCol4.innerHTML = 0;

  const bottomBarConfirmButton = document.createElement("button");
  bottomBarConfirmButton.classList.add("bottom-bar-confirm-button");
  bottomBarConfirmButton.setAttribute("id", "bottom-bar-confirm-button");
  bottomBarConfirmButton.innerHTML = "Cancel";

  bottomBarConfirmButton.addEventListener("click", function() {
      playSoundClip();
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
      playSoundClip();
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
  pricesBuyInfoCol2.innerHTML = 0;

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
  pricesBuyInfoCol4.innerHTML = 0;

  const bottomBarBuyConfirmButton = document.createElement("button");
  bottomBarBuyConfirmButton.classList.add("bottom-bar-buy-confirm-button");
  bottomBarBuyConfirmButton.setAttribute("id", "bottom-bar-buy-confirm-button");
  bottomBarBuyConfirmButton.innerHTML = "Cancel";

  bottomBarBuyConfirmButton.addEventListener("click", function() {
      playSoundClip();
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
      if ((transferAttackbuttonState === 0 && transferAttackButton.innerHTML === "CONFIRM") || (transferAttackbuttonState === 1 && (transferAttackButton.innerHTML === "CONFIRM" || transferAttackButton.innerHTML === "INVADE!" || transferAttackButton.innerHTML === "CANCEL"))) {
        transferAttackButton.style.fontWeight = "normal";
        transferAttackButton.style.color = "white";
        if (transferAttackbuttonState === 1) {
            setAttackProbabilityOnUI(0, 0);
            territoryUniqueIds.length = 0;
        }
      }
      playSoundClip();
      toggleTransferAttackWindow(false);
      transferAttackWindowOnScreen = false;
      svg.style.pointerEvents = 'auto';
      toggleUIButton(true);
      toggleBottomLeftPaneWithTurnAdvance(true);
      handleMovePhaseTransferAttackButton("xButtonClicked", lastPlayerOwnedValidDestinationsArray, playerOwnedTerritories, lastClickedPath, true, transferAttackbuttonState);
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
  battleUITitleTitleCenter.innerHTML = "vs";

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
  battleUIRow4Col1.innerHTML = "Round 1 of 5";

  const battleUIRow4Col2 = document.createElement("div");
  battleUIRow4Col2.classList.add("battleUIRow4Col2");
  battleUIRow4Col2.setAttribute("id","battleUIRow4Col2");

  const siegeButton = document.createElement("div");
  siegeButton.classList.add("siegeButton");
  siegeButton.setAttribute("id","siegeButton");

  const defenceIcon = document.createElement("div");
  defenceIcon.classList.add("defenceIcon");
  defenceIcon.setAttribute("id","defenceIcon");
  defenceIcon.innerHTML = "<img class='sizingPositionDefenceBonusIconBattleUI' src='./resources/fortIcon.png'>"

  const defenceBonusText = document.createElement("div");
  defenceBonusText.classList.add("defenceBonusText");
  defenceBonusText.setAttribute("id","defenceBonusText");
  defenceBonusText.innerHTML = "  20%";

  const battleUIRow5 = document.createElement("div");
  battleUIRow5.classList.add("battleUIRow");
  battleUIRow5.classList.add("battleUIRow5");
  battleUIRow5.setAttribute("id","battleUIRow5");

  const battleUIRow5Button1 = document.createElement("div");
  battleUIRow5Button1.classList.add("battleUIRow5Button1");
  battleUIRow5Button1.setAttribute("id","battleUIRow5Button1");

  const battleUIRow5Button2 = document.createElement("div");
  battleUIRow5Button2.classList.add("battleUIRow5Button2");
  battleUIRow5Button2.setAttribute("id","battleUIRow5Button2");

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

  battleUIRow4Col2.appendChild(siegeButton);
  battleUIRow4Col2.appendChild(defenceIcon);
  battleUIRow4Col2.appendChild(defenceBonusText);

  battleUIRow4.appendChild(battleUIRow4Col1);
  battleUIRow4.appendChild(battleUIRow4Col2);

  battleUIRow5.appendChild(battleUIRow5Button1);
  battleUIRow5.appendChild(battleUIRow5Button2);

  battleUIContainer.appendChild(battleUIRow1);
  battleUIContainer.appendChild(battleUIRow2);
  battleUIContainer.appendChild(battleUIRow3);
  battleUIContainer.appendChild(battleUIRow4);
  battleUIContainer.appendChild(battleUIRow5);

  document.getElementById("battleContainer").appendChild(battleUIContainer);

  pageLoaded = true;
});

document.addEventListener("keydown", function(event) {
  playSoundClip();
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
      toggleBattleUI(false);
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
      if (transferAttackWindowOnScreen || battleUIDisplayed) {
          if (transferAttackWindowOnScreen) {
            toggleTransferAttackWindow(true);
          } else if (battleUIDisplayed) {
            toggleBattleUI(true);
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
      if (battleUIDisplayed) {
        toggleBattleUI(true);
      }
      toggleBottomTableContainer(true);
      document.getElementById("menu-container").style.display = "none";

      if (lastClickedPath.getAttribute("d") !== "M0 0 L50 50") {
          selectCountry(lastClickedPath, true);
          if (territoryAboutToBeAttacked) {
              removeImageFromPathAndRestoreNormalStroke(territoryAboutToBeAttacked, false, true);
              addImageToPath(territoryAboutToBeAttacked, "army.png");
          }
      }

      menuState = false;
  }
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

    destinationPathObjectArray = removeDeniedDestinations(destinationPathObjectArray, manualDenialArray); //remove denied countrys (manual exception)
  
    if (manualExceptionsArray.length > 0) { //works correctly
        for (let i = 0; i < manualExceptionsArray.length; i++) {
            tempValidDestinationsArray.push(changeCountryColor(manualExceptionsArray[i], false, "pattern", count, attacking)[0]); //change color of touching countrys
            count++;
        }
    }
  
    for (let i = 0; i < destinationPathObjectArray.length; i++) {
        const targetName = targetPath.getAttribute("data-name");
        const destName = destinationPathObjectArray[i].getAttribute("data-name");
  
        if (distances[i] < 1 && targetPath !== destinationPathObjectArray[i]) { //if touches borders then always draws a line
            tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]); //change color of touching countrys
            count++;
        } else if (targetName === destName && targetPath !== destinationPathObjectArray[i]) { //if another territory of same country, then change color
            tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]); //change color of touching countrys
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
                    tempValidDestinationsArray.push(changeCountryColor(destinationPathObjectArray[i], false, "pattern", count, attacking)[0]); //change color of touching countrys
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
  

function getClosestPointsDestinationPaths(coord, paths) {
  const closestPoints = [];

  for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      let closestPoint = null;
      let closestDistance = Infinity;

      for (let j = 0; j < path.length; j++) {
          const point = path[j];
          const distance = Math.sqrt((coord[0][1] - point.x) ** 2 + (coord[0][2] - point.y) ** 2);

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

  if (place !== 4 && place !== 5) {
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
  } else if (button === territoryButton) {
      summaryButton.classList.remove("active");
      territoryButton.classList.add("active");
      armyButton.classList.remove("active");
  } else if (button === armyButton) {
      summaryButton.classList.remove("active");
      territoryButton.classList.remove("active");
      armyButton.classList.add("active");
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
      if (mouseAction === "mouseOver" && r <= 254 && g <= 254 && b <= 254) { //this handles color change when hovering (doesnt run on selected or interactable territories)
          hoveredNonInteractableAndNonSelectedTerritory = true;
          r += 20;
          g += 20;
          b += 20;
          territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
      } else if (mouseAction === "mouseOut" && r <= 254 && g <= 254 && b <= 254) { //this handles color change when leaving a hover (doesnt run on selected or interactable territories)
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
                  if (arrayOfSelectedCountries[i][0].getAttribute("deactivated") ==="false") {
                    setStrokeWidth(arrayOfSelectedCountries[i][0], "1");
                  }
              }
          } else {
              console.log("array empty");
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
          if (array[i][0] == path.getAttribute("uniqueid")) {
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
  const rgbString = `rgb(${val1}, ${val2}, ${val3})`;
  return rgbString;
}

function convertHexValuetoRGB(value) {
  // Strip the "#" prefix if present
  const hex = value.replace(/^#/, "");
  // Convert the hex string to an integer
  const intValue = parseInt(hex, 16);
  // Extract the red, green, and blue color components from the integer
  const red = (intValue >> 16) & 0xff;
  const green = (intValue >> 8) & 0xff;
  const blue = intValue & 0xff;
  // Construct the RGB string and return it
  return `rgb(${red},${green},${blue})`;
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
          // if clicks on a player-owned territory then show button in transfer state
          if (path.getAttribute("deactivated") === "true") {
            button.innerHTML = "DEACTIVATED";
            button.classList.remove("move-phase-button-red-background");
            button.classList.remove("move-phase-button-green-background");
            button.classList.add("move-phase-button-grey-background");
            button.disabled = true;
            button.style.display = "flex";
            transferAttackButtonDisplayed = true;
          } else {
            button.innerHTML = "TRANSFER";
          if (playerOwnedTerritories.length <= 1) {
              button.classList.remove("move-phase-button-red-background");
              button.classList.remove("move-phase-button-green-background");
              button.classList.add("move-phase-button-grey-background");
              button.disabled = true;
          } else {
              button.classList.remove("move-phase-button-red-background");
              button.classList.remove("move-phase-button-grey-background");
              button.classList.add("move-phase-button-green-background");
              button.disabled = false;
              transferAttackbuttonState = 0; //transfer
          }
          button.style.display = "flex";
          transferAttackButtonDisplayed = true;
          }
      } else if (lastClickedPathExternal.getAttribute("owner") === "Player" && path.getAttribute("attackableTerritory") === "true" && path.getAttribute("owner") !== "Player" && lastPlayerOwnedValidDestinationsArray.some(destination => destination.getAttribute("uniqueid") === path.getAttribute("uniqueid"))) {
          // if clicks on an enemy territory that is within reach then show attack state
          button.innerHTML = "ATTACK";
          button.classList.remove("move-phase-button-green-background");
          button.classList.remove("move-phase-button-grey-background");
          button.classList.add("move-phase-button-red-background");
          button.style.display = "flex";
          transferAttackButtonDisplayed = true;
          button.disabled = false;
          transferAttackbuttonState = 1; //attack
          setTerritoryForAttack(path);
      }
  } else {
      if (xButtonFromWhere === 0) { //transfer
          button.style.display = "flex";
          button.innerHTML = "TRANSFER";
          button.classList.remove("move-phase-button-blue-background");
          button.classList.remove("move-phase-button-red-background");
          button.classList.remove("move-phase-button-grey-background");
          button.classList.add("move-phase-button-green-background");
          transferAttackbuttonState = 0;
          return;
      } else if (xButtonFromWhere === 1) { //attack
          button.style.display = "flex";
          button.innerHTML = "ATTACK";
          button.classList.remove("move-phase-button-blue-background");
          button.classList.remove("move-phase-button-green-background");
          button.classList.remove("move-phase-button-grey-background");
          button.classList.add("move-phase-button-red-background");
          transferAttackbuttonState = 1;
          return;
      }
  }

  button.removeEventListener("click", transferAttackClickHandler); // Remove the existing event listener if any

  button.addEventListener("click", transferAttackClickHandler);

  function transferAttackClickHandler() {
    playSoundClip();
      if (transferAttackbuttonState == 0) {
          territoryComingFrom = lastClickedPath;
      }
      if (!eventHandlerExecuted) {
          eventHandlerExecuted = true;
          if (!button.disabled) {
              if (!transferAttackWindowOnScreen) {
                  toggleUIButton(false);
                  toggleBottomLeftPaneWithTurnAdvance(false);

                  toggleTransferAttackWindow(true);
                  svg.style.pointerEvents = 'none';
                  setTransferAttackWindowTitleText(
                      territoryAboutToBeAttacked && territoryAboutToBeAttacked.getAttribute("territory-name") !== null ?
                      territoryAboutToBeAttacked.getAttribute("territory-name") :
                      "transferring",
                      territoryAboutToBeAttacked ? territoryAboutToBeAttacked.getAttribute("data-name") : null,
                      territoryComingFrom,
                      transferAttackbuttonState,
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
                      transferAttackbuttonState
                  );

                  const selection = document.querySelectorAll('.transfer-table-row-hoverable > .transfer-table-outer-column:first-of-type');
                  setTransferToTerritory(selection);

                  if (transferAttackbuttonState === 1) {
                      for (let i = 0; i < paths.length; i++) {
                          paths[i].setAttribute("attackableTerritory", "false");
                      }
                  }
                  setTimeout(function() {
                      eventHandlerExecuted = false; // Reset the flag after a delay
                  }, 200);
                  return;
              } else if (transferAttackWindowOnScreen) {
                if (button.innerHTML === "CONFIRM" || button.innerHTML === "INVADE!") {
                    button.style.fontWeight = "normal";
                    button.style.color = "white";
                    setAttackProbabilityOnUI(0, 0);
                }
                  if (transferAttackbuttonState === 0) {
                    if (button.innerHTML === "CONFIRM") {
                        transferArmyToNewTerritory(transferQuantitiesArray);
                    }
                    button.classList.remove("move-phase-button-blue-background");
                    button.classList.add("move-phase-button-green-background");
                    button.innerHTML = "TRANSFER";
                    toggleTransferAttackWindow(false);
                    transferAttackWindowOnScreen = false;
                    svg.style.pointerEvents = 'auto';
                    toggleUIButton(true);
                    toggleBottomLeftPaneWithTurnAdvance(true);
                    setTimeout(function() {
                        eventHandlerExecuted = false; // Reset the flag after a delay
                    }, 200);
                    return;
                  } else if (transferAttackbuttonState === 1) {
                    if (button.innerHTML === "INVADE!") {
                        transferArmyOutOfTerritoryOnStartingInvasion(finalAttackArray, mainArrayOfTerritoriesAndResources);
                        toggleBattleUI(true);
                        setupBattleUI(finalAttackArray);
                        battleUIDisplayed = true;
                        svg.style.pointerEvents = 'none';
                        doBattle(probability, finalAttackArray, mainArrayOfTerritoriesAndResources);
                        setTimeout(function() {
                            eventHandlerExecuted = false; // Reset the flag after a delay
                        }, 200);
                    } else if (button.innerHTML === "CANCEL") {
                        setAttackProbabilityOnUI(0, 0);
                    }
                      territoryUniqueIds.length = 0;

                      if (button.innerHTML !== "DEACTIVATED") {
                        button.classList.remove("move-phase-button-blue-background");
                        button.classList.add("move-phase-button-red-background");
                        button.innerHTML = "ATTACK";
                      }
                      if (transferAttackbuttonState === 0) {
                        toggleUIButton(true);
                        toggleBottomLeftPaneWithTurnAdvance(true);
                        svg.style.pointerEvents = 'auto';
                      }
                      toggleTransferAttackWindow(false);
                      transferAttackWindowOnScreen = false;
                      setTimeout(function() {
                          eventHandlerExecuted = false; // Reset the flag after a delay
                      }, 200);
                      return;
                  }
              }
          }
          setTimeout(function() {
              eventHandlerExecuted = false; // Reset the flag after a delay
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
      }

      tooltip.style.display = "block";

  });
  button.addEventListener("mouseout", () => {
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
  });
}

function setTerritoryForAttack(territoryToAttack) {
  territoryAboutToBeAttacked = territoryToAttack;
  document.getElementById("attack-destination-text").innerHTML = territoryAboutToBeAttacked.getAttribute("territory-name");
  document.getElementById("leftBattleImage").src = setFlag(territoryToAttack.getAttribute("data-name"), 0);
  document.getElementById("rightBattleImage").src = setFlag(territoryToAttack.getAttribute("data-name"), 0);
  document.getElementById("attack-destination-container").style.display = "flex";
  attackTextCurrentlyDisplayed = true;
  territoryToAttack.style.stroke = territoryToAttack.getAttribute("fill");
  territoryToAttack.setAttribute("fill", playerColour);
  territoryToAttack.setAttribute("stroke-width", "5px");
  territoryToAttack.style.strokeDasharray = "10, 5";
  addImageToPath(territoryToAttack, "army.png");
}

function addImageToPath(pathElement, imagePath) {
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
  imageElement.setAttribute("x", imageX);
  imageElement.setAttribute("y", imageY);
  imageElement.setAttribute("width", imageWidth);
  imageElement.setAttribute("height", imageHeight);
  imageElement.setAttribute("z-index", 9999);
  imageElement.setAttribute("id", "armyImage"); // Add ID "armyImage" to the image element

  pathElement.parentNode.appendChild(imageElement);
}


export function removeImageFromPathAndRestoreNormalStroke(path, clickedSeaWithTerritoryToAttackSelected, escKeyEntry) {
  const imageElement = path.parentNode.getElementById("armyImage");

  if (imageElement) {
      imageElement.parentNode.removeChild(imageElement);
  }
  if (path !== territoryAboutToBeAttacked && escKeyEntry) {
    path.style.strokeDasharray = "none";
    path.style.stroke = "rgb(0,0,0)";
    path.setAttribute("stroke-width", "1");
  }
  if (clickedSeaWithTerritoryToAttackSelected) {
    path.style.strokeDasharray = "none";
    path.style.stroke = "rgb(0,0,0)";
    path.setAttribute("stroke-width", "1");
  }
  if (path === territoryAboutToBeAttacked && !escKeyEntry) {
    path.style.strokeDasharray = "none";
    path.style.stroke = "rgb(0,0,0)";
    path.setAttribute("stroke-width", "1");
    toggleTransferAttackButton(false);
    transferAttackButtonDisplayed = false;
    attackTextCurrentlyDisplayed = false;
  }
}

function setTransferAttackWindowTitleText(territory, country, territoryComingFrom, buttonState, mainArray) {
    let elementInMainArray;
    let totalAttackAmountArray = [0,0,0,0];

    if (buttonState === 1) {
        for (let i = 0; i < territoriesAbleToAttackTarget.length; i++) { //get total attack numbers for icon row attack window
            for (let j = 0; j < mainArrayOfTerritoriesAndResources.length; j++) {
                if (territoriesAbleToAttackTarget[i].getAttribute("uniqueid") === mainArrayOfTerritoriesAndResources[j].uniqueId) {
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
    }
  
    let attackingOrTransferring = "";

    document.getElementById("contentTransferHeaderRow").style.display = "flex";
    let imageElement;
    let imageSrc;

    if (buttonState === 0) {
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
                                                ? `<span style="font-weight: bold; color: rgb(245,160,160)";>${matchingElement.useableAssault}</span>`
                                                : matchingElement.useableAssault
                                        }/${matchingElement.assaultForCurrentTerritory}<br />
                                        Air: ${
                                            matchingElement.useableAir < matchingElement.airForCurrentTerritory
                                                ? `<span style="font-weight: bold; color: rgb(245,160,160)";>${matchingElement.useableAir}</span>`
                                                : matchingElement.useableAir
                                        }/${matchingElement.airForCurrentTerritory}<br />
                                        Naval: ${
                                            matchingElement.useableNaval < matchingElement.navalForCurrentTerritory
                                                ? `<span style="font-weight: bold; color: rgb(245,160,160)";>${matchingElement.useableNaval}</span>`
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
      territoryTextString.innerHTML = territory + " (" + country + ")";
      territoryTextString.style.color = "white";
    }
  
    const attackingFromTerritory = document.getElementById("attackingFromTerritoryTextString");
    const titleTransferAttackWindow = document.getElementById("title-transfer-attack-window");
  
    if (!transferToAttackHeading || !fromHeading || !territoryTextString || !attackingFromTerritory || !titleTransferAttackWindow) {
        console.error("One or more required elements are null.");
        return;
    }
  
    transferToAttackHeading.innerHTML = attackingOrTransferring;
    territoryTextString.innerHTML = (territory === "transferring" ? " (please select an option...)" : territory + " (" + country + ")");
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
          const clickedTerritoryName = territory.innerHTML;
          transferToTerritory = playerOwnedTerritories.find(territory => territory.getAttribute("territory-name") === clickedTerritoryName);

          if (transferToTerritory) {
              document.getElementById("territoryTextString").innerHTML = clickedTerritoryName;
          } else {
              document.getElementById("territoryTextString").innerHTML = "please select an option...";
          }
      });
  });
}

export function getLastClickedPath() {
  return lastClickedPath;
}

export function setAttackProbabilityOnUI(probability, place) {
    const roundedProbability = Math.ceil(probability);
    const displayProbability = roundedProbability >= 100 ? 100 : roundedProbability;

    if (place === 0) { //attackUI
        document.getElementById("percentageAttack").innerHTML = displayProbability + "%";
        if (displayProbability >= 1) {
            document.getElementById("colorBarAttackOverlayGreen").style.display = "flex";
        } else {
            document.getElementById("colorBarAttackOverlayGreen").style.display = "none";
        }
        document.getElementById("colorBarAttackOverlayGreen").style.width = displayProbability >= 99 ? "100%" : displayProbability + "%";
    } else if (place === 1) { //battleUI
        let probabilityColumnBox = document.getElementById("probabilityColumnBox");

        let battleUIRow4Col1 = document.getElementById("battleUIRow4Col1");
        battleUIRow4Col1.innerHTML = battleUIRow4Col1.innerHTML + " : Probability = " + displayProbability + "%";

        probabilityColumnBox.style.width = displayProbability >= 99 ? "100%" : displayProbability + "%";
        
    }
}
    

  export function setcurrentMapColorAndStrokeArrayFromExternal(changesArray) {
    currentMapColorAndStrokeArray = changesArray;
  }

  export function setterritoryAboutToBeAttackedFromExternal(value) {
    territoryAboutToBeAttacked = value;
  }

  export function setAttackTextCurrentlyDisplayedFromExternal(value) {
    attackTextCurrentlyDisplayed = value;
  }

  export function setTransferAttackButtonDisplayedFromExternal(value) {
    transferAttackButtonDisplayed = value;
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
        document.getElementById("main-ui-container").style.display = "block";
        drawUITable(uiTable, 0);
        svg.style.pointerEvents = 'none';
        uiCurrentlyOnScreen = true;
        toggleUIButton(false);
        document.getElementById("popup-with-confirm-container").style.display = "none";
        toggleTransferAttackButton(false);
    } else {
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
  
  function toggleBattleUI(turnOnBattleUI) {
      let battleUI = document.getElementById("battleContainer");
    if (turnOnBattleUI) {
      battleUI.style.display = "block";
    } else if (!turnOnBattleUI) {
      battleUI.style.display = "none";
    }
  }
  
  function toggleTransferAttackWindow(turnOnTransferAttackWindow) {
    let transferAttackWindow = document.getElementById("transfer-attack-window-container");
    if (turnOnTransferAttackWindow) {
        transferAttackWindow.style.display = "block";
        transferAttackWindowOnScreen = true;
    } else if (!turnOnTransferAttackWindow) {
        transferAttackWindow.style.display = "none";
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
  
  function setupBattleUI(attackArray) {
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
    setTitleTextBattleUI(attackerCountry, defenderTerritory);

    //SET PROBABILITY ON UI
    setAttackProbabilityOnUI(probability, 1);

    //SET ARMY TEXT VALUES
    setArmyTextValues(finalAttackArray, defenderTerritory);

    //INITIALISE BUTTONS
    retreatButtonState = setRetreatButtonText(0);
    advanceButtonState = setAdvanceButtonText(0);
    siegeButtonState = setSiegeButtonText(0);
}

function setTitleTextBattleUI(attacker, defender) {
    let attackerContainer = document.getElementById("battleUITitleTitleLeft");
    let defenderContainer = document.getElementById("battleUITitleTitleRight");

    let attackerCountry = attacker.getAttribute("data-name");
    let defenderTerritory = defender.getAttribute("territory-name");

    attackerCountry = reduceKeywords(attackerCountry);
    defenderTerritory = reduceKeywords(defenderTerritory);

    attackerContainer.innerHTML = attackerCountry;
    defenderContainer.innerHTML = defenderTerritory;
}

export function setArmyTextValues(attackArray) {
    let totalAttackingArmy = [0,0,0,0];
    let totalDefendingArmy = [0,0,0,0];
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
        if (mainArrayOfTerritoriesAndResources[i].uniqueId === attackArray[0]) { //any player territory to get country name
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
    document.getElementById("armyRowRow2Quantity1").innerHTML = formatNumbersToKMB(totalAttackingArmy[0]);
    document.getElementById("armyRowRow2Quantity2").innerHTML = formatNumbersToKMB(totalAttackingArmy[1]);
    document.getElementById("armyRowRow2Quantity3").innerHTML = formatNumbersToKMB(totalAttackingArmy[2]);
    document.getElementById("armyRowRow2Quantity4").innerHTML = formatNumbersToKMB(totalAttackingArmy[3]);
    document.getElementById("armyRowRow2Quantity5").innerHTML = formatNumbersToKMB(totalDefendingArmy[0]);
    document.getElementById("armyRowRow2Quantity6").innerHTML = formatNumbersToKMB(totalDefendingArmy[1]);
    document.getElementById("armyRowRow2Quantity7").innerHTML = formatNumbersToKMB(totalDefendingArmy[2]);
    document.getElementById("armyRowRow2Quantity8").innerHTML = formatNumbersToKMB(totalDefendingArmy[3]);
}

function reduceKeywords(str) {
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

  function setRetreatButtonText(situation) {
    const retreatButton = document.getElementById("battleUIRow5Button1");
    switch (situation) {
        case 0: //open battle / start of attack round of 5
            retreatButton.innerHTML = "Retreat!";
            break;
        case 1: // midway through round of 5
            retreatButton.innerHTML = "Scatter!";
            break;
        case 2: // midway through round of 5
            retreatButton.innerHTML = "Defeat!";
            break;
    }

    return situation;
  }

  function setAdvanceButtonText(situation) {
    const advanceButton = document.getElementById("battleUIRow5Button2");
    switch (situation) {
        case 0: //open battle / start of attack round of 5
            advanceButton.innerHTML = "Commit To Battle";
            break;
        case 1: // midway through round of 5
            advanceButton.innerHTML = "Next Round";
            break;
        case 2: // win war outright
            advanceButton.innerHTML = "Victory!";
            break;
        case 3: // massive assault win
            advanceButton.innerHTML = "Massive Assault";
            break;
        case 4: // routing win
            advanceButton.innerHTML = "Rout The Enemy";
            break;
    }

    return situation;
  }

  function setSiegeButtonText(situation) {
    const siegeButton = document.getElementById("siegeButton");
    switch (situation) {
        case 0: //not sieged currently
        siegeButton.innerHTML = "Siege Territory";
            break;
        case 1: // sieged currently
        siegeButton.innerHTML = "Lift Siege";
            break;
    }

    return situation;
  }
  