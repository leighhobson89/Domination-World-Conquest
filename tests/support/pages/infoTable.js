import { cls, containers, infoTable, tables } from "../selectors.js";

/**
 * The main info panel: Summary / Territories / Army / Wars & Sieges.
 *
 * It is also the only route to the buy and upgrade windows -- the Territories
 * tab carries the per-territory upgrade button and the Army tab the buy button.
 */
export class InfoTablePage {
    constructor(page) {
        this.page = page;
        this.container = page.locator(containers.mainUi);
        this.table = page.locator(tables.ui);
        this.startOfTurnCheckbox = page.locator(infoTable.appearsAtStartOfTurn);
    }

    async isOpen() {
        return (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    async open() {
        if (await this.isOpen()) return;
        await this.page.locator(infoTable.toggle).click();
        await this.page.waitForFunction(
            (selector) => getComputedStyle(document.querySelector(selector)).display !== "none",
            containers.mainUi
        );
    }

    async close() {
        if (!(await this.isOpen())) return;
        await this.page.locator(infoTable.close).click();
        await this.page.waitForFunction(
            (selector) => getComputedStyle(document.querySelector(selector)).display === "none",
            containers.mainUi
        );
    }

    async showSummary() {
        await this.page.locator(infoTable.summaryTab).click();
    }

    async showTerritories() {
        await this.page.locator(infoTable.territoriesTab).click();
        await this.page.locator(infoTable.territoryRow).first().waitFor();
    }

    async showArmy() {
        await this.page.locator(infoTable.armyTab).click();
        await this.page.locator(infoTable.territoryRow).first().waitFor();
    }

    async showWarsAndSieges() {
        await this.page.locator(infoTable.warsSiegesTab).click();
    }

    /** The active tab's id, or null when none is marked active. */
    async activeTab() {
        return this.page.evaluate(
            (selector) => document.querySelector(selector)?.id ?? null,
            `${cls.tabButton}${cls.tabButtonActive}`
        );
    }

    /** Territory names listed in the current tab, in row order. */
    async rowNames() {
        return this.page.evaluate(
            (selector) =>
                [...document.querySelectorAll(selector)].map(
                    (row) => row.children[0]?.textContent ?? ""
                ),
            infoTable.territoryRow
        );
    }

    rowFor(territoryName) {
        return this.page
            .locator(infoTable.territoryRow)
            .filter({ has: this.page.locator(`text="${territoryName}"`) })
            .first();
    }

    /**
     * The upgrade/buy buttons respond to mousedown+mouseup, not click -- the
     * handler was on mouseup until Phase 7.11, so the pressed-state image could
     * be swapped in between; it is an ordinary click on a `<button>` now, and
     * the press is `:active` in the stylesheet.
     */
    async openUpgradeFor(territoryName) {
        await this.showTerritories();
        const button = this.rowFor(territoryName).locator(infoTable.upgradeButton);
        await button.click();
        await this.page.waitForFunction(
            (selector) => getComputedStyle(document.querySelector(selector)).display !== "none",
            containers.upgrade
        );
    }

    async openBuyFor(territoryName) {
        await this.showArmy();
        const button = this.rowFor(territoryName).locator(infoTable.buyButton);
        await button.click();
        await this.page.waitForFunction(
            (selector) => getComputedStyle(document.querySelector(selector)).display !== "none",
            containers.buy
        );
    }

    /**
     * Is the upgrade button on this row live?
     *
     * Phase 7.11: this used to be "does an element with the `.upgrade-button`
     * class EXIST in the row", because the old build added that class only when
     * the button worked -- so the class said what the control is and was being
     * read to say what it is doing. The class is always present now and
     * `aria-disabled` is the state.
     */
    async upgradeButtonEnabled(territoryName) {
        await this.showTerritories();
        return this.actionButtonEnabled(territoryName, infoTable.upgradeButton);
    }

    async buyButtonEnabled(territoryName) {
        await this.showArmy();
        return this.actionButtonEnabled(territoryName, infoTable.buyButton);
    }

    async actionButtonEnabled(territoryName, selector) {
        const button = this.rowFor(territoryName).locator(selector);
        if ((await button.count()) === 0) return false;
        return (await button.getAttribute("aria-disabled")) !== "true";
    }

    async toggleAppearsAtStartOfTurn() {
        await this.startOfTurnCheckbox.click();
    }
}
