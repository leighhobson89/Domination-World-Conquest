import { test, expect } from "../../support/fixtures.js";
import { buyWindow, containers } from "../../support/selectors.js";

// The buy window: how it opens, and that closing it spends nothing.
// docs/03-e2e-test-plan.md section 5.6.

test.describe("the buy window", () => {
    test("opens from the Army tab for an owned territory", async ({ startedGame: game, page }) => {
        await game.openBuy("Germany");

        await expect(page.locator(containers.buy)).toBeVisible();
        await expect(game.buyWindow.subtitle).toHaveText("Germany");
    });

    test("offers infantry, assault, air and naval, in that order", async ({
        startedGame: game,
        page,
    }) => {
        await game.openBuy("Germany");

        const rows = page.locator(buyWindow.row);
        await expect(rows).toHaveCount(4);
        const labels = await rows.evaluateAll((els) => els.map((el) => el.children[1].textContent));
        expect(labels).toEqual(["Infantry", "Assault", "Air", "Naval"]);
    });

    test("closes on the X without spending anything", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.openBuy("Germany");
        await game.buyWindow.plus("infantry");
        expect(await game.buyWindow.quantity("infantry")).toBe(1);

        await game.buyWindow.close();

        const after = await game.territory("Germany");
        expect(after.goldForCurrentTerritory).toBe(before.goldForCurrentTerritory);
        expect(after.infantryForCurrentTerritory).toBe(before.infantryForCurrentTerritory);
    });

    test("closes on Cancel without spending anything", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.openBuy("Germany");
        expect(await game.buyWindow.confirmLabel()).toBe("Cancel");
        await game.buyWindow.submit();

        const after = await game.territory("Germany");
        expect(after.goldForCurrentTerritory).toBe(before.goldForCurrentTerritory);
        expect(after.armyForCurrentTerritory).toBe(before.armyForCurrentTerritory);
    });

    test("is unavailable in the Military phase", async ({ startedGame: game }) => {
        await game.endBuyPhase();
        await game.infoTable.open();

        expect(await game.infoTable.buyButtonEnabled("Germany")).toBe(false);
    });

    test("resets its totals each time it opens", async ({ startedGame: game }) => {
        await game.openBuy("Germany");
        await game.buyWindow.plus("infantry");
        expect((await game.buyWindow.totals()).gold).toBeGreaterThan(0);
        await game.buyWindow.close();

        await game.openBuy("Germany");
        expect(await game.buyWindow.totals()).toEqual({ gold: 0, prodPop: 0 });
        expect(await game.buyWindow.quantity("infantry")).toBe(0);
    });
});
