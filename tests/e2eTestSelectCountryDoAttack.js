const { runTest, switchContext, clickNewGame, clickCountryPath, clickPopupConfirm } = require('./e2etestFunctions.js');
const { Builder, By, Key, until } = require('selenium-webdriver');
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
    // Setup code before the tests start i.e. open the app and validate that the svg file is loaded
    driver = await new Builder().forBrowser('chrome').build();

    try {
      lookupTable = JSON.parse(fs.readFileSync('./tests/uniqueIdLookup.json'));
    } catch (error) {
      try {
        lookupTable = JSON.parse(fs.readFileSync('uniqueIdLookup.json'));
      } catch (error) {
        console.error('Failed to read the lookup table from both URLs.');
      }
    }

    //interpret launch.json territory name to be player
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

  it('should select a country for the player', async function () {
      let proceed = await switchContext(driver, 'default');
      if (proceed) {
        await clickNewGame(driver);
      }
      if (proceed) {
        await wait(500);
        proceed = await switchContext(driver, 'svg');
      }
      if (proceed) {
        proceed = await clickCountryPath(driver, pathArgument);
      }
      if (proceed) {
        await wait(500);
        proceed = await switchContext(driver, 'default');
      }
      if (proceed) {
        proceed = await clickPopupConfirm(driver, "Confirm");
      }
  });

  it('should do a basic attack', async function () {
    //load next test file
  });

  it('should do a basic siege', async function () {
    //load next test file
  });

  it('should do a basic assault after a siege', async function () {
    //load next test file
  });

  it('should do a siege after another siege', async function () {
    //load next test file
  });

  // Add more tests as needed
});

async function wait(time) {
  await new Promise(resolve => setTimeout(resolve, time));
}
