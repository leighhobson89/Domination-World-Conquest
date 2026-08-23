import { test as base, expect } from "@playwright/test";

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

/**
 * Drives the game at the level a player does, so specs never encode the click
 * sequence for starting a game. Extended in refactor Phase 2.
 */
export class GameDriver {
    constructor(page) {
        this.page = page;
    }

    /** Load the page and wait until the territory model is built. */
    async open({ seed } = {}) {
        const query = seed === undefined ? "?e2e=1" : `?e2e=1&seed=${encodeURIComponent(seed)}`;
        await this.page.goto(`/${query}`, { waitUntil: "load" });
        await this.page.waitForFunction(() => {
            const button = document.getElementById("new-game-btn");
            return button && !button.disabled;
        });
    }

    /** Click New Game and land on the country-selection screen. */
    async newGame() {
        await this.page.click("#new-game-btn");
        await this.page.waitForSelector("#popup-confirm", { state: "visible" });
    }

    /**
     * The map is an <object>, not an <iframe>, so page.frameLocator("#svg-map")
     * does not work. Chromium still exposes it as a frame named after the element
     * id, which is how we reach the territory paths.
     */
    mapFrame() {
        const frame = this.page.frame({ name: "svg-map" });
        if (!frame) {
            throw new Error("The svg-map frame is not available yet; is the map loaded?");
        }
        return frame;
    }

    /** Pick a country on the map by its territory name. */
    async selectTerritory(territoryName) {
        await this.mapFrame().locator(`path[territory-name="${territoryName}"]`).click();
    }

    /**
     * Full "start a game as this country" flow, ending in the Buy/Upgrade phase of
     * turn 1. Returns how long initialisation took, in milliseconds.
     */
    async start({ country = "Germany", seed } = {}) {
        await this.open({ seed });
        await this.newGame();
        await this.selectTerritory(country);
        await this.page.waitForFunction(
            () => document.getElementById("popup-confirm")?.style.display === "block"
        );

        const startedAt = Date.now();
        await this.page.click("#popup-confirm");
        await this.page.waitForFunction(() => window.__game && window.__game.isReady(), null, {
            timeout: 120_000,
        });
        return Date.now() - startedAt;
    }

    /**
     * Read a snapshot of game state through the ?e2e=1 hook. The optional second
     * argument is forwarded into the page, exactly like page.evaluate.
     */
    async state(expression, arg) {
        return arg === undefined
            ? this.page.evaluate(expression)
            : this.page.evaluate(expression, arg);
    }
}

export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
        // Seed from the test title: stable for a given test, distinct between tests,
        // so a spec that only passes at one seed is caught rather than hidden.
        await page.addInitScript(installSeededRandomSource, testInfo.title);

        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(`pageerror: ${error.message}`));
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
});

export { expect };
