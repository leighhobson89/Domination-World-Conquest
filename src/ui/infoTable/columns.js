// What each info-panel tab shows, as data.
//
// Phase 6.4. The four tabs of `drawUITable()` were four passes of one 920-line
// function, and every difference between them -- the header labels, the icons, the
// cell widths, the colours, which number goes where -- was a `switch (j)` over a
// column index paired with an `if (summaryTerritoryArmySiegesTable === n)` somewhere
// else in the function. Sixteen `case` labels described the summary tab's cells and
// a separate sixteen described the same tab's country totals, in the same order,
// naming the same sixteen quantities from a different object.
//
// Each tab is a list of column specs here. The order of the list IS the order of the
// columns, `label` is both the header tooltip and the icon's alt text, and `render`
// fills one cell. Adding a column is one entry; the builder in `tableDom.js` does
// not change.
//
// The renderers are given a context object rather than importing anything, so this
// file stays a description of the tables and `renderInfoTable.js` stays the only
// place that knows where the numbers come from.

import { applyGainColour, useableOverTotal } from "./tableDom.js";

const RESOURCE_LABELS = [
    "Territory",
    "Population(+/-)",
    "Gold(+/-)",
    "Oil(+/-)",
    "Oil Capacity",
    "Oil Demand",
    "Food(+/-)",
    "Food Capacity",
    "Food Consumption",
    "Construction Materials(+/-)",
    "Construction Materials Capacity",
    "Army Power",
    "Infantry",
    "Assault(useable)",
    "Air(useable)",
    "Naval(useable)"
];

const RESOURCE_ICONS = [
    "flagUIIcon.png",
    "population.png",
    "gold.png",
    "oil.png",
    "oilCap.png",
    "oilDemand.png",
    "food.png",
    "foodCap.png",
    "foodConsumption.png",
    "consMats.png",
    "consMatsCap.png",
    "army.png",
    "infantry.png",
    "assault.png",
    "air.png",
    "naval.png"
];

const SUMMARY_FIRST_COLUMN_WIDTH = "55%";
const NARROW_FIRST_COLUMN_WIDTH = "30%";

/**
 * The sixteen columns of the summary tab, sharing one label and icon list.
 *
 * `cells` supplies the fifteen renderers after the first, in column order. The three
 * tables stacked on the summary tab -- gains, country totals, per-territory -- differ
 * only in those renderers and in what the first cell says.
 */
function summaryColumns(firstCell, cells) {
    return RESOURCE_LABELS.map((label, index) => ({
        label,
        icon: RESOURCE_ICONS[index],
        width: index === 0 ? SUMMARY_FIRST_COLUMN_WIDTH : undefined,
        render: index === 0 ? firstCell : cells[index - 1]
    }));
}

/** A cell holding one formatted number, coloured by whether it is a gain or a loss. */
function gainCell(pick, { invert = false } = {}) {
    return (cell, ctx) => {
        const value = pick(ctx.gains);
        cell.textContent = ctx.formatNumber(value, 0);
        //Oil demand and food consumption rising is bad news, so those two columns are
        //coloured by the negation. It was a `// Reverse sign` comment on two of the
        //sixteen `case` labels; it is a property of the column now.
        applyGainColour(cell, invert ? -value : value);
    };
}

/** A cell holding one formatted number, uncoloured. */
function numberCell(pick, digits = 0) {
    return (cell, ctx) => {
        cell.textContent = ctx.formatNumber(pick(ctx), digits);
    };
}

/** A `useable / owned` pair, the useable half red when oil demand has grounded some. */
function useableCell(pickUseable, pickTotal) {
    return (cell, ctx) => {
        cell.innerHTML = useableOverTotal(pickUseable(ctx), pickTotal(ctx), ctx.formatNumber);
    };
}

// --- the summary tab's three tables ----------------------------------------

/** "Gains Last Turn > This Turn": one row, the whole country's change. */
export const gainsColumns = summaryColumns(
    (cell, ctx) => {
        cell.textContent = ctx.playerCountryName();
    },
    [
        gainCell(g => g.changePop),
        gainCell(g => g.changeGold),
        gainCell(g => g.changeOil),
        gainCell(g => g.changeOilCapacity),
        gainCell(g => g.changeOilDemand, { invert: true }),
        gainCell(g => g.changeFood),
        gainCell(g => g.changeFoodCapacity),
        gainCell(g => g.changeFoodConsumption, { invert: true }),
        gainCell(g => g.changeConsMats),
        gainCell(g => g.changeConsMatsCapacity),
        gainCell(g => g.changeArmy),
        gainCell(g => g.changeInfantry),
        gainCell(g => g.changeAssault),
        gainCell(g => g.changeAir),
        gainCell(g => g.changeNaval)
    ]
);

/** "Country Summary": one row, the whole country's totals. */
export const countryTotalsColumns = summaryColumns(
    (cell, ctx) => {
        cell.textContent = ctx.playerCountryName();
    },
    [
        numberCell(ctx => ctx.totals.totalPop),
        numberCell(ctx => ctx.totals.totalGold),
        numberCell(ctx => ctx.totals.totalOil),
        numberCell(ctx => ctx.capacities.totalOilCapacity),
        numberCell(ctx => ctx.demands.totalOilDemand),
        numberCell(ctx => ctx.totals.totalFood),
        numberCell(ctx => ctx.capacities.totalFoodCapacity),
        numberCell(ctx => ctx.demands.totalFoodConsumption),
        numberCell(ctx => ctx.totals.totalConsMats),
        numberCell(ctx => ctx.capacities.totalConsMatsCapacity),
        numberCell(ctx => ctx.totals.totalArmy),
        numberCell(ctx => ctx.totals.totalInfantry),
        useableCell(ctx => ctx.totals.totalUseableAssault, ctx => ctx.totals.totalAssault),
        useableCell(ctx => ctx.totals.totalUseableAir, ctx => ctx.totals.totalAir),
        useableCell(ctx => ctx.totals.totalUseableNaval, ctx => ctx.totals.totalNaval)
    ]
);

/** "Territories Summary": one row per territory, the same sixteen quantities. */
export const territoryResourceColumns = summaryColumns(
    (cell, ctx) => {
        cell.textContent = ctx.territoryName;
    },
    [
        numberCell(ctx => ctx.territory.territoryPopulation),
        numberCell(ctx => ctx.territory.goldForCurrentTerritory),
        numberCell(ctx => ctx.territory.oilForCurrentTerritory),
        numberCell(ctx => ctx.territory.oilCapacity),
        numberCell(ctx => ctx.territory.oilDemand),
        numberCell(ctx => ctx.territory.foodForCurrentTerritory),
        numberCell(ctx => ctx.territory.foodCapacity),
        numberCell(ctx => ctx.territory.foodConsumption),
        numberCell(ctx => ctx.territory.consMatsForCurrentTerritory),
        numberCell(ctx => ctx.territory.consMatsCapacity),
        numberCell(ctx => ctx.territory.armyForCurrentTerritory),
        numberCell(ctx => ctx.territory.infantryForCurrentTerritory),
        useableCell(ctx => ctx.territory.useableAssault, ctx => ctx.territory.assaultForCurrentTerritory),
        useableCell(ctx => ctx.territory.useableAir, ctx => ctx.territory.airForCurrentTerritory),
        //Naval used the one-argument form of the formatter here and the two-argument
        //form everywhere else. Preserved: `formatNumbersToKMB(x)` and
        //`formatNumbersToKMB(x, 0)` differ in how many decimals a sub-1000 figure
        //keeps, so making them agree would change what the panel reads.
        (cell, ctx) => {
            const useable = ctx.formatNumberDefault(ctx.territory.useableNaval);
            const total = ctx.formatNumberDefault(ctx.territory.navalForCurrentTerritory);
            const head = ctx.territory.useableNaval < ctx.territory.navalForCurrentTerritory
                ? `<span style="font-weight: bold; color:rgb(220, 120, 120)">${useable}</span>`
                : useable;
            cell.innerHTML = `${head}/${total}`;
        }
    ]
);

// --- the territories tab ---------------------------------------------------

const TERRITORY_LABELS = [
    "Territory",
    "Productive Population",
    "Population",
    "Area",
    "Gold",
    "Oil",
    "Food",
    "Construction Materials",
    "Upgrade"
];
const TERRITORY_ICONS = [
    "flagUIIcon.png",
    "prodPopulation.png",
    "population.png",
    "landArea.png",
    "gold.png",
    "oil.png",
    "food.png",
    "consMats.png",
    "upgrade.png"
];

/** A whole number, `Math.ceil`ed rather than abbreviated. */
function ceilCell(pick) {
    return (cell, ctx) => {
        cell.textContent = Math.ceil(pick(ctx)).toString();
    };
}

export const territoryColumns = TERRITORY_LABELS.map((label, index) => ({
    label,
    icon: TERRITORY_ICONS[index],
    width: index === 0 ? NARROW_FIRST_COLUMN_WIDTH : undefined,
    render: [
        (cell, ctx) => { cell.textContent = ctx.territoryName; },
        (cell, ctx) => { cell.textContent = ctx.formatNumberDefault(ctx.territory.productiveTerritoryPop).toString(); },
        (cell, ctx) => { cell.textContent = ctx.formatNumberDefault(ctx.territory.territoryPopulation).toString(); },
        (cell, ctx) => { cell.textContent = ctx.formatNumberDefault(ctx.territory.area).toString(); },
        ceilCell(ctx => ctx.territory.goldForCurrentTerritory),
        ceilCell(ctx => ctx.territory.oilForCurrentTerritory),
        ceilCell(ctx => ctx.territory.foodForCurrentTerritory),
        ceilCell(ctx => ctx.territory.consMatsForCurrentTerritory),
        (cell, ctx) => { cell.appendChild(ctx.upgradeButton(ctx)); }
    ][index]
}));

// --- the army tab ----------------------------------------------------------

const ARMY_LABELS = [
    "Territory",
    "Army",
    "Infantry",
    "Assault",
    "Air",
    "Naval",
    "Gold",
    "Oil",
    "Buy"
];
const ARMY_ICONS = [
    "flagUIIcon.png",
    "army.png",
    "infantry.png",
    "assault.png",
    "air.png",
    "naval.png",
    "gold.png",
    "oil.png",
    "buy.png"
];

export const armyColumns = ARMY_LABELS.map((label, index) => ({
    label,
    icon: ARMY_ICONS[index],
    width: index === 0 ? NARROW_FIRST_COLUMN_WIDTH : undefined,
    render: [
        (cell, ctx) => { cell.textContent = ctx.territoryName; },
        (cell, ctx) => { cell.textContent = ctx.formatNumberDefault(ctx.territory.armyForCurrentTerritory).toString(); },
        (cell, ctx) => { cell.textContent = ctx.formatNumberDefault(ctx.territory.infantryForCurrentTerritory).toString(); },
        (cell, ctx) => { cell.textContent = ctx.formatNumberDefault(ctx.territory.assaultForCurrentTerritory).toString(); },
        ceilCell(ctx => ctx.territory.airForCurrentTerritory),
        ceilCell(ctx => ctx.territory.navalForCurrentTerritory),
        ceilCell(ctx => ctx.territory.goldForCurrentTerritory),
        ceilCell(ctx => ctx.territory.oilForCurrentTerritory),
        (cell, ctx) => { cell.appendChild(ctx.buyButton(ctx)); }
    ][index]
}));

export { warColumns } from "./warColumns.js";
