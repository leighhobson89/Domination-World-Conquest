// The vocabulary of the diplomacy system: what states exist between two countries,
// how a pair of countries is named, and what each state permits.
//
// It imports NOTHING -- the same arrangement `phases.js` has, and for the same
// reason: the enum is read by the store, the selectors, the mutations, the AI and
// the UI, so anything it imported would be dragged into all five. It runs in Node
// and is unit-tested there.
//
// WHAT THE SYSTEM IS FOR. Until now the world is in permanent, undeclared, all-out
// war: every country may attack every other country it can reach, every turn, with
// no state in between. There is no way to agree not to fight, no way to fight
// alongside somebody, and therefore no way for the world to gang up on whoever is
// winning. The register is the fact that makes those possible -- one state per
// unordered PAIR of countries, and every rule about who may attack whom reads it.
//
// SIX STATES, AND THE DEFAULT IS THE ABSENCE OF A RELATIONSHIP:
//
//   NO_CONTACT  the two have never touched. Not "peace by another name" -- a pair
//               at no contact has no agreement of any kind, they simply have never
//               been in a position to have one. It is the default for all 21,321
//               pairs and it is the only state that cannot be NEGOTIATED into; it
//               is left, once, when their borders first meet, and never returned
//               to (see `FIRST_CONTACT_STATE`).
//   NEUTRAL     they have met and nothing has been agreed or declared. Nobody may
//               attack: war is a thing a country DECLARES, and this is the state it
//               is declared out of. This is the state that turns the map from
//               permanent undeclared war into a world where a war has a beginning.
//   WAR         no restrictions. Either may attack any territory of the other.
//               Where the whole map effectively sits today.
//   CEASEFIRE   behaves exactly like peace, and EXPIRES: it carries the turn it
//               runs out on, and reverts unless something firmer is agreed first.
//   PEACE       neither attacks a territory of the other, with no end date. The
//               player's attack controls are greyed out over such territories.
//   ALLIANCE    peace, plus shared resources -- and a very large penalty indeed
//               for breaking it.
//
// WHY THE PAIR AND NOT TWO ROWS. A relation is symmetric by construction: there is
// one record per unordered pair, so "France is at peace with Spain" and "Spain is
// at peace with France" cannot drift apart. Two rows is the defect the map's
// borders had (drawn twice, digitised independently, welded only in 2026) and the
// defect five straits in `manualAdjacencyExceptions.js` had -- listed on one side
// only, which has no signature at all; see known-issue BS. A one-way relation
// would be worse than either, because the country on the wrong side of it would
// plan a war its opponent did not know it was in.

/** The six states a pair of countries can be in. */
export const DiplomaticState = Object.freeze({
    NO_CONTACT: "noContact",
    NEUTRAL: "neutral",
    WAR: "war",
    CEASEFIRE: "ceasefire",
    PEACE: "peace",
    ALLIANCE: "alliance"
});

/** Every state, as a list. Register order, not a display order. */
export const DIPLOMATIC_STATES = Object.freeze(Object.values(DiplomaticState));

/**
 * What a pair is in until something happens to them.
 *
 * The register is SPARSE: 207 countries make 21,321 pairs, and storing a row for
 * each would be twenty thousand rows saying "these two have never met" in every
 * save file. A pair with no record is at `DEFAULT_DIPLOMATIC_STATE`, so an empty
 * register IS "every country at no contact with every other".
 */
export const DEFAULT_DIPLOMATIC_STATE = DiplomaticState.NO_CONTACT;

/**
 * What a pair enters when their borders first touch.
 *
 * NEUTRAL, which is Leigh's decision and the single most consequential line in the
 * diplomacy system: it means a war has a BEGINNING. Two countries that meet are not
 * at war with each other until one of them declares it, so "who is fighting whom"
 * becomes a fact about the world that the player can read, change and be surprised
 * by, instead of a constant.
 *
 * THIS CONSTANT AND THE RUNNING GAME DISAGREE UNTIL DECLARATIONS EXIST. Nothing
 * reads the register to gate an attack yet, so the AI still attacks whoever it
 * likes while the register calls the pair neutral. That is not a defect in either
 * half -- it is the ordering the work has to happen in, and it is why the attack
 * gates are a LATER stage than the declaration rules rather than an earlier one.
 * The register describes the world only once something declares.
 */
export const FIRST_CONTACT_STATE = DiplomaticState.NEUTRAL;

/**
 * The order relations are listed in when several are shown at once.
 *
 * War first, because it is the one that can cost the reader a territory this turn;
 * then the two that could become war (a ceasefire runs out, a peace can be broken);
 * then the alliance, which is the only one that is nobody's problem. Neutral is
 * below all of them -- it is the ordinary condition of two countries who have
 * simply met -- and no contact is last and is usually filtered out before it gets
 * here.
 */
export const RELATION_DISPLAY_ORDER = Object.freeze([
    DiplomaticState.WAR,
    DiplomaticState.CEASEFIRE,
    DiplomaticState.PEACE,
    DiplomaticState.ALLIANCE,
    DiplomaticState.NEUTRAL,
    DiplomaticState.NO_CONTACT
]);

/** Is this one of the six? Anything else must never reach the register. */
export function isDiplomaticState(value) {
    return DIPLOMATIC_STATES.includes(value);
}

/**
 * What separates the two names inside a key.
 *
 * The ASCII unit separator, written as an escape rather than as itself: a literal
 * control character in a source file is invisible in every diff and every editor
 * that will ever show this line.
 */
const KEY_SEPARATOR = "\u001f";

/**
 * The canonical name for a pair of countries.
 *
 * Sorted, so `relationKey("France", "Spain")` and `relationKey("Spain", "France")`
 * are the same string and the register cannot hold two contradictory rows for one
 * pair. The separator is the ASCII unit separator rather than a comma or a dash
 * because country and territory names carry real punctuation -- six territories
 * have parentheses in their names -- and a separator that can occur inside a name
 * is a key collision waiting to happen.
 *
 * @returns {string|null} null when either name is missing, or when a country is
 *          paired with itself: a country has no relation with itself, and asking
 *          for one is a caller's mistake rather than a state.
 */
export function relationKey(a, b) {
    if (!a || !b || a === b) {
        return null;
    }
    return a < b ? a + KEY_SEPARATOR + b : b + KEY_SEPARATOR + a;
}

/** The two country names back out of a key, or null. */
export function relationPair(key) {
    if (typeof key !== "string") {
        return null;
    }
    const parts = key.split(KEY_SEPARATOR);
    return parts.length === 2 ? parts : null;
}

/**
 * May these two fight?
 *
 * The single question every attack gate asks, on both sides of the game. WAR is
 * the only state that permits it, and that is the whole force of making NEUTRAL
 * the first-contact state: two countries who have merely met may not attack each
 * other, so somebody has to declare.
 */
export function allowsAttack(state) {
    return state === DiplomaticState.WAR;
}

/**
 * May war be declared out of this state, and does doing so cost anything?
 *
 * Leigh's rule: a declaration takes effect AT ONCE and the attack may be made the
 * same turn -- there is no waiting period anywhere in this system. What separates
 * the states is not delay but PRICE. Declaring out of neutral is free, because
 * nothing was promised; declaring out of one of the three agreements is breaking
 * something, and `breachOf()` in the penalties rule is what that costs.
 *
 * No contact is the one state war cannot be declared out of, and not by fiat: two
 * countries who have never touched cannot reach one another, and the turn they can,
 * the contact rule has already made them neutral.
 */
export function allowsDeclaration(state) {
    return state !== DiplomaticState.NO_CONTACT && state !== DiplomaticState.WAR;
}

/**
 * Is this a state somebody AGREED to?
 *
 * War and no contact are conditions of the world; the other three are agreements,
 * which is what makes them breakable and what makes breaking one cost something.
 */
export function isAgreement(state) {
    return (
        state === DiplomaticState.CEASEFIRE ||
        state === DiplomaticState.PEACE ||
        state === DiplomaticState.ALLIANCE
    );
}

/** Do these two share resources? Only an alliance does. */
export function sharesResources(state) {
    return state === DiplomaticState.ALLIANCE;
}

/** How a state is written for a human. Sentence-shaped, and carries no names. */
export function describeState(state) {
    switch (state) {
        case DiplomaticState.WAR:
            return "At war";
        case DiplomaticState.CEASEFIRE:
            return "Ceasefire";
        case DiplomaticState.PEACE:
            return "At peace";
        case DiplomaticState.ALLIANCE:
            return "Allied";
        case DiplomaticState.NEUTRAL:
            return "Neutral";
        case DiplomaticState.NO_CONTACT:
            return "No contact";
        default:
            return "Unknown";
    }
}

/**
 * The three things one country can OFFER another.
 *
 * A declaration is not on this list, and that is the distinction the whole stage rests
 * on: a declaration of war is UNILATERAL and takes effect at once, while these three
 * need somebody on the other side to say yes. `allowsDeclaration()` above governs the
 * first; `canPropose()` below governs these.
 *
 * ALLIANCE is listed here before it is built, because the shape of the vocabulary is
 * what decides whether adding it later is one row or a refactor. Nothing offers one
 * yet -- see the checklist's stage 5.2.
 */
export const ProposalKind = Object.freeze({
    CEASEFIRE: "ceasefire",
    PEACE: "peace",
    ALLIANCE: "alliance"
});

/** What state a proposal of each kind would put the pair into, if it were accepted. */
export const PROPOSAL_RESULT = Object.freeze({
    [ProposalKind.CEASEFIRE]: DiplomaticState.CEASEFIRE,
    [ProposalKind.PEACE]: DiplomaticState.PEACE,
    [ProposalKind.ALLIANCE]: DiplomaticState.ALLIANCE
});

/**
 * May this kind of agreement be OFFERED out of the state the pair is in?
 *
 * Three rules, and each says something about what the agreement means.
 *
 * A CEASEFIRE is a pause in fighting, so it can only be offered by people who are
 * fighting: out of WAR and nothing else. Offering one at neutral is offering to stop
 * doing something nobody is doing.
 *
 * A PEACE can be offered out of WAR -- the ordinary case -- and also out of NEUTRAL and
 * out of a CEASEFIRE, both of which are real and different. Neutral to peace is two
 * countries who have merely met agreeing that they will not fight, which turns an
 * absence into an agreement and gives it a price to break. A ceasefire firming into a
 * peace is the classic move and the design table names it.
 *
 * An ALLIANCE is offered out of PEACE alone. It is peace plus shared resources, and a
 * country that will not first agree not to fight you is not going to share its oil.
 *
 * Nothing may be offered at NO_CONTACT: two countries who have never touched have
 * nothing to agree about, and the turn they can reach each other the contact rule has
 * already made them neutral.
 */
export function canPropose(state, kind) {
    switch (kind) {
        case ProposalKind.CEASEFIRE:
            return state === DiplomaticState.WAR;
        case ProposalKind.PEACE:
            return state === DiplomaticState.WAR ||
                state === DiplomaticState.NEUTRAL ||
                state === DiplomaticState.CEASEFIRE;
        case ProposalKind.ALLIANCE:
            return state === DiplomaticState.PEACE;
        default:
            return false;
    }
}

/** How a proposal reads for a human. A noun, never an adjective, and carries no names. */
export function describeProposal(kind) {
    switch (kind) {
        case ProposalKind.CEASEFIRE:
            return "a ceasefire";
        case ProposalKind.PEACE:
            return "a peace";
        case ProposalKind.ALLIANCE:
            return "an alliance";
        default:
            return "an agreement";
    }
}

/**
 * A fresh relation record.
 *
 * `since` is the turn the state began, which is what a "you broke a peace you
 * signed forty turns ago" penalty needs and what lets the UI say how long a thing
 * has held. `until` is the turn a CEASEFIRE expires on and is null for every other
 * state.
 *
 * `revertsTo` IS THE ANSWER TO Q2, AND IT IS A FACT ABOUT THE AGREEMENT RATHER THAN A
 * RULE APPLIED AT EXPIRY. A ceasefire agreed during a war and allowed to lapse plainly
 * goes back to WAR -- that is what a ceasefire IS. But with NEUTRAL as the first-contact
 * state, "reverts to war" and "reverts to neutral" are genuinely different outcomes, and
 * a rule that guessed at expiry would have to reconstruct a history the register does not
 * keep. So the record remembers, at the moment it is signed, the state it was signed out
 * of. It is null for everything but a ceasefire.
 */
export function relationRecord(state, { since = null, until = null, revertsTo = null } = {}) {
    return { state, since, until, revertsTo };
}
