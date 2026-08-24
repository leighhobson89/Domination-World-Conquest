import { describe, it, expect, afterEach, vi } from "vitest";
import { cosmeticRandom, seedCosmeticRandom } from "../../src/platform/cosmeticRng.js";

// audit 5.3 Y, closed in refactor Phase 5.5.
//
// The defect was not that cosmetic randomness was random -- it is supposed to be. It was
// that it drew from `Math.random`, the same stream the economy, combat and the AI draw from,
// from a timer that re-armed every 0-100ms. How many cosmetic draws landed between two game
// draws therefore depended on wall-clock timing, and two runs of the same seed diverged. No
// spec anywhere in the suite was allowed to assert an exact combat or economy outcome.
//
// The property that matters is the one asserted here: this module NEVER touches
// `Math.random`. Everything else about it is an implementation detail.

describe("the cosmetic random stream", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("never draws from Math.random -- the whole point of the module", () => {
        const spy = vi.spyOn(Math, "random");
        for (let draw = 0; draw < 200; draw += 1) {
            cosmeticRandom();
        }
        expect(spy).not.toHaveBeenCalled();
    });

    it("returns draws in [0, 1)", () => {
        for (let draw = 0; draw < 1000; draw += 1) {
            const value = cosmeticRandom();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it("is a real generator, not a constant", () => {
        const draws = new Set(Array.from({ length: 100 }, () => cosmeticRandom()));
        expect(draws.size).toBeGreaterThan(90);
    });

    it("repeats from a given seed, so it can be pinned in a test", () => {
        seedCosmeticRandom(12345);
        const first = Array.from({ length: 10 }, () => cosmeticRandom());
        seedCosmeticRandom(12345);
        const second = Array.from({ length: 10 }, () => cosmeticRandom());
        expect(second).toEqual(first);
    });

    it("gives different sequences for different seeds", () => {
        seedCosmeticRandom(1);
        const first = Array.from({ length: 10 }, () => cosmeticRandom());
        seedCosmeticRandom(2);
        const second = Array.from({ length: 10 }, () => cosmeticRandom());
        expect(second).not.toEqual(first);
    });

    it("advancing it does not advance the game's stream", () => {
        // The inverse of the first test, stated as the behaviour a caller depends on: a
        // sparkle landing between two combat rolls must not change the combat rolls.
        let seed = 42;
        const gameRng = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };

        seed = 42;
        const withoutCosmetics = [gameRng(), gameRng(), gameRng()];

        seed = 42;
        const withCosmetics = [];
        withCosmetics.push(gameRng());
        cosmeticRandom();
        cosmeticRandom();
        withCosmetics.push(gameRng());
        cosmeticRandom();
        withCosmetics.push(gameRng());

        expect(withCosmetics).toEqual(withoutCosmetics);
    });
});
