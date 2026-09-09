// First contact: the live half of the rule that takes a pair of countries off
// NO_CONTACT.
//
// `src/rules/diplomacy/contact.js` is the pure walk and takes its world as an
// argument; this is the half that knows about the real adjacency graph and the
// real register, exactly the way `continentBonus.js` stands to `continents.js`.
//
// WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT. It only ever moves a pair OFF
// no contact, into `FIRST_CONTACT_STATE`. It never changes a pair that already has
// a record -- two countries whose border closes up again are still two countries
// that have met, and their peace treaty does not lapse because a third country got
// between them. Everything else in the diplomacy system (declaring, agreeing,
// expiring, breaking) is a decision somebody takes; this is the one transition the
// map makes on its own.
//
// WHY IT IS NOT RUN PER CONQUEST. A conquest is exactly how two countries come to
// share a border, so the answer does change during a turn -- but the walk is ~1,900
// pairings and a busy turn 1 logs fifty-one conquests. So `TERRITORY_CHANGED` marks
// it dirty and the walk happens at most once afterwards, at the next turn boundary
// or the next time somebody reads a relation, whichever comes first.
//
// WHILE `FIRST_CONTACT_STATE` IS `WAR` THIS CHANGES NO OUTCOME. The world is
// already in undeclared all-out war; recording that fact in the register makes it
// legible without making it different. That is the property that lets the register
// ship before any of the rules that read it.

import { getInteractableFrom, isAdjacencyLoaded } from "../data/adjacency.js";
import { newContactsAmong, touchingCountryPairs } from "../rules/diplomacy/contact.js";
import { FIRST_CONTACT_STATE, relationPair } from "./diplomacy.js";
import { Events, on } from "./events.js";
import { __store } from "./GameState.js";
import { setRelationState } from "./mutations.js";
import { allTerritories, currentTurn, getTerritoryByName, territoriesReady } from "./selectors.js";

let dirty = true;

on(Events.TERRITORY_CHANGED, () => {
    dirty = true;
});
on(Events.TURN_CHANGED, () => {
    dirty = true;
    //Eagerly at the turn boundary as well as lazily on read, so a country that
    //acquired a neighbour during the AI phase is in contact with it before anything
    //plans against it -- rather than at the moment somebody happens to hover.
    refreshDiplomaticContacts();
});
on(Events.DIPLOMACY_CHANGED, (payload) => {
    if (payload?.replaced) {
        dirty = true;
    }
});

/**
 * Every territory of another flag that this one can reach.
 *
 * `getInteractableFrom()` is the graph the game will actually let an army cross,
 * sea crossings included. It THROWS when its data file has not been loaded, which
 * is the case in Node and during the first moments of bootstrap, so every caller is
 * behind `isAdjacencyLoaded()`.
 */
function neighboursOf(territory) {
    return getInteractableFrom(territory.uniqueId, territory.territoryName);
}

/**
 * Record any pair of countries meeting for the first time.
 *
 * Safe to call as often as you like: it is a no-op unless something has changed,
 * and it writes only the pairs that have no record at all.
 *
 * @returns {string[]} the country names paired this time, as "A / B", for logging
 */
export function refreshDiplomaticContacts() {
    if (!dirty || !territoriesReady() || !isAdjacencyLoaded()) {
        return [];
    }
    dirty = false;

    const touching = touchingCountryPairs({
        territories: allTerritories(),
        neighboursOf,
        territoryByName: getTerritoryByName
    });
    const relations = __store().diplomacy.relations;
    const fresh = newContactsAmong(touching, (key) => relations.has(key));

    const made = [];
    for (const key of fresh) {
        const pair = relationPair(key);
        if (!pair) {
            continue;
        }
        //`via: "contact"` is what keeps the activity feed out of this: a busy turn 1 walks
        //something like 1,900 pairings, and "two countries can now see each other" is the
        //map's geometry rather than news. `activityRecorder.js` drops it on that annotation
        //and on the NO_CONTACT -> NEUTRAL transition both, because either alone would be a
        //single point of failure for the one write here that must never be reported.
        setRelationState(pair[0], pair[1], FIRST_CONTACT_STATE, {
            since: currentTurn(),
            via: "contact"
        });
        made.push(pair[0] + " / " + pair[1]);
    }
    return made;
}

/**
 * Bring the register up to date before reading it.
 *
 * Called by anything that asks the register a question the player will see -- the
 * territory tooltip does -- so a border that closed during the AI's turn is
 * reflected the first time somebody looks at it rather than only after the next
 * turn boundary.
 */
export function ensureDiplomaticContacts() {
    refreshDiplomaticContacts();
}

/** Test seam, and the hook for a new game: force the next call to do the walk. */
export function invalidateDiplomaticContacts() {
    dirty = true;
}
