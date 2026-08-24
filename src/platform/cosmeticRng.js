// The cosmetic random stream.
//
// Refactor plan Phase 5.5, and the fix for audit 5.3 Y.
//
// Nothing decorative may draw from `Math.random`. `addSparklesRegularly()` re-arms a
// timer every 0-100ms and burns three draws per tick -- interval, top, left -- and the
// battle UI picks one of two dice sounds with a fourth. Those draws landed on the same
// global stream as combat, the economy and the AI, and how many of them fell between two
// game draws depended on wall-clock timing. That is why seeding `Math.random` could never
// make two runs of this game agree, and why no spec was allowed to assert an exact combat
// or economy outcome across runs.
//
// The stream here is self-contained: its own mulberry32 state, seeded once at module
// evaluation from the clock. It never touches `Math.random`, so the harness's `?seed=`
// stream is advanced only by the game itself and two runs of the same seed see the same
// numbers in the same order.
//
// Cosmetics are deliberately NOT reproducible. A test asserting where a sparkle landed
// would be asserting the wrong thing, and seeding this from the harness would only put
// the timer back on a stream that game logic reads.

let state = (Date.now() ^ 0x9e3779b9) >>> 0;

/** One draw in [0, 1) from the cosmetic stream. mulberry32, same as `src/ai/rng.js`. */
export function cosmeticRandom() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Pin the cosmetic stream to a known seed.
 *
 * For unit tests only -- the game never calls it. It exists so the module can be proved
 * to be a real PRNG rather than a wrapper that quietly forwards to `Math.random`.
 *
 * @param {number} seed
 */
export function seedCosmeticRandom(seed) {
    state = seed >>> 0;
}
