import { test, expect } from "../../support/fixtures.js";

// Hokkaido (Japan), not Alaska (United States): since refactor Phase 3 the country
// selection strength gate actually fires (audit 5.2 Z), and the United States is above
// COUNTRY_GREYOUT_RANK, so it can no longer be chosen. Hokkaido is the same shape of
// fixture and a better one -- it reaches four other Japanese territories and two enemy
// ones (Russia, Kamchatkan Islands 3), where Alaska reached fewer.
// Selecting an owned territory in the Military phase highlights what it can
// reach and decides what the move button offers.
//
// docs/03-e2e-test-plan.md section 5.8.

test.describe("selecting an owned territory in the Military phase", () => {
    test("offers a live TRANSFER when there is somewhere to send units", async ({ game }) => {
        await game.start({ country: "Hokkaido" });
        await game.endBuyPhase();

        await game.selectOnMap("Hokkaido");

        expect(await game.moveButton.label()).toBe("TRANSFER");
        expect(await game.moveButton.variant()).toBe("transfer");
        expect(await game.moveButton.isEnabled()).toBe(true);
    });

    test("greys TRANSFER out when the player owns a single territory", async ({
        startedGame: game,
    }) => {
        // The button is shown but dead: with one territory there is nowhere to
        // transfer to. The condition the code tests is `playerOwnedTerritories
        // .length <= 1`, not whether the reachable set is empty.
        await game.endBuyPhase();

        await game.selectOnMap("Germany");

        expect(await game.moveButton.label()).toBe("TRANSFER");
        expect(await game.moveButton.variant()).toBe("disabled");
        expect(await game.moveButton.isEnabled()).toBe(false);
    });

    test("marks the reachable territories on the map", async ({ startedGame: game }) => {
        await game.endBuyPhase();
        await game.selectOnMap("Germany");

        const flagged = await game.map.attackableTerritories();
        const reachable = await game.interactableFrom("Germany");

        expect(flagged.length).toBeGreaterThan(0);
        // Everything flagged on the map must be in the adjacency model. The reverse
        // does not hold: a territory can be reachable but already besieged, and so
        // not flagged.
        for (const name of flagged) {
            expect(reachable, `${name} was flagged but is not reachable`).toContain(name);
        }
    });

    test("reaches only genuine neighbours, not the whole map", async ({ startedGame: game }) => {
        const reachable = await game.interactableFrom("Germany");

        expect(reachable.length).toBeGreaterThan(0);
        expect(reachable.length).toBeLessThan(30);
        expect(reachable).toContain("France");
        expect(reachable).not.toContain("Australia");
    });

    test("clears the flags when the map background is clicked", async ({ startedGame: game }) => {
        await game.endBuyPhase();
        await game.selectOnMap("Germany");
        expect((await game.map.attackableTerritories()).length).toBeGreaterThan(0);

        // Clicking the sea (the SVG's background rect) cancels the selection.
        await game.map.frame().locator("rect").first().click({ force: true });

        await expect.poll(async () => game.moveButton.isVisible()).toBe(false);
    });

    test("offers nothing at all in the Buy/Upgrade phase", async ({ startedGame: game }) => {
        await game.selectOnMap("Germany");
        expect(await game.moveButton.isVisible()).toBe(false);
    });
});
