const readline = require('readline');
const fs = require('fs');

try { //handles manual and F5 launches
  lookupTable = JSON.parse(fs.readFileSync('./tests/uniqueIdLookup.json'));
} catch (error) {
  try {
    lookupTable = JSON.parse(fs.readFileSync('uniqueIdLookup.json'));
  } catch (error) {
    console.error('Failed to read the lookup table from both URLs.');
    // Handle the error or perform any necessary actions
  }
}


// Load the unique ID lookup table from the JSON file
const { Builder, By, Key, until } = require('selenium-webdriver');

// Create a readline interface to read user input from the console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function run(path) {
  const driver = await new Builder().forBrowser('chrome').build();
  try {
    // Navigate to a website
    await driver.get('http://localhost:3000');
    let retries = 0;
    let foundSVG = false;

    // Find SVG file to start the game
    while (retries < 10 && !foundSVG) {
      try {
        let svgMap = await driver.findElement(By.id('svg-map'));
        foundSVG = true;

        console.log('Element found: ', svgMap);
        console.log('Sleeping 2000ms to allow async process...');
        await driver.sleep(2000);
      } catch (error) {
        console.log('SVG not found. Retrying...');

        await driver.sleep(2000);
        await driver.navigate().refresh();

        retries++;
      }
    }

    if (foundSVG) {
      let proceed = await switchContext(driver, 'default');
      if (proceed) {
        await clickNewGame(driver);
      }
      if (proceed) {
        await driver.sleep(500);
        proceed = await switchContext(driver, 'svg');
      }
      if (proceed) {
        if (path === "none") { // manual selection of country mode
          path = null;
          let country;
          while (path === null) {
            country = await getUserInput('Which Country / Territory are you selecting? ');
            path = lookupTable[country];
            if (!path) {
              console.log('Invalid country or territory entered.');
            }
          }
          rl.close();
        } else {
          path = lookupTable[path];
        }
        proceed = await clickCountryPath(driver, path);
      }
      if (proceed) {
        await driver.sleep(500);
        proceed = await switchContext(driver, 'default');
      }
      if (proceed) {
        proceed = await clickPopupConfirm(driver, "Confirm");
      }
      if (proceed) {
        await driver.sleep(500);
        proceed = await clickPopupConfirm(driver, "MILITARY");
      }
    } else {
      console.log('SVG not found after maximum retries, quitting.');
    }
  } finally {
    // Quit the WebDriver session
    await driver.quit();
    console.log('Got to the end.');
  }
}

async function switchContext(driver, context) {
  switch (context) {
    case 'svg':
      await driver.switchTo().frame(driver.findElement(By.id('svg-map')));
      console.log('Switched context to ' + context);
      return true;
    case 'default':
      await driver.switchTo().defaultContent();
      console.log('Switched context to ' + context);
      return true;
    default:
      console.log("Couldn't find context, quitting");
      return false;
  }
}

async function clickNewGame(driver) {
  // Click on the element with id="new-game-btn"
  let newGameButton = await driver.findElement(By.id('new-game-btn'));
  if (newGameButton) {
    await newGameButton.click();
    console.log('Clicked on "new-game-btn" element.');
    return true;
  } else {
    console.log('Could not find "new-game-btn" element.');
    return false;
  }
}

async function clickCountryPath(driver, path) {
  // Find the path element with attribute "uniqueid" equal to "path"
  let pathElement = await driver.findElement(By.css('path[uniqueid="' + path + '"]'));
  if (pathElement) {
    await pathElement.click();
    console.log('Clicked on path element with uniqueid="' + path + '".');
    return true;
  } else {
    console.log('Could not find path element ' + path);
    return false;
  }
}

async function clickPopupConfirm(driver, situation) {
  // Find the element with id="popup-confirm"
  let popupConfirmElement = await driver.findElement(By.id('popup-confirm'));
  let innerHTML = await popupConfirmElement.getAttribute('innerHTML');
  if (innerHTML) {
    if (innerHTML === situation) {
      await popupConfirmElement.click();
      console.log('Clicked on "popup-confirm" element with text ' + situation);
      return true;
    } else {
      console.log(
        'Inner HTML of "popup-confirm" element is not equal to ' +
          situation +
          ' but instead ' +
          innerHTML +
          '.'
      );
    }
    return false;
  } else {
    console.log("Could not find element " + popupConfirmElement);
    return false;
  }
}

// Utility function to read user input from the console
function getUserInput(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Get the argument passed from the launch configuration
const pathArgument = process.argv[2];
run(pathArgument);


