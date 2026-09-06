// What a finished game says about itself.
//
// The ending is by definition the state hardest to reach by clicking -- it needs a whole game
// played to a conclusion -- so a spec that had to drive the real UI to see one would be the
// slowest and least reliable test in the suite. `describeEnding()` is pure and the component
// draws whatever it returns, so every outcome is covered here in about a millisecond and
// `tests/e2e/` only has to prove the panel appears at all.

import { describe, expect, it } from "vitest";

import {
    conditionDemand,
    conditionName,
    describeEnding,
    finalStandings
} from "../../src/ui/gameOver/describeEnding.js";
import { VictoryCondition } from "../../src/ai/victory.js";

const standings = (rows = [["France", 200], ["Spain", 120], ["Chad", 39]]) => ({
    worldTerritories: rows.reduce((sum, [, count]) => sum + count, 0),
    byCountry: new Map(rows.map(([country, territories], index) =>
        [country, { territories, area: territories * 100 - index }]))
});

const ending = (over = {}, context = {}) => describeEnding({
    outcome: "VICTORY",
    winner: "France",
    reason: "CONDITION_MET",
    turn: 42,
    condition: { kind: VictoryCondition.CONTINENTAL, continentsRequired: 3 },
    ...over
}, { standings: standings(), playerCountry: "France", ...context });

describe("conditionName", () => {
    it("names all five goals", () => {
        for (const kind of Object.values(VictoryCondition)) {
            expect(conditionName(kind)).not.toBe("Unknown Goal");
        }
    });

    it("does not throw on a condition it has never heard of", () => {
        expect(conditionName("SOMETHING_ELSE")).toBe("Unknown Goal");
    });
});

describe("conditionDemand", () => {
    // The one mistake here would be SILENT: naming the wrong field quotes a number from a
    // different goal and reads as perfectly plausible. Each of these is the field
    // `conditionFor()` writes for that kind, and nothing else.
    it("reads continents for Continental Supremacy", () => {
        expect(conditionDemand({
            kind: VictoryCondition.CONTINENTAL, continentsRequired: 4, landShare: 0.9
        })).toBe("4 continents held whole");
    });

    it("reads the land share for Domination, as a percentage", () => {
        expect(conditionDemand({
            kind: VictoryCondition.DOMINATION, landShare: 0.6, continentsRequired: 3
        })).toBe("60% of the world's land");
    });

    it("reads the turn limit for a Timed Game", () => {
        expect(conditionDemand({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 250 }))
            .toContain("250");
    });

    it("reads the power count for Great Powers", () => {
        expect(conditionDemand({
            kind: VictoryCondition.GREAT_POWERS, greatPowersRequired: 3
        })).toBe("3 great powers broken");
    });

    it("says what World Conquest asks for without needing a number", () => {
        expect(conditionDemand({ kind: VictoryCondition.CONQUEST }))
            .toBe("every territory on the map");
    });

    it("survives a missing condition", () => {
        expect(conditionDemand(null)).toBe("");
    });
});

describe("finalStandings", () => {
    it("orders by territories held, largest first", () => {
        expect(finalStandings(standings()).map(row => row.country))
            .toEqual(["France", "Spain", "Chad"]);
    });

    it("breaks a tie the same way every time", () => {
        // Otherwise two countries on the same holding are ordered by whatever the map walk
        // happened to produce, and the same finished game reports two different tables.
        const tied = standings([["Zambia", 50], ["Albania", 50]]);
        tied.byCountry.get("Zambia").area = 10;
        tied.byCountry.get("Albania").area = 10;
        expect(finalStandings(tied).map(row => row.country)).toEqual(["Albania", "Zambia"]);
    });

    it("takes the share from the world total, not from the countries listed", () => {
        // A country holding nothing must not be able to change the denominator.
        const rows = finalStandings(standings());
        expect(rows[0].share).toBeCloseTo(200 / 359, 5);
    });

    it("honours the limit and survives an empty world", () => {
        expect(finalStandings(standings(), 2)).toHaveLength(2);
        expect(finalStandings(null)).toEqual([]);
        expect(finalStandings(standings(), 0)).toEqual([]);
    });
});

describe("describeEnding", () => {
    it("calls a win a victory and names the turn", () => {
        const result = ending();
        expect(result.tone).toBe("victory");
        expect(result.title).toBe("Victory");
        expect(result.subtitle).toContain("turn 42");
    });

    it("says what the game was played for, on every outcome", () => {
        // The five goals end five different ways, and a screen that said "You have won" to all
        // of them would waste the one thing the whole game builds to.
        for (const outcome of ["VICTORY", "DEFEAT", "DECIDED"]) {
            expect(ending({ outcome }).playedFor)
                .toBe("Continental Supremacy — 3 continents held whole");
        }
    });

    it("distinguishes elimination from a rival's victory", () => {
        // Both are DEFEAT and they are not the same sentence. Telling a player they were
        // driven from the map while they still held forty territories would be worse than
        // saying nothing.
        const eliminated = ending({ outcome: "DEFEAT", winner: null, reason: "ELIMINATED" });
        const outplayed = ending({ outcome: "DEFEAT", winner: "Spain", reason: "CONDITION_MET" });

        expect(eliminated.subtitle).toContain("driven from the map");
        expect(outplayed.subtitle).toContain("Spain");
        expect(outplayed.subtitle).not.toContain("driven from the map");
        expect(eliminated.tone).toBe("defeat");
        expect(outplayed.tone).toBe("defeat");
    });

    it("says the clock ran out when a Timed Game decides it", () => {
        const result = ending({
            outcome: "DEFEAT",
            winner: "Spain",
            reason: "TURN_LIMIT",
            condition: { kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 }
        });
        expect(result.body.some(block => block.text.includes("clock ran out"))).toBe(true);
    });

    it("has no player in a spectated game, and says so without a you", () => {
        const result = describeEnding({
            outcome: "DECIDED",
            winner: "Spain",
            reason: "CONDITION_MET",
            turn: 88,
            condition: { kind: VictoryCondition.CONQUEST }
        }, { standings: standings(), playerCountry: null });

        expect(result.tone).toBe("decided");
        for (const block of result.body) {
            expect(block.text.toLowerCase()).not.toMatch(/\byou\b/);
        }
    });

    it("carries the final standings so the panel need not read the store", () => {
        // The panel can outlive the store it describes: New Game restores a pristine world
        // underneath it, and a table read at render time would put the new world's figures
        // under the old game's headline.
        expect(ending().standings[0]).toMatchObject({ country: "France", territories: 200 });
    });

    it("emits only blocks the component knows how to draw", () => {
        for (const outcome of ["VICTORY", "DEFEAT", "DECIDED"]) {
            for (const block of ending({ outcome }).body) {
                expect(["p", "h"]).toContain(block.kind);
                expect(block.text).not.toBe("");
            }
        }
    });

    it("does not throw on an ending with nothing in it", () => {
        const result = describeEnding({}, {});
        expect(result.title).toBeTruthy();
        expect(Array.isArray(result.body)).toBe(true);
    });
});
