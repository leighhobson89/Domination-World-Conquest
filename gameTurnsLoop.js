import {
    playerCountry,
    uiAppearsAtStartOfTurn,
    toggleUIMenu,
    endPlayerTurn,
    initialiseNewPlayerTurn,
    toggleTransferAttackButton,
    reduceKeywords,
    setCurrentMapColorAndStrokeArray,
    getCurrentMapColorAndStrokeArray,
    saveMapColorState,
    restoreMapColorState,
    paths,
    fillPathBasedOnStartingCountryColor,
    currentMapColorAndStrokeArray,
    playerColour
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
    findSvgPath
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
    readClosestPointsJSON
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
    await (async () => { //finds attack options for a particular territory
        let path;
        for (let i = 0; i < mainGameArray.length; i++) {
            document.getElementById("move-phase-button").innerHTML = reduceKeywords(mainGameArray[i].territoryName).toUpperCase();
            highlightCountryBeingProcessedAndRemoveLastOneProcessed(mainGameArray[i].territoryName);
            let attackOptions = await findAttackOptions(i);
            attackOptionsArray.push(attackOptions);
        }
    })();
    console.log(attackOptionsArray);
    for (const path of paths) {
        if (path.getAttribute("data-name") === playerCountry) {
            path.setAttribute("fill", playerColour); //set player as the owner of the territory they select
        }
    }
    toggleTransferAttackButton(false, true);
    setCurrentMapColorAndStrokeArray(saveMapColorState("true"));
    document.getElementById("popup-color").disabled = true;
    gameInitialisation = false;
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

    let closestPathDataArray;
    let attackOptions;
    for (let i = 0; i < arrayOfLeadersAndCountries.length; i++) {

        // readLeaderResourcesAndTerritoriesDebugConsole(arrayOfLeadersAndCountries[i]);

        // TODO: Unblock territories that are no longer deactivated from previous wars
        // Implement once AI can conquer territories

        // Read resources and army per activated territory
        // Info already available in arrayOfLeadersAndCountries

        // Read total resources for specific AI's country and its per turn gains
        countryResourceTotals = getCountryResourceTotals()[arrayOfLeadersAndCountries[i][0]];
        const turnGainsArrayAi = currentTurn !== 1 ? getTurnGainsArrayAi()[arrayOfLeadersAndCountries[i][0]] : turnGainsArrayLastTurn;
        // console.log(countryResourceTotals);
        // console.log(turnGainsArrayAi);

        // TODO: Read in territories within range
        // This reads in the hardcoded distances of all paths on the map and can be used instead of calculating every time
            let territoriesInRange = [];
            for (let j = 0; j < arrayOfLeadersAndCountries[i][2].length; j++) {
                // console.log(arrayOfLeadersAndCountries[i][1].name + ": " + arrayOfLeadersAndCountries[i][2][j].territoryName);
                //territories in range.push() //read each territory we have by its unique id and get that data from the attackOptionsArray
                territoriesInRange.push(arrayOfLeadersAndCountries[i][2][j].territoryName + " is in range of: " + attackOptionsArray[arrayOfLeadersAndCountries[i][2][j].uniqueId]);
                console.log(territoriesInRange);
            }


        // TODO: Read in territories within range's army and forts
        // TODO: Assess threat from territories within range
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

        // After processing the closestPathDataArray for this territory, add your logic here.
    }
    console.log(attackOptionsArray);
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

function readLeaderResourcesAndTerritoriesDebugConsole(leaderAndCountry) {
    let currentAiTerritories = leaderAndCountry[2];
    console.log(leaderAndCountry[1].name + "'s territories are:");
    for (let j = 0; j < leaderAndCountry[2].length; j++) {
        console.log(leaderAndCountry[2][j].territoryName);
    }
}

async function findAttackOptions(i) {
    let closestPathDataArray;
    closestPathDataArray = await readClosestPointsJSON(i);
    return closestPathDataArray;
}

function filterAttackOptions(attackOptions) {
    const uniqueStringAMap = new Map();
    const filteredOptions = [];

    for (const option of attackOptions[1]) {
        const stringA = option[0];

        if (!uniqueStringAMap.has(stringA)) {
            uniqueStringAMap.set(stringA, true);
            filteredOptions.push(option);
        }
    }

    return [attackOptions[0], filteredOptions];
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