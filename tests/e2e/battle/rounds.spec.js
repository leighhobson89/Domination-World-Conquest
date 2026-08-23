import { test, expect } from "../../support/fixtures.js";

// A battle, round by round.
//
// EVERY assertion here is an invariant, never an outcome. Seeding Math.random is
// necessary but NOT sufficient: addSparklesRegularly() re-arms a timer every
// 0-100 ms and burns three draws per tick on the same global stream that combat
// draws from, so how many cosmetic draws land between two combat draws depends
// on wall-clock timing and two runs with the same seed diverge (audit 5.3 Y,
// e2e plan section 2.2). Exact survivor counts become assertable when Phase 5.3
// takes an injected RNG -- the canary is
// `bootstrap/e2e-hook.spec.js`'s "the same seed produces the same world".
//
// docs/04-e2e-test-plan.md section 5.10.

/** Attack a reachable enemy of `source` with everything the window will allow. */
async function startBattleFrom(game, source, { units = "infantry" } = {}) {
    await game.endBuyPhase();
    await game.selectOnMap(source);

    const target = await game.firstEnemyReachableFrom(source);
    expect(target, `${source} could reach no enemy territory`).not.toBeNull();

    await game.selectOnMap(target);
    await game.moveButton.click();
    await expect.poll(async () => game.transferAttack.isOpen()).toBe(true);

    await game.transferAttack.cycleMultiplier(source, units, 3);
    await game.transferAttack.plus(source, units, 4);
    await game.moveButton.click();
    await expect.poll(async () => game.battle.isOpen()).toBe(true);
    return target;
}

/**
 * A side's total headcount as the battle UI renders it. The cells are
 * KMB-formatted ("1.2k"), so this is a coarse comparison of like with like --
 * enough to say "smaller than last round", which is all these specs claim.
 */
function totalOf(row) {
    const scale = { k: 1e3, M: 1e6, B: 1e9 };
    return row
        .filter((cell) => cell !== null && cell !== "")
        .map((cell) => {
            const text = String(cell).trim();
            const value = Number.parseFloat(text);
            if (!Number.isFinite(value)) return 0;
            const suffix = text.slice(-1);
            return value * (scale[suffix] ?? 1);
        })
        .reduce((a, b) => a + b, 0);
}

test.describe("a battle", () => {
    test("opens with both sides listed and an advance button", async ({ startedGame: game }) => {
        await startBattleFrom(game, "Germany");

        expect(await game.battle.isOpen()).toBe(true);
        await expect(game.battle.advance).toBeVisible();
        await expect(game.battle.retreat).toBeVisible();

        const attackers = await game.battle.armyRow(1);
        expect(totalOf(attackers)).toBeGreaterThan(0);
    });

    test("shows a probability between 0 and 100", async ({ startedGame: game }) => {
        await startBattleFrom(game, "Germany");

        const probability = await game.battle.probability();
        expect(probability).toBeGreaterThanOrEqual(0);
        expect(probability).toBeLessThanOrEqual(100);
    });

    test("only ever reduces the totals on both sides as rounds advance", async ({
        startedGame: game,
    }) => {
        await startBattleFrom(game, "Germany");

        let attackers = totalOf(await game.battle.armyRow(1));
        let defenders = totalOf(await game.battle.armyRow(2));

        for (let round = 0; round < 3; round += 1) {
            if (!(await game.battle.isOpen())) break;
            if (!(await game.battle.advance.isVisible())) break;

            await game.battle.advanceRound();
            // The round animates; wait for the UI to settle rather than for a
            // fixed delay.
            await expect
                .poll(async () =>
                    (await game.battle.isOpen()) ? totalOf(await game.battle.armyRow(1)) : 0
                )
                .toBeLessThanOrEqual(attackers);

            if (!(await game.battle.isOpen())) break;

            const nextAttackers = totalOf(await game.battle.armyRow(1));
            const nextDefenders = totalOf(await game.battle.armyRow(2));

            expect(nextAttackers, `round ${round + 1} attackers`).toBeLessThanOrEqual(attackers);
            expect(nextDefenders, `round ${round + 1} defenders`).toBeLessThanOrEqual(defenders);

            attackers = nextAttackers;
            defenders = nextDefenders;
        }
    });

    test("never lets either side go negative", async ({ startedGame: game }) => {
        await startBattleFrom(game, "Germany");

        for (let round = 0; round < 5; round += 1) {
            if (!(await game.battle.isOpen())) break;
            if (!(await game.battle.advance.isVisible())) break;
            await game.battle.advanceRound();
            await game.page.waitForTimeout(250);

            if (!(await game.battle.isOpen())) break;
            expect(totalOf(await game.battle.armyRow(1))).toBeGreaterThanOrEqual(0);
            expect(totalOf(await game.battle.armyRow(2))).toBeGreaterThanOrEqual(0);
        }
    });

    test("resolves into either a results screen or a continuing battle, never a dead end", async ({
        startedGame: game,
        page,
    }) => {
        await startBattleFrom(game, "Germany");

        for (let round = 0; round < 6; round += 1) {
            if (!(await game.battle.isOpen())) break;
            if (!(await game.battle.advance.isVisible())) break;
            await game.battle.advanceRound();
            await page.waitForTimeout(300);
        }

        // One of the two panels must be on screen. A battle that shows neither is
        // the deadlock of audit 5.2 K -- see mismatched-unit-types.spec.js.
        const somethingIsShowing =
            (await game.battle.isOpen()) || (await game.battle.resultsShown());
        expect(somethingIsShowing).toBe(true);
    });
});
