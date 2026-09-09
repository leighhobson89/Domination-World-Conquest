// How a country feels about another country specifically.
//
// WHAT IT IS FOR. Read `docs/05-diplomatic-acceptance.md` §6.3 first, because it is the
// honest account of the gap this fills. Every diplomatic term in the game before this one is
// a PRESENT-TENSE FACT about the world -- how many wars a country is fighting, what its
// posture is, how big it is next to you, how alarmed it is by whoever is running away with
// the game, and who happens to be in charge of it this decade. Not one of them is a memory of
// what the two of you have done to each other. The shortest statement of the problem is that
// taking a province off a country changed its army, its income and its posture, and changed
// nothing at all about how it felt toward you.
//
// THE SHAPE. A number from -`range` to +`range` that a HOLDER carries about a SUBJECT, moved
// by what happens between them and pulled back every turn toward whatever their standing
// relationship implies. `docs/archived/08-opinion.md` is the design of record and carries
// the five decisions; the three that constrain this file are:
//
//   DIRECTIONAL. France may resent Spain more than Spain resents France, which the register
//                deliberately cannot say -- a relation is ONE record per UNORDERED pair, so
//                that "France's relation to Spain" and "Spain's relation to France" can never
//                drift apart (known-issue BS, designed out rather than asserted after the
//                fact). An opinion is the opposite: the whole point of it is that the two
//                sides of a pair are allowed to disagree. So it is a SECOND map, keyed by an
//                ORDERED pair, and the register is untouched.
//   SPARSE.      207 countries make 42,642 ordered pairs. A pair with no entry is at the
//                resting point its state implies, so an empty map is a correct world at turn
//                one -- and a save taken before opinion existed restores an empty map, which
//                is why the snapshot version does not move.
//   NEVER A GATE. Nothing in this file returns a boolean that can refuse anything. A rule
//                that can refuse is a rule that can freeze the world -- known-issue BA, where
//                a posture check disqualified 93% of the map and took a hundred turns of
//                measurement to find, because nothing throws and every turn completes. What
//                the readers get is a TERM to add to a score, and a term cannot do that
//                whatever value it takes.
//
// PURE, and it draws no randomness at all -- the same property `src/ai/diplomacy.js` has and
// for the same reason: nothing in the diplomatic layer may move a seeded outcome. It imports
// `config/` and `state/diplomacy.js` (which imports nothing itself), so it runs in Node and
// the whole policy is stated in `tests/unit/ai-opinion.spec.js`. The RECORDING half, which
// watches the world and calls `applyOpinionEvent()`, is `src/ai/opinionRecorder.js` -- the
// same split every other rule in this directory has.

import { opinionDiscipline } from "../config/balance.js";
import { DiplomaticState } from "../state/diplomacy.js";

/**
 * The directional store: `holder  subject` to a number.
 *
 * It rides the `aiStrategy` save slice rather than registering one of its own, which is the
 * rule the campaign table, the theatres and the diplomatic memory already follow.
 */
const opinions = new Map();

/**
 * The separator inside a key: the ASCII unit separator, written as an escape.
 *
 * The same choice `relationKey()` and `cooldownKey()` make, and for the same reason -- six
 * territories on this map carry real parentheses in their names, so any printable separator
 * is a key collision waiting to happen, and a literal control character in a source file is
 * invisible in every diff that will ever show this line.
 */
const KEY_SEPARATOR = "\u001f";

/** ORDERED, unlike `relationKey()`. That is the whole difference between the two stores. */
function keyFor(holder, subject) {
    return holder + KEY_SEPARATOR + subject;
}

function clampToRange(value) {
    const limit = opinionDiscipline.range;
    return Math.max(-limit, Math.min(limit, value));
}

function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** The resolution an opinion is stored at. `round()` below is this, spelled out. */
const ROUNDING_STEP = 0.1;

/**
 * How close to its resting point an opinion has to get to count as having ARRIVED.
 *
 * DERIVED FROM THE SETTLE RATE AND NOT A CONSTANT, because the two are not independent. A
 * geometric approach never lands exactly on its target, and rounding makes the last stretch
 * an actual FIXED POINT: the step is `distance x rate`, so once the distance falls below
 * `half the last digit / rate` the step rounds back to where it started and the entry sits
 * there for the rest of the game -- stored, saved, and never equal to the value it is
 * supposedly at. A hand-picked epsilon is right until somebody tunes `settleRate` down, at
 * which point the fixed point moves outside it and nothing ever arrives again.
 *
 * The floor of one point is the resolution the player is shown anything at, so an opinion
 * within a point of its resting value is at it as far as anybody can tell.
 */
function arrivalEpsilon(rate) {
    return Math.max(1, (ROUNDING_STEP / 2) / Math.max(rate, 1e-6));
}

/** One decimal place. An opinion is shown as a whole number and stored as a smooth one. */
function round(value) {
    return Math.round(value * 10) / 10;
}

/**
 * WHERE AN OPINION SETTLES, GIVEN THE STANDING RELATIONSHIP.
 *
 * The decision the whole mechanic hangs off, and the alternative -- decay toward zero -- was
 * rejected for three reasons set out in `balance.js`. The shortest is that decay toward zero
 * would have a fifty-turn war and a fifty-turn peace arrive at the same number.
 *
 * An unknown state rests at neutral rather than throwing: this is called for every row in the
 * register on every turn, and a state the enum grows later must not stop the world settling.
 */
export function restingFor(state) {
    const table = opinionDiscipline.resting;
    return finiteOr(table[state], table[DiplomaticState.NEUTRAL]);
}

/**
 * What `holder` thinks of `subject` right now.
 *
 * An absent pair reads as its RESTING POINT rather than as zero, which is what makes the
 * sparse map correct rather than merely small: two countries that have been at war for
 * eighty turns without a recorded incident are not neutral about each other, they are simply
 * at war, and the resting point is what "simply at war" means.
 *
 * @param {string} holder
 * @param {string} subject
 * @param {string} [state] the standing relation between the two, if known
 * @returns {number} -range..+range
 */
export function opinionOf(holder, subject, state = DiplomaticState.NEUTRAL) {
    if (!holder || !subject || holder === subject) {
        return 0;
    }
    const stored = opinions.get(keyFor(holder, subject));
    return Number.isFinite(stored) ? stored : restingFor(state);
}

/**
 * Move one direction of one pair, and return where it ended up.
 *
 * It MATERIALISES the entry from the resting point rather than from zero, so the first thing
 * that ever happens between two countries at war is felt on top of the fact that they are at
 * war, rather than starting the relationship over from neutral.
 */
export function adjustOpinion(holder, subject, delta, { state = DiplomaticState.NEUTRAL } = {}) {
    if (!holder || !subject || holder === subject) {
        return 0;
    }
    const change = finiteOr(delta, 0);
    if (change === 0) {
        return opinionOf(holder, subject, state);
    }
    const key = keyFor(holder, subject);
    const current = Number.isFinite(opinions.get(key))
        ? opinions.get(key)
        : restingFor(state);
    const next = round(clampToRange(current + change));
    opinions.set(key, next);
    return next;
}

/**
 * The events that move an opinion, by name.
 *
 * A CLOSED set, the rule `ActivityKind` follows and for the same reason: `applyOpinionEvent()`
 * switches on it, and an unrecognised name has to be a no-op rather than a silent zero that
 * looks like a working hook.
 */
export const OpinionEvent = Object.freeze({
    DECLARED_WAR: "declaredWar",
    CONQUEST: "conquest",
    SIEGE_LAID: "siegeLaid",
    FAILED_ATTACK: "failedAttack",
    CEASEFIRE_AGREED: "ceasefireAgreed",
    PEACE_AGREED: "peaceAgreed",
    ALLIANCE_AGREED: "allianceAgreed",
    CALL_ANSWERED: "callAnswered",
    CALL_REFUSED: "callRefused",
    BETRAYAL: "betrayal"
});

/**
 * WHICH EVENTS ARE FELT BY BOTH SIDES.
 *
 * Most are one-way, because most have somebody who chose them: a declarer does not resent
 * having declared. The three here are the ones where both parties learn something. An attack
 * thrown back sours it both ways -- one side was invaded, the other was humiliated. A treaty
 * warms both, because both signed it. And a refused call to arms costs both -- one was let
 * down, and the other knows it.
 */
const MUTUAL = new Set([
    OpinionEvent.FAILED_ATTACK,
    OpinionEvent.CEASEFIRE_AGREED,
    OpinionEvent.PEACE_AGREED,
    OpinionEvent.ALLIANCE_AGREED,
    OpinionEvent.CALL_REFUSED
]);

/**
 * Something happened between two countries.
 *
 * `subject` is the one who ACTED and `holder` is the one whose opinion moves -- so a conquest
 * is `applyOpinionEvent(CONQUEST, { holder: the country that lost the province, subject: the
 * country that took it })`. Naming them that way round is deliberate: every caller is a
 * listener that has just learned who did what to whom, and the alternative naming (actor and
 * victim) stops making sense the moment an event is mutual.
 *
 * @param {string} kind an `OpinionEvent`
 * @param {object} input
 * @param {string} input.holder   whose opinion moves
 * @param {string} input.subject  who it is about
 * @param {string} [input.state]  the standing relation, so an absent pair starts in the right
 *        place
 * @param {number} [input.scale]  a multiplier on the event's own weight. `reconquista` is the
 *        only thing that uses it, on a conquest
 * @returns {{holder: number, subject: number}|null} where the two directions ended up
 */
export function applyOpinionEvent(kind, { holder, subject, state, scale = 1 } = {}) {
    const weight = opinionDiscipline.events[kind];
    if (!Number.isFinite(weight) || !holder || !subject || holder === subject) {
        return null;
    }
    const delta = weight * finiteOr(scale, 1);
    const moved = {
        holder: adjustOpinion(holder, subject, delta, { state }),
        subject: opinionOf(subject, holder, state)
    };
    if (MUTUAL.has(kind)) {
        moved.subject = adjustOpinion(subject, holder, delta, { state });
    }
    return moved;
}

/**
 * Pull every stored opinion a fraction of the way toward its resting point. Once per turn.
 *
 * IT IS DRIVEN FROM THE REGISTER'S OWN ROWS, not from the stored opinions, and that is the
 * half that makes the resting point work at all: a pair at war with no recorded incident has
 * no entry, so walking the stored entries would never move it toward the war resting point
 * and "a long war sours a relationship" would need an event after all. The register is sparse
 * and holds exactly the pairs that have met, which is exactly the set that should be
 * settling.
 *
 * AN ENTRY THAT HAS ARRIVED IS DELETED rather than left sitting on its resting value. That is
 * what keeps the map sparse over a two-hundred-turn game -- otherwise every pair that ever
 * exchanged a shot would be stored for the rest of the run, and the save with it.
 *
 * @param {Array<{a: string, b: string, state: string}>} relations the register's rows
 * @returns {number} how many directions moved
 */
export function settleOpinions(relations = []) {
    const rate = opinionDiscipline.settleRate;
    if (!(rate > 0)) {
        return 0;
    }
    const arrived = arrivalEpsilon(rate);
    let moved = 0;
    for (const row of relations) {
        if (!row?.a || !row?.b) {
            continue;
        }
        const target = restingFor(row.state);
        for (const [holder, subject] of [[row.a, row.b], [row.b, row.a]]) {
            const key = keyFor(holder, subject);
            const current = opinions.get(key);
            const from = Number.isFinite(current) ? current : target;
            //ARRIVED IS A DISTANCE AND NOT AN EQUALITY. See `arrivalEpsilon()`: the approach
            //has a fixed point that an equality test never reaches, and a unit test walks
            //five hundred turns to prove this one does.
            if (Math.abs(target - from) < arrived) {
                //The sparse default already says this, so the entry is deleted rather than
                //left sitting on its own resting value. That is what keeps the map small
                //over a two-hundred-turn game.
                if (opinions.delete(key)) {
                    moved += 1;
                }
                continue;
            }
            const next = round(from + (target - from) * rate);
            opinions.set(key, next);
            moved += 1;
        }
    }
    return moved;
}

/**
 * The word for a value. Seven bands from hostile to devoted, symmetric about neutral.
 *
 * A bar with no label is a shape, and the player is being shown two of them side by side --
 * so the word is what lets somebody say "they are cold toward me and I am hostile toward
 * them" rather than comparing the lengths of two coloured rectangles.
 */
export function describeOpinion(value) {
    const opinion = finiteOr(value, 0);
    if (opinion <= -70) {
        return "hostile";
    }
    if (opinion <= -35) {
        return "cold";
    }
    if (opinion <= -12) {
        return "cool";
    }
    if (opinion < 12) {
        return "neutral";
    }
    if (opinion < 35) {
        return "warm";
    }
    if (opinion < 70) {
        return "friendly";
    }
    return "devoted";
}

/**
 * A clause naming an opinion, or null when it is not worth naming.
 *
 * The same contract `reasonFrom()`'s 0.15 floor has, in opinion's own units: a pair fifteen
 * points off neutral has no grudge worth putting in a sentence, and printing one would be the
 * mistake that rule exists to prevent -- an explanation that argues against its own answer.
 */
export function describeOpinionReason(value) {
    const opinion = finiteOr(value, 0);
    if (Math.abs(opinion) < opinionDiscipline.notableFrom) {
        return null;
    }
    if (opinion <= -70) {
        return "it will not forgive what you have done to it";
    }
    if (opinion < 0) {
        return "it holds a grudge against you";
    }
    if (opinion >= 70) {
        return "it counts you a friend";
    }
    return "it thinks well of you";
}

/**
 * Everything this country holds an opinion about, and everything held about it, forgotten.
 *
 * For a country that has been conquered out of existence -- the same pruning `pruneCallIns()`
 * does, and for the same reason: a principal that no longer exists would otherwise bar its
 * joiner from peace for the rest of the game, and here a dead country's grudges would ride in
 * every save until the end of the run.
 */
export function clearOpinionsFor(country) {
    if (!country) {
        return 0;
    }
    let removed = 0;
    for (const key of [...opinions.keys()]) {
        const [holder, subject] = key.split(KEY_SEPARATOR);
        if (holder === country || subject === country) {
            opinions.delete(key);
            removed += 1;
        }
    }
    return removed;
}

/** New Game, and the unit tests. */
export function resetOpinions() {
    opinions.clear();
}

/**
 * Every stored opinion, as rows.
 *
 * Rows rather than the keyed object, for the reason the register and the refusal cooldowns
 * are both saved as rows: the key carries a control character between the two names, which
 * survives JSON perfectly well and is unreadable in a save anybody opens.
 */
export function allOpinions() {
    return [...opinions].map(([key, value]) => {
        const [holder, subject] = key.split(KEY_SEPARATOR);
        return { holder, subject, value };
    });
}

export function restoreOpinions(rows) {
    resetOpinions();
    for (const row of rows ?? []) {
        if (row?.holder && row?.subject && Number.isFinite(Number(row.value))) {
            opinions.set(keyFor(row.holder, row.subject), clampToRange(Number(row.value)));
        }
    }
}
