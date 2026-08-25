import { test, expect } from "../../support/fixtures.js";
import { cls, sel } from "../../support/selectors.js";

// The controls Phase 7.11 stopped shipping as images.
//
// Twelve PNGs went: plus, minus and the step multiplier (each with a `Grey.png`
// twin), and the Upgrade and Buy buttons (each with an idle, a pressed and a
// greyed-out plate). Two things were wrong with all of them and this spec pins
// both.
//
// **The image WAS the state.** There was no other record of whether a control
// was live, so eleven sites across four files asked
// `button.src.includes("Grey.png")` -- answering a question about game rules by
// reading a file path. A typo there does not throw; it silently makes a disabled
// button clickable and lets the player overdraw.
//
// **A PNG cannot take a theme.** `src/ui/theme/` recolours by writing tokens
// onto the root element, and a picture of a grey plus sign is a picture of a
// grey plus sign in all six themes.
//
// docs/04-e2e-test-plan.md -- new functional area, `ui-layout/`.

/** Every `<img>` inside a container, by src. */
async function imagesIn(page, selector) {
    return page
        .locator(`${selector} img`)
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("src")));
}

test.describe("the spinner controls are drawn, not downloaded", () => {
    test("the upgrade window's plus and minus are buttons carrying an SVG", async ({
        startedGame: game,
        page,
    }) => {
        await game.openUpgrade("Germany");

        const row = page.locator(cls.upgradeRow).first();
        const plus = row.locator(`${cls.upgradePlus} ${cls.stepperButton}`);
        const minus = row.locator(`${cls.minusColumn} ${cls.stepperButton}`);

        await expect(plus).toHaveCount(1);
        await expect(minus).toHaveCount(1);

        for (const control of [plus, minus]) {
            expect(await control.evaluate((n) => n.tagName)).toBe("BUTTON");
            await expect(control.locator("svg")).toHaveCount(1);
        }
    });

    test("the buy window adds a step multiplier, and it is a button too", async ({
        startedGame: game,
        page,
    }) => {
        await game.openBuy("Germany");

        const row = page.locator(cls.buyRow).first();
        const cycler = row.locator(`${cls.buyMultiplier} ${cls.stepperButton}`);

        await expect(cycler).toHaveCount(1);
        expect(await cycler.evaluate((n) => n.tagName)).toBe("BUTTON");
        await expect(cycler.locator("svg")).toHaveCount(1);
    });

    test("neither window ships a plus, minus or multiplier PNG any more", async ({
        startedGame: game,
        page,
    }) => {
        await game.openUpgrade("Germany");
        const upgradeImages = await imagesIn(page, sel.upgradeContainer);
        await game.upgradeWindow.close();

        await game.openBuy("Germany");
        const buyImages = await imagesIn(page, sel.buyContainer);

        const retired = /plusButton|minusButton|multipleIncrementerButton|upgradeButtonIcon|buyButtonIcon/;
        expect(upgradeImages.filter((src) => retired.test(src))).toEqual([]);
        expect(buyImages.filter((src) => retired.test(src))).toEqual([]);
    });

    test("the artwork PNGs the brief asked to keep are still there", async ({
        startedGame: game,
        page,
    }) => {
        // The other half of the change. A sweep that took the farm and the tank
        // with it would pass every assertion above and be plainly wrong.
        await game.openUpgrade("Germany");
        const upgradeImages = await imagesIn(page, sel.upgradeContainer);
        expect(upgradeImages.some((src) => /farmIcon/.test(src))).toBe(true);
        expect(upgradeImages.some((src) => /fortIcon/.test(src))).toBe(true);
        expect(upgradeImages.some((src) => /gold\.png/.test(src))).toBe(true);
        await game.upgradeWindow.close();

        await game.openBuy("Germany");
        const buyImages = await imagesIn(page, sel.buyContainer);
        expect(buyImages.some((src) => /infantryIcon/.test(src))).toBe(true);
        expect(buyImages.some((src) => /navalIcon/.test(src))).toBe(true);
    });
});

test.describe("disabled is a state on the element", () => {
    test("a stepper that cannot be used says so in aria-disabled", async ({
        startedGame: game,
        page,
    }) => {
        await game.openBuy("Germany");

        // Every purchase row starts live for a country that can afford one of
        // something, so the interesting assertion is that the attribute EXISTS
        // and is answerable -- the old build had nowhere to put it.
        const states = await page
            .locator(`${cls.buyRow} ${cls.buyPlus} ${cls.stepperButton}`)
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-disabled")));

        expect(states.length).toBeGreaterThan(0);
        for (const state of states) {
            expect(["true", "false"]).toContain(state);
        }
    });

    test("spending to the limit greys the plus button, and stepping back down restores it", async ({
        startedGame: game,
    }) => {
        // The greying passes reach the plus button through
        // `.column5C .stepper-button`. If that selector goes stale the call
        // silently does nothing and the player overdraws -- which is exactly the
        // failure a file-path check could never catch either.
        //
        // A FORT, in the upgrade window, because upgrade costs are quadratic:
        // Germany runs out of gold within a handful of clicks and the row greys
        // for certain. `upgrade-territory/insufficient-resources.spec.js` pins the
        // same fixture for the same reason.
        await game.openUpgrade("Germany");
        expect(await game.upgradeWindow.rowGreyedOut("fort")).toBe(false);

        await game.upgradeWindow.plus("fort", 10);
        expect(await game.upgradeWindow.rowGreyedOut("fort")).toBe(true);

        await game.upgradeWindow.minus("fort");
        expect(await game.upgradeWindow.rowGreyedOut("fort")).toBe(false);
    });

    test("a greyed stepper still receives the click and simply does nothing", async ({
        startedGame: game,
    }) => {
        // Deliberate: these are NOT given the `disabled` property, because the
        // greyed PNGs still received clicks and handlers do other work on the way
        // past. If someone "tidies" that to a real `disabled`, the click below
        // starts throwing rather than being ignored.
        await game.openUpgrade("Germany");

        await game.upgradeWindow.plus("fort", 10);
        expect(await game.upgradeWindow.rowGreyedOut("fort")).toBe(true);
        const atLimit = await game.upgradeWindow.quantity("fort");

        await game.upgradeWindow.plus("fort");
        expect(await game.upgradeWindow.quantity("fort")).toBe(atLimit);
    });
});

test.describe("the territory-row action buttons", () => {
    test("are buttons with an icon and a word, and are present whether or not they work", async ({
        startedGame: game,
        page,
    }) => {
        await game.infoTable.open();
        await game.infoTable.showTerritories();

        const button = page.locator(`${cls.uiTableRowHoverable} ${cls.actionButton}`).first();
        await expect(button).toHaveCount(1);
        expect(await button.evaluate((n) => n.tagName)).toBe("BUTTON");
        await expect(button.locator("svg")).toHaveCount(1);
        await expect(button).toContainText(/UPGRADE/i);
    });

    test("stay in the row when the phase makes them inert, and say so", async ({
        startedGame: game,
        page,
    }) => {
        // Before Phase 7.11 the `.upgrade-button` class was ADDED only when the
        // button worked, so the column changed width as the phase turned over.
        await game.infoTable.open();
        expect(await game.infoTable.upgradeButtonEnabled("Germany")).toBe(true);

        await game.endBuyPhase();
        await game.infoTable.open();

        expect(await game.infoTable.upgradeButtonEnabled("Germany")).toBe(false);
        await expect(
            page.locator(`${cls.uiTableRowHoverable} ${cls.actionButton}`).first()
        ).toHaveCount(1);
    });
});

test.describe("a theme reaches the drawn controls", () => {
    // A theme is applied by writing its tokens onto the root element as inline
    // custom properties -- that is the whole mechanism, and `theme.js` does
    // nothing else. So the faithful test of "does a theme reach this control" is
    // to move one token and see whether the control follows. Which is a thing no
    // PNG has ever done, and the reason these were redrawn.
    //
    // `options/theme-picker.spec.js` owns the picker itself.
    // Polled, not read once. Both control families carry a `transition` on the
    // property being moved, so the first read after the write is the START of the
    // animation -- the old value -- and a straight assertion fails on a change
    // that is in fact working perfectly.
    async function expectFollowsAccent(page, locator, property) {
        const read = () => locator.evaluate((n, p) => getComputedStyle(n)[p], property);
        expect(await read()).not.toBe("rgb(1, 2, 3)");

        await page.evaluate(() =>
            document.documentElement.style.setProperty("--accent", "rgb(1, 2, 3)")
        );
        await expect.poll(read).toBe("rgb(1, 2, 3)");

        await page.evaluate(() => document.documentElement.style.removeProperty("--accent"));
    }

    test("moving the accent token repaints the upgrade window's steppers", async ({
        startedGame: game,
        page,
    }) => {
        await game.openUpgrade("Germany");
        const plus = page
            .locator(`${cls.upgradeRow} ${cls.upgradePlus} ${cls.stepperButton}`)
            .first();

        await expectFollowsAccent(page, plus, "color");
    });

    test("moving the accent token repaints the territory-row action button", async ({
        startedGame: game,
        page,
    }) => {
        await game.infoTable.open();
        await game.infoTable.showTerritories();
        const button = page.locator(`${cls.uiTableRowHoverable} ${cls.actionButton}`).first();

        await expectFollowsAccent(page, button, "backgroundColor");
    });
});
