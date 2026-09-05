// Draw one tab of the info panel.
//
// Phase 6.4. This is what is left of `drawUITable()` once the column definitions have
// gone to `columns.js` and the row construction to `tableDom.js`: four small
// functions that say what each tab is made of, and one dispatcher.
//
// Everything the tables need is INJECTED through `deps`, the same way `TopTable` and
// the rest of the Phase 6.3 components take their numbers. `resourceCalculations.js`
// has all of it in scope and passes it in; this module imports nothing from the
// economy, the store or `ui.js`, so extracting it added no edge to the module graph.
// That matters here more than usual, because `ui.js` and `resourceCalculations.js`
// already import each other.

import { headerRow, dataRow, emptyRow } from "./tableDom.js";
import {
    gainsColumns,
    countryTotalsColumns,
    territoryResourceColumns,
    territoryColumns,
    armyColumns,
    warColumns
} from "./columns.js";

/** The four tabs, by the index `drawUITable()` has always been called with. */
export const Tab = Object.freeze({
    SUMMARY: 0,
    TERRITORIES: 1,
    ARMY: 2,
    SIEGES: 3
});

/**
 * @typedef {object} InfoTableDeps
 * @property {(n: number, digits?: number) => string} formatNumber
 * @property {(n: number) => string} formatNumberDefault  the one-argument form
 * @property {() => string} playerCountryName
 * @property {object} gains          turnGainsArrayLastTurn
 * @property {object} totals         totalPlayerResources[0]
 * @property {object} capacities     capacityArray, already EFFECTIVE (continent bonus in)
 * @property {(territory: object, resource: string) => number} capacityOf  one territory's
 *           effective capacity for a resource
 * @property {string} continentsHeldLine  the Summary tab's continent-bonus sentence
 * @property {object} demands        demandArray
 * @property {Element[]} territoryPaths  playerOwnedTerritories, sorted
 * @property {(uniqueId: string) => object} territoryByUniqueId
 * @property {(path: Element, territory: object) => Element} upgradeButton
 * @property {(path: Element, territory: object) => Element} buyButton
 * @property {(row: Element, territory: object, event: MouseEvent) => void} territoryRowTooltip
 * @property {(row: Element, territory: object, event: MouseEvent) => void} armyRowTooltip
 * @property {() => void} hideTooltip
 * @property {object[]} sieges       the player's ongoing sieges
 * @property {object[]} historicWars finished wars, newest last
 * @property {(name: string) => string} reduceKeywords
 * @property {() => void} [afterSiegeTable]
 */

/**
 * Build the shared half of a render context: everything that does not depend on
 * which row is being drawn.
 */
function baseContext(deps) {
    return {
        formatNumber: deps.formatNumber,
        formatNumberDefault: deps.formatNumberDefault,
        playerCountryName: deps.playerCountryName,
        reduceKeywords: deps.reduceKeywords,
        gains: deps.gains,
        totals: deps.totals,
        capacities: deps.capacities,
        capacityOf: deps.capacityOf ?? (() => 0),
        demands: deps.demands
    };
}

/**
 * A full-width line of prose under one of the summary tables.
 *
 * The Summary tab is the one screen that already answers "how am I doing", which makes it
 * the right place to say which continents are held outright and what they are worth. It is
 * a sentence rather than a column because the answer is a LIST -- six continents, usually
 * none of them -- and a column would have to be sixteen cells wide to hold it.
 */
function noteRow(text) {
    const row = document.createElement("div");
    row.classList.add("ui-table-row");
    row.style.fontStyle = "italic";
    row.textContent = text;
    return row;
}

/** One row per player territory, over whichever column table the tab uses. */
function territoryRows(table, columns, deps, { onHover } = {}) {
    deps.territoryPaths.forEach(path => {
        const context = {
            ...baseContext(deps),
            path,
            territoryName: path.getAttribute("territory-name"),
            territory: deps.territoryByUniqueId(path.getAttribute("uniqueid")),
            upgradeButton: (ctx) => deps.upgradeButton(ctx.path, ctx.territory),
            buyButton: (ctx) => deps.buyButton(ctx.path, ctx.territory)
        };

        const row = dataRow(columns, context, { rowClass: "ui-table-row-hoverable" });

        if (onHover) {
            //The hover used to be attached inside the column loop, so a nine-column
            //row installed the same pair of listeners nine times over. Once now.
            row.addEventListener("mouseover", (event) => onHover(row, context.territory, event));
            row.addEventListener("mouseout", () => {
                deps.hideTooltip();
                row.style.cursor = "default";
            });
        }

        table.appendChild(row);
    });
}

/** Tab 0: gains, country totals and a per-territory breakdown, stacked. */
function renderSummary(table, deps) {
    const context = baseContext(deps);

    table.appendChild(headerRow(gainsColumns, { title: "Gains Last Turn > This Turn:" }));
    table.appendChild(dataRow(gainsColumns, context));
    table.appendChild(emptyRow());

    table.appendChild(headerRow(countryTotalsColumns, { title: "Country Summary:" }));
    table.appendChild(dataRow(countryTotalsColumns, context));
    if (deps.continentsHeldLine) {
        table.appendChild(noteRow(deps.continentsHeldLine));
    }
    table.appendChild(emptyRow());

    table.appendChild(headerRow(territoryResourceColumns, { title: "Territories Summary:" }));
    territoryRows(table, territoryResourceColumns, deps);
}

/** Tab 1: one row per territory, with the upgrade button. */
function renderTerritories(table, deps) {
    table.appendChild(headerRow(territoryColumns));
    territoryRows(table, territoryColumns, deps, { onHover: deps.territoryRowTooltip });
}

/** Tab 2: one row per territory, with the buy button. */
function renderArmy(table, deps) {
    table.appendChild(headerRow(armyColumns));
    territoryRows(table, armyColumns, deps, { onHover: deps.armyRowTooltip });
}

/** Tab 3: ongoing sieges above, finished wars below, with a blank line between. */
function renderSieges(table, deps) {
    const siegeSpecs = warColumns("siege");
    const historicSpecs = warColumns("historic");

    table.appendChild(headerRow(siegeSpecs));

    const sieges = [...deps.sieges].sort((a, b) => a.warId - b.warId);
    if (sieges.length === 0) {
        const none = document.createElement("div");
        none.classList.add("ui-table-row-siege");
        none.innerHTML = "Currently no Sieges";
        table.appendChild(none);
    } else {
        sieges.forEach(war => {
            table.appendChild(
                dataRow(siegeSpecs, { ...baseContext(deps), war }, {
                    rowClass: "ui-table-row-siege",
                    columnClass: "ui-table-column-siege-war"
                })
            );
        });
    }

    table.appendChild(emptyRow());

    const wars = [...deps.historicWars].sort((a, b) => a.warId - b.warId);
    if (wars.length === 0) {
        const none = document.createElement("div");
        none.classList.add("ui-table-row-war");
        none.innerHTML = "Currently no Wars";
        table.appendChild(none);
    } else {
        wars.forEach(war => {
            table.appendChild(
                dataRow(historicSpecs, { ...baseContext(deps), war }, {
                    rowClass: "ui-table-row-war",
                    columnClass: "ui-table-column-siege-war"
                })
            );
        });
    }
}

const RENDERERS = {
    [Tab.SUMMARY]: renderSummary,
    [Tab.TERRITORIES]: renderTerritories,
    [Tab.ARMY]: renderArmy,
    [Tab.SIEGES]: renderSieges
};

/**
 * Fill the info panel with one tab.
 *
 * @param {Element} container  the panel's table container
 * @param {number} tab         a `Tab` value
 * @param {InfoTableDeps} deps
 */
export function renderInfoTable(container, tab, deps) {
    container.innerHTML = "";
    container.style.display = "flex";

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.tableLayout = "fixed";

    (RENDERERS[tab] ?? renderSummary)(table, deps);

    container.appendChild(table);

    if (tab === Tab.SIEGES) {
        deps.afterSiegeTable?.();
    }
}
