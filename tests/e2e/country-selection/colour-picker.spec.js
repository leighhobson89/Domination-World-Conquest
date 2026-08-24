import { test, expect } from "../../support/fixtures.js";

// The colour picker repaints the pending country before the game starts, and
// every player-owned territory afterwards.
// docs/04-e2e-test-plan.md section 5.2.

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
});
