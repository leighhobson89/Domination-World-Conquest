import { test, expect } from "../../support/fixtures.js";
import { battle, containers, tables } from "../../support/selectors.js";

// The main info panel: Summary / Territories / Army / Wars & Sieges.
// docs/04-e2e-test-plan.md section 5.13.

test.describe("the info panel", () => {
    test.setTimeout(240_000);

    test("opens and closes, and only one tab is active at a time", async ({
        startedGame: game,
        page,
    }) => {
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await game.infoTable.open();
        await expect(page.locator(containers.mainUi)).toBeVisible();

        const activeCount = () =>
            page.evaluate(() => document.querySelectorAll(".tab-button.active").length);

        await game.infoTable.showSummary();
        expect(await activeCount(), "exactly one tab is active").toBe(1);
        const summary = await game.infoTable.activeTab();

        await game.infoTable.showTerritories();
        expect(await activeCount()).toBe(1);
        const territories = await game.infoTable.activeTab();
        expect(territories).not.toBe(summary);

        await game.infoTable.showArmy();
        expect(await activeCount()).toBe(1);
        expect(await game.infoTable.activeTab()).not.toBe(territories);

        await game.infoTable.showWarsAndSieges();
        expect(await activeCount()).toBe(1);

        await game.infoTable.close();
        await expect(page.locator(containers.mainUi)).toBeHidden();
    });

    test("keeps the chosen tab while the panel stays open", async ({ startedGame: game }) => {
        await game.infoTable.open();
        await game.infoTable.showTerritories();
        const chosen = await game.infoTable.activeTab();

        // Anything that redraws the panel without closing it must not reset the choice.
        await game.infoTable.rowNames();
        expect(await game.infoTable.activeTab()).toBe(chosen);
    });

    test("lists one row per owned territory, and every name is one the player owns", async ({
        game,
    }) => {
        // Japan, so there is more than one row to get wrong.
        await game.start({ country: "Hokkaido", seed: "panel-rows" });
        await game.infoTable.open();
        await game.infoTable.showTerritories();

        const owned = (await game.playerTerritories()).map((t) => t.territoryName).sort();
        const listed = (await game.infoTable.rowNames()).map((n) => n.trim()).sort();

        expect(listed).toEqual(owned);
    });

    test("gains a row when the player takes a territory", async ({ game }) => {
        await game.start({ country: "Germany", seed: "panel-conquest" });
        await game.infoTable.open();
        await game.infoTable.showTerritories();
        expect((await game.infoTable.rowNames()).map((n) => n.trim())).toEqual(["Germany"]);
        await game.infoTable.close();

        await game.loadScenario("outright-conquest");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await game.fightToResolution();
        await expect.poll(async () => game.battle.resultsShown()).toBe(true);
        await game.battle.acceptResult();
        await expect.poll(async () => (await game.territory("France")).owner).toBe("Player");

        await game.infoTable.open();
        await game.infoTable.showTerritories();
        expect((await game.infoTable.rowNames()).map((n) => n.trim()).sort()).toEqual([
            "France",
            "Germany",
        ]);
    });

    test("the Wars and Sieges tab shows a siege the player is running", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "panel-wars" });
        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await page.locator(battle.siege).click();
        await expect.poll(async () => (await game.sieges()).player).toContain("France");

        await game.infoTable.open();
        await game.infoTable.showWarsAndSieges();

        const text = await page.locator(tables.ui).innerText();
        expect(text, "the besieged territory should be named in the tab").toContain("France");
    });
});
