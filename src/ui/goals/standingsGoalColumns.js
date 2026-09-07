// What the two goal columns say, per goal.
//
// Register item E5, and Leigh's decision: the fixed columns (rank, country, territories,
// army) are the same in every game, and the GOAL adds two of its own.
//
// **Two and not one, because one is not enough to mean anything.** "1 of 3" is the same
// sentence whether the next great power is a province away or completely untouched, and
// Continental has the same problem: a country that has just landed on a continent and one
// two territories from owning it both read "0 of 3". The second column carries the fact that
// makes the first one worth looking at, and `victoryProgress().detail` already computes it --
// that object exists precisely because the aggregate is not the whole story.
//
// **This is the only place in the standings table that switches on a goal**, the same
// containment `src/ai/doctrine.js` has on the AI side. Everything else about the table is
// goal-agnostic: the ranking is a number, the fixed columns are facts about land.
//
// Pure, imports only the condition enum, unit-tested in Node.

import { VictoryCondition } from "../../ai/victory.js";

/** A whole-number percentage, for a table cell rather than for prose. */
function percent(fraction) {
    const value = Number(fraction);
    if (!Number.isFinite(value)) {
        return "0%";
    }
    return Math.round(value * 100) + "%";
}

/**
 * The two goal columns, keyed by condition kind.
 *
 * `value` is the headline the ranking is built on. `detail` is the fact that makes it
 * legible, and it is ALLOWED TO BE EMPTY -- a country that has finished, or one the detail
 * does not apply to, gets a blank cell rather than a dash, because a column of dashes reads
 * as missing data.
 */
const GOAL_COLUMNS = Object.freeze({
    [VictoryCondition.CONTINENTAL]: {
        valueLabel: "Continents",
        detailLabel: "Closest",
        //THE PERCENTAGE IS NOT DECORATION, IT IS THE RANKING BASIS MADE VISIBLE. Continental
        //is the one goal whose progress is not the count beside it: `victoryProgress()` sums
        //the shares of the best `required` continents rather than counting completed ones,
        //deliberately, so that a country two territories from owning Europe scores above one
        //that has just landed on it. Show the count alone and nearly every row reads "0 of 3"
        //for the first fifty turns while the table is visibly ordered by something else --
        //measured on a real game, Norway sat above the United Kingdom with a lower figure in
        //the Closest column, which reads as a sorting bug and is not one.
        value: (row) => (row.detail?.complete ?? 0) + " of " + (row.detail?.required ?? 0) +
            " · " + percent(row.fraction),
        detail: (row) => {
            //`detail.continents` is the best `required` of them, already sorted, so the
            //first row is the nearest one. A country that has completed everything it
            //needs gets no "closest" -- there is nothing left to be close to.
            const best = (row.detail?.continents ?? []).find(entry => !entry.complete);
            return best ? best.continent + " " + percent(best.share) : "";
        }
    },

    [VictoryCondition.GREAT_POWERS]: {
        valueLabel: "Powers broken",
        detailLabel: "Next",
        value: (row) => (row.detail?.broken ?? 0) + " of " + (row.detail?.required ?? 0),
        detail: (row) => {
            const next = (row.detail?.powers ?? []).find(entry => !entry.complete);
            return next ? next.power + " " + next.held + "/" + next.total : "";
        }
    },

    [VictoryCondition.DOMINATION]: {
        valueLabel: "Share of world",
        detailLabel: "Target",
        value: (row) => percent(row.detail?.landShare ?? 0),
        detail: (row) => "of " + percent(row.detail?.required ?? 0)
    },

    [VictoryCondition.CONQUEST]: {
        valueLabel: "Territories held",
        detailLabel: "Remaining",
        value: (row) => (row.detail?.held ?? 0) + " of " + (row.detail?.total ?? 0),
        detail: (row) => {
            const left = (row.detail?.total ?? 0) - (row.detail?.held ?? 0);
            return left > 0 ? left + " left" : "";
        }
    },

    [VictoryCondition.TURN_LIMIT]: {
        valueLabel: "Against the leader",
        detailLabel: "Clock",
        //A timed game is scored as a share of the leader's land, so the leader reads 100%
        //every turn of every game -- which is exactly the trap `describeLeaderProgress()`
        //records for the phase bar. In a TABLE it is not a trap at all: the column is read
        //DOWN, against the other rows, and "100%" at the top with "62%" under it says
        //precisely the right thing.
        value: (row) => percent(row.fraction),
        detail: (row, context) => {
            const limit = Number(row.detail?.turnLimit);
            const turn = Number(context?.turn);
            if (!Number.isFinite(limit) || !Number.isFinite(turn)) {
                return "";
            }
            const left = Math.max(0, limit - turn);
            return left === 1 ? "1 turn left" : left + " turns left";
        }
    },

    [VictoryCondition.ELIMINATION]: {
        valueLabel: "Status",
        detailLabel: "Territories",
        value: (row) => (row.territories > 0 ? "In the game" : "Eliminated"),
        detail: (row) => String(row.territories)
    }
});

/**
 * The goal columns for a condition.
 *
 * Falls back to CONTINENTAL, which is what `victoryProgress()` itself does for an unknown
 * kind -- so the table and the number it is ordered by can never disagree about which goal
 * is being played.
 *
 * @param {string} kind  a `VictoryCondition`
 * @returns {{valueLabel: string, detailLabel: string,
 *           value: (row: object, context?: object) => string,
 *           detail: (row: object, context?: object) => string}}
 */
export function goalColumnsFor(kind) {
    return GOAL_COLUMNS[kind] ?? GOAL_COLUMNS[VictoryCondition.CONTINENTAL];
}

/** Every kind this module knows about, for the test that walks the enum. */
export function goalColumnKinds() {
    return Object.keys(GOAL_COLUMNS);
}
