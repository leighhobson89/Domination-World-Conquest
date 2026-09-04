import { test, expect } from "../../support/fixtures.js";
import { battleOutcomeEffects } from "../../../src/config/balance.js";

// A ROUT: the defender's combined force falls below BREAK_THRESHOLD of what it started with
// while it still has units on the field. The territory is captured AND half the surviving
// defenders join the conqueror -- they surrendered rather than died.
//
// BATTLE OVERHAUL B.4.8. Two things changed. The threshold is one symmetric BREAK_THRESHOLD
// rather than the old 5%, and -- the part that decides how this spec has to be written -- the
// LAST PUSH band sits directly above it. A defender on its way to being routed passes through
// that band first, so the offer appears every time. `fightToResolution()` therefore DECLINES it
// by default: taking it would buy the territory before the rout could happen, and no spec could
// ever observe a rout at all. Declining and rolling on is what reaches this ending, and it is a
// real decision the player has -- pay a fifth now, or roll on and maybe absorb half their
// garrison instead.
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
// HOW THE ROUT BAND IS REACHED CHANGED WITH THE MODEL. It used to be by COMPOSITION: skirmishes
// paired like against like, so an all-naval attacker sank the defending fleet first and took most
// of its combined force with it while the infantry still stood. The dice model applies casualties
// PROPORTIONALLY across the four unit types -- composition survives attrition, which is what stops
// an army that started combined-arms from losing the modifiers it earned for being so. A defender
// therefore shrinks evenly and reaches the band by plain attrition, with ships and infantry both
// still on the field. Attrition cannot get there --
// an attacker big enough to win takes the defender from ~13% of its starting force to zero
// in a single step, straight past the band.
//
// docs/03-e2e-test-plan.md section 5.10.

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

        const { ending, live } = await game.fightToResolution({ takeLastPush: false });
        expect(ending, "declining the push and rolling on should rout them").toBe("Rout The Enemy");
        expect(live, "the harness must see the live battle armies").not.toBeNull();

        // A rout is a broken army, not a dead one: the defender still has units on the field.
        expect(live.defenders[0], "the defending infantry should still be alive").toBeGreaterThan(0);
        // The attacking force was ALL naval, so any infantry in the captured territory can only
        // have come from the defenders.
        expect(live.attackers[0]).toBe(0);

        await expect.poll(async () => game.battle.resultsShown()).toBe(true);
        await game.battle.acceptResult();

        const captured = await game.territory("France");
        expect(captured.owner, "a rout captures the territory").toBe("Player");

        // The garrison is the attacker's survivors PLUS half of the routed defenders, per unit
        // type -- they surrendered rather than died. That is the whole difference between a rout
        // and a clean win, and it applies to every type because casualties are proportional.
        const share = battleOutcomeEffects.routCaptureShare;
        expect(captured.infantryForCurrentTerritory, "half the routed infantry join").toBe(
            live.attackers[0] + Math.floor(live.defenders[0] * share)
        );
        expect(captured.navalForCurrentTerritory, "and half the routed ships").toBe(
            live.attackers[3] + Math.floor(live.defenders[3] * share)
        );
    });

    test("is reproducible: the same seed routs the same way", async ({ game, page }) => {
        // The point of closing audit 5.3 Y. Two runs of the same seed must agree exactly --
        // before Phase 5.5 the cosmetic sparkle timer advanced the same stream combat drew
        // from, so they could not.
        const runOnce = async () => {
            await game.start({ country: "Germany", seed: "rout-repeat" });
            await game.loadScenario("rout-bound-defender");
            await game.launchWholeGarrison({ from: "Germany", to: "France" });
            const { ending, live } = await game.fightToResolution({ takeLastPush: false });
            return { ending, attackers: live.attackers, defenders: live.defenders };
        };

        const first = await runOnce();
        const second = await runOnce();
        expect(second).toEqual(first);
    });
});
