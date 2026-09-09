// Which agreements have run out, and what they fall back to.
//
// A CEASEFIRE IS THE ONLY AGREEMENT WITH A CLOCK ON IT. A peace has no end date and an
// alliance has none either -- both are left by somebody deciding to leave them, which is a
// breach and costs. A ceasefire is the one that ends by its own terms, on the turn it named
// when it was signed, and nobody has to do anything.
//
// THE FALLBACK IS READ OFF THE RECORD AND NOT GUESSED HERE, which is the answer to Q2 in the
// diplomacy design. A ceasefire agreed during a war and allowed to lapse plainly goes back to
// WAR -- that is what a ceasefire IS -- but with NEUTRAL as the first-contact state, "back to
// war" and "back to neutral" are genuinely different outcomes, and the register keeps no
// history a rule could reconstruct the right one from. So `relationRecord()` stores
// `revertsTo` at the moment of signing and this only has to read it.
//
// The fallback when a record does not say is NEUTRAL, and that is deliberate rather than a
// tidy default: a save taken before ceasefires could be agreed restores rows with no
// `revertsTo`, and putting two countries into a WAR neither of them declared -- on the
// strength of a field that was absent -- is the worse of the two mistakes. Neutral is the
// state the world starts every relationship in, and either side may declare out of it in one
// click.
//
// Pure. It imports the enum, which imports nothing, so it runs in Node and is unit-tested
// there. `src/state/diplomacyExpiry.js` is the live half -- the same split
// `contact.js` / `diplomacyContacts.js` already has, and for the same reason.

import { DiplomaticState } from "../../state/diplomacy.js";

/**
 * Every relation whose agreement has run out by this turn.
 *
 * @param {Array<{a: string, b: string, state: string, until: number|null,
 *                revertsTo: string|null}>} rows  from `allRelations()`
 * @param {number} turn  the turn it is now
 * @returns {Array<{a: string, b: string, from: string, to: string}>} what to write
 */
export function expiredRelations(rows, turn) {
    const now = Number(turn);
    if (!Number.isFinite(now)) {
        return [];
    }
    const expired = [];
    for (const row of rows ?? []) {
        if (!hasLapsed(row, now)) {
            continue;
        }
        expired.push({
            a: row.a,
            b: row.b,
            from: row.state,
            to: fallbackFor(row)
        });
    }
    return expired;
}

/**
 * Has this one run out?
 *
 * The comparison is `turn >= until`, not `>`, because `until` is the turn the ceasefire runs
 * OUT on rather than the last turn it covers -- a ceasefire signed on turn 10 for fifteen
 * turns carries `until: 25` and turn 25 is the first turn the two may fight again. The panel
 * says "Runs out turn 25" from the same field, so the two agree by construction.
 */
function hasLapsed(row, now) {
    if (row?.state !== DiplomaticState.CEASEFIRE) {
        return false;
    }
    //THE NULL CHECK IS EXPLICIT AND HAS TO BE. `Number(null)` is 0 and `Number.isFinite(0)`
    //is true, so the obvious guard reports a ceasefire that never named an end date as
    //having run out on turn zero -- which expires it the first time anybody looks. This
    //codebase has now been caught by that same conversion three times in this phase alone.
    if (row.until === null || row.until === undefined || row.until === "") {
        return false;
    }
    const until = Number(row.until);
    return Number.isFinite(until) && now >= until;
}

/** What the pair goes back to. See the module comment for why the default is neutral. */
export function fallbackFor(row) {
    const revertsTo = row?.revertsTo;
    //Never back to NO_CONTACT: the two have met, and un-meeting them is what a "we have
    //never seen each other" bug would look like. `setRelationState()` refuses it anyway,
    //so letting one through here would be an expiry that silently did nothing.
    if (revertsTo === DiplomaticState.WAR || revertsTo === DiplomaticState.NEUTRAL) {
        return revertsTo;
    }
    return DiplomaticState.NEUTRAL;
}
