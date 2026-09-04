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
    captureVictoryCondition,
    closestToVictory,
    continentStandingsFor,
    hasWon,
    leadingCountry,
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

/* ------------------------------------------------ the two new kinds (Goals & Victory) --- */

// A second world, in which who OWNS a territory and who owned it ORIGINALLY differ. The
// first fixture sets `originalOwner: owner` throughout, so it cannot tell a homeland from
// a holding and cannot exercise GREAT_POWERS at all.
//
// Homelands: Alba 3 (all still Alba's), Brava 3 (Alba holds 2), Carda 2 (Alba holds both),
// Delta 2 (Brava holds both). So Alba has broken Carda outright and is one short of Brava.
function conqueredWorld() {
    const rows = [
        //name  continent  originalOwner  currentOwner  area
        ["A1", "Europe", "Alba", "Alba", 100],
        ["A2", "Europe", "Alba", "Alba", 100],
        ["A3", "Europe", "Alba", "Alba", 100],
        ["B1", "Europe", "Brava", "Alba", 100],
        ["B2", "Africa", "Brava", "Alba", 100],
        ["B3", "Africa", "Brava", "Brava", 100],
        ["C1", "Africa", "Carda", "Alba", 100],
        ["C2", "Africa", "Carda", "Alba", 100],
        ["D1", "Asia", "Delta", "Brava", 100],
        ["D2", "Asia", "Delta", "Brava", 100]
    ];
    return rows.map(([name, continent, originalOwner, owner, area], index) => ({
        uniqueId: String(index + 1),
        territoryName: name,
        continent,
        dataName: owner,
        owner,
        originalOwner,
        area,
        defenseBonus: 0
    }));
}

function seedConqueredWorld() {
    __resetStateForTests();
    resetVictoryCondition();
    seedTerritories(conqueredWorld());
}

describe("CONQUEST", () => {
    it("is not won while anybody else holds a territory", () => {
        setVictoryCondition({ kind: VictoryCondition.CONQUEST });
        expect(hasWon("Alba")).toBe(false);
        expect(hasWon("Brava")).toBe(false);
    });

    it("is won when no other country holds one", () => {
        __resetStateForTests();
        resetVictoryCondition();
        seedTerritories(world().map(territory => ({ ...territory, dataName: "Alba", owner: "Alba" })));
        setVictoryCondition({ kind: VictoryCondition.CONQUEST });
        expect(hasWon("Alba")).toBe(true);
    });

    it("measures progress in territories, not area", () => {
        setVictoryCondition({ kind: VictoryCondition.CONQUEST });
        //Alba holds 6 of the 12 territories but only 1,700 of the 5,200 area.
        expect(victoryProgress("Alba").fraction).toBeCloseTo(0.5);
        expect(victoryProgress("Alba").label).toBe("Conquest: 6 of 12 territories");
    });
});

describe("GREAT_POWERS", () => {
    beforeEach(seedConqueredWorld);

    it("counts a power broken only when its whole homeland is held", () => {
        setVictoryCondition({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Brava", "Carda", "Delta"],
            greatPowersRequired: 3
        });
        const progress = victoryProgress("Alba");
        //Carda only: Alba holds both of Carda's, two of Brava's three, none of Delta's.
        expect(progress.detail.broken).toBe(1);
        expect(hasWon("Alba")).toBe(false);
    });

    it("is won when enough powers have been broken", () => {
        setVictoryCondition({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Brava", "Carda", "Delta"],
            greatPowersRequired: 1
        });
        expect(hasWon("Alba")).toBe(true);
        //Carda has been driven off the map entirely and has broken nobody. Brava is NOT
        //the country to check here: it holds the whole of Delta's homeland, so with one
        //power required it has legitimately won too.
        expect(hasWon("Carda")).toBe(false);
    });

    it("routes through a third party -- a homeland held by someone else still counts against you", () => {
        setVictoryCondition({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Delta"],
            greatPowersRequired: 1
        });
        //Delta holds none of its own homeland, but Brava does -- so Alba has not broken it.
        expect(hasWon("Alba")).toBe(false);
        expect(hasWon("Brava")).toBe(true);
    });

    it("never lets a great power count its OWN homeland", () => {
        setVictoryCondition({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Alba", "Brava", "Carda", "Delta"],
            greatPowersRequired: 4
        });
        //Alba holds all three of its own homeland. If that counted, Alba would be
        //credited with a power it has not broken -- and on turn 1 every great power
        //would start the game part-way to winning.
        expect(victoryProgress("Alba").detail.broken).toBe(1);
    });

    it("caps the requirement at the number of powers a country can actually break", () => {
        setVictoryCondition({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Alba", "Carda"],
            greatPowersRequired: 2
        });
        //Alba may only break Carda, so one is all that can be asked of it.
        expect(victoryProgress("Alba").detail.required).toBe(1);
        expect(hasWon("Alba")).toBe(true);
    });

    it("names the power it is closest to finishing", () => {
        setVictoryCondition({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Brava", "Delta"],
            greatPowersRequired: 2
        });
        //Brava at 2 of 3 is closer than Delta at 0 of 2.
        expect(victoryProgress("Alba").label).toBe("Great Powers: 0 of 2 (Brava 2/3)");
    });
});

describe("TURN_LIMIT is decided, not merely measured", () => {
    it("is not won before the limit, however far ahead a country is", () => {
        setVictoryCondition({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 });
        expect(hasWon("Brava", undefined, undefined, 199)).toBe(false);
    });

    it("hands the game to the largest empire by area at the limit", () => {
        setVictoryCondition({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 });
        expect(hasWon("Brava", undefined, undefined, 200)).toBe(true);
        expect(hasWon("Alba", undefined, undefined, 200)).toBe(false);
    });
});

describe("the condition survives being captured", () => {
    it("does not let a saved condition alias the live one's great powers", () => {
        const live = setVictoryCondition({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Brava", "Carda"]
        });
        const saved = captureVictoryCondition();
        live.greatPowers.push("Delta");
        expect(saved.greatPowers).toEqual(["Brava", "Carda"]);
    });
});

describe("closestToVictory -- who is winning, as distinct from who is biggest", () => {
    beforeEach(() => {
        __resetStateForTests();
        seedTerritories(world());
    });

    it("names the country nearest the ACTIVE condition, not the largest empire", () => {
        //Brava holds much the most land -- three Asian territories at 1000 each against
        //Alba's 1900 all told -- so `leadingCountry()` says Brava. But the condition is
        //CONTINENTAL, and Alba owns Europe outright while Brava owns no continent at all.
        //Measuring "who is winning" by area would name the wrong country under four of the
        //five goals, which is the whole reason this function exists beside that one.
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 2 });
        expect(leadingCountry()).toBe("Brava");
        expect(closestToVictory().country).toBe("Alba");
    });

    it("agrees with leadingCountry under DOMINATION, which really is about area", () => {
        setVictoryCondition({ kind: VictoryCondition.DOMINATION, landShare: 0.6 });
        expect(closestToVictory().country).toBe(leadingCountry());
    });

    it("agrees with leadingCountry under TURN_LIMIT, which is the same question", () => {
        setVictoryCondition({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 });
        expect(closestToVictory().country).toBe(leadingCountry());
    });

    it("carries the leader's own progress, so a caller needs no second call", () => {
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 2 });
        const front = closestToVictory();
        expect(front.progress.label).toBe(victoryProgress(front.country).label);
        expect(front.fraction).toBe(front.progress.fraction);
    });

    it("answers null for an empty world rather than throwing", () => {
        __resetStateForTests();
        seedTerritories([]);
        expect(closestToVictory()).toBe(null);
    });

    it("breaks a tie the same way twice, so a seeded run reproduces its own answer", () => {
        setVictoryCondition({ kind: VictoryCondition.CONQUEST });
        expect(closestToVictory().country).toBe(closestToVictory().country);
    });
});
