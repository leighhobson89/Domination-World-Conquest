// rules/economy/upgrades.js -- the economy phase, stage 1.
//
// This module exists to close three defects that were all the same defect: an upgrade was a
// thing every caller re-implemented rather than a thing the rules could do. The AI's upgrades
// raised no capacity (audit E1), its forts recomputed no defence bonus (E2), and there were six
// copies of the price formula of which one disagreed (E4, E5).
//
// So the tests that matter here are the ones that pin BEHAVIOUR ACROSS CALLERS: the price this
// module returns has to be the price the upgrade table has always charged, to the ceiling,
// because stage 1 changes no balance number and a divergence here would be a silent one.

import { describe, expect, it } from "vitest";

import {
    CAPACITY_GAIN_PER_UPGRADE,
    UPGRADES,
    UPGRADE_KINDS,
    applyUpgrade,
    remainingCapacityFor,
    upgradeOrderPriceFor,
    upgradePriceFor
} from "../../src/rules/economy/upgrades.js";
import { defenseBonusFor } from "../../src/rules/economy/capacity.js";
import {
    maxFarms,
    territoryUpgradeBaseCostsConsMats,
    territoryUpgradeBaseCostsGold
} from "../../src/config/balance.js";

/** The formula exactly as `incrementDecrementUpgrades()` wrote it before this module. */
function legacyPrice(kind, nth, devIndex) {
    const consMatsScale = kind === "farm" ? 1.1 : 1.05;
    return {
        gold: Math.ceil(
            (territoryUpgradeBaseCostsGold[kind] * nth * (nth * 1.05)) * (devIndex / 4)),
        consMats: Math.ceil(
            (territoryUpgradeBaseCostsConsMats[kind] * nth * (nth * consMatsScale)) *
            (devIndex / 4))
    };
}

function territory(overrides = {}) {
    return {
        territoryName: "Testland",
        devIndex: 0.7,
        farmsBuilt: 0, forestsBuilt: 0, oilWellsBuilt: 0, fortsBuilt: 0,
        foodCapacity: 1000, consMatsCapacity: 2000, oilCapacity: 3000,
        isLandLockedBonus: 0,
        ...overrides
    };
}

describe("upgradePriceFor", () => {
    it("charges exactly what the upgrade table charged before this module existed", () => {
        // The whole of stage 1's claim to be a defect fix and not a balance change rests on
        // this. Six copies became one; the one has to be the same number as the five correct
        // copies were.
        for (const kind of UPGRADE_KINDS) {
            for (const devIndex of [0.3, 0.5, 0.7, 0.921]) {
                for (let nth = 1; nth <= 5; nth++) {
                    expect(upgradePriceFor(kind, nth, devIndex))
                        .toEqual(legacyPrice(kind, nth, devIndex));
                }
            }
        }
    });

    it("is quadratic in the count, so a fifth costs about 26 times a first", () => {
        const first = upgradePriceFor("farm", 1, 0.7).gold;
        const fifth = upgradePriceFor("farm", 5, 0.7).gold;
        expect(fifth / first).toBeGreaterThan(24);
        expect(fifth / first).toBeLessThan(28);
    });

    it("scales linearly with the development index", () => {
        // devIndex / 4 is the only territory term in the price. Audit D3 notes that this
        // scales the WRONG way -- a developed territory pays more -- and stage 3 deliberately
        // leaves it alone, so it is pinned here rather than silently drifting.
        const low = upgradePriceFor("fort", 3, 0.4).gold;
        const high = upgradePriceFor("fort", 3, 0.8).gold;
        expect(high).toBeGreaterThanOrEqual(low * 2 - 1);
        expect(high).toBeLessThanOrEqual(low * 2 + 1);
    });

    it("gives a farm a steeper cons-mats curve than the other three", () => {
        // 1.1 against 1.05, present in all five copies this module replaced. Behaviour, not
        // tidiness: it makes farms the cons-mats-expensive upgrade.
        const farm = upgradePriceFor("farm", 5, 0.7).consMats;
        const forest = upgradePriceFor("forest", 5, 0.7).consMats;
        expect(territoryUpgradeBaseCostsConsMats.farm)
            .toBe(territoryUpgradeBaseCostsConsMats.forest);
        expect(farm).toBeGreaterThan(forest);
    });

    it("answers zero rather than NaN for nonsense", () => {
        // A NaN written into a gold balance never washes out -- every later turn recomputes
        // from what the last one left. Same reasoning as the guards in income.js.
        expect(upgradePriceFor("castle", 1, 0.7)).toEqual({ gold: 0, consMats: 0 });
        expect(upgradePriceFor("farm", 0, 0.7)).toEqual({ gold: 0, consMats: 0 });
        expect(upgradePriceFor("farm", -2, 0.7)).toEqual({ gold: 0, consMats: 0 });
        expect(upgradePriceFor("farm", 1, undefined)).toEqual({ gold: 0, consMats: 0 });
    });

    it("accepts a development index that arrives as a string", () => {
        // `initialData.js` supplies numbers, but several paths carry devIndex through the DOM
        // and a `parseFloat` was written out at every one of the six old call sites.
        expect(upgradePriceFor("farm", 2, "0.7")).toEqual(upgradePriceFor("farm", 2, 0.7));
    });
});

describe("upgradeOrderPriceFor", () => {
    it("prices an order at the LAST one in it, which is what the table has always charged", () => {
        // Audit E8, pinned deliberately rather than fixed: the upgrade row displays
        // price(built + quantity) and the confirm button sums the four cells, so an order of
        // five costs price(5) and not the sum of the ladder. It is a balance number and stage
        // 1 changes none.
        expect(upgradeOrderPriceFor("farm", 0, 5, 0.7)).toEqual(upgradePriceFor("farm", 5, 0.7));
        expect(upgradeOrderPriceFor("farm", 2, 1, 0.7)).toEqual(upgradePriceFor("farm", 3, 0.7));
    });

    it("makes bulk buying markedly cheaper than buying one a turn", () => {
        // The measurement behind E8. If this ratio ever comes out near 1, the discrepancy has
        // been fixed and the audit entry should be closed rather than this test relaxed.
        const bulk = upgradeOrderPriceFor("farm", 0, 5, 0.7).gold;
        let oneATurn = 0;
        for (let nth = 1; nth <= 5; nth++) {
            oneATurn += upgradePriceFor("farm", nth, 0.7).gold;
        }
        expect(oneATurn / bulk).toBeGreaterThan(2);
    });

    it("costs nothing for an empty order", () => {
        expect(upgradeOrderPriceFor("farm", 3, 0, 0.7)).toEqual({ gold: 0, consMats: 0 });
    });
});

describe("applyUpgrade", () => {
    it("raises the ceiling by 10% of what it was BEFORE the transaction, per unit", () => {
        // audit 5.1 A. This compounded once, and a fifth farm applied +50% on top of an
        // already-inflated figure. Three farms is +30%, never 1.1^3 (+33.1%).
        const patch = applyUpgrade(territory({ foodCapacity: 1000 }), "farm", 3);
        expect(patch.farmsBuilt).toBe(3);
        expect(patch.foodCapacity).toBeCloseTo(1300, 6);
        expect(patch.foodCapacity).not.toBeCloseTo(1000 * Math.pow(1.1, 3), 6);
    });

    it("adds to what is already built rather than replacing it", () => {
        const patch = applyUpgrade(territory({ farmsBuilt: 2, foodCapacity: 1210 }), "farm", 1);
        expect(patch.farmsBuilt).toBe(3);
        expect(patch.foodCapacity).toBeCloseTo(1210 * 1.1, 6);
    });

    it("touches only the ceiling that upgrade acts on", () => {
        // Buying a fort used to re-apply the farm, forest and oil bonuses too, because the
        // guards tested the total built rather than what was bought (audit 5.1 A).
        const patch = applyUpgrade(territory(), "oilWell", 1);
        expect(Object.keys(patch).sort()).toEqual(["oilCapacity", "oilWellsBuilt"]);
    });

    it("recomputes a fort's defence bonus through the one defence formula", () => {
        // audit E2: the AI never recomputed this at all, so an AI fort moved no die band.
        // known-issue AQ: a fourth hand-written copy of the formula is how it comes to
        // disagree, so this asserts the module agrees with `defenseBonusFor()` rather than
        // asserting a number.
        const before = territory({ fortsBuilt: 1, devIndex: 0.7, isLandLockedBonus: 10 });
        const patch = applyUpgrade(before, "fort", 2);
        expect(patch.fortsBuilt).toBe(3);
        expect(patch.defenseBonus).toBe(defenseBonusFor({ ...before, fortsBuilt: 3 }));
        expect(patch.defenseBonus).toBeGreaterThan(defenseBonusFor(before));
    });

    it("gives a fort no capacity at all", () => {
        const patch = applyUpgrade(territory(), "fort", 1);
        expect(patch.foodCapacity).toBeUndefined();
        expect(patch.consMatsCapacity).toBeUndefined();
        expect(patch.oilCapacity).toBeUndefined();
    });

    it("carries a fort past the band where it starts costing the attacker a die", () => {
        // The economy's only direct line into the dice. `DIE_MODIFIERS.fortification` bands
        // the raw bonus at 25 and 100; a territory whose forts never raised `defenseBonus` sat
        // below the first band forever, which is what E2 did to every AI territory.
        const bare = territory({ fortsBuilt: 0, devIndex: 0.7, isLandLockedBonus: 0 });
        expect(defenseBonusFor(bare)).toBeLessThan(25);
        expect(applyUpgrade(bare, "fort", 2).defenseBonus).toBeGreaterThanOrEqual(25);
    });

    it("returns an empty patch rather than a NaN for nonsense", () => {
        expect(applyUpgrade(territory(), "castle", 1)).toEqual({});
        expect(applyUpgrade(territory(), "farm", 0)).toEqual({});
        expect(applyUpgrade(null, "farm", 1)).toEqual({});
    });

    it("mutates nothing", () => {
        // The caller writes the patch through state/mutations.js. A rule that wrote the world
        // would be a rule the write guard reports.
        const before = territory();
        const snapshot = JSON.stringify(before);
        applyUpgrade(before, "farm", 2);
        applyUpgrade(before, "fort", 1);
        expect(JSON.stringify(before)).toBe(snapshot);
    });
});

describe("the upgrade table", () => {
    it("names all four kinds and a ceiling for the three economic ones", () => {
        expect(UPGRADE_KINDS).toEqual(["farm", "forest", "oilWell", "fort"]);
        expect(UPGRADES.farm.capacity).toBe("foodCapacity");
        expect(UPGRADES.forest.capacity).toBe("consMatsCapacity");
        expect(UPGRADES.oilWell.capacity).toBe("oilCapacity");
        expect(UPGRADES.fort.capacity).toBeNull();
    });

    it("counts what is left to build, and never goes negative", () => {
        expect(remainingCapacityFor(territory(), "farm")).toBe(maxFarms);
        expect(remainingCapacityFor(territory({ farmsBuilt: maxFarms }), "farm")).toBe(0);
        expect(remainingCapacityFor(territory({ farmsBuilt: 99 }), "farm")).toBe(0);
        expect(remainingCapacityFor(territory(), "castle")).toBe(0);
    });

    it("states the capacity gain once", () => {
        expect(CAPACITY_GAIN_PER_UPGRADE).toBe(0.1);
    });
});
