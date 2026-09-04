import { test, expect } from "../../support/fixtures.js";
import { battleOutcomeEffects, BREAK_THRESHOLD } from "../../../src/config/balance.js";

// How a battle ENDS, one spec per terminal condition. `rout.spec.js` next door owns the rout,
// because it has arithmetic of its own worth a file.
//
// REWRITTEN FOR THE DICE MODEL (battle overhaul B.4.8). What these specs used to assert was the
// five-round skirmish model's endings, and every one of them changed by design:
//
//   * a battle is no longer five rounds, so "five rounds settle nothing" describes nothing;
//   * one symmetric BREAK_THRESHOLD replaces the 5% / 15% / 10% trio, so the bands moved;
//   * a side is BROKEN below the threshold rather than annihilated, so "the attackers are simply
//     gone" is no longer what a defeat looks like -- there are survivors, they just left;
//   * the last push is an OFFER on the bottom bar rather than an outcome that fires by itself.
//
// One consequence decides what CAN be tested here. The break test runs before annihilation can
// ever matter, so a garrison of any size is routed long before it is wiped out: `DEFENDER_WIPED`
// is reachable only for a handful of units. Annihilation is therefore asserted in
// `tests/unit/rules-battle-model.spec.js`, where it can be set up exactly, and these specs assert
// the journey the player actually sees.
//
// Every scenario attacks with NAVAL units. A naval unit is worth 20,000 personnel against an
// infantryman's one, so composing the defender out of ships and foot soldiers is what makes a
// threshold reachable on purpose rather than by luck: sinking the fleet takes most of the
// defender's combined force with it while its infantry are still standing.
//
// docs/04-e2e-test-plan.md section 5.10.

test.describe("how a battle ends", () => {
    test.setTimeout(180_000);

    test("the attacker takes the territory and its survivors garrison it", async ({ game }) => {
        await game.start({ country: "Germany", seed: "outcome-win" });
        const report = await game.loadScenario("outright-conquest");
        expect(report.errors).toEqual([]);

        const committed = await game.launchWholeGarrison({ from: "Germany", to: "France" });
        expect(committed).toBe(300);

        const { ending, live } = await game.fightToResolution();
        expect(
            ["Victory!", "Rout The Enemy", "Massive Assault"],
            "an overwhelming attack must end in one of the winning states"
        ).toContain(ending);

        expect(live.attackers[3], "the attacker keeps a fleet").toBeGreaterThan(0);

        await expect.poll(async () => game.battle.resultsShown()).toBe(true);
        await game.battle.acceptResult();

        const captured = await game.territory("France");
        expect(captured.owner).toBe("Player");
        expect(
            captured.navalForCurrentTerritory,
            "the survivors garrison what they took"
        ).toBeGreaterThan(0);
    });

    test("the defender holds: ownership is unchanged and the attackers do not come back", async ({
        game,
    }) => {
        await game.start({ country: "Germany", seed: "outcome-lose" });
        await game.loadScenario("hopeless-attacker");

        const committed = await game.launchWholeGarrison({ from: "Germany", to: "France" });
        expect(committed).toBe(6);

        const { ending, live } = await game.fightToResolution();
        expect(ending, "a hopeless attack reaches no winning state").toBe("attackerDestroyed");

        // BROKEN, not annihilated. The attacker is below the break threshold and may still have
        // units on the field -- that is the difference the new model makes, and asserting exactly
        // zero is what used to make this spec describe the old one.
        const startingForce = 6 * 20000;
        const remaining = live.attackers[3] * 20000 + live.attackers[0];
        expect(remaining).toBeLessThan(startingForce * BREAK_THRESHOLD);

        const defender = await game.territory("France");
        expect(defender.owner, "a failed attack changes nothing about ownership").not.toBe(
            "Player"
        );
        expect(defender.infantryForCurrentTerritory).toBe(400000);

        // The committed units do NOT come back. That is what separates a defeat from a retreat,
        // which queues them through the retrieval array instead.
        expect(await game.retrievals()).toEqual([]);
    });

    test("the last push is offered, and taking it costs a fifth of the survivors", async ({
        game,
    }) => {
        await game.start({ country: "Germany", seed: "outcome-push" });
        await game.loadScenario("last-push-defender");

        await game.launchWholeGarrison({ from: "Germany", to: "France" });

        // Roll until the offer appears on the bottom bar. It is an OFFER: the advance button still
        // reads "Next Round" and rolling on is a legitimate choice, which is what rout.spec.js
        // does instead.
        let offered = false;
        for (let click = 0; click < 30; click += 1) {
            offered = await game.battle.lastPushOffered();
            if (offered) {
                break;
            }
            await game.battle.advanceRound();
            await game.page.waitForTimeout(80);
        }
        expect(offered, "the defender should reach the last-push band").toBe(true);

        const before = await game.page.evaluate(() => window.__game.battle());
        const beforeThePush = before.attackers[3];

        await game.battle.takeLastPush();

        // Taking the push does not raise the results screen by itself: it resolves the battle and
        // puts the advance button into its "Massive Assault" accept state, exactly as a clean win
        // does. One more press is what shows the results.
        await game.battle.advanceRound();
        await expect.poll(async () => game.battle.resultsShown()).toBe(true);
        await game.battle.acceptResult();

        const captured = await game.territory("France");
        expect(captured.owner).toBe("Player");
        expect(
            captured.navalForCurrentTerritory,
            "a last push costs a fifth of the attacking survivors"
        ).toBe(Math.floor(beforeThePush * battleOutcomeEffects.lastPushSurvivorShare));
    });

    test("an even fight grinds: neither side breaks quickly and nothing resolves", async ({
        game,
    }) => {
        await game.start({ country: "Germany", seed: "outcome-grind" });
        await game.loadScenario("evenly-matched");

        await game.launchWholeGarrison({ from: "Germany", to: "France" });

        // Four rounds of an even fight. The defender wins ties, so the attacker is losing -- but
        // nothing has reached a threshold yet and the button is still offering another round
        // rather than a terminal option.
        for (let click = 0; click < 4; click += 1) {
            await game.battle.advanceRound();
            await game.page.waitForTimeout(80);
        }
        const state = await game.page.evaluate(() => ({
            label: document.getElementById("advanceButton")?.innerText,
            results: getComputedStyle(document.getElementById("battleResultsContainer")).display,
        }));
        expect(state.results, "an even fight does not resolve in four rounds").toBe("none");
        expect(["Next Round", "Start Attack!"]).toContain(state.label);

        const live = await game.page.evaluate(() => window.__game.battle());
        expect(live.attackers[3], "both fleets are still afloat").toBeGreaterThan(0);
        expect(live.defenders[3]).toBeGreaterThan(0);

        const contested = await game.territory("France");
        expect(contested.owner).not.toBe("Player");
    });

    test("the source territory is debited exactly once", async ({ game }) => {
        // Regression test. Phase 4.7 moved the debit to INVADE! (audit 5.1 AD) and added the
        // call without removing the original one in the advance button's "Begin War!" branch,
        // so a fresh battle charged its source territories TWICE -- once on launch and again
        // on the first click of the battle. Committing a whole garrison left the source
        // holding a NEGATIVE army, which then fed population, food consumption and defence
        // for the rest of the game. A battle resumed from a siege skipped the second debit,
        // which is why no siege spec ever saw it.
        await game.start({ country: "Germany", seed: "outcome-debit" });
        await game.loadScenario("outright-conquest");

        const before = await game.territory("Germany");
        expect(before.navalForCurrentTerritory).toBe(300);

        const committed = await game.launchWholeGarrison({ from: "Germany", to: "France" });
        const afterLaunch = await game.territory("Germany");
        expect(afterLaunch.navalForCurrentTerritory).toBe(
            before.navalForCurrentTerritory - committed
        );

        await game.fightToResolution();
        const afterBattle = await game.territory("Germany");
        expect(
            afterBattle.navalForCurrentTerritory,
            "the source must not be charged a second time"
        ).toBe(before.navalForCurrentTerritory - committed);
        expect(afterBattle.navalForCurrentTerritory).toBeGreaterThanOrEqual(0);
        expect(afterBattle.armyForCurrentTerritory).toBeGreaterThanOrEqual(0);
    });
});
