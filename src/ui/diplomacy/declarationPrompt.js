// What the player is asked before they declare war, and when they are asked nothing at all.
//
// Diplomacy checklist stage 4, first item: *"a confirmation when a declaration breaks an
// agreement, naming the penalty. None when it breaks nothing, because nothing was promised."*
//
// SO THE COMMON CASE IS SILENCE. Declaring out of NEUTRAL is free -- nothing was agreed, and
// a dialog in front of every declaration would be a click-through inside three turns, which
// is worse than no dialog at all because it trains the player to dismiss the one that
// matters. `declarationPromptFor()` returns null there, and the caller declares.
//
// WHAT IT SAYS, AND WHY IT SAYS MORE THAN IT USED TO. Breaking a peace, a ceasefire or an
// alliance is the one act this system calls a BREACH, and §3.4 narrows the penalty to it
// alone: declining a call-in and a mutual dissolution are both free. Until stage 5.6 that
// penalty did not exist, so this deliberately quoted no number -- a confirmation naming a
// penalty the game does not levy is the same class of lie the move button's hint was written
// to avoid, and the Dominapedia had to be rewritten wholesale once for exactly that.
//
// IT EXISTS NOW, so the confirmation names it: every OTHER agreement the player holds is torn
// up, and for a while nobody will agree anything with them. It still quotes no turn count,
// because the number differs by what was broken and a wrong figure is worse than none -- what
// it promises is exactly what happens.
//
// Pure, imports only the enum, unit-tested in Node -- because a dialog is reachable in the
// running game only by finding a country the player happens to have a treaty with, and
// nothing in the game makes one yet.

import { DiplomaticState, isAgreement } from "../../state/diplomacy.js";

/** How each agreement is named in a sentence, as a noun. Never as an adjective. */
const AGREEMENT_NOUN = Object.freeze({
    [DiplomaticState.PEACE]: "the peace",
    [DiplomaticState.CEASEFIRE]: "the ceasefire",
    [DiplomaticState.ALLIANCE]: "the alliance"
});

/**
 * The confirmation to show before declaring war, or null when none is warranted.
 *
 * @param {object} input
 * @param {string} input.country   whom war would be declared on
 * @param {string} input.state     the current `DiplomaticState` with them
 * @param {number|null} [input.since]  the turn that state began
 * @param {number|null} [input.turn]   the turn it is now
 * @returns {{title: string, message: string, confirmLabel: string, cancelLabel: string}|null}
 */
export function declarationPromptFor({ country, state, since = null, turn = null } = {}) {
    if (!country || !isAgreement(state)) {
        return null;
    }

    const noun = AGREEMENT_NOUN[state] ?? "the agreement";
    //Never a demonym: there are no adjective forms for 207 country names, so every phrasing
    //here uses the name as a noun. The activity feed's rule, and a unit test enforces it.
    const held = standingFor(since, turn);

    const alliance = state === DiplomaticState.ALLIANCE;
    return {
        title: "Break " + noun + " with " + country + "?",
        message:
            "You are " + describeStanding(state) + " with " + country + held + ". " +
            "Declaring war ends " + noun + " and is a breach -- the one way out of an " +
            "agreement that costs anything, and " +
            (alliance
                ? "an alliance is the most costly agreement in the game to break. "
                : "an alliance costs more to break than this. ") +
            //THE PRICE, NAMED. It is reputational and it is derived: losing the other
            //agreements is what a breach actually costs, and an alliance pays a standing share
            //of income, so the material cost falls out of the reputational one.
            "Every other agreement you hold will be torn up, and until it is forgotten " +
            "nobody will agree anything with you. " +
            "The war begins at once, so you may attack this turn.",
        confirmLabel: "Declare war",
        cancelLabel: "Keep " + noun
    };
}

/** "at peace" / "under a ceasefire" / "allied", as it reads mid-sentence. */
function describeStanding(state) {
    switch (state) {
        case DiplomaticState.CEASEFIRE:
            return "under a ceasefire";
        case DiplomaticState.ALLIANCE:
            return "allied";
        default:
            return "at peace";
    }
}

/**
 * ", agreed 14 turns ago" -- or nothing at all when the register does not know.
 *
 * `since` is null on a relation restored from a save taken before the field existed, and on
 * anything a scenario wrote without one. An empty clause is the right answer there: a
 * confirmation that says "agreed NaN turns ago" is worse than one that does not mention it.
 */
function standingFor(since, turn) {
    const from = asTurn(since);
    const now = asTurn(turn);
    if (from === null || now === null) {
        return "";
    }
    const turns = now - from;
    if (turns <= 0) {
        return ", agreed this turn";
    }
    return ", agreed " + turns + (turns === 1 ? " turn ago" : " turns ago");
}

/**
 * A turn number, or null.
 *
 * `Number(null)` is 0 and `Number.isFinite(0)` is true, so the obvious guard reports "agreed
 * this turn" for a relation whose `since` was never recorded. It has to be an explicit
 * null-and-undefined check, and it caught exactly that here.
 */
function asTurn(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
