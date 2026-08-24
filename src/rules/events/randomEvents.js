// The four disasters.
//
// Refactor plan Phase 5.2. Pure, with the RNG injected: nothing here reaches for
// `Math.random` on its own, which is what lets a test say "the mutiny lands" and get the
// mutiny landing.
//
// A disaster is drawn at most once a turn and applies to every territory, each of which
// gets its own coin flip for whether it is hit or escapes. The event also suppresses that
// turn's regeneration everywhere (see `rules/economy/income.js`) so the player has one turn
// to look at the damage before it starts healing.

import { RANDOM_EVENTS, randomEventLikelihood, randomEventSeverity } from "../../config/balance.js";

/**
 * Which stock each event damages, and what it does to it.
 *
 * Three of the four divide the stock; the mutiny multiplies it, because "lose a quarter of
 * your gold" reads better as a multiplication than as a division by 4/3.
 */
const EVENT_EFFECTS = {
    "Warehouse Fire": {
        field: "consMatsForCurrentTerritory",
        apply: (value) => value / randomEventSeverity.warehouseFireDivisor
    },
    "Oil Well Fire": {
        field: "oilForCurrentTerritory",
        apply: (value) => value / randomEventSeverity.oilWellFireDivisor
    },
    "Food Disaster": {
        field: "foodForCurrentTerritory",
        apply: (value) => value / randomEventSeverity.foodDisasterDivisor
    },
    "Mutiny": {
        field: "goldForCurrentTerritory",
        apply: (value) => Math.floor(value * randomEventSeverity.mutinyGoldMultiplier)
    }
};

/**
 * What this turn's disaster costs one territory.
 *
 * @param {object} territory
 * @param {{randomEventHappening: boolean, randomEvent: string, isSimulation?: boolean}} context
 * @param {() => number} [rng]
 * @returns {{field: string, from: number, to: number}|null} null when nothing happens --
 *          no event, a costing simulation, or the territory escaped harm
 */
export function randomEventDamageFor(territory, context, rng = Math.random) {
    if (!context.randomEventHappening || context.isSimulation) {
        return null;
    }
    const effect = EVENT_EFFECTS[context.randomEvent];
    if (!effect) {
        return null;
    }
    //audit 5.2 Q: `selectRandomEvent` returns "Warehouse Fire", and the construction-
    //materials branch tested for "Forest Fire" -- a name nothing produces. One of the four
    //disasters did nothing at all, and worse than nothing, because the turn's regeneration
    //and population change were suppressed anyway. The names come from one list now.
    if (rng() < randomEventSeverity.hitChance) {
        return null; //escaped harm
    }
    const from = territory[effect.field];
    return { field: effect.field, from: from, to: effect.apply(from) };
}

/**
 * Whether a disaster fires this turn, and the running probability for the next one.
 *
 * The chance climbs by a point every quiet turn and is compared against the MEAN of several
 * draws rather than a single one. Averaging pulls the draw towards the middle of the range,
 * so an event in the first turns is very unlikely and one by turn twenty close to certain --
 * a single draw would let a disaster land on turn 2 at a one-in-a-hundred chance and would
 * also let twenty quiet turns pass in a row.
 *
 * @param {number} probabilityPercent  the running probability carried between turns
 * @param {() => number} [rng]
 * @returns {{happening: boolean, nextProbabilityPercent: number}}
 */
export function rollRandomEventLikelihood(probabilityPercent, rng = Math.random) {
    const draws = Array.from({ length: randomEventLikelihood.samples }, () => rng());
    const mean = draws.reduce((sum, draw) => sum + draw, 0) / randomEventLikelihood.samples;

    if (mean <= probabilityPercent / 100) {
        return { happening: true, nextProbabilityPercent: randomEventLikelihood.startingProbabilityPercent };
    }
    return {
        happening: false,
        nextProbabilityPercent: probabilityPercent + randomEventLikelihood.incrementPerQuietTurn
    };
}

/** Draw one of the four disasters. */
export function selectRandomEvent(rng = Math.random) {
    return RANDOM_EVENTS[Math.floor(rng() * RANDOM_EVENTS.length)];
}
