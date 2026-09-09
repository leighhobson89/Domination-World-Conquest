// A map view is a mode the player chose, and only the view button takes it away.
// docs/02-e2e-test-plan.md section 5.4.
//
// Two defects, reported one after the other, and they turned out to be one rule and one bug.
//
// **The bug**: dragging the relief map dropped it back to the political map on release. The
// click that ends a pan reached the handler that leaves the relief, and the `if (!isDragging())`
// guard sitting right below could not stop it -- `mouseup` fires before `click` and is where the
// drag flag is cleared, so inside a click handler that test is *always* true. Every "not while
// dragging" guard in that handler was dead for the same reason.
//
// **The rule**: clicking a territory left the relief map on purpose, on the reasoning that a
// territory has to be readable to be clicked. Leigh overruled it -- *"if there is a rule to
// leave the physical map on click then get rid of it, that is not desired behaviour"*.
//
// Both are asserted here because neither has any signature except a player watching the map
// change under them: nothing throws, and every other spec in this area passes either way.

import { test, expect } from "../../support/fixtures.js";

test.describe("map views persist", () => {
    test("survive a drag of the map", async ({ startedGame: game, page }) => {
        await game.map.setContinentView("physical");
        //Panning does nothing at zoom 1 -- there is no world outside the frame to move to --
        //so the drag has to happen zoomed in, which is also where a player would do it.
        await game.map.zoom(-400, { steps: 3 });
        expect(await game.map.continentView()).toBe("physical");

        const box = await page.locator("#svg-map").boundingBox();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.45, { steps: 8 });
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4, { steps: 8 });
        await page.mouse.up();

        expect(await game.map.continentView()).toBe("physical");
    });

    test("survive a click on a territory, zoomed out and zoomed in", async ({
        startedGame: game,
        page,
    }) => {
        await game.map.setContinentView("physical");

        await game.map.click("France");
        expect(await game.map.continentView()).toBe("physical");

        await game.map.zoom(-400, { steps: 3 });
        await game.map.click("France");
        expect(await game.map.continentView()).toBe("physical");
    });

    test("survive a click on the sea", async ({ startedGame: game, page }) => {
        //Clicking away from the land is how a player deselects, and it goes through the same
        //handler -- it used to clear the relief too.
        await game.map.setContinentView("physical");

        const box = await page.locator("#svg-map").boundingBox();
        await page.mouse.click(box.x + 12, box.y + box.height - 12);

        expect(await game.map.continentView()).toBe("physical");
    });

    test("still let a small movement during a click count as a click", async ({
        startedGame: game,
        page,
    }) => {
        //THE OTHER HALF OF THE DRAG FIX. Suppressing the click after a pan must not suppress
        //the click of somebody with an ordinary unsteady hand, so the test is a few pixels of
        //travel rather than any travel at all. Selecting a territory is what proves the click
        //was delivered.
        await game.map.setContinentView("normal");
        await game.map.zoom(-400, { steps: 3 });

        const france = await game.map.territory("France").boundingBox();
        await page.mouse.move(france.x + france.width / 2, france.y + france.height / 2);
        await page.mouse.down();
        await page.mouse.move(france.x + france.width / 2 + 2, france.y + france.height / 2 + 1);
        await page.mouse.up();

        await expect.poll(async () => await game.bottomTable.territoryName()).toBe("France");
    });
});
