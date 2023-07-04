const { runTest, switchContext, clickNewGame, clickCountryPath, clickPopupConfirm } = require('./openAppAndSelectCountry.js');
const { Builder, By, Key, until } = require('selenium-webdriver');
const assert = require('assert');
const fs = require('fs');
const readline = require('readline');
let lookupTable;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

describe('App Tests', function () {
  let driver;
  let pathArgument;

  before(async function () {
    // Setup code before the tests start
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

    pathArgument = process.argv[3];
    if (pathArgument === "none") {
      let country = await getUserInput('Which Country / Territory are you selecting? ');
      pathArgument = lookupTable[country];
      rl.close();
    } else {
      pathArgument = lookupTable[pathArgument];
    }

    // Navigate to website
    await driver.get('http://localhost:3000');

    await runTest(driver);
  });

  after(async function () {
  });

  it('should select a country for the player', async function () {
      await new Promise(resolve => setTimeout(resolve, 1000)); //wait 2 seconds for page load
      let proceed = await switchContext(driver, 'default');
      if (proceed) {
        await clickNewGame(driver);
      }
      if (proceed) {
        await new Promise(resolve => setTimeout(resolve, 500)); //wait 2 seconds for page load
        proceed = await switchContext(driver, 'svg');
      }
      if (proceed) {
        proceed = await clickCountryPath(driver, pathArgument);
      }
      if (proceed) {
        await new Promise(resolve => setTimeout(resolve, 500)); //wait 2 seconds for page load
        proceed = await switchContext(driver, 'default');
      }
      if (proceed) {
        proceed = await clickPopupConfirm(driver, "Confirm");
      }
      if (proceed) {
        await driver.sleep(500);
        proceed = await clickPopupConfirm(driver, "MILITARY");
      }
  });

  it('should perform some validations', async function () {
    // Test code for validations
    // Perform necessary actions and assertions
  });

  // Add more tests as needed
});

// Utility function to read user input from the console
function getUserInput(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}
