// How a diplomatic state is COLOURED, in one place.
//
// A NAME AND NEVER A COLOUR. `style.css` may carry no colour literal outside its `:root`
// block, so the token lookup lives there and this says only which of the four kinds of news
// a row is -- exactly the arrangement the military view has with its ramp, and the activity
// feed with its card tones.
//
// It is its own module because TWO surfaces read it now: the territory tooltip (stage 0) and
// the diplomacy panel (stage 4). A second copy would be right until somebody decided that
// neutral should read differently, and would then be a map and a panel disagreeing about
// what the same relation means -- the two-rows-per-relation mistake in a different costume.

import { DiplomaticState } from "../../state/diplomacy.js";

/**
 * The class suffix each state is drawn in.
 *
 * NEUTRAL READS LIKE NO CONTACT AND NOT LIKE PEACE, and that is a decision rather than an
 * oversight: peace was AGREED and neutral is merely the absence of a declaration, so a player
 * who could not tell the two apart at a glance would think an undeclared neighbour safe.
 */
export const RELATION_TONES = Object.freeze({
    [DiplomaticState.WAR]: "hostile",
    [DiplomaticState.CEASEFIRE]: "caution",
    [DiplomaticState.PEACE]: "friendly",
    [DiplomaticState.ALLIANCE]: "friendly",
    [DiplomaticState.NEUTRAL]: "muted",
    [DiplomaticState.NO_CONTACT]: "muted"
});

/** The tone for a state. Anything unrecognised is muted rather than absent. */
export function toneFor(state) {
    return RELATION_TONES[state] ?? "muted";
}
