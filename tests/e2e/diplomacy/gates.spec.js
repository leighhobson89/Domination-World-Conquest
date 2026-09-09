import { test, expect } from "../../support/fixtures.js";
import { ids } from "../../support/selectors.js";

// That neutral really is neutral, and that a declaration really does open the fighting.
//
// Diplomacy stage 2 was the checkpoint where nobody on the map could attack anybody -- the one
// stage of this phase that knowingly suspended the house rule about ending playable, because a
// gate you can watch stop the world is a gate you can trust. Stage 3 gave the world a way back
// out of that. This is both halves asserted from the outside, in the only place they can be:
// the move button's own label.
//
// WHY THE BUTTON AND NOT THE REGISTER. `countriesMayFight()` is pure and is pinned by
// `tests/unit/ai-diplomatic-gate.spec.js`. What that cannot say is whether the RULE is wired
// to the CONTROL -- whether the game actually refuses the attack, or merely knows it should.
// The button's label is derived from the selection (`deriveMoveButtonState()`), so it is the
// one place the whole chain from register to affordance is visible at once.

/** What the move phase's button is offering right now. */
async function moveButtonLabel(page) {
    return page.evaluate(
        (buttonId) => document.getElementById(buttonId)?.innerHTML ?? "",
        ids.movePhaseButton
    );
}

test.describe("a neutral country cannot be attacked", () => {
    test("the move button offers no ATTACK against a country nobody has declared on", async ({
        startedGame: game,
        page,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");

        // NO `declareWarOn()`. Every attacking spec in the suite goes through
        // `openAttackWindow()`, which declares first; this is the one that must not.
        await game.endBuyPhase();
        await game.selectOnMap("Germany");
        await game.selectOnMap(target);
        await page.waitForTimeout(300);

        expect(await moveButtonLabel(page)).not.toBe("ATTACK");
    });

    test("and the same pairing offers ATTACK once war is declared", async ({
        startedGame: game,
        page,
    }) => {
        // The other half, and the reason the first test is not simply asserting that the
        // button is broken: the pairing is legal in every other respect -- adjacent, enemy
        // owned, in the right phase -- and the ONLY thing that changed is the register.
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");

        await game.endBuyPhase();
        await game.declareWarOn(target);
        await game.selectOnMap("Germany");
        await game.selectOnMap(target);

        await page.waitForFunction(
            (buttonId) => document.getElementById(buttonId)?.innerHTML === "ATTACK",
            ids.movePhaseButton,
            { timeout: 30_000 }
        );
        expect(await moveButtonLabel(page)).toBe("ATTACK");
    });
});

test.describe("the declaration is written where both sides can see it", () => {
    test("puts the pair at war in the register, one record, both directions", async ({
        startedGame: game,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");
        const owner = (await game.territory(target)).dataName;

        await game.declareWarOn(target);

        expect((await game.diplomacy.between("Germany", owner)).state).toBe("war");
        expect((await game.diplomacy.between(owner, "Germany")).state).toBe("war");
    });
});
