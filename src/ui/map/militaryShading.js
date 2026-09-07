// The military map, decided: what colour each territory takes and which borders are marked.
//
// Register item E1, and this is the pure half of it. Nothing here touches the DOM, the store,
// the adjacency graph or the battle model -- every fact it needs is passed in -- so the whole
// of the decision is unit-testable in Node, which matters because the alternative is asserting
// a fill colour through an `<object>` boundary in a Playwright spec.
//
// THREE DECISIONS ARE RECORDED HERE AND ALL THREE WERE TAKEN DELIBERATELY.
//
// **The shade is a RATIO, never an absolute army.** `garrison / the strongest enemy that can
// reach it`. An absolute figure paints China dark and says nothing -- the question a player
// actually has is *"which of my borders is thin"*, and a thin border beside a thin border is
// not the same picture as a thick one beside a thick one even though the two territories hold
// the same army. The AI has read the world this way from the beginning
// (`strongestEnemyPowerAgainst()` in `aiCalculations.js` is the same maximum), so the two
// sides are looking at the same map.
//
// **A territory no enemy can reach is SECURE, whatever it holds.** An interior province with
// an empty garrison cannot be attacked, so it takes the top band and the frontier draws itself
// -- which is the whole reason the view is worth having.
//
// **The red is REAL ODDS and not the ratio again.** The bands above are a raw force comparison
// with no terrain, forts or dice in them; a warning built on that would fire on every mountain
// fortress in the Alps and be ignored within three turns. The threat marks come from
// `takeProbability()`, the same function the AI decides on and the same one behind the number
// on the attack screen, so a border marked critical is a border the model says would fall. The
// two are not redundant: the shade says how the armies stand, the mark says what the ground
// does about it.

/** How many steps the strength ramp has. Five is what a player can tell apart at a glance. */
export const FORCE_BAND_COUNT = 5;

/**
 * The ratio at which each band starts, weakest first.
 *
 * Each edge is DOUBLE the one before it and parity sits on the middle edge, so the five bands
 * read as: under a quarter of what faces you, a quarter to a half, half to even, even to
 * double, and more than double. Geometric rather than even because the interesting range is
 * around parity -- the difference between 0.5:1 and 1:1 decides a border and the difference
 * between 6:1 and 12:1 decides nothing -- and centred on parity because an even border is the
 * thing a player is trying to judge everything else against, so it belongs in the middle
 * colour rather than a step off it.
 */
export const FORCE_BAND_EDGES = Object.freeze([0.25, 0.5, 1, 2]);

/** The odds at which a border is marked, in real take probability against the strongest enemy. */
export const THREAT_WARNED_ODDS = 35;
export const THREAT_CRITICAL_ODDS = 60;

export const THREAT_NONE = "none";
export const THREAT_WARNED = "warned";
export const THREAT_CRITICAL = "critical";

/**
 * Which band a garrison falls in against what can reach it.
 *
 * @param {number} garrison        the territory's own army
 * @param {number} strongestEnemy  the largest army that can reach it, 0 if none can
 * @returns {number} 0 (outnumbered) .. FORCE_BAND_COUNT - 1 (secure)
 */
export function forceBandFor(garrison, strongestEnemy) {
    const enemy = Number(strongestEnemy) || 0;
    if (enemy <= 0) {
        return FORCE_BAND_COUNT - 1;
    }
    const held = Number(garrison) || 0;
    if (held <= 0) {
        return 0;
    }
    const ratio = held / enemy;
    let band = 0;
    while (band < FORCE_BAND_EDGES.length && ratio >= FORCE_BAND_EDGES[band]) {
        band++;
    }
    return band;
}

/**
 * The mark a border carries, from the chance the strongest enemy beside it takes the place.
 *
 * @param {number} odds 0..100
 */
export function threatBandFor(odds) {
    const chance = Number(odds) || 0;
    if (chance >= THREAT_CRITICAL_ODDS) {
        return THREAT_CRITICAL;
    }
    if (chance >= THREAT_WARNED_ODDS) {
        return THREAT_WARNED;
    }
    return THREAT_NONE;
}

/**
 * The strongest enemy neighbour of a territory, and the army it holds.
 *
 * "Strongest" is by raw army rather than by composition, and that is a simplification with a
 * cost worth stating: a neighbour holding fewer men but more armour is the more dangerous
 * attacker and would not be picked. It is the same maximum the AI's own reserve calculation
 * takes, and taking it any other way would mean forecasting every pairing on the frontier
 * rather than one per territory.
 */
function strongestOf(neighbours) {
    let strongest = null;
    let power = 0;
    for (const neighbour of neighbours ?? []) {
        const army = Number(neighbour?.armyForCurrentTerritory) || 0;
        if (strongest === null || army > power) {
            strongest = neighbour;
            power = army;
        }
    }
    return { territory: strongest, power };
}

/**
 * Everything the view draws, as one plan.
 *
 * `oddsFor` is the expensive argument -- it plays out hundreds of battles -- so it is called
 * **once per player territory**, against the strongest enemy beside it, and never for anybody
 * else's land. That bound is the reason this function decides which pairings matter rather
 * than leaving the caller to ask about all of them.
 *
 * @param {object} input
 * @param {object[]} input.territories        every territory in the world
 * @param {(territory: object) => object[]} input.enemyNeighboursOf  reachable territories under
 *        another flag
 * @param {(territory: object) => boolean} input.isPlayerOwned
 * @param {(attacker: object, defender: object) => number} [input.oddsFor]  0..100; omitted in
 *        spectator mode, where there is no player and so nothing to warn
 * @returns {Map<string, {band: number, threat: string, odds: number, force: number,
 *          player: boolean}>} keyed by uniqueId
 */
export function planMilitaryView({ territories, enemyNeighboursOf, isPlayerOwned, oddsFor }) {
    const plan = new Map();

    for (const territory of territories ?? []) {
        const neighbours = enemyNeighboursOf(territory) ?? [];
        const { territory: strongest, power } = strongestOf(neighbours);
        const player = Boolean(isPlayerOwned(territory));

        let threat = THREAT_NONE;
        let odds = 0;
        if (player && strongest && typeof oddsFor === "function") {
            odds = Number(oddsFor(strongest, territory)) || 0;
            threat = threatBandFor(odds);
        }

        //EVERY territory carries its force, and which of them a figure is actually DRAWN on
        //is decided by the view, from whether the territory is big enough on screen to hold
        //one at the current zoom. This used to hand back a chosen subset -- the player's own
        //land and whatever touched it -- and a subset is a decision about what the player is
        //allowed to compare. Zooming is the better filter, because the player controls it.
        plan.set(String(territory.uniqueId), {
            band: forceBandFor(territory.armyForCurrentTerritory, power),
            threat,
            odds,
            force: Number(territory.armyForCurrentTerritory) || 0,
            player
        });
    }

    return plan;
}

/**
 * One step along the ramp between two colours, in sRGB.
 *
 * Deliberately a straight mix rather than a perceptual one: the two ends come from the theme
 * and a theme is free to make them near-neighbours, at which point a fancier interpolation is
 * measuring rounding error. `fraction` is clamped, so a caller cannot walk off either end.
 *
 * @param {{r: number, g: number, b: number}} weak
 * @param {{r: number, g: number, b: number}} strong
 * @param {number} fraction 0..1
 */
export function mixColour(weak, strong, fraction) {
    const t = Math.min(1, Math.max(0, Number(fraction) || 0));
    const channel = (from, to) => Math.round(from + (to - from) * t);
    return {
        r: channel(weak.r, strong.r),
        g: channel(weak.g, strong.g),
        b: channel(weak.b, strong.b)
    };
}

/** The whole ramp, weakest first, as `rgb(...)` strings. */
export function rampFor(weak, strong, steps = FORCE_BAND_COUNT) {
    const ramp = [];
    for (let index = 0; index < steps; index++) {
        const mixed = mixColour(weak, strong, steps === 1 ? 1 : index / (steps - 1));
        ramp.push(`rgb(${mixed.r},${mixed.g},${mixed.b})`);
    }
    return ramp;
}
