// Who is winning, in order (register item E5).
//
// `rankedStandings()` and the goal columns beside it are pure, which is what lets the whole
// of this be a millisecond in Node rather than a browser driving a game to turn forty.
//
// Three rules under test are decisions rather than mechanics, and each would look like a bug
// to somebody who did not know it had been chosen:
//
//   * RANK IS PROGRESS TOWARD THE GOAL, NOT SIZE. Under Great Powers the largest empire on
//     the map need not be the country nearest to winning, and the table is about the second.
//   * SIZE IS THE TIE-BREAK, and it does real work: on turn 4 of a Continental game every
//     country is at the same progress, so without it the order is insertion order and the
//     table reshuffles itself between renders for no visible reason.
//   * THE PLAYER IS ALWAYS ON THE TABLE, carrying their TRUE rank even when that rank is 95.

import { describe, expect, it } from "vitest";

import { VictoryCondition } from "../../src/ai/victory.js";
import { playerStanding, rankedStandings, STANDINGS_LIMIT } from "../../src/ui/goals/standingsTable.js";
import { goalColumnsFor, goalColumnKinds } from "../../src/ui/goals/standingsGoalColumns.js";

/** A `worldStandings()`-shaped snapshot from `{country: [territories, area]}`. */
function world(entries) {
    const byCountry = new Map();
    let worldArea = 0;
    for (const [country, [territories, area]] of Object.entries(entries)) {
        byCountry.set(country, { territories, area });
        worldArea += area;
    }
    return { byCountry, worldArea, worldTerritories: 0 };
}

const noProgress = () => ({ fraction: 0, detail: {} });

describe("ranking", () => {
    it("orders by progress toward the goal, not by size", () => {
        const standings = world({ Indonesia: [52, 5200], Turkey: [31, 3100], Canada: [44, 4400] });
        const progress = { Turkey: 0.66, Indonesia: 0.33, Canada: 0.0 };

        const { rows } = rankedStandings({
            standings,
            progressFor: (country) => ({ fraction: progress[country], detail: {} })
        });

        // Indonesia is the biggest empire and is second; Turkey has broken more powers.
        expect(rows.map(row => row.country)).toEqual(["Turkey", "Indonesia", "Canada"]);
    });

    it("breaks a tie on territories, then on name, so the order is total", () => {
        const standings = world({ Belgium: [3, 300], Austria: [3, 300], Chile: [9, 900] });

        const { rows } = rankedStandings({ standings, progressFor: noProgress });

        expect(rows.map(row => row.country)).toEqual(["Chile", "Austria", "Belgium"]);
    });

    it("gives every row its position, counting from one", () => {
        const standings = world({ A: [3, 300], B: [2, 200], C: [1, 100] });
        const { rows } = rankedStandings({ standings, progressFor: noProgress });
        expect(rows.map(row => row.rank)).toEqual([1, 2, 3]);
    });

    it("copes with an empty world rather than throwing", () => {
        expect(rankedStandings({ standings: world({}), progressFor: noProgress }))
            .toEqual({ rows: [], playerRow: null, surviving: 0, defeatedRows: [] });
        expect(rankedStandings({ standings: null, progressFor: noProgress }).rows).toEqual([]);
    });

    it("survives a country whose progress calculation throws", () => {
        // Up to 207 calls while a panel is being drawn. One country in an odd state should
        // cost its own row's figure, not the whole table.
        const standings = world({ Good: [5, 500], Bad: [9, 900] });
        const { rows } = rankedStandings({
            standings,
            progressFor: (country) => {
                if (country === "Bad") throw new Error("no");
                return { fraction: 0.5, detail: {} };
            }
        });
        expect(rows.map(row => row.country)).toEqual(["Good", "Bad"]);
        expect(rows[1].fraction).toBe(0);
    });
});

describe("the player's row", () => {
    function bigWorld(playerTerritories) {
        const entries = { Player: [playerTerritories, playerTerritories * 100] };
        for (let n = 0; n < 40; n += 1) {
            entries["AI" + String(n).padStart(2, "0")] = [50 - n, (50 - n) * 100];
        }
        return world(entries);
    }

    it("is marked in place when the player made the top sixteen", () => {
        const { rows, playerRow } = rankedStandings({
            standings: bigWorld(60), progressFor: noProgress, player: "Player"
        });
        expect(rows[0].isPlayer).toBe(true);
        // Not ALSO returned separately -- the caller appends `playerRow` blindly, so a row
        // returned in both places would draw the player twice.
        expect(playerRow).toBeNull();
    });

    it("is returned separately, with its true rank, when the player missed the cut", () => {
        const { rows, playerRow } = rankedStandings({
            standings: bigWorld(1), progressFor: noProgress, player: "Player"
        });
        expect(rows.some(row => row.isPlayer)).toBe(false);
        expect(playerRow.isPlayer).toBe(true);
        expect(playerRow.rank).toBe(41);
    });

    it("is found by playerStanding() wherever it ended up", () => {
        for (const territories of [60, 1]) {
            const result = rankedStandings({
                standings: bigWorld(territories), progressFor: noProgress, player: "Player"
            });
            expect(playerStanding(result)?.country).toBe("Player");
        }
        expect(playerStanding(null)).toBeNull();
    });

    it("lists no more than the limit", () => {
        const { rows } = rankedStandings({
            standings: bigWorld(1), progressFor: noProgress, player: "Player"
        });
        expect(rows).toHaveLength(STANDINGS_LIMIT);
    });

    it("counts every surviving country, not just the listed ones", () => {
        const { surviving } = rankedStandings({
            standings: bigWorld(1), progressFor: noProgress, player: "Player"
        });
        expect(surviving).toBe(41);
    });
});

describe("the goal columns", () => {
    const row = (fraction, detail, territories = 10) => ({ fraction, detail, territories });

    it("gives every victory condition a pair of labels and a pair of renderers", () => {
        // A kind with no entry would fall back to Continental and quietly show the wrong
        // thing, so the enum is walked rather than spot-checked.
        for (const kind of Object.values(VictoryCondition)) {
            const columns = goalColumnsFor(kind);
            expect(columns.valueLabel, kind).toBeTruthy();
            expect(columns.detailLabel, kind).toBeTruthy();
            expect(typeof columns.value, kind).toBe("function");
            expect(typeof columns.detail, kind).toBe("function");
        }
        expect(goalColumnKinds().length).toBeGreaterThanOrEqual(
            Object.values(VictoryCondition).length);
    });

    it("shows the ranking basis under Continental, because the count alone is not it", () => {
        // `victoryProgress()` sums the shares of the best `required` continents rather than
        // counting completed ones, so nearly every row reads "0 of 3" for fifty turns while
        // the table is visibly ordered by something else. Measured on a real game, Norway
        // sat above the United Kingdom with a LOWER figure in the Closest column.
        const columns = goalColumnsFor(VictoryCondition.CONTINENTAL);
        const value = columns.value(row(0.19, { complete: 0, required: 3, continents: [] }));
        expect(value).toContain("0 of 3");
        expect(value).toContain("19%");
    });

    it("names the nearest continent, and nothing once they are all held", () => {
        const columns = goalColumnsFor(VictoryCondition.CONTINENTAL);
        expect(columns.detail(row(0.5, {
            complete: 0, required: 3,
            continents: [{ continent: "Europe", share: 0.82, complete: false }]
        }))).toBe("Europe 82%");
        expect(columns.detail(row(1, {
            complete: 3, required: 3,
            continents: [{ continent: "Europe", share: 1, complete: true }]
        }))).toBe("");
    });

    it("names the next great power still standing", () => {
        const columns = goalColumnsFor(VictoryCondition.GREAT_POWERS);
        const detail = { broken: 1, required: 3, powers: [
            { power: "Russia", held: 25, total: 25, complete: true },
            { power: "United States", held: 14, total: 47, complete: false }
        ] };
        expect(columns.value(row(0.33, detail))).toBe("1 of 3");
        expect(columns.detail(row(0.33, detail))).toBe("United States 14/47");
    });

    it("counts the clock in a Timed Game, and says nothing without a turn", () => {
        const columns = goalColumnsFor(VictoryCondition.TURN_LIMIT);
        expect(columns.detail(row(0.7, { turnLimit: 200 }), { turn: 166 })).toBe("34 turns left");
        expect(columns.detail(row(0.7, { turnLimit: 200 }), { turn: 199 })).toBe("1 turn left");
        expect(columns.detail(row(0.7, { turnLimit: 200 }), {})).toBe("");
        // Past the limit reads as none left rather than as a negative number.
        expect(columns.detail(row(1, { turnLimit: 200 }), { turn: 240 })).toBe("0 turns left");
    });

    it("falls back to Continental for a kind it has never heard of", () => {
        // The same fallback `victoryProgress()` makes, so the table and the number it is
        // ordered by cannot disagree about which goal is being played.
        expect(goalColumnsFor("NOT_A_GOAL").valueLabel)
            .toBe(goalColumnsFor(VictoryCondition.CONTINENTAL).valueLabel);
    });

    it("never renders undefined or NaN from an empty detail object", () => {
        for (const kind of Object.values(VictoryCondition)) {
            const columns = goalColumnsFor(kind);
            for (const text of [columns.value(row(0, {}), {}), columns.detail(row(0, {}), {})]) {
                expect(String(text), kind).not.toContain("undefined");
                expect(String(text), kind).not.toContain("NaN");
            }
        }
    });
});

// ---------------------------------------------------------------------------
// WHO IS OUT OF THE GAME.
//
// Reported by Leigh: taking a one-territory country's only province left it still shown as an
// enemy in the diplomacy panel and on the tooltip, and vanished from the standings table
// entirely rather than being marked beaten. `worldStandings()` is a fold over TERRITORIES, so
// a country holding none is ABSENT from it rather than last in it — which is why these have to
// be added rather than filtered.
// ---------------------------------------------------------------------------

describe("countries that are out", () => {
    it("are a separate list, so the ranking is untouched", () => {
        const result = rankedStandings({
            standings: world({ Alba: [10, 100], Brava: [4, 40] }),
            progressFor: noProgress,
            defeated: ["Carda", "Dorne"]
        });
        expect(result.rows.map(row => row.country)).toEqual(["Alba", "Brava"]);
        expect(result.surviving).toBe(2);
        expect(result.defeatedRows.map(row => row.country)).toEqual(["Carda", "Dorne"]);
    });

    it("are marked, so a cell can say so rather than printing a zero", () => {
        const [row] = rankedStandings({
            standings: world({ Alba: [10, 100] }),
            progressFor: noProgress,
            defeated: ["Carda"]
        }).defeatedRows;
        expect(row.defeated).toBe(true);
        expect(row.territories).toBe(0);
        expect(row.army).toBe(0);
    });

    it("are alphabetical, because nothing records the turn a country fell", () => {
        //A `Set` iteration order would reshuffle the list between renders for no visible
        //reason, which is the same argument the ranking's own name tie-break records.
        const result = rankedStandings({
            standings: world({ Alba: [10, 100] }),
            progressFor: noProgress,
            defeated: new Set(["Zeta", "Brava", "Carda"])
        });
        expect(result.defeatedRows.map(row => row.country)).toEqual(["Brava", "Carda", "Zeta"]);
    });

    it("rank after every survivor", () => {
        const result = rankedStandings({
            standings: world({ Alba: [10, 100], Brava: [4, 40] }),
            progressFor: noProgress,
            defeated: ["Carda"]
        });
        expect(result.defeatedRows[0].rank).toBeGreaterThan(result.rows.at(-1).rank);
    });

    it("marks the player when the player is the one who is out", () => {
        const result = rankedStandings({
            standings: world({ Alba: [10, 100] }),
            progressFor: noProgress,
            player: "Carda",
            defeated: ["Carda"]
        });
        expect(result.defeatedRows[0].isPlayer).toBe(true);
    });
});
