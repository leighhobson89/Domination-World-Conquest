import { cls, containers, upgradeRows, upgradeWindow } from "../selectors.js";

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

    /**
     * The steppers are clicked with `force: true`, and that is not a shortcut.
     *
     * Phase 7.11 gave a greyed stepper `aria-disabled="true"`, which is the
     * correct markup -- it tells assistive technology the control is unavailable
     * while leaving it focusable. Playwright reads that attribute as "not
     * enabled" and refuses to click, which would be right if the game refused
     * too. It does not: these deliberately keep the `disabled` PROPERTY off so
     * the click still fires and the handler ignores it, exactly as the greyed
     * PNGs behaved (see `src/ui/controls/steppers.js`). Driving them the way a
     * player does therefore means saying so.
     */
    async plus(building, times = 1) {
        await this.dismissTooltip();
        for (let i = 0; i < times; i += 1) {
            await this.row(building).locator(upgradeWindow.rowPlus).click({ force: true });
        }
    }

    async minus(building, times = 1) {
        await this.dismissTooltip();
        for (let i = 0; i < times; i += 1) {
            await this.row(building).locator(upgradeWindow.rowMinus).click({ force: true });
        }
    }

    /** The row's condition text -- "Can Build", "Max Farms Reached", "Not enough gold"... */
    async conditionText(building) {
        return (await this.row(building).locator(cls.upgradeColumn).nth(1).innerText()).trim();
    }

    async rowText(building) {
        return (await this.row(building).innerText()).replace(/\s+/g, " ").trim();
    }

    /**
     * True when the row's plus button is inert.
     *
     * Phase 7.11: this used to ask whether the button's `src` ended in
     * `Grey.png`, because the image WAS the state. The button is drawn now and
     * `aria-disabled` carries it -- which is also what a screen reader reads.
     */
    async rowGreyedOut(building) {
        const state = await this.row(building).locator(upgradeWindow.rowPlus).getAttribute("aria-disabled");
        return state === "true";
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
