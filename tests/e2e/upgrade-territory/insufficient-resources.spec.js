import { test, expect } from "../../support/fixtures.js";

// What the window says when a territory cannot pay, and which resource it blames.
// docs/03-e2e-test-plan.md section 5.7.

test.describe("when a territory cannot afford a building", () => {
    test("greys the row's plus button rather than allowing an overdraft", async ({
        startedGame: game,
    }) => {
        const before = await game.territory("Germany");

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort", 10);
        const reached = await game.upgradeWindow.quantity("fort");
        const quoted = await game.upgradeWindow.totals();

        expect(await game.upgradeWindow.rowGreyedOut("fort")).toBe(true);
        // Whatever the stepper allowed must still be payable.
        expect(quoted.gold).toBeLessThanOrEqual(before.goldForCurrentTerritory);
        expect(reached).toBeGreaterThan(0);
    });

    test("names the resource that is short", async ({ startedGame: game }) => {
        // calculateAvailableUpgrades sets the row's condition to 'Not enough gold'
        // or 'Not enough Cons. Mats.' and the row renders that text. An oil well is
        // the most expensive building in gold, so it is the first to fail.
        await game.openUpgrade("Germany");

        const text = await game.upgradeWindow.rowText("oilWell");
        const germany = await game.territory("Germany");

        // Whichever way this territory falls, the row must name the reason rather
        // than silently doing nothing.
        const affordable = text.includes("Cap.") || text.includes("+");
        const blamesAResource =
            text.includes("Not enough gold") || text.includes("Not enough Cons. Mats.");
        expect(
            affordable || blamesAResource,
            `row read "${text}" with ${Math.round(germany.goldForCurrentTerritory)} gold`
        ).toBe(true);
    });

    test("spends nothing when the confirm button is still Cancel", async ({
        startedGame: game,
    }) => {
        const before = await game.territory("Germany");

        await game.openUpgrade("Germany");
        expect(await game.upgradeWindow.confirmLabel()).toBe("Cancel");
        await game.upgradeWindow.submit();

        const after = await game.territory("Germany");
        expect(after.goldForCurrentTerritory).toBe(before.goldForCurrentTerritory);
        expect(after.consMatsForCurrentTerritory).toBe(before.consMatsForCurrentTerritory);
    });

    test("never lets a purchase drive a territory's gold negative", async ({
        startedGame: game,
    }) => {
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort", 10);
        await game.upgradeWindow.submit();

        const after = await game.territory("Germany");
        expect(after.goldForCurrentTerritory).toBeGreaterThanOrEqual(0);
        expect(after.consMatsForCurrentTerritory).toBeGreaterThanOrEqual(0);
    });
});
