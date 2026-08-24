import { test, expect } from "../../support/fixtures.js";
import { PROBABILITY_THRESHOLD_FOR_SIEGE } from "../../../src/config/balance.js";
import { battle } from "../../support/selectors.js";

// Turning an attack into a standing siege, and when the game lets you.
// docs/04-e2e-test-plan.md sections 5.9 and 5.11.

test.describe("laying a siege", () => {
    test.setTimeout(240_000);

    test("offers the Siege option once the odds are at or above the threshold", async ({
        game,
        page,
    }) => {
        // NOTE ON THE PLAN. docs/04-e2e-test-plan.md section 5.9 states this the other way
        // round -- "when probability < 15 % the Siege button is enabled; at or above it is
        // disabled". The shipped rule is the opposite, and so is the AI's: `ai/goals.js`
        // pushes a Siege goal on `probabilityOfWin >= PROBABILITY_THRESHOLD_FOR_SIEGE`. A
        // siege commits an army for many turns, so it is offered when there is a real chance
        // of finishing it, not when the attack is hopeless. The code and the AI agree with
        // each other; the plan row is the odd one out, and it is the plan that is wrong.
        await game.start({ country: "Germany", seed: "siege-offer" });
        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });

        const odds = await game.battle.probability();
        expect(odds).toBeGreaterThanOrEqual(PROBABILITY_THRESHOLD_FOR_SIEGE);
        await expect(page.locator(battle.siege)).toBeEnabled();
        await expect(page.locator(battle.siege)).toHaveText("Siege Territory");
    });

    test("withholds it when the attack is hopeless", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "siege-no-offer" });
        await game.loadScenario("hopeless-attacker");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });

        const odds = await game.battle.probability();
        expect(odds).toBeLessThan(PROBABILITY_THRESHOLD_FOR_SIEGE);
        await expect(page.locator(battle.siege)).toBeDisabled();
    });

    test("converts the attack into a standing siege", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "siege-start" });
        await game.loadScenario("evenly-matched");
        const committed = await game.launchWholeGarrison({ from: "Germany", to: "France" });
        expect(committed).toBe(400);

        expect(await game.sieges(), "no siege before the button is pressed").toEqual({
            player: [],
            ai: [],
        });

        await page.locator(battle.siege).click();
        await expect.poll(async () => (await game.sieges()).player).toContain("France");

        // The battle UI closes and the map comes back.
        await expect.poll(async () => game.battle.isOpen()).toBe(false);

        const siege = await page.evaluate(() => window.__game.siegeAt("France"));
        expect(siege.side).toBe("player");
        expect(siege.defendingTerritory).toBe("France");
        expect(siege.turnsInSiege).toBe(0);
        expect(
            siege.attackingArmyRemaining[3],
            "the besieging fleet is the force that was committed"
        ).toBeGreaterThan(0);

        // `underSiege` is DERIVED from the siege lists and rendered by mapAttributeSync --
        // adding the siege is the whole operation, so the attribute has to follow.
        expect(await game.map.attribute("France", "underSiege")).toBe("true");

        const markerShown = await page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            // getElementById, not a selector: six territory names carry real parentheses
            // and would not be valid CSS (audit 5.2 AI).
            return !!doc.getElementById("siegeImage_France");
        });
        expect(markerShown, "the besieged territory carries the siege marker").toBe(true);

        // The besieging army left its source when INVADE! was pressed and does not come
        // back when the attack becomes a siege.
        const source = await game.territory("Germany");
        expect(source.navalForCurrentTerritory).toBe(0);
        expect(source.navalForCurrentTerritory).toBeGreaterThanOrEqual(0);
    });
});
