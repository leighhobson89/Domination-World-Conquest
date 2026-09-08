// What a territory has BUILT, as tooltip rows.
//
// Register item M1's second half. The map carries force now -- the military view shades every
// territory by how its garrison stands against what can reach it -- and it carries nothing the
// ECONOMY does: a player could not find out how many farms a province had without selecting it
// and opening the Upgrade Territory window, one territory at a time. So the question *"is this
// worth taking, or merely takeable"* had no answer anywhere on the board.
//
// Pure, and it takes a territory rather than a path, so it runs in Node and is unit-tested
// there. `ui.js` turns these rows into markup; the wording, the order and the rule about what
// is worth showing live here.
//
// **A ROW IS ONLY DRAWN FOR SOMETHING THAT EXISTS.** Four rows reading "Farms: 0, Forests: 0,
// Oil wells: 0, Forts: 0" is the same tooltip on nine tenths of the map, and a tooltip that
// says the same thing everywhere is one a player stops reading. What a territory has built is
// news; what it has not built is the default.
//
// **THE ICON IS THE GAME'S OWN ARTWORK.** `resources/farmIcon.png` and its three siblings are
// what the Upgrade Territory window draws, so a farm on the tooltip is the same picture as the
// farm the player buys -- the rule the crossed swords already follow between the Wars tab, the
// activity feed and the map-view button. These are resolved against the HOST document, which is
// where the tooltip lives; anything drawn INSIDE the map document has the base-url problem
// `flagOverlay.js` records.

import { UPGRADE_KINDS, UPGRADES } from "../../rules/economy/upgrades.js";

/**
 * How each kind is named and pictured on the tooltip.
 *
 * Plural because the count is almost always more than one and "Farms: 1" reads better than
 * making the label agree with the number -- which would need a second string per kind for a
 * gain of nothing.
 */
export const UPGRADE_TOOLTIP_ROWS = Object.freeze({
    farm: Object.freeze({ label: "Farms", icon: "farmIcon.png" }),
    forest: Object.freeze({ label: "Forests", icon: "forestIcon.png" }),
    oilWell: Object.freeze({ label: "Oil wells", icon: "oilWellIcon.png" }),
    //LAST, AND IT IS THE ONE THAT IS NOT AN ECONOMIC BUILDING. A fort raises no capacity; it
    //takes a die off the attacker, so it belongs at the bottom of the list where the reader has
    //already passed what the territory is worth and arrives at what it costs to take.
    fort: Object.freeze({ label: "Forts", icon: "fortIcon.png" })
});

/**
 * What is visible on somebody else's land.
 *
 * **YOURS IN FULL, ENEMIES IN OUTLINE** -- Leigh's call when asked how much of this the map
 * should give away. A fort is a military work: it is a physical thing on the ground, and the
 * battle screen already states the defence bonus the moment you open an attack, so hiding it
 * here would conceal nothing and only cost the player a click. Farms, forests and oil wells are
 * the enemy's BOOKS, and knowing exactly how developed a province is before you take it is a
 * different and much larger piece of information -- one that makes scouting pointless and a
 * distant war a spreadsheet exercise.
 */
const VISIBLE_ON_ENEMY_LAND = Object.freeze(["fort"]);

/**
 * The rows for one territory, in `UPGRADE_KINDS` order and with nothing empty in them.
 *
 * @param {object} territory  a store territory, or null
 * @param {object} [options]
 * @param {boolean} [options.owned]  true for the player's own land, which is shown in full
 * @returns {{kind: string, label: string, icon: string, count: number}[]}
 */
export function upgradeTooltipRows(territory, { owned = true } = {}) {
    if (!territory) {
        return [];
    }
    const rows = [];
    for (const kind of UPGRADE_KINDS) {
        if (!owned && !VISIBLE_ON_ENEMY_LAND.includes(kind)) {
            continue;
        }
        const count = Number(territory[UPGRADES[kind].built]) || 0;
        if (count <= 0) {
            continue;
        }
        const row = UPGRADE_TOOLTIP_ROWS[kind];
        rows.push({ kind, label: row.label, icon: row.icon, count });
    }
    return rows;
}
