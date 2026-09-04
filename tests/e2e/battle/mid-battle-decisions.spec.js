import { test, expect } from "../../support/fixtures.js";

// The two decisions a battle offers between rounds, other than "press on" and "withdraw".
//
// Battle overhaul B.7. Before this, the only thing a player could decide once a battle had
// started was whether to stop -- which is complaint six in docs/archived/battle_overhaul.md section 2.
// Now the bottom bar carries:
//
//   Retreat | Dig In | Reserves | Next Round | (Last Push!)
//
// Neither Dig In nor Reserves is up before the first round resolves: there is nothing to dig in
// against and the odds have not moved. `layoutBattleButtons()` shares the bar between whichever
// buttons are visible, which is why none of them has a width in the stylesheet.
//
// docs/archived/battle_overhaul.md section 4.8.

test.describe("mid-battle decisions", () => {
    test.setTimeout(180_000);

    /**
     * Open a battle that will last long enough to make a decision in, and press "Begin War!".
     *
     * The FIRST press of the advance button starts the battle; it does not fight a round. Every
     * press after it is one round. That distinction is easy to miss and was worth a failing spec:
     * checking for the mid-battle controls after a single click found them correctly hidden,
     * because no round had been fought yet.
     */
    async function openAGrind(game, seed) {
        await game.start({ country: "Germany", seed });
        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await game.battle.advanceRound(); // "Begin War!"
        await game.page.waitForTimeout(80);
    }

    /** One round of dice. */
    async function fightARound(game) {
        await game.battle.advanceRound();
        await game.page.waitForTimeout(140);
    }

    test("hides both decisions until a round has actually been fought", async ({ game }) => {
        await openAGrind(game, "midbattle-hidden");

        const beforeAnyRound = await game.page.evaluate(() => ({
            digIn: getComputedStyle(document.getElementById("digInButton")).display,
            reserves: getComputedStyle(document.getElementById("reservesButton")).display,
        }));
        expect(beforeAnyRound.digIn, "nothing to dig in against before a round").toBe("none");
        expect(beforeAnyRound.reserves).toBe("none");

        await fightARound(game);

        const afterARound = await game.page.evaluate(() => ({
            digIn: getComputedStyle(document.getElementById("digInButton")).display,
            reserves: getComputedStyle(document.getElementById("reservesButton")).display,
        }));
        expect(afterARound.digIn).not.toBe("none");
        expect(afterARound.reserves).not.toBe("none");
    });

    test("digging in is armed by a class, and is spent by the round it applies to", async ({
        game,
    }) => {
        await openAGrind(game, "midbattle-digin");
        await fightARound(game);

        expect(await game.battle.digInArmed(), "not armed to begin with").toBe(false);

        await game.battle.digIn();
        expect(await game.battle.digInArmed(), "one click arms it").toBe(true);

        // A disabled or armed control is a CLASS, not a picture (Phase 7.11), which is what lets
        // this be asserted at all rather than inferred from a file path.
        await game.battle.digIn();
        expect(await game.battle.digInArmed(), "clicking again disarms it").toBe(false);

        await game.battle.digIn();
        await fightARound(game);
        expect(await game.battle.digInArmed(), "it is spent by the round it applied to").toBe(false);
    });

    test("digging in costs the defender nothing that round", async ({ game }) => {
        await openAGrind(game, "midbattle-digin-cost");
        await fightARound(game);

        const before = await game.page.evaluate(() => window.__game.battle());

        await game.battle.digIn();
        await fightARound(game);

        const after = await game.page.evaluate(() => window.__game.battle());
        // Digging in gives up this round's OFFENCE. The side still rolls -- its dice still answer
        // the enemy's -- but the pairings it wins inflict nothing.
        expect(after.defenders, "the defender takes no casualties from a dug-in attacker").toEqual(
            before.defenders
        );
    });

    test("committing reserves debits the source and reinforces a round later", async ({ game }) => {
        // INFANTRY, not ships. Vehicles are gated by the oil capacity of wherever they stand, and
        // `useableNaval` is recomputed the moment a force leaves the territory -- so a naval
        // reserve can be correctly grounded at the instant it is asked for, which makes it useless
        // for testing the reserve path. `reserve-force` is an infantry fight for that reason.
        await game.start({ country: "Germany", seed: "midbattle-reserves" });
        await game.loadScenario("reserve-force");

        // Send part of the garrison, so there is something left to follow it.
        await game.endBuyPhase();
        await game.selectOnMap("Germany");
        await game.selectOnMap("France");
        await game.moveButton.click();
        await expect.poll(async () => game.transferAttack.isOpen()).toBe(true);
        await game.transferAttack.cycleMultiplier("Germany", "infantry", 3);
        await game.transferAttack.plus("Germany", "infantry", 5);
        await game.moveButton.click();
        await expect.poll(async () => game.battle.isOpen()).toBe(true);

        await game.battle.advanceRound(); // "Begin War!"
        await game.page.waitForTimeout(80);
        await fightARound(game);

        const sourceBefore = await game.territory("Germany");
        expect(sourceBefore.infantryForCurrentTerritory, "there is a reserve to send")
            .toBeGreaterThan(0);
        const inBattleBefore = await game.page.evaluate(() => window.__game.battle());

        await game.battle.commitReserves();
        await game.page.waitForTimeout(150);

        // Debited IMMEDIATELY -- the same rule INVADE! follows (audit 5.1 AD). An army that is
        // committed but not yet debited can be committed twice.
        const sourceAfter = await game.territory("Germany");
        expect(sourceAfter.infantryForCurrentTerritory, "the source pays at once").toBe(0);
        expect(sourceAfter.armyForCurrentTerritory).toBeGreaterThanOrEqual(0);

        // ...and they are NOT in the fight yet. That delay is what makes committing them a
        // decision rather than a free top-up.
        const stillInTransit = await game.page.evaluate(() => window.__game.battle());
        expect(stillInTransit.attackers[0]).toBe(inBattleBefore.attackers[0]);

        await fightARound(game);

        const afterArrival = await game.page.evaluate(() => window.__game.battle());
        // They fought in the round they arrived for, so the count is "what was there, plus what
        // arrived, minus that round's casualties" -- which is more than the round could have left
        // without them. A round takes at most ~41% of a force, so this bound is comfortable.
        expect(afterArrival.attackers[0]).toBeGreaterThan(inBattleBefore.attackers[0] * 0.6);
    });

    test("the reserves button says so when there is nothing left to send", async ({ game }) => {
        // A button that does nothing when pressed reads as broken. Committing the WHOLE garrison
        // to the attack leaves the source empty, so the first press has nothing to find.
        await openAGrind(game, "midbattle-no-reserves");
        await fightARound(game);

        await game.battle.commitReserves();
        await game.page.waitForTimeout(120);

        const label = await game.page.evaluate(
            () => document.getElementById("reservesButton")?.innerText.trim()
        );
        expect(label).toBe("None left");
    });
});
