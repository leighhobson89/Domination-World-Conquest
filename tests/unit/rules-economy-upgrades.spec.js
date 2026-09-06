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
    nextInOrderPriceFor,
    remainingCapacityFor,
    upgradeOrderPriceFor,
    upgradePriceFor
} from "../../src/rules/economy/upgrades.js";
import { defenseBonusFor } from "../../src/rules/economy/capacity.js";
import {
    maxFarms,
    maxOilWells,
    oilRequirements,
    territoryUpgradeBaseCostsConsMats,
    territoryUpgradeBaseCostsGold,
    upgradeFlatCapacityGain
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
        // The measurement behind E8, and it is now a RULE rather than a discrepancy: the
        // decision taken was that saving up to buy five at once is a real choice worth
        // keeping, and that the fault was that only the player could take it. So this ratio
        // is expected to stay above 2 -- `nextInOrderPriceFor()` below is what lets a buyer
        // who commits one decision at a time reach the same price.
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

describe("nextInOrderPriceFor", () => {
    // What makes the bulk discount available to a buyer that commits one decision at a time.
    // The AI's economy loop re-scores the territory after every purchase, so it cannot name
    // the size of its order up front -- and charging it `price(built + 1)` each pass made it
    // pay the full ladder, about 2.2x what a player pays for the same buildings. That was the
    // whole of E8: not the discount, but that only one side could take it.

    it("telescopes to the order price exactly", () => {
        // THE property. If these two ever diverge, the AI is paying something the price rule
        // never quotes to anybody.
        for (const kind of UPGRADE_KINDS) {
            for (const size of [1, 2, 5, 9]) {
                let marginals = { gold: 0, consMats: 0 };
                for (let ordered = 0; ordered < size; ordered++) {
                    const step = nextInOrderPriceFor(kind, 0, ordered, 0.7);
                    marginals = {
                        gold: marginals.gold + step.gold,
                        consMats: marginals.consMats + step.consMats
                    };
                }
                expect(marginals, `${kind} x${size}`)
                    .toEqual(upgradeOrderPriceFor(kind, 0, size, 0.7));
            }
        }
    });

    it("telescopes on top of what already stands, not from zero", () => {
        let total = 0;
        for (let ordered = 0; ordered < 3; ordered++) {
            total += nextInOrderPriceFor("fort", 4, ordered, 0.7).gold;
        }
        expect(total).toBe(upgradeOrderPriceFor("fort", 4, 3, 0.7).gold);
    });

    it("charges the first one in an order the full price of a first one", () => {
        // An order of zero costs nothing, so the first marginal is the whole of price(1) --
        // the discount is on the SECOND and later, which is what makes it a bulk discount and
        // not a rebate on buying anything at all.
        expect(nextInOrderPriceFor("farm", 0, 0, 0.7))
            .toEqual(upgradePriceFor("farm", 1, 0.7));
    });

    it("costs less per building the longer the order gets", () => {
        const first = nextInOrderPriceFor("farm", 0, 0, 0.7).gold;
        const fifth = nextInOrderPriceFor("farm", 0, 4, 0.7).gold;
        // Still rising -- the ladder is quadratic and this is its slope, not a flat rate --
        // but the five together come to far less than five rungs climbed separately.
        expect(fifth).toBeGreaterThan(first);
        let ladder = 0;
        for (let nth = 1; nth <= 5; nth++) {
            ladder += upgradePriceFor("farm", nth, 0.7).gold;
        }
        expect(upgradeOrderPriceFor("farm", 0, 5, 0.7).gold).toBeLessThan(ladder / 2);
    });

    it("treats a negative or missing position as the start of an order", () => {
        expect(nextInOrderPriceFor("farm", 0, -3, 0.7))
            .toEqual(upgradePriceFor("farm", 1, 0.7));
    });
});

describe("applyUpgrade", () => {
    it("raises the ceiling by 10% of what it was BEFORE the transaction, per unit", () => {
        // audit 5.1 A. This compounded once, and a fifth farm applied +50% on top of an
        // already-inflated figure. Three farms is +30%, never 1.1^3 (+33.1%). Stage 3 added a
        // FLAT term beside the percentage; the percentage half is still measured against the
        // ceiling as it stood before the transaction, and is still not compounded.
        const flat = upgradeFlatCapacityGain.food;
        const patch = applyUpgrade(territory({ foodCapacity: 1000 }), "farm", 3);
        expect(patch.farmsBuilt).toBe(3);
        expect(patch.foodCapacity).toBeCloseTo(1300 + (3 * flat), 6);
        expect(patch.foodCapacity).not.toBeCloseTo(1000 * Math.pow(1.1, 3) + (3 * flat), 6);
    });

    it("adds to what is already built rather than replacing it", () => {
        const patch = applyUpgrade(territory({ farmsBuilt: 2, foodCapacity: 1210 }), "farm", 1);
        expect(patch.farmsBuilt).toBe(3);
        expect(patch.foodCapacity).toBeCloseTo((1210 * 1.1) + upgradeFlatCapacityGain.food, 6);
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

// --- economy stage 3: nudge the small without taxing the large -------------------------------

describe("the flat component of an upgrade (economy stage 3.1)", () => {
    // The governing principle of the whole phase, in Leigh's words: "larger territories should
    // not be penalised for their size ... but smaller countries get a little nudge so that they
    // are not just a total waste of time". So the lever is the BENEFIT and never the price, and
    // what is asserted here is the SHAPE of that benefit rather than any one number: the flat
    // part dominates at the bottom of the map, the percentage swamps it at the top, and nothing
    // anywhere is taxed to pay for it.

    it("gives every economic upgrade a flat term as well as its 10%", () => {
        for (const [kind, resource] of [
            ["farm", "food"], ["forest", "consMats"], ["oilWell", "oil"]
        ]) {
            const field = UPGRADES[kind].capacity;
            const patch = applyUpgrade(territory({ [field]: 0 }), kind, 1);
            expect(patch[field]).toBeCloseTo(upgradeFlatCapacityGain[resource], 6);
        }
    });

    it("is the whole of the gain on the smallest territory on the map", () => {
        // Vatican City's food ceiling is its population plus its army: 801 people. Ten per cent
        // of that is 80, which is the reason a farm there paid back in thirteen thousand turns.
        const patch = applyUpgrade(territory({ foodCapacity: 801 }), "farm", 1);
        const percentagePart = 801 * CAPACITY_GAIN_PER_UPGRADE;
        expect(patch.foodCapacity - 801).toBeGreaterThan(percentagePart * 100);
    });

    it("is swamped by the percentage on the largest, so size still pays", () => {
        // China's food ceiling is about 1.45 billion. The flat term must be a rounding error
        // there, or "being large is good" has quietly stopped being true.
        const chinaCeiling = 1.455e9;
        const patch = applyUpgrade(territory({ foodCapacity: chinaCeiling }), "farm", 1);
        const gain = patch.foodCapacity - chinaCeiling;
        expect(upgradeFlatCapacityGain.food / gain).toBeLessThan(0.01);
        // ...and the large territory's gain is still far larger in ABSOLUTE terms, which is the
        // thing the principle actually protects.
        const smallPatch = applyUpgrade(territory({ foodCapacity: 801 }), "farm", 1);
        expect(gain).toBeGreaterThan((smallPatch.foodCapacity - 801) * 100);
    });

    it("scales with the number bought and is never compounded", () => {
        const one = applyUpgrade(territory({ oilCapacity: 500 }), "oilWell", 1).oilCapacity;
        const three = applyUpgrade(territory({ oilCapacity: 500 }), "oilWell", 3).oilCapacity;
        expect(three - 500).toBeCloseTo((one - 500) * 3, 6);
    });

    it("gives a fort nothing, because a fort raises no ceiling", () => {
        const patch = applyUpgrade(territory(), "fort", 1);
        expect(patch.foodCapacity).toBeUndefined();
        expect(patch.oilCapacity).toBeUndefined();
        expect(patch.consMatsCapacity).toBeUndefined();
    });

    it("names one flat term per ceiling and no more", () => {
        expect(Object.keys(upgradeFlatCapacityGain).sort())
            .toEqual(["consMats", "food", "oil"]);
        for (const value of Object.values(upgradeFlatCapacityGain)) {
            expect(value).toBeGreaterThan(0);
        }
    });

    it("makes five oil wells fuel one warship anywhere on the map", () => {
        // The legible statement of the oil nudge, and the reason the number is what it is: an
        // island whose oil ceiling is two barrels can currently fuel nothing at all, so the oil
        // gate reads to that player as "vehicles are not for you" rather than as a decision.
        expect(upgradeFlatCapacityGain.oil * maxOilWells).toBe(oilRequirements.naval);
    });
});
