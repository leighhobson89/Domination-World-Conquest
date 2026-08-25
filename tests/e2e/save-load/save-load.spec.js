import { test, expect } from "../../support/fixtures.js";
import { GameDriver } from "../../support/game.js";
import { compound, confirmDialog, containers, menu, phaseBar, saveLoad }
    from "../../support/selectors.js";

// Save, load, and the autosave.
//
// Refactor Phase 7.3. `tests/unit/state-snapshot.spec.js` covers the data path --
// what a snapshot contains, what a restore puts back, and the four ways a round trip
// can lose something while appearing to work. None of that needs a browser.
//
// What does need one is everything the snapshot cannot see: that a loaded game is
// WIRED UP. A restore that puts every number back but leaves the phase button
// invisible, the top table showing the abandoned game's gold, or the turn engine
// stopped is a restore that passes every unit test and hands the player a dead
// screen. So the assertions below are deliberately about the screen and the engine,
// not about the store -- the store is already covered.
//
// `window.__game.saveNow()` exists because the autosave interval is sixty seconds.
// Shortening it for the harness would mean testing a timing the game never uses; the
// hook takes the same save through the same code path, and the spinner it raises is
// the one the timer raises.

/** Play a full turn, so a save taken before it is provably different. */
async function playATurn(game) {
    await game.endBuyPhase();
    await game.endTurn();
}

test.describe("the save code", () => {
    test("the panel offers a code as soon as it opens", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "save-load" });

        await page.keyboard.press("Escape");
        await page.click(menu.saveLoad);
        await expect(page.locator(saveLoad.panel)).toBeVisible();

        // Generated on open, not behind a button: the player came here to copy it.
        const code = await page.inputValue(saveLoad.saveField);
        expect(code.startsWith("DWC1:")).toBe(true);
        expect(code.length).toBeGreaterThan(1000);
        await expect(page.locator(saveLoad.status)).toContainText("ready");
    });

    test("a code taken before a turn restores the game to before that turn",
        async ({ page }) => {
            const game = new GameDriver(page);
            await game.start({ country: "Germany", seed: "save-load" });

            await page.keyboard.press("Escape");
            await page.click(menu.saveLoad);
            const code = await page.inputValue(saveLoad.saveField);
            const before = await page.evaluate(() => ({
                turn: window.__game.turn(),
                totals: window.__game.totals(),
                owned: window.__game.territoriesOwnedBy("Player").length,
            }));
            await page.click(saveLoad.close);
            await page.click(menu.resume);

            await playATurn(game);
            expect(await game.turn()).toBeGreaterThan(before.turn);

            await game.withBlockersCleared(() => page.keyboard.press("Escape"));
            await page.click(menu.saveLoad);
            await page.fill(saveLoad.loadField, code);
            await page.click(saveLoad.load);
            // Loading over a live game asks first, exactly as New Game does.
            await page.click(confirmDialog.confirm);

            await expect(page.locator(containers.menu)).toBeHidden({ timeout: 120_000 });
            await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase",
                { timeout: 120_000 });

            const after = await page.evaluate(() => ({
                turn: window.__game.turn(),
                totals: window.__game.totals(),
                owned: window.__game.territoriesOwnedBy("Player").length,
            }));
            expect(after).toEqual(before);
        });

    test("a loaded game is wired up, not just restored", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "save-load" });
        const code = await page.evaluate(() => window.__game.saveCode());

        await page.evaluate((c) => window.__game.loadCode(c), code);
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase",
            { timeout: 120_000 });

        // The phase button: invisible until something makes it so, and a loaded
        // game never passes through the selection screen that used to do it.
        await expect(page.locator(phaseBar.confirm)).toBeVisible();
        await expect(page.locator(menu.hamburger)).toBeVisible();

        // The top table is written, not derived -- nothing repaints it on a state
        // change, so a load that forgets it shows the abandoned game's totals.
        const shownGold = await page.locator(compound.topTableGold).innerText();
        const modelGold = await page.evaluate(() => Math.ceil(window.__game.totals().gold));
        expect(Number(shownGold)).toBe(modelGold);

        // And the engine is running again: the phase advances.
        await game.endBuyPhase();
        await expect(page.locator(phaseBar.title)).toHaveText("Military Phase");
    });

    test("a code that is not ours is refused with a message, not a stack trace",
        async ({ page }) => {
            const game = new GameDriver(page);
            await game.open({ seed: "save-load" });

            await page.click(menu.saveLoad);
            await page.fill(saveLoad.loadField, "definitely not a save code");
            await page.click(saveLoad.load);
            await expect(page.locator(saveLoad.status))
                .toContainText("does not look like a save code");

            // A damaged one of ours says something different, because the player can
            // act on the difference.
            await page.fill(saveLoad.loadField, "DWC1:!!!truncated!!!");
            await page.click(saveLoad.load);
            await expect(page.locator(saveLoad.status)).toContainText("damaged");
        });

    test("an empty box is a prompt, not an error", async ({ page }) => {
        const game = new GameDriver(page);
        await game.open({ seed: "save-load" });
        await page.click(menu.saveLoad);
        await page.click(saveLoad.load);
        await expect(page.locator(saveLoad.status)).toContainText("Paste a save code");
    });
});

test.describe("the autosave", () => {
    test("writes to localStorage and shows the spinner", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "save-load" });

        expect(await page.evaluate(() => window.__game.hasStoredSave())).toBe(false);
        expect(await page.evaluate(() => window.__game.saveNow())).toBe(true);
        expect(await page.evaluate(() => window.__game.hasStoredSave())).toBe(true);

        // Visible immediately, gone after the two-second hold plus the fade.
        await expect(page.locator(saveLoad.indicator)).toHaveClass(/is-visible/);
        await expect(page.locator(saveLoad.indicator)).not.toHaveClass(/is-visible/,
            { timeout: 6000 });
    });

    test("a stored save offers Resume on the next visit, and loads it", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "save-load" });
        await playATurn(game);
        const savedTurn = await game.turn();
        await page.evaluate(() => window.__game.saveNow());

        // A fresh page load, same origin, same localStorage.
        await game.open({ seed: "save-load" });
        const resume = page.locator(menu.resume);
        await expect(resume).toBeEnabled();
        // The label names the turn, so the player knows what they are going back to.
        await expect(resume).toHaveText(`Continue Turn ${savedTurn}`);

        await resume.click();
        await expect(page.locator(containers.menu)).toBeHidden({ timeout: 120_000 });
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase",
            { timeout: 120_000 });
        expect(await game.turn()).toBe(savedTurn);
        expect(await page.evaluate(() => window.__game.territoriesOwnedBy("Player").length))
            .toBeGreaterThan(0);
    });

    test("no stored save means no Resume", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "save-load" });
        await page.evaluate(() => window.__game.clearStoredSave());

        await game.open({ seed: "save-load" });
        await expect(page.locator(menu.resume)).toBeDisabled();
    });
});
