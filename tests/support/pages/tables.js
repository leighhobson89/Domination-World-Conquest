import { tables, topTableCells, bottomTableCells } from "../selectors.js";

// Both tables are one <tr> of alternating icon/value cells addressed by index.
// The values are KMB-formatted ("1.2M"), so these page objects exist to assert
// what is VISIBLE. Numeric assertions go through window.__game -- see
// docs/04-e2e-test-plan.md section 8.3.

class CellTable {
    constructor(page, tableSelector, cellMap) {
        this.page = page;
        this.tableSelector = tableSelector;
        this.cells = cellMap;
    }

    async text(field) {
        const index = this.cells[field];
        if (index === undefined) throw new Error(`No such column: ${field}`);
        return this.page.evaluate(
            ({ selector, i }) => document.querySelector(selector).rows[0].cells[i].innerHTML.trim(),
            { selector: this.tableSelector, i: index }
        );
    }

    async all() {
        const out = {};
        for (const field of Object.keys(this.cells)) {
            out[field] = await this.text(field);
        }
        return out;
    }

    async isVisible(containerSelector) {
        return (
            (await this.page
                .locator(containerSelector)
                .evaluate((el) => getComputedStyle(el).display)) !== "none"
        );
    }
}

export class TopTablePage extends CellTable {
    constructor(page) {
        super(page, tables.top, topTableCells);
        this.flag = page.locator("#flag-top img");
    }
}

export class BottomTablePage extends CellTable {
    constructor(page) {
        super(page, tables.bottom, bottomTableCells);
    }

    /** "Bavaria (Europe)" -- the name cell carries the continent in brackets. */
    async territoryName() {
        return (await this.text("name")).replace(/\s*\(.*\)$/, "");
    }
}
