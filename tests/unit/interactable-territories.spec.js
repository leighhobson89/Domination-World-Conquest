import { describe, it, expect, beforeAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
    loadAdjacency,
    getReachableFrom,
    getInteractableFrom,
    __resetAdjacencyForTests,
} from "../../src/data/adjacency.js";
import { getManualAdditions, getManualDenials } from "../../src/data/manualAdjacencyExceptions.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const COMPACT = path.join(ROOT, "resources", "adjacency.json");
// Names and ids come from the SVG, which is what the running game reads.
const nameToId = Object.fromEntries(
    [
        ...fs
            .readFileSync(path.join(ROOT, "resources", "svgMaster.svg"), "utf8")
            .matchAll(/territory-name="([^"]*)"[^>]*uniqueid="(\d+)"/g),
    ].map((m) => [m[1], m[2]])
);

const idOf = (name) => nameToId[name];
const interactableFor = (name) => getInteractableFrom(idOf(name), name);

beforeAll(async () => {
    __resetAdjacencyForTests();
    await loadAdjacency({
        fetchImpl: vi.fn(async () => ({
            ok: true,
            json: async () => JSON.parse(fs.readFileSync(COMPACT, "utf8")),
        })),
    });
});

describe("getInteractableFrom", () => {
    it("starts from the raw adjacency for a territory with no exceptions", () => {
        expect(interactableFor("Germany")).toEqual(getReachableFrom(idOf("Germany")));
    });

    it("never includes the territory itself", () => {
        for (const name of Object.keys(nameToId)) {
            expect(interactableFor(name), `${name} reaches itself`).not.toContain(name);
        }
    });

    it("adds the manual additions", () => {
        const result = interactableFor("Fiji 2");
        for (const added of getManualAdditions("Fiji 2")) {
            expect(result, `Fiji 2 should reach ${added}`).toContain(added);
        }
    });

    it("removes the manual denials", () => {
        expect(getManualDenials("Laos")).toContain("Hainan Island");
        expect(interactableFor("Laos")).not.toContain("Hainan Island");
        expect(interactableFor("Hainan Island")).not.toContain("Laos");
    });

    it("removes a denial even when the raw adjacency lists it", () => {
        // The denials exist precisely because the geometric adjacency is wrong.
        const raw = getReachableFrom(idOf("United Kingdom"));
        expect(raw).toContain("Luxembourg");
        expect(interactableFor("United Kingdom")).not.toContain("Luxembourg");
    });

    it("does not duplicate a neighbour that is both adjacent and manually added", () => {
        for (const name of Object.keys(nameToId)) {
            const result = interactableFor(name);
            expect(new Set(result).size, `${name} has duplicates`).toBe(result.length);
        }
    });

    it("connects Grand Bahama (Bahamas) to Bermuda and the United States", () => {
        expect(interactableFor("Grand Bahama (Bahamas)")).toEqual(
            expect.arrayContaining(["Bermuda", "United States"])
        );
        expect(interactableFor("Bermuda")).toContain("Grand Bahama (Bahamas)");
        expect(interactableFor("United States")).toContain("Grand Bahama (Bahamas)");
    });

    // Regression for the duplicate "New Caledonia 1" key.
    it("connects New Caledonia 1 to King Island and Fraser Island", () => {
        expect(interactableFor("New Caledonia 1")).toEqual(
            expect.arrayContaining(["King Island", "Fraser Island", "New Zealand North Island"])
        );
    });

    it("keeps every neighbour of the two parenthetically-named Bahamas territories", () => {
        for (const name of ["Grand Bahama (Bahamas)", "Andros Island (Bahamas)"]) {
            expect(interactableFor(name).length, name).toBeGreaterThan(0);
            expect(interactableFor(name), name).toEqual(
                expect.arrayContaining(getReachableFrom(idOf(name)))
            );
        }
    });

    it("gives every one of the 359 territories at least one interactable neighbour", () => {
        const stranded = Object.keys(nameToId).filter((name) => interactableFor(name).length === 0);
        expect(stranded).toEqual([]);
    });

    it("returns a copy so callers cannot corrupt the index", () => {
        interactableFor("Germany").push("Atlantis");
        expect(interactableFor("Germany")).not.toContain("Atlantis");
    });
});
