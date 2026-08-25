// Buy Military: infantry, assault, air and naval.
//
// Refactor Phase 6.3. Structurally identical to `UpgradeWindow` -- both are a
// `ResourceWindow` -- and this file is the difference between them: a
// `buy` class prefix, its own ids, "Buy Military" instead of "Upgrade
// Territory", and productive population where the upgrade window shows
// construction materials.
//
// The close buttons were the one genuine asymmetry: this one has always carried
// `xButtonBuy`, while the upgrade window's shared a single `xButton` with the info
// panel. Phase 6.8 gave those two `xButtonUpgrade` and `xButtonInfoPanel`, so all
// three are unique and named for what they close.

import { ids } from "../core/registry.js";
import { buildResourceWindow, windowVisibility } from "./ResourceWindow.js";

const SPEC = {
    container: ids.buyContainer,
    title: "Buy Military",
    ids: {
        navBar: ids.navbarBuyWindow,
        subtitle: ids.subtitleBuyWindow,
        keyBar: ids.keyBarBuyWindow,
        close: ids.xButtonBuy,
        contentWindow: ids.contentWindowBuy,
        beforeInfoPanel: ids.beforeInfoPanelBuyWindow,
        infoPanel: ids.infoPanelBuy,
        table: ids.buyTable,
        bottomBar: ids.bottomBarBuyWindow,
        priceWindow: ids.pricesBuyInfoWindow,
        priceColumn0: ids.pricesBuyInfoColumn0,
        priceColumn1: ids.pricesBuyInfoColumn1,
        totalFirst: ids.pricesBuyInfoColumn2,
        priceColumn3: ids.pricesBuyInfoColumn3,
        totalSecond: ids.pricesBuyInfoColumn4,
        confirm: ids.bottomBarBuyConfirmButton,
    },
    classes: {
        navBar: "navbar-buy-window",
        navLeft: "left-column-buy",
        navCentre: "center-column-buy",
        navRight: "right-column-buy",
        subtitle: "subtitle-buy-window",
        keyBar: "key-bar-buy-window",
        keyColumn0: "key-bar-buy-column0",
        keyColumn1: "key-bar-buy-column1",
        keyColumn2: "key-bar-buy-column2",
        keyColumn3: "key-bar-buy-column3",
        keyColumn4: "key-bar-buy-column4",
        keyColumn5: "key-bar-buy-column5",
        closeButton: "x-button-buy",
        contentWindow: "content-window-buy",
        beforeInfoPanel: "info-panel-buy::before",
        infoPanel: "info-panel-buy",
        table: "buy-table",
        bottomBar: "bottom-bar-buy-window",
        priceWindow: "prices-buy-info-window",
        priceColumn: "prices-buy-info-column",
        priceCol0Padding: "prices-buy-info-col0-padding",
        priceIconJustification: "prices-buy-info-icon-justification",
        priceTotalJustification: "prices-buy-info-total-justification",
        confirmButton: "bottom-bar-buy-confirm-button",
    },
    keyBarIcons: [
        { src: "resources/gold.png", alt: "Gold" },
        { src: "resources/prodPopulation.png", alt: "Productive Population" },
        { src: "resources/buy.png", alt: "Buy" },
    ],
    priceIcons: [
        { src: "resources/gold.png", alt: "Gold" },
        { src: "resources/prodPopulation.png", alt: "Productive Population" },
    ],
};

let parts = null;
const visibility = windowVisibility(ids.buyContainer);

export function create(handlers) {
    if (parts) return parts;
    parts = buildResourceWindow(SPEC, handlers);
    return parts;
}

export function tableElement() {
    return parts?.table ?? document.getElementById(ids.buyTable);
}

export function confirmButton() {
    return parts?.confirmButton ?? document.getElementById(ids.bottomBarBuyConfirmButton);
}

export function elements() {
    return parts;
}

export function destroy() {
    parts?.root.remove();
    parts = null;
}

export const buyWindow = {
    create,
    tableElement,
    confirmButton,
    elements,
    destroy,
    show: visibility.show,
    hide: visibility.hide,
    isVisible: visibility.isVisible,
};
