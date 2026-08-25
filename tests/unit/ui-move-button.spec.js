import { describe, it, expect } from "vitest";
import {
    deriveMoveButtonState,
    stateAfterWindowClosed,
    MoveMode
} from "../../src/ui/moveButton/deriveMoveButtonState.js";

// Phase 6.6. What the move-phase button shows was decided inside a 300-line function
// that wrote its answer straight onto the DOM element, which meant these five
// outcomes could only be checked by clicking a live map in a browser. They are a pure
// function now and this is the whole table.

/** A selection with nothing remarkable about it: an enemy territory out of range. */
function selection(overrides = {}) {
    return {
        isPlayerOwned: false,
        isDeactivated: false,
        deactivatedTurnsLeft: undefined,
        isUnderSiege: false,
        isAttackable: false,
        isInRange: false,
        sourceIsPlayerOwned: false,
        ownedTerritoryCount: 5,
        siegeTurns: undefined,
        ...overrides
    };
}

describe("the move-phase button, for an owned territory", () => {
    it("offers TRANSFER", () => {
        const state = deriveMoveButtonState(selection({ isPlayerOwned: true }));

        expect(state).toMatchObject({
            visible: true,
            label: "TRANSFER",
            variant: "transfer",
            enabled: true,
            mode: MoveMode.TRANSFER
        });
    });

    it("greys TRANSFER out when the player has nowhere to send units", () => {
        const state = deriveMoveButtonState(
            selection({ isPlayerOwned: true, ownedTerritoryCount: 1 })
        );

        expect(state.label).toBe("TRANSFER");
        expect(state.enabled).toBe(false);
        expect(state.variant).toBe("disabled");
    });

    it("counts down the post-conquest lockout instead", () => {
        const state = deriveMoveButtonState(
            selection({ isPlayerOwned: true, isDeactivated: true, deactivatedTurnsLeft: 3 })
        );

        expect(state.label).toBe("DEACTIVATED (3)");
        expect(state.enabled).toBe(false);
    });

    it("leaves the mode alone while deactivated", () => {
        // The original only ever wrote `transferAttackButtonState` on the branches
        // that produced a live button, so a deactivated selection has to leave
        // whatever the last live one chose. A null mode is what says "do not write".
        const state = deriveMoveButtonState(
            selection({ isPlayerOwned: true, isDeactivated: true, deactivatedTurnsLeft: 1 })
        );

        expect(state.mode).toBeNull();
    });
});

describe("the move-phase button, for an enemy territory", () => {
    it("offers ATTACK when it is in range of an owned territory", () => {
        const state = deriveMoveButtonState(
            selection({ isAttackable: true, isInRange: true, sourceIsPlayerOwned: true })
        );

        expect(state).toMatchObject({
            label: "ATTACK",
            variant: "attack",
            enabled: true,
            mode: MoveMode.ATTACK,
            target: "attack"
        });
    });

    it("offers nothing when the previously selected territory was not the player's", () => {
        const state = deriveMoveButtonState(
            selection({ isAttackable: true, isInRange: true, sourceIsPlayerOwned: false })
        );

        expect(state.visible).toBe(false);
    });

    it("offers nothing when it is out of range", () => {
        const state = deriveMoveButtonState(
            selection({ isAttackable: true, isInRange: false, sourceIsPlayerOwned: true })
        );

        expect(state.visible).toBe(false);
    });

    it("offers VIEW SIEGE for a besieged territory, with the turn count", () => {
        const state = deriveMoveButtonState(selection({ isUnderSiege: true, siegeTurns: 4 }));

        expect(state).toMatchObject({
            label: "VIEW SIEGE (4)",
            variant: "viewSiege",
            enabled: true,
            mode: MoveMode.VIEW_SIEGE,
            target: "siege"
        });
    });

    it("prefers VIEW SIEGE over ATTACK on a besieged territory in range", () => {
        // A siege the player is already running is reached by clicking the territory;
        // offering ATTACK there would start a second war on the same ground.
        const state = deriveMoveButtonState(
            selection({
                isUnderSiege: true,
                siegeTurns: 2,
                isAttackable: true,
                isInRange: true,
                sourceIsPlayerOwned: true
            })
        );

        expect(state.label).toBe("VIEW SIEGE (2)");
    });

    it("says VIEW SIEGE (?) when the siege object cannot be found", () => {
        const state = deriveMoveButtonState(selection({ isUnderSiege: true }));

        expect(state.label).toBe("VIEW SIEGE (?)");
    });
});

describe("closing the transfer/attack window", () => {
    it("puts TRANSFER back", () => {
        expect(stateAfterWindowClosed(MoveMode.TRANSFER)).toMatchObject({
            label: "TRANSFER",
            enabled: true
        });
    });

    it("offers nothing after an attack is cancelled", () => {
        // audit 5.2 AE: cancelling an attack un-arms the target, so there is no
        // button to put back. The player clicks the territory again to re-arm.
        expect(stateAfterWindowClosed(MoveMode.ATTACK)).toBeNull();
    });
});
