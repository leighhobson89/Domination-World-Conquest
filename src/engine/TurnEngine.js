// The turn loop, as an explicit state machine.
//
// Refactor plan Phase 5.7. This replaces `gameLoop()` in gameTurnsLoop.js, which was:
//
//     function gameLoop() {
//         ...start-of-turn work...
//         handleBuyUpgradePhase().then(() => {
//             handleMilitaryPhase().then(() => {
//                 handleAITurn().then(() => {
//                     advanceTurn();
//                     gameLoop();          // <- and round again, forever
//                 });
//             });
//         });
//     }
//
// Three things were wrong with that, and all three are why "New Game" and "Restart" were
// never written:
//
//   1. **There was no way to stop it.** Nothing held a reference to the loop, so nothing
//      could end it. A new game meant a page reload.
//   2. **There was no `catch` anywhere in the chain.** Any throw inside the AI turn escaped
//      as an unhandled rejection and the loop simply never continued -- the phase button
//      stuck on "AI MOVING..." and the game was over, permanently, with no error surfaced to
//      the player. Phase 3 fixed five separate crashes that presented exactly this way (audit
//      5.1 AA, AF-AJ). The sixth would have done the same. Here a step that throws is
//      reported through `onError` and the turn continues without it: one bad turn instead of
//      a dead game.
//   3. **The phases were three near-identical private functions**, each wrapping a
//      `#popup-confirm` click listener in a Promise. What "advance the phase" means was
//      spread across three closures and a DOM id.
//
// The engine knows nothing about the DOM, the store or the game. It is a sequencer: it runs
// `beginTurn`, then each step in order, then `endTurn`, then does it again -- and it stops
// when told to. The steps that wait for the player do so on a gate that `advancePhase()`
// opens, which is the one thing the phase button now has to call.

/** What the engine is doing. */
export const EngineStatus = Object.freeze({
    /** Created, or reset, and not yet started. */
    IDLE: "idle",
    /** Running turns. */
    RUNNING: "running",
    /** `stop()` has been asked for; unwinding at the next safe point. */
    STOPPING: "stopping",
    /** The loop has ended. `start()` will begin a new one. */
    STOPPED: "stopped"
});

/**
 * A promise plus the function that resolves it.
 *
 * This is the whole of "wait for the player". The step awaits `promise`; `advancePhase()`
 * calls `open`; the await returns. Stopping the engine opens every outstanding gate, which
 * is what lets a `stop()` during the player's turn unwind rather than hang.
 */
function createGate() {
    let open;
    const promise = new Promise((resolve) => {
        open = resolve;
    });
    return { promise: promise, open: open };
}

/**
 * Build a turn engine.
 *
 * @param {object} options
 * @param {() => (void|Promise<void>)} [options.beginTurn]
 *        Start-of-turn bookkeeping: sieges, retrievals, income, random events.
 * @param {Array<{name: string, waitsForPlayer?: boolean, onEnter?: () => (void|Promise<void>),
 *                 run?: () => (void|Promise<void>)}>} options.steps
 *        The phases, in order. `onEnter` fires as the phase opens -- before the gate, so it
 *        is where a phase announces itself to the player. `run` fires once the phase is
 *        over: for a gated step that means after `advancePhase()`, and for an ungated one
 *        (the AI turn) immediately.
 * @param {() => (void|Promise<void>)} [options.endTurn]
 *        End-of-turn bookkeeping. This is where the turn counter advances.
 * @param {(error: Error, context: {step: string|null, stage: string}) => void} [options.onError]
 *        Called for anything a step or hook throws. The engine carries on regardless: the
 *        old loop's silent death is the behaviour being removed.
 * @param {(status: string) => void} [options.onStatusChange]
 * @param {() => (void|Promise<void>)} [options.onReset]
 *        Called by `reset()` once the loop has unwound, to put the world back.
 * @returns {object} the engine
 */
export function createTurnEngine(options) {
    const {
        beginTurn = () => {},
        steps = [],
        endTurn = () => {},
        onError = null,
        onStatusChange = null,
        onReset = null
    } = options ?? {};

    if (steps.length === 0) {
        throw new Error("createTurnEngine: an engine with no steps has nothing to run");
    }

    let status = EngineStatus.IDLE;
    let running = null;      //the promise of the current run, or null
    let gate = null;         //the gate the current step is waiting on, or null
    let currentStepIndex = -1;
    let turnsRun = 0;

    function setStatus(next) {
        if (status === next) {
            return;
        }
        status = next;
        if (onStatusChange) {
            //A listener that throws must not take the engine with it.
            try {
                onStatusChange(status);
            } catch (error) {
                report(error, { step: null, stage: "onStatusChange" });
            }
        }
    }

    function report(error, context) {
        if (onError) {
            try {
                onError(error, context);
                return;
            } catch {
                //An onError that itself throws is not worth a second attempt.
            }
        }
        console.error(
            `TurnEngine: ${context.stage}${context.step ? " (" + context.step + ")" : ""} threw`,
            error);
    }

    /** Run one hook or step body, reporting anything it throws rather than propagating. */
    async function runGuarded(fn, context) {
        try {
            await fn();
        } catch (error) {
            report(error, context);
        }
    }

    function isStopping() {
        return status === EngineStatus.STOPPING || status === EngineStatus.STOPPED;
    }

    async function loop() {
        while (!isStopping()) {
            await runGuarded(beginTurn, { step: null, stage: "beginTurn" });
            if (isStopping()) {
                break;
            }

            for (let index = 0; index < steps.length; index++) {
                const step = steps[index];
                currentStepIndex = index;

                if (step.onEnter) {
                    await runGuarded(step.onEnter, { step: step.name, stage: "onEnter" });
                    if (isStopping()) {
                        break;
                    }
                }

                if (step.waitsForPlayer) {
                    gate = createGate();
                    await gate.promise;
                    gate = null;
                    //`stop()` opens the gate to unwind, so the step must not then run.
                    if (isStopping()) {
                        break;
                    }
                }

                if (step.run) {
                    await runGuarded(step.run, { step: step.name, stage: "step" });
                }
                if (isStopping()) {
                    break;
                }
            }

            currentStepIndex = -1;
            if (isStopping()) {
                break;
            }

            await runGuarded(endTurn, { step: null, stage: "endTurn" });
            turnsRun++;
        }

        currentStepIndex = -1;
        setStatus(EngineStatus.STOPPED);
    }

    return {
        /**
         * Begin running turns.
         *
         * Idempotent while running: a second call returns the same promise rather than
         * starting a second loop over the same world.
         *
         * @returns {Promise<void>} resolves when the loop ends
         */
        start() {
            if (running && (status === EngineStatus.RUNNING || status === EngineStatus.STOPPING)) {
                return running;
            }
            turnsRun = 0;
            setStatus(EngineStatus.RUNNING);
            running = loop();
            return running;
        },

        /**
         * Let the waiting step proceed. This is what the phase button calls.
         *
         * @returns {boolean} true if a step was actually waiting. A click while the AI is
         *          moving, or between turns, is not an error -- it is simply ignored, which
         *          is what the three `#popup-confirm` listeners did by only existing while
         *          their phase was open.
         */
        advancePhase() {
            if (!gate) {
                return false;
            }
            gate.open();
            return true;
        },

        /**
         * End the loop at the next safe point.
         *
         * Any outstanding gate is opened so a stop during the player's phase unwinds
         * immediately rather than waiting for a click that will never come. The step that
         * was waiting does NOT then run.
         *
         * @returns {Promise<void>} resolves once the loop has unwound
         */
        stop() {
            if (status === EngineStatus.IDLE || status === EngineStatus.STOPPED) {
                setStatus(EngineStatus.STOPPED);
                return Promise.resolve();
            }
            setStatus(EngineStatus.STOPPING);
            if (gate) {
                gate.open();
            }
            return running ?? Promise.resolve();
        },

        /**
         * Stop, then put the engine back to IDLE so `start()` begins a fresh run.
         *
         * The engine cannot restore the world itself -- it does not know what the world is.
         * That is what `onReset` is for.
         */
        async reset() {
            await this.stop();
            if (onReset) {
                await runGuarded(onReset, { step: null, stage: "onReset" });
            }
            turnsRun = 0;
            currentStepIndex = -1;
            gate = null;
            running = null;
            status = EngineStatus.STOPPED; //so setStatus below actually fires
            setStatus(EngineStatus.IDLE);
        },

        /** @returns {string} an `EngineStatus` */
        status() {
            return status;
        },

        isRunning() {
            return status === EngineStatus.RUNNING;
        },

        /** The step being run or waited on, or null between turns. */
        currentStep() {
            return currentStepIndex === -1 ? null : steps[currentStepIndex].name;
        },

        /** True when a step is blocked waiting for `advancePhase()`. */
        isAwaitingPlayer() {
            return gate !== null;
        },

        /** How many turns have completed since `start()`. */
        turnsRun() {
            return turnsRun;
        }
    };
}
