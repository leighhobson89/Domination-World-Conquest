import { test, expect } from "../../support/fixtures.js";
import { goalSelect, menu, options } from "../../support/selectors.js";

// The Options panel and the theme it picks.
//
// The unit suite already covers the catalogue -- that every theme is complete,
// and what an unknown id resolves to. What can only be checked in a browser is
// the part that matters to the player: that choosing a theme actually repaints,
// that Done remembers it across a reload, and that Cancel puts back what was
// there. Those are three different code paths and the first two used to be one
// bug away from each other, because a preview that persisted would have made
// Cancel meaningless.
//
// docs/03-e2e-test-plan.md -- new functional area, `options/`.

/** The computed background of the menu panel, which every theme changes. */
async function panelBackground(page) {
    return page.locator(".menu-panel").evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe("options panel", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });
        await expect(page.locator(menu.newGame)).toBeEnabled({ timeout: 30_000 });
    });

    test("opens from the main menu and closes again", async ({ page }) => {
        await expect(page.locator(options.container)).toBeHidden();

        await page.click(menu.options);
        await expect(page.locator(options.panel)).toBeVisible();

        await page.click(options.done);
        await expect(page.locator(options.container)).toBeHidden();
    });

    test("Escape closes the panel", async ({ page }) => {
        await page.click(menu.options);
        await expect(page.locator(options.panel)).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(page.locator(options.container)).toBeHidden();
    });

    test("offers more than one theme, and the default is selected", async ({ page }) => {
        await page.click(menu.options);

        const values = await page
            .locator(`${options.themeSelect} option`)
            .evaluateAll((nodes) => nodes.map((n) => n.value));

        expect(values.length).toBeGreaterThan(1);
        expect(values).toContain("command");
        await expect(page.locator(options.themeSelect)).toHaveValue("command");
    });

    test("changing the dropdown repaints immediately, before anything is confirmed", async ({
        page,
    }) => {
        const before = await panelBackground(page);

        await page.click(menu.options);
        await page.selectOption(options.themeSelect, "parchment");

        await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");
        expect(await panelBackground(page)).not.toBe(before);
    });

    test("the description follows the selected theme", async ({ page }) => {
        await page.click(menu.options);

        const first = await page.locator(options.themeDescription).innerText();
        await page.selectOption(options.themeSelect, "terminal");
        const second = await page.locator(options.themeDescription).innerText();

        expect(second).not.toBe(first);
        expect(second.length).toBeGreaterThan(0);
    });

    test("Done keeps the choice across a reload", async ({ page }) => {
        await page.click(menu.options);
        await page.selectOption(options.themeSelect, "midnight");
        await page.click(options.done);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(menu.newGame)).toBeEnabled({ timeout: 30_000 });

        await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    });

    test("Cancel puts back the theme that was in force when the panel opened", async ({
        page,
    }) => {
        // Commit one theme first, so Cancel has something other than the default
        // to restore -- otherwise the assertion passes for the wrong reason.
        await page.click(menu.options);
        await page.selectOption(options.themeSelect, "crimson");
        await page.click(options.done);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "crimson");

        await page.click(menu.options);
        await page.selectOption(options.themeSelect, "arctic");
        await expect(page.locator("html")).toHaveAttribute("data-theme", "arctic");

        await page.click(options.cancel);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "crimson");
    });

    test("the theme survives starting a game", async ({ page }) => {
        await page.click(menu.options);
        await page.selectOption(options.themeSelect, "terminal");
        await page.click(options.done);

        await page.click(menu.newGame);
        //The goal chooser, which every new game opens on. It is the first screen the theme
        //has to survive now, and it shares the Options panel's scrim and buttons, so it is
        //worth asserting that it arrives themed rather than in the default palette.
        await expect(page.locator(goalSelect.panel)).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "terminal");

        await page.click(goalSelect.confirm);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "terminal");
    });
});
