function svgMapLoaded() {
    console.log("page loaded!");
  
    const svgMap = document.getElementById('svg-map').contentDocument;
    const tooltip = document.getElementById("tooltip");
  
    // Add a mouseover event listener to the SVG element
    svgMap.addEventListener("mouseover", function(e) {
      // Get the path element that was hovered over
      const path = e.target;
  
      // Get the name of the country from the "data-name" attribute
      const countryName = path.getAttribute("data-name");
  
      // Get the coordinates of the mouse cursor
      const x = e.clientX;
      const y = e.clientY;
  
      // Set the content of the tooltip
      tooltip.innerHTML = countryName;
  
      // Position the tooltip next to the mouse cursor
      tooltip.style.left = x + "px";
      tooltip.style.top = y + "px";
  
      // Show the tooltip
      tooltip.style.display = "block";
    });
  
    // Add a mouseout event listener to the SVG element
    svgMap.addEventListener("mouseout", function(e) {
      // Hide the tooltip
      tooltip.innerHTML = "";
      tooltip.style.display = "none";
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
        document.getElementById("my-table").rows[0].cells[0].innerHTML = data[0].country + " (" + data[0].continent + ")";
        /* document.getElementById("my-table").rows[1].cells[1].innerHTML = data[0].continent; */
       
        if (data[0].startingPop.length > 0) {
          const population = formatPopulation(data[0].startingPop);
          document.getElementById("my-table").rows[1].cells[1].innerHTML = population;
        }
        document.getElementById("my-table").rows[2].cells[1].innerHTML = data[0].area;
        document.getElementById("my-table").rows[3].cells[1].innerHTML = data[0].startingArmy;
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
  
  