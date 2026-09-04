import { test, expect } from "../../support/fixtures.js";
import { GameDriver } from "../../support/game.js";
import { confirmDialog, containers, goalSelect, menu, phaseBar } from "../../support/selectors.js";

// The screen every new game opens on, and the one modal in the game with no way out that
// does not answer its question.
//
// Goals and Victory, Q4.2. What is asserted here is the FLOW -- that the chooser is
// unskippable, that Escape is a way back to the menu rather than a way past the screen, and
// that Confirm lands on country selection. What each page SAYS is
// `tests/unit/ui-goal-catalogue.spec.js`, which pins the catalogue in Node: no spec here
// asserts prose, for the same reason none of `tests/e2e/dominapedia/` does.

test.describe("the goal chooser", () => {
    test("opens on New Game, before the country-selection screen", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open();

        await page.click(menu.newGame);

        await expect(page.locator(goalSelect.panel)).toBeVisible();
        await expect(page.locator(containers.menu)).toBeHidden();
        // The map is behind the scrim and the selection screen's title is already up, but
        // the confirm button that takes a country is not reachable -- the scrim is over it.
        await expect(page.locator(goalSelect.confirm)).toBeVisible();
    });

    test("cannot be dismissed by clicking the scrim", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open();
        await page.click(menu.newGame);
        await expect(page.locator(goalSelect.panel)).toBeVisible();

        // Every other modal in the game cancels on a scrim click. This one has nothing to
        // cancel to, so the corner of the scrim is deliberately inert.
        await page.locator(goalSelect.container).click({ position: { x: 5, y: 5 } });

        await expect(page.locator(goalSelect.panel)).toBeVisible();
        await expect(page.locator(containers.menu)).toBeHidden();
    });

    test("offers no cancel button", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open();
        await page.click(menu.newGame);

        // One button in the whole panel, and it is the one that answers the question.
        // Options and Save/Load are built from the same furniture and both carry two.
        const buttons = page.locator(`${goalSelect.panel} button`);
        await expect(buttons).toHaveCount(1);
        await expect(buttons.first()).toHaveText("Begin");
    });

    test("Escape goes back to the main menu rather than past the screen", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open();
        await page.click(menu.newGame);
        await expect(page.locator(goalSelect.panel)).toBeVisible();

        await page.keyboard.press("Escape");

        await expect(page.locator(goalSelect.container)).toBeHidden();
        await expect(page.locator(containers.menu)).toBeVisible();

        // And New Game asks again. A player who changed their mind about starting has not
        // started a game with no goal.
        await page.click(menu.newGame);
        await expect(page.locator(goalSelect.panel)).toBeVisible();
    });

    test("Confirm reaches country selection", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open();
        await page.click(menu.newGame);

        await page.click(goalSelect.confirm);

        await expect(page.locator(goalSelect.container)).toBeHidden();
        await expect(page.locator(phaseBar.title)).toHaveText("Select a Country...");
        await expect(page.locator(containers.bottomTable)).toBeVisible();

        // And the country underneath is really selectable, which is the whole point of the
        // screen the chooser sits in front of.
        await game.selectTerritory("Germany");
        await expect(page.locator(phaseBar.confirm)).toBeVisible();
    });

    test("a restart from inside a game asks the question again", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "goal-restart" });

        await game.withBlockersCleared(() => page.keyboard.press("Escape"));
        await page.click(menu.newGame);
        // Restarting over a live game asks before destroying it, exactly as it did before
        // the chooser existed.
        await page.click(confirmDialog.confirm);

        await expect(page.locator(goalSelect.panel)).toBeVisible({ timeout: 120_000 });
    });
});
