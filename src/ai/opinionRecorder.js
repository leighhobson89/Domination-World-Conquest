// What the world does to what countries think of each other.
//
// The RECORDING half of `src/ai/opinion.js`, kept apart from it for the reason every rule in
// this directory is split that way: the store is pure and runs in Node, and this watches a
// live game. It is modelled directly on `src/state/activityRecorder.js`, down to the
// `install...()` shape and the returned uninstaller, because it is answering the same
// question about the same events -- *what just happened between two countries* -- and two
// modules answering that question from different evidence would eventually disagree.
//
// THREE DOORS, AND THAT IS THE WHOLE POINT.
//
//   ACTIVITY_LOGGED     a conquest, a siege laid, an attack thrown back. NOT the raw
//                       `TERRITORY_CHANGED`, and this is a deliberate improvement on the plan
//                       in `docs/archived/08-opinion.md` §2: `activityRecorder.js` already
//                       owns the hard part of reading that event -- which changes are
//                       conquests and
//                       which are the bootstrap assigning the player their starting land, or
//                       a restore patching the world back into place. Deriving it a second
//                       time here would be a second copy of a rule that has already been got
//                       wrong once, so this reads the entry the feed produced instead. The
//                       feed cannot record a conquest this misses, and this cannot invent one
//                       the feed does not show the player.
//   DIPLOMACY_CHANGED   every declaration, every treaty, every call answered or refused.
//                       `setRelationState()` is the ONE way the register is written, so
//                       nothing can be missed by a new code path -- the same argument that
//                       made the news derived rather than reported from ten call sites. What
//                       the event cannot supply is WHO acted and BY WHAT ROUTE, and that is
//                       already annotated on it as `by`, `via` and `onBehalfOf`.
//   TURN_CHANGED        the settle, which is what pulls every opinion back toward the resting
//                       point its standing relationship implies.
//
// TWO FLOODS ARE GUARDED, and both are the lessons the activity feed already paid for. FIRST
// CONTACT is not an event: `diplomacyContacts.js` writes NEUTRAL for every pair whose borders
// have met and a busy turn 1 walks something like 1,900 pairings, so it is guarded twice --
// on `via: "contact"` and on the NO_CONTACT to NEUTRAL transition, independently. And a busy
// turn 1 logs FIFTY-ONE conquests, which is affordable here only because each one is a single
// map write.
//
// NOTHING HERE DRAWS RANDOMNESS. `src/ai/diplomacy.js` draws none and neither does
// `opinion.js`, which is why no diplomatic decision in this game can move a seeded outcome.
//
// THE LEADER'S TRAITS ARE INJECTED, NOT IMPORTED -- the same arrangement
// `installActivityRecorder({ leaderNameFor })` has, and for the same reason: the leaders live
// in `cpuPlayerGenerationAndLoading.js`, which reaches the whole game, and importing it here
// would drag the UI into `src/ai/` and cost this module the property the unit suite depends
// on.

import { ActivityKind } from "../state/activityLog.js";
import { DiplomaticState, isAgreement } from "../state/diplomacy.js";
import { Events, on } from "../state/events.js";
import { allRelations } from "../state/selectors.js";
import { opinionDiscipline } from "../config/balance.js";
import { applyOpinionEvent, OpinionEvent, settleOpinions } from "./opinion.js";

let installed = false;
let traitsOf = () => ({});

/**
 * Start watching. Called once, from bootstrap, beside `installActivityRecorder()`.
 *
 * @param {{traitsFor?: (country: string) => object}} [wiring]
 * @returns {() => void} an uninstaller
 */
export function installOpinionRecorder({ traitsFor } = {}) {
    if (typeof traitsFor === "function") {
        traitsOf = traitsFor;
    }
    if (installed) {
        return () => {};
    }
    installed = true;

    const offActivity = on(Events.ACTIVITY_LOGGED, onActivityLogged);
    const offDiplomacy = on(Events.DIPLOMACY_CHANGED, onDiplomacyChanged);
    const offTurn = on(Events.TURN_CHANGED, onTurnChanged);

    return () => {
        offActivity();
        offDiplomacy();
        offTurn();
        installed = false;
    };
}

/**
 * A conquest, a siege laid, or an attack thrown back.
 *
 * `attacker` and `defender` are the countries at the time it happened, which matters: a
 * territory that changes hands twice in a game must credit each conquest to whoever actually
 * took it, and reading the world back later is known-issue AS in new clothes.
 */
function onActivityLogged({ entry } = {}) {
    if (!entry?.attacker || !entry?.defender || entry.attacker === entry.defender) {
        return;
    }
    const between = { holder: entry.defender, subject: entry.attacker };

    if (entry.kind === ActivityKind.CONQUEST) {
        applyOpinionEvent(OpinionEvent.CONQUEST,
            { ...between, scale: reconquistaOf(entry.defender) });
        return;
    }
    if (entry.kind === ActivityKind.SIEGE_STARTED) {
        applyOpinionEvent(OpinionEvent.SIEGE_LAID, between);
        return;
    }
    if (entry.kind === ActivityKind.ATTACK_FAILED) {
        //Felt BOTH ways, which `applyOpinionEvent()` knows: one side was invaded and the
        //other was humiliated.
        applyOpinionEvent(OpinionEvent.FAILED_ATTACK, between);
    }
}

/**
 * How much this country minds losing a province, either side of the 0.5 that is neither.
 *
 * `reconquista` is the one trait that scales an event, and it is the trait for exactly this:
 * *how much it wants lost territory back*. Read at the moment the territory changes hands, so
 * a later succession cannot re-price a grudge that has already formed.
 */
function reconquistaOf(country) {
    const trait = Number(traitsOf(country)?.reconquista);
    if (!Number.isFinite(trait)) {
        return 1;
    }
    return 1 + (trait - 0.5) * opinionDiscipline.reconquistaSwing;
}

/**
 * A pair of countries changed diplomatic state.
 *
 * `by` is who acted and `via` is the route, both annotated at the call sites for exactly this
 * kind of reader: a pair arriving at WAR looks identical whether somebody declared, an ally
 * answered a call to arms, or a ceasefire lapsed, and those are three different feelings.
 */
function onDiplomacyChanged(payload) {
    if (!payload || payload.replaced || !payload.state) {
        return;
    }
    const { a, b, state, previous, via = null, by = null, onBehalfOf = null } = payload;
    if (!a || !b || a === b || via === "contact") {
        return;
    }
    //Guarded independently of `via`, because a scenario or a restore can produce the same
    //transition without going through `diplomacyContacts.js`.
    if (previous === DiplomaticState.NO_CONTACT && state === DiplomaticState.NEUTRAL) {
        return;
    }
    //Who this happened TO. `by` is the actor, so the other name is the one whose opinion of
    //the actor moves; a mutual event moves both anyway and does not care which is which.
    const actor = by === b ? b : a;
    const other = actor === a ? b : a;

    //A PAIR ARRIVING AT WAR IS NOT ALWAYS SOMETHING SOMEBODY DID, which is the whole reason
    //`via` is annotated in the first place. A ceasefire that simply LAPSES puts two countries
    //back to war with `via: "expired"` and nobody to blame -- charging that as a declaration
    //would give every ceasefire in the game a sting in its tail that nothing in the design
    //asks for, and the resting point already makes the renewed war felt. So the two routes
    //that ARE somebody's doing are named, and everything else is left to settle.
    if (state === DiplomaticState.WAR) {
        if (via === "declared" || via === "calledIn") {
            onWarBegun({ actor, other, previous, via, onBehalfOf });
        }
        return;
    }
    if (via === "declinedCall") {
        //The alliance ends, free for both -- but a call that goes unanswered is felt by both:
        //one was let down, and the other knows it.
        applyOpinionEvent(OpinionEvent.CALL_REFUSED, { holder: other, subject: actor });
        return;
    }
    const agreed = AGREEMENT_EVENTS[state];
    //`agreed` and `released` are the two routes into an agreement -- a country signing, and a
    //joiner being brought out of a war on its principal's terms. Both are agreements as far
    //as the two countries are concerned. A ceasefire LAPSING is not: it goes the other way
    //and has no `via` of its own.
    if (agreed && (via === "agreed" || via === "released")) {
        applyOpinionEvent(agreed, { holder: other, subject: actor, state: previous });
    }
}

/** Which agreement each state is, for the mutual warming that reaching it earns. */
const AGREEMENT_EVENTS = Object.freeze({
    [DiplomaticState.CEASEFIRE]: OpinionEvent.CEASEFIRE_AGREED,
    [DiplomaticState.PEACE]: OpinionEvent.PEACE_AGREED,
    [DiplomaticState.ALLIANCE]: OpinionEvent.ALLIANCE_AGREED
});

/**
 * Two countries are now at war, and there are three ways that happens.
 *
 * A BETRAYAL IS DERIVED RATHER THAN ANNOTATED, which is the rule the news already follows:
 * going to war out of an AGREEMENT is exactly the transition `applyBreach()` charges for, so
 * this asks the register the same question the penalty asks rather than trusting a flag.
 * It is PERSONAL where the treachery mark is global -- until now a country that betrayed
 * Spain was refused by everybody and Spain was no angrier about it than Chile.
 */
function onWarBegun({ actor, other, previous, via, onBehalfOf }) {
    if (via === "calledIn") {
        //AN ALLY TURNED UP. The largest positive in the table, because it is the largest
        //thing one country can do for another here: taking on a war it had no part in
        //starting. The principal is the one who feels it -- `actor` is the joiner.
        if (onBehalfOf && onBehalfOf !== actor) {
            applyOpinionEvent(OpinionEvent.CALL_ANSWERED,
                { holder: onBehalfOf, subject: actor });
        }
        //And the country it has just entered a war against takes it exactly as it looks.
        applyOpinionEvent(OpinionEvent.DECLARED_WAR, { holder: other, subject: actor });
        return;
    }
    if (isAgreement(previous)) {
        applyOpinionEvent(OpinionEvent.BETRAYAL,
            { holder: other, subject: actor, state: previous });
        return;
    }
    //A declarer does not resent having declared, so this moves one direction only.
    applyOpinionEvent(OpinionEvent.DECLARED_WAR,
        { holder: other, subject: actor, state: previous });
}

/**
 * The settle, once a turn.
 *
 * IT IS DRIVEN FROM THE REGISTER'S ROWS rather than from the stored opinions -- see
 * `settleOpinions()` for why that is the half that makes the resting point work at all. The
 * register is sparse and holds exactly the pairs that have met, which is exactly the set that
 * should be settling.
 */
function onTurnChanged() {
    settleOpinions(allRelations());
}
