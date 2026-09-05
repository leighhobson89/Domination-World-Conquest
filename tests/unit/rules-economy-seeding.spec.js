// rules/economy/seeding.js -- what a territory starts with. Economy phase, stage 3.2 (audit D7).
//
// D7 is the larger half of stage 3 and the half no change to a price or a benefit could have
// reached. Construction materials buy upgrades and nothing else, so a territory's cons-mats
// ceiling decides whether it is allowed into the upgrade tree at all -- and until this stage
// that ceiling was a function of LAND AREA almost entirely. Germany, the richest and most
// developed country in Europe, needed eighty turns of its own regeneration to fill one
// territory's twenty upgrade slots. China needed one.
//
// What is asserted here is the SHAPE of the fix and not its constants: the ceiling must answer
// to people as well as to land, the lift must be far larger for a small developed country than
// for a large one, and the floor must carry the territories that have neither. The exact numbers
// live in `balance.js` with the measurement that chose them.

import { describe, expect, it } from "vitest";

import {
    initialConsMatsCapacityFor,
    initialOilCapacityFor
} from "../../src/rules/economy/seeding.js";
import { MIN_CONS_MATS_CAPACITY } from "../../src/config/balance.js";

// The four territories the audit's tables are argued from, as they arrive from `initialData.js`.
const CHINA = { area: 9706961, devIndex: 0.768, continent: "Asia", population: 1447065329 };
const GERMANY = { area: 357114, devIndex: 0.942, continent: "Europe", population: 83975691 };
const CHAD = { area: 1284000, devIndex: 0.394, continent: "Africa", population: 17203787 };
const VATICAN = { area: 1, devIndex: 0.812, continent: "Europe", population: 800 };

describe("cons-mats capacity answers to people as well as to land (audit D7)", () => {
    it("lifts a small developed country by an order of magnitude", () => {
        // Germany measured 1,244 before this change and about 14,900 after -- which is the
        // difference between eighty turns of saving for one territory's buildings and seven.
        const areaOnly = initialConsMatsCapacityFor({ ...GERMANY, population: 0 });
        const withPeople = initialConsMatsCapacityFor(GERMANY);
        expect(withPeople / areaOnly).toBeGreaterThan(5);
    });

    it("lifts the largest country by far less, so being large is not taxed", () => {
        // The square root is what makes those two numbers different. A linear population term
        // would have paid China most, which is the opposite of the point.
        const chinaLift = initialConsMatsCapacityFor(CHINA) /
            initialConsMatsCapacityFor({ ...CHINA, population: 0 });
        const germanyLift = initialConsMatsCapacityFor(GERMANY) /
            initialConsMatsCapacityFor({ ...GERMANY, population: 0 });
        expect(chinaLift).toBeLessThan(germanyLift);
        expect(chinaLift).toBeGreaterThan(1);
    });

    it("still gives the largest country the largest ceiling by a wide margin", () => {
        // "Being large must stay good" is the principle the whole phase is governed by. The
        // nudge closes the spread; it must never invert it.
        expect(initialConsMatsCapacityFor(CHINA))
            .toBeGreaterThan(initialConsMatsCapacityFor(GERMANY) * 5);
        expect(initialConsMatsCapacityFor(GERMANY))
            .toBeGreaterThan(initialConsMatsCapacityFor(CHAD));
    });

    it("carries the bottom of the map on the floor, where neither term reaches", () => {
        // Vatican City is 800 people on one square kilometre: the area terms give it nothing and
        // the population term gives it nothing. The floor is the same instrument as
        // TERRITORY_BASE_INCOME and is there for the same reason.
        expect(initialConsMatsCapacityFor(VATICAN)).toBe(MIN_CONS_MATS_CAPACITY);
    });

    it("never returns less than the floor, whatever it is handed", () => {
        for (const nonsense of [
            { area: 0, devIndex: 0, continent: "Africa", population: 0 },
            { area: -5, devIndex: 0.5, continent: "Europe", population: -100 }
        ]) {
            const capacity = initialConsMatsCapacityFor(nonsense);
            expect(Number.isFinite(capacity)).toBe(true);
            expect(capacity).toBeGreaterThanOrEqual(MIN_CONS_MATS_CAPACITY);
        }
    });

    it("accepts a development index that arrives as a string", () => {
        expect(initialConsMatsCapacityFor({ ...GERMANY, devIndex: "0.942" }))
            .toBeCloseTo(initialConsMatsCapacityFor(GERMANY), 6);
    });
});

describe("oil capacity is deliberately unchanged", () => {
    it("is a function of land alone, because oil is a thing the ground has or has not", () => {
        // The nudge for a small territory arrives through the oil WELL instead -- five of which
        // add exactly the thousand barrels a turn one warship demands.
        const withPeople = initialOilCapacityFor({ ...GERMANY, population: 83975691 });
        const withoutPeople = initialOilCapacityFor({ ...GERMANY, population: 0 });
        expect(withPeople).toBe(withoutPeople);
    });

    it("has no floor, so an island can genuinely be dry", () => {
        expect(initialOilCapacityFor(VATICAN)).toBeLessThan(MIN_CONS_MATS_CAPACITY);
        expect(initialOilCapacityFor(CHINA)).toBeGreaterThan(initialOilCapacityFor(GERMANY));
    });
});
