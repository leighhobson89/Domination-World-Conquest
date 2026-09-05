// The words the game uses for a continent bonus, in one place.
//
// A bonus nobody can see is a bonus nobody plays for, and this one has to be visible BEFORE
// it is fought for rather than after. Three screens say it -- the territory tooltip on the
// map, the tooltip on the info panel's territory rows, and the Summary tab's own line -- and
// they have to agree, because a player who reads two different numbers for the same rule
// stops believing either.
//
// Pure. It imports `config/balance.js` and nothing else, so the wording is pinned by
// `tests/unit/ui-continent-bonus-text.spec.js` in Node rather than by an e2e spec asserting
// prose. That is the same arrangement `src/ui/dominapedia/topics.js` and
// `src/ui/goals/goalCatalogue.js` have, and it exists for the same reason: the manual quoting
// a figure the code no longer uses is worse than no manual at all.

import { CONTINENT_BONUS_CAPACITY, CONTINENT_BONUS_GOLD } from "../../config/balance.js";

/**
 * A multiplier as the percentage a player thinks in: 1.5 -> "+50%".
 *
 * Rounded, because 1.25 is "+25%" and no dial in this game is worth a decimal place on a
 * tooltip. A multiplier of 1 or less answers "+0%" rather than a negative, since nothing here
 * is ever a penalty.
 */
export function bonusPercent(multiplier) {
    const value = Number.isFinite(multiplier) ? multiplier : 1;
    return "+" + Math.max(0, Math.round((value - 1) * 100)) + "%";
}

/** "+50% gold, +25% capacities" -- what a completed continent is worth, said once. */
export function bonusSummary(gold = CONTINENT_BONUS_GOLD, capacity = CONTINENT_BONUS_CAPACITY) {
    return bonusPercent(gold) + " gold, " + bonusPercent(capacity) + " capacities";
}

/**
 * One line about the continent a territory sits on, for a tooltip.
 *
 * It states the holding either way. "Europe: 31 of 52 held by France" is the sentence a
 * player reads while deciding where to attack, and it is the half that makes the other half
 * worth playing for -- a bonus that only announces itself once it has been earned tells
 * nobody what to aim at.
 *
 * @param {{continent?: string, owner?: string, held: number, total: number}} holding
 * @returns {string} empty when there is nothing to say
 */
export function describeContinentHolding(holding) {
    const continent = holding?.continent;
    const total = Number(holding?.total) || 0;
    if (!continent || total === 0) {
        return "";
    }

    const held = Number(holding.held) || 0;
    const owner = holding.owner;

    if (held === total) {
        return continent + ": held whole" + (owner ? " by " + owner : "") +
            " (" + bonusSummary() + ")";
    }
    return continent + ": " + held + " of " + total + " held" + (owner ? " by " + owner : "");
}

/**
 * The info panel's Summary line: which continents this country holds outright.
 *
 * "None" is stated rather than the line being hidden. A line that appears only once a
 * continent has been completed is a line nobody has ever seen, so it teaches nobody that the
 * bonus exists -- and the Summary tab is the one screen that already answers "how am I
 * doing".
 *
 * @param {string[]} continents  alphabetical, from `continentsHeldBy()`
 * @returns {string}
 */
export function describeContinentsHeld(continents) {
    const names = Array.isArray(continents) ? continents.filter(Boolean) : [];
    if (names.length === 0) {
        return "Continents held outright: none (" + bonusSummary() + " on each, held whole)";
    }
    return "Continents held outright: " + names.join(", ") + " (" + bonusSummary() + " on each)";
}
