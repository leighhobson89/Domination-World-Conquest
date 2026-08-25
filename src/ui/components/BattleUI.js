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
// The buttons' listeners stay in ui.js. Advance in particular walks a state
// machine over rounds, sieges and routs, and moving it would mean moving the
// battle.

import { ids, indexedIds } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

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

    // Row 5 -- the three buttons. ui.js installs their listeners.
    const retreatButton = el("button", { id: ids.retreatButton, class: "retreatButton" });
    const advanceButton = el("button", { id: ids.advanceButton, class: "advanceButton" });
    const assaultButton = el("button", {
        id: ids.siegeBottomBarButton,
        class: "siegeBottomBarButton",
        html: "Assault!",
    });
    const row5 = el("div", { id: ids.battleUIRow5, class: ["battleUIRow", "battleUIRow5"] }, [
        retreatButton,
        advanceButton,
        assaultButton,
    ]);

    root = el("div", { class: ["battleContainer", "blur-background"] }, [row1, row2, row3, row4, row5]);
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

/** The buttons, for the handlers that still live in ui.js. */
export function buttons() {
    if (!parts) return null;
    const { retreatButton, advanceButton, assaultButton, siegeButton } = parts;
    return { retreat: retreatButton, advance: advanceButton, assault: assaultButton, siege: siegeButton };
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
