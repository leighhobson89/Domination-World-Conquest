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
//
//   3. FIVE ADDITIONS WERE LISTED ON ONE SIDE ONLY, so five straits in the south
//      Pacific ran in one direction. "Fiji 1" was written where "Fiji 2" was meant
//      and back again, which left Fiji 1 attackable from both Vanuatu territories
//      while it could attack neither of them, and Fiji 2 able to attack Vanuatu 2
//      and two New Caledonias with no reply available to any of them.
//
//      A one-way strait is the one thing this map should never contain, and it has
//      no signature at all: nothing throws, both sides plan normally, and the only
//      witness is a border that is only ever crossed in one direction. The geometry
//      underneath is perfectly symmetric -- resources/adjacency.json carries zero
//      one-way edges across all 359 territories -- so every asymmetry on the map
//      came from these five lines. Both specs assert symmetry now: additions and
//      denials here, and the effective adjacency in tests/unit/adjacency.spec.js.
//
//      They were repaired by ADDING the missing reciprocal rather than by deleting
//      the crossing, because each of the five is 46-67 SVG units across, the same
//      band as the pairs beside them that were already symmetric (53-57) and as the
//      table's hand-added crossings generally (median 66).

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
    "Vanuatu 2": [
        ["Fiji 1", ADD],
        ["Fiji 2", ADD],
    ],
    "New Caledonia 2": [
        ["Fiji 1", ADD],
        ["Fiji 2", ADD],
    ],
    "New Caledonia 3": [
        ["Fiji 1", ADD],
        ["Fiji 2", ADD],
    ],
    "Fiji 1": [
        ["New Caledonia 3", ADD],
        ["New Caledonia 2", ADD],
        ["Vanuatu 1", ADD],
        ["Vanuatu 2", ADD],
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
    //THE SECOND ATLANTIC DOOR, and the reason it is here rather than in the geometry.
    //
    //Greenland <-> Iceland was the ONLY crossing between Europe and North America on the
    //whole map, and Greenland had exactly two neighbours in the entire game. That made
    //North America a cul-de-sac: whoever took it could reach South America freely through
    //Mexico and a third continent only by forcing one strait. Under CONTINENTAL, which
    //asks for three continents, that country could not win from where it started
    //(known-issue BO; the measurements are in docs/06-force-and-succession.md section 7).
    //
    //Svalbard is Norwegian and therefore European, so this is a Europe <-> North America
    //crossing. It is 122.7 SVG units across -- SHORTER than Brazil <-> Sierra Leone
    //(147.8), which this table has always carried, and comparable to Australia <-> New
    //Zealand (104.8) and Arctic Islands 1 <-> Svalbard (95.7) beside it. So it is inside
    //the standard the map already sets for an ocean crossing rather than a new one.
    Svalbard: [
        ["Arctic Islands 1", ADD],
        ["Greenland", ADD],
    ],
    Greenland: [["Svalbard", ADD]],
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
