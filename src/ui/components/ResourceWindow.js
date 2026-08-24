// The shell shared by the Upgrade Territory and Buy Military windows.
//
// Refactor Phase 6.3. These two windows were built by two blocks of 190 lines
// in the `DOMContentLoaded` handler that differ only in their class-name
// prefixes, their ids, their title, and which three icons sit in the key bar.
// Every structural decision -- nav bar with the close button in its right
// column, subtitle, six-column key bar, content window wrapping an info panel,
// a `::before` element inserted at the front of that panel, a table, a bottom
// bar with a five-column price strip and a confirm button -- was written out
// twice, and a change to the layout of one had to be remembered for the other.
//
// It is one builder now, driven by a spec. `UpgradeWindow.js` and
// `BuyWindow.js` are the specs; neither contains any DOM construction.
//
// Note `info-panel-upgrade::before` and `info-panel-buy::before` are CLASS
// names containing two colons, not pseudo-element selectors. They have been
// since the windows were written, and renaming them is Phase 6.8's job.

import { el, mount } from "../core/dom.js";

/**
 * @typedef {object} ResourceWindowSpec
 * @property {string} container            id of the host <div> in index.html
 * @property {string} title                the nav bar's centre text
 * @property {object} ids                  every element id this window uses
 * @property {object} classes              every class name this window uses
 * @property {{src: string, alt: string}[]} keyBarIcons three icons, left to right
 * @property {{src: string, alt: string}[]} priceIcons  two icons in the price strip
 */

/** One key-bar or price-strip icon cell. */
function icon({ src, alt }) {
    return el("img", { src, alt, class: "sizingIcons" });
}

/**
 * Build the window and mount it.
 *
 * @param {ResourceWindowSpec} spec
 * @param {object} handlers
 * @param {() => void} handlers.onClose   the X in the nav bar
 * @param {() => void} handlers.onConfirm the bottom bar button, whichever it reads
 * @returns {object} the named elements the callers still write into
 */
export function buildResourceWindow(spec, { onClose, onConfirm } = {}) {
    const { ids: id, classes: cls } = spec;

    const closeButton = el("button", {
        id: id.close,
        class: cls.closeButton,
        html: "X",
        on: { click: onClose },
    });

    const navBar = el("div", { id: id.navBar, class: cls.navBar }, [
        el("div", { class: cls.navLeft, html: "" }),
        el("div", { class: cls.navCentre, html: spec.title }),
        el("div", { class: cls.navRight, html: "" }, closeButton),
    ]);

    const subtitle = el("div", { id: id.subtitle, class: cls.subtitle });

    const keyBar = el("div", { id: id.keyBar, class: cls.keyBar }, [
        el("div", { class: cls.keyColumn0, html: "" }),
        el("div", { class: cls.keyColumn1, html: "Type" }),
        el("div", { class: cls.keyColumn2, html: "Effect" }),
        el("div", { class: cls.keyColumn3 }, icon(spec.keyBarIcons[0])),
        el("div", { class: cls.keyColumn4 }, icon(spec.keyBarIcons[1])),
        el("div", { class: cls.keyColumn5 }, icon(spec.keyBarIcons[2])),
    ]);

    // The two running totals, which the price calculations write into.
    const totalFirst = el("div", {
        id: id.totalFirst,
        class: [cls.priceColumn, cls.priceTotalJustification],
        html: "0",
    });
    const totalSecond = el("div", {
        id: id.totalSecond,
        class: [cls.priceColumn, cls.priceTotalJustification],
        html: "0",
    });

    const priceStrip = el("div", { id: id.priceWindow, class: cls.priceWindow }, [
        el("div", {
            id: id.priceColumn0,
            class: [cls.priceColumn, cls.priceCol0Padding],
            html: "Total:",
        }),
        el(
            "div",
            { id: id.priceColumn1, class: [cls.priceColumn, cls.priceIconJustification] },
            icon(spec.priceIcons[0])
        ),
        totalFirst,
        el(
            "div",
            { id: id.priceColumn3, class: [cls.priceColumn, cls.priceIconJustification] },
            icon(spec.priceIcons[1])
        ),
        totalSecond,
    ]);

    // The button reads "Cancel" until the player has chosen something, at which
    // point the price calculation relabels it "Confirm". One listener, and it
    // asks the label what it means -- which is how it worked before, and is a
    // Phase 6.6-shaped problem rather than a 6.3 one.
    const confirmButton = el("button", {
        id: id.confirm,
        class: cls.confirmButton,
        html: "Cancel",
        on: { click: onConfirm },
    });

    const bottomBar = el("div", { id: id.bottomBar, class: cls.bottomBar }, [
        priceStrip,
        confirmButton,
    ]);

    const table = el("div", { id: id.table, class: cls.table });
    const before = el("div", { id: id.beforeInfoPanel, class: cls.beforeInfoPanel });
    const infoPanel = el("div", { id: id.infoPanel, class: cls.infoPanel }, [
        before,
        table,
        bottomBar,
    ]);

    const root = el("div", { class: "blur-background" }, [
        navBar,
        subtitle,
        keyBar,
        el("div", { id: id.contentWindow, class: cls.contentWindow }, infoPanel),
    ]);

    mount(spec.container, root);

    return {
        root,
        navBar,
        subtitle,
        keyBar,
        contentWindow: root.lastChild,
        infoPanel,
        table,
        bottomBar,
        priceStrip,
        totalFirst,
        totalSecond,
        confirmButton,
        closeButton,
    };
}

/** Show / hide helpers, shared by both windows. */
export function windowVisibility(containerId) {
    const container = () => document.getElementById(containerId);
    return {
        show() {
            const node = container();
            if (node) node.style.display = "block";
        },
        hide() {
            const node = container();
            if (node) node.style.display = "none";
        },
        isVisible() {
            return container()?.style.display !== "none";
        },
    };
}
