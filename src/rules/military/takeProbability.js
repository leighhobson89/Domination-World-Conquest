// The odds a DECISION is taken on: the chance the attacker actually takes the territory.
//
// Combat phase stage 1, closing known-issue C1. Before this, every AI odds floor, the
// commitment sizing and the siege gate read `winProbability()` -- a ratio of two strengths
// built over `defenseMultiplierFor()`, a multiplier the battle does not use, and which knows
// nothing about dice, bands, ties or unmatched hits. Measured against the real model over the
// real map its error ran +95 to -77 percentage points AND CHANGED SIGN ON FORTIFICATION: it
// over-rated an attack on unfortified mountain and under-rated one on a fortress. No constant
// tunes that out, which is why this is a new function and not a correction to that one.
//
// THE RULE THIS FILE EXISTS TO KEEP: there is one combat model, and the number the AI decides
// on is produced by playing THAT model. This is not an approximation of the dice model and it
// must never become one -- `docs/05-combat-and-conquest-audit.md` section 7.1, and the reason
// `doAttack()`'s separate resolver was deleted. Every answer here comes out of
// `battleForecast()`, which runs `resolveBattle()`.
//
// WHY A CACHE
//
// A forecast is hundreds of battles. The AI weighs about 1,600 pairings a turn and
// `sizeCommitment()` walks a four-rung ladder over each, so a naive swap is roughly six
// thousand forecasts -- over a million battles -- in one AI turn. That is not affordable.
//
// It does not have to be paid, because the model's outcome depends on far less than the setup
// does. Casualties are multiplicative -- each lost pairing takes a fixed FRACTION of that
// side's current force -- so the armies only ever move by scale factors, `share` is a monotone
// function of their ratio, and the break test is against each side's OWN starting force and so
// is scale-free too. Two setups with the same opening share, the same fortification dice
// penalty and the same face modifiers therefore play out as the same battle.
//
// MEASURED, and this is the part that was nearly got wrong. At a fixed seed and a fixed ratio,
// the take probability is IDENTICAL from a defending force of 2,000 upward and differs below it
// -- the integer floor in `applyCasualties()`, which is a larger fraction of a small army than
// the casualty share is. That much was expected. The THRESHOLD is not a constant of nature
// though: it was 2,000 until combat stage 3 lowered `PAIRING_CASUALTY_SHARE` from 0.10 to 0.07,
// which lengthens a battle and so gives the floor more rounds in which to bite -- that stage
// then settled on 0.09 and the threshold went back to 2,000, which is why the guard below sits
// at the worst value any candidate needed rather than tracking the dial. A unit test asserts
// the property directly, and it is what caught the move. What was not is that the face modifiers are
// only constant through a battle when the COUNTS are large: a side holding one air unit loses
// it to the floor in the first round and its air superiority with it, while a side holding a
// thousand keeps both. The gap between two setups that differ only in that scaling:
//
//     smallest non-zero unit count      1      2      5     10     25     50
//     worst gap in take probability   41.6   27.2    4.0    0.8    3.0    0.2  points
//
// So a single force threshold is not enough, and the fix is not a bigger threshold -- vehicle
// counts in this game are genuinely small, because they are gated by oil. Instead the key
// carries the exact counts of any unit type below `EXACT_COUNT_BELOW` and collapses everything
// at or above it to "many". That is exact where it matters and coarse where it does not, and
// it keeps the common case -- all-infantry, or vehicles in the hundreds -- on the small key.
//
// Pure and Node-runnable: it imports `config/` and three rules modules, and takes no rng of its
// own. `battleForecast()` seeds itself from the setup, deliberately off the game's stream, so
// asking this question never moves the battle that follows.

import { modifiersFor, shareFor } from "./battleModel.js";
import { battleForecast } from "./forecast.js";
import { combinedForce } from "./units.js";

/**
 * Trials behind one cached cell.
 *
 * Lower than `FORECAST_TRIALS` (500) because this figure is compared against odds floors in
 * whole percentage points rather than shown to one decimal place. The standard error on a
 * proportion at p = 0.5 and n = 200 is 3.5 points, well inside the +/-10 the phase gate asks
 * -- and a cell is computed once and read thousands of times, so the cost is paid once per
 * SHAPE of battle rather than once per question.
 */
export const TAKE_PROBABILITY_TRIALS = 200;

/**
 * How finely the opening share is bucketed.
 *
 * 0.01 gives 101 buckets: finer than the dice bands by an order of magnitude, so two shares in
 * one bucket are always in the same band; coarser than the noise floor of 200 trials, so a
 * finer bucket would only be measuring its own sampling error.
 */
const SHARE_BUCKET = 0.01;

/**
 * Unit counts below this go into the key EXACTLY; at or above it they collapse to "many".
 *
 * Ten, from the table above: below five the same cell can hold answers 40 points apart, and by
 * ten the drift is under a point. It is not raised further because vehicles are gated by oil
 * and are routinely in single or double figures, so a high threshold would put most of the
 * game's real armies into distinct cells and defeat the cache.
 */
const EXACT_COUNT_BELOW = 10;

/**
 * Below this combined force the integer casualty floor stops the battle being scale-free.
 *
 * Measured, not chosen: at a fixed seed and ratio the answer is identical from here upward.
 * It is deliberately an order of magnitude above the measured threshold, because that threshold
 * MOVES with `PAIRING_CASUALTY_SHARE`: a smaller share means more rounds and so more chances for
 * the floor to bite. Measured at 0.10 the answer is stable from 2,000; at 0.07 it needed 20,000;
 * combat stage 3 settled on 0.09 and it is back to 2,000. Rather than track it, the guard sits at
 * the highest value any of those needed -- it costs only that a battle under 20,000 combined
 * force is forecast rather than looked up, and the AI's battles are in the hundreds of thousands.
 * **Re-measure if that dial moves further**: any fixed-seed forecast run at two scales shows it.
 */
const MIN_CACHEABLE_FORCE = 20000;

/**
 * Cells kept. A long game touches a few hundred; the cap is a guard against a pathological
 * spread of small-count signatures, not an expected condition. Past it the answer is still
 * correct, it is simply computed every time.
 */
const MAX_CELLS = 20000;

const cache = new Map();
let hits = 0;
let misses = 0;
let uncacheable = 0;

/** An army's shape for keying: exact where the floor bites, "m" where it does not. */
function countSignature(army) {
    let signature = "";
    for (let index = 0; index < 4; index++) {
        const count = army[index] ?? 0;
        signature += (count >= EXACT_COUNT_BELOW ? "m" : String(count)) + ".";
    }
    return signature;
}

/** The numbers that decide the battle, as one string. */
function cellKeyFor(share, modifiers, attackers, defenders) {
    return Math.round(share / SHARE_BUCKET) + "|" +
        modifiers.attacker.diceChange + "|" +
        modifiers.attacker.total + "|" +
        modifiers.defender.total + "|" +
        countSignature(attackers) + countSignature(defenders);
}

/**
 * The attacker's chance of TAKING the territory, as a percentage.
 *
 * The same signature as `winProbability()`, so it is a drop-in at every call site that was
 * reading that as a probability -- which was all of them.
 *
 * @param {number[]} attackers  army array
 * @param {number[]} defenders  army array, the defender's USEABLE counts
 * @param {object} territory    the defending territory
 * @param {{attackingDevelopmentIndex?: number, combatContinentModifier?: number}} [context]
 * @param {{siegeTurns?: number, trials?: number}} [options]
 * @returns {number} 0..100
 */
export function takeProbability(attackers, defenders, territory, context = {}, options = {}) {
    const attackingForce = combinedForce(attackers);
    const defendingForce = combinedForce(defenders);

    //Two RESOLVED cases, not uncertain ones. `winProbability()` carries the same pair and for
    //the same reason: without them the caller gets a NaN and every later round inherits it.
    if (attackingForce <= 0) {
        return 0;
    }
    if (defendingForce <= 0) {
        return 100;
    }

    const siegeTurns = options.siegeTurns ?? 0;
    const setup = { attackers, defenders, territory, context, siegeTurns };

    if (attackingForce < MIN_CACHEABLE_FORCE || defendingForce < MIN_CACHEABLE_FORCE) {
        uncacheable++;
        return forecastPercent(setup, options.trials);
    }

    const share = shareFor(attackers, defenders, territory, context);
    const modifiers = modifiersFor(attackers, defenders, territory, { siegeTurns });
    const key = cellKeyFor(share, modifiers, attackers, defenders);

    const known = cache.get(key);
    if (known !== undefined) {
        hits++;
        return known;
    }

    misses++;
    const answer = forecastPercent(setup, options.trials);
    if (cache.size < MAX_CELLS) {
        cache.set(key, answer);
    }
    return answer;
}

function forecastPercent(setup, trials) {
    return battleForecast(setup, { trials: trials ?? TAKE_PROBABILITY_TRIALS })
        .takeProbability * 100;
}

/**
 * What the cache has been doing.
 *
 * Exposed because the whole justification for this file is that the miss rate collapses after
 * the opening turns, and a claim like that should be checkable rather than asserted. The unit
 * suite and `tools/combat-lab.mjs` both read it.
 */
export function takeProbabilityCacheStats() {
    return { cells: cache.size, hits, misses, uncacheable };
}

/** Empty it. For the unit suite, so one spec's cells cannot answer another's question. */
export function clearTakeProbabilityCache() {
    cache.clear();
    hits = 0;
    misses = 0;
    uncacheable = 0;
}
