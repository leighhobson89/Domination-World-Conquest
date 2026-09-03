// src/ai/theatre.js -- the AI's mid-term goal, and the memory that judges it.
//
// The behaviours worth pinning down are the ones whose ABSENCE was measurable over a
// hundred turns (tools/ai-sim.mjs): a world of 204 countries that was still 163 countries a
// hundred turns later, with the largest empire in it unchanged at 30 territories. Nobody was
// absorbing anybody, because no country was trying to absorb anybody in particular -- each
// spread one attack a turn along its whole border, took the free territories in the first
// ten turns and then re-derived the same losing odds against the same neighbours forever.
//
// So the four things asserted here are the four halves of "have a plan and notice when it is
// not working": commit to one rival, keep the commitment while it pays, drop it when it
// stalls, and remember what was dropped so the next choice is a different one.
//
// Adjacency is not loaded in Node, so the frontier is injected -- which is also what lets a
// test say "these two countries share a border" in one line instead of building a map.

import { beforeEach, describe, expect, it } from "vitest";

import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import {
    currentTheatre,
    frontierFor,
    isWall,
    noteAttemptOutcome,
    noteDevelopment,
    rankRivals,
    resetTheatres,
    reviewTheatre,
    theatreWeightFor,
    wallsFor
} from "../../src/ai/theatre.js";
import { postureThresholds, theatreCommitment } from "../../src/config/balance.js";

const HALF = () => 0.5;

function territory(overrides = {}) {
    return {
        uniqueId: "1",
        territoryName: "Somewhere",
        continent: "Europe",
        dataName: "Alba",
        owner: "Alba",
        originalOwner: "Alba",
        area: 1000,
        devIndex: 0.5,
        continentModifier: 1,
        armyForCurrentTerritory: 1000,
        farmsBuilt: 0,
        forestsBuilt: 0,
        oilWellsBuilt: 0,
        fortsBuilt: 0,
        ...overrides
    };
}

/**
 * Alba, with two neighbours: Brava is weak and next door, Carda is strong and further off.
 * The neighbour lists are what adjacency would have said.
 */
function borderWorld({ bravaArmy = 100, cardaArmy = 100000 } = {}) {
    seedTerritories([
        territory({ uniqueId: "a1", territoryName: "AlbaHome", dataName: "Alba", armyForCurrentTerritory: 5000 }),
        territory({ uniqueId: "b1", territoryName: "BravaOne", dataName: "Brava", armyForCurrentTerritory: bravaArmy }),
        territory({ uniqueId: "b2", territoryName: "BravaTwo", dataName: "Brava", armyForCurrentTerritory: bravaArmy }),
        territory({ uniqueId: "c1", territoryName: "CardaOne", dataName: "Carda", armyForCurrentTerritory: cardaArmy })
    ]);
}

/** The adjacency the world above would have: Alba touches all three enemy territories. */
const neighbours = () => ["BravaOne", "BravaTwo", "CardaOne"];

beforeEach(() => {
    __resetStateForTests();
    resetTheatres();
});

describe("reading the frontier", () => {
    it("groups reachable enemy territory by the country that holds it", () => {
        borderWorld();
        const frontier = frontierFor("Alba", { interactableFrom: neighbours });

        expect([...frontier.keys()].sort()).toEqual(["Brava", "Carda"]);
        expect(frontier.get("Brava").territories.sort()).toEqual(["BravaOne", "BravaTwo"]);
        expect(frontier.get("Carda").theirArmy).toBe(100000);
    });

    it("counts our own army along that border, so weakness is a ratio and not a guess", () => {
        borderWorld();
        const frontier = frontierFor("Alba", { interactableFrom: neighbours });
        expect(frontier.get("Brava").ourArmy).toBeGreaterThan(0);
    });

    it("never reports a country as its own neighbour", () => {
        borderWorld();
        const frontier = frontierFor("Alba", {
            interactableFrom: () => ["AlbaHome", "BravaOne"]
        });
        expect(frontier.has("Alba")).toBe(false);
    });
});

describe("choosing which neighbour to absorb", () => {
    it("prefers the weak neighbour to the strong one", () => {
        borderWorld();
        const ranked = rankRivals(frontierFor("Alba", { interactableFrom: neighbours }), { rng: HALF });
        expect(ranked[0].rival).toBe("Brava");
    });

    it("commits to it, and says so", () => {
        borderWorld();
        const theatre = reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        expect(theatre.rival).toBe("Brava");
        expect(theatre.changed).toBe(true);
        expect(currentTheatre("Alba").rival).toBe("Brava");
    });

    it("keeps the commitment next turn rather than re-choosing", () => {
        borderWorld();
        const frontier = frontierFor("Alba", { interactableFrom: neighbours });
        reviewTheatre({ country: "Alba", turn: 1, frontier, rng: HALF });

        // Brava is taken by surprise and Carda is now the weaker of the two -- a country
        // without a plan would swing across; a country with one finishes what it started.
        const second = reviewTheatre({
            country: "Alba", turn: 2, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });
        expect(second.rival).toBe("Brava");
        expect(second.changed).toBe(false);
    });
});

describe("noticing that the approach is not working", () => {
    it("writes a rival off as a wall after enough lost attacks and picks another", () => {
        borderWorld();
        const frontier = frontierFor("Alba", { interactableFrom: neighbours });
        reviewTheatre({ country: "Alba", turn: 1, frontier, rng: HALF });

        for (let attempt = 0; attempt < theatreCommitment.failuresBeforeWall; attempt += 1) {
            noteAttemptOutcome("Alba", "Brava", false, 2);
        }

        const reviewed = reviewTheatre({
            country: "Alba", turn: 2, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        expect(reviewed.rival).toBe("Carda");
        expect(reviewed.reason).toContain("wall");
        expect(isWall("Alba", "Brava", 2)).toBe(true);
        expect(wallsFor("Alba", 2)).toContain("Brava");
    });

    it("gives a new commitment room to get started before judging it", () => {
        // The deadline for a war that has produced NOTHING yet is the review interval, not
        // the stall clock: a plan deserves longer to get going than a stalled one deserves
        // to restart. Running both off one clock made the longer of the two unreachable.
        borderWorld();
        reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        const reviewed = reviewTheatre({
            country: "Alba", turn: theatreCommitment.reviewInterval, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        expect(reviewed.rival).toBe("Brava");
        expect(reviewed.changed).toBe(false);
    });

    it("gives up on a rival it has taken nothing from for several turns", () => {
        borderWorld();
        reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        const later = 1 + theatreCommitment.reviewInterval;
        const reviewed = reviewTheatre({
            country: "Alba", turn: later, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        expect(reviewed.reason).toContain("without taking anything");
        expect(isWall("Alba", "Brava", later)).toBe(true);
    });

    it("stays the course while it IS taking ground", () => {
        borderWorld();
        reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        // One territory taken on turn 3 -- the clock restarts from the gain, not from the
        // commitment, which is the difference between "slow war" and "stalled war".
        noteAttemptOutcome("Alba", "Brava", true, 3);
        const reviewed = reviewTheatre({
            country: "Alba", turn: 4, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        expect(reviewed.rival).toBe("Brava");
        expect(reviewed.takenFromRival).toBe(1);
        expect(reviewed.reason).toContain("taking ground");
    });

    it("forgets a wall eventually, because the reason it was one has expired", () => {
        borderWorld();
        reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });
        for (let attempt = 0; attempt < theatreCommitment.failuresBeforeWall; attempt += 1) {
            noteAttemptOutcome("Alba", "Brava", false, 2);
        }
        reviewTheatre({
            country: "Alba", turn: 2, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        expect(isWall("Alba", "Brava", 2)).toBe(true);
        expect(isWall("Alba", "Brava", 2 + theatreCommitment.wallMemoryTurns + 1)).toBe(false);
    });

    it("a win clears the record of failure -- three losses then a win is a war being learned", () => {
        borderWorld();
        reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });
        noteAttemptOutcome("Alba", "Brava", false, 2);
        noteAttemptOutcome("Alba", "Brava", false, 2);
        noteAttemptOutcome("Alba", "Brava", true, 3);

        expect(currentTheatre("Alba").failures).toBe(0);
    });

    it("abandons a rival that no longer exists without calling it a wall", () => {
        borderWorld();
        reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        // Brava has been eaten by somebody else; the border is now Carda's.
        seedTerritories([
            territory({ uniqueId: "a1", territoryName: "AlbaHome", dataName: "Alba" }),
            territory({ uniqueId: "c1", territoryName: "CardaOne", dataName: "Carda" })
        ]);
        const reviewed = reviewTheatre({
            country: "Alba", turn: 2, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: () => ["CardaOne"] })
        });

        expect(reviewed.rival).toBe("Carda");
        expect(isWall("Alba", "Brava", 2)).toBe(false);
    });
});

describe("what the mid-term goal does to a target's worth", () => {
    it("is worth more when it belongs to the committed rival", () => {
        borderWorld();
        reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        expect(theatreWeightFor("Alba", "Brava", 1)).toBe(theatreCommitment.rivalWeight);
        expect(theatreWeightFor("Alba", "Carda", 1)).toBe(1);
    });

    it("is worth less when it belongs to a rival written off as a wall", () => {
        borderWorld();
        reviewTheatre({
            country: "Alba", turn: 1, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });
        for (let attempt = 0; attempt < theatreCommitment.failuresBeforeWall; attempt += 1) {
            noteAttemptOutcome("Alba", "Brava", false, 2);
        }
        reviewTheatre({
            country: "Alba", turn: 2, rng: HALF,
            frontier: frontierFor("Alba", { interactableFrom: neighbours })
        });

        expect(theatreWeightFor("Alba", "Brava", 2)).toBe(theatreCommitment.wallWeight);
    });
});

describe("noticing that DEVELOPING is not working either", () => {
    const stallTurns = postureThresholds.developStallTurns;

    it("does not complain while a country is actually developing", () => {
        noteDevelopment("Alba", 0.1, 1, "DEVELOP");
        const verdict = noteDevelopment("Alba", 0.4, 1 + stallTurns, "DEVELOP");
        expect(verdict.stalled).toBe(false);
    });

    it("calls it stalled when the turns pass and the development does not move", () => {
        noteDevelopment("Alba", 0.1, 1, "DEVELOP");
        const verdict = noteDevelopment("Alba", 0.1, 1 + stallTurns, "DEVELOP");
        expect(verdict.stalled).toBe(true);
        expect(verdict.turnsDeveloping).toBe(stallTurns);
    });

    it("only counts turns actually spent developing", () => {
        noteDevelopment("Alba", 0.1, 1, "DEVELOP");
        noteDevelopment("Alba", 0.1, 2, "EXPAND");
        const verdict = noteDevelopment("Alba", 0.1, 1 + stallTurns, "DEVELOP");
        expect(verdict.stalled).toBe(false);
    });
});
