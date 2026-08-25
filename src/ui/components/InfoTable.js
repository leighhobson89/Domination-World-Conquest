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
import { makeDraggable } from "../core/draggable.js";
import { repeatPanelIcon } from "../icons.js";
import { tooltip } from "./Tooltip.js";

//Phase 7.11. `TAB_ACTIVE_COLOUR` and `TAB_IDLE_COLOUR` stood here -- two literal
//`rgb()` strings written inline onto the element on click, on mouseover and on
//mouseout. Three problems, and they are the reason the whole pair is gone. An
//inline write beats the stylesheet on specificity, so no theme could ever reach
//a tab; `mouseover` / `mouseout` were hand-rolling `:hover`, which CSS does
//without a listener and without getting it wrong when the pointer leaves the
//window; and `mouseout` asked whether the button was active in order to decide
//which literal to restore, so the selected tab's appearance was computed in two
//places. The `active` class is the whole state now and `style.css` reads it.

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
let titleBar = null;
let undrag = null;
let tabButtons = new Map();

function paintTab(button, active) {
    button.classList.toggle(classNames.tabButtonActive, active);
    button.setAttribute("aria-selected", active ? "true" : "false");
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
            attrs: { type: "button", role: "tab", "aria-selected": "false" },
            on: {
                click() {
                    onTabClick?.();
                    setActiveTab(tab.key);
                    drawTable?.(table, tab.index);
                },
            },
        });
        tabButtons.set(tab.key, button);
        return button;
    });

    //The control used to be a bare "✔" written into `innerHTML`, and it carried its
    //own state that way: a tick meant on, an empty button meant off. Two problems
    //with that. A tick says "yes" and nothing else -- sitting in a row of four tab
    //buttons it reads as a fifth tab or as a confirm, not as "open this panel again
    //next turn" -- and an EMPTY button is not a control that is switched off, it is
    //a control that failed to render. The icon says recurrence (a panel with a
    //repeat arrow round it), it is always drawn, and whether the option is on is a
    //class. The tooltip that explains it is unchanged.
    checkBox = el("button", {
        id: ids.checkBoxAppearStartOfTurn,
        class: ["checkBox-appear-start-of-turn", "is-on"],
        attrs: { type: "button", "aria-pressed": "true" },
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
    }, repeatPanelIcon());

    const closeButton = el("button", {
        id: ids.xButtonInfoPanel,
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

    //Phase 7.4. A title bar above the tab strip, and the reason it exists is that
    //the window is draggable now: the tabs cannot be the grip, because every pixel
    //of that strip is already a control. It is also the one thing this panel never
    //had -- four tabs and a close button, with nothing saying what the window IS.
    titleBar = el("div", { id: ids.mainUiTitleBar, class: classNames.windowTitleBar }, [
        el("span", { class: classNames.windowTitleText, text: "Empire Overview" }),
    ]);

    root = el("div", { class: "blur-background" }, [
        titleBar,
        el("div", { id: ids.tabButtons, class: "tab-buttons" }, [...buttons, checkBox, closeButton]),
        el("div", { id: ids.contentWindow, class: "content-window" }, [
            infoPanel,
            el("div", { id: ids.selectionPanel, class: "selection-panel" }),
        ]),
    ]);

    mount(ids.mainUiContainer, root);
    //The CONTAINER moves, not the blur-background inside it: the container is what
    //carries `position: fixed` and the stylesheet's placement.
    undrag = makeDraggable(document.getElementById(ids.mainUiContainer), titleBar);
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

/**
 * Whether the panel opens itself at the start of each turn.
 *
 * The component owns how that reads, which is the point of moving it here: the
 * caller says what is true and does not have to know that the answer is a class
 * on a button rather than a character in its `innerHTML`.
 */
export function setAppearAtStartOfTurn(enabled) {
    if (!checkBox) return;
    checkBox.classList.toggle("is-on", Boolean(enabled));
    checkBox.setAttribute("aria-pressed", enabled ? "true" : "false");
}

export function destroy() {
    undrag?.();
    undrag = null;
    root?.remove();
    root = null;
    table = null;
    checkBox = null;
    titleBar = null;
    tabButtons = new Map();
}

export const infoTable = {
    create,
    setActiveTab,
    clearActiveTab,
    activeTab,
    tableElement,
    checkBoxElement,
    setAppearAtStartOfTurn,
    destroy,
};
