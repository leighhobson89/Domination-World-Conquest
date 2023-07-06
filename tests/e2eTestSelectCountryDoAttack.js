const { runTest, switchContext, clickNewGame, clickPlayerCountryPath, clickPopupConfirm, findAvailableAttackPaths, selectRandomCountryToAttack, clickAttackTransferButton, validateAttackTransferWindowOpen, addMaxArmy, validateBattleUI, clickThroughAttack, clickButtonToEndBattle, validateResultsPage, clickButtonToCloseResultsPage, validateAttackedPathColor, validateAttackedPathOwner, getAllPathColors, getAllPathOwners } = require('./e2etestFunctions.js');
const { Builder } = require('selenium-webdriver');
const assert = require('assert');
const fs = require('fs');
const readline = require('readline');
let lookupTable;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

describe('Military Tests', function () {
  let driver;
  let pathArgument;

  before(async function () {
    // INITIALISE APP
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().window().maximize();

    try {
      lookupTable = JSON.parse(fs.readFileSync('./tests/uniqueIdLookup.json'));
    } catch (error) {
      try {
        lookupTable = JSON.parse(fs.readFileSync('uniqueIdLookup.json'));
      } catch (error) {
        console.error('Failed to read the lookup table from both URLs.');
      }
    }
    pathArgument = lookupTable[process.argv[3]];
  });

  beforeEach(async function () {
    await driver.get('http://localhost:3000');
    await runTest(driver);
    await wait(1000);
  });

  after(async function () {
    driver.close();
  });

  //----------------------------------------------TEST STEPS-----------------------------------------------//

  /* it('should select a country for the player', async function () {
    await selectAPlayerCountry(driver, pathArgument);
  }); */

  it('should do a basic attack', async function () {
    this.timeout(80000); //battle can take a while
    await selectAPlayerCountry(driver, pathArgument);
    let pathColors = await getAllPathColors(driver);
    let pathOwners = await getAllPathOwners(driver);
    let attackedPathUniqueIdColorAndName = await clickUIToSetUpAttack(driver, pathArgument);
    await validateAttackWindow(driver);
    let attackValues = await addMaxArmyAndClickInvade(driver);
    let battleOutcome = await doAttack(driver, attackValues);
    await validateResultsAndClickToEndBattle(driver, battleOutcome);
    await wait(500); //allow map to update
    await validateTerritoryIsInCorrectState(driver, battleOutcome, attackedPathUniqueIdColorAndName, pathColors, pathOwners);
  });

  /* it('should do a basic siege', async function () {
    //load next test file
  });

  it('should do a basic assault after a siege', async function () {
    //load next test file
  });

  it('should do a siege after another siege', async function () {
    //load next test file
  }); */

  // Add more tests as needed
});

async function wait(time) {
  await new Promise(resolve => setTimeout(resolve, time));
}

async function selectAPlayerCountry(driver, pathArgument) {
  await switchContext(driver, 'default');
  console.log("Selecting a Player Country");
  await clickNewGame(driver);
  await wait(500);
  await switchContext(driver, 'svg');
  await clickPlayerCountryPath(driver, pathArgument);
  await wait(500);
  await switchContext(driver, 'default');
  await clickPopupConfirm(driver, "Confirm");
}

async function clickUIToSetUpAttack(driver, pathArgument) {
  await switchContext(driver, 'default');

  let attackedPathUniqueIdColorAndName = [];
  let randomTerritoryToAttack;
  console.log("Setting Up A Basic Attack");

  await clickPopupConfirm(driver, "MILITARY");
  await switchContext(driver, 'svg');
  await clickPlayerCountryPath(driver, pathArgument);
  console.log("Finding enemy paths and selecting one...");
  await wait(500);

  let interactablePaths = await findAvailableAttackPaths(driver);
  randomTerritoryToAttack = await selectRandomCountryToAttack(interactablePaths);

  attackedPathUniqueIdColorAndName[0] = await randomTerritoryToAttack.getAttribute("uniqueid");
  attackedPathUniqueIdColorAndName[1] = await randomTerritoryToAttack.getAttribute("fill");
  attackedPathUniqueIdColorAndName[2] = await randomTerritoryToAttack.getAttribute("territory-name");

  if (interactablePaths.length === 0) {
    console.log("No territories to attack, something went wrong!");
  }
  console.log("Clicking enemy path...");
  await wait(500);

  await clickPlayerCountryPath(driver, attackedPathUniqueIdColorAndName[0]);
  await wait(500);
  console.log("Clicking 'Attack' button...");
  await switchContext(driver, 'default');
  await clickAttackTransferButton(driver);

  return attackedPathUniqueIdColorAndName;
}

async function validateAttackWindow(driver) {
  await switchContext(driver, 'default');
  let tableElements;
  await wait(500);
  console.log("Validating Attack Window Elements...");
  tableElements = await validateAttackTransferWindowOpen(driver);
  console.log("Passed Attack Window Validation Check");
  return tableElements;
}

async function addMaxArmyAndClickInvade(driver) {
  await switchContext(driver, 'default');
  console.log("Adding Max Army and entering Attack Interface...");
  let attackValues = await addMaxArmy(driver);
  console.log("Added Attack Army!");
  await clickAttackTransferButton(driver);
  await wait(1000);
  return attackValues;
}

async function doAttack(driver, attackValues) { //attackValues come from the attack window and are for a future validation of battle
  await switchContext(driver, 'default');
  console.log("Running Battle...");
  await validateBattleUI(driver);
  let battleOutcome = await clickThroughAttack(driver);
  return battleOutcome;
}

async function validateResultsAndClickToEndBattle(driver, battleOutcome) {
  await switchContext(driver, 'default');
  console.log("Validating Battle Results Page And Ending Battle...");
  await clickButtonToEndBattle(driver, battleOutcome);
  await validateResultsPage(driver, battleOutcome);
  await clickButtonToCloseResultsPage(driver);
}

async function validateTerritoryIsInCorrectState(driver, battleOutcome, attackedPathUniqueIdColorAndName, pathColors, pathOwners) {
  await switchContext(driver, 'default');
  await validateAttackedPathColor(driver, battleOutcome, attackedPathUniqueIdColorAndName, pathColors);
  await validateAttackedPathOwner(driver, battleOutcome, attackedPathUniqueIdColorAndName, pathOwners);
}