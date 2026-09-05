// src/state/continents.js -- who holds what, per continent.
//
// The primitive the continent-bonus phase is built on, and the one definition of "holds a
// continent outright" in the codebase. It lives in `state/` rather than in `src/ai/` because
// both `src/ai/` and `src/rules/` need it and `src/rules/victoryCheck.js` already imports
// `src/ai/victory.js` -- putting it there would close a package-level cycle.
//
// It is pure: it takes its territories as an argument and imports nothing but `config/`, so
// every case below runs in Node with no store and no DOM.

import { describe, expect, it } from "vitest";

import {
    accumulateContinent,
    continentControl,
    continentsHeldOutrightBy,
    holdsContinentOutright
} from "../../src/state/continents.js";

function territory(name, continent, owner, overrides = {}) {
    return {
        uniqueId: name,
        territoryName: name,
        continent,
        dataName: owner,
        area: 100,
        ...overrides
    };
}

/**
 * Europe (3) held whole by Alba, Africa (4) split two-two, Asia (2) held whole by Carda.
 *
 * Areas are uneven on purpose: control is counted in TERRITORIES, and a fixture where the
 * two agree could not tell them apart.
 */
function world() {
    return [
        territory("EU1", "Europe", "Alba", { area: 10 }),
        territory("EU2", "Europe", "Alba", { area: 10 }),
        territory("EU3", "Europe", "Alba", { area: 10 }),
        territory("AF1", "Africa", "Alba", { area: 200 }),
        territory("AF2", "Africa", "Alba", { area: 200 }),
        territory("AF3", "Africa", "Brava", { area: 200 }),
        territory("AF4", "Africa", "Brava", { area: 200 }),
        territory("AS1", "Asia", "Carda", { area: 1000 }),
        territory("AS2", "Asia", "Carda", { area: 1000 })
    ];
}

describe("continentControl", () => {
    it("counts every continent's territories and areas in one pass", () => {
        const control = continentControl(world());

        expect([...control.keys()].sort()).toEqual(["Africa", "Asia", "Europe"]);
        expect(control.get("Europe").total).toBe(3);
        expect(control.get("Europe").area).toBe(30);
        expect(control.get("Asia").total).toBe(2);
        expect(control.get("Asia").area).toBe(2000);
    });

    it("records each owner's holding on each continent", () => {
        const control = continentControl(world());

        expect(control.get("Africa").held.get("Alba")).toEqual({ count: 2, area: 400 });
        expect(control.get("Africa").held.get("Brava")).toEqual({ count: 2, area: 400 });
        expect(control.get("Europe").held.has("Brava")).toBe(false);
    });

    it("files a territory with no continent under Unknown rather than under null", () => {
        const control = continentControl([territory("X1", undefined, "Alba")]);

        expect(control.get("Unknown").total).toBe(1);
        expect(control.has(undefined)).toBe(false);
    });

    it("answers an empty world with an empty map rather than throwing", () => {
        expect(continentControl([]).size).toBe(0);
    });

    it("treats a non-numeric area as zero rather than propagating NaN", () => {
        const control = continentControl([territory("X1", "Europe", "Alba", { area: "wide" })]);

        expect(control.get("Europe").area).toBe(0);
    });
});

describe("what counts towards control", () => {
    //Both of these are DECISIONS rather than accidents, so both are asserted. A siege is a
    //thing happening to a territory you hold; the deactivation lockout is about what a
    //territory can DO, not about who owns it.
    it("counts a besieged territory", () => {
        const rows = world();
        rows[0].underSiege = true;
        const control = continentControl(rows);

        expect(holdsContinentOutright("Alba", "Europe", control)).toBe(true);
    });

    it("counts a freshly conquered, deactivated territory", () => {
        const rows = world();
        rows[1].deactivated = true;
        const control = continentControl(rows);

        expect(holdsContinentOutright("Alba", "Europe", control)).toBe(true);
    });
});

describe("holdsContinentOutright", () => {
    it("is true only when the owner holds every territory on the continent", () => {
        const control = continentControl(world());

        expect(holdsContinentOutright("Alba", "Europe", control)).toBe(true);
        expect(holdsContinentOutright("Alba", "Africa", control)).toBe(false);
        expect(holdsContinentOutright("Brava", "Africa", control)).toBe(false);
        expect(holdsContinentOutright("Carda", "Asia", control)).toBe(true);
    });

    it("answers false for a continent that is not on the map", () => {
        const control = continentControl(world());

        expect(holdsContinentOutright("Alba", "Antarctica", control)).toBe(false);
    });

    it("answers false for an owner holding nothing, and for no owner at all", () => {
        const control = continentControl(world());

        expect(holdsContinentOutright("Delta", "Europe", control)).toBe(false);
        expect(holdsContinentOutright(undefined, "Europe", control)).toBe(false);
    });

    it("answers false rather than throwing when handed no control at all", () => {
        expect(holdsContinentOutright("Alba", "Europe", undefined)).toBe(false);
        expect(holdsContinentOutright("Alba", "Europe", new Map())).toBe(false);
    });

    it("answers false for a continent with no territories on it", () => {
        //A zero-territory continent is vacuously held by everybody under a naive
        //`held === total` test, which would hand every country on the map a bonus.
        const control = new Map([["Europe", { continent: "Europe", total: 0, area: 0, held: new Map() }]]);

        expect(holdsContinentOutright("Alba", "Europe", control)).toBe(false);
    });
});

describe("continentsHeldOutrightBy", () => {
    it("names every continent the owner holds whole, alphabetically", () => {
        const rows = world();
        rows[5].dataName = "Alba";
        rows[6].dataName = "Alba";
        const control = continentControl(rows);

        expect(continentsHeldOutrightBy("Alba", control)).toEqual(["Africa", "Europe"]);
    });

    it("is empty for an owner holding no continent whole", () => {
        expect(continentsHeldOutrightBy("Brava", continentControl(world()))).toEqual([]);
    });

    it("is empty rather than throwing for an unknown owner or no control", () => {
        expect(continentsHeldOutrightBy("Delta", continentControl(world()))).toEqual([]);
        expect(continentsHeldOutrightBy("Alba", undefined)).toEqual([]);
    });
});

describe("accumulateContinent", () => {
    //This is the seam `worldStandings()` uses, so that the AI's walk over the map and this
    //module are ONE definition and ONE pass rather than two of each.
    it("builds the same map one territory at a time", () => {
        const rows = world();
        const oneAtATime = new Map();
        for (const row of rows) {
            accumulateContinent(oneAtATime, row);
        }

        expect(oneAtATime).toEqual(continentControl(rows));
    });
});
