import { test, expect } from "../../support/fixtures.js";
import { containers, upgradeWindow } from "../../support/selectors.js";

// The two status bars: the font they set in, and the flag cells that are controls.
//
// Two things landed together here and both were invisible to the rest of the suite.
//
// **The bars were the last hard-coded typeface in the stylesheet.** `#top-table td`
// and `#bottom-table td` set `Arial, Helvetica, sans-serif` while every panel above
// them read `var(--font-body)`, so the two strips framing the screen were the one
// part of the game a theme could not reach -- Parchment's serif and Terminal's
// monospace stopped at the edge of the map. The register's hygiene note kept them
// that way for a stated reason: the bars are a FIXED 30px, and a monospace face
// sets wider, so a cell that reflowed would push its own figures out of the bar.
// `white-space: nowrap` is what makes that safe, and THIS SPEC IS THE CHECK --
// it walks every theme and fails if either bar can scroll in any of them.
//
// **The flag cells open windows.** The bottom flag opens Upgrade Territory for the
// territory the bar is describing; the top flag opens the info panel. The flag and
// not the bar, deliberately: a thirty-pixel strip of figures a player is reading
// should not swallow a click near the bottom of the screen.
//
// The bottom flag is GATED and the top one is not, which is the asymmetry worth
// pinning. The bar is written for enemy territories too, and outside the
// Buy/Upgrade phase, and in both cases the window it would open refuses the
// purchase -- so the cursor has to say so before the click, not after.

const TOP_CELL = "#top-table td";
const BOTTOM_CELL = "#bottom-table td";
const TOP_FLAG = "#flag-top";
const BOTTOM_FLAG = "#bottom-table tr td:first-child";

test.describe("the status bars", () => {
    test("set in the theme's body font, not a hard-coded one", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "status-bars" });

        const fonts = await page.evaluate(({ top, bottom }) => {
            const family = (selector) => getComputedStyle(document.querySelector(selector)).fontFamily;
            return {
                top: family(top),
                bottom: family(bottom),
                body: getComputedStyle(document.documentElement)
                    .getPropertyValue("--font-body").trim(),
            };
        }, { top: TOP_CELL, bottom: BOTTOM_CELL });

        expect(fonts.top).toBe(fonts.body);
        expect(fonts.bottom).toBe(fonts.body);
    });

    test("fit every theme's face without either bar scrolling", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "status-bars" });
        await game.selectTerritory("Germany");

        const themeIds = await page.evaluate(async () =>
            (await import("/src/ui/theme/themes.js")).themeIds());
        expect(themeIds.length).toBeGreaterThan(1);

        for (const id of themeIds) {
            const measured = await page.evaluate(async (themeId) => {
                const { applyTheme } = await import("/src/ui/theme/theme.js");
                applyTheme(themeId);
                await new Promise((resolve) => requestAnimationFrame(resolve));
                //A wrapped cell makes the row taller than the bar's interior, and the
                //container is `overflow: auto` -- so it gains a scrollbar rather than
                //growing. That is the failure this is looking for, and it is why the
                //check is on scroll size and not on the rendered height.
                const overflows = (selector) => {
                    const bar = document.querySelector(selector);
                    return bar.scrollHeight > bar.clientHeight || bar.scrollWidth > bar.clientWidth;
                };
                return {
                    top: overflows(".top-table-container"),
                    bottom: overflows(".bottom-table-container"),
                };
            }, id);

            expect(measured.top, `top bar overflows under the ${id} theme`).toBe(false);
            expect(measured.bottom, `bottom bar overflows under the ${id} theme`).toBe(false);
        }
    });

    test("the bottom flag opens Upgrade Territory for the selected territory", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "status-bars" });
        await game.selectTerritory("Germany");

        await expect(page.locator(BOTTOM_FLAG)).toHaveCSS("cursor", "pointer");
        await page.locator(BOTTOM_FLAG).click();

        await expect(page.locator(containers.upgrade)).toBeVisible();
        //The same window the info panel's per-row upgrade button opens, and the same
        //call -- `openUpgradeWindowFor()` is the one entry point, because the window's
        //plus buttons charge `currentlySelectedTerritoryForUpgrades` and an entry point
        //that set the table without setting that would spend the wrong territory's gold.
        await expect(page.locator(upgradeWindow.subtitle)).toContainText("Germany");
    });

    test("the bottom flag is inert for a territory the player does not own", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "status-bars" });
        await game.selectTerritory("France");

        await expect(page.locator(BOTTOM_FLAG)).toHaveCSS("cursor", "auto");
        await page.locator(BOTTOM_FLAG).click();
        await expect(page.locator(containers.upgrade)).toBeHidden();
    });

    test("the top flag opens the info panel", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "status-bars" });

        await expect(page.locator(TOP_FLAG)).toHaveCSS("cursor", "pointer");
        await page.locator(TOP_FLAG).click();

        await expect(page.locator(containers.mainUi)).toBeVisible();
    });
});
