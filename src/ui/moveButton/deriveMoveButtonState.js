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
    VIEW_SIEGE: 2,
    /**
     * Declare war on the owner of the selected territory. Diplomacy stage 3.2.
     *
     * It is a MODE rather than a `target`, because `target` names something the caller has
     * to ARM on the map -- an attack marker, a siege -- and a declaration arms nothing. What
     * it does is change the world and then ask for the button to be worked out again, which
     * is a click handler's job and not a selection's.
     */
    DECLARE: 3
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
 * @param {boolean} selection.mayAttack         the player is at WAR with this territory's
 *        owner. Defaults true, so a caller that does not know about diplomacy behaves as
 *        the game did before it existed
 * @param {boolean} selection.mayDeclare        war can be declared out of the current state.
 *        Defaults FALSE, the opposite way round from `mayAttack` and for the same reason: a
 *        caller that has not been taught about declarations behaves as the game did at the
 *        stage 2 checkpoint -- greyed, and saying why -- rather than offering a control that
 *        leads nowhere
 * @param {string} [selection.relationLabel]    how the state reads, for the button
 * @param {string} [selection.relationCountry]  who the territory belongs to, for the hint
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
        mayAttack = true,
        mayDeclare = false,
        relationLabel = null,
        relationCountry = null,
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
        //NOT AT WAR WITH THEM. Leigh's brief for the diplomacy phase, in his own words:
        //*"in the case of the player has that option greyed out on territories of countrys
        //with which it has peace"*.
        //
        //It is a VISIBLE, DISABLED button and never a hidden one, and that distinction is
        //the whole value of putting the refusal here rather than filtering the territory
        //out of the reachable set upstream. A territory that simply stops responding tells
        //the player nothing; a greyed button carrying the state tells them the province is
        //in reach, that the reason they cannot take it is diplomatic rather than military,
        //and — once declarations land in Stage 3 — exactly which control turns it back on.
        if (!mayAttack) {
            //THE DECLARATION, when one is possible. Stage 3.2, and Leigh's second route into
            //a war: *"declaring without chatting too"*. It is offered from the control the
            //player was already reaching for, and it takes effect at once -- declare and
            //attack the same turn, because there is no waiting period anywhere in this
            //system.
            //
            //It is NOT the attack colour. The next click after this one is ATTACK, in the
            //same place, and two identical red buttons a click apart is how somebody invades
            //a country they meant only to threaten.
            if (mayDeclare) {
                return {
                    visible: true,
                    label: "DECLARE WAR",
                    variant: "open",
                    enabled: true,
                    mode: MoveMode.DECLARE,
                    //Nothing is armed. `target` names something the caller puts on the map,
                    //and a marker for a territory that cannot yet be attacked would have no
                    //way off it (`markers.js` -- the marker and its target are one fact).
                    target: null,
                    hint: diplomaticHint(relationLabel, relationCountry) + " " +
                        declarationOffer(relationLabel)
                };
            }
            return {
                visible: true,
                label: relationLabel ? relationLabel.toUpperCase() : "NOT AT WAR",
                variant: "disabled",
                enabled: false,
                //Left alone, like the deactivated branch above: this is not a live
                //selection and must not overwrite whatever mode the last one chose.
                mode: null,
                target: null,
                hint: diplomaticHint(relationLabel, relationCountry)
            };
        }
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
 * What the greyed button says on hover.
 *
 * IT IS DERIVED AND NOT MATCHED ON THE LABEL. The move button's `mouseover` decides its
 * tooltip by reading `button.innerHTML` against a chain of literals -- which worked while
 * every label was a fixed string, and cannot work for a label that is now one of five
 * relation names. Reading a label back to decide anything is the defect the battle bar
 * records at length; this returns the sentence with the state, and `ui.js` only has to
 * show it.
 *
 * The wording states the FACT and nothing else. What the player may DO about it is a
 * separate sentence (`declarationOffer()` below), appended only on the branch that actually
 * offers the control -- which is the design's own order: *"the attack control says why a
 * territory cannot be attacked before it offers the declaration"*. Keeping the two apart is
 * what let the fact survive stage 3 unedited when the control it deliberately did not
 * promise finally arrived.
 */
function diplomaticHint(relationLabel, relationCountry) {
    //Never a demonym: there are no adjective forms for 207 country names, so every
    //phrasing here is built to use the name as a noun. The activity feed's own rule.
    const them = relationCountry ? relationCountry : "this country";
    switch (relationLabel) {
        case "At peace":
            return `You are at peace with ${them}. Attacking would mean breaking the peace, ` +
                "which requires a declaration of war and carries a penalty.";
        case "Ceasefire":
            return `A ceasefire holds between you and ${them}. Neither side may attack ` +
                "while it stands.";
        case "Allied":
            return `${them} is your ally. You cannot attack an ally without breaking the ` +
                "alliance, which is the most costly thing you can do in this game.";
        case "No contact":
            return `You have never had dealings with ${them}, so there is nothing between ` +
                "you to fight over yet.";
        case "Neutral":
        default:
            return `You are not at war with ${them}. Neither side has declared, and until ` +
                "one does, neither may attack the other.";
    }
}

/**
 * What the DECLARE WAR button does, said after the fact that explains why it is there.
 *
 * A declaration out of NEUTRAL costs nothing, because nothing was promised. Out of one of
 * the three agreements it is a BREACH -- the one act the whole penalty rule attaches to --
 * and the sentence says so before the click rather than after it. The confirmation dialog in
 * stage 4 says it again at greater length; this is the version a player reads while deciding
 * whether to move the pointer at all.
 *
 * It names no number. The price of a breach is stage 5.6 and does not exist yet, and a hint
 * quoting a penalty the game does not levy is exactly the class of lie this file's other
 * sentence was written to avoid.
 */
function declarationOffer(relationLabel) {
    switch (relationLabel) {
        case "At peace":
        case "Ceasefire":
        case "Allied":
            return "Declaring war would break that agreement -- a breach, and the one way " +
                "out of an agreement that costs anything. Click to declare.";
        default:
            return "Declaring war costs nothing, because nothing was agreed. It takes " +
                "effect at once, so you may attack this turn. Click to declare.";
    }
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
