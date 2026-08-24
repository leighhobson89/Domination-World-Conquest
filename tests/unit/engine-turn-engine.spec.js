// engine/TurnEngine.js -- Phase 5.7/5.6.
//
// The engine is deliberately ignorant of the game, so all of this runs in Node with no DOM
// and no store: the steps are functions that push to an array.

import { describe, expect, it, vi } from "vitest";

import { EngineStatus, createTurnEngine } from "../../src/engine/TurnEngine.js";

/** Let queued microtasks run, so the engine reaches its next await. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The three-phase shape the real game uses: two player gates, then the AI. */
function gameShapedEngine(log, overrides = {}) {
    return createTurnEngine({
        beginTurn: () => log.push("begin"),
        steps: [
            { name: "buyUpgrade", waitsForPlayer: true, run: () => log.push("buyUpgrade") },
            { name: "military", waitsForPlayer: true, run: () => log.push("military") },
            { name: "ai", run: () => log.push("ai") }
        ],
        endTurn: () => log.push("end"),
        ...overrides
    });
}

describe("createTurnEngine", () => {
    it("refuses to build an engine with nothing to run", () => {
        expect(() => createTurnEngine({ steps: [] })).toThrow(/nothing to run/);
    });

    it("starts IDLE and does nothing until started", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        expect(engine.status()).toBe(EngineStatus.IDLE);
        await settle();
        expect(log).toEqual([]);
    });
});

describe("the turn cycle", () => {
    it("runs beginTurn, then blocks on the first player phase", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        engine.start();
        await settle();

        expect(log).toEqual(["begin"]);
        expect(engine.currentStep()).toBe("buyUpgrade");
        expect(engine.isAwaitingPlayer()).toBe(true);
        engine.stop();
    });

    it("walks begin -> buy -> military -> ai -> end on two advances", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        engine.start();
        await settle();

        engine.advancePhase();
        await settle();
        expect(log).toEqual(["begin", "buyUpgrade"]);

        engine.advancePhase();
        await settle();
        //The AI step does not wait, so it runs straight through into the next turn's begin.
        expect(log).toEqual(["begin", "buyUpgrade", "military", "ai", "end", "begin"]);
        expect(engine.turnsRun()).toBe(1);
        engine.stop();
    });

    it("cycles indefinitely rather than recursing once per turn", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        engine.start();
        for (let turn = 0; turn < 5; turn++) {
            await settle();
            engine.advancePhase();
            await settle();
            engine.advancePhase();
        }
        await settle();
        expect(engine.turnsRun()).toBe(5);
        expect(log.filter((entry) => entry === "end")).toHaveLength(5);
        await engine.stop();
    });

    it("ignores an advance when nothing is waiting", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        expect(engine.advancePhase()).toBe(false);
        engine.start();
        await settle();
        expect(engine.advancePhase()).toBe(true);
        await engine.stop();
    });

    it("does not start a second loop over the same world", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        const first = engine.start();
        const second = engine.start();
        expect(second).toBe(first);
        await settle();
        expect(log).toEqual(["begin"]);
        await engine.stop();
    });
});

describe("stopping", () => {
    it("unwinds a stop taken while waiting for the player, without running the step", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        engine.start();
        await settle();
        expect(engine.isAwaitingPlayer()).toBe(true);

        await engine.stop();
        expect(engine.status()).toBe(EngineStatus.STOPPED);
        //The gated step must not fire on the way out.
        expect(log).toEqual(["begin"]);
    });

    it("stops between turns rather than mid-turn", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        engine.start();
        await settle();
        engine.advancePhase();
        await settle();
        engine.stop();
        engine.advancePhase();
        await settle();
        expect(engine.turnsRun()).toBe(0);
        expect(log).not.toContain("end");
    });

    it("is safe to stop an engine that was never started", async () => {
        const engine = gameShapedEngine([]);
        await expect(engine.stop()).resolves.toBeUndefined();
        expect(engine.status()).toBe(EngineStatus.STOPPED);
    });
});

describe("reset", () => {
    it("returns the engine to IDLE and calls onReset", async () => {
        const log = [];
        const onReset = vi.fn(() => log.push("reset"));
        const engine = gameShapedEngine(log, { onReset: onReset });
        engine.start();
        await settle();
        engine.advancePhase();
        await settle();

        await engine.reset();
        expect(onReset).toHaveBeenCalledTimes(1);
        expect(engine.status()).toBe(EngineStatus.IDLE);
        expect(engine.turnsRun()).toBe(0);
        expect(engine.currentStep()).toBeNull();
    });

    it("lets a fresh game start afterwards -- which is the whole point", async () => {
        const log = [];
        const engine = gameShapedEngine(log);
        engine.start();
        await settle();
        await engine.reset();

        log.length = 0;
        engine.start();
        await settle();
        expect(log).toEqual(["begin"]);
        expect(engine.status()).toBe(EngineStatus.RUNNING);
        await engine.stop();
    });
});

describe("errors", () => {
    it("keeps going when a step throws, instead of dying silently", async () => {
        //This is the behaviour change the phase is for. The old chain had no catch anywhere
        //in it, so any throw inside the AI turn escaped as an unhandled rejection and the
        //loop simply never continued -- the phase button stuck on AI MOVING... and the game
        //was over, with nothing reported.
        const log = [];
        const errors = [];
        const engine = createTurnEngine({
            beginTurn: () => log.push("begin"),
            steps: [
                { name: "buyUpgrade", waitsForPlayer: true },
                {
                    name: "ai",
                    run: () => {
                        throw new Error("AI turn blew up");
                    }
                }
            ],
            endTurn: () => log.push("end"),
            onError: (error, context) => errors.push([context.step, error.message])
        });

        engine.start();
        await settle();
        engine.advancePhase();
        await settle();

        expect(errors).toEqual([["ai", "AI turn blew up"]]);
        expect(engine.turnsRun()).toBe(1);
        expect(log).toEqual(["begin", "end", "begin"]);
        await engine.stop();
    });

    it("reports a rejected async step the same way", async () => {
        const errors = [];
        const engine = createTurnEngine({
            steps: [{ name: "ai", run: async () => Promise.reject(new Error("async boom")) }],
            onError: (error, context) => {
                errors.push([context.stage, error.message]);
                engine.stop();
            }
        });
        engine.start();
        await settle();
        expect(errors).toEqual([["step", "async boom"]]);
    });

    it("reports a throwing beginTurn and still runs the turn's steps", async () => {
        const log = [];
        const errors = [];
        const engine = createTurnEngine({
            beginTurn: () => {
                throw new Error("bad start of turn");
            },
            steps: [{ name: "military", waitsForPlayer: true, run: () => log.push("military") }],
            onError: (error, context) => errors.push(context.stage)
        });
        engine.start();
        await settle();
        engine.advancePhase();
        await settle();

        expect(errors).toContain("beginTurn");
        expect(log).toContain("military");
        await engine.stop();
    });
});

describe("status reporting", () => {
    it("announces each transition once", async () => {
        const seen = [];
        const engine = gameShapedEngine([], { onStatusChange: (status) => seen.push(status) });
        engine.start();
        await settle();
        await engine.stop();
        expect(seen).toEqual([
            EngineStatus.RUNNING,
            EngineStatus.STOPPING,
            EngineStatus.STOPPED
        ]);
    });

    it("survives a listener that throws", async () => {
        const errors = [];
        const engine = gameShapedEngine([], {
            onStatusChange: () => {
                throw new Error("bad listener");
            },
            onError: (error, context) => errors.push(context.stage)
        });
        engine.start();
        await settle();
        expect(errors).toContain("onStatusChange");
        expect(engine.isAwaitingPlayer()).toBe(true);
        await engine.stop();
    });
});
