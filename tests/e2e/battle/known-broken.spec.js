import { test, expect } from "../../support/fixtures.js";

// The battle behaviours that are known to be WRONG today. Every spec here is
// `test.fixme` with the audit item it belongs to, so refactor Phase 3 flips them
// green rather than inventing expectations later.
//
// docs/03-refactor-plan.md step 2.5 · docs/04-e2e-test-plan.md section 5.10.

test.describe("known-broken battle behaviour", () => {
    test.fixme("a rout hands half the surviving defenders to the attacker", async ({
        startedGame: game,
    }) => {
        // 🔴 audit 5.1 E. Both rout thresholds compare the DEFENDER's remaining
        // force against `unchangeableWarStartCombinedForceDefend`, which is
        // assigned from `totalAttackingArmy`:
        //
        //     unchangeableWarStartCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
        //     unchangeableWarStartCombinedForceDefend = calculateCombinedForce(totalAttackingArmy);
        //
        // so "defender below 5% of its starting force" is really "defender
        // below 5% of the ATTACKER's starting force". Outcomes are wrong
        // whenever the two armies differ in size, which is almost always.
        // Refactor Phase 3.3 is the one-line fix; write the assertion then,
        // against the scenario loader (e2e plan section 3.7) rather than by
        // clicking, because a rout is not reliably reachable by hand.
        expect(true).toBe(false);
    });

    test.fixme("an all-infantry attack on an all-naval defender resolves rather than stalling", async ({
        startedGame: game,
    }) => {
        // 🔴 audit 5.2 K. Skirmishes only pair matching unit types, and
        // `skirmishesPerType = min(attacker[t], defender[t])`. Two armies with
        // no type in common produce `totalSkirmishes === 0`, so the battle can
        // neither progress nor resolve.
        //
        // Phase 3.15 has to DECIDE the design first -- a cross-type matchup
        // matrix (recommended) or a guaranteed skirmish per round -- and this
        // spec gets written against whichever lands. It needs the scenario
        // loader to construct the two armies.
        expect(true).toBe(false);
    });

    test.fixme("retreating returns the survivors to their source territories", async ({
        startedGame: game,
    }) => {
        // Blocked on the same thing as attack/attack-window.spec.js's
        // "takes the committed units out of their source territory immediately":
        // the source is never debited at INVADE! time, so there is nothing
        // meaningful to assert about it being credited back. Phase 4.7 makes war
        // objects hold a territory id instead of a copy, at which point both
        // halves become assertable together.
        expect(true).toBe(false);
    });

    test.fixme("two concurrent sieges both tick every turn", async ({ startedGame: game }) => {
        // 🔴 audit 5.1 D. `calculatePlayerInitiatedSiegePerTurn` does
        // `if (!damage) { return; }` inside its loop, so one siege that fails its
        // hit roll aborts processing for every other siege that turn. Needs the
        // scenario loader to set up two sieges; Phase 3.4 changes the `return` to
        // a `continue`.
        expect(true).toBe(false);
    });
});
