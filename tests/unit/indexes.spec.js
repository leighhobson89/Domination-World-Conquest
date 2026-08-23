import { describe, it, expect, beforeEach } from "vitest";

import {
    buildPathIndex,
    buildTerritoryIndex,
    getPathByUniqueId,
    getPathByName,
    getTerritoryByUniqueId,
    getTerritoryByName,
    isPathIndexBuilt,
    isTerritoryIndexBuilt,
    __resetIndexesForTests,
} from "../../src/state/indexes.js";

/** Minimal stand-in for an SVG <path>: only getAttribute is ever used. */
const fakePath = (attrs) => ({
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    __attrs: attrs,
});

const paths = [
    fakePath({ uniqueid: "0", "territory-name": "United Kingdom", "data-name": "United Kingdom" }),
    fakePath({ uniqueid: "7", "territory-name": "Vatican City", "data-name": "Vatican City" }),
    fakePath({ uniqueid: "8", "territory-name": "Italy", "data-name": "Italy" }),
];

const territories = [
    { uniqueId: "8", territoryName: "Italy", dataName: "Italy" },
    { uniqueId: "0", territoryName: "United Kingdom", dataName: "United Kingdom" },
    { uniqueId: "7", territoryName: "Vatican City", dataName: "Vatican City" },
];

beforeEach(() => __resetIndexesForTests());

describe("path index", () => {
    it("reports not built before building", () => {
        expect(isPathIndexBuilt()).toBe(false);
    });

    it("looks a path up by uniqueId in either string or number form", () => {
        buildPathIndex(paths);
        expect(getPathByUniqueId("7")).toBe(paths[1]);
        expect(getPathByUniqueId(7)).toBe(paths[1]);
    });

    it("looks a path up by territory name", () => {
        buildPathIndex(paths);
        expect(getPathByName("Italy")).toBe(paths[2]);
    });

    it("returns null for an unknown key rather than throwing", () => {
        buildPathIndex(paths);
        expect(getPathByUniqueId("9999")).toBe(null);
        expect(getPathByName("Atlantis")).toBe(null);
    });

    it("ignores elements with no uniqueid, such as the background rect", () => {
        buildPathIndex([...paths, fakePath({})]);
        expect(isPathIndexBuilt()).toBe(true);
        expect(getPathByUniqueId("7")).toBe(paths[1]);
    });

    it("rebuilds cleanly, dropping entries that no longer exist", () => {
        buildPathIndex(paths);
        buildPathIndex([paths[0]]);
        expect(getPathByUniqueId("0")).toBe(paths[0]);
        expect(getPathByUniqueId("7")).toBe(null);
    });

    it("throws a clear error if queried before being built", () => {
        expect(() => getPathByUniqueId("7")).toThrow(/buildPathIndex/i);
        expect(() => getPathByName("Italy")).toThrow(/buildPathIndex/i);
    });
});

describe("territory index", () => {
    it("looks a territory up by uniqueId regardless of array order", () => {
        // mainGameArray is sorted by defenseBonus, so position never matches uniqueId.
        buildTerritoryIndex(territories);
        expect(getTerritoryByUniqueId("0")).toBe(territories[1]);
        expect(getTerritoryByUniqueId(0)).toBe(territories[1]);
    });

    it("looks a territory up by name", () => {
        buildTerritoryIndex(territories);
        expect(getTerritoryByName("Vatican City")).toBe(territories[2]);
    });

    it("returns null for an unknown key", () => {
        buildTerritoryIndex(territories);
        expect(getTerritoryByUniqueId("9999")).toBe(null);
        expect(getTerritoryByName("Atlantis")).toBe(null);
    });

    it("throws a clear error if queried before being built", () => {
        expect(() => getTerritoryByUniqueId("0")).toThrow(/buildTerritoryIndex/i);
    });

    it("indexes by identity, so a lookup returns the live object", () => {
        buildTerritoryIndex(territories);
        getTerritoryByUniqueId("8").goldForCurrentTerritory = 123;
        expect(territories[0].goldForCurrentTerritory).toBe(123);
    });

    it("is independent of the path index", () => {
        buildTerritoryIndex(territories);
        expect(isTerritoryIndexBuilt()).toBe(true);
        expect(isPathIndexBuilt()).toBe(false);
    });
});
