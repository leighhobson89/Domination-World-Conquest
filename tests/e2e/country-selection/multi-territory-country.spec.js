import { test, expect } from "../../support/fixtures.js";
import { startingTerritoryCount } from "../../support/territories.js";

// Picking a country gives the player ALL of its territories, not just the one
// clicked. Derived from resources/svgMaster.svg, which is what the running game
// reads.
// docs/04-e2e-test-plan.md section 5.2.

// Japan, not the United States: the US is above COUNTRY_GREYOUT_RANK and is no
// longer selectable (audit 5.2 Z, fixed in refactor Phase 3). Japan has five
// territories, of which Hokkaido is an island rather than the mainland -- the same
// "click any ONE path" property Alaska used to give.
const MULTI = "Japan";
const ISLAND_OF_MULTI = "Hokkaido";
const SINGLE = "Germany";

test.describe("picking a country", () => {
    test("gives the player every territory of a multi-territory country", async ({ game }) => {
        const expected = startingTerritoryCount(MULTI);
        expect(expected, `${MULTI} should own several territories`).toBeGreaterThan(1);

        // An island, not the mainland: clicking any ONE path must hand over all of them.
        await game.start({ country: ISLAND_OF_MULTI });

        const owned = await game.playerTerritories();
        expect(owned.length).toBe(expected);
        expect(new Set(owned.map((t) => t.dataName))).toEqual(new Set([MULTI]));
    });

    test("gives the player exactly one territory of a single-territory country", async ({
        game,
    }) => {
        expect(startingTerritoryCount(SINGLE)).toBe(1);

        await game.start({ country: SINGLE });

        const owned = await game.playerTerritories();
        expect(owned.map((t) => t.territoryName)).toEqual([SINGLE]);
    });

    test("colours every owned path, not just the clicked one", async ({ game }) => {
        await game.start({ country: ISLAND_OF_MULTI });

        const owners = await game.map.attributeCounts("owner");
        expect(owners.Player).toBe(startingTerritoryCount(MULTI));
    });
});
