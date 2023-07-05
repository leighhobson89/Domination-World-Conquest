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
      break;
    case 'default':
      await driver.switchTo().defaultContent();
      console.log('Switched context to ' + context);
      break;
    default:
      console.log("Couldn't find context, quitting");
      break;
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
  } else {
    console.log('Could not find path element ' + path);
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
    } else {
      console.log(
        'Inner HTML of "popup-confirm" element is not equal to ' +
          situation +
          ' but instead ' +
          innerHTML +
          '.'
      );
    }
  } else {
    console.log("Could not find element " + popupConfirmElement);
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
  } else {
    console.log('Could not find "move-phase-button" element.');
  }
}

async function validateAttackTransferWindowOpen(driver) {
  let table = await driver.findElement(By.id('transferTable'));
  if (!table) {
    console.log("Table Not On Screen!");
    return;
  }
  console.log("Table On Screen!");

  let firstRow = await driver.findElement(By.css('.transfer-table-row:first-child'));
  if (!firstRow) {
    console.log("No Rows In Table!");
    return;
  }
  console.log("At Least One Row In Table!");

  const colSelectors = await getTransferAttackColumnSelectors();  

  const columnElements = [[], [], [], []];

    for (let i = 0; i < colSelectors.length; i++) {
      const [selector, elementName] = colSelectors[i];
      const element = await driver.findElement(By.css(selector));

      if (elementName.includes("first")) {
        columnElements[0].push(element);
      } else if (elementName.includes("second")) {
        columnElements[1].push(element);
      } else if (elementName.includes("third")) {
        columnElements[2].push(element);
      } else if (elementName.includes("fourth")) {
        columnElements[3].push(element);
      }
      if (i === 15) { //if gets to end of selector validations
        console.log("All Elements Found In Table Row!");
      }
    }
  return columnElements;
}

async function getTransferAttackColumnSelectors() {
  const colSelectors = [
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
  return colSelectors;
}

async function addMaxArmy(driver) {
  let col;
  let amountsArray = [0, 0, 0, 0];

  for (let i = 1; i < 5; i++) {
    col = await driver.findElement(By.css(`.transfer-table-row:first-child .army-type-column:nth-child(${i}) .transferPlusButton`));
    await col.click();
    await wait(100);
    amountsArray[i] = await driver.findElement(By.css(`.transfer-table-row:first-child .army-type-column:nth-child(${i}) .quantityTextField`));
    console.log("Added " + amountsArray[i] + " for column " + i);
  }
  return amountsArray;
}

async function wait(time) {
  await new Promise(resolve => setTimeout(resolve, time));
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
  validateAttackTransferWindowOpen: validateAttackTransferWindowOpen,
  addMaxArmy: addMaxArmy
};

