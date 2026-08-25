import { test, expect } from "../../support/fixtures.js";
import { containers, sel } from "../../support/selectors.js";

// The phase bar's shape: where the advance button sits, and what folding the bar
// away does to it.
//
// Phase 7.4. Two things changed and one of them is a rule, not a preference.
//
// The bar used to be `height: 40%` with `justify-content: center`, so four items
// were centred in a box a third taller than they needed and there was an empty
// row under the button. Its height comes from its content now.
//
// The rule: **the advance button must not move when the bar folds.** It is the
// one control a player reaches for every single turn, and a control that walks up
// the screen when something unrelated is toggled is worse than no toggle at all.
// That is what makes the bar collapse DOWNWARDS -- it is anchored by its bottom
// edge, so the rows above the button are the ones that travel.
//
// docs/04-e2e-test-plan.md -- `ui-layout/`.

const PHASE_BAR = ".popup-with-confirm-container";

async function geometry(page) {
    return page.evaluate((barSelector) => {
        const bar = document.querySelector(barSelector);
        const button = document.getElementById("popup-confirm");
        const barBox = bar.getBoundingClientRect();
        const buttonBox = button.getBoundingClientRect();
        return {
            barTop: Math.round(barBox.top),
            barBottom: Math.round(barBox.bottom),
            barHeight: Math.round(barBox.height),
            buttonBottom: Math.round(buttonBox.bottom),
            gapUnderButton: Math.round(barBox.bottom - buttonBox.bottom),
            collapsed: bar.classList.contains("is-collapsed"),
        };
    }, PHASE_BAR);
}

test.describe("the advance button sits at the bottom", () => {
    test("with no spare row under it", async ({ startedGame: game, page }) => {
        // 10px of the container's own padding, and nothing else. It used to be a
        // whole empty row: `height: 40%` over four centred children.
        const { gapUnderButton } = await geometry(page);
        expect(gapUnderButton).toBeLessThanOrEqual(14);
    });

    test("and the bar is no taller than what is in it", async ({ startedGame: game, page }) => {
        const { barHeight } = await geometry(page);
        const viewport = page.viewportSize();
        expect(barHeight).toBeLessThan(viewport.height * 0.32);
    });
});

test.describe("collapsing", () => {
    test("folds the colour label and the flag away, and leaves the phase and the button", async ({
        startedGame: game,
        page,
    }) => {
        await expect(page.locator(sel.phaseBarCollapsible)).toBeVisible();

        await page.click(sel.phaseBarCollapseButton);
        await expect(page.locator(sel.phaseBarCollapsible)).not.toBeVisible();

        // The two that stay are the turn loop; the two that fold are about the country.
        await expect(page.locator(sel.popupTitle)).toBeVisible();
        await expect(page.locator(sel.popupConfirm)).toBeVisible();
        await expect(page.locator(sel.phaseBarCollapseButton)).toBeVisible();
    });

    test("does not move the advance button by a single pixel", async ({
        startedGame: game,
        page,
    }) => {
        const open = await geometry(page);

        await page.click(sel.phaseBarCollapseButton);
        await expect(page.locator(sel.phaseBarCollapsible)).not.toBeVisible();
        const shut = await geometry(page);

        expect(shut.buttonBottom).toBe(open.buttonBottom);
        expect(shut.barBottom).toBe(open.barBottom);
        // It got shorter from the TOP, which is the whole mechanism.
        expect(shut.barHeight).toBeLessThan(open.barHeight);
        expect(shut.barTop).toBeGreaterThan(open.barTop);
    });

    test("expands again to exactly what it was", async ({ startedGame: game, page }) => {
        const open = await geometry(page);

        await page.click(sel.phaseBarCollapseButton);
        await expect(page.locator(sel.phaseBarCollapsible)).not.toBeVisible();
        await page.click(sel.phaseBarCollapseButton);
        await expect(page.locator(sel.phaseBarCollapsible)).toBeVisible();

        // Polled: the fold is a `max-height` transition, and `toBeVisible()` is
        // satisfied the moment the box is non-empty -- which is 2px into a 280ms
        // slide. Measuring there compares a height against itself mid-animation.
        await expect.poll(async () => (await geometry(page)).barHeight).toBe(open.barHeight);
        expect((await geometry(page)).buttonBottom).toBe(open.buttonBottom);
    });

    test("shows the player's flag whenever it is expanded", async ({
        startedGame: game,
        page,
    }) => {
        // The flag row is `height: 11vh` and not a percentage of the bar. It WAS a
        // percentage -- forty per cent of a bar that was itself forty per cent of the
        // viewport -- and a percentage against an `auto` parent resolves to `auto`, so
        // the moment the bar started sizing itself the flag became a four-pixel stripe.
        const flag = page.locator(sel.popupBody);
        await expect(flag).toBeVisible();
        const height = await flag.evaluate((el) => el.getBoundingClientRect().height);
        expect(height).toBeGreaterThan(60);
    });

    test("the control says which way it will go", async ({ startedGame: game, page }) => {
        const button = page.locator(sel.phaseBarCollapseButton);
        await expect(button).toHaveAttribute("aria-expanded", "true");
        await button.click();
        await expect(button).toHaveAttribute("aria-expanded", "false");
    });
});

test.describe("stacking", () => {
    test("the bar is below every window, at all times", async ({ startedGame: game, page }) => {
        // It was 9999 -- above the territory panel, above the activity feed, above
        // everything. The bar is furniture the player reads THROUGH.
        await game.infoTable.open();
        await game.activityPanel.open();

        const stacking = await page.evaluate(
            ([barSelector, mainUi, feed]) => ({
                bar: Number(getComputedStyle(document.querySelector(barSelector)).zIndex),
                territory: Number(document.querySelector(mainUi).style.zIndex),
                feed: Number(document.querySelector(feed).style.zIndex),
            }),
            [PHASE_BAR, containers.mainUi, containers.activityPanel]
        );

        expect(stacking.territory).toBeGreaterThan(stacking.bar);
        expect(stacking.feed).toBeGreaterThan(stacking.bar);
    });

    test("the colour picker still sits directly above the bar", async ({ game, page }) => {
        // The picker used to be positioned with `calc(8% + 40% + 10px)` -- the bar's
        // `bottom` plus its `height` -- which stopped being expressible the moment the
        // bar's height became its content. It measures now.
        //
        // On the SELECTION screen, because that is the only place the picker opens
        // from and the bar is at its tallest there.
        await game.open();
        await game.newGame();
        await game.selectTerritory("Germany");
        await page.click(sel.popupColor);

        const picker = await page.locator(sel.colourPickerContainer).boundingBox();
        const bar = await page.locator(PHASE_BAR).boundingBox();
        expect(picker.y + picker.height).toBeLessThanOrEqual(bar.y + 2);
        expect(picker.y + picker.height).toBeGreaterThan(bar.y - 40);
    });
});
