import { test, expect } from "../../support/fixtures.js";
import { GameDriver } from "../../support/game.js";
import { goalSelect, menu, phaseBar } from "../../support/selectors.js";

// What the chooser DOES with the five goals: each has its own description, each has its own
// scale list, and the pair the player leaves the screen with is the pair the game is played
// under.
//
// No assertion here is about wording. `tests/unit/ui-goal-catalogue.spec.js` owns the
// catalogue's content and its shape, in Node, where it is cheap -- what a browser is needed
// for is that the panel re-renders when the dropdown changes and that Confirm builds the
// right CONDITION, which is the one mistake in this area that would be silent.

/** The five kinds, in the order `allGoals()` lists them. */
const KINDS = ["CONTINENTAL", "DOMINATION", "GREAT_POWERS", "CONQUEST", "TURN_LIMIT"];

async function openChooser(page) {
    const game = new GameDriver(page);
    await game.open();
    await page.click(menu.newGame);
    await expect(page.locator(goalSelect.panel)).toBeVisible();
    return game;
}

/** The scale dropdown's option labels, in order. */
function scaleLabels(page) {
    return page.locator(goalSelect.scale).evaluate((select) =>
        [...select.options].map((option) => option.textContent));
}

test.describe("the five goals", () => {
    test("the dropdown offers exactly the five goals", async ({ page }) => {
        await openChooser(page);
        const kinds = await page.locator(goalSelect.kind).evaluate((select) =>
            [...select.options].map((option) => option.value));
        expect(kinds).toEqual(KINDS);
    });

    test("each goal shows its own summary and description", async ({ page }) => {
        await openChooser(page);

        const seenSummaries = new Set();
        for (const kind of KINDS) {
            await page.selectOption(goalSelect.kind, kind);
            const summary = (await page.locator(goalSelect.summary).textContent())?.trim() ?? "";
            expect(summary.length, `${kind} should summarise itself`).toBeGreaterThan(0);
            expect(seenSummaries.has(summary), `${kind} repeats another goal's summary`)
                .toBe(false);
            seenSummaries.add(summary);

            // The body is blocks, never markup -- so "it rendered" is "there are elements
            // in the description pane", not a string match.
            const blocks = await page.locator(`${goalSelect.description} > *`).count();
            expect(blocks, `${kind} should have a description body`).toBeGreaterThan(0);
        }
    });

    test("the scale list changes with the goal", async ({ page }) => {
        await openChooser(page);

        await page.selectOption(goalSelect.kind, "CONTINENTAL");
        const continental = await scaleLabels(page);

        await page.selectOption(goalSelect.kind, "TURN_LIMIT");
        const timed = await scaleLabels(page);

        expect(continental.length).toBeGreaterThan(1);
        expect(timed.length).toBeGreaterThan(1);
        expect(timed).not.toEqual(continental);

        // The label above the dropdown changes with it -- "Continents" and "Turns" are not
        // the same question and a single "Scale" would say neither.
        await page.selectOption(goalSelect.kind, "CONTINENTAL");
        const continentsLabel = await page.locator(goalSelect.scaleLabel).textContent();
        await page.selectOption(goalSelect.kind, "TURN_LIMIT");
        const turnsLabel = await page.locator(goalSelect.scaleLabel).textContent();
        expect(turnsLabel).not.toBe(continentsLabel);
    });

    test("World Conquest keeps the dropdown but has nothing to choose", async ({ page }) => {
        await openChooser(page);
        await page.selectOption(goalSelect.kind, "CONQUEST");

        // The dropdown STAYS -- hiding it would make the panel change shape as the player
        // browses, which reads as a rendering fault on a screen nobody can skip.
        await expect(page.locator(goalSelect.scale)).toBeVisible();
        expect((await scaleLabels(page)).length).toBe(1);
        await expect(page.locator(goalSelect.scale)).toBeDisabled();
    });

    test("Great Powers names the powers, and they are the locked countries", async ({ page }) => {
        await openChooser(page);

        await page.selectOption(goalSelect.kind, "CONTINENTAL");
        await expect(page.locator(goalSelect.powers)).toHaveText("");

        await page.selectOption(goalSelect.kind, "GREAT_POWERS");
        const line = (await page.locator(goalSelect.powers).textContent()) ?? "";
        expect(line.length).toBeGreaterThan(0);

        // The five the selection screen will not let you play as. They have to be the same
        // five, or the goal names one set of countries and the map locks another.
        const locked = await page.evaluate(() => window.__game.greyedOutCountries());
        expect(locked.length).toBeGreaterThan(0);
        for (const country of locked) {
            expect(line, `the powers line should name ${country}`).toContain(country);
        }
    });

    test("the goal and scale confirmed are the condition the game is played under",
        async ({ page }) => {
            const game = new GameDriver(page);
            await game.start({
                country: "Germany",
                seed: "goal-condition",
                goal: "DOMINATION",
                scale: "40% of the world's land"
            });

            const condition = await page.evaluate(() => window.__game.victoryCondition());
            expect(condition.kind).toBe("DOMINATION");
            // The one mistake here that would be SILENT: a share written into
            // `continentsRequired` is a valid condition object that plays as the default
            // game. `conditionFor()` is what stops it, and this is what says so.
            expect(condition.landShare).toBeCloseTo(0.4, 5);
            expect(condition.continentsRequired).not.toBe(0.4);
        });

    test("a Great Powers game carries the five names into the condition", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({
            country: "Germany",
            seed: "goal-powers",
            goal: "GREAT_POWERS",
            scale: "Any 3 of the five"
        });

        const condition = await page.evaluate(() => window.__game.victoryCondition());
        expect(condition.kind).toBe("GREAT_POWERS");
        expect(condition.greatPowersRequired).toBe(3);
        // Frozen at the start of the game, so they survive the lock being cleared the
        // moment a country is chosen -- which is what once made a Great Powers game read
        // "0 of 0" and be unwinnable.
        expect(condition.greatPowers.length).toBeGreaterThan(0);
    });

    test("the progress line on the phase bar describes the chosen goal", async ({ page }) => {
        const game = new GameDriver(page);
        await game.start({ country: "Germany", seed: "goal-line", goal: "CONQUEST" });

        await game.playTurn();
        await game.dismissBlockingPanels();

        // `victoryProgress().label` verbatim, so the player and the countries racing them
        // are reading one number. The wording is the rules layer's, and the unit suite owns
        // it; what matters here is that the line is present and is about THIS goal.
        const line = await page.locator(phaseBar.goal).textContent();
        const label = await page.evaluate(() => window.__game.victoryProgressFor().label);
        expect(line?.trim()).toBe(label.trim());
        expect(label).toContain("Conquest");
    });
});
