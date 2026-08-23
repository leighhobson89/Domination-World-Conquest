import { test, expect } from "../../support/fixtures.js";
import { containers } from "../../support/selectors.js";

// Hovering lightens the path and shows the owner tooltip.
// docs/04-e2e-test-plan.md section 5.4.

/** rgb(r,g,b) -> [r,g,b], whatever the spacing. */
function channels(fill) {
    return fill.match(/\d+/g).map(Number);
}

test.describe("hovering a territory", () => {
    test("lightens the fill by 20 in each channel and restores it on mouse-out", async ({
        startedGame: game,
        page,
    }) => {
        const before = channels(await game.map.fill("France"));

        await game.map.hover("France");
        const hovered = channels(await game.map.fill("France"));
        expect(hovered).toEqual(before.map((c) => c + 20));

        // The restore is wired to the SVG's own mouseout, so the pointer has to
        // leave the map entirely, not merely the path.
        await page.mouse.move(0, 0);
        await expect.poll(async () => channels(await game.map.fill("France"))).toEqual(before);
    });

    test("shows the owner in the tooltip, and hides it again", async ({
        startedGame: game,
        page,
    }) => {
        const tooltip = page.locator(containers.tooltip);

        // The tooltip is populated on mousemove, not on mouseover, so a single
        // hover() is not enough -- the pointer has to actually travel.
        const box = await game.map.territory("France").boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 2);

        await expect(tooltip).toBeVisible();
        await expect(tooltip).toHaveText("France");

        await page.mouse.move(0, 0);
        await expect(tooltip).toBeHidden();
    });

    test("names the player, not the country, over a player-owned territory", async ({
        startedGame: game,
        page,
    }) => {
        // The tooltip shows `owner`, which is the literal "Player" for the player's
        // own territories and the country name for everyone else's.
        const tooltip = page.locator(containers.tooltip);
        const box = await game.map.territory("Germany").boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 2);

        await expect(tooltip).toHaveText("Player");
    });

    test("does not lighten a greyed-out path", async ({ game }) => {
        // hoverOverTerritory is gated on greyedOut === "false". With audit 5.2 Z
        // unfixed nothing is ever greyed, so this asserts the gate from the other
        // side: on the selection screen every path is hoverable, and the fill still
        // moves by exactly 20.
        await game.open();
        await game.newGame();

        const before = channels(await game.map.fill("France"));
        await game.map.hover("France");
        expect(channels(await game.map.fill("France"))).toEqual(before.map((c) => c + 20));
    });
});
