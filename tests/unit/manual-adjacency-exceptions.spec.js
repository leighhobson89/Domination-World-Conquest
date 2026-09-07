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

    it("carries the rules it is meant to, counted", () => {
        // The legacy table listed 96 additions across 69 keys, but "New Caledonia 1"
        // appeared twice and both entries contained "New Zealand North Island".
        // Merging the two keys left 95 distinct additions across 68 territories.
        //
        // 100 NOW, AND THE FIVE ARE NOT NEW CROSSINGS. Five of the ninety-five were
        // listed on one side only -- "Fiji 1" written where "Fiji 2" was meant, and
        // back -- so five straits in the south Pacific ran in one direction. The
        // missing reciprocals were added rather than the crossings deleted; the
        // symmetry spec above is what now makes the class of defect impossible.
        //
        // 102 ACROSS 69 KEYS NOW: Greenland is a new key and Svalbard gained a target,
        // which is the second Europe <-> North America crossing. Before it, Greenland <->
        // Iceland was the ONLY one on the map and Greenland had two neighbours in the whole
        // game -- see the note beside the rule and docs/06-force-and-succession.md section 7.
        const all = Object.values(manualAdjacencyExceptions).flat();
        expect(Object.keys(manualAdjacencyExceptions).length).toBe(69);
        expect(all.filter(([, f]) => f === ADD).length).toBe(102);
        expect(all.filter(([, f]) => f === DENY).length).toBe(6);
    });

    // The crossing this table exists to make possible, asserted by name because it is a
    // deliberate change to the map's strategic geography rather than a repair: North
    // America reaches Europe through TWO territories now, not one.
    it("gives North America a second door into Europe", () => {
        expect(getManualAdditions("Greenland")).toContain("Svalbard");
        expect(getManualAdditions("Svalbard")).toContain("Greenland");
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

    // Every crossing in this table is a two-way strait, and the geometry underneath it
    // is perfectly symmetric -- `adjacency.spec.js` asserts zero one-way edges in
    // resources/adjacency.json. So an addition listed on one side only is a typo, and it
    // produces the one thing the map should never contain: a territory that can be
    // attacked from a neighbour it cannot attack back. Five of them survived here for as
    // long as the table has existed (Fiji 1 written where Fiji 2 was meant, and back),
    // and they were invisible because nothing compared the two directions.
    it("carries every addition as a symmetric pair", () => {
        const additions = Object.entries(manualAdjacencyExceptions).flatMap(([source, targets]) =>
            targets.filter(([, f]) => f === ADD).map(([target]) => [source, target])
        );
        for (const [a, b] of additions) {
            expect(getManualAdditions(b), `${b} should add ${a} back`).toContain(a);
        }
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
