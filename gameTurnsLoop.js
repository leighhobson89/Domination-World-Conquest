import {
  playerCountry,
  uiAppearsAtStartOfTurn,
  toggleUIMenu,
} from './ui.js';
import {
  getPlayerTerritories,
  newTurnResources,
  drawUITable,
  calculateTerritoryStrengths,
  mainGameArray
} from './resourceCalculations.js';
import {
  activateAllTerritoriesForNewTurn,
  incrementSiegeTurns,
  calculateSiegePerTurn,
  handleEndSiegeDueArrest,
  getRetrievalArray
} from './battle.js';

export let currentTurn = 1;
export let currentTurnPhase = 0; //0 - Buy/Upgrade -- 1 - Deploy -- 2 - Move/Attack -- 3 -- AI
export let randomEventHappening = false;
export let randomEvent = "";

let probability = 0;

export function modifyCurrentTurnPhase(value) {
  currentTurnPhase = value;
}

export function initialiseGame() {
  console.log("Welcome to new game! Your country is " + playerCountry + "!");
  const svgMap = document.getElementById('svg-map').contentDocument;
  const paths = Array.from(svgMap.querySelectorAll('path'));

  for (const path of paths) {
      if (path.getAttribute("data-name") === playerCountry) {
          path.setAttribute("owner", "Player"); //set player as the owner of the territory they select
      }
  }

  for (const territory of mainGameArray) {
      if (territory.dataName === playerCountry) {
          territory.owner = "Player";
      }
  }
  gameLoop();
}

function gameLoop() {
  activateAllTerritoriesForNewTurn();
  let continueSiege = true;
  let continueSiegeArray = calculateSiegePerTurn(); //large function to work out siege effects per turn
  if (continueSiegeArray) {
    continueSiegeArray.forEach(element => {
      if (element !== true) {
        continueSiege = false;
        handleEndSiegeDueArrest(element);
      }
    });
  }
  incrementSiegeTurns();
  if (currentTurn > 1) {
      handleArmyRetrievals(getRetrievalArray());
  }
  getPlayerTerritories();
  console.log("Probability of Random Event: " + probability + "%");
  randomEventHappening = handleRandomEventLikelihood();
  if (randomEventHappening) {
      randomEvent = selectRandomEvent();
      console.log("There's been a " + randomEvent + "!")
  }
  newTurnResources();
  calculateTerritoryStrengths(mainGameArray); //might not be necessary every turn
  if (uiAppearsAtStartOfTurn && currentTurn !== 1 && continueSiege === true) {
      toggleUIMenu(true);
      drawUITable(document.getElementById("uiTable"), 0);
  }
  randomEventHappening = false;
  randomEvent = "";
  console.log("Turn " + currentTurn + " has started!");
  // Handle player turn
  handleSpendUpgradePhase().then(() => {
      // Handle move/attack phase
      handleMoveAttackPhase().then(() => {
          // Handle AI turn
          handleAITurn().then(() => {
              // Increment turn counter
              currentTurn++;
              // Repeat game loop
              gameLoop();
          });
      });
  });
}

function handleSpendUpgradePhase() {
  return new Promise(resolve => {
      console.log("Handling Spend Upgrade Phase");
      console.log("Current turn-phase is: " + currentTurnPhase);
      const popupConfirmButton = document.getElementById("popup-confirm");
      const onClickHandler = () => {
          popupConfirmButton.removeEventListener("click", onClickHandler);
          resolve();
      };
      popupConfirmButton.addEventListener("click", onClickHandler);
  });
}

function handleMoveAttackPhase() {
  return new Promise(resolve => {
      console.log("Handling Move Attack Phase");
      console.log("Current turn-phase is: " + currentTurnPhase);
      const popupConfirmButton = document.getElementById("popup-confirm");
      const onClickHandler = () => {
          popupConfirmButton.removeEventListener("click", onClickHandler);
          resolve();
      };
      popupConfirmButton.addEventListener("click", onClickHandler);
  });
}

function handleAITurn() {
  return new Promise(resolve => {
      console.log("Handling AI Turn");
      console.log("Current turn-phase is: " + currentTurnPhase);
      const popupConfirmButton = document.getElementById("popup-confirm");
      const onClickHandler = () => {
          popupConfirmButton.removeEventListener("click", onClickHandler);
          resolve();
      };
      popupConfirmButton.addEventListener("click", onClickHandler);
  });
}

function handleRandomEventLikelihood() {
  const decimalProbability = probability / 100;
  const randomNumberSum = Array.from({
      length: 5
  }, () => Math.random()).reduce((a, b) => a + b, 0);
  const averageRandomNumber = randomNumberSum / 5;
  if (averageRandomNumber <= decimalProbability) {
      probability = 0;
      return true;
  } else {
      probability = probability + 1;
      return false;
  }
}


function selectRandomEvent() {
  const events = [
      "Food Disaster",
      "Oil Well Fire",
      "Warehouse Fire",
      "Mutiny"
  ];
  const randomIndex = Math.floor(Math.random() * events.length);
  return events[randomIndex];
  /* return events[0]; */
}

function handleArmyRetrievals(retrievalArray) {
    for (let i = 0; i < retrievalArray.length; i++) {
        if (currentTurn === retrievalArray[i][2] + retrievalArray[i][3]) {
            const armySets = retrievalArray[i][1];
            for (let j = 0; j < armySets[0].length; j++) {
                const uniqueId = armySets[0][j][0].toString();
                for (let k = 0; k < mainGameArray.length; k++) {
                    if (mainGameArray[k].uniqueId === uniqueId) {
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

                        mainGameArray[k].infantryForCurrentTerritory += infantryQuantity;
                        mainGameArray[k].assaultForCurrentTerritory += assaultQuantity;
                        mainGameArray[k].airForCurrentTerritory += airQuantity;
                        mainGameArray[k].navalForCurrentTerritory += navalQuantity;
                    }
                }
            }
            retrievalArray.splice(i, 1); // Remove the element at index i from retrievalArray
            i--; // Decrement i to account for the removed element
        }
    }
}
