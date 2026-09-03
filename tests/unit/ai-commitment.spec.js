// src/ai/commitment.js -- how much of a garrison goes to an attack, and whether it goes.
//
// The behaviour being pinned down is the one that made the AI lose wars it had correctly
// decided to fight. The old sizing took the MEAN of every threat facing the whole country,
// subtracted one territory's defence score from it, and used the result as a number of
// soldiers -- then pressed the attack on any probability above 1%. The planner's odds and
// the battle's odds were therefore two different numbers about two different armies.
//
// So the properties worth asserting are: what leaves is bounded by what THIS border can
// spare, what is sent is chosen by asking the real odds, and an attack that cannot reach the
// leader's floor does not happen at all.

import { describe, expect, it } from "vitest";

import {
    decideCommitment,
    disposableForce,
    sizeCommitment
} from "../../src/ai/commitment.js";
import { commitmentDiscipline } from "../../src/config/balance.js";

const traits = (overrides = {}) => ({
    fortification: 0.5,
    territory_expansion: 0.5,
    style_of_war: 0.5,
    reconquista: 0.5,
    ...overrides
});

describe("what a territory can spare", () => {
    it("sends nothing when the worst neighbour already outguns it", () => {
        expect(disposableForce({
            army: 1000, localEnemyPower: 100000, leaderType: "balanced", traits: traits()
        })).toBe(0);
    });

    it("lets an aggressive gambler commit a slice even then", () => {
        const reckless = disposableForce({
            army: 1000, localEnemyPower: 100000, leaderType: "aggressive",
            traits: traits({ style_of_war: 0.9 })
        });
        expect(reckless).toBe(Math.floor(1000 * commitmentDiscipline.recklessShare));
    });

    it("spends a fraction of the LOCAL surplus, never the whole garrison", () => {
        // 1000 at home against a neighbour worth 400: half of theirs is kept as a garrison
        // and only part of the rest marches out, so the border is still held afterwards.
        const spare = disposableForce({
            army: 1000, localEnemyPower: 400, leaderType: "balanced", traits: traits()
        });
        expect(spare).toBeGreaterThan(0);
        expect(spare).toBeLessThan(1000);
        expect(1000 - spare).toBeGreaterThanOrEqual(
            400 * commitmentDiscipline.defenceKeepRatio);
    });

    it("never offers more than the territory actually has", () => {
        const spare = disposableForce({
            army: 100, localEnemyPower: 0, leaderType: "aggressive", traits: traits()
        });
        expect(spare).toBeLessThanOrEqual(100);
    });

    it("marches out with more under an aggressive leader than a pacifist one", () => {
        const input = { army: 1000, localEnemyPower: 0, traits: traits() };
        expect(disposableForce({ ...input, leaderType: "aggressive" }))
            .toBeGreaterThan(disposableForce({ ...input, leaderType: "pacifist" }));
    });

    it("treats an interior territory as almost entirely disposable", () => {
        // Zero is what the threat map reports when no enemy can reach the territory at all;
        // it still keeps a reserve, because a conquest elsewhere can make it a border.
        const spare = disposableForce({
            army: 800, localEnemyPower: 0, leaderType: "balanced", traits: traits()
        });
        expect(spare).toBeGreaterThan(0);
        expect(spare).toBeLessThanOrEqual(800);
    });
});

describe("sizing the commitment against the real odds", () => {
    /** Odds that rise with the force sent, which is what the probability model does. */
    const oddsRisingWith = (perUnit) => (amount) => Math.min(100, amount * perUnit);

    it("stops at the smallest force that clears the floor", () => {
        const sized = sizeCommitment({
            disposable: 1000, floor: 35, oddsFor: oddsRisingWith(0.1)
        });
        // 35% needs 350 at a tenth of a point each, which the first rung (0.35 of 1000)
        // reaches exactly -- so the ladder stops there rather than sending 550 to win the
        // same battle.
        expect(sized.cleared).toBe(true);
        expect(sized.amount).toBe(350);
    });

    it("reports the best it could manage when nothing clears the floor", () => {
        const sized = sizeCommitment({
            disposable: 100, floor: 80, oddsFor: oddsRisingWith(0.1)
        });
        expect(sized.cleared).toBe(false);
        expect(sized.best).toBe(10);
    });

    it("commits nothing when there is nothing to commit", () => {
        const sized = sizeCommitment({ disposable: 0, floor: 10, oddsFor: () => 100 });
        expect(sized).toEqual({ amount: 0, odds: 0, cleared: false, best: 0 });
    });
});

describe("the whole decision", () => {
    it("cancels, naming the best odds it could reach, when the border cannot do it", () => {
        const decision = decideCommitment({
            army: 1000, localEnemyPower: 200, leaderType: "balanced", traits: traits(),
            floor: 50, oddsFor: () => 12, targetName: "Fortress"
        });

        expect(decision.commit).toBe(false);
        expect(decision.reason).toContain("12%");
        expect(decision.reason).toContain("Fortress");
        // A fact about the two armies, so the caller is told to remember it.
        expect(decision.reasonCode).toBe("below-floor");
    });

    it("cancels when the territory has nothing to spare, and marks it as NOT a lesson", () => {
        const decision = decideCommitment({
            army: 1000, localEnemyPower: 100000, leaderType: "pacifist", traits: traits(),
            floor: 10, oddsFor: () => 99, targetName: "Fortress"
        });

        expect(decision.commit).toBe(false);
        expect(decision.reason).toContain("nothing to spare");
        // A fact about this turn, not about the enemy. Recording it as a defeat was
        // measured and took the world's conquests to zero inside ten turns.
        expect(decision.reasonCode).toBe("no-force");
    });

    it("aims above the leader's floor rather than at it", () => {
        // The floor is 20 and the smallest rung already clears it -- but a battle fought at
        // the floor is a battle lost four times in five, so more goes.
        const decision = decideCommitment({
            army: 1000, localEnemyPower: 0, leaderType: "balanced", traits: traits(),
            floor: 20, oddsFor: (amount) => amount / 5, targetName: "Belgium"
        });

        expect(decision.commit).toBe(true);
        expect(decision.odds).toBeGreaterThanOrEqual(commitmentDiscipline.decisiveOdds);
    });

    it("asks for reinforcement instead of attacking when it is merely short", () => {
        // Past the floor, under the aim: the answer is not a bad attack and not a shrug, it
        // is a request the interior provinces answer next turn (src/ai/muster.js).
        const decision = decideCommitment({
            army: 1000, localEnemyPower: 0, leaderType: "balanced", traits: traits(),
            floor: 20, oddsFor: (amount) => amount / 20, targetName: "Belgium"
        });

        expect(decision.commit).toBe(false);
        expect(decision.reasonCode).toBe("needs-more-force");
        expect(decision.shortfall).toBeGreaterThan(0);
    });

    it("presses the attack under the aim anyway when the war is one it has committed to", () => {
        const decision = decideCommitment({
            army: 1000, localEnemyPower: 0, leaderType: "balanced", traits: traits(),
            floor: 20, oddsFor: (amount) => amount / 20, targetName: "Belgium",
            pressOnBelowAim: true
        });

        expect(decision.commit).toBe(true);
        expect(decision.odds).toBeGreaterThanOrEqual(20);
    });

    it("commits when the odds are there, and reports the odds it committed on", () => {
        const decision = decideCommitment({
            army: 1000, localEnemyPower: 0, leaderType: "balanced", traits: traits(),
            floor: 30, oddsFor: (amount) => Math.min(100, amount * 0.2), targetName: "Belgium"
        });

        expect(decision.commit).toBe(true);
        expect(decision.amount).toBeGreaterThan(0);
        expect(decision.odds).toBeGreaterThanOrEqual(30);
    });

    it("is the odds of the force being SENT, not of the whole garrison", () => {
        // The bug this whole module exists for: the planner asked about 1000 and the
        // executor sent 200. Here the odds function is asked about the amount, so a
        // commitment that clears 40% is a commitment that really does clear 40%.
        const asked = [];
        const decision = decideCommitment({
            army: 1000, localEnemyPower: 0, leaderType: "balanced", traits: traits(),
            floor: 40,
            oddsFor: (amount) => {
                asked.push(amount);
                return amount / 5;
            },
            targetName: "Belgium"
        });

        expect(asked).toContain(decision.amount);
        expect(decision.odds).toBe(decision.amount / 5);
    });
});
