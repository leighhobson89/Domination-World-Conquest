import { test, expect } from "../../support/fixtures.js";
import { GameDriver } from "../../support/game.js";
import { confirmDialog, menu, phaseBar } from "../../support/selectors.js";

// The ending, and the one property of it that no unit test can see: that it is WIRED.
//
// `tests/unit/rules-victory-check.spec.js` decides every outcome -- a met condition under
// each of the five goals, elimination, the turn-limit tie-break -- on a seven-territory
// world with no store and no browser. None of that is repeated here.
//
// What needs a browser is the wiring: the check is one call in the turn engine's `endTurn`
// hook, BEFORE `advanceTurn`, and it LATCHES. The failure that latch exists to prevent is a
// decided game announcing itself again at the end of every subsequent turn, which is
// invisible to anything that only asks "is the game over" -- so the assertion is a COUNT,
// over turns played past the ending. `window.__game.gameOverEvents()` is the list.
//
// Elimination is the ending used because it is the only one reachable from a scenario: the
// other four ask for continents, for 60% of the world's land or for two hundred turns.
// It is not a special case of the rule -- `checkForVictory()` puts it first deliberately,
// because holding nothing is losing whatever you were playing for.

test.describe("the end of a game", () => {
    test("nothing is decided while the game is being played", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "game-over-quiet" });

        await game.playTurns(2);

        expect(await page.evaluate(() => window.__game.gameOverEvents())).toEqual([]);
    });

    test("losing the last territory ends the game once", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "game-over-eliminated" });

        // Germany is a single-territory country, so this is the player's whole empire
        // changing hands. Straight through `state/mutations.js`, like every scenario.
        await game.endBuyPhase();
        await game.loadScenario("player-eliminated");
        expect(await game.playerTerritories()).toHaveLength(0);

        await game.endTurn();

        const decided = await page.evaluate(() => window.__game.gameOverEvents());
        expect(decided).toHaveLength(1);
        expect(decided[0].outcome).toBe("DEFEAT");
        expect(decided[0].reason).toBe("ELIMINATED");
        expect(decided[0].winner).toBe(null);

        // The check runs BEFORE `advanceTurn`, so the turn it reports is the turn that was
        // being played and not the one after it. A timed game scored a turn late would be
        // off by one against every number the player had been reading all game.
        expect(decided[0].turn).toBe(1);
    });

    test("a decided game does not announce itself again every turn", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "game-over-latch" });

        await game.endBuyPhase();
        await game.loadScenario("player-eliminated");
        await game.endTurn();
        expect(await page.evaluate(() => window.__game.gameOverEvents())).toHaveLength(1);

        // Nothing stops the world turning yet -- the victory and defeat screens are the
        // next phase and are a second subscriber to this event, not a change to it. So the
        // condition stays met, and the latch is the only thing keeping it quiet.
        await game.playTurns(2);

        expect(await page.evaluate(() => window.__game.gameOverEvents())).toHaveLength(1);
    });

    test("New Game clears the previous game's ending", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "game-over-restart" });

        await game.endBuyPhase();
        await game.loadScenario("player-eliminated");
        await game.endTurn();
        expect(await page.evaluate(() => window.__game.gameOverEvents())).toHaveLength(1);

        await game.withBlockersCleared(() => page.keyboard.press("Escape"));
        await page.click(menu.newGame);
        await page.click(confirmDialog.confirm);
        await game.confirmGoal();
        await game.selectTerritory("Germany");
        await page.click(phaseBar.confirm);
        await page.waitForFunction(() => window.__game && window.__game.isReady(),
            null, { timeout: 120_000 });

        expect(await page.evaluate(() => window.__game.gameOverEvents())).toEqual([]);
    });
});
