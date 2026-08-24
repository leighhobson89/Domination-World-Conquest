import { test, expect } from "../../support/fixtures.js";
import { containers, moveButton } from "../../support/selectors.js";

// Hokkaido (Japan), not Alaska (United States): since refactor Phase 3 the country
// selection strength gate actually fires (audit 5.2 Z), and the United States is above
// COUNTRY_GREYOUT_RANK, so it can no longer be chosen. Hokkaido is the same shape of
// fixture and a better one -- it reaches four other Japanese territories and two enemy
// ones (Russia, Kamchatkan Islands 3), where Alaska reached fewer.
// What is available in which phase. The buy/upgrade buttons are gated on
// `currentTurnPhase === 0`, and the transfer/attack button on phase 1.
//
// docs/04-e2e-test-plan.md section 5.3.

test.describe("phase restrictions", () => {
    test("offers buy and upgrade in Buy/Upgrade", async ({ startedGame: game }) => {
        await game.infoTable.open();

        expect(await game.infoTable.upgradeButtonEnabled("Germany")).toBe(true);
        expect(await game.infoTable.buyButtonEnabled("Germany")).toBe(true);
    });

    test("withdraws buy and upgrade in the Military phase", async ({ startedGame: game }) => {
        await game.endBuyPhase();
        await game.infoTable.open();

        // The row still renders, but with the greyed-out image and no
        // `.upgrade-button` / `.buy-button` class, so there is nothing to click.
        expect(await game.infoTable.upgradeButtonEnabled("Germany")).toBe(false);
        expect(await game.infoTable.buyButtonEnabled("Germany")).toBe(false);
    });

    test("does not offer the transfer/attack button during Buy/Upgrade", async ({
        startedGame: game,
        page,
    }) => {
        await game.selectOnMap("Germany");
        // handleMovePhaseTransferAttackButton only runs for currentTurnPhase === 1,
        // so in Buy/Upgrade clicking a territory must leave the button hidden.
        await expect(page.locator(moveButton.button)).toBeHidden();
    });

    test("offers a live TRANSFER once the Military phase begins", async ({ game }) => {
        // A country with somewhere to transfer TO. Germany owns one territory, so
        // its button is correctly dead -- that case is the next spec.
        await game.start({ country: "Hokkaido" });
        await game.endBuyPhase();
        await game.selectOnMap("Hokkaido");

        await expect(game.moveButton.button).toBeVisible();
        expect(await game.moveButton.label()).toBe("TRANSFER");
        expect(await game.moveButton.variant()).toBe("transfer");
        expect(await game.moveButton.isEnabled()).toBe(true);
    });

    test("greys TRANSFER out for a player who owns a single territory", async ({
        startedGame: game,
    }) => {
        await game.endBuyPhase();
        await game.selectOnMap("Germany");

        await expect(game.moveButton.button).toBeVisible();
        expect(await game.moveButton.label()).toBe("TRANSFER");
        expect(await game.moveButton.variant()).toBe("disabled");
        expect(await game.moveButton.isEnabled()).toBe(false);
    });

    test("keeps the in-game panels hidden until they are asked for", async ({
        startedGame: game,
        page,
    }) => {
        for (const selector of [
            containers.buy,
            containers.upgrade,
            containers.transferAttack,
            containers.battle,
            containers.battleResults,
        ]) {
            await expect(page.locator(selector), `${selector} should start hidden`).toBeHidden();
        }
    });
});
