function svgMapLoaded() {
    console.log("page loaded!");
  
    const svgMap = document.getElementById('svg-map').contentDocument;
    const tooltip = document.getElementById("tooltip");
    
    svgMap.addEventListener('wheel', handleMapScroll, { passive: false });

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

  function handleMapScroll(event) {
    const svgMap = document.getElementById('svg-map');
    const svgRect = svgMap.getBoundingClientRect();
    const pointerX = event.clientX - svgRect.left;
    const pointerY = event.clientY - svgRect.top;
    
    // Prevent the default scrolling behavior
    event.preventDefault();
  
    // Determine the amount of scrolling
    const delta = Math.max(-1, Math.min(1, (event.deltaY || -event.detail))) * -1;
  
    // Get the current zoom level
    const currentZoom = svgMap.style.zoom ? parseFloat(svgMap.style.zoom) : 1;
  
    // Calculate the new zoom level
    const newZoom = currentZoom + (delta * 0.1);
  
    // Limit the zoom level to between 1 and 2
    const zoom = Math.min(2, Math.max(1, newZoom));
  
    // Calculate the new viewBox coordinates based on the zoom level and pointer position
    const viewBoxX = (svgRect.width / 2) - ((svgRect.width / (2 * zoom)) + pointerX / zoom);
    const viewBoxY = (svgRect.height / 2) - ((svgRect.height / (2 * zoom)) + pointerY / zoom);

    const viewBoxWidth = svgRect.width / zoom;
    const viewBoxHeight = svgRect.height / zoom;
    const viewBox = `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`;
  
    // Set the new zoom level and viewBox
    svgMap.style.zoom = zoom;
    svgMap.setAttribute('viewBox', viewBox);
  
    // Enable or disable scrolling based on the zoom level
    svgMap.style.overflow = zoom > 1 ? 'scroll' : 'hidden';
    
    // Disable mouse wheel scrolling when the map is zoomed in
    if (zoom > 1) {
      svgMap.addEventListener('wheel', disableMouseWheelScroll, { passive: false });
    } else {
      svgMap.removeEventListener('wheel', disableMouseWheelScroll);
    }
  }
  
  function disableMouseWheelScroll(event) {
    // Prevent the default scrolling behavior
    event.preventDefault();
  }
  
  
  
  
  
  