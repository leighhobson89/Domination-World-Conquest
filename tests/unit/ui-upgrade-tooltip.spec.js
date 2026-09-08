// What the territory tooltip says a province has built.
//
// Register item M1's second half, and the decision worth pinning here is the one about what is
// NOT shown: a kind with none of it gets no row. Four zero rows would be the same tooltip on
// nine tenths of the map, and a tooltip that says the same thing everywhere is one a player
// stops reading.

import { describe, expect, it } from "vitest";

import { UPGRADE_KINDS } from "../../src/rules/economy/upgrades.js";
import {
    UPGRADE_TOOLTIP_ROWS,
    upgradeTooltipRows
} from "../../src/ui/map/upgradeTooltip.js";

const territory = (fields) => ({
    farmsBuilt: 0, forestsBuilt: 0, oilWellsBuilt: 0, fortsBuilt: 0, ...fields
});

describe("the upgrade rows on a territory tooltip", () => {
    it("shows only what has actually been built", () => {
        const rows = upgradeTooltipRows(territory({ farmsBuilt: 3, forestsBuilt: 2 }));

        expect(rows.map(row => [row.label, row.count]))
            .toEqual([["Farms", 3], ["Forests", 2]]);
    });

    it("says nothing at all about an undeveloped territory", () => {
        //THE DECISION. Most of the map has built nothing, so the alternative is four zero rows
        //on nine tenths of the territories -- and the tooltip already carries the owner, the
        //leader, the continent and, in the military view, the whole threat list.
        expect(upgradeTooltipRows(territory({}))).toEqual([]);
        expect(upgradeTooltipRows(null)).toEqual([]);
    });

    it("counts forts, which are the one upgrade that is not an economic building", () => {
        //A fort raises no capacity -- it takes a die off the attacker -- so it belongs on a
        //tooltip a player reads while deciding where to attack quite as much as a farm does.
        const rows = upgradeTooltipRows(territory({ fortsBuilt: 4 }));

        expect(rows).toHaveLength(1);
        expect(rows[0].label).toBe("Forts");
        expect(rows[0].count).toBe(4);
    });

    it("keeps the order the upgrade table uses, with forts last", () => {
        const rows = upgradeTooltipRows(
            territory({ farmsBuilt: 1, forestsBuilt: 1, oilWellsBuilt: 1, fortsBuilt: 1 })
        );

        expect(rows.map(row => row.kind)).toEqual([...UPGRADE_KINDS]);
    });

    it("has a label and a picture for every kind the rules define", () => {
        //The rules own the list of kinds. A fifth one added there without a row here would
        //silently never appear on the tooltip, which is the kind of omission nothing notices.
        for (const kind of UPGRADE_KINDS) {
            expect(UPGRADE_TOOLTIP_ROWS[kind]?.label).toBeTruthy();
            expect(UPGRADE_TOOLTIP_ROWS[kind]?.icon).toMatch(/\.png$/);
        }
    });

    it("shows an enemy's forts and keeps their books to themselves", () => {
        //YOURS IN FULL, ENEMIES IN OUTLINE. A fort is a physical military work and the battle
        //screen states the defence bonus the moment an attack is opened, so hiding it here
        //conceals nothing and costs a click. How developed a province is, is a different and
        //much larger piece of information -- giving it away makes scouting pointless.
        const developed = territory({
            farmsBuilt: 5, forestsBuilt: 4, oilWellsBuilt: 3, fortsBuilt: 2
        });

        expect(upgradeTooltipRows(developed, { owned: false }).map(row => row.kind))
            .toEqual(["fort"]);
        expect(upgradeTooltipRows(developed, { owned: true }).map(row => row.kind))
            .toEqual(["farm", "forest", "oilWell", "fort"]);
        //An unfortified enemy province says nothing at all rather than saying "Forts: 0".
        expect(upgradeTooltipRows(territory({ farmsBuilt: 9 }), { owned: false })).toEqual([]);
    });

    it("ignores a count that is missing or nonsense rather than printing it", () => {
        expect(upgradeTooltipRows({ farmsBuilt: undefined, fortsBuilt: "2" }))
            .toEqual([{ kind: "fort", label: "Forts", icon: "fortIcon.png", count: 2 }]);
        expect(upgradeTooltipRows({ farmsBuilt: -3 })).toEqual([]);
    });
});
