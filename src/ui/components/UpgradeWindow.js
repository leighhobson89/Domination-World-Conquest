// Upgrade Territory: farms, forests, oil wells and forts.
//
// Refactor Phase 6.3. The window is a `ResourceWindow` -- see that file for why
// this one has no DOM construction in it. What is here is the spec: which ids,
// which class names, which icons, and what the two buttons do.
//
// The rows themselves are drawn by `calculateAvailableUpgrades()` in
// resourceCalculations.js, which Phase 6.5's shared `ArmyAllocationRow` will
// pull together with the buy window's near-identical row builder.

import { ids } from "../core/registry.js";
import { buildResourceWindow, windowVisibility } from "./ResourceWindow.js";

const SPEC = {
    container: ids.upgradeContainer,
    title: "Upgrade Territory",
    ids: {
        navBar: ids.navbarUpgradeWindow,
        subtitle: ids.subtitleUpgradeWindow,
        keyBar: ids.keyBarUpgradeWindow,
        // DUPLICATED id: the info panel's close button carries `xButton` too.
        close: ids.xButton,
        contentWindow: ids.contentWindowUpgrade,
        beforeInfoPanel: ids.beforeInfoPanelUpgradeWindow,
        infoPanel: ids.infoPanelUpgrade,
        table: ids.upgradeTable,
        bottomBar: ids.bottomBarUpgradeWindow,
        priceWindow: ids.pricesInfoWindow,
        priceColumn0: ids.pricesInfoColumn0,
        priceColumn1: ids.pricesInfoColumn1,
        totalFirst: ids.pricesInfoColumn2,
        priceColumn3: ids.pricesInfoColumn3,
        totalSecond: ids.pricesInfoColumn4,
        confirm: ids.bottomBarConfirmButton,
    },
    classes: {
        navBar: "navbar-upgrade-window",
        navLeft: "left-column",
        navCentre: "center-column",
        navRight: "right-column",
        subtitle: "subtitle-upgrade-window",
        keyBar: "key-bar-upgrade-window",
        keyColumn0: "key-bar-column0",
        keyColumn1: "key-bar-column1",
        keyColumn2: "key-bar-column2",
        keyColumn3: "key-bar-column3",
        keyColumn4: "key-bar-column4",
        keyColumn5: "key-bar-column5",
        closeButton: "x-button",
        contentWindow: "content-window-upgrade",
        beforeInfoPanel: "info-panel-upgrade::before",
        infoPanel: "info-panel-upgrade",
        table: "upgrade-table",
        bottomBar: "bottom-bar-upgrade-window",
        priceWindow: "prices-info-window",
        priceColumn: "prices-info-column",
        priceCol0Padding: "prices-info-col0-padding",
        priceIconJustification: "prices-info-icon-justification",
        priceTotalJustification: "prices-info-total-justification",
        confirmButton: "bottom-bar-confirm-button",
    },
    keyBarIcons: [
        { src: "resources/gold.png", alt: "Gold" },
        { src: "resources/consMats.png", alt: "Construction Materials" },
        { src: "resources/upgrade.png", alt: "Upgrade" },
    ],
    priceIcons: [
        { src: "resources/gold.png", alt: "Gold" },
        { src: "resources/consMats.png", alt: "Construction Materials" },
    ],
};

let parts = null;
const visibility = windowVisibility(ids.upgradeContainer);

export function create(handlers) {
    if (parts) return parts;
    parts = buildResourceWindow(SPEC, handlers);
    return parts;
}

export function tableElement() {
    return parts?.table ?? document.getElementById(ids.upgradeTable);
}

export function confirmButton() {
    return parts?.confirmButton ?? document.getElementById(ids.bottomBarConfirmButton);
}

export function elements() {
    return parts;
}

export function destroy() {
    parts?.root.remove();
    parts = null;
}

export const upgradeWindow = {
    create,
    tableElement,
    confirmButton,
    elements,
    destroy,
    show: visibility.show,
    hide: visibility.hide,
    isVisible: visibility.isVisible,
};
