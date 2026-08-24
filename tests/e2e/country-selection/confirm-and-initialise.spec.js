import { test, expect } from "../../support/fixtures.js";
import { Phase, containers, phaseBar, phaseButtonLabel, sel } from "../../support/selectors.js";

// Confirming a country runs initialisation and lands in Buy/Upgrade of turn 1.
// docs/04-e2e-test-plan.md section 5.2.

test.describe("confirming a country", () => {
    test("lands in Buy/Upgrade of turn 1 with the phase button reading MILITARY", async ({
        game,
        page,
    }) => {
        await game.start({ country: "Germany" });

        expect(await game.turn()).toBe(1);
        expect(await game.phase()).toBe(Phase.BUY_UPGRADE);
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase");
        await expect(page.locator(phaseBar.confirm)).toHaveText(
            phaseButtonLabel[Phase.BUY_UPGRADE]
        );
    });

    test("sets the player flag in the top table", async ({ game, page }) => {
        await game.start({ country: "Germany" });

        await expect(page.locator(containers.topTable)).toBeVisible();
        const flagSrc = await page.locator(`${sel.flagTop} img`).getAttribute("src");
        expect(flagSrc).toContain("resources/flags/Germany.png");
    });

    test("ungreys the whole map so every territory is interactive again", async ({ game }) => {
        await game.start({ country: "Germany" });

        const greyed = await game.map.attributeCounts("greyedOut");
        expect(greyed.true ?? 0).toBe(0);
    });

    test("marks the chosen country as owned by the player, in state and on the map", async ({
        game,
    }) => {
        await game.start({ country: "Germany" });

        // Territory state lives in three places at once -- mainGameArray, the SVG
        // path attributes, and siege/war copies. These are the two that exist at
        // turn 1, and they must agree.
        const owned = await game.playerTerritories();
        expect(owned.map((t) => t.territoryName)).toEqual(["Germany"]);

        expect(await game.map.attribute("Germany", "owner")).toBe("Player");
    });

    test("keeps the colour picker usable once the game is running", async ({ game, page }) => {
        // The confirm handler runs `document.getElementById("popup-color").disabled
        // = true`, but #popup-color is a <label> -- `disabled` is not a label
        // property, so the assignment is inert and the picker stays live. That is
        // also what the change handler expects: it has an explicit
        // `countrySelectedAndGameStarted` branch that repaints owned territories,
        // which would be unreachable if the control really were disabled. Recorded
        // as behaviour rather than as a defect: the dead assignment goes when
        // CountrySelect is extracted in Phase 6.3.
        await game.start({ country: "Germany" });
        await expect(page.locator(phaseBar.colourLabel)).toBeVisible();
        expect(
            await page.locator(phaseBar.colourLabel).evaluate((el) => el.tagName.toLowerCase())
        ).toBe("label");
    });

    test("computes the player's totals from their territories", async ({ game }) => {
        await game.start({ country: "Germany" });

        const { totals, summed } = await game.state(() => {
            const owned = window.__game.territoriesOwnedBy("Player");
            const sum = (key) => owned.reduce((a, t) => a + t[key], 0);
            return {
                totals: window.__game.totals(),
                summed: {
                    gold: sum("goldForCurrentTerritory"),
                    oil: sum("oilForCurrentTerritory"),
                    food: sum("foodForCurrentTerritory"),
                    consMats: sum("consMatsForCurrentTerritory"),
                    area: sum("area"),
                },
            };
        });

        expect(totals.gold).toBeCloseTo(summed.gold, 5);
        expect(totals.oil).toBeCloseTo(summed.oil, 5);
        expect(totals.food).toBeCloseTo(summed.food, 5);
        expect(totals.consMats).toBeCloseTo(summed.consMats, 5);
        expect(totals.area).toBeCloseTo(summed.area, 5);
    });
});
