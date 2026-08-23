import { test, expect } from "../../support/fixtures.js";

// Clicking a territory fills the bottom table from that territory's model entry.
// The table is KMB-formatted, so the numbers are checked against __game rather
// than parsed the other way round -- see docs/04-e2e-test-plan.md section 8.3.
//
// docs/04-e2e-test-plan.md section 5.4.

/**
 * formatNumbersToKMB mirrored, so the expectations read as numbers rather than
 * as strings. Note the lower-case `k` and the upper-case `M`/`B` -- that
 * inconsistency is the shipped behaviour, and `info-panels/formatting.spec.js`
 * (P2) is where the formatter's own boundaries get pinned.
 */
function kmb(value) {
    if (value === 0 || (value > -1 && value < 1)) return "0";
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(0);
}

test.describe("selecting a territory", () => {
    test("fills the bottom table from that territory's model entry", async ({
        startedGame: game,
    }) => {
        await game.map.click("France");
        const france = await game.territory("France");

        await expect.poll(async () => await game.bottomTable.territoryName()).toBe("France");

        expect(await game.bottomTable.text("mountainDefence")).toBe(
            String(france.mountainDefenseBonus)
        );
        expect(await game.bottomTable.text("gold")).toBe(
            String(Math.ceil(france.goldForCurrentTerritory))
        );
        expect(await game.bottomTable.text("oil")).toBe(
            String(Math.ceil(france.oilForCurrentTerritory))
        );
        expect(await game.bottomTable.text("food")).toBe(
            String(Math.ceil(france.foodForCurrentTerritory))
        );
        expect(await game.bottomTable.text("consMats")).toBe(
            String(Math.ceil(france.consMatsForCurrentTerritory))
        );
    });

    test("shows the continent alongside the territory name", async ({ startedGame: game }) => {
        await game.map.click("France");
        await expect.poll(async () => await game.bottomTable.text("name")).toContain("France");
        expect(await game.bottomTable.text("name")).toContain("Europe");
    });

    test("sets the territory flag in the bottom table", async ({ startedGame: game, page }) => {
        await game.map.click("France");
        await expect
            .poll(async () => page.locator("#flag-bottom img").getAttribute("src"))
            .toContain("resources/flags/France.png");
    });

    test("formats population and area with the KMB formatter", async ({ startedGame: game }) => {
        await game.map.click("France");
        const france = await game.territory("France");

        await expect.poll(async () => await game.bottomTable.territoryName()).toBe("France");

        expect(await game.bottomTable.text("population")).toBe(
            `${kmb(france.productiveTerritoryPop)} (${kmb(france.territoryPopulation)})`
        );
        expect(await game.bottomTable.text("area")).toBe(`${kmb(france.area)} (km²)`);
    });

    test("switches cleanly from one territory to another", async ({ startedGame: game }) => {
        await game.map.click("France");
        await expect.poll(async () => await game.bottomTable.territoryName()).toBe("France");

        await game.map.click("Germany");
        await expect.poll(async () => await game.bottomTable.territoryName()).toBe("Germany");

        const germany = await game.territory("Germany");
        expect(await game.bottomTable.text("gold")).toBe(
            String(Math.ceil(germany.goldForCurrentTerritory))
        );
    });

    test("raises a path in z-order one click late", async ({ startedGame: game, page }) => {
        // selectCountry() re-inserts `lastClickedPath` before its parent's 10th
        // child so the selected territory draws over its neighbours -- but it does
        // that BEFORE reassigning `lastClickedPath = country`, so the path it
        // actually raises is the PREVIOUS selection, not the new one. The newly
        // clicked path stays at the back until the next click.
        //
        // Recorded as behaviour rather than filed as a defect: the raise exists to
        // make the selected stroke visible on a shared border, and whether the
        // one-click lag is visible to a player is a design question for the Phase
        // 6.7 MapView, not something to "fix" blind.
        const indexOf = (name) =>
            page.evaluate((territoryName) => {
                const doc = document.getElementById("svg-map").contentDocument;
                const path = doc.querySelector(`path[territory-name="${territoryName}"]`);
                return [...path.parentNode.children].indexOf(path);
            }, name);

        await game.map.click("France");
        expect(await indexOf("France"), "the newly clicked path is not raised yet").toBeGreaterThan(
            9
        );

        await game.map.click("Spain");
        expect(
            await indexOf("France"),
            "the previous selection is raised instead"
        ).toBeLessThanOrEqual(9);
    });
});
