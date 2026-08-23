import { test, expect } from "../../support/fixtures.js";
import { phaseBar, Phase } from "../../support/selectors.js";

// Buy/Upgrade -> Military -> AI -> Buy/Upgrade. The spine of the game: every
// other area assumes these transitions are right.
//
// docs/04-e2e-test-plan.md section 5.3.

test.describe("phase transitions", () => {
    test("starts in Buy/Upgrade with the button offering MILITARY", async ({
        startedGame: game,
        page,
    }) => {
        expect(await game.phase()).toBe(Phase.BUY_UPGRADE);
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase");
        await expect(page.locator(phaseBar.confirm)).toHaveText("MILITARY");
        await expect(page.locator(phaseBar.confirm)).toBeEnabled();
    });

    test("moves to the Military phase with the button offering END TURN", async ({
        startedGame: game,
        page,
    }) => {
        await game.endBuyPhase();

        expect(await game.phase()).toBe(Phase.MILITARY);
        await expect(page.locator(phaseBar.title)).toHaveText("Military Phase");
        await expect(page.locator(phaseBar.confirm)).toHaveText("END TURN");
        await expect(page.locator(phaseBar.confirm)).toBeEnabled();
    });

    test("disables the phase button for the whole AI phase and re-enables it after", async ({
        startedGame: game,
        page,
    }) => {
        await game.endBuyPhase();

        // The AI phase can finish inside an assertion's retry window, so polling
        // for "disabled" is a race the spec would lose intermittently. Record the
        // states the button passes through instead, then assert on the recording.
        await page.evaluate((selector) => {
            const button = document.querySelector(selector);
            window.__phaseButtonStates = [];
            const record = () =>
                window.__phaseButtonStates.push({
                    label: button.innerText.trim(),
                    disabled: button.disabled,
                });
            record();
            new MutationObserver(record).observe(button, {
                attributes: true,
                childList: true,
                subtree: true,
                characterData: true,
            });
        }, phaseBar.confirm);

        const turnBefore = await game.turn();
        await page.locator(phaseBar.confirm).click();
        await page.waitForFunction((previous) => window.__game.turn() > previous, turnBefore, {
            timeout: 120_000,
        });

        const states = await page.evaluate(() => window.__phaseButtonStates);
        expect(
            states.some((s) => s.disabled && s.label === "AI MOVING..."),
            `button never showed the locked AI state; saw ${JSON.stringify(states)}`
        ).toBe(true);
        expect(
            states.every((s) => s.label !== "END TURN" || !s.disabled),
            "the button must stay live for the whole Military phase"
        ).toBe(true);

        await expect(page.locator(phaseBar.confirm)).toBeEnabled();
        await expect(page.locator(phaseBar.confirm)).toHaveText("MILITARY");
    });

    test("returns to Buy/Upgrade of the next turn", async ({ startedGame: game, page }) => {
        await game.playTurn();

        expect(await game.turn()).toBe(2);
        expect(await game.phase()).toBe(Phase.BUY_UPGRADE);
        await expect(page.locator(phaseBar.title)).toHaveText("Buy / Upgrade Phase");
    });

    test.fixme("cycles cleanly twice in a row", async ({ startedGame: game }) => {
        // 🔴 audit 5.1 AA -- the AI turn throws `Cannot read properties of undefined
        // (reading '1')` and the unhandled rejection stops `gameLoop()` for good. It
        // can land as early as the second AI phase, so ANY spec needing more than one
        // full turn is a coin flip today. Un-fixme with refactor Phase 3.1a.
        // The loop is an infinitely recursing gameLoop() with nested promise
        // chains (audit 5.3). Repeating the cycle is what catches a phase index
        // that drifts by one after the first pass.
        for (let expectedTurn = 1; expectedTurn <= 2; expectedTurn += 1) {
            expect(await game.turn()).toBe(expectedTurn);
            expect(await game.phase()).toBe(Phase.BUY_UPGRADE);
            await game.endBuyPhase();
            expect(await game.phase()).toBe(Phase.MILITARY);
            await game.endTurn();
        }
        expect(await game.turn()).toBe(3);
    });
});
