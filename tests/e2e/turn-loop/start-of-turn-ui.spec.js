import { test, expect } from "../../support/fixtures.js";
import { containers } from "../../support/selectors.js";

// The info panel auto-opens at the start of each turn while the checkbox is on.
// docs/04-e2e-test-plan.md section 5.3.

test.describe("the start-of-turn info panel", () => {
    test("opens automatically at the start of turn 2", async ({ startedGame: game, page }) => {
        // gameLoop() opens it when uiAppearsAtStartOfTurn is set AND currentTurn is
        // not 1 -- turn 1 has no income to report, so there is nothing to show.
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await game.playTurn();

        await expect(page.locator(containers.mainUi)).toBeVisible();
        expect(await game.turn()).toBe(2);
    });

    test.fixme("does not open when the preference is off, and the preference survives turns", async ({
        startedGame: game,
        page,
    }) => {
        // 🔴 audit 5.1 AA -- the AI turn throws `Cannot read properties of undefined
        // (reading '1')` and the unhandled rejection stops `gameLoop()` for good. It
        // can land as early as the second AI phase, so ANY spec needing more than one
        // full turn is a coin flip today. Un-fixme with refactor Phase 3.1a.

        // The checkbox lives inside the panel, so turning the preference off means
        // opening the panel, unticking, and closing again.
        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await game.playTurn();
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await game.playTurn();
        await expect(
            page.locator(containers.mainUi),
            "the preference should not reset each turn"
        ).toBeHidden();
    });

    test.fixme("can be turned back on and takes effect the next turn", async ({
        startedGame: game,
        page,
    }) => {
        // 🔴 audit 5.1 AA -- the AI turn throws `Cannot read properties of undefined
        // (reading '1')` and the unhandled rejection stops `gameLoop()` for good. It
        // can land as early as the second AI phase, so ANY spec needing more than one
        // full turn is a coin flip today. Un-fixme with refactor Phase 3.1a.

        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await game.playTurn();
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await game.playTurn();
        await expect(page.locator(containers.mainUi)).toBeVisible();
    });
});
