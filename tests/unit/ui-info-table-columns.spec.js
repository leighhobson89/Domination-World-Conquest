// The info panel's column definitions -- economy stage 4.2, audit D5.
//
// D5 was decided rather than fixed: the player's treasury IS pooled, deliberately, so that
// conquering a rich country funds a war on the other side of the map, and the pooling is not
// going anywhere. What was left of the item is that the panels implied the opposite -- a gold
// figure sitting in a territory's own row reads as a purse belonging to that territory, and a
// player who reasons from it will hold back a purchase they could have made.
//
// So the fix is UI only and it is a label. These tests exist because a label is exactly the kind
// of thing that gets "tidied" back to one word by someone who does not know why it is long, and
// because the two labels have to keep saying DIFFERENT things: units are bought from the whole
// country's gold, and buildings are not.

import { describe, expect, it } from "vitest";

import { territoryColumns, territoryResourceColumns } from "../../src/ui/infoTable/columns.js";

/** The one column whose header carries an icon of `name`. */
function columnByIcon(columns, name) {
    return columns.find((column) => column.icon === name);
}

describe("the info panel says the treasury is pooled (audit D5)", () => {
    it("tells a per-territory gold row that units are bought from the whole country", () => {
        const gold = columnByIcon(territoryResourceColumns, "gold.png");
        expect(gold).toBeDefined();
        expect(gold.label.toLowerCase()).toContain("pooled");
    });

    it("says the same on the territories tab, where the upgrade button sits beside it", () => {
        const gold = columnByIcon(territoryColumns, "gold.png");
        expect(gold).toBeDefined();
        expect(gold.label.toLowerCase()).toContain("pooled");
    });

    it("says the OPPOSITE about construction materials, which are never pooled", () => {
        // The distinction is the point. Gold moves between territories on demand; materials do
        // not move at all, which is why a rich empire can raise an army anywhere and can only
        // develop a territory that is itself solvent.
        const materials = columnByIcon(territoryColumns, "consMats.png");
        expect(materials).toBeDefined();
        expect(materials.label.toLowerCase()).toContain("never pooled");
    });

    it("keeps every label a single line of plain text", () => {
        // A label is the header's tooltip and the icon's alt text. Markup would be carried into
        // an `alt` attribute verbatim, and a newline would be swallowed silently.
        for (const columns of [territoryColumns, territoryResourceColumns]) {
            for (const column of columns) {
                expect(typeof column.label).toBe("string");
                expect(column.label).not.toContain("<");
                expect(column.label).not.toContain("\n");
            }
        }
    });
});
