import { test, expect } from "../../support/fixtures.js";
import { diplomacyPanel, infoTable } from "../../support/selectors.js";

// A COUNTRY THAT HOLDS NO TERRITORY IS OUT OF THE GAME, AND STOPS BEING A RELATION.
//
// Reported by Leigh, playing: *"i took a territory of a country that only had 1, effectively
// defeating that country. however it still shows as being at war with me in diplomacy and in
// the tooltip."*
//
// The register in `src/state/diplomacy.js` is keyed by COUNTRY NAME and knows nothing about
// the map, so a relation outlives the country it describes. That is worse than clutter: it is
// the game telling a player they have an enemy they have already beaten, and over a long game
// the panel fills up with them.
//
// `src/state/defeated.js` is the answer, and it is DERIVED rather than stored -- a country
// with no territory has nowhere to attack from, so defeat is permanent and there is no flag
// anybody can forget to set. `tests/unit/state-defeated.spec.js` owns the derivation and its
// cache; `ui-diplomacy-tooltip.spec.js` and `ui-diplomacy-panel.spec.js` own the two filters.
// What is left here is what none of them can see: that the wiring is connected in a running
// game, on the two surfaces the defect was reported on and the third it exposed.
//
// Luxembourg holds exactly ONE territory on this map, which is what makes the scenario
// possible at all: handing that territory to the player takes the country out entirely.

test.describe("a country conquered out of existence", () => {
    async function conquerLuxembourg(game) {
        await game.start({ country: "Germany", seed: "defeated-country" });
        await game.loadScenario("country-defeated");
    }

    test("is not listed on the territory tooltip", async ({ game }) => {
        await conquerLuxembourg(game);

        await game.map.hover("Germany");
        await game.page.waitForTimeout(250);

        const rows = await game.diplomacy.tooltipRows();
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.map(row => row.text).join(" ")).not.toContain("Luxembourg");
    });

    test("is not listed in the diplomacy panel, and is not counted either", async ({ game }) => {
        await conquerLuxembourg(game);
        await game.diplomacy.open();

        const listed = (await game.diplomacy.rows()).map(row => row.country);
        expect(listed.length).toBeGreaterThan(0);
        expect(listed).not.toContain("Luxembourg");

        //THE COUNT AS WELL AS THE ROW, and this is the half a filter would have got wrong. The
        //search box is applied AFTER the count, deliberately, so a heading does not change
        //while somebody types; a beaten country is dropped BEFORE it, because "At war: 1" over
        //an empty group is not a filtered count, it is a wrong number.
        const summary = await game.page.locator(diplomacyPanel.summary).textContent();
        expect(summary).toContain("At war with nobody");
    });

    test("is shown as defeated in the standings table", async ({ game, page }) => {
        await conquerLuxembourg(game);

        //The info panel is SHUT on turn 1 -- it raises itself at the start of a turn and turn
        //one has no news to raise it for -- and the news panel opens over it.
        await page.evaluate(() => {
            const feed = document.getElementById("activity-panel-container");
            if (feed) feed.style.display = "none";
        });
        const panel = page.locator("#main-ui-container");
        if (!(await panel.isVisible())) {
            await page.click(infoTable.toggle);
            await expect(panel).toBeVisible();
        }
        await page.click(infoTable.standingsTab);

        //`worldStandings()` is a fold over TERRITORIES, so a country holding none is ABSENT
        //from it rather than last in it -- the table simply stopped mentioning a country the
        //turn it was conquered, which is the opposite of what somebody who has just conquered
        //it wants. These rows are ADDED BACK below a separator rather than filtered.
        const rows = await page.evaluate(() =>
            [...document.querySelectorAll("#uiTable .ui-table-row-defeated")]
                .map(row => row.textContent.trim()));

        expect(rows.some(text => text.includes("Luxembourg"))).toBe(true);
        expect(rows.some(text => text.includes("defeated"))).toBe(true);
    });
});
