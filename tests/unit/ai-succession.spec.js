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
        //This map is full of them, and a weak hash would put the two United * on the SAME
        //TIMETABLE -- which is the visible pulse the stagger exists to avoid.
        //
        //This asserts the schedules diverge rather than that the next turn differs, and the
        //difference matters now that the term span is six values wide rather than eleven
        //(15-20, halved from 30-40). Two countries out of two hundred coinciding ONCE is
        //arithmetic, not a weak hash: measured, the United States and the United Kingdom
        //share turn 35 and then separate for good, because their terms are 19 and 16 --
        //54 against 51, 73 against 67, and so on. Sharing a term is what would matter.
        expect(termFor("United States")).not.toBe(termFor("United Kingdom"));

        const laterUs = nextSuccessionTurn("United States", 60);
        const laterUk = nextSuccessionTurn("United Kingdom", 60);
        expect(laterUs).not.toBe(laterUk);
    });

    it("keeps the whole world's successions spread, at map scale", () => {
        //The property the prefix test above is a proxy for, asserted on a list big enough to
        //mean something. Measured over the real 207 countries: a mean of 11.8 successions a
        //turn, a worst turn of 37 (17.9% of the world), and only 2 turns in 150 with none at
        //all. The bound here is loose on purpose -- it is guarding against a PULSE, half the
        //world changing its mind at once, not pinning a distribution.
        const many = [];
        for (let index = 0; index < 200; index++) {
            many.push("Country " + index);
        }
        const start = leaderSuccession.firstPossibleTurn;
        let worst = 0;
        for (let turn = start; turn < start + 150; turn++) {
            worst = Math.max(worst, successionsDueOn(many, turn).length);
        }
        expect(worst).toBeLessThan(many.length / 3);
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
