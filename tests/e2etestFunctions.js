const { By } = require('selenium-webdriver');

async function validateSVG(driver) {
  try {
    let retries = 0;
    let foundSVG = false;

    // Find SVG file to start the game
    while (retries < 10 && !foundSVG) {
      try {
        const svgMap = await driver.findElement(By.id('svg-map'));
        if (svgMap) {
          foundSVG = true;
          console.log('Loaded App. SVG:');
        }
      } catch (error) {
        console.log('SVG not found. Retrying attempt... ' + retries);
        await driver.navigate().refresh();
        retries++;
      }
    }
  } catch (error) {
    console.log("Max Retries attempted, SVG file not loading");
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

async function clickPlayerCountryPath(driver, path) {
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

async function findAvailableAttackPaths(driver) {
  //select paths not belonging to player from those available to interact with
  const elements = await driver.findElements(By.css('path[fill*="url"]:not([owner="Player"])'));
  return elements;
}


async function selectRandomCountryToAttack(interactablePaths) {
  const randomIndex = Math.floor(Math.random() * interactablePaths.length);
  const randomElement = interactablePaths[randomIndex];
  if (randomElement) {
    const territoryName = await randomElement.getAttribute('territory-name');
    console.log("Picked to Attack: " + territoryName);
  }
  return randomElement;
}

module.exports = {
  runTest: validateSVG,
  clickPopupConfirm: clickPopupConfirm,
  clickPlayerCountryPath: clickPlayerCountryPath,
  clickNewGame: clickNewGame,
  switchContext: switchContext,
  findAvailableAttackPaths: findAvailableAttackPaths,
  selectRandomCountryToAttack: selectRandomCountryToAttack
};

