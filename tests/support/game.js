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
    ActivityPanelPage,
} from "./pages/index.js";
import { readFile } from "node:fs/promises";

import { Phase, phaseButtonLabel, phaseBar as phaseBarSelectors, ids } from "./selectors.js";

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
        this.activityPanel = new ActivityPanelPage(page);
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

    /**
     * Everything the previous phase can leave sitting on top of the phase bar.
     *
     * Since refactor Phase 3 the AI actually conquers, which means it also attacks
     * the PLAYER -- and a turn can now end with the battle results screen up,
     * waiting to be accepted, with the phase button underneath it. Before Phase 3
     * that never happened, because the AI turn threw before it got that far.
     *
     * The battle UI proper is deliberately NOT dismissed here: if a spec finds one
     * open it is a real interactive battle and the spec should drive it, not have
     * the driver click it away.
     */
    async dismissBlockingPanels() {
        await this.dismissBattleResults();
        await this.dismissStartOfTurnPanel();
    }

    /**
     * Accept battle results until none is on screen, and touch nothing else.
     *
     * A loop, not a single check: several AI countries can resolve wars against the
     * player in one AI phase, and each queues its own results screen.
     *
     * Separate from dismissBlockingPanels() because a spec asserting on the
     * start-of-turn info panel needs the results out of the way WITHOUT the panel
     * being closed along with them.
     */
    async dismissBattleResults(limit = 10) {
        for (let i = 0; i < limit; i += 1) {
            if (!(await this.battle.resultsShown())) {
                return i > 0;
            }
            await this.battle.acceptResult();
        }
        throw new Error(`more than ${limit} battle results queued -- the AI phase is not settling`);
    }

    /**
     * Run an action that clicks the phase bar, clearing anything on top of it.
     *
     * A battle result can appear a beat AFTER the turn counter advances, so clearing
     * once and clicking is not enough -- the click then waits on an element the
     * results screen is covering. Retrying with a short per-attempt budget costs
     * nothing when the path is clear, which is the usual case.
     */
    async withBlockersCleared(action, attempts = 3) {
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            await this.dismissBlockingPanels();
            try {
                return await action();
            } catch (error) {
                if (attempt === attempts) {
                    throw error;
                }
            }
        }
        return undefined;
    }

    /** Buy/Upgrade -> Military. */
    async endBuyPhase() {
        await this.withBlockersCleared(() => this.phaseBar.advanceTo(Phase.MILITARY, 30_000));
    }

    /**
     * Military -> AI -> the next turn's Buy/Upgrade. The AI phase runs 200+
     * countries, so this waits on the turn counter rather than on a timer.
     */
    async endTurn() {
        const before = await this.turn();
        await this.withBlockersCleared(() => this.phaseBar.confirm.click({ timeout: 30_000 }));
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

    // --------------------------------------------------------------- attacking

    /**
     * End Buy/Upgrade, aim `from` at `to`, commit the WHOLE garrison of one unit type, and
     * open the battle. Returns how many units were committed.
     *
     * The allocation multiplier starts on "All", so a single press of the plus button
     * commits everything -- which is the only practical way to field a large force, since
     * the next multipliers are x1, x10, x100 and x1k.
     *
     * The INVADE! click is retried. `#tooltip` follows the pointer with no `pointer-events:
     * none`, so it can cover the move button and swallow the click; a swallowed click leaves
     * the attack window open and is indistinguishable from "the battle never opened".
     */
    /**
     * Aim `from` at `to` and open the ATTACK window, without committing anything.
     *
     * Split out of `launchWholeGarrison()` at battle overhaul B.6.7, because the attack window
     * itself is now worth asserting on: the itemised dice preview lives in it and redraws on
     * every plus and minus press, so a spec has to be able to stand in the window rather than
     * pass through it.
     */
    async openAttackWindow({ from, to }) {
        await this.endBuyPhase();
        await this.selectOnMap(from);
        await this.selectOnMap(to);
        await this.page.waitForFunction(
            (buttonId) => document.getElementById(buttonId)?.innerHTML === "ATTACK",
            ids.movePhaseButton,
            { timeout: 30_000 }
        );
        await this.moveButton.click();
        await this.page.waitForFunction(
            (containerId) =>
                getComputedStyle(document.getElementById(containerId)).display !== "none",
            ids.transferAttackWindowContainer,
            { timeout: 30_000 }
        );
    }

    async launchWholeGarrison({ from, to, unit = "naval" }) {
        await this.openAttackWindow({ from, to });

        await this.transferAttack.plus(from, unit, 1);
        const committed = await this.transferAttack.quantity(from, unit);

        await this.page.waitForFunction(
            (buttonId) => document.getElementById(buttonId)?.innerHTML === "INVADE!",
            ids.movePhaseButton,
            { timeout: 30_000 }
        );
        const deadline = Date.now() + 30_000;
        while (!(await this.battle.isOpen())) {
            if (Date.now() > deadline) {
                throw new Error("the battle never opened after INVADE!");
            }
            await this.page.mouse.move(5, 5);
            await this.moveButton.click().catch(() => {});
            await this.page.waitForTimeout(150);
        }
        return committed;
    }

    /**
     * Click the battle's advance button until the battle reaches a terminal state, and
     * report the label it stopped on with the armies as they stood just before the click
     * that ended it.
     *
     * The advance button walks "Begin War!" -> "Next Round" until a side breaks ->
     * "Start Attack!" and round again, so a round of five costs about seven clicks. It
     * stops on one of "Victory!", "Rout The Enemy", "Massive Assault", or by becoming
     * disabled -- which is how a defeat presents, with the retreat button reading "Defeat!".
     */
    /**
     * Click the battle through to a terminal state and report which one.
     *
     * `takeLastPush` decides what to do with the OFFER. The last-push band sits above the break
     * threshold, so it is crossed on the way to almost every rout -- taking the offer whenever it
     * appears would mean a spec could never observe a rout at all. Declining is the default
     * because it is the outcome the model reaches on its own.
     */
    async fightToResolution({ maxClicks = 80, takeLastPush = false } = {}) {
        const terminal = ["Victory!", "Rout The Enemy", "Massive Assault"];
        let live = null;
        for (let i = 0; i < maxClicks; i += 1) {
            if (await this.battle.resultsShown()) {
                return { ending: "results", live };
            }
            const state = await this.page.evaluate((buttonIds) => {
                const push = document.getElementById(buttonIds.push);
                const advance = document.getElementById(buttonIds.advance);
                return {
                    label: advance?.innerText ?? "",
                    //Battle overhaul B.6.6. This read `advance.disabled`, the PROPERTY. The bar
                    //records "inert" as `aria-disabled` plus a class instead -- deliberately, so
                    //the battle container's capture listener still sees the click and can settle
                    //the dice -- so the property is always false now and this loop would have
                    //pressed a dead button until it ran out of clicks.
                    disabled: !!advance && advance.getAttribute("aria-disabled") === "true",
                    pushOffered: !!push && getComputedStyle(push).display !== "none"
                        && push.innerText.trim() === "Last Push!",
                };
            }, { advance: ids.advanceButton, push: ids.siegeBottomBarButton });
            const snapshot = await this.page.evaluate(() => window.__game.battle());
            if (snapshot) {
                live = snapshot;
            }
            if (state.disabled) {
                return { ending: "attackerDestroyed", live };
            }
            if (state.pushOffered && takeLastPush) {
                await this.battle.takeLastPush();
                await this.page.waitForTimeout(80);
                continue;
            }
            await this.battle.advanceRound();
            await this.page.waitForTimeout(80);
            if (terminal.includes(state.label)) {
                return { ending: state.label, live };
            }
        }
        return { ending: "unresolved", live };
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

    /**
     * Put the world into a named state that clicking cannot reach -- a rout, an
     * all-naval defender, two concurrent sieges. Scenarios live in
     * `tests/support/scenarios/*.json` and are applied through `state/mutations.js`,
     * the same path the game writes by. See docs/04-e2e-test-plan.md section 3.7.
     *
     * The JSON is read here rather than fetched by the page, because the preview
     * server serves `build/` and not the repository.
     *
     * Throws if the scenario named a territory that does not exist: a scenario that
     * silently did nothing is worse than a failing assertion.
     */
    async loadScenario(name) {
        const url = new URL(`./scenarios/${name}.json`, import.meta.url);
        const scenario = JSON.parse(await readFile(url, "utf8"));
        const report = await this.page.evaluate(
            (input) => window.__game.applyScenario(input),
            scenario
        );
        if (report.errors.length > 0) {
            throw new Error(
                `scenario "${name}" did not apply cleanly: ${report.errors.join("; ")}`
            );
        }
        return report;
    }

    async wars() {
        return this.page.evaluate(() => window.__game.wars());
    }

    /** Armies committed to an attack, retreated from it, and due back on a later turn. */
    async retrievals() {
        return this.page.evaluate(() => window.__game.retrievals());
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
