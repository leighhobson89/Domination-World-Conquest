// Ask the store about the territory a path draws.
//
// Most of the legacy UI holds SVG path elements rather than territory objects -- the
// click handlers, the colouring passes, the destination lists. Before Phase 4 those
// call sites read game state straight off the element:
//
//     if (path.getAttribute("owner") === "Player") { ... }
//     if (path.getAttribute("underSiege") === "false") { ... }
//
// which made the DOM the source of truth for ownership, deactivation and sieges.
// These helpers take the same path and answer the same question from `GameState`,
// so the call sites can be converted one at a time without first being rewritten to
// carry territory objects around. Phase 6.7 removes the need for them entirely, when
// `MapView` renders from state and the UI stops holding path elements.
//
// `uniqueid` and `territory-name` are still read from the element. They are the
// path's identity, not its state: they come from `resources/svgMaster.svg`, which is
// authoritative for territory names, and nothing in the game ever changes them.
//
// --- the bootstrap window -------------------------------------------------------
//
// There is one interval in which the SVG really is the truth, and it matters: between
// `svgMapLoaded()` (window `load`, which is what populates `paths`) and
// `seedTerritories()` (the end of the initial-data Promise). During that window the
// store has no territories at all, and the SVG attributes are what the model is about
// to be BUILT FROM.
//
// Code runs in that window. `colorCountriesRandomly()` is the clearest case: it walks
// every path, groups them by `data-name`, and gives each country one colour. Answering
// it with the empty store returned null for all 359 paths, they all grouped together,
// and the entire map came out one flat colour -- with every territory's `countryColor`
// wrong for the rest of the game. The same trap caught the `owner` read inside
// `assignArmyAndResourcesToPaths()`, which is the seeding pass itself.
//
// So these read the attribute while the model does not exist, and the store once it
// does. The fallback is bounded by `territoriesReady()` rather than by "the lookup
// returned null", deliberately: after seeding, a path with no territory behind it is a
// bug worth surfacing, not a reason to quietly read a stale attribute.

import {
    territoriesReady,
    countryOf,
    getTerritory,
    isAttackable,
    isCountryGreyedOut,
    isDeactivated,
    isUnderSiege,
    ownerOf
} from "./selectors.js";

/** Is the territory model built? Before it is, the SVG is the seed and the truth. */
function modelReady() {
    return territoriesReady();
}

function attribute(path, name) {
    return path?.getAttribute?.(name) ?? null;
}

/** The uniqueId a path carries, as a string, or null for the background rect. */
export function pathUniqueId(path) {
    return attribute(path, "uniqueid");
}

/** The territory a path draws, or null. */
export function territoryForPath(path) {
    return getTerritory(pathUniqueId(path));
}

/** Replaces `path.getAttribute("owner")`: "Player", or the owning country. */
export function pathOwner(path) {
    if (!modelReady()) {
        return attribute(path, "owner");
    }
    return ownerOf(pathUniqueId(path));
}

/** Replaces `path.getAttribute("owner") === "Player"`. */
export function pathIsPlayerOwned(path) {
    return pathOwner(path) === "Player";
}

/** Replaces `path.getAttribute("data-name")`: the current owning country. */
export function pathCountry(path) {
    if (!modelReady()) {
        return attribute(path, "data-name");
    }
    return countryOf(pathUniqueId(path));
}

/** Replaces `path.getAttribute("deactivated") === "true"`. */
export function pathIsDeactivated(path) {
    if (!modelReady()) {
        return attribute(path, "deactivated") === "true";
    }
    return isDeactivated(pathUniqueId(path));
}

/** Replaces `path.getAttribute("underSiege") === "true"`. */
export function pathIsUnderSiege(path) {
    if (!modelReady()) {
        return attribute(path, "underSiege") === "true";
    }
    const territory = territoryForPath(path);
    return territory ? isUnderSiege(territory.territoryName) : false;
}

/** Replaces `path.getAttribute("greyedOut") === "true"`. */
export function pathIsGreyedOut(path) {
    if (!modelReady()) {
        return attribute(path, "greyedOut") === "true";
    }
    return isCountryGreyedOut(pathCountry(path));
}

/** Replaces `path.getAttribute("attackableTerritory") === "true"`. */
export function pathIsAttackable(path) {
    if (!modelReady()) {
        return attribute(path, "attackableTerritory") === "true";
    }
    return isAttackable(pathUniqueId(path));
}

/** Do two paths currently belong to the same country? */
export function pathsShareCountry(a, b) {
    const country = pathCountry(a);
    return country !== null && country === pathCountry(b);
}
