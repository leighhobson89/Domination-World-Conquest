import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
    manualAdjacencyExceptions,
    getManualAdditions,
    getManualDenials,
    ADD,
    DENY,
} from "../../src/data/manualAdjacencyExceptions.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
// Names come from the SVG, which is what the running game reads.
const territoryNames = new Set(
    [
        ...fs
            .readFileSync(path.join(ROOT, "resources", "svgMaster.svg"), "utf8")
            .matchAll(/territory-name="([^"]*)"/g),
    ].map((m) => m[1])
);

describe("manual adjacency exceptions table", () => {
    it("is available synchronously on import, with no timer or async load", () => {
        // The legacy module built this behind `setTimeout(..., 1000)` before a
        // dynamic import of resourceCalculations.js. If the territory model was not
        // ready in time, every id lookup returned undefined and the whole table
        // silently collapsed. A plain data module cannot lose that race.
        expect(typeof manualAdjacencyExceptions).toBe("object");
        expect(Object.keys(manualAdjacencyExceptions).length).toBeGreaterThan(0);
    });

    it("is keyed by territory name, and every key is a real territory", () => {
        for (const name of Object.keys(manualAdjacencyExceptions)) {
            expect(
                territoryNames.has(name),
                `unknown source territory ${JSON.stringify(name)}`
            ).toBe(true);
        }
    });

    it("every target is a real territory", () => {
        for (const [source, targets] of Object.entries(manualAdjacencyExceptions)) {
            for (const [target] of targets) {
                expect(
                    territoryNames.has(target),
                    `${source} -> unknown target ${JSON.stringify(target)}`
                ).toBe(true);
            }
        }
    });

    it("uses only the ADD and DENY flags", () => {
        for (const targets of Object.values(manualAdjacencyExceptions)) {
            for (const [, flag] of targets) {
                expect([ADD, DENY]).toContain(flag);
            }
        }
    });

    it("carries the same rules as the legacy table, minus one duplicate", () => {
        // The legacy table listed 96 additions across 69 keys, but "New Caledonia 1"
        // appeared twice and both entries contained "New Zealand North Island".
        // Merging the two keys leaves 95 distinct additions across 68 territories.
        const all = Object.values(manualAdjacencyExceptions).flat();
        expect(Object.keys(manualAdjacencyExceptions).length).toBe(68);
        expect(all.filter(([, f]) => f === ADD).length).toBe(95);
        expect(all.filter(([, f]) => f === DENY).length).toBe(6);
    });

    it("lists no target twice for the same territory", () => {
        for (const [source, targets] of Object.entries(manualAdjacencyExceptions)) {
            const keys = targets.map(([t, f]) => `${t}:${f}`);
            expect(new Set(keys).size, `${source} has a duplicate target`).toBe(keys.length);
        }
    });

    // Regression: the legacy table was a `new Map([...])` with "New Caledonia 1"
    // present twice. The second entry silently overwrote the first, losing the
    // King Island and Fraser Island links.
    it("keeps every target of New Caledonia 1, which was listed twice in the legacy Map", () => {
        expect(getManualAdditions("New Caledonia 1").sort()).toEqual(
            ["Fraser Island", "King Island", "New Zealand North Island"].sort()
        );
    });

    // "Grand Bahama (Bahamas)" looks like a typo and is not: that is the real
    // territory-name in svgMaster.svg. The rule below must keep the qualifier.
    it("links Grand Bahama (Bahamas) to Bermuda and the United States", () => {
        expect(getManualAdditions("Grand Bahama (Bahamas)")).toEqual(
            expect.arrayContaining(["Bermuda", "United States"])
        );
        expect(getManualAdditions("Bermuda")).toContain("Grand Bahama (Bahamas)");
        expect(getManualAdditions("United States")).toContain("Grand Bahama (Bahamas)");
    });

    it("carries the six known denials, as three symmetric pairs", () => {
        const denials = Object.entries(manualAdjacencyExceptions).flatMap(([source, targets]) =>
            targets.filter(([, f]) => f === DENY).map(([target]) => [source, target])
        );
        expect(denials.length).toBe(6);
        for (const [a, b] of denials) {
            expect(getManualDenials(b), `${b} should deny ${a} back`).toContain(a);
        }
    });
});

describe("getManualAdditions / getManualDenials", () => {
    it("returns the added neighbours for a territory", () => {
        expect(getManualAdditions("Fiji 2")).toEqual(
            expect.arrayContaining(["Vanuatu 2", "New Caledonia 2", "New Caledonia 3"])
        );
    });

    it("returns the denied neighbours for a territory", () => {
        expect(getManualDenials("Laos")).toEqual(["Hainan Island"]);
        expect(getManualDenials("United Kingdom")).toEqual(["Luxembourg"]);
    });

    it("returns an empty array for a territory with no exceptions", () => {
        expect(getManualAdditions("Germany")).toEqual([]);
        expect(getManualDenials("Germany")).toEqual([]);
    });

    it("does not mix additions into denials or vice versa", () => {
        expect(getManualAdditions("Laos")).not.toContain("Hainan Island");
        expect(getManualDenials("Fiji 2")).toEqual([]);
    });

    it("returns a copy so callers cannot corrupt the table", () => {
        getManualAdditions("Fiji 2").push("Atlantis");
        expect(getManualAdditions("Fiji 2")).not.toContain("Atlantis");
    });
});
