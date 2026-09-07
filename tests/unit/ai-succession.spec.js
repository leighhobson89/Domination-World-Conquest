// src/ai/succession.js -- when a country's leader dies and a new one thinks again.
//
// The behaviour worth pinning is the SCHEDULE, because the schedule is what makes this a
// background process rather than a visible pulse: two hundred leaders must not all be replaced
// on the same turn, the timetable must survive a save and reload without a slice, and it must
// not touch the game's random stream (a draw here would move every seeded outcome in the game,
// once per country per succession).
//
// What it is FOR is measured in the module's own header: with a country's character fixed for
// the whole game, the largest empire on the map reached 71 territories at turn 50 and was still
// on 71 at turn 150, because a stalemate between two comparable neighbours is symmetric and
// nothing could break it.

import { describe, expect, it } from "vitest";

import {
    isSuccessionTurn,
    nextSuccessionTurn,
    successionsDueOn,
    termFor
} from "../../src/ai/succession.js";
import { leaderSuccession } from "../../src/config/balance.js";

/** A realistic spread of the map's country names, including two that share a prefix. */
const COUNTRIES = [
    "United States", "United Kingdom", "France", "Germany", "China", "India", "Brazil",
    "Nigeria", "Indonesia", "Russia", "Canada", "Australia", "Chile", "Vatican City",
    "Luxembourg", "Mongolia", "Peru", "Egypt", "Kenya", "Japan"
];

describe("how long a leader serves", () => {
    it("keeps every term inside the configured range", () => {
        for (const country of COUNTRIES) {
            expect(termFor(country)).toBeGreaterThanOrEqual(leaderSuccession.minimumTermTurns);
            expect(termFor(country)).toBeLessThanOrEqual(leaderSuccession.maximumTermTurns);
        }
    });

    it("is stable for a given country, so a reloaded game keeps its timetable", () => {
        //The whole reason the term is derived rather than drawn and stored: there is no slice
        //to save, so there is no slice to forget to restore.
        const first = COUNTRIES.map(termFor);
        const second = COUNTRIES.map(termFor);
        expect(second).toEqual(first);
    });

    it("separates countries that share a long prefix", () => {
        //This map is full of them, and a weak hash would retire the two United * on the same
        //turn -- which is precisely the visible pulse the stagger exists to avoid.
        expect(nextSuccessionTurn("United States", 20))
            .not.toBe(nextSuccessionTurn("United Kingdom", 20));
    });

    it("survives a nameless or missing country rather than throwing", () => {
        expect(termFor(undefined)).toBeGreaterThanOrEqual(leaderSuccession.minimumTermTurns);
        expect(termFor("")).toBeGreaterThanOrEqual(leaderSuccession.minimumTermTurns);
    });
});

describe("the succession schedule", () => {
    it("replaces nobody before the opening has been played out", () => {
        for (let turn = 0; turn < leaderSuccession.firstPossibleTurn; turn++) {
            expect(successionsDueOn(COUNTRIES, turn)).toEqual([]);
        }
    });

    it("replaces every country's leader within one full term", () => {
        //Nobody is missed. A country whose leader never died would be exactly the frozen
        //country this module exists to unfreeze.
        const seen = new Set();
        const start = leaderSuccession.firstPossibleTurn;
        for (let turn = start; turn < start + leaderSuccession.maximumTermTurns; turn++) {
            for (const country of successionsDueOn(COUNTRIES, turn)) {
                seen.add(country);
            }
        }
        expect([...seen].sort()).toEqual([...COUNTRIES].sort());
    });

    it("staggers them rather than pulsing the whole world at once", () => {
        //The property that makes this a background process. With 20 countries over a ~35 turn
        //term, no single turn should carry a large share of them.
        const start = leaderSuccession.firstPossibleTurn;
        let worst = 0;
        for (let turn = start; turn < start + 200; turn++) {
            worst = Math.max(worst, successionsDueOn(COUNTRIES, turn).length);
        }
        expect(worst).toBeLessThanOrEqual(Math.ceil(COUNTRIES.length / 3));
    });

    it("recurs on the term, so a long game keeps changing its leaders", () => {
        const country = "France";
        const term = termFor(country);
        const first = nextSuccessionTurn(country, leaderSuccession.firstPossibleTurn);
        expect(isSuccessionTurn(country, first)).toBe(true);
        expect(isSuccessionTurn(country, first + term)).toBe(true);
        expect(isSuccessionTurn(country, first + 2 * term)).toBe(true);
    });

    it("does not fire on the turns between two successions", () => {
        const country = "Brazil";
        const first = nextSuccessionTurn(country, leaderSuccession.firstPossibleTurn);
        for (let turn = first + 1; turn < first + termFor(country); turn++) {
            expect(isSuccessionTurn(country, turn)).toBe(false);
        }
    });

    it("treats a non-numeric turn as no succession rather than as turn zero", () => {
        expect(isSuccessionTurn("France", undefined)).toBe(false);
        expect(isSuccessionTurn("France", Number.NaN)).toBe(false);
    });
});
