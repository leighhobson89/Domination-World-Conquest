import { test, expect } from "../../support/fixtures.js";

// The regression guard for docs/01-codebase-audit.md section 4.1.
//
// Before refactor Phase 1, starting a game re-fetched and re-parsed the 19 MB
// closestPathsData.json once per territory -- 359 fetches and roughly 6.8 GB of
// JSON.parse -- which took minutes. If this budget is ever breached again, the
// cause is almost certainly something reintroduced into the initialisation loop.
const COLD_START_BUDGET_MS = 3000;

// Time from navigation to the New Game button becoming clickable, i.e. the whole
// territory-model build. This is separate from COLD_START_BUDGET_MS, which covers
// the game start that follows.
const PAGE_READY_BUDGET_MS = 1000;

test.describe("page bootstrap", () => {
    test("makes New Game clickable within the budget", async ({ page }, testInfo) => {
        // Wall-clock budgets are only meaningful with the machine to ourselves. With
        // the default four workers, four Chromium instances build a 359-territory
        // model against one preview server and this reads ~4x higher -- that is
        // contention, not a regression. Measured serially it is ~550ms.
        //   npm run test:e2e:perf
        test.skip(
            testInfo.config.workers > 1,
            "timing budget only asserted on a single-worker run (npm run test:e2e:perf)"
        );
        const startedAt = Date.now();
        await page.goto("/?e2e=1", { waitUntil: "load" });
        await page.waitForFunction(() => {
            const button = document.getElementById("new-game-btn");
            return button && !button.disabled;
        });
        const elapsed = Date.now() - startedAt;
        console.log(`      page ready: ${elapsed} ms (budget ${PAGE_READY_BUDGET_MS} ms)`);
        expect(elapsed).toBeLessThan(PAGE_READY_BUDGET_MS);
    });

    test("uses the precomputed territory areas instead of sampling them", async ({ page }) => {
        // calculatePathAreasWhenPageLoaded() was called from two places, so the
        // 80-samples-per-path sweep over all 359 paths ran twice (~460ms) behind two
        // separate 800ms pollers. It is now memoised AND served from
        // resources/pathAreas.json, so the sweep should not run at all.
        //
        // A non-zero count is not a crash -- it means the cache guard rejected the
        // file and the game fell back to computing areas live, which is the correct
        // behaviour after the SVG is edited. Regenerate with:
        //     npm run build:areas
        await page.goto("/?e2e=1", { waitUntil: "load" });
        await page.waitForFunction(() => {
            const button = document.getElementById("new-game-btn");
            return button && !button.disabled;
        });
        const count = await page.evaluate(() => window.__game.pathAreaComputations());
        expect(count, "fell back to live area sampling; is pathAreas.json stale?").toBe(0);
    });
});

test.describe("cold start", () => {
    test("builds the territory model and reaches turn 1 within the budget", async ({ game }) => {
        const elapsed = await game.start({ country: "Germany" });
        console.log(`      cold start: ${elapsed} ms (budget ${COLD_START_BUDGET_MS} ms)`);
        expect(elapsed).toBeLessThan(COLD_START_BUDGET_MS);
    });

    test("loads the adjacency data exactly once, not once per territory", async ({
        page,
        game,
    }) => {
        const adjacencyRequests = [];
        page.on("request", (request) => {
            const url = request.url();
            if (url.includes("adjacency.json") || url.includes("closestPathsData.json")) {
                adjacencyRequests.push(url);
            }
        });

        await game.start({ country: "Germany" });

        expect(adjacencyRequests.length).toBe(1);
        expect(adjacencyRequests[0]).toContain("adjacency.json");
        expect(adjacencyRequests.join(" ")).not.toContain("closestPathsData.json");
    });

    test("never requests the 19 MB source data file at runtime", async ({ page, game }) => {
        let bytes = 0;
        page.on("response", async (response) => {
            if (response.url().includes("closestPathsData.json")) bytes += 1;
        });
        await game.start({ country: "Germany" });
        expect(bytes).toBe(0);
    });

    test("gives the player every territory of their chosen country", async ({ game }) => {
        await game.start({ country: "Germany" });
        const owned = await game.state(() => window.__game.territoriesOwnedBy("Player"));
        expect(owned.length).toBeGreaterThan(0);
        expect(owned.every((t) => t.dataName === "Germany")).toBe(true);
    });

    test("colours the map rather than leaving it white", async ({ game, page }) => {
        // Colouring used to be a side effect of the per-territory loading loop.
        // Removing that loop must not leave the map blank.
        await game.start({ country: "Germany" });
        const white = await page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            const paths = [...doc.querySelectorAll("path[uniqueid]")];
            return paths.filter((p) => p.getAttribute("fill") === "rgb(255, 255, 255)").length;
        });
        expect(white).toBe(0);
    });
});
