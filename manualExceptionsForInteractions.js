let mainArray = [];

function handleImportedModule(module) {
    const {
        mainArrayOfTerritoriesAndResources
    } = module;
    mainArray = mainArrayOfTerritoriesAndResources;
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
        let territoryOrder = [];

        for (let i = 0; i < mainArray.length; i++) {
        const territory = mainArray[i];
        id[territory.territoryName] = territory.uniqueId;
        territoryOrder.push(territory.territoryName);
        }

        // Accessing territories in the order they were added
        for (let j = 0; j < territoryOrder.length; j++) {
        const territoryName = territoryOrder[j];
        const uniqueId = id[territoryName];
        console.log(territoryName, uniqueId);
        }


        const manualInteractionExceptions = new Map([
            //OCEANIA
            //Extreme East Islands
            [id['Fiji 2'], [id['Vanuatu 2'], id['Vanuatu 2'], id['New Caledonia 2'], id['New Caledonia 3']]],
            [id['Vanuatu 1'], [id['Fiji 1']]],
            [id['Vanuatu 2'], [id['Fiji 1']]],
            [id['New Caledonia 2'], [id['Fiji 1']]],
            [id['New Caledonia 3'], [id['Fiji 1']]],
            [id['Vanuatu 1'], [id['Solomon Islands 6']]],
            [id['Solomon Islands 6'], [id['Vanuatu 1']]],
            [id['New Caledonia 1'], [id['King Island'], id['Fraser Island'], id['New Zealand North Island']]],
            [id['King Island'], id['New Caledonia 1']],
            [id['Fraser Island'], id['New Caledonia 1']],
        
            //Solomon Islands with Papua New Guinea
            [id['Solomon Islands 4'], [id['Fergusson Island'], id['Papua New Guinea']]],
            [id['Solomon Islands 1'], [id['Fergusson Island'], id['Papua New Guinea']]],
            [id['Fergusson Island'], [id['Solomon Islands 4'], id['Solomon Islands 1']]],
            [id['Papua New Guinea'], [id['Solomon Islands 1'], id['Solomon Islands 4']]],
        
            //New Zealand connections
            [id['New Zealand South Island'], [id['Australia'], id['Flinders Island'], id['Tasmania']]],
            [id['Australia'], [id['New Zealand South Island'], id['New Zealand North Island']]],
            [id['Flinders Island'], [id['New Zealand South Island'], id['New Zealand North Island']]],
            [id['Tasmania'], [id['New Zealand South Island'], id['New Zealand North Island']]],
            [id['New Zealand North Island'], [id['Australia'], id['Flinders Island'], id['Tasmania'], id['New Caledonia 1']]],
            [id['New Caledonia 1'], [id['New Zealand North Island']]],
        
            //Timor Leste with Australia
            [id['Timor Leste'], [id['Australia']]],
            [id['Australia'], [id['Timor Leste']]],
        
            //ASIA
            //Russia with U.S. Arctic Island
            [id['Russia'], [id['Alaskan Islands 4']]],
            [id['Alaskan Islands 4'], [id['Russia']]],
        
            //Maldives with India/Sri Lanka
            [id['Maldives 2'], [id['India'], id['Sri Lanka']]],
            [id['Sri Lanka'], [id['Maldives 2']]],
            [id['India'], [id['Maldives 2']]],
        
            //China with Japan/S Korea
            [id['Japan'], [id['China']]],
            [id['South Korea'], [id['China']]],
            [id['China'], [id['Japan'], id['South Korea']]],
        
            //AFRICA
            //Djibouti with Yemen
            [id['Djibouti'], [id['Yemen']]],
            [id['Yemen'], [id['Djibouti']]],
        
            //Seychelles with Mozambique/Tanzania
            [id['Seychelles South Island'], [id['Tanzania'], id['Mozambique']]],
            [id['Mozambique'], [id['Seychelles South Island']]],
            [id['Tanzania'], [id['Seychelles South Island']]],
        
            //Seychelles with Maldives
            [id['Maldives 5'], [id['Seychelles North Island']]],
            [id['Seychelles North Island'], [id['Maldives 5']]],

            //Reunion with Madagascar
            [id['Reunion'], [id['Madagascar']]],
            [id['Madagascar'], [id['Reunion']]],
        
            //EUROPE
            //NOT PERMITTED
            //Luxembourg with UK
            [id['United Kingdom'], [id['Luxembourg']]],
            [id['Luxembourg'], [id['United Kingdom']]],
        
            //PERMITTED
            //Italy with San Marino, Albania and Tunisia
            [id['Italy'], [id['Albania']]],
            [id['Albania'], [id['Italy']]],
            [id['Italy'], [id['Tunisia']]],
            [id['Tunisia'], [id['Italy']]],
        
            //Spain with Algeria
            [id['Spain'], [id['Algeria']]],
            [id['Algeria'], [id['Spain']]],
        
            //Morocco with Spain, Portugal and Gibraltar
            [id['Morocco'], [id['Portugal'], id['Spain'], id['Gibraltar']]],
            [id['Portugal'], [id['Morocco']]],
            [id['Spain'], [id['Morocco']]],
            [id['Gibraltar'], [id['Morocco']]],
        
            //Norway with UK
            [id['United Kingdom'], [id['Norway']]],
            [id['Norway'], [id['United Kingdom']]],
        
            //Sweden with Denmark
            [id['Sweden'], [id['Denmark']]],
            [id['Denmark'], [id['Sweden']]],
        
            //Norway Svalbard with Island Russian Island
            [id['Arctic Islands 1'], [id['Svalbard']]],
            [id['Svalbard'], [id['Arctic Islands 1']]],
        
            //Finland with Estonia
            [id['Finland'], [id['Estonia']]],
            [id['Estonia'], [id['Finland']]],
        
            //Iceland with UK Hebridean Islands and Ireland
            [id['Iceland'], [id['Hebridean Islands'], id['Ireland']]],
            [id['Hebridean Islands'], [id['Iceland']]],
            [id['Ireland'], [id['Iceland']]],
        
            //NORTH AMERICA
            //Bermuda with U.S. Mainland and Bahamas North Island
            [id['Bermuda'], [id['Grand Bahama (Bahamas)'], id['United States']]],
            [id['Grand Bahama (Bahamas)'], [id['Bermuda']]],
            [id['United States'], [id['Bermuda']]],
        
            //SOUTH AMERICA
            //Brazil with Sierra Leone, Liberia and Guinea
            [id['Brazil'], [id['Guinea'], id['Sierra Leone'], id['Liberia']]],
            [id['Liberia'], [id['Brazil']]],
            [id['Sierra Leone'], [id['Brazil']]],
            [id['Guinea'], [id['Brazil']]]
        ]);
    })
    .catch(error => {
        console.log(error);
    });

export function findMatchingCountries(pathObj) {
    const matchingCountries = [];

    for (const [uniqueId, countries] of manualInteractionExceptions) {
        if (uniqueId.toString() === pathObj.getAttribute("uniqueid")) {
            const svgMap = document.getElementById("svg-map").contentDocument;
            const paths = svgMap.getElementsByTagName("path");

            const matchingPaths = [];
            const matchingIds = countries.map(id => id.toString());

            for (const path of paths) {
                const pathId = path.getAttribute("uniqueid");
                if (matchingIds.includes(pathId)) {
                    matchingCountries.push(path);
                }
            }
            break;
        }
    }
    return matchingCountries;
}