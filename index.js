let red;
let green;
let blue;
let mouseOverFlag = false;

function svgMapLoaded() {
  console.log("page loaded!");

  const svgMap = document.getElementById('svg-map').contentDocument;
  const tooltip = document.getElementById("tooltip");
  let currentPath; // Define a global variable to store the current path element

  // Add a mouseover event listener to the SVG element
  svgMap.addEventListener("mouseover", function(e) {
    // Get the path element that was hovered over
    const path = e.target;
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
    tooltip.style.left = 10 + x + "px";
    tooltip.style.top = y + "px";

    // Show the tooltip
    tooltip.style.display = "block";
    tooltip.style.backgroundColor = "white";
  });

  // Add a mouseout event listener to the SVG element
  svgMap.addEventListener("mouseout", function(e) {
    // Hide the tooltip
    tooltip.innerHTML = "";
    tooltip.style.display = "none";
    tooltip.style.backgroundColor = "transparent";
    hoverColorChange(currentPath, 1); // Pass the current path element and set mouseAction to 1
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
      const path = e.target;
      sendPostRequest(path.getAttribute("data-name"));
    });
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
  xhr.open("POST", "http://localhost:8000/databaseConn.php", true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.onreadystatechange = function () {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      // Parse the response JSON data
      const data = JSON.parse(xhr.responseText);
      console.log(data);

      // Update the table with the response data
      document.getElementById("my-table").rows[0].cells[0].style.whiteSpace = "pre";
      document.getElementById("my-table").rows[0].cells[0].innerHTML = data[0].country + " (" + data[0].continent + ")";
     
      if (data[0].startingPop.length > 0) {
        const population = formatPopulation(data[0].startingPop);
        document.getElementById("my-table").rows[0].cells[2].innerHTML = population;
      }
      document.getElementById("my-table").rows[0].cells[4].innerHTML = data[0].area;
      document.getElementById("my-table").rows[0].cells[6].innerHTML = data[0].startingArmy;
    }
  };
  xhr.send("country=" + country);
}

function formatPopulation(population) {
  if (population >= 1000000000) {
    return (population / 1000000000).toFixed(1) + 'B';
  } else if (population >= 1000000) {
    return (population / 1000000).toFixed(1) + 'M';
  } else if (population >= 1000) {
    return (population / 1000).toFixed(1) + 'k';
  } else {
    return population.toString();
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

      // Loop through all paths in the SVG and change the fill color of the ones that have a "data-name" attribute that matches the one of the hovered path
      const svgMap = document.getElementById('svg-map').contentDocument;
      const paths = svgMap.querySelectorAll('path[data-name="' + path.getAttribute("data-name") + '"]');
      for (let i = 0; i < paths.length; i++) {
        paths[i].style.fill = 'rgb(' + r + ',' + g + ',' + b + ')';
      }
    } else if (mouseAction == 1 && mouseOverFlag) {
      // Loop through all paths in the SVG and change the fill color of the ones that have a "data-name" attribute that matches the one of the hovered path
      const svgMap = document.getElementById('svg-map').contentDocument;
      const paths = svgMap.querySelectorAll('path[data-name="' + path.getAttribute("data-name") + '"]');
      for (let i = 0; i < paths.length; i++) {
        if (paths[i])
        paths[i].style.fill = `rgb(${red}, ${green}, ${blue})`;;
      }
      mouseOverFlag = false;
    }
  }
}

