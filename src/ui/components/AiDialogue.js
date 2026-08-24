// The AI negotiation panel: two flags, a heading, two columns of four rows,
// an eight-column summary strip, and three response buttons.
//
// Refactor Phase 6.3. Nearly two hundred lines of `createElement` in the
// `DOMContentLoaded` block, and every element in it exists purely so that
// `populateAiDialogueBox()` in ui.js and the AI's own code in
// aiCalculations.js can find it again by id. Nothing here is state -- what the
// panel says is decided when a proposal is made, so this is `create()` /
// `destroy()` plus setters, with no `state/events.js` subscription.
//
// The three response buttons are the only interactive part, and they all do
// the same thing with a different number: 0 accept, 1 refuse, 9 accept for
// every remaining row. The caller supplies the handler.

import { ids, indexedIds } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

/** How many rows each body column has, and how many summary columns there are. */
const BODY_ROWS = 4;
const SUMMARY_COLUMNS = 8;

let root = null;
let parts = null;

function bodyColumn(side) {
    const large = el("div", {
        id: side === "left" ? ids.aiDialogueBodyBottomContentLeftLarge : ids.aiDialogueBodyBottomContentRightLarge,
        class: "aiDialogueBodyBottomContentLarge",
    });
    const build = side === "left" ? indexedIds.aiDialogueLeftRow : indexedIds.aiDialogueRightRow;
    const rowClass =
        side === "left" ? "aiDialogueBodyBottomContentLeftRow" : "aiDialogueBodyBottomContentRightRow";

    const rows = [];
    for (let n = 1; n <= BODY_ROWS; n++) {
        rows.push(el("div", { id: build(n), class: rowClass }));
    }

    const column = el(
        "div",
        {
            id: side === "left" ? ids.aiDialogueBodyBottomContentLeft : ids.aiDialogueBodyBottomContentRight,
            class: side === "left" ? "aiDialogueBodyBottomContentLeft" : "aiDialogueBodyBottomContentRight",
        },
        [large, ...rows]
    );
    return { column, large, rows };
}

/**
 * The eight-cell summary strip. Odd columns are icons and even ones are text,
 * which is why the classes alternate.
 */
function summaryRow() {
    const columns = [];
    for (let n = 1; n <= SUMMARY_COLUMNS; n++) {
        columns.push(
            el("div", {
                id: indexedIds.aiDialogueSummaryColumn(n),
                class: n % 2 === 1 ? "aiDialogueBoxBottomSummaryRowColImg" : "aiDialogueBoxBottomSummaryRowColTxt",
            })
        );
    }
    const row = el(
        "div",
        { id: ids.aiDialogueBoxBottomSummaryRow, class: "aiDialogueBoxBottomSummaryRow" },
        columns
    );
    return { row, columns };
}

/**
 * @param {object} deps
 * @param {(response: number) => void} deps.onResponse 0 accept, 1 refuse, 9 accept all
 */
export function create({ onResponse } = {}) {
    if (root) return root;

    const titleFlagLeft = el("div", {
        id: ids.aiDialogueTitleFlagCol1,
        class: "aiDialogueTitleFlagCol1",
    });
    const titleText = el("div", { id: ids.aiDialogueTitleText, class: "aiDialogueTitleText" });
    const titleFlagRight = el("div", {
        id: ids.aiDialogueTitleFlagCol2,
        class: "aiDialogueTitleFlagCol2",
    });
    const titleRow = el("div", { id: ids.aiTitleRow, class: "aiTitleRow" }, [
        titleFlagLeft,
        titleText,
        titleFlagRight,
    ]);

    const subHeading = el("div", {
        id: ids.aiDialogueBodySubHeading,
        class: "aiDialogueBodySubHeading",
    });
    const left = bodyColumn("left");
    const right = bodyColumn("right");
    const bottomContent = el(
        "div",
        { id: ids.aiDialogueBodyBottomContent, class: "aiDialogueBodyBottomContent" },
        [left.column, right.column]
    );
    const summary = summaryRow();
    const body = el("div", { id: ids.aiDialogueBody, class: "aiDialogueBody" }, [
        subHeading,
        bottomContent,
        summary.row,
    ]);

    const accept = el("div", {
        id: ids.aiButtonLeft,
        class: "aiButtonLeft",
        on: { click: () => onResponse?.(0) },
    });
    const refuse = el("div", {
        id: ids.aiButtonRight,
        class: "aiButtonRight",
        on: { click: () => onResponse?.(1) },
    });
    const acceptAll = el("div", {
        id: ids.aiButtonAllRow,
        class: "aiButtonAllRow",
        on: { click: () => onResponse?.(9) },
    });
    const buttonRow = el("div", { id: ids.aiButtonRow, class: "aiButtonRow" }, [
        accept,
        refuse,
        acceptAll,
    ]);

    root = el("div", { class: "blur-background" }, [titleRow, body, buttonRow]);
    parts = {
        titleRow,
        titleFlagLeft,
        titleText,
        titleFlagRight,
        body,
        subHeading,
        left,
        right,
        summary,
        buttonRow,
        accept,
        refuse,
        acceptAll,
    };

    mount(ids.aiDialogueContainer, root);
    return root;
}

/** The container, which is what is shown and hidden. */
function container() {
    return document.getElementById(ids.aiDialogueContainer);
}

export function show() {
    const node = container();
    if (node) node.style.display = "flex";
}

export function hide() {
    const node = container();
    if (node) node.style.display = "none";
}

export function isVisible() {
    return container()?.style.display !== "none";
}

export function setTitle(text) {
    if (parts) parts.titleText.innerHTML = text;
}

export function setSubHeading(text) {
    if (parts) parts.subHeading.innerHTML = text;
}

/** Named handles for the elements `populateAiDialogueBox()` still writes into. */
export function elements() {
    return parts;
}

export function destroy() {
    root?.remove();
    root = null;
    parts = null;
}

export const aiDialogue = {
    create,
    show,
    hide,
    isVisible,
    setTitle,
    setSubHeading,
    elements,
    destroy,
};
