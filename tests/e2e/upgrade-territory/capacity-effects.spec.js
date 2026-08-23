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
// These specs are written for the intended behaviour and are `test.fixme` until
// refactor Phase 3.1 recomputes from `buildingsBuilt` against the pre-transaction
// capacity. The last spec records what happens today so the defect is not silent.
//
// docs/04-e2e-test-plan.md section 5.7.

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
    test.fixme("one farm raises food capacity by exactly ten percent", async ({
        startedGame: game,
    }) => {
        const { before, after } = await buildOne(game, "farm");

        expect(after.farmsBuilt).toBe(before.farmsBuilt + 1);
        expect(after.foodCapacity).toBeCloseTo(before.foodCapacity * 1.1, 4);
    });

    test.fixme("one forest raises cons. mats capacity by exactly ten percent", async ({
        startedGame: game,
    }) => {
        const { before, after } = await buildOne(game, "forest");

        expect(after.forestsBuilt).toBe(before.forestsBuilt + 1);
        expect(after.consMatsCapacity).toBeCloseTo(before.consMatsCapacity * 1.1, 4);
    });

    test.fixme("one oil well raises oil capacity by exactly ten percent", async ({
        startedGame: game,
    }) => {
        const { before, after } = await buildOne(game, "oilWell");

        expect(after.oilWellsBuilt).toBe(before.oilWellsBuilt + 1);
        expect(after.oilCapacity).toBeCloseTo(before.oilCapacity * 1.1, 4);
    });

    test.fixme("a second farm raises capacity by ten percent, not twenty", async ({
        startedGame: game,
    }) => {
        await buildOne(game, "farm");
        const { before, after } = await buildOne(game, "farm");

        expect(after.farmsBuilt).toBe(2);
        expect(after.foodCapacity).toBeCloseTo(before.foodCapacity * 1.1, 4);
    });

    test.fixme("buying a fort leaves all three capacities untouched", async ({
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

    test("today: a fort purchase inflates the food capacity of a territory with a farm", async ({
        startedGame: game,
    }) => {
        // Characterisation of audit 5.1 A, so the suite states the current
        // behaviour rather than staying quiet about it. When Phase 3.1 lands, this
        // spec fails -- which is the signal to delete it and un-fixme the five
        // above.
        await buildOne(game, "farm");
        const { before, after } = await buildOne(game, "fort");

        expect(after.fortsBuilt).toBeGreaterThan(before.fortsBuilt);
        expect(
            after.foodCapacity,
            "audit 5.1 A -- a fort should not touch food capacity"
        ).toBeGreaterThan(before.foodCapacity);
    });
});
