import { test, expect } from "../../support/fixtures.js";
import { battle as battleSelectors } from "../../support/selectors.js";

// The pairing animation -- the panel that says what the dice MEANT.
//
// The complaint it answers was about the rules being unreadable, not about the numbers being
// wrong: "if we get a six and they get a one what does that mean? What happens to the extra dice
// we have that they don't?" Both are rules that `resolvePairings()` has always applied and that
// nothing on screen ever stated.
//
// WHAT THESE SPECS ASSERT, AND WHAT THEY DELIBERATELY DO NOT. The wording of the panel is pinned
// in `tests/unit/ui-battle-round-account.spec.js`, over a plain record, in milliseconds -- the
// same division `tests/e2e/dominapedia/` records for the manual, and for the same reason: a spec
// that asserts prose turns every edit to the prose into a red suite. What is left here is
// everything a unit test cannot see -- that the panel is reachable at all, that it is drawn from
// the round that was actually fought, that it goes away, and that it can never be in the way.
//
// The last of those is the one worth having. The panel lives OUTSIDE `#battleContainer` (that
// element is transformed, and a transform creates a stacking context, so nothing inside it can
// paint over the dice canvas), it covers the middle of the screen for several seconds, and the
// click it would swallow is the one that dismisses the results screen underneath it. That is the
// same class of bug as the siege marker eating the click on the territory it marked.

test.describe("the clash panel", () => {
    test.setTimeout(180_000);

    /** Open a battle and fight exactly one round, leaving the clash mid-play. */
    async function fightOneRound(game, seed) {
        await game.start({ country: "Germany", seed });
        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await game.battle.advanceRound(); // "Begin War!" -- starts the battle, fights no round
        await game.page.waitForTimeout(80);
        await game.battle.advanceRound(); // one round
    }

    const panel = battleSelectors.clashPanel;
    const pairs = battleSelectors.clashPairs;

    /**
     * The panel with its faces filled in.
     *
     * The panel opens BLANK the moment a round resolves and fills in only when the dice come to
     * rest -- so "visible" and "showing the numbers" are two different states now, and a spec that
     * waits for the first and then reads the second is a race. `is-revealed` is the second.
     */
    const revealed = `${panel}.is-revealed`;

    test("opens after a round with one row per pairing, and every row says why", async ({
        game
    }) => {
        await fightOneRound(game, "clash-opens");

        //The frame goes up at once; the faces wait for the dice. Both are asserted, in that
        //order, because the order IS the feature.
        await expect(game.page.locator(panel)).toBeVisible({ timeout: 15_000 });
        await expect(game.page.locator(revealed)).toBeVisible({ timeout: 20_000 });

        const rows = game.page.locator(`${pairs} .clashPair`);
        await expect(rows.first()).toBeVisible();

        //One row per pairing, and `resolvePairings()` returns one per CONTESTED pairing plus one
        //per unmatched die -- so the count is the larger of the two dice counts, never the sum.
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(5);

        //Every row states its verdict. Which verdict is the unit suite's business; that there IS
        //one on each is this one's, because a row that resolved silently is the panel failing at
        //the only job it has.
        const verdicts = await game.page.locator(`${pairs} .clashVerdict`).allInnerTexts();
        expect(verdicts.length).toBe(count);
        for (const verdict of verdicts) {
            expect(verdict.trim().length).toBeGreaterThan(0);
        }
    });

    test("agrees with the round log about the round it is describing", async ({ game }) => {
        await fightOneRound(game, "clash-agrees");
        await expect(game.page.locator(revealed)).toBeVisible({ timeout: 20_000 });

        //The two are rendered from the same record by different code. If they can disagree, one
        //of them is describing a different round from the one that was fought -- which is the
        //failure the whole "pure render of the model" arrangement exists to make impossible.
        const title = await game.page.locator(battleSelectors.clashPanel).innerText();
        const line = await game.page.locator(battleSelectors.roundSummary).innerText();

        const clashDice = title.match(/(\d+)\s+(?:dice|die)/g) ?? [];
        expect(clashDice.length, "the header names both sides' dice counts").toBe(2);

        const logged = line.match(/R(\d+): (\d+)v(\d+) dice/);
        expect(logged, "the round line names the round and both dice counts").not.toBeNull();
        expect(logged[1]).toBe("1");
        expect(clashDice[0]).toContain(logged[2]);
        expect(clashDice[1]).toContain(logged[3]);
    });

    test("the dice on the table show the faces the battle was fought with", async ({ game }) => {
        await fightOneRound(game, "clash-dice-match");
        await expect(game.page.locator(revealed)).toBeVisible({ timeout: 20_000 });

        // THE INVARIANT THE WHOLE DICE FILE EXISTS FOR, and it was false for as long as the dice
        // have existed. The rules roll the faces on the seeded stream; the physics throws real
        // dice; each die's MESH is then rotated by one of a cube's 24 symmetries so that the face
        // landing upwards is the one the rules chose. The rotation was searched for in the wrong
        // direction, so a die showed the right number only when the rotation happened to be its
        // own inverse for that pair -- roughly one round in four.
        //
        // Nothing could see it. Nothing throws, the battle window's numbers are right, every
        // outcome is correct and reproducible, and the only witness is a person looking at the
        // table and noticing that the dice do not say what the game says they said. It has to be
        // asserted here because it is a question about what is DRAWN -- a physics pose composed
        // with a mesh rotation, in a canvas -- which no unit test can reach.
        const shown = await game.state(() => window.__game.diceFaces());
        expect(shown.length, "a round was rolled, so there are dice on the table")
            .toBeGreaterThan(0);

        const panelFaces = await game.page.locator(`${pairs} .clashDie[data-face]`)
            .evaluateAll((nodes) => nodes.map((n) => Number(n.dataset.face)));

        const ordered = (list) => [...list].sort((a, b) => a - b).join(",");
        expect(ordered(shown), "the dice on the table and the pairings must be the same faces")
            .toBe(ordered(panelFaces));
    });

    test("never intercepts a click, so the window underneath stays usable", async ({ game }) => {
        await fightOneRound(game, "clash-click-through");
        await expect(game.page.locator(revealed)).toBeVisible({ timeout: 20_000 });

        //Not `force: true`. The point of this spec is that Playwright's actionability check --
        //which is a hit test at the element's centre -- finds the advance button and not a
        //decoration lying over it. A forced click would pass whether or not the bug were there.
        const box = await game.page.locator(panel).boundingBox();
        expect(box, "the panel is on screen, so it is genuinely in front of something").not
            .toBeNull();

        await game.page.locator(`#${battleSelectors.advanceId}`).click();

        //The click both settled the animation and fought a round, so the log has two of them.
        await expect(game.page.locator(battleSelectors.roundLogToggle))
            .toContainText("(2)", { timeout: 15_000 });
    });

    test("is gone once the battle is over", async ({ game }) => {
        await fightOneRound(game, "clash-gone");
        await expect(game.page.locator(revealed)).toBeVisible({ timeout: 20_000 });

        await game.battle.retreat.click({ force: true });

        //Every ending routes through `toggleDiceCanvas(false)`, which is what takes the panel down
        //with the dice. It is not a child of the battle window, so nothing hides it by accident --
        //and a pairing animation still playing over the battle-results screen is the one thing it
        //must never do.
        await expect(game.page.locator(panel)).toBeHidden({ timeout: 15_000 });
    });
});
