// The battle window: the two flags and title, the probability bar, the two
// rows of eight army figures, the defender's stats strip, and the three
// buttons at the bottom (Retreat / Advance / Assault).
//
// Refactor Phase 6.3. Two hundred and eighty lines of `createElement`. As with
// `BattleResults`, most of it was the same statements repeated eight times for
// `armyRowRow1Icon1..8` and `armyRowRow2Quantity1..8` -- the attacker's four
// unit types followed by the defender's four, which is why column 5 carries
// the divider class.
//
// Row 4 column 2 is the part worth reading carefully. It is eight cells named
// `battleStatsProdPopIcon` through `H`, alternating icon and text: production
// population, food, fort defence, mountain defence. `A` also holds the Siege
// Territory button, which is why the first icon shares a cell with it. Those
// ids are meaningless and Phase 6.8 replaces them; the `STAT_CELLS` table here
// is what makes that a rename rather than an archaeology exercise.
//
// Battle overhaul B.6.2. This file still BUILDS the window; what each of the five
// bottom-bar buttons says, whether it responds, how wide it is and what colour it
// goes moved to `src/ui/battle/BattleWindow.js`, over a state derived by the pure
// `buttonState.js`. The click HANDLERS stay in ui.js -- opening a battle, resolving
// a round, garrisoning a conquest are turn-loop work -- but they are registered
// through `battleWindow.create()` and branch on the state rather than on a label.

import { ids, indexedIds } from "../core/registry.js";
import { el, mount } from "../core/dom.js";
import { forceLedger } from "../battle/ForceLedger.js";
import { roundLog } from "../battle/RoundLog.js";

/** Attacker infantry/assault/air/naval, then the defender's four. */
const UNIT_ICONS = ["infantry", "assault", "air", "naval", "infantry", "assault", "air", "naval"];

/** Where the defender's half of each eight-cell row begins. */
const DIVIDER_COLUMN = 5;

/**
 * Row 4's right-hand strip, in order: an icon cell then a value cell, four times
 * over -- productive population, food capacity, defence bonus, mountain defence.
 *
 * Phase 6.8 renamed these from `battleUIRow4Col2A` through `H`, which named where
 * they sat rather than what they showed, so the strip could not be read without
 * counting. The id, the CSS class and the entry here are one string, so a rename is
 * one edit in `registry.js` plus its class in `style.css`.
 */
const STAT_CELLS = [
    { cell: "battleStatsProdPopIcon", icon: ids.prodPopIcon, image: "prodPopulation" },
    { cell: "battleStatsProdPopValue", text: ids.prodPopText },
    { cell: "battleStatsFoodIcon", icon: ids.foodIcon, image: "foodCap" },
    { cell: "battleStatsFoodValue", text: ids.foodText },
    { cell: "battleStatsDefenseIcon", icon: ids.defenseIcon, image: "fortIcon", flex: true },
    { cell: "battleStatsDefenseValue", text: ids.defenseBonusText },
    { cell: "battleStatsMountainIcon", icon: ids.mountainDefenseIcon, image: "mountainDefenseIcon", flex: true },
    { cell: "battleStatsMountainValue", text: ids.mountainDefenseText, extraClass: "mountainDefenseText" },
];

let root = null;
let parts = null;

function unitIcon(name) {
    return `<img class='sizingPositionArmyIconsBattleUI' src='./resources/${name}.png'>`;
}

function statIcon(name) {
    return `<img class='sizingPositionRow4IconBattleUI' src='./resources/${name}.png'>`;
}

function eightColumns(buildId, className, dividerClass, { icons = false } = {}) {
    const cells = [];
    for (let n = 1; n <= UNIT_ICONS.length; n++) {
        cells.push(
            el("div", {
                id: buildId(n),
                class: n === DIVIDER_COLUMN ? [className, dividerClass] : className,
                html: icons ? unitIcon(UNIT_ICONS[n - 1]) : undefined,
            })
        );
    }
    return cells;
}

export function create() {
    if (root) return root;

    // Row 1 -- flags and the three-part title.
    const flagLeft = el("div", {
        id: ids.battleUITitleFlagCol1,
        class: "battleUITitleFlagCol1",
        html: "Flag Attacker",
    });
    const titleLeft = el("div", { id: ids.battleUITitleTitleLeft, class: "leftHalfTitleBattle" });
    const titleCenter = el("div", { id: ids.battleUITitleTitleCenter, class: "centerTitleBattle" });
    const titleRight = el("div", { id: ids.battleUITitleTitleRight, class: "rightHalfTitleBattle" });
    const flagRight = el("div", { id: ids.battleUITitleFlagCol2, class: "battleUITitleFlagCol2" });
    const row1 = el("div", { id: ids.battleUIRow1, class: ["battleUIRow", "battleUIRow1"] }, [
        flagLeft,
        el("div", { id: ids.battleUITitleTitleCol, class: "battleUITitleTitleCol" }, [
            titleLeft,
            titleCenter,
            titleRight,
        ]),
        flagRight,
    ]);

    // Row 2 -- the probability bar, which `prepareProbabilityBar()` fills.
    const probabilityBox = el("div", {
        id: ids.probabilityColumnBox,
        class: "probabilityColumnBox",
    });
    const row2 = el(
        "div",
        { id: ids.battleUIRow2, class: ["battleUIRow", "battleUIRow2", "battleUIRow2AttackBg"] },
        probabilityBox
    );

    // Row 3 -- unit icons over the live army figures.
    const row3 = el("div", { id: ids.battleUIRow3, class: ["battleUIRow", "battleUIRow3"] }, [
        el(
            "div",
            { id: ids.armyRowRow1, class: "armyRowRow1" },
            eightColumns(indexedIds.armyRowIcon, "armyIconColumnBattleUI", "armyIconColumnBattleUIDivider", {
                icons: true,
            })
        ),
        el(
            "div",
            { id: ids.armyRowRow2, class: "armyRowRow2" },
            eightColumns(indexedIds.armyRowQuantity, "armyRowRow2Quantity", "armyIconColumnBattleUIDivider")
        ),
    ]);

    // Row 4 -- probability / siege score on the left, defender stats on the right.
    const siegeButton = el("button", {
        id: ids.siegeButton,
        class: "siegeButton",
        html: "Siege Territory",
    });

    const statCells = STAT_CELLS.map((spec) => {
        const children = [];
        if (spec.cell === "battleStatsProdPopIcon") children.push(siegeButton);
        if (spec.icon) {
            children.push(
                el("div", {
                    id: spec.icon,
                    class: "battleRow4Icon",
                    style: spec.flex ? { display: "flex" } : undefined,
                    html: statIcon(spec.image),
                })
            );
        }
        if (spec.text) {
            children.push(
                el("div", {
                    id: spec.text,
                    class: spec.extraClass
                        ? ["battleRow4IconText", spec.extraClass]
                        : "battleRow4IconText",
                })
            );
        }
        return el("div", { id: ids[spec.cell], class: spec.cell }, children);
    });

    const row4 = el("div", { id: ids.battleUIRow4, class: ["battleUIRow", "battleUIRow4"] }, [
        el("div", { id: ids.battleUIRow4Col1, class: "battleUIRow4Col1" }, [
            el("div", {
                id: ids.battleUIRow4Col1IconProbabilityTurnsSiege,
                class: "battleUIRow4Col1IconProbabilityTurnsSiege",
            }),
            el("div", {
                id: ids.battleUIRow4Col1TextProbabilityTurnsSiege,
                class: "battleUIRow4Col1",
            }),
            el("div", {
                id: ids.battleUIRow4Col1IconSiegeScore,
                class: "battleUIRow4Col1IconProbabilityTurnsSiege",
            }),
            el("div", {
                id: ids.battleUIRow4Col1TextSiegeScore,
                class: ["battleUIRow4Col1", "battleUIRow4Col1TextWidth"],
            }),
        ]),
        el("div", { id: ids.battleUIRow4Col2, class: "battleUIRow4Col2" }, statCells),
    ]);

    // Row 5 -- the bottom bar. `BattleWindow.create()` installs the listeners, once.
    //
    // Battle overhaul B.7 took this from three buttons to five, and they are NOT all up at once:
    // `battleBarWidths()` in src/ui/battle/buttonState.js shares the width between whichever are
    // visible. Dig In and Commit Reserves appear once a round has been fought, and the third
    // button carries either "Assault!" (resuming out of a siege) or "Last Push!" (the offer),
    // never both -- which is `ThirdButton` on the window's state rather than a convention.
    const retreatButton = el("button", { id: ids.retreatButton, class: "retreatButton" });
    const digInButton = el("button", {
        id: ids.digInButton,
        class: ["battleBarButton", "digInButton"],
        html: "Dig In",
    });
    const reservesButton = el("button", {
        id: ids.reservesButton,
        class: ["battleBarButton", "reservesButton"],
        html: "Reserves",
    });
    const advanceButton = el("button", { id: ids.advanceButton, class: "advanceButton" });
    const assaultButton = el("button", {
        id: ids.siegeBottomBarButton,
        class: "siegeBottomBarButton",
        html: "Assault!",
    });
    const row5 = el("div", { id: ids.battleUIRow5, class: ["battleUIRow", "battleUIRow5"] }, [
        retreatButton,
        digInButton,
        reservesButton,
        advanceButton,
        assaultButton,
    ]);

    //Battle overhaul B.6.3. The ledger sits directly under the probability bar and above the
    //army figures, because it explains the first and predicts the second.
    const ledger = forceLedger.create();

    //B.6.4. The round log goes UNDER the ledger and above the army figures, collapsed. Ledger
    //then log is explanation then history, which is the order they are wanted in; and because it
    //is collapsed by default it costs one line of height until the player asks for it.
    const log = roundLog.create();

    root = el("div", { class: ["battleContainer", "blur-background"] },
        [row1, row2, ledger, log, row3, row4, row5]);
    parts = {
        flagLeft,
        flagRight,
        titleLeft,
        titleCenter,
        titleRight,
        probabilityBox,
        siegeButton,
        retreatButton,
        advanceButton,
        assaultButton,
        digInButton,
        reservesButton,
    };

    mount(ids.battleContainer, root);
    return root;
}

function container() {
    return document.getElementById(ids.battleContainer);
}

export function show() {
    const node = container();
    if (node) node.style.display = "block";
}

export function hide() {
    const node = container();
    if (node) node.style.display = "none";
}

export function isVisible() {
    return container()?.style.display !== "none";
}

/**
 * The buttons.
 *
 * Battle overhaul B.6.2: `src/ui/battle/BattleWindow.js` reaches them through the registry rather
 * than through this, so this exists for the two places in ui.js that still need a handle. Do not
 * write a label or a background colour onto one -- that is the window's job, and a second writer
 * is how the label and the state came to disagree in the first place.
 */
export function buttons() {
    if (!parts) return null;
    const {
        retreatButton, advanceButton, assaultButton, siegeButton, digInButton, reservesButton
    } = parts;
    return {
        retreat: retreatButton,
        advance: advanceButton,
        assault: assaultButton,
        siege: siegeButton,
        //Battle overhaul B.7. Omitting these two here was a real bug and worth recording: ui.js
        //destructures this object in its `DOMContentLoaded` block and immediately calls
        //`addEventListener` on each, so a missing key is not a missing button -- it is a
        //TypeError that stops bootstrap dead, before the main menu, with the whole game blank.
        digIn: digInButton,
        reserves: reservesButton
    };
}

export function elements() {
    return parts;
}

export function destroy() {
    root?.remove();
    root = null;
    parts = null;
}

export const battleUI = { create, show, hide, isVisible, buttons, elements, destroy };
