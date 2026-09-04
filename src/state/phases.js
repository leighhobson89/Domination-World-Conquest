// The turn phases, as a named enum.
//
// Before Phase 4.6 there were two counters for one fact: `currentTurnPhase` in
// `gameTurnsLoop.js` (the value the rest of the game read) and `turnPhase` in
// `ui.js` (the value the phase button incremented). They were kept in step by the
// button remembering to call `modifyCurrentTurnPhase()` -- and `ui.js` also
// compared against the raw numbers 0, 1 and 2 in a dozen places.
//
// The numeric values are unchanged so that anything still comparing against a bare
// integer keeps working during the migration, and so the `?e2e=1` harness keeps
// reporting the same numbers it always has.
//
// This module imports nothing.
//
// See docs/archived/03-refactor-plan.md Phase 4.6.

export const Phase = Object.freeze({
    /** Buy and upgrade. The only phase in which territories may be developed. */
    BUY_UPGRADE: 0,
    /** Move, transfer and attack. */
    MOVE_ATTACK: 1,
    /** The AI takes its turn; the player cannot act. */
    AI: 2
});

/** The order the phase button walks, and what "next" means at the end of it. */
export const PHASE_ORDER = Object.freeze([Phase.BUY_UPGRADE, Phase.MOVE_ATTACK, Phase.AI]);

const NAMES = Object.freeze({
    [Phase.BUY_UPGRADE]: "BUY_UPGRADE",
    [Phase.MOVE_ATTACK]: "MOVE_ATTACK",
    [Phase.AI]: "AI"
});

/** Human-readable name, for logs and test failure messages. */
export function phaseName(phase) {
    return NAMES[phase] ?? `UNKNOWN(${phase})`;
}

/** Is this a phase value the game knows about? */
export function isPhase(value) {
    return value === Phase.BUY_UPGRADE || value === Phase.MOVE_ATTACK || value === Phase.AI;
}

/** The phase that follows `phase`, wrapping AI -> BUY_UPGRADE for the next turn. */
export function nextPhase(phase) {
    const index = PHASE_ORDER.indexOf(phase);
    if (index === -1) {
        return Phase.BUY_UPGRADE;
    }
    return PHASE_ORDER[(index + 1) % PHASE_ORDER.length];
}

/** Does advancing past `phase` roll the turn counter? */
export function endsTurn(phase) {
    return phase === Phase.AI;
}
