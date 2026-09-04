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
// DOM. See docs/03-e2e-test-plan.md section 7.

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
    activityPanel: sel.activityPanelContainer,
    activityButton: sel.activityButtonContainer,
    tooltip: sel.tooltip,
};

export const menu = {
    resume: sel.resumeGameBtn,
    newGame: sel.newGameBtn,
    saveLoad: sel.saveLoadBtn,
    options: sel.optionsBtn,
    /** Phase 7.6. This was `help`, and until then the button did nothing. */
    dominapedia: sel.dominapediaBtn,
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

/**
 * The Options panel, opened from the main menu: the theme picker and the two
 * sound switches.
 *
 * The switches are real checkboxes, so `check()` / `uncheck()` / `isChecked()`
 * all work on them. Their sense is inverted against what `audio.js` stores --
 * checked means audible, the setting is `musicMuted`.
 */
export const options = {
    container: sel.optionsContainer,
    panel: sel.optionsPanel,
    themeSelect: sel.themeSelect,
    themePreview: sel.themePreview,
    themeDescription: sel.themeDescription,
    musicToggle: sel.optionsMusicToggle,
    sfxToggle: sel.optionsSfxToggle,
    done: sel.optionsCloseBtn,
    cancel: sel.optionsCancelBtn,
};

/**
 * The Dominapedia: the manual, opened from the main menu (Phase 7.6).
 *
 * A full-screen window rather than a dialog -- a collapsible contents column on
 * the left and a content pane on the right, with Previous and Next walking every
 * sub-topic in the book and WRAPPING at both ends, so neither button is ever
 * disabled.
 *
 * Which page is showing is asked through `aria-current="page"` on its link, not
 * through the `.is-current` class: the class is cosmetic and the attribute is the
 * fact. The order of the pages is `allTopics()` in
 * `src/ui/dominapedia/topics.js`, which the unit suite already pins -- a spec here
 * should ask whether the BUTTONS move through that order, never what the order is.
 */
export const dominapedia = {
    container: sel.dominapediaContainer,
    panel: sel.dominapediaPanel,
    title: sel.dominapediaTitle,
    close: sel.dominapediaCloseBtn,
    nav: sel.dominapediaNav,
    content: sel.dominapediaContent,
    breadcrumb: sel.dominapediaBreadcrumb,
    contentTitle: sel.dominapediaContentTitle,
    contentSummary: sel.dominapediaContentSummary,
    contentBody: sel.dominapediaContentBody,
    previous: sel.dominapediaPrevBtn,
    next: sel.dominapediaNextBtn,
    position: sel.dominapediaPosition,
    section: cls.dominapediaSection,
    sectionHeader: cls.dominapediaSectionHeader,
    sectionTopics: cls.dominapediaSectionTopics,
    topicLink: cls.dominapediaTopicLink,
    isOpen: cls.dominapediaIsOpen,
    isCurrent: cls.dominapediaIsCurrent,
    /** The link for one page, by its topic id. */
    linkFor: (topicId) => `${sel.dominapediaNav} [data-topic="${topicId}"]`,
    // `data-section` is on the group AND on its header -- the group so a spec can
    // ask whether the section is open, the header so it can click it -- so both of
    // these say which of the two they mean. A bare `[data-section=...]` matches
    // two elements and Playwright refuses it.
    /** The clickable header of one main topic. */
    sectionFor: (sectionId) =>
        `${sel.dominapediaNav} ${cls.dominapediaSectionHeader}[data-section="${sectionId}"]`,
    /** The whole group, which carries `.is-open` when it is expanded. */
    sectionGroupFor: (sectionId) =>
        `${sel.dominapediaNav} ${cls.dominapediaSection}[data-section="${sectionId}"]`,
    /** Whichever page is currently showing. */
    currentLink: `${sel.dominapediaNav} [aria-current="page"]`,
};

/**
 * The goal chooser: the screen every new game now opens on, before country selection.
 *
 * The choice is FORCED -- there is no cancel and clicking the scrim does nothing, and
 * Escape goes back to the main menu rather than skipping the screen. That is why
 * `GameDriver.newGame()` has to confirm it: every spec in the suite starts a game, and none
 * of them would reach the map otherwise.
 *
 * The scale `<select>` carries INDEXES rather than values, because the DOM stringifies an
 * option's value and Domination's 0.6 would come back as "0.6" and never match the number in
 * the tier list. A spec that wants a particular scale should select by its LABEL.
 */
export const goalSelect = {
    container: sel.goalSelectContainer,
    panel: sel.goalSelectPanel,
    kind: sel.goalSelectKind,
    scale: sel.goalSelectScale,
    scaleLabel: sel.goalSelectScaleLabel,
    summary: sel.goalSelectSummary,
    powers: sel.goalSelectPowers,
    description: sel.goalSelectDescription,
    confirm: sel.goalSelectConfirmBtn,
};

/** Spectator mode's readout, where a played game puts the player's top table. */
export const aiGameGoalBar = sel.aiGameGoalBar;

/** The popup that is both the country-select confirm AND the phase-advance button. */
export const phaseBar = {
    title: sel.popupTitle,
    body: sel.popupBody,
    confirm: sel.popupConfirm,
    colourLabel: sel.popupColor,
    /** The victory-progress line, inside the collapsible half of the bar. */
    goal: sel.phaseBarGoal,
    /**
     * The `#rrggbb` value holder. It is an off-screen `<input type="color">`: the
     * browser's own dialog was replaced by a themed grid of 256 swatches, but the
     * input is still where the value lives and still what fires `change`.
     */
    colourPicker: sel.playerColorPicker,
    colourContainer: sel.colourPickerContainer,
    colourPanel: sel.colourPickerPanel,
    colourGrid: sel.colourPickerGrid,
    colourPreview: sel.colourPickerPreview,
    colourClose: sel.colourPickerCloseBtn,
};

/**
 * The floating audio panel and the music-note button that opens it.
 *
 * The button is the TOP of the right-hand chrome column, with the continent-view
 * button under it, and it is on screen from the country-selection screen onward
 * rather than from the first turn -- the two mutes it offers are also in the main
 * menu's Options panel, for the screens where the map is not up at all.
 */
export const audio = {
    button: sel.audioButton,
    buttonContainer: sel.audioButtonContainer,
    container: sel.audioPanelContainer,
    panel: sel.audioPanel,
    playPause: sel.audioPlayPauseBtn,
    skip: sel.audioSkipBtn,
    trackName: sel.audioTrackName,
    musicSlider: sel.audioMusicSlider,
    musicMute: sel.audioMusicMuteBtn,
    sfxSlider: sel.audioSfxSlider,
    sfxMute: sel.audioSfxMuteBtn,
    close: sel.audioCloseBtn,
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

/**
 * The military activity feed (Phase 7.4) and the window furniture it shares.
 *
 * `entry` and the three tone classes are how a spec asks what the feed SAID
 * without asserting the sentence: the wording is derived when the row is drawn
 * and is pinned by `tests/unit/ui-activity-feed.spec.js`, so an e2e spec that
 * matched on text would be testing the phrasing twice and the behaviour not at
 * all.
 */
export const activityPanel = {
    button: sel.activityToggleButton,
    buttonContainer: sel.activityButtonContainer,
    container: sel.activityPanelContainer,
    panel: sel.activityPanel,
    body: sel.activityPanelBody,
    empty: sel.activityPanelEmpty,
    close: sel.xButtonActivity,
    appearsAtStartOfTurn: sel.checkBoxActivityAtStartOfTurn,
    turnGroup: cls.activityTurnGroup,
    turnHeader: cls.activityTurnHeader,
    entry: cls.activityEntry,
    entryText: cls.activityEntryText,
    isOpen: cls.activityIsOpen,
    isPlayer: cls.activityIsPlayer,
    toneVictory: cls.activityToneVictory,
    toneLoss: cls.activityToneLoss,
    toneSiege: cls.activityToneSiege,
};

/** Draggable windows (Phase 7.4): which container moves, and what moves it. */
export const draggableWindows = {
    titleBar: cls.windowTitleBar,
    dragHandle: cls.windowDragHandle,
    isDragging: cls.windowIsDragging,
    mainUiTitleBar: sel.mainUiTitleBar,
    /** Every window in the focus stack, and the handle each is dragged by. */
    all: [
        { name: "territory panel", container: sel.mainUiContainer, handle: sel.mainUiTitleBar },
        { name: "upgrade window", container: sel.upgradeContainer, handle: sel.navbarUpgradeWindow },
        { name: "buy window", container: sel.buyContainer, handle: sel.navbarBuyWindow },
        {
            name: "activity feed",
            container: sel.activityPanelContainer,
            handle: sel.activityPanel + " .activity-panel-header",
        },
    ],
};

export const buyWindow = {
    close: sel.xButtonBuy,
    confirm: sel.bottomBarBuyConfirmButton,
    subtitle: sel.subtitleBuyWindow,
    totalGold: sel.pricesBuyInfoColumn2,
    totalProdPop: sel.pricesBuyInfoColumn4,
    row: cls.buyRow,
    // Phase 7.11: the three spinner controls are `<button>`s drawn from
    // `src/ui/icons.js`, not `<img>` elements swapping to a `Grey.png` twin.
    rowMultiplier: `${cls.buyMultiplier} ${cls.stepperButton}`,
    rowMultiplierText: `${cls.buyMultiplier} ${cls.buyColumn}`,
    rowMinus: `${cls.minusColumn} ${cls.stepperButton}`,
    rowQuantity: `${cls.buyQuantity} input`,
    rowPlus: `${cls.buyPlus} ${cls.stepperButton}`,
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
    rowMinus: `${cls.minusColumn} ${cls.stepperButton}`,
    rowQuantity: `${cls.upgradeQuantity} input`,
    rowPlus: `${cls.upgradePlus} ${cls.stepperButton}`,
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
    // Battle overhaul B.7. The bottom bar's third button carries "Assault!" when resuming out of
    // a siege and "Last Push!" while the decisive round is on offer, so the selector is the same
    // element and the LABEL is what says which job it is doing.
    lastPush: sel.siegeBottomBarButton,
    lastPushId: registryIds.siegeBottomBarButton,
    digIn: sel.digInButton,
    digInId: registryIds.digInButton,
    reserves: sel.reservesButton,
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
    // Battle overhaul B.6.3 / B.6.4 / B.6.7. The three panels the overhaul added.
    ledger: sel.battleLedger,
    ledgerAttacker: sel.battleLedgerAttacker,
    ledgerDefender: sel.battleLedgerDefender,
    roundLog: sel.battleRoundLog,
    roundLogList: sel.battleRoundLogList,
    roundLogToggle: sel.battleRoundLogToggle,
    roundSummary: sel.battleRoundSummary,
    //The pairing animation. It lives OUTSIDE the battle window -- see the header of
    //src/ui/battle/ClashPanel.js -- so a spec that scopes a query to `#battleContainer` will
    //not find it.
    clashPanel: sel.battleClashPanel,
    clashPairs: sel.battleClashPairs,
    clashSummary: sel.battleClashSummary,
    attackPreview: sel.attackPreview,
    attackPreviewAttacker: sel.attackPreviewAttacker,
    attackPreviewDefender: sel.attackPreviewDefender,
    attackPreviewForecast: sel.attackPreviewForecast,
    advanceId: registryIds.advanceButton,
    retreatId: registryIds.retreatButton,
    reservesId: registryIds.reservesButton,
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
