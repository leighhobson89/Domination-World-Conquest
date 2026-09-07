// The state of the nation at the top of a turn — the facts, not the sentences.
//
// Register item E7. The news panel is a LOG: it says what happened, one event at a time. What
// it could not say is where any of it left you, so a player who had lost two provinces and
// gained one had three cards and no answer to "am I doing well". This is the summary that
// leads each turn's section.
//
// Pure, and it imports nothing at all: every figure is passed in. That is not tidiness for its
// own sake -- `weakBordersFor()` needs the adjacency graph, which THROWS when its data has not
// been loaded (which is the case in Node), so a module that reached for it directly could not
// be unit-tested at all.
//
// **THE LOG STORES FACTS, NEVER SENTENCES**, which is why this returns numbers and names and
// the wording lives in `describeActivity.js`. Storing "You earned 4,180 gold and lie fourth in
// the world" would bake today's phrasing into every save file, and would make the figures
// unrecoverable afterwards for anything else that wanted them.

/**
 * Which of a player's territories face an enemy stronger than their own garrison.
 *
 * The game has never warned about a massing army. The AI has had this measurement from the
 * beginning -- `strongestEnemyPowerAgainst()` in `aiCalculations.js` is how a country decides
 * what to keep back on each border -- and the player had no equivalent at all, which is a
 * straightforward asymmetry rather than a difficulty setting.
 *
 * Deliberately a RAW comparison of the two army figures, with no terrain, forts or dice model
 * in it. Three reasons. It is the same shape the AI's own reserve calculation uses, so the two
 * sides are reading the world the same way. A defender's real advantage is large and would
 * make the warning fire almost never, which is worse than not having one. And the player has
 * the exact odds available on the attack screen the moment they care -- this is the nudge to
 * go and look, not a replacement for looking.
 *
 * @param {object[]} owned            the player's territories
 * @param {(territory: object) => object[]} neighboursOf  enemy neighbours of one territory
 * @param {number} [limit]            how many names the caller wants back
 * @returns {{names: string[], count: number}}  `count` is ALL of them; `names` is the worst
 *          `limit` by margin, because a card naming eleven provinces names none of them
 */
export function weakBordersFor(owned, neighboursOf, limit = 3) {
    const threatened = [];

    for (const territory of owned ?? []) {
        const garrison = Number(territory?.armyForCurrentTerritory) || 0;
        let strongest = 0;
        for (const neighbour of neighboursOf(territory) ?? []) {
            strongest = Math.max(strongest, Number(neighbour?.armyForCurrentTerritory) || 0);
        }
        if (strongest > garrison) {
            threatened.push({
                name: territory.territoryName,
                //The MARGIN and not the ratio: a province held by nobody facing an army of
                //any size is the most urgent row there is, and a ratio against a garrison of
                //zero is infinite for every one of them, which sorts them arbitrarily.
                margin: strongest - garrison
            });
        }
    }

    threatened.sort((a, b) => b.margin - a.margin);
    return {
        names: threatened.slice(0, limit).map(entry => entry.name),
        count: threatened.length
    };
}

/**
 * Everything the briefing card is made of.
 *
 * Every argument is a figure the caller already has in scope; nothing is looked up here.
 *
 * @param {object} facts
 * @param {number} facts.goldIncome     net gold this turn, upkeep already taken off
 * @param {number} facts.territories    how many the player holds
 * @param {number} facts.rank           position in the world, by progress toward the goal
 * @param {number} facts.surviving      countries still on the map
 * @param {string} facts.goalKind       a `VictoryCondition`, so the wording can name the goal
 * @param {number} facts.progressFraction  0..1 toward that goal
 * @param {{names: string[], count: number}} facts.weakBorders
 * @param {number} facts.besieging      sieges the player is prosecuting
 * @param {number} facts.besieged       sieges the player is enduring
 * @returns {object}  a plain, JSON-safe object for `recordActivity()`
 */
export function briefingFacts({
    goldIncome = 0,
    territories = 0,
    rank = 0,
    surviving = 0,
    goalKind = "",
    progressFraction = 0,
    weakBorders = { names: [], count: 0 },
    besieging = 0,
    besieged = 0
} = {}) {
    return {
        goldIncome: Math.round(Number(goldIncome) || 0),
        territories: Number(territories) || 0,
        rank: Number(rank) || 0,
        surviving: Number(surviving) || 0,
        goalKind: String(goalKind || ""),
        progressFraction: Number(progressFraction) || 0,
        weakBorderNames: [...(weakBorders?.names ?? [])],
        weakBorderCount: Number(weakBorders?.count) || 0,
        besieging: Number(besieging) || 0,
        besieged: Number(besieged) || 0
    };
}
