import { test, expect } from "../../support/fixtures.js";
import { containers } from "../../support/selectors.js";

// The info panel auto-opens at the start of each turn while the checkbox is on.
// docs/04-e2e-test-plan.md section 5.3.

/**
 * Play one turn and report whether the panel opened.
 *
 * Before Phase 5.8 this had to be polled over several turns, because the panel was gated on
 * `continueSiege === true` -- suppressed on any turn where a siege ended in an arrest, since
 * the arrest raised the battle results screen and the two would collide. Once sieges
 * actually ticked (audit 5.1 D, 5.2 J) the AI was running dozens of concurrent sieges and at
 * least one was arrested nearly every turn, so the preference never took effect at all and
 * the player got an EMPTY results screen instead. An arrest now raises that screen only when
 * the player was a party to it, so the panel opens on the very next turn.
 */
async function playTurnAndSeeIfPanelOpens(game, page) {
    await game.playTurn();
    await game.dismissBattleResults();
    return page.locator(containers.mainUi).isVisible();
}

test.describe("the start-of-turn info panel", () => {
    // Two of these play several turns, and a turn is 206 AI countries. The default
    // 120 s budget is a turn or two, not a handful.
    test.setTimeout(300_000);

    test("opens automatically at the start of a turn, but never turn 1", async ({
        startedGame: game,
        page,
    }) => {
        // gameLoop() opens it when uiAppearsAtStartOfTurn is set AND currentTurn is
        // not 1 -- turn 1 has no income to report, so there is nothing to show.
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await expect
            .poll(async () => playTurnAndSeeIfPanelOpens(game, page), { timeout: 240_000 })
            .toBe(true);

        expect(await game.turn()).toBeGreaterThanOrEqual(2);
    });

    test("opens on the very next turn, not eventually", async ({ startedGame: game, page }) => {
        // The regression test for the gate. One turn, no dismissing and no polling: the
        // preference is on by default, so turn 2 must open the panel.
        await game.playTurn();
        expect(await game.turn()).toBe(2);
        await expect(page.locator(containers.mainUi)).toBeVisible();
    });

    test("raises no empty battle results screen at the start of a turn", async ({
        startedGame: game,
        page,
    }) => {
        // Reported from play: "it is showing an empty battle ui" at the start of every turn.
        // `handleEndSiegeDueArrest()` called `setUpResultsOfWarExternal(true)` for EVERY
        // arrest, including the AI-versus-AI sieges the player has nothing to do with, and
        // only the player branch ever populated the screen. The AI arrests something on
        // nearly every turn, so the player was handed a results screen holding nothing but
        // column headers, sitting on top of the phase button and in place of this panel.
        for (let turn = 0; turn < 3; turn += 1) {
            await game.playTurn();

            if (await page.locator(containers.battleResults).isVisible()) {
                // A results screen is legitimate ONLY if it describes a war the player was
                // actually in, which means it names one.
                const attacker = await page.locator("#battleResultsTitleTitleLeft").innerText();
                expect(
                    attacker.trim(),
                    "a visible results screen must name the war it is reporting"
                ).not.toBe("");
            }
            await game.dismissBlockingPanels();
        }
    });

    test("does not open when the preference is off, and the preference survives turns", async ({
        startedGame: game,
        page,
    }) => {
        // audit 5.1 AA, fixed in refactor Phase 3.1a -- more than one full turn is
        // testable again.

        // The checkbox lives inside the panel, so turning the preference off means
        // opening the panel, unticking, and closing again.
        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await game.playTurn();
        await game.dismissBattleResults();
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await game.playTurn();
        await game.dismissBattleResults();
        await expect(
            page.locator(containers.mainUi),
            "the preference should not reset each turn"
        ).toBeHidden();
    });

    test("can be turned back on and takes effect again", async ({
        startedGame: game,
        page,
    }) => {
        // audit 5.1 AA, fixed in refactor Phase 3.1a -- more than one full turn is
        // testable again.

        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await game.playTurn();
        await game.dismissBattleResults();
        await expect(page.locator(containers.mainUi)).toBeHidden();

        await game.infoTable.open();
        await game.infoTable.toggleAppearsAtStartOfTurn();
        await game.infoTable.close();

        await expect
            .poll(async () => playTurnAndSeeIfPanelOpens(game, page), { timeout: 240_000 })
            .toBe(true);
    });
});
