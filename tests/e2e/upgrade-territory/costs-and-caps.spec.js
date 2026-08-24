import { test, expect } from "../../support/fixtures.js";

// What a building costs, and the five-per-territory cap.
//
// The cost is QUADRATIC in the running total, not linear:
//
//     cost(n) = ceil(base x n x (n x mult) x (devIndex / 4))
//
// where `n` is the number that WOULD be built (already built + selected), `mult`
// is 1.05 everywhere except a farm's construction materials, which use 1.1. So
// the second farm costs four times the first, not the same again. That is the
// mechanic; the e2e plan's "base x modifier x (devIndex / 4)" describes only the
// n = 1 case.
//
// The constants below are COPIES of resourceCalculations.js's
// `territoryUpgradeBaseCostsGold` / `territoryUpgradeBaseCostsConsMats`, not
// imports: that module runs `document.getElementById("tooltip")` at
// module-evaluation time, so it cannot be loaded into a Node-side spec. They
// become a real import at refactor Phase 5.1, when the numbers move into
// `config/balance.js` -- which is also when the arithmetic itself becomes a
// Vitest unit test. What belongs here is that the window quotes and then charges
// the same number.
//
// docs/04-e2e-test-plan.md section 5.7.

// Hokkaido (Japan), not Alaska (United States): since refactor Phase 3 the country
// selection strength gate actually fires (audit 5.2 Z), and the United States is above
// COUNTRY_GREYOUT_RANK, so it can no longer be chosen. Hokkaido is the same shape of
// fixture and a better one -- it reaches four other Japanese territories and two enemy
// ones (Russia, Kamchatkan Islands 3), where Alaska reached fewer.
const baseGold = { farm: 200, forest: 200, oilWell: 1100, fort: 1000 };
const baseConsMats = { farm: 500, forest: 500, oilWell: 200, fort: 600 };

const MAX_PER_BUILDING = 5;

function cost(base, quantity, devIndex, mult = 1.05) {
    return Math.ceil(base * quantity * (quantity * mult) * (devIndex / 4));
}

test.describe("upgrade costs", () => {
    test("quote base x mult x (devIndex / 4) for the first building", async ({
        startedGame: game,
    }) => {
        const germany = await game.territory("Germany");
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");

        const totals = await game.upgradeWindow.totals();
        expect(totals.gold).toBe(cost(baseGold.farm, 1, germany.devIndex));
        expect(totals.consMats).toBe(cost(baseConsMats.farm, 1, germany.devIndex, 1.1));
    });

    test("grow quadratically with the running total, not linearly", async ({
        startedGame: game,
    }) => {
        const germany = await game.territory("Germany");
        await game.openUpgrade("Germany");

        await game.upgradeWindow.plus("farm");
        const one = await game.upgradeWindow.totals();

        await game.upgradeWindow.plus("farm");
        const two = await game.upgradeWindow.totals();

        expect(await game.upgradeWindow.quantity("farm")).toBe(2);
        expect(one.gold).toBe(cost(baseGold.farm, 1, germany.devIndex));
        expect(two.gold).toBe(cost(baseGold.farm, 2, germany.devIndex));
        // 2^2 / 1^2 -- four times the first, not twice.
        expect(two.gold).toBeGreaterThan(one.gold * 3);
    });

    test("scale with the territory's devIndex", async ({ startedGame: game }) => {
        const germany = await game.territory("Germany");
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort");

        const quoted = await game.upgradeWindow.totals();
        // The whole cost is proportional to devIndex, so a more developed
        // territory pays MORE for the same building. (The e2e plan's prose says
        // "less"; the shipped formula says more, and the code is the reference
        // until Phase 5.1 settles the design question.)
        expect(quoted.gold).toBe(cost(baseGold.fort, 1, germany.devIndex));
        expect(germany.devIndex).toBeGreaterThan(0);
    });

    test("charge exactly the quoted total on confirm", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort");
        const quoted = await game.upgradeWindow.totals();
        await game.upgradeWindow.submit();

        const after = await game.territory("Germany");
        // Upgrades are charged once. Military purchases are charged twice --
        // see audit 5.1 AC and buy-military/purchase.spec.js. The asymmetry is
        // exactly why both are pinned.
        expect(before.goldForCurrentTerritory - after.goldForCurrentTerritory).toBeCloseTo(
            quoted.gold,
            4
        );
        expect(before.consMatsForCurrentTerritory - after.consMatsForCurrentTerritory).toBeCloseTo(
            quoted.consMats,
            4
        );
        expect(after.fortsBuilt).toBe(before.fortsBuilt + 1);
    });

    test("count what is already built into the next purchase's price", async ({
        startedGame: game,
    }) => {
        const germany = await game.territory("Germany");

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");
        const firstQuote = await game.upgradeWindow.totals();
        await game.upgradeWindow.submit();

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");
        const secondQuote = await game.upgradeWindow.totals();

        expect(firstQuote.gold).toBe(cost(baseGold.farm, 1, germany.devIndex));
        expect(secondQuote.gold).toBe(cost(baseGold.farm, 2, germany.devIndex));
    });
});

test.describe("building caps and affordability", () => {
    test("stop the stepper once the territory cannot pay for the next one", async ({
        startedGame: game,
    }) => {
        // Germany cannot fund five forts in one transaction -- the cost is
        // quadratic and the plus button greys out when the next one is
        // unaffordable. That is affordability doing its job, not the cap.
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort", 10);

        const reached = await game.upgradeWindow.quantity("fort");
        expect(reached).toBeGreaterThan(0);
        expect(reached).toBeLessThanOrEqual(MAX_PER_BUILDING);
        expect(await game.upgradeWindow.rowGreyedOut("fort")).toBe(true);
    });

    test("cap a building at five however rich the player is", async ({ game }) => {
        // Japan funds a purchase from ALL of the player's territories
        // (checkForMinusAndTransfer...), so this is the case where the cap, rather
        // than the wallet, is what stops the stepper.
        await game.start({ country: "Hokkaido" });

        await game.openUpgrade("Hokkaido");
        await game.upgradeWindow.plus("farm", 12);

        expect(await game.upgradeWindow.quantity("farm")).toBeLessThanOrEqual(MAX_PER_BUILDING);
    });

    test("clamp the minus stepper at zero", async ({ startedGame: game }) => {
        await game.openUpgrade("Germany");

        await game.upgradeWindow.minus("farm", 3);
        expect(await game.upgradeWindow.quantity("farm")).toBe(0);

        await game.upgradeWindow.plus("farm");
        await game.upgradeWindow.minus("farm", 5);
        expect(await game.upgradeWindow.quantity("farm")).toBe(0);
    });

    test("turn the confirm button into Confirm only once something is selected", async ({
        startedGame: game,
    }) => {
        await game.openUpgrade("Germany");
        expect(await game.upgradeWindow.confirmLabel()).toBe("Cancel");

        await game.upgradeWindow.plus("farm");
        expect(await game.upgradeWindow.confirmLabel()).toBe("Confirm");
    });
});
