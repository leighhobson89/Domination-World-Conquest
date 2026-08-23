import { test, expect } from "../../support/fixtures.js";

// Moving units between two territories the player owns.
//
// The United States is the smallest world in which a transfer is possible at
// all: 11 territories, several of them mutually reachable. Germany owns one, so
// its TRANSFER button is correctly dead (valid-destinations.spec.js).
//
// docs/04-e2e-test-plan.md section 5.8.

/** Open the transfer window from a source territory the player owns. */
async function openTransferFrom(game, source) {
    await game.endBuyPhase();
    await game.selectOnMap(source);
    expect(await game.moveButton.variant()).toBe("transfer");
    await game.moveButton.click();
    await expect.poll(async () => game.transferAttack.isOpen()).toBe(true);
}

/** A destination the source can reach that the player also owns. */
async function friendlyDestination(game, source) {
    const reachable = await game.interactableFrom(source);
    for (const name of reachable ?? []) {
        const territory = await game.territory(name);
        if (territory && territory.owner === "Player" && territory.territoryName !== source) {
            return name;
        }
    }
    return null;
}

test.describe("the transfer window", () => {
    test("lists the destinations the source can reach, and not the source itself", async ({
        game,
    }) => {
        await game.start({ country: "Alaska" });
        await openTransferFrom(game, "Alaska");

        const rows = await game.transferAttack.rowNames();
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.some((name) => name.startsWith("Alaska "))).toBe(false);
    });

    test("labels each destination coastal or landlocked", async ({ game }) => {
        await game.start({ country: "Alaska" });
        await openTransferFrom(game, "Alaska");

        const rows = await game.transferAttack.rowNames();
        for (const row of rows) {
            expect(row).toMatch(/\((Coastal|Landlocked)\)$/);
        }
    });

    test("needs a row to be selected before its steppers respond", async ({ game }) => {
        await game.start({ country: "Alaska" });
        await openTransferFrom(game, "Alaska");

        const destination = await friendlyDestination(game, "Alaska");
        test.skip(!destination, "Alaska reached no other player-owned territory");

        expect(await game.transferAttack.selectedRowName()).toBeNull();
        await game.transferAttack.select(destination);
        expect(await game.transferAttack.selectedRowName()).toContain(destination);
    });

    test("turns the move button into CONFIRM once a quantity is non-zero", async ({ game }) => {
        await game.start({ country: "Alaska" });
        await openTransferFrom(game, "Alaska");

        const destination = await friendlyDestination(game, "Alaska");
        test.skip(!destination, "Alaska reached no other player-owned territory");

        await game.transferAttack.select(destination);
        expect(await game.moveButton.label()).toBe("CANCEL");

        await game.transferAttack.plus(destination, "infantry");
        await expect.poll(async () => game.moveButton.label()).toBe("CONFIRM");
    });
});

test.describe("executing a transfer", () => {
    test("moves the chosen units and conserves the total", async ({ game }) => {
        await game.start({ country: "Alaska" });
        const destination = await friendlyDestination(game, "Alaska");
        test.skip(!destination, "Alaska reached no other player-owned territory");

        const sourceBefore = await game.territory("Alaska");
        const destBefore = await game.territory(destination);

        await openTransferFrom(game, "Alaska");
        await game.transferAttack.select(destination);
        await game.transferAttack.plus(destination, "infantry");
        const moved = await game.transferAttack.quantity(destination, "infantry");
        expect(moved).toBeGreaterThan(0);

        await game.moveButton.click();
        await expect.poll(async () => game.transferAttack.isOpen()).toBe(false);

        const sourceAfter = await game.territory("Alaska");
        const destAfter = await game.territory(destination);

        expect(
            sourceBefore.infantryForCurrentTerritory - sourceAfter.infantryForCurrentTerritory
        ).toBe(moved);
        expect(destAfter.infantryForCurrentTerritory - destBefore.infantryForCurrentTerritory).toBe(
            moved
        );

        // Nothing is created or destroyed by a transfer.
        const before =
            sourceBefore.infantryForCurrentTerritory + destBefore.infantryForCurrentTerritory;
        const after =
            sourceAfter.infantryForCurrentTerritory + destAfter.infantryForCurrentTerritory;
        expect(after).toBe(before);
    });

    test("leaves the units usable in the same turn", async ({ game }) => {
        // Transferred units arrive active -- there is no arrival delay, unlike the
        // post-battle retrieval array.
        await game.start({ country: "Alaska" });
        const destination = await friendlyDestination(game, "Alaska");
        test.skip(!destination, "Alaska reached no other player-owned territory");

        await openTransferFrom(game, "Alaska");
        await game.transferAttack.select(destination);
        await game.transferAttack.plus(destination, "infantry");
        await game.moveButton.click();
        await expect.poll(async () => game.transferAttack.isOpen()).toBe(false);

        const destAfter = await game.territory(destination);
        expect(destAfter.armyForCurrentTerritory).toBeGreaterThan(0);
        expect(await game.map.attribute(destination, "deactivated")).toBe("false");
    });

    test("returns everything when the window is cancelled instead", async ({ game }) => {
        await game.start({ country: "Alaska" });
        const destination = await friendlyDestination(game, "Alaska");
        test.skip(!destination, "Alaska reached no other player-owned territory");

        const sourceBefore = await game.territory("Alaska");

        await openTransferFrom(game, "Alaska");
        await game.transferAttack.select(destination);
        await game.transferAttack.close();

        const sourceAfter = await game.territory("Alaska");
        expect(sourceAfter.infantryForCurrentTerritory).toBe(
            sourceBefore.infantryForCurrentTerritory
        );
    });
});
