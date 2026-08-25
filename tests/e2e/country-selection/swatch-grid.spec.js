import { test, expect } from "../../support/fixtures.js";
import { phaseBar } from "../../support/selectors.js";

// The themed swatch grid that replaced the browser's colour dialog.
//
// `tests/unit/ui-colour-picker.spec.js` covers the palette itself -- 256 entries, all
// distinct, all valid hex -- which needs no browser. What needs one is the two things
// the OS dialog could not do, and which are the entire reason it was replaced:
//
//   * the grid is IN the page, so the theme reaches it and the map behind it stays
//     visible while a colour is being chosen;
//   * clicking a swatch repaints the map immediately, rather than when a modal is
//     dismissed.
//
// There is also a regression here worth its own name. The phase bar's colour control
// is a `<label>`, and it used to carry `for="player-color-picker"`. Clicking it
// therefore ACTIVATED the input as well as opening the grid, so the operating
// system's dialog opened on top of the thing that was meant to replace it.
//
// docs/04-e2e-test-plan.md -- `country-selection/`.

const MULTI = "United Kingdom";

test.describe("player colour swatch grid", () => {
    test.setTimeout(180_000);

    test.beforeEach(async ({ game }) => {
        await game.open();
        await game.newGame();
        // The colour control is only offered once a country has been clicked.
        await game.selectTerritory("France");
    });

    test("the label opens the grid and opens it with 256 swatches", async ({ page }) => {
        await expect(page.locator(phaseBar.colourPanel)).toBeHidden();

        await page.click(phaseBar.colourLabel);
        await expect(page.locator(phaseBar.colourPanel)).toBeVisible();
        await expect(page.locator(`${phaseBar.colourGrid} .colour-swatch`)).toHaveCount(256);
    });

    test("the label closes the grid again", async ({ page }) => {
        await page.click(phaseBar.colourLabel);
        await expect(page.locator(phaseBar.colourPanel)).toBeVisible();

        await page.click(phaseBar.colourLabel);
        await expect(page.locator(phaseBar.colourPanel)).toBeHidden();
    });

    test("the label does not open the operating system's colour dialog", async ({ page }) => {
        // The dialog is drawn by the OS and is invisible to Playwright, so what is
        // asserted is the thing that summoned it: a `<label for>` pointing at the
        // `<input type="color">` activates that input on click. There must be no such
        // pointer, and the input must be out of reach.
        const label = page.locator(phaseBar.colourLabel);
        expect(await label.getAttribute("for"), "the label must not target the input").toBeNull();

        const input = page.locator(phaseBar.colourPicker);
        await expect(input, "the value holder is off screen, not a control").toBeHidden();
    });

    test("clicking a swatch repaints the map without closing the grid", async ({ game, page }) => {
        await page.click(phaseBar.colourLabel);

        // A saturated swatch from the middle of the grid, whatever the palette makes it.
        const swatch = page.locator(`${phaseBar.colourGrid} .colour-swatch`).nth(120);
        const chosen = await swatch.getAttribute("data-colour");

        await swatch.click();
        await expect(page.locator(phaseBar.colourPicker)).toHaveValue(chosen);

        // Choosing by eye is only possible if the grid stays up while the map changes.
        await expect(page.locator(phaseBar.colourPanel), "the grid stays open").toBeVisible();

        await game.selectTerritory(MULTI);
        await page.mouse.move(1, 1);
        await expect
            .poll(async () => await game.map.fill("United Kingdom"))
            .toBe(hexToRgbString(chosen));
    });

    test("the chosen swatch is marked, and the preview shows it", async ({ page }) => {
        await page.click(phaseBar.colourLabel);
        const swatch = page.locator(`${phaseBar.colourGrid} .colour-swatch`).nth(90);
        const chosen = await swatch.getAttribute("data-colour");
        await swatch.click();

        await expect(page.locator(`${phaseBar.colourGrid} .colour-swatch.is-selected`)).toHaveCount(1);
        await expect(
            page.locator(`${phaseBar.colourGrid} .colour-swatch.is-selected`)
        ).toHaveAttribute("data-colour", chosen);

        const preview = await page
            .locator(phaseBar.colourPreview)
            .evaluate((node) => getComputedStyle(node).backgroundColor);
        expect(preview).toBe(hexToRgbString(chosen, true));
    });

    test("picking a colour does not repaint the label that opened the grid", async ({
        page,
    }) => {
        // The label used to BE the preview: two places wrote `style.color = playerColour()`
        // on it after every pick, and a `::before` chip took the same colour. So the words
        // "Select Player Color" turned whatever the player had just chosen -- which on any
        // colour near the panel's own background made the control unreadable, and on a
        // themed UI made one element in the phase bar ignore the theme.
        //
        // The preview is in the grid's own header and on the marked swatch, both asserted
        // above. What is asserted here is that the label is not a third copy of it: its
        // colour is the theme's before the pick and the same afterwards.
        const labelColour = () =>
            page
                .locator(phaseBar.colourLabel)
                .evaluate((node) => getComputedStyle(node).color);

        const before = await labelColour();

        await page.click(phaseBar.colourLabel);
        const swatch = page.locator(`${phaseBar.colourGrid} .colour-swatch`).nth(150);
        const chosen = await swatch.getAttribute("data-colour");
        await swatch.click();
        await expect(page.locator(phaseBar.colourPicker)).toHaveValue(chosen);

        expect(await labelColour()).toBe(before);
        // ...and nothing wrote it inline, which is the mechanism rather than the symptom.
        expect(
            await page.locator(phaseBar.colourLabel).evaluate((node) => node.style.color)
        ).toBe("");
    });

    test("Escape closes the grid", async ({ page }) => {
        await page.click(phaseBar.colourLabel);
        await expect(page.locator(phaseBar.colourPanel)).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(page.locator(phaseBar.colourPanel)).toBeHidden();
    });
});

/**
 * `#rrggbb` as the map writes it.
 *
 * The map's `fill` attribute is written as `rgb(r,g,b)` with no spaces; a computed
 * style comes back as `rgb(r, g, b)` with them. One helper, one flag.
 */
function hexToRgbString(hex, spaced = false) {
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    return spaced ? `rgb(${r}, ${g}, ${b})` : `rgb(${r},${g},${b})`;
}
