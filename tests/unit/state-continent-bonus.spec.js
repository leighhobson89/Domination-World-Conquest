// src/state/continentBonus.js -- the live half of the continent bonus.
//
// The pure half is `continents.js` and has its own spec. What is worth pinning here is the
// thing that would fail silently: a MEMOISED answer that has stopped tracking the world. A
// stale cache would hand a player the bonus for a continent they no longer hold, and nothing
// in the game compares a bonus against what it should be.

import { beforeEach, describe, expect, it } from "vitest";

import { CONTINENT_BONUS_CAPACITY, CONTINENT_BONUS_GOLD } from "../../src/config/balance.js";
import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import {
    continentCapacityBonusFor,
    continentGoldBonusFor,
    continentsHeldBy,
    currentContinentControl,
    holdsWholeContinent,
    invalidateContinentControl
} from "../../src/state/continentBonus.js";
import { setTerritoryOwner } from "../../src/state/mutations.js";
import { getTerritoryByName } from "../../src/state/selectors.js";

function world() {
    const rows = [
        ["EU1", "Europe", "Alba"],
        ["EU2", "Europe", "Alba"],
        ["AF1", "Africa", "Alba"],
        ["AF2", "Africa", "Brava"]
    ];
    return rows.map(([name, continent, owner], index) => ({
        uniqueId: String(index + 1),
        territoryName: name,
        continent,
        dataName: owner,
        owner,
        originalOwner: owner,
        area: 100,
        defenseBonus: 0
    }));
}

beforeEach(() => {
    __resetStateForTests();
    seedTerritories(world());
    invalidateContinentControl();
});

describe("reading the live world", () => {
    it("says who holds a continent whole", () => {
        expect(holdsWholeContinent("Alba", "Europe")).toBe(true);
        expect(holdsWholeContinent("Alba", "Africa")).toBe(false);
        expect(continentsHeldBy("Alba")).toEqual(["Europe"]);
        expect(continentsHeldBy("Brava")).toEqual([]);
    });

    it("gives a territory on a held continent both multipliers, and one elsewhere neither", () => {
        expect(continentGoldBonusFor(getTerritoryByName("EU1"))).toBe(CONTINENT_BONUS_GOLD);
        expect(continentCapacityBonusFor(getTerritoryByName("EU1")))
            .toBe(CONTINENT_BONUS_CAPACITY);

        expect(continentGoldBonusFor(getTerritoryByName("AF1"))).toBe(1);
        expect(continentCapacityBonusFor(getTerritoryByName("AF1"))).toBe(1);
    });

    it("answers 1 rather than throwing for no territory at all", () => {
        expect(continentGoldBonusFor(null)).toBe(1);
        expect(continentCapacityBonusFor(undefined)).toBe(1);
    });
});

describe("the cache tracks the world", () => {
    //The failure this guards against has no textual signature: nothing throws, every turn
    //completes, and a country quietly keeps earning for a continent it has lost.
    it("grants the bonus on the turn a continent is completed", () => {
        expect(continentGoldBonusFor(getTerritoryByName("AF1"))).toBe(1);

        setTerritoryOwner("4", "Alba", "Alba");

        expect(holdsWholeContinent("Alba", "Africa")).toBe(true);
        expect(continentGoldBonusFor(getTerritoryByName("AF1"))).toBe(CONTINENT_BONUS_GOLD);
    });

    it("withdraws the bonus on the turn a continent is broken", () => {
        expect(continentGoldBonusFor(getTerritoryByName("EU1"))).toBe(CONTINENT_BONUS_GOLD);

        setTerritoryOwner("2", "Brava", "Brava");

        expect(holdsWholeContinent("Alba", "Europe")).toBe(false);
        expect(continentGoldBonusFor(getTerritoryByName("EU1"))).toBe(1);
    });

    it("reuses the same control map until something changes", () => {
        const first = currentContinentControl();
        expect(currentContinentControl()).toBe(first);

        setTerritoryOwner("4", "Alba", "Alba");
        expect(currentContinentControl()).not.toBe(first);
    });
});
