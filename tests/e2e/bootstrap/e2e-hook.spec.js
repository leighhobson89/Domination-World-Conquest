import { test, expect, GameDriver } from "../../support/fixtures.js";

// refactor Phase 1.6. Everything in docs/04-e2e-test-plan.md depends on these two
// hooks existing: a state accessor, so numeric assertions read the model rather
// than parsing "1.2M" out of a table cell, and a seeded RNG, so combat is
// reproducible.

test.describe("?e2e=1 state hook", () => {
    test("is absent without the flag, so production pages expose nothing", async ({ page }) => {
        await page.goto("/", { waitUntil: "load" });
        await page.waitForFunction(() => {
            const button = document.getElementById("new-game-btn");
            return button && !button.disabled;
        });
        expect(await page.evaluate(() => typeof window.__game)).toBe("undefined");
    });

    test("is present with the flag, before a game is even started", async ({ page, game }) => {
        await game.open();
        const api = await page.evaluate(() => Object.keys(window.__game).sort());
        expect(api).toEqual(
            [
                "countryStrengths",
        "isReady",
                "pathAreaComputations",
                "phase",
                "ready",
                "seed",
                "sieges",
                "territoriesOwnedBy",
                "territory",
                "totals",
                "turn",
                "wars",
            ].sort()
        );
    });

    test("reports not-ready before a game starts and ready afterwards", async ({ page, game }) => {
        await game.open();
        expect(await page.evaluate(() => window.__game.isReady())).toBe(false);
        await game.newGame();
        await game.selectTerritory("Germany");
        await page.click("#popup-confirm");
        await page.waitForFunction(() => window.__game.isReady());
        expect(await page.evaluate(() => window.__game.isReady())).toBe(true);
    });

    test("exposes turn and phase", async ({ game }) => {
        await game.start({ country: "Germany" });
        expect(await game.state(() => window.__game.turn())).toBe(1);
        expect(await game.state(() => window.__game.phase())).toBe(0); // Buy / Upgrade
    });

    test("returns a territory snapshot by name or uniqueId", async ({ game }) => {
        await game.start({ country: "Germany" });
        const byName = await game.state(() => window.__game.territory("Germany"));
        expect(byName).toMatchObject({
            territoryName: "Germany",
            dataName: "Germany",
            owner: "Player",
        });
        expect(byName.goldForCurrentTerritory).toBeGreaterThan(0);

        const byId = await game.state(() => window.__game.territory(17));
        expect(byId).not.toBeNull();
    });

    test("returns a copy, so a test cannot mutate live game state", async ({ game }) => {
        await game.start({ country: "Germany" });
        const mutated = await game.state(() => {
            window.__game.territory("Germany").goldForCurrentTerritory = -1;
            return window.__game.territory("Germany").goldForCurrentTerritory;
        });
        expect(mutated).not.toBe(-1);
    });

    test("returns null for an unknown territory", async ({ game }) => {
        await game.start({ country: "Germany" });
        expect(await game.state(() => window.__game.territory("Atlantis"))).toBeNull();
    });

    test("totals agree with the sum over the player's territories", async ({ game }) => {
        await game.start({ country: "Germany" });
        const { totals, summed } = await game.state(() => {
            const owned = window.__game.territoriesOwnedBy("Player");
            return {
                totals: window.__game.totals(),
                summed: owned.reduce((a, t) => a + t.goldForCurrentTerritory, 0),
            };
        });
        expect(totals.gold).toBeCloseTo(summed, 5);
    });

    test("reports sieges and wars as empty at the start of a game", async ({ game }) => {
        await game.start({ country: "Germany" });
        expect(await game.state(() => window.__game.sieges())).toEqual({ player: [], ai: [] });
        expect(await game.state(() => window.__game.wars())).toEqual([]);
    });
});

test.describe("seeded RNG", () => {
    test("the harness seed is installed before any game module runs", async ({ page, game }) => {
        await game.open();
        expect(await page.evaluate(() => window.__seed)).toBeTruthy();
    });

    test("?seed= installs a reproducible Math.random", async ({ page }) => {
        await page.goto("/?e2e=1&seed=abc123", { waitUntil: "load" });
        // Re-seed immediately before drawing. The page cannot simply be reloaded and
        // sampled, because the sparkle animation timer consumes the same global
        // Math.random stream at unpredictable points -- see the fixme below.
        const draw = () =>
            page.evaluate(() => {
                window.__seedRandom("abc123");
                return [Math.random(), Math.random(), Math.random()];
            });
        expect(await draw()).toEqual(await draw());
    });

    test("__seedRandom is only defined with the e2e flag", async ({ page }) => {
        await page.goto("/", { waitUntil: "load" });
        expect(await page.evaluate(() => typeof window.__seedRandom)).toBe("undefined");
    });

    test("a different seed gives a different sequence", async ({ page }) => {
        await page.goto("/?e2e=1&seed=aaa", { waitUntil: "load" });
        const first = await page.evaluate(() => [Math.random(), Math.random()]);
        await page.goto("/?e2e=1&seed=bbb", { waitUntil: "load" });
        const second = await page.evaluate(() => [Math.random(), Math.random()]);
        expect(first).not.toEqual(second);
    });

    // KNOWN GAP, not a broken test. Seeding Math.random globally cannot make this
    // game deterministic, because addSparklesRegularly() in ui.js re-arms a timer
    // every 0-100ms and burns three Math.random() calls per tick (interval, top,
    // left) on the same global stream that the economy and combat draw from. How
    // many cosmetic draws land between two game-logic draws depends on wall-clock
    // timing, so two runs with the same seed diverge.
    //
    // The fix belongs with refactor Phase 5, which introduces an injected RNG for
    // game logic (src/ai/rng.js and the rules layer) and leaves cosmetics on the
    // global Math.random. Un-skip this then. Until it passes, no test may assert an
    // exact combat or economy outcome across runs.
    test.fixme("the same seed produces the same world", async ({ page }) => {
        const worldFor = async () => {
            const driver = new GameDriver(page);
            await driver.start({ country: "Germany", seed: "world-seed" });
            return page.evaluate(() =>
                window.__game
                    .territoriesOwnedBy("Player")
                    .map((t) => `${t.territoryName}:${Math.round(t.goldForCurrentTerritory)}`)
                    .sort()
            );
        };
        expect(await worldFor()).toEqual(await worldFor());
    });
});
