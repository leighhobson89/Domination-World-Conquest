// The owner-flag overlay.
// docs/02-e2e-test-plan.md section 5.4.
//
// A flag on each territory showing who holds it NOW -- an overlay rather than a view, so it
// composes with whichever map view is up instead of replacing one.
//
// WHAT IS ASSERTED HERE AND WHAT IS NOT. Nothing about how it looks: the chip size, the plate
// and the fit margin are all matters of taste and a spec that pinned them would fail on the
// next tweak. What only a browser can answer is asserted, and there are three such things.
// **That the image URL actually resolves to an image** -- the first version of this drew a
// relative href inside the map's own document, which is right under `npm run dev` and wrong in
// a build, where Vite hashes the SVG into `/assets/` and the relative path then points at
// nothing; the preview server answers with `index.html` and a 200, so no request looks like it
// failed and the map simply carries several hundred broken-image glyphs. **That the chips are
// sized in screen pixels**, which is a claim about the camera and cannot be made in Node. And
// **that a territory never carries both a flag and a force figure**, which is a claim about two
// overlays that do not import each other.

import { test, expect } from "../../support/fixtures.js";
import { ids } from "../../../src/ui/core/registry.js";

/** Every flag chip in the map document: which territory, and how wide it was drawn. */
const flagsOn = (page) =>
    page.evaluate(([mapId, layerId]) => {
        const doc = document.getElementById(mapId).contentDocument;
        const layer = doc.getElementById(layerId);
        if (!layer) {
            return [];
        }
        return Array.from(layer.querySelectorAll("image")).map(image => ({
            country: image.getAttribute("data-flag"),
            href: image.getAttribute("href"),
            width: Number(image.getAttribute("width"))
        }));
    }, [ids.svgMap, ids.flagLayer]);

/** The territories carrying a force figure, by the text they show. */
const labelsOn = (page) =>
    page.evaluate((layerId) => {
        const doc = document.getElementById("svg-map").contentDocument;
        const layer = doc.getElementById(layerId);
        return Array.from(layer?.querySelectorAll("text") ?? []).map(node => node.textContent);
    }, ids.militaryLabelLayer);

test.describe("the owner flags", () => {
    test("go up and come down with their own button", async ({ startedGame: game, page }) => {
        const button = page.locator("#" + ids.flagOverlayButton);

        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute("aria-pressed", "false");
        expect(await flagsOn(page)).toHaveLength(0);

        await button.click();

        await expect(button).toHaveAttribute("aria-pressed", "true");
        const flags = await flagsOn(page);
        expect(flags.length).toBeGreaterThan(20);
        //A flag is the CURRENT owner's, so on turn 1 the map is full of different ones rather
        //than one country repeated -- the cheapest available check that it is reading the
        //world and not a constant.
        expect(new Set(flags.map(flag => flag.country)).size).toBeGreaterThan(20);

        await button.click();

        await expect(button).toHaveAttribute("aria-pressed", "false");
        expect(await flagsOn(page)).toHaveLength(0);
    });

    test("point at a file the server will actually serve as an image", async ({
        startedGame: game,
        page,
    }) => {
        //THE BUG THIS GUARDS, and it is invisible in the dev server. The map is an `<object>`
        //with its own document, and a build hashes that document to `/assets/svgMaster-<hash>
        //.svg` -- so a relative href resolves somewhere different in a build from where it
        //resolves in development. Asserting the STATUS is not enough: the preview server
        //answers an unknown path with `index.html` and a 200. The content type is the test.
        await page.locator("#" + ids.flagOverlayButton).click();
        const flags = await flagsOn(page);
        expect(flags.length).toBeGreaterThan(0);

        const types = await page.evaluate(async (hrefs) => {
            const seen = [];
            for (const href of hrefs) {
                const response = await fetch(href);
                seen.push(`${response.status} ${response.headers.get("content-type")}`);
            }
            return seen;
        }, flags.slice(0, 5).map(flag => flag.href));

        for (const type of types) {
            expect(type).toMatch(/^200 image\//);
        }
    });

    test("keep their size on screen as the map is zoomed into", async ({
        startedGame: game,
        page,
    }) => {
        //The rule every line and label on this map follows: a chip drawn in map user units is
        //magnified with the land, so its width in USER units has to fall as the zoom rises for
        //its width on SCREEN to stay put.
        await page.locator("#" + ids.flagOverlayButton).click();
        const before = await flagsOn(page);
        expect(before.length).toBeGreaterThan(0);

        await game.map.zoom(-400, { steps: 4 });

        const after = await flagsOn(page);
        expect(after.length).toBeGreaterThan(0);
        expect(after[0].width).toBeLessThan(before[0].width);
        //And zooming in is the decluttering: more territories are big enough on screen to hold
        //a chip, so more of them carry one.
        expect(after.length).toBeGreaterThan(before.length);
    });

    test("never sit on a territory that is already showing a force figure", async ({
        startedGame: game,
        page,
    }) => {
        //THE DIVISION THE TWO OVERLAYS KEEP. The military view draws a garrison in the middle
        //of every frontier territory, which is exactly where a flag wants to go, so the flags
        //stand back there: the war zone is measured and the rest of the world is named. The
        //two modules do not import each other, so this is the only place the arrangement can
        //be checked.
        await page.locator("#" + ids.flagOverlayButton).click();
        const political = await flagsOn(page);

        await game.map.setContinentView("military");
        await expect.poll(async () => (await labelsOn(page)).length).toBeGreaterThan(0);

        const military = await flagsOn(page);
        expect(military.length).toBeLessThan(political.length);

        const overlap = await page.evaluate(([mapId, flagId, labelId]) => {
            const doc = document.getElementById(mapId).contentDocument;
            const centres = new Set();
            for (const label of doc.getElementById(labelId).querySelectorAll("text")) {
                centres.add(`${label.getAttribute("x")}|${label.getAttribute("y")}`);
            }
            //A chip is placed from the same bounding box the figure is, so a territory carrying
            //both would put them within half a chip of one another. Comparing centres is what
            //makes this a test of the RULE rather than of a list of ids.
            let clashes = 0;
            for (const image of doc.getElementById(flagId).querySelectorAll("image")) {
                const x = Number(image.getAttribute("x")) + Number(image.getAttribute("width")) / 2;
                const y = Number(image.getAttribute("y")) + Number(image.getAttribute("height")) / 2;
                for (const centre of centres) {
                    const [labelX, labelY] = centre.split("|").map(Number);
                    if (Math.abs(labelX - x) < 1 && Math.abs(labelY - y) < 1) {
                        clashes++;
                    }
                }
            }
            return clashes;
        }, [ids.svgMap, ids.flagLayer, ids.militaryLabelLayer]);

        expect(overlap).toBe(0);
    });
});
