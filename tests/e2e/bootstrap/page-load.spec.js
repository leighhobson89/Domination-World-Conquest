import { test, expect } from "../../support/fixtures.js";
import { containers, menu, map } from "../../support/selectors.js";

// Page load through to a playable state. Everything else in the suite assumes
// these hold, so a failure here should be read before any other failure.
//
// docs/04-e2e-test-plan.md section 5.1.

const EXPECTED_TERRITORIES = 359;

test.describe("page load", () => {
    test("shows the main menu with New Game disabled until the model is built", async ({
        page,
    }) => {
        // Sampled from inside the page, not asserted from outside it.
        //
        // The button ships disabled and is enabled by enableNewGameButton() once the
        // territory model exists. Since Phase 1 that whole window is about 600 ms --
        // faster than a Playwright assertion can reliably land in, so
        // `await expect(...).toBeDisabled()` after a plain navigation passed only when
        // the machine happened to be slow, and failed otherwise. A 5 ms sampler
        // installed before any page script runs sees the disabled state every time.
        await page.addInitScript(() => {
            window.__newGameWasDisabled = false;
            const tick = setInterval(() => {
                const button = document.getElementById("new-game-btn");
                if (!button) return;
                if (button.disabled) {
                    window.__newGameWasDisabled = true;
                } else {
                    clearInterval(tick);
                }
            }, 5);
        });

        await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });

        await expect(page.locator(containers.menu)).toBeVisible();
        await expect(page.locator(menu.newGame)).toBeEnabled({ timeout: 30_000 });

        // Bootstrap has two halves that finish out of order -- DOMContentLoaded builds
        // the UI, window load populates `paths` -- so the button going from disabled to
        // enabled is the only honest readiness signal in the page.
        expect(
            await page.evaluate(() => window.__newGameWasDisabled),
            "New Game should ship disabled and be enabled once the model is built"
        ).toBe(true);
    });

    test("resolves both SVG layers", async ({ game, page }) => {
        await game.open();
        const layers = await page.evaluate(() => ({
            mapReady: !!document.getElementById("svg-map").contentDocument,
            coastReady: !!document.getElementById("svg-coast-lines").contentDocument,
        }));
        expect(layers).toEqual({ mapReady: true, coastReady: true });
    });

    test("loads every territory path with the attribute set the game relies on", async ({
        game,
        page,
    }) => {
        await game.open();

        const report = await page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            const paths = [...doc.querySelectorAll("path[uniqueid]")];
            const required = ["uniqueid", "territory-name", "data-name", "territory-id"];
            const missing = {};
            for (const attribute of required) {
                missing[attribute] = paths.filter((p) => !p.getAttribute(attribute)).length;
            }
            return {
                count: paths.length,
                missing,
                uniqueIds: new Set(paths.map((p) => p.getAttribute("uniqueid"))).size,
            };
        });

        expect(report.count).toBe(EXPECTED_TERRITORIES);
        expect(report.uniqueIds, "uniqueid must be unique").toBe(EXPECTED_TERRITORIES);
        expect(report.missing).toEqual({
            uniqueid: 0,
            "territory-name": 0,
            "data-name": 0,
            "territory-id": 0,
        });
    });

    test("starts with no territory greyed out, besieged or deactivated", async ({ game }) => {
        await game.open();
        const greyed = await game.map.attributeCounts("greyedOut");
        const besieged = await game.map.attributeCounts("underSiege");
        const deactivated = await game.map.attributeCounts("deactivated");

        expect(greyed.true ?? 0).toBe(0);
        expect(besieged.true ?? 0).toBe(0);
        expect(deactivated.true ?? 0).toBe(0);
    });

    test("hides the in-game panels until a game is started", async ({ game, page }) => {
        await game.open();
        for (const selector of [containers.topTable, containers.mainUi, containers.buy]) {
            const display = await page
                .locator(selector)
                .evaluate((el) => getComputedStyle(el).display);
            expect(display, `${selector} should be hidden on the menu`).toBe("none");
        }
    });

    test("addresses the map as a frame, not an iframe", async ({ game, page }) => {
        // page.frameLocator("#svg-map") silently matches nothing because the map is
        // an <object>. Recorded as a spec so the harness convention is enforced, not
        // just documented.
        await game.open();
        expect(page.frame({ name: map.frameName })).not.toBeNull();
        await expect(game.map.territory("Germany")).toHaveCount(1);
    });
});
