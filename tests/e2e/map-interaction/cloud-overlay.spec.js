// The weather over the world.
// docs/03-e2e-test-plan.md section 5.4.
//
// Two forms of cloud that the zoom cross-fades between -- storm systems seen from orbit when the
// whole world is on screen, individual cartoon clouds with shadows on the ground when it is not.
//
// WHAT IS ASSERTED AND WHAT IS NOT. Nothing about how it looks: the shapes, the palette, the
// counts and the speeds are all matters of taste and a spec that pinned them would fail on the
// next tweak. What is asserted is the structure only a browser can answer for, and it is four
// things. That the button walks three states and the sky follows. That the two forms swap over
// with the zoom, which is the whole design. That the clouds are the ONE overlay measured in map
// user units -- everything else on this map is sized in screen pixels, and getting this one
// backwards would mean the sky stayed the same size as you flew down toward the ground. And that
// the sky never intercepts a click, which is the rule every decoration on this map follows and
// the one whose failure is worst: a cloud that swallowed a click would make territories under it
// unselectable, intermittently, as the weather moved.

import { test, expect } from "../../support/fixtures.js";
import { ids } from "../../support/selectors.js";

const skyState = (page) =>
    page.evaluate(([mapId, layerId]) => {
        const doc = document.getElementById(mapId).contentDocument;
        const layer = doc.getElementById(layerId);
        if (!layer) {
            return { present: false };
        }
        const band = (name) => layer.querySelector("." + name);
        const opacityOf = (name) => Number(band(name)?.getAttribute("opacity") ?? -1);
        const puff = layer.querySelector(".cloud-puff");
        return {
            present: true,
            opacity: Number(layer.getAttribute("opacity")),
            masses: layer.querySelectorAll(".cloud-mass").length,
            puffs: layer.querySelectorAll(".cloud-puff").length,
            shadows: layer.querySelectorAll(".cloud-shadow").length,
            weather: opacityOf("cloud-weather"),
            puffBand: opacityOf("cloud-puffs"),
            puffTransform: puff?.getAttribute("transform") ?? null,
            hasKeyframes: (layer.querySelector("style")?.textContent ?? "").includes("@keyframes")
        };
    }, [ids.svgMap, ids.cloudLayer]);

test.describe("the clouds", () => {
    test("are on by default, and the button walks full, half, off", async ({
        startedGame: game,
        page,
    }) => {
        const button = page.locator("#" + ids.cloudOverlayButton);

        //A NEW GAME OPENS WITH WEATHER. Applied rather than declared, the same rule the opening
        //map view follows -- declaring it would leave the button saying "full" over a clear sky.
        await expect(button).toHaveAttribute("data-clouds", "full");
        const opening = await skyState(page);
        expect(opening.present).toBe(true);
        expect(opening.opacity).toBe(1);
        expect(opening.masses).toBeGreaterThan(0);
        expect(opening.puffs).toBeGreaterThan(0);
        //Every cloud casts one, and only one.
        expect(opening.shadows).toBe(opening.puffs);
        //The cycles are CSS, injected into the map's own document -- the per-frame work is the
        //browser's, and only the drift is JavaScript's.
        expect(opening.hasKeyframes).toBe(true);

        await button.click();
        await expect(button).toHaveAttribute("data-clouds", "half");
        expect((await skyState(page)).opacity).toBeCloseTo(0.45, 2);

        await button.click();
        await expect(button).toHaveAttribute("data-clouds", "off");
        //OFF TAKES THE GROUP OUT rather than making it transparent: an invisible overlay is
        //still an overlay the renderer walks, and the drift loop stops with it.
        expect((await skyState(page)).present).toBe(false);

        await button.click();
        await expect(button).toHaveAttribute("data-clouds", "full");
        expect((await skyState(page)).present).toBe(true);
    });

    test("swap storm systems for individual clouds as the map is zoomed into", async ({
        startedGame: game,
        page,
    }) => {
        //THE WHOLE DESIGN. Two forms, and the zoom decides which one you are looking at: the
        //world map is weather seen from orbit and a zoomed-in view is clouds seen from below.
        //A single form that tried to be both would be wrong at one end or the other.
        const out = await skyState(page);
        expect(out.weather).toBeGreaterThan(0.9);
        expect(out.puffBand).toBeLessThan(0.1);

        await game.map.zoom(-400, { steps: 5 });

        const inClose = await skyState(page);
        expect(inClose.weather).toBeLessThan(0.1);
        expect(inClose.puffBand).toBeGreaterThan(0.9);
    });

    test("are measured in map user units, not screen pixels", async ({
        startedGame: game,
        page,
    }) => {
        //THE ONE OVERLAY ON THIS MAP THAT SCALES WITH THE LAND, and deliberately. A label, a
        //flag and a border are chrome and hold their size on screen as the camera moves; a cloud
        //is an object sitting over the world, so it has to magnify with the world or zooming in
        //would fly the player toward the ground while the sky stayed put. The check is that a
        //puff's own drawn size never changes: only the camera does.
        const sizeOf = () => page.evaluate(([mapId, layerId]) => {
            const doc = document.getElementById(mapId).contentDocument;
            const lobe = doc.getElementById(layerId).querySelector(".cloud-puff ellipse");
            return Number(lobe.getAttribute("rx"));
        }, [ids.svgMap, ids.cloudLayer]);

        const before = await sizeOf();
        await game.map.zoom(-400, { steps: 4 });
        expect(await sizeOf()).toBe(before);
    });

    test("drift, and never swallow a click", async ({ startedGame: game, page }) => {
        await game.map.zoom(-400, { steps: 5 });
        const first = (await skyState(page)).puffTransform;
        expect(first).not.toBeNull();

        await expect
            .poll(async () => (await skyState(page)).puffTransform, { timeout: 4000 })
            .not.toBe(first);

        //A DECORATION MUST NEVER INTERCEPT A CLICK, the rule the siege markers and `#tooltip`
        //follow. Clouds move, so a cloud that took a click would make a territory unselectable
        //at some moments and not others -- the worst possible version of this bug.
        //
        //Back out to the world view first: at full zoom the camera is over the middle of the
        //map and France is off screen, which Playwright reports as a click that never lands --
        //a failure that reads exactly like the bug this line is looking for.
        await game.map.zoom(400, { steps: 5 });
        await game.map.click("France");
        await expect.poll(async () => await game.bottomTable.territoryName()).toBe("France");
    });
});
