// The thirteen columns of the Wars and Sieges tab.
//
// Phase 6.4, split out of `columns.js` in 6.8 to keep both files under 400 lines.
// Ongoing sieges and finished wars share every column; they differ only in the icon
// in the first cell and in one fix-up on the attacker figures.

const WAR_LABELS = [
    "Outcome",
    "Sieged Turns",
    "Territory",
    "Attacking Country",
    "Attacking Infantry",
    "Attacking Assault",
    "Attacking Air",
    "Attacking Naval",
    "Defending Country",
    "Defending Infantry",
    "Defending Assault",
    "Defending Air",
    "Defending Naval"
];
const WAR_ICONS = [
    "battle.png",
    "siege.png",
    "flagUIIcon.png",
    "sword.png",
    "infantry.png",
    "assault.png",
    "air.png",
    "naval.png",
    "shield.png",
    "infantry.png",
    "assault.png",
    "air.png",
    "naval.png"
];

//The war table's widths were thirteen `if (j === a || j === b)` tests, repeated
//verbatim in the header builder, the ongoing-siege row builder and the historic-war
//row builder -- three copies that had to agree. One table.
const WAR_COLUMN_WIDTHS = ["5%", "5%", "12%", "5%", "10%", "8%", "8%", "8%", "5%", "10%", "8%", "8%", "8%"];

//...with one exception, preserved rather than corrected. Column 9 (Defending
//Infantry) is 10% wide in the header and 8% in the body, because the two `if` chains
//were not quite copies of each other. Making them agree is a visual change and
//belongs to 6.8; this phase moves code.
const WAR_CELL_WIDTHS = ["5%", "5%", "12%", "5%", "10%", "8%", "8%", "8%", "5%", "8%", "8%", "8%", "8%"];

//Attacker columns are green, defender columns red, and the territory name yellow.
const ATTACKER_GREEN = "rgb(0,235,0)";
const DEFENDER_RED = "rgb(220,120,120)";
const TERRITORY_YELLOW = "rgb(235,235,0)";

function warColumnStyle(index) {
    if (index === 0) {
        return { justifyContent: "center" };
    }
    if (index === 2) {
        return { color: TERRITORY_YELLOW };
    }
    if (index >= 4 && index <= 7) {
        return { color: ATTACKER_GREEN, whiteSpace: "nowrap" };
    }
    if (index >= 9 && index <= 11) {
        return { color: DEFENDER_RED, whiteSpace: "nowrap" };
    }
    if (index === 12) {
        return { color: DEFENDER_RED };
    }
    return undefined;
}

function flagCell(pickCountry) {
    return (cell, ctx) => {
        const image = document.createElement("img");
        image.classList.add("flag-war");
        image.src = `./resources/flags/${pickCountry(ctx)}.png`;
        cell.innerHTML = "";
        cell.appendChild(image);
    };
}

/**
 * `remaining / started with`, for one unit slot of one side.
 *
 * A historic war records `"All"` as the starting figure for a retreat before the
 * first round, and `"0/All"` then reads as though the army was wiped out when in
 * fact none of it was ever committed -- so it is shown as `"All/All"`. That fix-up
 * applied only to the four ATTACKER columns of the historic table, and it still does.
 */
function armySlotCell(side, slot, { allForAll = false } = {}) {
    const remainingKey = side === "attack" ? "attackingArmyRemaining" : "defendingArmyRemaining";
    const startingKey = side === "attack" ? "startingAtt" : "startingDef";
    return (cell, ctx) => {
        const war = ctx.war;
        cell.textContent =
            ctx.formatNumberDefault(war[remainingKey][slot]) + " / " + ctx.formatNumberDefault(war[startingKey][slot]);
        if (allForAll && cell.textContent === "0/All") {
            cell.textContent = "All/All";
        }
    };
}

/**
 * The thirteen columns of one war row.
 *
 * @param {"siege"|"historic"} kind  an ongoing siege always shows the siege icon;
 *                                   a finished war shows how it ended
 */
export function warColumns(kind) {
    const historic = kind === "historic";

    return WAR_LABELS.map((label, index) => ({
        label,
        icon: WAR_ICONS[index],
        width: WAR_COLUMN_WIDTHS[index],
        cellWidth: WAR_CELL_WIDTHS[index],
        headerStyle: index === 0 ? { justifyContent: "center", marginLeft: "10px" } : undefined,
        cellStyle: warColumnStyle(index),
        render: [
            (cell, ctx) => {
                const image = document.createElement("img");
                image.classList.add("sizingIcons");
                const src = historic ? outcomeIcon(ctx.war.resolution) : "./resources/siege.png";
                //An unrecognised resolution leaves the src unset, exactly as before.
                //Inventing a fallback would hide a resolution string nobody handles.
                if (src) {
                    image.src = src;
                }
                cell.appendChild(image);
            },
            (cell, ctx) => {
                cell.textContent = ctx.war.turnsInSiege ? "Yes: " + ctx.war.turnsInSiege : "No";
            },
            (cell, ctx) => {
                cell.textContent = ctx.reduceKeywords(ctx.war.defendingTerritory.territoryName);
            },
            flagCell(ctx => ctx.playerCountryName()),
            armySlotCell("attack", 0, { allForAll: historic }),
            armySlotCell("attack", 1, { allForAll: historic }),
            armySlotCell("attack", 2, { allForAll: historic }),
            armySlotCell("attack", 3, { allForAll: historic }),
            flagCell(ctx => ctx.war.defendingTerritory.dataName),
            armySlotCell("defend", 0),
            armySlotCell("defend", 1),
            armySlotCell("defend", 2),
            armySlotCell("defend", 3)
        ][index]
    }));
}

function outcomeIcon(resolution) {
    switch (resolution) {
        case "Victory": return "./resources/victory.png";
        case "Defeat": return "./resources/defeat.png";
        case "Retreat": return "./resources/retreat.png";
        case "Arrested": return "./resources/arrest.png";
        default: return null;
    }
}
