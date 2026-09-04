// The battle window's bottom bar, DERIVED.
//
// Battle overhaul B.6.6. What this replaces is worth stating, because the shape of the bug it
// closes is the same one `deriveMoveButtonState()` closed for the move button.
//
// There used to be TWO independent vocabularies for the same five buttons. `advanceButtonState`
// held 0..3 and decided what a click DID; `setAdvanceButtonText(situation, button)` took a
// different 0..7 and decided what the button SAID. Nothing tied them together -- every call site
// set both by hand, and they agreed only by convention:
//
//     setAdvanceButtonState(2); setAdvanceButtonText(4, advanceButton);   // "accept", "Rout"
//     setAdvanceButtonState(2); setAdvanceButtonText(3, advanceButton);   // "accept", "Massive"
//
// The cost of that shows up two ways. Case 5 of the label switch ("End Round") was left in place
// with a comment saying it is unused *because the numbering of the cases either side of it would
// otherwise shift* -- a dead branch kept alive by positional coupling. And the advance handler
// asked `if (advanceButton.innerHTML === "Start Attack!")`: a question about the state of the
// battle, answered by reading a string out of the DOM. "Start Attack!" was never written by
// anything, so that branch could not fire at all.
//
// Here there is ONE state, the label is derived from it, and the label is never read back.
// Everything below is pure -- no DOM, no imports -- so `tests/unit/ui-battle-buttons.spec.js`
// asserts the whole state machine in milliseconds. `BattleWindow.js` is the only thing that
// turns a spec into elements.

/** What pressing the big green button MEANS. One value, and the label follows from it. */
export const AdvanceMode = Object.freeze({
    /** Nothing has been fought yet. The press opens the battle. */
    BEGIN: "begin",
    /** One press, one round of dice. */
    ROUND: "round",
    /** The battle is won and the press banks it. `victory` says which kind of win. */
    ACCEPT: "accept",
    /** The window is showing a standing siege; the press just closes it. */
    SIEGE: "siege",
    /**
     * A recorded battle the PLAYER DEFENDED is replaying (overhaul B.8). There is nothing to
     * decide, so the bar is one full-width button and the press cuts the replay short.
     */
    SKIP: "skip"
});

/**
 * How the attacker won, for the label only.
 *
 * The three used to be three `advanceButtonText` cases sharing one `advanceButtonState`, which
 * is precisely the coupling this module exists to remove: the flavour changes the word, never
 * the behaviour.
 */
export const VictoryKind = Object.freeze({
    CLEAN: "clean",
    ROUT: "rout",
    ASSAULT: "assault"
});

/** What pressing the red button costs. */
export const RetreatMode = Object.freeze({
    /** Before the first round: a free withdrawal. */
    FREE: "free",
    /** After a round has been fought: the scatter penalty applies. */
    SCATTER: "scatter",
    /** The attack is over and lost; the press only dismisses the window. */
    DEFEAT: "defeat",
    /** Looking at a standing siege: the press lifts it. */
    PULL_OUT: "pullOut"
});

/**
 * The third slot in the bar, which is one button carrying one of two unrelated jobs.
 *
 * They are mutually exclusive by construction rather than by care: `LAST_PUSH` is only ever
 * offered inside a live battle and `ASSAULT` only ever outside one.
 */
export const ThirdButton = Object.freeze({
    NONE: "none",
    /** Resume a battle out of a siege. */
    ASSAULT: "assault",
    /** Buy the territory now with a fifth of the survivors (overhaul section 4.8). */
    LAST_PUSH: "lastPush"
});

/** Whether there is anything left at the front to send. */
export const ReservesState = Object.freeze({
    READY: "ready",
    IN_TRANSIT: "inTransit",
    EMPTY: "empty"
});

const ADVANCE_LABELS = Object.freeze({
    [AdvanceMode.BEGIN]: "Begin War!",
    [AdvanceMode.ROUND]: "Next Round",
    [AdvanceMode.SIEGE]: "Continue Siege",
    [AdvanceMode.SKIP]: "Skip"
});

const VICTORY_LABELS = Object.freeze({
    [VictoryKind.CLEAN]: "Victory!",
    [VictoryKind.ROUT]: "Rout The Enemy",
    [VictoryKind.ASSAULT]: "Massive Assault"
});

const RETREAT_LABELS = Object.freeze({
    [RetreatMode.FREE]: "Retreat!",
    [RetreatMode.SCATTER]: "Scatter!",
    [RetreatMode.DEFEAT]: "Defeat!",
    [RetreatMode.PULL_OUT]: "Pull Out"
});

const RESERVES_LABELS = Object.freeze({
    [ReservesState.READY]: "Reserves",
    [ReservesState.IN_TRANSIT]: "In transit",
    [ReservesState.EMPTY]: "None left"
});

/** The state a freshly opened attack starts in. Exported so the window and the specs agree. */
export function initialBattleButtons() {
    return {
        advance: AdvanceMode.BEGIN,
        victory: VictoryKind.CLEAN,
        retreat: RetreatMode.FREE,
        third: ThirdButton.NONE,
        //The siege button is DISABLED until a round has been fought. Laying a siege is a decision
        //about a battle that is going badly, and there is no such battle before the first round.
        siegeEnabled: false,
        midBattleControls: false,
        digInArmed: false,
        reserves: ReservesState.READY
    };
}

/** The state the window starts in when it is opened over a siege that already stands. */
export function siegeBattleButtons() {
    return {
        ...initialBattleButtons(),
        advance: AdvanceMode.SIEGE,
        retreat: RetreatMode.PULL_OUT,
        third: ThirdButton.ASSAULT,
        siegeEnabled: false
    };
}

/**
 * Turn one battle-window state into what each of the five buttons shows and whether it responds.
 *
 * Pure. The result is a plain description -- no elements, no ids -- which is what lets the whole
 * machine be asserted without a DOM and what stops a label ever being read back as state.
 *
 * @param {object} state as built by `initialBattleButtons()`
 * @returns {{advance: object, retreat: object, siege: object, third: object,
 *            digIn: object, reserves: object}}
 */
export function deriveBattleButtons(state) {
    const s = { ...initialBattleButtons(), ...(state ?? {}) };

    //A replay has no decisions in it. Rather than five hide calls at the call site -- which is
    //what B.8 shipped, and which left the OTHER four buttons hidden for the next real battle
    //until something happened to show them again -- SKIP is a state of this machine and the
    //ordinary reset puts the bar back.
    if (s.advance === AdvanceMode.SKIP) {
        return {
            advance: { label: ADVANCE_LABELS[AdvanceMode.SKIP], enabled: true, mode: AdvanceMode.SKIP },
            retreat: { visible: false, label: "", enabled: false, mode: s.retreat },
            siege: { enabled: false },
            third: { visible: false, label: "", enabled: false, job: ThirdButton.NONE },
            digIn: { visible: false, label: "Dig In", armed: false, enabled: false },
            reserves: { visible: false, label: "Reserves", enabled: false, state: s.reserves }
        };
    }

    const advance = {
        label: s.advance === AdvanceMode.ACCEPT
            ? (VICTORY_LABELS[s.victory] ?? VICTORY_LABELS[VictoryKind.CLEAN])
            : (ADVANCE_LABELS[s.advance] ?? ADVANCE_LABELS[AdvanceMode.BEGIN]),
        //The attack is lost: the only way out is the red button, so the green one goes inert.
        //It is `enabled` and a class rather than the `disabled` property for the reason
        //CLAUDE.md records for the steppers -- a disabled element swallows the click, and the
        //battle container's capture listener needs to see it to settle the dice.
        enabled: s.retreat !== RetreatMode.DEFEAT,
        mode: s.advance
    };

    const retreat = {
        label: RETREAT_LABELS[s.retreat] ?? RETREAT_LABELS[RetreatMode.FREE],
        //Withdrawing is always available. It was briefly written as
        //`disabled = true; ...; disabled = false` on consecutive lines, which is a no-op that
        //looked like a rule.
        enabled: true,
        mode: s.retreat
    };

    //Once the battle has ended -- won or lost -- laying a siege is not one of the options, and
    //the button says so rather than throwing when pressed.
    const battleOver = s.advance === AdvanceMode.ACCEPT || s.retreat === RetreatMode.DEFEAT;
    const siege = { enabled: Boolean(s.siegeEnabled) && !battleOver };

    const third = {
        visible: s.third !== ThirdButton.NONE,
        label: s.third === ThirdButton.LAST_PUSH ? "Last Push!" : "Assault!",
        enabled: s.third !== ThirdButton.NONE,
        job: s.third
    };

    //Both mid-battle decisions are meaningless before a round has been fought: there is nothing
    //to dig in against, and reserves committed now would simply be part of the attack.
    const showMidBattle = Boolean(s.midBattleControls) && s.advance === AdvanceMode.ROUND;

    const digIn = {
        visible: showMidBattle,
        label: s.digInArmed ? "Digging In" : "Dig In",
        armed: Boolean(s.digInArmed),
        enabled: true
    };

    const reserves = {
        visible: showMidBattle,
        label: RESERVES_LABELS[s.reserves] ?? RESERVES_LABELS[ReservesState.READY],
        enabled: s.reserves === ReservesState.READY,
        state: s.reserves
    };

    return { advance, retreat, siege, third, digIn, reserves };
}

/**
 * How wide each visible button is, as a percentage string.
 *
 * The bar shares its width between whichever buttons are up, which is between two and five.
 * Written here rather than measured from the DOM so the arithmetic is testable and so the bar
 * cannot end up 99.99% wide from rounding: the last visible button takes the remainder.
 *
 * @param {object} spec the result of `deriveBattleButtons()`
 * @returns {object} the same keys, each with a `width` string, plus `visible`
 */
export function battleBarWidths(spec) {
    const order = ["retreat", "digIn", "reserves", "advance", "third"];
    const visible = order.filter((key) => spec[key].visible !== false);
    if (visible.length === 0) {
        return {};
    }
    const each = Math.floor((100 / visible.length) * 10000) / 10000;
    const widths = {};
    visible.forEach((key, index) => {
        widths[key] = index === visible.length - 1
            ? `${(100 - each * (visible.length - 1)).toFixed(4)}%`
            : `${each.toFixed(4)}%`;
    });
    return widths;
}
