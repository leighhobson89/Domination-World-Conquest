import { upgradeWindow, upgradeRows, containers } from "../selectors.js";

/**
 * Upgrade Territory. Reached from the info panel's Territories tab.
 *
 * Row order is fixed by calculateAvailableUpgrades(): farm, forest, oil well,
 * fort. Each caps at 5 built.
 */
export class UpgradeWindowPage {
    constructor(page) {
        this.page = page;
        this.container = page.locator(containers.upgrade);
        this.confirm = page.locator(upgradeWindow.confirm);
        this.closeButton = page.locator(upgradeWindow.close);
        this.subtitle = page.locator(upgradeWindow.subtitle);
    }

    async isOpen() {
        return (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    row(building) {
        const index = upgradeRows[building];
        if (index === undefined) throw new Error(`No such building row: ${building}`);
        return this.page.locator(upgradeWindow.row).nth(index);
    }

    async quantity(building) {
        return Number(await this.row(building).locator(upgradeWindow.rowQuantity).inputValue());
    }

    /** See BuyWindowPage.dismissTooltip -- the tooltip intercepts row clicks. */
    async dismissTooltip() {
        await this.subtitle.hover();
    }

    async plus(building, times = 1) {
        await this.dismissTooltip();
        for (let i = 0; i < times; i += 1) {
            await this.row(building).locator(upgradeWindow.rowPlus).click();
        }
    }

    async minus(building, times = 1) {
        await this.dismissTooltip();
        for (let i = 0; i < times; i += 1) {
            await this.row(building).locator(upgradeWindow.rowMinus).click();
        }
    }

    /** The row's condition text -- "Can Build", "Max Farms Reached", "Not enough gold"... */
    async conditionText(building) {
        return (await this.row(building).locator(".upgrade-column").nth(1).innerText()).trim();
    }

    async rowText(building) {
        return (await this.row(building).innerText()).replace(/\s+/g, " ").trim();
    }

    async rowGreyedOut(building) {
        const src = await this.row(building).locator(upgradeWindow.rowPlus).getAttribute("src");
        return src.includes("Grey.png");
    }

    async totals() {
        return {
            gold: Number(await this.page.locator(upgradeWindow.totalGold).innerText()),
            consMats: Number(await this.page.locator(upgradeWindow.totalConsMats).innerText()),
        };
    }

    async confirmLabel() {
        return (await this.confirm.innerText()).trim();
    }

    async submit() {
        await this.dismissTooltip();
        await this.confirm.click();
        await this.page.waitForFunction(
            (selector) => getComputedStyle(document.querySelector(selector)).display === "none",
            containers.upgrade
        );
    }

    async close() {
        await this.closeButton.click();
        await this.page.waitForFunction(
            (selector) => getComputedStyle(document.querySelector(selector)).display === "none",
            containers.upgrade
        );
    }
}
