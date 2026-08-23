import { test, expect } from "../../support/fixtures.js";

// Vehicles need oil. A territory that owns more of them than its oil supports
// keeps them, but cannot USE them -- and it is the useable count that feeds
// defence strength and the attack probability, not the owned count.
//
// Per unit, per turn: naval 1,000 · air 300 · assault 100. Infantry needs none.
// Units are taken out of service naval first, then air, then assault.
//
// docs/04-e2e-test-plan.md section 5.5.

const oilRequirements = { assault: 100, air: 300, naval: 1000 };

/** Buy `count` of `unit` in the given territory. */
async function buy(game, territoryName, unit, count) {
    await game.openBuy(territoryName);
    await game.buyWindow.plus(unit, count);
    await game.buyWindow.submit();
}

test.describe("oil demand", () => {
    test("starts satisfied, so every owned vehicle is useable", async ({ startedGame: game }) => {
        const germany = await game.territory("Germany");

        expect(germany.oilDemand).toBeLessThanOrEqual(germany.oilForCurrentTerritory);
        expect(germany.useableAssault).toBe(germany.assaultForCurrentTerritory);
        expect(germany.useableAir).toBe(germany.airForCurrentTerritory);
        expect(germany.useableNaval).toBe(germany.navalForCurrentTerritory);
    });

    test("rises by the per-unit figure for each vehicle bought", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await buy(game, "Germany", "naval", 2);

        const after = await game.territory("Germany");
        expect(after.oilDemand - before.oilDemand).toBeCloseTo(oilRequirements.naval * 2, 4);
    });

    test("leaves vehicles owned but not useable once demand outruns supply", async ({
        startedGame: game,
    }) => {
        const before = await game.territory("Germany");

        // Enough naval units to blow well past the territory's oil supply.
        const excessive = Math.ceil(before.oilForCurrentTerritory / oilRequirements.naval) + 5;
        await buy(game, "Germany", "naval", excessive);

        const after = await game.territory("Germany");
        expect(after.navalForCurrentTerritory).toBe(before.navalForCurrentTerritory + excessive);
        expect(after.oilDemand).toBeGreaterThan(after.oilForCurrentTerritory);
        expect(
            after.useableNaval,
            "owning them is not the same as being able to use them"
        ).toBeLessThan(after.navalForCurrentTerritory);
    });

    test("takes naval units out of service before air and assault", async ({
        startedGame: game,
    }) => {
        const before = await game.territory("Germany");

        await buy(game, "Germany", "assault", 3);
        await buy(game, "Germany", "air", 3);
        const excessive = Math.ceil(before.oilForCurrentTerritory / oilRequirements.naval) + 2;
        await buy(game, "Germany", "naval", excessive);

        const after = await game.territory("Germany");
        const navalGrounded = after.navalForCurrentTerritory - after.useableNaval;
        const airGrounded = after.airForCurrentTerritory - after.useableAir;

        expect(navalGrounded).toBeGreaterThan(0);
        // Air only starts being grounded once every naval unit already is.
        if (airGrounded > 0) {
            expect(after.useableNaval).toBe(0);
        }
    });

    test("re-evaluates useability immediately, not at the next turn", async ({
        startedGame: game,
    }) => {
        const before = await game.territory("Germany");
        const excessive = Math.ceil(before.oilForCurrentTerritory / oilRequirements.naval) + 5;

        await buy(game, "Germany", "naval", excessive);

        // No phase change, no turn rollover -- the figure is already correct.
        const after = await game.territory("Germany");
        expect(after.useableNaval).toBeLessThan(after.navalForCurrentTerritory);
    });

    test("never grounds infantry, which needs no oil", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");
        const excessive = Math.ceil(before.oilForCurrentTerritory / oilRequirements.naval) + 5;

        await buy(game, "Germany", "naval", excessive);
        await buy(game, "Germany", "infantry", 5);

        const after = await game.territory("Germany");
        expect(after.infantryForCurrentTerritory).toBe(
            before.infantryForCurrentTerritory + 5 * 1000
        );
    });
});
