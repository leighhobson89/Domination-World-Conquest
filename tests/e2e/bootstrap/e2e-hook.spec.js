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
        //The save hooks are deliberately NOT in this list: `installSaveTestHooks()`
        //runs from `beginAutosaving()`, which needs a game. The audio hooks ARE,
        //because the audio panel exists from the main menu onwards and a spec has to
        //be able to read the settings before anything has been started.
        expect(api).toEqual(
            [
                "activity",
                //Phase 7.8. What every AI country decided and why, from the same bounded
                //ring the Numpad-/ debug panel draws. `tools/ai-sim.mjs` reads it to answer
                //"why has the world stopped changing?" over a hundred turns -- a question
                //with no textual signature, since every turn completes and nothing throws.
                "aiPlans",
                "applyScenario",
                "audio",
                "audioTracks",
                "battle",
                "currentTrack",
                "countryStrengths",
                "forceRandomEvent",
                "greyedOutCountries",
                "isReady",
                "musicPlaying",
                "pathAreaComputations",
                //Battle overhaul B.8.4. The four playback hooks. Playing back a battle the player
                //DEFENDED needs an AI country to attack a chosen territory on a chosen turn,
                //which is a seed lottery -- but nothing about the PLAYBACK needs the AI turn, so
                //`queueDefence()` supplies the same record `doAttack()` builds and the queue, the
                //reversed sides, the ledger, the timer and the Skip control are all the real path.
                //`setAlwaysSkipPlayback()` reaches the player's own preference, which the fixture
                //turns ON for every spec so a replay does not add seconds to every ended turn.
                "pendingDefences",
                "phase",
                "playQueuedDefences",
                "queueDefence",
                "randomEventProbability",
                "ready",
                "recordActivity",
                "retrievals",
                "seed",
                "setAlwaysSkipPlayback",
                "setAudio",
                "siegeAt",
                "sieges",
                "stateGuardViolations",
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

    // Audit 5.3 Y, closed in refactor Phase 5.5. Cosmetic randomness moved off the
    // global stream into `src/platform/cosmeticRng.js`, so `addSparklesRegularly()`
    // no longer burns three timer-driven draws per tick on the stream the economy,
    // combat and the AI draw from. Two runs of the same seed now see the same
    // numbers in the same order, which is what makes an exact-outcome assertion
    // legitimate anywhere in the suite.
    test("the same seed produces the same world", async ({ page }) => {
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
