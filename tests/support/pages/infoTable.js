import { infoTable, containers } from "../selectors.js";

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
        this.table = page.locator("#uiTable");
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
        return this.page.evaluate(() => document.querySelector(".tab-button.active")?.id ?? null);
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
     * handler is on mouseup so the pressed-state image can be swapped in
     * between. Playwright's click() fires both, but only via the element's own
     * hit box; hovering first keeps it stable while the table redraws.
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

    /** Is the upgrade button on this row live, or the greyed-out image? */
    async upgradeButtonEnabled(territoryName) {
        await this.showTerritories();
        const row = this.rowFor(territoryName);
        return (await row.locator(infoTable.upgradeButton).count()) > 0;
    }

    async buyButtonEnabled(territoryName) {
        await this.showArmy();
        const row = this.rowFor(territoryName);
        return (await row.locator(infoTable.buyButton).count()) > 0;
    }

    async toggleAppearsAtStartOfTurn() {
        await this.startOfTurnCheckbox.click();
    }
}
