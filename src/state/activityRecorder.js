// What gets written to the activity feed, and from where.
//
// Phase 7.4. `activityLog.js` is the record; this is the set of rules about when
// to add to it. Splitting them means the log can be unit-tested without any of the
// game's events, and the rules can be read in one place instead of being inferred
// from eight scattered call sites.
//
// There are two ways an entry gets in, and the division is deliberate.
//
// **Derived from state, where the state change IS the event.** A conquest is
// exactly "a territory's `dataName` changed", and a siege beginning is exactly
// "a siege was added". Both already emit through `state/events.js`, from
// `mutations.js`, which every code path must go through -- so deriving them here
// means a conquest cannot be missed by a new attack route that forgets to call a
// logger. That matters: there are eight places that take a territory today.
//
// **Reported explicitly, where the state change does not carry the reason.** A
// failed attack changes nothing about who owns what, so there is no state to
// derive it from. And a siege ENDING is one event with three meanings -- the
// besiegers were arrested, the siege broke into a battle the besieger won, or one
// they lost -- and the store cannot tell them apart after the fact. Those four
// callers say what happened.
//
// **Diplomacy (stage 6) is the third case and it is a HYBRID of the two.** The event
// is derived -- `setRelationState()` is the one way the register is written, so no
// declaration and no treaty can be missed by a caller that forgot to log it -- but
// two facts the register cannot supply are ANNOTATED on it: who acted, and by what
// route. A pair arriving at WAR looks identical whether somebody declared, an ally
// answered a call to arms, or a ceasefire lapsed. See `onDiplomacyChanged()`.
//
// **A leader's name is INJECTED, not imported.** The names live in
// `cpuPlayerGenerationAndLoading.js`, which reaches the whole game; importing it here
// would drag the UI in through the back door and cost this module the property the
// unit suite depends on. `installActivityRecorder({ leaderNameFor })` is the same
// arrangement the AI's rng and `calculateProbabilityPreBattle` already have, and it
// defaults to a function returning "" so a test -- or a spectated game -- gets entries
// with no leader on them rather than a crash.
//
// The name is read AT THE MOMENT OF THE EVENT and stored on the entry. Leaders die
// every 15-20 turns, so resolving one when the card is drawn would credit a turn-12
// conquest to whoever is in charge on turn 40. See the header of `activityLog.js`.
//
// This module imports only from `state/`, so it stays loadable in Node.

import { ActivityKind, recordActivity } from "./activityLog.js";
import { DiplomaticState, isAgreement } from "./diplomacy.js";
import { Events, on } from "./events.js";
import { playerCountryName } from "./selectors.js";

let installed = false;

/** Injected: country name -> the name of whoever rules it right now. */
let leaderNameFor = () => "";

/**
 * Start deriving entries from state events.
 *
 * Idempotent, because bootstrap is two halves that finish out of order and this is
 * called from the earlier one. Returns the uninstaller, which is what a test uses
 * to put the world back.
 *
 * @param {object} [deps]
 * @param {(country: string) => string} [deps.leaderNameFor]
 */
export function installActivityRecorder({ leaderNameFor: lookup } = {}) {
    //The lookup is taken even on a repeat call. Bootstrap installs this before the
    //CPU leaders exist and `gameTurnsLoop.js` is where the table lives, so refusing
    //to update it would pin the default forever.
    if (typeof lookup === "function") {
        leaderNameFor = lookup;
    }
    if (installed) {
        return () => {};
    }
    installed = true;

    const offTerritory = on(Events.TERRITORY_CHANGED, onTerritoryChanged);
    const offSiege = on(Events.SIEGE_CHANGED, onSiegeChanged);
    const offDiplomacy = on(Events.DIPLOMACY_CHANGED, onDiplomacyChanged);

    return () => {
        offTerritory();
        offSiege();
        offDiplomacy();
        installed = false;
    };
}

/**
 * A territory changed hands.
 *
 * `previous.dataName` is the country it was taken FROM and is why `updateTerritory()`
 * reports the values it overwrote -- by the time this runs the store only knows who
 * holds the territory now.
 *
 * Two changes are deliberately NOT conquests and both would otherwise be logged.
 * `initialiseGame()` sets the player's own starting territories to `owner: "Player"`
 * without touching `dataName`, so testing `dataName` rather than `owner` filters it
 * out; and a restore patches territories without emitting at all.
 */
function onTerritoryChanged({ territory, changed, previous }) {
    if (!changed?.includes("dataName")) {
        return;
    }
    const from = previous?.dataName;
    const to = territory?.dataName;
    if (!from || !to || from === to) {
        return;
    }

    const player = playerCountryName();
    recordActivity({
        kind: ActivityKind.CONQUEST,
        territory: territory.territoryName,
        defender: from,
        attacker: to,
        attackerLeader: safeLeaderName(to),
        defenderLeader: safeLeaderName(from),
        playerAttacking: to === player,
        playerDefending: from === player
    });
}

/**
 * A siege was added or removed.
 *
 * Only `add` is derived. A removal is handled by whichever caller removed it,
 * because "the siege is gone" does not say whether the besiegers were arrested,
 * stormed the place, or were thrown back -- and those are three different lines in
 * three different senses.
 */
function onSiegeChanged({ action, siege, territoryName, side }) {
    if (action !== "add" || !siege) {
        return;
    }

    const player = playerCountryName();
    const defender = siege.defendingTerritory?.dataName ?? siege.defendingCountry ?? "";
    const attacker = siege.attackingCountry ?? (side === "player" ? player : "");

    recordActivity({
        kind: ActivityKind.SIEGE_STARTED,
        territory: territoryName,
        defender: defender,
        attacker: attacker,
        playerAttacking: side === "player",
        playerDefending: siege.defendingTerritory?.owner === "Player"
    });
}

/**
 * A pair of countries changed diplomatic state (diplomacy stage 6).
 *
 * DERIVED FROM ONE EVENT RATHER THAN REPORTED FROM TEN CALL SITES, which is the division
 * this module's header draws and the reason a conquest cannot be missed by a new attack
 * route: `setRelationState()` is the one way the register is written, so every declaration,
 * every treaty and every alliance passes through here whether or not whoever wrote it
 * remembered the news. What the event cannot supply -- who acted, and by what route -- is
 * ANNOTATED on it as `by` and `via`, because a pair arriving at WAR looks identical whether
 * somebody declared, an ally answered a call to arms, or a ceasefire lapsed.
 *
 * TWO TRANSITIONS ARE DELIBERATELY NOT NEWS, and both would otherwise flood the log.
 *
 *   FIRST CONTACT. `diplomacyContacts.js` writes NEUTRAL for every pair whose borders have
 *   met, and a busy turn 1 walks something like 1,900 pairings. "Two countries can now see
 *   each other" is the map's geometry rather than an event, and fifty turns of it would
 *   flush every real entry out of the bounded ring.
 *
 *   A DROP TO NEUTRAL OUT OF NOTHING. A scenario, or a restore, can set a pair to neutral
 *   from neutral-adjacent states; only losing an AGREEMENT is a thing that happened.
 */
function onDiplomacyChanged(payload) {
    if (!payload || payload.replaced || !payload.state) {
        return;
    }
    const { a, b, state, previous, via = null, by = null, onBehalfOf = null } = payload;
    if (!a || !b || via === "contact") {
        return;
    }
    if (previous === DiplomaticState.NO_CONTACT && state === DiplomaticState.NEUTRAL) {
        return;
    }
    if (state === DiplomaticState.NEUTRAL && !isAgreement(previous)) {
        return;
    }

    const kind = diplomaticKind(state, previous, via);
    if (!kind) {
        return;
    }

    //WHO ACTED IS THE ACTOR AND THE OTHER SIDE IS THE SUBJECT, and when nobody acted -- a
    //ceasefire running out -- the pair is taken in the register's own canonical order. The
    //wording layer never says "X did this to Y" for those, precisely because nobody did.
    const actor = (by === a || by === b) ? by : null;
    const player = playerCountryName();
    const first = actor ?? a;
    const second = actor === b ? a : b;

    recordActivity({
        kind,
        territory: "",
        diplomacy: {
            //Null when nobody acted -- a ceasefire running out. `a` and `b` are always both
            //there, actor first when there is one, so a wording with no actor still has two
            //countries to name.
            actor: actor,
            a: first,
            b: second,
            from: previous ?? DiplomaticState.NO_CONTACT,
            to: state,
            via: via,
            onBehalfOf: onBehalfOf
        },
        //`playerAttacking` and `playerDefending` are how `involvesPlayer()` and the panel
        //decide what gets a card, so a diplomatic entry has to speak that vocabulary. Read
        //them here as "the player is the one who ACTED" and "the player is the one it was
        //done to" -- an agreement has no attacker, and inventing a third pair of flags for
        //one kind of entry would mean teaching `involvesPlayer()` about diplomacy.
        playerAttacking: Boolean(player) && first === player,
        playerDefending: Boolean(player) && second === player,
        attackerLeader: safeLeaderName(first),
        defenderLeader: safeLeaderName(second)
    });
}

/**
 * Which of the four diplomatic kinds this transition is, or null when it is not news.
 *
 * A BETRAYAL IS DERIVED AND NOT ANNOTATED, and that is the one judgement here. Going to war
 * out of an AGREEMENT is exactly what `betrayalPenalty` charges for -- `applyBreach()` is
 * called on that transition and on no other -- so asking the register is asking the same
 * question the penalty asks, rather than trusting a caller to have labelled it.
 */
function diplomaticKind(state, previous, via) {
    if (state === DiplomaticState.WAR) {
        return isAgreement(previous) ? ActivityKind.BETRAYAL : ActivityKind.DECLARATION;
    }
    if (state === DiplomaticState.ALLIANCE) {
        return ActivityKind.ALLIANCE;
    }
    if (state === DiplomaticState.NEUTRAL) {
        //An agreement was lost: a call declined, a dissolution, or somebody else's breach
        //taking this one down with it. Which of the three is `via`.
        return previous === DiplomaticState.ALLIANCE
            ? ActivityKind.ALLIANCE
            : ActivityKind.TREATY;
    }
    if (state === DiplomaticState.CEASEFIRE || state === DiplomaticState.PEACE) {
        return ActivityKind.TREATY;
    }
    return null;
}

// --- the explicit half -----------------------------------------------------

/**
 * The leader of a country, or "" -- never a throw.
 *
 * The lookup reaches game code that is built in a different half of bootstrap from
 * this one, and an entry with no leader on it costs the player a clause in a
 * sentence. An exception here would cost them the conquest.
 */
function safeLeaderName(country) {
    if (!country) {
        return "";
    }
    try {
        return leaderNameFor(country) ?? "";
    } catch {
        return "";
    }
}

/**
 * A disaster struck the player's territories this turn (register E3).
 *
 * ONE call per disaster per turn, made after the income pass has finished rolling
 * against every territory -- see the note on `ActivityKind.DISASTER`. `territoriesHit`
 * is what makes the headline: "Famine strikes" reads very differently at one
 * territory and at thirty.
 *
 * @param {{event: string, territory: string, territoriesHit: number}} what
 *        `territory` is the WORST-hit one, which is what the card names.
 */
export function recordDisaster({ event, territory, territoriesHit }) {
    if (!event || !Number.isFinite(territoriesHit) || territoriesHit < 1) {
        return null;
    }
    return recordActivity({
        kind: ActivityKind.DISASTER,
        territory: territory ?? "",
        defender: playerCountryName(),
        event: event,
        territoriesHit: territoriesHit,
        //A disaster is only ever recorded for the player -- a famine in Peru is not
        //something the player has any way of knowing about, and recording the other
        //206 countries' would be 206 entries a turn nobody can act on.
        playerDefending: true
    });
}

/**
 * The state of the nation at the top of a turn (register item E7).
 *
 * `turn` is passed in rather than defaulted, because a briefing belongs to the turn that has
 * just ENDED -- see the note on `ActivityKind.BRIEFING`. Getting that wrong is invisible: the
 * entry is stored, the panel renders, and the player simply never sees it until a turn later.
 *
 * @param {{briefing: object, turn: number}} what
 */
export function recordBriefing({ briefing, turn }) {
    if (!briefing || !Number.isFinite(turn) || turn < 1) {
        return null;
    }
    return recordActivity({
        kind: ActivityKind.BRIEFING,
        territory: "",
        defender: playerCountryName(),
        briefing,
        turn,
        //Always the player's own news; there is no such thing as somebody else's briefing.
        playerDefending: true
    });
}

/**
 * An attack was fought and the territory did not change hands.
 *
 * @param {{territory: string, defender: string, attacker: string,
 *          playerAttacking?: boolean, playerDefending?: boolean}} what
 */
export function recordFailedAttack(what) {
    return recordActivity({
        kind: ActivityKind.ATTACK_FAILED,
        attackerLeader: safeLeaderName(what?.attacker),
        defenderLeader: safeLeaderName(what?.defender),
        ...what
    });
}

/** A siege ended because the besieging army was arrested. */
export function recordSiegeLifted(what) {
    return recordActivity({ kind: ActivityKind.SIEGE_LIFTED, ...what });
}

/** A siege became a battle. `besiegerWon` picks which of the two lines is written. */
/**
 * A besieging country gave up and marched its army home (`src/ai/siegeReview.js`).
 *
 * Explicit for the same reason every other siege ending is: `SIEGE_CHANGED` fires for the
 * removal, but a removal alone cannot say which of the four endings this was.
 */
export function recordSiegeAbandoned(what) {
    return recordActivity({ kind: ActivityKind.SIEGE_ABANDONED, ...what });
}

export function recordSiegeResolved({ besiegerWon, ...what }) {
    return recordActivity({
        kind: besiegerWon ? ActivityKind.SIEGE_WON : ActivityKind.SIEGE_LOST,
        ...what
    });
}

/**
 * One line per siege still running, at the start of a turn.
 *
 * Called once from `beginTurn()` with both lists, rather than from
 * `incrementSiegeTurns()` -- which runs twice, and is a rule rather than a
 * narrator. A siege that started this turn is skipped: it already has a "lays
 * siege to" line above, and following it immediately with "still besieged, turn 1"
 * reads as a stutter.
 *
 * @param {Array<{side: "player"|"ai", territoryName: string, siege: object}>} running
 */
export function recordOngoingSieges(running) {
    const player = playerCountryName();
    const written = [];
    for (const { side, territoryName, siege } of running ?? []) {
        const turns = Number(siege?.turnsInSiege) || 0;
        if (turns < 2) {
            continue;
        }
        written.push(
            recordActivity({
                kind: ActivityKind.SIEGE_ONGOING,
                territory: territoryName,
                defender: siege.defendingTerritory?.dataName ?? siege.defendingCountry ?? "",
                attacker: siege.attackingCountry ?? (side === "player" ? player : ""),
                playerAttacking: side === "player",
                playerDefending: siege.defendingTerritory?.owner === "Player",
                turnsUnderSiege: turns
            })
        );
    }
    return written.filter(Boolean);
}
