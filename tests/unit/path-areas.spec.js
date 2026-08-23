import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
    loadPrecomputedPathAreas,
    precomputedAreasFor,
    __resetPathAreasForTests,
} from "../../src/data/pathAreas.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const DATA = path.join(ROOT, "resources", "pathAreas.json");
const SVG = path.join(ROOT, "resources", "svgMaster.svg");

const payload = () => JSON.parse(fs.readFileSync(DATA, "utf8"));

const fetchOf = (body) => vi.fn(async () => ({ ok: true, json: async () => body }));

/** Minimal stand-in for the live SVG path list. */
const fakePaths = (ids) =>
    ids.map((id) => ({ getAttribute: (name) => (name === "uniqueid" ? String(id) : null) }));

const livePaths = () => fakePaths(payload().areas.map((a) => a.uniqueId));

beforeEach(() => __resetPathAreasForTests());

describe("precomputed path areas file", () => {
    it("exists and is small", () => {
        expect(fs.existsSync(DATA)).toBe(true);
        expect(fs.statSync(DATA).size).toBeLessThan(200 * 1024);
    });

    it("covers every path in the SVG", () => {
        const svgIds = [...fs.readFileSync(SVG, "utf8").matchAll(/uniqueid="(\d+)"/g)].map(
            (m) => m[1]
        );
        const data = payload();
        expect(data.pathCount).toBe(svgIds.length);
        expect(data.areas.map((a) => a.uniqueId).sort()).toEqual(svgIds.sort());
    });

    it("sums to the world area the game scales to", () => {
        const data = payload();
        const total = data.areas.reduce((sum, entry) => sum + entry.area, 0);
        expect(total).toBeCloseTo(data.totalWorldAreaKm2, 0);
    });

    it("records the guard fields the runtime checks", () => {
        const data = payload();
        expect(data.svgBytes).toBe(fs.statSync(SVG).size);
        expect(data.sampledPoints).toBe(80);
    });

    it("gives every territory a positive area", () => {
        expect(payload().areas.filter((a) => !(a.area > 0))).toEqual([]);
    });
});

describe("precomputedAreasFor", () => {
    it("returns the precomputed areas when the SVG matches", async () => {
        await loadPrecomputedPathAreas({ fetchImpl: fetchOf(payload()) });
        const areas = precomputedAreasFor(livePaths(), payload().svgBytes);
        expect(areas).not.toBeNull();
        expect(areas.length).toBe(359);
        expect(areas[0]).toHaveProperty("area");
        expect(areas[0]).toHaveProperty("uniqueId");
    });

    it("falls back to null when the path count disagrees", async () => {
        await loadPrecomputedPathAreas({ fetchImpl: fetchOf(payload()) });
        const oneShort = livePaths().slice(0, 358);
        expect(precomputedAreasFor(oneShort, payload().svgBytes)).toBeNull();
    });

    it("falls back to null when a uniqueId is not in the precomputed set", async () => {
        await loadPrecomputedPathAreas({ fetchImpl: fetchOf(payload()) });
        const swapped = livePaths();
        swapped[10] = fakePaths(["99999"])[0];
        expect(precomputedAreasFor(swapped, payload().svgBytes)).toBeNull();
    });

    it("falls back to null when the SVG byte size has changed", async () => {
        await loadPrecomputedPathAreas({ fetchImpl: fetchOf(payload()) });
        expect(precomputedAreasFor(livePaths(), payload().svgBytes + 1)).toBeNull();
    });

    it("falls back to null when the data never loaded", () => {
        expect(precomputedAreasFor(livePaths(), 123)).toBeNull();
    });

    it("does not reject when the file is missing -- the caller just recomputes", async () => {
        const missing = vi.fn(async () => ({ ok: false, status: 404 }));
        await expect(loadPrecomputedPathAreas({ fetchImpl: missing })).resolves.toBeNull();
        expect(precomputedAreasFor(livePaths(), 1)).toBeNull();
    });

    it("reads the file only once however many times it is asked", async () => {
        const fetchImpl = fetchOf(payload());
        await Promise.all([
            loadPrecomputedPathAreas({ fetchImpl }),
            loadPrecomputedPathAreas({ fetchImpl }),
        ]);
        await loadPrecomputedPathAreas({ fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("returns copies, so a caller cannot corrupt the cached data", async () => {
        await loadPrecomputedPathAreas({ fetchImpl: fetchOf(payload()) });
        const first = precomputedAreasFor(livePaths(), payload().svgBytes);
        first[0].area = -1;
        const second = precomputedAreasFor(livePaths(), payload().svgBytes);
        expect(second[0].area).toBeGreaterThan(0);
    });
});
