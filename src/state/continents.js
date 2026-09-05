// Who holds what, per continent. The one definition of "holds a continent outright".
//
// Continents are everywhere in this game and have never been worth anything: the economy
// scales a territory's output by which continent it sits on, the AI commits to three of them
// and plans a whole campaign around finishing one, and the default victory condition is "hold
// every territory on three continents". The continent-bonus phase makes a completed continent
// pay, and this module is the primitive it -- and the AI, and any future victory check --
// reads.
//
// WHY IT LIVES IN `state/`. `worldStandings()` in `src/ai/victory.js` already did this walk,
// and importing it from the economy is not possible: `src/rules/victoryCheck.js` imports
// `src/ai/victory.js`, so an `ai -> rules` edge on top of `rules -> ai` would close a
// package-level cycle that this codebase has spent whole phases getting out of. `src/ai/` and
// `src/rules/` both already depend on `src/state/selectors.js`, and this is the same kind of
// thing: a pure read over territories.
//
// PURE. It imports nothing at all, takes its territories as an argument, and runs in Node.
// The LIVE view -- the memoised walk over the real store, and the multiplier it produces --
// is `src/state/continentBonus.js`, deliberately a separate module so that this one stays a
// function of its inputs.
//
// CONTROL IS DERIVED, NEVER STORED. A territory changes hands and a continent's control
// changes with it; there must be no "who holds this continent" that a conquest has to
// remember to update. `CLAUDE.md` records three stored derivations that all failed the same
// way -- the map colour snapshot, `territoryAboutToBeAttackedOrSieged`, `underSiege` as a
// field -- and this is the same shape.

/**
 * @typedef {object} ContinentHolding
 * @property {number} count  territories held
 * @property {number} area   land area held
 */

/**
 * @typedef {object} ContinentRow
 * @property {string} continent
 * @property {number} total  territories on the continent
 * @property {number} area   land area of the continent
 * @property {Map<string, ContinentHolding>} held  owner -> what they hold of it
 */

/**
 * Fold one territory into a control map, creating the continent's row if it is the first.
 *
 * This is the seam `worldStandings()` uses. That function walks all 359 territories once a
 * turn building three indexes at the same time, so it calls THIS rather than
 * `continentControl()` below -- one definition of what a continent holding is, and still one
 * pass over the map.
 *
 * A territory with no continent is filed under `"Unknown"` rather than under `undefined`, so
 * that a malformed row cannot silently become a continent nobody can name.
 *
 * @param {Map<string, ContinentRow>} control  mutated in place
 * @param {object} territory
 * @returns {ContinentRow} the row the territory was added to
 */
export function accumulateContinent(control, territory) {
    const name = territory.continent ?? "Unknown";
    const owner = territory.dataName;
    const area = Number(territory.area) || 0;

    if (!control.has(name)) {
        control.set(name, { continent: name, total: 0, area: 0, held: new Map() });
    }
    const row = control.get(name);
    row.total += 1;
    row.area += area;

    if (!row.held.has(owner)) {
        row.held.set(owner, { count: 0, area: 0 });
    }
    const holding = row.held.get(owner);
    holding.count += 1;
    holding.area += area;

    return row;
}

/**
 * One pass over a set of territories, reduced to per-continent holdings.
 *
 * Every territory counts, whatever is happening to it. Two of those are decisions rather than
 * accidents and both are asserted in `tests/unit/state-continents.spec.js`:
 *
 *   * **A besieged territory counts.** You hold it; a siege is a thing happening to it. (It
 *     earns nothing itself while besieged -- a separate, existing rule, untouched.)
 *   * **A freshly conquered, deactivated territory counts.** The lockout is about what a
 *     territory can DO, not about who owns it.
 *
 * @param {Iterable<object>} territories
 * @returns {Map<string, ContinentRow>}
 */
export function continentControl(territories) {
    const control = new Map();
    for (const territory of territories ?? []) {
        accumulateContinent(control, territory);
    }
    return control;
}

/**
 * Does `owner` hold every territory on `continent`?
 *
 * All or nothing, deliberately, and it is the same threshold the CONTINENTAL victory
 * condition uses -- a bonus with a different threshold would mean the game measured "holding
 * a continent" two different ways, and the two would drift.
 *
 * A continent with no territories on it answers `false`. Under a naive `held === total` test
 * it is vacuously held by everybody, which would hand a bonus to all 207 countries the first
 * time an empty continent appeared in the map data.
 *
 * @param {string} owner
 * @param {string} continent
 * @param {Map<string, ContinentRow>} control
 * @returns {boolean}
 */
export function holdsContinentOutright(owner, continent, control) {
    const row = control?.get?.(continent);
    if (!row || row.total === 0) {
        return false;
    }
    return (row.held.get(owner)?.count ?? 0) === row.total;
}

/**
 * Every continent `owner` holds whole, named, alphabetically.
 *
 * Alphabetical rather than in map order because this is what the info panel and the manual
 * read, and a list whose order depends on which territory happened to be walked first is a
 * list that reorders itself as the world changes.
 *
 * @param {string} owner
 * @param {Map<string, ContinentRow>} control
 * @returns {string[]}
 */
export function continentsHeldOutrightBy(owner, control) {
    const names = [];
    for (const row of control?.values?.() ?? []) {
        if (holdsContinentOutright(owner, row.continent, control)) {
            names.push(row.continent);
        }
    }
    return names.sort((a, b) => a.localeCompare(b));
}
