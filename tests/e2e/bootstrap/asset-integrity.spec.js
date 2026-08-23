import { test, expect } from "../../support/fixtures.js";

// setFlag() builds its src by string concatenation -- `./resources/flags/${name}.png`
// -- and has no fallback, so a missing flag renders as a broken image with no
// error anywhere. Asset paths are hand-written strings in ~100 places and no
// bundler rewrites them; vite.config.mjs copies resources/ verbatim for exactly
// this reason. This spec is what catches a copy that did not happen.
//
// docs/04-e2e-test-plan.md section 5.1.

/** Fetch a batch of URLs from inside the page and report the ones that are not 200. */
async function missingAssets(page, urls) {
    return page.evaluate(async (list) => {
        const bad = [];
        // Serialised in chunks: 200+ parallel fetches against the preview server
        // is the kind of load that makes this spec flaky rather than useful.
        for (let i = 0; i < list.length; i += 20) {
            const chunk = list.slice(i, i + 20);
            const results = await Promise.all(
                chunk.map(async (url) => {
                    try {
                        const response = await fetch(url, { method: "GET" });
                        return response.ok ? null : `${url} -> ${response.status}`;
                    } catch (error) {
                        return `${url} -> ${String(error)}`;
                    }
                })
            );
            bad.push(...results.filter(Boolean));
        }
        return bad;
    }, urls);
}

test.describe("asset integrity", () => {
    test("ships a flag for every country on the map", async ({ game, page }) => {
        await game.open();

        const countries = await page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            return [
                ...new Set(
                    [...doc.querySelectorAll("path[data-name]")].map((p) =>
                        p.getAttribute("data-name")
                    )
                ),
            ].sort();
        });

        expect(countries.length, "the map should carry 200+ countries").toBeGreaterThan(200);

        const bad = await missingAssets(
            page,
            countries.map((name) => `./resources/flags/${name}.png`)
        );
        expect(bad, "setFlag has no fallback -- a missing flag is silent").toEqual([]);
    });

    test("serves every image the UI references at load time", async ({
        startedGame: game,
        page,
    }) => {
        // Everything already in the DOM, plus the icons the buy/upgrade windows
        // swap in by name at click time. The swapped variants never appear in the
        // DOM until clicked, which is why they are listed explicitly.
        const swappedIcons = [
            "resources/plusButton.png",
            "resources/plusButtonGrey.png",
            "resources/minusButton.png",
            "resources/minusButtonGrey.png",
            "resources/multipleIncrementerButton.png",
            "resources/multipleIncrementerButtonGrey.png",
            "resources/upgradeButtonIcon.png",
            "resources/upgradeButtonIconPressed.png",
            "resources/upgradeButtonGreyedOut.png",
            "resources/buyButtonIcon.png",
            "resources/buyButtonIconPressed.png",
            "resources/buyButtonGreyedOut.png",
            "resources/mapMode1.png",
            "resources/strokeToggle2.png",
            "resources/globeNoStandButtonUI.png",
            "resources/gold.png",
            "resources/prodPopulation.png",
            "resources/buy.png",
        ];

        await game.infoTable.open();
        const inDom = await page.evaluate(() =>
            [...document.querySelectorAll("img")]
                .map((img) => img.getAttribute("src"))
                .filter((src) => src && !src.startsWith("data:"))
        );

        const bad = await missingAssets(page, [...new Set([...inDom, ...swappedIcons])]);
        expect(bad).toEqual([]);
    });

    test("serves the generated data files the game loads at runtime", async ({ page, game }) => {
        await game.open();
        const bad = await missingAssets(page, [
            "resources/adjacency.json",
            "resources/pathAreas.json",
            "resources/svgMaster.svg",
        ]);
        expect(bad).toEqual([]);
    });
});
