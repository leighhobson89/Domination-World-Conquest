// Which countries are out of the game.
//
// THE DEFECT THIS CLOSES, in the words it was reported in: *"i took a territory of a country
// that only had 1, effectively defeating that country. however it still shows as being at war
// with me in diplomacy and in the tooltip."* The register in `src/state/diplomacy.js` is keyed
// by COUNTRY NAME and knows nothing about the map, so a relation outlives the country it
// describes -- and the panel and the tooltip both list every relation they are handed. The
// world therefore filled up with wars against countries that no longer exist, which is worse
// than clutter: it is the game telling a player they have an enemy they have already beaten.
//
// A COUNTRY IS DEFEATED WHEN IT HOLDS NO TERRITORY, and there is no fourth condition. That is
// the whole definition, and it is why this is DERIVED rather than stored:
//
//   IT CANNOT COME BACK. A country with no territory has nowhere to attack from and nothing
//        to be attacked, so defeat is permanent and a derived answer can never be stale in
//        the way a stored flag can be missed.
//   THERE IS NOWHERE TO WRITE IT. Conquest goes through `mutations.js` from at least eight
//        call sites; a register maintained by hand would need every one of them to remember,
//        and a list of eight hooks is one new attack route away from being wrong. That is
//        exactly the argument `activityRecorder.js` records for deriving a conquest from the
//        event rather than reporting it, and `continentBonus.js` for deriving the bonus
//        rather than writing it onto a territory.
//   IT NEEDS NO SAVE SLICE, so the snapshot version does not move and a save taken before
//        this existed restores a world this answers correctly on the first ask.
//
// IT IS MEMOISED AND THE CACHE IS DROPPED ON `TERRITORY_CHANGED`, the arrangement
// `continentBonus.js` has: the walk is over all 359 territories and the answer is wanted from
// a tooltip that rebuilds dozens of times a second while the pointer moves.
//
// THE BOOTSTRAP WINDOW IS SAFE BY CONSTRUCTION rather than by a guard. Both halves of the
// answer come from the same walk -- everybody who has ever held land, and everybody holding
// some now -- so an empty store yields an empty roster and an empty defeated set, which is
// the correct answer for a world that has not been seeded yet. A guard that tested for
// "territories ready" would be a second thing to keep in step.

import { Events, on } from "./events.js";
import { allTerritories } from "./selectors.js";

/** The last computed answer, or null when it has to be walked again. */
let cache = null;

/**
 * How many territories the last walk saw.
 *
 * CHECKED AS WELL AS THE EVENT, AND IT IS NOT BELT-AND-BRACES -- it is what covers the
 * bootstrap window, the same guard `continentBonus.js` carries and for the same reason:
 * `seedTerritories()` replaces the world without emitting anything, because it is not a
 * mutation, so an answer taken before the store was seeded is an answer over nothing and
 * would otherwise be cached for the rest of the game.
 */
let cachedCount = -1;

on(Events.TERRITORY_CHANGED, () => {
    cache = null;
});

/**
 * Everybody who has ever held land, and everybody holding some now.
 *
 * `originalOwner` is the roster and `dataName` is the present -- and BOTH are folded into the
 * roster, because a country can be created by nothing but conquest in this game only if it
 * already existed, but a scenario or a save can hand us a `dataName` that no territory names
 * as its original owner, and a country the roster did not know about would be reported
 * defeated the moment it was asked about.
 */
function walk() {
    const everyone = new Set();
    const holding = new Set();
    for (const territory of allTerritories()) {
        const owner = territory?.dataName;
        const original = territory?.originalOwner;
        if (owner) {
            everyone.add(owner);
            holding.add(owner);
        }
        if (original) {
            everyone.add(original);
        }
    }

    const defeated = new Set();
    for (const country of everyone) {
        if (!holding.has(country)) {
            defeated.add(country);
        }
    }
    return { defeated, surviving: holding };
}

function current() {
    const count = allTerritories().length;
    if (!cache || cachedCount !== count) {
        cache = walk();
        cachedCount = count;
    }
    return cache;
}

/**
 * Every country that once held land and holds none now.
 *
 * Returned as the live Set rather than a copy, because the commonest caller is a filter
 * running per relation row on a tooltip rebuild. Treat it as read-only; the cache is dropped
 * and rebuilt on the next territory change either way.
 */
export function defeatedCountries() {
    return current().defeated;
}

/** Is this country out of the game? The one question three surfaces ask. */
export function isDefeated(country) {
    return Boolean(country) && current().defeated.has(country);
}

/** How many countries are out. The standings tab says so. */
export function defeatedCount() {
    return current().defeated.size;
}

/** Every country still holding land. */
export function survivingCountries() {
    return current().surviving;
}

/**
 * Throw the cached walk away.
 *
 * `TERRITORY_CHANGED` covers every ordinary conquest and the territory count covers the
 * bootstrap. This is for the one case NEITHER covers: **a restore patches territories in
 * place and emits nothing**, so loading a save in which Spain is dead, over a running game in
 * which Spain is alive, changes no count and fires no event. `restoreState()` calls this.
 */
export function resetDefeatedCache() {
    cache = null;
    cachedCount = -1;
}
