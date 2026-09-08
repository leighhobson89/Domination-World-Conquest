import { test, expect } from "../../support/fixtures.js";

// The animated attack arrows drawn from the selected territory to each enemy it may
// attack. docs/03-e2e-test-plan.md section 5.4.
//
// What is checked HERE and what is checked in `tests/unit/ui-arrow-geometry.spec.js`
// is a deliberate split, and it is the same one the Dominapedia and the move button
// have. The geometry -- which arrow bows which way, how short an arrow may be, how the
// band's cycle is derived -- is arithmetic, so it is settled in Node in a millisecond.
// What can only be asked of a running browser is here: that the layer is in the map's
// own document at all, that it holds one arrow per ATTACKABLE territory rather than one
// per reachable one, that it comes off when the selection does, and that a zoom
// re-derives it. `getTotalLength()` is a browser fact too -- a Bezier's length is not
// its chord.

/**
 * The enemy territories the arrows should point at.
 *
 * Derived from the `attackableTerritory` FLAGS the highlight sets rather than from
 * `interactableFrom()`, because the flags are the same set the arrows are drawn from --
 * asking a second source would make this a test of two derivations agreeing rather than
 * of the arrows being right.
 */
async function attackableEnemyIds(game) {
    const flagged = await game.map.attackableTerritories();
    const ids = [];
    for (const name of flagged) {
        const territory = await game.territory(name);
        if (territory && territory.owner !== "Player") {
            ids.push(String(territory.uniqueId));
        }
    }
    return ids;
}

/**
 * Put the player at war with everything Germany can reach, then select it.
 *
 * AN ARROW MEANS "YOU CAN ATTACK HERE", and since the diplomacy phase that is a question
 * about the register rather than about reach: every pair starts NEUTRAL, and no arrow is
 * drawn at a country the player is not at war with. The hatched highlight still covers
 * them, because the hatch means REACHABLE and they are -- which is what the last test in
 * this file pins.
 *
 * Declaring on ALL of them rather than on one is what keeps the fan of arrows the subject:
 * with a single declaration these tests would assert a fan against a world where one arrow
 * of the fan is legal.
 */
async function selectAtWar(game, source) {
    await game.endBuyPhase();
    await game.declareWarOnReachable(source);
    await game.selectOnMap(source);
}

test.describe("attack arrows", () => {
    test("draws one arrow per attackable territory when an owned one is selected", async ({
        startedGame: game,
    }) => {
        await selectAtWar(game, "Germany");

        const expected = await attackableEnemyIds(game);
        expect(expected.length).toBeGreaterThan(0);

        await expect.poll(async () => (await game.map.attackArrows()).length).toBe(expected.length);

        const drawn = await game.map.attackArrows();
        expect(drawn.map((arrow) => arrow.uniqueId).sort()).toEqual([...expected].sort());
    });

    test("points at the enemies only -- the player's own neighbours are a transfer", async ({
        startedGame: game,
    }) => {
        await selectAtWar(game, "Germany");
        await expect.poll(async () => (await game.map.attackArrows()).length).toBeGreaterThan(0);

        const drawnIds = new Set((await game.map.attackArrows()).map((arrow) => arrow.uniqueId));
        for (const name of await game.map.attackableTerritories()) {
            const territory = await game.territory(name);
            if (territory?.owner === "Player") {
                expect(drawnIds.has(String(territory.uniqueId))).toBe(false);
            }
        }
    });

    test("gives every arrow a band that travels, and lets clicks through", async ({
        startedGame: game,
    }) => {
        await selectAtWar(game, "Germany");
        await expect.poll(async () => (await game.map.attackArrows()).length).toBeGreaterThan(0);

        for (const arrow of await game.map.attackArrows()) {
            // One <animate> on the shaft. The band is a dash pattern whose period is
            // longer than the path, so exactly one band is ever on an arrow.
            expect(arrow.animations).toBe(1);
            const [band, total] = arrow.dashArray.split(/[\s,]+/).map(Number);
            expect(band).toBeGreaterThan(0);
            expect(band).toBeLessThan(total);
            // A decoration must never intercept a click: these run across the middle
            // of the territories they point at, and clicking one is how a player picks
            // the target the arrow is advertising.
            expect(arrow.pointerEvents).toBe("none");
        }
    });

    test("comes off the map when the selection is cleared", async ({ startedGame: game, page }) => {
        await selectAtWar(game, "Germany");
        await expect.poll(async () => (await game.map.attackArrows()).length).toBeGreaterThan(0);

        // A click on the sea repaints the map, which is the one route the decorations
        // are undone by.
        await page.evaluate(() => {
            document
                .getElementById("svg-map")
                .contentDocument.querySelector("rect")
                .dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        await expect.poll(async () => (await game.map.attackArrows()).length).toBe(0);
    });

    test("draws no arrow at a country the player is not at war with", async ({
        startedGame: game,
    }) => {
        //THE DIPLOMATIC GATE, on the map. Every pair starts NEUTRAL, so with no declaration
        //at all there is nothing to attack and no arrow to draw -- while the hatched
        //highlight still covers those same territories, because the hatch means REACHABLE
        //and they are. That distinction is the whole reason the arrows are filtered and the
        //highlight is not: an arrow is a promise the move button would then refuse, and a
        //province the player cannot reach at all is a different fact from one they may not
        //yet attack.
        await game.endBuyPhase();
        await game.selectOnMap("Germany");

        const reachableEnemies = await attackableEnemyIds(game);
        expect(reachableEnemies.length).toBeGreaterThan(0);
        expect(await game.map.attackArrows()).toHaveLength(0);

        //And they come back the moment war is declared, from the same selection.
        await game.declareWarOnReachable("Germany");
        await game.selectOnMap("Germany");
        await expect
            .poll(async () => (await game.map.attackArrows()).length)
            .toBe(reachableEnemies.length);
    });

    test("draws nothing in the Buy/Upgrade phase", async ({ startedGame: game }) => {
        await game.selectOnMap("Germany");
        expect(await game.map.attackArrows()).toHaveLength(0);
    });

    test("redraws on a zoom, thinner in map units so it holds its size on screen", async ({
        startedGame: game,
    }) => {
        await selectAtWar(game, "Germany");
        await expect.poll(async () => (await game.map.attackArrows()).length).toBeGreaterThan(0);

        const before = await game.map.attackArrows();
        await game.map.zoom(-100, { steps: 3 });
        await game.map.settle();
        await expect
            .poll(async () => (await game.map.attackArrows())[0]?.strokeWidth)
            .toBeLessThan(before[0].strokeWidth);

        const after = await game.map.attackArrows();
        // Same arrows, re-derived rather than merely rescaled: one per target still.
        expect(after).toHaveLength(before.length);
        expect(after.map((arrow) => arrow.uniqueId).sort()).toEqual(
            before.map((arrow) => arrow.uniqueId).sort()
        );
        // And each still carries its own band, because the cycle is derived from the
        // new length rather than left at the old one.
        for (const arrow of after) {
            expect(arrow.animations).toBe(1);
        }
    });
});
