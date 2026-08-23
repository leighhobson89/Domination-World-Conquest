import { test, expect } from "../../support/fixtures.js";

// The top table is the player's headline figure for every resource. It must be
// the sum over the territories they own, and it must move when they spend.
//
// Numbers come from __game; the table is checked for the fact that it CHANGED,
// not for its formatted text -- parsing "1.2M" back into a number tests the
// formatter, not the economy (docs/04-e2e-test-plan.md section 8.3).
//
// docs/04-e2e-test-plan.md section 5.5.

/** Within a tenth of a percent -- loose enough for float noise, tight enough to catch a desync. */
function agrees(a, b) {
    return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.001);
}

async function totalsAndSum(game) {
    return game.state(() => {
        const owned = window.__game.territoriesOwnedBy("Player");
        const sum = (key) => owned.reduce((a, t) => a + t[key], 0);
        return {
            totals: window.__game.totals(),
            summed: {
                gold: sum("goldForCurrentTerritory"),
                oil: sum("oilForCurrentTerritory"),
                food: sum("foodForCurrentTerritory"),
                consMats: sum("consMatsForCurrentTerritory"),
                area: sum("area"),
                army: sum("armyForCurrentTerritory"),
                prodPop: sum("productiveTerritoryPop"),
            },
        };
    });
}

test.describe("the top table", () => {
    test("equals the sum over the player's territories for a single-territory country", async ({
        startedGame: game,
    }) => {
        const { totals, summed } = await totalsAndSum(game);

        for (const key of Object.keys(summed)) {
            expect(
                agrees(totals[key], summed[key]),
                `${key}: ${totals[key]} vs ${summed[key]}`
            ).toBe(true);
        }
    });

    test("equals the sum across all eleven territories of a multi-territory country", async ({
        game,
    }) => {
        await game.start({ country: "Alaska" });

        const owned = await game.playerTerritories();
        expect(owned.length).toBeGreaterThan(1);

        const { totals, summed } = await totalsAndSum(game);
        for (const key of Object.keys(summed)) {
            expect(
                agrees(totals[key], summed[key]),
                `${key}: ${totals[key]} vs ${summed[key]}`
            ).toBe(true);
        }
    });

    test("updates after a purchase, without a phase change", async ({ startedGame: game }) => {
        const goldBefore = await game.topTable.text("gold");
        const armyBefore = await game.topTable.text("army");

        await game.openBuy("Germany");
        await game.buyWindow.plus("infantry", 20);
        await game.buyWindow.submit();

        await expect.poll(async () => game.topTable.text("gold")).not.toBe(goldBefore);
        await expect.poll(async () => game.topTable.text("army")).not.toBe(armyBefore);
    });

    test("updates after an upgrade, without a phase change", async ({ startedGame: game }) => {
        const consMatsBefore = await game.topTable.text("consMats");

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort");
        await game.upgradeWindow.submit();

        await expect.poll(async () => game.topTable.text("consMats")).not.toBe(consMatsBefore);
    });

    test("shows the player's own flag", async ({ startedGame: game }) => {
        await expect(game.topTable.flag).toHaveAttribute("src", /flags\/Germany\.png$/);
    });
});
