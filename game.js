let turn = 0;
let arrayOfArmyProportions;

const turnLabel = document.getElementById('turn-label');
turnLabel.textContent += turn;
if (!pageLoaded) {
    Promise.all([listenForPageLoad(), connectAndCreateArmyArray()])
        .then(([pathAreas, armyArray]) => {
            console.log(arrayOfArmyProportions);
        })
        .catch(error => {
            console.log(error);
        });
}

function listenForPageLoad() {
    return new Promise((resolve, reject) => {
        let intervalId = setInterval(function() {
            if (pageLoaded === true) {
                console.log(pageLoaded);

                var svgFile = document.getElementById('svg-map').contentDocument;
                var pathAreas = calculatePathAreas(svgFile);

                clearInterval(intervalId);

                resolve(pathAreas);
            }
        }, 1000); // check every 1 second
    });
}


function calculatePathAreas(svgFile) {
    // Get all the path elements from the SVG file
    var paths = svgFile.querySelectorAll('path');

    // Calculate the total length of all paths
    var totalLength = 0;
    for (var i = 0; i < paths.length; i++) {
        totalLength += paths[i].getTotalLength();
    }

    // Calculate the area of each path and store it in an array
    var pathAreas = [];
    for (var i = 0; i < paths.length; i++) {
        var path = paths[i];
        var pathLength = path.getTotalLength();
        var numPoints = 100; // Change this to increase or decrease the number of points
        var points = [];
        for (var j = 0; j < numPoints; j++) {
            var point = path.getPointAtLength(j / numPoints * pathLength);
            points.push({ x: point.x, y: point.y });
        }
        var area = 0;
        for (var j = 0; j < points.length; j++) {
            var k = (j + 1) % points.length;
            area += points[j].x * points[k].y - points[j].y * points[k].x;
        }
        area = Math.abs(area / 2);
        var pathArea = area * (136067649 / totalLength);
        var dataName = path.getAttribute('data-name');
        var territoryId = path.getAttribute('territory-id');
        pathAreas.push({ dataName: dataName, territoryId: territoryId, area: pathArea });
    }

    // Return the array of path areas
    return pathAreas;
}

function assignArmyToPaths(pathAreas, armyArray) {
    // Create a new array to store the updated path data
    const updatedPathAreas = [];

    // Loop through each element in pathAreas array
    for (var i = 0; i < pathAreas.length; i++) {
        var dataName = pathAreas[i].dataName;
        var territoryId = pathAreas[i].territoryId;
        var area = pathAreas[i].area;

        // Find matching country in armyArray
        var matchingCountry = armyArray.find(function(country) {
            return country.countryName === dataName;
        });

        if (matchingCountry) {
            var totalArmyForCountry = matchingCountry.totalArmyForCountry;
            var percentOfWholeArea = 0;

            // Calculate percentOfWholeArea based on number of paths per dataName
            var numPaths = pathAreas.filter(function(path) {
                return path.dataName === dataName;
            }).length;

            if (numPaths === 1) {
                percentOfWholeArea = 100;
            } else {
                var pathsForDataName = pathAreas.filter(function(path) {
                    return path.dataName === dataName;
                });
                var areaSum = pathsForDataName.reduce(function(acc, path) {
                    return acc + path.area;
                }, 0);
                var areaForTerritoryId = pathsForDataName.find(function(path) {
                    return path.territoryId === territoryId;
                }).area;
                percentOfWholeArea = areaForTerritoryId / areaSum;
            }

            // Calculate new army value for current element
            var armyForCurrentTerritory = totalArmyForCountry * percentOfWholeArea;

            // Add updated path data to the new array
            updatedPathAreas.push({
                dataName: dataName,
                territoryId: territoryId,
                area: area,
                armyForCurrentTerritory: armyForCurrentTerritory,
            });
        }
    }
    return updatedPathAreas;
}


function connectAndCreateArmyArray() {
    return listenForPageLoad().then(pathAreas => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "http://localhost:8000/getCountryDataForArmyCalculation.php", true);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.onreadystatechange = function () {
                if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
                    // Parse the response JSON data
                    const data = JSON.parse(xhr.responseText);

                    const armyArray = [];
                    for (let i = 0; i < data.length; i++) {
                        armyArray.push({
                            countryName: data[i].country,
                            totalArmyForCountry: data[i].startingArmy
                        });
                    }
                    arrayOfArmyProportions = assignArmyToPaths(pathAreas, armyArray);
                    resolve(arrayOfArmyProportions);
                }
            };
            xhr.send();
        });
    });
}









