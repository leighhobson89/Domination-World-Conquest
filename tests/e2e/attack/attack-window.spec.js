import { test, expect } from "../../support/fixtures.js";
import { containers } from "../../support/selectors.js";

// The attack window: which of the player's territories can join the attack, how
// units are allocated, the probability bar, and what INVADE! actually does.
//
// No exact combat outcome is asserted anywhere here. Seeding Math.random does
// not make the game reproducible while addSparklesRegularly() shares the global
// stream (audit 5.3 Y), so these pin invariants -- units leave their source, the
// battle opens, cancelling returns everything -- and battle/ does the same.
//
// docs/03-e2e-test-plan.md section 5.9.

/** Aim at a reachable enemy of `source` and open the attack window. */
async function openAttackFrom(game, source) {
    await game.endBuyPhase();
    await game.selectOnMap(source);

    const target = await game.firstEnemyReachableFrom(source);
    expect(target, `${source} could reach no enemy territory`).not.toBeNull();

    await game.selectOnMap(target);
    expect(await game.moveButton.label()).toBe("ATTACK");
    await game.moveButton.click();
    await expect.poll(async () => game.transferAttack.isOpen()).toBe(true);
    return target;
}

test.describe("the attack window", () => {
    test("lists the player territories able to reach the target", async ({ startedGame: game }) => {
        await openAttackFrom(game, "Germany");

        const rows = await game.transferAttack.rowNames();
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.some((name) => name.startsWith("Germany"))).toBe(true);
    });

    test("starts at CANCEL and becomes INVADE! once units are allocated", async ({
        startedGame: game,
    }) => {
        await openAttackFrom(game, "Germany");

        // Attack rows need no row selection -- every listed territory can commit
        // units at once, which is the point of a multi-territory assault. Only the
        // TRANSFER mode of the same renderer has a `.selectedRow`.
        expect(await game.moveButton.label()).toBe("CANCEL");

        await game.transferAttack.plus("Germany", "infantry");

        await expect.poll(async () => game.moveButton.label()).toBe("INVADE!");
        expect(await game.moveButton.variant()).toBe("attack");
    });

    test("shows a win probability once units are allocated", async ({ startedGame: game }) => {
        await openAttackFrom(game, "Germany");
        await game.transferAttack.plus("Germany", "infantry");

        const probability = await game.battle.probability();
        expect(Number.isFinite(probability)).toBe(true);
        expect(probability).toBeGreaterThanOrEqual(0);
        expect(probability).toBeLessThanOrEqual(100);
    });

    test("moves the probability when more units are committed", async ({ startedGame: game }) => {
        await openAttackFrom(game, "Germany");

        await game.transferAttack.plus("Germany", "infantry");
        const first = await game.battle.probability();

        await game.transferAttack.cycleMultiplier("Germany", "infantry", 3); // x1k
        await game.transferAttack.plus("Germany", "infantry", 3);
        const second = await game.battle.probability();

        expect(second).toBeGreaterThanOrEqual(first);
    });

    test("cancelling returns every unit and closes the window", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await openAttackFrom(game, "Germany");
        await game.transferAttack.plus("Germany", "infantry");
        await game.transferAttack.close();

        const after = await game.territory("Germany");
        expect(after.infantryForCurrentTerritory).toBe(before.infantryForCurrentTerritory);
        expect(after.armyForCurrentTerritory).toBe(before.armyForCurrentTerritory);
    });

    test("cancelling clears the attack marker from the map", async ({
        startedGame: game,
        page,
    }) => {
        // audit 5.2 AE, closed in Phase 6.7. The battle image used to stay on the
        // target after a cancel by either route -- the window's X or the move
        // button's CANCEL -- because the marker was an <image> that six call sites
        // removed by hand while the fact it was drawing,
        // `territoryAboutToBeAttackedOrSieged`, was a separate `let` that the
        // cancel path nulled without touching the DOM. src/ui/map/markers.js owns
        // both as one fact now: clearing the target removes the marker.
        const markerPresent = () =>
            page.evaluate(
                () =>
                    !!document
                        .getElementById("svg-map")
                        .contentDocument.getElementById("attackImage")
            );

        await openAttackFrom(game, "Germany");
        expect(await markerPresent()).toBe(true);

        expect(await game.moveButton.label()).toBe("CANCEL");
        await game.moveButton.click();

        await expect.poll(markerPresent).toBe(false);
    });

    test("closing the attack window with its X clears the marker too", async ({
        startedGame: game,
        page,
    }) => {
        // The other half of audit 5.2 AE. This route never ran the marker cleanup
        // at all, so it is the one that proves the fix is structural rather than a
        // patch on the one path that happened to be tested.
        const markerPresent = () =>
            page.evaluate(
                () =>
                    !!document
                        .getElementById("svg-map")
                        .contentDocument.getElementById("attackImage")
            );

        await openAttackFrom(game, "Germany");
        expect(await markerPresent()).toBe(true);

        await game.transferAttack.close();

        await expect.poll(markerPresent).toBe(false);
    });
});

test.describe("launching the attack", () => {
    test("takes the committed units out of their source territory immediately", async ({
        startedGame: game,
    }) => {
        // audit 5.1 AD, closed in Phase 4.7. It used to leave the source untouched
        // because the battle ran on copies of both armies and the source was only
        // reconciled when the war resolved -- so the same garrison could be committed
        // to two attacks in one turn and a failed attack cost nothing. Now the siege
        // and war objects reference the real territory, so INVADE! debits it.
        const before = await game.territory("Germany");

        await openAttackFrom(game, "Germany");
        await game.transferAttack.plus("Germany", "infantry");
        const committed = await game.transferAttack.quantity("Germany", "infantry");
        expect(committed).toBeGreaterThan(0);

        await game.moveButton.click();
        await expect.poll(async () => game.battle.isOpen()).toBe(true);

        const after = await game.territory("Germany");
        expect(before.infantryForCurrentTerritory - after.infantryForCurrentTerritory).toBe(
            committed
        );
    });

    test("leaves the source territory's army total consistent with its units", async ({
        startedGame: game,
    }) => {
        // The debit above used to be written as `armyForCurrentTerritory -= (sum of
        // what remains)`, which subtracts the garrison a second time and sends the
        // total negative. It is the sum of the units, so it is an assignment.
        await openAttackFrom(game, "Germany");
        await game.transferAttack.plus("Germany", "infantry");
        await game.moveButton.click();
        await expect.poll(async () => game.battle.isOpen()).toBe(true);

        const after = await game.territory("Germany");
        expect(after.armyForCurrentTerritory).toBeGreaterThanOrEqual(0);
        expect(after.armyForCurrentTerritory).toBeGreaterThanOrEqual(
            after.infantryForCurrentTerritory
        );
    });

    test("opens the battle UI and closes the attack window", async ({ startedGame: game }) => {
        await openAttackFrom(game, "Germany");
        await game.transferAttack.plus("Germany", "infantry");
        await game.moveButton.click();

        await expect.poll(async () => game.battle.isOpen()).toBe(true);
        expect(await game.transferAttack.isOpen()).toBe(false);
    });

    test("names both sides in the battle UI", async ({ startedGame: game, page }) => {
        // __game.wars() reads `historicWars`, which is only written when a war
        // ENDS -- an in-progress battle is not in it. The battle UI's own title is
        // what states who is fighting whom while it is running.
        const target = await openAttackFrom(game, "Germany");
        await game.transferAttack.plus("Germany", "infantry");
        await game.moveButton.click();
        await expect.poll(async () => game.battle.isOpen()).toBe(true);

        const title = await page.locator(containers.battle).innerText();
        expect(title).toContain(target);
        expect(await game.wars()).toEqual([]);
    });
});
