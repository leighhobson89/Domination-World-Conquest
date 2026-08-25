// What the move-phase button says, and whether it does anything.
//
// Phase 6.6. `handleMovePhaseTransferAttackButton()` was 300 lines in which the first
// hundred decided what the button should look like and wrote it straight onto the
// element, four `classList.remove()` calls at a time. There were five such blocks and
// no two removed the same set, so the button could end up carrying two backgrounds at
// once -- `MoveButton.setVariant()` fixed that in 6.3 by removing all five before
// adding one, and this file removes the reason it kept happening.
//
// The decision is a pure function of the selection. It has no DOM in it and no
// imports at all, which is what lets `tests/unit/ui-move-button.spec.js` state the
// whole table of outcomes in Node -- the five branches used to be reachable only by
// clicking a live map.
//
// The `mode` in the result is the value that was called `transferAttackButtonState`:
// 0 transfer, 1 attack, 2 view siege. It stays a number because the battle code and
// the transfer table both switch on it; naming it is Phase 7 work.

export const MoveMode = Object.freeze({
    TRANSFER: 0,
    ATTACK: 1,
    VIEW_SIEGE: 2
});

/** Nothing to offer for this selection: the button is hidden and does nothing. */
const HIDDEN = Object.freeze({ visible: false, label: "", variant: null, enabled: false, mode: null, target: null });

/**
 * Decide the button's state for a newly selected territory.
 *
 * Every input is a plain fact about the selection, so the caller does the reading and
 * this does the deciding.
 *
 * @param {object} selection
 * @param {boolean} selection.isPlayerOwned      the clicked territory is the player's
 * @param {boolean} selection.isDeactivated      locked out after a conquest
 * @param {number|undefined} selection.deactivatedTurnsLeft
 * @param {boolean} selection.isUnderSiege
 * @param {boolean} selection.isAttackable       flagged reachable this selection
 * @param {boolean} selection.isInRange          in the last player-owned reach list
 * @param {boolean} selection.sourceIsPlayerOwned  the PREVIOUS click was the player's
 * @param {number} selection.ownedTerritoryCount
 * @param {number|undefined} selection.siegeTurns
 * @returns {{visible: boolean, label: string, variant: string|null, enabled: boolean,
 *            mode: number|null, target: "attack"|"siege"|null}}
 *          `target` says whether the selection also has to be armed as an attack or a
 *          siege target -- the one side effect the caller still has to perform.
 */
export function deriveMoveButtonState(selection) {
    const {
        isPlayerOwned,
        isDeactivated,
        deactivatedTurnsLeft,
        isUnderSiege,
        isAttackable,
        isInRange,
        sourceIsPlayerOwned,
        ownedTerritoryCount,
        siegeTurns
    } = selection;

    if (isPlayerOwned) {
        if (isDeactivated) {
            //Still serving its lockout. The count is shown so the player knows how
            //long, rather than being told "no" with no reason.
            return {
                visible: true,
                label: `DEACTIVATED (${deactivatedTurnsLeft})`,
                variant: "disabled",
                enabled: false,
                //The mode is deliberately left alone here. The original set
                //`transferAttackButtonState` only on the enabled branches, so a
                //deactivated selection leaves whatever the last live one chose.
                mode: null,
                target: null
            };
        }

        //A country with one territory has nowhere to transfer to, so TRANSFER is
        //shown but dead -- which reads better than hiding it and leaving the player
        //wondering where the button went.
        const alone = ownedTerritoryCount <= 1;
        return {
            visible: true,
            label: "TRANSFER",
            variant: alone ? "disabled" : "transfer",
            enabled: !alone,
            mode: alone ? null : MoveMode.TRANSFER,
            target: null
        };
    }

    //An enemy territory. Order matters: a besieged one offers VIEW SIEGE whether or
    //not it is in range, because the player may already have a siege running on it.
    if (sourceIsPlayerOwned && isAttackable && isInRange && !isUnderSiege) {
        return {
            visible: true,
            label: "ATTACK",
            variant: "attack",
            enabled: true,
            mode: MoveMode.ATTACK,
            target: "attack"
        };
    }

    if (isUnderSiege) {
        return {
            visible: true,
            label: `VIEW SIEGE (${siegeTurns ?? "?"})`,
            variant: "viewSiege",
            enabled: true,
            mode: MoveMode.VIEW_SIEGE,
            target: "siege"
        };
    }

    return HIDDEN;
}

/**
 * The button after the transfer/attack window is dismissed with its X.
 *
 * Transfer returns to its own label with the window closed; attack does not appear
 * here at all, because cancelling an attack un-arms the target and hides the button
 * (audit 5.2 AE -- see `cancelAttackSelection()`).
 */
export function stateAfterWindowClosed(mode) {
    if (mode === MoveMode.TRANSFER) {
        return { visible: true, label: "TRANSFER", variant: "transfer", enabled: true, mode: MoveMode.TRANSFER, target: null };
    }
    return null;
}
