import { playerCountry } from './ui.js';

let currentTurn = 1;
export let currentTurnPhase = 0; //0 - Buy/Upgrade -- 1 - Deploy -- 2 - Move/Attack -- 3 -- AI
export function modifyCurrentTurnPhase( value ) { currentTurnPhase = value; }

export function initialiseGameLoop() {
    console.log("Welcome to new game! Your country is " + playerCountry + "!");

    gameLoop();
}

function gameLoop() {
    // Handle player turn
    handleSpendUpgradePhase().then(() => {
      // Handle deploy phase
      handleDeployPhase().then(() => {
        // Handle move/attack phase
        handleMoveAttackPhase().then(() => {
          // Increment turn counter
          currentTurn++;
          console.log("Turn " + currentTurn + " has started!");

          // Handle AI turn
          handleAITurn().then(() => {
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
  
      // Attach a click event listener to an element on the screen
      const popupConfirmButton = document.getElementById("popup-confirm");
      const onClickHandler = () => {
        // Remove the event listener
        popupConfirmButton.removeEventListener("click", onClickHandler);
  
        // Resolve the promise
        resolve();
      };
      popupConfirmButton.addEventListener("click", onClickHandler);
    });
  }
  

  function handleDeployPhase() {
    return new Promise(resolve => {
        console.log("Handling Deploy Phase");
        console.log("Current turnphase is: " + currentTurnPhase);
    
        // Attach a click event listener to an element on the screen
      const popupConfirmButton = document.getElementById("popup-confirm");
      const onClickHandler = () => {
        // Remove the event listener
        popupConfirmButton.removeEventListener("click", onClickHandler);
  
        // Resolve the promise
        resolve();
      };
      popupConfirmButton.addEventListener("click", onClickHandler);
    });
  }

  function handleMoveAttackPhase() {
    return new Promise(resolve => {
        console.log("Handling Move Attack Phase");
        console.log("Current turnphase is: " + currentTurnPhase);
    
        // Attach a click event listener to an element on the screen
      const popupConfirmButton = document.getElementById("popup-confirm");
      const onClickHandler = () => {
        // Remove the event listener
        popupConfirmButton.removeEventListener("click", onClickHandler);
  
        // Resolve the promise
        resolve();
      };
      popupConfirmButton.addEventListener("click", onClickHandler);
    });
  }

  function handleAITurn() {
    return new Promise(resolve => {
        console.log("Handling AI Turn");
        console.log("Current turnphase is: " + currentTurnPhase);
    
        // Attach a click event listener to an element on the screen
      const popupConfirmButton = document.getElementById("popup-confirm");
      const onClickHandler = () => {
        // Remove the event listener
        popupConfirmButton.removeEventListener("click", onClickHandler);
  
        // Resolve the promise
        resolve();
      };
      popupConfirmButton.addEventListener("click", onClickHandler);
    });
  }