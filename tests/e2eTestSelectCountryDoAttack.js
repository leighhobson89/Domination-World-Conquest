const { runTest, switchContext, clickNewGame, clickPlayerCountryPath, clickPopupConfirm, findAvailableAttackPaths, selectRandomCountryToAttack, clickAttackTransferButton, validateAttackTransferWindowOpen, addMaxArmy } = require('./e2etestFunctions.js');
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
    this.timeout(20000);
    await selectAPlayerCountry(driver, pathArgument);
    await clickUIToSetUpAttack(driver, pathArgument);
    await validateAttackWindow(driver);
    await addMaxArmyAndClickInvade(driver);
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
  let randomTerritoryToAttack;
  console.log("Setting Up A Basic Attack");
  await clickPopupConfirm(driver, "MILITARY");
  await switchContext(driver, 'svg');
  await clickPlayerCountryPath(driver, pathArgument);
  console.log("Finding enemy paths and selecting one...");
  await wait(500);
  let interactablePaths = await findAvailableAttackPaths(driver);
  randomTerritoryToAttack = await selectRandomCountryToAttack(interactablePaths);
  if (interactablePaths.length === 0) {
    console.log("No territories to attack, something went wrong!");
  }
  console.log("Clicking enemy path...");
  await wait(500);
  await clickPlayerCountryPath(driver, await randomTerritoryToAttack.getAttribute("uniqueid"));
  await wait(500);
  console.log("Clicking 'Attack' button...");
  await switchContext(driver, 'default');
  await clickAttackTransferButton(driver);
}

async function validateAttackWindow(driver) {
  let tableElements;
  await wait(500);
  console.log("Validating Attack Window Elements...");
  tableElements = await validateAttackTransferWindowOpen(driver);
  console.log("Passed Attack Window Validation Check");
  return tableElements;
}

async function addMaxArmyAndClickInvade(driver) {
  console.log("Adding Max Army and entering Attack Interface...");
  let attackAmounts = await addMaxArmy(driver);
  console.log("Added Attack Army! (" + attackAmounts[0] + " " + attackAmounts[1] + " " + attackAmounts[2] + " " + attackAmounts[3]);
}