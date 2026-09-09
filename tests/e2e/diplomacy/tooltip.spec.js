import { test, expect } from "../../support/fixtures.js";

// The register drawn on the map. DEFERRED FROM STAGE 0 and delivered here.
//
// The board carries force (the military view) and what a territory has built (the upgrade
// rows); a relation is the third thing that has to be readable off the map rather than out of
// a panel, because it decides whether a territory can be attacked at all -- and a greyed-out
// attack control that does not say why is a bug report waiting to be filed.
//
// THE WORDING IS NOT ASSERTED. `diplomacyTooltipRows()` is pure and
// `tests/unit/ui-diplomacy-tooltip.spec.js` owns every row's phrasing, the ordering and the
// cap. What is here is what that cannot see: that the rows reach the DOM at all, that hovering
// somebody else's territory puts the player's own standing with them FIRST, and the defect
// that was found by hovering rather than by reading -- the player's own territory listing the
// player's own country as a foreign power at no contact with itself.

/** Hover a territory and let the delegated `mousemove` listener rebuild the tooltip. */
async function hover(game, territoryName) {
    await game.map.hover(territoryName);
    await game.page.waitForTimeout(250);
}

test.describe("relations appear on the tooltip", () => {
    test("hovering an enemy territory lists where the player stands with its owner", async ({
        startedGame: game,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");
        const owner = (await game.territory(target)).dataName;

        await game.declareWarOn(target);
        await hover(game, target);

        expect(await game.diplomacy.tooltipHasRelations()).toBe(true);
        const rows = await game.diplomacy.tooltipRows();
        expect(rows.length).toBeGreaterThan(0);

        // THE PLAYER'S OWN STANDING COMES FIRST, ALWAYS. It is the row a player is hovering
        // to find, and on somebody else's territory it is the one that would otherwise be
        // buried under a list of their other wars.
        expect(rows[0].text).toContain("Germany");
        expect(rows[0].tone).toBe("is-hostile");
        expect(owner).toBeTruthy();
    });

    test("the player's own territory never lists the player as a foreign power", async ({
        startedGame: game,
    }) => {
        // FOUND BY HOVERING THE RUNNING GAME, NOT BY READING IT. The label above the rows is
        // `pathOwner()`, which reads "Player" on the player's own land -- and passing that to
        // the tooltip made the player's own territory take the "somebody else's country"
        // branch and list Germany as a country Germany had never met. The register is keyed
        // by `dataName`.
        await hover(game, "Germany");

        const rows = await game.diplomacy.tooltipRows();
        for (const row of rows) {
            expect(row.text, row.text).not.toMatch(/^Germany\b/);
        }
    });

    test("a state agreed in the register is the state the tooltip shows", async ({
        startedGame: game,
    }) => {
        // One assertion that the tooltip is a VIEW of the register rather than a second
        // derivation of it: change the state underneath and the row follows.
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");
        const owner = (await game.territory(target)).dataName;

        await game.diplomacy.setRelation("Germany", owner, "war");
        await hover(game, target);
        expect((await game.diplomacy.tooltipRows())[0].tone).toBe("is-hostile");

        await game.map.dismissTooltip();
        await game.diplomacy.setRelation("Germany", owner, "alliance");
        await hover(game, target);
        expect((await game.diplomacy.tooltipRows())[0].tone).toBe("is-friendly");
    });
});

// THE OPINION BARS (docs/archived/08-opinion.md §4). Two of them on any territory the player does not
// own -- how that country sees the player, and how the player sees it.
//
// `tests/unit/ui-opinion-bar.spec.js` owns the wording, the bands and the arithmetic. What is
// here is what a unit test cannot see: that the bars reach the DOM, that the GEOMETRY reaches
// the element as an inline style (a bar that computes correctly and is drawn at zero width is
// a passing unit suite and an invisible control), and that a declaration of war actually
// moves the number -- which is the whole mechanic in one assertion.
test.describe("the opinion bars", () => {
    test("draws two on a foreign territory and none on the player's own", async ({
        startedGame: game,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");

        await hover(game, target);
        const bars = await game.diplomacy.tooltipOpinionBars();
        expect(bars).toHaveLength(2);
        expect(bars[0].text).toContain("sees you");
        expect(bars[1].text).toContain("How you see");

        await hover(game, "Germany");
        expect(await game.diplomacy.tooltipOpinionBars()).toHaveLength(0);
    });

    test("a declaration of war moves it, and the bar is drawn where it says", async ({
        startedGame: game,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");

        await game.declareWarOn(target);
        await hover(game, target);

        const [theirs, ours] = await game.diplomacy.tooltipOpinionBars();
        // A declaration is felt by the victim and not by the declarer, so it is the FIRST bar
        // -- how they see you -- that moves, and the player's own view of them does not.
        //
        // THE TONE IS NOT PINNED TO ONE BAND, deliberately. A single declaration out of
        // neutral is a setback and not yet a blood feud, so which of the two negative bands
        // it lands in is a balance number and belongs to the unit suite -- asserting the
        // exact band here would make every future tuning pass a failing e2e run.
        expect(["is-hostile", "is-caution"]).toContain(theirs.tone);
        // AND THE TWO ARE DIFFERENT NUMBERS, which is the property the whole store exists
        // for: the victim's view is what the declaration MOVED it to, and the declarer's is
        // the resting point being at war implies. A symmetric model could not tell them
        // apart, and this is the cheapest place to prove it reaches the screen.
        expect(theirs.width).not.toBe(ours.width);
        // Negative, so the fill grows leftwards out of the centre: it starts before the
        // halfway mark and is more than nothing wide. This is the assertion that a unit test
        // genuinely cannot make -- that the geometry reached the element.
        expect(parseFloat(theirs.width)).toBeGreaterThan(0);
        expect(parseFloat(theirs.left)).toBeLessThan(50);
        expect(parseFloat(theirs.left) + parseFloat(theirs.width)).toBeCloseTo(50, 1);
    });
});
