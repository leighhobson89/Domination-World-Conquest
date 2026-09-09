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
 * @param {string[]|Set<string>} [options.defeated]  countries that hold no territory, from
 *        `src/state/defeated.js`. They are NOT in `standings.byCountry` -- see below
 * @param {number} [options.limit]
 * @returns {{rows: object[], playerRow: object|null, surviving: number,
 *            defeatedRows: object[]}}
 *          `rows` is the top `limit`, best first. `playerRow` is set ONLY when the player
 *          fell outside them, so the caller appends it rather than testing for a duplicate.
 *          `defeatedRows` is everybody who is out, alphabetically, for the caller to append
 *          below a separator.
 */
export function rankedStandings({
    standings,
    progressFor,
    armyFor,
    player,
    defeated = [],
    limit = STANDINGS_LIMIT
}) {
    const byCountry = standings?.byCountry;
    if (!byCountry || byCountry.size === 0) {
        return { rows: [], playerRow: null, surviving: 0, defeatedRows: [] };
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

    //WHO IS OUT, AND WHY THEY HAVE TO BE ADDED RATHER THAN FILTERED. `worldStandings()` is a
    //fold over TERRITORIES, so a country holding none is not in `byCountry` at all -- it does
    //not rank badly, it is simply absent, and the table quietly stopped mentioning it the
    //turn it lost its last province. That is the right ranking and the wrong record: a player
    //who has just conquered somebody wants to see that they did.
    //
    //THEY ARE A SEPARATE LIST AND NOT PART OF THE RANKING. Sorting them in would put them
    //below every survivor anyway (no progress, no territory), so they would never reach the
    //top sixteen and the change would be invisible -- which is the whole complaint. The
    //caller appends them under a separator instead.
    //
    //ALPHABETICAL, because there is nothing else to order them by: the register does not
    //record the turn a country fell, and inventing an order out of `Set` iteration would
    //reshuffle the list between renders for no visible reason.
    const defeatedRows = [...defeated]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map((country, index) => ({
            country,
            defeated: true,
            rank: all.length + index + 1,
            territories: 0,
            area: 0,
            areaShare: 0,
            army: 0,
            fraction: 0,
            detail: {},
            isPlayer: Boolean(player) && country === player
        }));

    return { rows, playerRow, surviving: all.length, defeatedRows };
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
