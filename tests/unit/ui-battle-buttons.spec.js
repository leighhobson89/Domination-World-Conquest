// The battle window's bottom bar, as a state machine.
//
// Battle overhaul B.6.6. `src/ui/battle/buttonState.js` is pure -- no DOM, no imports -- which is
// the whole reason the extraction was worth doing: the machine that used to be ~180 lines inside
// `ui.js`'s `DOMContentLoaded` handler, reachable only by opening a battle in a browser, is
// asserted here in milliseconds.
//
// What these tests are really guarding is the ONE invariant the old code did not have: the label
// and the behaviour come from the same state. Every assertion below reads a label out of a state
// rather than setting one, which is the thing that stopped being possible to get wrong.

import { describe, expect, it } from "vitest";

import {
    AdvanceMode,
    ReservesState,
    RetreatMode,
    ThirdButton,
    VictoryKind,
    battleBarWidths,
    deriveBattleButtons,
    initialBattleButtons,
    siegeBattleButtons
} from "../../src/ui/battle/buttonState.js";

/** Derive from the opening state plus a patch, which is how every call site uses it. */
function bar(patch) {
    return deriveBattleButtons({ ...initialBattleButtons(), ...patch });
}

describe("the opening state of an attack", () => {
    it("offers Begin War and a free withdrawal", () => {
        const spec = deriveBattleButtons(initialBattleButtons());
        expect(spec.advance.label).toBe("Begin War!");
        expect(spec.advance.enabled).toBe(true);
        expect(spec.retreat.label).toBe("Retreat!");
        expect(spec.retreat.enabled).toBe(true);
    });

    it("does not offer a siege before a round has been fought", () => {
        //Laying a siege is a decision about a battle that is going badly, and there is no such
        //battle yet.
        expect(deriveBattleButtons(initialBattleButtons()).siege.enabled).toBe(false);
    });

    it("hides the two mid-battle decisions and the third button", () => {
        const spec = deriveBattleButtons(initialBattleButtons());
        expect(spec.digIn.visible).toBe(false);
        expect(spec.reserves.visible).toBe(false);
        expect(spec.third.visible).toBe(false);
    });
});

describe("the opening state over a standing siege", () => {
    it("offers Continue Siege, Pull Out and Assault", () => {
        const spec = deriveBattleButtons(siegeBattleButtons());
        expect(spec.advance.label).toBe("Continue Siege");
        expect(spec.retreat.label).toBe("Pull Out");
        expect(spec.third.visible).toBe(true);
        expect(spec.third.label).toBe("Assault!");
        expect(spec.third.job).toBe(ThirdButton.ASSAULT);
    });
});

describe("the advance button's label follows its mode", () => {
    it("says Next Round while rounds are being fought", () => {
        expect(bar({ advance: AdvanceMode.ROUND }).advance.label).toBe("Next Round");
    });

    //The three victory labels used to be three `setAdvanceButtonText` cases sharing one
    //`advanceButtonState` of 2. The flavour changes the word and nothing else, which is why it is
    //a separate field rather than three modes.
    it.each([
        [VictoryKind.CLEAN, "Victory!"],
        [VictoryKind.ROUT, "Rout The Enemy"],
        [VictoryKind.ASSAULT, "Massive Assault"]
    ])("says %s as %s", (victory, label) => {
        const spec = bar({ advance: AdvanceMode.ACCEPT, victory });
        expect(spec.advance.label).toBe(label);
        expect(spec.advance.mode).toBe(AdvanceMode.ACCEPT);
    });

    it("falls back to the clean victory label rather than showing nothing", () => {
        expect(bar({ advance: AdvanceMode.ACCEPT, victory: "nonsense" }).advance.label)
            .toBe("Victory!");
    });
});

describe("a lost attack", () => {
    it("makes the red button the only way out", () => {
        const spec = bar({ retreat: RetreatMode.DEFEAT });
        expect(spec.retreat.label).toBe("Defeat!");
        expect(spec.retreat.enabled).toBe(true);
        expect(spec.advance.enabled).toBe(false);
    });

    it("takes the siege option away even if it had been enabled", () => {
        //Five branches of `handleWarEndingsAndOptions()` used to disable this by hand, each with
        //its own colour literal. It is a consequence of the state now.
        expect(bar({ retreat: RetreatMode.DEFEAT, siegeEnabled: true }).siege.enabled).toBe(false);
        expect(bar({ advance: AdvanceMode.ACCEPT, siegeEnabled: true }).siege.enabled).toBe(false);
    });
});

describe("the mid-battle decisions", () => {
    it("stay hidden before the first round even when asked for", () => {
        //`midBattleControls` is a request; being in a round is the precondition. Both have to
        //hold, which is what makes "meaningless before a round has been fought" a rule rather
        //than a convention the call sites happen to follow.
        const spec = bar({ midBattleControls: true, advance: AdvanceMode.BEGIN });
        expect(spec.digIn.visible).toBe(false);
        expect(spec.reserves.visible).toBe(false);
    });

    it("appear once a round is being fought", () => {
        const spec = bar({ midBattleControls: true, advance: AdvanceMode.ROUND });
        expect(spec.digIn.visible).toBe(true);
        expect(spec.reserves.visible).toBe(true);
    });

    it("say Digging In while armed", () => {
        const armed = bar({ midBattleControls: true, advance: AdvanceMode.ROUND, digInArmed: true });
        expect(armed.digIn.label).toBe("Digging In");
        expect(armed.digIn.armed).toBe(true);
    });

    it.each([
        [ReservesState.READY, "Reserves", true],
        [ReservesState.IN_TRANSIT, "In transit", false],
        [ReservesState.EMPTY, "None left", false]
    ])("reports reserves as %s", (state, label, enabled) => {
        const spec = bar({ midBattleControls: true, advance: AdvanceMode.ROUND, reserves: state });
        expect(spec.reserves.label).toBe(label);
        expect(spec.reserves.enabled).toBe(enabled);
    });
});

describe("the third button carries one job at a time", () => {
    it("offers the last push when the defender is nearly broken", () => {
        const spec = bar({ advance: AdvanceMode.ROUND, third: ThirdButton.LAST_PUSH });
        expect(spec.third.visible).toBe(true);
        expect(spec.third.label).toBe("Last Push!");
        expect(spec.third.job).toBe(ThirdButton.LAST_PUSH);
    });

    it("is hidden when it has no job", () => {
        expect(bar({ third: ThirdButton.NONE }).third.visible).toBe(false);
    });
});

describe("the replay's Skip state", () => {
    //Battle overhaul B.8. A recorded battle the player DEFENDED has nothing to decide in it, so
    //the bar is one full-width button. It was five hide calls at the call site, which left the
    //other four hidden for the next real battle.
    it("is one button and hides everything else", () => {
        const spec = bar({ advance: AdvanceMode.SKIP, midBattleControls: true,
            third: ThirdButton.LAST_PUSH, siegeEnabled: true });
        expect(spec.advance.label).toBe("Skip");
        expect(spec.advance.enabled).toBe(true);
        expect(spec.retreat.visible).toBe(false);
        expect(spec.third.visible).toBe(false);
        expect(spec.digIn.visible).toBe(false);
        expect(spec.reserves.visible).toBe(false);
        expect(spec.siege.enabled).toBe(false);
    });

    it("is undone by resetting the bar for an attack", () => {
        const spec = deriveBattleButtons(initialBattleButtons());
        expect(spec.advance.label).toBe("Begin War!");
        expect(spec.retreat.visible).not.toBe(false);
    });
});

describe("the bar's widths", () => {
    it("splits between the two buttons a fresh attack shows", () => {
        const widths = battleBarWidths(deriveBattleButtons(initialBattleButtons()));
        expect(Object.keys(widths).sort()).toEqual(["advance", "retreat"]);
        expect(widths.retreat).toBe("50.0000%");
        expect(widths.advance).toBe("50.0000%");
    });

    it("splits five ways once every control is up, and sums to exactly 100", () => {
        const spec = bar({
            advance: AdvanceMode.ROUND,
            midBattleControls: true,
            third: ThirdButton.LAST_PUSH
        });
        const widths = battleBarWidths(spec);
        expect(Object.keys(widths)).toHaveLength(5);
        const total = Object.values(widths)
            .reduce((sum, width) => sum + parseFloat(width), 0);
        //The last visible button takes the remainder, so a bar of five cannot come out 99.9995%
        //wide -- which is what dividing 100 by 5 and rounding to four places would have given for
        //three, seven or nine buttons.
        expect(total).toBeCloseTo(100, 6);
    });

    it("gives the whole bar to Skip", () => {
        const widths = battleBarWidths(bar({ advance: AdvanceMode.SKIP }));
        expect(widths.advance).toBe("100.0000%");
    });

    it("reports nothing when the bar is empty", () => {
        expect(battleBarWidths({
            retreat: { visible: false }, digIn: { visible: false }, reserves: { visible: false },
            advance: { visible: false }, third: { visible: false }
        })).toEqual({});
    });
});

describe("an unknown state does not produce a blank bar", () => {
    it("falls back to the opening labels", () => {
        const spec = deriveBattleButtons({ advance: "nonsense", retreat: "nonsense" });
        expect(spec.advance.label).toBe("Begin War!");
        expect(spec.retreat.label).toBe("Retreat!");
    });

    it("treats no state at all as the opening state", () => {
        expect(deriveBattleButtons(undefined).advance.label).toBe("Begin War!");
    });
});
