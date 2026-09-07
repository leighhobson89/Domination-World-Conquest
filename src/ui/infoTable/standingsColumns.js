// The six columns of the Standings tab.
//
// Register item E5. Four of them are the same in every game and two come from the goal in
// force -- `src/ui/goals/standingsGoalColumns.js` is the only thing that switches on which
// goal that is, and this file simply asks it for a pair of labels and a pair of renderers.
//
// Two things about the shape, both of which differ from every tab before this one.
//
// **The headers are TEXT, not icons.** The other four tabs head their columns with a picture
// because each column is one quantity -- gold, food, army -- and the icon is shorter than
// the word. A goal column is a phrase that changes with the goal ("Powers broken", "Against
// the leader"), and there is no icon that could mean it.
//
// **The rows are COUNTRIES, not the player's territories.** Every other tab iterates
// `deps.territoryPaths`; this one iterates the ranked world, so the render context is a
// standings row rather than a territory and the cell renderers take a different datum.

import { goalColumnsFor } from "../goals/standingsGoalColumns.js";

const RANK_WIDTH = "8%";
const COUNTRY_WIDTH = "26%";

/**
 * The column table for one goal.
 *
 * `context` carries what the goal columns need beyond a row -- the current turn, for the
 * Timed Game's clock -- and is captured here rather than threaded through `dataRow()`,
 * which passes exactly one datum by design.
 *
 * @param {string} conditionKind  a `VictoryCondition`
 * @param {{turn?: number, formatNumber?: (n: number) => string}} [context]
 */
export function standingsColumns(conditionKind, context = {}) {
    const goal = goalColumnsFor(conditionKind);
    const format = context.formatNumber ?? ((value) => String(value));

    return [
        {
            label: "Position",
            headerText: "#",
            width: RANK_WIDTH,
            render: (cell, row) => {
                cell.textContent = String(row.rank);
            }
        },
        {
            label: "Country",
            headerText: "Country",
            width: COUNTRY_WIDTH,
            render: (cell, row) => {
                //The player's own row says so in words rather than only in colour. The
                //table is ordered by goal progress, so the player can be anywhere in it,
                //and hunting for a highlighted row in sixteen is exactly the sort of thing
                //a table should not make somebody do.
                cell.textContent = row.isPlayer ? row.country + " (you)" : row.country;
            }
        },
        {
            label: "Territories held",
            headerText: "Territories",
            render: (cell, row) => {
                cell.textContent = String(row.territories);
            }
        },
        {
            label: "Total military strength",
            headerText: "Army",
            render: (cell, row) => {
                cell.textContent = format(row.army);
            }
        },
        {
            label: goal.valueLabel,
            headerText: goal.valueLabel,
            render: (cell, row) => {
                cell.textContent = goal.value(row, context);
            }
        },
        {
            label: goal.detailLabel,
            headerText: goal.detailLabel,
            render: (cell, row) => {
                cell.textContent = goal.detail(row, context);
            }
        }
    ];
}
