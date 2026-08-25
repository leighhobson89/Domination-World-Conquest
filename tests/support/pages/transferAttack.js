import { cls, containers, transferAttack } from "../selectors.js";

/** Army column order inside a row, fixed by drawAndHandleTransferAttackTable. */
export const UNIT_COLUMN = { infantry: 0, assault: 1, air: 2, naval: 3 };

/**
 * The transfer and attack window -- one 710-line renderer with two modes, so
 * one page object with two entry points.
 *
 * The rows carry duplicated ids (`#quantityTextBox` appears once per unit type
 * per row), so everything here is addressed structurally: row -> .army-type-column
 * -> the input inside it. Refactor Phase 6.5 splits the renderer and gives the
 * rows data-testid attributes.
 *
 * A row must be SELECTED (click it, it gains `.selectedRow`) before its
 * steppers respond.
 */
export class TransferAttackPage {
    constructor(page) {
        this.page = page;
        this.container = page.locator(containers.transferAttack);
        this.table = page.locator(transferAttack.table);
        this.closeButton = page.locator(transferAttack.close);
    }

    async isOpen() {
        return (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    rows() {
        return this.page.locator(`${transferAttack.table} > div`);
    }

    async rowNames() {
        return this.page.evaluate((selector) => {
            const table = document.querySelector(selector);
            return [...table.children].map((row) => row.children[0]?.textContent ?? "");
        }, transferAttack.table);
    }

    rowFor(territoryName) {
        return this.rows().filter({ hasText: territoryName }).first();
    }

    /**
     * TRANSFER MODE ONLY. An attack table needs no row selection -- every listed
     * territory can commit units at once, which is what makes a multi-territory
     * assault possible -- and its rows carry `transfer-table-row` rather than
     * `transfer-table-row-hoverable`, with no `.selectedRow` anywhere.
     *
     * The click handler is bound to the row's NAME column
     * (`.transfer-table-outer-column:first-child`), not to the row, so clicking
     * the row anywhere else does nothing. Refactor Phase 6.5 moves the handler
     * onto the row where it belongs.
     */
    async select(territoryName) {
        await this.rowFor(territoryName).locator(cls.transferTableOuterColumn).first().click();
        await this.page.waitForSelector(cls.selectedRow);
    }

    async selectedRowName() {
        return this.page.evaluate(
            (selector) => document.querySelector(selector)?.children[0]?.textContent ?? null,
            cls.selectedRow
        );
    }

    unitColumn(territoryName, unit) {
        return this.rowFor(territoryName).locator(cls.armyTypeColumn).nth(UNIT_COLUMN[unit]);
    }

    async quantity(territoryName, unit) {
        return Number(
            await this.unitColumn(territoryName, unit).locator(cls.quantityTextField).inputValue()
        );
    }

    /**
     * `force: true` on all three steppers, for the reason written up in
     * `upgradeWindow.js`: a greyed stepper carries `aria-disabled="true"`, which
     * Playwright treats as not-enabled and refuses to click, while the game
     * itself still dispatches the click and ignores it. A transfer cell starts
     * greyed until a destination is chosen, so this one is hit constantly.
     */
    async plus(territoryName, unit, times = 1) {
        const column = this.unitColumn(territoryName, unit);
        for (let i = 0; i < times; i += 1) {
            await column.locator(cls.transferPlusButton).click({ force: true });
        }
    }

    async minus(territoryName, unit, times = 1) {
        const column = this.unitColumn(territoryName, unit);
        for (let i = 0; i < times; i += 1) {
            await column.locator(cls.transferMinusButton).click({ force: true });
        }
    }

    async multiplier(territoryName, unit) {
        return this.unitColumn(territoryName, unit).locator(cls.multipleTextField).inputValue();
    }

    async cycleMultiplier(territoryName, unit, times = 1) {
        const column = this.unitColumn(territoryName, unit);
        for (let i = 0; i < times; i += 1) {
            await column.locator(cls.multipleIncrementerButton).click({ force: true });
        }
        return this.multiplier(territoryName, unit);
    }

    /** The siege offer, only enabled when the win probability is under 15%. */
    siegeButton() {
        return this.page.locator(transferAttack.siegeButton);
    }

    async close() {
        await this.closeButton.click();
    }
}
