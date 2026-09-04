// How the chosen goal changes the way the AI plays.
//
// `src/ai/victory.js` says what winning MEANS and measures how far along everybody is.
// This says what to DO about it, and it is the only module in `src/ai/` allowed to switch
// on a `VictoryCondition` kind.
//
// That restriction is the whole point of the seam. Before it existed, `chooseObjective()`
// in `strategy.js` was the single place the condition was consumed and all it did was turn
// the kind into a number of continents -- CONTINENTAL gave its own figure, DOMINATION gave
// four, everything else gave two. A country playing a Great Powers game campaigned for two
// arbitrary continents and never looked at a great power. Adding a sixth goal meant finding
// every `switch` in the AI and adding a case to it, and missing one had no signature at all:
// nothing throws, every turn completes, and the goal simply does not happen.
//
// So a DOCTRINE is the small set of dials the existing modules already think in terms of:
//
//   continentsToCommit  what `chooseObjective()` commits to. `Infinity` means "as many as
//                       the map has" and is clamped where it is read.
//   areaHunger          how much a target's raw LAND is worth on top of what
//                       `territoryValue()` already says about it. Domination and a Timed
//                       Game are scored in area; Continental Supremacy is not.
//   targetCountries     the countries this goal is ABOUT. Only Great Powers has any.
//   urgency             0..1. How much of a hurry everybody is in -- see below.
//   neverSatisfied      the goal has no resting point, so a posture must never settle.
//
// The rows live in `goalDoctrines` in `config/balance.js`, one per goal with a sentence
// each, so tuning a goal's character is a balance edit rather than a code edit.
//
// URGENCY IS THE RUNAWAY-LEADER RESPONSE, and it is the most valuable thing here. It is the
// strongest RIVAL's share of the world's land area, which means a player who pulls ahead
// starts getting attacked harder by everybody -- a difficulty curve the AI could not
// previously have, because no country had any idea how anybody else was doing. It costs one
// pass that `worldStandings()` has already made; asking `victoryProgress()` for every rival
// of every country would be 207 x 207 walks of the map per turn.
//
// A Timed Game takes its urgency from the clock instead: there is nothing to conserve on the
// last turn, and the deadline is the thing that actually ends that game.
//
// ONE TRAP, ALREADY PAID FOR ONCE. Urgency scales the ATTACK budget and never the siege
// budget, and this module deliberately offers no siege dial at all so that it cannot. The
// siege budget subtracting the sieges already running is what ended the
// seventeen-to-sixty-seven concurrent sieges problem, and a multiplier over that cap walks
// straight back into it. `tests/unit/ai-doctrine.spec.js` asserts that no key here matches
// /siege/.
//
// Pure: `config/` and `victory.js`, which is itself pure. It runs in Node.

import { doctrineUrgency, goalDoctrines } from "../config/balance.js";
import { greatPowerStandingsFor, VictoryCondition } from "./victory.js";

/**
 * standings -> Map(country -> land-area share), and the two largest shares.
 *
 * Memoised on the standings OBJECT rather than on the turn, because the standings are
 * already built once per turn and handed to every country -- keying on identity means the
 * memo cannot outlive the thing it describes, and a caller that builds fresh standings
 * mid-turn (the unit tests do) gets a fresh answer rather than a stale one.
 */
const shareCache = new WeakMap();

function sharesOf(standings) {
    if (!standings?.byCountry) {
        return { shares: new Map(), first: null, second: null };
    }
    const cached = shareCache.get(standings);
    if (cached) {
        return cached;
    }

    const worldArea = Number(standings.worldArea) || 0;
    const shares = new Map();
    //The two largest, not a sort: the strongest rival of any country is the largest empire
    //unless that country IS the largest, in which case it is the second largest. Two
    //running maxima answer that for all 207 countries in one pass.
    let first = null;
    let second = null;

    for (const [country, holding] of standings.byCountry) {
        const share = worldArea === 0 ? 0 : (Number(holding.area) || 0) / worldArea;
        shares.set(country, share);
        if (first === null || share > first.share) {
            second = first;
            first = { country, share };
        } else if (second === null || share > second.share) {
            second = { country, share };
        }
    }

    const answer = { shares, first, second };
    shareCache.set(standings, answer);
    return answer;
}

/**
 * How much of a hurry `country` is in, given who else is winning.
 *
 * Exported in its own right so the simulator and the debug panel can ask the world's
 * question without building a doctrine to get at the answer.
 *
 * @param {string} country
 * @param {object} standings from `worldStandings()`
 * @returns {number} 0..1, never below `doctrineUrgency.floor`
 */
export function urgencyFor(country, standings) {
    const { first, second } = sharesOf(standings);
    //A country is never its own reason to hurry. The largest empire in the world is the one
    //country with nothing to fear from the largest empire in the world.
    const rival = first && first.country !== country ? first : second;
    const share = rival?.share ?? 0;
    const full = doctrineUrgency.rivalShareForFull > 0
        ? doctrineUrgency.rivalShareForFull
        : 1;
    return clamp01(Math.max(doctrineUrgency.floor, share / full));
}

/**
 * The doctrine for one country under one condition, on one turn.
 *
 * Called once per country per turn from `planCampaign()`, which already has the standings
 * and the progress and passes both in rather than making this module recompute them.
 *
 * @param {object} condition the active victory condition
 * @param {{progress?: object, turn?: number, standings?: object, country?: string}} context
 * @returns {{kind: string, continentsToCommit: number, areaHunger: number,
 *            targetCountries: string[], urgency: number, neverSatisfied: boolean}} frozen
 */
export function doctrineFor(condition, context = {}) {
    const kind = Object.values(VictoryCondition).includes(condition?.kind)
        ? condition.kind
        : VictoryCondition.CONTINENTAL;
    //An unknown kind falls back to the Continental row rather than to nothing: a doctrine of
    //zeroes is a country that stops playing, and the point of the fallback is that a goal
    //nobody has written a row for still produces an AI that fights.
    const row = goalDoctrines[kind] ?? goalDoctrines[VictoryCondition.CONTINENTAL];
    const country = context.country ?? "";
    const standings = context.standings ?? null;
    const turn = Number(context.turn) || 0;

    return Object.freeze({
        kind,
        //`null` in the row means "whatever the condition itself asks for", which is only
        //CONTINENTAL -- the one goal whose scale IS a continent count.
        continentsToCommit: row.continentsToCommit === null
            ? positiveOr(condition?.continentsRequired, 3)
            : row.continentsToCommit,
        areaHunger: row.areaHunger,
        targetCountries: targetsFor(kind, country, condition, standings),
        urgency: kind === VictoryCondition.TURN_LIMIT
            //The clock, not the standings. `turnLimit` is a positive integer by the time
            //`setVictoryCondition()` has been through it, but this module is also called
            //with hand-written conditions from the unit suite.
            ? clamp01(turn / positiveOr(condition?.turnLimit, 200))
            : urgencyFor(country, standings),
        neverSatisfied: Boolean(row.neverSatisfied)
    });
}

/**
 * The great powers this country still has to break, or an empty list.
 *
 * Powers this country has already broken are dropped, so a country three-quarters of the
 * way through a Great Powers game concentrates on what is left rather than continuing to
 * weight territory it already holds. The country itself is never listed -- that is the rule
 * in `greatPowerStandingsFor()` that stops a great power beginning a five-power game a fifth
 * of the way to winning, and it holds here for the same reason.
 *
 * These are the POWERS, not whoever currently holds their ground. `theatre.js` biases the
 * neighbour it commits to absorbing towards this list, and `targeting.js` weights any
 * territory whose `originalOwner` is on it -- which is what keeps the goal achievable when a
 * third party takes half of the United States first: those territories are still the ones
 * worth having, and taking them becomes a different war rather than an impossible one.
 */
function targetsFor(kind, country, condition, standings) {
    if (kind !== VictoryCondition.GREAT_POWERS || !standings) {
        return Object.freeze([]);
    }
    const { rows } = greatPowerStandingsFor(country, condition, standings);
    return Object.freeze(rows.filter(row => !row.complete).map(row => row.power));
}

function positiveOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp01(value) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
