import { test, expect } from "../../support/fixtures.js";
import { containers } from "../../support/selectors.js";

// Hovering lightens the path and shows the owner tooltip.
// docs/03-e2e-test-plan.md section 5.4.
//
// The tooltip is TWO lines since the continent-bonus phase: the owner (plus the besieger,
// when there is one) and the continent, with how much of it the owner holds. So these
// address the two lines separately rather than asserting one exact string -- an assertion
// on the whole tooltip would have to be rewritten by anything that ever adds a third line,
// and would say nothing about which line was wrong when it failed.
//
// `line(tooltip, n)` is what makes that possible: `territoryTooltipLabel()` renders each
// fact in its own `<div>`, deliberately, because `<br />` contributes nothing to
// `textContent` and the two facts would arrive concatenated with no separator.

/** rgb(r,g,b) -> [r,g,b], whatever the spacing. */
function channels(fill) {
    return fill.match(/\d+/g).map(Number);
}

/** One line of the map tooltip: 0 is the owner, 1 is the continent. */
function line(tooltip, index) {
    return tooltip.locator("div").nth(index);
}

/** Park the pointer on a territory. The tooltip fills on mousemove, not on mouseover,
 *  so the pointer has to actually travel -- one hover() is not enough. */
async function hoverOver(game, page, territoryName) {
    const box = await game.map.territory(territoryName).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 2);
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

        await hoverOver(game, page, "France");

        await expect(tooltip).toBeVisible();
        await expect(line(tooltip, 0)).toHaveText("France");

        await page.mouse.move(0, 0);
        await expect(tooltip).toBeHidden();
    });

    test("names the continent and how much of it the owner holds", async ({
        startedGame: game,
        page,
    }) => {
        // The continent-bonus phase. This is the tooltip a player reads while deciding
        // where to attack, so it is where a continent has to be visible BEFORE it is
        // completed rather than after -- "Europe: 31 of 52 held by France" is what makes
        // finishing one something anybody aims at.
        //
        // Neither number is asserted here, deliberately. Both are facts about the
        // starting map, and a continent's SIZE is not even the number the SVG says: a
        // territory's continent comes from its original owner's row in `initialData.js`,
        // not from the path's `continent=` attribute, and the two disagree about Easter
        // Island. `resources-economy/continent-bonus.spec.js` is what checks the totals,
        // against `window.__game.continents()`, which is the same walk the rule uses.
        const tooltip = page.locator(containers.tooltip);
        await hoverOver(game, page, "France");

        await expect(line(tooltip, 1)).toHaveText(/^Europe: \d+ of \d+ held by France$/);
    });

    test("states the continent of a territory the player does not own", async ({
        startedGame: game,
        page,
    }) => {
        // An opponent's progress towards a continent is readable off the map, which is
        // half the point: a bonus you can only see once you have earned it teaches nobody
        // what to aim at.
        const tooltip = page.locator(containers.tooltip);
        await hoverOver(game, page, "Brazil");

        await expect(line(tooltip, 1)).toHaveText(/^South America: \d+ of \d+ held by /);
    });

    test("names the player, not the country, over a player-owned territory", async ({
        startedGame: game,
        page,
    }) => {
        // The tooltip shows `owner`, which is the literal "Player" for the player's
        // own territories and the country name for everyone else's. The CONTINENT line
        // names the country instead, because it is a fact about who holds the continent
        // and "held by Player" would be the only place in the game that said so.
        const tooltip = page.locator(containers.tooltip);
        await hoverOver(game, page, "Germany");

        await expect(line(tooltip, 0)).toHaveText("Player");
        await expect(line(tooltip, 1)).toContainText("Europe:");
    });

    test("names the besieger in the tooltip of a besieged territory", async ({
        startedGame: game,
        page,
    }) => {
        // Phase 6. The siege MARKER used to carry a tooltip of its own -- and then
        // stopped showing one, because audit 5.3 AW gave every marker
        // `pointer-events: none`, so the hit test at the centre of a besieged
        // territory returns the path underneath and the marker never sees a
        // mousemove. Rather than give the marker its events back (which would put
        // the swallowed-click bug straight back), the siege is stated in the
        // territory's own tooltip. The player then gets the same fact wherever in
        // the territory they hover, rather than only over the icon.
        const tooltip = page.locator(containers.tooltip);
        await game.loadScenario("two-sieges");

        await hoverOver(game, page, "France");

        await expect(line(tooltip, 0)).toHaveText("France (under siege by Spain)");
    });

    test("says only the country when the territory is not besieged", async ({
        startedGame: game,
        page,
    }) => {
        // The other half of the same rule: the parenthetical appears only for a
        // territory a siege actually names.
        const tooltip = page.locator(containers.tooltip);
        await game.loadScenario("two-sieges");

        await hoverOver(game, page, "Italy");

        await expect(line(tooltip, 0)).toHaveText("Italy");
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
