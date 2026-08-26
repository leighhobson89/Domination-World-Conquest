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
    VICTORY_TURN_LIMIT
} from "../config/balance.js";
import { allTerritories } from "../state/selectors.js";

/** The four conditions from the design. Only CONTINENTAL and DOMINATION shape AI play. */
export const VictoryCondition = Object.freeze({
    /** Hold every territory on `continentsRequired` continents outright. */
    CONTINENTAL: "CONTINENTAL",
    /** Hold `landShare` of the world's land AREA -- area, not territory count. */
    DOMINATION: "DOMINATION",
    /** Hold no territories at all and you have lost. The defeat condition; needs no goal. */
    ELIMINATION: "ELIMINATION",
    /** At `turnLimit`, the largest empire by land area wins. */
    TURN_LIMIT: "TURN_LIMIT"
});

const DEFAULT_CONDITION = Object.freeze({
    kind: VictoryCondition.CONTINENTAL,
    continentsRequired: CONTINENTS_REQUIRED_FOR_VICTORY,
    landShare: DOMINATION_LAND_SHARE,
    turnLimit: VICTORY_TURN_LIMIT
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
        turnLimit: positiveOr(condition?.turnLimit, DEFAULT_CONDITION.turnLimit)
    };
    return activeCondition;
}

/** Back to CONTINENTAL at three continents. Called by New Game and by the unit tests. */
export function resetVictoryCondition() {
    activeCondition = { ...DEFAULT_CONDITION };
    return activeCondition;
}

export function captureVictoryCondition() {
    return { ...activeCondition };
}

export function restoreVictoryCondition(data) {
    setVictoryCondition(data ?? DEFAULT_CONDITION);
}

function positiveOr(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
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
    let worldArea = 0;
    let worldTerritories = 0;

    for (const territory of allTerritories()) {
        const name = territory.continent ?? "Unknown";
        const area = Number(territory.area) || 0;
        const owner = territory.dataName;

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

    return { continents, worldArea, worldTerritories, byCountry };
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
export function victoryProgress(country, condition = activeVictoryCondition(), standings = worldStandings()) {
    const rows = continentStandingsFor(country, standings);
    const holding = standings.byCountry.get(country) ?? { territories: 0, area: 0 };

    switch (condition.kind) {
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

/** Has this country met the active condition outright? Nothing acts on this yet. */
export function hasWon(country, condition = activeVictoryCondition(), standings = worldStandings()) {
    if (condition.kind === VictoryCondition.CONTINENTAL) {
        return continentStandingsFor(country, standings)
            .filter(row => row.complete).length >= condition.continentsRequired;
    }
    if (condition.kind === VictoryCondition.DOMINATION) {
        const holding = standings.byCountry.get(country) ?? { area: 0 };
        return standings.worldArea > 0 && holding.area / standings.worldArea >= condition.landShare;
    }
    return false;
}

function clamp01(value) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function percent(value) {
    return Math.round(clamp01(value) * 100) + "%";
}
