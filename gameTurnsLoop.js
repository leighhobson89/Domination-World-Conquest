import { playerCountry, uiAppearsAtStartOfTurn, toggleUIMenu } from './ui.js';
import { getPlayerTerritories, newTurnResources, drawUITable } from './resourceCalculations.js';

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
    gameLoop();
}

function gameLoop() {
    getPlayerTerritories();
    console.log("Probability of Random Event: " + probability + "%");
    randomEventHappening = handleRandomEventLikelihood();
    if (randomEventHappening) {
      randomEvent = selectRandomEvent();
      console.log("There's been a " + randomEvent + "!")
    }
    newTurnResources();
    if (uiAppearsAtStartOfTurn && currentTurn !== 1) {
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
      console.log("Current turnphase is: " + currentTurnPhase);
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
          console.log("Current turnphase is: " + currentTurnPhase);
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
          console.log("Current turnphase is: " + currentTurnPhase);
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
    const randomNumberSum = Array.from({ length: 5 }, () => Math.random()).reduce((a, b) => a + b, 0);
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
      "Option 4",
      "Option 5",
      "Option 6",
      "Option 7",
      "Option 8",
      "Option 9",
      "Option 10"
    ];
    const randomIndex = Math.floor(Math.random() * events.length);
    /* return events[randomIndex]; */
    return events[0];
}