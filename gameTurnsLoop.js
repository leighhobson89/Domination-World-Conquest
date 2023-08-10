import {
    playerCountry,
    uiAppearsAtStartOfTurn,
    toggleUIMenu,
    endPlayerTurn,
    initialiseNewPlayerTurn,
    toggleTransferAttackButton,
    reduceKeywords,
    setCurrentMapColorAndStrokeArray,
    saveMapColorState,
    paths,
    playerColour,
    svg,
    setZoomLevel,
    zoomMap, setColorOnMap
} from './ui.js';
import {
    getPlayerTerritories,
    newTurnResources,
    drawUITable,
    calculateTerritoryStrengths,
    mainGameArray,
    getCountryResourceTotals,
    turnGainsArrayLastTurn,
    getTurnGainsArrayAi
} from './resourceCalculations.js';
import {
    activateAllPlayerTerritoriesForNewTurn,
    incrementSiegeTurns,
    calculatePlayerInitiatedSiegePerTurn,
    handleEndSiegeDueArrest,
    getRetrievalArray, activateAiTerritoriesForNewTurn, calculateAiInitiatedSiegePerTurn
} from './battle.js';
import {
    getArrayOfLeadersAndCountries,
    updateArrayOfLeadersAndCountries
} from "./cpuPlayerGenerationAndLoading.js";
import {
    addManualExceptionsAndRemoveDenials,
    buildAttackableTerritoriesInRangeArray,
    buildFullTerritoriesInRangeArray,
    calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory,
    calculateTurnGoals,
    convertAttackableArrayStringsToMainArrayObjects,
    doAiActions,
    getArrayOfGoldToSpendOnBolster,
    getArrayOfGoldToSpendOnEconomy,
    getFriendlyTerritoriesDefenseScores,
    prioritiseTurnGoalsBasedOnPersonality,
    readClosestPointsJSON,
    refineTurnGoals, setDebugArraysToZero,
} from "./aiCalculations.js";

export let currentTurn = 1;
export let currentTurnPhase = 0; //0 - Buy/Upgrade -- 1 - Move/Attack -- 2 -- AI
export let randomEventHappening = false;
export let randomEvent = "";

export let summaryWarsArray = [];
export let summaryWarsLostArray = [];

let probability = 0;
let attackOptionsArray = [];
let arrayOfLeadersAndCountries = [];
let gameInitialisation;

export async function initialiseGame() {
    setZoomLevel(1);
    zoomMap("init");
    svg.style.pointerEvents = 'none';
    gameInitialisation = true;
    console.log("Welcome to new game! Your country is " + playerCountry + "!");
    const svgMap = document.getElementById('svg-map').contentDocument;
    const paths = Array.from(svgMap.querySelectorAll('path'));

    for (const path of paths) {
        if (path.getAttribute("data-name") === playerCountry) {
            path.setAttribute("owner", "Player");
        }
    }

    for (const territory of mainGameArray) {
        if (territory.dataName === playerCountry) {
            territory.owner = "Player";
        }
    }
    arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    setCurrentMapColorAndStrokeArray(saveMapColorState(false));
    document.getElementById("top-table-container").style.display = "block";
    toggleTransferAttackButton(true, true);
    changeAllPathsToWhite();
    await (async () => { //finds attack options for a particular territory and causes the loading to happen
        for (let i = 0; i < mainGameArray.length; i++) {
            document.getElementById("move-phase-button").innerHTML = reduceKeywords(mainGameArray[i].territoryName).toUpperCase();
            highlightCountryBeingProcessedAndRemoveLastOneProcessed(mainGameArray[i].territoryName);
            let allInteractableTerritoriesForUniqueId = await findAllInteractableTerritoriesOnGameLoad(i);
            allInteractableTerritoriesForUniqueId = addManualExceptionsAndRemoveDenials(allInteractableTerritoriesForUniqueId);
            allInteractableTerritoriesForUniqueId[1].shift(); //remove first element as will always be territory with uniqueid of attackOptionsArray element index, don't need it
            attackOptionsArray.push(allInteractableTerritoriesForUniqueId);
        }
    })();
    for (const path of paths) {
        if (path.getAttribute("data-name") === playerCountry) {
            path.setAttribute("fill", playerColour); //set player as the owner of the territory they select
        }
    }
    toggleTransferAttackButton(false, true);
    setCurrentMapColorAndStrokeArray(saveMapColorState("true"));
    document.getElementById("popup-color").disabled = true;
    gameInitialisation = false;
    svg.style.pointerEvents = 'auto';
    gameLoop();
}

function gameLoop() {
    activateAllPlayerTerritoriesForNewTurn();
    activateAiTerritoriesForNewTurn();
    let continueSiege = true;
    let continueSiegeArrayPlayer = calculatePlayerInitiatedSiegePerTurn(); //large function to work out siege effects per turn
    if (continueSiegeArrayPlayer) {
        continueSiegeArrayPlayer.forEach(element => {
            if (element !== true) {
                continueSiege = false;
                handleEndSiegeDueArrest(false, element);
            }
        });
    }
    let continueSiegeArrayAi = calculateAiInitiatedSiegePerTurn();
    if (continueSiegeArrayAi) {
        continueSiegeArrayAi.forEach(element => {
            if (element !== true) {
                continueSiege = false;
                handleEndSiegeDueArrest(true, element);
                console.log("Ai Siege Of " + element.defendingTerritory.territoryName + " finished due to arrest of " + element.attackingTerritory.dataName + "'s attacking troops!");
            }
        });
    }
    incrementSiegeTurns(true);
    incrementSiegeTurns(false);
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
    calculateTerritoryStrengths(mainGameArray); //might not be necessary every turn // related with greying out
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

async function handleAITurn() {
    console.log("Handling AI Turn...");
    document.getElementById("popup-confirm").disabled = true; // Stop the user from clicking the button during the AI turn
    endPlayerTurn();
    updateArrayOfLeadersAndCountries();
    arrayOfLeadersAndCountries = getArrayOfLeadersAndCountries();
    let countryResourceTotals;
    let turnGainsArrayAi;
    let currentAiCountry;

    for (let i = 0; i < arrayOfLeadersAndCountries.length; i++) {
        let fullTerritoriesInRange = [];
        let attackableTerritoriesInRange = [];
        let arrayOfTerritoriesInRangeThreats = []; //[territoryName, [friendlyTerritory1, threatScore]]
        let arrayOfAiPlayerDefenseScoresForTerritories = [];
        let unrefinedTurnGoals = [];
        let refinedTurnGoals = [];

        const leader = arrayOfLeadersAndCountries[i][2][0].leader;
        const leaderTraits = arrayOfLeadersAndCountries[i][2][0].leader.traits;

        currentAiCountry = arrayOfLeadersAndCountries[i][0];
        console.log("Now it is " + currentAiCountry + "'s turn!");

        // TODO: Unblock territories that are no longer deactivated from previous wars
        // Implement once AI can conquer territories

        countryResourceTotals = getCountryResourceTotals()[arrayOfLeadersAndCountries[i][0]];
        turnGainsArrayAi = currentTurn !== 1 ? getTurnGainsArrayAi()[arrayOfLeadersAndCountries[i][0]] : turnGainsArrayLastTurn;
        fullTerritoriesInRange = buildFullTerritoriesInRangeArray(arrayOfLeadersAndCountries, attackOptionsArray, i);
        attackableTerritoriesInRange = buildAttackableTerritoriesInRangeArray(arrayOfLeadersAndCountries, fullTerritoriesInRange, i);
        attackableTerritoriesInRange = convertAttackableArrayStringsToMainArrayObjects(attackableTerritoriesInRange, paths, mainGameArray);
        arrayOfAiPlayerDefenseScoresForTerritories = getFriendlyTerritoriesDefenseScores(arrayOfLeadersAndCountries, currentAiCountry, i);
        arrayOfTerritoriesInRangeThreats = calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory(attackableTerritoriesInRange, arrayOfLeadersAndCountries, fullTerritoriesInRange, arrayOfAiPlayerDefenseScoresForTerritories, i);
        // TODO: Check long term goal i.e. destroy x country, or have x territories or have an average defense level of x%, or gain continent x etc
        // implement when long term goal is decided
        unrefinedTurnGoals.push(calculateTurnGoals(arrayOfTerritoriesInRangeThreats));
        refinedTurnGoals = refineTurnGoals(unrefinedTurnGoals, currentAiCountry, leaderTraits);
        refinedTurnGoals= prioritiseTurnGoalsBasedOnPersonality(refinedTurnGoals, currentAiCountry, leaderTraits);
        refinedTurnGoals = await doAiActions(refinedTurnGoals, leader, turnGainsArrayAi, arrayOfTerritoriesInRangeThreats, arrayOfAiPlayerDefenseScoresForTerritories); //refinedTurnGoals gets returned because can be updated in this function if a bolster job gets deleted after recalculations
        // TODO: If successful, deactivate army stationed in territory for x turns and block the upgrade of territory for the same
        // TODO: Based on threat, move available army around between available owned territories
        // TODO: Assess if turn goal was realised and update long-term goal if necessary
    }
    //DEBUG
    logGoldStats(getArrayOfGoldToSpendOnEconomy(), "Economy");
    logGoldStats(getArrayOfGoldToSpendOnBolster(), "Bolster");
    setDebugArraysToZero();
    //
    for (let i = 0; i < summaryWarsArray.length; i++) {
        console.log(`%c${summaryWarsArray[i]}`, "color: rgb(0,255,0);");
        if (i < summaryWarsArray.length - 1) {
            console.log("%c------------------", "color: rgb(0,255,0);"); // Line separator
        }
    }
    for (let i = 0; i < summaryWarsLostArray.length; i++) {
        console.log(`%c${summaryWarsLostArray[i]}`, "color: red;");
        if (i < summaryWarsLostArray.length - 1) {
            console.log("%c------------------", "color: red;"); // Line separator
        }
    }
    summaryWarsArray.length = 0;
    summaryWarsLostArray.length = 0;
    console.log("AI DONE!"); // Placeholder message for AI turn completed
    initialiseNewPlayerTurn();

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

async function findAllInteractableTerritoriesOnGameLoad(i) {
    let closestPathDataArray;
    closestPathDataArray = await readClosestPointsJSON(i);
    return closestPathDataArray;
}

function changeAllPathsToWhite() {
    for (let i = 0; i < paths.length; i++) {
        paths[i].setAttribute("fill", "rgb(255, 255, 255)");
    }
}

function highlightCountryBeingProcessedAndRemoveLastOneProcessed(territoryName) {
    for (let i = 0; i < mainGameArray.length; i++) {
        if (mainGameArray[i].territoryName === territoryName) {
            setColorOnMap(mainGameArray[i]);
            break;
        }
    }
}

export function modifyCurrentTurnPhase(value) {
    currentTurnPhase = value;
}

export function getGameInitialisation() {
    return gameInitialisation;
}

//DEBUG
function logGoldStats(arr, name) {
    // Sort the array in ascending order to find the five smallest values
    const sortedAscending = arr.slice().sort((a, b) => a - b);
    const smallest = sortedAscending.slice(0, 10); //change last number for more/less output

    // Sort the array in descending order to find the five largest values
    const sortedDescending = arr.slice().sort((a, b) => b - a);
    const largest = sortedDescending.slice(0, 10); //change last number for more/less output

    // Calculate the average of all values in the array
    const sum = arr.reduce((total, value) => total + value, 0);
    const average = sum / arr.length;

    // Calculate the median
    const middleIndex = Math.floor(arr.length / 2);
    const median = arr.length % 2 === 0 ? (arr[middleIndex - 1] + arr[middleIndex]) / 2 : arr[middleIndex];

    // Calculate the mode
    const frequencyMap = {};
    arr.forEach((value) => {
        frequencyMap[value] = (frequencyMap[value] || 0) + 1;
    });
    let mode;
    let maxFrequency = 0;
    for (const key in frequencyMap) {
        if (frequencyMap[key] > maxFrequency) {
            mode = key;
            maxFrequency = frequencyMap[key];
        }
    }

    // Log the information
    console.log(
        name +
        "ECONOMY GOLD: Min 10 values: " + smallest.join(", ") +
        " Max 10 values: " + largest.join(", ") +
        " AVERAGE: " + average +
        " MEDIAN: " + median +
        " MODE: " + mode
    );
}
//