// Leaders die, and the country that replaces one gets to think again.
//
// THE PROBLEM THIS EXISTS FOR. A country's character is drawn once, at the start of the game,
// and never changes for the rest of it. A pacifist with `risk_taking` of 0.05 holds a heavy
// reserve on every border for two hundred turns, cannot raise a force ratio worth attacking
// at, writes off each neighbour in turn as a wall, and then sits. Its plans churn -- walls
// decay after fifteen turns, the theatre is reviewed every six -- but every retry re-derives
// the same arithmetic from the same traits and gets the same answer, so the churn is invisible
// and the country is frozen from about turn fifty onward.
//
// Measured after the risk-taking trait landed: the largest empire on the map reaches 71
// territories at turn 50 and is still on 71 at turn 150, while the world's army triples from
// 67M to 192M and its gold multiplies by five. **Everyone gets richer together, so the ratio
// between neighbours never moves**, and a stalemate between two comparable countries is
// permanent by construction. Nothing in the game could break one.
//
// A new leader can. A succession draws a fresh personality, so a country that has spent forty
// turns being cautious may spend the next forty being reckless -- and a reckless leader holds
// a thinner border, reaches a force ratio the last one could not, and attacks a neighbour that
// had been safe for a century. That is the shake-up, and it is aimed at variety and at
// deadlock in equal measure.
//
// WHY IT IS STATELESS. The obvious implementation keeps a tenure clock per country and
// registers a save slice for it. This does not: a country's term is derived from a hash of its
// name, so the schedule is a pure function of (country, turn). Three things fall out of that
// for free. It survives save and load with no slice to write, restore or forget. It STAGGERS
// by construction -- two hundred leaders do not all die on turn 35, which would be a visible
// pulse in the world rather than a background process. And it is trivially testable in Node
// with no fixture at all.
//
// Pure: it imports the balance numbers and nothing else, and it decides only WHEN. Drawing the
// new leader and writing it onto the territories is the caller's job, because the generator
// lives in `cpuPlayerGenerationAndLoading.js` and reaches the store.

import { leaderSuccession } from "../config/balance.js";

/**
 * A small, stable, well-spread hash of a country name.
 *
 * FNV-1a. It has to be stable across runs and machines -- the schedule is derived from it, so
 * a hash that varied would make a saved game resume onto a different succession timetable --
 * and it has to spread names that share prefixes, because this map is full of them ("United
 * States", "United Kingdom") and a weak hash would retire them on the same turn.
 */
function hashOf(country) {
    let hash = 0x811c9dc5;
    const name = String(country ?? "");
    for (let index = 0; index < name.length; index++) {
        hash ^= name.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

/**
 * How long this country's leaders serve, in turns.
 *
 * Derived rather than drawn, so it does not touch the game's random stream: adding a draw here
 * would move every seeded outcome in the game (see the `generateDistinctRGBs()` gotcha in
 * `CLAUDE.md`) and would do it once per country per succession.
 *
 * @returns {number} a term inside [minimumTermTurns, maximumTermTurns]
 */
export function termFor(country) {
    const tuning = leaderSuccession;
    const span = Math.max(1, tuning.maximumTermTurns - tuning.minimumTermTurns + 1);
    return tuning.minimumTermTurns + (hashOf(country) % span);
}

/**
 * The turn on which this country's leader is next replaced, at or after `turn`.
 *
 * Exposed for the AI log and the spectator console: "Chancellor Adler, 12 turns from the end
 * of her term" is a sentence a person watching a game can do something with, and it costs
 * nothing to derive.
 */
export function nextSuccessionTurn(country, turn) {
    const term = termFor(country);
    const offset = hashOf(country) % term;
    const from = Math.max(Number(turn) || 0, leaderSuccession.firstPossibleTurn);
    //The first turn >= `from` that is congruent to `offset` modulo the term.
    const ahead = ((offset - from) % term + term) % term;
    return from + ahead;
}

/**
 * Does this country's leader die at the end of this turn?
 *
 * Nothing happens before `firstPossibleTurn`: the opening of a game is when a country's
 * personality is doing the most work -- who it commits to, what it builds -- and replacing a
 * leader in the middle of that would read as the plan being lost rather than changed.
 *
 * @param {string} country
 * @param {number} turn
 * @returns {boolean}
 */
export function isSuccessionTurn(country, turn) {
    const now = Number(turn);
    if (!Number.isFinite(now) || now < leaderSuccession.firstPossibleTurn) {
        return false;
    }
    const term = termFor(country);
    return now % term === hashOf(country) % term;
}

/**
 * Every country whose leader dies this turn, out of the ones offered.
 *
 * Takes the list rather than reaching for the store, so it runs in Node.
 *
 * @param {string[]} countries
 * @param {number} turn
 * @returns {string[]}
 */
export function successionsDueOn(countries, turn) {
    return (countries ?? []).filter((country) => isSuccessionTurn(country, turn));
}
