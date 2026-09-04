// src/rules/military/dice.js -- battle overhaul B.1.
//
// The dice on their own: counts from a share, faces from an rng, and who wins a pairing.
// Nothing here knows what an army is, which is the whole reason this module was split out.
//
// Every test drives its own rng, so a branch is reached on purpose rather than waited for.

import { describe, expect, it } from "vitest";

import {
    clampModifier,
    contestedPairingOdds,
    defenderDiceCountFor,
    diceCountFor,
    resolvePairings,
    rollDice
} from "../../src/rules/military/dice.js";
import {
    DEFENDER_DICE_CAP,
    DICE_SHARE_BANDS,
    DIE_FACES,
    MODIFIER_CLAMP
} from "../../src/config/balance.js";

/** An rng that yields the given draws in order, then throws rather than silently repeating. */
function scriptedRng(draws) {
    let index = 0;
    return () => {
        if (index >= draws.length) {
            throw new Error(`scriptedRng ran out after ${draws.length} draws`);
        }
        return draws[index++];
    };
}

describe("diceCountFor", () => {
    it("gives the maximum at the top band and one at the bottom", () => {
        expect(diceCountFor(1)).toBe(5);
        expect(diceCountFor(0)).toBe(1);
    });

    it("is exact at every band edge -- the edge belongs to the higher band", () => {
        // The edges are what a player aims at in the attack window, so they are asserted from
        // the table rather than hard-coded: a change to the bands has to change this test.
        for (const band of DICE_SHARE_BANDS) {
            expect(diceCountFor(band.minimumShare)).toBe(band.dice);
        }
    });

    it("drops a die just below an edge", () => {
        expect(diceCountFor(0.7)).toBe(5);
        expect(diceCountFor(0.6999)).toBe(4);
        expect(diceCountFor(0.5)).toBe(4);
        expect(diceCountFor(0.4999)).toBe(3);
        expect(diceCountFor(0.35)).toBe(3);
        expect(diceCountFor(0.3499)).toBe(2);
        expect(diceCountFor(0.2)).toBe(2);
        expect(diceCountFor(0.1999)).toBe(1);
    });

    it("never returns zero, so the underdog always keeps a die", () => {
        for (let share = 0; share <= 1; share += 0.01) {
            expect(diceCountFor(share)).toBeGreaterThanOrEqual(1);
        }
    });

    it("clamps a share outside 0..1 rather than producing NaN", () => {
        expect(diceCountFor(-3)).toBe(1);
        expect(diceCountFor(17)).toBe(5);
        expect(diceCountFor(Number.NaN)).toBe(1);
        expect(diceCountFor(undefined)).toBe(1);
    });
});

describe("defenderDiceCountFor", () => {
    it("caps the defender below the attacker's maximum", () => {
        expect(defenderDiceCountFor(1)).toBe(DEFENDER_DICE_CAP);
        expect(DEFENDER_DICE_CAP).toBeLessThan(5);
    });

    it("does nothing at even strength -- both sides roll four", () => {
        expect(diceCountFor(0.5)).toBe(4);
        expect(defenderDiceCountFor(0.5)).toBe(4);
    });
});

describe("rollDice", () => {
    it("returns one face per die, in the order rolled", () => {
        const rng = scriptedRng([0, 0.5, 0.999]);
        expect(rollDice(3, rng)).toEqual([1, 4, 6]);
    });

    it("covers the whole face range and nothing outside it", () => {
        let state = 0;
        const rng = () => {
            state = (state + 0.0137) % 1;
            return state;
        };
        const faces = rollDice(2000, rng);
        expect(Math.min(...faces)).toBe(1);
        expect(Math.max(...faces)).toBe(DIE_FACES);
    });

    it("rolls nothing for a count of zero", () => {
        expect(rollDice(0, () => 0.5)).toEqual([]);
    });
});

describe("clampModifier", () => {
    it("holds the ceiling in both directions", () => {
        expect(clampModifier(9)).toBe(MODIFIER_CLAMP);
        expect(clampModifier(-9)).toBe(-MODIFIER_CLAMP);
        expect(clampModifier(1)).toBe(1);
        expect(clampModifier(0)).toBe(0);
    });
});

describe("resolvePairings", () => {
    it("pairs high against high, not in the order rolled", () => {
        // Attacker 1,6 against defender 5,2. Paired in roll order the attacker would lose both;
        // sorted, 6 beats 5 and 1 loses to 2, so it is one each.
        const result = resolvePairings([1, 6], [5, 2]);
        expect(result.attackerLosses).toBe(1);
        expect(result.defenderLosses).toBe(1);
    });

    it("gives ties to the defender", () => {
        const result = resolvePairings([4], [4]);
        expect(result.attackerLosses).toBe(1);
        expect(result.defenderLosses).toBe(0);
        expect(result.pairings[0].tied).toBe(true);
        expect(result.pairings[0].attackerWins).toBe(false);
    });

    it("treats the attacker's unmatched dice as automatic hits", () => {
        // Five against one: one contested pairing plus four the defender cannot answer.
        const result = resolvePairings([6, 6, 6, 6, 1], [6]);
        expect(result.pairings).toHaveLength(5);
        expect(result.pairings.filter((p) => p.unmatched)).toHaveLength(4);
        // 6 vs 6 is a tie and goes to the defender; the other four are automatic.
        expect(result.attackerLosses).toBe(1);
        expect(result.defenderLosses).toBe(4);
    });

    it("treats the defender's unmatched dice as automatic hits too", () => {
        const result = resolvePairings([6], [1, 1, 1, 1]);
        expect(result.defenderLosses).toBe(1);
        expect(result.attackerLosses).toBe(3);
    });

    it("resolves every die into exactly one pairing", () => {
        const result = resolvePairings([3, 5, 2], [4, 4]);
        expect(result.pairings).toHaveLength(3);
        expect(result.attackerLosses + result.defenderLosses).toBe(3);
    });

    it("applies a modifier to every die on that side", () => {
        // 3 against 4 loses; +1 makes it 4 against 4, which is a tie and still loses; +2 wins.
        expect(resolvePairings([3], [4], 0, 0).defenderLosses).toBe(0);
        expect(resolvePairings([3], [4], 1, 0).defenderLosses).toBe(0);
        expect(resolvePairings([3], [4], 2, 0).defenderLosses).toBe(1);
    });

    it("clamps a modifier before using it", () => {
        const result = resolvePairings([1], [6], 99, 0);
        expect(result.attackerModifier).toBe(MODIFIER_CLAMP);
        // 1 + 2 = 3 against 6: still a loss. An unclamped +99 would have won.
        expect(result.attackerLosses).toBe(1);
    });

    it("reports the raw face as well as the modified value, for the dice stage", () => {
        const result = resolvePairings([2], [1], 2, 0);
        expect(result.pairings[0].attackerFace).toBe(2);
        expect(result.pairings[0].attackerValue).toBe(4);
    });

    it("handles a side with no dice at all", () => {
        const result = resolvePairings([], [3, 3]);
        expect(result.attackerLosses).toBe(2);
        expect(result.defenderLosses).toBe(0);
    });
});

describe("contestedPairingOdds", () => {
    it("is 15/36 unmodified -- the defender's tie advantage, as a number", () => {
        expect(contestedPairingOdds(0, 0)).toBeCloseTo(15 / 36, 10);
    });

    it("is 21/36 at +1 to the attacker", () => {
        expect(contestedPairingOdds(1, 0)).toBeCloseTo(21 / 36, 10);
    });

    it("is symmetric -- a defender bonus is an attacker penalty", () => {
        expect(contestedPairingOdds(0, 1)).toBeCloseTo(contestedPairingOdds(-1, 0), 10);
    });

    it("agrees with the resolver over many rolls", () => {
        // The maths and the implementation, checked against each other rather than the maths
        // against itself.
        let state = 12345;
        const rng = () => {
            state = (state + 0x6d2b79f5) | 0;
            let t = Math.imul(state ^ (state >>> 15), state | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        let attackerWins = 0;
        const trials = 20000;
        for (let trial = 0; trial < trials; trial++) {
            const result = resolvePairings(rollDice(1, rng), rollDice(1, rng));
            attackerWins += result.defenderLosses;
        }
        expect(attackerWins / trials).toBeCloseTo(contestedPairingOdds(), 1);
    });
});
