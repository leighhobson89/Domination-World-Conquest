// Dice: how many you roll, what you roll, and who wins each pairing.
//
// Battle overhaul B.1. Pure, with the RNG injected, and deliberately knowing NOTHING about
// this game -- no armies, no territories, no unit types. It takes a share and gives a count;
// it takes two lists of faces and says who lost how many pairings. Everything that makes those
// numbers mean something is in `battleModel.js`.
//
// That separation is what lets the whole of the model be tested with plain numbers, and it is
// what lets `DiceStage` render a round without importing a single game rule.

import {
    DEFENDER_DICE_CAP,
    DICE_SHARE_BANDS,
    DIE_FACES,
    MODIFIER_CLAMP
} from "../../config/balance.js";

/**
 * How many dice a side rolls, given its own share of the two strengths.
 *
 * The bands are ordered high to low, so the first one the share reaches is the answer. A share
 * outside 0..1 is clamped rather than rejected: the caller computes it as a ratio of two
 * strengths and a zero-strength defender would otherwise produce NaN here rather than at the
 * site that actually has something sensible to say about it.
 *
 * @param {number} share  0..1
 * @param {{cap?: number}} [options]
 * @returns {number} 1..5
 */
export function diceCountFor(share, options = {}) {
    const clamped = Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 0;
    const band = DICE_SHARE_BANDS.find((row) => clamped >= row.minimumShare);
    const dice = band ? band.dice : 1;
    return options.cap === undefined ? dice : Math.min(dice, options.cap);
}

/** The defender's count: the same table, capped. */
export function defenderDiceCountFor(share) {
    return diceCountFor(share, { cap: DEFENDER_DICE_CAP });
}

/**
 * Roll `count` dice.
 *
 * @param {number} count
 * @param {() => number} rng  a draw in [0, 1)
 * @returns {number[]} faces, 1..DIE_FACES, in the order rolled
 */
export function rollDice(count, rng) {
    const faces = [];
    for (let die = 0; die < count; die++) {
        faces.push(1 + Math.floor(rng() * DIE_FACES));
    }
    return faces;
}

/** A side's modifier, clamped. Exported so the ledger and the resolver agree on the ceiling. */
export function clampModifier(modifier) {
    return Math.max(-MODIFIER_CLAMP, Math.min(MODIFIER_CLAMP, modifier));
}

/**
 * Compare two sets of dice.
 *
 * Both sides' faces are modified, sorted descending, and paired off high against high. The
 * loser of a pairing loses a pairing; TIES GO TO THE DEFENDER, which is the defender's whole
 * built-in edge and is why no separate "defensive bonus" number is needed on top of terrain.
 *
 * Dice the other side cannot match are AUTOMATIC hits. Without that rule scale stops mattering
 * once the dice counts diverge -- a five-against-one fight would be one pairing a round, and an
 * overwhelming attack would take twenty rounds to land instead of two.
 *
 * The per-pairing detail is returned as well as the totals, because the round log and the dice
 * stage both render it and neither should have to re-derive who beat whom.
 *
 * @param {number[]} attackerFaces  raw faces, unmodified and unsorted
 * @param {number[]} defenderFaces  raw faces, unmodified and unsorted
 * @param {number} [attackerModifier]
 * @param {number} [defenderModifier]
 */
export function resolvePairings(attackerFaces, defenderFaces, attackerModifier = 0, defenderModifier = 0) {
    const attackerBonus = clampModifier(attackerModifier);
    const defenderBonus = clampModifier(defenderModifier);

    const attackers = attackerFaces
        .map((face) => ({ face, value: face + attackerBonus }))
        .sort((a, b) => b.value - a.value);
    const defenders = defenderFaces
        .map((face) => ({ face, value: face + defenderBonus }))
        .sort((a, b) => b.value - a.value);

    const contested = Math.min(attackers.length, defenders.length);
    const pairings = [];
    let attackerLosses = 0;
    let defenderLosses = 0;

    for (let index = 0; index < contested; index++) {
        const attacker = attackers[index];
        const defender = defenders[index];
        const attackerWins = attacker.value > defender.value;
        if (attackerWins) {
            defenderLosses++;
        } else {
            attackerLosses++;
        }
        pairings.push({
            attackerFace: attacker.face,
            defenderFace: defender.face,
            attackerValue: attacker.value,
            defenderValue: defender.value,
            attackerWins,
            tied: attacker.value === defender.value,
            unmatched: false
        });
    }

    // Whatever one side rolled that the other could not answer.
    for (let index = contested; index < attackers.length; index++) {
        defenderLosses++;
        pairings.push({
            attackerFace: attackers[index].face,
            defenderFace: null,
            attackerValue: attackers[index].value,
            defenderValue: null,
            attackerWins: true,
            tied: false,
            unmatched: true
        });
    }
    for (let index = contested; index < defenders.length; index++) {
        attackerLosses++;
        pairings.push({
            attackerFace: null,
            defenderFace: defenders[index].face,
            attackerValue: null,
            defenderValue: defenders[index].value,
            attackerWins: false,
            tied: false,
            unmatched: true
        });
    }

    return {
        pairings,
        attackerLosses,
        defenderLosses,
        attackerModifier: attackerBonus,
        defenderModifier: defenderBonus
    };
}

/**
 * The chance the attacker wins one CONTESTED pairing, by exact enumeration.
 *
 * Used by the ledger to explain a matchup without rolling anything, and by the unit tests to
 * check the resolver against the maths rather than against itself. Enumerates both sides' full
 * face space, so it is only sensible for the counts this game uses -- at 5 and 4 dice that is
 * 6^9, far too many, so it is deliberately restricted to a SINGLE pairing at a given rank.
 *
 * @param {number} attackerModifier
 * @param {number} defenderModifier
 * @returns {number} 0..1
 */
export function contestedPairingOdds(attackerModifier = 0, defenderModifier = 0) {
    const attackerBonus = clampModifier(attackerModifier);
    const defenderBonus = clampModifier(defenderModifier);
    let wins = 0;
    for (let a = 1; a <= DIE_FACES; a++) {
        for (let d = 1; d <= DIE_FACES; d++) {
            if (a + attackerBonus > d + defenderBonus) {
                wins++;
            }
        }
    }
    return wins / (DIE_FACES * DIE_FACES);
}
