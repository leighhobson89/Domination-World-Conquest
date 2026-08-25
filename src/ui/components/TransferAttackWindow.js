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
import { bringToFront, makeDraggable } from "../core/draggable.js";

let root = null;
let parts = null;
let undrag = null;

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
    //A real `<button>`, and Phase 7.4 is what forced the issue. It was a `<div>`
    //with a click listener, which every stylesheet rule and every spec was happy
    //with -- until the window became draggable and `makeDraggable()` had to decide
    //whether a pointerdown on this element was a grip or a control. It excludes
    //`button, input, select, textarea, a`; a `<div>` is none of those, so taking
    //hold of the X started a drag, and a drag cancels the click that would have
    //closed the window and cleared the attack marker.
    const closeButton = el("button", {
        id: ids.xButtonTransferAttack,
        class: "x-button-transfer-attack",
        html: "X",
        attrs: { type: "button", "aria-label": "Close" },
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
    //Phase 7.4. The two-row title is the grip. Note what the drag deliberately does
    //NOT touch: this container is centred by `transform: translate(-50%, -50%)` and
    //BOTH `.title-transfer-attack-window` and `.content-transfer-header-row` are
    //`position: fixed` inside it -- a fixed child is positioned against the nearest
    //transformed ancestor, so removing that transform to make the drag arithmetic
    //simpler would fling this window's own header into the corner of the screen.
    //`makeDraggable()` shifts the computed `left`/`top` and leaves the transform be.
    undrag = makeDraggable(container(), title);
    return root;
}

function container() {
    return document.getElementById(ids.transferAttackWindowContainer);
}

export function show() {
    const node = container();
    if (!node) return;
    node.style.display = "block";
    //Opening is focusing -- see the note in `ResourceWindow.js`. This window is
    //raised from the move button rather than from inside another window, but it is
    //in the same stacking group and the same rule applies.
    bringToFront(node);
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
    undrag?.();
    undrag = null;
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
