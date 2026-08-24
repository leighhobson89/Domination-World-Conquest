// The main info panel: four tabs (Summary / Territories / Military / Wars &
// Sieges), a start-of-turn checkbox, a close button, and the table itself.
//
// Refactor Phase 6.3 extracts the CHROME -- the tab strip and the panel around
// the table. The table's CONTENTS are still drawn by `drawUITable()`, 920 lines
// and a sixteen-case switch in resourceCalculations.js; Phase 6.4 breaks that
// into one renderer per tab over a shared column definition. Doing both at once
// would make the rewrite unbisectable, so this component takes a `drawTable`
// callback and calls it with the tab index the player clicked.
//
// One real fix comes with the move. Before Phase 5.8 the `active` class was
// ADDED to the Summary button once, at game start, and removed only by the X --
// no tab click ever moved it. `.tab-button.active` is what style.css
// highlights, so Summary looked permanently selected however many times the
// player switched, and `mouseout` (which asks `classList.contains("active")`)
// reset the wrong button's colour. Which tab is selected is one fact, and
// `setActiveTab()` is now the only thing that writes it -- including on close,
// where all four buttons used to be cleared one statement at a time and the
// Summary button was left out of the list.

import { classNames, ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";
import { tooltip } from "./Tooltip.js";

const TAB_ACTIVE_COLOUR = "rgb(111, 151, 183)";
const TAB_IDLE_COLOUR = "rgb(81, 121, 153)";

/**
 * The four tabs, in display order. `index` is the number `drawUITable()` takes
 * as its mode, which is the only reason these are ordered rather than named.
 */
const TABS = [
    { key: "summary", id: ids.summaryButton, label: "Summary", index: 0 },
    { key: "territories", id: ids.territoryButton, label: "Territories", index: 1 },
    { key: "army", id: ids.armyButton, label: "Military", index: 2 },
    { key: "warsSieges", id: ids.warsSiegesButton, label: "Wars / Sieges", index: 3 },
];

let root = null;
let table = null;
let checkBox = null;
let tabButtons = new Map();

function paintTab(button, active) {
    button.classList.toggle(classNames.tabButtonActive, active);
    button.style.backgroundColor = active ? TAB_ACTIVE_COLOUR : TAB_IDLE_COLOUR;
}

/**
 * @param {object} deps
 * @param {(table: HTMLElement, tabIndex: number) => void} deps.drawTable
 * @param {() => void} deps.onClose
 * @param {() => void} deps.onToggleStartOfTurn
 * @param {() => void} deps.onTabClick fired before the table is drawn, for the click sound
 */
export function create({ drawTable, onClose, onToggleStartOfTurn, onTabClick } = {}) {
    if (root) return root;

    const buttons = TABS.map((tab) => {
        const button = el("button", {
            id: tab.id,
            class: classNames.tabButton,
            html: tab.label,
            on: {
                click() {
                    onTabClick?.();
                    setActiveTab(tab.key);
                    drawTable?.(table, tab.index);
                },
                mouseover() {
                    button.style.backgroundColor = TAB_ACTIVE_COLOUR;
                },
                mouseout() {
                    if (!button.classList.contains(classNames.tabButtonActive)) {
                        button.style.backgroundColor = TAB_IDLE_COLOUR;
                    }
                },
            },
        });
        tabButtons.set(tab.key, button);
        return button;
    });

    checkBox = el("button", {
        id: ids.checkBoxAppearStartOfTurn,
        class: "checkBox-appear-start-of-turn",
        html: "✔",
        on: {
            mouseover(e) {
                tooltip.moveTo(e.clientX - 40, 25 + e.clientY);
                tooltip.setContent("Check to display UI at start of turn!");
                tooltip.show();
            },
            mouseout() {
                tooltip.clear();
            },
            click() {
                onToggleStartOfTurn?.();
            },
        },
    });

    // `xButton` is a duplicated id -- the upgrade window's close button carries
    // it too. Phase 6.8 separates them; until then a bare "#xButton" selector is
    // ambiguous and everything scopes it to a container.
    const closeButton = el("button", {
        id: ids.xButton,
        class: "x-button",
        html: "X",
        on: {
            click() {
                onClose?.();
                clearActiveTab();
                if (table) table.style.display = "none";
            },
        },
    });

    table = el("div", { id: ids.uiTable, class: "ui-table" });

    const infoPanel = el("div", { id: ids.infoPanel, class: classNames.infoPanel }, [
        // `info-panel::before` is a class name, not a pseudo-element. It has
        // been one since the panel was written; renaming it is Phase 6.8's job.
        el("div", { id: ids.beforeInfoPanel, class: "info-panel::before" }),
        table,
    ]);

    root = el("div", { class: "blur-background" }, [
        el("div", { id: ids.tabButtons, class: "tab-buttons" }, [...buttons, checkBox, closeButton]),
        el("div", { id: ids.contentWindow, class: "content-window" }, [
            infoPanel,
            el("div", { id: ids.selectionPanel, class: "selection-panel" }),
        ]),
    ]);

    mount(ids.mainUiContainer, root);
    return root;
}

/** Mark one tab selected and every other one not. */
export function setActiveTab(key) {
    for (const [name, button] of tabButtons) paintTab(button, name === key);
}

/** No tab selected -- what closing the panel leaves behind. */
export function clearActiveTab() {
    for (const button of tabButtons.values()) paintTab(button, false);
}

/** The key of the selected tab, or null. Mirrors what the e2e suite reads. */
export function activeTab() {
    for (const [name, button] of tabButtons) {
        if (button.classList.contains(classNames.tabButtonActive)) return name;
    }
    return null;
}

/** The table element, which `drawUITable()` renders into. */
export function tableElement() {
    return table ?? document.getElementById(ids.uiTable);
}

export function checkBoxElement() {
    return checkBox;
}

export function destroy() {
    root?.remove();
    root = null;
    table = null;
    checkBox = null;
    tabButtons = new Map();
}

export const infoTable = {
    create,
    setActiveTab,
    clearActiveTab,
    activeTab,
    tableElement,
    checkBoxElement,
    destroy,
};
