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

describe("an exact filter -- a country NAMED rather than searched for", () => {
    // Clicking a territory sets the filter to whoever owns it, and there a substring is
    // the wrong rule: clicking anything American showed the United States AND the United
    // States Virgin Islands, two countries that merely share a prefix. Typing the same
    // text must still find both, so the mode travels with the filter rather than being a
    // property of the text.
    it("keeps a country whose name shares a prefix out of the results", () => {
        const american = ["United States", "United States Virgin Islands"];
        expect(american.filter((c) => matchesCountryFilter(c, "united states", true)))
            .toEqual(["United States"]);
        //...and the same text typed into the box still finds both.
        expect(american.filter((c) => matchesCountryFilter(c, "united states")))
            .toEqual(american);
    });

    it("still ignores case and surrounding space", () => {
        expect(matchesCountryFilter("United States", "  UNITED STATES ", true)).toBe(true);
    });

    it("does not match a country the named one is a substring OF, or vice versa", () => {
        expect(matchesCountryFilter("United States Virgin Islands", "united states", true))
            .toBe(false);
        expect(matchesCountryFilter("United States", "united states virgin islands", true))
            .toBe(false);
    });

    it("is still no filter at all below the length threshold", () => {
        // The threshold is checked BEFORE the mode. Otherwise naming a two-letter
        // country would hide the entire log, where every other too-short filter shows
        // everything -- the opposite behaviour from the same rule.
        expect(matchesCountryFilter("Fiji", "fi", true)).toBe(true);
        expect(matchesCountryFilter("Chad", "fi", true)).toBe(true);
    });

    it("handles a country name that is not a string", () => {
        expect(matchesCountryFilter(undefined, "france", true)).toBe(false);
    });
});
