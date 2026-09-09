// A ceasefire running out, and what it falls back to.
//
// Diplomacy checklist stage 5.1, and the answer to **Q2**. A ceasefire agreed during a war
// and allowed to lapse plainly goes back to WAR — that is what a ceasefire IS. But with
// NEUTRAL as the first-contact state, "back to war" and "back to neutral" are genuinely
// different outcomes, and the register keeps no history a rule could reconstruct the right
// one from. So the record remembers, at signing, the state it was signed out of.

import { describe, expect, it } from "vitest";

import { DiplomaticState } from "../../src/state/diplomacy.js";
import { expiredRelations, fallbackFor } from "../../src/rules/diplomacy/expiry.js";

const ceasefire = (overrides = {}) => ({
    a: "Alba",
    b: "Brava",
    state: DiplomaticState.CEASEFIRE,
    since: 10,
    until: 25,
    revertsTo: DiplomaticState.WAR,
    ...overrides
});

describe("which agreements have run out", () => {
    it("finds none before the turn it runs out on", () => {
        expect(expiredRelations([ceasefire()], 24)).toEqual([]);
    });

    it("expires ON the turn it names, not after it", () => {
        //`until` is the turn the ceasefire runs OUT on rather than the last turn it covers,
        //and the panel says "Runs out turn 25" from the same field — so the two agree by
        //construction rather than by anybody remembering to keep them in step.
        expect(expiredRelations([ceasefire()], 25)).toEqual([
            { a: "Alba", b: "Brava", from: DiplomaticState.CEASEFIRE, to: DiplomaticState.WAR }
        ]);
    });

    it("still expires one that is long overdue", () => {
        //A save restored well past the expiry, or a turn in which nothing read the register.
        expect(expiredRelations([ceasefire()], 400)).toHaveLength(1);
    });

    it("leaves every other state alone", () => {
        const rows = [
            { a: "A", b: "B", state: DiplomaticState.PEACE, until: 5 },
            { a: "A", b: "C", state: DiplomaticState.WAR, until: 5 },
            { a: "A", b: "D", state: DiplomaticState.NEUTRAL, until: 5 },
            { a: "A", b: "E", state: DiplomaticState.ALLIANCE, until: 5 }
        ];
        //A peace and an alliance have no end date: they are left by somebody DECIDING to
        //leave them, which is a breach and costs. Only a ceasefire ends by its own terms.
        expect(expiredRelations(rows, 100)).toEqual([]);
    });

    it("leaves a ceasefire with no expiry turn alone", () => {
        //Not a thing the game can produce, but a scenario can write one, and a ceasefire
        //with no clock is a ceasefire nobody agreed an end to rather than one that has run.
        expect(expiredRelations([ceasefire({ until: null })], 100)).toEqual([]);
    });

    it("answers nothing at all when it is not told the turn", () => {
        expect(expiredRelations([ceasefire()], undefined)).toEqual([]);
        expect(expiredRelations(null, 30)).toEqual([]);
    });
});

describe("what it falls back to — Q2", () => {
    it("goes back to war when it was signed out of one", () => {
        expect(fallbackFor(ceasefire())).toBe(DiplomaticState.WAR);
    });

    it("goes back to neutral when it was signed out of that", () => {
        expect(fallbackFor(ceasefire({ revertsTo: DiplomaticState.NEUTRAL })))
            .toBe(DiplomaticState.NEUTRAL);
    });

    it("falls back to NEUTRAL when the record does not say", () => {
        //A save taken before ceasefires could be agreed restores rows with no `revertsTo`,
        //and putting two countries into a war neither of them declared — on the strength of
        //a field that was absent — is the worse of the two mistakes.
        expect(fallbackFor(ceasefire({ revertsTo: null }))).toBe(DiplomaticState.NEUTRAL);
        expect(fallbackFor({})).toBe(DiplomaticState.NEUTRAL);
    });

    it("never falls back to no contact", () => {
        //The two have met, and un-meeting them is what a "we have never seen each other" bug
        //would look like. `setRelationState()` refuses it anyway, so letting one through here
        //would be an expiry that silently did nothing at all.
        expect(fallbackFor(ceasefire({ revertsTo: DiplomaticState.NO_CONTACT })))
            .toBe(DiplomaticState.NEUTRAL);
    });

    it("never falls back into another agreement", () => {
        //A lapsed ceasefire cannot become a peace nobody signed.
        for (const state of [DiplomaticState.PEACE, DiplomaticState.ALLIANCE, "nonsense"]) {
            expect(fallbackFor(ceasefire({ revertsTo: state }))).toBe(DiplomaticState.NEUTRAL);
        }
    });
});
