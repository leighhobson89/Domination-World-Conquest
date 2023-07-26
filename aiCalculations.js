// Function to parse the JSON data
function parseJSON(jsonData) {
    try {
        const parsedData = JSON.parse(jsonData);
        // Do something with the parsed data
        return parsedData;
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
    }
}

// Function to fetch the JSON file and return a Promise that resolves to the parsed data
function fetchJSONFile(url) {
    return fetch(url)
        .then(response => response.text())
        .then(data => parseJSON(data));
}



export function readClosestPointsJSON(territory) {
    const uniqueId = territory.uniqueId;
    const jsonFileURL = './resources/closestPathsData.json';
    return fetchJSONFile(jsonFileURL)
        .then(data => {
            if (data.hasOwnProperty(uniqueId)) {
                return [uniqueId, data[uniqueId]];
            } else {
                console.error("Error: Territory ID not found in JSON data.");
                return null;
            }
        })
        .catch(error => {
            console.error("Error fetching and parsing JSON file:", error);
            return null;
        });
}
