// The canonical selector inventory for the e2e suite.
//
// Today's ids are positional and hand-written (`battleUIRow4Col2A`...`H`, table
// cells addressed by index). Refactor Phase 6.1 replaces this file with a
// re-export of `ui/core/registry.js`, so that the app and the page objects share
// one definition and selector drift becomes a build error rather than a flaky
// test. Until then this is the single place a rename has to be applied.
//
// See docs/04-e2e-test-plan.md section 7 for the full recorded inventory.

/** Containers, in the order they appear in index.html. */
export const containers = {
    menu: "#menu-container",
    popupWithConfirm: "#popup-with-confirm-container",
    topTable: "#top-table-container",
    bottomTable: "#bottom-table-container",
    mainUi: "#main-ui-container",
    upgrade: "#upgrade-container",
    buy: "#buy-container",
    transferAttack: "#transfer-attack-window-container",
    battle: "#battleContainer",
    battleResults: "#battleResultsContainer",
    aiDialogue: "#ai-dialogue-container",
    attackDestination: "#attack-destination-containers",
    movePhaseButtons: "#move-phase-buttons-container",
    uiButton: "#UIButtonContainer",
    mapMode: "#mapModeContainer",
    tooltip: "#tooltip",
};

export const menu = {
    newGame: "#new-game-btn",
    toggleMusic: "#toggle-music-btn",
};

/** The popup that is both the country-select confirm AND the phase-advance button. */
export const phaseBar = {
    title: "#popup-title",
    body: "#popup-body",
    confirm: "#popup-confirm",
    colourLabel: "#popup-color",
    colourPicker: "#player-color-picker",
};

export const map = {
    object: "#svg-map",
    /** Chromium exposes an <object> as a frame named after the element id. */
    frameName: "svg-map",
    coastLines: "#svg-coast-lines",
    mapModeButton: "#mapModeButton",
    strokeHighlightButton: "#strokeHighlightButton",
    uiToggleButton: "#UIToggleButton",
    /** A territory path, addressed by its stable identity. */
    territory: (territoryName) => `path[territory-name="${territoryName}"]`,
    /** Every path of a country -- `data-name` is the CURRENT owner, not identity. */
    country: (dataName) => `path[data-name="${dataName}"]`,
    byUniqueId: (uniqueId) => `path[uniqueid="${uniqueId}"]`,
    allTerritories: "path[uniqueid]",
};

export const tables = {
    top: "#top-table",
    bottom: "#bottom-table",
    ui: "#uiTable",
    buy: "#buy-table",
    upgrade: "#upgrade-table",
    transfer: "#transferTable",
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
    toggle: "#UIToggleButton",
    // `xButton` is a DUPLICATED id: the info panel's close button and the upgrade
    // window's both carry it, so a bare "#xButton" is a strict-mode violation the
    // moment both exist. Scope it to the container. Refactor Phase 6.8 gives them
    // semantic ids.
    close: "#main-ui-container #xButton",
    tabs: "#tab-buttons",
    summaryTab: "#summaryButton",
    territoriesTab: "#territoryButton",
    armyTab: "#armyButton",
    warsSiegesTab: "#warsSiegesButton",
    appearsAtStartOfTurn: "#checkBox-appear-start-of-turn",
    territoryRow: ".ui-table-row-hoverable",
    siegeRow: ".ui-table-row-siege",
    warRow: ".ui-table-row-war",
    /** The last column of a Territories-tab row. */
    upgradeButton: ".upgrade-button",
    /** The last column of an Army-tab row. */
    buyButton: ".buy-button",
};

export const buyWindow = {
    close: "#xButtonBuy",
    confirm: "#bottom-bar-buy-confirm-button",
    subtitle: "#subtitle-buy-window",
    totalGold: "#prices-buy-info-column2",
    totalProdPop: "#prices-buy-info-column4",
    row: ".buy-row",
    rowMultiplier: ".buyColumn5Multiplier img",
    rowMultiplierText: ".buyColumn5Multiplier .buy-column",
    rowMinus: ".column5A img",
    rowQuantity: ".buyColumn5B input",
    rowPlus: ".buyColumn5C img",
};

// Row order is fixed by calculateAvailablePurchases().
export const buyRows = { infantry: 0, assault: 1, air: 2, naval: 3 };

export const upgradeWindow = {
    // See the note on infoTable.close -- `xButton` is used twice in the document.
    close: "#upgrade-container #xButton",
    confirm: "#bottom-bar-confirm-button",
    subtitle: "#subtitle-upgrade-window",
    totalGold: "#prices-info-column2",
    totalConsMats: "#prices-info-column4",
    row: ".upgrade-row",
    rowMinus: ".column5A img",
    rowQuantity: ".column5B input",
    rowPlus: ".column5C img",
};

// Row order is fixed by calculateAvailableUpgrades().
export const upgradeRows = { farm: 0, forest: 1, oilWell: 2, fort: 3 };

export const moveButton = {
    button: "#move-phase-button",
    destinationText: "#attack-destination-text",
    /** The button's state is carried by its background class, not a data attribute. */
    classFor: {
        transfer: "move-phase-button-green-background",
        attack: "move-phase-button-red-background",
        viewSiege: "move-phase-button-brown-background",
        disabled: "move-phase-button-grey-background",
        open: "move-phase-button-blue-background",
    },
};

export const transferAttack = {
    close: "#xButtonTransferAttack",
    table: "#transferTable",
    tableContainer: "#transferTableContainer",
    row: ".transfer-table-row-hoverable",
    confirm: "#transferAttackConfirmButton",
    siegeButton: "#siegeBottomBarButton",
};

export const battle = {
    advance: "#advanceButton",
    retreat: "#retreatButton",
    siege: "#siegeButton",
    // TWO probabilities, written by the same `setAttackProbabilityOnUI(probability,
    // situation)`: situation 0 is the ATTACK WINDOW's bar, situation 1 is the BATTLE UI's.
    // They are different elements and only one of them is live at a time -- the attack
    // window's is left holding whatever it last showed once the window closes, which is why
    // reading it from inside a battle returned a stale 0.
    attackWindowPercentage: "#percentageAttack",
    percentage: "#battleUIRow4Col1TextProbabilityTurnsSiege",
    probabilityBox: "#probabilityColumnBox",
    resultsRow: (n) => `#battleResultsRow${n}`,
    kills: "#battleResultsRow2Row3Kills",
    losses: "#battleResultsRow2Row3Losses",
    captured: "#battleResultsRow3Row2Captured",
    survived: "#battleResultsRow3Row2Survived",
    rounds: "#battleResultsRow3Row3RoundsCount",
    siegeStats: "#battleResultsRow3Row3SiegeStats",
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
