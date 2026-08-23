// GameDriver -- the one place that knows how to start a game, advance a phase or
// run N turns. Specs never click the phase button directly; setup goes through
// here and only the thing under test is driven by hand.
//
// See docs/04-e2e-test-plan.md section 3.6.

import {
    MenuPage,
    PhaseBarPage,
    MapPage,
    TopTablePage,
    BottomTablePage,
    InfoTablePage,
    BuyWindowPage,
    UpgradeWindowPage,
    MoveButtonPage,
    TransferAttackPage,
    BattlePage,
} from "./pages/index.js";
import { Phase, phaseButtonLabel, phaseBar as phaseBarSelectors } from "./selectors.js";

export class GameDriver {
    constructor(page) {
        this.page = page;
        this.menu = new MenuPage(page);
        this.phaseBar = new PhaseBarPage(page);
        this.map = new MapPage(page);
        this.topTable = new TopTablePage(page);
        this.bottomTable = new BottomTablePage(page);
        this.infoTable = new InfoTablePage(page);
        this.buyWindow = new BuyWindowPage(page);
        this.upgradeWindow = new UpgradeWindowPage(page);
        this.moveButton = new MoveButtonPage(page);
        this.transferAttack = new TransferAttackPage(page);
        this.battle = new BattlePage(page);
    }

    // ---------------------------------------------------------------- lifecycle

    /** Load the page and wait until the territory model is built. */
    async open({ seed } = {}) {
        const query = seed === undefined ? "?e2e=1" : `?e2e=1&seed=${encodeURIComponent(seed)}`;
        await this.page.goto(`/${query}`, { waitUntil: "load" });
        await this.menu.waitForEnabled();
    }

    /** Click New Game and land on the country-selection screen. */
    async newGame() {
        await this.menu.start();
        await this.page.waitForSelector(phaseBarSelectors.confirm, { state: "visible" });
    }

    /**
     * The map is an <object>, not an <iframe>, so page.frameLocator("#svg-map")
     * does not work. Chromium still exposes it as a frame named after the element
     * id, which is how we reach the territory paths.
     */
    mapFrame() {
        return this.map.frame();
    }

    /** Pick a country on the map by its territory name. */
    async selectTerritory(territoryName) {
        await this.map.click(territoryName);
    }

    /** Change the player colour before or after the game starts. */
    async setColour(hex) {
        await this.page.locator(phaseBarSelectors.colourPicker).evaluate((input, value) => {
            input.value = value;
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }, hex);
    }

    /**
     * Full "start a game as this country" flow, ending in the Buy/Upgrade phase
     * of turn 1. Returns how long initialisation took, in milliseconds.
     */
    async start({ country = "Germany", seed, colour } = {}) {
        await this.open({ seed });
        await this.newGame();
        await this.selectTerritory(country);
        await this.page.waitForFunction(
            (selector) => document.querySelector(selector)?.style.display === "block",
            phaseBarSelectors.confirm
        );
        if (colour) {
            await this.setColour(colour);
        }

        const startedAt = Date.now();
        await this.page.click(phaseBarSelectors.confirm);
        await this.page.waitForFunction(() => window.__game && window.__game.isReady(), null, {
            timeout: 120_000,
        });
        // isReady() fires from initialiseGame(); the popup only settles into
        // "Buy / Upgrade Phase" once the caller finishes creating CPU players and
        // forts. Waiting for the label keeps every later phase assertion honest.
        await this.page.waitForFunction(
            ({ selector, label }) => document.querySelector(selector)?.innerText.trim() === label,
            { selector: phaseBarSelectors.confirm, label: phaseButtonLabel[Phase.BUY_UPGRADE] },
            { timeout: 120_000 }
        );
        return Date.now() - startedAt;
    }

    // -------------------------------------------------------------- turn control

    async phase() {
        return this.page.evaluate(() => window.__game.phase());
    }

    async turn() {
        return this.page.evaluate(() => window.__game.turn());
    }

    /**
     * The info panel auto-opens at the start of every turn after the first, and
     * `toggleUIMenu(true)` hides the bottom-left pane that holds the phase
     * button -- so the button is genuinely unclickable while the panel is up.
     * That is the real player experience: close the panel, then advance. Every
     * phase transition goes through here so no spec has to know about it.
     */
    async dismissStartOfTurnPanel() {
        if (await this.infoTable.isOpen()) {
            await this.infoTable.close();
        }
    }

    /** Buy/Upgrade -> Military. */
    async endBuyPhase() {
        await this.dismissStartOfTurnPanel();
        await this.phaseBar.advanceTo(Phase.MILITARY);
    }

    /**
     * Military -> AI -> the next turn's Buy/Upgrade. The AI phase runs 200+
     * countries, so this waits on the turn counter rather than on a timer.
     */
    async endTurn() {
        await this.dismissStartOfTurnPanel();
        const before = await this.turn();
        await this.phaseBar.confirm.click();
        await this.page.waitForFunction((previous) => window.__game.turn() > previous, before, {
            timeout: 120_000,
        });
        await this.page.waitForFunction(
            ({ selector, label }) => {
                const button = document.querySelector(selector);
                return button && !button.disabled && button.innerText.trim() === label;
            },
            { selector: phaseBarSelectors.confirm, label: phaseButtonLabel[Phase.BUY_UPGRADE] },
            { timeout: 120_000 }
        );
    }

    /** One complete cycle from Buy/Upgrade back to Buy/Upgrade. */
    async playTurn() {
        await this.endBuyPhase();
        await this.endTurn();
    }

    async playTurns(count) {
        for (let i = 0; i < count; i += 1) {
            await this.playTurn();
        }
    }

    // -------------------------------------------------------------- state access

    /**
     * Read a snapshot of game state through the ?e2e=1 hook. The optional second
     * argument is forwarded into the page, exactly like page.evaluate.
     */
    async state(expression, arg) {
        return arg === undefined
            ? this.page.evaluate(expression)
            : this.page.evaluate(expression, arg);
    }

    async territory(nameOrId) {
        return this.page.evaluate((key) => window.__game.territory(key), nameOrId);
    }

    async playerTerritories() {
        return this.page.evaluate(() => window.__game.territoriesOwnedBy("Player"));
    }

    async totals() {
        return this.page.evaluate(() => window.__game.totals());
    }

    async sieges() {
        return this.page.evaluate(() => window.__game.sieges());
    }

    async wars() {
        return this.page.evaluate(() => window.__game.wars());
    }

    /** Territory names the player can reach from `territoryName`. */
    async interactableFrom(territoryName) {
        return this.page.evaluate((name) => window.__game.interactableFrom(name), territoryName);
    }

    // ------------------------------------------------------------- player actions

    /** Open the buy window for one of the player's territories. */
    async openBuy(territoryName) {
        await this.infoTable.open();
        await this.infoTable.openBuyFor(territoryName);
    }

    /** Open the upgrade window for one of the player's territories. */
    async openUpgrade(territoryName) {
        await this.infoTable.open();
        await this.infoTable.openUpgradeFor(territoryName);
    }

    /**
     * Select a territory on the map during the Military phase, which is what
     * populates the reachable set and drives the move button.
     */
    async selectOnMap(territoryName) {
        await this.map.click(territoryName);
    }

    /** The first reachable territory NOT owned by the player, or null. */
    async firstEnemyReachableFrom(territoryName) {
        const reachable = await this.interactableFrom(territoryName);
        for (const name of reachable ?? []) {
            const territory = await this.territory(name);
            if (territory && territory.owner !== "Player") return name;
        }
        return null;
    }
}

export { Phase };
