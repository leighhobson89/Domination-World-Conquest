let pageLoaded = false;
let arrayOfArmyAndResourceProportionsUI;
let startingArmy;
let red;
let green;
let blue;
let currentPath; // Define a global variable to store the current path element
let mouseOverFlag = false;
let clickActionsDone = false;
let blurNotRunYet = true;
let gameInProgress = false;
let menuState = true;
let prevPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
prevPath.setAttribute("d", "M0 0 L50 50"); // set a dummy path data

function svgMapLoaded() {
  const svgMap = document.getElementById('svg-map').contentDocument;
  const svg = document.getElementById('svg-map');
  svg.setAttribute("tabindex", "0");
  const tooltip = document.getElementById("tooltip");

  if (blurNotRunYet) {
    blurEffect(0); //blur background
    blurNotRunYet = false;
  }
    
    svgMap.addEventListener("mouseover", function(e) {
      // Get the element that was hovered over
      const path = e.target;
    
      if (path.tagName === "image") {
        setTimeout(function() {
          path.style.cursor = "default";
        }, 50);
      }

    currentPath = path; // Set the current path element

    // Call the hoverColorChange function
    hoverColorChange(path, 0);

    // Get the name of the country from the "data-name" attribute
    const countryName = path.getAttribute("data-name");

    // Get the coordinates of the mouse cursor
    const x = e.clientX;
    const y = e.clientY;

    // Set the content of the tooltip
    tooltip.innerHTML = countryName;

    // Position the tooltip next to the mouse cursor
    tooltip.style.left = x - 40 + "px";
    tooltip.style.top = 25 + y + "px";

    // Show the tooltip
    tooltip.style.display = "block";
    tooltip.style.backgroundColor = "white";

    path.style.cursor = "pointer";
  });

  // Add a mouseout event listener to the SVG element
  svgMap.addEventListener("mouseout", function(e) {
    tooltip.innerHTML = "";
    tooltip.style.display = "none";
    tooltip.style.backgroundColor = "transparent";
    hoverColorChange(currentPath, 1); // Pass the current path element and set mouseAction to 1
    clickActionsDone = false;
  });

  // Add a mousemove event listener to the SVG element
  svgMap.addEventListener("mousemove", function(e) {
    // Check if the mouse is currently over a country with a tooltip
    if (tooltip.innerHTML !== "") {
      // Set the display property of the tooltip to "block" to show it
      tooltip.style.display = "block";
      // Set the background color of the tooltip to white
      tooltip.style.backgroundColor = "white";
    } else {
      // Set the display property of the tooltip to "none" to hide it
      tooltip.style.display = "none";
      // Set the background color of the tooltip to transparent
      tooltip.style.backgroundColor = "transparent";
    }
  });

  svgMap.addEventListener("click", function(e) {
    if (e.target.tagName === "path") {
    selectCountry(e.target, false);
  }
});

svgMap.addEventListener("mousedown", function(e) {
  e.preventDefault();
});

svgMap.addEventListener("mouseup", function(e) {
  e.preventDefault();
});
console.log ("loaded!");
}

window.addEventListener('load', function() {
  svgMapLoaded();
});

function sendPostRequest(country) {
  // Ensure hovering over a country before sending request
  if (tooltip.innerHTML === "") {
    return;
  }

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "http://localhost:8000/getCountryDataForBottomTable.php", true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.onreadystatechange = function () {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      // Parse the response JSON data
      const data = JSON.parse(xhr.responseText);

      // Loop through arrayOfArmyAndResourceProportionsUI to find the data for the corresponding country
      let countryResourceData;
      for (let i = 0; i < arrayOfArmyAndResourceProportionsUI.length; i++) {
        if (arrayOfArmyAndResourceProportionsUI[i].dataName === country) {
          countryResourceData = arrayOfArmyAndResourceProportionsUI[i];
          break;
        }
      }

      // Update the table with the response data
      document.getElementById("bottom-table").rows[0].cells[0].style.whiteSpace = "pre";
      document.getElementById("bottom-table").rows[0].cells[0].innerHTML = data[0].country + " (" + data[0].continent + ")";

      document.getElementById("bottom-table").rows[0].cells[2].innerHTML = Math.ceil(countryResourceData.goldForCurrentTerritory);
      document.getElementById("bottom-table").rows[0].cells[4].innerHTML = Math.ceil(countryResourceData.oilForCurrentTerritory);
      document.getElementById("bottom-table").rows[0].cells[6].innerHTML = Math.ceil(countryResourceData.foodForCurrentTerritory);
      document.getElementById("bottom-table").rows[0].cells[8].innerHTML = Math.ceil(countryResourceData.consMatsForCurrentTerritory);
      if (data[0].startingPop.length > 0) {
        const population = formatNumbersToKMB(data[0].startingPop);
        document.getElementById("bottom-table").rows[0].cells[10].innerHTML = population;
      }
      if (data[0].area.length > 0) {
        const area = formatNumbersToKMB(data[0].area);
        document.getElementById("bottom-table").rows[0].cells[12].innerHTML = area + " (km²)";
      }
      const territoryId = currentPath.getAttribute("territory-id");
      for (let i = 0; i < arrayOfArmyAndResourceProportionsUI.length; i++) {
        if (arrayOfArmyAndResourceProportionsUI[i].territoryId === territoryId && arrayOfArmyAndResourceProportionsUI[i].dataName === data[0].country) {
          startingArmy = Math.ceil(arrayOfArmyAndResourceProportionsUI[i].armyForCurrentTerritory);
          startingArmy = formatNumbersToKMB(startingArmy);
          break;
        }
      }
      document.getElementById("bottom-table").rows[0].cells[14].innerHTML = startingArmy;
    }
  };
  xhr.send("country=" + country);
}


function formatNumbersToKMB(string) {
  if (string >= 1000000000) {
    return (string / 1000000000).toFixed(1) + 'B';
  } else if (string >= 1000000) {
    return (string / 1000000).toFixed(1) + 'M';
  } else if (string >= 1000) {
    return (string / 1000).toFixed(1) + 'k';
  } else {
    return string.toString();
  }
}

function hoverColorChange(path, mouseAction) { //mouseaction = 0 if mouseover, or 1 if mouseout
  if (path && path.style) {
    // Get the current fill color
    let color = path.style.fill;

    // Convert the color to an RGB array
    let rgb = color.replace(/[^\d,]/g, '').split(',');

    // Convert each RGB component to an integer
    let r = parseInt(rgb[0], 10);
    let g = parseInt(rgb[1], 10);
    let b = parseInt(rgb[2], 10);

    // Increase each RGB component by 30, or set to 255 if already higher than 225
    if (mouseAction == 0 && !mouseOverFlag) {
      red = r;
      green = g;
      blue = b;
      r = Math.min(r + 20, 255);
      g = Math.min(g + 20, 255);
      b = Math.min(b + 20, 255);
      mouseOverFlag = true;

      const svgMap = document.getElementById('svg-map').contentDocument;
      const paths = svgMap.querySelectorAll('path[data-name="' + path.getAttribute("data-name") + '"]');

      // Loop through all paths in the SVG and change the fill color of the ones that have a "data-name" attribute that matches the one of the hovered path
      
      for (let i = 0; i < paths.length; i++) {
        paths[i].style.fill = 'rgb(' + r + ',' + g + ',' + b + ')';
      }
    } else if (mouseAction == 1 && mouseOverFlag) {
      const svgMap = document.getElementById('svg-map').contentDocument;
      const paths = svgMap.querySelectorAll('path[data-name="' + path.getAttribute("data-name") + '"]');
      // Loop through all paths in the SVG and change the fill color of the ones that have a "data-name" attribute that matches the one of the hovered path
      for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("data-name") == "Russia" && paths[i].getAttribute("special") == 0) { //Kaliningrad special case for colour
          paths[i].style.fill = `rgb(186, 218, 85)`;
        } else {
          paths[i].style.fill = `rgb(${red}, ${green}, ${blue})`;
        }
      }
      mouseOverFlag = false;
    }
  }
}

function blurEffect(mode) {
  if (mode == 0) {
    // Get the SVG element and create a filter element
    const svg = document.getElementById('svg-map');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'blur-filter');

    // Create a Gaussian blur element and set its attributes
    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic'); // Apply the filter to the entire SVG element
    blur.setAttribute('stdDeviation', '5'); // Set the amount of blur

    // Append the blur element to the filter element, and the filter element to the SVG element
    filter.appendChild(blur);
    svg.appendChild(filter);

    // Apply the filter to the SVG element
    svg.style.filter = 'url(#blur-filter)';
  } else if (mode == 1) {
    // Get the SVG element and the filter element, and remove the filter element
    const svg = document.getElementById('svg-map');
    const filter = document.getElementById('blur-filter');
    svg.removeChild(filter);

    // Reset the SVG element's filter property to 'none'
    svg.style.filter = 'none';
  }
}

function selectCountry(country, escKeyEntry) {
  const svgMap = document.getElementById('svg-map').contentDocument;
    window.focus();
    svgMap.documentElement.appendChild(country);
    country.setAttribute('stroke-width', '3');
      if (!clickActionsDone) {
        sendPostRequest(country.getAttribute("data-name"));
        if (prevPath != null && !escKeyEntry) { // Check if a path was previously clicked
          if (prevPath.getAttribute('d') != 'M0 0 L50 50') {
            prevPath.parentNode.insertBefore(prevPath, prevPath.parentNode.children[9]);
            prevPath.setAttribute('stroke-width', '1'); // Set the stroke-width attribute of the previous path to "1"
          }

        }
        prevPath = country; // Update the previously clicked path
        clickActionsDone = true;
      }
}

document.addEventListener("DOMContentLoaded", function() {
  // create the menu container
  const menuContainer = document.createElement("div");
  menuContainer.classList.add("menu-container");

  // create the menu options
  const title = document.createElement("td");
  title.innerText = "Domination:";
  title.classList.add("menu-option");
  title.classList.add("title");

  const subTitle = document.createElement("td");
  subTitle.innerText = "World Conquest";
  subTitle.classList.add("menu-option");
  subTitle.classList.add("subTitle");

  const option3 = document.createElement("button");
  option3.innerText = "New Game";
  option3.classList.add("menu-option");
  option3.classList.add("option-3");
  option3.setAttribute("id", "new-game-btn"); 

  const option4 = document.createElement("button");
  option4.innerText = "Toggle Music";
  option4.classList.add("menu-option");
  option4.classList.add("option-4");
  option4.setAttribute("id", "toggle-music-btn"); 

  const option5 = document.createElement("button");
  option5.innerText = "Help";
  option5.classList.add("menu-option");
  option5.classList.add("option-5");

  // add event listener to New Game button
  option3.addEventListener("click", function() {
    toggleTableContainer(true);
    blurEffect(1);
    document.getElementById("menu-container").style.display = "none";
    gameInProgress = true;
    menuState = false;
  });

  // add the menu options to the menu container
  menuContainer.appendChild(title);
  menuContainer.appendChild(subTitle);
  menuContainer.appendChild(option3);
  menuContainer.appendChild(option4);
  menuContainer.appendChild(option5);

  // add the menu container to the HTML body
  document.getElementById("menu-container").appendChild(menuContainer);
  pageLoaded = true;
});

function toggleTableContainer(turnOnTable) {
  var tableContainer = document.getElementById("table-container");
  if (turnOnTable) {
    tableContainer.style.display = "block";
  } else if (!turnOnTable) {
    tableContainer.style.display = "none";
  }
}

window.addEventListener("keydown", function(event) {
  if (event.code === "Escape" && gameInProgress && !menuState) {
    blurEffect(0);
    document.getElementById("menu-container").style.display = "block";
    toggleTableContainer(false);
    menuState = true;
  } else if (event.code === "Escape" && gameInProgress && menuState) {
    blurEffect(1);
    toggleTableContainer(true);
    document.getElementById("menu-container").style.display = "none";
    selectCountry(prevPath, true);
    menuState = false;
  }
});


