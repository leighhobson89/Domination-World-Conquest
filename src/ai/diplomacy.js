// Who a country declares war on, and who it leaves alone.
//
// THE ONLY MODULE IN `src/ai/` ALLOWED TO DECIDE A DIPLOMATIC ACTION -- the containment
// `doctrine.js` has over victory conditions and `standingsGoalColumns.js` has on the UI
// side. Everything else in the AI reads a STATE (`countriesMayFight()`, through
// `rateTarget()`'s refusal) rather than re-deriving an intention, so there is exactly one
// place to look when the world is at the wrong temperature.
//
// WHAT IT IS FOR. Diplomacy stage 2 pointed the attack gates at the register, and because
// first contact is NEUTRAL and `allowsAttack()` permits WAR alone, the world went silent:
// not one conquest, not one siege, all 207 countries surviving with the largest empire on
// the 31 territories it started with. That silence was the deliverable -- a gate you can
// watch stop the world is a gate you can trust -- and this module is what ends it.
//
// THE FREEZE GUARD, AND IT IS THE ONE THING TO GET RIGHT HERE. From this stage onwards a
// RESIDUAL freeze looks exactly like the intended one: nothing throws, every turn completes,
// the map quietly stops changing. That is known-issue BA, which cost this project a hundred
// turns of measurement once already, when a posture rule disqualified 93% of the world from
// expanding. So the declaration rule is deliberately split in two:
//
//   THE THEATRE WAR is unconditional. `theatre.js` already commits each country to absorbing
//                   ONE neighbour and keeps the commitment until the rival becomes a wall --
//                   that commitment IS the country's own answer to "who is my enemy", it is
//                   already persistent and already derived from the border. Turning it into
//                   a declaration costs nothing and cannot be refused by a posture, by a war
//                   cap or by a leader's temperament. Every country with a reachable
//                   neighbour therefore has a war, which is what makes a freeze impossible
//                   rather than merely unlikely.
//   THE REST is bounded. Opportunistic declarations -- a second front against a neighbour
//                   who is visibly weaker -- are the ones `declarationDiscipline` governs,
//                   and they are small numbers because a war never ENDS in the game as it
//                   stands. Peace is stage 5; until it exists every declaration is permanent,
//                   so a generous allowance would put the map back into the undeclared
//                   all-out war this phase exists to replace, inside twenty turns.
//
// WHAT IT WILL NOT DO YET. It never declares out of an AGREEMENT. Breaking a peace, a
// ceasefire or an alliance is the one act this system calls a BREACH, and stage 5.6 is what
// prices it; an AI that walked out of a treaty for free would be teaching the player that a
// treaty is worthless, which is the opposite of what the phase is for. Nor does it make
// peace, propose anything or answer a proposal -- those are stage 5 and they arrive here,
// beside `planDeclarations()`.
//
// Pure. It takes the world as arguments -- the relation lookup, the war count, the campaign
// -- reads no store and draws no randomness at all, so it runs in Node and the whole policy
// is stated in `tests/unit/ai-diplomacy.spec.js`. The APPLYING half, which writes the
// register through `setRelationState()`, is in `aiCalculations.js`, the same split every
// other rule in this directory has.

import {
    allianceDiscipline,
    betrayalPenalty,
    declarationDiscipline,
    peaceDiscipline
} from "../config/balance.js";
import {
    allowsDeclaration,
    canPropose,
    describeProposal,
    describeState,
    DiplomaticState,
    isAgreement,
    ProposalKind
} from "../state/diplomacy.js";

/** Where a declaration came from. The plan log and the debug panel print it. */
export const DeclarationSource = Object.freeze({
    THEATRE: "theatre",
    OPPORTUNISTIC: "opportunistic"
});

/**
 * Every war this country will open this turn, and why it left the rest alone.
 *
 * Called once per country per turn, from `planAiCampaign()` in `aiCalculations.js`, AFTER
 * `planCampaign()` -- it reads the theatre that call chose -- and BEFORE the turn's goals
 * are planned, so a war declared this turn can be fought this turn. Leigh's rule: a
 * declaration takes effect at once and there is no waiting period anywhere in this system.
 *
 * @param {object} input
 * @param {string} input.country
 * @param {number} input.turn
 * @param {object} input.campaign          from `planCampaign()`
 * @param {(other: string) => string} input.relationStateOf   the CURRENT state with a country
 * @param {number} input.warCount          how many countries this one is already at war with
 * @param {object} [input.traits]          the leader's traits
 * @param {string|null} [input.playerCountry]
 * @param {number} [input.graceTurns]      `PLAYER_GRACE_TURNS`
 * @returns {{declarations: Array<{target: string, reason: string, source: string}>,
 *            skipped: Array<{target: string, reason: string}>}}
 */
export function planDeclarations({
    country,
    turn = 0,
    campaign = null,
    relationStateOf,
    warCount = 0,
    traits = {},
    playerCountry = null,
    graceTurns = 0
} = {}) {
    const declarations = [];
    const skipped = [];
    if (!country || typeof relationStateOf !== "function") {
        return { declarations, skipped };
    }

    const decided = new Set();
    const stateOf = (other) => relationStateOf(other) ?? DiplomaticState.NO_CONTACT;

    /**
     * Everything that is true of a target whoever is asking.
     *
     * It returns a REASON rather than a boolean, because a refusal with no reason is the
     * thing this codebase has been burnt by twice: the AI debug window and the plan log both
     * print `reason`, and a country that quietly declines to declare war for fifty turns is
     * indistinguishable from one that was never asked.
     */
    const refuse = (target) => {
        if (!target || target === country) {
            return "not a country this one can declare on";
        }
        if (decided.has(target)) {
            return "already decided this turn";
        }
        const state = stateOf(target);
        if (state === DiplomaticState.WAR) {
            return "already at war";
        }
        //An agreement is broken by a BREACH, and stage 5.6 is what a breach costs. Nothing
        //prices one yet, so the AI does not commit an act whose consequence has not been
        //built. `isAgreement()` is the enum's own question, so a sixth agreement state added
        //later is covered without a change here.
        if (isAgreement(state)) {
            return "an agreement stands (" + state + ") and breaking one is a breach";
        }
        //NO_CONTACT. Contact is coalesced -- walked at most once per turn -- so a border
        //that opened during this turn's conquests can genuinely still read as no contact for
        //a moment. Refusing is right either way: two countries who have never touched cannot
        //reach one another, and the turn they can, the contact rule has already made them
        //neutral.
        if (!allowsDeclaration(state)) {
            return "no contact yet -- their borders have not met";
        }
        //THE PLAYER'S OPENING GRACE PERIOD, in the diplomatic vocabulary. `rateTarget()`
        //already refuses the AI the OPENING of an attack or a siege against the player for
        //the first few turns, because 206 countries plan turn 1 with full information and a
        //player who chose a one-territory country is reachable by several at once. Refusing
        //the DECLARATION as well is the same idea said better: the player is not merely
        //un-attackable during the grace period, nobody has declared on them, so the map and
        //the tooltip agree with the rule. The attack gate stays exactly as it is -- it is
        //the belt to this braces, and it is what covers a war declared before the player
        //existed, which a loaded save can produce.
        if (playerCountry && target === playerCountry && turn <= graceTurns) {
            return "the player is inside the opening grace period (turn " + turn +
                " of " + graceTurns + ")";
        }
        return null;
    };

    const declare = (target, source, reason) => {
        decided.add(target);
        declarations.push({ target, source, reason });
    };
    const skip = (target, reason) => {
        if (target) {
            decided.add(target);
        }
        skipped.push({ target, reason });
    };

    //--- THE THEATRE WAR ------------------------------------------------------------
    //Unconditional, and see the module comment for why. This is the guard that makes a
    //silent world impossible rather than merely unlikely.
    const theatre = campaign?.theatre ?? null;
    const rival = theatre?.rival ?? null;
    if (rival) {
        const refusal = refuse(rival);
        if (refusal) {
            skip(rival, refusal);
        } else {
            declare(rival, DeclarationSource.THEATRE,
                "committed to absorbing " + rival + " -- a war it intends to fight, so a war it declares");
        }
    }

    //--- OPPORTUNISM ----------------------------------------------------------------
    let allowance = opportunisticAllowance(campaign, traits);
    if (allowance <= 0) {
        return { declarations, skipped };
    }

    const cap = declarationDiscipline.concurrentWarCap;
    for (const candidate of theatre?.candidates ?? []) {
        if (allowance <= 0) {
            break;
        }
        const target = candidate?.rival ?? null;
        if (!target || decided.has(target)) {
            continue;
        }
        //THE CAP COUNTS THE WARS ALREADY RUNNING PLUS THE ONES OPENED A MOMENT AGO, which is
        //the shape the siege budget had to be given for exactly this reason: a budget that
        //ignores what it has already spent this turn is not a budget.
        if (warCount + declarations.length >= cap) {
            skip(target, "already at war with " + (warCount + declarations.length) +
                " countries -- the cap is " + cap);
            continue;
        }
        if (candidate.walled) {
            skip(target, "written off as a wall -- not worth a fresh declaration");
            continue;
        }
        const weakness = Number(candidate.weakness) || 0;
        if (weakness < declarationDiscipline.opportunistWeakness) {
            skip(target, "border strength " + weakness.toFixed(2) +
                " is short of the " + declarationDiscipline.opportunistWeakness +
                " an opportunistic war is worth starting at");
            continue;
        }
        const refusal = refuse(target);
        if (refusal) {
            skip(target, refusal);
            continue;
        }
        allowance -= 1;
        declare(target, DeclarationSource.OPPORTUNISTIC,
            "a weaker border than ours (" + weakness.toFixed(2) + ") and nothing agreed between them");
    }

    return { declarations, skipped };
}

/**
 * How many wars beyond the theatre one this country will open.
 *
 * Three terms, and each says something different about the country. The POSTURE says whether
 * it is in a position to open a front at all -- a country developing or defending is not.
 * `risk_taking` says whether the leader is the sort to; a pacifist (0.0-0.4) still fights the
 * war their country has committed to and still defends itself, and simply will not start a
 * second one because a neighbour looks weak. And URGENCY -- the strongest rival's share of
 * the world's land, already computed every turn by `doctrine.js` -- is the runaway-leader
 * response in its diplomatic form: when somebody is winning, the rest of the world starts
 * more wars. That is the mechanism behind Leigh's stated goal for this phase, *"countries
 * will work together to overcome adversaries"*, arriving one declaration at a time.
 */
function opportunisticAllowance(campaign, traits) {
    const posture = campaign?.posture ?? "EXPAND";
    const base = declarationDiscipline.postureAllowance[posture] ?? 0;
    if (base <= 0) {
        return 0;
    }
    const risk = Number(traits?.risk_taking);
    if (Number.isFinite(risk) && risk < declarationDiscipline.opportunistRiskFloor) {
        return 0;
    }
    const urgency = Number(campaign?.doctrine?.urgency) || 0;
    return base + (urgency >= declarationDiscipline.urgencyForExtra ? 1 : 0);
}

// ---------------------------------------------------------------------------------------
// NEGOTIATION -- stage 5.1. The half of this module that can END a war.
//
// WHY IT MATTERS MORE THAN THE DECLARATION RULES ABOVE. Stage 3 measured a world in which a
// war, once declared, could never end: pairs at war climbed 536 -> 749 across a 150-turn run
// under every one of the five goals, which is the map walking back towards the permanent
// undeclared war this whole phase exists to replace. A declaration rule with no matching
// peace rule is a ratchet, and this is the pawl coming off it.
//
// A PROPOSAL IS ANSWERED AT ONCE, like everything else in this system. There is no waiting
// period anywhere: you ask, and you are told. What separates the agreements is not delay but
// how hard they are to get -- a ceasefire expires, so it costs a country far less to agree to
// than a promise never to fight again, and `ceasefireAllowance` is that difference stated as
// a number.

/**
 * pair key -> { [kind]: turn it was last refused }
 *
 * WHY A COOLDOWN AT ALL. A player who can ask every turn until the dice fall their way is not
 * negotiating, they are rerolling -- and the answer is a pure function of a world that barely
 * moves between turns, so asking again immediately is asking the same question. It is per
 * PAIR and per KIND, so being refused a peace does not stop you asking for a ceasefire.
 *
 * It rides in the `aiStrategy` save slice rather than registering one of its own, which is
 * the rule the campaign table and the theatres already follow.
 */
const refusals = new Map();

/**
 * The separator inside a cooldown key: the ASCII unit separator, written as an escape.
 *
 * The same choice `relationKey()` makes and for the same reason -- six territories on this
 * map carry real parentheses in their names, so any printable separator is a key collision
 * waiting to happen, and a literal control character in a source file is invisible in every
 * diff that will ever show this line.
 */
const KEY_SEPARATOR = "\u001f";

function cooldownKey(a, b) {
    return a < b ? a + KEY_SEPARATOR + b : b + KEY_SEPARATOR + a;
}

/** Turns left before this pair may be asked this again, or 0. */
export function proposalCooldownLeft(a, b, kind, turn) {
    const refusedOn = refusals.get(cooldownKey(a, b))?.[kind];
    if (!Number.isFinite(refusedOn)) {
        return 0;
    }
    return Math.max(0, peaceDiscipline.proposalCooldown - ((Number(turn) || 0) - refusedOn));
}

function rememberRefusal(a, b, kind, turn) {
    const key = cooldownKey(a, b);
    const row = refusals.get(key) ?? {};
    row[kind] = Number(turn) || 0;
    refusals.set(key, row);
}

/**
 * Wipe every refusal and every call-in binding. New Game, and the unit tests.
 *
 * `callIns` is declared further down this file, which is fine for a `const` at module scope
 * and is why this is safe to call from anywhere -- but it does mean the two halves of "what
 * this module remembers" have to be kept in step by hand, and a third would too.
 */
export function resetDiplomacyMemory() {
    refusals.clear();
    callIns.clear();
    treachery.clear();
}

export function captureDiplomacyMemory() {
    return {
        refusals: Object.fromEntries([...refusals].map(([key, row]) => [key, { ...row }])),
        //Rows rather than the keys themselves, for the reason the register is saved as rows:
        //the key carries a control character between the names, which survives JSON and is
        //unreadable in a save anybody opens.
        callIns: allCallIns(),
        treachery: allTreachery()
    };
}

export function restoreDiplomacyMemory(data) {
    resetDiplomacyMemory();
    for (const [key, row] of Object.entries(data?.refusals ?? {})) {
        refusals.set(key, { ...row });
    }
    for (const row of data?.callIns ?? []) {
        bindJoiner(row?.principal, row?.joiner, row?.adversary);
    }
    for (const row of data?.treachery ?? []) {
        if (row?.country && Number.isFinite(Number(row.until))) {
            treachery.set(row.country, {
                until: Number(row.until),
                span: Number(row.span) || 1
            });
        }
    }
}

/**
 * Will this country accept what it has just been offered?
 *
 * Pure, and it takes PLAIN VALUES rather than a campaign object -- deliberately, because it
 * is asked from two places with very different amounts to hand. The player's offer is
 * answered by a country whose campaign has already been derived this turn; an AI's offer to
 * another AI is answered by a country whose turn may not have come round yet, and deriving a
 * whole campaign to answer one question would be 207 extra campaign derivations on a busy
 * turn. Every term degrades to zero when its input is missing, so the second caller gets a
 * slightly less informed answer rather than a wrong one.
 *
 * @param {object} input
 * @param {string} input.country      who is being ASKED
 * @param {string} input.proposer     who is asking
 * @param {string} input.kind         a `ProposalKind`
 * @param {string} input.state        the current state between the two
 * @param {number} input.turn
 * @param {object} [input.traits]           the asked country's leader
 * @param {string|null} [input.posture]     the asked country's posture, if known
 * @param {number} [input.urgency]          0..1, the runaway-leader signal
 * @param {string|null} [input.theatreRival]  who the asked country is committed to absorbing
 * @param {number} [input.otherWars]        wars it is fighting BESIDES this one
 * @param {number} [input.failuresAgainstProposer]  attacks it has lost against the proposer
 * @param {number} [input.territories]              how much the asked country holds
 * @param {number} [input.proposerTerritories]
 * @param {boolean} [input.siegeStanding]   a siege stands between the two -- see below
 * @param {number} [input.sharedEnemies]    countries BOTH are at war with. Alliance only
 * @param {number} [input.existingAllies]   how many allies the asked country already has
 * @param {string|null} [input.boundToPrincipal]  who the PROPOSER joined this war on behalf
 *        of, if anybody. A country called in may not settle out of it -- see below
 * @returns {{accepted: boolean, score: number, threshold: number, reason: string}}
 */
export function proposalOutcomeFor({
    country,
    proposer,
    kind,
    state,
    turn = 0,
    traits = {},
    posture = null,
    urgency = 0,
    theatreRival = null,
    otherWars = 0,
    failuresAgainstProposer = 0,
    territories = 0,
    proposerTerritories = 0,
    siegeStanding = false,
    //Alliance-only, and both free to gather: the register already holds every war list.
    sharedEnemies = 0,
    existingAllies = 0,
    //Set when the ASKING country joined somebody else's war against this one. See below.
    boundToPrincipal = null
} = {}) {
    const tuning = peaceDiscipline;
    const offered = describeProposal(kind);

    const refuse = (value, reason) => ({
        accepted: false, score: round(value), threshold: tuning.acceptThreshold, reason
    });
    const refuseAndRemember = (value, reason) => {
        rememberRefusal(country, proposer, kind, turn);
        return refuse(value, reason);
    };

    if (!country || !proposer || country === proposer) {
        return refuse(0, "there is nobody to agree with");
    }
    if (!canPropose(state, kind)) {
        return refuse(0, offered + " cannot be offered out of the state you are in");
    }
    //Q1 ANSWERED: A SIEGE BLOCKS AN AGREEMENT, AND IT BLOCKS IT SYMMETRICALLY.
    //
    //Peace agreed while an army is three turns from starving a province out is a
    //contradiction, and both ways of resolving it are worse than refusing. LIFTING the siege
    //means moving an army back out of a siege object from two unrelated code paths, the
    //player's and the AI's -- and a write that creates or destroys army is the single largest
    //class of defect this project has had (known-issue BJ, and the free-attack bug before
    //it). LETTING IT RUN under a peace makes the register say something untrue about the map.
    //So the agreement waits: finish the siege, or lift it, then talk.
    //
    //THE COST IS REAL AND IS ACCEPTED. A player besieged by the AI cannot lift that siege
    //themselves, so peace is unavailable to them for as long as it stands -- which is exactly
    //when they most want it. What makes it bearable is that `siegeReview.js` already lifts a
    //siege that stalls, that sieges are rare (nought to five standing across the whole world
    //at every sample ever taken), and that the refusal says why.
    if (siegeStanding) {
        return refuse(0, "a siege stands between you -- it has to end before " + offered +
            " can be agreed");
    }
    //A COUNTRY CALLED INTO SOMEBODY ELSE'S WAR MAY NOT SETTLE OUT OF IT ALONE. Leigh's rule,
    //in his own words: *"an ally brought in to aid an attacked ally against an adversary may
    //not independently make peace with that adversary, the peace must be asked either by the
    //ally under attack or by the adversary, and agreed, where it then applies peace to the
    //ally aiding the attacked ally as well."*
    //
    //Without it a call-in is a free favour: an ally turns up, is thanked, and buys its own
    //way out on the next turn while the country that called it is still fighting. The other
    //half of the rule -- the joiner coming OUT when the principal settles -- is
    //`releaseJoiners()`, and it is why this refusal can be absolute rather than a penalty.
    //
    //It does not spend the cooldown: this is a refusal about WHO is asking rather than about
    //whether they should be listened to, and it stops applying the moment the principal's war
    //ends. Locking the pair out for eight turns after that would be punishing them for a war
    //that is already over.
    if (boundToPrincipal) {
        return refuse(0, "it joined this war to aid " + boundToPrincipal +
            " and cannot settle out of it alone -- " + boundToPrincipal +
            " has to agree the peace");
    }
    //NOBODY DEALS WITH SOMEBODY WHO HAS JUST TORN UP A TREATY. This is the whole of the
    //betrayal penalty on the diplomatic side: while the mark stands, no agreement of any kind
    //can be reached with them. It is the part that makes an alliance's benefits a HOSTAGE --
    //and it decays, so a betrayal is a setback rather than a permanent exclusion.
    //
    //It is checked before the cooldown so the reason a player is refused is the one they can
    //actually act on, and it does not SET a cooldown: being refused for treachery is a fact
    //about the mark rather than about the offer, and it stops applying on its own.
    if (isTreacherous(proposer, turn)) {
        return refuse(0, "it will not deal with somebody who has broken an agreement -- " +
            "wait for that to be forgotten");
    }
    const cooling = proposalCooldownLeft(country, proposer, kind, turn);
    if (cooling > 0) {
        return refuse(0, "you asked recently and were refused -- ask again in " + cooling +
            (cooling === 1 ? " turn" : " turns"));
    }

    //THE THEATRE RIVAL IS THE ONE COUNTRY A PEACE CANNOT BE BOUGHT FROM, and that is what
    //keeps the register meaningful. `theatre.js` commits a country to absorbing ONE neighbour
    //and keeps the commitment while it takes ground; a war that could be ended by asking
    //would make the mid-term goal a suggestion.
    //
    //A CEASEFIRE IS STILL AVAILABLE FROM A RIVAL THAT IS LOSING, and that escape is the point
    //rather than a softening: a country being beaten wants a breather, and that is exactly
    //the moment the other side most wants to buy one.
    if (theatreRival && theatreRival === proposer) {
        if (kind !== ProposalKind.CEASEFIRE) {
            return refuseAndRemember(0,
                "this is the war it has committed to -- it will not agree to " + offered);
        }
        if (failuresAgainstProposer < tuning.theatreCeasefireFailures) {
            return refuseAndRemember(0,
                "it is committed to this war and has not been beaten badly enough to want a pause");
        }
    }

    //AN ALLIANCE IS SCORED ON A DIFFERENT QUESTION ENTIRELY, so it takes its own branch
    //rather than another six terms in this one. Peace and a ceasefire ask "do you want out of
    //this war"; an alliance asks "do you want into somebody else's", which shares not one
    //term with it. `allianceScoreFor()` is that question and it lives beside the call-in it
    //creates the risk of.
    if (kind === ProposalKind.ALLIANCE) {
        const { score: allianceScore, parts: allianceParts } = allianceScoreFor({
            traits,
            urgency,
            sharedEnemies,
            existingAllies,
            territories,
            proposerTerritories
        });
        const allied = allianceScore >= allianceDiscipline.acceptThreshold;
        if (!allied) {
            rememberRefusal(country, proposer, kind, turn);
        }
        return {
            accepted: allied,
            score: round(allianceScore),
            threshold: allianceDiscipline.acceptThreshold,
            reason: reasonFrom(allianceParts, allied)
        };
    }

    let score = kind === ProposalKind.CEASEFIRE ? tuning.ceasefireAllowance : 0;

    //EVERY TERM RECORDS WHICH WAY IT ARGUED, and the sentence at the end names only the ones
    //that agree with the answer. Listing all of them reads as nonsense to a player: an
    //accepted offer explained by "its leader is aggressive, it is much the larger of the two"
    //is giving the reasons it should have said NO. This is the one output of the whole rule
    //that anybody reads, so it has to argue in one direction.
    const parts = [];
    const note = (weight, text) => {
        if (Math.abs(weight) > 0.15) {
            parts.push({ weight, text });
        }
    };

    //FIGHTING ON MORE THAN ONE FRONT. The classic reason to want out of a war, and the first
    //one the design names.
    const fronts = Math.min(tuning.maxOtherWarWeight,
        tuning.perOtherWar * Math.max(0, Number(otherWars) || 0));
    if (fronts > 0) {
        score += fronts;
        note(fronts, "it is fighting " + otherWars + " other war" + (otherWars === 1 ? "" : "s"));
    }

    if (posture === "DEFEND" || posture === "DEVELOP") {
        score += tuning.defensivePosture;
        note(tuning.defensivePosture,
            posture === "DEFEND" ? "it is defending" : "it is building");
    }

    //LOSING GROUND. `theatre.js` already counts the attacks lost against a rival, so this
    //costs nothing to ask and is the most legible reason of the lot.
    const beaten = Math.min(tuning.maxFailureWeight,
        tuning.perFailure * Math.max(0, Number(failuresAgainstProposer) || 0));
    if (beaten > 0) {
        score += beaten;
        note(beaten, "it has lost " + failuresAgainstProposer + " attack" +
            (failuresAgainstProposer === 1 ? "" : "s") + " here");
    }

    //WHO IS IN CHARGE. A pacifist leans towards yes and an aggressive one away, around the
    //0.5 that is neither -- which is what makes a succession worth watching.
    const risk = finiteOr(traits?.risk_taking, 0.5);
    const temperament = tuning.riskSwing * (0.5 - risk);
    score += temperament;
    note(temperament, risk < 0.5 ? "its leader is cautious" : "its leader is aggressive");

    //SOMEBODY IS RUNNING AWAY WITH THE GAME. See `urgencyWeight` in `balance.js`: this is the
    //mechanism behind the phase's stated goal, arriving one handshake at a time.
    const alarm = tuning.urgencyWeight * clamp01(urgency);
    score += alarm;
    note(alarm, "a bigger threat is growing elsewhere");

    //AGREEING NOT TO FIGHT SOMEBODY YOU ARE BEATING IS WHAT A COUNTRY DOES NOT DO. Without
    //this the strongest empire on the map signs peace with everything it is about to eat.
    const mine = Math.max(0, Number(territories) || 0);
    const theirs = Math.max(0, Number(proposerTerritories) || 0);
    if (theirs > 0 && mine > theirs && tuning.strongerRatio > 1) {
        const advantage = clamp01(((mine / theirs) - 1) / (tuning.strongerRatio - 1));
        const dominance = tuning.strongerRefusal * advantage;
        score -= dominance;
        note(-dominance, "it is much the larger of the two");
    }

    const threshold = tuning.acceptThreshold;
    const accepted = score >= threshold;
    if (!accepted) {
        rememberRefusal(country, proposer, kind, turn);
    }
    return { accepted, score: round(score), threshold, reason: reasonFrom(parts, accepted) };
}

/**
 * The one agreement this country will OFFER somebody this turn, or null.
 *
 * ONE OFFER PER COUNTRY PER TURN, and that cap is not a performance decision. Two hundred
 * countries each asking three neighbours is six hundred negotiations a turn, most of them
 * refused and every refusal setting a cooldown -- the world would exhaust its own diplomacy
 * in three turns and then go quiet for eight. One offer means a country works through its
 * wars at the pace a country plausibly would.
 *
 * IT OFFERS TO THE WAR IT VALUES LEAST, which is what the design asks for: never the theatre
 * rival, and among the rest the one it has been beaten by most, because that is the war that
 * is costing it something and going nowhere.
 *
 * A CEASEFIRE FIRST, ALWAYS -- it is the cheap version and the design says to reach for it
 * first. A peace is offered only to somebody already under a ceasefire, which is the classic
 * move and the one case where the two have already stopped shooting.
 *
 * @param {object} input
 * @param {string} input.country
 * @param {number} input.turn
 * @param {Array<{country: string, state: string}>} input.relations  from `relationsFor()`
 * @param {string|null} [input.theatreRival]
 * @param {object} [input.traits]
 * @param {string|null} [input.posture]
 * @param {number} [input.urgency]
 * @param {(rival: string) => number} [input.failuresAgainst]
 * @returns {{target: string, kind: string, reason: string}|null}
 */
export function planAgreementOffer({
    country,
    turn = 0,
    relations = [],
    theatreRival = null,
    traits = {},
    posture = null,
    urgency = 0,
    failuresAgainst = null
} = {}) {
    if (!country) {
        return null;
    }

    //AN ALLIANCE COMES FIRST WHEN THERE IS SOMETHING TO BE AFRAID OF, and that ordering is
    //the phase's stated goal expressed as a priority: a country that can see a power running
    //away with the game should be looking for a partner before it goes back to tidying up its
    //own wars. It is offered out of PEACE alone -- a country that will not first agree not to
    //fight you is not going to share its oil -- so the candidates are already a short list.
    if (clamp01(urgency) >= allianceDiscipline.seekAllyUrgency) {
        const enemies = new Set(relations
            .filter(row => row.state === DiplomaticState.WAR)
            .map(row => row.country));
        const partner = relations
            .filter(row => row.state === DiplomaticState.PEACE)
            .filter(row => proposalCooldownLeft(country, row.country, ProposalKind.ALLIANCE, turn) === 0)
            .map(row => ({
                country: row.country,
                //Only the enemies THIS country can see are counted, which is the honest half
                //of a shared fear: it is not asking the other side who it is fighting, it is
                //noticing that they are fighting the same people.
                shared: (row.theirWars ?? []).filter(name => enemies.has(name)).length
            }))
            .sort((a, b) => b.shared - a.shared || a.country.localeCompare(b.country))[0];
        if (partner) {
            return {
                target: partner.country,
                kind: ProposalKind.ALLIANCE,
                reason: partner.shared > 0
                    ? "a power is running away with the game and " + partner.country +
                        " fights " + partner.shared + " of the same enemies"
                    : "a power is running away with the game and " + partner.country +
                        " is already at peace with it"
            };
        }
    }

    const wars = relations.filter(
        row => row.state === DiplomaticState.WAR && row.country !== country);
    const ceasefires = relations.filter(row => row.state === DiplomaticState.CEASEFIRE);

    //FIRMING A CEASEFIRE INTO A PEACE comes first, because it is the cheapest thing in the
    //system that permanently removes a war: the shooting has already stopped, and the clock
    //is the only thing standing between these two and it starting again.
    for (const row of ceasefires) {
        if (row.country === theatreRival) {
            continue;
        }
        if (proposalCooldownLeft(country, row.country, ProposalKind.PEACE, turn) > 0) {
            continue;
        }
        return {
            target: row.country,
            kind: ProposalKind.PEACE,
            reason: "the ceasefire with " + row.country + " is holding -- worth making permanent"
        };
    }

    //A country needs a REASON to sue for a ceasefire, and this is it: more than one war, a
    //posture that is not looking for a fight, a cautious leader, or a threat growing
    //elsewhere. Without a gate here every country would offer every turn, which is a world of
    //diplomats rather than a world with diplomacy in it.
    const risk = finiteOr(traits?.risk_taking, 0.5);
    const wantsOut = wars.length > 1 ||
        posture === "DEFEND" ||
        posture === "DEVELOP" ||
        risk < 0.4 ||
        clamp01(urgency) >= 0.6;
    if (!wantsOut || wars.length === 0) {
        return null;
    }

    const candidates = wars
        .filter(row => row.country !== theatreRival)
        .filter(row =>
            proposalCooldownLeft(country, row.country, ProposalKind.CEASEFIRE, turn) === 0)
        .map(row => ({
            country: row.country,
            failures: failuresAgainst ? (Number(failuresAgainst(row.country)) || 0) : 0
        }))
        //Most beaten first, then alphabetical. The tie-break is there so a world of countries
        //with no losses yet still produces a stable, reproducible choice rather than one that
        //follows `Map` insertion order.
        .sort((a, b) => b.failures - a.failures || a.country.localeCompare(b.country));

    const chosen = candidates[0];
    if (!chosen) {
        return null;
    }
    return {
        target: chosen.country,
        kind: ProposalKind.CEASEFIRE,
        reason: chosen.failures > 0
            ? "losing against " + chosen.country + " and fighting " + wars.length + " wars"
            : "fighting " + wars.length + " wars and this is the least of them"
    };
}

/**
 * The sentence, built from the terms that argued the way the answer went.
 *
 * Heaviest first, and at most three: a player reading a refusal wants the reason, not the
 * arithmetic, and six clauses is a spreadsheet. The fallback matters more than it looks --
 * a country with nothing pushing either way genuinely has no story to tell, and "nothing in
 * particular moves it" is a truer thing to print than the strongest of six tiny numbers.
 */
function reasonFrom(parts, accepted) {
    const agreeing = parts
        .filter(part => (accepted ? part.weight > 0 : part.weight < 0))
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
        .slice(0, 3)
        .map(part => part.text);

    if (agreeing.length > 0) {
        return agreeing.join(", ");
    }
    //An offer refused with nothing arguing against it is the common case and the one worth
    //saying plainly: nobody talked them out of it, there was simply never enough for it.
    return accepted ? "it sees no reason to keep fighting" : "nothing in particular moves it";
}

function clamp01(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

/** A number, or the fallback. A missing trait must not turn a score into NaN. */
function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function round(value) {
    return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------------------
// ALLIANCES -- stages 5.2 to 5.5. The only agreement that GIVES something.
//
// Peace and a ceasefire are both promises not to do a thing. An alliance pays -- income,
// capacity, reach and sight -- and that is what makes it worth the risk in Leigh's §3.4: a
// party to an alliance that goes to war ASKS its ally to join, and the ally may say no.
//
// NOTHING CASCADES, AND THAT IS DESIGNED IN RATHER THAN GUARDED AGAINST. The first draft of
// this system had co-belligerence automatic, which needed a rule forbidding a transitive
// closure or one signature would have put the whole map at war in three hops. A war spreads
// one country at a time now, and only ever because somebody said yes.

/**
 * Wars somebody was CALLED INTO, as `principal  joiner  adversary`.
 *
 * WHY THIS EXISTS AT ALL, in Leigh's words: *"an ally brought in to aid an attacked ally
 * against an adversary may not independently make peace with that adversary, the peace must
 * be asked either by the ally under attack or by the adversary, and agreed, where it then
 * applies peace to the ally aiding the attacked ally as well."*
 *
 * So a joiner is BOUND: it cannot buy its own way out of a war it entered on somebody else's
 * behalf, and when the principal's war ends the joiner's ends with it, on the same terms. That
 * is what stops a call-in being a free favour a country accepts and then immediately settles.
 *
 * It rides in the `aiStrategy` save slice with the refusal cooldown.
 */
const callIns = new Set();

function callInKey(principal, joiner, adversary) {
    return principal + KEY_SEPARATOR + joiner + KEY_SEPARATOR + adversary;
}

/** Record that `joiner` entered `principal`'s war against `adversary`. */
export function bindJoiner(principal, joiner, adversary) {
    if (!principal || !joiner || !adversary || joiner === adversary) {
        return;
    }
    callIns.add(callInKey(principal, joiner, adversary));
}

/** Is this country bound to somebody else's war against this adversary? */
export function isBoundJoiner(joiner, adversary) {
    for (const key of callIns) {
        const parts = key.split(KEY_SEPARATOR);
        if (parts[1] === joiner && parts[2] === adversary) {
            return parts[0];
        }
    }
    return null;
}

/**
 * Everybody bound to this country's war against this adversary, and the binding is dropped.
 *
 * Called when the principal's own war ends: the joiners come out with them, on the same
 * terms, which is the second half of Leigh's rule. Reading and clearing in one step is
 * deliberate -- a binding that outlived the war it described would keep a country from ever
 * making peace with that adversary again.
 */
export function releaseJoiners(principal, adversary) {
    const freed = [];
    for (const key of [...callIns]) {
        const parts = key.split(KEY_SEPARATOR);
        if (parts[0] === principal && parts[2] === adversary) {
            freed.push(parts[1]);
            callIns.delete(key);
        }
    }
    return freed;
}

/** Forget every binding a country holds, either way round. It has left the war or the map. */
export function releaseAllFor(country) {
    for (const key of [...callIns]) {
        const parts = key.split(KEY_SEPARATOR);
        if (parts.includes(country)) {
            callIns.delete(key);
        }
    }
}

/** Every binding, for the debug panel and the save slice. */
export function allCallIns() {
    return [...callIns].map(key => {
        const [principal, joiner, adversary] = key.split(KEY_SEPARATOR);
        return { principal, joiner, adversary };
    });
}

/**
 * Will this country accept an alliance?
 *
 * Asked through the same door as every other proposal (`proposalOutcomeFor()`), so the
 * player's offer and an AI's offer to another AI cannot come to different conclusions.
 *
 * URGENCY IS THE HEAVIEST TERM BY A DISTANCE, and that is where the phase's stated goal
 * finally arrives in full: a country with nothing to fear has no reason to tie itself to
 * somebody else's wars, and a world where one power is running away with it is a world that
 * starts signing. Shared enemies come next, because it is the most legible reason two
 * countries ally and it is free to ask -- both war lists are already in the register.
 *
 * @returns {{score: number, parts: Array<{weight: number, text: string}>}}
 */
export function allianceScoreFor({
    traits = {},
    urgency = 0,
    sharedEnemies = 0,
    existingAllies = 0,
    territories = 0,
    proposerTerritories = 0
} = {}) {
    const tuning = allianceDiscipline;
    const parts = [];
    const note = (weight, text) => {
        if (Math.abs(weight) > 0.15) {
            parts.push({ weight, text });
        }
    };
    let score = 0;

    const alarm = tuning.urgency * clamp01(urgency);
    score += alarm;
    note(alarm, "a power is running away with the game");

    const shared = Math.min(tuning.maxSharedEnemyWeight,
        tuning.perSharedEnemy * Math.max(0, Number(sharedEnemies) || 0));
    score += shared;
    note(shared, "you already fight " + sharedEnemies + " of the same enem" +
        (sharedEnemies === 1 ? "y" : "ies"));

    const web = tuning.perExistingAlly * Math.max(0, Number(existingAllies) || 0);
    score += web;
    note(web, "it has " + existingAllies + " all" + (existingAllies === 1 ? "y" : "ies") +
        " already");

    const risk = finiteOr(traits?.risk_taking, 0.5);
    const temperament = tuning.riskSwing * (0.5 - risk);
    score += temperament;
    note(temperament, risk < 0.5 ? "its leader is cautious" : "its leader is aggressive");

    //AN ALLIANCE WITH A COUNTRY THAT CANNOT HELP YOU is a promise to fight their wars for
    //nothing. The asymmetry is one-way on purpose: a SMALLER country is glad of a large
    //ally, so only the larger side is talked out of it.
    const mine = Math.max(0, Number(territories) || 0);
    const theirs = Math.max(0, Number(proposerTerritories) || 0);
    if (theirs > 0 && mine > theirs && tuning.strongerRatio > 1) {
        const advantage = clamp01(((mine / theirs) - 1) / (tuning.strongerRatio - 1));
        const dominance = tuning.strongerRefusal * advantage;
        score -= dominance;
        note(-dominance, "it is far the larger of the two");
    }

    return { score, parts };
}

/**
 * Will this ally answer a call to arms?
 *
 * **Q3 IS ANSWERED AND AN ALLY IS CALLED IN ON DEFENCE AS WELL AS ON AGGRESSION** (Leigh:
 * *"yes they are"*). That reopens the cascade the first draft designed out, so the guard is
 * the same one that made it safe in the first place: nothing is automatic. A call is a
 * question, the answer may be no, and a war spreads exactly one country per yes.
 *
 * The defensive case is weighted HIGHER than the aggressive one, which is the point of the
 * distinction: coming to the aid of somebody who has been attacked is what an alliance is
 * understood to be for, and being dragged into a war your partner started is not.
 *
 * @returns {{joins: boolean, score: number, reason: string}}
 */
export function callInOutcomeFor({
    ally,
    principal,
    adversary,
    traits = {},
    urgency = 0,
    defensive = false,
    alreadyAtWar = false,
    existingWars = 0,
    allyTerritories = 0,
    adversaryTerritories = 0
} = {}) {
    const tuning = allianceDiscipline.callIn;
    const parts = [];
    const note = (weight, text) => {
        if (Math.abs(weight) > 0.15) {
            parts.push({ weight, text });
        }
    };
    let score = 0;

    if (!ally || !principal || !adversary || ally === adversary) {
        return { joins: false, score: 0, reason: "there is no war to join" };
    }

    //ALREADY FIGHTING THEM COSTS NOTHING, so it is the heaviest term. An ally that is already
    //at war with the adversary is being asked to keep doing what it is doing.
    if (alreadyAtWar) {
        score += tuning.alreadyFighting;
        note(tuning.alreadyFighting, "it is already at war with " + adversary);
    }

    if (defensive) {
        score += tuning.defensive;
        note(tuning.defensive, principal + " was attacked");
    }

    const alarm = tuning.urgency * clamp01(urgency);
    score += alarm;
    note(alarm, "a power is running away with the game");

    const stretched = tuning.perExistingWar * Math.max(0, Number(existingWars) || 0);
    score += stretched;
    note(stretched, "it is already fighting " + existingWars + " war" +
        (existingWars === 1 ? "" : "s"));

    const risk = finiteOr(traits?.risk_taking, 0.5);
    const temperament = tuning.riskSwing * (risk - 0.5);
    score += temperament;
    note(temperament, risk > 0.5 ? "its leader is aggressive" : "its leader is cautious");

    const theirs = Math.max(0, Number(adversaryTerritories) || 0);
    const mine = Math.max(0, Number(allyTerritories) || 0);
    if (mine > 0 && theirs > mine && tuning.strongerRatio > 1) {
        const gap = clamp01(((theirs / mine) - 1) / (tuning.strongerRatio - 1));
        const fear = tuning.strongerAdversary * gap;
        score -= fear;
        note(-fear, adversary + " is far the larger power");
    }

    const joins = score >= tuning.acceptThreshold;
    return { joins, score: round(score), reason: reasonFrom(parts, joins) };
}

// ---------------------------------------------------------------------------------------
// BETRAYAL -- stage 5.6. The one act in this system that costs anything.
//
// Leigh: *"a very large penalty indeed if broken"*, narrowed by §3.4 to exactly one act.
// There are three ways an alliance ends and only this is a breach:
//
//   an ally DECLINES a call-in          free, both sides. Both of them decided
//   both agree to DISSOLVE it           free, both sides. Both of them agreed
//   one side WALKS OUT, or turns on its own ally     the full penalty
//
// THE ASYMMETRY IS WHAT MAKES THE PENALTY SAFE TO MAKE LARGE. A country that wants out of an
// alliance has a free, honest route available every single turn, so choosing the breach
// instead is a choice to be TREACHEROUS rather than a choice to be free.
//
// **Q4 ANSWERED: the penalty is REPUTATIONAL ONLY.** No fine, and that is a decision. A gold
// penalty is a number nobody can calibrate -- what is a treaty worth in gold? -- and it would
// fall hardest on the countries least able to absorb it. What the reputation costs instead is
// DERIVED and self-calibrating: a breach drops every other agreement the betrayer holds, and
// an alliance pays a standing share of income, so tearing up one treaty is paid for in the
// dividends of all the rest. The material cost falls out of the reputational one.

/** country -> the turn its treachery mark runs out on. Decays; see `betrayalPenalty`. */
const treachery = new Map();

/**
 * How treacherous this country is right now, 0..1, decaying to nothing.
 *
 * A FRACTION RATHER THAN A FLAG, because the mark decays and a boolean cannot decay. It is
 * the share of the mark still to run, so a country that tore up an alliance last turn reads
 * near 1 and one that did it twenty turns ago reads near 0 -- and `theatreCommitment`'s walls
 * are the precedent for a memory that fades rather than one that is forgiven all at once.
 */
export function treacheryOf(country, turn = 0) {
    const record = treachery.get(country);
    if (!record) {
        return 0;
    }
    const now = Number(turn) || 0;
    const remaining = record.until - now;
    if (remaining <= 0) {
        treachery.delete(country);
        return 0;
    }
    return clamp01(remaining / Math.max(1, record.span));
}

/** Is this country still marked at all? */
export function isTreacherous(country, turn = 0) {
    return treacheryOf(country, turn) > 0;
}

/** Every marked country, for the debug panel and the save slice. */
export function allTreachery() {
    return [...treachery].map(([country, record]) => ({ country, ...record }));
}

/**
 * Record a breach, and say what else has to be torn up because of it.
 *
 * IT DECIDES AND WRITES NOTHING. The `drops` it returns are the betrayer's other agreements,
 * for `aiCalculations.js` to put through `setRelationState()` -- this module reads no store
 * and writes none, which is what keeps the whole policy testable in Node.
 *
 * @param {object} input
 * @param {string} input.betrayer
 * @param {string} input.victim
 * @param {string} input.broken   the `DiplomaticState` that was torn up
 * @param {number} input.turn
 * @param {Array<{country: string, state: string}>} [input.relations]  the betrayer's, so the
 *        other agreements can be named without this module reading anything
 * @returns {{breach: boolean, severity: string|null, until: number,
 *            drops: string[], reason: string}}
 */
export function recordBreach({ betrayer, victim, broken, turn = 0, relations = [] } = {}) {
    const span = betrayalPenalty.treacheryTurns[severityOf(broken)] ?? 0;

    //LEAVING NEUTRAL COSTS NOTHING AT ALL, because nothing was promised. That is not a
    //leniency, it is what the word neutral means -- and it is why declaring war is free in the
    //overwhelming majority of cases and this whole rule almost never fires.
    if (!betrayer || !victim || span <= 0) {
        return { breach: false, severity: null, until: 0, drops: [], reason: "nothing was agreed" };
    }

    const now = Number(turn) || 0;
    const existing = treachery.get(betrayer);
    //A SECOND BETRAYAL EXTENDS THE MARK RATHER THAN REPLACING IT, so a country that tears up
    //a peace while already marked for an alliance does not get the shorter sentence.
    const until = Math.max(now + span, existing?.until ?? 0);
    treachery.set(betrayer, { until, span: Math.max(span, existing?.span ?? 0) });

    //NOBODY KEEPS A TREATY WITH SOMEBODY WHO HAS JUST TORN ONE UP. This is the heart of the
    //penalty and the reason it needs no gold figure: the betrayer loses the agreements it
    //had, and an alliance pays a standing share of income, so the cost is exactly
    //proportional to what they were getting out of being trustworthy.
    const drops = betrayalPenalty.dropsOtherAgreements
        ? relations
            .filter(row => row.country !== victim && isAgreement(row.state))
            .map(row => row.country)
        : [];

    return {
        breach: true,
        severity: severityOf(broken),
        until,
        drops,
        reason: "broke " + describeState(broken).toLowerCase() + " with " + victim
    };
}

/** Which row of `treacheryTurns` applies. Null for anything that was not an agreement. */
function severityOf(state) {
    switch (state) {
        case DiplomaticState.ALLIANCE:
            return "alliance";
        case DiplomaticState.PEACE:
            return "peace";
        case DiplomaticState.CEASEFIRE:
            return "ceasefire";
        default:
            return null;
    }
}
