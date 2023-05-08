import { arrayOfArmyAndResourceProportionsUI } from './resourceCalculations.js';
import { findMatchingCountries } from './manualExceptionsForInteractions.js';
import { initialiseGame as initialiseGame } from './gameTurnsLoop.js';
import { currentTurnPhase, modifyCurrentTurnPhase } from "./gameTurnsLoop.js"
import { newArrayOfTerritorySpecificArmyAndResources } from './resourceCalculations.js';


export let pageLoaded = false;
const svgns = "http://www.w3.org/2000/svg";
let currentlySelectedColorsArray = [];
let turnPhase = currentTurnPhase;

//variables that receive information for resources of countrys after database reading and calculations, before game starts
export let exportArmy;
export let exportPop;
export let exportArea;
export let exportGold;
export let exportOil;
export let exportFood;
export let exportConsMats;
export let playerCountry;
export let playerColour;

let currentMapColorArray = []; //current state of map at start of new turn
const continentColorArray = [["Africa", [233, 234, 20]], 
                            ["Asia", [203, 58, 22]],
                            ["Europe", [186, 218, 85]],
                            ["North America", [83, 107, 205]],
                            ["South America", [193, 83, 205]],
                            ["Oceania", [74, 202, 233]]];

let teamColorArray = [];

//path selection variables
let lastClickedPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
lastClickedPath.setAttribute("d", "M0 0 L50 50"); // used for player selection, and for stroke alteration
let currentPath; // used for hover, and tooltip before user clicks on a country
let currentSelectedPath;
let validDestinationsAndClosestPointArray; //populated with valid interaction territories when a particular territory is selected
let validDestinationsArray;
let closestDistancesArray;
let hoveredNonInteractableAndNonSelectedTerritory = false;
let colorArray;

// Game States
let popupCurrentlyOnScreen = false; // used for handling popups on screen when game state changes
let UICurrentlyOnScreen = false;
let outsideOfMenuAndMapVisible = false;
let clickActionsDone = false;
let countrySelectedAndGameStarted = false;
let menuState = true;
let selectCountryPlayerState = false;
let UIButtonCurrentlyOnScreen = false;

//This determines how the map will be colored for different game modes
let mapMode = 1; //0 - standard continent coloring 1 - random coloring and team assignments 2 - totally random color

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

export function svgMapLoaded() {
  const svgMap = document.getElementById('svg-map').contentDocument;
  const svg = document.getElementById('svg-map');
  svg.setAttribute("tabindex", "0");
  const tooltip = document.getElementById("tooltip");
  svg.focus();

  //console.log(manualInteractionExceptions);

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
    hoverOverTerritory(path, "mouseOver");

    // Get the name of the country from the "data-name" attribute
    const countryName = path.getAttribute("owner");

    // Get the coordinates of the mouse cursor
    const x = e.clientX;
    const y = e.clientY;

    // Set the content of the tooltip
    tooltip.innerHTML = countryName;

    // Position the tooltip next to the mouse cursor
    tooltip.style.left = x - 40 + "px";
    tooltip.style.top = 25 + y + "px";

    // Show the tooltip
    tooltip.style.display = "block";
    tooltip.style.backgroundColor = "white";

    path.style.cursor = "pointer";
  });

  // Add a mouseout event listener to the SVG element
  svgMap.addEventListener("mouseout", function(e) {
    tooltip.innerHTML = "";
    tooltip.style.display = "none";
    tooltip.style.backgroundColor = "transparent";
    hoverOverTerritory(currentPath, "mouseOut"); // Pass the current path element and set mouseAction to 1
    clickActionsDone = false;
  });

  svgMap.addEventListener("click", function(e) {
    if (e.target.tagName === "rect" && currentTurnPhase >= 2) { // if user clicks on sea then clear selection colors
      restoreMapColorState(currentMapColorArray);
    }
    if (e.target.tagName === "path") {
      currentPath = e.target;
      document.getElementById("popup-confirm").style.opacity = 1;
      selectCountry(currentPath, false);
      if (countrySelectedAndGameStarted) {
        if (currentTurnPhase === 2) { //move/deploy phase show interactable countries when clicking a country
          validDestinationsAndClosestPointArray = findClosestPaths(e.target);
          if (!currentPath.hasAttribute("fill")) { 
            
          } else {
            hoverOverTerritory(currentPath, "clickCountry", currentlySelectedColorsArray);
            currentlySelectedColorsArray.length = 0;
            currentSelectedPath = currentPath;
            validDestinationsArray = validDestinationsAndClosestPointArray.map(dest => dest[0]);
            closestDistancesArray = validDestinationsAndClosestPointArray.map(dest => dest[2]);
            let centerOfTargetPath = findCentroidsFromArrayOfPaths(validDestinationsArray[0]);
            let closestPointOfDestPathArray = getClosestPointsDestinationPaths(centerOfTargetPath, validDestinationsAndClosestPointArray.map(dest => dest[1]));
            if (e.target.getAttribute("owner") === "Player") {
              validDestinationsArray = HighlightInteractableCountriesAfterSelectingOne(currentSelectedPath, centerOfTargetPath, closestPointOfDestPathArray, validDestinationsArray, closestDistancesArray);
            }
          }        
        } else if (currentTurnPhase === 3) {
          
        }
      } else { //if on country selection screen
        document.getElementById("popup-color").style.display = "block";
      }                                                                                                       
    }
  });

  svgMap.addEventListener("wheel", zoomMap);

  svgMap.addEventListener('mousedown', function(event) {
    if (event.button === 0 && zoomLevel > 1) {
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      event.preventDefault();
    }
  });
  
  svgMap.addEventListener('mousemove', function(event) {
    if (tooltip.innerHTML !== "") {
      tooltip.style.display = "block";
      tooltip.style.backgroundColor = "white";
    } else {
      tooltip.style.display = "none";
      tooltip.style.backgroundColor = "transparent";
    }

    panMap(event);
  });
  
  svgMap.addEventListener('mouseup', function(event) {
    if (event.button === 0) {
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
  
  console.log ("loaded!");
}

function postRequestForCountryData(country, countryPath) {
  let countryResourceData  = [];
  // Ensure hovering over a country before sending request
  if (tooltip.innerHTML === "") {
    return;
  }

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "http://localhost:8000/getCountryDataForBottomTable.php", true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.onreadystatechange = function () {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      // Parse the response JSON data
      const data = JSON.parse(xhr.responseText);
      let territoryArea = 0;
      let totalArea = 0;
      let totalArmy = 0;
      let startingArmy = 0;
      let territoryPop = 0;

      let totalGold = 0;
      let totalOil = 0;
      let totalFood = 0;
      let totalConsMats = 0;

      exportGold = 0;
      exportOil = 0;
      exportFood = 0;
      exportConsMats = 0;

      // Loop through arrayOfArmyAndResourceProportionsUI to find the data for the corresponding territories of the country
      for (let i = 0; i < arrayOfArmyAndResourceProportionsUI.length; i++) {
        if (arrayOfArmyAndResourceProportionsUI[i].dataName === countryPath.getAttribute("data-name")) {
          countryResourceData.push(arrayOfArmyAndResourceProportionsUI[i]);      
          totalGold += newArrayOfTerritorySpecificArmyAndResources[i].goldForCurrentTerritory;
          totalOil += newArrayOfTerritorySpecificArmyAndResources[i].oilForCurrentTerritory;
          totalFood += newArrayOfTerritorySpecificArmyAndResources[i].foodForCurrentTerritory;
          totalConsMats += newArrayOfTerritorySpecificArmyAndResources[i].consMatsForCurrentTerritory;    
        }
      }

      exportGold = totalGold;
      exportOil = totalOil;
      exportFood = totalFood;
      exportConsMats = totalConsMats;

      // Update the table with the response data
      document.getElementById("bottom-table").rows[0].cells[0].style.whiteSpace = "pre";

      setFlag(countryPath.getAttribute("data-name"),2); //set flag for territory clicked on (bottom table)

      document.getElementById("bottom-table").rows[0].cells[1].innerHTML = countryPath.getAttribute("territory-name") + " (" + data[0].continent + ")";

      for (let i = 0; i < countryResourceData.length; i++) {
        if (countryResourceData[i].uniqueId === countryPath.getAttribute("uniqueid")) {
          document.getElementById("bottom-table").rows[0].cells[3].innerHTML = Math.ceil(countryResourceData[i].goldForCurrentTerritory);
          document.getElementById("bottom-table").rows[0].cells[5].innerHTML = Math.ceil(countryResourceData[i].oilForCurrentTerritory);
          document.getElementById("bottom-table").rows[0].cells[7].innerHTML = Math.ceil(countryResourceData[i].foodForCurrentTerritory);
          document.getElementById("bottom-table").rows[0].cells[9].innerHTML = Math.ceil(countryResourceData[i].consMatsForCurrentTerritory);
        }
      }

      if (data[0].startingPop.length > 0) {
        const population = data[0].startingPop;
        for (let i = 0; i < newArrayOfTerritorySpecificArmyAndResources.length; i++) {
          if (newArrayOfTerritorySpecificArmyAndResources[i].dataName === countryPath.getAttribute("data-name")) {
            totalArea += newArrayOfTerritorySpecificArmyAndResources[i].area;
          }
        }
       
        for (let i = 0; i < newArrayOfTerritorySpecificArmyAndResources.length; i++) {
          if (newArrayOfTerritorySpecificArmyAndResources[i].uniqueId === countryPath.getAttribute("uniqueid")) {
            territoryPop = formatNumbersToKMB((population / totalArea) * newArrayOfTerritorySpecificArmyAndResources[i].area);
            document.getElementById("bottom-table").rows[0].cells[11].innerHTML = territoryPop;
            exportPop = formatNumbersToKMB(population);
            break;
          }
        }      
      }

      if (data[0].area.length > 0) {
        for (let i = 0; i < newArrayOfTerritorySpecificArmyAndResources.length; i++) {
          if (newArrayOfTerritorySpecificArmyAndResources[i].uniqueId === countryPath.getAttribute("uniqueid")) {
            exportArea = formatNumbersToKMB(totalArea);
            territoryArea = formatNumbersToKMB(newArrayOfTerritorySpecificArmyAndResources[i].area);
            document.getElementById("bottom-table").rows[0].cells[13].innerHTML = territoryArea + " (km²)";
            break;
          }
        }
      }

      const territoryId = currentPath.getAttribute("territory-id");
      for (let i = 0; i < arrayOfArmyAndResourceProportionsUI.length; i++) {
        if (arrayOfArmyAndResourceProportionsUI[i].territoryId === territoryId && arrayOfArmyAndResourceProportionsUI[i].dataName === data[0].country) {
          startingArmy = Math.ceil(arrayOfArmyAndResourceProportionsUI[i].armyForCurrentTerritory);
          startingArmy = formatNumbersToKMB(startingArmy);
          break;
        }
      }
      document.getElementById("bottom-table").rows[0].cells[15].innerHTML = startingArmy;
      
      for (let i = 0; i < newArrayOfTerritorySpecificArmyAndResources.length; i++) {
        if (newArrayOfTerritorySpecificArmyAndResources[i].dataName === countryPath.getAttribute("data-name")) {
          totalArmy += newArrayOfTerritorySpecificArmyAndResources[i].armyForCurrentTerritory;
        }
      }
      exportArmy = formatNumbersToKMB(totalArmy);
    }
  };
  xhr.send("country=" + country);
}


function formatNumbersToKMB(string) {
  if (string >= 1000000000) {
    return (string / 1000000000).toFixed(1) + 'B';
  } else if (string >= 1000000) {
    return (string / 1000000).toFixed(1) + 'M';
  } else if (string >= 1000) {
    return (string / 1000).toFixed(1) + 'k';
  } else {
    return string.toFixed(0);
  }
}

function selectCountry(country, escKeyEntry) {
  const svgMap = document.getElementById('svg-map').contentDocument;
  const paths = svgMap.getElementsByTagName("path");
  
  if (country.getAttribute("data-name") === "South Africa") { //Lesotho workaround
    for (let i = 0; i < paths.length; i++) {
      if (paths[i].getAttribute("data-name") === "Lesotho") {
        svgMap.documentElement.appendChild(paths[i]);
        for (let j = 0; j < paths.length; j++) {
          if (paths[j].getAttribute("data-name") === "South Africa") {
            lastClickedPath.parentNode.insertBefore(paths[j], lastClickedPath.parentNode.lastChild);
            break;
          }
        }
        break;
      }
    }
  } else {
    svgMap.documentElement.appendChild(country);
  }
  
  country.setAttribute('stroke-width', '3');
  
  if (selectCountryPlayerState && !escKeyEntry) {
    for (let i = 0; i < paths.length; i++) {
      if (paths[i].getAttribute("data-name") === country.getAttribute("data-name")) {
        if (playerColour == undefined) {
          paths[i].setAttribute('fill', 'rgb(254,254,254)');
          playerColour = "rgb(254,254,254)";
        } else {
          paths[i].setAttribute('fill', playerColour);
        }
      }
    }
  } else if (!selectCountryPlayerState && !escKeyEntry) {
    for (let i = 0; i < paths.length; i++) {
      if (paths[i].getAttribute("owner") === "Player") {
        paths[i].setAttribute('fill', playerColour);
      }
    }
  }
  
  if (lastClickedPath.hasAttribute("fill") && !escKeyEntry) {
    
    for (let i = 0; i < paths.length; i++) {
      if ((paths[i].getAttribute("data-name") === lastClickedPath.getAttribute("data-name")) && paths[i].getAttribute("owner") === "Player") {
        paths[i].setAttribute('fill', playerColour);
      } else if ((paths[i].getAttribute("data-name") === lastClickedPath.getAttribute("data-name")) && paths[i].getAttribute("owner") !== "Player") {
        if (mapMode === 0) {
          paths[i].setAttribute("fill", fillPathBasedOnContinent(paths[i]));   
        }
        if (mapMode === 1) {
          fillPathBasedOnTeam(paths[i]);
        }
      }
    }
  }
  
  console.log(country.getAttribute("uniqueid") + " lastclickedpath: " + lastClickedPath.getAttribute("uniqueid"));
  
  if (!clickActionsDone) {
    postRequestForCountryData(country.getAttribute("data-name"), country);
    
    if (lastClickedPath != null && !escKeyEntry) { // Check if a path was previously clicked
      if (lastClickedPath.getAttribute('d') != 'M0 0 L50 50') {
        if (lastClickedPath.getAttribute("data-name") === "Lesotho" || lastClickedPath.getAttribute("data-name") === "Monaco" || lastClickedPath.getAttribute("data-name") === "Liechtenstein" || lastClickedPath.getAttribute("data-name") === "San Marino") { //stop small countries disappearing
          lastClickedPath.parentNode.appendChild(lastClickedPath);
        } else {
          lastClickedPath.parentNode.insertBefore(lastClickedPath, lastClickedPath.parentNode.children[9]);
        }
        lastClickedPath.setAttribute('stroke-width', '1'); // Set the stroke-width attribute of the previous path to "1"
      }
    }
    
    lastClickedPath = country; // Update the previously clicked path
    
    if (selectCountryPlayerState && !escKeyEntry) {
      adjustTextToFit(document.getElementById('popup-body'), country.getAttribute("data-name"));
      document.getElementById('popup-confirm').classList.add("greenBackground");
      document.getElementById('popup-confirm').style.display = "block";
    }
    
    clickActionsDone = true;
  }
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
    resetGameState();
  });

  function resetGameState() {
    toggleTableContainer(true);
    document.getElementById("menu-container").style.display = "none";
    outsideOfMenuAndMapVisible = true;
    menuState = false;
    countrySelectedAndGameStarted = false;
    selectCountryPlayerState = true;
    popupWithConfirmContainer.style.display = "flex";
    popupCurrentlyOnScreen = true;
  }

  // add the menu options to the menu container
  menuContainer.appendChild(title);
  menuContainer.appendChild(subTitle);
  menuContainer.appendChild(newGameButton);
  menuContainer.appendChild(toggleMusicButton);
  menuContainer.appendChild(helpButton);

  // add the menu container to the HTML body
  document.getElementById("menu-container").appendChild(menuContainer);

  //Map Popup With Confirm Button
  // create the menu container
  const popupWithConfirmContainer = document.createElement("div");
  popupWithConfirmContainer.classList.add("popup-with-confirm-container");

  // create the menu options
  const popupTitle = document.createElement("td");
  popupTitle.innerText = "Select A Starting Country"; //set in required function
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

  const UIToggleButton = document.createElement("button");
  UIToggleButton.innerText = "Menu";
  UIToggleButton.classList.add("UI-option");
  UIToggleButton.setAttribute("id", "UIToggleButton");

  UIToggleButton.addEventListener("click", function() {
    toggleUIMenu();
  });

  document.getElementById("UIButtonContainer").appendChild(UIToggleButton);

  colorPicker.addEventListener("click", function() {
    document.getElementById("player-color-picker").style.display = "block";
  });

  document.getElementById("player-color-picker").addEventListener('change', function() {
    const svgMap = document.getElementById("svg-map").contentDocument;
    const paths = Array.from(svgMap.querySelectorAll('path'));
    playerColour = convertHexValuetoRGB(document.getElementById("player-color-picker").value);
    restoreMapColorState(currentMapColorArray);
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
      currentMapColorArray = saveMapColorState();
    }
  });
  

  // add event listener to popup confirm button
  popupConfirm.addEventListener("click", function() {
    if (selectCountryPlayerState) {
      selectCountryPlayerState = false;
      countrySelectedAndGameStarted = true;
      document.getElementById("popup-color").style.color = playerColour;
      playerCountry = document.getElementById("popup-body").innerHTML;
      setFlag(playerCountry,1); //set playerflag in top table
      UIButtonCurrentlyOnScreen = true;
      toggleUIButton(true);
      initialiseGame();
      document.getElementById("top-table-container").style.display = "block";
      popupTitle.innerText = "Buy / Upgrade Phase";
      popupSubTitle.innerText = "";
      popupConfirm.innerText = "DEPLOY";
      turnPhase++;
    } else if (countrySelectedAndGameStarted && turnPhase == 0) {
      popupTitle.innerText = "Buy / Upgrade Phase";
      popupSubTitle.innerText = "";
      popupConfirm.innerText = "DEPLOY";
      modifyCurrentTurnPhase(turnPhase);
      turnPhase++; 
    } else if (countrySelectedAndGameStarted && turnPhase == 1) {
      currentMapColorArray = saveMapColorState(); //grab state of map colors at start of turn.
      popupTitle.innerText = "Deploy Phase";
      popupConfirm.innerText = "MOVE / ATTACK";
      modifyCurrentTurnPhase(turnPhase);
      turnPhase++;
    } else if (countrySelectedAndGameStarted && turnPhase == 2) {
      currentMapColorArray = saveMapColorState(); //grab state of map colors at start of turn.
      popupTitle.innerText = "Move / Attack Phase";
      popupConfirm.innerText = "END TURN";
      modifyCurrentTurnPhase(turnPhase);
      turnPhase++;
    } else if (countrySelectedAndGameStarted && turnPhase == 3) {
      restoreMapColorState(currentMapColorArray); //Add to this feature once attack implemented and territories can change color
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
  pageLoaded = true;
});

function toggleTableContainer(turnOnTable) {
  var tableContainer = document.getElementById("bottom-table-container");
  if (turnOnTable) {
    tableContainer.style.display = "block";
  } else if (!turnOnTable) {
    tableContainer.style.display = "none";
  }
}

window.addEventListener("keydown", function(event) {
  const svg = document.getElementById('svg-map');
  if (event.code === "Escape" && outsideOfMenuAndMapVisible && !menuState) {
    document.getElementById("menu-container").style.display = "block";
    document.getElementById("popup-with-confirm-container").style.display = "none";
    document.getElementById("main-ui-container").style.display = "none";
    toggleTableContainer(false);
    menuState = true;
    toggleUIButton(false);
  } else if (event.code === "Escape" && outsideOfMenuAndMapVisible && menuState) {
    if (popupCurrentlyOnScreen) {
      document.getElementById("popup-with-confirm-container").style.display = "flex";
    }
    if (UIButtonCurrentlyOnScreen) {
      toggleUIButton(true);
    }
    
    if (UICurrentlyOnScreen) {
      document.getElementById("main-ui-container").style.display = "flex";
    }
    svg.focus();
    toggleTableContainer(true);
    document.getElementById("menu-container").style.display = "none";
    selectCountry(lastClickedPath, true);
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
  const lineHeight = fontSize * 1.2; // assuming a line height of 1.2em
  return lines.length * lineHeight;
}

function findClosestPaths(targetPath) {
  const svgMap = document.getElementById("svg-map").contentDocument;
  // console.log(targetPath.getAttribute("uniqueid"));

  if (!targetPath) {
    throw new Error(`Could not find path with ID ${targetPath} in SVG map.`);
  }

  const allPaths = svgMap.getElementsByTagName("path");
  const targetPoints = getPoints(targetPath);
  let resultsPaths = [];

  let closestPaths = Array.from(allPaths)
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
            ({ distance, path }) =>
                distance < 1 && path.getAttribute("isIsland") === "false"
        )
        .map(({ path, pointsDestPath, distance }) => [path, pointsDestPath, distance]);
    let closestPathsUpTo30 = closestPaths
        .filter(
            ({ distance, path }) =>
                distance <= 30 && distance >= 1 && path.getAttribute("isIsland") === "true"
        )
        .map(({ path, pointsDestPath, distance }) => [path, pointsDestPath, distance]);
    let sameCountryDiffTerritory = closestPaths
        .filter(
            ({ distance, path }) =>
                path.getAttribute("data-name") === targetPath.getAttribute("data-name")
        )
        .map(({ path, pointsDestPath, distance }) => [path, pointsDestPath, distance]);

    resultsPaths = resultsPaths.concat(closestPathsLessThan1, closestPathsUpTo30, sameCountryDiffTerritory);
  } else {
    resultsPaths = resultsPaths.concat(
        closestPaths
            .filter(({ distance }) => distance <= 30)
            .map(({ path, pointsDestPath, distance }) => [path, pointsDestPath, distance])
    );
  }

  // add paths with matching "data-name" attribute
  const matchingPaths = Array.from(allPaths).filter(
      (path) =>
          path.getAttribute("data-name") === targetPath.getAttribute("data-name") &&
          path.getAttribute("territory-id") !== targetPath.getAttribute("territory-id")
  );
  resultsPaths.push(...matchingPaths.map((path) => [path, getPoints(path), getMinimumDistance(path)]));

  // Remove duplicates while keeping the first occurrence of an element that has the attribute value of "uniqueid" equal to the first element of the array
  const uniqueIds = new Set();
  const uniqueResultsPaths = [[resultsPaths[0][0], resultsPaths[0][1], resultsPaths[0][2]]];
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
    points.push({ x: point.x, y: point.y });
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


function HighlightInteractableCountriesAfterSelectingOne(targetPath, centerCoordsTargetPath, destCoordsArray, destinationPathObjectArray, distances) {
  let manualExceptionsArray = [];
  const svgMap = document.getElementById("svg-map").contentDocument;
  const paths = Array.from(svgMap.querySelectorAll('path'));

  const defs = svgMap.querySelector('defs');
  const patterns = defs.querySelectorAll('pattern');

  for (let i = 0; i < patterns.length; i++) { //remove all patterns before creating new ones
    defs.removeChild(patterns[i]);
  }

  if (destCoordsArray.length < 1) {
    throw new Error("Array must contain at least 1 element");
  }

  let x1 = centerCoordsTargetPath[0][1];
  let y1 = centerCoordsTargetPath[0][2];
  let count = 0;

  manualExceptionsArray = findMatchingCountries(targetPath); //set up manual exceptions for this targetPath

  if (manualExceptionsArray.length > 0) { //works correctly
    for (let i = 0; i < manualExceptionsArray.length; i++) {
      changeCountryColor(manualExceptionsArray[i], true, "pattern", count);
      count++;
    }
  }

  for (let i = 0; i < destinationPathObjectArray.length; i++) {
    const targetName = targetPath.getAttribute("data-name");
    const destName = destinationPathObjectArray[i].getAttribute("data-name");

    const line = document.createElementNS(svgns, "path");
    line.setAttribute("d", `M${x1},${y1} L${destCoordsArray[i].x},${destCoordsArray[i].y}`);
    if (distances[i] < 1 && targetPath !== destinationPathObjectArray[i]) { //if touches borders then always draws a line
      changeCountryColor(destinationPathObjectArray[i], false, "pattern", count); //change color of touching countrys
      count++;
    } else if (targetName === destName && targetPath !== destinationPathObjectArray[i]) { //if another territory of same country, then change color
      changeCountryColor(destinationPathObjectArray[i], false, playerColour, count);
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
          changeCountryColor(destinationPathObjectArray[i], false, "pattern", count);
          count++;
        }

        if (targetPath.getAttribute("data-name") === destObjJ.getAttribute("data-name")) {
          break;
        }
      }
    }
  }
  validDestinationsArray.length = 0;

  for (let i = 0; i < paths.length; i++) {
    if (paths[i].getAttribute("fill").startsWith("url")) {
      validDestinationsArray.push(paths[i]);
    }
  }

  // for (let i = 0; i < validDestinationsArray.length; i++) {
  //   let styleAttr = validDestinationsArray[i].getAttribute("style");
  //   styleAttr = styleAttr.replace("stroke-width: 1", "stroke-width: 3");
  //   validDestinationsArray[i].setAttribute("style", styleAttr);
  // }

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

function changeCountryColor(pathObj, isManualException, newRgbValue, count) {
  const svgMap = document.getElementById("svg-map").contentDocument;
  let originalColor = pathObj.getAttribute("fill");
  let rgbValues = originalColor.match(/\d{1,3}/g);
  let newRgbValues;

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
      const defs = svgMap.querySelector('defs');
      defs.appendChild(pattern);

      // apply the pattern to the path element
      pathObj.setAttribute('fill', 'url(#' + pattern.getAttribute("id") + ')');
      console.log
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
}

function setFlag(country, topOrBottom) {
  let flagElement;
  let popupBodyElement = document.getElementById("popup-body");
  if (topOrBottom === 1) {
    flagElement = document.getElementById("flag-top");
  } else if (topOrBottom === 2) {
    flagElement = document.getElementById("flag-bottom");   
  }
  const img = document.createElement('img');
  img.classList.add("flag");
  flagElement.innerHTML = '';
  img.src = `./resources/flags/${country}.png`;
  flagElement.appendChild(img);
  if (selectCountryPlayerState) {
    popupBodyElement.style.background = `rgba(0, 0, 0, 0.5) url(${img.src}) no-repeat`;
    popupBodyElement.style.backgroundSize = "100% 100%";
    popupBodyElement.style.backgroundPosition = "center";
  }
}

function toggleUIButton(makeVisible) {
  if (makeVisible) {
    document.getElementById("UIButtonContainer").style.display = "block";
  } else {
    document.getElementById("UIButtonContainer").style.display = "none";
  }
}

function toggleUIMenu() {
  console.log(document.getElementById("main-ui-container").style.display);
  if (document.getElementById("main-ui-container").style.display) {
    if(document.getElementById("main-ui-container").style.display !== "none") {
      document.getElementById("main-ui-container").style.display = "none";
      UICurrentlyOnScreen = false;
    } else {
      document.getElementById("main-ui-container").style.display = "flex";
      UICurrentlyOnScreen = true;
    }
    
  } else {
    document.getElementById("main-ui-container").style.display = "flex";
    UICurrentlyOnScreen = true;
  }
}

  function colorMapAtBeginningOfGame() {
    const svgMap = document.getElementById('svg-map').contentDocument;
    const paths = Array.from(svgMap.querySelectorAll('path'));

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
      } else if (mouseAction === "mouseOut"  && r <= 254 && g <= 254 && b <= 254) { //this handles color change when leaving a hover (doesnt run on selected or interactable territories)
        hoveredNonInteractableAndNonSelectedTerritory = false;
        r -= 20;
        g -= 20;
        b -= 20;
        territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
      } else if (mouseAction === "clickCountry") { //this returns colors back to their original state after deselecting by selecting another, either white if interactable by both the previous and new selected areas, or back to owner color if not accessible by new selected area
        if (arrayOfSelectedCountries.length > 0) {
          for (let i = 0; i < arrayOfSelectedCountries.length; i++) {
            let rGBValuesToReplace = arrayOfSelectedCountries[i][1];
            arrayOfSelectedCountries[i][0].setAttribute("fill", rGBValuesToReplace);
          }
        } else {
          console.log("array empty");
        }
      }
    } else {
      console.log("Svg Hovered");
    }
  }

  function saveMapColorState() {
    const svgMap = document.getElementById('svg-map').contentDocument;
    const paths = Array.from(svgMap.querySelectorAll('path'));

    const fillArray = [];

    for (let i = 0; i < paths.length; i++) {
      const uniqueId = paths[i].getAttribute('uniqueid');
      const fillValue = paths[i].getAttribute('fill');
      if (uniqueId && fillValue) {
        fillArray.push([uniqueId, fillValue]);
      }
    }

    return fillArray;
}

function restoreMapColorState(array) {
  if (validDestinationsArray !== undefined) {
    validDestinationsArray.length = 0;
  }
  
  currentlySelectedColorsArray.length = 0;
  const svgMap = document.getElementById('svg-map').contentDocument;
  const paths = Array.from(svgMap.querySelectorAll('path'));

  paths.forEach(path => { //for each path, loop through the currentMapArray and find the match and set the color back
    for (let i = 0; i < array.length; i++) {
      if (array[i][0] == path.getAttribute("uniqueid")) {
        path.setAttribute("fill", array[i][1]);
      }
    }
  }); 
}

function fillPathBasedOnContinent(path) {
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
  const svgMap = document.getElementById('svg-map').contentDocument;
  const paths = Array.from(svgMap.querySelectorAll('path'));

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
  const svgMap = document.getElementById("svg-map").contentDocument;
  const paths = svgMap.getElementsByTagName("path");

  // Calculate the number of paths per group
  const numPaths = paths.length;
  const numGroups = colorArray.length;
  const pathsPerGroup = Math.floor(numPaths / numGroups);
  const remainder = numPaths % numGroups;

  // Assign a random number to each path element
  const assignedNumbers = Array.from({ length: numPaths }, (_, i) => i);
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
  const svg = document.getElementById("svg-map").contentDocument;
  const svgTag = svg.querySelector('svg');
  const delta = Math.sign(event.deltaY);
  
  if (delta < 0 && zoomLevel < maxZoomLevel) {
    zoomLevel++;
  } else if (delta > 0 && zoomLevel > 1) {
    zoomLevel--;
  }
  
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
  } else {
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

  console.log(`newWidth: ${newWidth}, newHeight: ${newHeight}, newLeft: ${newLeft}, newTop: ${newTop}, newViewBox: ${newViewBox}`);
  console.log(zoomLevel);
  // Set the new viewBox attribute on your SVG element
  svgTag.setAttribute("viewBox", newViewBox);
  
  // Set the initial viewBox when fully zoomed out
  if (zoomLevel === 1) {
    svgTag.setAttribute("viewBox", `${originalViewBoxX} ${originalViewBoxY} ${originalViewBoxWidth} ${originalViewBoxHeight}`);
  }
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function panMap(event) {
  const svgTag = document.getElementById("svg-map").contentDocument.querySelector('svg');

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