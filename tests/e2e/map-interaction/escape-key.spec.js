import { test, expect } from "../../support/fixtures.js";
import { containers } from "../../support/selectors.js";

// Escape opens the in-game menu over the map and closes it again, restoring
// whichever panels were open. The handler is on the SVG document, so the map has
// to hold focus for the key to reach it.
//
// docs/04-e2e-test-plan.md section 5.4.

/** Escape is handled by a keydown listener on the map's own document. */
async function pressEscapeOnMap(game) {
    await game.map.frame().locator("svg").press("Escape");
}

test.describe("the escape key", () => {
    test("opens the menu over a running game and hides the in-game furniture", async ({
        startedGame: game,
        page,
    }) => {
        await expect(page.locator(containers.menu)).toBeHidden();

        await pressEscapeOnMap(game);

        await expect(page.locator(containers.menu)).toBeVisible();
        await expect(page.locator(containers.topTable)).toBeHidden();
        await expect(page.locator(containers.mainUi)).toBeHidden();
    });

    test("closes the menu again and brings the game back", async ({ startedGame: game, page }) => {
        await pressEscapeOnMap(game);
        await expect(page.locator(containers.menu)).toBeVisible();

        await page.locator(containers.menu).press("Escape");

        await expect(page.locator(containers.menu)).toBeHidden();
        await expect(page.locator(containers.topTable)).toBeVisible();
    });

    test("restores the info panel if it was open", async ({ startedGame: game, page }) => {
        await game.infoTable.open();
        await expect(page.locator(containers.mainUi)).toBeVisible();

        await pressEscapeOnMap(game);
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await page.locator(containers.menu).press("Escape");
        await expect(page.locator(containers.mainUi)).toBeVisible();
    });

    test("is ignored during initialisation", async ({ game, page }) => {
        // setUnsetMenuOnEscape is guarded by getGameInitialisation(), so a key
        // press while the world is being built must not strand the player in a
        // half-set-up menu. Pressing before New Game is the reachable equivalent:
        // outsideOfMenuAndMapVisible is still false, so nothing happens.
        await game.open();
        await game.map.frame().locator("svg").press("Escape");
        await expect(page.locator(containers.menu)).toBeVisible();
        await expect(page.locator(containers.topTable)).toBeHidden();
    });

    test("leaves the map interactive after a round trip", async ({ startedGame: game, page }) => {
        await pressEscapeOnMap(game);
        await page.locator(containers.menu).press("Escape");

        // Returning from the menu calls selectCountry(lastClickedPath, true), which
        // leaves `clickActionsDone` latched true. Only the SVG's own mouseout
        // clears it, and a mouseout needs a mouseover first -- so the pointer has
        // to visit the map and leave again before a click will update anything.
        // A real player's pointer does that on the way back from the menu;
        // Playwright's teleports, so the spec does it explicitly. Refactor Phase
        // 6.7 replaces the flag with a selection held in state.
        await game.map.hover("France");
        await game.map.dismissTooltip();

        await game.map.click("France");
        await expect.poll(async () => await game.bottomTable.territoryName()).toBe("France");
    });
});
