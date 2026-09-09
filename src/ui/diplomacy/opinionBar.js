// An opinion, as something to draw.
//
// WHY THE PLAYER IS SHOWN THIS AT ALL, because it overturns a rule this project already
// wrote down. `docs/05-diplomatic-acceptance.md` §7.5 argued that an opinion should NOT go on
// the territory tooltip, on the grounds that it is the same class of thing as a leader's
// trait values -- the numbers the AI plans with -- and the standing rule there is that the
// three personality NAMES are shown and the six trait VALUES are not, because putting one on
// a tooltip is the enemy's plan drawn on the map.
//
// Leigh overruled it, and the counter-argument is the one that decides it: A RELATION THE
// PLAYER CANNOT SEE IS A RULE THEY CANNOT PLAY AGAINST. A trait is fixed and secret and
// nothing the player does can move it. An opinion is a CONSEQUENCE OF THEIR OWN ACTIONS, and
// the whole point of the mechanic is that the reason you are told no becomes a thing you can
// change -- which requires that you can see it.
//
// TWO BARS AND NOT ONE, which is the other half of the brief. Opinion is directional, so
// "how they see you" and "how you see them" are different numbers, and a single bar would be
// asserting a symmetry the model deliberately does not have.
//
// Pure, and it runs in Node: it takes a number and returns geometry and a word. `ui.js` turns
// that into markup and `style.css` owns the colours, which is the arrangement every other
// drawn thing in this codebase has -- a name and never a colour, because the stylesheet may
// carry no colour literal outside its `:root` block.

import { describeOpinion } from "../../ai/opinion.js";
import { opinionDiscipline } from "../../config/balance.js";

/**
 * THE BAR IS CENTRED, and that is the whole reason this file has arithmetic in it.
 *
 * A left-to-right fill would put "hostile" at the empty end and "devoted" at the full one,
 * which reads as a progress bar -- more is better, and a short bar is a bar that has not
 * finished. An opinion is not a quantity of anything; it is a position either side of a
 * neutral middle. So the track has a mark down its centre and the fill grows out from it,
 * left in the negative and right in the positive, and a relation at zero draws nothing at
 * all rather than drawing half a bar.
 */
export const BAR_CENTRE_PERCENT = 50;

/**
 * What to draw for one direction of one pair.
 *
 * @param {number} value -100..100
 * @param {string} label who this is the opinion OF, for the row's own wording
 * @returns {{value: number, word: string, tone: string, side: string, fillPercent: number,
 *            offsetPercent: number, label: string}}
 */
export function opinionBarModel(value, label = "") {
    const limit = opinionDiscipline.range || 100;
    const raw = Number(value);
    const opinion = Math.max(-limit, Math.min(limit, Number.isFinite(raw) ? raw : 0));
    //A WHOLE NUMBER, because the store keeps a decimal so that a slow settle actually moves
    //and nobody reading a tooltip wants to know a relation is at -37.4.
    const shown = Math.round(opinion);
    const magnitude = Math.abs(opinion) / limit;
    const fillPercent = magnitude * BAR_CENTRE_PERCENT;

    return {
        value: shown,
        word: describeOpinion(opinion),
        tone: toneOf(opinion),
        side: opinion < 0 ? "left" : "right",
        fillPercent,
        //Where the fill STARTS, as a percentage from the left edge. A negative opinion grows
        //leftwards from the centre, so its box has to be moved as well as sized -- doing it
        //with one offset rather than with two CSS rules keeps the stylesheet from having to
        //know which way round the scale runs.
        offsetPercent: opinion < 0 ? BAR_CENTRE_PERCENT - fillPercent : BAR_CENTRE_PERCENT,
        label
    };
}

/**
 * The class suffix a value is drawn in.
 *
 * THE SAME FOUR NAMES `relationTone.js` USES, deliberately: the tooltip already draws war in
 * `is-hostile` and an alliance in `is-friendly`, and an opinion bar with a fifth vocabulary
 * beside those rows would be two colour systems in one box. `muted` is the middle, because a
 * relation nobody feels strongly about should not be shouting in either colour.
 */
function toneOf(opinion) {
    if (opinion <= -35) {
        return "hostile";
    }
    if (opinion < -12) {
        return "caution";
    }
    if (opinion < 12) {
        return "muted";
    }
    return "friendly";
}

/**
 * The two bars for a territory the player does not own: how they see you, how you see them.
 *
 * ORDER IS DELIBERATE -- theirs first. What the player is actually asking when they hover a
 * foreign province is *will they deal with me*, and their own attitude is the thing they
 * already know.
 *
 * @param {object} input
 * @param {string} input.country       whose territory this is
 * @param {string|null} input.playerCountry  null in spectator mode
 * @param {number} input.theirs        what `country` thinks of the player
 * @param {number} input.ours          what the player thinks of `country`
 * @returns {Array<object>} zero rows when there is nobody to have an opinion
 */
export function opinionTooltipBars({ country, playerCountry, theirs, ours }) {
    //NOTHING AT ALL WITHOUT A PLAYER. In spectator mode there is nobody for a country to have
    //an opinion of, and two bars of nothing on every territory in the world is the kind of
    //row that teaches people to stop reading a tooltip.
    if (!country || !playerCountry || country === playerCountry) {
        return [];
    }
    return [
        opinionBarModel(theirs, "How " + country + " sees you"),
        opinionBarModel(ours, "How you see " + country)
    ];
}
