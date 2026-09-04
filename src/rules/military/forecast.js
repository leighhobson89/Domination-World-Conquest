// What the attack screen tells you before you commit.
//
// Battle overhaul B.2. Pure, and it runs the REAL model -- `resolveBattle()` from
// `battleModel.js`, several hundred times -- rather than a closed-form approximation of it.
// That is deliberate: an approximation is a second model, and a second model is something that
// can disagree with the first. The number the player is shown is the number they will get,
// measured by playing the battle out.
//
// WHY NOT THE OLD PROBABILITY BAR. `winProbability()` answers "what is the attacker's share of
// the two strengths", and today that one number does two jobs: it is shown to the player AND it
// is the per-skirmish coin-flip odds. It is honest at neither. A 62% bar over a battle the
// attacker loses two times in three is exactly what docs/archived/battle_overhaul.md section 2.3 is
// about. Here the two jobs are separated: `shareFor()` picks dice counts, and this file answers
// the player's actual question, which is "will I take it, how long will it take, and what will
// I have left".
//
// THE RNG. A dedicated mulberry32, seeded from a stable hash of the setup. Three consequences,
// all of them load-bearing:
//
//   * It never touches `Math.random`, so calling it does not advance the game's stream. The
//     attack window recomputes this on EVERY plus and minus press; on the game's stream that
//     would make the eventual battle depend on how many times the player nudged the allocation,
//     which is the same class of bug as audit 5.3 Y.
//   * Seeding it from the setup rather than the clock makes the figure STABLE. A forecast that
//     flickers between 66% and 69% while the player holds the plus button reads as noise, and
//     the player cannot tell it apart from the effect of the units they are adding.
//   * It is not the stream the battle will actually be fought on. The forecast is a prediction,
//     not a promise, and a player who takes a 70% fight and loses has not been cheated.

import { MAX_BATTLE_ROUNDS } from "../../config/balance.js";
import { BattleState, attackerTookIt, resolveBattle } from "./battleModel.js";
import { combinedForce } from "./units.js";

/** How many battles a forecast plays out. See `FORECAST_TRIALS` note below. */
const FORECAST_TRIALS = 500;

/**
 * 500 is where the error stops mattering to a percentage shown to one decimal place. The
 * standard error on a proportion is sqrt(p(1-p)/n), so at p = 0.5 and n = 500 it is 2.2
 * points -- close enough that the displayed figure moves by less than a band edge, and cheap
 * enough (about 500 x 8 rounds x 9 dice = 36,000 draws) to run on every keystroke.
 */
export { FORECAST_TRIALS };

/** mulberry32. The same generator as `src/platform/cosmeticRng.js` and `src/ai/rng.js`. */
function makeRng(seed) {
    let state = seed >>> 0;
    return function forecastRandom() {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), state | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * A stable seed for a given setup: FNV-1a over the numbers that decide the battle.
 *
 * Only things the model actually reads go in. Adding the territory NAME would be wrong -- two
 * identical fights should forecast identically -- and adding the turn number would put the
 * flicker back.
 */
export function forecastSeedFor(setup) {
    const territory = setup.territory ?? {};
    const parts = [
        ...setup.attackers,
        ...setup.defenders,
        territory.defenseBonus ?? 0,
        territory.mountainDefenseBonus ?? 0,
        Math.round(territory.area ?? 0),
        territory.isCoastal ? 1 : 0,
        Math.round((setup.context?.attackingDevelopmentIndex ?? 1) * 1000),
        Math.round((setup.context?.combatContinentModifier ?? 1) * 1000),
        setup.siegeTurns ?? 0
    ];
    let hash = 2166136261 >>> 0;
    for (const part of parts) {
        const value = Number.isFinite(part) ? Math.trunc(part) : 0;
        //Fold the whole 32-bit value in a byte at a time, so two setups differing only in a
        //high byte -- an army of 400,000 against one of 400,256 -- do not collide.
        for (let shift = 0; shift < 32; shift += 8) {
            hash ^= (value >>> shift) & 0xff;
            hash = Math.imul(hash, 16777619);
        }
    }
    return hash >>> 0;
}

/** The middle value of a sorted-in-place copy. */
function median(values) {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

/** The value below which `fraction` of the sorted values fall. */
function percentile(values, fraction) {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))));
    return sorted[index];
}

/**
 * Play the battle out `trials` times and report what happened.
 *
 * @param {{attackers: number[], defenders: number[], territory: object,
 *          context?: object, siegeTurns?: number}} setup
 * @param {{trials?: number, seed?: number, takeLastPush?: boolean}} [options]
 * @returns {{takeProbability: number, medianRounds: number, roundsRange: [number, number],
 *            expectedSurvivors: number, survivorsIfWon: number, outcomes: object,
 *            trials: number, seed: number}}
 */
export function battleForecast(setup, options = {}) {
    const trials = options.trials ?? FORECAST_TRIALS;
    const seed = options.seed ?? forecastSeedFor(setup);
    const rng = makeRng(seed);

    let taken = 0;
    let survivorsTotal = 0;
    let survivorsWhenWon = 0;
    const rounds = [];
    const outcomes = {
        [BattleState.DEFENDER_WIPED]: 0,
        [BattleState.DEFENDER_ROUTED]: 0,
        [BattleState.ATTACKER_WIPED]: 0,
        [BattleState.ATTACKER_BROKEN]: 0,
        [BattleState.STALEMATE]: 0
    };

    for (let trial = 0; trial < trials; trial++) {
        const result = resolveBattle(setup, rng, { takeLastPush: options.takeLastPush ?? true });
        outcomes[result.state] = (outcomes[result.state] ?? 0) + 1;
        rounds.push(result.records.length);

        const survivors = combinedForce(result.occupying ?? result.battle.attackers);
        survivorsTotal += survivors;
        if (attackerTookIt(result.state)) {
            taken++;
            survivorsWhenWon += survivors;
        }
    }

    return {
        takeProbability: taken / trials,
        medianRounds: median(rounds),
        //A range rather than a mean, because rounds are skewed: most battles are short and a
        //few grind. "4-9 rounds" is a truer thing to show than "5.8 rounds".
        roundsRange: [percentile(rounds, 0.1), percentile(rounds, 0.9)],
        expectedSurvivors: Math.round(survivorsTotal / trials),
        survivorsIfWon: taken > 0 ? Math.round(survivorsWhenWon / taken) : 0,
        outcomes,
        trials,
        seed,
        //A battle that regularly hits the cap is a bug, not a hard fight. Surfaced here so
        //`tools/battle-lab.mjs` can report it rather than it having to be inferred.
        stalemateRate: (outcomes[BattleState.STALEMATE] ?? 0) / trials,
        maxRounds: MAX_BATTLE_ROUNDS
    };
}
