// Who is winning, in order — the derivation behind the info panel's Standings tab.
//
// Register item E5. `worldStandings()` has always existed and was called in exactly two
// places: the ending snapshot and the phase bar's one-line goal label. So a player could
// learn that somebody else had been winning at the moment the game ended, and not before.
//
// This module is the pure half, in the same arrangement `goalCatalogue.js` has with
// `GoalSelect.js` and `topics.js` has with `Dominapedia.js`: it imports nothing, takes the
// world as an argument, and runs in Node. `renderInfoTable.js` draws what it returns.
//
// Four decisions, all of them Leigh's, and each one is a thing the table would get wrong if
// it were left to work it out itself.
//
// **RANK IS PROGRESS TOWARD THE ACTIVE GOAL, not size.** `CLAUDE.md` already draws this
// distinction for the AI -- `leadingCountry()` is the largest empire and `closestToVictory()`
// is who is winning, and under Great Powers they are routinely different countries. A table
// headed "standings" that ordered by territory count would put a sprawling empire above the
// country one province from breaking its third power, which is the opposite of what the
// player needs to know.
//
// **SIZE IS THE TIE-BREAK, and it is doing real work rather than tidying.** On turn 4 of a
// Continental game every country in the world is at "0 of 3" and the progress fractions are
// all but identical, so progress alone leaves the order undefined -- which in practice means
// insertion order, which means the table reshuffles itself for no reason a player can see.
// Territories, then name, make it total and stable.
//
// **THE PLAYER IS ALWAYS ON THE TABLE.** Sixteen rows, and if the player is not among them
// they are appended as a final row carrying their TRUE rank. A standings table that can stop
// answering "where am I" is a standings table that stops being read at exactly the point --
// losing -- when the answer matters most.
//
// **SIXTEEN IS NOT ARBITRARY.** `tools/ai-sim.mjs` reports "top-sixteen share" as its measure
// of whether the world is consolidating, so it is already the number this project thinks in.

/** How many countries the table lists before the player's pinned row. */
export const STANDINGS_LIMIT = 16;

/**
 * Rank the world by progress toward the goal in force.
 *
 * Everything is INJECTED. `progressFor` is `victoryProgress()` bound to the active condition
 * and a SHARED standings object -- shared because that function takes `standings` as a
 * parameter precisely so it does not walk 359 territories per country, and calling it 207
 * times with the default argument would do exactly that. `armyFor` is separate because
 * `worldStandings()` accumulates territories and area and not army, and adding a field to it
 * would be a change to `src/ai/` for a table's benefit.
 *
 * @param {object} options
 * @param {{byCountry: Map<string, {territories: number, area: number}>, worldArea: number}}
 *        options.standings            one `worldStandings()` snapshot
 * @param {(country: string) => {fraction: number, detail: object}} options.progressFor
 * @param {(country: string) => number} [options.armyFor]
 * @param {string} [options.player]    the player's country, marked and always included
 * @param {number} [options.limit]
 * @returns {{rows: object[], playerRow: object|null, surviving: number}}
 *          `rows` is the top `limit`, best first. `playerRow` is set ONLY when the player
 *          fell outside them, so the caller appends it rather than testing for a duplicate.
 */
export function rankedStandings({ standings, progressFor, armyFor, player, limit = STANDINGS_LIMIT }) {
    const byCountry = standings?.byCountry;
    if (!byCountry || byCountry.size === 0) {
        return { rows: [], playerRow: null, surviving: 0 };
    }

    const worldArea = Number(standings.worldArea) || 0;
    const all = [];

    for (const [country, holding] of byCountry) {
        //A country with no territories is not in `byCountry` at all -- the walk that builds
        //it is over territories -- so every row here is a country still in the game, and
        //`surviving` is just the size of the list.
        const progress = safeProgress(progressFor, country);
        all.push({
            country,
            territories: holding.territories,
            area: holding.area,
            areaShare: worldArea === 0 ? 0 : holding.area / worldArea,
            army: safeArmy(armyFor, country),
            fraction: progress.fraction,
            detail: progress.detail,
            isPlayer: Boolean(player) && country === player
        });
    }

    all.sort(compareStandings);
    all.forEach((row, index) => {
        row.rank = index + 1;
    });

    const rows = all.slice(0, limit);
    const playerRow = player && !rows.some(row => row.isPlayer)
        ? (all.find(row => row.isPlayer) ?? null)
        : null;

    return { rows, playerRow, surviving: all.length };
}

/**
 * Best first: progress, then size, then name.
 *
 * The name is the last resort and it exists for determinism rather than for meaning -- two
 * countries identical in both of the first two would otherwise swap places between renders,
 * because `Map` iteration order is insertion order and a conquest changes it.
 */
function compareStandings(a, b) {
    if (b.fraction !== a.fraction) {
        return b.fraction - a.fraction;
    }
    if (b.territories !== a.territories) {
        return b.territories - a.territories;
    }
    return a.country.localeCompare(b.country);
}

/**
 * `victoryProgress()` for one country, or a zeroed row.
 *
 * Guarded because this is called once per surviving country -- up to 207 times -- while a
 * panel is being drawn, and one country in an odd state should cost the player a row rather
 * than the whole table. A thrown error here would take the info panel down with it.
 */
function safeProgress(progressFor, country) {
    try {
        const progress = progressFor?.(country);
        return {
            fraction: Number.isFinite(progress?.fraction) ? progress.fraction : 0,
            detail: progress?.detail ?? {}
        };
    } catch {
        return { fraction: 0, detail: {} };
    }
}

function safeArmy(armyFor, country) {
    try {
        return Number(armyFor?.(country)) || 0;
    } catch {
        return 0;
    }
}

/**
 * The player's own row out of a `rankedStandings()` result, or null.
 *
 * `playerRow` is set ONLY when the player missed the cut, so a caller that wants the row
 * whatever their position -- the turn-start briefing does -- has to look in both places.
 * Getting that wrong gives a briefing that silently stops mentioning your rank as soon as you
 * do well enough to make the table.
 */
export function playerStanding(result) {
    if (!result) {
        return null;
    }
    return result.playerRow ?? result.rows?.find(row => row.isPlayer) ?? null;
}
