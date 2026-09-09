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
//
// AND IT IS MODAL NOW, WHICH REVERSES HALF OF THAT. The panel used to carry
// `pointer-events: none` for the reason above, and Leigh reported what it cost: the battle
// window's own buttons could be pressed straight THROUGH the panel, so a player reading the
// account of a round could advance past it by clicking where a button happened to be. It raises
// a scrim instead, and the two things the old rule was protecting are answered separately -- the
// scrim takes the skip click, and there is an X because a seven-second linger you cannot shorten
// would be a worse trade than the bug.

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

    test("blocks the window underneath, and hands it back when dismissed", async ({ game }) => {
        //THIS SPEC USED TO ASSERT THE OPPOSITE and it is worth saying why, because the change
        //is Leigh's rather than a discovery. It read "never intercepts a click, so the window
        //underneath stays usable": the panel carried `pointer-events: none` so the click that
        //dismisses the results screen still landed. That protected the results screen and let
        //the battle window's own buttons be pressed straight THROUGH the panel, which is what
        //was reported.
        //
        //IT ALSO SHOWS WHY THE OLD ASSERTION HAD TO BE REPLACED RATHER THAN LEFT. With the
        //scrim up it went on PASSING -- Playwright retries an intercepted click, the panel
        //takes itself down after its seven-second linger, and the click then lands. A spec
        //that passes by waiting out the thing it is meant to be testing is worse than one
        //that fails.
        await fightOneRound(game, "clash-click-through");
        await expect(game.page.locator(revealed)).toBeVisible({ timeout: 20_000 });

        //THE HIT TEST, which is the assertion. Playwright's own actionability check is the
        //same question asked less directly, and it would answer it by waiting.
        const covering = await game.page.evaluate((advanceId) => {
            const button = document.getElementById(advanceId);
            const box = button.getBoundingClientRect();
            const hit = document.elementFromPoint(
                box.x + box.width / 2, box.y + box.height / 2);
            return hit?.id ?? null;
        }, battleSelectors.advanceId);
        expect(covering).toBe(battleSelectors.clashScrimId);

        //AND THE WINDOW COMES BACK. Modal is only acceptable because there is a way out of it
        //that does not involve waiting: this is the scrim's own click, which finishes the
        //animation and then takes the panel down.
        await game.battle.dismissClashPanel();
        await game.page.locator(`#${battleSelectors.advanceId}`).click();

        //A round was fought, so the log has two of them.
        await expect(game.page.locator(battleSelectors.roundLogToggle))
            .toContainText("(2)", { timeout: 15_000 });
    });

    test("is gone once the battle is over", async ({ game }) => {
        await fightOneRound(game, "clash-gone");
        await expect(game.page.locator(revealed)).toBeVisible({ timeout: 20_000 });

        await game.battle.retreatFromBattle();

        //Every ending routes through `toggleDiceCanvas(false)`, which is what takes the panel down
        //with the dice. It is not a child of the battle window, so nothing hides it by accident --
        //and a pairing animation still playing over the battle-results screen is the one thing it
        //must never do.
        await expect(game.page.locator(panel)).toBeHidden({ timeout: 15_000 });
    });
});

test.describe("the clash panel is modal", () => {
    test.setTimeout(180_000);

    /** Open a battle and fight exactly one round, leaving the clash mid-play. */
    async function fightOneRound(game, seed) {
        await game.start({ country: "Germany", seed });
        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await game.battle.advanceRound();
        await game.page.waitForTimeout(80);
        await game.battle.advanceRound();
    }

    const revealedPanel = `${battleSelectors.clashPanel}.is-revealed`;

    test("raises a scrim over the battle window while it is up", async ({ game, page }) => {
        await fightOneRound(game, "clash-modal");
        await expect(page.locator(revealedPanel)).toBeVisible({ timeout: 20_000 });

        const state = await page.evaluate((ids) => ({
            scrim: getComputedStyle(document.getElementById(ids.scrim)).display,
            //The panel takes clicks too, or its own X could not be pressed. The container is
            //`pointer-events: none`, so this has to be turned on by the `is-open` class.
            panel: getComputedStyle(document.getElementById(ids.panel)).pointerEvents,
        }), { scrim: battleSelectors.clashScrimId, panel: "battleClashPanel" });

        expect(state.scrim).not.toBe("none");
        expect(state.panel).toBe("auto");
    });

    test("has an X that takes it down without waiting out the linger", async ({ game, page }) => {
        //THE LINGER IS SEVEN SECONDS and the panel is modal, so without this the player is
        //made to sit out a round they have finished reading. Leigh asked for the X by name.
        await fightOneRound(game, "clash-close");
        await expect(page.locator(revealedPanel)).toBeVisible({ timeout: 20_000 });

        await page.locator(battleSelectors.clashClose).click();

        await expect(page.locator(battleSelectors.clashPanel)).toBeHidden({ timeout: 5_000 });
        const scrim = await page.evaluate((id) =>
            getComputedStyle(document.getElementById(id)).display, battleSelectors.clashScrimId);
        expect(scrim).toBe("none");
    });

    test("does not come back after being closed mid-round", async ({ game, page }) => {
        //`reveal()` is called from a promise chained BEFORE the player pressed the X
        //(`rolled?.finally?.(() => clashPanel.reveal())`), so without the dismissed flag the
        //panel reopened a moment later and the X read as broken.
        await fightOneRound(game, "clash-dismissed");
        await expect(page.locator(battleSelectors.clashPanel)).toBeVisible({ timeout: 20_000 });

        await page.locator(battleSelectors.clashClose).click();
        await page.waitForTimeout(2_500);

        await expect(page.locator(battleSelectors.clashPanel)).toBeHidden();
    });
});
