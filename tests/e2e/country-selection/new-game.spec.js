import { test, expect } from "../../support/fixtures.js";
import { containers, phaseBar } from "../../support/selectors.js";

// New Game through to a country being picked.
// docs/04-e2e-test-plan.md section 5.2.

const GREY_OUT_COLOR = "rgb(170,170,170)";

test.describe("new game", () => {
    test("hides the menu and shows the country-selection popup", async ({ game, page }) => {
        await game.open();
        await expect(page.locator(containers.menu)).toBeVisible();

        await game.newGame();

        await expect(page.locator(containers.menu)).toBeHidden();
        await expect(page.locator(phaseBar.title)).toHaveText("Select a Country...");
        await expect(page.locator(containers.bottomTable)).toBeVisible();
    });

    test.fixme("greys out the countries that are too strong to play", async ({ game, page }) => {
        // 🔴 The strength gate can never fire -- see docs/01-codebase-audit.md
        // section 5.2 Z and tests/e2e/country-selection/greyed-out.spec.js.
        // Unskip together with those, in Phase 3.
        await game.open();
        const before = await game.map.attributeCounts("greyedOut");
        expect(before.true ?? 0).toBe(0);

        await game.newGame();

        const after = await game.map.attributeCounts("greyedOut");
        expect(after.true, "some countries should be above the strength threshold").toBeGreaterThan(
            0
        );
        expect(after.false, "and some should still be playable").toBeGreaterThan(0);
    });

    test("keeps the greyedOut attribute and the grey fill in agreement", async ({ game, page }) => {
        // selectCountry() decides whether to offer the confirm button by reading the
        // FILL, while everything else reads the attribute. They must not diverge --
        // and, given audit 5.2 Z, today they agree by both being empty.
        await game.open();
        await game.newGame();

        const mismatched = await page.evaluate((grey) => {
            const doc = document.getElementById("svg-map").contentDocument;
            return [...doc.querySelectorAll("path[uniqueid]")]
                .filter(
                    (p) =>
                        (p.getAttribute("greyedOut") === "true") !==
                        (p.getAttribute("fill") === grey)
                )
                .map((p) => p.getAttribute("territory-name"))
                .slice(0, 10);
        }, GREY_OUT_COLOR);
        expect(mismatched).toEqual([]);
    });

    test("offers the colour picker on the selection screen", async ({ game, page }) => {
        await game.open();
        await game.newGame();
        await game.selectTerritory("Germany");
        await expect(page.locator(phaseBar.colourLabel)).toBeVisible();
    });

    test("keeps the confirm button invisible until a country is picked", async ({ game, page }) => {
        await game.open();
        await game.newGame();

        // The button is present from page build, hidden by `opacity: 0` rather than
        // by display, so Playwright's toBeHidden() would not see it -- opacity is
        // the honest assertion here. Refactor Phase 6.3 gives CountrySelect a real
        // hidden state.
        const opacity = () =>
            page.locator(phaseBar.confirm).evaluate((el) => getComputedStyle(el).opacity);
        expect(await opacity()).toBe("0");

        await game.selectTerritory("Germany");
        expect(await opacity()).toBe("1");
        await expect(page.locator(phaseBar.confirm)).toBeVisible();
    });
});
