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

    it("greys the button out when the player is not at war with the owner", () => {
        //Leigh's brief: *"in the case of the player has that option greyed out on
        //territories of countrys with which it has peace"*. VISIBLE and disabled, never
        //hidden -- a territory that simply stops responding tells the player nothing,
        //where a greyed button carrying the state says the province is in reach and the
        //obstacle is diplomatic rather than military.
        const state = deriveMoveButtonState(
            selection({
                isAttackable: true,
                isInRange: true,
                sourceIsPlayerOwned: true,
                mayAttack: false,
                relationLabel: "Neutral"
            })
        );

        expect(state).toMatchObject({
            visible: true,
            label: "NEUTRAL",
            variant: "disabled",
            enabled: false,
            target: null
        });
    });

    it("carries a hover sentence naming the country and the state", () => {
        //DERIVED, and that is the point. The button's `mouseover` in ui.js decides its
        //tooltip by matching `button.innerHTML` against a chain of fixed strings, which
        //cannot work for a label that is now one of five relation names — reading a label
        //back to decide anything is the defect the battle bar records at length. So the
        //sentence comes from here and `ui.js` only shows it.
        const hint = deriveMoveButtonState(
            selection({
                isAttackable: true,
                isInRange: true,
                sourceIsPlayerOwned: true,
                mayAttack: false,
                relationLabel: "Neutral",
                relationCountry: "France"
            })
        ).hint;

        expect(hint).toContain("France");
        expect(hint).toContain("not at war");
        //It states the FACT and promises no control: declaring war is Stage 3, so
        //"click to declare war" would be a lie today and a stale string tomorrow.
        expect(hint).not.toContain("Click");
    });

    it("gives peace, ceasefire and alliance their own sentences", () => {
        const hintFor = (relationLabel) => deriveMoveButtonState(
            selection({
                isAttackable: true,
                isInRange: true,
                sourceIsPlayerOwned: true,
                mayAttack: false,
                relationLabel,
                relationCountry: "France"
            })
        ).hint;

        expect(hintFor("At peace")).toContain("breaking the peace");
        expect(hintFor("Ceasefire")).toContain("ceasefire");
        expect(hintFor("Allied")).toContain("ally");
        //Each names the country as a NOUN. There are no demonym forms for 207 country
        //names, so "the France garrison" is what a naive template produces — the rule a
        //unit test already enforces on the activity feed.
        for (const label of ["At peace", "Ceasefire", "Allied", "Neutral"]) {
            expect(hintFor(label)).not.toMatch(/France[a-z]/);
        }
    });

    it("falls back to a sentence when the owner is not known", () => {
        const hint = deriveMoveButtonState(
            selection({
                isAttackable: true,
                isInRange: true,
                sourceIsPlayerOwned: true,
                mayAttack: false
            })
        ).hint;
        expect(hint).toContain("this country");
    });

    it("does not arm the territory as an attack target when it may not be attacked", () => {
        //`target` is the one side effect the caller performs off this result, and arming a
        //target the player cannot fight would leave the marker on the map with no way to
        //take it off.
        const state = deriveMoveButtonState(
            selection({
                isAttackable: true,
                isInRange: true,
                sourceIsPlayerOwned: true,
                mayAttack: false
            })
        );

        expect(state.target).toBeNull();
        expect(state.mode).toBeNull();
        expect(state.label).toBe("NOT AT WAR");
    });

    it("still offers VIEW SIEGE on a besieged territory whatever the relation", () => {
        //A siege already standing is untouched by the gate, the same narrowness the
        //player's grace period has: this refuses the OPENING of an interaction, never the
        //continuation of one.
        const state = deriveMoveButtonState(
            selection({
                isUnderSiege: true,
                isAttackable: true,
                isInRange: true,
                sourceIsPlayerOwned: true,
                mayAttack: false,
                siegeTurns: 3
            })
        );

        expect(state).toMatchObject({ variant: "viewSiege", enabled: true, target: "siege" });
    });

    it("attacks as it always did when nothing says otherwise", () => {
        //The default is permission, so every caller that predates diplomacy behaves as it
        //used to. That is the deliberate half of the choice recorded in `rateTarget()`.
        const state = deriveMoveButtonState(
            selection({ isAttackable: true, isInRange: true, sourceIsPlayerOwned: true })
        );
        expect(state.label).toBe("ATTACK");
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

describe("declaring war, from the attack control", () => {
    // Diplomacy checklist stage 3.2. Leigh named two ways into a war -- *"changing state by
    // communication diplomacy and also declaring without chatting too"* -- and this is the
    // second: a bare declaration, no negotiation, taken from the control the player was
    // already reaching for.
    //
    // `mayDeclare` DEFAULTS TO FALSE, deliberately. A caller that has not been taught about
    // declarations behaves exactly as the game did in stage 2: the button is greyed and says
    // why. The alternative default would offer a control that leads nowhere.
    const declarable = (overrides = {}) => selection({
        isAttackable: true,
        isInRange: true,
        sourceIsPlayerOwned: true,
        mayAttack: false,
        mayDeclare: true,
        relationLabel: "Neutral",
        relationCountry: "France",
        ...overrides
    });

    it("offers DECLARE WAR in place of the greyed button", () => {
        expect(deriveMoveButtonState(declarable())).toMatchObject({
            visible: true,
            label: "DECLARE WAR",
            enabled: true,
            mode: MoveMode.DECLARE,
            target: null
        });
    });

    it("does not wear the attack colour", () => {
        //A declaration is not an attack and must not look like the button that opens one:
        //the next click after this one is ATTACK, in the same place, and two identical red
        //buttons a click apart is how a player invades a country they meant to threaten.
        expect(deriveMoveButtonState(declarable()).variant).not.toBe("attack");
    });

    it("arms no attack target", () => {
        //The marker and its target are one fact (`markers.js`), and arming one for a
        //territory the player may not yet attack would leave it on the map with no way off.
        const state = deriveMoveButtonState(declarable());
        expect(state.target).toBeNull();
    });

    it("says why the territory cannot be attacked BEFORE it offers the declaration", () => {
        //The design's own order: *"the attack control says why a territory cannot be
        //attacked before it offers the declaration. A greyed control with no reason is a
        //bug report waiting to be filed."*
        const hint = deriveMoveButtonState(declarable()).hint;
        expect(hint).toContain("France");
        expect(hint).toContain("not at war");
        expect(hint.indexOf("not at war")).toBeLessThan(hint.indexOf("Declaring war"));
    });

    it("warns that an agreement would be broken", () => {
        const hintFor = (relationLabel) =>
            deriveMoveButtonState(declarable({ relationLabel })).hint;
        expect(hintFor("At peace")).toMatch(/breach|breaking the peace/i);
        expect(hintFor("Allied")).toMatch(/ally/i);
        //Still never a demonym.
        for (const label of ["At peace", "Ceasefire", "Allied", "Neutral"]) {
            expect(hintFor(label)).not.toMatch(/France[a-z]/);
        }
    });

    it("greys out instead when a declaration is not possible", () => {
        //NO_CONTACT is the one state war cannot be declared out of, and the contact walk is
        //coalesced -- so a border that opened during the AI's turn can genuinely read this
        //way for a moment.
        const state = deriveMoveButtonState(
            declarable({ mayDeclare: false, relationLabel: "No contact" })
        );
        expect(state).toMatchObject({ enabled: false, variant: "disabled", mode: null });
    });

    it("prefers VIEW SIEGE on a besieged territory", () => {
        const state = deriveMoveButtonState(declarable({ isUnderSiege: true, siegeTurns: 2 }));
        expect(state.label).toBe("VIEW SIEGE (2)");
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
