import { test, expect } from "../../support/fixtures.js";

// The turn counter, and the fact that turn 1 deliberately applies no income.
// docs/04-e2e-test-plan.md section 5.3.

test.describe("the turn counter", () => {
    test("increments once per full cycle, not once per phase", async ({ startedGame: game }) => {
        expect(await game.turn()).toBe(1);

        await game.endBuyPhase();
        expect(await game.turn(), "the Military phase is still turn 1").toBe(1);

        await game.endTurn();
        expect(await game.turn()).toBe(2);
    });

    test("applies no income on turn 1", async ({ startedGame: game }) => {
        // newTurnResources() skips calculateTerritoryResourceIncomesEachTurn() when
        // currentTurn === 1, because leaders and forts are created AFTER
        // initialiseGame() resolves (audit 5.3, bootstrap ordering). Turn 1 is a
        // snapshot of the seeded world, nothing more.
        const before = await game.totals();
        const territoryBefore = await game.territory("Germany");

        // Nothing the player does changes this; only the turn rollover would.
        expect(before.gold).toBeCloseTo(territoryBefore.goldForCurrentTerritory, 5);
    });

    test("applies income from turn 2 onward", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.playTurn();

        const after = await game.territory("Germany");
        expect(await game.turn()).toBe(2);
        // Gold accrues every turn regardless of the balance of the other
        // resources, so it is the honest signal that income ran at all. The exact
        // figure is not asserted -- see docs/04-e2e-test-plan.md section 2.2.
        //
        // This is also the spec that exposed audit 5.1 AB: read through the O(1)
        // territory index it reported no change at all, because the AI substitutes
        // whole elements into mainGameArray and orphans the index. The ?e2e=1
        // accessor now scans the live array, which is why it passes.
        expect(after.goldForCurrentTerritory).toBeGreaterThan(before.goldForCurrentTerritory);
    });

    test("moves oil, food and cons. mats toward capacity rather than leaving them static", async ({
        startedGame: game,
    }) => {
        // Territories start AT their oil and cons. mats capacity, so those two
        // legitimately do not move on turn 2 -- the regeneration rules only fire on
        // a gap. Food and population do move. Asserted as "the economy is running"
        // rather than as figures: see docs/04-e2e-test-plan.md section 2.2.
        const moved = await game.state(() => {
            const owned = window.__game.territoriesOwnedBy("Player")[0];
            return {
                atOilCapacity: Math.abs(owned.oilForCurrentTerritory - owned.oilCapacity) < 1,
                atConsMatsCapacity:
                    Math.abs(owned.consMatsForCurrentTerritory - owned.consMatsCapacity) < 1,
            };
        });

        await game.playTurn();

        const after = await game.state(() => {
            const owned = window.__game.territoriesOwnedBy("Player")[0];
            return {
                oil: owned.oilForCurrentTerritory,
                oilCapacity: owned.oilCapacity,
                consMats: owned.consMatsForCurrentTerritory,
                consMatsCapacity: owned.consMatsCapacity,
            };
        });

        if (moved.atOilCapacity) {
            expect(after.oil).toBeCloseTo(after.oilCapacity, 0);
        }
        if (moved.atConsMatsCapacity) {
            expect(after.consMats).toBeCloseTo(after.consMatsCapacity, 0);
        }
    });

    test("keeps the player's territories across a turn when nothing attacks them", async ({
        startedGame: game,
    }) => {
        const before = (await game.playerTerritories()).map((t) => t.territoryName).sort();

        await game.playTurn();

        const after = (await game.playerTerritories()).map((t) => t.territoryName).sort();
        expect(after).toEqual(before);
    });
});
