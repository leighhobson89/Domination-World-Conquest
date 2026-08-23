import { test, expect } from "../../support/fixtures.js";

// Wheel zoom, its clamps, and the two SVG layers staying in register.
// docs/04-e2e-test-plan.md section 5.4.

const MAX_ZOOM_STEPS = 6;

/** viewBox width of both layers -- they must move together or the map tears. */
async function viewBoxes(page) {
    return page.evaluate(() => {
        const read = (id) => {
            const doc = document.getElementById(id).contentDocument;
            const svg = doc.querySelector("svg");
            const [, , width, height] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
            return { width, height };
        };
        return { map: read("svg-map"), coast: read("svg-coast-lines") };
    });
}

/**
 * zoomMap() animates and ignores wheel events while `isAnimating` is set, so one
 * step means: send a wheel, then wait for the viewBox to stop moving.
 */
async function zoomStep(page, game, deltaY) {
    const before = (await viewBoxes(page)).map.width;
    await game.map.zoom(deltaY);
    await expect
        .poll(async () => (await viewBoxes(page)).map.width, { timeout: 10_000 })
        .not.toBe(before);
    // Let the animation settle before the next step, otherwise it is dropped.
    let last = null;
    await expect
        .poll(
            async () => {
                const current = (await viewBoxes(page)).map.width;
                const settled = current === last;
                last = current;
                return settled;
            },
            { timeout: 10_000 }
        )
        .toBe(true);
}

test.describe("zoom", () => {
    test("zooms in on a wheel-up and shrinks the viewBox", async ({ startedGame: game, page }) => {
        const before = await viewBoxes(page);
        await zoomStep(page, game, -100);
        const after = await viewBoxes(page);

        expect(after.map.width).toBeLessThan(before.map.width);
        expect(after.map.height).toBeLessThan(before.map.height);
    });

    test("clamps at six steps in", async ({ startedGame: game, page }) => {
        for (let i = 0; i < MAX_ZOOM_STEPS - 1; i += 1) {
            await zoomStep(page, game, -100);
        }
        const atMax = await viewBoxes(page);

        // One more wheel event past the clamp must change nothing at all.
        await game.map.zoom(-100);
        await game.map.zoom(-100);
        await expect
            .poll(async () => (await viewBoxes(page)).map.width, { timeout: 10_000 })
            .toBe(atMax.map.width);
    });

    test("clamps at the original view on the way back out", async ({ startedGame: game, page }) => {
        const original = await viewBoxes(page);

        await zoomStep(page, game, -100);
        await zoomStep(page, game, 100);

        await expect
            .poll(async () => (await viewBoxes(page)).map.width, { timeout: 10_000 })
            .toBeCloseTo(original.map.width, 0);

        // And further wheel-downs at zoom level 1 are a no-op.
        await game.map.zoom(100);
        await game.map.zoom(100);
        await expect
            .poll(async () => (await viewBoxes(page)).map.width, { timeout: 10_000 })
            .toBeCloseTo(original.map.width, 0);
    });

    test("keeps the map and the coast-line layer in register", async ({
        startedGame: game,
        page,
    }) => {
        // Two independent <object>s with two independent viewBoxes. If they ever
        // stop moving together, the coastline detaches from the territories.
        const before = await viewBoxes(page);
        const ratioBefore = before.map.width / before.coast.width;

        await zoomStep(page, game, -100);
        await zoomStep(page, game, -100);

        const after = await viewBoxes(page);
        expect(after.map.width / after.coast.width).toBeCloseTo(ratioBefore, 2);
    });
});
