// The spectator log: the ring, and the two facts a block carries that the console
// cannot work out for itself.
//
// `startsTurn` is the interesting one. The console draws a rule ACROSS the log rather
// than a container around each turn, so it needs to know which block opened a turn --
// and it must still know that after the block before it has fallen off the front of
// the ring, which is why the flag is stamped at write time rather than derived from
// the neighbours at render time.

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    AiGameTone,
    MAX_BLOCKS_KEPT,
    aiGameBlockCount,
    aiGameBlocks,
    clearAiGameLog,
    onAiGameBlock,
    recordAiGameBlock
} from "../../src/debug/aiGameLog.js";

beforeEach(() => {
    clearAiGameLog();
});

describe("recording a block", () => {
    it("keeps the log oldest-first, because a log reads downwards", () => {
        recordAiGameBlock({ turn: 1, country: "France" });
        recordAiGameBlock({ turn: 1, country: "Spain" });
        expect(aiGameBlocks().map((block) => block.country)).toEqual(["France", "Spain"]);
    });

    it("marks the first block of each turn, and only the first", () => {
        recordAiGameBlock({ turn: 1, country: "France" });
        recordAiGameBlock({ turn: 1, country: "Spain" });
        recordAiGameBlock({ turn: 2, country: "France" });
        expect(aiGameBlocks().map((block) => block.startsTurn)).toEqual([true, false, true]);
    });

    it("gives every block a distinct id, so two identical reports stay distinct", () => {
        recordAiGameBlock({ turn: 1, country: "France" });
        recordAiGameBlock({ turn: 1, country: "France" });
        const [first, second] = aiGameBlocks();
        expect(first.id).not.toBe(second.id);
    });

    it("fills in the fields a report may not have", () => {
        const stored = recordAiGameBlock({ country: "France" });
        expect(stored.turn).toBe(0);
        expect(stored.leaderName).toBe("");
        expect(stored.posture).toBe("");
        expect(stored.lines).toEqual([]);
    });

    it("names an unknown country rather than storing undefined", () => {
        expect(recordAiGameBlock({}).country).toBe("unknown");
    });
});

describe("the lines", () => {
    it("drops anything with no text, so an absent fact draws no empty row", () => {
        const stored = recordAiGameBlock({
            turn: 1,
            country: "France",
            lines: [
                { label: "Plan", text: "Attack Spain" },
                { label: "Income", text: "" },
                null,
                { label: "War" }
            ]
        });
        expect(stored.lines).toHaveLength(1);
    });

    it("falls back to the neutral tone rather than an unstyled row", () => {
        const stored = recordAiGameBlock({
            turn: 1,
            country: "France",
            lines: [
                { text: "a", tone: "invented" },
                { text: "b", tone: AiGameTone.SIEGE },
                { text: "c" }
            ]
        });
        expect(stored.lines.map((line) => line.tone)).toEqual([
            AiGameTone.NEUTRAL,
            AiGameTone.SIEGE,
            AiGameTone.NEUTRAL
        ]);
    });

    it("freezes a stored block, because the console renders from it and never edits it", () => {
        const stored = recordAiGameBlock({ turn: 1, country: "France", lines: [{ text: "a" }] });
        expect(Object.isFrozen(stored)).toBe(true);
        expect(Object.isFrozen(stored.lines)).toBe(true);
    });
});

describe("the ring", () => {
    it("holds at the bound, dropping the oldest", () => {
        for (let i = 0; i < MAX_BLOCKS_KEPT + 25; i++) {
            recordAiGameBlock({ turn: 1, country: "C" + i });
        }
        expect(aiGameBlockCount()).toBe(MAX_BLOCKS_KEPT);
        expect(aiGameBlocks()[0].country).toBe("C25");
    });

    it("keeps `startsTurn` on the survivors, so the turn rules stay where they were", () => {
        // Turn 1 is written first and is entirely dropped; the block that opened turn
        // 2 must still say so, or the console loses the rule above it.
        for (let i = 0; i < MAX_BLOCKS_KEPT; i++) {
            recordAiGameBlock({ turn: 1, country: "old" + i });
        }
        const opener = recordAiGameBlock({ turn: 2, country: "France" });
        expect(opener.startsTurn).toBe(true);
        expect(aiGameBlocks().at(-1).startsTurn).toBe(true);
    });
});

describe("clearing", () => {
    it("empties the log and restarts the turn tracking", () => {
        recordAiGameBlock({ turn: 4, country: "France" });
        clearAiGameLog();
        expect(aiGameBlocks()).toEqual([]);
        // Turn 4 again, and it still opens a turn: the previous run is gone.
        expect(recordAiGameBlock({ turn: 4, country: "France" }).startsTurn).toBe(true);
    });
});

describe("subscribers", () => {
    it("is told the block on an append and null on a clear", () => {
        const seen = [];
        const off = onAiGameBlock((block) => seen.push(block?.country ?? null));
        recordAiGameBlock({ turn: 1, country: "France" });
        clearAiGameLog();
        expect(seen).toEqual(["France", null]);
        off();
    });

    it("does not let a listener that throws take the AI turn with it", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const off = onAiGameBlock(() => {
            throw new Error("the console repainted badly");
        });
        expect(() => recordAiGameBlock({ turn: 1, country: "France" })).not.toThrow();
        off();
    });
});
