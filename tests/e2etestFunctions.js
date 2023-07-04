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

async function clickAttackTransferButton(driver) {
  // Click on the element with id="new-game-btn"
  let attackTransferButton = await driver.findElement(By.id('move-phase-button'));
  if (attackTransferButton) {
    console.log('Clicked on "move-phase-button" element, which reads: ' + await (await driver.findElement(By.id('move-phase-button'))).getAttribute('innerHTML'));
    await attackTransferButton.click();
    return true;
  } else {
    console.log('Could not find "move-phase-button" element.');
    return false;
  }
}

async function validateAttackTransferWindowOpen(driver) {
  let table = await driver.findElement(By.id('transferTable'));
  if (!table) {
    console.log("Table Not On Screen!");
    return false;
  }
  console.log("Table On Screen!");

  let firstRow = await driver.findElement(By.css('.transfer-table-row:first-child'));
  if (!firstRow) {
    console.log("No Rows In Table!");
    return false;
  }
  console.log("At Least One Row In Table!");

  const columnNames = ['first', 'second', 'third', 'fourth'];
  const selectors = [
    ['.transfer-table-row .army-type-column:nth-child(1) .multipleIncrementerButton', 'firstColumnMultiple'],
    ['.transfer-table-row .army-type-column:nth-child(1) .multipleTextField', 'firstColumnMultAmount'],
    ['.transfer-table-row .army-type-column:nth-child(1) .transferMinusButton', 'firstColumnMinus'],
    ['.transfer-table-row .army-type-column:nth-child(1) .quantityTextField', 'firstColumnAttackAmount'],
    ['.transfer-table-row .army-type-column:nth-child(1) .transferPlusButton', 'firstColumnPlus'],
    ['.transfer-table-row .army-type-column:nth-child(2) .multipleIncrementerButton', 'secondColumnMultiple'],
    ['.transfer-table-row .army-type-column:nth-child(2) .multipleTextField', 'secondColumnMultAmount'],
    ['.transfer-table-row .army-type-column:nth-child(2) .transferMinusButton', 'secondColumnMinus'],
    ['.transfer-table-row .army-type-column:nth-child(2) .quantityTextField', 'secondColumnAttackAmount'],
    ['.transfer-table-row .army-type-column:nth-child(2) .transferPlusButton', 'secondColumnPlus'],
    ['.transfer-table-row .army-type-column:nth-child(3) .multipleIncrementerButton', 'thirdColumnMultiple'],
    ['.transfer-table-row .army-type-column:nth-child(3) .multipleTextField', 'thirdColumnMultAmount'],
    ['.transfer-table-row .army-type-column:nth-child(3) .transferMinusButton', 'thirdColumnMinus'],
    ['.transfer-table-row .army-type-column:nth-child(3) .quantityTextField', 'thirdColumnAttackAmount'],
    ['.transfer-table-row .army-type-column:nth-child(3) .transferPlusButton', 'thirdColumnPlus'],
    ['.transfer-table-row .army-type-column:nth-child(4) .multipleIncrementerButton', 'fourthColumnMultiple'],
    ['.transfer-table-row .army-type-column:nth-child(4) .multipleTextField', 'fourthColumnMultAmount'],
    ['.transfer-table-row .army-type-column:nth-child(4) .transferMinusButton', 'fourthColumnMinus'],
    ['.transfer-table-row .army-type-column:nth-child(4) .quantityTextField', 'fourthColumnAttackAmount'],
    ['.transfer-table-row .army-type-column:nth-child(4) .transferPlusButton', 'fourthColumnPlus']
  ];

  const elements = [];

  for (let i = 0; i < columnNames.length; i++) {
    const column = columnNames[i];
    const columnElements = [];

    for (let j = i * selectors.length; j < (i + 1) * selectors.length; j++) {
      const [selector, elementName] = selectors[j];
      const element = await driver.findElement(By.css(selector));

      if (!element) {
        console.log(`Not Found: ${column} column, ${elementName}`);
        return false;
      }

      console.log(`Found ${column} column, ${elementName}`);
      columnElements.push(element);
    }

    elements.push(columnElements);
  }

  console.log("All Elements Found In Table Row!");
  return elements;
}



module.exports = {
  runTest: validateSVG,
  clickPopupConfirm: clickPopupConfirm,
  clickPlayerCountryPath: clickPlayerCountryPath,
  clickNewGame: clickNewGame,
  switchContext: switchContext,
  findAvailableAttackPaths: findAvailableAttackPaths,
  selectRandomCountryToAttack: selectRandomCountryToAttack,
  clickAttackTransferButton: clickAttackTransferButton,
  validateAttackTransferWindowOpen: validateAttackTransferWindowOpen
};

