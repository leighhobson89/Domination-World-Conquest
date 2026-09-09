// What the diplomacy panel shows: the player's standing with every country they have met,
// and what can be done about each.
//
// Diplomacy checklist stage 4. The tooltip (stage 0) answers *what is the state* for the
// territory under the pointer; this answers *what can I do about it*, for the whole world at
// once. **Q6 is settled here as its own full-screen window rather than a sixth info-panel
// tab**, and the reason is stage 5 rather than stage 4: a proposal, a counter-offer and a
// call-in are a conversation, and a conversation does not fit in a column beside four tables
// of numbers. The Dominapedia is the shape it borrows -- a list on the left, the subject on
// the right -- because that is the shape this game already uses for "browse a set, read one".
//
// THIS FILE IS THE DECISION AND `DiplomacyPanel.js` IS THE DRAWING, the same split
// `militaryShading.js` has from `militaryView.js` and `topics.js` has from `Dominapedia.js`.
// It imports the enum and nothing else, so the whole of what the panel says is stated in
// Node -- which matters more here than usual, because most of what it can say describes
// states no running game reaches yet: nothing in the game agrees a peace or an alliance
// until stage 5, so a browser is the one place these rows CANNOT be checked.
//
// TWO THINGS IT DELIBERATELY DOES NOT DO. It never reports a country the player has not met
// -- the register is sparse and 206 rows of "no contact" is a list nobody reads -- and it
// never reports the AI's INTENTIONS. Who is about to declare war on whom goes to the console
// with the rest of the plan; a panel showing it would be a cheat, and that line is already
// drawn for the activity feed.

import {
    allowsAttack,
    allowsDeclaration,
    canPropose,
    describeState,
    DiplomaticState,
    isAgreement,
    ProposalKind,
    RELATION_DISPLAY_ORDER
} from "../../state/diplomacy.js";
import { describeOpinion } from "../../ai/opinion.js";
import { toneFor } from "./relationTone.js";

/** How a group of relations is headed. Plural, because a group holds a list. */
const GROUP_HEADING = Object.freeze({
    [DiplomaticState.WAR]: "At war",
    [DiplomaticState.CEASEFIRE]: "Ceasefires",
    [DiplomaticState.PEACE]: "At peace",
    [DiplomaticState.ALLIANCE]: "Allies",
    [DiplomaticState.NEUTRAL]: "Neutral",
    [DiplomaticState.NO_CONTACT]: "No contact"
});

/**
 * The panel's left-hand list: every country the player has met, grouped by state.
 *
 * The groups are in `RELATION_DISPLAY_ORDER` -- war first, because it is the one that can
 * cost the reader a territory this turn, and neutral below the agreements because it is the
 * ordinary condition of two countries who have simply met. Within a group the order is
 * alphabetical and not by size: a player looking for a country knows its name, and a list
 * that re-sorts itself as armies change is a list you cannot find anything in twice.
 *
 * @param {object} input
 * @param {Array<{country: string, state: string, since: number|null, until: number|null}>}
 *        input.relations   from `relationsFor(player)`
 * @param {(country: string) => number} [input.territoryCountOf]
 * @param {(country: string) => boolean} [input.isDefeated]  a country that holds no territory
 *        is out of the game and is dropped entirely -- see below
 * @param {string} [input.search]  a substring filter on the country name, case-insensitive
 * @returns {{groups: Array<{state: string, heading: string, rows: Array}>, total: number,
 *            counts: object}}
 */
export function diplomacyGroups({
    relations = [],
    territoryCountOf = null,
    isDefeated = null,
    search = ""
} = {}) {
    const needle = String(search ?? "").trim().toLowerCase();
    const counts = {};
    const byState = new Map();

    for (const relation of relations) {
        const country = relation?.country;
        if (!country) {
            continue;
        }
        //A DEFEATED COUNTRY IS DROPPED BEFORE IT IS COUNTED, and it is the one filter here
        //that comes before the count rather than after it. The search box is a filter on a
        //list; this is a fact about the world. A country that holds no territory is out of
        //the game, and a heading reading "At war: 3" that includes two countries the player
        //has already conquered is not a count with a filter applied to it -- it is a wrong
        //number. Reported by Leigh, who took a one-territory country's only province and
        //went on being shown at war with it.
        if (isDefeated && isDefeated(country)) {
            continue;
        }
        const state = relation.state ?? DiplomaticState.NO_CONTACT;
        //COUNTED BEFORE FILTERED. The headings say how many countries the player is at war
        //with, and that figure must not change because somebody typed three letters into the
        //search box -- a count that moves with the filter is answering a different question
        //from the one the heading asks.
        counts[state] = (counts[state] ?? 0) + 1;

        //A pair returned to no contact cannot happen -- `setRelationState()` refuses it --
        //but a save restored from a future version could carry one, and a group nobody can
        //act on is noise.
        if (state === DiplomaticState.NO_CONTACT) {
            continue;
        }
        if (needle && !country.toLowerCase().includes(needle)) {
            continue;
        }

        if (!byState.has(state)) {
            byState.set(state, []);
        }
        byState.get(state).push({
            country,
            state,
            label: describeState(state),
            tone: toneFor(state),
            since: relation.since ?? null,
            until: relation.until ?? null,
            territories: territoryCountOf ? (territoryCountOf(country) || 0) : null
        });
    }

    const groups = [];
    for (const state of RELATION_DISPLAY_ORDER) {
        const rows = byState.get(state);
        if (!rows || rows.length === 0) {
            continue;
        }
        rows.sort((a, b) => a.country.localeCompare(b.country));
        groups.push({
            state,
            heading: GROUP_HEADING[state] ?? describeState(state),
            count: counts[state] ?? rows.length,
            rows
        });
    }

    return { groups, total: relations.length, counts };
}

/**
 * Everything the panel says about ONE country.
 *
 * @param {object} input
 * @param {string} input.country
 * @param {string} input.state          the state between this country and the player
 * @param {number|null} [input.since]
 * @param {number|null} [input.until]
 * @param {number|null} [input.turn]
 * @param {number|null} [input.territories]  how many territories they hold
 * @param {Array<{country: string, state: string}>} [input.theirRelations]  everybody THEY
 *        have a relation with, from `relationsFor(country)`
 * @param {number|null} [input.opinion]  what THEY think of the player, -100..100
 * @returns {object}
 */
export function countryDetail({
    country,
    state = DiplomaticState.NO_CONTACT,
    since = null,
    until = null,
    turn = null,
    territories = null,
    theirRelations = [],
    opinion = null
} = {}) {
    const facts = [];
    const held = asNumber(territories);
    if (held !== null) {
        facts.push({
            label: "Holds",
            value: held + (held === 1 ? " territory" : " territories")
        });
    }
    facts.push({ label: "Standing", value: describeState(state) });
    const from = asNumber(since);
    const now = asNumber(turn);
    if (from !== null && now !== null) {
        const turns = Math.max(0, now - from);
        facts.push({
            label: "Since",
            value: turns === 0
                ? "this turn"
                : "turn " + since + " (" + turns + (turns === 1 ? " turn" : " turns") + ")"
        });
    }
    if (state === DiplomaticState.CEASEFIRE && asNumber(until) !== null) {
        facts.push({ label: "Runs out", value: "turn " + until });
    }

    //HOW THEY REGARD THE PLAYER (docs/archived/08-opinion.md §4). This is the panel where the offers
    //are actually made and refused, so it is the place the number most needs to be: an
    //opinion is the one input to a refusal that the player can DO something about, and
    //`describeOpinion()` is the same wording the tooltip's bars carry -- the bands live in
    //`opinion.js` precisely so that the two surfaces cannot describe one number differently.
    const regard = asNumber(opinion);
    if (regard !== null) {
        facts.push({
            label: "Regards you as",
            value: describeOpinion(regard) + " (" + (regard > 0 ? "+" : "") +
                Math.round(regard) + ")"
        });
    }

    //WHO ELSE THEY ARE FIGHTING. Not a cheat and not intelligence-sharing: a war is a fact
    //about the world that both parties know, the territory tooltip already lists it, and it
    //is the one thing that makes a country's diplomacy legible -- a neighbour at war with
    //three others is a neighbour worth talking to.
    const theirWars = theirRelations
        .filter(row => row.state === DiplomaticState.WAR && row.country !== country)
        .map(row => row.country)
        .sort((a, b) => a.localeCompare(b));
    const theirAllies = theirRelations
        .filter(row => row.state === DiplomaticState.ALLIANCE)
        .map(row => row.country)
        .sort((a, b) => a.localeCompare(b));

    return {
        country,
        state,
        label: describeState(state),
        tone: toneFor(state),
        facts,
        theirWars,
        theirAllies,
        actions: actionsFor(country, state)
    };
}

/**
 * What the player may do to this country right now, and why not when they may not.
 *
 * A DISABLED ACTION ALWAYS CARRIES ITS REASON. That is a standing rule in this project --
 * a control that is visible and refuses to act must explain itself on hover -- and it is the
 * whole argument for the panel existing rather than the map alone: the map can grey a button,
 * and only a panel has room to say what would change the answer.
 *
 * THREE ACTIONS, AND THE ORDER IS THE ANSWER TO "WHAT SHOULD I DO HERE". The two ways of
 * stopping a fight come first because they are the ones a player has to go looking for -- war
 * is one click away on the map itself -- and the declaration is last because it is the
 * irreversible one and the one every other surface already offers.
 *
 * THE LIST ENDS WITH THE TWO ACTS THAT NEED NOBODY'S CONSENT, and that ordering is the answer
 * to "what should I do here": everything that has to be agreed comes first, and the two a
 * country can simply DO -- walking out of an alliance, and declaring war -- come last.
 */
function actionsFor(country, state) {
    const actions = [
        proposalAction(country, state, ProposalKind.CEASEFIRE, "Propose a ceasefire"),
        proposalAction(country, state, ProposalKind.PEACE, "Propose a peace"),
        proposalAction(country, state, ProposalKind.ALLIANCE, "Propose an alliance")
    ];
    //MUTUAL DISSOLUTION, and it is only ever offered where there is an alliance to dissolve.
    //It is the second of the two penalty-free ways out and the reason the breach penalty can
    //be made large: a country that wants out of an alliance has a free, honest route
    //available every single turn, so choosing the breach instead is a choice to be
    //treacherous rather than a choice to be free.
    if (state === DiplomaticState.ALLIANCE) {
        actions.push({
            kind: "dissolve",
            label: "Propose ending it",
            enabled: true,
            reason: "Both of you walk away with nothing owed. If " + country +
                " agrees, the alliance simply ends."
        });
    }
    actions.push(declareAction(country, state));
    return actions;
}

/**
 * One of the two things a player can OFFER, and why it is not on the table when it is not.
 *
 * The reasons are about the VOCABULARY and never about the answer. Whether this particular
 * country would accept is `proposalOutcomeFor()`'s question, it depends on six things that
 * move every turn, and printing a forecast here would be telling the player what the AI is
 * about to decide -- the line the activity feed already draws. What this says is only what a
 * ceasefire and a peace ARE, which is what somebody who has never used the panel needs.
 */
function proposalAction(country, state, kind, label) {
    if (canPropose(state, kind)) {
        return { kind, label, enabled: true, reason: offerReasonFor(country, state, kind) };
    }
    return { kind, label, enabled: false, reason: refusalReasonFor(country, state, kind) };
}

/** What the agreement IS, for somebody who has never used the panel. */
function offerReasonFor(country, state, kind) {
    if (kind === ProposalKind.CEASEFIRE) {
        return "A pause in the fighting, with an end date. Cheaper to agree than a peace, " +
            "and it lapses back to war unless something firmer is signed first.";
    }
    if (kind === ProposalKind.ALLIANCE) {
        //Everything an alliance gives, said once, because it is the only agreement that gives
        //rather than withholds -- and the call-in is said in the same breath, because it is
        //the price and a player should not meet it for the first time as a surprise.
        return "Both of you earn more, see each other's frontiers, and can strike through " +
            "each other's land. If " + country + " goes to war you will be ASKED to join, " +
            "and refusing ends the alliance -- free, but ended.";
    }
    return state === DiplomaticState.WAR
        ? "An end to the war, with no end date of its own. Harder to agree than a ceasefire, " +
          "and breaking it later is a breach."
        : "Turns an absence into an agreement: neither of you may attack, and breaking it " +
          "later is a breach.";
}

/** Why it is not on the table. Always about the VOCABULARY, never about the answer. */
function refusalReasonFor(country, state, kind) {
    if (kind === ProposalKind.CEASEFIRE && !allowsAttack(state)) {
        return "A ceasefire is a pause in the fighting, and you are not fighting " + country + ".";
    }
    if (kind === ProposalKind.ALLIANCE) {
        if (state === DiplomaticState.ALLIANCE) {
            return "You are already allied with " + country + ".";
        }
        if (state !== DiplomaticState.NO_CONTACT) {
            //An alliance is peace PLUS shared resources, so the peace comes first: a country
            //that will not agree not to fight you is not going to share its oil.
            return "An alliance is built on a peace. Agree one with " + country + " first.";
        }
    }
    if (kind === ProposalKind.PEACE &&
        (state === DiplomaticState.PEACE || state === DiplomaticState.ALLIANCE)) {
        return "You are already " + describeState(state).toLowerCase() + " with " + country + ".";
    }
    return "You have never had dealings with " + country +
        ", so there is nothing between you to agree about yet.";
}

/** The one act that needs nobody's consent. It takes effect at once. */
function declareAction(country, state) {
    if (allowsAttack(state)) {
        return {
            kind: "declare",
            label: "Declare war",
            enabled: false,
            reason: "You are already at war with " + country + "."
        };
    }
    if (!allowsDeclaration(state)) {
        return {
            kind: "declare",
            label: "Declare war",
            enabled: false,
            reason: "You have never had dealings with " + country +
                ", so there is nothing between you to fight over yet."
        };
    }
    return {
        kind: "declare",
        label: "Declare war",
        enabled: true,
        reason: isAgreement(state)
            ? "This would break an agreement. You will be asked to confirm."
            : "Nothing was agreed, so this costs nothing. It takes effect at once."
    };
}

/**
 * The one-line summary across the top of the panel.
 *
 * It leads with the wars, because that is what the player came to find out, and it says
 * "nobody" rather than "0" -- a count of zero reads as a figure that has not loaded.
 */
export function diplomacySummary(counts = {}) {
    const wars = counts[DiplomaticState.WAR] ?? 0;
    const agreements =
        (counts[DiplomaticState.PEACE] ?? 0) +
        (counts[DiplomaticState.CEASEFIRE] ?? 0) +
        (counts[DiplomaticState.ALLIANCE] ?? 0);
    const met = Object.values(counts).reduce((total, count) => total + count, 0);

    const warPart = wars === 0
        ? "At war with nobody"
        : "At war with " + wars + (wars === 1 ? " country" : " countries");
    const agreementPart = agreements === 0
        ? "no agreements"
        : agreements + (agreements === 1 ? " agreement" : " agreements");
    return warPart + ", " + agreementPart + ", " + met +
        (met === 1 ? " country met" : " countries met");
}

/**
 * A number, or null when the register does not know.
 *
 * `Number(null)` is 0 and `Number.isFinite(0)` is true, so the obvious guard reports a fact
 * the register never recorded -- "Since turn 0", "Holds 0 territories" -- as though it had.
 * It has to be an explicit null-and-undefined check.
 */
function asNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
