// The AI's random number stream.
//
// Refactor plan Phase 5.5. Pure, and the only module-level state here is which stream is
// current -- which is the point: an AI turn is seeded from `(turn, countryName)`, so the
// same country making the same decisions on the same turn draws the same numbers whatever
// else the game is doing.
//
// This exists because seeding `Math.random` does not make the game deterministic and cannot.
// `addSparklesRegularly()` in ui.js burns three draws per timer tick on the same global
// stream as combat and the economy, so two runs of the same turn never see the same numbers
// (see the seeding gotcha in CLAUDE.md). A per-country stream sidesteps that entirely: it is
// not shared with anything, so nothing else can advance it.
//
// The seed is a hash of the turn and the country name rather than a counter, so a country
// that takes no turn does not shift every later country's stream.

/** FNV-1a over a string. Cheap, well-spread, and stable across runs and platforms. */
export function hashSeed(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/** mulberry32: a small, fast PRNG with a 32-bit state. Returns draws in [0, 1). */
export function mulberry32(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * The stream one country gets for one turn.
 *
 * @param {number} turn
 * @param {string} countryName
 * @returns {() => number}
 */
export function seededRngFor(turn, countryName) {
    return mulberry32(hashSeed(`${turn}|${countryName}`));
}

let aiRng = Math.random;

/** Point the AI stream at this country's seeded sequence for this turn. */
export function setAiRngContext(turn, countryName) {
    aiRng = seededRngFor(turn, countryName);
}

/**
 * Put the AI stream back on `Math.random`.
 *
 * Called at the end of each country's turn so that anything drawing outside an AI turn --
 * the player's own battles, the random events -- is not quietly reading a seeded stream.
 */
export function resetAiRngContext() {
    aiRng = Math.random;
}

/** The stream itself, for passing to a rule that takes an injected `rng`. */
export function currentAiRng() {
    return aiRng;
}

/** One draw from the current AI stream. */
export function aiRandom() {
    return aiRng();
}
