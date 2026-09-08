// The diplomatic gate on the AI's targeting: `rateTarget()` refuses a country it is not at
// war with, before it weighs anything.
//
// Diplomacy checklist Stage 2. This is the AI half of the gate; `ui-move-button.spec.js`
// holds the player's half, and both go through `countriesMayFight()` in the running game so
// they cannot come to different conclusions.
//
// **THE ORDER MATTERS AND IS ASSERTED HERE.** Every other refusal in `rateTarget()` is a
// judgement — the odds are too long, the target is not worth it, this country has been
// beaten here three times. This one is not a judgement at all: it says the target is not
// available to be weighed. So it is asked first, and a target that is BOTH unreachable on
// the odds AND not at war must report the diplomacy, because that is the refusal a player
// or a debugging session can do something about.

import { describe, expect, it } from "vitest";

import { DiplomaticState } from "../../src/state/diplomacy.js";
import { rateTarget, Verdict } from "../../src/ai/targeting.js";

function territory(overrides = {}) {
    return {
        uniqueId: overrides.territoryName ?? "T",
        territoryName: "T",
        continent: "Europe",
        dataName: "Brava",
        owner: "Brava",
        area: 100,
        population: 1_000_000,
        armyForCurrentTerritory: 1000,
        defenseBonus: 0,
        mountainDefenseFactor: 0,
        fortsBuilt: 0,
        ...overrides
    };
}

/** Floors low and an objective present, so only the gate under test can refuse. */
function campaign(overrides = {}) {
    return {
        turn: 40,
        attackOddsFloor: 10,
        siegeOddsFloor: 10,
        siegeBudget: 5,
        objective: { continents: [], banked: [] },
        ...overrides
    };
}

const source = () => territory({ territoryName: "Home", dataName: "Alba", owner: "Alba" });
const target = () => territory({ territoryName: "Away", dataName: "Brava", owner: "Brava" });

/** Odds and a campaign generous enough that only the gate can refuse. */
function rate(relationState) {
    return rateTarget({
        target: target(),
        source: source(),
        probability: 90,
        threatScore: 10,
        campaign: campaign(),
        traits: {},
        country: "Alba",
        relationState
    });
}

describe("the gate", () => {
    it("lets a target through when the two are at war", () => {
        expect(rate(DiplomaticState.WAR).verdict).not.toBe(Verdict.SKIP);
    });

    it("refuses every state that is not war", () => {
        for (const state of [
            DiplomaticState.NEUTRAL,
            DiplomaticState.PEACE,
            DiplomaticState.CEASEFIRE,
            DiplomaticState.ALLIANCE,
            DiplomaticState.NO_CONTACT
        ]) {
            expect(rate(state).verdict).toBe(Verdict.SKIP);
        }
    });

    it("names the country and the state in the reason", () => {
        //The AI debug window and the plan log both print `reason`, and this is the one
        //place a target is declined with a stated one. A target that vanishes has to say
        //why, or the whole diplomacy layer is invisible from inside the game.
        const reason = rate(DiplomaticState.PEACE).reason;
        expect(reason).toContain("Brava");
        expect(reason).toContain("at peace");
    });

    it("is asked before the odds, so a hopeless neutral target reports the diplomacy", () => {
        const rating = rateTarget({
            target: target(),
            source: source(),
            probability: 1,
            threatScore: 0,
            campaign: campaign({ attackOddsFloor: 34, siegeOddsFloor: 22 }),
            traits: {},
            country: "Alba",
            relationState: DiplomaticState.NEUTRAL
        });
        expect(rating.verdict).toBe(Verdict.SKIP);
        expect(rating.reason).toContain("not at war");
    });

    it("is asked before the player's grace period, which it outranks", () => {
        //Both refuse, and the diplomatic one is the durable fact — the grace period lasts
        //five turns and being neutral lasts until somebody declares.
        const rating = rateTarget({
            target: territory({ dataName: "Human", owner: "Player" }),
            source: source(),
            probability: 90,
            threatScore: 10,
            campaign: campaign({ turn: 1 }),
            traits: {},
            country: "Alba",
            relationState: DiplomaticState.NEUTRAL
        });
        expect(rating.reason).toContain("not at war");
        expect(rating.reason).not.toContain("grace period");
    });

    it("defaults to war when no state is given", () => {
        //Deliberate, and recorded in the module: a caller that forgot the field lets an
        //illegal attack through rather than silently freezing that country, and the first
        //is the failure a measurement catches. `tools/ai-sim.mjs` reporting conquests at
        //zero is the proof the gate holds; a silent freeze looks identical to it working.
        const rating = rateTarget({
            target: target(),
            source: source(),
            probability: 90,
            threatScore: 10,
            campaign: campaign(),
            traits: {},
            country: "Alba"
        });
        expect(rating.verdict).not.toBe(Verdict.SKIP);
    });
});
