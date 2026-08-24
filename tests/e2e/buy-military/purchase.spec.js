import { test, expect } from "../../support/fixtures.js";

// Steppers, prices, and what confirming a purchase actually moves.
//
// Prices are COPIES of resourceCalculations.js's `armyGoldPrices`,
// `armyProdPopPrices`, `oilRequirements` and `INFANTRY_IN_A_TROOP`, not imports:
// that module calls `document.getElementById` at module-evaluation time, so it
// cannot be loaded into a Node-side spec. They become a real import at refactor
// Phase 5.1, when the numbers move into `config/balance.js`.
//
// docs/04-e2e-test-plan.md section 5.6.

const armyGoldPrices = { infantry: 10, assault: 50, air: 100, naval: 200 };
const armyProdPopPrices = { infantry: 1000, assault: 1000, air: 5000, naval: 20000 };
const oilRequirements = { assault: 100, air: 300, naval: 1000 };

/** One "infantry" row buys a troop of 1,000, not one soldier. */
const INFANTRY_IN_A_TROOP = 1000;

test.describe("quantity steppers", () => {
    test("cycle the multiplier x1 -> x10 -> x100 -> x1k and wrap", async ({
        startedGame: game,
    }) => {
        await game.openBuy("Germany");

        expect(await game.buyWindow.multiplier("infantry")).toBe("x1");
        expect(await game.buyWindow.cycleMultiplier("infantry")).toBe("x10");
        expect(await game.buyWindow.cycleMultiplier("infantry")).toBe("x100");
        expect(await game.buyWindow.cycleMultiplier("infantry")).toBe("x1k");
        expect(await game.buyWindow.cycleMultiplier("infantry")).toBe("x1");
    });

    test("step by the selected multiplier", async ({ startedGame: game }) => {
        await game.openBuy("Germany");

        await game.buyWindow.plus("infantry");
        expect(await game.buyWindow.quantity("infantry")).toBe(1);

        await game.buyWindow.cycleMultiplier("infantry"); // x10
        await game.buyWindow.plus("infantry");
        expect(await game.buyWindow.quantity("infantry")).toBe(11);

        await game.buyWindow.minus("infantry");
        expect(await game.buyWindow.quantity("infantry")).toBe(1);
    });

    test("clamp at zero", async ({ startedGame: game }) => {
        await game.openBuy("Germany");

        await game.buyWindow.minus("assault", 3);
        expect(await game.buyWindow.quantity("assault")).toBe(0);
    });

    test("track the running gold and manpower totals", async ({ startedGame: game }) => {
        await game.openBuy("Germany");

        await game.buyWindow.plus("infantry");
        expect(await game.buyWindow.totals()).toEqual({
            gold: armyGoldPrices.infantry,
            prodPop: armyProdPopPrices.infantry,
        });

        await game.buyWindow.plus("assault", 2);
        expect(await game.buyWindow.totals()).toEqual({
            gold: armyGoldPrices.infantry + armyGoldPrices.assault * 2,
            prodPop: armyProdPopPrices.infantry + armyProdPopPrices.assault * 2,
        });
    });

    test("turn the confirm button into Confirm only once something is selected", async ({
        startedGame: game,
    }) => {
        await game.openBuy("Germany");
        expect(await game.buyWindow.confirmLabel()).toBe("Cancel");

        await game.buyWindow.plus("air");
        expect(await game.buyWindow.confirmLabel()).toBe("Confirm");
    });
});

test.describe("confirming a purchase", () => {
    test("deducts exactly the quoted gold and manpower", async ({ startedGame: game }) => {
        // audit 5.1 AC, fixed in refactor Phase 3.0. addPlayerPurchases used to deduct
        // the cost AND call the two checkForMinusAndTransfer... helpers, each of which
        // ends by deducting its own cost -- so every military purchase was charged
        // twice while the window quoted the correct, single price. The caller no
        // longer deducts; the helpers borrow and then charge, once.
        const before = await game.territory("Germany");

        await game.openBuy("Germany");
        await game.buyWindow.plus("assault", 2);
        const quoted = await game.buyWindow.totals();
        await game.buyWindow.submit();

        const after = await game.territory("Germany");
        expect(quoted.gold).toBe(armyGoldPrices.assault * 2);
        expect(before.goldForCurrentTerritory - after.goldForCurrentTerritory).toBeCloseTo(
            quoted.gold,
            4
        );
        expect(before.productiveTerritoryPop - after.productiveTerritoryPop).toBeCloseTo(
            quoted.prodPop,
            4
        );
    });

        test("adds exactly the units bought", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.openBuy("Germany");
        await game.buyWindow.plus("assault", 2);
        await game.buyWindow.plus("air");
        await game.buyWindow.submit();

        const after = await game.territory("Germany");
        expect(after.assaultForCurrentTerritory).toBe(before.assaultForCurrentTerritory + 2);
        expect(after.airForCurrentTerritory).toBe(before.airForCurrentTerritory + 1);
        expect(after.navalForCurrentTerritory).toBe(before.navalForCurrentTerritory);
    });

    test("buys infantry in troops of a thousand", async ({ startedGame: game }) => {
        // The row reads "+1000 Infantry" and the purchase is multiplied by
        // vehicleArmyPersonnelWorth.infantry * 1000 on the way into the model.
        const before = await game.territory("Germany");

        await game.openBuy("Germany");
        await game.buyWindow.plus("infantry", 3);
        await game.buyWindow.submit();

        const after = await game.territory("Germany");
        expect(after.infantryForCurrentTerritory).toBe(
            before.infantryForCurrentTerritory + 3 * INFANTRY_IN_A_TROOP
        );
        expect(after.armyForCurrentTerritory).toBe(
            before.armyForCurrentTerritory + 3 * INFANTRY_IN_A_TROOP
        );
    });

    test("raises the territory's oil demand by the published per-unit figures", async ({
        startedGame: game,
    }) => {
        const before = await game.territory("Germany");

        await game.openBuy("Germany");
        await game.buyWindow.plus("assault");
        await game.buyWindow.plus("air");
        await game.buyWindow.submit();

        const after = await game.territory("Germany");
        expect(after.oilDemand - before.oilDemand).toBeCloseTo(
            oilRequirements.assault + oilRequirements.air,
            4
        );
    });

    test("leaves infantry out of the oil demand entirely", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.openBuy("Germany");
        await game.buyWindow.plus("infantry", 5);
        await game.buyWindow.submit();

        const after = await game.territory("Germany");
        expect(after.oilDemand).toBeCloseTo(before.oilDemand, 4);
    });

    test("updates the top table's army figure without a phase change", async ({
        startedGame: game,
    }) => {
        const armyBefore = await game.topTable.text("army");

        await game.openBuy("Germany");
        await game.buyWindow.plus("infantry", 10);
        await game.buyWindow.submit();

        await expect.poll(async () => game.topTable.text("army")).not.toBe(armyBefore);
    });
});
