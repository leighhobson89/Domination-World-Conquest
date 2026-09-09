import { test, expect } from "../../support/fixtures.js";
import { containers } from "../../support/selectors.js";

// Hovering lightens the path and shows the owner tooltip.
// docs/02-e2e-test-plan.md section 5.4.
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

/**
 * One line of the map tooltip, addressed by WHAT IT IS rather than by where it sits.
 *
 * The lines were indexed by number until the leader line (register item E4) was inserted
 * between the owner and the continent, at which point two specs here started reading the
 * leader and asserting it against a continent pattern -- a stale spec, not a defect, and one
 * that stayed red long enough to read as background noise. An index is the wrong address for
 * a tooltip that grows: the leader line is only there for a country with a leader, and the
 * military and upgrade lines come and go with the view and with what a territory has built.
 */
function line(tooltip, index) {
    return tooltip.locator("div").nth(index);
}

/** The whole tooltip as lines of text, which is what a reader of the map actually sees. */
async function tooltipLines(tooltip) {
    return (await tooltip.innerText()).split("\n").map(text => text.trim()).filter(Boolean);
}

/** Park the pointer on a territory. The tooltip fills on mousemove, not on mouseover,
 *  so the pointer has to actually travel -- one hover() is not enough. */
async function hoverOver(game, page, territoryName) {
    const box = await game.map.territory(territoryName).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 2);
}

test.describe("hovering a territory", () => {
    test("lists what the territory has built, and nothing it has not", async ({
        startedGame: game,
        page,
    }) => {
        //Register item M1. The map carries force and carried nothing the economy does, so
        //"how developed is this province" could only be answered by selecting it and opening
        //the Upgrade Territory window -- one territory at a time.
        const tooltip = page.locator(containers.tooltip);

        await page.evaluate((input) => window.__game.applyScenario(input), {
            name: "tooltip-upgrades",
            territories: [
                //Germany is the player's in this fixture; France is not.
                { territory: "Germany", patch: { farmsBuilt: 3, forestsBuilt: 2, oilWellsBuilt: 0, fortsBuilt: 1 } },
                { territory: "France", patch: { farmsBuilt: 5, forestsBuilt: 4, oilWellsBuilt: 3, fortsBuilt: 2 } },
                { territory: "Spain", patch: { farmsBuilt: 0, forestsBuilt: 0, oilWellsBuilt: 0, fortsBuilt: 0 } }
            ]
        });

        await hoverOver(game, page, "Germany");
        await expect
            .poll(async () => await tooltipLines(tooltip))
            .toEqual(expect.arrayContaining(["Farms: 3", "Forests: 2", "Forts: 1"]));
        //NOTHING FOR A KIND WITH NONE OF IT. Four zero rows would be the same tooltip on nine
        //tenths of the map, which is a tooltip people stop reading.
        expect(await tooltipLines(tooltip)).not.toContain("Oil wells: 0");
        //The game's own artwork, so a farm here is the picture of the farm the player buys.
        await expect(tooltip.locator(".tooltip-upgrade img").first())
            .toHaveAttribute("src", /farmIcon\.png$/);

        //YOURS IN FULL, ENEMIES IN OUTLINE. France has all four and gives up only its forts:
        //a fort is a physical work the battle screen reveals anyway, and how developed a
        //province is, is the enemy's books.
        await page.mouse.move(0, 0);
        await hoverOver(game, page, "France");
        await expect
            .poll(async () => await tooltipLines(tooltip))
            .toEqual(expect.arrayContaining(["Forts: 2"]));
        expect(await tooltipLines(tooltip)).not.toContain("Farms: 5");
        expect(await tooltipLines(tooltip)).not.toContain("Forests: 4");

        await page.mouse.move(0, 0);
        await hoverOver(game, page, "Spain");
        await expect
            .poll(async () => (await tooltipLines(tooltip)).some(text => /^(Farms|Forts):/.test(text)))
            .toBe(false);
    });

    test("keeps working however many times a territory is hovered", async ({
        startedGame: game,
        page,
    }) => {
        //THE LEAK THIS GUARDS. `mouseover` used to add a fresh `mousemove` and a fresh
        //`mouseout` listener to the territory every time the pointer entered it and remove
        //neither, so twenty-four hovers left twenty-four of each -- every one of them
        //rebuilding the whole tooltip on every pixel of pointer movement. A long session
        //degraded until the tooltip stopped keeping up and only a reload cleared it: exactly
        //"after changing map modes the tooltip stops generating until you refresh".
        const tooltip = page.locator(containers.tooltip);

        //The counter lives on `window` and is read back AFTER the hovers: returning the object
        //from this call would hand the spec a serialised snapshot of zeroes and assert nothing.
        await page.evaluate((mapId) => {
            const doc = document.getElementById(mapId).contentDocument;
            const view = doc.defaultView;
            window.__hoverListenersAdded = { mousemove: 0, mouseout: 0 };
            const original = view.Element.prototype.addEventListener;
            view.Element.prototype.addEventListener = function (type, ...rest) {
                if (window.__hoverListenersAdded[type] !== undefined) {
                    window.__hoverListenersAdded[type] += 1;
                }
                return original.call(this, type, ...rest);
            };
        }, "svg-map");

        for (let pass = 0; pass < 8; pass++) {
            await hoverOver(game, page, "France");
            await hoverOver(game, page, "Spain");
        }

        //Not "few" -- NONE. Territory listeners are installed once at bootstrap now, and a
        //hover adds nothing at all. Sixteen hovers used to add sixteen of each.
        const added = await page.evaluate(() => window.__hoverListenersAdded);
        expect(added).toEqual({ mousemove: 0, mouseout: 0 });

        //And it still works after all that, which is the symptom the player reported.
        await hoverOver(game, page, "France");
        await expect(tooltip).toBeVisible();
        await expect(tooltip.locator("div").first()).toHaveText("France");
    });

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

        await expect
            .poll(async () => await tooltipLines(tooltip))
            .toEqual(expect.arrayContaining([expect.stringMatching(
                /^Europe: \d+ of \d+ held by France$/)]));
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

        await expect
            .poll(async () => await tooltipLines(tooltip))
            .toEqual(expect.arrayContaining([expect.stringMatching(
                /^South America: \d+ of \d+ held by /)]));
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
