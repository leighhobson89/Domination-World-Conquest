// Ceasefires running out: the live half of `src/rules/diplomacy/expiry.js`.
//
// `contact.js` / `diplomacyContacts.js` is the pattern -- the pure rule takes the world as an
// argument and this half knows about the real register.
//
// IT RUNS FROM ONE PLACE, at the turn boundary, and that is a rule rather than a convenience.
// A ceasefire that expired lazily -- on the next read, wherever that happened to be -- would
// lapse at a different moment for a player who opened the diplomacy panel than for one who
// did not, and the AI plans its turn off the same register. One `TURN_CHANGED` listener means
// every reader of the register on turn N sees the same world.
//
// IT RUNS BEFORE THE AI PLANS, which is what `TURN_CHANGED` buys: the counter advances in the
// engine's `endTurn` hook, so this fires before the next turn's steps and a ceasefire that
// lapsed is a war again by the time anybody weighs a target across it. The alternative -- a
// step in `gameTurnsLoop.js` -- would have worked too and would have been one more thing for
// `resumeSavedGame()` to remember.

import { expiredRelations } from "../rules/diplomacy/expiry.js";
import { Events, on } from "./events.js";
import { allRelations, currentTurn } from "./selectors.js";
import { setRelationState } from "./mutations.js";

on(Events.TURN_CHANGED, () => {
    expireDiplomaticAgreements();
});

/**
 * Put every lapsed ceasefire back to whatever it was signed out of.
 *
 * Safe to call as often as you like: a relation is only written when it has actually run
 * out, and `setRelationState()` emits nothing on a no-op.
 *
 * @returns {Array<{a: string, b: string, from: string, to: string}>} what lapsed, for logging
 */
export function expireDiplomaticAgreements() {
    const turn = currentTurn();
    const expired = expiredRelations(allRelations(), turn);
    for (const row of expired) {
        //`since` is the turn the NEW state began, not the turn the ceasefire did. What
        //follows an expiry is a fresh standing between the two, and a "how long has this
        //held" figure that counted from the signing of the agreement it replaced would be
        //answering a question nobody asked.
        setRelationState(row.a, row.b, row.to, { since: turn });
        console.log("The ceasefire between " + row.a + " and " + row.b +
            " has run out -- back to " + row.to);
    }
    return expired;
}
