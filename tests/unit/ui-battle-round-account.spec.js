// The two sentences that explain a round of dice.
//
// The battle window now says what a round MEANT in three places, and two of them are pure
// derivations over one `resolveBattleRound()` record: the clash panel's three-line summary and
// the one-line account beside the Rounds toggle. This file owns both.
//
// WHY THEY ARE TESTED HERE AND NOT IN THE `battle/` E2E AREA. The wording is the whole point of
// the feature -- the complaint it answers is "I haven't a clue what the dice mean" -- and wording
// is exactly what an e2e spec should not assert, for the reason `tests/e2e/dominapedia/` records:
// a spec that pins a sentence turns every edit to the prose into a red suite. These are pure
// functions over a record, so the sentence can be pinned in milliseconds here, and the e2e side
// is left to assert that the panel appears at all.
//
// WHAT THEY ARE REALLY GUARDING. Every number in both sentences comes off the record and none is
// recomputed. That is the same rule the ledger follows and it exists for the same reason: the
// explanation and the battle must be incapable of disagreeing. A test that built its own expected
// figures from the armies would not catch the one bug that matters, which is a sentence describing
// a different round from the one that was fought.

import { describe, expect, it } from "vitest";

import { summaryFor } from "../../src/ui/battle/ClashPanel.js";
import { describeRound } from "../../src/ui/battle/RoundLog.js";

/**
 * A record shaped like `resolveBattleRound()`'s, with the fields these two read.
 *
 * Armies are `[infantry, assault, air, naval]`; both sentences report PERSONNEL lost, which is a
 * plain difference of the counts and not a force-weighted figure -- it is the number the army
 * figures on screen move by.
 */
function record(patch = {}) {
    return {
        round: 3,
        attackerDice: 4,
        defenderDice: 3,
        attackerLosses: 1,
        defenderLosses: 2,
        pairings: [
            { attackerWins: true, tied: false, unmatched: false },
            { attackerWins: false, tied: true, unmatched: false },
            { attackerWins: true, tied: false, unmatched: true }
        ],
        attackersBefore: [10000, 0, 0, 0],
        attackersAfter: [9000, 0, 0, 0],
        defendersBefore: [5000, 0, 0, 0],
        defendersAfter: [3200, 0, 0, 0],
        ...patch
    };
}

describe("the round line beside the Rounds toggle", () => {
    it("names the round, both dice counts and both pairing totals", () => {
        expect(describeRound(record())).toBe(
            "R3: 4v3 dice — you won 2, lost 1, 1 unanswered.");
    });

    it("says nothing about unanswered dice when every die was contested", () => {
        const contested = record({
            pairings: [
                { attackerWins: true, unmatched: false },
                { attackerWins: false, unmatched: false }
            ]
        });
        expect(describeRound(contested)).not.toContain("unanswered");
    });

    it("reports a last push as a transaction rather than as a round of dice", () => {
        //`resolveLastPush()` rolls nothing, so a record from it carries no dice counts and no
        //pairings. Describing it with the ordinary sentence would print "undefinedvundefined".
        expect(describeRound({ round: 6, lastPush: true }))
            .toBe("Last push — the territory was taken outright.");
    });

    it("has nothing to say about no record at all", () => {
        expect(describeRound(null)).toBe("");
        expect(describeRound(undefined)).toBe("");
    });
});

describe("the clash panel's summary", () => {
    it("names the winner of the round by the count of pairings, not by casualties", () => {
        //Deliberate, and worth pinning. Casualties are a tenth of each side's CURRENT force, so a
        //much larger army can win every pairing and still lose more people in absolute terms.
        //Reporting the loser as the winner because their number was smaller would be the exact
        //misreading the panel exists to prevent.
        const lopsided = record({
            attackerLosses: 0,
            defenderLosses: 4,
            attackersBefore: [900000, 0, 0, 0],
            attackersAfter: [900000, 0, 0, 0],
            defendersBefore: [5000, 0, 0, 0],
            defendersAfter: [3000, 0, 0, 0]
        });
        expect(summaryFor(lopsided, { attacker: "Germany" }).headline)
            .toBe("Germany won the round");
    });

    it("names the defender when the defender took more pairings", () => {
        const losing = record({ attackerLosses: 3, defenderLosses: 0 });
        expect(summaryFor(losing, { defender: "Luxembourg" }).headline)
            .toBe("Luxembourg won the round");
    });

    it("calls an equal round even rather than picking a side", () => {
        expect(summaryFor(record({ attackerLosses: 2, defenderLosses: 2 })).headline)
            .toBe("The round was even");
    });

    it("states the casualty rule alongside the pairing count, in that order", () => {
        const summary = summaryFor(record());
        expect(summary.detail).toBe(
            "2 pairings won, 1 lost. Each lost pairing costs that side a tenth of the force it has left.");
    });

    it("says 'pairing' when exactly one was won", () => {
        expect(summaryFor(record({ defenderLosses: 1 })).detail).toContain("1 pairing won");
    });

    it("reports personnel lost on both sides, the player's first", () => {
        expect(summaryFor(record(), { attacker: "Germany", defender: "Luxembourg" }).cost)
            .toBe("Germany −1.0k  ·  Luxembourg −1.8k");
    });

    it("falls back to neutral names rather than printing undefined", () => {
        const summary = summaryFor(record());
        expect(summary.headline).toBe("You won the round");
        expect(summary.cost).toContain("The defenders");
    });
});
