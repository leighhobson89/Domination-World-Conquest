// src/ai/doctrine.js -- the seam between the chosen goal and how the AI plays.
//
// Before this module, `chooseObjective()` in `strategy.js` was the ONLY place the active
// victory condition was consumed, and all it did was turn the kind into a number of
// continents: CONTINENTAL gave its own figure, DOMINATION gave four, and everything else
// gave two. An AI under Great Powers campaigned for two arbitrary continents and never
// looked at a great power in its life.
//
// So the property worth pinning here is not "the numbers are these numbers" -- it is that
// the five goals produce five DIFFERENT doctrines, and that the two dials which have been
// dangerous before behave: urgency never touches a siege budget (it is not even offered
// one), and `neverSatisfied` is set by exactly the one goal that has no resting point.
//
// Runs in Node: `doctrine.js` imports `config/` and its two pure siblings and nothing else.

import { beforeEach, describe, expect, it } from "vitest";

import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import { doctrineFor, urgencyFor } from "../../src/ai/doctrine.js";
import {
    resetVictoryCondition,
    VictoryCondition,
    victoryProgress,
    worldStandings
} from "../../src/ai/victory.js";
import { doctrineUrgency } from "../../src/config/balance.js";

/**
 * A world of three continents in which Brava is plainly running away with it.
 *
 * Alba holds Europe outright and a corner of Africa; Brava holds most of Asia, whose
 * territories are ten times the area of Europe's, so Brava is much the largest empire by
 * LAND even though the territory counts are closer. That gap is the whole point -- urgency
 * is measured in area, and a fixture where area and count agreed would not show it.
 */
function world() {
    const rows = [
        ["EU1", "Europe", "Alba", 100, "Alba"],
        ["EU2", "Europe", "Alba", 100, "Alba"],
        ["EU3", "Europe", "Alba", 100, "Alba"],
        ["AF1", "Africa", "Alba", 200, "Carda"],
        ["AF2", "Africa", "Carda", 200, "Carda"],
        ["AF3", "Africa", "Carda", 200, "Carda"],
        ["AS1", "Asia", "Brava", 1000, "Brava"],
        ["AS2", "Asia", "Brava", 1000, "Brava"],
        ["AS3", "Asia", "Brava", 1000, "Brava"],
        ["AS4", "Asia", "Brava", 1000, "Brava"],
        ["AS5", "Asia", "Alba", 1000, "Brava"]
    ];
    return rows.map(([name, continent, owner, area, originalOwner], index) => ({
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

function standings() {
    return worldStandings();
}

function condition(overrides = {}) {
    return {
        kind: VictoryCondition.CONTINENTAL,
        continentsRequired: 3,
        landShare: 0.6,
        turnLimit: 200,
        greatPowers: [],
        greatPowersRequired: 5,
        ...overrides
    };
}

function doctrine(conditionOverrides = {}, country = "Alba", turn = 10) {
    const active = condition(conditionOverrides);
    const table = standings();
    return doctrineFor(active, {
        country,
        turn,
        standings: table,
        progress: victoryProgress(country, active, table, turn)
    });
}

beforeEach(() => {
    __resetStateForTests();
    seedTerritories(world());
    resetVictoryCondition();
});

describe("doctrineFor -- one row per goal", () => {
    it("gives CONTINENTAL the continent count the condition itself asks for", () => {
        expect(doctrine({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 2 })
            .continentsToCommit).toBe(2);
        expect(doctrine({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 4 })
            .continentsToCommit).toBe(4);
    });

    it("spreads DOMINATION over four continents and makes it hungry for area", () => {
        const domination = doctrine({ kind: VictoryCondition.DOMINATION });
        expect(domination.continentsToCommit).toBe(4);
        expect(domination.areaHunger).toBeGreaterThan(
            doctrine({ kind: VictoryCondition.CONTINENTAL }).areaHunger);
    });

    it("asks CONQUEST for every continent there is, and never lets it stop", () => {
        const conquest = doctrine({ kind: VictoryCondition.CONQUEST });
        expect(conquest.continentsToCommit).toBe(Infinity);
        expect(conquest.neverSatisfied).toBe(true);
    });

    it("leaves every other goal satisfiable", () => {
        for (const kind of [VictoryCondition.CONTINENTAL, VictoryCondition.DOMINATION,
            VictoryCondition.GREAT_POWERS, VictoryCondition.TURN_LIMIT]) {
            expect(doctrine({ kind }).neverSatisfied).toBe(false);
        }
    });

    it("carries the goal's kind through, so a consumer never has to be told twice", () => {
        expect(doctrine({ kind: VictoryCondition.TURN_LIMIT }).kind)
            .toBe(VictoryCondition.TURN_LIMIT);
    });

    it("falls back to the CONTINENTAL row for a kind it has never heard of", () => {
        const unknown = doctrine({ kind: "SOMETHING_ELSE", continentsRequired: 3 });
        expect(unknown.continentsToCommit).toBe(3);
        expect(unknown.neverSatisfied).toBe(false);
    });

    it("produces a visibly different doctrine for each of the five goals", () => {
        const shapes = [
            VictoryCondition.CONQUEST,
            VictoryCondition.CONTINENTAL,
            VictoryCondition.DOMINATION,
            VictoryCondition.GREAT_POWERS,
            VictoryCondition.TURN_LIMIT
        ].map(kind => {
            const row = doctrine({ kind, greatPowers: ["Brava", "Carda"] });
            return row.continentsToCommit + "/" + row.areaHunger + "/" +
                row.targetCountries.length;
        });
        expect(new Set(shapes).size).toBe(shapes.length);
    });
});

describe("targetCountries -- only Great Powers has an antagonist", () => {
    it("is empty under every goal but Great Powers", () => {
        for (const kind of [VictoryCondition.CONQUEST, VictoryCondition.CONTINENTAL,
            VictoryCondition.DOMINATION, VictoryCondition.TURN_LIMIT]) {
            expect(doctrine({ kind, greatPowers: ["Brava", "Carda"] }).targetCountries)
                .toEqual([]);
        }
    });

    it("names the powers still to be broken", () => {
        const powers = doctrine({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Brava", "Carda"],
            greatPowersRequired: 2
        }).targetCountries;
        expect(powers).toContain("Brava");
        expect(powers).toContain("Carda");
    });

    it("never names the country itself -- a power does not campaign against its own homeland", () => {
        const powers = doctrine({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Alba", "Brava", "Carda"],
            greatPowersRequired: 3
        }, "Alba").targetCountries;
        expect(powers).not.toContain("Alba");
    });

    it("drops a power whose homeland this country already holds outright", () => {
        //Alba holds all three of its own Europe territories, and Brava's homeland is the
        //five Asian ones, of which Alba holds one. Carda's homeland is Africa: Alba holds
        //AF1 but not AF2 or AF3, so Carda is still a target and Brava is too. Give Carda's
        //whole homeland to Alba by naming a power nobody holds anything of instead.
        const powers = doctrine({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Brava", "Carda"],
            greatPowersRequired: 2
        }, "Carda").targetCountries;
        //Carda holds two of the three Africa territories it originally owned, so it is not
        //done with itself -- but it never lists itself anyway.
        expect(powers).toEqual(["Brava"]);
    });
});

describe("urgency -- the runaway-leader response", () => {
    it("rises with the strongest rival's share of the world's land", () => {
        //Alba's strongest rival is Brava, which holds four of the five Asian territories:
        //4000 of a world of 5900, well past the share at which urgency saturates.
        const alba = doctrine({ kind: VictoryCondition.CONTINENTAL }, "Alba").urgency;
        expect(alba).toBe(1);
    });

    it("never reads the country's OWN size as a reason to hurry", () => {
        //Brava is the runaway. Its strongest rival is Alba, which holds much less, so
        //Brava's urgency must be lower than everybody else's -- it is the one country with
        //no reason to panic.
        const brava = doctrine({ kind: VictoryCondition.CONTINENTAL }, "Brava").urgency;
        const carda = doctrine({ kind: VictoryCondition.CONTINENTAL }, "Carda").urgency;
        expect(brava).toBeLessThan(carda);
    });

    it("never falls below the floor, and never rises above one", () => {
        for (const country of ["Alba", "Brava", "Carda", "Nobody"]) {
            const value = doctrine({ kind: VictoryCondition.CONTINENTAL }, country).urgency;
            expect(value).toBeGreaterThanOrEqual(doctrineUrgency.floor);
            expect(value).toBeLessThanOrEqual(1);
        }
    });

    it("comes from the CLOCK in a timed game, not from the standings", () => {
        const early = doctrine({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 },
            "Brava", 20).urgency;
        const late = doctrine({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 },
            "Brava", 190).urgency;
        expect(late).toBeGreaterThan(early);
        expect(late).toBeCloseTo(0.95, 5);
    });

    it("clamps a timed game that has run past its own limit", () => {
        expect(doctrine({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 }, "Alba", 400)
            .urgency).toBe(1);
    });

    it("is derived once for the whole world, not once per country", () => {
        //`urgencyFor()` is exported so the sim and the debug panel can ask the same
        //question the doctrine asks, without building a doctrine to get at it.
        const table = standings();
        expect(urgencyFor("Alba", table)).toBe(
            doctrineFor(condition(), {
                country: "Alba", turn: 1, standings: table,
                progress: victoryProgress("Alba", condition(), table, 1)
            }).urgency
        );
    });
});

describe("the shape of the answer", () => {
    it("is frozen, so a consumer cannot tune the world by writing to its own doctrine", () => {
        const row = doctrine();
        expect(Object.isFrozen(row)).toBe(true);
    });

    it("offers no siege dial at all -- urgency must never reach the siege budget", () => {
        expect(Object.keys(doctrine()).some(key => /siege/i.test(key))).toBe(false);
    });

    it("survives being asked with nothing at all", () => {
        const row = doctrineFor(undefined, {});
        expect(row.kind).toBe(VictoryCondition.CONTINENTAL);
        expect(row.targetCountries).toEqual([]);
        expect(Number.isFinite(row.urgency)).toBe(true);
    });
});
