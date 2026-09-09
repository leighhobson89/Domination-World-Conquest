// Who is out of the game.
//
// Reported by Leigh: taking a one-territory country's only province left it still shown as an
// enemy in the diplomacy panel and on the territory tooltip. The register in
// `src/state/diplomacy.js` is keyed by COUNTRY NAME and knows nothing about the map, so a
// relation outlives the country it describes.
//
// The two things worth pinning here are both invisible in a running game: that the answer is
// re-derived when the world changes rather than cached for the rest of the run, and that an
// UNSEEDED store answers "nobody is defeated" rather than "everybody is".

import { describe, expect, it, beforeEach } from "vitest";

import {
    __resetStateForTests,
    seedTerritories
} from "../../src/state/GameState.js";
import { updateTerritory } from "../../src/state/mutations.js";
import { getTerritoryByName } from "../../src/state/selectors.js";
import {
    defeatedCount,
    defeatedCountries,
    isDefeated,
    resetDefeatedCache,
    survivingCountries
} from "../../src/state/defeated.js";

function territory(uniqueId, name, owner) {
    return {
        uniqueId,
        territoryName: name,
        dataName: owner,
        originalOwner: owner,
        owner: "AI",
        armyForCurrentTerritory: 100,
        defenseBonus: 0
    };
}

function world() {
    seedTerritories([
        territory("1", "AlbaHome", "Alba"),
        territory("2", "BravaOne", "Brava"),
        territory("3", "BravaTwo", "Brava"),
        territory("4", "CardaHome", "Carda")
    ]);
}

beforeEach(() => {
    __resetStateForTests();
    resetDefeatedCache();
});

describe("the defeated register", () => {
    it("says nobody is out while everybody still holds land", () => {
        world();
        expect(defeatedCount()).toBe(0);
        expect(isDefeated("Carda")).toBe(false);
        expect([...survivingCountries()].sort()).toEqual(["Alba", "Brava", "Carda"]);
    });

    it("says a country is out the moment its LAST territory changes hands", () => {
        world();
        const carda = getTerritoryByName("CardaHome");
        updateTerritory(carda.uniqueId, { dataName: "Alba" });

        expect(isDefeated("Carda")).toBe(true);
        expect([...defeatedCountries()]).toEqual(["Carda"]);
    });

    it("does not call a country out while it still holds one", () => {
        //The case that makes the walk necessary rather than a per-territory flag: Brava holds
        //two, so losing one is not defeat.
        world();
        updateTerritory(getTerritoryByName("BravaOne").uniqueId, { dataName: "Alba" });
        expect(isDefeated("Brava")).toBe(false);

        updateTerritory(getTerritoryByName("BravaTwo").uniqueId, { dataName: "Alba" });
        expect(isDefeated("Brava")).toBe(true);
    });

    it("re-derives after a conquest rather than answering from the first walk", () => {
        //The cache is the whole reason this module can be asked from a tooltip that rebuilds
        //dozens of times a second, and a cache that is not dropped is a country that stays
        //alive on the screen for the rest of the game.
        world();
        expect(defeatedCount()).toBe(0);
        updateTerritory(getTerritoryByName("CardaHome").uniqueId, { dataName: "Alba" });
        expect(defeatedCount()).toBe(1);
    });

    it("answers 'nobody' for a store that has not been seeded yet", () => {
        //SAFE BY CONSTRUCTION rather than by a guard: both halves of the answer come from the
        //same walk, so an empty world yields an empty roster and an empty defeated set. The
        //failure this rules out is the ugly one -- every country in the game reported beaten
        //during the bootstrap window, and the answer cached.
        expect(defeatedCount()).toBe(0);
        expect(isDefeated("Alba")).toBe(false);
    });

    it("counts a country nothing names as an original owner", () => {
        //A save or a scenario can hand us a `dataName` no territory lists as its original
        //owner. Folding both into the roster is what stops such a country being reported
        //defeated the moment it is asked about.
        seedTerritories([
            { ...territory("1", "AlbaHome", "Alba"), originalOwner: "Dorne" }
        ]);
        expect(isDefeated("Alba")).toBe(false);
        expect(isDefeated("Dorne")).toBe(true);
    });

    it("has no opinion about a country it has never heard of", () => {
        world();
        expect(isDefeated("Atlantis")).toBe(false);
        expect(isDefeated("")).toBe(false);
        expect(isDefeated(undefined)).toBe(false);
    });
});
