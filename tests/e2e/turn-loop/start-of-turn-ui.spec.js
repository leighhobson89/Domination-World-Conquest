import { test, expect } from "../../support/fixtures.js";
import { containers } from "../../support/selectors.js";

// The info panel auto-opens at the start of each turn while the checkbox is on.
// docs/04-e2e-test-plan.md section 5.3.

/**
 * Play one turn and report whether the panel opened.
 *
 * `gameLoop()` opens it only when `continueSiege === true` -- that is, on a turn where
 * no siege ended in an arrest. An arrest raises the battle results screen instead, and
 * the two would collide. Before refactor Phase 3 that never came up, because audit
 * 5.1 D meant one quiet siege cancelled every other siege's processing and audit 5.2 J
 * meant only one besieged territory was processed at all. Now that sieges tick properly
 * an arrest is an ordinary event, so "the preference takes effect" means "on the next
 * turn that does not end one", not "on the very next turn".
 */
async function playTurnAndSeeIfPanelOpens(game, page) {
    await game.playTurn();
    await game.dismissBattleResults();
    return page.locator(containers.mainUi).isVisible();
}

test.describe("the start-of-turn info panel", () => {
    // Two of these play several turns, and a turn is 206 AI countries. The default
    // 120 s budget is a turn or two, not a handful.
    test.setTimeout(300_000);

    test("opens automatically at the start of a turn, but never turn 1", async ({
        startedGame: game,
        page,
    }) => {
        // gameLoop() opens it when uiAppearsAtStartOfTurn is set AND currentTurn is
        // not 1 -- turn 1 has no income to report, so there is nothing to show.
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await expect
            .poll(async () => playTurnAndSeeIfPanelOpens(game, page), { timeout: 240_000 })
            .toBe(true);

        expect(await game.turn()).toBeGreaterThanOrEqual(2);
    });

    test("does not open when the preference is off, and the preference survives turns", async ({
        startedGame: game,
        page,
    }) => {
        // audit 5.1 AA, fixed in refactor Phase 3.1a -- more than one full turn is
        // testable again.

        // The checkbox lives inside the panel, so turning the preference off means
        // opening the panel, unticking, and closing again.
        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await game.playTurn();
        await game.dismissBattleResults();
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await game.playTurn();
        await game.dismissBattleResults();
        await expect(
            page.locator(containers.mainUi),
            "the preference should not reset each turn"
        ).toBeHidden();
    });

    test("can be turned back on and takes effect again", async ({
        startedGame: game,
        page,
    }) => {
        // audit 5.1 AA, fixed in refactor Phase 3.1a -- more than one full turn is
        // testable again.

        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await game.playTurn();
        await game.dismissBattleResults();
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await expect
            .poll(async () => playTurnAndSeeIfPanelOpens(game, page), { timeout: 240_000 })
            .toBe(true);
    });
});
