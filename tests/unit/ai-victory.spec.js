// src/ai/victory.js -- what winning means and how far along everybody is.
//
// The Dominapedia has carried the design for four victory conditions for some time with
// the honest note that none of them was implemented. This is the measurement half of that
// design, and the reason it exists now is the AI: an AI with no notion of what it is
// playing for can only be turn-local.
//
// The whole module runs in Node -- it reads the store through selectors and imports
// nothing else -- so a fifteen-territory world is enough to pin down every condition.

import { beforeEach, describe, expect, it } from "vitest";

import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import {
    activeVictoryCondition,
    continentStandingsFor,
    hasWon,
    resetVictoryCondition,
    setVictoryCondition,
    VictoryCondition,
    victoryProgress,
    worldStandings
} from "../../src/ai/victory.js";

/**
 * A world of three continents: Europe (3 territories), Africa (4) and Asia (5).
 *
 * Alba owns all of Europe, two of Africa and one of Asia. Brava owns the rest of Africa
 * and three of Asia; Carda holds the last Asian one. Areas are deliberately uneven --
 * Asia's are ten times Europe's -- because DOMINATION counts area and CONTINENTAL counts
 * territories, and a fixture where those agree would not tell the two apart.
 */
function world() {
    const rows = [
        ["EU1", "Europe", "Alba", 100],
        ["EU2", "Europe", "Alba", 100],
        ["EU3", "Europe", "Alba", 100],
        ["AF1", "Africa", "Alba", 200],
        ["AF2", "Africa", "Alba", 200],
        ["AF3", "Africa", "Brava", 200],
        ["AF4", "Africa", "Brava", 200],
        ["AS1", "Asia", "Alba", 1000],
        ["AS2", "Asia", "Brava", 1000],
        ["AS3", "Asia", "Brava", 1000],
        ["AS4", "Asia", "Brava", 1000],
        ["AS5", "Asia", "Carda", 1000]
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

describe("the active condition", () => {
    it("defaults to holding three continents outright", () => {
        const condition = activeVictoryCondition();
        expect(condition.kind).toBe(VictoryCondition.CONTINENTAL);
        expect(condition.continentsRequired).toBe(3);
    });

    it("accepts a partial choice and fills the rest in", () => {
        const condition = setVictoryCondition({ kind: VictoryCondition.DOMINATION });
        expect(condition.kind).toBe(VictoryCondition.DOMINATION);
        expect(condition.landShare).toBeGreaterThan(0);
        expect(condition.turnLimit).toBeGreaterThan(0);
    });

    it("falls back to the default rather than accepting a condition nothing implements", () => {
        expect(setVictoryCondition({ kind: "CONQUER_THE_MOON" }).kind).toBe(VictoryCondition.CONTINENTAL);
    });

    it("ignores a nonsense continent count", () => {
        expect(setVictoryCondition({ continentsRequired: -2 }).continentsRequired).toBe(3);
    });
});

describe("standings", () => {
    it("counts every continent once, whoever holds it", () => {
        const standings = worldStandings();
        expect(standings.continents.get("Europe").total).toBe(3);
        expect(standings.continents.get("Africa").total).toBe(4);
        expect(standings.continents.get("Asia").total).toBe(5);
        expect(standings.worldTerritories).toBe(12);
    });

    it("reports a continent held outright as complete", () => {
        const europe = continentStandingsFor("Alba").find(row => row.continent === "Europe");
        expect(europe.held).toBe(3);
        expect(europe.missing).toBe(0);
        expect(europe.complete).toBe(true);
    });

    it("names the strongest rival on a contested continent", () => {
        const asia = continentStandingsFor("Alba").find(row => row.continent === "Asia");
        expect(asia.strongestRival).toBe("Brava");
        expect(asia.strongestRivalShare).toBeCloseTo(3 / 5);
    });

    it("puts the continent it holds most of first", () => {
        expect(continentStandingsFor("Alba")[0].continent).toBe("Europe");
    });

    it("gives a country with nothing a row per continent, all empty", () => {
        const rows = continentStandingsFor("Nowhereland");
        expect(rows).toHaveLength(3);
        expect(rows.every(row => row.held === 0 && !row.complete)).toBe(true);
    });
});

describe("progress towards a CONTINENTAL victory", () => {
    it("moves between completions rather than only on one", () => {
        //Alba holds all of Europe, half of Africa and a fifth of Asia. A progress number
        //that only counted completed continents would read 1 of 3 and would not move at
        //all as Africa was taken, which would tell the AI nothing.
        const progress = victoryProgress("Alba");
        expect(progress.kind).toBe(VictoryCondition.CONTINENTAL);
        expect(progress.fraction).toBeCloseTo((1 + 0.5 + 0.2) / 3);
        expect(progress.detail.complete).toBe(1);
    });

    it("says how many continents are still wanted", () => {
        expect(victoryProgress("Alba").label).toBe("Continental: 1 of 3 continents");
    });

    it("is not won on one continent", () => {
        expect(hasWon("Alba")).toBe(false);
    });

    it("is won once the required number are held outright", () => {
        setVictoryCondition({ continentsRequired: 1 });
        expect(hasWon("Alba")).toBe(true);
        expect(hasWon("Brava")).toBe(false);
    });
});

describe("progress towards a DOMINATION victory", () => {
    beforeEach(() => {
        setVictoryCondition({ kind: VictoryCondition.DOMINATION, landShare: 0.6 });
    });

    it("counts land area, not territories", () => {
        //Alba holds six of twelve territories but only 1,700 of 6,100 area -- half the map
        //by count and a quarter of it by area. Counting territories would say it was
        //nearly there.
        const progress = victoryProgress("Alba");
        expect(progress.detail.landShare).toBeCloseTo(1700 / 6100);
        expect(progress.fraction).toBeLessThan(0.5);
    });

    it("is won at the required share of the world's land", () => {
        setVictoryCondition({ kind: VictoryCondition.DOMINATION, landShare: 0.25 });
        expect(hasWon("Alba")).toBe(true);
    });
});

describe("the other two conditions", () => {
    it("ELIMINATION is about holding anything at all", () => {
        setVictoryCondition({ kind: VictoryCondition.ELIMINATION });
        expect(victoryProgress("Alba").fraction).toBe(1);
        expect(victoryProgress("Nowhereland").fraction).toBe(0);
        expect(victoryProgress("Nowhereland").label).toBe("Eliminated");
    });

    it("TURN_LIMIT measures a country against the largest empire", () => {
        setVictoryCondition({ kind: VictoryCondition.TURN_LIMIT });
        //Brava holds 3,400 of area against Alba's 1,700, so Brava is the leader.
        expect(victoryProgress("Brava").fraction).toBe(1);
        expect(victoryProgress("Alba").fraction).toBeCloseTo(0.5);
    });
});
