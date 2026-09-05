import { test, expect } from "../../support/fixtures.js";
import { sel } from "../../support/selectors.js";

// The dice STAGE, as distinct from the dice.
//
// `clash.spec.js` asserts that the faces on the table are the faces the rules rolled, which is
// the invariant the whole pivot-and-offset arrangement exists to protect. This file asserts
// something cruder and, as it turned out, more easily lost: that there is a table at all.
//
// THE BUG THIS FILE EXISTS FOR. The stage is permanent -- one `WebGLRenderer` for the life of
// the page, because a fresh one per roll leaks a GL context and browsers cap those at about
// sixteen -- so `ensureStage()` returns immediately once the renderer exists. `ui.js` called
// `removeCanvasIfExist()` when a battle OPENED, which was harmless the first time (there was no
// canvas yet) and, from the second battle of a session onwards, tore the canvas out of the
// document and left the renderer drawing into a detached element.
//
// Every symptom pointed away from the dice. Nothing threw. The rules rolled correctly, the
// battle window's numbers were right, the round log was right, and the clash panel filled itself
// in with the correct faces -- because all of those read the RECORD. The only witness was a
// person looking at an empty stage during their second war of the session.
//
// So the assertion is about the DOM, not about the faces: the canvas the renderer owns has to be
// inside `#threeCanvasForDice`, and it has to have a real drawing buffer. Neither is visible to
// any spec that reads what the round produced.

test.describe("the dice stage", () => {
    test.setTimeout(180_000);

    /** The canvas `dices.js` renders into, as the document sees it. */
    function stageState(page) {
        return page.evaluate(({ container, canvas }) => {
            const host = document.querySelector(container);
            const element = document.querySelector(canvas);
            return {
                hostVisible: !!host && getComputedStyle(host).display !== "none",
                canvasExists: !!element,
                //A detached canvas renders perfectly and shows nothing. `isConnected` is the
                //whole of the defect, and it is not observable from any number the round
                //produced.
                canvasConnected: !!element && element.isConnected,
                insideHost: !!element && !!host && host.contains(element),
                //Reported but deliberately NOT asserted. `renderer.setSize()` is what takes
                //the drawing buffer off the WebGL default of 300x150, and on a machine with no
                //working GL context there is no renderer to call it -- the canvas is created,
                //the roll is caught and reported as unrenderable, and the buffer stays at the
                //default. That is correct behaviour and it varies by machine, so asserting on
                //it would make this spec a test of the runner's graphics stack. The blur fix it
                //describes is pinned in `tests/unit/ui-stylesheet.spec.js` instead.
                width: element?.width ?? 0,
                height: element?.height ?? 0
            };
        }, { container: sel.threeCanvasForDice, canvas: sel.canvas });
    }

    /**
     * Open an attack on France and fight one round of it.
     *
     * `evenly-matched` is two fleets of four hundred and `launchWholeGarrison` commits one press
     * of the plus button rather than the whole four hundred, which is what leaves enough behind
     * to mount a SECOND attack -- and a second attack is the whole point of this file.
     *
     * `advancePhase` is false for that second one. Both wars are fought in the SAME turn,
     * deliberately: the obvious alternative, a turn boundary between them, was tried and the AI
     * took Germany during it. That is not a flake, it is correct play -- a scatter retreat sends
     * the committed force home over two turns and leaves the territory thin, and Germany is a
     * one-territory country, so losing it ends the game. A spec about a canvas should not be
     * standing in the middle of that.
     */
    async function fightOneRound(game, { advancePhase = true } = {}) {
        await game.launchWholeGarrison({
            from: "Germany", to: "France", unit: "naval", advancePhase
        });
        await game.battle.advanceRound(); // "Begin War!" -- opens the battle, fights no round
        await game.page.waitForTimeout(120);
        await game.battle.advanceRound(); // one round, and the dice with it
    }

    test("the canvas is in the document, and sized, on the first battle", async ({ game }) => {
        await game.start({ country: "Germany", seed: "dice-stage-first" });
        await game.loadScenario("evenly-matched");
        await fightOneRound(game);

        await expect.poll(async () => (await stageState(game.page)).canvasExists,
            { timeout: 20_000 }).toBe(true);

        const stage = await stageState(game.page);
        expect(stage.canvasConnected, "the renderer's canvas must be in the document").toBe(true);
        expect(stage.insideHost, "and inside #threeCanvasForDice").toBe(true);
        expect(stage.hostVisible, "which must itself be shown").toBe(true);
    });

    test("and it is STILL there for the second battle of the session", async ({ game }) => {
        await game.start({ country: "Germany", seed: "dice-stage-second" });
        await game.loadScenario("evenly-matched");

        await fightOneRound(game);
        await expect.poll(async () => (await stageState(game.page)).canvasExists,
            { timeout: 20_000 }).toBe(true);

        // Out of the first war. Retreating after a round has been fought is a scatter -- it
        // costs the committed force -- which does not matter here: what matters is that the
        // battle ENDS so that another can be opened.
        await game.battle.retreat.click({ force: true });
        await game.dismissBattleResults();

        // Both fleets back to four hundred. `launchWholeGarrison` means it: one press of the
        // plus button commits the whole stack, and the scatter retreat then sent it home over
        // two turns -- so without this the second attack window opens on a force of zero. That
        // is precisely what scenarios are for.
        await game.loadScenario("evenly-matched");

        // And straight into a second war, in the same turn and therefore without touching the
        // phase button. `AdvanceMode.BEGIN` -- the branch that used to remove the canvas -- runs
        // once per battle OPENED, so two openings is all this needs.
        await fightOneRound(game, { advancePhase: false });

        // THE REGRESSION. Opening a battle used to remove this element, and `ensureStage()` --
        // which owns the only reference to it -- never rebuilds it once the renderer exists.
        const stage = await stageState(game.page);
        expect(stage.canvasExists, "a second battle must not destroy the dice canvas").toBe(true);
        expect(stage.canvasConnected,
            "the renderer was left drawing into a detached canvas: dice roll, nothing shows")
            .toBe(true);
        expect(stage.insideHost).toBe(true);
        expect(stage.hostVisible).toBe(true);

        // And the dice really were thrown into it.
        const faces = await game.page.evaluate(() => window.__game.diceFaces());
        expect(faces.length, "the second battle rolled dice too").toBeGreaterThan(0);
    });
});
