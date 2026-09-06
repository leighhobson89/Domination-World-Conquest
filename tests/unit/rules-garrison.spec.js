// The two invariants known-issue BJ existed for.
//
// BJ was "a large empire's `armyForCurrentTerritory` goes hugely negative" -- India at minus six
// and a half billion after 150 headless turns. It had no textual signature: nothing threw, every
// battle was resolved correctly against the force actually sent, and the register had already
// ruled out the plausible cause (BM, the AI's infantry price) by measurement. What was left was
// four separate hand-written garrison writes in `aiCalculations.js` that each got a different
// part of it wrong. This module is the one write they all go through now, and these are the
// properties that make the negative impossible rather than merely absent.

import { describe, it, expect } from "vitest";

import { garrisonFields, garrisonOf, garrisonPatch, writeGarrison } from "../../src/rules/military/garrison.js";
import { vehicleArmyPersonnelWorth } from "../../src/config/balance.js";

const territory = (over = {}) => ({
    territoryName: "Testland",
    infantryForCurrentTerritory: 1000,
    assaultForCurrentTerritory: 4,
    airForCurrentTerritory: 3,
    navalForCurrentTerritory: 2,
    useableAssault: 4,
    useableAir: 3,
    useableNaval: 2,
    armyForCurrentTerritory: 0,
    ...over,
});

describe("garrisonFields", () => {
    it("totals the infantry and the USEABLE vehicles", () => {
        const fields = garrisonFields({ infantry: 1000, assault: 4, air: 3, naval: 2 });
        expect(fields.armyForCurrentTerritory).toBe(
            1000 +
            (4 * vehicleArmyPersonnelWorth.assault) +
            (3 * vehicleArmyPersonnelWorth.air) +
            (2 * vehicleArmyPersonnelWorth.naval)
        );
    });

    it("counts a grounded vehicle in the holding but not in the force", () => {
        //A vehicle with no oil is still owned; it is just not force in the field. `armyTotalFor()`
        //has always said so, and the AI's hand-written totals did not.
        const fields = garrisonFields({
            infantry: 0, assault: 10, air: 0, naval: 0,
            useable: { assault: 1, air: 0, naval: 0 },
        });
        expect(fields.assaultForCurrentTerritory).toBe(10);
        expect(fields.useableAssault).toBe(1);
        expect(fields.armyForCurrentTerritory).toBe(vehicleArmyPersonnelWorth.assault);
    });

    it("never writes a negative count, however far the debit overshoots", () => {
        //This is the whole of BJ. `doAttack()` subtracted an army array that a stale `useable*`
        //count could make larger than the garrison, and nothing stopped it.
        const fields = garrisonFields({
            infantry: -999999, assault: -5, air: -5, naval: -5,
            useable: { assault: -5, air: -5, naval: -5 },
        });
        for (const value of Object.values(fields)) {
            expect(value).toBeGreaterThanOrEqual(0);
        }
    });

    it("never lets a useable count exceed the count it gates", () => {
        //The conquest path used to leave the DEFEATED owner's `useable*` standing over the
        //survivors' counts, and `calculateArmyMakeupOfAttack()` allocates from `useable*` -- so
        //the next attack out of a freshly taken territory sent vehicles that were not there.
        const fields = garrisonFields({
            infantry: 0, assault: 1, air: 1, naval: 1,
            useable: { assault: 99, air: 99, naval: 99 },
        });
        expect(fields.useableAssault).toBe(1);
        expect(fields.useableAir).toBe(1);
        expect(fields.useableNaval).toBe(1);
    });

    it("defaults useable to the whole holding, which is what an arriving force means", () => {
        const fields = garrisonFields({ infantry: 5, assault: 2, air: 1, naval: 0 });
        expect(fields.useableAssault).toBe(2);
        expect(fields.useableAir).toBe(1);
        expect(fields.useableNaval).toBe(0);
    });

    it("keeps the counts whole", () => {
        //A survivor array is a proportion of a starting force and comes out fractional.
        const fields = garrisonFields({ infantry: 10.4, assault: 1.6, air: 0, naval: 0 });
        expect(fields.infantryForCurrentTerritory).toBe(10);
        expect(fields.assaultForCurrentTerritory).toBe(2);
    });
});

describe("garrisonOf", () => {
    it("reads the seven figures off a territory", () => {
        expect(garrisonOf(territory())).toEqual({
            infantry: 1000, assault: 4, air: 3, naval: 2,
            useable: { assault: 4, air: 3, naval: 2 },
        });
    });

    it("reads a missing or malformed field as nothing rather than as NaN", () => {
        expect(garrisonOf({}).infantry).toBe(0);
        expect(garrisonOf(undefined).useable.air).toBe(0);
    });
});

describe("writeGarrison", () => {
    it("mutates in place and returns the same object", () => {
        const target = territory();
        const returned = writeGarrison(target, garrisonOf(target));
        expect(returned).toBe(target);
        expect(target.armyForCurrentTerritory).toBe(
            1000 +
            (4 * vehicleArmyPersonnelWorth.assault) +
            (3 * vehicleArmyPersonnelWorth.air) +
            (2 * vehicleArmyPersonnelWorth.naval)
        );
    });

    it("survives a debit larger than the garrison, which is the BJ case", () => {
        const target = territory();
        const before = garrisonOf(target);
        writeGarrison(target, {
            infantry: before.infantry - 5_000_000,
            assault: before.assault - 100,
            air: before.air - 100,
            naval: before.naval - 100,
            useable: {
                assault: before.useable.assault - 100,
                air: before.useable.air - 100,
                naval: before.useable.naval - 100,
            },
        });
        expect(target.infantryForCurrentTerritory).toBe(0);
        expect(target.armyForCurrentTerritory).toBe(0);
    });
});

describe("garrisonPatch", () => {
    it("changes only what it is given and recomputes the total from the result", () => {
        const source = territory();
        const patch = garrisonPatch(source, { infantry: 400 });
        expect(patch.infantryForCurrentTerritory).toBe(400);
        expect(patch.assaultForCurrentTerritory).toBe(4);
        expect(patch.armyForCurrentTerritory).toBe(
            400 +
            (4 * vehicleArmyPersonnelWorth.assault) +
            (3 * vehicleArmyPersonnelWorth.air) +
            (2 * vehicleArmyPersonnelWorth.naval)
        );
    });

    it("does not carry an inconsistent total forward -- the muster case", () => {
        //`musterAiArmies()` adjusted `armyForCurrentTerritory` by the same delta as the
        //infantry. That is correct arithmetic on a total that is already right, and it took a
        //territory whose stored total was below its infantry further negative every turn it
        //sent reinforcements.
        const broken = territory({ armyForCurrentTerritory: -8_000_000 });
        const patch = garrisonPatch(broken, { infantry: broken.infantryForCurrentTerritory - 100 });
        expect(patch.armyForCurrentTerritory).toBeGreaterThan(0);
    });

    it("returns a plain patch, not the territory", () => {
        const source = territory();
        const patch = garrisonPatch(source);
        expect(patch).not.toBe(source);
        expect(patch.territoryName).toBeUndefined();
    });
});
