import { test, expect } from "../../support/fixtures.js";
import { GameDriver } from "../../support/game.js";
import { confirmDialog, containers, menu, phaseBar } from "../../support/selectors.js";

// Reaching the menu mid-game, and what New Game does once there is a game to lose.
//
// Refactor Phase 7.2. Escape has opened the menu since long before the refactor and
// nothing on screen said so; the hamburger is the same transition with a handle on
// it, which is why these specs assert that the two do the same thing rather than
// testing the button in isolation.
//
// The New Game confirmation is the part with teeth. Before 7.2, New Game from inside
// a running game showed the country-selection screen over a world that was still
// running -- the turn counter, the territories and the engine were all the previous
// game's. So "cancel keeps the game" and "confirm actually resets it" are two halves
// of one behaviour and both are asserted.

test.describe("in-game menu access", () => {
    test("the hamburger is hidden on the title screen and shown in game", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open({ seed: "menu-access" });
        await expect(page.locator(menu.hamburger)).toBeHidden();

        await game.newGame();
        // Visible from the country-selection screen onwards -- backing out of that
        // is a decision too, and Escape has always worked there.
        await expect(page.locator(menu.hamburger)).toBeVisible();
    });

    test("the hamburger opens the menu and Resume hands the map back", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "menu-access" });

        await page.click(menu.hamburger);
        await expect(page.locator(containers.menu)).toBeVisible();
        await expect(page.locator(menu.hamburger)).toBeHidden();
        await expect(page.locator(menu.resume)).toBeEnabled();

        await page.click(menu.resume);
        await expect(page.locator(containers.menu)).toBeHidden();
        await expect(page.locator(menu.hamburger)).toBeVisible();
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase");
    });

    test("Escape does exactly what the hamburger does", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "menu-access" });

        await page.keyboard.press("Escape");
        await expect(page.locator(containers.menu)).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(page.locator(containers.menu)).toBeHidden();
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase");
    });

    test("Resume is greyed out until there is something to resume", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open({ seed: "menu-access" });
        await expect(page.locator(menu.resume)).toBeDisabled();
        // Save / Load has the same prerequisite as New Game -- a load patches the
        // seeded territories -- so the two are enabled together.
        await expect(page.locator(menu.newGame)).toBeEnabled();
        await expect(page.locator(menu.saveLoad)).toBeEnabled();
    });
});

test.describe("New Game over a running game", () => {
    test("asks first, and Cancel leaves the game exactly where it was", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "menu-access" });
        const turnBefore = await game.turn();
        const ownedBefore = await page.evaluate(
            () => window.__game.territoriesOwnedBy("Player").length);

        await page.keyboard.press("Escape");
        await page.click(menu.newGame);
        await expect(page.locator(confirmDialog.panel)).toBeVisible();

        await page.click(confirmDialog.cancel);
        await expect(page.locator(confirmDialog.container)).toBeHidden();
        // Still in the menu, and the world is untouched.
        await expect(page.locator(containers.menu)).toBeVisible();
        expect(await game.turn()).toBe(turnBefore);
        expect(await page.evaluate(() => window.__game.territoriesOwnedBy("Player").length))
            .toBe(ownedBefore);
    });

    test("no confirmation on the title screen -- there is nothing to lose", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open({ seed: "menu-access" });

        await page.click(menu.newGame);
        await expect(page.locator(confirmDialog.container)).toBeHidden();
        await expect(page.locator(phaseBar.confirm)).toBeVisible();
    });

    test("confirming puts the world back to before anybody played it", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "menu-access" });
        expect(await page.evaluate(() => window.__game.territoriesOwnedBy("Player").length))
            .toBeGreaterThan(0);

        await game.endBuyPhase();
        await game.endTurn();
        expect(await game.turn()).toBeGreaterThan(1);

        await game.withBlockersCleared(() => page.keyboard.press("Escape"));
        await expect(page.locator(containers.menu)).toBeVisible();
        await page.click(menu.newGame);
        await page.click(confirmDialog.confirm);

        // Back on the country-selection screen: nothing owned, the turn counter
        // reset, and the five strongest countries locked again.
        await expect(page.locator(phaseBar.title)).toHaveText("Select a Country...");
        expect(await game.turn()).toBe(1);
        expect(await page.evaluate(() => window.__game.territoriesOwnedBy("Player").length))
            .toBe(0);
        expect(await page.evaluate(() => window.__game.greyedOutCountries().length))
            .toBeGreaterThan(0);
    });

    test("the restarted game is playable -- the engine really did restart", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "menu-access" });

        await page.keyboard.press("Escape");
        await page.click(menu.newGame);
        await page.click(confirmDialog.confirm);

        // A different country, to prove the second game is not the first one wearing
        // a new label.
        await game.selectTerritory("Spain");
        await page.waitForFunction(
            (selector) => document.querySelector(selector)?.style.display === "block",
            phaseBar.confirm
        );
        await page.click(phaseBar.confirm);
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase",
            { timeout: 120_000 });
        expect(await page.evaluate(() => window.__game.territoriesOwnedBy("Player").length))
            .toBeGreaterThan(0);
        expect(await game.turn()).toBe(1);
    });
});
