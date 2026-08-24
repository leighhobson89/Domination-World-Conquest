import { test, expect } from "../../support/fixtures.js";
import { phaseBar } from "../../support/selectors.js";

// A country too strong to play is greyed out and unselectable.
//
// It used not to be: calculateTerritoryStrengths() min-max normalises every country
// into 0..10000, and greyOutTerritoriesForUnselectableCountries() greyed anything
// over COUNTRY_GREYOUT_THRESHOLD = 40000 -- a bound nothing could reach, so no
// country was ever greyed out and the player could start as the United States.
//
// Fixed in refactor Phase 3: the gate is now a RANK, COUNTRY_GREYOUT_RANK, because
// the intent ("the top few countries are too strong") is a rank and not a magnitude
// on whatever scale the normaliser happens to produce. See
// docs/01-codebase-audit.md section 5.2 Z.
//
// docs/04-e2e-test-plan.md section 5.2.

/** The name of the first territory whose country is greyed out / playable. */
async function firstTerritoryWhere(page, greyed) {
    return page.evaluate((wantGreyed) => {
        const doc = document.getElementById("svg-map").contentDocument;
        const match = [...doc.querySelectorAll("path[uniqueid]")].find(
            (p) => (p.getAttribute("greyedOut") === "true") === wantGreyed
        );
        return match ? match.getAttribute("territory-name") : null;
    }, greyed);
}

test.describe("greyed-out countries", () => {
    test("show no confirm button when clicked", async ({ game, page }) => {
        await game.open();
        await game.newGame();

        const greyedTerritory = await firstTerritoryWhere(page, true);
        expect(greyedTerritory, "no country was greyed out at all").not.toBeNull();

        await game.selectTerritory(greyedTerritory);

        await expect(page.locator(phaseBar.confirm)).toBeHidden();
    });

    test("clicking a greyed country after a playable one withdraws the offer", async ({
        game,
        page,
    }) => {
        await game.open();
        await game.newGame();

        await game.selectTerritory("Germany");
        await expect(page.locator(phaseBar.confirm)).toBeVisible();

        const greyedTerritory = await firstTerritoryWhere(page, true);
        await game.selectTerritory(greyedTerritory);
        await expect(page.locator(phaseBar.confirm)).toBeHidden();
    });

    test("keep the strongest countries out of reach", async ({ game, page }) => {
        // The United States is the top of the strength table, so if the gate works
        // at all it must catch this one.
        await game.open();
        await game.newGame();
        expect(await game.map.attribute("United States", "greyedOut")).toBe("true");
    });

        test("a selectable country names itself in the popup and offers confirm", async ({
        game,
        page,
    }) => {
        await game.open();
        await game.newGame();

        const playable = await firstTerritoryWhere(page, false);
        expect(playable).not.toBeNull();

        const expectedCountry = await game.map.attribute(playable, "data-name");
        await game.selectTerritory(playable);

        await expect(page.locator(phaseBar.body)).toHaveText(expectedCountry);
        await expect(page.locator(phaseBar.confirm)).toBeVisible();
        await expect(page.locator(phaseBar.confirm)).toHaveClass(/greenBackground/);
    });
});
