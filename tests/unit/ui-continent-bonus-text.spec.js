// src/ui/continents/continentBonusText.js -- what the game says about a continent bonus.
//
// The wording is pinned here rather than in an e2e spec for the same reason the Dominapedia's
// topics and the goal catalogue are: no e2e spec asserts prose, so a sentence that goes stale
// when a dial moves is caught by nobody. These run in Node with no store and no DOM.

import { describe, expect, it } from "vitest";

import { CONTINENT_BONUS_CAPACITY, CONTINENT_BONUS_GOLD } from "../../src/config/balance.js";
import {
    bonusPercent,
    bonusSummary,
    describeContinentHolding,
    describeContinentsHeld
} from "../../src/ui/continents/continentBonusText.js";

describe("bonusPercent", () => {
    it("turns a multiplier into the percentage a player thinks in", () => {
        expect(bonusPercent(1.5)).toBe("+50%");
        expect(bonusPercent(1.25)).toBe("+25%");
        expect(bonusPercent(1)).toBe("+0%");
    });

    it("never reads as a penalty, and never as NaN", () => {
        expect(bonusPercent(0.5)).toBe("+0%");
        expect(bonusPercent(Number.NaN)).toBe("+0%");
        expect(bonusPercent(undefined)).toBe("+0%");
    });
});

describe("bonusSummary", () => {
    it("quotes the dials that are actually in force", () => {
        //If a dial moves and this fails, the manual and the two tooltips have gone stale
        //together, which is the whole point of asserting it here.
        expect(bonusSummary()).toBe(
            bonusPercent(CONTINENT_BONUS_GOLD) + " gold, " +
            bonusPercent(CONTINENT_BONUS_CAPACITY) + " capacities");
    });
});

describe("describeContinentHolding", () => {
    it("states a partial holding, which is what a player reads before attacking", () => {
        expect(describeContinentHolding(
            { continent: "Europe", owner: "France", held: 31, total: 52 }))
            .toBe("Europe: 31 of 52 held by France");
    });

    it("states a completed continent and what it is worth", () => {
        expect(describeContinentHolding(
            { continent: "Africa", owner: "Libya", held: 59, total: 59 }))
            .toBe("Africa: held whole by Libya (" + bonusSummary() + ")");
    });

    it("drops the owner when there is not one to name", () => {
        expect(describeContinentHolding({ continent: "Asia", held: 87, total: 87 }))
            .toBe("Asia: held whole (" + bonusSummary() + ")");
    });

    it("says nothing at all rather than something wrong", () => {
        expect(describeContinentHolding(null)).toBe("");
        expect(describeContinentHolding({ continent: "Europe", held: 0, total: 0 })).toBe("");
        expect(describeContinentHolding({ held: 3, total: 4 })).toBe("");
    });
});

describe("describeContinentsHeld", () => {
    it("names the continents held outright", () => {
        expect(describeContinentsHeld(["Africa", "Europe"]))
            .toBe("Continents held outright: Africa, Europe (" + bonusSummary() + " on each)");
    });

    it("says 'none' rather than disappearing, so the rule is discoverable", () => {
        //A line that only appears once a continent is completed is a line that has taught
        //nobody the bonus exists.
        expect(describeContinentsHeld([])).toContain("none");
        expect(describeContinentsHeld([])).toContain(bonusSummary());
        expect(describeContinentsHeld(undefined)).toContain("none");
    });
});
