// The military activity log: what it accepts, how it groups, and what survives a save.
//
// Phase 7.4. The log is the model behind the activity panel, and it runs in Node
// because it has no DOM in it -- which is the property that lets these tests
// exist. What the panel DOES with the log is `tests/e2e/activity-feed/`.
//
// The two properties worth stating up front, because everything below turns on
// them: the log stores FACTS and never sentences, and what counts as military is
// decided by the log rather than by its callers.

import { beforeEach, describe, expect, it } from "vitest";

import {
    ActivityKind,
    MAX_TURNS_KEPT,
    activityCount,
    activityForTurn,
    activityTurnNumbers,
    activityTurns,
    captureActivityLog,
    clearActivityLog,
    involvesPlayer,
    recordActivity,
    restoreActivityLog,
} from "../../src/state/activityLog.js";

/** A conquest, with only what the test cares about spelled out. */
function conquest(overrides = {}) {
    return {
        kind: ActivityKind.CONQUEST,
        territory: "Balearic Islands",
        defender: "Spain",
        attacker: "Libya",
        turn: 4,
        ...overrides,
    };
}

describe("recording", () => {
    beforeEach(() => clearActivityLog());

    it("keeps a military entry", () => {
        const stored = recordActivity(conquest());
        expect(stored).not.toBeNull();
        expect(stored.territory).toBe("Balearic Islands");
        expect(stored.defender).toBe("Spain");
        expect(stored.attacker).toBe("Libya");
        expect(activityCount()).toBe(1);
    });

    it("refuses a kind that is not military", () => {
        // The brief is explicit that economy, planning and "thoughts" stay out. The
        // guard is here rather than at the call sites so a new caller cannot let one
        // in by inventing a string.
        expect(recordActivity({ kind: "economyUpgrade", territory: "Bavaria" })).toBeNull();
        expect(recordActivity({ kind: "aiThinking" })).toBeNull();
        expect(recordActivity(null)).toBeNull();
        expect(activityCount()).toBe(0);
    });

    it("accepts every kind it declares, and no others", () => {
        for (const kind of Object.values(ActivityKind)) {
            expect(recordActivity({ kind, territory: "X", turn: 1 }), kind).not.toBeNull();
        }
        expect(activityCount()).toBe(Object.values(ActivityKind).length);
    });

    it("gives every entry a distinct id, so two identical events stay two events", () => {
        const first = recordActivity(conquest());
        const second = recordActivity(conquest());
        expect(first.id).not.toBe(second.id);
        expect(activityForTurn(4)).toHaveLength(2);
    });

    it("stores an entry frozen, so a reader cannot rewrite history", () => {
        const stored = recordActivity(conquest());
        expect(() => {
            "use strict";
            stored.attacker = "France";
        }).toThrow();
    });
});

describe("who the player is to an entry", () => {
    beforeEach(() => clearActivityLog());

    it("marks both sides separately", () => {
        const attacking = recordActivity(conquest({ playerAttacking: true }));
        const defending = recordActivity(conquest({ playerDefending: true }));
        const neither = recordActivity(conquest());

        expect(involvesPlayer(attacking)).toBe(true);
        expect(involvesPlayer(defending)).toBe(true);
        expect(involvesPlayer(neither)).toBe(false);
    });

    it("keeps the two flags apart", () => {
        // They decide different things: `playerDefending` on a conquest is what turns
        // a victory into a loss, and either one makes the row larger. Collapsing them
        // into one "involves you" boolean is what would lose that.
        const defending = recordActivity(conquest({ playerDefending: true }));
        expect(defending.playerDefending).toBe(true);
        expect(defending.playerAttacking).toBe(false);
    });
});

describe("grouping by turn", () => {
    beforeEach(() => clearActivityLog());

    it("returns turns newest first and entries oldest first inside a turn", () => {
        // Both orderings matter and they are opposite on purpose: the newest turn is
        // what the panel opens on, and within a turn the entries are a narrative --
        // reading a battle's outcome above its start is nonsense.
        recordActivity(conquest({ turn: 1, territory: "A" }));
        recordActivity(conquest({ turn: 3, territory: "B" }));
        recordActivity(conquest({ turn: 3, territory: "C" }));
        recordActivity(conquest({ turn: 2, territory: "D" }));

        const turns = activityTurns();
        expect(turns.map((t) => t.turn)).toEqual([3, 2, 1]);
        expect(turns[0].entries.map((e) => e.territory)).toEqual(["B", "C"]);
    });

    it("hands out copies, so a caller cannot mutate the log through them", () => {
        recordActivity(conquest({ turn: 2 }));
        const first = activityTurns();
        first[0].entries.push({ kind: "nonsense" });
        expect(activityTurns()[0].entries).toHaveLength(1);
    });

    it("drops the oldest turns once the cap is reached", () => {
        // The log is saved with the game, so it cannot grow for ever. Fifty turns of
        // a busy map is a few kilobytes against a ~460 KB envelope; two hundred is
        // not, and nobody wants turn 3 back at turn 240.
        for (let turn = 1; turn <= MAX_TURNS_KEPT + 5; turn += 1) {
            recordActivity(conquest({ turn }));
        }
        const kept = activityTurnNumbers();
        expect(kept).toHaveLength(MAX_TURNS_KEPT);
        expect(kept[0]).toBe(6);
        expect(kept[kept.length - 1]).toBe(MAX_TURNS_KEPT + 5);
    });
});

describe("save and restore", () => {
    beforeEach(() => clearActivityLog());

    it("round-trips through JSON", () => {
        recordActivity(conquest({ turn: 2 }));
        recordActivity({ ...conquest({ turn: 3 }), kind: ActivityKind.SIEGE_ONGOING, turnsUnderSiege: 4 });

        const envelope = JSON.parse(JSON.stringify(captureActivityLog()));
        clearActivityLog();
        expect(activityCount()).toBe(0);

        restoreActivityLog(envelope);
        expect(activityCount()).toBe(2);
        expect(activityTurns().map((t) => t.turn)).toEqual([3, 2]);
        expect(activityForTurn(3)[0].turnsUnderSiege).toBe(4);
    });

    it("replaces the log rather than merging into it", () => {
        recordActivity(conquest({ turn: 2 }));
        const envelope = captureActivityLog();
        recordActivity(conquest({ turn: 9, territory: "Later" }));

        restoreActivityLog(envelope);
        expect(activityTurnNumbers()).toEqual([2]);
    });

    it("loads a save that predates the feed rather than failing", () => {
        // An activity log is a nicety. A save written before this existed carries no
        // "activity" slice at all, and the whole load must not fail over it.
        recordActivity(conquest());
        expect(() => restoreActivityLog(undefined)).not.toThrow();
        expect(activityCount()).toBe(0);

        expect(() => restoreActivityLog({ turns: "not an array" })).not.toThrow();
        expect(() => restoreActivityLog({ turns: [["x", null], [2]] })).not.toThrow();
    });

    it("drops entries whose kind it no longer knows", () => {
        restoreActivityLog({
            nextId: 9,
            turns: [[2, [
                { id: 1, kind: ActivityKind.CONQUEST, territory: "Kept", turn: 2 },
                { id: 2, kind: "economyUpgrade", territory: "Dropped", turn: 2 },
            ]]],
        });
        expect(activityForTurn(2).map((e) => e.territory)).toEqual(["Kept"]);
    });

    it("carries the id counter forward so restored and new entries never collide", () => {
        restoreActivityLog({
            turns: [[1, [{ id: 40, kind: ActivityKind.CONQUEST, territory: "Old", turn: 1 }]]],
        });
        const fresh = recordActivity(conquest({ turn: 1 }));
        expect(fresh.id).toBeGreaterThan(40);
    });
});
