// The single inventory of every element id, class and selector the UI uses.
//
// Refactor Phase 6.1. Both sides of the fence import this file: the application
// (which creates the elements and looks them up) and the e2e page objects
// (`tests/support/selectors.js`, which is now a re-export of it). A rename is
// therefore a one-line change here that fails loudly at both ends, rather than
// a literal string edited in fourteen places and a flaky spec three days later.
//
// Nothing in here imports anything, and it must stay that way -- the page
// objects run in Node under Playwright, so a DOM reference or a pull on `ui.js`
// would take the whole e2e harness with it.
//
// The ids are recorded AS THEY ARE TODAY, positional warts and all
// (`battleStatsProdPopIcon`...`H`, `xButton` used twice). Phase 6.8 replaces them
// with semantic ones plus `data-testid`; the point of doing 6.1 first is that
// 6.8 then only has to edit this file.

/**
 * Every element id in the document, as a bare id string (no `#`).
 *
 * Keys are the camelCase form of the id, so the mapping stays mechanical.
 * Grouped by the component that owns the element -- that grouping is what
 * Phase 6.3 extracts, so read a section heading as a future file name.
 */
export const ids = Object.freeze({
    // --- Top-level containers -------------------------------------------------
    // All but `attackDestinationContainer` are bare <div>s declared in
    // index.html that a component mounts itself into.
    menuContainer: "menu-container",
    popupWithConfirmContainer: "popup-with-confirm-container",
    topTableContainer: "top-table-container",
    bottomTableContainer: "bottom-table-container",
    mainUiContainer: "main-ui-container",
    upgradeContainer: "upgrade-container",
    buyContainer: "buy-container",
    transferAttackWindowContainer: "transfer-attack-window-container",
    battleContainer: "battleContainer",
    battleResultsContainer: "battleResultsContainer",
    aiDialogueContainer: "ai-dialogue-container",
    attackDestinationContainers: "attack-destination-containers",
    movePhaseButtonsContainer: "move-phase-buttons-container",
    uiButtonContainer: "UIButtonContainer",
    mapModeContainer: "mapModeContainer",
    tooltip: "tooltip",
    threeCanvasForDice: "threeCanvasForDice",
    canvas: "canvas",

    // --- Main menu ------------------------------------------------------------
    // Phase 7.2 added `resumeGameBtn` and `saveLoadBtn`. Resume is FIRST in the
    // menu and disabled until there is something to resume -- either a game
    // already in progress behind the menu, or an autosave found at page load.
    resumeGameBtn: "resume-game-btn",
    newGameBtn: "new-game-btn",
    saveLoadBtn: "save-load-btn",
    optionsBtn: "options-btn",
    helpBtn: "help-btn",

    // --- Audio ----------------------------------------------------------------
    // `toggle-music-btn` used to live in the main menu and was the whole of the
    // audio UI: one button, no volume, nothing saved. It is a music-note chrome
    // button under the continent-view button now, and it opens a panel with a
    // slider and a mute for each of music and sfx, plus transport controls.
    audioButton: "audio-button",
    audioButtonContainer: "audio-button-container",
    audioPanel: "audio-panel",
    audioPanelContainer: "audio-panel-container",
    audioPlayPauseBtn: "audio-play-pause-btn",
    audioSkipBtn: "audio-skip-btn",
    audioTrackName: "audio-track-name",
    audioMusicSlider: "audio-music-slider",
    audioMusicMuteBtn: "audio-music-mute-btn",
    audioSfxSlider: "audio-sfx-slider",
    audioSfxMuteBtn: "audio-sfx-mute-btn",
    audioCloseBtn: "audio-close-btn",

    // --- In-game menu button (Phase 7.2) --------------------------------------
    // The hamburger at the top of the screen. Escape has always opened the menu
    // mid-game; nothing on screen said so, which is the whole reason this exists.
    menuButton: "menu-button-hamburger",

    // --- Confirm dialog (Phase 7.2) -------------------------------------------
    // One reusable yes/no modal. New Game asks through it, because starting one
    // over a game in progress destroys that game with no undo.
    confirmDialogContainer: "confirm-dialog-container",
    confirmDialog: "confirm-dialog",
    confirmDialogTitle: "confirm-dialog-title",
    confirmDialogMessage: "confirm-dialog-message",
    confirmDialogConfirm: "confirm-dialog-confirm",
    confirmDialogCancel: "confirm-dialog-cancel",

    // --- Save / load panel (Phase 7.3) ----------------------------------------
    saveLoadContainer: "save-load-container",
    saveLoadPanel: "save-load-panel",
    saveCodeField: "save-code-field",
    saveCodeCopyBtn: "save-code-copy-btn",
    saveCodeGenerateBtn: "save-code-generate-btn",
    loadCodeField: "load-code-field",
    loadCodeBtn: "load-code-btn",
    saveLoadStatus: "save-load-status",
    saveLoadCloseBtn: "save-load-close-btn",

    // --- Autosave indicator (Phase 7.3) ---------------------------------------
    saveIndicator: "save-indicator",

    // --- Options panel --------------------------------------------------------
    // Opened from the main menu. The container is created by the component
    // rather than declared in index.html -- it is the first one that is, and
    // it is the pattern the rest should move to.
    optionsContainer: "options-container",
    optionsPanel: "options-panel",
    themeSelect: "theme-select",
    themePreview: "theme-preview",
    themeDescription: "theme-description",
    // The two sound switches. They are the same two mutes the audio panel over the
    // map already offers, put where a player looks for a setting -- the panel is
    // reachable only once a game is on screen, and "turn the music off" is the
    // first thing some players do from the title screen.
    optionsMusicToggle: "options-music-toggle",
    optionsSfxToggle: "options-sfx-toggle",
    optionsCloseBtn: "options-close-btn",
    // Phase 7.3 gave Cancel an id. It never had one, and the theme spec reached it
    // by `.options-button-ghost` -- which stopped being unique the moment the
    // confirm dialog and the save/load panel started sharing that class.
    optionsCancelBtn: "options-cancel-btn",

    // --- Phase bar ------------------------------------------------------------
    // One popup doing two jobs: the country-select confirm before the game
    // starts, and the phase-advance button for the rest of it.
    popupTitle: "popup-title",
    popupBody: "popup-body",
    popupConfirm: "popup-confirm",
    popupColor: "popup-color",
    // The VALUE holder, and nothing else. It is an `<input type="color">` kept
    // off screen: the browser's own 16.7-million-colour dialog is gone, replaced
    // by `ColourPicker.js`'s grid of 256 swatches, but the input is still where
    // the chosen `#rrggbb` lives and is still what fires `change`. One fact, one
    // element, and every existing reader keeps working.
    playerColorPicker: "player-color-picker",
    colourPickerContainer: "colour-picker-container",
    colourPickerPanel: "colour-picker-panel",
    colourPickerGrid: "colour-picker-grid",
    colourPickerPreview: "colour-picker-preview",
    colourPickerCloseBtn: "colour-picker-close-btn",

    // --- Map ------------------------------------------------------------------
    // `svgMap` is an <object>, not an <iframe>. In Playwright it is reached with
    // `page.frame({ name: "svg-map" })`, never `frameLocator`.
    svgMap: "svg-map",
    svgCoastLines: "svg-coast-lines",
    // Phase 7.4. `mapModeButton` (flip to the physical map) and
    // `strokeHighlightButton` (draw the continent boundaries) were two PNG
    // buttons offering four combinations, of which one -- relief with no
    // boundaries on it -- nobody wants to look at. They are one button walking
    // three states now; `data-view` on it says which.
    continentViewButton: "continentViewButton",
    uiToggleButton: "UIToggleButton",
    // Lives INSIDE the SVG document, not the host document.
    attackImage: "attackImage",

    // --- Top table (the player's totals) --------------------------------------
    topTable: "top-table",
    flagTop: "flag-top",

    // --- Bottom table (the selected territory) --------------------------------
    // Declared in index.html rather than built in JS, unlike the top table.
    bottomTable: "bottom-table",
    flagBottom: "flag-bottom",

    // --- Info table (Summary / Territories / Army / Wars & Sieges) -------------
    tabButtons: "tab-buttons",
    summaryButton: "summaryButton",
    territoryButton: "territoryButton",
    armyButton: "armyButton",
    warsSiegesButton: "warsSiegesButton",
    checkBoxAppearStartOfTurn: "checkBox-appear-start-of-turn",
    // Phase 6.8. These two were ONE id, `xButton`, on two elements: the info
    // panel's close button and the upgrade window's. A bare "#xButton" selector was
    // ambiguous the moment both existed, so every call site and every page object had
    // to scope it to a container and say why. They are named for what they close now.
    xButtonInfoPanel: "xButtonInfoPanel",
    xButtonUpgrade: "xButtonUpgrade",
    contentWindow: "content-window",
    beforeInfoPanel: "beforeInfoPanel",
    infoPanel: "info-panel",
    uiTable: "uiTable",
    selectionPanel: "selection-panel",

    // --- Upgrade window -------------------------------------------------------
    navbarUpgradeWindow: "navbar-upgrade-window",
    subtitleUpgradeWindow: "subtitle-upgrade-window",
    keyBarUpgradeWindow: "key-bar-upgrade-window",
    contentWindowUpgrade: "content-window-upgrade",
    beforeInfoPanelUpgradeWindow: "beforeInfoPanelUpgradeWindow",
    infoPanelUpgrade: "info-panel-upgrade",
    upgradeTable: "upgrade-table",
    bottomBarUpgradeWindow: "bottom-bar-upgrade-window",
    pricesInfoWindow: "prices-info-window",
    pricesInfoColumn0: "prices-info-column0",
    pricesInfoColumn1: "prices-info-column1",
    pricesInfoColumn2: "prices-info-column2",
    pricesInfoColumn3: "prices-info-column3",
    pricesInfoColumn4: "prices-info-column4",
    bottomBarConfirmButton: "bottom-bar-confirm-button",

    // --- Buy window -----------------------------------------------------------
    navbarBuyWindow: "navbar-buy-window",
    subtitleBuyWindow: "subtitle-buy-window",
    keyBarBuyWindow: "key-bar-buy-window",
    contentWindowBuy: "content-window-buy",
    beforeInfoPanelBuyWindow: "beforeInfoPanelBuyWindow",
    infoPanelBuy: "info-panel-buy",
    buyTable: "buy-table",
    bottomBarBuyWindow: "bottom-bar-buy-window",
    pricesBuyInfoWindow: "prices-buy-info-window",
    pricesBuyInfoColumn0: "prices-buy-info-column0",
    pricesBuyInfoColumn1: "prices-buy-info-column1",
    pricesBuyInfoColumn2: "prices-buy-info-column2",
    pricesBuyInfoColumn3: "prices-buy-info-column3",
    pricesBuyInfoColumn4: "prices-buy-info-column4",
    bottomBarBuyConfirmButton: "bottom-bar-buy-confirm-button",
    xButtonBuy: "xButtonBuy",

    // --- Buy / upgrade row controls -------------------------------------------
    // Written once per row by `drawUITable`'s row builders, so these ids are NOT
    // unique in the document -- they are only ever reached from within a row.
    multipleIncrementCycler: "multipleIncrementCycler",
    multipleTextBox: "multipleTextBox",
    minusButton: "minusButton",
    quantityTextBox: "quantityTextBox",
    plusButton: "plusButton",

    // --- Move-phase button ----------------------------------------------------
    movePhaseButton: "move-phase-button",
    attackDestinationContainer: "attack-destination-container",
    attackDestinationText: "attack-destination-text",

    // --- Transfer / attack window ---------------------------------------------
    titleTransferAttackWindow: "title-transfer-attack-window",
    titleTransferWindowTitleRow: "title-transfer-window-title-row",
    colorBarAttackUnderlayRed: "colorBarAttackUnderlayRed",
    colorBarAttackOverlayGreen: "colorBarAttackOverlayGreen",
    attackOrTransferString: "attackOrTransferString",
    fromHeadingString: "fromHeadingString",
    territoryTextString: "territoryTextString",
    attackingFromTerritoryTextString: "attackingFromTerritoryTextString",
    xButtonTransferAttack: "xButtonTransferAttack",
    // The ATTACK WINDOW's probability bar. The battle UI has its own, below --
    // they are different elements and only one of them is live at a time, which
    // is why reading this one from inside a battle returns a stale figure.
    percentageAttack: "percentageAttack",
    contentTransferAttackWindow: "contentTransferAttackWindow",
    contentTransferHeaderRow: "contentTransferHeaderRow",
    contentTransferHeaderColumn1: "contentTransferHeaderColumn1",
    contentTransferHeaderColumn2: "contentTransferHeaderColumn2",
    contentTransferHeaderImageColumn1: "contentTransferHeaderImageColumn1",
    contentTransferHeaderImageColumn2: "contentTransferHeaderImageColumn2",
    contentTransferHeaderImageColumn3: "contentTransferHeaderImageColumn3",
    contentTransferHeaderImageColumn4: "contentTransferHeaderImageColumn4",
    transferTableContainer: "transferTableContainer",
    transferTable: "transferTable",
    siegeBottomBarButton: "siegeBottomBarButton",

    // --- Battle UI ------------------------------------------------------------
    battleUITitleTitleCol: "battleUITitleTitleCol",
    battleUITitleTitleLeft: "battleUITitleTitleLeft",
    battleUITitleTitleCenter: "battleUITitleTitleCenter",
    battleUITitleTitleRight: "battleUITitleTitleRight",
    battleUITitleFlagCol1: "battleUITitleFlagCol1",
    battleUITitleFlagCol2: "battleUITitleFlagCol2",
    battleUIRow1: "battleUIRow1",
    battleUIRow2: "battleUIRow2",
    battleUIRow3: "battleUIRow3",
    battleUIRow4: "battleUIRow4",
    battleUIRow5: "battleUIRow5",
    battleUIRow4Col1: "battleUIRow4Col1",
    battleUIRow4Col1IconProbabilityTurnsSiege: "battleUIRow4Col1IconProbabilityTurnsSiege",
    // The BATTLE UI's probability / siege-turns readout. See `percentageAttack`.
    battleUIRow4Col1TextProbabilityTurnsSiege: "battleUIRow4Col1TextProbabilityTurnsSiege",
    battleUIRow4Col1IconSiegeScore: "battleUIRow4Col1IconSiegeScore",
    battleUIRow4Col1TextSiegeScore: "battleUIRow4Col1TextSiegeScore",
    battleUIRow4Col2: "battleUIRow4Col2",
    battleStatsProdPopIcon: "battleStatsProdPopIcon",
    battleStatsProdPopValue: "battleStatsProdPopValue",
    battleStatsFoodIcon: "battleStatsFoodIcon",
    battleStatsFoodValue: "battleStatsFoodValue",
    battleStatsDefenseIcon: "battleStatsDefenseIcon",
    battleStatsDefenseValue: "battleStatsDefenseValue",
    battleStatsMountainIcon: "battleStatsMountainIcon",
    battleStatsMountainValue: "battleStatsMountainValue",
    leftBattleImage: "leftBattleImage",
    rightBattleImage: "rightBattleImage",
    probabilityColumnBox: "probabilityColumnBox",
    advanceButton: "advanceButton",
    retreatButton: "retreatButton",
    siegeButton: "siegeButton",
    armyRowRow1: "armyRowRow1",
    armyRowRow2: "armyRowRow2",
    defenseIcon: "defenseIcon",
    defenseBonusText: "defenseBonusText",
    mountainDefenseIcon: "mountainDefenseIcon",
    mountainDefenseText: "mountainDefenseText",
    foodIcon: "foodIcon",
    foodText: "foodText",
    prodPopIcon: "prodPopIcon",
    prodPopText: "prodPopText",

    // --- Battle results -------------------------------------------------------
    battleResultsTitleTitleCol: "battleResultsTitleTitleCol",
    battleResultsTitleTitleLeft: "battleResultsTitleTitleLeft",
    battleResultsTitleTitleCenter: "battleResultsTitleTitleCenter",
    battleResultsTitleTitleRight: "battleResultsTitleTitleRight",
    battleResultsRow1: "battleResultsRow1",
    battleResultsRow1FlagCol1: "battleResultsRow1FlagCol1",
    battleResultsRow1FlagCol2: "battleResultsRow1FlagCol2",
    battleResultsRow2: "battleResultsRow2",
    battleResultsRow2Row1: "battleResultsRow2Row1",
    battleResultsRow2Row2: "battleResultsRow2Row2",
    battleResultsRow2Row3: "battleResultsRow2Row3",
    battleResultsRow2Row3Kills: "battleResultsRow2Row3Kills",
    battleResultsRow2Row3Losses: "battleResultsRow2Row3Losses",
    battleResultsRow3: "battleResultsRow3",
    battleResultsRow3Row1: "battleResultsRow3Row1",
    battleResultsRow3Row2: "battleResultsRow3Row2",
    battleResultsRow3Row2Captured: "battleResultsRow3Row2Captured",
    battleResultsRow3Row2Survived: "battleResultsRow3Row2Survived",
    battleResultsRow3Row3: "battleResultsRow3Row3",
    battleResultsRow3Row3RoundsCount: "battleResultsRow3Row3RoundsCount",
    battleResultsRow3Row3SiegeStats: "battleResultsRow3Row3SiegeStats",
    battleResultsRow4: "battleResultsRow4",

    // --- AI dialogue ----------------------------------------------------------
    aiTitleRow: "aiTitleRow",
    aiDialogueTitleFlagCol1: "aiDialogueTitleFlagCol1",
    aiDialogueTitleFlagCol2: "aiDialogueTitleFlagCol2",
    aiDialogueTitleText: "aiDialogueTitleText",
    aiDialogueBody: "aiDialogueBody",
    aiDialogueBodySubHeading: "aiDialogueBodySubHeading",
    aiDialogueBodyBottomContent: "aiDialogueBodyBottomContent",
    aiDialogueBodyBottomContentLeft: "aiDialogueBodyBottomContentLeft",
    aiDialogueBodyBottomContentLeftLarge: "aiDialogueBodyBottomContentLeftLarge",
    aiDialogueBodyBottomContentRight: "aiDialogueBodyBottomContentRight",
    aiDialogueBodyBottomContentRightLarge: "aiDialogueBodyBottomContentRightLarge",
    aiDialogueBoxBottomSummaryRow: "aiDialogueBoxBottomSummaryRow",
    aiButtonRow: "aiButtonRow",
    aiButtonLeft: "aiButtonLeft",
    aiButtonRight: "aiButtonRight",
    aiButtonAllRow: "aiButtonAllRow",
});

/**
 * The numbered ids. Each family is a row of N sibling cells that differ only by
 * index, which is why they exist as forty-odd hand-written strings today.
 * Building them from a function is the step that makes Phase 6.8 able to delete
 * them.
 */
export const indexedIds = Object.freeze({
    /** Battle UI army icons, 1..8. */
    armyRowIcon: (n) => `armyRowRow1Icon${n}`,
    /** Battle UI army quantities, 1..8 (1-4 attacker, 5-8 defender). */
    armyRowQuantity: (n) => `armyRowRow2Quantity${n}`,
    /** Battle results attacker icons, 1..8. */
    battleResultsIcon: (n) => `battleResultsRow2Row1Icon${n}`,
    /** Battle results "lost" quantities, 1..8. */
    battleResultsLostQuantity: (n) => `battleResultsRow2Row2Quantity${n}`,
    /** Battle results "remaining" quantities, 1..8. */
    battleResultsRemainingQuantity: (n) => `battleResultsRow3Row1Quantity${n}`,
    /** AI dialogue summary columns, 1..8. */
    aiDialogueSummaryColumn: (n) => `aiDialogueBoxBottomSummaryRowCol${n}`,
    /** AI dialogue left/right body rows, 1..4. */
    aiDialogueLeftRow: (n) => `aiDialogueBodyBottomContentLeftRow${n}`,
    aiDialogueRightRow: (n) => `aiDialogueBodyBottomContentRightRow${n}`,
});

/**
 * Ids built from game data rather than written out. Both of these live inside
 * the SVG document, not the host document.
 *
 * Territory names are NOT selector-safe -- six of them carry real parentheses
 * ("Andros Island (Bahamas)"), so `#siegeImage_Andros_Island_(Bahamas)` throws
 * rather than returning null (audit 5.2 AI). Anything keyed by a territory name
 * must be reached with `getElementById`, never `querySelector`.
 */
export const SIEGE_OVERLAY_PREFIX = "siegeImage_";

export const dynamicIds = Object.freeze({
    siegeOverlay: (territoryName) => SIEGE_OVERLAY_PREFIX + territoryName.replace(/\s+/g, "_"),
    isSiegeOverlay: (id) => typeof id === "string" && id.startsWith(SIEGE_OVERLAY_PREFIX),
    diagonalLines: (n) => `diagonal-lines${n}`,
});

/**
 * Class names, without the leading dot. Only classes used as a SELECTOR by the
 * app or by a page object belong here; purely cosmetic classes stay in
 * style.css and out of this file.
 */
export const classNames = Object.freeze({
    // Info table
    tabButton: "tab-button",
    tabButtonActive: "active",
    uiTableColumn: "ui-table-column",
    uiTableRowHoverable: "ui-table-row-hoverable",
    uiTableRowSiege: "ui-table-row-siege",
    uiTableRowWar: "ui-table-row-war",
    upgradeButton: "upgrade-button",
    buyButton: "buy-button",
    infoPanel: "info-panel",
    infoPanelUpgrade: "info-panel-upgrade",

    // Upgrade window rows
    upgradeRow: "upgrade-row",
    upgradeColumn: "upgrade-column",
    upgradeQuantity: "column5B",
    upgradePlus: "column5C",

    // Buy window rows
    buyRow: "buy-row",
    buyColumn: "buy-column",
    buyMultiplier: "buyColumn5Multiplier",
    buyQuantity: "buyColumn5B",
    buyPlus: "buyColumn5C",
    // The minus column is the ONE control the two windows share a class for --
    // `column5A` is on both the upgrade row and the buy row, while every other
    // buy control carries a `buyColumn5*` class of its own.
    minusColumn: "column5A",
    multipleIncrementerButton: "multipleIncrementerButton",
    multipleTextField: "multipleTextField",
    quantityTextField: "quantityTextField",
    armyTypeColumn: "army-type-column",

    // Transfer / attack table
    transferTableRow: "transfer-table-row",
    transferTableRowHoverable: "transfer-table-row-hoverable",
    transferTableOuterColumn: "transfer-table-outer-column",
    transferMinusButton: "transferMinusButton",
    transferPlusButton: "transferPlusButton",
    selectedRow: "selectedRow",

    // Cells of the two tables declared in index.html
    resourceFields: "resourceFields",
    population: "population",
    area: "area",

    // Map furniture
    sparklesContainer: "sparkles-container",

    // Map chrome (Phase 7.4). The hamburger, the info-panel globe and the
    // continent-view button are one design in three sizes of nothing -- same
    // box, same tokens, different art inside.
    chromeButton: "chrome-button",
    chromeIcon: "chrome-icon",
});

/**
 * The move button carries its state in its background class rather than in a
 * data attribute. Phase 6.6 replaces the reads with `deriveMoveButtonState()`;
 * until then this is what both the app and the page objects compare against.
 */
export const moveButtonClass = Object.freeze({
    transfer: "move-phase-button-green-background",
    attack: "move-phase-button-red-background",
    viewSiege: "move-phase-button-brown-background",
    disabled: "move-phase-button-grey-background",
    open: "move-phase-button-blue-background",
});

/**
 * Territory paths, addressed inside the SVG document.
 *
 * `territory-name` is the stable identity; `data-name` is the CURRENT owner and
 * changes on conquest. Mixing them up is a recurring source of bugs. Note these
 * attributes are OUTPUT -- they are written only by `src/ui/mapAttributeSync.js`
 * from store events, so read territory state through `src/state/selectors.js`
 * or `src/state/pathState.js`, never by matching one of these back.
 */
export const territorySelectors = Object.freeze({
    /** Chromium exposes an <object> as a frame named after the element id. */
    mapFrameName: ids.svgMap,
    all: "path[uniqueid]",
    byName: (territoryName) => `path[territory-name="${territoryName}"]`,
    byCountry: (dataName) => `path[data-name="${dataName}"]`,
    byUniqueId: (uniqueId) => `path[uniqueid="${uniqueId}"]`,
    owned: "path[data-name]",
    attackable: 'path[attackableTerritory="true"]',
});

/** `#id` for every entry in `ids`, so no lookup hand-writes the hash. */
export const sel = Object.freeze(
    Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, "#" + id]))
);

/** `.name` for every entry in `classNames`. */
export const cls = Object.freeze(
    Object.fromEntries(Object.entries(classNames).map(([key, name]) => [key, "." + name]))
);

/**
 * The handful of selectors that address a cell by its position inside another
 * element. Every one of these is a Phase 6.8 to-do -- a `data-testid` on the
 * cell makes the whole family go away -- but while they exist they belong here
 * rather than spelled out at four call sites each.
 */
export const compound = Object.freeze({
    /** The top table is one <tr> of alternating icon/value cells. */
    topTableGold: `${sel.topTable} ${cls.resourceFields}:nth-child(4)`,
    topTablePopulation: `${sel.topTable} ${cls.population}`,
    /** `rowIndex` is 1-based, in the order `calculateAvailablePurchases()` emits. */
    buyRowQuantityInput: (rowIndex) =>
        `${sel.buyTable} ${cls.buyRow}:nth-child(${rowIndex}) ${cls.buyQuantity} input`,
});
