import { test, expect } from "../../support/fixtures.js";
import { map } from "../../support/selectors.js";

// The map-view button: one control, four views.
// docs/03-e2e-test-plan.md section 5.4.
//
//     continent  political map + continent boundaries   <- the DEFAULT
//     normal     political map, no continent boundaries
//     military   force shading + threatened borders     <- register item E1
//     physical   relief map + continent boundaries
//
// THE ORDER WAS SWAPPED for the continent-bonus work: `continent` was the last stop and is
// now the first, and it is what a game opens on. A continent is a thing a player wins
// something for holding, and a boundary a player has to go looking for is a boundary they will
// not plan around. **The military view was then put between `normal` and `physical`**, because
// the political map is what it is read against -- who owns what, and then where the force is.
//
// The consequence worth testing, and the one that would break silently, is that the default
// is APPLIED rather than merely declared -- the SVG ships with plain sea-coloured strokes, so
// a game that only set the variable would show the button in one state and the map in
// another. "starts with the continent boundaries drawn" is that assertion.
//
// What the military view itself draws is `military-view.spec.js`; this file is about the
// button and the cycle.
//
// The button used to be two PNG buttons and the assertions named the file each was showing.
// There is no `src` any more -- the icons are inline SVG -- so the view is read from
// `data-view`, which is also what the CSS picks the icon by.

test.describe("map views", () => {
    /** The stroke of the first coast-line path, which is a continent boundary. */
    const strokeOf = (page) =>
        page.evaluate(() => {
            const doc = document.getElementById("svg-coast-lines").contentDocument;
            return doc.querySelector("path").style.stroke;
        });

    test("starts on the political map with the continent boundaries drawn", async ({
        startedGame: game,
        page,
    }) => {
        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "continent"
        );
        // Political, not relief: the territory fills are solid.
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
        // And the boundaries are really on the map, not merely on the button. The plain
        // strokes are one shared colour; a continent boundary is that continent's own.
        expect(await strokeOf(page)).not.toBe("rgb(103, 124, 160)");
    });

    test("first click drops the boundaries and keeps the political colours", async ({
        startedGame: game,
        page,
    }) => {
        const fillBefore = await game.map.fill("France");

        await game.map.cycleContinentView();

        await expect(page.locator(map.continentViewButton)).toHaveAttribute("data-view", "normal");
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
        expect(await game.map.fill("France")).toBe(fillBefore);
        // The plain map: one shared stroke colour across every coast line.
        expect(await strokeOf(page)).toBe("rgb(103, 124, 160)");
    });

    test("the relief map keeps the boundaries", async ({ startedGame: game, page }) => {
        await game.map.setContinentView("physical");

        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "physical"
        );
        // The relief map drops the territory fills to near-transparent and paints
        // the coast-line layer by continent instead.
        const opacity = await game.map.attribute("France", "fill-opacity");
        expect(Number(opacity)).toBeLessThan(0.5);
        // The boundaries stay up -- they are thinner over the relief, but they are there.
        expect(await strokeOf(page)).not.toBe("rgb(103, 124, 160)");
    });

    test("keeps the player's territories visible on the relief map", async ({
        startedGame: game,
    }) => {
        await game.map.setContinentView("physical");

        // Player territories keep the player colour at half opacity, so the player
        // can still see their own empire on the physical map.
        const opacity = Number(await game.map.attribute("Germany", "fill-opacity"));
        expect(opacity).toBeCloseTo(0.5, 2);
    });

    test("a full lap comes back to the continent view it started on", async ({
        startedGame: game,
        page,
    }) => {
        const strokeBefore = await strokeOf(page);
        const fillBefore = await game.map.fill("France");

        await game.map.cycleContinentView();
        await game.map.cycleContinentView();
        await game.map.cycleContinentView();
        await game.map.cycleContinentView();

        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "continent"
        );
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
        expect(await game.map.fill("France")).toBe(fillBefore);
        expect(await strokeOf(page)).toBe(strokeBefore);
    });

    test("clicking the map leaves the relief behind and keeps the boundaries", async ({
        startedGame: game,
        page,
    }) => {
        await game.map.setContinentView("physical");

        await game.map.click("France");

        // A territory has to be legible to be clicked on, so the relief goes -- but
        // the player did not ask for the boundaries to go with it, and they do not.
        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "continent"
        );
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
    });

    test("clicking the map does NOT leave the military view", async ({
        startedGame: game,
        page,
    }) => {
        await game.map.setContinentView("military");

        await game.map.click("Germany");

        // The relief map is left on a click because a territory has to be legible to be
        // clicked on. The military view is the opposite case: it is the view a player is in
        // BECAUSE they are about to reinforce something, so throwing it away on the first
        // selection they make would make it unusable for the one job it has.
        await expect(page.locator(map.continentViewButton)).toHaveAttribute(
            "data-view",
            "military"
        );
    });
});
