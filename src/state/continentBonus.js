// The LIVE continent bonus: one walk of the real world per change, and the multiplier it
// produces for a territory.
//
// `src/state/continents.js` is the pure half -- it takes territories as an argument and
// imports nothing. This is the half that knows about the store, so that the pure half stays a
// function of its inputs and keeps running in Node. Everything that needs "what is this
// territory's bonus right now" reads THIS module: the income pass, the oil gate, the tooltip,
// the info panel and the upgrade preview.
//
// WHY IT IS MEMOISED. `continentControl()` is one pass over 359 territories. The income pass
// alone asks four times per territory, which without a cache is half a million comparisons a
// turn to answer a question whose answer changes only when a territory changes hands.
//
// WHY THE CACHE CANNOT GO STALE. It is dropped on `TERRITORY_CHANGED` and on `TURN_CHANGED`.
// Every conquest goes through `mutations.js` -- that is the invariant the activity feed
// already depends on, since it derives "X conquered by Y" from an ownership change rather
// than from eight call sites -- and a restored save emits `TURN_CHANGED` from
// `state/snapshot.js`. A STORED bonus is what this arrangement exists to avoid: writing the
// multiplier onto a territory would need an exact inverse write when the continent was lost,
// and a player would keep a bonus for a continent they no longer held, silently.

import { CONTINENT_BONUS_CAPACITY, CONTINENT_BONUS_GOLD } from "../config/balance.js";
import {
    continentControl,
    continentsHeldOutrightBy,
    holdsContinentOutright
} from "./continents.js";
import { Events, on } from "./events.js";
import { allTerritories } from "./selectors.js";

/** @type {Map<string, object> | null} */
let cached = null;
/** How many territories the cached walk covered. See `currentContinentControl()`. */
let cachedCount = 0;

on(Events.TERRITORY_CHANGED, () => {
    invalidateContinentControl();
});
on(Events.TURN_CHANGED, () => {
    invalidateContinentControl();
});

/**
 * Who holds what, right now. Rebuilt only when the world has changed since the last ask.
 *
 * @returns {Map<string, object>}
 */
export function currentContinentControl() {
    const territories = allTerritories();
    //The territory COUNT is checked as well as the events, and it is not belt-and-braces: it
    //is what covers the bootstrap window. `seedTerritories()` replaces the world without
    //emitting anything -- it is not a mutation -- so an answer taken before the store was
    //seeded is an answer over nothing, and it would otherwise be cached for the rest of the
    //game. The comparison is one number.
    if (cached === null || cachedCount !== territories.length) {
        cached = continentControl(territories);
        cachedCount = territories.length;
    }
    return cached;
}

/**
 * Drop the cache by hand.
 *
 * The two events above cover every ordinary path. This is for the ones that replace the world
 * without going through a mutation -- a new game seeding territories, and the unit tests.
 */
export function invalidateContinentControl() {
    cached = null;
    cachedCount = 0;
}

/** Does this country hold every territory on this continent? */
export function holdsWholeContinent(owner, continent) {
    return holdsContinentOutright(owner, continent, currentContinentControl());
}

/** Every continent this country holds whole, alphabetically. */
export function continentsHeldBy(owner) {
    return continentsHeldOutrightBy(owner, currentContinentControl());
}

/**
 * Is this territory sitting on a continent its OWNER holds whole?
 *
 * `dataName` is the current owner and is what changes on conquest; `originalOwner` is
 * historical and `territoryName` is the stable identity. Mixing them up is a recurring source
 * of bugs in this codebase, so the field is named once, here.
 */
export function territoryIsOnHeldContinent(territory) {
    if (!territory) {
        return false;
    }
    return holdsWholeContinent(territory.dataName, territory.continent ?? "Unknown");
}

/** The gold multiplier for a territory: `CONTINENT_BONUS_GOLD` or 1. */
export function continentGoldBonusFor(territory) {
    return territoryIsOnHeldContinent(territory) ? CONTINENT_BONUS_GOLD : 1;
}

/** The capacity multiplier for a territory: `CONTINENT_BONUS_CAPACITY` or 1. */
export function continentCapacityBonusFor(territory) {
    return territoryIsOnHeldContinent(territory) ? CONTINENT_BONUS_CAPACITY : 1;
}

/**
 * This territory's continent, as a row the UI can describe: who owns the territory, how much
 * of the continent they hold, and how big it is.
 *
 * The three screens that talk about the bonus -- the map tooltip, the info panel's territory
 * tooltip and the Summary tab -- all take their facts from here and their WORDS from
 * `src/ui/continents/continentBonusText.js`, so the split is: this module knows the world,
 * that one knows the sentence, and neither knows the other's job.
 *
 * @param {object} territory
 * @returns {{continent: string, owner: string, held: number, total: number}|null}
 */
export function continentHoldingFor(territory) {
    if (!territory) {
        return null;
    }
    const continent = territory.continent ?? "Unknown";
    const row = currentContinentControl().get(continent);
    if (!row) {
        return null;
    }
    return {
        continent,
        owner: territory.dataName,
        held: row.held.get(territory.dataName)?.count ?? 0,
        total: row.total
    };
}
