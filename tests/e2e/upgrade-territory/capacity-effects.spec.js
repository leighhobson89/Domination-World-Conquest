import { test, expect } from "../../support/fixtures.js";

// 🔴 THE audit section 5.1 A regression test.
//
// Buying one farm is documented, in the row's own effect text, as "Food cap.
// +10%". What the code does is:
//
//     mainGameArray[i].farmsBuilt += parseInt(upgradeArray[0]);
//     if (mainGameArray[i].farmsBuilt > 0) {
//         foodCapacity += foodCapacity * ((territory.farmsBuilt * 10) / 100);
//     }
//
// `territory` IS `mainGameArray[i]`, and `farmsBuilt` has already been
// incremented -- so the multiplier is the TOTAL number of farms, applied to the
// already-boosted capacity, every time ANY upgrade is bought. The 5th farm
// applies +50%. A fort purchase re-applies the farm, forest and oil bonuses
// because the three `> 0` guards do not check what was actually bought.
//
// FIXED in refactor Phase 3.1: each building bought in a transaction is worth +10%
// of the capacity the territory had BEFORE that transaction, and the three guards
// now test what was BOUGHT rather than what has ever been built, so a fort no
// longer re-applies the farm, forest and oil bonuses.
//
// ECONOMY STAGE 3.1 added a second term. The gain is now
// `(capacity * 0.10) + upgradeFlatCapacityGain[resource]` per building bought, and
// the flat half is the whole of that stage: ten per cent of a ceiling is eighty
// people on a territory of eight hundred and a fortune on China, which is why the
// same farm at the same price paid back in under a turn in one place and in
// thirteen thousand turns in another. The regression this file exists for is the
// COMPOUNDING one, and it is unchanged and still asserted -- neither term may be
// applied to an already-boosted figure, and a fort must still touch no ceiling at
// all. The flat term is imported rather than written out, because a copy of a
// balance number in a spec is what economy stage 4.1 had to go and fix in
// `buy-military/purchase.spec.js`.
//
// docs/03-e2e-test-plan.md section 5.7.

import { upgradeFlatCapacityGain } from "../../../src/config/balance.js";

/** What one building of `kind` adds to a ceiling that stood at `before`. */
function gainFor(before, resource, bought = 1) {
    return ((before * 0.1) + upgradeFlatCapacityGain[resource]) * bought;
}

/** Build one of something and return the territory before and after. */
async function buildOne(game, building, territoryName = "Germany") {
    const before = await game.territory(territoryName);
    await game.openUpgrade(territoryName);
    await game.upgradeWindow.plus(building);
    await game.upgradeWindow.submit();
    const after = await game.territory(territoryName);
    return { before, after };
}

test.describe("capacity effects of a single building", () => {
    test("one farm raises food capacity by exactly ten percent", async ({
        startedGame: game,
    }) => {
        const { before, after } = await buildOne(game, "farm");

        expect(after.farmsBuilt).toBe(before.farmsBuilt + 1);
        expect(after.foodCapacity)
            .toBeCloseTo(before.foodCapacity + gainFor(before.foodCapacity, "food"), 4);
    });

    test("one forest raises cons. mats capacity by ten percent and a flat amount", async ({
        startedGame: game,
    }) => {
        const { before, after } = await buildOne(game, "forest");

        expect(after.forestsBuilt).toBe(before.forestsBuilt + 1);
        expect(after.consMatsCapacity).toBeCloseTo(
            before.consMatsCapacity + gainFor(before.consMatsCapacity, "consMats"), 4);
    });

    test("one oil well raises oil capacity by ten percent and a flat amount", async ({
        startedGame: game,
    }) => {
        const { before, after } = await buildOne(game, "oilWell");

        expect(after.oilWellsBuilt).toBe(before.oilWellsBuilt + 1);
        expect(after.oilCapacity)
            .toBeCloseTo(before.oilCapacity + gainFor(before.oilCapacity, "oil"), 4);
    });

    test("a second farm raises capacity by ten percent of the NEW ceiling, not twenty", async ({
        startedGame: game,
    }) => {
        await buildOne(game, "farm");
        const { before, after } = await buildOne(game, "farm");

        // The audit 5.1 A regression, restated for two terms: the percentage half is measured
        // against the ceiling as it stands BEFORE this transaction -- which the first farm has
        // already raised -- and never against an already-boosted figure a second time.
        expect(after.farmsBuilt).toBe(2);
        expect(after.foodCapacity)
            .toBeCloseTo(before.foodCapacity + gainFor(before.foodCapacity, "food"), 4);
    });

    test("buying a fort leaves all three capacities untouched", async ({
        startedGame: game,
    }) => {
        // A fort has nothing to do with food, cons. mats or oil. The three
        // `> 0` guards do not check what was bought, so today it re-applies every
        // bonus the territory has ever earned.
        const { before, after } = await buildOne(game, "fort");

        expect(after.fortsBuilt).toBe(before.fortsBuilt + 1);
        expect(after.foodCapacity).toBeCloseTo(before.foodCapacity, 4);
        expect(after.consMatsCapacity).toBeCloseTo(before.consMatsCapacity, 4);
        expect(after.oilCapacity).toBeCloseTo(before.oilCapacity, 4);
    });

    });
