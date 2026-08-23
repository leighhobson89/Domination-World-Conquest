import { test, expect } from "../../support/fixtures.js";

// The colour picker repaints the pending country before the game starts, and
// every player-owned territory afterwards.
// docs/04-e2e-test-plan.md section 5.2.

const RED = "#ff0000";
const RED_RGB = "rgb(255,0,0)";

test.describe("the player colour picker", () => {
    test("repaints every path of the pending country", async ({ game }) => {
        await game.open();
        await game.newGame();
        // The United States has 11 separate territories, so "every path" is a real
        // assertion rather than a single-path one.
        await game.selectTerritory("United States");

        await game.setColour(RED);

        const fills = await game.map
            .country("United States")
            .evaluateAll((paths) => paths.map((p) => p.getAttribute("fill")));
        expect(fills.length).toBeGreaterThan(1);
        expect(new Set(fills)).toEqual(new Set([RED_RGB]));
    });

    test("repaints the player's territories after the game has started", async ({ game }) => {
        await game.start({ country: "United States" });

        await game.setColour(RED);

        const fills = await game.map
            .country("United States")
            .evaluateAll((paths) => paths.map((p) => p.getAttribute("fill")));
        expect(new Set(fills)).toEqual(new Set([RED_RGB]));
    });

    test("keeps the chosen colour across a phase change", async ({ game }) => {
        await game.start({ country: "United States", colour: RED });

        await game.endBuyPhase();

        const fills = await game.map
            .country("United States")
            .evaluateAll((paths) => paths.map((p) => p.getAttribute("fill")));
        expect(new Set(fills)).toEqual(new Set([RED_RGB]));
    });

    test("leaves other countries alone", async ({ game }) => {
        await game.start({ country: "Germany", colour: RED });

        const franceFill = await game.map.fill("France");
        expect(franceFill).not.toBe(RED_RGB);
    });
});
