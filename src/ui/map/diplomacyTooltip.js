// Who a country is at war, at peace, at truce or allied with, as tooltip rows.
//
// The board carries force (the military view) and what a territory has built (the
// upgrade rows); this is the third thing a player has to be able to read off the
// map rather than out of a panel, because a relation decides whether a territory
// can be attacked at all. A greyed-out attack control that does not say WHY is a
// bug report waiting to be filed.
//
// Pure: it takes a country, the player's country and the register's own rows, and
// returns rows. `ui.js` turns them into markup. It runs in Node and is unit-tested
// there, which is the only affordable way to pin wording -- no e2e spec asserts
// prose, and the tooltip is rebuilt dozens of times a second.
//
// TWO AUDIENCES, TWO RULES, AND THEY ARE NOT THE SAME LIST (Leigh's brief):
//
//   YOUR OWN TERRITORY   every country you have a relation with, and nothing that
//                        is still at no contact -- a list of 206 countries you have
//                        never met is not a list, and no contact is the absence of
//                        a relationship rather than one of them.
//   SOMEBODY ELSE'S      the state between them and YOU first, ALWAYS, even when it
//                        is no contact -- "we have never met" is exactly what a
//                        player wants to know about a country on the far side of
//                        the map, and it is the one row that would otherwise be
//                        missing precisely when it is most informative. Then their
//                        other relations, on the same rule as above.
//
// WAR IS LISTED FIRST because it is the only state that can cost the reader a
// territory this turn; then the two that could become war, then the alliance.
//
// THE LIST IS CAPPED. A surviving empire borders a dozen countries and a tooltip
// that fills the screen is one people stop reading -- the military view's threat
// lines settled this the same way, with a count of what was left out rather than
// silence.

import { DiplomaticState, describeState, RELATION_DISPLAY_ORDER } from "../../state/diplomacy.js";

/** How many relations are listed before the rest become a count. */
export const TOOLTIP_RELATION_ROWS = 6;

/**
 * The class suffix each state is drawn in.
 *
 * A name rather than a colour: `style.css` may carry no colour literal outside its
 * `:root` block, so the token lookup belongs there and this says only which of the
 * four kinds of news a row is.
 */
const TONES = Object.freeze({
    [DiplomaticState.WAR]: "hostile",
    [DiplomaticState.CEASEFIRE]: "caution",
    [DiplomaticState.PEACE]: "friendly",
    [DiplomaticState.ALLIANCE]: "friendly",
    //Neutral reads like no contact rather than like peace, and deliberately: peace
    //was AGREED and neutral is merely the absence of a declaration, so a player who
    //could not tell them apart at a glance would think themselves safe.
    [DiplomaticState.NEUTRAL]: "muted",
    [DiplomaticState.NO_CONTACT]: "muted"
});

function orderOf(state) {
    const index = RELATION_DISPLAY_ORDER.indexOf(state);
    return index === -1 ? RELATION_DISPLAY_ORDER.length : index;
}

/**
 * One row's wording.
 *
 * The country is named first and the state second, so a column of rows reads down
 * the names -- which is what somebody scanning for one particular neighbour is
 * doing. A ceasefire carries the turn it runs out on, because a truce with no date
 * on it is indistinguishable from a peace right up until it is not.
 */
function labelFor(country, state, until) {
    const described = describeState(state);
    if (state === DiplomaticState.CEASEFIRE && Number.isFinite(until)) {
        return country + " — " + described + " until turn " + until;
    }
    return country + " — " + described;
}

function rowFor(country, state, until, { isPlayerRow = false } = {}) {
    return {
        country,
        state,
        isPlayerRow,
        tone: TONES[state] ?? "muted",
        label: labelFor(country, state, until)
    };
}

/**
 * The relation rows for the country holding the territory under the pointer.
 *
 * @param {object} input
 * @param {string} input.country        whose territory is being hovered (`dataName`)
 * @param {string|null} input.playerCountry  null in spectator mode, where there is
 *        no player to put first and every country is somebody else
 * @param {{country: string, state: string, until: number|null}[]} input.relations
 *        the register's rows for `country`, in any order
 * @param {number} [input.maxRows]
 * @returns {{rows: object[], more: number}}
 */
export function diplomacyTooltipRows({
    country,
    playerCountry = null,
    relations = [],
    maxRows = TOOLTIP_RELATION_ROWS
}) {
    if (!country) {
        return { rows: [], more: 0 };
    }

    const isPlayerCountry = Boolean(playerCountry) && country === playerCountry;
    const others = relations.filter(
        (relation) =>
            relation &&
            relation.country &&
            relation.country !== country &&
            relation.state !== DiplomaticState.NO_CONTACT &&
            //Held back only when it is going to be re-added at the top. On the
            //player's OWN territory there is no such row, so the player's country
            //is not in this list to begin with.
            !(!isPlayerCountry && relation.country === playerCountry)
    );

    others.sort((left, right) => {
        const byState = orderOf(left.state) - orderOf(right.state);
        return byState !== 0 ? byState : left.country.localeCompare(right.country);
    });

    const rows = [];
    if (!isPlayerCountry && playerCountry) {
        //ALWAYS, and even at no contact -- see the note at the top. Absent from the
        //register means the two have never met, which is a fact worth stating.
        const withPlayer = relations.find((relation) => relation?.country === playerCountry);
        rows.push(
            rowFor(
                playerCountry,
                withPlayer?.state ?? DiplomaticState.NO_CONTACT,
                withPlayer?.until ?? null,
                { isPlayerRow: true }
            )
        );
    }

    //The cap counts the player's row, because the cap is about how tall the tooltip
    //gets and that row is as tall as any other.
    const room = Math.max(0, maxRows - rows.length);
    for (const relation of others.slice(0, room)) {
        rows.push(rowFor(relation.country, relation.state, relation.until));
    }

    return { rows, more: Math.max(0, others.length - room) };
}
