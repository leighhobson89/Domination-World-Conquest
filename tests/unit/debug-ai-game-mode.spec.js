// The spectator mode's pacing gate.
//
// This is the half of "AI Game" that has to be right and cannot be seen: the gate is
// awaited two hundred times a turn from inside the AI loop, and every one of its
// failure modes looks like a game defect rather than a debug-tool defect. A gate that
// never resolves is "the map stopped changing"; one that resolves instantly is "the
// slider does nothing"; one that ignores `stop()` is "New Game hangs for four
// minutes", because `TurnEngine.stop()` waits for the running step to return and the
// whole AI phase is one step.
//
// None of that involves the DOM or the store, which is why the mode is a module of
// its own and why this can be tested with fake timers instead of a browser.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    DEFAULT_SECONDS_PER_COUNTRY,
    MAX_SECONDS_PER_COUNTRY,
    MIN_SECONDS_PER_COUNTRY,
    SPEED_SLIDER_STEPS,
    aiGameSecondsPerCountry,
    aiGameState,
    awaitCountryPacing,
    isAiGameActive,
    isAiGamePaused,
    onAiGameChanged,
    setAiGamePaused,
    setAiGameSecondsPerCountry,
    describeAiGameSpeed,
    secondsForSliderPosition,
    sliderPositionForSeconds,
    startAiGameMode,
    stopAiGameMode,
    toggleAiGamePaused
} from "../../src/debug/aiGameMode.js";

/** Did a promise settle? The gate's whole contract is about when it does. */
function settles(promise) {
    const state = { done: false };
    promise.then(() => {
        state.done = true;
    });
    return state;
}

/** Let the microtask queue drain, so a `then` above has actually run. */
async function flush() {
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(() => {
    vi.useFakeTimers();
    stopAiGameMode();
    setAiGameSecondsPerCountry(DEFAULT_SECONDS_PER_COUNTRY);
});

afterEach(() => {
    stopAiGameMode();
    vi.useRealTimers();
});

describe("the mode flag", () => {
    it("starts inactive, and starting is idempotent", () => {
        expect(isAiGameActive()).toBe(false);
        startAiGameMode();
        startAiGameMode();
        expect(isAiGameActive()).toBe(true);
    });

    it("clears the pause when it stops, so the next run does not open frozen", () => {
        startAiGameMode();
        setAiGamePaused(true);
        expect(isAiGamePaused()).toBe(true);
        stopAiGameMode();
        startAiGameMode();
        expect(isAiGamePaused()).toBe(false);
    });

    it("reports paused only while active", () => {
        setAiGamePaused(true);
        expect(isAiGamePaused()).toBe(false);
    });
});

describe("the speed", () => {
    it("clamps to the slider's range, so a bad value cannot stall the run", () => {
        setAiGameSecondsPerCountry(500);
        expect(aiGameSecondsPerCountry()).toBe(MAX_SECONDS_PER_COUNTRY);
        setAiGameSecondsPerCountry(0);
        expect(aiGameSecondsPerCountry()).toBe(MIN_SECONDS_PER_COUNTRY);
    });

    it("ignores anything that is not a number", () => {
        setAiGameSecondsPerCountry(2);
        setAiGameSecondsPerCountry("nonsense");
        setAiGameSecondsPerCountry(undefined);
        expect(aiGameSecondsPerCountry()).toBe(2);
    });
});

describe("the speed slider", () => {
    // The track is two geometric halves pinned to three anchors, and the anchors are the
    // whole point: the ends have to actually BE the pace the label claims, and one second
    // has to sit dead centre rather than a fiftieth of the way along. Rounding is applied
    // per half at three different grains, which is exactly the sort of arithmetic that
    // lands 0.021 at the fast end and nobody notices.
    it("lands its three anchors exactly", () => {
        expect(secondsForSliderPosition(0)).toBe(MIN_SECONDS_PER_COUNTRY);
        expect(secondsForSliderPosition(SPEED_SLIDER_STEPS / 2)).toBe(DEFAULT_SECONDS_PER_COUNTRY);
        expect(secondsForSliderPosition(SPEED_SLIDER_STEPS)).toBe(MAX_SECONDS_PER_COUNTRY);
    });

    it("reaches fifty countries a second at the fast end, and says so", () => {
        expect(1 / secondsForSliderPosition(0)).toBe(50);
        expect(describeAiGameSpeed(secondsForSliderPosition(0))).toBe("50 countries/s");
    });

    it("gets slower with every step, never faster", () => {
        let previous = 0;
        for (let position = 0; position <= SPEED_SLIDER_STEPS; position++) {
            const seconds = secondsForSliderPosition(position);
            expect(seconds).toBeGreaterThanOrEqual(previous);
            previous = seconds;
        }
    });

    it("clamps a position off either end of the track", () => {
        expect(secondsForSliderPosition(-40)).toBe(MIN_SECONDS_PER_COUNTRY);
        expect(secondsForSliderPosition(SPEED_SLIDER_STEPS + 40)).toBe(MAX_SECONDS_PER_COUNTRY);
    });

    it("puts the thumb back where a speed came from", () => {
        // The control holds no copy of the speed -- it repaints from the change event -- so
        // a round trip that drifts is a thumb that walks away from itself on every notify.
        for (const position of [0, 1, 17, 50, 63, 88, SPEED_SLIDER_STEPS]) {
            const seconds = secondsForSliderPosition(position);
            expect(Math.abs(sliderPositionForSeconds(seconds) - position)).toBeLessThanOrEqual(1);
        }
    });

    it("reads as a rate below a second and as a duration above one", () => {
        expect(describeAiGameSpeed(0.5)).toBe("2 countries/s");
        expect(describeAiGameSpeed(1)).toBe("1s per country");
        expect(describeAiGameSpeed(2.25)).toBe("2.25s per country");
        expect(describeAiGameSpeed(5)).toBe("5s per country");
    });
});

describe("the pacing gate", () => {
    it("returns at once when the mode is off, so an ordinary game pays nothing", async () => {
        const waiting = settles(awaitCountryPacing());
        await flush();
        expect(waiting.done).toBe(true);
    });

    it("holds for the configured delay and no longer", async () => {
        startAiGameMode();
        setAiGameSecondsPerCountry(2);

        const waiting = settles(awaitCountryPacing());
        await vi.advanceTimersByTimeAsync(1900);
        expect(waiting.done).toBe(false);
        await vi.advanceTimersByTimeAsync(200);
        expect(waiting.done).toBe(true);
    });

    it("blocks before the delay when already paused", async () => {
        startAiGameMode();
        setAiGamePaused(true);

        const waiting = settles(awaitCountryPacing());
        await vi.advanceTimersByTimeAsync(10000);
        expect(waiting.done).toBe(false);

        setAiGamePaused(false);
        await vi.advanceTimersByTimeAsync(DEFAULT_SECONDS_PER_COUNTRY * 1000 + 50);
        expect(waiting.done).toBe(true);
    });

    it("honours a pause taken DURING the delay, at the end of it", async () => {
        // The pause deliberately does not interrupt a delay in flight: a country
        // half-way through its turn is not a place to stop. What it must do is keep
        // the NEXT country from starting, which is this.
        startAiGameMode();
        setAiGameSecondsPerCountry(1);

        const waiting = settles(awaitCountryPacing());
        await vi.advanceTimersByTimeAsync(500);
        setAiGamePaused(true);
        await vi.advanceTimersByTimeAsync(5000);
        expect(waiting.done).toBe(false);

        setAiGamePaused(false);
        await flush();
        expect(waiting.done).toBe(true);
    });

    it("releases everything that is waiting when the mode stops", async () => {
        // This is what stops New Game hanging: the engine's stop() waits for the AI
        // step to return, and the AI step is blocked in here.
        startAiGameMode();
        setAiGameSecondsPerCountry(5);

        const delayed = settles(awaitCountryPacing());
        setAiGamePaused(true);
        const held = settles(awaitCountryPacing());
        await flush();

        stopAiGameMode();
        await flush();
        expect(delayed.done).toBe(true);
        expect(held.done).toBe(true);
    });

    it("does not leave the timer behind when it is released early", async () => {
        startAiGameMode();
        setAiGameSecondsPerCountry(5);
        const waiting = settles(awaitCountryPacing());
        await flush();

        stopAiGameMode();
        await flush();
        expect(waiting.done).toBe(true);
        // Nothing left to fire. At five seconds a country a stopped run would
        // otherwise strand a couple of hundred live timers.
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("change notifications", () => {
    it("reports the whole state, so a control never renders half of it", () => {
        const seen = [];
        const off = onAiGameChanged((state) => seen.push(state));

        startAiGameMode();
        setAiGameSecondsPerCountry(3);
        toggleAiGamePaused();

        expect(seen.at(-1)).toEqual({ active: true, paused: true, secondsPerCountry: 3 });
        expect(aiGameState()).toEqual(seen.at(-1));
        off();
    });

    it("does not let a listener that throws take the AI turn with it", () => {
        const off = onAiGameChanged(() => {
            throw new Error("a control repainted badly");
        });
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => startAiGameMode()).not.toThrow();
        off();
    });

    it("stops notifying once unsubscribed", () => {
        let calls = 0;
        const off = onAiGameChanged(() => calls++);
        startAiGameMode();
        const afterStart = calls;
        off();
        setAiGameSecondsPerCountry(4);
        expect(calls).toBe(afterStart);
    });
});
