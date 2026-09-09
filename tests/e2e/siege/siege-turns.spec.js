import { test, expect } from "../../support/fixtures.js";
import { battle } from "../../support/selectors.js";
import { armyMaintenanceFor } from "../../../src/rules/economy/maintenance.js";

// What a turn does to a siege, and what a siege does to the territory under it.
// docs/02-e2e-test-plan.md section 5.11.

/** Put France under a player siege and return once it is in the store. */
async function besiegeFrance(game, page) {
    await game.loadScenario("evenly-matched");
    await game.launchWholeGarrison({ from: "Germany", to: "France" });
    await page.locator(battle.siege).click();
    await expect.poll(async () => (await game.sieges()).player).toContain("France");
}

test.describe("a siege over time", () => {
    test.setTimeout(300_000);

    test("advances by exactly one turn per turn", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "siege-tick" });
        await besiegeFrance(game, page);

        const start = await page.evaluate(() => window.__game.siegeAt("France"));
        expect(start.turnsInSiege).toBe(0);

        // The siege was laid during the Military phase, so the game is already past
        // Buy/Upgrade -- `endTurn()` alone is one turn from here. `playTurn()` would be two.
        await game.endTurn();
        const afterOne = await page.evaluate(() => window.__game.siegeAt("France"));
        expect(afterOne.turnsInSiege).toBe(1);

        await game.playTurn();
        const afterTwo = await page.evaluate(() => window.__game.siegeAt("France"));
        expect(afterTwo.turnsInSiege).toBe(2);
    });

    test("wears the defender's food capacity down", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "siege-damage" });
        await besiegeFrance(game, page);

        const before = await game.territory("France");
        expect(before.foodCapacity).toBeGreaterThan(0);

        await game.endTurn();

        // This asks the siege what it destroyed rather than diffing the territory's ceiling
        // across the turn, and the difference is not pedantry. Until the economy phase, an AI
        // country's upgrades raised no capacity at all (known-issue BK), so the only thing
        // that could move `foodCapacity` was the siege and a net diff measured it exactly.
        // They work now -- and a besieged territory can still build, so France answers a siege
        // by putting up a farm, and +10% of a ceiling outweighs one tick of collateral damage.
        // Measured here: 64,967,839 -> 65,032,807 over the turn the siege began, UP, with one
        // farm built. The siege was doing its job the whole time.
        const siege = await page.evaluate(() => window.__game.siegeAt("France"));
        expect(siege.foodCapacityDestroyed, "a siege damages what it besieges")
            .toBeGreaterThan(0);

        const after = await game.territory("France");
        // Never below zero and never non-finite: `calculateDamageDone()` left
        // `collateralDamage` undefined on one of its four paths, which made `foodCapacity`
        // NaN for the rest of the game (defect AK, fixed in Phase 4).
        expect(after.foodCapacity).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(after.foodCapacity)).toBe(true);
        expect(Number.isFinite(siege.foodCapacityDestroyed)).toBe(true);
    });

    test("keeps the defender alive rather than emptying it", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "siege-sane" });
        await besiegeFrance(game, page);

        for (let turn = 0; turn < 3; turn += 1) {
            await game.playTurn();
            const territory = await game.territory("France");
            const numbers = Object.entries(territory).filter(
                ([, value]) => typeof value === "number"
            );
            const nonFinite = numbers.filter(([, value]) => !Number.isFinite(value));
            expect(nonFinite, `non-finite fields on turn ${turn}`).toEqual([]);

            const siege = await page.evaluate(() => window.__game.siegeAt("France"));
            if (!siege) {
                break; // resolved -- an arrest or a conquest, both legitimate
            }
            expect(siege.defendingArmyRemaining.every((count) => count >= 0)).toBe(true);
            expect(siege.attackingArmyRemaining.every((count) => count >= 0)).toBe(true);
        }
    });

    test("leaves the besieged territory a reduced income, not none", async ({ game, page }) => {
        // THE RULE, decided rather than inherited. This spec used to characterise the
        // opposite: gold, oil and construction materials were simply absent from the siege
        // branch of the income pass, so a besieged territory earned NOTHING for as long as
        // the siege stood -- and nothing in the game ends a siege except an arrest or a
        // conquest. A player besieged on turn 3 of a measured run was still frozen on turn 14
        // with no decision available to them. The old spec said in as many words that it
        // should be deleted and the new rule stated when this changed.
        //
        // It is `SIEGE_INCOME_SHARE` of the yield now, with upkeep charged in FULL against it.
        //
        // Gold is the witness and the assertion is one-sided, both deliberately. Oil and
        // construction materials look like better probes and are not: France sits AT both
        // ceilings in this scenario, so their regeneration is zero whatever the siege does,
        // and a spec asserting they rose would fail for a reason that has nothing to do with
        // the rule. And the yield itself cannot be predicted here without re-implementing
        // `calculateGoldChange()` in the test. What CAN be stated exactly is the floor: a
        // territory earning nothing would lose its whole upkeep bill, so a treasury that fell
        // by less than that received something. `armyMaintenanceFor()` is the real rule, pure
        // and importable, so this borrows it rather than copying the four rates.
        await game.start({ country: "Germany", seed: "siege-income" });
        await besiegeFrance(game, page);

        const before = await game.territory("France");
        expect(before.goldForCurrentTerritory).toBeGreaterThan(0);
        const upkeep = armyMaintenanceFor(before);
        expect(upkeep, "the scenario's garrison has to owe something").toBeGreaterThan(0);

        await game.endTurn();
        const after = await game.territory("France");

        const delta = after.goldForCurrentTerritory - before.goldForCurrentTerritory;
        expect(delta, "a besieged treasury is no longer frozen").not.toBe(0);
        expect(
            delta,
            "a besieged territory that earned nothing would be down its whole upkeep bill"
        ).toBeGreaterThan(-upkeep);

        expect(after.goldForCurrentTerritory).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(after.goldForCurrentTerritory)).toBe(true);
        expect(Number.isFinite(after.consMatsForCurrentTerritory)).toBe(true);
        expect(Number.isFinite(after.oilForCurrentTerritory)).toBe(true);
    });

    test("refuses to let the besieged territory build -- BQ", async ({ game, page }) => {
        // Known-issue BQ. A besieged territory could not earn and could still BUILD, which is
        // an odd pair on its own and produced a plainly wrong outcome: France, under siege,
        // put up a farm and its food ceiling went UP across the turn the siege began, so the
        // farm outran the siege grinding it down. `condition` is what gates every plus button
        // in the upgrade window, so asserting it is asserting the control.
        await game.start({ country: "Germany", seed: "siege-build" });
        await besiegeFrance(game, page);

        const conditions = await page.evaluate(() =>
            window.__game
                .availableUpgrades("France")
                .map((row) => row.condition));
        expect(conditions.length).toBeGreaterThan(0);
        expect(new Set(conditions)).toEqual(new Set(["Under Siege"]));
    });
});
