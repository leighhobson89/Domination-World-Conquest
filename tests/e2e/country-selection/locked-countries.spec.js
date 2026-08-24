import { test, expect } from "../../support/fixtures.js";
import { phaseBar } from "../../support/selectors.js";

// The five strongest countries are LOCKED on the selection screen -- audit 5.2 Z, and
// the design decision recorded in docs/05-known-issues.md section 4.
//
// This file is the regression test for how that lock was enforced before Phase 5.8. The
// guard at the top of `selectCountry()` closes before the block that offers the confirm
// button, so the only thing standing between the player and a locked country was
//
//     if (country.getAttribute("fill") === GREY_OUT_COLOR) { confirm.style.display = "none"; }
//
// -- a string comparison against a FILL. The colour picker repaints, so the lock came off
// in three clicks: click a locked country, change the colour, click it again. Measured
// before the fix, that started a real game as the United States with 11 territories.
//
// Every assertion here reads `__game.greyedOutCountries()`, which is the store, so none of
// them can be satisfied by painting.

const GREY_OUT_COLOR = "rgb(170,170,170)";

/** The countries the store says are locked, asserted non-empty. */
async function lockedCountries(page) {
    const locked = await page.evaluate(() => window.__game.greyedOutCountries());
    expect(locked.length, "the selection screen should lock the strongest countries").toBeGreaterThan(0);
    return locked;
}

/** Any territory belonging to `country`. */
async function aTerritoryOf(page, country) {
    const name = await page.evaluate((wanted) => {
        const doc = document.getElementById("svg-map").contentDocument;
        const path = [...doc.querySelectorAll("path[uniqueid]")].find(
            (p) => p.getAttribute("data-name") === wanted
        );
        return path ? path.getAttribute("territory-name") : null;
    }, country);
    expect(name, `no territory found for ${country}`).toBeTruthy();
    return name;
}

/** The fill of every path belonging to one of `countries`. */
function fillsOf(page, countries) {
    return page.evaluate((wanted) => {
        const doc = document.getElementById("svg-map").contentDocument;
        return [...doc.querySelectorAll("path[uniqueid]")]
            .filter((p) => wanted.includes(p.getAttribute("data-name")))
            .map((p) => ({
                territory: p.getAttribute("territory-name"),
                country: p.getAttribute("data-name"),
                fill: p.getAttribute("fill"),
                greyedOut: p.getAttribute("greyedOut"),
            }));
    }, countries);
}

test.describe("locked countries", () => {
    test("are painted in their own colour, muted -- not flat grey", async ({ game, page }) => {
        // Painting them flat grey made them look unrendered rather than unavailable, which
        // is exactly how it was reported. Each locked country keeps a distinct hue; what
        // marks it as locked is that the hue is muted toward grey.
        await game.open();
        await game.newGame();
        const locked = await lockedCountries(page);
        const painted = await fillsOf(page, locked);

        expect(painted.length).toBeGreaterThan(0);
        for (const entry of painted) {
            expect(entry.fill, `${entry.country} should not be painted flat grey`).not.toBe(
                GREY_OUT_COLOR
            );
            expect(entry.fill, `${entry.country} should still have a colour`).toMatch(/^rgb\(/);
        }
        const distinct = new Set(painted.map((e) => e.fill));
        expect(distinct.size, "each locked country keeps its own hue").toBeGreaterThan(1);
    });

    test("offer no confirm button, and say why", async ({ game, page }) => {
        await game.open();
        await game.newGame();
        const locked = await lockedCountries(page);
        const territory = await aTerritoryOf(page, locked[0]);

        await game.selectTerritory(territory);

        await expect(page.locator(phaseBar.confirm)).toBeHidden();
        // It names the country AND the reason, instead of naming it as if it were choosable.
        await expect(page.locator(phaseBar.body)).toContainText(locked[0]);
        await expect(page.locator(phaseBar.body)).toContainText("too strong to play");
    });

    test("cannot be unlocked by changing the player colour", async ({ game, page }) => {
        // The reported bypass, start to finish.
        await game.open();
        await game.newGame();
        const locked = await lockedCountries(page);
        const territory = await aTerritoryOf(page, locked[0]);

        await game.selectTerritory(territory);
        await page.evaluate(() => {
            const picker = document.getElementById("player-color-picker");
            picker.value = "#ff00ff";
            picker.dispatchEvent(new Event("change"));
        });

        // The locked country did not take the player colour...
        const after = await fillsOf(page, [locked[0]]);
        expect(after.every((e) => e.fill !== "rgb(255,0,255)")).toBe(true);

        // ...and clicking it again still offers nothing to confirm.
        await game.selectTerritory(territory);
        await expect(page.locator(phaseBar.confirm)).toBeHidden();
    });

    test("stay locked when the colour picker repaints the whole map", async ({ game, page }) => {
        // restoreMapColorState() replays the colours saved at bootstrap -- the TRUE ones --
        // so a colour change used to lift the lock off every locked country at once, even
        // ones the player had never clicked.
        await game.open();
        await game.newGame();
        const locked = await lockedCountries(page);

        await game.selectTerritory("Hokkaido"); // Japan: playable
        const before = await fillsOf(page, locked);
        await page.evaluate(() => {
            const picker = document.getElementById("player-color-picker");
            picker.value = "#00ff00";
            picker.dispatchEvent(new Event("change"));
        });

        const after = await fillsOf(page, locked);
        // The locked treatment itself has to survive the repaint, not just the attribute:
        // before Phase 5.8 the restore put every locked country back to its TRUE colour,
        // which is precisely what made the next click on one of them offer confirm.
        expect(
            after.map((e) => e.fill),
            "the locked treatment must survive a whole-map repaint"
        ).toEqual(before.map((e) => e.fill));
        expect(after.every((e) => e.greyedOut === "true"), "every locked path stays locked").toBe(
            true
        );
        expect(
            after.filter((e) => e.fill === "rgb(0,255,0)").map((e) => e.territory),
            "no locked country may wear the player colour"
        ).toEqual([]);
    });

    test("clicking one gives the previously picked country its own colour back", async ({
        game,
        page,
    }) => {
        // Reported from play: pick Algeria, then click Russia, and Algeria turns BLACK.
        //
        // Clicking a locked country takes the `else` arm of the guard at the top of
        // `selectCountry()`, which un-picks whatever was picked before by calling
        // `setColorOnMap(territory)` -- with no second argument. That is the IN-GAME form,
        // and it paints `territory.countryColor`, a field that is not filled in until
        // `pushColorsToMainArray()` runs on confirm. So it wrote the string "undefined" into
        // the fill, and an invalid fill renders black. The sibling branch one level up
        // always passed `true`, which reads the starting-colour table instead.
        await game.open();
        await game.newGame();

        const algeriaFill = () =>
            page.evaluate(() => {
                const doc = document.getElementById("svg-map").contentDocument;
                const path = [...doc.querySelectorAll("path[uniqueid]")].find(
                    (p) => p.getAttribute("territory-name") === "Algeria"
                );
                return path ? path.getAttribute("fill") : null;
            });

        const original = await algeriaFill();
        expect(original).toMatch(/^rgb\(/);

        await game.selectTerritory("Algeria");
        await page.mouse.move(2, 2);
        expect(await algeriaFill(), "picking it paints it the player colour").not.toBe(original);

        const locked = await lockedCountries(page);
        await game.selectTerritory(await aTerritoryOf(page, locked[0]));
        await page.mouse.move(2, 2);

        const restored = await algeriaFill();
        expect(restored, "an invalid fill renders black").not.toBe("undefined");
        // Same colour, whitespace aside -- the starting table writes it without spaces.
        expect(restored.replace(/\s/g, "")).toBe(original.replace(/\s/g, ""));
    });

    test("are coloured normally once a game has started", async ({ game, page }) => {
        // The lock is a selection-screen rule. Once the player has confirmed, the map is an
        // ordinary map again and every country carries its real colour.
        await game.start({ country: "Hokkaido" });
        expect(await page.evaluate(() => window.__game.greyedOutCountries())).toEqual([]);

        const anyStillLocked = await page.evaluate((grey) => {
            const doc = document.getElementById("svg-map").contentDocument;
            return [...doc.querySelectorAll("path[uniqueid]")].some(
                (p) => p.getAttribute("fill") === grey || p.getAttribute("greyedOut") === "true"
            );
        }, GREY_OUT_COLOR);
        expect(anyStillLocked).toBe(false);
    });
});
