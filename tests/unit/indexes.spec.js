import { describe, it, expect, beforeEach } from "vitest";

import {
    buildPathIndex,
    getPathByUniqueId,
    getPathByName,
    isPathIndexBuilt,
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

// The territory half of this module moved into GameState in Phase 4.1 -- there is one
// Map over the territories now, not two. Its tests are in state.spec.js.
