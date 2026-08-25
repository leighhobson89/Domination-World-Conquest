import { test, expect } from "../../support/fixtures.js";

// Wheel zoom, its clamps, the two SVG layers staying in register, and the world
// bounds. docs/04-e2e-test-plan.md section 5.4.
//
// Phase 6.7 changed two things about zoom deliberately, at the developer's request,
// and this file changed with them:
//
//  * it is INSTANT. It used to interpolate the viewBox over 500 ms and drop any
//    wheel event that arrived mid-animation, so these tests had to poll for the
//    motion to settle before sending the next step. They no longer do.
//  * it ANCHORS ON THE POINTER, rather than centring roughly near it through two
//    hard-coded pixel offsets. `anchors the zoom on the pointer` is the new test.

const MAX_ZOOM_STEPS = 6;

// The full-world viewBox, from src/ui/map/camera.js. Nothing may ever show outside it.
const WORLD = { x: 312, y: -207, width: 1947, height: 1040 };

/** viewBox of both layers -- they must move together or the map tears. */
async function viewBoxes(page) {
    return page.evaluate(() => {
        const read = (id) => {
            const doc = document.getElementById(id).contentDocument;
            const svg = doc.querySelector("svg");
            const [x, y, width, height] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
            return { x, y, width, height };
        };
        return { map: read("svg-map"), coast: read("svg-coast-lines") };
    });
}

test.describe("zoom", () => {
    test("zooms in on a wheel-up and shrinks the viewBox", async ({ startedGame: game, page }) => {
        const before = await viewBoxes(page);
        await game.map.zoom(-100);
        const after = await viewBoxes(page);

        expect(after.map.width).toBeLessThan(before.map.width);
        expect(after.map.height).toBeLessThan(before.map.height);
    });

    test("applies every wheel event, with no animation to swallow one", async ({
        startedGame: game,
        page,
    }) => {
        // Two notches in quick succession used to move one level, because the second
        // arrived while `isAnimating` was set and was dropped on the floor.
        await game.map.zoom(-100, { steps: 2 });
        const twoSteps = (await viewBoxes(page)).map.width;

        await game.map.zoom(100, { steps: 2 });
        await game.map.zoom(-100);
        const oneStep = (await viewBoxes(page)).map.width;

        expect(twoSteps).toBeLessThan(oneStep);
    });

    test("clamps at six steps in", async ({ startedGame: game, page }) => {
        await game.map.zoom(-100, { steps: MAX_ZOOM_STEPS - 1 });
        const atMax = (await viewBoxes(page)).map.width;

        // Further wheel events past the clamp must change nothing at all.
        await game.map.zoom(-100, { steps: 2 });
        expect((await viewBoxes(page)).map.width).toBe(atMax);
    });

    test("clamps at the original view on the way back out", async ({
        startedGame: game,
        page,
    }) => {
        await game.map.zoom(-100);
        await game.map.zoom(100);
        expect((await viewBoxes(page)).map.width).toBeCloseTo(WORLD.width, 0);

        // And further wheel-downs at zoom level 1 are a no-op.
        await game.map.zoom(100, { steps: 2 });
        expect((await viewBoxes(page)).map.width).toBeCloseTo(WORLD.width, 0);
    });

    test("anchors the zoom on the pointer", async ({ startedGame: game, page }) => {
        // Zooming with the pointer in the top-left quarter must move the viewBox
        // towards the top-left; with it in the bottom-right, towards bottom-right.
        // Both are one step from the same starting view, so they are comparable.
        await game.map.zoom(-100, { at: { x: 0.25, y: 0.25 } });
        const towardsTopLeft = (await viewBoxes(page)).map;

        await game.map.zoom(100);
        await game.map.zoom(-100, { at: { x: 0.75, y: 0.75 } });
        const towardsBottomRight = (await viewBoxes(page)).map;

        expect(towardsTopLeft.width).toBeCloseTo(towardsBottomRight.width, 0);
        expect(towardsTopLeft.x).toBeLessThan(towardsBottomRight.x);
        expect(towardsTopLeft.y).toBeLessThan(towardsBottomRight.y);
    });

    test("never shows anything outside the world", async ({ startedGame: game, page }) => {
        // Zoom hard into a corner. The clamp has to win over the anchor, or the map
        // shows empty space past the edge of the map.
        for (const at of [
            { x: 0.01, y: 0.01 },
            { x: 0.99, y: 0.99 },
        ]) {
            await game.map.zoom(100, { steps: MAX_ZOOM_STEPS });
            await game.map.zoom(-100, { steps: MAX_ZOOM_STEPS - 1, at });

            const { map } = await viewBoxes(page);
            expect(map.x).toBeGreaterThanOrEqual(WORLD.x - 0.5);
            expect(map.y).toBeGreaterThanOrEqual(WORLD.y - 0.5);
            expect(map.x + map.width).toBeLessThanOrEqual(WORLD.x + WORLD.width + 0.5);
            expect(map.y + map.height).toBeLessThanOrEqual(WORLD.y + WORLD.height + 0.5);
        }
    });

    test("keeps the map and the coast-line layer in register", async ({
        startedGame: game,
        page,
    }) => {
        // Two independent <object>s with two independent viewBoxes. If they ever
        // stop moving together, the coastline detaches from the territories.
        const before = await viewBoxes(page);
        const offsetX = before.coast.x - before.map.x;
        const offsetY = before.coast.y - before.map.y;

        await game.map.zoom(-100, { steps: 2, at: { x: 0.3, y: 0.7 } });

        const after = await viewBoxes(page);
        expect(after.map.width).toBeCloseTo(after.coast.width, 2);
        expect(after.map.height).toBeCloseTo(after.coast.height, 2);
        expect(after.coast.x - after.map.x).toBeCloseTo(offsetX, 2);
        expect(after.coast.y - after.map.y).toBeCloseTo(offsetY, 2);
    });
});
