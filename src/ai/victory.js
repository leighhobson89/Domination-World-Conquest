// What winning means, and how far along everybody is.
//
// The Dominapedia's "Goals and Victory" page has carried the design for four victory
// conditions for some time, with the honest note that none of them was implemented and
// that nothing checks whether the game is over. This module implements the MEASUREMENT
// half of that design: what each condition asks for, and how close a given country is to
// it. It does not end the game and it does not draw anything -- the player-facing chooser
// and the "you have won" moment are still to come.
//
// It exists now because the AI needs it. An AI with no notion of what it is playing FOR
// can only be turn-local, and turn-local is exactly the behaviour the campaign layer in
// `strategy.js` replaces. The AI campaigns towards whichever condition is active, so when
// the player is finally given the chooser at the start of a game the AI adapts to their
// choice for free -- `setVictoryCondition()` is the entire seam.
//
// The default is CONTINENTAL at three continents, which is what the design names as the
// shorter, sharper game and the one that gives continent control a point.
//
// Pure: imports `config/` and `state/selectors.js` and nothing else, so it runs in Node.
// The active condition is module state rather than store state deliberately -- it is a
// setting rather than a fact about the world -- and `captureVictoryCondition()` /
// `restoreVictoryCondition()` are what `aiCalculations.js` registers as a save slice. The
// registration is done there rather than here so that this module keeps importing nothing
// from `platform/`.

import {
    CONTINENTS_REQUIRED_FOR_VICTORY,
    DOMINATION_LAND_SHARE,
    GREAT_POWERS_REQUIRED,
    VICTORY_TURN_LIMIT
} from "../config/balance.js";
import { allTerritories } from "../state/selectors.js";

/**
 * What a player may choose between, plus the defeat condition.
 *
 * ELIMINATION is deliberately NOT one of the five a player picks. It was written as a
 * victory condition and it never was one -- it is what losing means, and it now runs
 * underneath every goal rather than being an alternative to them. `hasWon()` therefore
 * always answers `false` for it; `src/rules/victoryCheck.js` is what acts on it.
 */
export const VictoryCondition = Object.freeze({
    /** Hold every territory on the map. The severe definition. */
    CONQUEST: "CONQUEST",
    /** Hold every territory on `continentsRequired` continents outright. */
    CONTINENTAL: "CONTINENTAL",
    /** Hold `landShare` of the world's land AREA -- area, not territory count. */
    DOMINATION: "DOMINATION",
    /** Hold no territories at all and you have lost. The defeat condition; needs no goal. */
    ELIMINATION: "ELIMINATION",
    /** Hold the whole HOMELAND of `greatPowersRequired` of the named `greatPowers`. */
    GREAT_POWERS: "GREAT_POWERS",
    /** At `turnLimit`, the largest empire by land area wins. */
    TURN_LIMIT: "TURN_LIMIT"
});

const DEFAULT_CONDITION = Object.freeze({
    kind: VictoryCondition.CONTINENTAL,
    continentsRequired: CONTINENTS_REQUIRED_FOR_VICTORY,
    landShare: DOMINATION_LAND_SHARE,
    turnLimit: VICTORY_TURN_LIMIT,
    /**
     * The countries a GREAT_POWERS game is about, frozen at the moment the game starts.
     *
     * They are carried on the condition rather than read back from the store's
     * `greyedOutCountries` for three reasons: this module stays pure and runnable in Node,
     * the list survives the powers being conquered and disappearing from the map, and it
     * rides into the save slice that already exists. Empty under every other condition.
     */
    greatPowers: Object.freeze([]),
    greatPowersRequired: GREAT_POWERS_REQUIRED
});

let activeCondition = { ...DEFAULT_CONDITION };

/** The condition every country -- player and AI -- is playing towards. */
export function activeVictoryCondition() {
    return activeCondition;
}

/**
 * Choose the victory condition. This is the seam the start-of-game chooser will use.
 *
 * Unknown kinds and missing fields fall back to the default, so a caller may pass
 * `{ kind: "DOMINATION" }` and get a complete, valid condition back.
 */
export function setVictoryCondition(condition) {
    const kind = Object.values(VictoryCondition).includes(condition?.kind)
        ? condition.kind
        : DEFAULT_CONDITION.kind;

    activeCondition = {
        kind,
        continentsRequired: positiveOr(condition?.continentsRequired, DEFAULT_CONDITION.continentsRequired),
        landShare: positiveOr(condition?.landShare, DEFAULT_CONDITION.landShare),
        turnLimit: positiveOr(condition?.turnLimit, DEFAULT_CONDITION.turnLimit),
        //Copied, not adopted: a caller that kept its array would otherwise be able to
        //rewrite the live condition after the fact.
        greatPowers: namesOr(condition?.greatPowers, DEFAULT_CONDITION.greatPowers),
        greatPowersRequired: positiveOr(
            condition?.greatPowersRequired, DEFAULT_CONDITION.greatPowersRequired)
    };
    return activeCondition;
}

/** Back to CONTINENTAL at three continents. Called by New Game and by the unit tests. */
export function resetVictoryCondition() {
    activeCondition = { ...DEFAULT_CONDITION, greatPowers: [] };
    return activeCondition;
}

export function captureVictoryCondition() {
    //The spread alone would hand the save the LIVE array, so a later change to the
    //condition would silently rewrite a snapshot that had already been taken.
    return { ...activeCondition, greatPowers: [...activeCondition.greatPowers] };
}

export function restoreVictoryCondition(data) {
    setVictoryCondition(data ?? DEFAULT_CONDITION);
}

function positiveOr(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** A copy of a list of country names, or the fallback. Never the caller's own array. */
function namesOr(value, fallback) {
    return Array.isArray(value) ? value.filter(name => typeof name === "string") : [...fallback];
}

/**
 * One pass over the map, reduced to per-continent holdings.
 *
 * This is the primitive both the AI and any future victory check needs, and it is
 * deliberately computed for EVERY country at once rather than for one: an AI country
 * choosing what to campaign for has to know who else is on the continent, and doing that
 * one country at a time would walk all 359 territories once per country per turn.
 *
 * @returns {{continents: Map<string, {continent: string, total: number, area: number,
 *            held: Map<string, {count: number, area: number}>}>,
 *           worldArea: number, worldTerritories: number,
 *           byCountry: Map<string, {territories: number, area: number}>}}
 */
export function worldStandings() {
    const continents = new Map();
    const byCountry = new Map();
    /**
     * Who a territory ORIGINALLY belonged to, and who holds it now -- the index
     * GREAT_POWERS is measured from. Built in this same pass because the alternative is
     * a second walk of 359 territories per country per turn.
     */
    const homelands = new Map();
    let worldArea = 0;
    let worldTerritories = 0;

    for (const territory of allTerritories()) {
        const name = territory.continent ?? "Unknown";
        const area = Number(territory.area) || 0;
        const owner = territory.dataName;
        //`originalOwner` is historical and `dataName` is the current owner; conflating the
        //two is a recurring source of bugs in this codebase, so the fallback is explicit.
        const homeland = territory.originalOwner ?? owner;

        if (!homelands.has(homeland)) {
            homelands.set(homeland, { country: homeland, total: 0, heldBy: new Map() });
        }
        const home = homelands.get(homeland);
        home.total += 1;
        home.heldBy.set(owner, (home.heldBy.get(owner) ?? 0) + 1);

        if (!continents.has(name)) {
            continents.set(name, { continent: name, total: 0, area: 0, held: new Map() });
        }
        const continent = continents.get(name);
        continent.total += 1;
        continent.area += area;
        worldArea += area;
        worldTerritories += 1;

        if (!continent.held.has(owner)) {
            continent.held.set(owner, { count: 0, area: 0 });
        }
        const holding = continent.held.get(owner);
        holding.count += 1;
        holding.area += area;

        if (!byCountry.has(owner)) {
            byCountry.set(owner, { territories: 0, area: 0 });
        }
        const country = byCountry.get(owner);
        country.territories += 1;
        country.area += area;
    }

    return { continents, worldArea, worldTerritories, byCountry, homelands };
}

/**
 * How far `country` has got through the great powers it is being asked to break.
 *
 * One row per target power, best first. A power is BROKEN when this country holds every
 * territory that power originally owned -- which routes through third parties on purpose:
 * if another country took half of the United States first, those territories have to be
 * taken from THAT country instead, and the objective becomes a different war rather than
 * an impossible one.
 *
 * Two rules that are easy to get wrong and are both here:
 *
 *   * **A country never counts its own homeland.** Every great power holds its own on turn
 *     1, so without the filter each of them would begin a five-power game already a fifth
 *     of the way to winning. The player can never be a great power, so this would only ever
 *     have gone wrong for the AI -- which is exactly why it would not have been noticed.
 *   * **The requirement is capped at the number of powers a country can actually break.**
 *     A great power has only four others to go after, so "all five" asks it for four.
 */
export function greatPowerStandingsFor(country, condition = activeVictoryCondition(),
    standings = worldStandings()) {
    const rows = (condition.greatPowers ?? [])
        .filter(power => power !== country)
        .map(power => {
            const home = standings.homelands.get(power);
            const total = home?.total ?? 0;
            const held = home?.heldBy.get(country) ?? 0;
            return {
                power,
                total,
                held,
                share: total === 0 ? 0 : held / total,
                complete: total > 0 && held === total
            };
        });

    rows.sort((a, b) => b.share - a.share || a.power.localeCompare(b.power));

    const broken = rows.filter(row => row.complete).length;
    const required = Math.min(
        positiveOr(condition.greatPowersRequired, DEFAULT_CONDITION.greatPowersRequired),
        rows.length
    );
    return { rows, broken, required };
}

/**
 * The largest empire by land AREA, with the tie-break spelled out.
 *
 * A TURN_LIMIT game is decided by this, so "they were equal" is not an acceptable answer:
 * area first, then territory count, then the name, which makes a seeded run reproduce its
 * own ending.
 */
export function leadingCountry(standings = worldStandings()) {
    let leader = null;
    let best = null;

    for (const [country, holding] of standings.byCountry) {
        if (best === null
            || holding.area > best.area
            || (holding.area === best.area && holding.territories > best.territories)
            || (holding.area === best.area && holding.territories === best.territories
                && country.localeCompare(leader) < 0)) {
            leader = country;
            best = holding;
        }
    }
    return leader;
}

/**
 * The same standings, read from one country's point of view.
 *
 * `strongestRivalShare` is what makes a continent look like a war rather than a walk, and
 * it is why a country holding 40% of Europe against a rival holding 45% will not
 * necessarily campaign for Europe.
 *
 * @returns {Array<{continent: string, total: number, held: number, share: number,
 *                  missing: number, complete: boolean, strongestRival: string|null,
 *                  strongestRivalShare: number}>} one row per continent, best share first
 */
export function continentStandingsFor(country, standings = worldStandings()) {
    const rows = [];

    for (const continent of standings.continents.values()) {
        const held = continent.held.get(country)?.count ?? 0;

        let strongestRival = null;
        let strongestRivalHeld = 0;
        for (const [owner, holding] of continent.held) {
            if (owner === country) {
                continue;
            }
            if (holding.count > strongestRivalHeld) {
                strongestRivalHeld = holding.count;
                strongestRival = owner;
            }
        }

        rows.push({
            continent: continent.continent,
            total: continent.total,
            held,
            share: continent.total === 0 ? 0 : held / continent.total,
            missing: continent.total - held,
            complete: continent.total > 0 && held === continent.total,
            strongestRival,
            strongestRivalShare: continent.total === 0 ? 0 : strongestRivalHeld / continent.total
        });
    }

    //Best share first, and the smaller continent first on a tie -- the tie-break matters
    //because it is the one a country actually finishes.
    rows.sort((a, b) => b.share - a.share || a.total - b.total ||
        a.continent.localeCompare(b.continent));
    return rows;
}

/**
 * How far this country is towards the active victory condition.
 *
 * One call answers for every condition, which is the point: the future phase-bar line
 * ("Domination: 12% of 60%") and the AI's own sense of progress read the same function,
 * so they cannot disagree.
 *
 * @returns {{kind: string, fraction: number, label: string, detail: object}}
 */
export function victoryProgress(country, condition = activeVictoryCondition(),
    standings = worldStandings(), turn = 0) {
    const rows = continentStandingsFor(country, standings);
    const holding = standings.byCountry.get(country) ?? { territories: 0, area: 0 };

    switch (condition.kind) {
        case VictoryCondition.CONQUEST: {
            //Territories, not area. Conquest asks for every territory on the map, so the
            //number a player watches should be the one the condition is written in --
            //"84% of the land" beside eleven territories still in enemy hands would read
            //as a bug rather than as the last mile.
            const total = standings.worldTerritories;
            return {
                kind: condition.kind,
                fraction: total === 0 ? 0 : clamp01(holding.territories / total),
                label: "Conquest: " + holding.territories + " of " + total + " territories",
                detail: { held: holding.territories, total }
            };
        }

        case VictoryCondition.GREAT_POWERS: {
            const { rows: powers, broken, required } = greatPowerStandingsFor(
                country, condition, standings);
            //The nearest power still standing, named. The aggregate on its own tells a
            //player nothing useful here -- "1 of 3" is the same sentence whether the next
            //one is a province away or untouched, and this is the goal whose whole value
            //is that it has antagonists.
            const next = powers.find(row => !row.complete);
            const suffix = next ? " (" + next.power + " " + next.held + "/" + next.total + ")" : "";
            return {
                kind: condition.kind,
                fraction: required === 0 ? 0 : clamp01(broken / required),
                label: "Great Powers: " + broken + " of " + required + suffix,
                detail: { broken, required, powers }
            };
        }
        case VictoryCondition.DOMINATION: {
            const share = standings.worldArea === 0 ? 0 : holding.area / standings.worldArea;
            return {
                kind: condition.kind,
                fraction: clamp01(share / condition.landShare),
                label: "Domination: " + percent(share) + " of " + percent(condition.landShare),
                detail: { landShare: share, required: condition.landShare }
            };
        }

        case VictoryCondition.ELIMINATION: {
            return {
                kind: condition.kind,
                fraction: holding.territories > 0 ? 1 : 0,
                label: holding.territories > 0 ? "In the game" : "Eliminated",
                detail: { territories: holding.territories }
            };
        }

        case VictoryCondition.TURN_LIMIT: {
            let leadingArea = 0;
            for (const entry of standings.byCountry.values()) {
                leadingArea = Math.max(leadingArea, entry.area);
            }
            const fraction = leadingArea === 0 ? 0 : clamp01(holding.area / leadingArea);
            return {
                kind: condition.kind,
                fraction,
                label: "Largest empire: " + percent(fraction) + " of the leader",
                detail: { area: holding.area, leadingArea, turnLimit: condition.turnLimit }
            };
        }

        case VictoryCondition.CONTINENTAL:
        default: {
            const required = condition.continentsRequired;
            //Progress is the sum of the shares of the best `required` continents, not the
            //count of completed ones -- a country two territories from owning Europe is
            //visibly closer to winning than one that has just landed on it, and a number
            //that only moved on completion would tell the AI nothing between the two.
            const best = rows.slice(0, required);
            const complete = rows.filter(row => row.complete).length;
            const fraction = required === 0
                ? 0
                : clamp01(best.reduce((sum, row) => sum + row.share, 0) / required);
            return {
                kind: VictoryCondition.CONTINENTAL,
                fraction,
                label: "Continental: " + complete + " of " + required + " continents",
                detail: { required, complete, continents: best }
            };
        }
    }
}

/**
 * Has this country met the active condition outright?
 *
 * `turn` is a PARAMETER rather than something this module reads from `state/phases.js`,
 * which keeps the whole file a pure function of its inputs -- a unit test can play out a
 * turn-limit game without a store, and nothing here has to know that the turn counter
 * exists. It is only consulted by TURN_LIMIT.
 *
 * ELIMINATION always answers `false`: it is the defeat condition, not a goal, and
 * `src/rules/victoryCheck.js` is what acts on it.
 */
export function hasWon(country, condition = activeVictoryCondition(),
    standings = worldStandings(), turn = 0) {
    switch (condition.kind) {
        case VictoryCondition.CONQUEST: {
            const holding = standings.byCountry.get(country) ?? { territories: 0 };
            //An exact integer test, deliberately, rather than DOMINATION at a land share of
            //1.0 -- a float comparison against the whole world is fragile at exactly the
            //boundary this condition is entirely about.
            return standings.worldTerritories > 0
                && holding.territories === standings.worldTerritories;
        }

        case VictoryCondition.CONTINENTAL:
            return continentStandingsFor(country, standings)
                .filter(row => row.complete).length >= condition.continentsRequired;

        case VictoryCondition.DOMINATION: {
            const holding = standings.byCountry.get(country) ?? { area: 0 };
            return standings.worldArea > 0
                && holding.area / standings.worldArea >= condition.landShare;
        }

        case VictoryCondition.GREAT_POWERS: {
            const { broken, required } = greatPowerStandingsFor(country, condition, standings);
            //`required > 0` matters: a condition naming no powers, or naming only this
            //country, would otherwise be met by everybody the moment the game began.
            return required > 0 && broken >= required;
        }

        case VictoryCondition.TURN_LIMIT:
            //Nobody wins a timed game early, however far ahead they are -- and at the
            //limit exactly one country does, which is what makes this answerable at all.
            return turn >= condition.turnLimit && leadingCountry(standings) === country;

        default:
            return false;
    }
}

function clamp01(value) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function percent(value) {
    return Math.round(clamp01(value) * 100) + "%";
}
