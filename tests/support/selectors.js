// The e2e suite's view of the selector inventory.
//
// Phase 6.1: this file no longer HOLDS any selector. Every string below is
// derived from `src/ui/core/registry.js`, which is the same module the
// application imports when it creates the elements. Rename an id there and both
// ends move together; get one wrong and this file throws on import, which fails
// the whole run loudly instead of one spec flakily three days later.
//
// What stays here is the suite's own knowledge -- column indices, phase labels,
// row orderings -- because those are facts about the assertions, not about the
// DOM. See docs/04-e2e-test-plan.md section 7.

import {
    cls,
    compound,
    dynamicIds,
    ids as registryIds,
    indexedIds,
    moveButtonClass,
    sel,
    territorySelectors,
} from "../../src/ui/core/registry.js";

/** Re-exported so a spec can reach anything the registry knows without a second import. */
export { registryIds as ids, sel, cls, compound, indexedIds, dynamicIds, territorySelectors };

/** Containers, in the order they appear in index.html. */
export const containers = {
    menu: sel.menuContainer,
    popupWithConfirm: sel.popupWithConfirmContainer,
    topTable: sel.topTableContainer,
    bottomTable: sel.bottomTableContainer,
    mainUi: sel.mainUiContainer,
    upgrade: sel.upgradeContainer,
    buy: sel.buyContainer,
    transferAttack: sel.transferAttackWindowContainer,
    battle: sel.battleContainer,
    battleResults: sel.battleResultsContainer,
    aiDialogue: sel.aiDialogueContainer,
    attackDestination: sel.attackDestinationContainers,
    movePhaseButtons: sel.movePhaseButtonsContainer,
    uiButton: sel.uiButtonContainer,
    mapMode: sel.mapModeContainer,
    tooltip: sel.tooltip,
};

export const menu = {
    resume: sel.resumeGameBtn,
    newGame: sel.newGameBtn,
    saveLoad: sel.saveLoadBtn,
    toggleMusic: sel.toggleMusicBtn,
    options: sel.optionsBtn,
    help: sel.helpBtn,
    /** The hamburger over the map. The same door as Escape (Phase 7.2). */
    hamburger: sel.menuButton,
};

/** The reusable yes/no modal. New Game and a load over a live game both ask here. */
export const confirmDialog = {
    container: sel.confirmDialogContainer,
    panel: sel.confirmDialog,
    title: sel.confirmDialogTitle,
    message: sel.confirmDialogMessage,
    confirm: sel.confirmDialogConfirm,
    cancel: sel.confirmDialogCancel,
};

/** Save / Load: the whole game as a string, in and out (Phase 7.3). */
export const saveLoad = {
    container: sel.saveLoadContainer,
    panel: sel.saveLoadPanel,
    saveField: sel.saveCodeField,
    refresh: sel.saveCodeGenerateBtn,
    copy: sel.saveCodeCopyBtn,
    loadField: sel.loadCodeField,
    load: sel.loadCodeBtn,
    status: sel.saveLoadStatus,
    close: sel.saveLoadCloseBtn,
    /** The autosave spinner. `.is-visible` is what puts it on screen. */
    indicator: sel.saveIndicator,
};

/** The Options panel, opened from the main menu. Holds the theme picker. */
export const options = {
    container: sel.optionsContainer,
    panel: sel.optionsPanel,
    themeSelect: sel.themeSelect,
    themePreview: sel.themePreview,
    themeDescription: sel.themeDescription,
    done: sel.optionsCloseBtn,
    cancel: sel.optionsCancelBtn,
};

/** The popup that is both the country-select confirm AND the phase-advance button. */
export const phaseBar = {
    title: sel.popupTitle,
    body: sel.popupBody,
    confirm: sel.popupConfirm,
    colourLabel: sel.popupColor,
    colourPicker: sel.playerColorPicker,
};

export const map = {
    object: sel.svgMap,
    /** Chromium exposes an <object> as a frame named after the element id. */
    frameName: territorySelectors.mapFrameName,
    coastLines: sel.svgCoastLines,
    /**
     * One button, three views (Phase 7.4). Read `data-view` -- "normal",
     * "physical" or "continent" -- rather than the icon; the icons are inline SVG
     * and there is no `src` to assert on any more.
     */
    continentViewButton: sel.continentViewButton,
    uiToggleButton: sel.uiToggleButton,
    /** A territory path, addressed by its stable identity. */
    territory: territorySelectors.byName,
    /** Every path of a country -- `data-name` is the CURRENT owner, not identity. */
    country: territorySelectors.byCountry,
    byUniqueId: territorySelectors.byUniqueId,
    allTerritories: territorySelectors.all,
};

export const tables = {
    top: sel.topTable,
    bottom: sel.bottomTable,
    ui: sel.uiTable,
    buy: sel.buyTable,
    upgrade: sel.upgradeTable,
    transfer: sel.transferTable,
};

// Both tables are a single <tr> of alternating icon/value cells, so a value's
// column index is fixed. These are the indices, not the values.
export const topTableCells = {
    gold: 3,
    oil: 5,
    food: 7,
    consMats: 9,
    population: 11,
    area: 13,
    army: 15,
};

export const bottomTableCells = {
    name: 1,
    mountainDefence: 3,
    gold: 5,
    oil: 7,
    food: 9,
    consMats: 11,
    population: 13,
    area: 15,
    army: 17,
};

export const infoTable = {
    toggle: sel.uiToggleButton,
    close: sel.xButtonInfoPanel,
    tabs: sel.tabButtons,
    summaryTab: sel.summaryButton,
    territoriesTab: sel.territoryButton,
    armyTab: sel.armyButton,
    warsSiegesTab: sel.warsSiegesButton,
    appearsAtStartOfTurn: sel.checkBoxAppearStartOfTurn,
    territoryRow: cls.uiTableRowHoverable,
    siegeRow: cls.uiTableRowSiege,
    warRow: cls.uiTableRowWar,
    /** The last column of a Territories-tab row. */
    upgradeButton: cls.upgradeButton,
    /** The last column of an Army-tab row. */
    buyButton: cls.buyButton,
};

export const buyWindow = {
    close: sel.xButtonBuy,
    confirm: sel.bottomBarBuyConfirmButton,
    subtitle: sel.subtitleBuyWindow,
    totalGold: sel.pricesBuyInfoColumn2,
    totalProdPop: sel.pricesBuyInfoColumn4,
    row: cls.buyRow,
    rowMultiplier: `${cls.buyMultiplier} img`,
    rowMultiplierText: `${cls.buyMultiplier} ${cls.buyColumn}`,
    rowMinus: `${cls.minusColumn} img`,
    rowQuantity: `${cls.buyQuantity} input`,
    rowPlus: `${cls.buyPlus} img`,
};

// Row order is fixed by calculateAvailablePurchases().
export const buyRows = { infantry: 0, assault: 1, air: 2, naval: 3 };

export const upgradeWindow = {
    close: sel.xButtonUpgrade,
    confirm: sel.bottomBarConfirmButton,
    subtitle: sel.subtitleUpgradeWindow,
    totalGold: sel.pricesInfoColumn2,
    totalConsMats: sel.pricesInfoColumn4,
    row: cls.upgradeRow,
    rowMinus: `${cls.minusColumn} img`,
    rowQuantity: `${cls.upgradeQuantity} input`,
    rowPlus: `${cls.upgradePlus} img`,
};

// Row order is fixed by calculateAvailableUpgrades().
export const upgradeRows = { farm: 0, forest: 1, oilWell: 2, fort: 3 };

export const moveButton = {
    button: sel.movePhaseButton,
    destinationText: sel.attackDestinationText,
    /** The button's state is carried by its background class, not a data attribute. */
    classFor: moveButtonClass,
};

export const transferAttack = {
    close: sel.xButtonTransferAttack,
    table: sel.transferTable,
    tableContainer: sel.transferTableContainer,
    row: cls.transferTableRowHoverable,
    siegeButton: sel.siegeBottomBarButton,
};

export const battle = {
    advance: sel.advanceButton,
    retreat: sel.retreatButton,
    siege: sel.siegeButton,
    // TWO probabilities, written by the same `setAttackProbabilityOnUI(probability,
    // situation)`: situation 0 is the ATTACK WINDOW's bar, situation 1 is the BATTLE UI's.
    // They are different elements and only one of them is live at a time -- the attack
    // window's is left holding whatever it last showed once the window closes, which is why
    // reading it from inside a battle returned a stale 0.
    attackWindowPercentage: sel.percentageAttack,
    percentage: sel.battleUIRow4Col1TextProbabilityTurnsSiege,
    probabilityBox: sel.probabilityColumnBox,
    resultsRow: (n) => `#battleResultsRow${n}`,
    kills: sel.battleResultsRow2Row3Kills,
    losses: sel.battleResultsRow2Row3Losses,
    captured: sel.battleResultsRow3Row2Captured,
    survived: sel.battleResultsRow3Row2Survived,
    rounds: sel.battleResultsRow3Row3RoundsCount,
    siegeStats: sel.battleResultsRow3Row3SiegeStats,
};

/** Phase indices, as `currentTurnPhase` / `window.__game.phase()` reports them. */
export const Phase = {
    BUY_UPGRADE: 0,
    MILITARY: 1,
    AI: 2,
};

/** What #popup-confirm reads in each phase. */
export const phaseButtonLabel = {
    [Phase.BUY_UPGRADE]: "MILITARY",
    [Phase.MILITARY]: "END TURN",
    [Phase.AI]: "AI MOVING...",
};

export const phaseTitle = {
    [Phase.BUY_UPGRADE]: "Buy / Upgrade Phase",
    [Phase.MILITARY]: "Military Phase",
    [Phase.AI]: "AI turn",
};
