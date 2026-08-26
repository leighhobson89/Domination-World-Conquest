import { test, expect } from "../../support/fixtures.js";

// A siege between two AI countries has to resolve between those two countries.
// docs/04-e2e-test-plan.md section 5.11.

test.describe("a siege the player is no party to", () => {
    test.setTimeout(300_000);

    test("hands the territory to the besieging AI, not to the player", async ({ game }) => {
        await game.start({ country: "Germany", seed: "ai-siege-starves-out" });
        await game.loadScenario("ai-siege-starves-out");

        const before = await game.territory("Estonia");
        expect(before.owner, "the scenario besieges an AI territory").toBe("Estonia");
        expect((await game.sieges()).ai).toContain("Estonia");

        // The starve-out is resolved by the next turn's income pass, in beginTurn().
        await game.playTurn();

        const after = await game.territory("Estonia");
        expect(
            after.owner,
            "Russia's siege of Estonia is nothing to do with the player"
        ).not.toBe("Player");
        const playerHeld = (await game.playerTerritories()).map((t) => t.territoryName);
        expect(playerHeld).not.toContain("Estonia");

        // Whoever holds it, it has to be a real country: the AI conquest branch read the
        // besieger off a field the siege object does not carry, which set the owner to
        // `undefined` on the rare turn it ran at all.
        expect(typeof after.owner).toBe("string");
        expect(after.owner.length).toBeGreaterThan(0);

        // And the siege has to be gone from the list it was actually in. Removing it
        // through the player's list leaves it standing in the AI's for the rest of the
        // game, on a territory that has already fallen.
        const sieges = await game.sieges();
        expect(sieges.ai).not.toContain("Estonia");
        expect(sieges.player).not.toContain("Estonia");
    });
});
