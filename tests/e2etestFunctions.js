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
  await switchContext(driver, "default");
  const tooltipElement = await driver.findElement(By.id('tooltip'));
  const originalDisplay = await tooltipElement.getCssValue('display');
  await driver.executeScript("arguments[0].style.display = 'none';", tooltipElement);
  await switchContext(driver, "svg");
  let pathElement = await driver.findElement(By.css('path[uniqueid="' + path + '"]'));
  if (pathElement) {
    await pathElement.click();
    console.log('Clicked on path element with uniqueid="' + path + '".');
  } else {
    console.log('Could not find path element ' + path);
  }
  await switchContext(driver, "default");
  await driver.executeScript("arguments[0].style.display = arguments[1];", tooltipElement, originalDisplay);
  await switchContext(driver, "svg");
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
    amountsArray[i-1] = await driver.findElement(By.css(`.transfer-table-row:first-child .army-type-column:nth-child(${i}) .quantityTextField`)).getAttribute('value');
    console.log("Added " + amountsArray[i-1] + " for column " + i);
  }
  return amountsArray;
}

async function validateBattleUI(driver) {
  const leftTitle = await driver.findElement(By.id('battleUITitleTitleLeft')).getText();
  const centerTitle = await driver.findElement(By.id('battleUITitleTitleCenter')).getText();
  const rightTitle = await driver.findElement(By.id('battleUITitleTitleRight')).getText();

  console.log("The war is " + leftTitle + " " + centerTitle + " " + rightTitle);

  const attInfantry = await driver.findElement(By.id('armyRowRow2Quantity1')).getText();
  const attAssault = await driver.findElement(By.id('armyRowRow2Quantity2')).getText();
  const attAir = await driver.findElement(By.id('armyRowRow2Quantity3')).getText();
  const attNaval = await driver.findElement(By.id('armyRowRow2Quantity4')).getText();

  const defInfantry = await driver.findElement(By.id('armyRowRow2Quantity5')).getText();
  const defAssault = await driver.findElement(By.id('armyRowRow2Quantity6')).getText();
  const defAir = await driver.findElement(By.id('armyRowRow2Quantity7')).getText();
  const defNaval = await driver.findElement(By.id('armyRowRow2Quantity8')).getText();

  const probability = await driver.findElement(By.id('battleUIRow4Col1')).getText();
  const defenceBonus = await driver.findElement(By.id('defenceBonusText')).getText();

  const probabilityColumnBox = await driver.findElement(By.id('probabilityColumnBox'));
  const widthValueProbabilityColumnBox = await probabilityColumnBox.getCssValue('width');

  console.log("Carrying out Attack, starting with " + attInfantry + " infantry, " + attAssault + " assault, " + attAir + " air, and " + attNaval + " naval!");
  console.log("Defenders have " + defInfantry + " infantry, " + defAssault + " assault, " + defAir + " air, and " + defNaval + " naval!");
  console.log(probability);
  console.log("The width value of probabilityColumnBox is: " + widthValueProbabilityColumnBox);
  console.log("Defence Bonus: " + defenceBonus);

  const siegeButton = await driver.findElement(By.id('siegeButton'));
  const advanceButton = await driver.findElement(By.id('advanceButton'));
  const retreatButton = await driver.findElement(By.id('retreatButton'));

  const siegeDisabled = await siegeButton.getAttribute('disabled');
  const siegeText = await siegeButton.getAttribute('innerHTML');
  const advanceDisabled = await advanceButton.getAttribute('disabled');
  const advanceText = await advanceButton.getAttribute('innerHTML');
  const retreatDisabled = await retreatButton.getAttribute('disabled');
  const retreatText = await retreatButton.getAttribute('innerHTML');

  console.log("siegeButton - Disabled: " + siegeDisabled + ", Text: " + siegeText);
  console.log("advanceButton - Disabled: " + advanceDisabled + ", Text: " + advanceText);
  console.log("retreatButton - Disabled: " + retreatDisabled + ", Text: " + retreatText);
}

async function clickThroughAttack(driver) {
  const advanceButton = await driver.findElement(By.id('advanceButton'));
  const retreatButton = await driver.findElement(By.id('retreatButton'));
  const siegeButton = await driver.findElement(By.id('siegeButton'));

  let probability = await driver.findElement(By.id('battleUIRow4Col1')).getText();
  let probabilityValue = parseInt(probability.match(/\d+/)[0]);

  let advanceButtonText = await advanceButton.getText();
  let retreatButtonText = await retreatButton.getText();
  let siegeButtonDisabled = await siegeButton.getAttribute('disabled');
  let retreatButtonDisabled = await retreatButton.getAttribute('disabled');
  let advanceButtonDisabled = await advanceButton.getAttribute('disabled');

  console.log('Advance Button:', advanceButtonText);
  console.log('Retreat Button:', retreatButtonText);
  console.log('Siege Button Disabled:', siegeButtonDisabled);
  console.log('Retreat Button Disabled:', retreatButtonDisabled);
  console.log('Advance Button Disabled:', advanceButtonDisabled);

  if (advanceButtonText === 'Begin War!' && retreatButtonText === 'Retreat!') {
    await advanceButton.click();
    console.log('Clicked Advance Button');
  }

  let battleResolution = '';

  while (true) {
    probability = await driver.findElement(By.id('battleUIRow4Col1')).getText();
    probabilityValue = parseInt(probability.match(/\d+/)[0]);
    console.log(probability);

    advanceButtonText = await advanceButton.getText();
    retreatButtonText = await retreatButton.getText();
    siegeButtonDisabled = await siegeButton.getAttribute('disabled');
    retreatButtonDisabled = await retreatButton.getAttribute('disabled');
    advanceButtonDisabled = await advanceButton.getAttribute('disabled');

    await wait(200);
    if (advanceButtonText === 'Next Skirmish') {
      if (probabilityValue < 25) {
        if (Math.random() > 0.5) {
          console.log("Scattering!");
          battleResolution = "DS";
          break;
        } else {
          await advanceButton.click();
          console.log('Resisted Urge To Scatter And Clicked Next Skirmish');
          continue;
        }
      }
      await advanceButton.click();
      console.log('Clicked Next Skirmish');

      advanceButtonText = await advanceButton.getText();
      retreatButtonText = await retreatButton.getText();
      siegeButtonDisabled = await siegeButton.getAttribute('disabled');
      retreatButtonDisabled = await retreatButton.getAttribute('disabled');
      advanceButtonDisabled = await advanceButton.getAttribute('disabled');

      if (advanceButtonText === 'Massive Assault' || advanceButtonText === 'Rout The Enemy' || advanceButtonText === 'Victory!') {
        console.log('Battle Resolution Available:', advanceButtonText);
        switch (advanceButtonText) {
          case "Massive Assault":
            battleResolution = "VMA";
            break;
          case "Rout The Enemy":
            battleResolution = "VR";
            break;
          case "Victory!":
            battleResolution = "V";
            break;
        }
        await wait(500);
        break;
      } else if (advanceButtonText === 'End Round' && retreatButtonText === 'Scatter!' && siegeButtonDisabled && retreatButtonDisabled) {
          console.log('End of Round, Continuing...');
          await advanceButton.click();
          await wait(200);
          continue;
      }
    } else if (retreatButtonText === 'Retreat!' && advanceButtonText === 'Start Attack!' && !advanceButtonDisabled && !siegeButtonDisabled) {
        await advanceButton.click();
        console.log('Clicked Start Attack!');
        continue;
    }

    advanceButtonText = await advanceButton.getText();
    retreatButtonText = await retreatButton.getText();
    siegeButtonDisabled = await siegeButton.getAttribute('disabled');
    retreatButtonDisabled = await retreatButton.getAttribute('disabled');
    advanceButtonDisabled = await advanceButton.getAttribute('disabled');

    console.log('Advance Button:', advanceButtonText);
    console.log('Retreat Button:', retreatButtonText);
    console.log('Siege Button Disabled:', siegeButtonDisabled);
    console.log('Retreat Button Disabled:', retreatButtonDisabled);
    console.log('Advance Button Disabled:', advanceButtonDisabled);

    if (advanceButtonText === 'Next Skirmish') {
      if (retreatButtonText === 'Scatter!') {
        console.log('Retreat Button says "Scatter!"');
      }

      if (retreatButtonText === 'Defeat!') {
        console.log('Retreat Button says "Defeat!"');
        break;
      }
    }
    await wait(300);
  }

  advanceButtonText = await advanceButton.getText();
  retreatButtonText = await retreatButton.getText();
  siegeButtonDisabled = await siegeButton.getAttribute('disabled');
  retreatButtonDisabled = await retreatButton.getAttribute('disabled');
  advanceButtonDisabled = await advanceButton.getAttribute('disabled');

  let armyQuantities = [];
  let enemyArmyQuantities = [];

  if (advanceButtonDisabled && siegeButtonDisabled && retreatButtonText === 'Defeat!') {
    console.log('Advance Button Disabled, Siege Button Disabled, Retreat Button says "Defeat!"');
    battleResolution = 'D';
  }

  if (retreatButtonDisabled && siegeButtonDisabled && advanceButtonText === 'Rout The Enemy') {
    console.log('Retreat Button Disabled, Siege Button Disabled, Retreat Button says "Rout The Enemy"');
    battleResolution = 'VR';
  }

  if (retreatButtonDisabled && siegeButtonDisabled && advanceButtonText === 'Massive Assault') {
    console.log('Retreat Button Disabled, Siege Button Disabled, Retreat Button says "Massive Assault"');
    battleResolution = 'VMA';
  }

  if (retreatButtonDisabled && siegeButtonDisabled && advanceButtonText === 'Victory!') {
    console.log('Retreat Button Disabled, Siege Button Disabled, Retreat Button says "Victory!"');
    battleResolution = 'V';
  }

  const attInfantry = await driver.findElement(By.id('armyRowRow2Quantity1')).getText();
  const attAssault = await driver.findElement(By.id('armyRowRow2Quantity2')).getText();
  const attAir = await driver.findElement(By.id('armyRowRow2Quantity3')).getText();
  const attNaval = await driver.findElement(By.id('armyRowRow2Quantity4')).getText();

  const defInfantry = await driver.findElement(By.id('armyRowRow2Quantity5')).getText();
  const defAssault = await driver.findElement(By.id('armyRowRow2Quantity6')).getText();
  const defAir = await driver.findElement(By.id('armyRowRow2Quantity7')).getText();
  const defNaval = await driver.findElement(By.id('armyRowRow2Quantity8')).getText();

  armyQuantities = [attInfantry, attAssault, attAir, attNaval];
  enemyArmyQuantities = [defInfantry, defAssault, defAir, defNaval];
  result = [armyQuantities, enemyArmyQuantities, battleResolution];

  console.log("Attackers Remaining " + armyQuantities.join(', ') + "!");
  console.log("Defenders remaining " + enemyArmyQuantities.join(', ') + "!");
  console.log("Resolution of the Battle: " + battleResolution);

  return result;
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
  addMaxArmy: addMaxArmy,
  validateBattleUI: validateBattleUI,
  clickThroughAttack: clickThroughAttack
};

