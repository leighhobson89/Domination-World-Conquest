// ai/rng.js and the pure half of ai/threat.js -- Phase 5.5/5.6.
//
// The point of Phase 5.5 is that these run in Node. `threat.js` reads the store through
// `state/selectors.js` for the parts that need the world, but its scoring arithmetic takes
// plain objects, and that is what is exercised here.

import { describe, expect, it } from "vitest";

import {
    aiRandom,
    currentAiRng,
    hashSeed,
    mulberry32,
    resetAiRngContext,
    seededRngFor,
    setAiRngContext
} from "../../src/ai/rng.js";
import { retrieveArmyPowerOfTerritory } from "../../src/ai/threat.js";
import { defenseMultiplierFor } from "../../src/rules/military/probability.js";
import { vehicleArmyPersonnelWorth } from "../../src/config/balance.js";

function draws(rng, count) {
    return Array.from({ length: count }, () => rng());
}

describe("hashSeed", () => {
    it("is stable for the same string", () => {
        expect(hashSeed("3|Germany")).toBe(hashSeed("3|Germany"));
    });

    it("separates turns and countries", () => {
        expect(hashSeed("3|Germany")).not.toBe(hashSeed("4|Germany"));
        expect(hashSeed("3|Germany")).not.toBe(hashSeed("3|France"));
    });

    it("returns an unsigned 32-bit integer", () => {
        const seed = hashSeed("anything at all");
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThan(2 ** 32);
    });

    it("handles the empty string without throwing", () => {
        expect(Number.isInteger(hashSeed(""))).toBe(true);
    });
});

describe("mulberry32", () => {
    it("draws in [0, 1)", () => {
        for (const value of draws(mulberry32(12345), 200)) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it("gives the same sequence for the same seed", () => {
        expect(draws(mulberry32(99), 10)).toEqual(draws(mulberry32(99), 10));
    });

    it("gives different sequences for different seeds", () => {
        expect(draws(mulberry32(1), 10)).not.toEqual(draws(mulberry32(2), 10));
    });

    it("does not immediately repeat itself", () => {
        const values = draws(mulberry32(7), 100);
        expect(new Set(values).size).toBe(values.length);
    });
});

describe("seededRngFor", () => {
    it("makes one country's turn reproducible", () => {
//A per-country stream is not shared with anything, so nothing else can advance it --
        //which is a stronger guarantee than the global seed gives even now that audit 5.3 Y
        //is closed. `seededRngFor(turn, country)` hashes its inputs rather than counting, so
        //a country that takes no turn does not shift every later country's stream.
        expect(draws(seededRngFor(5, "Germany"), 20))
            .toEqual(draws(seededRngFor(5, "Germany"), 20));
    });

    it("gives neighbours on the same turn different streams", () => {
        expect(draws(seededRngFor(5, "Germany"), 20))
            .not.toEqual(draws(seededRngFor(5, "France"), 20));
    });

    it("gives the same country a different stream each turn", () => {
        expect(draws(seededRngFor(5, "Germany"), 20))
            .not.toEqual(draws(seededRngFor(6, "Germany"), 20));
    });

    it("does not shift a country's stream when another takes no turn", () => {
        //The seed is a hash of (turn, country), not a running counter, so an eliminated
        //country simply does not draw -- it does not move everyone after it.
        const before = draws(seededRngFor(9, "Peru"), 5);
        seededRngFor(9, "Chile")();
        expect(draws(seededRngFor(9, "Peru"), 5)).toEqual(before);
    });
});

describe("the current AI stream", () => {
    it("starts on Math.random", () => {
        resetAiRngContext();
        expect(currentAiRng()).toBe(Math.random);
    });

    it("switches to the seeded stream for a country's turn", () => {
        setAiRngContext(2, "Spain");
        const observed = draws(aiRandom, 10);
        setAiRngContext(2, "Spain");
        expect(draws(aiRandom, 10)).toEqual(observed);
        resetAiRngContext();
    });

    it("goes back to Math.random when the country's turn ends", () => {
        //Anything drawing OUTSIDE an AI turn -- the player's battles, the random events --
        //must not quietly be reading a seeded stream.
        setAiRngContext(2, "Spain");
        resetAiRngContext();
        expect(currentAiRng()).toBe(Math.random);
    });

    it("keeps aiRandom a stable reference across context changes", () => {
        //The ~13 call sites in aiCalculations.js hold this one function; it has to follow
        //whichever stream is current rather than capturing one.
        setAiRngContext(1, "Italy");
        const first = aiRandom();
        setAiRngContext(1, "Italy");
        expect(aiRandom()).toBe(first);
        resetAiRngContext();
    });
});

describe("retrieveArmyPowerOfTerritory", () => {
    const territory = (overrides = {}) => ({
        armyForCurrentTerritory: 10000,
        assaultForCurrentTerritory: 10,
        airForCurrentTerritory: 10,
        navalForCurrentTerritory: 10,
        useableAssault: 10,
        useableAir: 10,
        useableNaval: 10,
        defenseBonus: 0,
        mountainDefenseBonus: 0,
        ...overrides
    });

    it("is the army total when nothing is grounded", () => {
        expect(retrieveArmyPowerOfTerritory(territory(), false)).toBe(10000);
    });

    it("subtracts the grounded vehicles", () => {
        const short = territory({ useableNaval: 6 });
        expect(retrieveArmyPowerOfTerritory(short, false))
            .toBe(10000 - (4 * vehicleArmyPersonnelWorth.naval));
    });

    it("applies the fortification multiplier to the naval term only", () => {
        //Where the parentheses fall in the original expression. Long-standing, and preserved
        //by the extraction -- moving them is a balance change.
        const fortified = territory({ useableNaval: 6, defenseBonus: 100 });
        const grounded = 4 * vehicleArmyPersonnelWorth.naval;
        expect(retrieveArmyPowerOfTerritory(fortified, true))
            .toBe(10000 - (grounded * defenseMultiplierFor(fortified)));
    });

    it("gives the same answer either way for a fully fuelled territory", () => {
        //With nothing grounded the naval term is zero, so the multiplier has nothing to
        //multiply -- which is why fortifications only show up on a territory short of oil.
        const fuelled = territory({ defenseBonus: 100 });
        expect(retrieveArmyPowerOfTerritory(fuelled, true))
            .toBe(retrieveArmyPowerOfTerritory(fuelled, false));
    });

    it("does not mutate the territory", () => {
        const before = territory({ useableAir: 3 });
        const snapshot = { ...before };
        retrieveArmyPowerOfTerritory(before, true);
        expect(before).toEqual(snapshot);
    });
});
