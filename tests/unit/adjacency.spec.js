import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
    loadAdjacency,
    getReachableFrom,
    isAdjacencyLoaded,
    adjacencyIds,
    __resetAdjacencyForTests,
} from "../../src/data/adjacency.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const COMPACT = path.join(ROOT, "resources", "adjacency.json");
const SOURCE = path.join(ROOT, "resources", "closestPathsData.json");
const SVG = path.join(ROOT, "resources", "svgMaster.svg");

// svgMaster.svg is the authoritative source of territory names -- it is what the
// running game reads. tests/uniqueIdLookup.json is a convenience map that has
// drifted from it before, so these tests never depend on it.
const idToName = (() => {
    const svg = fs.readFileSync(SVG, "utf8");
    const pattern = /territory-name="([^"]*)"[^>]*uniqueid="(\d+)"/g;
    const byId = {};
    let match;
    while ((match = pattern.exec(svg)) !== null) {
        byId[match[2]] = match[1];
    }
    return byId;
})();
const knownNames = new Set(Object.values(idToName));

// Stands in for the browser's fetch, reading the real shipped file off disk so
// the tests exercise the actual data rather than a fixture that can drift.
function makeFetch(file) {
    return vi.fn(async () => ({
        ok: true,
        json: async () => JSON.parse(fs.readFileSync(file, "utf8")),
    }));
}

describe("adjacency data file", () => {
    it("ships a compact adjacency.json", () => {
        expect(fs.existsSync(COMPACT)).toBe(true);
    });

    it("is small enough to parse instantly (< 2 MB)", () => {
        const bytes = fs.statSync(COMPACT).size;
        expect(bytes).toBeLessThan(2 * 1024 * 1024);
    });

    it("covers every territory in the source data", () => {
        const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
        const compact = JSON.parse(fs.readFileSync(COMPACT, "utf8"));
        expect(Object.keys(compact).length).toBe(source.length);
        for (const [id] of source) {
            expect(compact, `missing uniqueId ${id}`).toHaveProperty(id);
        }
    });

    it("preserves neighbour order and content from the source, minus self", () => {
        const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
        const compact = JSON.parse(fs.readFileSync(COMPACT, "utf8"));
        for (const [id, neighbours] of source) {
            const expected = neighbours.map((n) => n[0]).filter((name) => name !== idToName[id]);
            expect(compact[id], `uniqueId ${id}`).toEqual(expected);
        }
    });

    it("never lists a territory as its own neighbour", () => {
        const compact = JSON.parse(fs.readFileSync(COMPACT, "utf8"));
        for (const [id, neighbours] of Object.entries(compact)) {
            expect(neighbours, `uniqueId ${id} lists itself`).not.toContain(idToName[id]);
        }
    });
});

describe("loadAdjacency", () => {
    beforeEach(() => __resetAdjacencyForTests());

    it("reads the data file exactly once no matter how often it is called", async () => {
        const fetchImpl = makeFetch(COMPACT);
        await Promise.all([
            loadAdjacency({ fetchImpl }),
            loadAdjacency({ fetchImpl }),
            loadAdjacency({ fetchImpl }),
        ]);
        await loadAdjacency({ fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("reports not-loaded before the load and loaded after", async () => {
        expect(isAdjacencyLoaded()).toBe(false);
        await loadAdjacency({ fetchImpl: makeFetch(COMPACT) });
        expect(isAdjacencyLoaded()).toBe(true);
    });

    it("rejects and stays unloaded if the fetch fails", async () => {
        const failing = vi.fn(async () => ({ ok: false, status: 404 }));
        await expect(loadAdjacency({ fetchImpl: failing })).rejects.toThrow();
        expect(isAdjacencyLoaded()).toBe(false);
    });
});

describe("getReachableFrom", () => {
    beforeEach(async () => {
        __resetAdjacencyForTests();
        await loadAdjacency({ fetchImpl: makeFetch(COMPACT) });
    });

    it("is synchronous and returns territory names", () => {
        const names = getReachableFrom("7"); // Vatican City
        expect(Array.isArray(names)).toBe(true);
        expect(names).toContain("Italy");
        expect(names.every((n) => typeof n === "string")).toBe(true);
    });

    it("accepts a number as well as a string id", () => {
        expect(getReachableFrom(7)).toEqual(getReachableFrom("7"));
    });

    it("excludes the territory itself", () => {
        expect(getReachableFrom("7")).not.toContain("Vatican City");
    });

    // The two territories whose names carry a parenthetical qualifier. These are
    // real names in the SVG, not typos, and tests/uniqueIdLookup.json used to
    // disagree -- which quietly broke self-stripping for exactly these two.
    it.each([
        ["24", "Grand Bahama (Bahamas)"],
        ["25", "Andros Island (Bahamas)"],
    ])("strips self for %s (%s), whose name carries a qualifier", (id, name) => {
        expect(idToName[id]).toBe(name);
        expect(getReachableFrom(id)).not.toContain(name);
        expect(getReachableFrom(id).length).toBeGreaterThan(0);
    });

    it("only ever names territories that exist in the SVG", () => {
        for (const id of adjacencyIds()) {
            for (const name of getReachableFrom(id)) {
                expect(knownNames.has(name), `uniqueId ${id} -> unknown ${name}`).toBe(true);
            }
        }
    });

    it("returns every id present in the data", () => {
        for (const id of adjacencyIds()) {
            expect(Array.isArray(getReachableFrom(id)), `uniqueId ${id}`).toBe(true);
        }
        expect(adjacencyIds().length).toBe(359);
    });

    it("returns an empty array for an unknown id rather than throwing", () => {
        expect(getReachableFrom("99999")).toEqual([]);
    });

    it("returns a copy, so a caller mutating the result cannot corrupt the index", () => {
        const first = getReachableFrom("7");
        first.push("Atlantis");
        expect(getReachableFrom("7")).not.toContain("Atlantis");
    });

    it("throws a clear error if called before the data is loaded", () => {
        __resetAdjacencyForTests();
        expect(() => getReachableFrom("7")).toThrow(/loadAdjacency/i);
    });
});
