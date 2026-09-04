import { test, expect } from "../../support/fixtures.js";
import { GameDriver } from "../../support/game.js";
import { confirmDialog, containers, menu, phaseBar } from "../../support/selectors.js";

// The chosen goal is durable state that lives OUTSIDE the store -- what a game is being
// played FOR is a setting, not a fact about the world -- so it rides in the `aiStrategy`
// save slice registered from `aiCalculations.js`. A load that put every territory back and
// quietly resumed the DEFAULT goal would pass every assertion in `save-load.spec.js`, hand
// the player a progress line about the wrong condition, and set every AI campaigning for
// something the player was not.
//
// Goals and Victory, Q4.3. Three facts have to survive: the kind, its scale, and the five
// names a Great Powers game froze at the start. The third is the one that is easy to lose,
// because `greatPowers` is spread onto the condition and a shared reference would not
// serialise as its own list.

test.describe("the chosen goal and a save", () => {
    test("a code restores the goal and its scale", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({
            country: "Germany",
            seed: "goal-save",
            goal: "DOMINATION",
            scale: "40% of the world's land"
        });

        const before = await page.evaluate(() => window.__game.victoryCondition());
        const code = await page.evaluate(() => window.__game.saveCode());

        // Start a different game, under a different goal, so a load that did nothing at all
        // could not pass by accident.
        await game.withBlockersCleared(() => page.keyboard.press("Escape"));
        await page.click(menu.newGame);
        await page.click(confirmDialog.confirm);
        await game.confirmGoal({ goal: "CONQUEST" });
        await game.selectTerritory("Germany");
        await page.click(phaseBar.confirm);
        await page.waitForFunction(() => window.__game && window.__game.isReady(),
            null, { timeout: 120_000 });
        expect((await page.evaluate(() => window.__game.victoryCondition())).kind)
            .toBe("CONQUEST");

        await page.evaluate((c) => window.__game.loadCode(c), code);
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase",
            { timeout: 120_000 });

        const after = await page.evaluate(() => window.__game.victoryCondition());
        expect(after.kind).toBe("DOMINATION");
        expect(after.landShare).toBeCloseTo(before.landShare, 5);
    });

    test("a Great Powers game restores the five names it was started with", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({
            country: "Germany",
            seed: "goal-save-powers",
            goal: "GREAT_POWERS",
            scale: "Any 3 of the five"
        });

        const before = await page.evaluate(() => window.__game.victoryCondition());
        expect(before.greatPowers.length).toBeGreaterThan(0);
        const code = await page.evaluate(() => window.__game.saveCode());

        await page.evaluate((c) => window.__game.loadCode(c), code);
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase",
            { timeout: 120_000 });

        const after = await page.evaluate(() => window.__game.victoryCondition());
        expect(after.kind).toBe("GREAT_POWERS");
        expect(after.greatPowersRequired).toBe(3);
        // The names, not merely a list of the right length -- an empty one is what made a
        // Great Powers game read "0 of 0" and be unwinnable.
        expect(after.greatPowers).toEqual(before.greatPowers);
    });

    test("the progress line is right on the first frame of a loaded game", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({
            country: "Germany",
            seed: "goal-save-line",
            goal: "CONQUEST"
        });
        // A save taken on turn 1 and restored over a fresh game at turn 1 changes no turn
        // and so emits no TURN_CHANGED -- which is exactly why `resumeSavedGame()` calls
        // `refreshGoalLine()` as an ADDRESSED write rather than relying on the event.
        const code = await page.evaluate(() => window.__game.saveCode());

        await page.evaluate((c) => window.__game.loadCode(c), code);
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase",
            { timeout: 120_000 });

        const label = await page.evaluate(() => window.__game.victoryProgressFor().label);
        await expect(page.locator(phaseBar.goal)).toHaveText(label);
        expect(label).toContain("Conquest");
    });

    test("Resume from a stored save comes back to the same goal", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({
            country: "Germany",
            seed: "goal-resume",
            goal: "TURN_LIMIT",
            scale: "350 turns"
        });
        await page.evaluate(() => window.__game.saveNow());

        await game.open({ seed: "goal-resume" });
        await page.click(menu.resume);
        await expect(page.locator(containers.menu)).toBeHidden({ timeout: 120_000 });
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase",
            { timeout: 120_000 });

        const after = await page.evaluate(() => window.__game.victoryCondition());
        expect(after.kind).toBe("TURN_LIMIT");
        expect(after.turnLimit).toBe(350);
    });
});
