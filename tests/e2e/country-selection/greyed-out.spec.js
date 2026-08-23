import { test, expect } from "../../support/fixtures.js";
import { phaseBar } from "../../support/selectors.js";

// A country too strong to play is supposed to be greyed out and unselectable.
//
// 🔴 IT IS NOT. calculateTerritoryStrengths() min-max normalises every country
// into 0..10000, and greyOutTerritoriesForUnselectableCountries() greys anything
// over COUNTRY_GREYOUT_THRESHOLD = 40000 -- a bound nothing can reach. No country
// is ever greyed out, and the player can start as the United States.
//
// See docs/01-codebase-audit.md section 5.2 Z. The three specs below are the
// characterisation of the intended behaviour and are `test.fixme` until Phase 3
// re-scales the threshold; the fourth records what the game does today, so the
// suite is not silent about it in the meantime.
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
    test.fixme("show no confirm button when clicked", async ({ game, page }) => {
        await game.open();
        await game.newGame();

        const greyedTerritory = await firstTerritoryWhere(page, true);
        expect(greyedTerritory, "no country was greyed out at all").not.toBeNull();

        await game.selectTerritory(greyedTerritory);

        await expect(page.locator(phaseBar.confirm)).toBeHidden();
    });

    test.fixme("clicking a greyed country after a playable one withdraws the offer", async ({
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

    test.fixme("keep the strongest countries out of reach", async ({ game, page }) => {
        // The United States is the top of the strength table, so if the gate works
        // at all it must catch this one.
        await game.open();
        await game.newGame();
        expect(await game.map.attribute("United States", "greyedOut")).toBe("true");
    });

    test("today: nothing is greyed out, so every country is selectable", async ({ game, page }) => {
        // Characterisation of the defect itself, so the suite states the current
        // behaviour rather than staying quiet about it. When Phase 3 fixes the
        // threshold this spec fails, which is the signal to delete it and un-fixme
        // the three above.
        await game.open();
        await game.newGame();

        const counts = await game.map.attributeCounts("greyedOut");
        expect(counts.true ?? 0, "audit 5.2 Z -- the strength gate is unreachable").toBe(0);

        await game.selectTerritory("United States");
        await expect(page.locator(phaseBar.confirm)).toBeVisible();
        await expect(page.locator(phaseBar.body)).toHaveText("United States");
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
