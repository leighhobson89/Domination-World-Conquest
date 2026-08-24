// The player's totals, across the top of the screen.
//
// Refactor Phase 6.3. Two hundred lines of `createElement` in the
// `DOMContentLoaded` block built one <tr> of sixteen cells; five places
// elsewhere then wrote into it by cell INDEX --
// `getElementById("top-table").rows[0].cells[11].innerHTML = ...` -- which is
// why `tests/support/selectors.js` has to carry a `topTableCells` map at all.
// The component keeps the cells it built, so the writes are named.
//
// What this file deliberately does NOT do yet is subscribe to
// `state/events.js`. The totals are produced by
// `addUpAllTerritoryResourcesForCountryAndWriteToTopTable()`, a sweep over all
// 359 paths that also fills `countryResourceTotals` for every AI country as a
// side effect. Until that computation is a selector, subscribing here would
// only make the same impure sweep run more often. `update()` takes the totals
// as an argument, and the callers that already compute them pass them in.
//
// The hover text needs live capacity and demand figures, which live in
// resourceCalculations.js. They are INJECTED at `create()` rather than
// imported, for the same reason the rules take an `rng`: this file must not
// drag the economy into the UI layer.

import { classNames, ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";
import { tooltip } from "./Tooltip.js";

const YELLOW = "rgb(235,235,0)";

let root = null;
let cells = null;
let heading = null;

/** A resource cell's hover text, or null for the cells that have none. */
function hoverFor(describe) {
    if (!describe) return {};
    return {
        mouseover() {
            tooltip.setContent(describe());
            tooltip.show();
        },
        mouseout() {
            tooltip.clear();
        },
    };
}

/**
 * One icon cell plus one value cell, which is how every figure in this row is
 * laid out. Returns both so the caller can keep the value.
 */
function figure({ alt, icon, valueClass = classNames.resourceFields, describe }) {
    const on = hoverFor(describe);
    const iconCell = el("td", { class: "iconCell", on }, [
        el("img", { class: "sizingIcons", alt, src: icon }),
    ]);
    const valueCell = el("td", { class: valueClass, on });
    return [iconCell, valueCell];
}

/**
 * Build the table and mount it.
 *
 * @param {object} deps
 * @param {() => string} deps.playerCountryName  for the flag's hover text
 * @param {() => object} deps.capacities         `capacityArray`
 * @param {() => object} deps.demands            `demandArray`
 * @param {(n: number, dp: number) => string} deps.formatNumber  `formatNumbersToKMB`
 */
export function create({ playerCountryName, capacities, demands, formatNumber }) {
    if (root) return root;

    const oilText = () => `
    <div><span style="color: ${YELLOW}">Oil:</span></div>
    <div>Total Oil Capacity: ${Math.ceil(capacities().totalOilCapacity)}</div>
    <div>Total Oil Demand: ${demands().totalOilDemand}</div>
  `;
    const foodText = () => `
    <div><span style="color: ${YELLOW}">Food:</span></div>
    <div>Total Food Capacity: ${formatNumber(capacities().totalFoodCapacity, 0)}</div>
  `;
    const consMatsText = () => `
    <div><span style="color: ${YELLOW}">Cons Mats.:</span></div>
    <div>Total Cons. Mats. Capacity: ${Math.ceil(capacities().totalConsMatsCapacity)}</div>
  `;

    const flag = el("td", {
        id: ids.flagTop,
        class: "iconCell",
        on: hoverFor(() => playerCountryName()),
    });

    heading = el("td", { html: "Please wait, initialising game..." });

    const [goldIcon, gold] = figure({ alt: "Gold", icon: "resources/gold.png" });
    const [oilIcon, oil] = figure({ alt: "Oil", icon: "resources/oil.png", describe: oilText });
    const [foodIcon, food] = figure({ alt: "Food", icon: "resources/food.png", describe: foodText });
    const [consMatsIcon, consMats] = figure({
        alt: "Construction Materials",
        icon: "resources/consMats.png",
        describe: consMatsText,
    });
    const [popIcon, population] = figure({
        alt: "Population",
        icon: "resources/prodPopulation.png",
        valueClass: classNames.population,
    });
    const [areaIcon, area] = figure({ alt: "Land Area", icon: "resources/landArea.png" });
    const [armyIcon, army] = figure({ alt: "Military", icon: "resources/army.png" });

    cells = { flag, gold, oil, food, consMats, population, area, army };

    root = el("table", { id: ids.topTable }, [
        el("tr", { class: "top-row" }, [
            flag,
            heading,
            goldIcon,
            gold,
            oilIcon,
            oil,
            foodIcon,
            food,
            consMatsIcon,
            consMats,
            popIcon,
            population,
            areaIcon,
            area,
            armyIcon,
            army,
        ]),
    ]);

    mount(ids.topTableContainer, root);
    // The flag cell's contents are set later and can be wider than one line.
    flag.style.whiteSpace = "pre";
    return root;
}

/**
 * Write the figures. Every key is optional, because three of the five callers
 * only touch a subset -- a purchase moves gold, population and army and nothing
 * else, and rewriting the other five cells with stale numbers is exactly the
 * bug that cell-index writes made easy.
 */
export function update(totals = {}) {
    if (!cells) return;
    for (const [key, value] of Object.entries(totals)) {
        if (value === undefined || value === null) continue;
        const cell = cells[key];
        if (cell) cell.innerHTML = value;
    }
}

/** The "Please wait, initialising game..." / "Total Player Resources:" cell. */
export function setHeading(text) {
    if (heading) heading.innerHTML = text;
}

/** The flag cell, which `setFlag()` fills with an <img>. */
export function flagCell() {
    return cells?.flag ?? null;
}

export function destroy() {
    root?.remove();
    root = null;
    cells = null;
    heading = null;
}

export const topTable = { create, update, setHeading, flagCell, destroy };
