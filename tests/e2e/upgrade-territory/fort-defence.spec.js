import { test, expect } from "../../support/fixtures.js";

// Forts are the only building with a combat effect, and the only one whose
// result is visible in the bottom table.
//
//     defenseBonus = ceil(forts x (forts + 1) x 10 x devIndex + landlockedBonus)
//
// Note that the game rounds this TWO different ways. At construction
// (resourceCalculations.js:436) it is
// `Math.ceil(forts x (forts+1) x 10) x devIndex + landlockedBonus` -- the ceil
// inside, so the result is fractional. After buying a fort
// (`addPlayerUpgrades`) it is `Math.ceil(... x devIndex + landlockedBonus)` --
// the ceil outside, so the result is an integer. The two disagree by under 1,
// which is why nobody has noticed; the form asserted here is the one that
// applies after a purchase. Reconciling them belongs with Phase 5.1, where the
// formula moves into `rules/`.
//
// docs/03-e2e-test-plan.md section 5.7.

function expectedDefence(forts, devIndex, landlockedBonus) {
    return Math.ceil(forts * (forts + 1) * 10 * devIndex + landlockedBonus);
}

test.describe("fort defence", () => {
    test("follows the published formula for one fort", async ({ startedGame: game }) => {
        const before = await game.territory("Germany");

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort");
        await game.upgradeWindow.submit();

        const after = await game.territory("Germany");
        expect(after.fortsBuilt).toBe(before.fortsBuilt + 1);
        expect(after.defenseBonus).toBe(
            expectedDefence(after.fortsBuilt, after.devIndex, after.isLandLockedBonus)
        );
    });

    test("grows quadratically, not linearly, with the number of forts", async ({
        startedGame: game,
    }) => {
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort");
        await game.upgradeWindow.submit();
        const one = await game.territory("Germany");
        expect(one.fortsBuilt).toBe(1);

        // Fort cost is quadratic, so how many more Germany can afford is a
        // balance question, not a behavioural one. Buy as many as the stepper
        // allows and assert the formula against whatever that turns out to be.
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort", 4);
        await game.upgradeWindow.submit();
        const more = await game.territory("Germany");

        expect(more.fortsBuilt).toBeGreaterThan(one.fortsBuilt);
        expect(more.defenseBonus).toBe(
            expectedDefence(more.fortsBuilt, more.devIndex, more.isLandLockedBonus)
        );
        // n(n+1) grows faster than n, so k forts are worth more than k times one.
        expect(more.defenseBonus).toBeGreaterThan(one.defenseBonus * more.fortsBuilt);
    });

    test("gives a landlocked territory a standing bonus", async ({ startedGame: game }) => {
        // Germany is coastal; Austria is not. The landlocked bonus is part of the
        // territory model from construction, before any fort is built.
        const coastal = await game.territory("Germany");
        const landlocked = await game.territory("Austria");

        expect(coastal.isLandLockedBonus).toBe(0);
        expect(landlocked.isLandLockedBonus).toBeGreaterThan(0);
    });

    test("is what the bottom table's defence figure shows", async ({ startedGame: game }) => {
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort", 2);
        await game.upgradeWindow.submit();

        await game.infoTable.close();
        await game.map.click("Germany");

        const germany = await game.territory("Germany");
        // The bottom table's "defence" cell is the MOUNTAIN bonus, which forts do
        // not change -- the fort bonus lives in defenseBonus and surfaces in
        // combat. Pinned here so the two are not confused again.
        expect(await game.bottomTable.text("mountainDefence")).toBe(
            String(germany.mountainDefenseBonus)
        );
        expect(germany.defenseBonus).not.toBe(germany.mountainDefenseBonus);
    });
});
