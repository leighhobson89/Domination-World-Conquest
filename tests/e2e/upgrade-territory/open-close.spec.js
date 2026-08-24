import { test, expect } from "../../support/fixtures.js";
import { containers, upgradeWindow } from "../../support/selectors.js";

// The upgrade window: how it opens, and that closing it spends nothing.
// docs/04-e2e-test-plan.md section 5.7.

test.describe("the upgrade window", () => {
    test("opens from the Territories tab for an owned territory", async ({
        startedGame: game,
        page,
    }) => {
        await game.openUpgrade("Germany");

        await expect(page.locator(containers.upgrade)).toBeVisible();
        await expect(game.upgradeWindow.subtitle).toHaveText("Germany");
        expect(await game.upgradeWindow.row("farm").count()).toBe(1);
    });

    test("offers exactly four buildings, in a fixed order", async ({ startedGame: game, page }) => {
        await game.openUpgrade("Germany");

        const rows = page.locator(upgradeWindow.row);
        await expect(rows).toHaveCount(4);
        const labels = await rows.evaluateAll((els) => els.map((el) => el.children[1].textContent));
        expect(labels).toEqual(["Farm", "Forest", "Oil Well", "Fort"]);
    });

    test("closes on the X without spending anything", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");
        expect(await game.upgradeWindow.quantity("farm")).toBe(1);

        await game.upgradeWindow.close();

        const after = await game.territory("Germany");
        expect(after.goldForCurrentTerritory).toBe(before.goldForCurrentTerritory);
        expect(after.consMatsForCurrentTerritory).toBe(before.consMatsForCurrentTerritory);
        expect(after.farmsBuilt).toBe(before.farmsBuilt);
    });

    test("closes on Cancel without spending anything", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.openUpgrade("Germany");
        // The confirm button reads "Cancel" until at least one row is non-zero.
        expect(await game.upgradeWindow.confirmLabel()).toBe("Cancel");
        await game.upgradeWindow.submit();

        const after = await game.territory("Germany");
        expect(after.goldForCurrentTerritory).toBe(before.goldForCurrentTerritory);
        expect(after.farmsBuilt).toBe(before.farmsBuilt);
    });

    test("is unavailable in the Military phase", async ({ startedGame: game }) => {
        await game.endBuyPhase();
        await game.infoTable.open();

        // The row still renders; the button is the greyed-out image with no
        // `.upgrade-button` class, so there is nothing clickable.
        expect(await game.infoTable.upgradeButtonEnabled("Germany")).toBe(false);
    });

    test("resets its totals each time it opens", async ({ startedGame: game }) => {
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");
        expect((await game.upgradeWindow.totals()).gold).toBeGreaterThan(0);
        await game.upgradeWindow.close();

        await game.openUpgrade("Germany");
        expect(await game.upgradeWindow.totals()).toEqual({ gold: 0, consMats: 0 });
        expect(await game.upgradeWindow.quantity("farm")).toBe(0);
    });
});
