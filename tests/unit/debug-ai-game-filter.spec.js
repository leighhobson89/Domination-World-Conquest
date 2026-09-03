// The spectator log's country filter.
//
// The three-character threshold is the part worth pinning down. It is what makes
// clearing the field the way to get the whole log back -- an empty string is simply
// below the threshold rather than a case of its own -- and it is why typing towards
// "Russia" does not blank and restore the window twice on the way.

import { describe, expect, it } from "vitest";

import {
    MIN_FILTER_LENGTH,
    filterIsActive,
    matchesCountryFilter,
    normaliseFilter
} from "../../src/debug/aiGameFilter.js";

describe("normaliseFilter", () => {
    it("trims and lower-cases, so matching is one includes() per row", () => {
        expect(normaliseFilter("  RuSSia ")).toBe("russia");
    });

    it("turns nothing at all into the empty string", () => {
        expect(normaliseFilter(undefined)).toBe("");
        expect(normaliseFilter(null)).toBe("");
    });
});

describe("filterIsActive", () => {
    it("ignores anything shorter than the minimum, the empty field included", () => {
        expect(filterIsActive("")).toBe(false);
        expect(filterIsActive("r")).toBe(false);
        expect(filterIsActive("ru")).toBe(false);
        expect(filterIsActive("rus")).toBe(true);
        expect(MIN_FILTER_LENGTH).toBe(3);
    });

    it("does not count whitespace towards the minimum", () => {
        expect(filterIsActive("  r  ")).toBe(false);
    });
});

describe("matchesCountryFilter", () => {
    it("passes everything while the filter is too short", () => {
        // This is what "delete the text and we see all of them again" means.
        for (const filter of ["", "r", "ru", "   "]) {
            expect(matchesCountryFilter("Zimbabwe", filter)).toBe(true);
        }
    });

    it("matches a substring anywhere in the name, ignoring case", () => {
        for (const country of ["Russia", "Belarus", "Cyprus"]) {
            expect(matchesCountryFilter(country, "rus")).toBe(true);
        }
        expect(matchesCountryFilter("RUSSIA", "rus")).toBe(true);
        expect(matchesCountryFilter("Zimbabwe", "rus")).toBe(false);
    });

    it("can match more than one country, which is the point of a substring", () => {
        const map = ["Afghanistan", "Albania", "Romania", "Tanzania", "France"];
        expect(map.filter((c) => matchesCountryFilter(c, "ani"))).toEqual([
            "Afghanistan",
            "Albania",
            "Romania",
            "Tanzania"
        ]);
    });

    it("matches nothing when nothing contains the string", () => {
        expect(matchesCountryFilter("France", "zzzzz")).toBe(false);
    });

    it("handles a country name that is not a string", () => {
        expect(matchesCountryFilter(undefined, "rus")).toBe(false);
    });

    it("takes the raw typed text as well as a normalised one", () => {
        // The console normalises once and passes that in, but nothing stops a caller
        // handing over what was typed, and the answer must be the same either way.
        expect(matchesCountryFilter("Russia", "  RUS ")).toBe(true);
    });
});
