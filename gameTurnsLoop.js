import { playerCountry } from './ui.js';
import { newTurnResources } from './resourceCalculations.js';

export let currentTurn = 1;
export let currentTurnPhase = 0; //0 - Buy/Upgrade -- 1 - Deploy -- 2 - Move/Attack -- 3 -- AI
export function modifyCurrentTurnPhase( value ) { currentTurnPhase = value; }

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
    newTurnResources(playerCountry);
    console.log("Turn " + currentTurn + " has started!");
    // Handle player turn
    handleSpendUpgradePhase().then(() => {
      // Handle deploy phase
      handleDeployPhase().then(() => {
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
  

  function handleDeployPhase() {
    return new Promise(resolve => {
        console.log("Handling Deploy Phase");
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