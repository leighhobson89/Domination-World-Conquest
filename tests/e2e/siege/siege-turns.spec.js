import { test, expect } from "../../support/fixtures.js";

// What a turn does to a siege, and what a siege does to the territory under it.
// docs/04-e2e-test-plan.md section 5.11.

/** Put France under a player siege and return once it is in the store. */
async function besiegeFrance(game, page) {
    await game.loadScenario("evenly-matched");
    await game.launchWholeGarrison({ from: "Germany", to: "France" });
    await page.locator("#siegeButton").click();
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

        const after = await game.territory("France");
        expect(after.foodCapacity, "a siege damages what it besieges").toBeLessThan(
            before.foodCapacity
        );
        // Never below zero and never non-finite: `calculateDamageDone()` left
        // `collateralDamage` undefined on one of its four paths, which made `foodCapacity`
        // NaN for the rest of the game (defect AK, fixed in Phase 4).
        expect(after.foodCapacity).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(after.foodCapacity)).toBe(true);
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

    test("suspends the besieged territory's income -- characterised, not endorsed", async ({
        game,
        page,
    }) => {
        // This is a DESIGN problem, logged for Phase 7 in docs/05-known-issues.md section 6,
        // not a defect to fix here. The gold, oil and construction-material lines in the
        // siege branch are commented out under "uncomment other features if decided to
        // involve them in sieges", so a besieged territory earns nothing for as long as the
        // siege lasts -- and the AI besieges far more than it can finish.
        //
        // It is characterised rather than asserted as correct: this spec is written to FAIL
        // when Phase 7 gives a besieged territory some income, which is the point. If it
        // starts failing, the fix is to delete it and state the new rule.
        await game.start({ country: "Germany", seed: "siege-income" });
        await besiegeFrance(game, page);

        const before = await game.territory("France");
        await game.endTurn();
        const after = await game.territory("France");

        expect(
            after.goldForCurrentTerritory,
            "a besieged territory earns no gold today -- Phase 7 owns this"
        ).toBeLessThanOrEqual(before.goldForCurrentTerritory);
    });
});
