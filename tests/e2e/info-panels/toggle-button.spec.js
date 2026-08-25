import { test, expect } from "../../support/fixtures.js";
import { containers, infoTable } from "../../support/selectors.js";

// The globe button that opens the territory panel, and now also closes it.
//
// It used to be hidden the moment the panel opened, which made it a one-way door:
// the only way back out was the X in the panel's own corner, and the button the
// player had just pressed had vanished from under the pointer. `toggleUIMenu()`
// keeps it up now, and its click handler already asked whether the panel was open --
// so the same button is both halves of the toggle.
//
// The thing that makes it more than a `display` change is the stacking. The panel is
// `position: fixed` and fills most of the screen; the button's container sits at
// z-index 9000, above it. A button that is present but underneath is worse than one
// that is hidden, because it looks available and does nothing -- so the test clicks
// it rather than merely asserting it is visible.
//
// docs/04-e2e-test-plan.md -- `info-panels/`.

test.describe("territory panel toggle button", () => {
    test.setTimeout(180_000);

    test("the globe opens the panel and then closes it", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "ui-toggle" });
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await page.click(infoTable.toggle);
        await expect(page.locator(containers.mainUi)).toBeVisible();

        // Still there, and still on top of the panel it just opened.
        await expect(page.locator(infoTable.toggle)).toBeVisible();
        await page.click(infoTable.toggle);
        await expect(page.locator(containers.mainUi)).toBeHidden();
    });

    test("the X still closes the panel too", async ({ game, page }) => {
        // The second door was the only one; it must not have been traded away for the
        // first.
        await game.start({ country: "Germany", seed: "ui-toggle-x" });
        await page.click(infoTable.toggle);
        await expect(page.locator(containers.mainUi)).toBeVisible();

        await page.click(infoTable.close);
        await expect(page.locator(containers.mainUi)).toBeHidden();
    });

    test("opening from the globe lands on the Summary tab", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "ui-toggle-tab" });
        await page.click(infoTable.toggle);

        await expect(page.locator(infoTable.summaryTab)).toHaveClass(/active/);
    });
});
