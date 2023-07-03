const { Builder, By, Key, until } = require('selenium-webdriver');

async function run() {
// Create a new instance of the WebDriver
let driver = await new Builder().forBrowser('chrome').build();

try {
// Navigate to a website
await driver.get('http://localhost:3000');
let retries = 0;
let foundElement = false;

while (retries < 10 && !foundElement) {
  try {
    // Find and interact with the element on the page
    let searchInput = await driver.findElement(By.id('svg-map'));

    // If the element is found, set the flag and break the loop
    foundElement = true;

    console.log('Element found:', searchInput);
  } catch (error) {
    // If the element is not found, wait for 2 seconds and refresh the page
    console.log('Element not found. Retrying...');

    await driver.sleep(2000);
    await driver.navigate().refresh();

    retries++;
  }
}

if (foundElement) {
  // Perform additional actions if the element is found
  // ...
} else {
  console.log('Element not found after maximum retries.');
}
} finally {
    // Quit the WebDriver session
    console.log('Got to the end.');
    }
}
    
    run();