import { test, expect } from "../../support/fixtures.js";
import { battleOutcomeEffects } from "../../../src/config/balance.js";

// How a battle ENDS, one spec per terminal condition. `rout.spec.js` next door owns the
// fifth, because a rout has arithmetic of its own worth a file.
//
// The e2e plan (section 5.10) listed `attacker-wins`, `defender-wins`, `massive-assault`,
// `attacker-routed` and `fight-again` as specs that "need a battle to reach a SPECIFIC
// terminal condition, which is a seed lottery on the live map". Two things closed that:
// the scenario loader (Phase 4), and taking cosmetic randomness off the game's RNG stream
// so that `?seed=` actually repeats (audit 5.3 Y, Phase 5.5).
//
// Every scenario here attacks with NAVAL units, for one reason worth knowing:
// `chooseDefendingUnitTypeIndex()` engages its own type first, so a fleet reliably sinks the
// defending fleet before it touches anything else -- and a naval unit is worth 20,000
// personnel against an infantryman's one. Composing the defender out of ships and foot
// soldiers is what makes each threshold reachable on purpose rather than by luck.
//
// docs/04-e2e-test-plan.md section 5.10.

test.describe("how a battle ends", () => {
    test.setTimeout(180_000);

    test("attacker wins: the defenders are destroyed and the survivors garrison it", async ({
        game,
    }) => {
        await game.start({ country: "Germany", seed: "outcome-win" });
        const report = await game.loadScenario("outright-conquest");
        expect(report.errors).toEqual([]);

        const committed = await game.launchWholeGarrison({ from: "Germany", to: "France" });
        expect(committed).toBe(300);

        const { ending, live } = await game.fightToResolution();
        expect(ending).toBe("Victory!");
        expect(live.defenders, "nothing of the defender is left").toEqual([0, 0, 0, 0]);

        const survivors = live.attackers[3];
        expect(survivors).toBeGreaterThan(0);

        await expect.poll(async () => game.battle.resultsShown()).toBe(true);
        await game.battle.acceptResult();

        const captured = await game.territory("France");
        expect(captured.owner).toBe("Player");
        expect(captured.navalForCurrentTerritory).toBe(survivors);
        // A clean win absorbs nobody -- that is what separates it from a rout.
        expect(captured.infantryForCurrentTerritory).toBe(0);
    });

    test("defender wins: ownership is unchanged and the attackers are simply gone", async ({
        game,
    }) => {
        await game.start({ country: "Germany", seed: "outcome-lose" });
        await game.loadScenario("hopeless-attacker");

        const committed = await game.launchWholeGarrison({ from: "Germany", to: "France" });
        expect(committed).toBe(6);

        const { ending, live } = await game.fightToResolution();
        expect(ending).toBe("attackerDestroyed");
        expect(live.attackers).toEqual([0, 0, 0, 0]);

        const defender = await game.territory("France");
        expect(defender.owner, "a failed attack changes nothing about ownership").not.toBe(
            "Player"
        );
        expect(defender.infantryForCurrentTerritory).toBe(400000);

        // The committed units do NOT come back. That is what separates a defeat from a
        // retreat, which queues them through the retrieval array instead.
        expect(await game.retrievals()).toEqual([]);
    });

    test("last push: the defender breaks below 15% and the final push costs a fifth", async ({
        game,
    }) => {
        await game.start({ country: "Germany", seed: "outcome-push" });
        await game.loadScenario("last-push-defender");

        await game.launchWholeGarrison({ from: "Germany", to: "France" });

        const { ending, live } = await game.fightToResolution();
        expect(ending, "sinking the fleet should put the defender in the last-push band").toBe(
            "Massive Assault"
        );
        // The band is between the 5% rout threshold and the 15% last-push threshold, and it
        // is reached by composition: the ships are gone, the infantry are not.
        expect(live.defenders[3]).toBe(0);
        expect(live.defenders[0]).toBeGreaterThan(0);

        const beforeThePush = live.attackers[3];

        await expect.poll(async () => game.battle.resultsShown()).toBe(true);
        await game.battle.acceptResult();

        const captured = await game.territory("France");
        expect(captured.owner).toBe("Player");
        expect(
            captured.navalForCurrentTerritory,
            "a last push costs a fifth of the attacking survivors"
        ).toBe(Math.floor(beforeThePush * battleOutcomeEffects.lastPushSurvivorShare));
    });

    test("evenly matched: five rounds settle nothing and the fight goes on", async ({ game }) => {
        await game.start({ country: "Germany", seed: "outcome-grind" });
        await game.loadScenario("evenly-matched");

        await game.launchWholeGarrison({ from: "Germany", to: "France" });

        // Two full rounds of five, and neither side has reached a threshold: the button is
        // still offering another round rather than a terminal option.
        for (let click = 0; click < 14; click += 1) {
            await game.battle.advanceRound();
            await game.page.waitForTimeout(60);
        }
        const state = await game.page.evaluate(() => ({
            label: document.getElementById("advanceButton")?.innerText,
            disabled: !!document.getElementById("advanceButton")?.disabled,
            results: getComputedStyle(document.getElementById("battleResultsContainer")).display,
        }));
        expect(state.results, "an even fight does not resolve").toBe("none");
        expect(["Next Skirmish", "End Round", "Start Attack!"]).toContain(state.label);

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
