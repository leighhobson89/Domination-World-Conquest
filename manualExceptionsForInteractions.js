const manualInteractionExceptions = new Map([
    //OCEANIA
    //Extreme East Islands
    [338, [333,334,336,337]],
    [333, [338]],
    [334, [338]],
    [336, [338]],
    [337, [338]],
    [333, [332]],
    [332, [333]],
    [335, [346, 350, 356]],
    [346, [335]],
    [350, [335]],

    //Solomon Islands with Papua New Guinea
    [330, [325,321]],
    [327, [325,321]],
    [325, [330,327]],
    [321, [327,330]],

    //New Zealand connections
    [355, [346,348,349]],
    [346, [355,356]],
    [348, [355,356]],
    [349, [355,356]],
    [356, [346,348,349, 335]],

    //Timor Leste with Australia
    [291, [346]],

    //ASIA
    //Russia with U.S. Arctic Island
    [93, [19]],
    [19, [93]],

    //Maldives with India/Sri Lanka
    [227, [66,246]],
    [246, [227]],
    [66, [227]],

    //China with Japan/S Korea
    [236, [240]],
    [238, [240]],
    [240, [236, 238]],

    //AFRICA
    //Djibouti with Yemen
    [197, [195]],
    [195, [197]],

    //Seychelles with Mozambique/Tanzania
    [225, [210,216]],
    [216, [225]],
    [210, [225]],
    [224, [230]],

    //Seychelles with Maldives
    [230, [224]],

    //Reunion with Madagascar
    [221, [223]],
    [223, [221]],

    //Lesotho with South Africa
    [219, [220]],
    [220, [219]],

    //EUROPE
    //NOT PERMITTED
    //Luxembourg with UK
    [0, [57]],
    [57, [0]],

    //PERMITTED
    //Italy with San Marino, Albania and Tunisia
    [8, [358]],
    [358, [8]],
    [8, [37]],
    [37, [8]],
    [8, [79]],
    [79, [8]],

    //Spain with Algeria
    [5, [67]],
    [67, [5]],

    //Morocco with Spain, Portugal and Gibraltar
    [78, [28,5,69]],
    [28, [78]],
    [5, [78]],
    [69, [78]],

    //Norway with UK
    [0, [63]],
    [63, [0]],

    //Sweden with Denmark
    [62, [48]],
    [48, [62]],

    //Norway Svalbard with Island Russian Island
    [96, [64]],
    [64, [96]],

    //Finland with Estonia
    [61, [51]],
    [51, [61]],

    //Iceland with UK Hebridean Islands and Ireland
    [3, [1,2]],
    [1, [3]],
    [2, [3]],

    //NORTH AMERICA
    //Bermuda with U.S. Mainland and Bahamas North Island
    [145, [24,12]],
    [24, [145]],
    [12, [145]],

    //SOUTH AMERICA
    //Brazil with Sierra Leone, Liberia and Guinea
    [27, [83,84,86]],
    [86, [27]],
    [84, [27]],
    [83, [27]]
]);

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



