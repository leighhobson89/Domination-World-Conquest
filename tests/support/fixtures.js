import { test as base, expect } from "@playwright/test";
import { GameDriver } from "./game.js";

/** Deterministic PRNG, injected before any page script runs. */
function installSeededRandomSource(seed) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < String(seed).length; i += 1) {
        h ^= String(seed).charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let a = h >>> 0;
    Math.random = function seededRandom() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    window.__seed = String(seed);
}

export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
        // Seed from the test title: stable for a given test, distinct between tests,
        // so a spec that only passes at one seed is caught rather than hidden.
        await page.addInitScript(installSeededRandomSource, testInfo.title);

        // Battle overhaul B.8. Defender playback replays every battle the AI fought against the
        // player, on a timer, at the end of the AI phase. That is right for a person and wrong for
        // a suite: it would add seconds to every spec that ends a turn, for an animation none of
        // them are asserting. The preference the player has is the same one used here, so this is
        // not a special harness path -- it is the "always skip" setting, on by default under test.
        // `battle/defender-playback.spec.js` clears it, which is what makes it testable.
        await page.addInitScript(() => {
            try {
                window.localStorage.setItem("battlePlayback.alwaysSkip", "1");
            } catch {
                //Storage blocked. The playback will run; nothing breaks, it is only slower.
            }
        });

        const pageErrors = [];
        // The STACK, not just the message. The specs run against the production build,
        // so the frames are minified -- but they carry byte offsets that
        // build/assets/*.js.map resolves back to a file and line. Diagnosing audit
        // 5.1 AA cost two extra full runs purely because the message arrived with no
        // location at all.
        page.on("pageerror", (error) => pageErrors.push(`pageerror: ${error.stack || error.message}`));
        page.on("console", (message) => {
            if (message.type() === "error") pageErrors.push(`console.error: ${message.text()}`);
        });
        page.on("requestfailed", (request) => {
            const reason = request.failure()?.errorText ?? "";
            // ERR_ABORTED is what a browser reports when a request is cancelled by
            // navigation or page close. The 7 MB background music file is almost
            // always mid-flight when a test ends, so this would fail every spec.
            if (reason.includes("ERR_ABORTED")) return;
            pageErrors.push(`requestfailed: ${request.url()} ${reason}`);
        });

        await use(page);

        expect(pageErrors, "the page logged errors").toEqual([]);
    },

    game: async ({ page }, use) => {
        await use(new GameDriver(page));
    },

    /**
     * A game already started as Germany, sitting in Buy/Upgrade of turn 1.
     *
     * Germany is the default because it is a single-territory country with a
     * mid-range devIndex and several reachable neighbours -- the smallest world
     * that still exercises transfer, attack and economy. Specs that need several
     * owned territories start their own game as a multi-territory country.
     */
    startedGame: async ({ game }, use) => {
        await game.start({ country: "Germany" });
        await use(game);
    },
});

export { expect, GameDriver };
