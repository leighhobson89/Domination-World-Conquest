// What the spectator console SAYS about one AI country's turn.
//
// The wording is the part with judgement in it, which is why it lives apart from the
// window that draws it -- the same split `describeActivity()` has from the activity
// feed, and for the same reason.
//
// Two of these assert something that has already been wrong once in this codebase and
// would be wrong again by default. The economy is a difference between two snapshots,
// and the difference has to ignore any territory the country did not hold at the start
// of the turn -- otherwise conquering a developed province reads as having built it.
// And a war line is written from the acting country's point of view, not the player's:
// there is no player in this mode, so "attacker" and "victory" are not the same axis
// the feed treats them as.

import { describe, expect, it } from "vitest";

import { ActivityKind } from "../../src/state/activityLog.js";
import { AiGameTone } from "../../src/debug/aiGameLog.js";
import {
    buildCountryReport,
    diffHoldings,
    warLines
} from "../../src/debug/aiGameReport.js";

/** A holdings row with only the fields a case cares about; the rest are zero. */
function holding(fields = {}) {
    return {
        goldForCurrentTerritory: 0,
        oilForCurrentTerritory: 0,
        consMatsForCurrentTerritory: 0,
        foodForCurrentTerritory: 0,
        armyForCurrentTerritory: 0,
        infantryForCurrentTerritory: 0,
        assaultForCurrentTerritory: 0,
        airForCurrentTerritory: 0,
        navalForCurrentTerritory: 0,
        farmsBuilt: 0,
        oilWellsBuilt: 0,
        forestsBuilt: 0,
        fortsBuilt: 0,
        ...fields
    };
}

/** The text of the line with the given label, or undefined. */
function line(block, label) {
    return block.lines.find((row) => row.label === label)?.text;
}

describe("diffHoldings", () => {
    it("sums the change across territories held both before and after", () => {
        const before = new Map([
            ["1", holding({ goldForCurrentTerritory: 1000, farmsBuilt: 1 })],
            ["2", holding({ goldForCurrentTerritory: 500 })]
        ]);
        const after = new Map([
            ["1", holding({ goldForCurrentTerritory: 400, farmsBuilt: 3 })],
            ["2", holding({ goldForCurrentTerritory: 500 })]
        ]);
        const delta = diffHoldings(before, after);
        expect(delta.goldForCurrentTerritory).toBe(-600);
        expect(delta.farmsBuilt).toBe(2);
    });

    it("IGNORES a territory that was conquered during the turn", () => {
        // The whole reason the snapshot is per-territory. A captured province arrives
        // with somebody else's farms, gold and garrison on it, and counting those
        // would report a country that built nothing as having built three farms.
        const before = new Map([["1", holding({ farmsBuilt: 0 })]]);
        const after = new Map([
            ["1", holding({ farmsBuilt: 0 })],
            ["99", holding({ farmsBuilt: 4, goldForCurrentTerritory: 9000 })]
        ]);
        const delta = diffHoldings(before, after);
        expect(delta.farmsBuilt).toBe(0);
        expect(delta.goldForCurrentTerritory).toBe(0);
    });

    it("ignores a territory that was LOST during the turn", () => {
        const before = new Map([
            ["1", holding({ goldForCurrentTerritory: 100 })],
            ["2", holding({ goldForCurrentTerritory: 700 })]
        ]);
        const after = new Map([["1", holding({ goldForCurrentTerritory: 100 })]]);
        expect(diffHoldings(before, after).goldForCurrentTerritory).toBe(0);
    });

    it("survives being handed nothing", () => {
        expect(diffHoldings(null, null).goldForCurrentTerritory).toBe(0);
    });
});

describe("warLines", () => {
    const entry = (fields) => ({
        kind: ActivityKind.CONQUEST,
        territory: "Barcelona",
        defender: "Spain",
        attacker: "France",
        ...fields
    });

    it("reads a conquest as a victory for the attacker and a loss for the defender", () => {
        const [attackerView] = warLines([entry({})], "France");
        const [defenderView] = warLines([entry({})], "Spain");
        expect(attackerView.tone).toBe(AiGameTone.VICTORY);
        expect(attackerView.text).toBe("took Barcelona from Spain");
        expect(defenderView.tone).toBe(AiGameTone.LOSS);
        expect(defenderView.text).toBe("lost Barcelona to France");
    });

    it("reads a failed attack as a loss for the attacker and a victory for the defender", () => {
        // The activity FEED colours this red whoever it happened to, because it
        // describes the attack and the attack failed. That rule is about a player
        // reading their own war; here both countries are being reported in turn and a
        // defender who held has just won.
        const failed = entry({ kind: ActivityKind.ATTACK_FAILED });
        expect(warLines([failed], "France")[0].tone).toBe(AiGameTone.LOSS);
        expect(warLines([failed], "Spain")[0].tone).toBe(AiGameTone.VICTORY);
    });

    it("does not repeat a country's name when the territory IS the country", () => {
        // A country and its only province share a name all over this map, and "took
        // Eswatini from Eswatini" reads as a bug even though it is the truth.
        const [only] = warLines(
            [entry({ territory: "Eswatini", defender: "Eswatini", attacker: "Zimbabwe" })],
            "Zimbabwe"
        );
        expect(only.text).toBe("took Eswatini");
    });

    it("keeps every siege state amber except the two that decide a territory", () => {
        const siege = (kind) => warLines([entry({ kind })], "France")[0].tone;
        expect(siege(ActivityKind.SIEGE_STARTED)).toBe(AiGameTone.SIEGE);
        expect(siege(ActivityKind.SIEGE_ABANDONED)).toBe(AiGameTone.SIEGE);
        expect(siege(ActivityKind.SIEGE_WON)).toBe(AiGameTone.VICTORY);
        expect(siege(ActivityKind.SIEGE_LOST)).toBe(AiGameTone.LOSS);
    });

    it("drops an entry the country was no party to", () => {
        expect(warLines([entry({})], "Portugal")).toEqual([]);
    });
});

describe("buildCountryReport", () => {
    const campaign = {
        posture: "EXPAND",
        walls: ["Portugal"],
        theatre: { rival: "Spain", takenFromRival: 2, failures: 1, changed: false, reason: "" },
        musters: [{ from: "Lyon", to: "Toulouse", infantry: 3000, reason: "reinforcing the front" }],
        siegeReviews: [
            { verdict: "press", target: "Bilbao", turnsInSiege: 3, progress: 0.4, assaultOdds: 61, reason: "wearing them down" }
        ],
        decisions: [
            { verdict: "Skip", target: "Porto", odds: 8, reason: "below the floor" },
            { verdict: "Attack", target: "Girona", odds: 70, reason: "worth it" }
        ]
    };

    const plan = {
        shortTerm: ["Attack Girona from Perpignan (priority 4.0)"],
        mediumTerm: {
            posture: "EXPAND",
            focusContinent: "Europe",
            budgets: {
                attack: 2,
                siege: 1,
                activeSieges: 1,
                concurrentSiegeCap: 3,
                attackOddsFloor: 55
            }
        },
        longTerm: {
            objective: { kind: "CONTINENTAL", continents: ["Europe"], banked: [] },
            progress: { label: "1 of 3", fraction: 0.33 }
        }
    };

    it("puts the thinking, the plan, the economy and the war in one block", () => {
        const block = buildCountryReport({
            country: "France",
            turn: 7,
            leader: { name: "Queen Emma", leaderType: "aggressive" },
            campaign,
            plan,
            delta: diffHoldings(
                new Map([["1", holding({ goldForCurrentTerritory: 4000 })]]),
                new Map([["1", holding({ goldForCurrentTerritory: 900, fortsBuilt: 1, infantryForCurrentTerritory: 2500 })]])
            ),
            turnGains: { changeGold: 1200, changeOil: 0, changeConsMats: -40, changeFood: 0, changePop: 0 },
            entries: [
                {
                    kind: ActivityKind.CONQUEST,
                    territory: "Girona",
                    defender: "Spain",
                    attacker: "France"
                }
            ],
            territoriesHeld: 12
        });

        expect(block.country).toBe("France");
        expect(block.turn).toBe(7);
        expect(block.posture).toBe("EXPAND");
        expect(block.leaderName).toBe("Queen Emma");

        expect(line(block, "Holds")).toBe("12 territories");
        expect(line(block, "Objective")).toContain("CONTINENTAL");
        expect(line(block, "Absorbing")).toContain("Spain");
        expect(line(block, "Written off")).toContain("Portugal");
        expect(line(block, "Budget")).toContain("55% odds");
        expect(line(block, "Siege review")).toContain("PRESS at Bilbao");
        expect(line(block, "Plan")).toContain("Attack Girona");
        expect(line(block, "Marched")).toBe(
            "3.0k infantry, Lyon -> Toulouse (reinforcing the front)"
        );
        expect(line(block, "Income")).toBe("+1.2k gold, -40 cons.mats");
        expect(line(block, "Economy")).toBe(
            "built 1 fort, recruited 2.5k infantry, spending 3.1k gold"
        );
        expect(line(block, "Conquest")).toBe("took Girona from Spain");
    });

    it("only lists the targets it PASSED OVER -- the rest are already the plan", () => {
        const block = buildCountryReport({ country: "France", turn: 1, campaign, plan });
        expect(line(block, "Passed over")).toContain("Porto");
        expect(line(block, "Passed over")).not.toContain("Girona");
    });

    it("says a quiet turn was quiet rather than leaving a gap", () => {
        // A block per country every turn, always. A missing one reads to a spectator
        // as having looked away at the wrong moment.
        const block = buildCountryReport({
            country: "Andorra",
            turn: 3,
            delta: diffHoldings(new Map([["1", holding()]]), new Map([["1", holding()]])),
            entries: [],
            territoriesHeld: 1
        });
        expect(line(block, "Holds")).toBe("1 territory");
        expect(line(block, "Economy")).toBe("built nothing and recruited nothing");
        expect(line(block, "War")).toBe("no fighting");
    });

    it("says so when a country had no plan at all", () => {
        const block = buildCountryReport({ country: "Nauru", turn: 2 });
        expect(line(block, "Plan")).toContain("no enemy territory in range");
    });

    it("takes a note instead of a report, for a country that never moved", () => {
        const block = buildCountryReport({
            country: "Tuvalu",
            turn: 9,
            note: "eliminated -- holds no territory"
        });
        expect(block.lines).toHaveLength(1);
        expect(block.lines[0].text).toBe("eliminated -- holds no territory");
    });
});
