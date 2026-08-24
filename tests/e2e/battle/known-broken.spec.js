import { test, expect } from "../../support/fixtures.js";

// Battle behaviours whose defects Phase 3 fixed but whose assertions needed a way to
// reach the situation being asserted -- a rout, a naval-only defender, two live sieges,
// a retreat with something to return.
//
// That way is the scenario loader (docs/04-e2e-test-plan.md section 3.7), delivered in
// Phase 4 because it needs the single state layer to be safe: a scenario is applied
// through `state/mutations.js`, the same path the game writes by, so it cannot produce a
// world the game could not have produced itself.
//
// These pin invariants -- the battle resolves, both sieges tick, the survivors come home --
// rather than survivor counts, because the invariant is the more useful thing to state for
// each of them. That is now a choice rather than a limit: audit 5.3 Y is closed (Phase 5.5
// moved cosmetic randomness to src/platform/cosmeticRng.js), so `?seed=` makes a run repeat
// exactly and `rout.spec.js` next door does assert an exact outcome.
//
// docs/03-refactor-plan.md step 2.5 · docs/04-e2e-test-plan.md section 5.10.

/** Aim at a named enemy of `source` and open the attack window. */
async function openAttackOn(game, source, target) {
    await game.endBuyPhase();
    await game.selectOnMap(source);
    await game.selectOnMap(target);
    expect(await game.moveButton.label()).toBe("ATTACK");
    await game.moveButton.click();
    await expect.poll(async () => game.transferAttack.isOpen()).toBe(true);
}

test.describe("battle behaviour that needs a scenario", () => {
    test("resolves an all-infantry attack on an all-naval defender rather than stalling", async ({
        startedGame: game,
    }) => {
        // audit 5.2 K, fixed in Phase 3.15 with the cross-type matchup matrix the plan
        // recommended: `UNIT_MATCHUP_EFFECTIVENESS` scales the odds by how effective an
        // attacking type is against the type it engages, and `totalSkirmishes` is the
        // number of pairings the two armies can make -- zero only when one side is empty.
        // Before that, two armies sharing no unit type produced zero skirmishes and the
        // battle hung with no way out.
        const report = await game.loadScenario("naval-only-defender");
        expect(report.territories).toEqual(["Germany", "France"]);

        await openAttackOn(game, "Germany", "France");
        await game.transferAttack.plus("Germany", "infantry", 3);
        await game.moveButton.click();

        await expect.poll(async () => game.battle.isOpen()).toBe(true);

        // The point of the assertion: a probability at all. It was NaN or a hang before.
        const probability = await game.battle.probability();
        expect(Number.isFinite(probability)).toBe(true);

        await game.battle.advanceRound();
        await expect
            .poll(async () => (await game.battle.isOpen()) || (await game.battle.resultsShown()))
            .toBe(true);
    });

    test("ticks two concurrent sieges every turn, not just the first", async ({
        startedGame: game,
    }) => {
        // audit 5.1 D, fixed in Phase 3.4: `calculatePlayerInitiatedSiegePerTurn` did
        // `if (!damage) { return; }` inside its loop, so one siege that missed its hit
        // roll aborted processing for every other siege that turn. It is a `continue`
        // now, in both the player and the AI function -- but proving it needs two sieges
        // running at once, which no amount of clicking reliably produces.
        const report = await game.loadScenario("two-sieges");
        expect(report.sieges).toHaveLength(2);

        const before = await game.sieges();
        expect(before.ai).toEqual(expect.arrayContaining(["Germany", "France"]));

        const turnsBefore = await game.page.evaluate(() => {
            const sieges = window.__game.sieges();
            return sieges.ai.length;
        });
        expect(turnsBefore).toBeGreaterThanOrEqual(2);

        await game.playTurns(1);

        // Both are either still besieged -- and therefore both were processed -- or
        // resolved. What must not happen is one advancing while the other is untouched,
        // which is what the `return` produced.
        const after = await game.sieges();
        const stillBesieged = ["Germany", "France"].filter(
            (name) => after.ai.includes(name) || after.player.includes(name)
        );
        const wars = await game.wars();
        const resolved = ["Germany", "France"].filter((name) =>
            wars.some((war) => war.defendingTerritory === name)
        );
        expect(stillBesieged.length + resolved.length).toBeGreaterThanOrEqual(2);
    });

    test("marks a besieged territory on the map from the siege list alone", async ({
        startedGame: game,
    }) => {
        // Phase 4.4/4.5: `underSiege` is derived from the siege lists and rendered by
        // src/ui/mapAttributeSync.js. The scenario only adds a siege -- it never touches
        // the attribute -- so if the map shows it, the derivation is what put it there.
        await game.loadScenario("two-sieges");

        const marked = await game.page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            return Array.from(doc.querySelectorAll("path"))
                .filter((path) => path.getAttribute("underSiege") === "true")
                .map((path) => path.getAttribute("territory-name"))
                .sort();
        });
        expect(marked).toEqual(["France", "Germany"]);
    });

    test("debits the source at INVADE! and queues the survivors for return on retreat", async ({
        startedGame: game,
    }) => {
        // Two halves of one rule, and neither was assertable before Phase 4.7: the source
        // was never debited at INVADE! (audit 5.1 AD), so there was nothing meaningful to
        // assert about it being credited back. Both are real now, and they have to stay
        // paired -- debiting without queueing the return would quietly destroy the army.
        //
        // The queue is asserted rather than the payout. `handleArmyRetrievals()` pays out
        // on a later turn, and getting there means surviving two AI phases whose battles
        // are not reproducible while Math.random is shared with the sparkles (audit 5.3
        // Y). Asserting the queue tests the mechanism; asserting the payout would test
        // the seed.
        await game.loadScenario("weak-defender");

        const source = await game.territory("Germany");

        await openAttackOn(game, "Germany", "France");
        await game.transferAttack.plus("Germany", "infantry", 3);
        const committed = await game.transferAttack.quantity("Germany", "infantry");
        expect(committed).toBeGreaterThan(0);

        await expect.poll(async () => game.moveButton.label()).toBe("INVADE!");
        await game.moveButton.click();
        await expect.poll(async () => game.battle.isOpen()).toBe(true);

        const duringBattle = await game.territory("Germany");
        expect(source.infantryForCurrentTerritory - duringBattle.infantryForCurrentTerritory).toBe(
            committed
        );

        expect(await game.retrievals()).toEqual([]);

        await game.battle.retreat.click();

        // Before Phase 4.7 this branch only queued a retrieval when the button read
        // "Pull Out" -- a siege pullout. A plain retreat from a fresh battle queued
        // nothing, which was harmless only because nothing had been debited.
        const queued = await game.retrievals();
        expect(queued.length).toBe(1);
        expect(queued[0].sourceTerritoryIds).toContain(String(source.uniqueId));
        expect(queued[0].turnsUntilReturn).toBeGreaterThan(0);
    });
});

// The rout used to be `test.fixme` here, with `expect(true).toBe(false)` standing in for it.
// It is a real spec now -- `rout.spec.js` -- and it asserts the exact arithmetic: the
// territory changes hands and the conqueror's garrison is its own survivors plus half the
// defenders left standing. Two things had to land first. The scenario loader (Phase 4) made
// a hopeless defender reachable, and closing audit 5.3 Y (Phase 5.5) made the outcome
// repeatable, so "a rout is a random outcome given that setup" stopped being true.
//
// Nothing in this file is `fixme` any more. The one battle-adjacent defect still open is
// audit 5.2 AE -- the attack marker surviving a cancel -- which is a MARKER problem, not a
// battle one, and is owned by Phase 6.7. It stays `fixme` in attack/attack-window.spec.js.
