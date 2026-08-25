// What an AI country is trying to do, at three horizons.
//
// Phase 7.4, the developer-facing half. This is the derivation behind the console
// report in `src/ai/planLog.js`, and it is separate from the printing precisely so
// it can be tested: the AI turn already emits forty-odd lines per country and none
// of them said what the country was trying to DO.
//
// The short horizon is a reading of the goal list. The medium is a summary of it,
// and is honest about being a summary -- the AI has no explicit medium-term state.
// The LONG horizon is the interesting one, because it comes from the world rather
// than from any plan: what a country once owned and has lost, which continent it
// is closest to holding, and who has taken most from it. Those persist across
// turns because they are properties of the map.

import { beforeEach, describe, expect, it } from "vitest";

import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import {
    longTermAmbitions,
    mediumTermPosture,
    shortTermGoals,
    summariseGoalHorizons,
} from "../../src/ai/goalHorizons.js";

/** A refined goal row is `[count, type, ...fields]` -- see ai/goals.js. */
const attack = (target, from, weight = 3) => [weight, "Attack", target, from];
const siege = (target, from, weight = 2) => [weight, "Siege", target, from];
const bolster = (own, weight = 4) => [weight, "Bolster", own];
const economy = (own, weight = 1) => [weight, "Economy", own];

function territory(overrides = {}) {
    return {
        uniqueId: String(overrides.uniqueId ?? Math.random()),
        territoryName: "T",
        dataName: "Libya",
        originalOwner: "Libya",
        continent: "Africa",
        ...overrides,
    };
}

describe("short term -- this turn's goals as sentences", () => {
    it("reads each kind of goal in the order the AI will attempt them", () => {
        const lines = shortTermGoals([
            attack("Sardinia", "Tripolitania", 6),
            bolster("Cyrenaica", 4),
            economy("Fezzan", 1),
        ]);
        expect(lines[0]).toContain("Attack Sardinia from Tripolitania");
        expect(lines[1]).toContain("Reinforce Cyrenaica");
        expect(lines[2]).toContain("Develop Fezzan");
    });

    it("carries the priority, which is what the ordering is FOR", () => {
        expect(shortTermGoals([attack("A", "B", 6.5)])[0]).toContain("6.5");
    });

    it("includes economy and reinforcement, unlike the player-facing feed", () => {
        // The exclusion in the activity panel is about what a PLAYER should see. A
        // developer asking why a country did not attack needs to know it spent the
        // turn building.
        expect(shortTermGoals([economy("Fezzan")])).toHaveLength(1);
    });

    it("caps the list, because 206 countries print every turn", () => {
        const many = Array.from({ length: 30 }, (_, i) => attack("T" + i, "S"));
        expect(shortTermGoals(many)).toHaveLength(8);
        expect(shortTermGoals(many, 3)).toHaveLength(3);
    });

    it("copes with no goals at all", () => {
        // A country whose neighbours are now all its own has nothing to plan. That is
        // an ordinary state once the AI can conquer, and it used to throw (audit 5.1 AG).
        expect(shortTermGoals([])).toEqual([]);
        expect(shortTermGoals(undefined)).toEqual([]);
    });
});

describe("medium term -- what the turn adds up to", () => {
    beforeEach(() => {
        __resetStateForTests();
        seedTerritories([
            territory({ uniqueId: "1", territoryName: "Sardinia", dataName: "Italy" }),
            territory({ uniqueId: "2", territoryName: "Sicily", dataName: "Italy" }),
            territory({ uniqueId: "3", territoryName: "Crete", dataName: "Greece" }),
        ]);
    });

    it("calls a turn with more offence than defence Advancing", () => {
        const posture = mediumTermPosture([attack("Sardinia", "X"), siege("Sicily", "X")]);
        expect(posture.posture).toBe("Advancing");
        expect(posture.counts).toMatchObject({ attack: 1, siege: 1 });
    });

    it("calls a turn with no offence at all Building", () => {
        expect(mediumTermPosture([economy("A"), bolster("B")]).posture).toBe("Building");
    });

    it("calls anything else Holding", () => {
        const posture = mediumTermPosture([attack("Sardinia", "X"), bolster("B"), bolster("C")]);
        expect(posture.posture).toBe("Holding");
    });

    it("names the country taking the most pressure", () => {
        // Which enemy an AI is actually pushing against is invisible in the goal list,
        // because a goal names a TERRITORY. Resolving that to its owner is the only
        // reason this is more than a count.
        const posture = mediumTermPosture([
            attack("Sardinia", "X"),
            siege("Sicily", "X"),
            attack("Crete", "X"),
        ]);
        expect(posture.pressureOn).toBe("Italy");
    });

    it("lists what it is shoring up", () => {
        const posture = mediumTermPosture([bolster("Cyrenaica"), bolster("Cyrenaica"), bolster("Fezzan")]);
        expect(posture.holding).toEqual(["Cyrenaica", "Fezzan"]);
    });
});

describe("long term -- standing ambitions, read from the world", () => {
    beforeEach(() => {
        __resetStateForTests();
        seedTerritories([
            // Libya holds two of the three African territories...
            territory({ uniqueId: "1", territoryName: "Tripolitania", dataName: "Libya", originalOwner: "Libya" }),
            territory({ uniqueId: "2", territoryName: "Cyrenaica", dataName: "Libya", originalOwner: "Libya" }),
            // ...and has lost the third, plus one in Europe, both to Italy.
            territory({ uniqueId: "3", territoryName: "Fezzan", dataName: "Italy", originalOwner: "Libya" }),
            territory({ uniqueId: "4", territoryName: "Malta", dataName: "Italy", originalOwner: "Libya", continent: "Europe" }),
            territory({ uniqueId: "5", territoryName: "Sicily", dataName: "Greece", originalOwner: "Italy", continent: "Europe" }),
        ]);
    });

    it("counts what the country holds", () => {
        expect(longTermAmbitions("Libya").territoriesHeld).toBe(2);
    });

    it("lists what it once owned and has lost", () => {
        const { reconquista, reconquistaTotal } = longTermAmbitions("Libya");
        expect(reconquistaTotal).toBe(2);
        expect(reconquista).toEqual(["Fezzan", "Malta"]);
    });

    it("names the country holding most of them", () => {
        expect(longTermAmbitions("Libya").principalRival).toEqual({ country: "Italy", count: 2 });
    });

    it("finds the continent it is closest to holding outright", () => {
        const { nearestContinent } = longTermAmbitions("Libya");
        expect(nearestContinent.continent).toBe("Africa");
        expect(nearestContinent.held).toBe(2);
        expect(nearestContinent.total).toBe(3);
    });

    it("ignores a continent it has no foothold on", () => {
        // "Closest to holding Europe, 0 of 3" is not an ambition, it is arithmetic.
        expect(longTermAmbitions("Libya").nearestContinent.continent).not.toBe("Europe");
    });

    it("answers for a country that holds nothing without throwing", () => {
        const nobody = longTermAmbitions("Atlantis");
        expect(nobody.territoriesHeld).toBe(0);
        expect(nobody.nearestContinent).toBeNull();
        expect(nobody.principalRival).toBeNull();
    });
});

describe("all three together", () => {
    beforeEach(() => {
        __resetStateForTests();
        seedTerritories([territory({ uniqueId: "1", territoryName: "Tripolitania", dataName: "Libya" })]);
    });

    it("is one object, which is what the console report prints", () => {
        const plan = summariseGoalHorizons({
            country: "Libya",
            leader: { name: "Anonymous", leaderType: "aggressive" },
            refinedGoals: [bolster("Tripolitania")],
        });
        expect(plan.country).toBe("Libya");
        expect(plan.leaderName).toBe("Anonymous");
        expect(plan.leaderType).toBe("aggressive");
        expect(plan.shortTerm).toHaveLength(1);
        expect(plan.mediumTerm.posture).toBe("Building");
        expect(plan.longTerm.territoriesHeld).toBe(1);
    });

    it("survives a country with no leader, which turn 1 genuinely has", () => {
        // The CPU leaders are created AFTER `initialiseGame()` starts turn 1 -- a
        // bootstrap ordering that was measured and deliberately left alone (see the
        // note in gameTurnsLoop.js). A logging helper must never be what breaks it.
        const plan = summariseGoalHorizons({ country: "Libya", leader: undefined, refinedGoals: [] });
        expect(plan.leaderName).toBe("unknown");
        expect(plan.shortTerm).toEqual([]);
    });
});
