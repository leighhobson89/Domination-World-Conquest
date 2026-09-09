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
// **A THREAT IS A TERRITORY AND NOT A COUNTRY, and every one of them is marked.** The plan used
// to forecast a single pairing per province -- the strongest enemy beside it -- so a border
// facing two dangerous neighbours was marked on one of them and drawn clean on the other.
// Leigh found it on the real map: Canada is threatened by the United States along the whole
// 49th parallel AND by Alaska in the north-west, and only the longer border was marked, which
// says *that one is safe* about the border a player would most want telling about. Every enemy
// neighbour that clears the warning odds now gets its own stretch of border at its own colour,
// and the tooltip names them.
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

/**
 * The odds at which a border is marked, as a real take probability.
 *
 * **RE-CUT FROM 35/60 BECAUSE THE AMBER BAND ALMOST NEVER FIRED, and the measurement is the
 * reason rather than the taste.** Bisecting 120 real adjacent pairings for the force ratio at
 * which each edge opens: at 35/60 amber ran from 1.10:1 to 1.26:1 on open ground -- a window
 * **14%** wide in force ratio -- and from 1.37:1 to 1.46:1 behind a single fort, a window of
 * **6%**. A neighbour had to land inside a few per cent for the warning to show, so in practice
 * a border went from unmarked to red with nothing in between and Leigh had never seen an amber
 * border in a game.
 *
 * That is the CLIFF and not a bad threshold: the dice model is a step function, an extra die is
 * an unmatched die and an unmatched die is a free hit every round, so the real odds move in
 * jumps. Widening the band is the only thing that can be done about it from here.
 *
 * At 15/45 amber opens at **0.90:1** and red at **1.24:1**, a window **37%** wide, so amber
 * comes to mean *this border is roughly even* -- which is the case worth warning about, because
 * a defender at parity loses the province about a quarter of the time (24.3%, `combat-lab
 * cliff`). Re-measure with the same sweep if the dice bands or `DICE_ATTACK_ADVANTAGE` move.
 */
export const THREAT_WARNED_ODDS = 15;
export const THREAT_CRITICAL_ODDS = 45;

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
 * How strong a neighbour has to be, against the garrison, before its odds are worth asking for.
 *
 * The bound that makes a forecast per PAIRING affordable, and it is a measurement rather than a
 * taste. `node tools/combat-lab.mjs cliff` puts a real take probability at raw parity at 24.3%,
 * which is already under the 35% warning band, and at 0.35:1 at 0.0% -- so a neighbour holding
 * well under the garrison cannot reach the band whatever it is made of. 0.6 is a wide margin
 * under parity, chosen so composition (an all-armour attacker is worth more than its headcount)
 * cannot carry a skipped pairing over the line.
 *
 * It cuts hard on the real map, where most borders are between provinces of very different
 * weight: a frontier territory typically forecasts one or two of its neighbours rather than all
 * of them. Terrain and forts only ever move the odds DOWN from here, so the filter cannot hide
 * a warning it should have raised.
 */
export const THREAT_CANDIDATE_RATIO = 0.6;

/**
 * The neighbours worth forecasting against a garrison, strongest first.
 *
 * Sorted so the expensive calls happen in the order a player would care about them; the results
 * are re-sorted by the ODDS afterwards, which is not the same order.
 */
export function threatCandidatesFor(neighbours, garrison) {
    const floor = (Number(garrison) || 0) * THREAT_CANDIDATE_RATIO;
    return (neighbours ?? [])
        .filter(neighbour => {
            const army = Number(neighbour?.armyForCurrentTerritory) || 0;
            return army > 0 && army >= floor;
        })
        .sort((a, b) =>
            (Number(b.armyForCurrentTerritory) || 0) - (Number(a.armyForCurrentTerritory) || 0));
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
 * `oddsFor` is the expensive argument -- it plays out hundreds of battles -- and it is called
 * once per CREDIBLE PAIRING on the player's own frontier: never for anybody else's land, and
 * never for a neighbour too weak to reach the warning band (`THREAT_CANDIDATE_RATIO`). It used
 * to be one call per player territory, against the strongest enemy beside it, which is cheaper
 * and marks the wrong map -- see the note at the top of the file. That bound is the reason this
 * function decides which pairings matter rather than leaving the caller to ask about all of
 * them.
 *
 * @param {object} input
 * @param {object[]} input.territories        every territory in the world
 * @param {(territory: object) => object[]} input.enemyNeighboursOf  reachable territories under
 *        another flag
 * @param {(territory: object) => boolean} input.isPlayerOwned
 * @param {(territory: object) => boolean} [input.isAlliedOwned]  held by an ALLY of the
 *        player. Diplomacy stage 5.4 -- shared intelligence. Defaults to "nobody", so a
 *        caller that predates alliances gets exactly the view it had
 * @param {(attacker: object, defender: object) => number} [input.oddsFor]  0..100; omitted in
 *        spectator mode, where there is no player and so nothing to warn
 * @returns {Map<string, {band: number, threat: string, odds: number, force: number,
 *          faced: number, facedBy: string|null, facedName: string|null, facedId: string|null,
 *          threats: {id: string, name: string|null, country: string|null, force: number,
 *          odds: number, threat: string}[], frontier: boolean, player: boolean}>} keyed by
 *          uniqueId
 */
export function planMilitaryView({
    territories,
    enemyNeighboursOf,
    isPlayerOwned,
    isAlliedOwned = null,
    oddsFor
}) {
    const plan = new Map();

    //SHARED INTELLIGENCE -- diplomacy stage 5.4, and the cheapest of the four things an
    //alliance gives. Nothing new is computed: this function already walks the whole map, and
    //the widening is one predicate. An ally's frontier gets the same figures and the same
    //threat marks the player's own does, which is what "you can see what your ally sees"
    //means on a map made of numbers.
    const alliedOwned = typeof isAlliedOwned === "function" ? isAlliedOwned : () => false;
    const friendly = (territory) => Boolean(isPlayerOwned(territory)) || alliedOwned(territory);

    //THE FRONTIER: the coalition's own land, and every enemy territory that touches it. It is
    //gathered as the plan is built rather than walked for separately, because the enemy
    //neighbours of each watched territory are exactly what the loop is already asking for.
    const frontier = new Set();
    let anyPlayer = false;

    for (const territory of territories ?? []) {
        const reachable = enemyNeighboursOf(territory) ?? [];
        const player = Boolean(isPlayerOwned(territory));
        const allied = !player && alliedOwned(territory);
        const watched = player || allied;

        //AN ALLY IS NOT AN ENEMY, AND THE SHADE HAS TO KNOW IT. `enemyNeighboursOf()` means
        //"under another flag", which an ally's territory also is -- so without this filter the
        //moment two countries signed, each would start shading its own border with the other
        //dark and marking it as a threat. The filter applies only to a WATCHED territory,
        //because "friendly" is a fact about the player's coalition: for some third country on
        //the far side of the world, the player and their allies are enemies like anybody else,
        //and its shade is right to count them.
        const neighbours = watched ? reachable.filter(other => !friendly(other)) : reachable;
        const { territory: strongest, power } = strongestOf(neighbours);
        if (watched) {
            anyPlayer = true;
            frontier.add(String(territory.uniqueId));
            for (const neighbour of neighbours) {
                frontier.add(String(neighbour.uniqueId));
            }
        }

        //ONE ENTRY PER THREATENING NEIGHBOUR, and not one per territory. A province can be
        //threatened from several directions at once, each of them a different border with a
        //different answer -- marking only the worst of them says the others are safe.
        const threats = [];
        if (watched && typeof oddsFor === "function") {
            const candidates = threatCandidatesFor(neighbours, territory.armyForCurrentTerritory);
            for (const neighbour of candidates) {
                const chance = Number(oddsFor(neighbour, territory)) || 0;
                const band = threatBandFor(chance);
                if (band === THREAT_NONE) {
                    continue;
                }
                threats.push({
                    id: String(neighbour.uniqueId),
                    name: neighbour.territoryName ?? null,
                    country: neighbour.dataName ?? null,
                    force: Number(neighbour.armyForCurrentTerritory) || 0,
                    odds: chance,
                    threat: band
                });
            }
            //Worst first by the ODDS and not by the army: a smaller neighbour on better ground
            //is the more dangerous one, which is the whole reason the mark is a forecast rather
            //than a second force comparison.
            threats.sort((a, b) => b.odds - a.odds);
        }
        //The single figures stay and they describe the WORST of them, so a caller with room
        //for one answer is given the one that matters most.
        const threat = threats.length > 0 ? threats[0].threat : THREAT_NONE;
        const odds = threats.length > 0 ? threats[0].odds : 0;

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
            //WHAT THE SHADE WAS MEASURED AGAINST, kept so the view can say it out loud. The
            //band is a ratio, and a ratio is the one thing a colour cannot explain by itself:
            //a territory holding two million men is pale when the neighbour it faces holds
            //five, and dark when it faces one. Without these two fields the map can only be
            //read by somebody who already knows the rule.
            faced: power,
            facedBy: strongest?.dataName ?? null,
            facedName: strongest?.territoryName ?? null,
            facedId: strongest ? String(strongest.uniqueId) : null,
            threats,
            //Filled in below: the whole frontier is not known until every watched territory
            //has been seen, and a territory can be the neighbour of one visited later.
            frontier: false,
            player,
            /** Held by an ally. Drawn like the player's own land, and owned by somebody else. */
            ally: allied
        });
    }

    //WHEN THERE IS NO PLAYER, EVERYTHING IS FRONTIER. Spectator mode has nobody to draw a
    //frontier around, and a military map with no figures on it at all would be a debug view
    //that says less than the one it replaced -- so the subset falls back to the whole world.
    for (const [uniqueId, entry] of plan) {
        entry.frontier = anyPlayer ? frontier.has(uniqueId) : true;
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
