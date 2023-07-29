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
    fillPathBasedOnStartingCountryColor,
    playerColour,
    svg,
    setZoomLevel,
    zoomMap
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
    calculateSiegePerTurn,
    handleEndSiegeDueArrest,
    getRetrievalArray
} from './battle.js';
import {
    getArrayOfLeadersAndCountries,
    updateArrayOfLeadersAndCountries
} from "./cpuPlayerGenerationAndLoading.js";
import {
    addManualExceptionsAndRemoveDenials,
    buildAttackableTerritoriesInRangeArray,
    buildFullTerritoriesInRangeArray,
    convertAttackableArrayStringsToMainArrayObjects,
    determineIfStillHasTurnInThisTurn,
    readClosestPointsJSON,
    retrieveArmyPowerOfTerritory
} from "./aiCalculations.js";

export let currentTurn = 1;
export let currentTurnPhase = 0; //0 - Buy/Upgrade -- 1 - Move/Attack -- 2 -- AI
export let randomEventHappening = false;
export let randomEvent = "";

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
        currentAiCountry = arrayOfLeadersAndCountries[i][0];
        console.log("Now it is " + currentAiCountry + "'s turn!");
        // TODO: Unblock territories that are no longer deactivated from previous wars
        // Implement once AI can conquer territories

        // Read resources and army per activated territory
        // Info already available in arrayOfLeadersAndCountries

        // Read total resources for specific AI's country and its per turn gains
        countryResourceTotals = getCountryResourceTotals()[arrayOfLeadersAndCountries[i][0]];
        turnGainsArrayAi = currentTurn !== 1 ? getTurnGainsArrayAi()[arrayOfLeadersAndCountries[i][0]] : turnGainsArrayLastTurn;

        // Read in territories within range
        let fullTerritoriesInRange = [];
        let attackableTerritoriesInRange = [];
        fullTerritoriesInRange = buildFullTerritoriesInRangeArray(arrayOfLeadersAndCountries, attackOptionsArray, i);
        attackableTerritoriesInRange = buildAttackableTerritoriesInRangeArray(arrayOfLeadersAndCountries, fullTerritoriesInRange, i);
        // Read in territories within range's army and forts
        attackableTerritoriesInRange = convertAttackableArrayStringsToMainArrayObjects(attackableTerritoriesInRange, paths, mainGameArray);
        // TODO: Assess threat from territories within range
        // add up army in opposing territory, compare to defending territory army taking account of defense bonuses and if current territory is landlocked
        let arrayOfTerritoriesInRangeThreats = [];
        let arrayOfAiPlayerDefenseScoresForTerritories = [];
        for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) { //add defense array with army power modified for defense bonus and indicate if coastal
            if (arrayOfLeadersAndCountries[i][2][j].dataName === currentAiCountry){
                arrayOfAiPlayerDefenseScoresForTerritories.push([arrayOfLeadersAndCountries[i][2][j].territoryName, retrieveArmyPowerOfTerritory(arrayOfLeadersAndCountries[i][2][j], true), arrayOfLeadersAndCountries[i][2][j].isCoastal]);
            }
        }
        console.log("defence territories army scores including defense bonuses, and if they are coastal:");
        console.log(arrayOfAiPlayerDefenseScoresForTerritories);
        //for each territory in attackableTerritoriesInRange
        for (const territory of attackableTerritoriesInRange) {
            let turnStillToCome = false;
            let armyPowerOfEnemyTerritory;
            let arrayOfTerritoryThreats = [];
            //work out if they will have a turn after this ai but before end of turn, ie if they have gone yet
            turnStillToCome = determineIfStillHasTurnInThisTurn(territory, arrayOfLeadersAndCountries, i);
            armyPowerOfEnemyTerritory = retrieveArmyPowerOfTerritory(territory, false);
            arrayOfTerritoryThreats.push(territory.territoryName, turnStillToCome, armyPowerOfEnemyTerritory);
            console.log("enemy territories army scores:");
            console.log(arrayOfTerritoryThreats);
        }
        // TODO: Check long term goal i.e. destroy x country, or have x territories or have an average defense level of x%, or gain continent x etc
        // TODO: Based on personality type, available resources, and threat, decide on goal for this turn to work towards longer-term goal
        // TODO: Based on threat and personality type, decide ratios for spending on defense (forts and army) and economy to achieve turn goal
        // TODO: Spend resources on upgrades and army for each territory owned
        // TODO: Calculate the probability of a successful battle from all owned territories against all territories that contribute to the turn goal
        // TODO: Based on personality, turn goal, new resources after update, and probability, decide if going to attack anyone
        // TODO: Calculate army needed for a successful attack
        // TODO: Check if one or combination of territories could meet that need
        // TODO: Based on personality and threats, decide how important it is to leave army to defend currently owned territory
        // TODO: Realise all attacks - move army out, run battle, and return result
        // TODO: If successful, deactivate army stationed in territory for x turns and block the upgrade of territory for the same
        // TODO: Based on threat, move available army around between available owned territories
        // TODO: Assess if turn goal was realised and update long-term goal if necessary
    }
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
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("territory-name") === territoryName) {
            paths[i].setAttribute("fill", fillPathBasedOnStartingCountryColor(paths[i]));
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