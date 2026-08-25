// The three shapes every info-panel table is made of: a header row, a data row, and
// an empty spacer.
//
// Phase 6.4. `drawUITable()` was 920 lines and built each of these by hand, four times
// over, with the differences between the four expressed as `if
// (summaryTerritoryArmySiegesTable === n)` tests scattered through the middle of the
// construction. There were sixteen such tests in the header builder alone. The
// differences are data -- which columns, how wide, what goes in them -- so they live
// in a column table now (`columns.js`) and this file builds whatever it is handed.

import { el } from "../core/dom.js";
import { tooltip } from "../components/Tooltip.js";

/**
 * A column definition.
 *
 * @typedef {object} ColumnSpec
 * @property {string} label     the header tooltip, and the image's alt text
 * @property {string} [icon]    file name under `resources/`
 * @property {() => Element} [iconNode]  builds the header icon instead of `icon`,
 *           for the columns drawn as inline SVG so a theme can reach them
 * @property {string} [width]   CSS width for both header and body cell
 * @property {string} [headerText]  literal text INSTEAD of the icon, for a title cell
 * @property {(ctx: any) => void} [render]  fills the body cell
 */

/**
 * The hover tooltip every header cell carries: the column's full name, which is the
 * only place the icons are explained.
 */
function attachHeaderTooltip(column, label) {
    column.addEventListener("mouseover", (e) => {
        tooltip.moveTo(e.clientX - 60, 25 + e.clientY);
        tooltip.setContent(label);
        tooltip.show();
    });
    column.addEventListener("mouseout", () => {
        tooltip.setContent("");
        tooltip.hide();
    });
}

/**
 * One header row.
 *
 * @param {ColumnSpec[]} columns
 * @param {{rowClass?: string, columnClass?: string, title?: string}} options
 *        `title` replaces the first cell's contents, which is how the summary tab
 *        labels its three stacked tables.
 */
export function headerRow(columns, { rowClass = "ui-table-row", columnClass = "ui-table-column", title } = {}) {
    const row = el("div", { class: rowClass });
    row.style.fontWeight = "bold";

    columns.forEach((spec, index) => {
        const column = el("div", { class: columnClass });

        if (spec.width) {
            column.style.width = spec.width;
        }
        if (spec.headerStyle) {
            Object.assign(column.style, spec.headerStyle);
        }
        if (index > 0) {
            column.classList.add("centerIcons");
        }

        attachHeaderTooltip(column, spec.label);

        // An inline SVG wins over a file name. The war and siege columns are drawn
        // rather than shipped as PNGs so they take `var(--accent)` like the rest of
        // the chrome -- a bitmap is the same colour in every theme, which is what
        // made those two icons the odd ones out in a themed table.
        if (spec.iconNode) {
            const node = spec.iconNode();
            node.setAttribute("role", "img");
            node.setAttribute("aria-label", spec.label);
            column.appendChild(node);
        } else if (spec.icon) {
            const image = el("img", { class: "sizingIcons", alt: spec.label });
            image.src = "resources/" + spec.icon;
            column.appendChild(image);
        }

        if (index === 0 && title !== undefined) {
            column.innerHTML = title;
        }

        row.appendChild(column);
    });

    return row;
}

/**
 * One data row: the column table applied to one datum.
 *
 * `render` receives the cell and the datum, so a column that needs a button or a
 * `<span>` builds one and a column that needs a number sets `textContent`. That is
 * the whole of what the sixteen-case `switch` statements were doing.
 */
export function dataRow(columns, datum, { rowClass = "ui-table-row", columnClass = "ui-table-column" } = {}) {
    const row = el("div", { class: rowClass });

    columns.forEach((spec, index) => {
        const column = el("div", { class: columnClass });

        const width = spec.cellWidth ?? spec.width;
        if (width) {
            column.style.width = width;
        }
        if (spec.cellStyle) {
            Object.assign(column.style, spec.cellStyle);
        }
        if (index > 0) {
            column.classList.add("centerIcons");
        }

        spec.render?.(column, datum);

        row.appendChild(column);
    });

    return row;
}

/** The blank line the summary tab uses to separate its three tables. */
export function emptyRow() {
    return el("div", { class: "ui-empty-row" });
}

/**
 * Green for a gain, red for a loss, white for no change.
 *
 * Some columns pass the NEGATED value: a rise in oil demand or food consumption is
 * bad news, so it is shown red. That inversion used to be a `// Reverse sign` comment
 * beside two of the sixteen `case` labels; it is a property of the column now.
 */
export function applyGainColour(element, value) {
    if (value < 0) {
        element.style.color = "rgb(220, 120, 120)";
    } else if (value > 0) {
        element.style.color = "rgb(0, 235, 0)";
    } else {
        element.style.color = "rgb(255, 255, 255)";
    }
}

/**
 * `useable / owned`, with the useable half in red when oil demand has grounded some
 * of the fleet. Three columns of the summary tab want exactly this, twice over --
 * once for the country totals and once per territory.
 */
export function useableOverTotal(useable, total, formatNumber) {
    const useableText = formatNumber(useable, 0);
    const totalText = formatNumber(total, 0);
    const head = useable < total
        ? `<span style="font-weight: bold; color:rgb(220, 120, 120)">${useableText}</span>`
        : useableText;
    return `${head}/${totalText}`;
}
