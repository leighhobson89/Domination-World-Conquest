// The battle results screen: who fought, what each side lost, what survived,
// and the one button that reads "Accept Victory!" or "Accept Defeat!".
//
// Refactor Phase 6.3. Two hundred and seventy lines of `createElement`, of
// which about two hundred were the same four statements repeated for
// `battleResultsRow2Row1Icon1` through `Icon8`, `...Row2Quantity1` through `8`
// and `...Row1Quantity1` through `8`. Twenty-four elements that differ only by
// index and, for the icons, by which unit picture they carry.
//
// Three loops replace them, driven by `UNIT_ICONS`. The eight columns are the
// attacker's four unit types followed by the defender's four, which is why the
// icon list is the same four images twice and why column 5 -- the first
// defender column -- is the one that carries `battleResultsRowDivider`.

import { ids, indexedIds } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

/** Attacker infantry/assault/air/naval, then the defender's four. */
const UNIT_ICONS = [
    "infantry",
    "assault",
    "air",
    "naval",
    "infantry",
    "assault",
    "air",
    "naval",
];

/** The column where the defender's half of every row starts. */
const DIVIDER_COLUMN = 5;

let root = null;
let parts = null;

function unitIcon(name) {
    return `<img class='sizingPositionArmyIconsBattleUI' src='./resources/${name}.png'>`;
}

/** One eight-cell row, built from an id function and a class. */
function eightColumns(buildId, className, { icons = false } = {}) {
    const cells = [];
    for (let n = 1; n <= UNIT_ICONS.length; n++) {
        cells.push(
            el("div", {
                id: buildId(n),
                class: n === DIVIDER_COLUMN ? [className, "battleResultsRowDivider"] : className,
                html: icons ? unitIcon(UNIT_ICONS[n - 1]) : undefined,
            })
        );
    }
    return cells;
}

export function create() {
    if (root) return root;

    // Row 1 -- the two flags and the three-part title.
    const flagLeft = el("div", {
        id: ids.battleResultsRow1FlagCol1,
        class: "battleResultsRow1FlagCol1",
    });
    const titleLeft = el("div", {
        id: ids.battleResultsTitleTitleLeft,
        class: "battleResultsTitleTitleLeft",
    });
    const titleCenter = el("div", {
        id: ids.battleResultsTitleTitleCenter,
        class: "battleResultsTitleTitleCenter",
    });
    const titleRight = el("div", {
        id: ids.battleResultsTitleTitleRight,
        class: "battleResultsTitleTitleRight",
    });
    const flagRight = el("div", {
        id: ids.battleResultsRow1FlagCol2,
        class: "battleResultsRow1FlagCol2",
    });
    const row1 = el("div", { id: ids.battleResultsRow1, class: ["battleResultsRow", "battleResultsRow1"] }, [
        flagLeft,
        el("div", { id: ids.battleResultsTitleTitleCol, class: "battleResultsTitleTitleCol" }, [
            titleLeft,
            titleCenter,
            titleRight,
        ]),
        flagRight,
    ]);

    // Row 2 -- unit icons, what each side lost, and the Losses / Kills labels.
    const lossesLabel = el("div", {
        id: ids.battleResultsRow2Row3Losses,
        class: "battleResultsRow2Row3Column",
        html: "Losses",
    });
    const killsLabel = el("div", {
        id: ids.battleResultsRow2Row3Kills,
        class: ["battleResultsRow2Row3Column", "battleResultsRowDivider"],
        html: "Kills",
    });
    const row2 = el("div", { id: ids.battleResultsRow2, class: ["battleResultsRow", "battleResultsRow2"] }, [
        el(
            "div",
            { id: ids.battleResultsRow2Row1, class: "battleResultsRow2Row1" },
            eightColumns(indexedIds.battleResultsIcon, "battleResultsRow2Row1Icon", { icons: true })
        ),
        el(
            "div",
            { id: ids.battleResultsRow2Row2, class: "battleResultsRow2Row2" },
            eightColumns(indexedIds.battleResultsLostQuantity, "battleResultsRow2Row2Quantity")
        ),
        el("div", { id: ids.battleResultsRow2Row3, class: "battleResultsRow2Row3" }, [
            lossesLabel,
            killsLabel,
        ]),
    ]);

    // Row 3 -- what remains, the Survived / Captured labels, and the counters.
    const survivedLabel = el("div", {
        id: ids.battleResultsRow3Row2Survived,
        class: "battleResultsRow3Row2Column",
        html: "Survived",
    });
    const capturedLabel = el("div", {
        id: ids.battleResultsRow3Row2Captured,
        class: ["battleResultsRow3Row2Column", "battleResultsRowDivider"],
        html: "Captured",
    });
    const roundsCount = el("div", {
        id: ids.battleResultsRow3Row3RoundsCount,
        class: "battleResultsRow3Row3Column",
    });
    const siegeStats = el("div", {
        id: ids.battleResultsRow3Row3SiegeStats,
        class: ["battleResultsRow3Row3ColumnSiege", "battleResultsRowDivider"],
        html: "Sieged: ",
    });
    const row3 = el("div", { id: ids.battleResultsRow3, class: ["battleResultsRow", "battleResultsRow3"] }, [
        el(
            "div",
            { id: ids.battleResultsRow3Row1, class: "battleResultsRow3Row1" },
            eightColumns(indexedIds.battleResultsRemainingQuantity, "battleResultsRow3Row1Quantity")
        ),
        el("div", { id: ids.battleResultsRow3Row2, class: "battleResultsRow3Row2" }, [
            survivedLabel,
            capturedLabel,
        ]),
        el("div", { id: ids.battleResultsRow3Row3, class: "battleResultsRow3Row3" }, [
            roundsCount,
            siegeStats,
        ]),
    ]);

    // Row 4 is the confirm button. Its listener is installed by ui.js, which is
    // what knows whether accepting means a victory or a defeat.
    const confirm = el("button", {
        id: ids.battleResultsRow4,
        class: ["battleResultsRow", "battleResultsRow4"],
    });

    root = el("div", { class: "blur-background" }, [row1, row2, row3, confirm]);
    parts = { flagLeft, flagRight, titleLeft, titleCenter, titleRight, confirm, roundsCount, siegeStats };

    mount(ids.battleResultsContainer, root);
    return root;
}

function container() {
    return document.getElementById(ids.battleResultsContainer);
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

/** The confirm button, so ui.js can install its own hover and click handling. */
export function confirmButton() {
    return parts?.confirm ?? document.getElementById(ids.battleResultsRow4);
}

export function elements() {
    return parts;
}

export function destroy() {
    root?.remove();
    root = null;
    parts = null;
}

export const battleResults = {
    create,
    show,
    hide,
    isVisible,
    confirmButton,
    elements,
    destroy,
};
