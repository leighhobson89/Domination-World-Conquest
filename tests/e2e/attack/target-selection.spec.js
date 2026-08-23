import { test, expect } from "../../support/fixtures.js";

// Picking an enemy territory to attack: what the move button becomes, what the
// banner says, and what the map shows.
//
// docs/04-e2e-test-plan.md section 5.9.

/** Select an owned territory, then a reachable enemy of it. Returns the target's name. */
async function aimAtEnemy(game, source) {
    await game.endBuyPhase();
    await game.selectOnMap(source);

    const target = await game.firstEnemyReachableFrom(source);
    expect(target, `${source} could reach no enemy territory`).not.toBeNull();

    await game.selectOnMap(target);
    return target;
}

test.describe("choosing a target", () => {
    test("turns the move button red and reads ATTACK", async ({ startedGame: game }) => {
        await aimAtEnemy(game, "Germany");

        expect(await game.moveButton.label()).toBe("ATTACK");
        expect(await game.moveButton.variant()).toBe("attack");
        expect(await game.moveButton.isEnabled()).toBe(true);
    });

    test("names the target in the destination banner", async ({ startedGame: game }) => {
        const target = await aimAtEnemy(game, "Germany");
        expect(await game.moveButton.destinationText()).toBe(target);
    });

    test("marks the target on the map with the battle image", async ({
        startedGame: game,
        page,
    }) => {
        await aimAtEnemy(game, "Germany");

        const marked = await page.evaluate(
            () => !!document.getElementById("svg-map").contentDocument.getElementById("attackImage")
        );
        expect(marked).toBe(true);
    });

    test("offers no button for an enemy territory out of range", async ({ startedGame: game }) => {
        await game.endBuyPhase();
        await game.selectOnMap("Germany");

        const reachable = await game.interactableFrom("Germany");
        expect(reachable).not.toContain("Australia");

        await game.selectOnMap("Australia");
        expect(await game.moveButton.isVisible()).toBe(false);
    });

    test("reverts to TRANSFER when an owned territory is chosen again", async ({ game }) => {
        await game.start({ country: "Alaska" });
        await game.endBuyPhase();
        await game.selectOnMap("Alaska");

        const target = await game.firstEnemyReachableFrom("Alaska");
        test.skip(!target, "Alaska could reach no enemy territory");

        await game.selectOnMap(target);
        expect(await game.moveButton.label()).toBe("ATTACK");

        await game.selectOnMap("Alaska");
        expect(await game.moveButton.label()).toBe("TRANSFER");
        expect(await game.moveButton.variant()).toBe("transfer");
    });
});
