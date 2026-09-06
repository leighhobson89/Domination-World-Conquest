import { test, expect } from "../../support/fixtures.js";
import { GameDriver } from "../../support/game.js";
import { gameOver, phaseBar } from "../../support/selectors.js";

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
// The SCREEN is the other half of that wiring, and it is asserted the same way and for the
// same reason: `tests/unit/ui-game-over.spec.js` decides every word of every outcome from
// `describeEnding()`, in Node, in about a millisecond. What needs a browser is only that the
// panel is subscribed, that it draws, and that its three exits go where they say.
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

        // Nothing stops the world turning -- the ending screen is a second subscriber to this
        // event and not a change to it, so the condition stays met and the latch is the only
        // thing keeping it quiet. The panel sits at z-index 10000 over the phase button, so
        // its quiet third exit is what lets this spec go on driving the game.
        await page.click(gameOver.viewMap);
        await game.playTurns(2);

        expect(await page.evaluate(() => window.__game.gameOverEvents())).toHaveLength(1);
    });

    test("raises the ending screen, saying what was played for and how it went", async ({
        page,
    }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "game-over-screen" });

        await game.endBuyPhase();
        await game.loadScenario("player-eliminated");
        await game.endTurn();

        await page.waitForSelector(gameOver.panel, { state: "visible" });
        // Elimination and a rival's victory are both DEFEAT and are not the same sentence.
        // Which sentence appears is decided in the unit suite; that the right KIND of ending
        // reached the screen is what this asserts.
        expect(await page.textContent(gameOver.title)).toContain("Defeat");
        expect(await page.textContent(gameOver.subtitle)).toContain("driven from the map");
        // The goal is named whatever the outcome: five goals end five different ways, and a
        // screen that could not say which was being played would waste the one moment the
        // whole game builds to.
        expect((await page.textContent(gameOver.playedFor)).length).toBeGreaterThan(0);
        expect(await page.locator(`${gameOver.standings} tr`).count()).toBeGreaterThan(1);

        // The tone is a class, not an inline colour -- `style.css` carries no colour literal
        // outside `:root`, and a themed page has to be able to say what defeat looks like.
        expect(await page.getAttribute(gameOver.panel, "data-tone")).toBe("defeat");
    });

    test("View Final Map puts the finished board back without ending anything", async ({
        page,
    }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "game-over-view" });

        await game.endBuyPhase();
        await game.loadScenario("player-eliminated");
        await game.endTurn();
        await page.waitForSelector(gameOver.panel, { state: "visible" });

        await page.click(gameOver.viewMap);
        await page.waitForSelector(gameOver.container, { state: "hidden" });

        // Nothing was reset and nothing was decided a second time: the quiet exit only takes
        // the panel down.
        expect(await page.evaluate(() => window.__game.gameOverEvents())).toHaveLength(1);
    });

    test("New Game on the ending screen starts a fresh game and clears the ending", async ({
        page,
    }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "game-over-restart" });

        await game.endBuyPhase();
        await game.loadScenario("player-eliminated");
        await game.endTurn();
        expect(await page.evaluate(() => window.__game.gameOverEvents())).toHaveLength(1);

        // Straight from the panel, which is the route a player actually takes -- it goes to
        // the same `startNewGame()` the main menu's button does, so the goal chooser is next
        // and there is no confirm dialog, because there is no game left to lose.
        await page.waitForSelector(gameOver.panel, { state: "visible" });
        await page.click(gameOver.newGame);
        await game.confirmGoal();
        await game.selectTerritory("Germany");
        await page.click(phaseBar.confirm);
        await page.waitForFunction(() => window.__game && window.__game.isReady(),
            null, { timeout: 120_000 });

        expect(await page.evaluate(() => window.__game.gameOverEvents())).toEqual([]);
    });
});
