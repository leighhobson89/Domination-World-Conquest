import { test, expect } from "../../support/fixtures.js";

// The colour picker repaints the pending country before the game starts, and
// every player-owned territory afterwards.
// docs/03-e2e-test-plan.md section 5.2.

const RED = "#ff0000";
const RED_RGB = "rgb(255,0,0)";

// Japan, not the United States: the US is above COUNTRY_GREYOUT_RANK and is no longer
// selectable (audit 5.2 Z, fixed in refactor Phase 3). Japan still has five separate
// territories, so "every path" stays a real assertion.
//
// The path CLICKED is Hokkaido, not the mainland: an invisible <rect> in the SVG covers
// the mainland and intercepts the pointer, so `path[territory-name="Japan"]` can never be
// clicked. Picking any one path hands over the whole country either way.
const MULTI = "Japan";
const MULTI_TERRITORY = "Hokkaido";

test.describe("the player colour picker", () => {
    test("repaints every path of the pending country", async ({ game }) => {
        await game.open();
        await game.newGame();
        await game.selectTerritory(MULTI_TERRITORY);

        await game.setColour(RED);

        const fills = await game.map
            .country(MULTI)
            .evaluateAll((paths) => paths.map((p) => p.getAttribute("fill")));
        expect(fills.length).toBeGreaterThan(1);
        expect(new Set(fills)).toEqual(new Set([RED_RGB]));
    });

    test("repaints the player's territories after the game has started", async ({ game }) => {
        await game.start({ country: MULTI_TERRITORY });

        await game.setColour(RED);

        const fills = await game.map
            .country(MULTI)
            .evaluateAll((paths) => paths.map((p) => p.getAttribute("fill")));
        expect(new Set(fills)).toEqual(new Set([RED_RGB]));
    });

    test("keeps the chosen colour across a phase change", async ({ game }) => {
        await game.start({ country: MULTI_TERRITORY, colour: RED });

        await game.endBuyPhase();

        const fills = await game.map
            .country(MULTI)
            .evaluateAll((paths) => paths.map((p) => p.getAttribute("fill")));
        expect(new Set(fills)).toEqual(new Set([RED_RGB]));
    });

    test("leaves other countries alone", async ({ game }) => {
        await game.start({ country: "Germany", colour: RED });

        const franceFill = await game.map.fill("France");
        expect(franceFill).not.toBe(RED_RGB);
    });

    test("starts showing the colour the player actually has", async ({ game, page }) => {
        // The input's markup value and the store's `playerColour` were two separate facts
        // and they disagreed: index.html shipped `value="#000000"` while the store's default
        // was white. Nothing reconciled them, so the picker advertised black and the player
        // had white.
        await game.open();
        await game.newGame();

        const shown = await page.evaluate(() => document.getElementById("player-color-picker").value);
        expect(shown.toLowerCase()).toBe("#ffffff");
    });

    test("a change event that picks the value already shown does not turn the map black", async ({
        game,
        page,
    }) => {
        // Reported from play: click a country that is too strong, then a playable one, and
        // the playable one comes out BLACK instead of showing the player's colour. The
        // locked country was a red herring -- it is the route by which a player reaches for
        // the colour picker. Opening the native colour dialog and accepting what is already
        // selected fires `change` with the input's value, which was `#000000`, so the player
        // silently acquired black: the same colour as the map strokes, so their country read
        // as a hole rather than a selection.
        await game.open();
        await game.newGame();

        const locked = await page.evaluate(() => window.__game.greyedOutCountries());
        const lockedTerritory = await page.evaluate((country) => {
            const doc = document.getElementById("svg-map").contentDocument;
            const path = [...doc.querySelectorAll("path[uniqueid]")].find(
                (p) => p.getAttribute("data-name") === country
            );
            return path ? path.getAttribute("territory-name") : null;
        }, locked[0]);

        await game.selectTerritory(lockedTerritory);
        // The dialog opened and was accepted unchanged.
        await page.evaluate(() => {
            document.getElementById("player-color-picker").dispatchEvent(new Event("change"));
        });
        await game.selectTerritory(MULTI_TERRITORY);
        await page.mouse.move(1, 1);

        const fills = await game.map
            .country(MULTI)
            .evaluateAll((paths) => paths.map((p) => p.getAttribute("fill")));
        expect(new Set(fills)).not.toContain("rgb(0,0,0)");
        expect(new Set(fills)).toEqual(new Set(["rgb(255,255,255)"]));
    });
});
