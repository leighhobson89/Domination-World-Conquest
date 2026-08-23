import { test, expect } from "../../support/fixtures.js";
import { map } from "../../support/selectors.js";

// Political <-> physical map modes, and the independent continent-stroke toggle.
// docs/04-e2e-test-plan.md section 5.4.

test.describe("map modes", () => {
    test("switches the button art and recolours the territories", async ({
        startedGame: game,
        page,
    }) => {
        await expect(page.locator(map.mapModeButton)).toHaveAttribute("src", /mapMode1\.png$/);
        const politicalFill = await game.map.fill("France");

        await game.map.toggleMapMode();

        await expect(page.locator(map.mapModeButton)).toHaveAttribute("src", /mapMode2\.png$/);
        // Physical mode drops the territory fills to near-transparent and paints
        // the coast-line layer by continent instead.
        const opacity = await game.map.attribute("France", "fill-opacity");
        expect(Number(opacity)).toBeLessThan(0.5);
        expect(politicalFill).toBeTruthy();
    });

    test("keeps the player's territories visible in physical mode", async ({
        startedGame: game,
    }) => {
        await game.map.toggleMapMode();

        // Player territories keep the player colour at half opacity, so the player
        // can still see their own empire on the physical map.
        const opacity = Number(await game.map.attribute("Germany", "fill-opacity"));
        expect(opacity).toBeCloseTo(0.5, 2);
    });

    test("returns to political mode and restores the fills", async ({
        startedGame: game,
        page,
    }) => {
        const before = await game.map.fill("France");

        await game.map.toggleMapMode();
        await game.map.toggleMapMode();

        await expect(page.locator(map.mapModeButton)).toHaveAttribute("src", /mapMode1\.png$/);
        expect(await game.map.attribute("France", "fill-opacity")).toBe("1");
        expect(await game.map.fill("France")).toBe(before);
    });

    test("reverts to political mode when the map is clicked", async ({
        startedGame: game,
        page,
    }) => {
        await game.map.toggleMapMode();
        await expect(page.locator(map.mapModeButton)).toHaveAttribute("src", /mapMode2\.png$/);

        await game.map.click("France");

        await expect(page.locator(map.mapModeButton)).toHaveAttribute("src", /mapMode1\.png$/);
    });

    test("toggles continent strokes independently of the map mode", async ({
        startedGame: game,
        page,
    }) => {
        const strokeOf = () =>
            page.evaluate(() => {
                const doc = document.getElementById("svg-coast-lines").contentDocument;
                const path = doc.querySelector("path");
                return path.style.stroke;
            });

        const before = await strokeOf();
        await game.map.toggleContinentStroke();
        expect(await strokeOf()).not.toBe(before);
        await expect(page.locator(map.strokeHighlightButton)).toHaveAttribute(
            "src",
            /strokeToggle1\.png$/
        );

        await game.map.toggleContinentStroke();
        expect(await strokeOf()).toBe(before);

        // The map mode button is untouched throughout.
        await expect(page.locator(map.mapModeButton)).toHaveAttribute("src", /mapMode1\.png$/);
    });
});
