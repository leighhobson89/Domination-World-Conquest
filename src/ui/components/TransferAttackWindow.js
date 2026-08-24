// The window that opens on TRANSFER or ATTACK: a two-row title, a probability
// bar built from a red underlay and a green overlay, a header strip of four
// unit icons, and the allocation table.
//
// Refactor Phase 6.3 extracts the SHELL. The table inside it is drawn by
// `drawAndHandleTransferAttackTable()` in transferAndAttack.js -- 710 lines
// serving two modes off one renderer -- which Phase 6.5 splits into
// `TransferTable` and `AttackTable` over a shared `ArmyAllocationRow`.
//
// Two things in here are worth knowing:
//
//   * `title-transfer-window-title-row` is used as the id of BOTH title rows.
//     That is a duplicated id in the live document and it has been since the
//     window was written. It is preserved rather than fixed, because fixing it
//     is a rename and renames belong to Phase 6.8 where the registry makes them
//     a one-file change. It is recorded here so it is not mistaken for a typo.
//
//   * The probability bar is two absolutely-positioned bars, not one element
//     with a width. `setAttackProbabilityOnUI()` sizes the green one over the
//     red; that is why both exist and why the order they are appended matters.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

let root = null;
let parts = null;

export function create({ onClose } = {}) {
    if (root) return root;

    const underlayRed = el("div", {
        id: ids.colorBarAttackUnderlayRed,
        class: "color-bar-attack-underlay-red",
    });
    const overlayGreen = el("div", {
        id: ids.colorBarAttackOverlayGreen,
        class: "color-bar-attack-overlay-green",
    });

    const heading = el("div", { id: ids.attackOrTransferString, class: "attackOrTransferHeading" });
    const territoryText = el("div", { id: ids.territoryTextString, class: "territoryText" });
    const closeButton = el("div", {
        id: ids.xButtonTransferAttack,
        class: "x-button-transfer-attack",
        html: "X",
        on: { click: onClose },
    });

    const fromHeading = el("div", { id: ids.fromHeadingString, class: "fromHeading" });
    const fromTerritoryText = el("div", {
        id: ids.attackingFromTerritoryTextString,
        class: "attackingFromTerritoryTextString",
    });
    const percentage = el("div", {
        id: ids.percentageAttack,
        class: "percentage-attack",
        html: "0 %",
    });

    // Both rows carry the same id. See the note at the top of the file.
    const titleRow1 = el(
        "div",
        { id: ids.titleTransferWindowTitleRow, class: "title-transfer-window-title-row" },
        [heading, territoryText, closeButton]
    );
    const titleRow2 = el(
        "div",
        { id: ids.titleTransferWindowTitleRow, class: "title-transfer-window-title-row" },
        [fromHeading, fromTerritoryText, percentage]
    );
    const title = el(
        "div",
        { id: ids.titleTransferAttackWindow, class: "title-transfer-attack-window" },
        [titleRow1, titleRow2]
    );

    const headerImageColumns = [
        ids.contentTransferHeaderImageColumn1,
        ids.contentTransferHeaderImageColumn2,
        ids.contentTransferHeaderImageColumn3,
        ids.contentTransferHeaderImageColumn4,
    ].map((id) => el("div", { id, class: "content-transfer-header-image-column" }));

    const headerRow = el(
        "div",
        { id: ids.contentTransferHeaderRow, class: "content-transfer-header-row" },
        [
            el("div", {
                id: ids.contentTransferHeaderColumn1,
                class: "content-transfer-header-column",
            }),
            el(
                "div",
                { id: ids.contentTransferHeaderColumn2, class: "content-transfer-header-column" },
                headerImageColumns
            ),
        ]
    );

    const table = el("div", { id: ids.transferTable, class: "transfer-table" });
    const content = el(
        "div",
        { id: ids.contentTransferAttackWindow, class: "content-transfer-attack-window" },
        el("div", { id: ids.transferTableContainer, class: "transfer-table-container" }, table)
    );

    root = el("div", { class: "blur-background" }, [
        underlayRed,
        overlayGreen,
        title,
        headerRow,
        content,
    ]);

    parts = {
        underlayRed,
        overlayGreen,
        heading,
        territoryText,
        fromHeading,
        fromTerritoryText,
        percentage,
        closeButton,
        headerRow,
        headerImageColumns,
        table,
    };

    mount(ids.transferAttackWindowContainer, root);
    return root;
}

function container() {
    return document.getElementById(ids.transferAttackWindowContainer);
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

export function tableElement() {
    return parts?.table ?? document.getElementById(ids.transferTable);
}

export function elements() {
    return parts;
}

export function destroy() {
    root?.remove();
    root = null;
    parts = null;
}

export const transferAttackWindow = {
    create,
    show,
    hide,
    isVisible,
    tableElement,
    elements,
    destroy,
};
