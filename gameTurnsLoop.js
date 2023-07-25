import {
    playerCountry,
    uiAppearsAtStartOfTurn,
    toggleUIMenu,
    endPlayerTurn, initialiseNewPlayerTurn
} from './ui.js';
import {
    getPlayerTerritories,
    newTurnResources,
    drawUITable,
    calculateTerritoryStrengths,
    mainGameArray,
    getCountryResourceTotals,
    turnGainsArrayLastTurn,
    getTurnGainsArrayAi,
} from './resourceCalculations.js';
import {
  activateAllPlayerTerritoriesForNewTurn,
  incrementSiegeTurns,
  calculateSiegePerTurn,
  handleEndSiegeDueArrest,
  getRetrievalArray
} from './battle.js';
import { getArrayOfLeadersAndCountries } from "./cpuPlayerGenerationAndLoading.js";

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
  activateAllPlayerTerritoriesForNewTurn();
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
  handleBuyUpgradePhase().then(() => {
      // Handle move/attack phase
      handleMilitaryPhase().then(() => {
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

function handleBuyUpgradePhase() {
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

function handleMilitaryPhase() {
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
        console.log("Handling AI Turn, with simulated 2 second delay...");
        document.getElementById("popup-confirm").disabled = true; //stop user clicking button during ai turn
        endPlayerTurn();

        setTimeout(() => {
            let arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
            let countryResourceTotals;
            let turnGainsArrayAi;
            for (let i = 0; i < arrayOfLeadersAndCountries.length; i++) { //main ai loop
                //read in current leaders territories and resource information from the mainUI
                readLeaderResourcesAndTerritoriesDebugConsole(arrayOfLeadersAndCountries);

                // TODO unblock territories that are no longer deactivated from previous wars
                // implement once ai can conquer territories

                // TODO read in resources and army per activated territory
                // info already available in arrayOfLeadersAndCountries

                // read in total resources for specific ai's country and it's per turn gains
                countryResourceTotals = getCountryResourceTotals()[arrayOfLeadersAndCountries[i][0]];
                const turnGainsArrayAi = currentTurn !== 1 ? getTurnGainsArrayAi()[arrayOfLeadersAndCountries[i][0]] : turnGainsArrayLastTurn;

                console.log(countryResourceTotals);
                console.log(turnGainsArrayAi);

                // TODO read in territories within range
                // TODO read in territories within ranges army and forts
                // TODO assess threat from territories within range
                // TODO check long term goal i.e. destroy x country, or have x territories or have an average defense level of x%, or gain continent x etc
                // TODO based on personality type, available resources, and threat, decide on goal for this turn to work towards longer term goal
                // TODO based on threat and personality type, decide ratios for spending on defense (forts and army) and economy to achieve turn goal
                // TODO spend resources on upgrades, and army for each territory owned
                // TODO calculate probability of a successful battle from all owned territories against all territories that contribute to the turn goal
                // TODO based on personality, turn goal and new resources after update, and probability, decide if going to attack anyone
                // TODO calculate army needed for a successful attack
                // TODO check if one or combination of territories could meet that need
                // TODO based on personality and threats, decide how important it is to leave army to defend currently owned territory
                // TODO realise all attacks - move army out, run battle, and return result
                // TODO if successful deactivate army stationed in territory for x turns, and block upgrade of territory for same
                // TODO based on threat, move available army around between available owned territories
                // TODO assess if turn goal was realised and update long term goal if necessary
            }
            console.log("AI DONE!"); // Placeholder message for AI turn completed
            initialiseNewPlayerTurn();
            resolve(); // Resolve the Promise to indicate AI turn handling completion
        }, 2000);

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

function readLeaderResourcesAndTerritoriesDebugConsole(arrayOfLeadersAndCountries) {
    // let currentAiTerritories = arrayOfLeadersAndCountries[i][2];
    // console.log(arrayOfLeadersAndCountries[i][1].name + "'s territories are:");
    // for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) {
    //     console.log(arrayOfLeadersAndCountries[i][2][j].territoryName);
    // }
}
