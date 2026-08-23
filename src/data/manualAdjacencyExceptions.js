// Hand-curated corrections to the geometric territory adjacency.
//
// The adjacency in resources/adjacency.json is derived from the SVG geometry, so
// it gets islands and narrow straits wrong in both directions: it misses crossings
// that should be possible (Fiji to Vanuatu) and invents ones that should not be
// (the United Kingdom to Luxembourg). This table patches both cases by hand.
//
// Keyed by territory NAME, and importing nothing.
//
// The previous version of this table lived in manualExceptionsForInteractions.js,
// keyed by uniqueId, and was built inside a `setTimeout(..., 1000)` before a
// dynamic import of resourceCalculations.js. If the territory model was not ready
// within that second, every `id[...]` lookup returned undefined and the entire
// Map collapsed into a single `undefined` key -- silently disabling every island
// rule below. See docs/01-codebase-audit.md section 3.1.
//
// Two defects were fixed while porting; both are covered by tests:
//
//   1. "Grand Bahama (Bahamas)" is not a territory name. The territory is
//      "Grand Bahama (Bahamas)". The legacy lookup produced `undefined`, so the
//      Bermuda <-> Grand Bahama <-> United States links never existed.
//
//   2. "New Caledonia 1" was present twice as a Map key. The second entry
//      overwrote the first, losing its King Island and Fraser Island links.
//      The two entries are merged here.

/** This territory can reach that one, even though the geometry says otherwise. */
export const ADD = 1;

/** This territory must NOT reach that one, even though the geometry says it can. */
export const DENY = 0;

/** @type {Record<string, Array<[string, typeof ADD | typeof DENY]>>} */
export const manualAdjacencyExceptions = {
    "Fiji 2": [
        ["Vanuatu 2", ADD],
        ["New Caledonia 2", ADD],
        ["New Caledonia 3", ADD],
    ],
    "Vanuatu 1": [
        ["Fiji 1", ADD],
        ["Solomon Islands 6", ADD],
    ],
    "Vanuatu 2": [["Fiji 1", ADD]],
    "New Caledonia 2": [["Fiji 1", ADD]],
    "New Caledonia 3": [["Fiji 1", ADD]],
    "Fiji 1": [
        ["New Caledonia 3", ADD],
        ["New Caledonia 2", ADD],
    ],
    "Solomon Islands 6": [["Vanuatu 1", ADD]],
    "New Caledonia 1": [
        ["King Island", ADD],
        ["Fraser Island", ADD],
        ["New Zealand North Island", ADD],
    ],
    "King Island": [["New Caledonia 1", ADD]],
    "Fraser Island": [["New Caledonia 1", ADD]],
    "Solomon Islands 4": [
        ["Fergusson Island", ADD],
        ["Papua New Guinea", ADD],
    ],
    "Solomon Islands 1": [
        ["Fergusson Island", ADD],
        ["Papua New Guinea", ADD],
    ],
    "Fergusson Island": [
        ["Solomon Islands 4", ADD],
        ["Solomon Islands 1", ADD],
    ],
    "Papua New Guinea": [
        ["Solomon Islands 1", ADD],
        ["Solomon Islands 4", ADD],
    ],
    "New Zealand South Island": [
        ["Australia", ADD],
        ["Flinders Island", ADD],
        ["Tasmania", ADD],
    ],
    Australia: [
        ["New Zealand South Island", ADD],
        ["New Zealand North Island", ADD],
        ["Timor Leste", ADD],
    ],
    "Flinders Island": [
        ["New Zealand South Island", ADD],
        ["New Zealand North Island", ADD],
    ],
    Tasmania: [
        ["New Zealand South Island", ADD],
        ["New Zealand North Island", ADD],
    ],
    "New Zealand North Island": [
        ["Australia", ADD],
        ["Flinders Island", ADD],
        ["Tasmania", ADD],
        ["New Caledonia 1", ADD],
    ],
    "Timor Leste": [["Australia", ADD]],
    Russia: [["Alaskan Islands 4", ADD]],
    "Alaskan Islands 4": [["Russia", ADD]],
    "Maldives 2": [
        ["India", ADD],
        ["Sri Lanka", ADD],
    ],
    "Sri Lanka": [["Maldives 2", ADD]],
    India: [["Maldives 2", ADD]],
    Japan: [["China", ADD]],
    "South Korea": [["China", ADD]],
    China: [
        ["Japan", ADD],
        ["South Korea", ADD],
    ],
    Laos: [["Hainan Island", DENY]],
    "Hainan Island": [["Laos", DENY]],
    Djibouti: [["Yemen", ADD]],
    Yemen: [["Djibouti", ADD]],
    "Seychelles South Island": [
        ["Tanzania", ADD],
        ["Mozambique", ADD],
    ],
    Mozambique: [["Seychelles South Island", ADD]],
    Tanzania: [["Seychelles South Island", ADD]],
    "Maldives 5": [["Seychelles North Island", ADD]],
    "Seychelles North Island": [["Maldives 5", ADD]],
    Reunion: [["Madagascar", ADD]],
    Madagascar: [["Reunion", ADD]],
    "United Kingdom": [
        ["Luxembourg", DENY],
        ["Norway", ADD],
    ],
    Luxembourg: [["United Kingdom", DENY]],
    Italy: [
        ["Albania", ADD],
        ["Tunisia", ADD],
    ],
    Albania: [["Italy", ADD]],
    Tunisia: [["Italy", ADD]],
    Spain: [
        ["Algeria", ADD],
        ["Morocco", ADD],
    ],
    Algeria: [["Spain", ADD]],
    Morocco: [
        ["Portugal", ADD],
        ["Spain", ADD],
        ["Gibraltar", ADD],
    ],
    Portugal: [["Morocco", ADD]],
    Gibraltar: [["Morocco", ADD]],
    Andorra: [["Balearic Islands", DENY]],
    "Balearic Islands": [["Andorra", DENY]],
    Norway: [["United Kingdom", ADD]],
    Sweden: [["Denmark", ADD]],
    Denmark: [["Sweden", ADD]],
    "Arctic Islands 1": [["Svalbard", ADD]],
    Svalbard: [["Arctic Islands 1", ADD]],
    Finland: [["Estonia", ADD]],
    Estonia: [["Finland", ADD]],
    Iceland: [
        ["Hebridean Islands", ADD],
        ["Ireland", ADD],
    ],
    "Hebridean Islands": [["Iceland", ADD]],
    Ireland: [["Iceland", ADD]],
    Bermuda: [
        ["Grand Bahama (Bahamas)", ADD],
        ["United States", ADD],
    ],
    "Grand Bahama (Bahamas)": [
        ["Bermuda", ADD],
        ["United States", ADD],
    ],
    "United States": [
        ["Bermuda", ADD],
        ["Grand Bahama (Bahamas)", ADD],
    ],
    Brazil: [
        ["Guinea", ADD],
        ["Sierra Leone", ADD],
        ["Liberia", ADD],
    ],
    Liberia: [["Brazil", ADD]],
    "Sierra Leone": [["Brazil", ADD]],
    Guinea: [["Brazil", ADD]],
};

function targetsWithFlag(territoryName, flag) {
    const rules = manualAdjacencyExceptions[territoryName];
    if (!rules) {
        return [];
    }
    return rules.filter(([, ruleFlag]) => ruleFlag === flag).map(([target]) => target);
}

/** Territories reachable from `territoryName` that the geometry does not provide. */
export function getManualAdditions(territoryName) {
    return targetsWithFlag(territoryName, ADD);
}

/** Territories that must be removed from `territoryName`'s geometric neighbours. */
export function getManualDenials(territoryName) {
    return targetsWithFlag(territoryName, DENY);
}
