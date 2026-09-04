// src/rules/victoryCheck.js -- the one question the turn loop asks at the end of a turn:
// is this game over, and for whom?
//
// The measurement half (src/ai/victory.js) answers "has this country met the condition".
// This is the half that turns that into an OUTCOME, and the difference matters because the
// goal is a shared race: every country plays for the same condition, so an AI getting there
// first is the player's defeat rather than a curiosity. Elimination runs underneath every
// goal -- it is not one of them.
//
// Pure, so a fifteen-territory world is enough to pin all of it down.

import { beforeEach, describe, expect, it } from "vitest";

import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import { resetVictoryCondition, setVictoryCondition, VictoryCondition } from "../../src/ai/victory.js";
import { checkForVictory } from "../../src/rules/victoryCheck.js";

/**
 * Europe (3) held entirely by Alba, Africa (2) split, Asia (2) held by Brava.
 * Alba: 3 territories, 300 area. Brava: 3 territories, 2,100 area. Carda: 1, 100.
 *
 * Brava is the larger empire by AREA while Alba and Brava are level on territory COUNT,
 * which is what makes the turn-limit tie-break testable.
 */
function world() {
    const rows = [
        ["EU1", "Europe", "Alba", 100],
        ["EU2", "Europe", "Alba", 100],
        ["EU3", "Europe", "Alba", 100],
        ["AF1", "Africa", "Brava", 100],
        ["AF2", "Africa", "Carda", 100],
        ["AS1", "Asia", "Brava", 1000],
        ["AS2", "Asia", "Brava", 1000]
    ];
    return rows.map(([name, continent, owner, area], index) => ({
        uniqueId: String(index + 1),
        territoryName: name,
        continent,
        dataName: owner,
        owner,
        originalOwner: owner,
        area,
        defenseBonus: 0
    }));
}

beforeEach(() => {
    __resetStateForTests();
    resetVictoryCondition();
    seedTerritories(world());
});

describe("an undecided game", () => {
    it("returns nothing while nobody has met the condition", () => {
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 3 });
        expect(checkForVictory({ turn: 5, playerCountry: "Alba" })).toBe(null);
    });
});

describe("elimination runs underneath every goal", () => {
    it("is a defeat even though the chosen goal is something else entirely", () => {
        setVictoryCondition({ kind: VictoryCondition.DOMINATION, landShare: 0.9 });
        const result = checkForVictory({ turn: 5, playerCountry: "Nowhereland" });
        expect(result.outcome).toBe("DEFEAT");
        expect(result.reason).toBe("ELIMINATED");
    });

    it("is not reported for a player who still holds something", () => {
        setVictoryCondition({ kind: VictoryCondition.DOMINATION, landShare: 0.9 });
        expect(checkForVictory({ turn: 5, playerCountry: "Carda" })).toBe(null);
    });
});

describe("a shared race", () => {
    it("is a victory when the player meets the condition", () => {
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 1 });
        const result = checkForVictory({ turn: 5, playerCountry: "Alba" });
        expect(result.outcome).toBe("VICTORY");
        expect(result.winner).toBe("Alba");
        expect(result.reason).toBe("CONDITION_MET");
    });

    it("is a defeat when somebody else meets it first", () => {
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 1 });
        const result = checkForVictory({ turn: 5, playerCountry: "Carda" });
        expect(result.outcome).toBe("DEFEAT");
        //Alba owns Europe outright and Brava owns Asia outright; both have met it, and the
        //winner has to be settled deterministically or a seeded run would not reproduce.
        expect(result.winner).toBe("Alba");
    });

    it("gives the player the win when they reach it on the same turn as an AI", () => {
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 1 });
        const result = checkForVictory({ turn: 5, playerCountry: "Brava" });
        expect(result.outcome).toBe("VICTORY");
        expect(result.winner).toBe("Brava");
    });

    it("reports a decided game with no player in it", () => {
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 1 });
        const result = checkForVictory({ turn: 5, playerCountry: null });
        expect(result.outcome).toBe("DECIDED");
        expect(result.winner).toBe("Alba");
    });
});

describe("a timed game", () => {
    it("runs on until the limit", () => {
        setVictoryCondition({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 });
        expect(checkForVictory({ turn: 199, playerCountry: "Alba" })).toBe(null);
    });

    it("is scored on the largest empire by area at the limit", () => {
        setVictoryCondition({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 });
        const result = checkForVictory({ turn: 200, playerCountry: "Alba" });
        expect(result.outcome).toBe("DEFEAT");
        expect(result.winner).toBe("Brava");
        expect(result.reason).toBe("TURN_LIMIT");
    });

    it("is a victory for the leader", () => {
        setVictoryCondition({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 });
        expect(checkForVictory({ turn: 200, playerCountry: "Brava" }).outcome).toBe("VICTORY");
    });

    it("still ends if the limit is passed rather than landed on exactly", () => {
        setVictoryCondition({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 });
        expect(checkForVictory({ turn: 240, playerCountry: "Alba" }).winner).toBe("Brava");
    });
});

describe("determinism", () => {
    it("gives the same answer for the same world twice", () => {
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 1 });
        const first = checkForVictory({ turn: 5, playerCountry: "Carda" });
        const second = checkForVictory({ turn: 5, playerCountry: "Carda" });
        expect(second).toEqual(first);
    });
});
