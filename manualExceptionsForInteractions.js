let mainArray = [];
let manualInteractionExceptions;

function handleImportedModule(module) {
    const {
        mainGameArray
    } = module;
    mainArray = mainGameArray;
}

function importModuleWithTimeout() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            import('./resourceCalculations.js')
                .then(module => {
                    resolve(module);
                })
                .catch(error => {
                    reject(error);
                });
        }, 1000);
    });
}

importModuleWithTimeout()
    .then(module => {
        handleImportedModule(module);

        let id = {};

        for (let i = 0; i < mainArray.length; i++) {
        const territory = mainArray[i];
        id[territory.territoryName] = territory.uniqueId;
        }

        manualInteractionExceptions = new Map([
            [id['Fiji 2'], [[id['Vanuatu 2'], 1], [id['New Caledonia 2'], 1], [id['New Caledonia 3'], 1]]],
            [id['Vanuatu 1'], [[id['Fiji 1'], 1], [id['Solomon Islands 6'], 1]]],
            [id['Vanuatu 2'], [[id['Fiji 1'], 1]]],
            [id['New Caledonia 2'], [[id['Fiji 1'], 1]]],
            [id['New Caledonia 3'], [[id['Fiji 1'], 1]]],
            [id['Fiji 1'], [[id['New Caledonia 3'], 1], [id['New Caledonia 2'], 1]]],
            [id['Solomon Islands 6'], [[id['Vanuatu 1'], 1]]],
            [id['New Caledonia 1'], [[id['King Island'], 1], [id['Fraser Island'], 1], [id['New Zealand North Island'], 1]]],
            [id['King Island'], [[id['New Caledonia 1'], 1]]],
            [id['Fraser Island'], [[id['New Caledonia 1'], 1]]],
            [id['Solomon Islands 4'], [[id['Fergusson Island'], 1], [id['Papua New Guinea'], 1]]],
            [id['Solomon Islands 1'], [[id['Fergusson Island'], 1], [id['Papua New Guinea'], 1]]],
            [id['Fergusson Island'], [[id['Solomon Islands 4'], 1], [id['Solomon Islands 1'], 1]]],
            [id['Papua New Guinea'], [[id['Solomon Islands 1'], 1], [id['Solomon Islands 4'], 1]]],
            [id['New Zealand South Island'], [[id['Australia'], 1], [id['Flinders Island'], 1], [id['Tasmania'], 1]]],
            [id['Australia'], [[id['New Zealand South Island'], 1], [id['New Zealand North Island'], 1], [id['Timor Leste'], 1]]],
            [id['Flinders Island'], [[id['New Zealand South Island'], 1], [id['New Zealand North Island'], 1]]],
            [id['Tasmania'], [[id['New Zealand South Island'], 1], [id['New Zealand North Island'], 1]]],
            [id['New Zealand North Island'], [[id['Australia'], 1], [id['Flinders Island'], 1], [id['Tasmania'], 1], [id['New Caledonia 1'], 1]]],
            [id['New Caledonia 1'], [[id['New Zealand North Island'], 1]]],
            [id['Timor Leste'], [[id['Australia'], 1]]],
            [id['Russia'], [[id['Alaskan Islands 4'], 1]]],
            [id['Alaskan Islands 4'], [[id['Russia'], 1]]],
            [id['Maldives 2'], [[id['India'], 1], [id['Sri Lanka'], 1]]],
            [id['Sri Lanka'], [[id['Maldives 2'], 1]]],
            [id['India'], [[id['Maldives 2'], 1]]],
            [id['Japan'], [[id['China'], 1]]],
            [id['South Korea'], [[id['China'], 1]]],
            [id['China'], [[id['Japan'], 1], [id['South Korea'], 1]]],
            [id['Djibouti'], [[id['Yemen'], 1]]],
            [id['Yemen'], [[id['Djibouti'], 1]]],
            [id['Seychelles South Island'], [[id['Tanzania'], 1], [id['Mozambique'], 1]]],
            [id['Mozambique'], [[id['Seychelles South Island'], 1]]],
            [id['Tanzania'], [[id['Seychelles South Island'], 1]]],
            [id['Maldives 5'], [[id['Seychelles North Island'], 1]]],
            [id['Seychelles North Island'], [[id['Maldives 5'], 1]]],
            [id['Reunion'], [[id['Madagascar'], 1]]],
            [id['Madagascar'], [[id['Reunion'], 1]]],
            [id['United Kingdom'], [[id['Luxembourg'], 0], [id['Norway'], 1]]],
            [id['Luxembourg'], [[id['United Kingdom'], 0]]],
            [id['Italy'], [[id['Albania'], 1], [id['Tunisia'], 1]]],
            [id['Albania'], [[id['Italy'], 1]]],
            [id['Tunisia'], [[id['Italy'], 1]]],
            [id['Spain'], [[id['Algeria'], 1], [id['Morocco'], 1]]],
            [id['Algeria'], [[id['Spain'], 1]]],
            [id['Morocco'], [[id['Portugal'], 1], [id['Spain'], 1], [id['Gibraltar'], 1]]],
            [id['Portugal'], [[id['Morocco'], 1]]],
            [id['Gibraltar'], [[id['Morocco'], 1]]],
            [id['Norway'], [[id['United Kingdom'], 1]]],
            [id['Sweden'], [[id['Denmark'], 1]]],
            [id['Denmark'], [[id['Sweden'], 1]]],
            [id['Arctic Islands 1'], [[id['Svalbard'], 1]]],
            [id['Svalbard'], [[id['Arctic Islands 1'], 1]]],
            [id['Finland'], [[id['Estonia'], 1]]],
            [id['Estonia'], [[id['Finland'], 1]]],
            [id['Iceland'], [[id['Hebridean Islands'], 1], [id['Ireland'], 1]]],
            [id['Hebridean Islands'], [[id['Iceland'], 1]]],
            [id['Ireland'], [[id['Iceland'], 1]]],
            [id['Bermuda'], [[id['Grand Bahama (Bahamas)'], 1], [id['United States'], 1]]],
            [id['Grand Bahama (Bahamas)'], [[id['Bermuda'], 1], [id['United States'], 1]]],
            [id['United States'], [[id['Bermuda'], 1], [id['Grand Bahama (Bahamas)'], 1]]],
            [id['Brazil'], [[id['Guinea'], 1], [id['Sierra Leone'], 1], [id['Liberia'], 1]]],
            [id['Liberia'], [[id['Brazil'], 1]]],
            [id['Sierra Leone'], [[id['Brazil'], 1]]],
            [id['Guinea'], [[id['Brazil'], 1]]]
        ]);
        
    })
    .catch(error => {
        console.log(error);
    });

    export function findMatchingCountries(pathObj, value) {
        const matchingCountries = [];
    
        for (const [uniqueId, countries] of manualInteractionExceptions) {
            if (uniqueId.toString() === pathObj.getAttribute("uniqueid")) {
                const svgMap = document.getElementById("svg-map").contentDocument;
                const paths = svgMap.getElementsByTagName("path");
    
                const matchingIds = countries.map(([id, flag]) => [id.toString(), flag]);
    
                for (const path of paths) {
                    const pathId = path.getAttribute("uniqueid");
                    const matchingData = matchingIds.find(([id]) => id === pathId);
                    if (matchingData && matchingData[1] === value) {
                        matchingCountries.push(path);
                    }
                }
                break;
            }
        }
        return matchingCountries;
    }
    
    