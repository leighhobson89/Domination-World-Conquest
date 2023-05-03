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

let currentMapColorArray = []; //current state of map at start of new turn
const continentColorArray = [["Africa", [233, 234, 20]], 
                            ["Asia", [203, 58, 22]],
                            ["Europe", [186, 218, 85]],
                            ["North America", [83, 107, 205]],
                            ["South America", [193, 83, 205]],
                            ["Oceania", [74, 202, 233]]];

//path selection variables
let lastClickedPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
lastClickedPath.setAttribute("d", "M0 0 L50 50"); // used for player selection, and for stroke alteration
let currentPath; // used for hover, and tooltip before user clicks on a country
let currentSelectedPath;
let validDestinationsAndClosestPointArray; //populated with valid interaction territories when a particular territory is selected
let validDestinationsArray;
let closestDistancesArray;
let hoveredNonWhiteTerritory = false;

// Game States
let popupCurrentlyOnScreen = false; // used for handling popups on screen when game state changes
let UICurrentlyOnScreen = false;
let outsideOfMenuAndMapVisible = false;
let clickActionsDone = false;
let countrySelectedAndGameStarted = false;
let menuState = true;
let selectCountryPlayerState = false;

// const defaultViewBox = [312.805, -162.358, 1947.089, 1000.359]; // for zoom function

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

  // Add a mousemove event listener to the SVG element
  svgMap.addEventListener("mousemove", function(e) {
    // Check if the mouse is currently over a country with a tooltip
    if (tooltip.innerHTML !== "") {
      // Set the display property of the tooltip to "block" to show it
      tooltip.style.display = "block";
      // Set the background color of the tooltip to white
      tooltip.style.backgroundColor = "white";
    } else {
      // Set the display property of the tooltip to "none" to hide it
      tooltip.style.display = "none";
      // Set the background color of the tooltip to transparent
      tooltip.style.backgroundColor = "transparent";
    }
  });

  svgMap.addEventListener("click", function(e) {
    if (e.target.tagName === "path") {
      currentPath = e.target;
      document.getElementById("popup-confirm").style.opacity = 1;
      selectCountry(currentPath, false);
      if (countrySelectedAndGameStarted) {
        if (currentTurnPhase === 0) {
          
        } else if (currentTurnPhase === 2) { //move/deploy phase show interactable countries when clicking a country
        validDestinationsAndClosestPointArray = findClosestPaths(e.target);
        hoverOverTerritory(currentPath, "clickCountry", currentlySelectedColorsArray);
        currentlySelectedColorsArray.length = 0;
        currentSelectedPath = currentPath;
        validDestinationsArray = validDestinationsAndClosestPointArray.map(dest => dest[0]);
        closestDistancesArray = validDestinationsAndClosestPointArray.map(dest => dest[2]);
        let centerOfTargetPath = findCentroidsFromArrayOfPaths(validDestinationsArray[0]);
        let closestPointOfDestPathArray = getClosestPointsDestinationPaths(centerOfTargetPath, validDestinationsAndClosestPointArray.map(dest => dest[1]));
        validDestinationsArray = HighlightInteractableCountriesAfterSelectingOne(currentSelectedPath, centerOfTargetPath, closestPointOfDestPathArray, validDestinationsArray, closestDistancesArray);

        //all this is for the console log below it
        let logStr = "Selected country is: " + currentSelectedPath.getAttribute("data-name") + " [" + validDestinationsArray[0].getAttribute("territory-id") + "] and interactable countries are: ";
        for (let i = 0; i < validDestinationsArray.length; i++) {
          logStr += validDestinationsArray[i].getAttribute("data-name") + "[" + validDestinationsArray[i].getAttribute("territory-id") + "]";
          if (i < validDestinationsArray.length - 1) {
            logStr += ", ";
          }
        }                           
        console.log(logStr);
        } else if (currentTurnPhase === 3) {
          
        }
      }                                                                                                       
    }
  });

  svgMap.addEventListener("mousedown", function(e) {
    e.preventDefault();
  });

  svgMap.addEventListener("mouseup", function(e) {
    e.preventDefault();
  });

  svgMap.addEventListener("wheel", function(e) {
      // console.log('Current focus:', document.activeElement);
  }, { passive: false });

  colorMapAtBeginningOfGame();
  console.log ("loaded!");
}


// window.addEventListener('load', function() {
//   svgMapLoaded();
// });

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
  const svg = document.getElementById('svg-map');
    if (country.getAttribute("data-name") === "South Africa") { //Lesotho workaround
      const allPaths = svgMap.getElementsByTagName("path");
      for (let i = 0; i < allPaths.length; i++) {
        if (allPaths[i].getAttribute("data-name") === "Lesotho") {
          svgMap.documentElement.appendChild(allPaths[i]);
          for (let j = 0; j < allPaths.length; j++) {
            if (allPaths[j].getAttribute("data-name") === "South Africa") {
              lastClickedPath.parentNode.insertBefore(allPaths[j], lastClickedPath.parentNode.lastChild);
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
    toggleTableContainer(true);
    document.getElementById("menu-container").style.display = "none";
    outsideOfMenuAndMapVisible = true;
    menuState = false;
    selectCountryPlayerState = true;
    if (selectCountryPlayerState) {
      popupWithConfirmContainer.style.display = "flex";
      popupCurrentlyOnScreen = true;
    }
  });

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

  const popupSubTitle = document.createElement("td");
  popupSubTitle.innerText = "- - - -"; // set in required function
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
  

  // add event listener to popup confirm button
  popupConfirm.addEventListener("click", function() {
    if (selectCountryPlayerState) {
      selectCountryPlayerState = false;
      countrySelectedAndGameStarted = true;
      playerCountry = document.getElementById("popup-body").innerHTML;
      setFlag(playerCountry,1); //set playerflag in top table
      toggleUIButton(true);
      initialiseGame();
      document.getElementById("top-table-container").style.display = "block";
      popupTitle.innerText = "Buy / Upgrade Phase";
      popupSubTitle.innerText = "TO DO";
      popupConfirm.innerText = "DEPLOY";
      turnPhase++;
    } else if (countrySelectedAndGameStarted && turnPhase == 0) {
      popupTitle.innerText = "Buy / Upgrade Phase";
      popupSubTitle.innerText = "TO DO";
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
  } else if (event.code === "Escape" && outsideOfMenuAndMapVisible && menuState) {
    if (popupCurrentlyOnScreen) {
      document.getElementById("popup-with-confirm-container").style.display = "block";
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

  if (destCoordsArray.length < 1) {
    throw new Error("Array must contain at least 1 element");
  }

  let x1 = centerCoordsTargetPath[0][1];
  let y1 = centerCoordsTargetPath[0][2];

  manualExceptionsArray = findMatchingCountries(targetPath); //set up manual exceptions for this targetPath

  if (manualExceptionsArray.length > 0) {
    for (let i = 0; i < manualExceptionsArray.length; i++) {
      changeCountryColor(manualExceptionsArray[i], true, "255,255,255");
    }
  }

  for (let i = 0; i < destinationPathObjectArray.length; i++) {
    const targetName = targetPath.getAttribute("data-name");
    const destName = destinationPathObjectArray[i].getAttribute("data-name");

    if (destinationPathObjectArray[i] === targetPath) {
      changeCountryColor(targetPath, false, "255,255,255"); //change color of country clicked on
    }

    const line = document.createElementNS(svgns, "path");
    line.setAttribute("d", `M${x1},${y1} L${destCoordsArray[i].x},${destCoordsArray[i].y}`);
    if (distances[i] < 1 && targetPath !== destinationPathObjectArray[i]) { //if touches borders then always draws a line
      changeCountryColor(destinationPathObjectArray[i], false, "255,255,255"); //change color of touching countrys
    } else if (targetName === destName && targetPath !== destinationPathObjectArray[i]) { //if another territory of same country, then change color
      // console.log("target " + targetName + " and destination " + destName + " are same country, so definitely a line here!");
      changeCountryColor(destinationPathObjectArray[i], false, "255,255,255"); // change color of all territories of clicked country
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
          changeCountryColor(destinationPathObjectArray[i], false, "255,255,255");
        }

        if (targetPath.getAttribute("data-name") === destObjJ.getAttribute("data-name")) {
          break;
        }
      }
    }
  }
  validDestinationsArray.length = 0;

  for (let i = 0; i < paths.length; i++) {
    if (paths[i].getAttribute("fill") === "rgb(255, 255, 255)") {
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

function changeCountryColor(pathObj, isManualException, newRgbValue) {
  let originalColor = pathObj.getAttribute("fill");
  let rgbValues = originalColor.match(/\d{1,3}/g);
  let newRgbValues;

  if (pathObj === currentSelectedPath && hoveredNonWhiteTerritory) {
    let [r, g, b] = rgbValues;

    r -= 20;
    g -= 20;
    b -= 20;
    
    originalColor = "rgb(" + r + "," + g + "," + b + ")";

    hoveredNonWhiteTerritory = false;
  }

  newRgbValues = newRgbValue.split(",");
    
    rgbValues.forEach((value, index) => {
      rgbValues[index] = parseInt(newRgbValues[index].trim());
    });

    let newFillAttribute = "rgb(" + rgbValues.join(", ") + ")";
    pathObj.setAttribute("fill", newFillAttribute);

  // Push the original color to the array
    
  currentlySelectedColorsArray.push([pathObj, originalColor, isManualException]);

  // Remove any elements containing "255, 255, 255"
  let lastElem = currentlySelectedColorsArray[currentlySelectedColorsArray.length - 1][1];
  if (lastElem === "rgb(255, 255, 255)") {
    currentlySelectedColorsArray.pop();
  }
}

function setFlag(country, topOrBottom) {
  let flagElement;
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
}

function toggleUIButton(makeVisible = false) {
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
      if (mouseAction === "mouseOver" && r <= 254 && g <= 254 && b <= 254) {
        hoveredNonWhiteTerritory = true;
        r += 20;
        g += 20;
        b += 20;
        territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
        console.log("hoveredNonWhiteFlag = " + hoveredNonWhiteTerritory);
      } else if (mouseAction === "mouseOut"  && r <= 254 && g <= 254 && b <= 254) {
        hoveredNonWhiteTerritory = false;
        r -= 20;
        g -= 20;
        b -= 20;
        territory.setAttribute("fill", "rgb(" + r + "," + g + "," + b + ")");
        console.log("hoveredNonWhiteFlag = " + hoveredNonWhiteTerritory);
      } else if (mouseAction === "clickCountry") {
        if (arrayOfSelectedCountries.length > 0) {
          for (let i = 0; i < arrayOfSelectedCountries.length; i++) {
            let rGBValuesToReplace = arrayOfSelectedCountries[i][1];
            arrayOfSelectedCountries[i][0].setAttribute("fill", rGBValuesToReplace);
          }
        } else {
          console.log("array empty");
          console.log("hoveredNonWhiteFlag = " + hoveredNonWhiteTerritory);
        }
      }
    } else {
      console.log("Svg Hovered");
      console.log("hoveredNonWhiteFlag = " + hoveredNonWhiteTerritory);
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