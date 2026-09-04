import { test, expect } from "../../support/fixtures.js";
import { containers, phaseBar } from "../../support/selectors.js";

// New Game through to a country being picked.
// docs/03-e2e-test-plan.md section 5.2.


test.describe("new game", () => {
    test("hides the menu and shows the country-selection popup", async ({ game, page }) => {
        await game.open();
        await expect(page.locator(containers.menu)).toBeVisible();

        await game.newGame();

        await expect(page.locator(containers.menu)).toBeHidden();
        await expect(page.locator(phaseBar.title)).toHaveText("Select a Country...");
        await expect(page.locator(containers.bottomTable)).toBeVisible();
    });

    test("greys out the countries that are too strong to play", async ({ game, page }) => {
        // audit 5.2 Z, fixed in refactor Phase 3 -- see
        // tests/e2e/country-selection/greyed-out.spec.js.
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

    test("keeps the greyedOut attribute and the store's lock set in agreement", async ({
        game,
        page,
    }) => {
        // This used to compare the attribute against the FILL, because selectCountry()
        // decided whether to offer the confirm button by reading the fill. That is what
        // made the lock bypassable through the colour picker, and Phase 5.8 moved the gate
        // onto the store -- so the honest pairing now is attribute against store, and the
        // fill is free to be a muted country colour rather than one flat grey.
        // The lock's own behaviour is pinned in locked-countries.spec.js.
        await game.open();
        await game.newGame();

        const locked = await page.evaluate(() => window.__game.greyedOutCountries());
        expect(locked.length).toBeGreaterThan(0);

        const mismatched = await page.evaluate((lockedCountries) => {
            const doc = document.getElementById("svg-map").contentDocument;
            return [...doc.querySelectorAll("path[uniqueid]")]
                .filter(
                    (p) =>
                        (p.getAttribute("greyedOut") === "true") !==
                        lockedCountries.includes(p.getAttribute("data-name"))
                )
                .map((p) => p.getAttribute("territory-name"))
                .slice(0, 10);
        }, locked);
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
