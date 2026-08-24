import { test, expect } from "../../support/fixtures.js";

// Battle behaviours whose DEFECTS are fixed but whose ASSERTIONS are not yet
// writable.
//
// Refactor Phase 3 fixed the code behind three of the four: the rout threshold
// (audit 5.1 E), the cross-unit-type deadlock (5.2 K) and two concurrent sieges
// (5.1 D). What none of them has is a way to reach the situation being asserted --
// a rout, a naval-only defender, two live sieges. Every one of those needs the
// scenario loader (docs/04-e2e-test-plan.md section 3.7, a Phase 4 deliverable);
// hoping the live map produces one is a seed lottery, not a test.
//
// So these stay `test.fixme`, and the reason has changed: it is no longer "the
// game does the wrong thing", it is "the harness cannot set this up yet".
//
// docs/03-refactor-plan.md step 2.5 · docs/04-e2e-test-plan.md section 5.10.

test.describe("known-broken battle behaviour", () => {
    test.fixme("a rout hands half the surviving defenders to the attacker", async ({
        startedGame: game,
    }) => {
        // audit 5.1 E is FIXED (refactor Phase 3.3):
        // `unchangeableWarStartCombinedForceDefend` was assigned from
        // `totalAttackingArmy`, so "defender below 5% of its starting force" really
        // meant "below 5% of the ATTACKER's starting force" and outcomes were wrong
        // whenever the armies differed in size. It now reads `totalDefendingArmy`.
        //
        // Still `fixme` because a rout is not reliably reachable by clicking. Write
        // this against the scenario loader (e2e plan section 3.7, Phase 4).
        expect(true).toBe(false);
    });

    test.fixme("an all-infantry attack on an all-naval defender resolves rather than stalling", async ({
        startedGame: game,
    }) => {
        // audit 5.2 K is FIXED (refactor Phase 3.15), with the cross-type matchup
        // matrix the plan recommended: `UNIT_MATCHUP_EFFECTIVENESS` in battle.js
        // scales the odds by how effective an attacking type is against the type it
        // engages, and `totalSkirmishes` is now the number of pairings the two armies
        // can make -- zero only when one side is empty.
        //
        // Still `fixme` because constructing an all-infantry attack on an all-naval
        // defender needs the scenario loader (e2e plan section 3.7, Phase 4).
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
        // audit 5.1 D is FIXED (refactor Phase 3.4): `calculatePlayerInitiatedSiegePerTurn`
        // did `if (!damage) { return; }` inside its loop, so one siege that missed its
        // hit roll aborted processing for every other siege that turn. It is a
        // `continue` now, in both the player and the AI function.
        //
        // Still `fixme` because setting up two concurrent sieges needs the scenario
        // loader (e2e plan section 3.7, Phase 4).
        expect(true).toBe(false);
    });
});
