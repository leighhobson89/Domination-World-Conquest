import { buyWindow, buyRows, containers } from "../selectors.js";

/**
 * Buy Military. Reached from the info panel's Army tab, per territory.
 *
 * Quantities are driven ONLY by the plus/minus buttons -- the text field has no
 * change handler, so typing into it is ignored by the game. The multiplier
 * cycles x1 -> x10 -> x100 -> x1k and wraps.
 */
export class BuyWindowPage {
    constructor(page) {
        this.page = page;
        this.container = page.locator(containers.buy);
        this.confirm = page.locator(buyWindow.confirm);
        this.closeButton = page.locator(buyWindow.close);
        this.subtitle = page.locator(buyWindow.subtitle);
    }

    async isOpen() {
        return (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    row(unit) {
        const index = buyRows[unit];
        if (index === undefined) throw new Error(`No such unit row: ${unit}`);
        return this.page.locator(buyWindow.row).nth(index);
    }

    async quantity(unit) {
        return Number(await this.row(unit).locator(buyWindow.rowQuantity).inputValue());
    }

    async multiplier(unit) {
        return (await this.row(unit).locator(buyWindow.rowMultiplierText).innerText()).trim();
    }

    async cycleMultiplier(unit, times = 1) {
        await this.dismissTooltip();
        for (let i = 0; i < times; i += 1) {
            await this.row(unit).locator(buyWindow.rowMultiplier).click();
        }
        return this.multiplier(unit);
    }

    /**
     * The tooltip follows the pointer and has no `pointer-events: none`, so the
     * one raised by hovering row A sits on top of row B's plus button and eats
     * the click. Parking the pointer on the window's own subtitle fires the
     * row's mouseout, which hides it. Refactor Phase 6.8 moves the inline styling
     * into CSS and this goes away.
     */
    async dismissTooltip() {
        await this.subtitle.hover();
    }

    async plus(unit, times = 1) {
        await this.dismissTooltip();
        for (let i = 0; i < times; i += 1) {
            await this.row(unit).locator(buyWindow.rowPlus).click();
        }
    }

    async minus(unit, times = 1) {
        await this.dismissTooltip();
        for (let i = 0; i < times; i += 1) {
            await this.row(unit).locator(buyWindow.rowMinus).click();
        }
    }

    /** True when the row's plus button is the greyed-out image. */
    async rowGreyedOut(unit) {
        const src = await this.row(unit).locator(buyWindow.rowPlus).getAttribute("src");
        return src.includes("Grey.png");
    }

    async totals() {
        return {
            gold: Number(await this.page.locator(buyWindow.totalGold).innerText()),
            prodPop: Number(await this.page.locator(buyWindow.totalProdPop).innerText()),
        };
    }

    /** "Cancel" until at least one row is non-zero, then "Confirm". */
    async confirmLabel() {
        return (await this.confirm.innerText()).trim();
    }

    async submit() {
        await this.dismissTooltip();
        await this.confirm.click();
        await this.page.waitForFunction(
            (selector) => getComputedStyle(document.querySelector(selector)).display === "none",
            containers.buy
        );
    }

    async close() {
        await this.closeButton.click();
        await this.page.waitForFunction(
            (selector) => getComputedStyle(document.querySelector(selector)).display === "none",
            containers.buy
        );
    }
}
