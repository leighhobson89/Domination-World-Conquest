// Which countries are in a position to have a relationship at all.
//
// NO_CONTACT is defined by the world rather than by agreement: two countries are at
// no contact when no territory of one touches a territory of the other, and never
// has. So it is the one state the players do not choose -- it is left, exactly
// once, on the turn their borders first meet, and never returned to.
//
// This is the pure half. It takes the territories and a neighbour lookup as
// arguments and imports only the pair-key rule, which imports nothing at all, so it
// runs in Node and is unit-tested there. The live half -- asking the real adjacency
// graph and writing the register -- is `src/state/diplomacyContacts.js`, and the
// split is the one `continents.js` / `continentBonus.js` already use.
//
// THE LOOKUP IS INJECTED BECAUSE `src/data/adjacency.js` THROWS IN NODE. It refuses
// to answer before its data file has been fetched, which never happens in a unit
// test, so every rule that needs the neighbour graph takes it as a parameter. See
// the note in CLAUDE.md about `isAdjacencyLoaded()`.
//
// CONTACT IS THE CURRENT OWNER's, NOT THE ORIGINAL OWNER's. `dataName` is who holds
// a territory now and is what changes on conquest; `originalOwner` is historical and
// `territoryName` is the stable identity. Mixing them up is a recurring source of
// bugs here, so the field is named once, below. A conquest is precisely how two
// countries on opposite sides of the world come to share a border, which is why this
// is re-derived rather than computed once at the start of a game.

import { relationKey } from "../../state/diplomacy.js";

/**
 * Every pair of countries whose territories touch right now.
 *
 * @param {object} input
 * @param {object[]} input.territories             every territory in the world
 * @param {(territory: object) => string[]} input.neighboursOf  neighbouring
 *        territory NAMES, from the graph the game will actually let an army cross
 *        (sea crossings included) -- the same question the AI's threat array asks.
 * @param {(name: string) => object|null} input.territoryByName
 * @returns {Set<string>} canonical relation keys
 */
export function touchingCountryPairs({ territories, neighboursOf, territoryByName }) {
    const pairs = new Set();
    for (const territory of territories ?? []) {
        const country = territory?.dataName;
        if (!country) {
            continue;
        }
        for (const name of neighboursOf(territory) ?? []) {
            const neighbour = territoryByName(name);
            const other = neighbour?.dataName;
            if (!other || other === country) {
                continue;
            }
            //`relationKey` sorts the two names, so a border walked from both ends
            //adds one entry rather than two, and the Set does the de-duplicating
            //for the ~1,900 adjacent pairs on this map.
            const key = relationKey(country, other);
            if (key) {
                pairs.add(key);
            }
        }
    }
    return pairs;
}

/**
 * Which of those pairs the register has never seen.
 *
 * The register is sparse and a record is the permanent proof that two countries
 * have met, so "has no record" and "is at no contact" are the same question, and
 * this is what turns a walk of the world into the short list of things to write.
 *
 * @param {Set<string>} touching        from `touchingCountryPairs()`
 * @param {(key: string) => boolean} hasRecord
 * @returns {string[]} keys of pairs meeting for the first time
 */
export function newContactsAmong(touching, hasRecord) {
    const fresh = [];
    for (const key of touching) {
        if (!hasRecord(key)) {
            fresh.push(key);
        }
    }
    return fresh;
}
