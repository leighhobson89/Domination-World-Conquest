import { test, expect } from "../../support/fixtures.js";
import { map } from "../../support/selectors.js";

// The continent-view button: one control, three views (Phase 7.4).
// docs/04-e2e-test-plan.md section 5.4.
//
//     normal     political map, no continent boundaries
//     physical   relief map + continent boundaries
//     continent  political map + continent boundaries
//
// The button used to be two PNG buttons and the assertions named the file each
// was showing. There is no `src` any more -- the icons are inline SVG -- so the
// view is read from `data-view`, which is also what the CSS picks the icon by.

test.describe("continent view", () => {
    /** The stroke of the first coast-line path, which is a continent boundary. */
    const strokeOf = (page) =>
        page.evaluate(() => {
            const doc = document.getElementById("svg-coast-lines").contentDocument;
            return doc.querySelector("path").style.stroke;
        });

    test("starts on the political map with no continent boundaries", async ({
        startedGame: game,
        page,
    }) => {
        await expect(page.locator(map.continentViewButton)).toHaveAttribute("data-view", "normal");
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
    });

    test("first click brings up the relief map and the continent boundaries", async ({
        startedGame: game,
        page,
    }) => {
        const strokeBefore = await strokeOf(page);
        const politicalFill = await game.map.fill("France");

        await game.map.cycleContinentView();

        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "physical"
        );
        // The relief map drops the territory fills to near-transparent and paints
        // the coast-line layer by continent instead.
        const opacity = await game.map.attribute("France", "fill-opacity");
        expect(Number(opacity)).toBeLessThan(0.5);
        expect(politicalFill).toBeTruthy();
        // ...and the boundaries come up with it, which is the half that used to be
        // a separate button.
        expect(await strokeOf(page)).not.toBe(strokeBefore);
    });

    test("keeps the player's territories visible on the relief map", async ({
        startedGame: game,
    }) => {
        await game.map.cycleContinentView();

        // Player territories keep the player colour at half opacity, so the player
        // can still see their own empire on the physical map.
        const opacity = Number(await game.map.attribute("Germany", "fill-opacity"));
        expect(opacity).toBeCloseTo(0.5, 2);
    });

    test("second click drops the relief and keeps the boundaries", async ({
        startedGame: game,
        page,
    }) => {
        const strokeBefore = await strokeOf(page);
        const fillBefore = await game.map.fill("France");

        await game.map.cycleContinentView();
        await game.map.cycleContinentView();

        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "continent"
        );
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
        expect(await game.map.fill("France")).toBe(fillBefore);
        expect(await strokeOf(page)).not.toBe(strokeBefore);
    });

    test("third click returns to the plain political map", async ({ startedGame: game, page }) => {
        const strokeBefore = await strokeOf(page);
        const fillBefore = await game.map.fill("France");

        await game.map.cycleContinentView();
        await game.map.cycleContinentView();
        await game.map.cycleContinentView();

        await expect(page.locator(map.continentViewButton)).toHaveAttribute("data-view", "normal");
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
        expect(await game.map.fill("France")).toBe(fillBefore);
        expect(await strokeOf(page)).toBe(strokeBefore);
    });

    test("clicking the map leaves the relief behind and keeps the boundaries", async ({
        startedGame: game,
        page,
    }) => {
        await game.map.cycleContinentView();
        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "physical"
        );

        await game.map.click("France");

        // A territory has to be legible to be clicked on, so the relief goes -- but
        // the player did not ask for the boundaries to go with it, and they do not.
        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "continent"
        );
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
    });
});
