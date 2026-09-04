import { test, expect } from "../../support/fixtures.js";
import { audio, containers, ids, phaseBar } from "../../support/selectors.js";

// The audio panel: the music-note button over the map, and the six controls behind it.
//
// The unit suite (`tests/unit/platform-audio.spec.js`) already covers the parts that are
// arithmetic -- the shuffle bag, the clamping, what a restored save does to the settings --
// against stubbed `Audio` and `fetch`. None of that needs a browser.
//
// What does need one is everything to do with WHERE the controls are and whether the player
// can reach them, which is the whole reason this replaced a main-menu item: the button
// follows the map chrome, the panel is not a modal, and a setting changed here survives a
// save and a load. Those cannot be asserted anywhere else.
//
// docs/03-e2e-test-plan.md -- `options/`.

/**
 * The settings as the running game holds them.
 *
 * Through `window.__game`, not a dynamic `import()` of the module: the e2e suite runs
 * against `npm run preview`, which serves a Vite BUILD, and a build rewrites the
 * entry modules to hashed bundles -- so `/src/platform/audio.js` is a path that
 * exists under `npm run dev` and nowhere else.
 */
function settings(page) {
    return page.evaluate(() => window.__game.audio());
}

test.describe("audio panel", () => {
    test.setTimeout(180_000);

    test("the music-note button is up from the country-selection screen", async ({
        game,
        page,
    }) => {
        // The title screen has no map behind it, so no map chrome either.
        await game.open();
        await expect(page.locator(audio.buttonContainer)).toBeHidden();

        // From here the button is the ONE piece of chrome that does not wait for a
        // country to be chosen. It used to be toggled purely by `toggleMapModeButton()`,
        // which meant a player who wanted the music off had to start a game to reach the
        // control -- so the selection screen, which is the longest a player ever spends
        // on one screen, was the one screen it could not be reached from.
        await game.newGame();
        await expect(page.locator(audio.button)).toBeVisible();
        await expect(page.locator(containers.mapMode)).toBeHidden();

        // And once a game is running the two are up together, in that order down the
        // right-hand edge: music first, continent view under it.
        await game.selectTerritory("Germany");
        await page.click(phaseBar.confirm);
        await page.waitForFunction(() => window.__game && window.__game.isReady(), null, {
            timeout: 120_000,
        });
        await expect(page.locator(audio.button)).toBeVisible();
        await expect(page.locator(containers.mapMode)).toBeVisible();

        const order = await page.evaluate(
            ([musicId, mapModeId]) => ({
                music: document.getElementById(musicId).getBoundingClientRect().top,
                mapMode: document.getElementById(mapModeId).getBoundingClientRect().top,
            }),
            [ids.audioButtonContainer, ids.mapModeContainer],
        );
        expect(order.music).toBeLessThan(order.mapMode);
    });

    test("the in-game menu takes the button down and gives it back", async ({
        game,
        page,
    }) => {
        // Including on the selection screen, which is the case the extra visibility rule
        // above could most easily have broken: nothing there restores the map-mode
        // button, so nothing there would have restored this one either.
        await game.open();
        await game.newGame();
        await expect(page.locator(audio.button)).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(page.locator(audio.buttonContainer)).toBeHidden();

        await page.keyboard.press("Escape");
        await expect(page.locator(audio.button)).toBeVisible();
    });

    test("the button opens the panel and closes it again", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "audio-toggle" });
        await expect(page.locator(audio.container)).toBeHidden();

        await page.click(audio.button);
        await expect(page.locator(audio.panel)).toBeVisible();

        // The same button closes it. A control that only opens is a one-way door, which is
        // what the territory panel's globe used to be.
        await page.click(audio.button);
        await expect(page.locator(audio.container)).toBeHidden();
    });

    test("Escape closes the panel", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "audio-escape" });
        await page.click(audio.button);
        await expect(page.locator(audio.panel)).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(page.locator(audio.container)).toBeHidden();
    });

    test("the panel is not a modal -- the map is still live behind it", async ({ game, page }) => {
        // Deliberate. Volume is something a player adjusts WHILE looking at the game, so
        // there is no scrim; putting one there would make this the same interruption the
        // main-menu item was.
        await game.start({ country: "Germany", seed: "audio-nonmodal" });
        await page.click(audio.button);
        await expect(page.locator(audio.panel)).toBeVisible();

        await game.selectTerritory("France");
        await expect.poll(async () => await game.bottomTable.territoryName()).toBe("France");
        await expect(page.locator(audio.panel), "the panel stays up").toBeVisible();
    });

    test("the sliders move the volumes and the mutes flip", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "audio-controls" });
        await page.click(audio.button);

        await page.locator(audio.musicSlider).fill("20");
        await page.locator(audio.sfxSlider).fill("80");
        await expect.poll(async () => (await settings(page)).musicVolume).toBeCloseTo(0.2, 2);
        await expect.poll(async () => (await settings(page)).sfxVolume).toBeCloseTo(0.8, 2);

        expect((await settings(page)).musicMuted).toBe(false);
        await page.click(audio.musicMute);
        expect((await settings(page)).musicMuted).toBe(true);
        await page.click(audio.sfxMute);
        expect((await settings(page)).sfxMuted).toBe(true);

        // Muting must not throw the volume away -- unmuting has to know what to go back to.
        expect((await settings(page)).musicVolume).toBeCloseTo(0.2, 2);
    });

    test("a saved game remembers the audio settings", async ({ game, page }) => {
        // The whole point of `registerSaveSlice("audio", ...)`. A loaded game should sound
        // the way the saved game did; before this, a load always came back at whatever the
        // browser happened to be doing.
        await game.start({ country: "Germany", seed: "audio-save" });
        await page.click(audio.button);
        await page.locator(audio.musicSlider).fill("15");
        await page.click(audio.sfxMute);

        const code = await page.evaluate(() => window.__game.saveCode());
        expect(code, "a save code was produced").toBeTruthy();

        // Put the settings somewhere else entirely, then load the save back over them.
        // Without this the test would pass on a save that carries no audio at all.
        await page.evaluate(() =>
            window.__game.setAudio({ musicVolume: 0.95, sfxMuted: false })
        );
        expect((await settings(page)).sfxMuted).toBe(false);

        await page.evaluate((saveCode) => window.__game.loadCode(saveCode), code);

        const restored = await settings(page);
        expect(restored.musicVolume).toBeCloseTo(0.15, 2);
        expect(restored.sfxMuted).toBe(true);
    });

    test("the menu no longer carries a music button", async ({ page }) => {
        // It was removed rather than moved. Anything still reaching for `#toggle-music-btn`
        // is looking for a control that is now on the map.
        await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#toggle-music-btn")).toHaveCount(0);
    });
});
