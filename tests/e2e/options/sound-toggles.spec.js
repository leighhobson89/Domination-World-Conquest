import { test, expect } from "../../support/fixtures.js";
import { audio, menu, options } from "../../support/selectors.js";

// The two sound switches in the main menu's Options panel.
//
// They are the same two mutes the audio panel over the map already has, and that
// duplication is the point: the audio panel hangs off a button over the map, and the
// map is not on screen at the title. "Turn the music off" is the first thing some
// players do, and until this landed the only place to do it was inside a game.
//
// Because there are now two views of one setting, the thing worth asserting is not
// that a switch flips -- `tests/unit/platform-audio.spec.js` covers `setMusicMuted()`
// against a stubbed `Audio` and needs no browser -- but that the two views cannot
// disagree, in both directions, and that Cancel means cancel here as it already did
// for the theme.
//
// docs/04-e2e-test-plan.md -- `options/`.

/** The settings as the running game holds them, through `window.__game`. */
function settings(page) {
    return page.evaluate(() => window.__game.audio());
}

async function openOptions(page) {
    await page.click(menu.options);
    await expect(page.locator(options.panel)).toBeVisible();
}

test.describe("options sound switches", () => {
    test.setTimeout(180_000);

    test.beforeEach(async ({ game }) => {
        await game.open();
    });

    test("both switches are reachable from the title screen, before any game", async ({
        page,
    }) => {
        await openOptions(page);
        // Checked means AUDIBLE. `audio.js` stores the opposite -- `musicMuted` -- and
        // the inversion happens in exactly one place, which is what this pins.
        await expect(page.locator(options.musicToggle)).toBeChecked();
        await expect(page.locator(options.sfxToggle)).toBeChecked();
        expect(await settings(page)).toMatchObject({ musicMuted: false, sfxMuted: false });
    });

    test("unchecking a switch mutes, and Done keeps it muted", async ({ page }) => {
        await openOptions(page);

        await page.uncheck(options.musicToggle);
        expect(await settings(page)).toMatchObject({ musicMuted: true, sfxMuted: false });

        await page.uncheck(options.sfxToggle);
        expect(await settings(page)).toMatchObject({ musicMuted: true, sfxMuted: true });

        await page.click(options.done);
        await expect(page.locator(options.container)).toBeHidden();
        expect(await settings(page)).toMatchObject({ musicMuted: true, sfxMuted: true });

        // And they are still muted when the panel is opened again, rather than the
        // switches merely remembering their own last position.
        await openOptions(page);
        await expect(page.locator(options.musicToggle)).not.toBeChecked();
        await expect(page.locator(options.sfxToggle)).not.toBeChecked();
    });

    test("Cancel puts both mutes back the way they were", async ({ page }) => {
        // Commit one of them first, so Cancel has something other than the defaults to
        // restore to -- restoring to false would pass either way.
        await openOptions(page);
        await page.uncheck(options.sfxToggle);
        await page.click(options.done);

        await openOptions(page);
        await page.uncheck(options.musicToggle);
        await page.check(options.sfxToggle);
        expect(await settings(page)).toMatchObject({ musicMuted: true, sfxMuted: false });

        await page.click(options.cancel);
        await expect(page.locator(options.container)).toBeHidden();
        expect(await settings(page)).toMatchObject({ musicMuted: false, sfxMuted: true });
    });

    test("Escape cancels, exactly as the Cancel button does", async ({ page }) => {
        await openOptions(page);
        await page.uncheck(options.musicToggle);
        expect(await settings(page)).toMatchObject({ musicMuted: true });

        await page.keyboard.press("Escape");
        await expect(page.locator(options.container)).toBeHidden();
        expect(await settings(page)).toMatchObject({ musicMuted: false });
    });

    test("the switches and the audio panel over the map are one setting", async ({
        game,
        page,
    }) => {
        // Menu -> map. Mute from Options, then look at the panel over the map.
        await openOptions(page);
        await page.uncheck(options.musicToggle);
        await page.click(options.done);

        await game.newGame();
        await page.click(audio.button);
        await expect(page.locator(audio.musicMute)).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator(audio.sfxMute)).toHaveAttribute("aria-pressed", "false");

        // Map -> menu. Unmute from the panel, mute the effects, then reopen Options.
        await page.click(audio.musicMute);
        await page.click(audio.sfxMute);
        await page.click(audio.button);

        await page.click(menu.hamburger);
        await expect(page.locator(menu.options)).toBeVisible();
        await openOptions(page);
        await expect(page.locator(options.musicToggle)).toBeChecked();
        await expect(page.locator(options.sfxToggle)).not.toBeChecked();
    });
});
