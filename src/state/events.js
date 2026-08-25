// A ~30-line synchronous emitter. The one channel the state layer uses to tell the
// UI that something changed.
//
// Deliberately minimal: no wildcards, no async, no priority. `mutations.js` is the
// only module that emits world changes -- `state/activityLog.js` is the single
// exception and the note on ACTIVITY_LOGGED says why. Anything may subscribe. Handlers run synchronously in
// subscription order so a listener sees the state exactly as the mutation left it.
//
// A throwing listener must not abort the mutation that emitted, nor stop the other
// listeners, so each handler is called inside a try/catch and reported.
//
// See docs/03-refactor-plan.md Phase 4.3.

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/** Every event name mutations.js emits. Import these rather than typing strings. */
export const Events = Object.freeze({
    TERRITORY_CHANGED: "territoryChanged",
    TURN_CHANGED: "turnChanged",
    PHASE_CHANGED: "phaseChanged",
    WAR_CHANGED: "warChanged",
    SIEGE_CHANGED: "siegeChanged",
    /** The greyed-out / attackable highlight sets. UI selection, not world state. */
    SELECTION_CHANGED: "selectionChanged",
    /**
     * Something military was written to the activity feed.
     *
     * The one event NOT emitted by `mutations.js`. Its source is
     * `state/activityLog.js`, which is a record of things that happened rather
     * than a part of the world -- nothing reads it back to decide a rule, and
     * putting it through a mutation would have meant giving the store a field
     * whose only consumer is a panel. The payload carries the entry, or
     * `{ entry: null, cleared: true }` / `{ entry: null, restored: true }` when
     * the whole log was replaced.
     */
    ACTIVITY_LOGGED: "activityLogged"
});

/**
 * Subscribe to an event.
 *
 * @param {string} event
 * @param {(payload: object) => void} handler
 * @returns {() => void} unsubscribe
 */
export function on(event, handler) {
    if (!listeners.has(event)) {
        listeners.set(event, new Set());
    }
    listeners.get(event).add(handler);
    return () => off(event, handler);
}

/** Unsubscribe. Safe to call twice. */
export function off(event, handler) {
    listeners.get(event)?.delete(handler);
}

/**
 * Fire an event. Only mutations.js should call this.
 *
 * @param {string} event
 * @param {object} [payload]
 */
export function emit(event, payload = {}) {
    const handlers = listeners.get(event);
    if (!handlers || handlers.size === 0) {
        return;
    }
    // Copy first: a handler is allowed to unsubscribe itself.
    for (const handler of [...handlers]) {
        try {
            handler(payload);
        } catch (error) {
            console.error(`state/events: listener for "${event}" threw`, error);
        }
    }
}

/** Test seam. */
export function __resetEventsForTests() {
    listeners.clear();
}

/** Diagnostics: how many handlers are attached to an event. */
export function listenerCount(event) {
    return listeners.get(event)?.size ?? 0;
}
