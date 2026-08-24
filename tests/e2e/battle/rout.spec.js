import { test, expect } from "../../support/fixtures.js";
import { battleOutcomeEffects } from "../../../src/config/balance.js";

// A ROUT: the defender's combined force falls below 5% of what it started with while it
// still has units on the field. The territory is captured AND half the surviving defenders
// join the conqueror -- they surrendered rather than died.
//
// audit 5.1 E. `unchangeableWarStartCombinedForceDefend` was assigned from
// `totalAttackingArmy`, so "the defender is below 5% of its starting force" actually meant
// "below 5% of the ATTACKER's starting force", and every rout resolved at the wrong moment
// whenever the two armies differed in size -- which is almost always. Fixed in Phase 3.3.
//
// This spec was `test.fixme` for two separate reasons, and both are now closed:
//
//  1. There was no way to set up a hopeless defender. The scenario loader (Phase 4) is that.
//  2. A rout is a random outcome given the setup, and seeding could not force one while
//     `addSparklesRegularly()` shared the global RNG stream (audit 5.3 Y). Cosmetic
//     randomness moved to src/platform/cosmeticRng.js in Phase 5.5, so `?seed=` repeats.
//
// The scenario reaches the rout band by COMPOSITION rather than by attrition, which matters
// enough to write down: a naval unit is worth 20,000 personnel and an infantryman is worth
// one, so a defender that is almost all naval loses almost all of its combined force when
// its ships go down, while its infantry are still standing. Attrition cannot get there --
// an attacker big enough to win takes the defender from ~13% of its starting force to zero
// in a single step, straight past the 5% band.
//
// docs/04-e2e-test-plan.md section 5.10.

test.describe("a rout", () => {
    test.setTimeout(180_000);

    test("captures the territory and takes half the surviving defenders with it", async ({
        game,
        page,
    }) => {
        await game.start({ country: "Germany", seed: "rout-e2e" });
        const report = await game.loadScenario("rout-bound-defender");
        expect(report.territories).toEqual(["Germany", "France"]);

        const defenderBefore = await game.territory("France");
        expect(defenderBefore.owner).not.toBe("Player");
        expect(defenderBefore.navalForCurrentTerritory).toBe(100);
        expect(defenderBefore.infantryForCurrentTerritory).toBe(2000);

        const committed = await game.launchWholeGarrison({ from: "Germany", to: "France" });
        expect(committed).toBe(300);

        const { ending, live } = await game.fightToResolution();
        expect(ending, "the scenario should end in a rout").toBe("Rout The Enemy");
        expect(live, "the harness must see the live battle armies").not.toBeNull();

        // The defender's ships are gone; its infantry are not. That is the rout band.
        expect(live.defenders[3], "the defending naval should be destroyed").toBe(0);
        expect(live.defenders[0], "the defending infantry should still be alive").toBeGreaterThan(0);
        // The attacking force was ALL naval, so any infantry in the captured territory can
        // only have come from the defenders.
        expect(live.attackers[0]).toBe(0);

        const survivingAttackers = live.attackers[3];
        const survivingDefenders = live.defenders[0];

        await expect.poll(async () => game.battle.resultsShown()).toBe(true);
        await game.battle.acceptResult();

        const captured = await game.territory("France");
        expect(captured.owner, "a rout captures the territory").toBe("Player");
        expect(captured.navalForCurrentTerritory, "the attacker keeps its survivors").toBe(
            survivingAttackers
        );
        expect(
            captured.infantryForCurrentTerritory,
            "half the surviving defenders join the conqueror"
        ).toBe(Math.floor(survivingDefenders * battleOutcomeEffects.routCaptureShare));
    });

    test("is reproducible: the same seed routs the same way", async ({ game, page }) => {
        // The point of closing audit 5.3 Y. Two runs of the same seed must agree exactly --
        // before Phase 5.5 the cosmetic sparkle timer advanced the same stream combat drew
        // from, so they could not.
        const runOnce = async () => {
            await game.start({ country: "Germany", seed: "rout-repeat" });
            await game.loadScenario("rout-bound-defender");
            await game.launchWholeGarrison({ from: "Germany", to: "France" });
            const { ending, live } = await game.fightToResolution();
            return { ending, attackers: live.attackers, defenders: live.defenders };
        };

        const first = await runOnce();
        const second = await runOnce();
        expect(second).toEqual(first);
    });
});
